const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: ['https://lumiere-beta-nine.vercel.app', 'http://localhost:5173', 'https://lumiere-portal-clientes.vercel.app'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(express.json());

// Rutas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/productos', require('./routes/productos'));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/ventas', require('./routes/ventas'));
app.use('/api/inventario', require('./routes/inventario'));
app.use('/api/finanzas', require('./routes/finanzas'));
app.use('/api/cupones', require('./routes/cupones'));
app.use('/api/fidelizacion', require('./routes/fidelizacion'));
app.use('/api/postventa', require('./routes/postventa'));
app.use('/api/locales', require('./routes/locales'));
app.use('/api/comisiones', require('./routes/comisiones'));
app.use('/api/arca', require('./routes/arca'));
app.use('/api/medios-pago', require('./routes/medios-pago'));
app.use('/api/categorias-costo', require('./routes/categorias-costo'));
app.use('/api/proveedores', require('./routes/proveedores'));
app.use('/api/cuentas-pago', require('./routes/cuentas-pago'));
app.use('/api/ordenes-ingreso', require('./routes/ordenes-ingreso'));
app.use('/api/cuentas-pago', require('./routes/cuentas-pago'));
app.use('/api/caja', require('./routes/caja'));
app.use('/api/ordenes-ingreso', require('./routes/ordenes-ingreso'));
app.use('/api/kits', require('./routes/kits'));
app.use('/api/tiendanube', require('./routes/tiendanube'));
app.use('/api/permisos', require('./routes/permisos'));
app.use('/api/gift-cards', require('./routes/gift-cards'));
app.use('/api/portal', require('./routes/portal'));

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({ 
    mensaje: 'Lumiere API funcionando',
    version: '2.0.0',
    estado: 'OK',
    features: ['multi-local', 'usuarios', 'roles']
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor Lumiere corriendo en puerto ${PORT}`);
});

module.exports = app;