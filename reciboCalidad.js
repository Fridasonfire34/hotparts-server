const express = require('express');
const sql = require('mssql');

module.exports = (config) => {
    const router = express.Router();

    router.post('/reciboCalidad', async (req, res) => {
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
            const folioParams = folios.map((_, i) => `@folio${i}`).join(', ');

            // 1. Actualizar Codigos -> Estatus = 'Calidad'
            const updateCodigosQuery = `
                UPDATE Codigos
                SET Estatus = 'Calidad'
                WHERE Folio IN (${folioParams})
            `;
            const requestCodigos = pool.request();
            folios.forEach((folio, i) => {
                requestCodigos.input(`folio${i}`, sql.NVarChar, folio);
            });
            await requestCodigos.query(updateCodigosQuery);
            console.log('Codigos actualizados');

            // 2. Sumar Cantidad Entrega de Codigos a Produccion.Cantidad Entregada a Calidad
            const updateCantidadQuery = `
                UPDATE P
                SET P.[Cantidad Entregada a Calidad] = ISNULL(P.[Cantidad Entregada a Calidad], 0) + ISNULL(C.[Cantidad Entrega], 0)
                FROM Produccion P
                INNER JOIN Codigos C ON P.Folio = C.Folio
                WHERE P.Folio IN (${folioParams})
            `;
            const requestCantidad = pool.request();
            folios.forEach((folio, i) => {
                requestCantidad.input(`folio${i}`, sql.NVarChar, folio);
            });
            await requestCantidad.query(updateCantidadQuery);
            console.log('Cantidad Entregada a Calidad actualizada en Produccion');

            // 3. Actualizar Produccion solo si Cantidad Faltante por Entregar es 0
            const updateProduccionQuery = `
                UPDATE Produccion
                SET Estatus = 'Calidad', [Usuario Entrega] = @nomina
                WHERE Folio IN (${folioParams}) AND [Cantidad Faltante por Entregar] = 0
            `;
            const requestProduccion = pool.request();
            requestProduccion.input('nomina', sql.Float, parseFloat(nomina));
            folios.forEach((folio, i) => {
                requestProduccion.input(`folio${i}`, sql.NVarChar, folio);
            });
            await requestProduccion.query(updateProduccionQuery);
            console.log('Produccion actualizada');

            // 4. Actualizar Programacion
            const updateProgramacionQuery = `
                UPDATE Programacion
                SET Estatus = 'Calidad', [Usuario Entrega] = @nomina
                WHERE Folio IN (${folioParams})
            `;
            const requestProgramacion = pool.request();
            requestProgramacion.input('nomina', sql.Float, parseFloat(nomina));
            folios.forEach((folio, i) => {
                requestProgramacion.input(`folio${i}`, sql.NVarChar, folio);
            });
            await requestProgramacion.query(updateProgramacionQuery);
            console.log('Programacion actualizada');

            // 5. Consultar datos desde Codigos
            const selectCodigosQuery = `
                SELECT Folio, [Orden de Compra], [Numero de Parte], [Cantidad Entrega]
                FROM Codigos
                WHERE Folio IN (${folioParams})
            `;
            const requestCodigosSelect = pool.request();
            folios.forEach((folio, i) => {
                requestCodigosSelect.input(`folio${i}`, sql.NVarChar, folio);
            });
            const codigosResult = await requestCodigosSelect.query(selectCodigosQuery);

            for (const codigo of codigosResult.recordset) {
                const { Folio, ['Orden de Compra']: OrdenCompra, ['Numero de Parte']: NumeroParte, ['Cantidad Entrega']: CantidadEntrega } = codigo;

                // 5. Buscar si el folio ya existe en Calidad
                const checkCalidadQuery = `
                    SELECT COUNT(*) as count FROM Calidad WHERE Folio = @folio
                `;
                const requestCheck = pool.request();
                requestCheck.input('folio', sql.NVarChar, Folio);
                const checkResult = await requestCheck.query(checkCalidadQuery);

                if (checkResult.recordset[0].count > 0) {
                    // 5.1 Existe → Sumar Cantidad Entrega a Cantidad Recibida
                    const updateCalidadQuery = `
                        UPDATE Calidad
                        SET [Cantidad Recibida] = ISNULL([Cantidad Recibida], 0) + ISNULL(@cantidadEntrega, 0),
                            [Hora Ingreso] = GETDATE()
                        WHERE Folio = @folio
                    `;
                    const requestUpdate = pool.request();
                    requestUpdate.input('folio', sql.NVarChar, Folio);
                    requestUpdate.input('cantidadEntrega', sql.Int, CantidadEntrega);
                    await requestUpdate.query(updateCalidadQuery);
                    console.log(`Actualizado Calidad (existente): ${Folio}`);
                } else {
                    // 5.2 No existe → Insertar nuevo registro en Calidad
                    const insertCalidadQuery = `
                        INSERT INTO Calidad (Folio, [Orden de Compra], [Numero de Parte], [Cantidad Recibida], Estatus, [Hora Ingreso])
                        VALUES (@folio, @ordenCompra, @numeroParte, @cantidadRecibida, 'Calidad', GETDATE())
                    `;
                    const requestInsert = pool.request();
                    requestInsert.input('folio', sql.NVarChar, Folio);
                    requestInsert.input('ordenCompra', sql.NVarChar, OrdenCompra);
                    requestInsert.input('numeroParte', sql.NVarChar, NumeroParte);
                    requestInsert.input('cantidadRecibida', sql.Int, CantidadEntrega);
                    await requestInsert.query(insertCalidadQuery);
                    console.log(`Insertado en Calidad: ${Folio}`);
                }

                // 6. Buscar Produccion y actualizar Secuencia y Cantidad Original en Calidad
                const selectProduccionQuery = `
                    SELECT Secuencia, [Cantidad Original]
                    FROM Produccion
                    WHERE Folio = @folio
                `;
                const requestProduccionMatch = pool.request();
                requestProduccionMatch.input('folio', sql.NVarChar, Folio);
                const prodResult = await requestProduccionMatch.query(selectProduccionQuery);

                if (prodResult.recordset.length > 0) {
                    const { Secuencia, ['Cantidad Original']: CantidadOriginal } = prodResult.recordset[0];
                    const updateCalidadInfoQuery = `
                        UPDATE Calidad
                        SET Secuencia = @secuencia,
                            [Cantidad Original] = @cantidadOriginal
                        WHERE Folio = @folio
                    `;
                    const requestUpdateCalidad = pool.request();
                    requestUpdateCalidad.input('folio', sql.NVarChar, Folio);
                    requestUpdateCalidad.input('secuencia', sql.NVarChar, Secuencia);
                    requestUpdateCalidad.input('cantidadOriginal', sql.Int, CantidadOriginal);
                    await requestUpdateCalidad.query(updateCalidadInfoQuery);
                    console.log(`Datos de Produccion copiados a Calidad: ${Folio}`);
                }
            }

            return res.status(200).json({
                success: true,
                message: 'Proceso de recibo en calidad completado correctamente.'
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
