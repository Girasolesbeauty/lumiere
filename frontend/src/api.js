import axios from 'axios';

const API = axios.create({
  baseURL: 'https://lumiere-production-79d0.up.railway.app/api',
});

// PRODUCTOS
export const getProductos = () => API.get('/productos');
export const getProducto = (id) => API.get(`/productos/${id}`);
export const createProducto = (data) => API.post('/productos', data);
export const updateProducto = (id, data) => API.put(`/productos/${id}`, data);
export const deleteProducto = (id) => API.delete(`/productos/${id}`);
export const getAlertasStock = () => API.get('/productos/alertas/stock');

// CLIENTES
export const getClientes = () => API.get('/clientes');
export const getCliente = (id) => API.get(`/clientes/${id}`);
export const createCliente = (data) => API.post('/clientes', data);
export const updateCliente = (id, data) => API.put(`/clientes/${id}`, data);
export const deleteCliente = (id) => API.delete(`/clientes/${id}`);
export const getHistorialCliente = (id) => API.get(`/clientes/${id}/historial`);
export const agregarPuntos = (id, puntos) => API.post(`/clientes/${id}/puntos`, { puntos });

// VENTAS
export const getVentas = () => API.get('/ventas');
export const getVenta = (id) => API.get(`/ventas/${id}`);
export const createVenta = (data) => API.post('/ventas', data);
export const getResumenHoy = () => API.get('/ventas/resumen/hoy');
export const getResumenMes = () => API.get('/ventas/resumen/mes');

// INVENTARIO
export const getMovimientos = () => API.get('/inventario/movimientos');
export const agregarMovimiento = (data) => API.post('/inventario/movimiento', data);
export const getInventarioValorizado = () => API.get('/inventario/valorizado');

// FINANZAS
export const getFlujo = (mes, anio) => API.get(`/finanzas/flujo?mes=${mes}&anio=${anio}`);
export const agregarEgreso = (data) => API.post('/finanzas/egreso', data);
export const getPuntoEquilibrio = () => API.get('/finanzas/equilibrio');
export const getResumenFinanzas = () => API.get('/finanzas/resumen');

// CUPONES
export const getCupones = () => API.get('/cupones');
export const validarCupon = (codigo, monto) => API.get(`/cupones/${codigo}/validar?monto=${monto}`);
export const createCupon = (data) => API.post('/cupones', data);
export const updateCupon = (id, data) => API.put(`/cupones/${id}`, data);
export const deleteCupon = (id) => API.delete(`/cupones/${id}`);

// FIDELIZACIÓN
export const getPremios = () => API.get('/fidelizacion/premios');
export const createPremio = (data) => API.post('/fidelizacion/premios', data);
export const canjearPuntos = (data) => API.post('/fidelizacion/canjear', data);
export const getRanking = () => API.get('/fidelizacion/ranking');

// POSTVENTA
export const getReglas = () => API.get('/postventa/reglas');
export const createRegla = (data) => API.post('/postventa/reglas', data);
export const updateRegla = (id, data) => API.put(`/postventa/reglas/${id}`, data);
export const getMensajes = () => API.get('/postventa/mensajes');
export const ejecutarReglas = () => API.post('/postventa/ejecutar');

// AUTH
export const login = (data) => API.post('/auth/login', data);
export const register = (data) => API.post('/auth/register', data);

export default API;