import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const corsOptions = {
    origin: process.env.NODE_ENV === 'production' 
        ? ['*'] 
        : ['http://localhost:3000'],
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static('public'));

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/BDEmpleos";
const client = new MongoClient(uri);

async function connectDB() {
    try {
        await client.connect();
        console.log("Conectado a MongoDB");
        return client.db("BDEmpleos").collection("Ofertas");
    } catch (error) {
        console.error("Error conectando a MongoDB:", error);
        throw error;
    }
}

app.get('/api/ofertas', async (req, res) => {
    try {
        const collection = await connectDB();
        const ofertas = await collection.find({}).sort({ NroId: 1 }).toArray();
        res.json(ofertas);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener ofertas" });
    }
});

app.get('/api/ofertas/:id', async (req, res) => {
    try {
        const collection = await connectDB();
        const oferta = await collection.findOne({ NroId: parseInt(req.params.id) });
        if (oferta) {
            res.json(oferta);
        } else {
            res.status(404).json({ error: "Oferta no encontrada" });
        }
    } catch (error) {
        res.status(500).json({ error: "Error al obtener la oferta" });
    }
});

app.post('/api/ofertas', async (req, res) => {
    try {
        const collection = await connectDB();
        const nuevaOferta = req.body;
        const camposRequeridos = ['Puesto', 'Empresa', 'Requisitos', 'Experiencia', 'PagoMensual', 'FechaFinal'];
        for (const campo of camposRequeridos) {
            if (!nuevaOferta[campo]) {
                return res.status(400).json({ error: `El campo ${campo} es requerido` });
            }
        }
        const ultimaOferta = await collection.find().sort({ NroId: -1 }).limit(1).toArray();
        nuevaOferta.NroId = ultimaOferta.length > 0 ? ultimaOferta[0].NroId + 1 : 1;
        
        const result = await collection.insertOne(nuevaOferta);
        res.status(201).json({ 
            message: "Oferta creada exitosamente", 
            id: result.insertedId,
            nroId: nuevaOferta.NroId
        });
    } catch (error) {
        res.status(500).json({ error: "Error al crear oferta: " + error.message });
    }
});

app.put('/api/ofertas/:id', async (req, res) => {
    try {
        const collection = await connectDB();
        const filter = { NroId: parseInt(req.params.id) };
        const updateData = req.body;
        
        const result = await collection.replaceOne(filter, updateData);
        
        if (result.modifiedCount > 0) {
            res.json({ message: "Oferta actualizada exitosamente" });
        } else {
            res.status(404).json({ error: "Oferta no encontrada" });
        }
    } catch (error) {
        res.status(500).json({ error: "Error al actualizar oferta" });
    }
});

app.delete('/api/ofertas/:id', async (req, res) => {
    try {
        const collection = await connectDB();
        const result = await collection.deleteOne({ NroId: parseInt(req.params.id) });
        
        if (result.deletedCount > 0) {
            res.json({ message: "Oferta eliminada exitosamente" });
        } else {
            res.status(404).json({ error: "Oferta no encontrada" });
        }
    } catch (error) {
        res.status(500).json({ error: "Error al eliminar oferta" });
    }
});

app.get('/api/ofertas/buscar/:campo/:valor', async (req, res) => {
    try {
        const collection = await connectDB();
        const { campo, valor } = req.params;
        
        let query = {};
        if (campo === 'Puesto' || campo === 'Empresa.RazonSoc' || campo === 'Distrito') {
            query[campo] = { $regex: valor, $options: 'i' };
        } else if (campo === 'PagoMensual') {
            query[campo] = { $gte: parseInt(valor) };
        }
        
        const ofertas = await collection.find(query).toArray();
        res.json(ofertas);
    } catch (error) {
        res.status(500).json({ error: "Error en la búsqueda" });
    }
});

app.get('/api/estadisticas', async (req, res) => {
    try {
        const collection = await connectDB();
        const ofertas = await collection.find({}).toArray();
        
        if (ofertas.length === 0) {
            return res.json({
                totalOfertas: 0,
                mensaje: "No hay ofertas para calcular estadísticas"
            });
        }
        
        const salarios = ofertas.map(o => o.PagoMensual);
        const experiencias = ofertas.map(o => o.Experiencia);
        
        const promedioSalario = salarios.reduce((a, b) => a + b, 0) / salarios.length;
        const promedioExperiencia = experiencias.reduce((a, b) => a + b, 0) / experiencias.length;
        
        const salarioMax = Math.max(...salarios);
        const salarioMin = Math.min(...salarios);
        const empresaCounts = {};
        ofertas.forEach(oferta => {
            const empresa = oferta.Empresa.RazonSoc;
            empresaCounts[empresa] = (empresaCounts[empresa] || 0) + 1;
        });
        
        const empresaMasOfertas = Object.entries(empresaCounts)
            .sort((a, b) => b[1] - a[1])[0];
        const conocimientoCounts = {};
        ofertas.forEach(oferta => {
            const conocimientos = Array.isArray(oferta.Requisitos.Conocimientos) 
                ? oferta.Requisitos.Conocimientos 
                : [];
            
            conocimientos.forEach(conocimiento => {
                conocimientoCounts[conocimiento] = (conocimientoCounts[conocimiento] || 0) + 1;
            });
        });
        
        const conocimientosMasDemandados = Object.entries(conocimientoCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
        
        res.json({
            totalOfertas: ofertas.length,
            promedioSalario: promedioSalario.toFixed(2),
            promedioExperiencia: promedioExperiencia.toFixed(1),
            salarioMaximo: salarioMax,
            salarioMinimo: salarioMin,
            empresaMasOfertas: {
                nombre: empresaMasOfertas[0],
                cantidad: empresaMasOfertas[1]
            },
            conocimientosMasDemandados: conocimientosMasDemandados.map(([conocimiento, count]) => ({
                conocimiento,
                cantidad: count,
                porcentaje: ((count / ofertas.length) * 100).toFixed(1) + '%'
            })),
            distribucionPuestos: Object.entries(
                ofertas.reduce((acc, o) => {
                    acc[o.Puesto] = (acc[o.Puesto] || 0) + 1;
                    return acc;
                }, {})
            ).map(([puesto, count]) => ({
                puesto,
                cantidad: count
            }))
        });
        
    } catch (error) {
        res.status(500).json({ error: "Error al calcular estadísticas" });
    }
});

app.get('/api/ofertas/conocimiento/:conocimiento', async (req, res) => {
    try {
        const collection = await connectDB();
        const conocimiento = req.params.conocimiento;
        
        const ofertas = await collection.find({
            'Requisitos.Conocimientos': {
                $regex: conocimiento,
                $options: 'i'
            }
        }).toArray();
        
        const resultados = ofertas.map(oferta => {
            const conocimientos = Array.isArray(oferta.Requisitos.Conocimientos) 
                ? oferta.Requisitos.Conocimientos 
                : [];
            
            const conocimientosFormateados = conocimientos.map(conoc => {
                if (conoc.toLowerCase().includes(conocimiento.toLowerCase())) {
                    return `<span class="highlight">${conoc}</span>`;
                }
                return conoc;
            });
            
            return {
                NroId: oferta.NroId,
                Empresa: oferta.Empresa.RazonSoc,
                Conocimientos: conocimientosFormateados,
                Puesto: oferta.Puesto,
                TotalConocimientos: conocimientos.length,
                MatchCount: conocimientos.filter(c => 
                    c.toLowerCase().includes(conocimiento.toLowerCase())
                ).length
            };
        }).sort((a, b) => b.MatchCount - a.MatchCount);
        
        res.json({
            conocimientoBuscado: conocimiento,
            totalResultados: resultados.length,
            resultados
        });
        
    } catch (error) {
        res.status(500).json({ error: "Error en la búsqueda por conocimiento" });
    }
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        service: 'Sistema de Ofertas de Empleo API'
    });
});

app.get('/api', (req, res) => {
    res.json({ 
        message: 'API de Sistema de Ofertas de Empleo',
        version: '2.0.0',
        endpoints: {
            ofertas: {
                todas: 'GET /api/ofertas',
                porId: 'GET /api/ofertas/:id',
                crear: 'POST /api/ofertas',
                actualizar: 'PUT /api/ofertas/:id',
                eliminar: 'DELETE /api/ofertas/:id'
            },
            busquedas: {
                general: 'GET /api/ofertas/buscar/:campo/:valor',
                porConocimiento: 'GET /api/ofertas/conocimiento/:conocimiento'
            },
            estadisticas: 'GET /api/estadisticas',
            salud: 'GET /health'
        }
    });
});

app.get('*', (req, res) => {
    res.sendFile('index.html', { root: 'public' });
});

app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({ 
        error: 'Error interno del servidor',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
    console.log(`Modo: ${process.env.NODE_ENV || 'development'}`);
    console.log(`API disponible en: http://localhost:${port}/api`);
    console.log(`Health check: http://localhost:${port}/health`);
});