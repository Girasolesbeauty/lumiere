const pool = require('../config/database');

// Ventas que salieron de un pedido de la tienda web: se cobran en la caja (son venta del dia y se
// facturan), pero no las hizo una vendedora. La tabla de la tienda existe solo si el negocio la uso.
async function hayTienda() {
  return !!(await pool.query(`SELECT to_regclass('tienda_pedidos') AS t`)).rows[0].t;
}
// Condicion SQL "esta venta es de la tienda web" (alias = la tabla ventas en la consulta)
async function esVentaWeb(alias) {
  return (await hayTienda()) ? `EXISTS (SELECT 1 FROM tienda_pedidos tpw WHERE tpw.venta_id = ${alias}.id)` : 'FALSE';
}

module.exports = { hayTienda, esVentaWeb };
