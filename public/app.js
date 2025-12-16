let ofertasActuales = [];
let ofertaEditando = null;
let estadisticasActuales = null;
let apiStatus = 'checking';

document.addEventListener('DOMContentLoaded', () => {
    console.log('Inicializando Sistema de Ofertas de Empleo...');
    verificarConexionAPI();
    configurarFormulario();
    configurarFechaPorDefecto();
    cargarOfertas();
    cargarEstadisticas();
    configurarEventos();
    alertify.set('notifier', 'position', 'top-right');
    alertify.set('notifier', 'delay', 5);
});

function configurarFormulario() {
    const form = document.getElementById('ofertaForm');
    form.addEventListener('submit', manejarEnvioFormulario);
    const campos = form.querySelectorAll('input[required], textarea[required]');
    campos.forEach(campo => {
        campo.addEventListener('blur', () => validarCampo(campo));
        campo.addEventListener('input', () => limpiarError(campo));
    });
}

function configurarFechaPorDefecto() {
    const fechaInput = document.getElementById('fechaFinal');
    const hoy = new Date();
    const fechaFutura = new Date(hoy);
    fechaFutura.setDate(fechaFutura.getDate() + 30);
    
    const fechaFormateada = fechaFutura.toISOString().split('T')[0];
    fechaInput.min = hoy.toISOString().split('T')[0];
    fechaInput.value = fechaFormateada;
}

function configurarEventos() {
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') buscarOfertas();
    });
    
    document.getElementById('knowledgeInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') buscarPorConocimiento();
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') cerrarModal();
    });
    
    setInterval(() => {
        if (document.visibilityState === 'visible') {
            cargarEstadisticas();
        }
    }, 30000);
}

async function verificarConexionAPI() {
    try {
        const respuesta = await fetch('/health');
        if (respuesta.ok) {
            apiStatus = 'connected';
            actualizarEstadoAPI('✅ Conectado', 'success');
        } else {
            apiStatus = 'error';
            actualizarEstadoAPI('❌ Error de conexión', 'error');
        }
    } catch (error) {
        apiStatus = 'offline';
        actualizarEstadoAPI('⚠️ Sin conexión', 'warning');
    }
}

function actualizarEstadoAPI(mensaje, tipo) {
    const badge = document.getElementById('apiStatus');
    const footerStatus = document.getElementById('apiStatusFooter');
    
    badge.innerHTML = `<i class="fas fa-circle"></i> ${mensaje}`;
    footerStatus.textContent = mensaje;
    
    badge.className = `status-badge ${tipo}`;
    footerStatus.className = tipo;
}

async function cargarOfertas() {
    mostrarCargaOfertas();
    
    try {
        const respuesta = await fetch('/api/ofertas');
        if (!respuesta.ok) throw new Error(`Error ${respuesta.status}: ${respuesta.statusText}`);
        
        ofertasActuales = await respuesta.json();
        mostrarOfertas(ofertasActuales);
        actualizarContadores();
        
        mostrarExito(`Se cargaron ${ofertasActuales.length} ofertas`);
    } catch (error) {
        mostrarError('Error al cargar ofertas: ' + error.message);
        mostrarErrorOfertas();
    }
}

function mostrarCargaOfertas() {
    const container = document.getElementById('listaOfertas');
    container.innerHTML = `
        <div class="loading-ofertas">
            <i class="fas fa-spinner fa-spin fa-2x"></i>
            <p>Cargando ofertas...</p>
        </div>
    `;
}

function mostrarErrorOfertas() {
    const container = document.getElementById('listaOfertas');
    container.innerHTML = `
        <div class="error-ofertas">
            <i class="fas fa-exclamation-triangle fa-3x"></i>
            <h3>Error al cargar ofertas</h3>
            <p>No se pudieron cargar las ofertas. Verifica la conexión.</p>
            <button onclick="cargarOfertas()" class="btn-primary">
                <i class="fas fa-sync-alt"></i> Reintentar
            </button>
        </div>
    `;
}

function mostrarOfertas(ofertas) {
    const container = document.getElementById('listaOfertas');
    
    if (ofertas.length === 0) {
        container.innerHTML = `
            <div class="no-data">
                <i class="fas fa-inbox fa-4x"></i>
                <h3>No hay ofertas disponibles</h3>
                <p>Crea la primera oferta haciendo clic en "Nueva Oferta"</p>
                <button onclick="mostrarFormularioCrear()" class="btn-primary">
                    <i class="fas fa-plus"></i> Crear Primera Oferta
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = ofertas.map(oferta => crearCardOferta(oferta)).join('');
}

function crearCardOferta(oferta) {
    const conocimientos = Array.isArray(oferta.Requisitos.Conocimientos) 
        ? oferta.Requisitos.Conocimientos 
        : (typeof oferta.Requisitos.Conocimientos === 'string' 
            ? oferta.Requisitos.Conocimientos.split(',').map(s => s.trim())
            : []);
    
    const fechaVencimiento = new Date(oferta.FechaFinal.split('/').reverse().join('-'));
    const hoy = new Date();
    const diasRestantes = Math.ceil((fechaVencimiento - hoy) / (1000 * 60 * 60 * 24));
    const vencimientoClass = diasRestantes < 7 ? 'vencido' : diasRestantes < 30 ? 'proximo' : 'normal';
    
    return `
        <div class="card" data-id="${oferta.NroId}">
            <div class="card-header">
                <h3 class="card-title">${oferta.Puesto}</h3>
                <div>
                    <span class="card-badge">$${oferta.PagoMensual.toLocaleString()}/mes</span>
                    <span class="vencimiento-badge ${vencimientoClass}" 
                          data-tooltip="${diasRestantes > 0 ? `${diasRestantes} días restantes` : 'Vencido'}">
                        <i class="fas fa-clock"></i> ${diasRestantes > 0 ? `${diasRestantes}d` : 'Vencido'}
                    </span>
                </div>
            </div>
            
            <div class="card-company">
                <i class="fas fa-building"></i>
                ${oferta.Empresa.RazonSoc}
            </div>
            
            <div class="card-details">
                <div class="detail-item">
                    <span class="detail-label">
                        <i class="fas fa-map-marker-alt"></i> Ubicación:
                    </span>
                    <span class="detail-value">${oferta.Empresa.Distrito}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">
                        <i class="fas fa-graduation-cap"></i> Formación:
                    </span>
                    <span class="detail-value">${oferta.Requisitos.Formacion}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">
                        <i class="fas fa-chart-line"></i> Experiencia:
                    </span>
                    <span class="detail-value">${oferta.Experiencia} años</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">
                        <i class="fas fa-calendar-alt"></i> Vence:
                    </span>
                    <span class="detail-value">${oferta.FechaFinal}</span>
                </div>
            </div>
            
            <div class="card-skills">
                <div class="skills-title">
                    <i class="fas fa-code"></i> Conocimientos requeridos:
                    <span class="skills-count">${conocimientos.length}</span>
                </div>
                <div class="skills-list">
                    ${conocimientos.map(conocimiento => 
                        `<span class="skill-tag">${conocimiento}</span>`
                    ).slice(0, 5).join('')}
                    ${conocimientos.length > 5 ? 
                        `<span class="skill-tag more" data-tooltip="${conocimientos.slice(5).join(', ')}">
                            +${conocimientos.length - 5} más
                        </span>` : ''}
                </div>
            </div>
            
            <div class="card-actions">
                <button onclick="editarOferta(${oferta.NroId})" class="btn-primary">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button onclick="verDetalles(${oferta.NroId})" class="btn-secondary">
                    <i class="fas fa-eye"></i> Ver Detalles
                </button>
                <button onclick="duplicarOferta(${oferta.NroId})" class="btn-success">
                    <i class="fas fa-copy"></i> Duplicar
                </button>
            </div>
        </div>
    `;
}

async function buscarOfertas() {
    const busqueda = document.getElementById('searchInput').value.trim();
    const campo = document.getElementById('filterField').value;
    
    if (!busqueda && campo !== 'PagoMensual') {
        cargarOfertas();
        return;
    }
    
    mostrarCargaOfertas();
    
    try {
        let url;
        if (campo === 'PagoMensual') {
            const valor = busqueda || '0';
            url = `/api/ofertas/buscar/${campo}/${valor}`;
        } else {
            url = `/api/ofertas/buscar/${campo}/${encodeURIComponent(busqueda)}`;
        }
        
        const respuesta = await fetch(url);
        if (!respuesta.ok) throw new Error('Error en la búsqueda');
        
        const resultados = await respuesta.json();
        mostrarOfertas(resultados);
        
        mostrarExito(`🔍 ${resultados.length} resultados encontrados`);
    } catch (error) {
        mostrarError('Error en la búsqueda: ' + error.message);
        mostrarErrorOfertas();
    }
}

async function buscarPorConocimiento() {
    const conocimiento = document.getElementById('knowledgeInput').value.trim();
    
    if (!conocimiento) {
        alertify.error('Por favor, ingresa un conocimiento para buscar');
        document.getElementById('knowledgeInput').focus();
        return;
    }
    
    try {
        alertify.message(`Buscando: ${conocimiento}...`);
        
        const respuesta = await fetch(`/api/ofertas/conocimiento/${encodeURIComponent(conocimiento)}`);
        if (!respuesta.ok) throw new Error('Error en la búsqueda');
        
        const data = await respuesta.json();
        mostrarResultadosConocimiento(data);
        
    } catch (error) {
        alertify.error('Error en la búsqueda: ' + error.message);
    }
}

function mostrarResultadosConocimiento(data) {
    const modal = document.getElementById('knowledgeModal');
    const resultsContainer = document.getElementById('knowledgeResults');
    
    if (data.totalResultados === 0) {
        resultsContainer.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search fa-3x"></i>
                <h3>No se encontraron resultados</h3>
                <p>No hay ofertas que requieran el conocimiento: <strong class="highlight">${data.conocimientoBuscado}</strong></p>
                <p>Intenta con otro término de búsqueda o verifica la ortografía.</p>
            </div>
        `;
    } else {
        resultsContainer.innerHTML = `
            <div class="results-summary">
                <h4><i class="fas fa-info-circle"></i> Resultados de búsqueda</h4>
                <p>Se encontraron <strong>${data.totalResultados}</strong> ofertas que requieren el conocimiento: 
                <strong class="highlight">${data.conocimientoBuscado}</strong></p>
                <p><small><i class="fas fa-lightbulb"></i> Los conocimientos resaltados en amarillo coinciden con tu búsqueda.</small></p>
            </div>
            
            <table class="results-table">
                <thead>
                    <tr>
                        <th width="8%">ID</th>
                        <th width="22%">Empresa</th>
                        <th width="15%">Puesto</th>
                        <th width="55%">Conocimientos Requeridos</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.resultados.map(item => `
                        <tr>
                            <td>
                                <span class="badge" style="background: #3498db; color: white; padding: 5px 10px; border-radius: 10px;">
                                    ${item.NroId}
                                </span>
                            </td>
                            <td><strong>${item.Empresa}</strong></td>
                            <td>${item.Puesto}</td>
                            <td class="conocimientos-cell">
                                <div class="conocimientos-list">
                                    ${item.Conocimientos.map(conoc => {
                                        const esHTML = conoc.includes('<span');
                                        if (esHTML) {
                                            return `<span class="conocimiento-item highlighted">${conoc.replace(/<\/?span[^>]*>/g, '')}</span>`;
                                        }
                                        return `<span class="conocimiento-item">${conoc}</span>`;
                                    }).join('')}
                                </div>
                                <small style="color: #7f8c8d; margin-top: 8px; display: block; font-size: 0.85rem;">
                                    <i class="fas fa-hashtag"></i> ${item.TotalConocimientos} conocimientos totales
                                    ${item.MatchCount > 1 ? ` · <i class="fas fa-bullseye"></i> ${item.MatchCount} coincidencias` : ''}
                                </small>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <div style="margin-top: 25px; padding: 15px; background: linear-gradient(135deg, #f8f9fa, #e9ecef); border-radius: 10px; border-left: 4px solid #3498db;">
                <p style="margin: 0; display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-chart-pie" style="color: #3498db;"></i>
                    <strong>Análisis:</strong> 
                    ${data.resultados.length} ofertas requieren <strong>${data.conocimientoBuscado}</strong>.
                    ${data.resultados.some(r => r.MatchCount > 1) ? 
                        'Algunas ofertas requieren este conocimiento múltiples veces.' : ''}
                </p>
            </div>
        `;
    }
    
    modal.style.display = 'flex';
}

function mostrarFormularioCrear() {
    ofertaEditando = null;
    document.getElementById('formTitle').innerHTML = '<i class="fas fa-plus"></i> Nueva Oferta';
    document.getElementById('btnEliminar').style.display = 'none';
    document.getElementById('nroId').value = '';
    const form = document.getElementById('ofertaForm');
    form.reset();
    configurarFechaPorDefecto();
    mostrarFormulario();
    document.getElementById('puesto').focus();
}

async function editarOferta(id) {
    try {
        const respuesta = await fetch(`/api/ofertas/${id}`);
        if (!respuesta.ok) throw new Error('Error al cargar oferta');
        
        ofertaEditando = await respuesta.json();
        document.getElementById('formTitle').innerHTML = '<i class="fas fa-edit"></i> Editar Oferta';
        document.getElementById('btnEliminar').style.display = 'inline-flex';
        document.getElementById('nroId').value = ofertaEditando.NroId;
        document.getElementById('puesto').value = ofertaEditando.Puesto || '';
        document.getElementById('empresa').value = ofertaEditando.Empresa?.RazonSoc || '';
        document.getElementById('direccion').value = ofertaEditando.Empresa?.Direccion || '';
        document.getElementById('distrito').value = ofertaEditando.Empresa?.Distrito || '';
        document.getElementById('formacion').value = ofertaEditando.Requisitos?.Formacion || '';
        const conocimientos = Array.isArray(ofertaEditando.Requisitos?.Conocimientos)
            ? ofertaEditando.Requisitos.Conocimientos.join(', ')
            : ofertaEditando.Requisitos?.Conocimientos || '';
        document.getElementById('conocimientos').value = conocimientos;
        document.getElementById('experiencia').value = ofertaEditando.Experiencia || 0;
        document.getElementById('pagoMensual').value = ofertaEditando.PagoMensual || 0;
        document.getElementById('fechaFinal').value = ofertaEditando.FechaFinal || '';
        mostrarFormulario();
        
    } catch (error) {
        mostrarError('Error al cargar oferta: ' + error.message);
    }
}

function mostrarFormulario() {
    document.getElementById('formContainer').style.display = 'block';
    document.getElementById('formContainer').scrollIntoView({ behavior: 'smooth' });
}

function ocultarFormulario() {
    document.getElementById('formContainer').style.display = 'none';
    ofertaEditando = null;
}

async function manejarEnvioFormulario(event) {
    event.preventDefault();
    
    if (!validarFormulario()) {
        return;
    }
    
    const form = event.target;
    const ofertaData = construirOfertaData(form);
    
    try {
        const boton = form.querySelector('button[type="submit"]');
        const textoOriginal = boton.innerHTML;
        boton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        boton.disabled = true;
        
        let respuesta;
        let mensaje;
        
        if (ofertaEditando) {
            respuesta = await fetch(`/api/ofertas/${ofertaEditando.NroId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ofertaData)
            });
            mensaje = 'Oferta actualizada';
        } else {
            respuesta = await fetch('/api/ofertas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ofertaData)
            });
            mensaje = 'Oferta creada';
        }
        
        if (!respuesta.ok) {
            const errorData = await respuesta.json();
            throw new Error(errorData.error || 'Error en la operación');
        }
        
        mostrarExito(mensaje);
        form.reset();
        ocultarFormulario();
        
        await Promise.all([
            cargarOfertas(),
            cargarEstadisticas()
        ]);
        
    } catch (error) {
        mostrarError('Error: ' + error.message);
    } finally {
        const boton = form.querySelector('button[type="submit"]');
        boton.innerHTML = '<i class="fas fa-save"></i> Guardar Oferta';
        boton.disabled = false;
    }
}

function construirOfertaData(form) {
    const formData = new FormData(form);
    const ofertaData = {};
    
    formData.forEach((value, key) => {
        if (key.includes('.')) {
            const keys = key.split('.');
            let obj = ofertaData;
            for (let i = 0; i < keys.length - 1; i++) {
                if (!obj[keys[i]]) obj[keys[i]] = {};
                obj = obj[keys[i]];
            }
            obj[keys[keys.length - 1]] = value;
        } else if (key === 'Experiencia' || key === 'PagoMensual') {
            ofertaData[key] = parseInt(value) || 0;
        } else if (key !== 'nroId') {
            ofertaData[key] = value;
        }
    });
    
    if (ofertaData.Requisitos && ofertaData.Requisitos.Conocimientos) {
        ofertaData.Requisitos.Conocimientos = ofertaData.Requisitos.Conocimientos
            .split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0);
    }
    
    return ofertaData;
}

async function eliminarOferta() {
    if (!ofertaEditando) return;
    
    alertify.confirm(
        'Confirmar Eliminación',
        `¿Estás seguro de eliminar la oferta "${ofertaEditando.Puesto}" de ${ofertaEditando.Empresa.RazonSoc}?<br><br>
        <strong>Esta acción no se puede deshacer.</strong>`,
        async () => {
            try {
                const respuesta = await fetch(`/api/ofertas/${ofertaEditando.NroId}`, {
                    method: 'DELETE'
                });
                
                if (!respuesta.ok) throw new Error('Error al eliminar oferta');
                
                mostrarExito('🗑️ Oferta eliminada exitosamente');
                ocultarFormulario();
                
                await Promise.all([
                    cargarOfertas(),
                    cargarEstadisticas()
                ]);
                
            } catch (error) {
                mostrarError('Error al eliminar oferta: ' + error.message);
            }
        },
        () => {
            alertify.message('Eliminación cancelada');
        }
    );
}

async function cargarEstadisticas() {
    try {
        const respuesta = await fetch('/api/estadisticas');
        if (!respuesta.ok) throw new Error('Error al cargar estadísticas');
        
        estadisticasActuales = await respuesta.json();
        mostrarEstadisticas(estadisticasActuales);
    } catch (error) {
        document.getElementById('statsContainer').innerHTML = `
            <div class="error-stats" style="grid-column: 1 / -1; text-align: center; padding: 40px;">
                <i class="fas fa-exclamation-triangle fa-3x" style="color: #e74c3c; margin-bottom: 15px;"></i>
                <h3 style="color: #e74c3c; margin-bottom: 10px;">Error al cargar estadísticas</h3>
                <p style="color: #7f8c8d;">${error.message}</p>
                <button onclick="cargarEstadisticas()" class="btn-primary" style="margin-top: 15px;">
                    <i class="fas fa-sync-alt"></i> Reintentar
                </button>
            </div>
        `;
    }
}

function mostrarEstadisticas(stats) {
    const container = document.getElementById('statsContainer');
    
    if (stats.totalOfertas === 0) {
        container.innerHTML = `
            <div class="no-stats" style="grid-column: 1 / -1; text-align: center; padding: 60px;">
                <i class="fas fa-chart-bar fa-4x" style="color: #bdc3c7; margin-bottom: 20px;"></i>
                <h3 style="color: #7f8c8d; margin-bottom: 10px;">No hay datos para mostrar</h3>
                <p style="color: #95a5a6;">Agrega ofertas para ver estadísticas</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <!-- Total de Ofertas -->
        <div class="stat-card primary">
            <div class="stat-icon">
                <i class="fas fa-briefcase"></i>
            </div>
            <div class="stat-value">${stats.totalOfertas}</div>
            <div class="stat-label">Total de Ofertas</div>
            <div class="stat-detail">
                <div class="stat-detail-item">
                    <span class="stat-detail-label">Empresa líder:</span>
                    <span class="stat-detail-value">${stats.empresaMasOfertas.nombre}</span>
                </div>
                <div class="stat-detail-item">
                    <span class="stat-detail-label">Ofertas:</span>
                    <span class="stat-detail-value">${stats.empresaMasOfertas.cantidad}</span>
                </div>
            </div>
        </div>
        
        <!-- Promedio Salarial -->
        <div class="stat-card success">
            <div class="stat-icon">
                <i class="fas fa-money-bill-wave"></i>
            </div>
            <div class="stat-value">$${parseFloat(stats.promedioSalario).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
            <div class="stat-label">Salario Promedio</div>
            <div class="stat-detail">
                <div class="stat-detail-item">
                    <span class="stat-detail-label">Máximo:</span>
                    <span class="stat-detail-value">$${stats.salarioMaximo.toLocaleString()}</span>
                </div>
                <div class="stat-detail-item">
                    <span class="stat-detail-label">Mínimo:</span>
                    <span class="stat-detail-value">$${stats.salarioMinimo.toLocaleString()}</span>
                </div>
            </div>
        </div>
        
        <!-- Promedio Experiencia -->
        <div class="stat-card warning">
            <div class="stat-icon">
                <i class="fas fa-chart-line"></i>
            </div>
            <div class="stat-value">${stats.promedioExperiencia}</div>
            <div class="stat-label">Años de Experiencia</div>
            <div class="stat-detail">
                <div class="stat-detail-item">
                    <span class="stat-detail-label">Promedio requerido</span>
                    <span class="stat-detail-value">${stats.promedioExperiencia} años</span>
                </div>
            </div>
        </div>
        
        <!-- Conocimientos Demandados -->
        <div class="stat-card danger">
            <div class="stat-icon">
                <i class="fas fa-code"></i>
            </div>
            <div class="stat-value">Top 5</div>
            <div class="stat-label">Conocimientos más Demandados</div>
            <div class="stat-detail">
                ${stats.conocimientosMasDemandados.map(item => `
                    <div class="stat-detail-item">
                        <span class="stat-detail-label">${item.conocimiento}:</span>
                        <span class="stat-detail-value">${item.cantidad} (${item.porcentaje})</span>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <!-- Distribución por Puesto -->
        <div class="stat-card info">
            <div class="stat-icon">
                <i class="fas fa-users"></i>
            </div>
            <div class="stat-value">${stats.distribucionPuestos.length}</div>
            <div class="stat-label">Tipos de Puestos</div>
            <div class="stat-detail">
                ${stats.distribucionPuestos.slice(0, 3).map(item => `
                    <div class="stat-detail-item">
                        <span class="stat-detail-label">${item.puesto}:</span>
                        <span class="stat-detail-value">${item.cantidad}</span>
                    </div>
                `).join('')}
                ${stats.distribucionPuestos.length > 3 ? 
                    `<div class="stat-detail-item">
                        <span class="stat-detail-label">...</span>
                        <span class="stat-detail-value">+${stats.distribucionPuestos.length - 3} más</span>
                    </div>` : ''}
            </div>
        </div>
    `;
}

function verDetalles(id) {
    const oferta = ofertasActuales.find(o => o.NroId === id);
    if (!oferta) return;
    
    const conocimientos = Array.isArray(oferta.Requisitos.Conocimientos) 
        ? oferta.Requisitos.Conocimientos 
        : [];
    
    alertify.alert()
        .setting({
            'title': `<i class="fas fa-info-circle"></i> Detalles de la Oferta`,
            'label': 'Cerrar',
            'message': `
                <div style="max-width: 500px;">
                    <h3 style="color: #2c3e50; margin-bottom: 20px; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
                        ${oferta.Puesto}
                    </h3>
                    
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                        <h4 style="color: #3498db; margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
                            <i class="fas fa-building"></i> Información de la Empresa
                        </h4>
                        <p><strong>Empresa:</strong> ${oferta.Empresa.RazonSoc}</p>
                        <p><strong>Dirección:</strong> ${oferta.Empresa.Direccion}</p>
                        <p><strong>Distrito:</strong> ${oferta.Empresa.Distrito}</p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                        <h4 style="color: #27ae60; margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
                            <i class="fas fa-user-tie"></i> Requisitos del Puesto
                        </h4>
                        <p><strong>Formación:</strong> ${oferta.Requisitos.Formacion}</p>
                        <p><strong>Experiencia:</strong> ${oferta.Experiencia} años</p>
                        <p><strong>Salario:</strong> $${oferta.PagoMensual.toLocaleString()} mensuales</p>
                        <p><strong>Vence:</strong> ${oferta.FechaFinal}</p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 10px;">
                        <h4 style="color: #9b59b6; margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
                            <i class="fas fa-code"></i> Conocimientos Requeridos (${conocimientos.length})
                        </h4>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                            ${conocimientos.map(conoc => 
                                `<span style="background: #3498db; color: white; padding: 5px 10px; border-radius: 15px; font-size: 0.9rem;">
                                    ${conoc}
                                </span>`
                            ).join('')}
                        </div>
                    </div>
                    
                    <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #ddd; text-align: center;">
                        <small style="color: #7f8c8d;">
                            <i class="fas fa-id-card"></i> ID: ${oferta.NroId} | 
                            <i class="fas fa-database"></i> Actualizado: ${new Date().toLocaleDateString()}
                        </small>
                    </div>
                </div>
            `
        }).show();
}

async function duplicarOferta(id) {
    try {
        const respuesta = await fetch(`/api/ofertas/${id}`);
        if (!respuesta.ok) throw new Error('Error al obtener oferta');
        
        const oferta = await respuesta.json();
        const ofertaCopia = { ...oferta };
        delete ofertaCopia._id;
        delete ofertaCopia.NroId;
        ofertaCopia.Puesto = `${oferta.Puesto} (Copia)`;
        const respuestaCrear = await fetch('/api/ofertas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ofertaCopia)
        });
        
        if (!respuestaCrear.ok) throw new Error('Error al duplicar oferta');
        
        mostrarExito('Oferta duplicada');
        cargarOfertas();
        
    } catch (error) {
        mostrarError('Error al duplicar oferta: ' + error.message);
    }
}

function exportarEstadisticas() {
    if (!estadisticasActuales) {
        mostrarError('No hay estadísticas para exportar');
        return;
    }
    
    const contenido = `Estadísticas del Sistema de Ofertas de Empleo
===========================================
Fecha: ${new Date().toLocaleString()}
Total de Ofertas: ${estadisticasActuales.totalOfertas}
Salario Promedio: $${estadisticasActuales.promedioSalario}
Experiencia Promedio: ${estadisticasActuales.promedioExperiencia} años
Salario Máximo: $${estadisticasActuales.salarioMaximo}
Salario Mínimo: $${estadisticasActuales.salarioMinimo}
Empresa con más ofertas: ${estadisticasActuales.empresaMasOfertas.nombre} (${estadisticasActuales.empresaMasOfertas.cantidad})

Conocimientos más demandados:
${estadisticasActuales.conocimientosMasDemandados.map(item => `  • ${item.conocimiento}: ${item.cantidad} ofertas (${item.porcentaje})`).join('\n')}

===========================================
Sistema de Ofertas de Empleo - Versión 2.0
`;
    
    descargarArchivo(contenido, 'estadisticas-ofertas.txt', 'text/plain');
    mostrarExito('📊 Estadísticas exportadas');
}

function exportarOfertas() {
    if (ofertasActuales.length === 0) {
        mostrarError('No hay ofertas para exportar');
        return;
    }
    
    const csv = convertirOfertasACSV();
    descargarArchivo(csv, 'ofertas-empleo.csv', 'text/csv');
    mostrarExito('📄 Ofertas exportadas a CSV');
}

function exportarResultadosBusqueda() {
    const modal = document.getElementById('knowledgeModal');
    const table = modal.querySelector('.results-table');
    
    if (!table) {
        mostrarError('No hay resultados para exportar');
        return;
    }
    
    let csv = 'ID,Empresa,Puesto,Conocimientos\n';
    const rows = table.querySelectorAll('tbody tr');
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        const id = cells[0].textContent.trim();
        const empresa = cells[1].textContent.trim();
        const puesto = cells[2].textContent.trim();
        const conocimientos = Array.from(cells[3].querySelectorAll('.conocimiento-item'))
            .map(item => item.textContent.trim())
            .join('; ');
        
        csv += `"${id}","${empresa}","${puesto}","${conocimientos}"\n`;
    });
    
    const conocimiento = document.getElementById('knowledgeInput').value.trim();
    const nombreArchivo = `busqueda-${conocimiento.replace(/[^a-z0-9]/gi, '-')}.csv`;
    
    descargarArchivo(csv, nombreArchivo, 'text/csv');
    mostrarExito('🔍 Resultados de búsqueda exportados');
}

function convertirOfertasACSV() {
    let csv = 'ID,Puesto,Empresa,Direccion,Distrito,Formacion,Experiencia,Salario,Fecha,Conocimientos\n';
    
    ofertasActuales.forEach(oferta => {
        const conocimientos = Array.isArray(oferta.Requisitos.Conocimientos)
            ? oferta.Requisitos.Conocimientos.join('; ')
            : oferta.Requisitos.Conocimientos || '';
        
        csv += `"${oferta.NroId}","${oferta.Puesto}","${oferta.Empresa.RazonSoc}","${oferta.Empresa.Direccion}","${oferta.Empresa.Distrito}","${oferta.Requisitos.Formacion}","${oferta.Experiencia}","${oferta.PagoMensual}","${oferta.FechaFinal}","${conocimientos}"\n`;
    });
    
    return csv;
}

function descargarArchivo(contenido, nombre, tipo) {
    const blob = new Blob([contenido], { type: tipo });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.download = nombre;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function actualizarContadores() {
    document.getElementById('ofertasCounter').textContent = ofertasActuales.length;
    document.getElementById('ofertasCountFooter').textContent = ofertasActuales.length;
}

function cerrarModal() {
    document.getElementById('knowledgeModal').style.display = 'none';
}

window.onclick = function(event) {
    const modal = document.getElementById('knowledgeModal');
    if (event.target === modal) {
        cerrarModal();
    }
}

function validarFormulario() {
    const form = document.getElementById('ofertaForm');
    const campos = form.querySelectorAll('input[required], textarea[required]');
    let valido = true;
    
    campos.forEach(campo => {
        if (!validarCampo(campo)) {
            valido = false;
        }
    });
    
    return valido;
}

function validarCampo(campo) {
    const valor = campo.value.trim();
    const nombre = campo.name.replace(/\./g, ' ');
    
    if (!valor) {
        mostrarErrorCampo(campo, `El campo "${nombre}" es requerido`);
        return false;
    }
    
    if (campo.name === 'PagoMensual' || campo.name === 'Experiencia') {
        const num = parseFloat(valor);
        if (isNaN(num) || num < 0) {
            mostrarErrorCampo(campo, `El valor debe ser un número positivo`);
            return false;
        }
    }
    
    if (campo.name === 'FechaFinal') {
        const fecha = new Date(valor);
        const hoy = new Date();
        if (fecha < hoy) {
            mostrarErrorCampo(campo, 'La fecha no puede ser anterior a hoy');
            return false;
        }
    }
    
    limpiarError(campo);
    return true;
}

function mostrarErrorCampo(campo, mensaje) {
    limpiarError(campo);
    
    const error = document.createElement('div');
    error.className = 'error-message';
    error.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${mensaje}`;
    error.style.color = '#e74c3c';
    error.style.fontSize = '0.85rem';
    error.style.marginTop = '5px';
    
    campo.parentNode.appendChild(error);
    campo.style.borderColor = '#e74c3c';
}

function limpiarError(campo) {
    const error = campo.parentNode.querySelector('.error-message');
    if (error) error.remove();
    campo.style.borderColor = '';
}

function mostrarExito(mensaje) {
    alertify.success(mensaje);
    console.log('✅ ' + mensaje);
}

function mostrarError(mensaje) {
    alertify.error(mensaje);
    console.error('❌ ' + mensaje);
}