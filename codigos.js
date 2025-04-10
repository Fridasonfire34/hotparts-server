const sql = require('mssql');
const crypto = require('crypto');

module.exports = (config) => {
    const express = require('express');
    const router = express.Router();

    const generateRandomCode = () => {
        return crypto.randomBytes(3).toString('hex').toUpperCase();
    };

    router.post('/generarCodigo', async (req, res) => {
        const { folios, nomina } = req.body;
        console.log("Nomina recibido en el backend:", nomina);
        console.log("Folios recibidos: ", folios);

        if (!folios || folios.length === 0 || !nomina) {
            return res.status(400).json({
                success: false,
                message: 'Faltan parámetros: folios o nomina.'
            });
        }

        const codigoEntrega = generateRandomCode();

        try {
            await sql.connect(config);

            const requestCheck = new sql.Request();
            requestCheck.input('nomina', sql.Float, parseFloat(nomina));

            const placeholders = folios.map((_, index) => `@folio${index}`).join(', ');
            folios.forEach((folio, index) => {
                requestCheck.input(`folio${index}`, sql.NVarChar, folio);
            });

            const result = await requestCheck.query(`
                SELECT [Folio], [Codigo Entrega], [Usuario Recibe]
                FROM Codigos 
                WHERE Folio IN (${placeholders})
            `);

            if (result.recordset.length > 0) {
                const existingFolios = result.recordset.filter(item => item['Codigo Entrega']);
                if (existingFolios.length > 0) {
                    res.json({
                        message: `Códigos de entrega ya existen para los siguientes folios: ${existingFolios.map(item => item.Folio).join(', ')}`,
                        codigoEntrega: existingFolios.map(item => item['Codigo Entrega'])
                    });
                    return;
                }

                // Actualizamos los registros de los folios
                const requestUpdate = new sql.Request();
                requestUpdate.input('codigoEntrega', sql.NVarChar, codigoEntrega);
                requestUpdate.input('nomina', sql.Float, parseFloat(nomina));

                const updatePlaceholders = folios.map((_, index) => `@folio${index}`).join(', ');
                folios.forEach((folio, index) => {
                    requestUpdate.input(`folio${index}`, sql.NVarChar, folio);
                });

                await requestUpdate.query(`
                    UPDATE Codigos
                    SET [Codigo Entrega] = @codigoEntrega, [Usuario Recibe] = @nomina
                    WHERE Folio IN (${updatePlaceholders})
                `);

                res.json({
                    message: 'Códigos de entrega generados y Usuario Recibe actualizado para todos los folios.',
                    codigoEntrega: codigoEntrega
                });
            } else {
                // Insertamos nuevos registros para los folios
                const requestInsert = new sql.Request();
                requestInsert.input('codigoEntrega', sql.NVarChar, codigoEntrega);
                requestInsert.input('nomina', sql.Float, parseFloat(nomina));

                const insertValues = folios.map(folio => `('${folio}', @codigoEntrega, @nomina)`).join(', ');
                await requestInsert.query(`
                    INSERT INTO Codigos (Folio, [Codigo Entrega], [Usuario Recibe]) 
                    VALUES ${insertValues}
                `);

                res.json({
                    message: 'Registros creados con el Código de Entrega para todos los folios.',
                    codigoEntrega: codigoEntrega
                });
            }
        } catch (err) {
            console.error('Error al generar o actualizar el código:', err);
            res.status(500).send('Error al generar o actualizar el código de entrega');
        }
    });

    return router;
};
