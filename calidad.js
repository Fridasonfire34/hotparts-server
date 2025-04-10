const express = require('express');
const sql = require('mssql');

module.exports = (config) => {
    const router = express.Router();

    router.get('/calidad', async (req, res) => {
        try {
            await sql.connect(config);

            const result = await sql.query("SELECT * FROM Calidad WHERE Estatus = 'Calidad' AND [Cantidad Faltante] <> 0");

            res.json(result.recordset);
        } catch (err) {
            console.error('Error al obtener las piezas de calidad:', err);
            res.status(500).send('Error al obtener las piezas de calidad');
        }
    });

    return router;
};
