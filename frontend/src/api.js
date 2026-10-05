import axios from 'axios';

// La URL del backend se lee de una variable de entorno (VITE_API_URL), asi el mismo
// codigo sirve para cualquier copia del sistema -- cada cliente la configura en su propio
// Vercel, sin tocar ni una linea de codigo. Si no esta configurada (como en esta copia
// original), sigue funcionando exactamente igual que siempre, apuntando al backend real.
const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://lumiere-production-79d0.up.railway.app/api',
});

// Cada pedido lleva la llave de la sesion; sin ella el servidor no devuelve datos.
API.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('lumiere_token');
  if (token) cfg.headers = { ...(cfg.headers || {}), Authorization: 'Bearer ' + token };
  return cfg;
});
// Si la sesion vencio, se vuelve al inicio de sesion con un aviso (una sola vez, sin quedar en bucle)
API.interceptors.response.use((r) => r, (err) => {
  const esLogin = (err.config?.url || '').includes('/auth/login');
  if (err.response?.status === 401 && err.response?.data?.sesion && !esLogin && localStorage.getItem('lumiere_token')) {
    localStorage.removeItem('lumiere_token');
    localStorage.removeItem('lumiere_user');
    sessionStorage.setItem('lumiere_sesion_vencida', '1');
    window.location.reload();
  }
  // Prueba gratis terminada: se avisa en pantalla (el servidor no dejo guardar)
  if (err.response?.status === 402 && err.response?.data?.prueba_vencida) {
    window.dispatchEvent(new CustomEvent('lumiere-prueba-vencida', { detail: err.response.data.error }));
  }
  // Negocio suspendido: se cierra la sesion con el aviso
  if (err.response?.status === 403 && err.response?.data?.suspendido && localStorage.getItem('lumiere_token')) {
    localStorage.removeItem('lumiere_token');
    localStorage.removeItem('lumiere_user');
    sessionStorage.setItem('lumiere_aviso_login', err.response.data.error);
    window.location.reload();
  }
  return Promise.reject(err);
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