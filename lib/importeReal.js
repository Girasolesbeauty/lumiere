// Lo que de verdad se cobró por un renglón de venta. En venta_items queda el precio de lista (o con el descuento a mano
// del renglón); las promos (ej. Cyber), el cupón y el descuento por medio de pago se descuentan sobre el total del
// ticket. Acá se reparte ese descuento entre los renglones según lo que pesa cada uno. Nunca sube el importe: el
// interés de las cuotas o el envío no se cargan a los productos.
// Requiere la venta con alias v y el renglón con alias vi.
const FACTOR_VENTA = `LEAST(1, GREATEST(0, COALESCE(v.total / NULLIF(v.subtotal, 0), 1)))`;
const IMPORTE_VI = `(vi.cantidad * vi.precio_unitario * ${FACTOR_VENTA})`;
const SUBTOTAL_VI = `(vi.subtotal * ${FACTOR_VENTA})`;
module.exports = { FACTOR_VENTA, IMPORTE_VI, SUBTOTAL_VI };
