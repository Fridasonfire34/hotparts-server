const express = require('express');
const sql = require('mssql');

module.exports = (config) => {
    const router = express.Router();

    router.post('/verificarCodigos', async (req, res) => {
        const { folios, codigoEntrega, nomina } = req.body;
        console.log("Folios recibidos para verificar Código:", folios);

        if (!folios || folios.length === 0 || !codigoEntrega || !nomina) {
            return res.status(400).json({
                success: false,
                message: 'Faltan parámetros: folios, código de entrega o nómina.'
            });
        }

        try {
            const pool = await sql.connect(config);

            const foliosStr = folios.map(folio => `'${folio}'`).join(',');

            const result = await pool.request()
                .input('folios', sql.NVarChar, foliosStr)
                .query(`
                    SELECT * FROM Codigos
                    WHERE Folio IN (${foliosStr}) AND [Cantidad Entrega] = [Cantidad Recibida]
                `);

            const codigos = result.recordset;

            if (codigos.length > 0) {
                const invalidCodigos = codigos.filter(codigo => codigo['Codigo Entrega'] !== codigoEntrega);

                if (invalidCodigos.length > 0) {
                    return res.status(400).json({
                        success: false,
                        message: `El código de entrega no coincide para los siguientes folios: ${invalidCodigos.map(item => item.Folio).join(', ')}`
                    });
                }

                const cantidadInvalida = codigos.find(codigo => codigo['Cantidad Entrega'] !== codigo['Cantidad Recibida']);
                if (cantidadInvalida) {
                    return res.status(400).json({
                        success: false,
                        message: 'Las cantidades a entregar son diferentes a las cantidades que se reciben, por favor verifica la información.'
                    });
                }

                const requestUpdate = new sql.Request();
                requestUpdate.input('codigoEntrega', sql.NVarChar, codigoEntrega);
                requestUpdate.input('nomina', sql.Float, parseFloat(nomina));

                await requestUpdate.query(`
                    UPDATE Codigos
                    SET [Usuario Entrega] = @nomina,
                        [Cantidad Recibida] = [Cantidad Entrega],
                        [Fecha y Hora] = GETDATE()
                    WHERE Folio IN (${foliosStr})
                `);

                res.json({
                    success: true,
                    message: 'Códigos de entrega validados y estatus actualizado a Producción para todos los folios.'
                });
            } else {
                const requestInsert = new sql.Request();
                const codigosNuevos = folios.map(folio => {
                    const codigoEntregaNuevo = generateRandomCode();
                    requestInsert.input('folio', sql.NVarChar, folio);
                    requestInsert.input('codigoEntrega', sql.NVarChar, codigoEntregaNuevo);
                    requestInsert.input('nomina', sql.Float, parseFloat(nomina));

                    return requestInsert.query(`
                        INSERT INTO Codigos (Folio, [Codigo Entrega], [Usuario Recibe], [Fecha y Hora])
                        VALUES (@folio, @codigoEntrega, @nomina, GETDATE())
                    `);
                });

                await Promise.all(codigosNuevos);

                res.json({
                    success: true,
                    message: 'No se encontraron folios, se crearon nuevos registros con códigos de entrega.',
                    codigoEntrega: codigosNuevos.map(() => generateRandomCode())
                });
            }
        } catch (err) {
            console.error('Error al verificar los códigos:', err);
            res.status(500).send('Error al verificar los códigos');
        }
    });

    return router;
};
