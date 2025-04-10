const express = require('express');
const sql = require('mssql');

module.exports = (config) => {
    const router = express.Router();

    router.post('/cantidadEntrega', async (req, res) => {
        const { folios, cantidades, nomina, ordenesCompra, numerosParte } = req.body;
        console.log("Valores recibidos:", folios, cantidades, nomina, ordenesCompra, numerosParte);

        if (!folios || !cantidades || !ordenesCompra || !numerosParte || !nomina ||
            folios.length === 0 || cantidades.length === 0 || ordenesCompra.length === 0 || numerosParte.length === 0 ||
            folios.length !== cantidades.length || folios.length !== ordenesCompra.length || folios.length !== numerosParte.length) {
            return res.status(400).json({ success: false, message: 'Faltan parámetros o los arreglos no tienen el mismo tamaño.' });
        }

        try {
            const pool = await sql.connect(config);

            for (let i = 0; i < folios.length; i++) {
                const folio = folios[i];
                const cantidad = cantidades[i];
                const ordenCompra = ordenesCompra[i];
                const numeroParte = numerosParte[i];

                const result = await pool.request()
                    .input('folio', sql.NVarChar, folio)
                    .query('SELECT * FROM Codigos WHERE Folio = @folio AND Estatus IS NULL');

                if (result.recordset.length > 0) {
                    const updateQuery = `
                        UPDATE Codigos 
                        SET [Cantidad Entrega] = @cantidad, [Usuario Entrega] = @nomina, [Orden de Compra] = @OrdenCompra, [Numero de Parte] = @numeroParte
                        WHERE Folio = @folio AND Estatus IS NULL
                    `;
                    await pool.request()
                        .input('folio', sql.NVarChar, folio)
                        .input('cantidad', sql.Int, cantidad)
                        .input('nomina', sql.Int, nomina)
                        .input('OrdenCompra', sql.Float, ordenCompra)
                        .input('numeroParte', sql.NVarChar, numeroParte)
                        .query(updateQuery);
                } else {
                    const insertQuery = `
                        INSERT INTO Codigos (Folio, [Orden de Compra], [Numero de Parte], [Cantidad Entrega], [Usuario Entrega]) 
                        VALUES (@folio, @ordenCompra, @numeroParte, @cantidad, @nomina)
                    `;
                    await pool.request()
                        .input('folio', sql.NVarChar, folio)
                        .input('cantidad', sql.Int, cantidad)
                        .input('nomina', sql.Int, nomina)
                        .input('OrdenCompra', sql.Float, ordenCompra)
                        .input('numeroParte', sql.NVarChar, numeroParte)
                        .query(insertQuery);
                }
            }

            return res.status(200).json({ success: true, message: 'Cantidad de entrega actualizada/inserta correctamente.' });

        } catch (error) {
            console.error('Error en la consulta:', error);
            return res.status(500).json({ success: false, message: 'Hubo un error al procesar la solicitud.' });
        }
    });

    return router;
};
