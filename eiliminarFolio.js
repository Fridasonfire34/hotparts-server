const express = require('express');
const sql = require('mssql');

module.exports = (config) => {
    const router = express.Router();

    router.post('/eliminarFolio', async (req, res) => {
        const { folio } = req.body;

        if (!folio) {
            return res.status(400).json({ success: false, message: 'El folio es requerido' });
        }

        try {
            const pool = await sql.connect(config);

            const eliminarQuery = `
                DELETE FROM Codigos
                WHERE Folio = @folio
            `;

            const result = await pool.request()
                .input('folio', sql.NVarChar, folio)
                .query(eliminarQuery);

            if (result.rowsAffected[0] > 0) {
                res.status(200).json({ success: true, message: 'Folio eliminado correctamente' });
            } else {
                res.status(404).json({ success: false, message: 'No se encontró el folio' });
            }

        } catch (err) {
            console.error('Error al eliminar el folio:', err);
            res.status(500).send('Error al procesar la solicitud de eliminación del folio');
        }
    });

    return router;
};
