const sql = require('mssql');

module.exports = (config) => {
    const express = require('express');
    const router = express.Router();

    router.post('/login', async (req, res) => {
        const { nomina, password } = req.body;

        try {
            await sql.connect(config);

            const result = await sql.query(`
                SELECT * FROM Usuarios 
                WHERE Nomina = '${nomina}' AND Password = '${password}'
            `);

            if (result.recordset.length > 0) {
                res.json({ message: 'Login exitoso', user: result.recordset[0] });
            } else {
                res.status(401).json({ message: 'Credenciales incorrectas' });
            }
        } catch (err) {
            console.error('Error en la consulta de login:', err);
            res.status(500).send('Error en el servidor');
        }
    });

    return router;
};
