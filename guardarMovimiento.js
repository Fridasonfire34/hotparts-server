const express = require('express');
const sql = require('mssql');

module.exports = (config) => {
    const router = express.Router();

    router.post('/guardarMovimiento', async (req, res) => {
        try {
            const pool = await sql.connect(config);

            const queryCodigos = `
                SELECT FOLIO, [Orden de Compra], [Numero de Parte], [Usuario Entrega], 
                       [Cantidad Entrega], [Usuario Recibe], [Cantidad Recibida], [Fecha y Hora], Estatus
                FROM Codigos
            `;

            const requestCodigos = pool.request();
            const resultCodigos = await requestCodigos.query(queryCodigos);

            if (resultCodigos.recordset.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'No se encontraron registros en la tabla Codigos.'
                });
            }

            const insertQuery = `
                INSERT INTO [Movimientos Movil] (FOLIO, [Orden de Compra], [Numero de Parte], 
                                                  [Usuario Entrega], [Cantidad Entrega], 
                                                  [Usuario Recibe], [Cantidad Recibida], 
                                                  [Fecha y Hora], Area)
                VALUES (@folio, @ordenCompra, @numeroParte, @usuarioEntrega, @cantidadEntrega, 
                        @usuarioRecibe, @cantidadRecibida, @fechaHora, @estatus)
            `;

            for (const codigo of resultCodigos.recordset) {
                const requestMovimientos = pool.request();

                requestMovimientos.input('folio', sql.NVarChar, codigo.FOLIO);
                requestMovimientos.input('ordenCompra', sql.Float, codigo['Orden de Compra']);
                requestMovimientos.input('numeroParte', sql.NVarChar, codigo['Numero de Parte']);
                requestMovimientos.input('usuarioEntrega', sql.Float, codigo['Usuario Entrega']);
                requestMovimientos.input('cantidadEntrega', sql.Int, codigo['Cantidad Entrega']);
                requestMovimientos.input('usuarioRecibe', sql.Float, codigo['Usuario Recibe']);
                requestMovimientos.input('cantidadRecibida', sql.Int, codigo['Cantidad Recibida']);
                requestMovimientos.input('fechaHora', sql.DateTime, codigo['Fecha y Hora']);
                requestMovimientos.input('estatus', sql.NVarChar, codigo.Estatus);

                await requestMovimientos.query(insertQuery);
                console.log(`Movimiento insertado correctamente en la tabla Movimientos Movil para el folio: ${codigo.FOLIO}`);
            }
            const deleteQuery = `
            DELETE FROM Codigos
            `

            return res.status(200).json({
                success: true,
                message: 'Todos los registros fueron copiados de Codigos a Movimientos Movil exitosamente.'
            });

        } catch (err) {
            console.error('Error al guardar movimiento:', err);
            return res.status(500).json({
                success: false,
                message: 'Hubo un error al procesar la solicitud.',
                error: err.message
            });
        }
    });

    return router;
};
