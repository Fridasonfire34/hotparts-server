const express = require('express');
const sql = require('mssql');

module.exports = (config) => {
    const router = express.Router();

    router.post('/eliminarCodigos', async (req, res) => {
        try {
            const pool = await sql.connect(config);

            const deleteQuery = 'DELETE FROM Codigos';

            await pool.request().query(deleteQuery);

            console.log('Todas las filas fueron eliminadas de la tabla Codigos');

            return res.status(200).json({
                success: true,
                message: 'Todas las filas fueron eliminadas de la tabla Codigos exitosamente.'
            });
        } catch (err) {
            console.error('Error al eliminar las filas:', err.message);
            return res.status(500).json({
                success: false,
                message: 'Hubo un error al eliminar las filas de la tabla Codigos.',
                error: err.message
            });
        }
    });

    return router;
};
