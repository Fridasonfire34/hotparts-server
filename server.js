const express = require('express');
const sql = require('mssql');
const loginRoutes = require('./login');
const programacionRoutes = require('./programacion');
const calidadRoutes = require('./calidad');
const codigosRoutes = require('./codigos');
const ProduccionRoutes = require('./produccion');
const ReciboProduccionRoutes = require('./reciboProduccion');
const ReciboCalidadRoutes = require('./reciboCalidad');
const ReciboEmbarquesRoutes = require('./reciboEmbarques');
const VerificarCodigoRoutes = require('./verificarCodigo');
const CantidadEntregaRoutes = require('./cantidadEntrega');
const CantidadTodoRoutes = require('./cantidadTodo');
const GuardarMovimientoRoutes = require('./guardarMovimiento');
const eliminarCodigosRoutes = require('./eliminarCodigos');
const cantidadReciboRoutes = require('./cantidadRecibo');


const app = express();
const port = 3000;

app.use(express.json());

const config = {
    user: 'sa',
    password: 'TMPdb1124',
    server: '192.168.16.146',
    database: 'HotParts',
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};

app.get('/test-db', async (req, res) => {
    try {
        await sql.connect(config);
        const result = await sql.query('SELECT TOP 1 * FROM [Usuarios]');
        res.json(result.recordset);
    } catch (err) {
        console.error('Error de conexión:', err);
        res.status(500).send('Error de conexión a la base de datos');
    }
});

app.use('/api', loginRoutes(config));
app.use('/api', programacionRoutes(config));
app.use('/api', codigosRoutes(config));
app.use('/api', calidadRoutes(config));
app.use('/api', ProduccionRoutes(config));
app.use('/api', ReciboProduccionRoutes(config));
app.use('/api', ReciboCalidadRoutes(config));
app.use('/api', ReciboEmbarquesRoutes(config));
app.use('/api', VerificarCodigoRoutes(config));
app.use('/api', CantidadEntregaRoutes(config));
app.use('/api', CantidadTodoRoutes(config));
app.use('/api', GuardarMovimientoRoutes(config));
app.use('/api', eliminarCodigosRoutes(config));
app.use('/api', cantidadReciboRoutes(config));

app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});
