const express = require('express');
const sql = require('mssql');

module.exports = (config) => {
    const router = express.Router();

    router.get('/programacion', async (req, res) => {
        try {
            await sql.connect(config);

            const result = await sql.query("SELECT * FROM Programacion WHERE Estatus = 'Programacion'");

            res.json(result.recordset);
        } catch (err) {
            console.error('Error al obtener las piezas de programación:', err);
            res.status(500).send('Error al obtener las piezas de programación');
        }
    });

    return router;
};
