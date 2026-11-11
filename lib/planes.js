// Planes de Lumiere y sus precios. Los precios que se cobran salen de acá (del servidor), nunca de lo que mande el
// navegador. Tienen que coincidir con los de la página de ventas (sistemalumiere.com › Planes).
// Por ahora el cobro automático es solo para Argentina (pesos). Otros países: se les pide contactarse.
const PLANES = {
  basico: { nombre: 'Básico', ars: 26300 },
  estrategico: { nombre: 'Estratégico', ars: 46280 },
  premium: { nombre: 'Premium', ars: 88740 }, // incluye la tienda online y Toma de decisiones
};
// Cada cuántos meses se cobra y el descuento por pagar por adelantado
const PERIODOS = {
  mes: { meses: 1, desc: 0, etiqueta: 'por mes' },
  tri: { meses: 3, desc: 10, etiqueta: 'cada 3 meses' },
  anio: { meses: 12, desc: 25, etiqueta: 'por año' },
};

// Precio redondo (25.000, no 24.999): igual que en la página de ventas
function lindo(x) {
  if (x >= 100000) return Math.round(x / 1000) * 1000;
  if (x >= 5000) return Math.round(x / 250) * 250;
  if (x >= 500) return Math.round(x / 50) * 50;
  if (x >= 50) return Math.round(x / 5) * 5;
  return Math.round(x);
}

// { mensual, total, meses, desc } para un plan y un período, o null si no existen
function precio(plan, periodo) {
  const p = PLANES[plan], per = PERIODOS[periodo];
  if (!p || !per) return null;
  const mensual = Math.round(p.ars * (1 - per.desc / 100) / 10) * 10; // a 10 pesos: 26.300 se cobra 26.300
  return { mensual, total: mensual * per.meses, meses: per.meses, desc: per.desc };
}

// Para mostrar en la ventana de pago
function catalogo() {
  return Object.entries(PLANES).map(([id, p]) => ({
    id, nombre: p.nombre,
    periodos: Object.fromEntries(Object.keys(PERIODOS).map(k => [k, { ...precio(id, k), etiqueta: PERIODOS[k].etiqueta, base_mensual: precio(id, 'mes').mensual }])),
  }));
}

module.exports = { PLANES, PERIODOS, precio, catalogo, lindo };
