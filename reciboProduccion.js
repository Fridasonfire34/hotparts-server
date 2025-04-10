const express = require('express');
const sql = require('mssql');
const axios = require('axios');

module.exports = (config) => {
    const router = express.Router();

    router.post('/reciboProduccion', async (req, res) => {
        const { folios, nomina } = req.body;
        console.log("Folios recibidos:", folios);

        if (!folios || folios.length === 0 || !nomina) {
            return res.status(400).json({
                success: false,
                message: 'Faltan parámetros: folios o nómina.'
            });
        }

        try {
            const pool = await sql.connect(config);
            const fechaHoraActual = new Date().toISOString();

            const folioParams = folios.map((_, index) => `@folio${index}`).join(', ');

            const updateCodigosQuery = `
                UPDATE Codigos
                SET Estatus = 'Producción'
                WHERE Folio IN (${folioParams})
            `;
            const requestCodigos = pool.request();
            folios.forEach((folio, index) => {
                requestCodigos.input(`folio${index}`, sql.NVarChar, folio);
            });
            await requestCodigos.query(updateCodigosQuery);
            console.log('Actualización en la tabla Codigos');

            const updateProgramacionQuery = `
                UPDATE Programacion
                SET Estatus = 'Producción', [Usuario Entrega] = @nomina, [Hora Salida] = GETDATE()
                WHERE Folio IN (${folioParams})
            `;
            const requestProgramacion = pool.request();
            requestProgramacion.input('nomina', sql.Float, parseFloat(nomina));
            requestProgramacion.input('fechaHoraActual', sql.DateTime, fechaHoraActual);
            folios.forEach((folio, index) => {
                requestProgramacion.input(`folio${index}`, sql.NVarChar, folio);
            });
            await requestProgramacion.query(updateProgramacionQuery);
            console.log('Actualización en la tabla Programacion');

            const queryProgramacion = `
                SELECT Folio, Secuencia, [Orden de Compra], [Numero de Parte], Cantidad
                FROM Programacion
                WHERE Folio IN (${folioParams})
            `;
            const resultProgramacion = await pool.request();
            folios.forEach((folio, index) => {
                resultProgramacion.input(`folio${index}`, sql.NVarChar, folio);
            });
            const resultProgramacionQuery = await resultProgramacion.query(queryProgramacion);
            console.log('Consulta en la tabla Programacion');
            console.log('Folios a insertar en la tabla Produccion: ', folios);

            if (resultProgramacionQuery.recordset.length === 0) {
                return res.status(400).json({ success: false, message: 'Folio no encontrado en la tabla Programacion' });
            }

            const insertProduccionQuery = `
                INSERT INTO Produccion (Folio, Estatus)
                VALUES (@folio, 'Producción')
            `;

            const insertResults = [];

            for (const record of resultProgramacionQuery.recordset) {
                const folioParams = record.Folio;

                const requestProduccion = pool.request();
                requestProduccion.input('folio', sql.NVarChar, folioParams);

                await requestProduccion.query(insertProduccionQuery);
                console.log(`Inserción en Producción exitosa para el folio: ${folioParams}`);

                const selectProgramacionQuery = `
                    SELECT Secuencia, [Numero de Parte], [Orden de Compra], Cantidad
                    FROM Programacion
                    WHERE Folio = @folio
                `;

                const requestProgramacionMatch = pool.request();
                requestProgramacionMatch.input('folio', sql.NVarChar, folioParams);

                const resultProgramacionMatch = await requestProgramacionMatch.query(selectProgramacionQuery);

                if (resultProgramacionMatch.recordset.length > 0) {
                    const matchedRecord = resultProgramacionMatch.recordset[0];

                    const updateProduccionQuery = `
                        UPDATE Produccion
                        SET Secuencia = @secuencia,
                            [Numero de Parte] = @numeroParte,
                            [Orden de Compra] = @ordenCompra,
                            [Cantidad Original] = @cantidadOriginal,
                            [Hora Ingreso] = GETDATE()
                        WHERE Folio = @folio AND [Cantidad Original] IS NULL
                    `;

                    const requestUpdateProduccion = pool.request();

                    requestUpdateProduccion.input('folio', sql.NVarChar, folioParams);
                    requestUpdateProduccion.input('secuencia', sql.NVarChar, matchedRecord.Secuencia);
                    requestUpdateProduccion.input('numeroParte', sql.NVarChar, matchedRecord['Numero de Parte']);
                    requestUpdateProduccion.input('ordenCompra', sql.NVarChar, matchedRecord['Orden de Compra']);
                    requestUpdateProduccion.input('cantidadOriginal', sql.Int, matchedRecord.Cantidad);

                    await requestUpdateProduccion.query(updateProduccionQuery);
                    console.log(`Actualización en Producción exitosa para el folio: ${folioParams}`);
                }
            }

            return res.status(200).json({
                success: true,
                message: 'Los folios fueron insertados y actualizados en Producción exitosamente.',
                data: insertResults
            });

        } catch (err) {
            console.error('Error general:', err.message);
            return res.status(500).json({
                success: false,
                message: 'Hubo un error al procesar la solicitud.',
                error: err.message
            });
        }
    });

    return router;
};
