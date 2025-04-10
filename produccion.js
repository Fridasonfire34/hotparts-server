const express = require('express');
const sql = require('mssql');

module.exports = (config) => {
    const router = express.Router();

    router.get('/produccion', async (req, res) => {
        try {
            await sql.connect(config);

            const result = await sql.query("SELECT * FROM Produccion WHERE Estatus = 'Producción' AND [Cantidad Faltante por Entregar] <> 0");

            res.json(result.recordset);
        } catch (err) {
            console.error('Error al obtener las piezas de produccion:', err);
            res.status(500).send('Error al obtener las piezas de produccion');
        }
    });

    return router;
};
