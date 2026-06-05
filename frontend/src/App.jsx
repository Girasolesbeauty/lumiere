import { useState, useEffect } from "react";
import { getProductos, createVenta, getClientes, getFlujo, getPuntoEquilibrio, agregarEgreso, getResumenFinanzas, getVentas, getAlertasStock, getCupones, createCupon, updateCupon, getRanking, getReglas, createRegla as createReglaWA, updateRegla as updateReglaWA, login, register } from "./api";
import API from "./api";

const C = {
  bg: "#fafafa", surface: "#ffffff", card: "#f5f5f5", border: "#e8e8e8",
  accent: "#c9a84c", accentDim: "#c9a84c15", accentHover: "#e8c86a",
  text: "#111111", textSoft: "#444444", textMuted: "#999999",
  green: "#2d7a4f", greenDim: "#2d7a4f12",
  red: "#c0392b", redDim: "#c0392b12",
  blue: "#2471a3", blueDim: "#2471a312",
  purple: "#7d3c98", purpleDim: "#7d3c9812",
  wa: "#25d366", waDim: "#25d36618",
};

const BASE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Inter', sans-serif; background: #fafafa; color: #111111; min-height: 100vh; -webkit-font-smoothing: antialiased; }
::-webkit-scrollbar { width: 3px; }
::-webkit-scrollbar-thumb { background: #e0e0e0; border-radius: 2px; }
@keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .4; } }
.fade { animation: fadeUp .25s ease forwards; }
.pulse { animation: pulse 2s infinite; }
.layout { display: flex; min-height: 100vh; }
.sidebar { width: 210px; background: #111111; border-right: 1px solid #222222; display: flex; flex-direction: column; position: fixed; height: 100vh; z-index: 20; overflow-y: auto; }
.logo { padding: 24px 20px 16px; border-bottom: 1px solid #222222; }
.logo-name { font-family: 'Inter', sans-serif; font-size: 18px; font-weight: 700; letter-spacing: .1em; color: #c9a84c; text-transform: uppercase; }
.logo-sub { font-size: 9px; color: #888888; letter-spacing: .3em; margin-top: 3px; text-transform: uppercase; }
.nav { padding: 12px 10px; flex: 1; }
.nav-section { font-size: 8px; letter-spacing: .3em; color: #666666; padding: 10px 10px 4px; text-transform: uppercase; }
.nav-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 5px; cursor: pointer; font-size: 12px; font-weight: 500; color: #aaaaaa; transition: all .18s; margin-bottom: 1px; border: 1px solid transparent; }
.nav-item:hover { color: #ffffff; background: #333333; }
.nav-item.active { color: #c9a84c; background: #c9a84c18; border-color: #c9a84c44; }
.nav-icon { font-size: 13px; width: 18px; text-align: center; flex-shrink: 0; }
.sb-footer { padding: 12px 18px; border-top: 1px solid #222222; }
.main { margin-left: 210px; flex: 1; padding: 28px 34px; min-height: 100vh; background: #fafafa; }
.ph { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 26px; }
.pt { font-family: 'Inter', sans-serif; font-size: 26px; font-weight: 700; letter-spacing: -0.02em; line-height: 1; color: #111111; }
.ps { font-size: 11px; color: #888888; font-weight: 400; margin-top: 5px; }
.g4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 18px; }
.g3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin-bottom: 18px; }
.g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 18px; }
.card { background: #ffffff; border: 1px solid #e8e8e8; box-shadow: 0 1px 3px rgba(0,0,0,0.06); border-radius: 8px; padding: 18px; }
.ct { font-size: 10px; letter-spacing: .15em; text-transform: uppercase; color: #777777; font-weight: 600; margin-bottom: 10px; }
.metric { font-family: 'Inter', sans-serif; font-size: 32px; font-weight: 700; line-height: 1; }
.msub { font-size: 12px; color: #666666; font-weight: 400; margin-top: 5px; }
.badge { display: inline-flex; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
.bg { background: #2d7a4f12; color: #2d7a4f; }
.br { background: #c0392b12; color: #c0392b; }
.bb { background: #2471a312; color: #2471a3; }
.bp { background: #7d3c9812; color: #7d3c98; }
.ba { background: #c9a84c15; color: #c9a84c; }
.bw { background: #25d36618; color: #25d366; }
.bx { background: #f5f5f5; color: #999999; border: 1px solid #e0e0e0; }
.btn { padding: 9px 18px; border-radius: 6px; font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600; cursor: pointer; border: none; transition: all .18s; }
.btn-p { background: #111111; color: #ffffff; font-weight: 500; }
.btn-p:hover { background: #333333; }
.btn-g { background: transparent; color: #666666; border: 1px solid #e0e0e0; }
.btn-g:hover { border-color: #c9a84c; color: #c9a84c; }
.btn-sm { padding: 5px 11px; font-size: 10px; }
.inp { width: 100%; background: #ffffff; border: 1px solid #e0e0e0; border-radius: 6px; padding: 10px 14px; color: #111111; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 400; outline: none; transition: border-color .18s; }
.inp:focus { border-color: #c9a84c; }
.inp::placeholder { color: #bbbbbb; }
.sel { background: #ffffff; border: 1px solid #e0e0e0; border-radius: 6px; padding: 10px 14px; color: #111111; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 400; outline: none; width: 100%; }
.fg { margin-bottom: 12px; }
.fl { font-size: 11px; color: #666666; font-weight: 600; margin-bottom: 6px; }
.tabs { display: flex; margin-bottom: 20px; border-bottom: 1px solid #e8e8e8; }
.tab { padding: 8px 16px; font-size: 12px; font-weight: 500; color: #888888; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all .18s; }
.tab.on { color: #111111; border-bottom-color: #c9a84c; font-weight: 600; }
.tab:hover { color: #333333; }
.divider { height: 1px; background: #e8e8e8; margin: 14px 0; }
.pb { height: 5px; background: #eeeeee; border-radius: 3px; overflow: hidden; }
.pf { height: 100%; border-radius: 3px; transition: width .5s; }
.sw-wrap { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.sw { width: 34px; height: 18px; border-radius: 9px; position: relative; transition: background .2s; flex-shrink: 0; }
.sw.on { background: #6bbf8e; }
.sw.off { background: #dddddd; }
.sw-dot { position: absolute; top: 2px; width: 14px; height: 14px; border-radius: 50%; background: white; transition: left .2s; }
.sw.on .sw-dot { left: 18px; }
.sw.off .sw-dot { left: 2px; }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; font-size: 11px; text-transform: uppercase; color: #888888; padding: 9px 11px; font-weight: 600; border-bottom: 2px solid #eeeeee; letter-spacing: 0.05em; }
td { padding: 10px 11px; font-size: 12px; color: #222222; font-weight: 400; border-bottom: 1px solid #f0f0f0; }
tr:last-child td { border-bottom: none; }
tr:hover td { background: #fafafa; }
`;

const PRODUCTS = [
  { id: 1, name: "Serum Vitamina C", brand: "L'OREAL", price: 8500, stock: 12, min: 5, cost: 4200, lead: 7 },
  { id: 2, name: "Crema Hidratante FPS50", brand: "NEUTROGENA", price: 6200, stock: 3, min: 8, cost: 3100, lead: 10 },
  { id: 3, name: "Contorno de Ojos", brand: "MAYBELLINE", price: 4800, stock: 18, min: 6, cost: 2400, lead: 5 },
  { id: 4, name: "Base Liquida HD", brand: "REVLON", price: 7300, stock: 7, min: 5, cost: 3650, lead: 7 },
  { id: 5, name: "Aceite Rosa Mosqueta", brand: "WELEDA", price: 9100, stock: 2, min: 4, cost: 4550, lead: 14 },
  { id: 6, name: "Mascara de Pestanas", brand: "RIMMEL", price: 3200, stock: 24, min: 10, cost: 1600, lead: 5 },
];

const CLIENTS = [
  { id: 1, name: "Garcia, Maria", email: "maria@gmail.com", cuit: "20-34521678-9", points: 1240, tier: "Gold", purchases: 14, total: 186500 },
  { id: 2, name: "Cosmetica SA", email: "compras@cosmetica.com", cuit: "30-71234567-8", points: 3800, tier: "Platinum", purchases: 6, total: 312000 },
  { id: 3, name: "Lopez, Ana", email: "ana@gmail.com", cuit: "27-28901234-5", points: 760, tier: "Silver", purchases: 9, total: 98400 },
  { id: 4, name: "Rodriguez, Paula", email: "paula@gmail.com", cuit: "23-45678901-4", points: 210, tier: "Bronze", purchases: 3, total: 31200 },
  { id: 5, name: "Fernandez, Lucia", email: "lucia@gmail.com", cuit: "20-41234567-8", points: 580, tier: "Silver", purchases: 7, total: 84600 },
];

const REWARDS = [
  { id: 1, name: "Serum Vitamina C Mini", brand: "L'OREAL", pts: 400, emoji: "ok_hand", stock: 8 },
  { id: 2, name: "Muestra Crema Hidratante", brand: "NEUTROGENA", pts: 200, emoji: "droplet", stock: 15 },
  { id: 3, name: "Labial Mate", brand: "MAYBELLINE", pts: 600, emoji: "lipstick", stock: 5 },
  { id: 4, name: "10% descuento proxima compra", brand: "LUMIERE", pts: 300, emoji: "gift", stock: 99 },
  { id: 5, name: "Kit Hidratacion Completo", brand: "WELEDA", pts: 1200, emoji: "herb", stock: 3 },
  { id: 6, name: "Perfume Travel Size", brand: "REVLON", pts: 900, emoji: "cherry_blossom", stock: 4 },
];

const REWARDS_DISPLAY = REWARDS.map(r => ({
  ...r,
  emoji: r.emoji === "ok_hand" ? "✨" : r.emoji === "droplet" ? "💧" : r.emoji === "lipstick" ? "💄" : r.emoji === "gift" ? "🎁" : r.emoji === "herb" ? "🌿" : "🌸"
}));

const CUPONS_DATA = [
  { id: 1, code: "INSTA20", desc: "20% off - Instagram", type: "%", value: 20, uses: 48, max: 100, active: true, expires: "31/05/2026", channel: "Instagram" },
  { id: 2, code: "TIKTOK15", desc: "15% off - TikTok", type: "%", value: 15, uses: 127, max: 200, active: true, expires: "30/06/2026", channel: "TikTok" },
  { id: 3, code: "BDAY10", desc: "$10.000 off - cumpleanos", type: "$", value: 10000, uses: 12, max: null, active: true, expires: null, channel: "Auto" },
  { id: 4, code: "INFLUENCER_SOF", desc: "Sofia Moreno", type: "%", value: 12, uses: 34, max: null, active: true, expires: null, channel: "Influencer" },
];

const WA_RULES = [
  { id: 1, name: "Como te esta yendo?", trigger: "7 dias post compra", segment: "Todos", active: true, sent: 142, opened: 98, msg: "Hola {nombre}! Hace una semana compraste {producto}. Ya pudiste ver los resultados? Cualquier duda escribinos!" },
  { id: 2, name: "Reposicion inteligente", trigger: "30 dias post compra", segment: "Cremas / Serums", active: true, sent: 89, opened: 71, msg: "Hola {nombre}! Tu {producto} ya debe estar por terminarse. Queres que te reservemos uno? Respondenos SI y te lo separamos." },
  { id: 3, name: "Upsell complementario", trigger: "14 dias post compra", segment: "Bases", active: true, sent: 56, opened: 38, msg: "Hola {nombre}! Como te quedo la {producto}? Te recomendamos nuestro fijador para que dure todo el dia." },
  { id: 4, name: "Reactivacion inactivos", trigger: "60 dias sin compras", segment: "Todos", active: false, sent: 34, opened: 18, msg: "Hola {nombre}! Hace un tiempo que no te vemos. Tus {puntos} puntos te estan esperando!" },
  { id: 5, name: "Saludo cumpleanos", trigger: "Dia del cumpleanos", segment: "Con fecha nac.", active: true, sent: 23, opened: 22, msg: "Feliz cumpleanos {nombre}! Te regalamos BDAY10 con $10.000 de descuento en tu proxima compra. Que lo disfrutes!" },
];

const PROVIDERS_ABC = [
  { name: "L'OREAL Argentina", ventas: 1240000, pct: 38, clase: "A" },
  { name: "Neutrogena", ventas: 890000, pct: 27, clase: "A" },
  { name: "Maybelline", ventas: 510000, pct: 16, clase: "B" },
  { name: "Revlon", ventas: 280000, pct: 9, clase: "B" },
  { name: "Weleda", ventas: 190000, pct: 6, clase: "C" },
  { name: "Rimmel", ventas: 130000, pct: 4, clase: "C" },
];

function Sw({ on, toggle }) {
  return (
    <div className="sw-wrap" onClick={toggle}>
      <div className={"sw " + (on ? "on" : "off")}>
        <div className="sw-dot" />
      </div>
    </div>
  );
}

function StatusDot({ color, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div className="pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      <span style={{ fontSize: 9, color: color, letterSpacing: ".12em" }}>{label}</span>
    </div>
  );
}

function MCard({ label, value, sub, color }) {
  return (
    <div className="card">
      <div className="ct">{label}</div>
      <div className="metric" style={{ color: color || "#111111" }}>{value}</div>
      {sub && <div className="msub">{sub}</div>}
    </div>
  );
}

function TierBadge({ tier }) {
  const cls = tier === "Platinum" ? "bp" : tier === "Gold" ? "ba" : tier === "Silver" ? "bb" : "bx";
  return <span className={"badge " + cls}>{tier}</span>;
}

function Dashboard() {
  const [resumen, setResumen] = useState({ ingresos: 0, egresos: 0, neto: 0 });
  const [ventas, setVentas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getResumenFinanzas(),
      getVentas(),
      getClientes(),
      getAlertasStock()
    ]).then(([r, v, c, a]) => {
      setResumen(r.data);
      setVentas(v.data.slice(0, 4));
      setClientes(c.data.slice(0, 4));
      setAlertas(a.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="fade">
      <div className="ph">
        <div>
          <div className="pt">Dashboard</div>
          <div className="ps">{new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })} - resumen ejecutivo</div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <StatusDot color="#25d366" label="TIENDANUBE" />
          <StatusDot color="#2d7a4f" label="ARCA" />
        </div>
      </div>
      <div className="g4">
        <MCard label="Ingresos del mes" value={"$" + parseFloat(resumen.ingresos || 0).toLocaleString()} sub="ventas registradas" />
        <MCard label="Facturas emitidas" value={String(ventas.length)} sub="este mes" />
        <MCard label="Stock critico" value={String(alertas.length)} sub="requieren pedido" color={alertas.length > 0 ? "#c0392b" : "#2d7a4f"} />
        <MCard label="Clientes activos" value={String(clientes.length)} sub="en la base" />
      </div>
      <div className="g2">
        <div className="card">
          <div className="ct">Ultimas facturas</div>
          {loading ? <div style={{ color: "#999999", fontSize: 11 }}>Cargando...</div> :
          <table>
            <thead><tr><th>Nro</th><th>Cliente</th><th>Total</th><th>Estado</th></tr></thead>
            <tbody>
              {ventas.length > 0 ? ventas.map(s => (
                <tr key={s.id}>
                  <td style={{ color: "#c9a84c" }}>{s.numero_factura}</td>
                  <td>{s.cliente_nombre || "Consumidor final"}</td>
                  <td>${parseFloat(s.total).toLocaleString()}</td>
                  <td><span className="badge bg">{s.estado}</span></td>
                </tr>
              )) : <tr><td colSpan={4} style={{ color: "#999999", textAlign: "center" }}>Sin ventas aun</td></tr>}
            </tbody>
          </table>}
        </div>
        <div className="card">
          <div className="ct">Flujo de caja</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            {[{ l: "INGRESOS", v: "$" + parseFloat(resumen.ingresos || 0).toLocaleString(), c: "#2d7a4f" },
              { l: "EGRESOS", v: "$" + parseFloat(resumen.egresos || 0).toLocaleString(), c: "#c0392b" },
              { l: "NETO", v: "$" + parseFloat(resumen.neto || 0).toLocaleString(), c: "#c9a84c" }].map(r => (
              <div key={r.l}>
                <div style={{ fontSize: 9, color: "#999999", letterSpacing: ".15em" }}>{r.l}</div>
                <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 22, fontWeight: 700, color: r.c, marginTop: 4 }}>{r.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="g2">
        {alertas.length > 0 && (
          <div className="card">
            <div className="ct">Alertas de stock</div>
            {alertas.slice(0, 3).map(p => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #2722201a" }}>
                <div>
                  <div style={{ fontSize: 11, color: "#444444" }}>{p.nombre}</div>
                  <div style={{ fontSize: 9, color: "#c0392b" }}>Stock: {p.stock}u — necesita pedido</div>
                </div>
                <span className="badge br">PEDIR</span>
              </div>
            ))}
          </div>
        )}
        <div className="card">
          <div className="ct">Top clientes</div>
          {clientes.map((c, i) => (
            <div key={c.id || i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 11, color: "#444444" }}>{(c.nombre || c.name || "").split(",")[0]}</div>
                <div style={{ fontSize: 9, color: "#999999" }}>{(c.puntos || c.points || 0).toLocaleString()} pts</div>
              </div>
              <TierBadge tier={c.nivel || c.tier || "Bronze"} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function POS({ localId }) {
  const [cart, setCart] = useState([]);
  const [dniInput, setDniInput] = useState("");
  const [tipoFac, setTipoFac] = useState("B");
  const [productos, setProductos] = useState([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [showNuevoCliente, setShowNuevoCliente] = useState(false);
  const [nuevoClienteDni, setNuevoClienteDni] = useState({ nombre: "", email: "", telefono: "" });
  const [cupon, setCupon] = useState("");
  const [cuponAplicado, setCuponAplicado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [preventa, setPreventa] = useState(false);
  const [nombrePreventa, setNombrePreventa] = useState("");
  const [mediosPago, setMediosPago] = useState([]);
  const [medioPagoSel, setMedioPagoSel] = useState(null);

  useEffect(() => {
    getProductos().then(res => setProductos(res.data)).catch(() => setProductos(PRODUCTS));
    API.get("/medios-pago").then(res => setMediosPago(res.data)).catch(() => {
      setMediosPago([
        { id: 1, nombre: "Efectivo", coeficiente: 1 },
        { id: 2, nombre: "Débito", coeficiente: 1 },
        { id: 3, nombre: "Transferencia / QR", coeficiente: 1 },
        { id: 4, nombre: "Crédito 1 cuota", coeficiente: 1 },
        { id: 10, nombre: "Crédito 2 cuotas con interés", coeficiente: 1.0941 },
        { id: 11, nombre: "Crédito 3 cuotas con interés", coeficiente: 1.1281 },
        { id: 12, nombre: "Crédito 4 cuotas con interés", coeficiente: 1.1629 },
        { id: 13, nombre: "Crédito 5 cuotas con interés", coeficiente: 1.1983 },
        { id: 14, nombre: "Crédito 6 cuotas con interés", coeficiente: 1.2344 },
      ]);
    });
  }, [localId]);

  const add = (p) => setCart(prev => {
    const e = prev.find(i => i.id === p.id);
    return e ? prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i) : [...prev, { ...p, qty: 1 }];
  });
  const remove = (id) => setCart(prev => prev.filter(i => i.id !== id));
  
  const coef = medioPagoSel ? parseFloat(medioPagoSel.coeficiente) : 1;
  const subtotalBase = cart.reduce((s, i) => s + (i.precio || i.price) * i.qty, 0);
  const descuento = cuponAplicado ? (cuponAplicado.tipo === "%" ? subtotalBase * (cuponAplicado.valor / 100) : cuponAplicado.valor) : 0;
  const subtotalConDesc = subtotalBase - descuento;
  const total = Math.round(subtotalConDesc * coef);
  const intereses = total - subtotalConDesc;

  const buscarClientePorDni = async (dni) => {
    setDniInput(dni);
    if (dni.length < 7) { setClienteSeleccionado(null); return; }
    setBuscandoCliente(true);
    try {
      const res = await API.get("/clientes?local_id=" + (localId || 1));
      const encontrado = res.data.find(c => c.cuit_dni === dni || c.cuit_dni === dni.replace(/[-]/g, ""));
      if (encontrado) { setClienteSeleccionado(encontrado); setShowNuevoCliente(false); }
      else { setClienteSeleccionado(null); if (dni.length >= 8) setShowNuevoCliente(true); }
    } catch (e) {}
    setBuscandoCliente(false);
  };

  const crearClienteRapido = async () => {
    try {
      const res = await API.post("/clientes", { ...nuevoClienteDni, cuit_dni: dniInput, local_id: localId || 1 });
      setClienteSeleccionado(res.data);
      setShowNuevoCliente(false);
      setMensaje("Cliente creado!");
      setTimeout(() => setMensaje(""), 2000);
    } catch (e) { setMensaje("Error al crear cliente"); }
  };

  const aplicarCupon = async () => {
    if (!cupon) return;
    try {
      const res = await API.get("/cupones");
      const c = res.data.find(x => (x.codigo || x.code) === cupon.toUpperCase() && (x.activo || x.active));
      if (c) { setCuponAplicado({ tipo: c.tipo || c.type, valor: parseFloat(c.valor || c.value) }); setMensaje("Cupon aplicado!"); }
      else setMensaje("Cupon invalido o inactivo");
      setTimeout(() => setMensaje(""), 2000);
    } catch (e) {}
  };

  const emitirFactura = async () => {
    if (cart.length === 0) return setMensaje("Agrega productos al ticket");
    if (!medioPagoSel) return setMensaje("Selecciona un medio de pago");
    setLoading(true);
    try {
      const items = cart.map(i => ({ producto_id: i.id, cantidad: i.qty, precio_unitario: i.precio || i.price }));
      const ventaRes = await createVenta({
        cliente_id: clienteSeleccionado?.id || null,
        tipo_factura: tipoFac,
        items,
        canal: "presencial",
        cupon_codigo: cupon || null,
        local_id: localId || 1,
        medio_pago_id: medioPagoSel.id,
        medio_pago_nombre: medioPagoSel.nombre,
        total_con_interes: total,
        es_preventa: preventa,
        nombre_preventa: preventa ? nombrePreventa : null
      });

      if (!preventa) {
        try {
          const arcaRes = await API.post("/arca/emitir", {
            tipo: tipoFac,
            items,
            total,
            cliente_cuit: clienteSeleccionado?.cuit_dni || null,
            venta_id: ventaRes.data.id
          });
          setMensaje("✓ " + arcaRes.data.mensaje + " | CAE: " + arcaRes.data.cae);
        } catch (arcaErr) {
          setMensaje("Venta registrada pero error en ARCA: " + arcaErr.message);
        }
      } else {
        setMensaje("Preventa registrada para " + nombrePreventa + "!");
      }

      setCart([]);
      setDniInput("");
      setCupon("");
      setCuponAplicado(null);
      setClienteSeleccionado(null);
      setShowNuevoCliente(false);
      setMedioPagoSel(null);
      setPreventa(false);
      setNombrePreventa("");
      setTimeout(() => setMensaje(""), 8000);
    } catch (error) {
      setMensaje("Error al emitir factura");
    }
    setLoading(false);
  };

  const productosAMostrar = (productos.length > 0 ? productos : PRODUCTS).filter(p =>
    !busqueda || (p.nombre || p.name || "").toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.marca || p.brand || "").toLowerCase().includes(busqueda.toLowerCase())
  );

  // Agrupar medios de pago
  const gruposMedios = {
    "Efectivo / Transferencia": mediosPago.filter(m => m.tipo === "efectivo" || m.tipo === "transferencia"),
    "Débito": mediosPago.filter(m => m.tipo === "debito"),
    "Crédito sin interés": mediosPago.filter(m => m.tipo === "credito" && !m.con_interes),
    "Crédito con interés": mediosPago.filter(m => m.tipo === "credito" && m.con_interes),
    "Plataformas": mediosPago.filter(m => m.tipo === "plataforma"),
  };

  return (
    <div className="fade">
      <div className="ph">
        <div><div className="pt">Punto de Venta</div><div className="ps">facturacion electronica - arca</div></div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div className="sw-wrap" onClick={() => { setPreventa(!preventa); setMensaje(""); }}>
            <div className={"sw " + (preventa ? "on" : "off")}><div className="sw-dot" /></div>
            <span style={{ fontSize: 11, color: preventa ? "#2471a3" : "#999999" }}>Preventa</span>
          </div>
          <StatusDot color="#2d7a4f" label="ARCA" />
        </div>
      </div>
      {mensaje && (
        <div style={{ background: mensaje.includes("Error") || mensaje.includes("error") ? "#c0392b12" : "#2d7a4f12", border: "1px solid " + (mensaje.includes("Error") || mensaje.includes("error") ? "#c0392b" : "#2d7a4f"), borderRadius: 6, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: mensaje.includes("Error") || mensaje.includes("error") ? "#c0392b" : "#2d7a4f" }}>
          {mensaje}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16, height: "calc(100vh - 180px)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, overflow: "hidden" }}>
          <input className="inp" placeholder="Buscar producto por nombre o marca..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, overflowY: "auto", flex: 1 }}>
            {productosAMostrar.map(p => (
              <div key={p.id} onClick={() => add(p)}
                style={{ background: "#ffffff", border: "1px solid #e8e8e8", borderRadius: 7, padding: 14, cursor: "pointer", transition: "all .18s", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#c9a84c"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#e8e8e8"; e.currentTarget.style.transform = "translateY(0)"; }}>
                <div style={{ fontSize: 9, color: "#999999", letterSpacing: ".12em", textTransform: "uppercase" }}>{p.marca || p.brand}</div>
                <div style={{ fontSize: 12, color: "#333333", marginTop: 3, fontWeight: 500 }}>{p.nombre || p.name}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 10 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#c9a84c" }}>${(p.precio || p.price).toLocaleString()}</div>
                  <span className={"badge " + (p.stock < (p.stock_minimo || p.min || 5) ? "br" : "bg")}>{p.stock}u</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: "#ffffff", border: "1px solid #e8e8e8", borderRadius: 8, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #f0f0f0", fontSize: 10, letterSpacing: ".15em", color: "#999999", fontWeight: 600, background: preventa ? "#2471a312" : "#fafafa" }}>
            {preventa ? "📋 PREVENTA" : "🧾 COMPROBANTE EN CURSO"}
          </div>

          <div style={{ padding: "10px 14px", borderBottom: "1px solid #f0f0f0" }}>
            {preventa ? (
              <input className="inp" placeholder="Nombre del cliente (preventa)" value={nombrePreventa} onChange={e => setNombrePreventa(e.target.value)} />
            ) : (
              <>
                <div style={{ position: "relative", marginBottom: 6 }}>
                  <input className="inp" placeholder="DNI del cliente (opcional)" value={dniInput} onChange={e => buscarClientePorDni(e.target.value)} />
                  {buscandoCliente && <div style={{ position: "absolute", right: 10, top: 10, fontSize: 10, color: "#999999" }}>buscando...</div>}
                </div>
                {clienteSeleccionado && clienteSeleccionado.id && (
                  <div style={{ background: "#2d7a4f12", border: "1px solid #2d7a4f33", borderRadius: 6, padding: "8px 12px", marginBottom: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#2d7a4f" }}>✓ {clienteSeleccionado.nombre}</div>
                    <div style={{ fontSize: 10, color: "#666666", marginTop: 2 }}>{clienteSeleccionado.puntos || 0} pts · {clienteSeleccionado.nivel || "Bronze"}</div>
                  </div>
                )}
                {showNuevoCliente && !clienteSeleccionado && (
                  <div style={{ background: "#2471a312", border: "1px solid #2471a333", borderRadius: 6, padding: 10, marginBottom: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#2471a3", marginBottom: 8 }}>Cliente nuevo</div>
                    <input className="inp" placeholder="Nombre completo" value={nuevoClienteDni.nombre} onChange={e => setNuevoClienteDni(p => ({ ...p, nombre: e.target.value }))} style={{ marginBottom: 6 }} />
                    <input className="inp" placeholder="Teléfono (opcional)" value={nuevoClienteDni.telefono} onChange={e => setNuevoClienteDni(p => ({ ...p, telefono: e.target.value }))} style={{ marginBottom: 6 }} />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-p btn-sm" style={{ flex: 1 }} onClick={crearClienteRapido}>Guardar</button>
                      <button className="btn btn-g btn-sm" style={{ flex: 1 }} onClick={() => { setShowNuevoCliente(false); setClienteSeleccionado({ id: null, nombre: "Consumidor Final", puntos: 0 }); }}>Consumidor Final</button>
                    </div>
                  </div>
                )}
                {!clienteSeleccionado && !showNuevoCliente && (
                  <button className="btn btn-g btn-sm" style={{ width: "100%", marginBottom: 6 }} onClick={() => setClienteSeleccionado({ id: null, nombre: "Consumidor Final", puntos: 0 })}>
                    Consumidor Final
                  </button>
                )}
                <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                  <input className="inp" placeholder="Cupon" value={cupon} onChange={e => setCupon(e.target.value)} style={{ flex: 1 }} />
                  <button className="btn btn-g btn-sm" onClick={aplicarCupon}>Aplicar</button>
                </div>
                {cuponAplicado && <div style={{ fontSize: 10, color: "#2d7a4f", marginBottom: 4 }}>✓ Descuento: -${descuento.toLocaleString()}</div>}
              </>
            )}
            <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
              {["A", "B", "Remito"].map(t => (
                <button key={t} onClick={() => setTipoFac(t)} className="btn btn-sm"
                  style={{ flex: 1, background: tipoFac === t ? "#c9a84c15" : "transparent", border: "1px solid " + (tipoFac === t ? "#c9a84c" : "#e8e8e8"), color: tipoFac === t ? "#c9a84c" : "#999999", fontWeight: tipoFac === t ? 600 : 400 }}>
                  {t === "Remito" ? "Remito" : "Fac. " + t}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
            {cart.length === 0
              ? <div style={{ textAlign: "center", color: "#cccccc", fontSize: 12, marginTop: 20 }}>Seleccioná productos</div>
              : cart.map(i => (
                <div key={i.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fafafa", borderRadius: 6, padding: "8px 10px", marginBottom: 6, border: "1px solid #f0f0f0" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: "#333333", fontWeight: 500 }}>{i.nombre || i.name}</div>
                    <div style={{ fontSize: 10, color: "#999999" }}>{i.marca || i.brand}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button onClick={() => setCart(prev => prev.map(x => x.id === i.id && x.qty > 1 ? { ...x, qty: x.qty - 1 } : x))} style={{ width: 22, height: 22, borderRadius: 4, border: "1px solid #e8e8e8", background: "white", cursor: "pointer", fontSize: 14 }}>-</button>
                    <span style={{ fontSize: 12, fontWeight: 600, minWidth: 20, textAlign: "center" }}>{i.qty}</span>
                    <button onClick={() => add(i)} style={{ width: 22, height: 22, borderRadius: 4, border: "1px solid #e8e8e8", background: "white", cursor: "pointer", fontSize: 14 }}>+</button>
                    <div style={{ minWidth: 70, textAlign: "right", fontSize: 12, fontWeight: 600 }}>${((i.precio || i.price) * i.qty).toLocaleString()}</div>
                    <div onClick={() => remove(i.id)} style={{ cursor: "pointer", color: "#cccccc", fontSize: 18, padding: "0 2px" }}>×</div>
                  </div>
                </div>
              ))}

            {cart.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div className="fg">
                  <div className="fl">Medio de pago</div>
                  <select className="sel" value={medioPagoSel?.id || ""} onChange={e => {
                    const m = mediosPago.find(x => x.id === parseInt(e.target.value));
                    setMedioPagoSel(m || null);
                  }}>
                    <option value="">Seleccionar...</option>
                    {["efectivo", "transferencia", "debito", "credito", "plataforma"].map(tipo => (
                      <optgroup key={tipo} label={tipo === "efectivo" ? "Efectivo" : tipo === "transferencia" ? "Transferencia" : tipo === "debito" ? "Débito" : tipo === "credito" ? "Crédito" : "Plataformas"}>
                        {mediosPago.filter(m => m.tipo === tipo).map(m => (
                          <option key={m.id} value={m.id}>
                            {m.nombre}{m.con_interes ? ` (+${Math.round((parseFloat(m.coeficiente) - 1) * 100)}%)` : ""}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          <div style={{ padding: "14px 16px", borderTop: "1px solid #f0f0f0", background: "#fafafa" }}>
            {descuento > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: "#999999" }}>Descuento</span>
                <span style={{ fontSize: 11, color: "#2d7a4f" }}>-${descuento.toLocaleString()}</span>
              </div>
            )}
            {intereses > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: "#c0392b" }}>Intereses ({medioPagoSel?.nombre})</span>
                <span style={{ fontSize: 11, color: "#c0392b" }}>+${intereses.toLocaleString()}</span>
              </div>
            )}
            {medioPagoSel && intereses > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: "#999999" }}>Cuota aprox.</span>
                <span style={{ fontSize: 10, color: "#999999" }}>${Math.round(total / medioPagoSel.cuotas).toLocaleString()} x {medioPagoSel.cuotas}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: "#999999", fontWeight: 600 }}>TOTAL{medioPagoSel ? " — " + medioPagoSel.nombre : ""}</div>
              <div style={{ fontSize: 30, fontWeight: 700, color: "#111111" }}>${total.toLocaleString()}</div>
            </div>
            <button className="btn btn-p" style={{ width: "100%", padding: 13, fontSize: 13, opacity: loading ? 0.7 : 1 }} onClick={emitirFactura} disabled={loading}>
              {loading ? "Procesando..." : preventa ? "Registrar Preventa" : "Emitir Factura " + tipoFac + " — ARCA"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


function Inventario() {
  const [tab, setTab] = useState("stock");
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProductos().then(res => { setProductos(res.data); setLoading(false); }).catch(() => { setProductos(PRODUCTS.map(p => ({ ...p, nombre: p.name, marca: p.brand, precio: p.price, stock_minimo: p.min, lead_time_dias: p.lead }))); setLoading(false); });
  }, []);

  const productosAMostrar = productos.length > 0 ? productos : PRODUCTS.map(p => ({ ...p, nombre: p.name, marca: p.brand, precio: p.price, stock_minimo: p.min, lead_time_dias: p.lead }));
  const alertas = productosAMostrar.filter(p => p.stock <= (p.stock_minimo || p.min) + 3);

  return (
    <div className="fade">
      <div className="ph">
        <div><div className="pt">Inventario</div><div className="ps">stock - punto de pedido - alertas</div></div>
        <button className="btn btn-p btn-sm">+ Nuevo producto</button>
      </div>
      <div className="tabs">
        {["stock", "alertas", "movimientos"].map(t => <div key={t} className={"tab " + (tab === t ? "on" : "")} onClick={() => setTab(t)}>
          {t.toUpperCase()}{t === "alertas" && alertas.length > 0 && <span style={{ background: "#c0392b", color: "white", borderRadius: 10, fontSize: 8, padding: "1px 5px", marginLeft: 5 }}>{alertas.length}</span>}
        </div>)}
      </div>
      {tab === "stock" && (
        <div className="card fade">
          {loading ? <div style={{ textAlign: "center", color: "#999999", padding: 20 }}>Cargando inventario...</div> :
          <table>
            <thead><tr><th>Producto</th><th>Stock</th><th>Minimo</th><th>Lead time</th><th>Punto pedido</th><th>Costo</th><th>Estado</th></tr></thead>
            <tbody>
              {productosAMostrar.map(p => {
                const min = p.stock_minimo || p.min || 5;
                const lead = p.lead_time_dias || p.lead || 7;
                const pp = Math.ceil(1.2 * lead + min);
                const needs = p.stock <= pp;
                const pct = Math.min(Math.round((p.stock / (min * 3)) * 100), 100);
                return (
                  <tr key={p.id}>
                    <td><div style={{ color: "#111111" }}>{p.nombre || p.name}</div><div style={{ fontSize: 9, color: "#999999" }}>{p.marca || p.brand}</div></td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18 }}>{p.stock}</span>
                        <div style={{ width: 50 }}><div className="pb"><div className="pf" style={{ width: pct + "%", background: pct < 30 ? "#c0392b" : pct < 60 ? "#c9a84c" : "#2d7a4f" }} /></div></div>
                      </div>
                    </td>
                    <td>{min}</td>
                    <td>{lead}d</td>
                    <td style={{ color: "#c9a84c" }}>{pp}u</td>
                    <td>${(p.costo || p.cost || 0).toLocaleString()}</td>
                    <td><span className={"badge " + (needs ? "br" : "bg")}>{needs ? "PEDIR" : "OK"}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>}
        </div>
      )}
      {tab === "alertas" && (
        <div className="fade">
          {alertas.length === 0
            ? <div style={{ textAlign: "center", color: "#2d7a4f", padding: 30, fontSize: 12 }}>No hay alertas de stock por ahora</div>
            : alertas.map(p => (
              <div key={p.id} style={{ background: "#c0392b12", border: "1px solid #d9707033", borderRadius: 6, padding: "12px 16px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 12, color: "#444444" }}>{p.nombre || p.name} - {p.marca || p.brand}</div>
                  <div style={{ fontSize: 10, color: "#999999", marginTop: 2 }}>Stock: {p.stock}u | Minimo: {p.stock_minimo || p.min}u | Lead: {p.lead_time_dias || p.lead}d</div>
                </div>
                <button className="btn btn-p btn-sm">Generar OC</button>
              </div>
            ))}
        </div>
      )}
      {tab === "movimientos" && (
        <div className="card fade">
          <table>
            <thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th>Cantidad</th><th>Referencia</th></tr></thead>
            <tbody>
              {[
                { d: "24/05", p: "Serum Vitamina C", t: "Venta", q: -2, r: "F-0041" },
                { d: "24/05", p: "Crema Hidratante", t: "Ingreso", q: 20, r: "OC-0018" },
                { d: "23/05", p: "Base Liquida HD", t: "Venta", q: -1, r: "F-0040" },
              ].map((m, i) => (
                <tr key={i}>
                  <td>{m.d}</td><td>{m.p}</td>
                  <td><span className={"badge " + (m.t === "Venta" ? "bb" : m.t === "Ingreso" ? "bg" : "ba")}>{m.t}</span></td>
                  <td style={{ color: m.q > 0 ? "#2d7a4f" : "#c0392b" }}>{m.q > 0 ? "+" : ""}{m.q}</td>
                  <td style={{ color: "#c9a84c" }}>{m.r}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Clientes() {
  const [tab, setTab] = useState("lista");
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [nuevoCliente, setNuevoCliente] = useState({ nombre: "", email: "", cuit_dni: "", telefono: "", fecha_nacimiento: "" });
  const tierNext = { Bronze: 500, Silver: 1000, Gold: 2000, Platinum: 99999 };

  useEffect(() => {
    getClientes().then(res => { setClientes(res.data); setLoading(false); }).catch(() => { setClientes(CLIENTS.map(c => ({ ...c, nombre: c.name, puntos: c.points, nivel: c.tier, total_compras: c.total, cuit_dni: c.cuit }))); setLoading(false); });
  }, []);

  const guardarCliente = async () => {
    try {
      const { createCliente } = await import("./api");
      await createCliente(nuevoCliente);
      setMensaje("Cliente guardado correctamente!");
      setShowForm(false);
      setNuevoCliente({ nombre: "", email: "", cuit_dni: "", telefono: "", fecha_nacimiento: "" });
      getClientes().then(res => setClientes(res.data));
      setTimeout(() => setMensaje(""), 3000);
    } catch (e) {
      setMensaje("Error al guardar cliente");
    }
  };

  const clientesAMostrar = clientes.length > 0 ? clientes : CLIENTS.map(c => ({ ...c, nombre: c.name, puntos: c.points, nivel: c.tier, total_compras: c.total, cuit_dni: c.cuit }));
  const platinum = clientesAMostrar.filter(c => (c.nivel || c.tier) === "Platinum").length;
  const gold = clientesAMostrar.filter(c => (c.nivel || c.tier) === "Gold").length;
  const silver = clientesAMostrar.filter(c => (c.nivel || c.tier) === "Silver").length;

  return (
    <div className="fade">
      <div className="ph">
        <div><div className="pt">Clientes</div><div className="ps">gestion - fidelizacion - historial</div></div>
        <button className="btn btn-p btn-sm" onClick={() => setShowForm(!showForm)}>+ Nuevo cliente</button>
      </div>
      {mensaje && <div style={{ background: mensaje.includes("Error") ? "#c0392b12" : "#2d7a4f12", border: "1px solid " + (mensaje.includes("Error") ? "#c0392b" : "#2d7a4f"), borderRadius: 6, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: mensaje.includes("Error") ? "#c0392b" : "#2d7a4f" }}>{mensaje}</div>}
      {showForm && (
        <div className="card fade" style={{ marginBottom: 18 }}>
          <div className="ct">Nuevo cliente</div>
          <div className="g2">
            <div>
              <div className="fg"><div className="fl">Nombre</div><input className="inp" placeholder="Nombre completo" value={nuevoCliente.nombre} onChange={e => setNuevoCliente(p => ({ ...p, nombre: e.target.value }))} /></div>
              <div className="fg"><div className="fl">Email</div><input className="inp" placeholder="email@gmail.com" value={nuevoCliente.email} onChange={e => setNuevoCliente(p => ({ ...p, email: e.target.value }))} /></div>
              <div className="fg"><div className="fl">CUIT / DNI</div><input className="inp" placeholder="20-12345678-9" value={nuevoCliente.cuit_dni} onChange={e => setNuevoCliente(p => ({ ...p, cuit_dni: e.target.value }))} /></div>
            </div>
            <div>
              <div className="fg"><div className="fl">Telefono</div><input className="inp" placeholder="+54 9 351 000 0000" value={nuevoCliente.telefono} onChange={e => setNuevoCliente(p => ({ ...p, telefono: e.target.value }))} /></div>
              <div className="fg"><div className="fl">Fecha de nacimiento</div><input className="inp" type="date" value={nuevoCliente.fecha_nacimiento} onChange={e => setNuevoCliente(p => ({ ...p, fecha_nacimiento: e.target.value }))} /></div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button className="btn btn-p" style={{ flex: 1 }} onClick={guardarCliente}>Guardar</button>
                <button className="btn btn-g" style={{ flex: 1 }} onClick={() => setShowForm(false)}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="g3">
        {[{ t: "Platinum", n: platinum, c: "#7d3c98" }, { t: "Gold", n: gold, c: "#c9a84c" }, { t: "Silver", n: silver, c: "#2471a3" }].map(t => (
          <div key={t.t} className="card" style={{ borderTop: "2px solid " + t.c }}>
            <div className="ct">{t.t}</div>
            <div className="metric" style={{ color: t.c, fontSize: 26 }}>{t.n}</div>
          </div>
        ))}
      </div>
      <div className="tabs">
        {["lista", "niveles"].map(t => <div key={t} className={"tab " + (tab === t ? "on" : "")} onClick={() => setTab(t)}>{t.toUpperCase()}</div>)}
      </div>
      {tab === "lista" && (
        <div className="card fade">
          {loading ? <div style={{ textAlign: "center", color: "#999999", padding: 20 }}>Cargando clientes...</div> :
          <table>
            <thead><tr><th>Cliente</th><th>CUIT/DNI</th><th>Total compras</th><th>Puntos</th><th>Nivel</th></tr></thead>
            <tbody>
              {clientesAMostrar.map((c, i) => {
                const nivel = c.nivel || c.tier;
                const puntos = c.puntos || c.points || 0;
                const next = tierNext[nivel] || 500;
                const pct = Math.min(Math.round((puntos / next) * 100), 100);
                return (
                  <tr key={c.id || i}>
                    <td><div style={{ color: "#111111" }}>{c.nombre || c.name}</div><div style={{ fontSize: 9, color: "#999999" }}>{c.email}</div></td>
                    <td style={{ fontSize: 10 }}>{c.cuit_dni || c.cuit}</td>
                    <td>${(c.total_compras || c.total || 0).toLocaleString()}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 18, fontWeight: 700, color: "#c9a84c" }}>{puntos.toLocaleString()}</span>
                        <div style={{ width: 40 }}><div className="pb"><div className="pf" style={{ width: pct + "%", background: "#c9a84c" }} /></div></div>
                      </div>
                    </td>
                    <td><TierBadge tier={nivel} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>}
        </div>
      )}
      {tab === "niveles" && (
        <div className="g2 fade">
          {[
            { tier: "Bronze", min: 0, max: 499, c: "#c9a84c", perks: ["1 pt cada $100", "Cupon bienvenida"] },
            { tier: "Silver", min: 500, max: 999, c: "#2471a3", perks: ["1.2 pts cada $100", "Acceso preventas", "Envio gratis +$5k"] },
            { tier: "Gold", min: 1000, max: 1999, c: "#c9a84c", perks: ["1.5 pts cada $100", "5% descuento exclusivo", "Regalo de cumpleanos"] },
            { tier: "Platinum", min: 2000, max: null, c: "#7d3c98", perks: ["2 pts cada $100", "10% descuento", "Envio gratis siempre", "Lanzamientos anticipados"] },
          ].map(n => (
            <div key={n.tier} className="card" style={{ borderLeft: "3px solid " + n.c }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 20, fontWeight: 700, color: n.c }}>{n.tier}</div>
                <div style={{ fontSize: 10, color: "#999999" }}>{n.min.toLocaleString()}{n.max ? " - " + n.max.toLocaleString() + " pts" : "+ pts"}</div>
              </div>
              {n.perks.map((p, i) => (
                <div key={i} style={{ display: "flex", gap: 7, marginBottom: 6, fontSize: 11, color: "#444444" }}>
                  <span style={{ color: n.c }}>v</span>{p}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Finanzas() {
  const [tab, setTab] = useState("flujo");
  const [flujo, setFlujo] = useState(null);
  const [equilibrio, setEquilibrio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nuevoEgreso, setNuevoEgreso] = useState({ concepto: "", importe: "", categoria_id: "" });
  const [categoriasCosto, setCategoriasCosto] = useState([]);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    Promise.all([
      getFlujo(new Date().getMonth() + 1, new Date().getFullYear()),
      getPuntoEquilibrio(),
      API.get("/categorias-costo")
    ]).then(([f, e, cats]) => {
      setFlujo(f.data);
      setEquilibrio(e.data);
      setCategoriasCosto(cats.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const guardarEgreso = async () => {
    try {
      await agregarEgreso({ concepto: nuevoEgreso.concepto, importe: nuevoEgreso.importe, referencia: "Manual" });
      setMensaje("Egreso registrado!");
      setNuevoEgreso({ concepto: "", importe: "" });
      const f = await getFlujo(new Date().getMonth() + 1, new Date().getFullYear());
      setFlujo(f.data);
      setTimeout(() => setMensaje(""), 3000);
    } catch (e) {
      setMensaje("Error al registrar egreso");
    }
  };

  const ingresos = flujo?.resumen?.ingresos || 0;
  const egresos = flujo?.resumen?.egresos || 0;
  const neto = flujo?.resumen?.neto || 0;

  return (
    <div className="fade">
      <div className="ph"><div><div className="pt">Finanzas</div><div className="ps">flujo de efectivo - costos - equilibrio</div></div></div>
      {mensaje && <div style={{ background: mensaje.includes("Error") ? "#c0392b12" : "#2d7a4f12", border: "1px solid " + (mensaje.includes("Error") ? "#c0392b" : "#2d7a4f"), borderRadius: 6, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: mensaje.includes("Error") ? "#c0392b" : "#2d7a4f" }}>{mensaje}</div>}
      <div className="tabs">
        {["flujo", "costos", "equilibrio"].map(t => <div key={t} className={"tab " + (tab === t ? "on" : "")} onClick={() => setTab(t)}>{t.toUpperCase()}</div>)}
      </div>
      {tab === "flujo" && (
        <div className="fade">
          <div className="g3">
            <div className="card"><div className="ct">Ingresos del mes</div><div style={{ fontFamily: "'Inter',sans-serif", fontSize: 26, fontWeight: 700, color: "#2d7a4f" }}>${ingresos.toLocaleString()}</div></div>
            <div className="card"><div className="ct">Egresos del mes</div><div style={{ fontFamily: "'Inter',sans-serif", fontSize: 26, fontWeight: 700, color: "#c0392b" }}>${egresos.toLocaleString()}</div></div>
            <div className="card"><div className="ct">Resultado neto</div><div style={{ fontFamily: "'Inter',sans-serif", fontSize: 26, fontWeight: 700, color: "#c9a84c" }}>${neto.toLocaleString()}</div></div>
          </div>
          <div className="g2">
            <div className="card">
              <div className="ct">Movimientos</div>
              {loading ? <div style={{ color: "#999999", fontSize: 11 }}>Cargando...</div> :
              <table>
                <thead><tr><th>Concepto</th><th>Tipo</th><th>Importe</th></tr></thead>
                <tbody>
                  {(flujo?.movimientos || []).slice(0, 8).map((m, i) => (
                    <tr key={i}>
                      <td>{m.concepto}</td>
                      <td><span className={"badge " + (m.tipo === "I" ? "bg" : "br")}>{m.tipo === "I" ? "Ingreso" : "Egreso"}</span></td>
                      <td style={{ color: m.tipo === "I" ? "#2d7a4f" : "#c0392b" }}>{m.tipo === "I" ? "+" : "-"}${parseFloat(m.importe).toLocaleString()}</td>
                    </tr>
                  ))}
                  {(flujo?.movimientos || []).length === 0 && <tr><td colSpan={3} style={{ color: "#999999", textAlign: "center" }}>Sin movimientos este mes</td></tr>}
                </tbody>
              </table>}
            </div>
            <div className="card">
              <div className="ct">Registrar egreso</div>
              <div className="fg">
                <div className="fl">Categoria</div>
                <select className="sel" value={nuevoEgreso.categoria_id || ""} onChange={e => {
                  const cat = categoriasCosto.find(c => c.id === parseInt(e.target.value));
                  setNuevoEgreso(p => ({ ...p, categoria_id: e.target.value, concepto: cat?.nombre || "" }));
                }}>
                  <option value="">Seleccionar categoria...</option>
                  {["variable", "fijo", "administrativo", "sueldo"].map(tipo => (
                    <optgroup key={tipo} label={tipo === "variable" ? "Costos Variables" : tipo === "fijo" ? "Costos Fijos" : tipo === "administrativo" ? "Gastos Administrativos" : "Sueldos"}>
                      {categoriasCosto.filter(c => c.tipo === tipo).map(c => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="fg"><div className="fl">Concepto (detalle)</div><input className="inp" placeholder="Ej: Factura luz enero" value={nuevoEgreso.concepto} onChange={e => setNuevoEgreso(p => ({ ...p, concepto: e.target.value }))} /></div>
              <div className="fg"><div className="fl">Importe ($)</div><input className="inp" type="number" placeholder="35000" value={nuevoEgreso.importe} onChange={e => setNuevoEgreso(p => ({ ...p, importe: e.target.value }))} /></div>
              <button className="btn btn-p" style={{ width: "100%" }} onClick={guardarEgreso}>Registrar egreso</button>
            </div>
          </div>
        </div>
      )}
      {tab === "costos" && (
        <div className="g2 fade">
          <div className="card">
            <div className="ct">Costos fijos mensuales</div>
            {[{ l: "Alquiler", v: 35000 }, { l: "Personal", v: 28000 }, { l: "Servicios", v: 4200 }, { l: "Plataformas", v: 3800 }].map(c => (
              <div key={c.l} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid #272220" }}>
                <span style={{ fontSize: 12, color: "#444444" }}>{c.l}</span>
                <span style={{ color: "#c9a84c" }}>${c.v.toLocaleString()}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10 }}>
              <span style={{ fontSize: 12, color: "#111111" }}>TOTAL FIJOS</span>
              <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20 }}>$71.000</span>
            </div>
          </div>
          <div className="card">
            <div className="ct">Margen bruto por producto</div>
            {PRODUCTS.map(p => {
              const mg = Math.round(((p.price - p.cost) / p.price) * 100);
              return (
                <div key={p.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: "#444444" }}>{p.name}</span>
                    <span style={{ fontSize: 11, color: "#2d7a4f" }}>{mg}%</span>
                  </div>
                  <div className="pb"><div className="pf" style={{ width: mg + "%", background: "#2d7a4f" }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {tab === "equilibrio" && (
        <div className="g2 fade">
          <div className="card">
            <div className="ct">Punto de equilibrio</div>
            {loading ? <div style={{ color: "#999999" }}>Calculando...</div> : <>
              <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 48, fontWeight: 700, color: "#c9a84c" }}>${parseFloat(equilibrio?.punto_equilibrio || 0).toLocaleString()}</div>
              <div style={{ fontSize: 11, color: "#999999", marginTop: 4 }}>ventas minimas para cubrir costos</div>
              <div className="divider" />
              {[
                { l: "Costos fijos", v: "$" + parseFloat(equilibrio?.costos_fijos || 0).toLocaleString() },
                { l: "Margen promedio", v: (equilibrio?.margen_promedio || 0) + "%" },
                { l: "Margen seguridad", v: equilibrio?.margen_seguridad || "0%" },
              ].map(r => (
                <div key={r.l} style={{ display: "flex", justifyContent: "space-between", marginBottom: 9 }}>
                  <span style={{ fontSize: 11, color: "#999999" }}>{r.l}</span>
                  <span style={{ fontSize: 11, color: "#444444" }}>{r.v}</span>
                </div>
              ))}
            </>}
          </div>
          <div className="card">
            <div className="ct">Situacion actual</div>
            {[
              { l: "Ventas actuales", v: "$" + parseFloat(equilibrio?.ventas_actuales || 0).toLocaleString(), c: "#2d7a4f" },
              { l: "Punto equilibrio", v: "$" + parseFloat(equilibrio?.punto_equilibrio || 0).toLocaleString(), c: "#c9a84c" },
              { l: "Superado", v: equilibrio?.superado ? "SI" : "NO", c: equilibrio?.superado ? "#2d7a4f" : "#c0392b" },
            ].map(r => (
              <div key={r.l} style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: "#999999" }}>{r.l}</span>
                <span style={{ color: r.c }}>{r.v}</span>
              </div>
            ))}
            <div className="pb" style={{ height: 10, marginTop: 8 }}>
              <div className="pf" style={{ width: "100%", background: "linear-gradient(90deg,#d97070 0%,#c9a96e 63%,#6bbf8e 100%)" }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Informes() {
  const [tab, setTab] = useState("abc");
  return (
    <div className="fade">
      <div className="ph">
        <div><div className="pt">Informes</div><div className="ps">abc proveedores - inventario - ventas</div></div>
        <button className="btn btn-g btn-sm">Exportar</button>
      </div>
      <div className="tabs">
        {[["abc", "ABC PROV."], ["inv", "INVENTARIO"], ["ventas", "VENTAS"]].map(([id, l]) => (
          <div key={id} className={"tab " + (tab === id ? "on" : "")} onClick={() => setTab(id)}>{l}</div>
        ))}
      </div>
      {tab === "abc" && (
        <div className="fade">
          <div className="g3" style={{ marginBottom: 16 }}>
            {[{ c: "A", n: 2, pct: "65%", col: "#2d7a4f", desc: "80% de ventas" }, { c: "B", n: 2, pct: "25%", col: "#2471a3", desc: "15% de ventas" }, { c: "C", n: 2, pct: "10%", col: "#999999", desc: "5% de ventas" }].map(t => (
              <div key={t.c} className="card">
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div className="ct">Clase {t.c}</div>
                  <span className={"badge " + (t.c === "A" ? "bg" : t.c === "B" ? "bb" : "bx")}>{t.n} prov.</span>
                </div>
                <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 30, fontWeight: 700, color: t.col }}>{t.pct}</div>
                <div style={{ fontSize: 10, color: "#999999" }}>{t.desc}</div>
              </div>
            ))}
          </div>
          <div className="card">
            <table>
              <thead><tr><th>Proveedor</th><th>Ventas</th><th>%</th><th>Clase</th><th>Acumulado</th></tr></thead>
              <tbody>
                {PROVIDERS_ABC.map((p, i) => {
                  const acum = PROVIDERS_ABC.slice(0, i + 1).reduce((s, x) => s + x.pct, 0);
                  return (
                    <tr key={p.name}>
                      <td style={{ color: "#111111" }}>{p.name}</td>
                      <td>${p.ventas.toLocaleString()}</td>
                      <td>{p.pct}%</td>
                      <td><span className={"badge " + (p.clase === "A" ? "bg" : p.clase === "B" ? "bb" : "bx")}>{p.clase}</span></td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <div style={{ flex: 1 }}><div className="pb"><div className="pf" style={{ width: acum + "%", background: p.clase === "A" ? "#2d7a4f" : p.clase === "B" ? "#2471a3" : "#999999" }} /></div></div>
                          <span style={{ fontSize: 9, color: "#999999", width: 28 }}>{acum}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {tab === "inv" && (
        <div className="card fade">
          <table>
            <thead><tr><th>Producto</th><th>Stock</th><th>Valor stock</th><th>Estado</th></tr></thead>
            <tbody>
              {PRODUCTS.map(p => (
                <tr key={p.id}>
                  <td><div style={{ color: "#111111" }}>{p.name}</div><div style={{ fontSize: 9, color: "#999999" }}>{p.brand}</div></td>
                  <td>{p.stock}u</td>
                  <td style={{ color: "#c9a84c" }}>${(p.stock * p.cost).toLocaleString()}</td>
                  <td><span className={"badge " + (p.stock < p.min ? "br" : p.stock < p.min * 1.5 ? "ba" : "bg")}>{p.stock < p.min ? "CRITICO" : p.stock < p.min * 1.5 ? "BAJO" : "NORMAL"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === "ventas" && (
        <div className="g2 fade">
          <div className="card">
            <div className="ct">Ventas por canal</div>
            {[{ canal: "Presencial (POS)", pct: 62, val: 88226, c: "#c9a84c" }, { canal: "Tiendanube (online)", pct: 38, val: 54074, c: "#7d3c98" }].map(c => (
              <div key={c.canal} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 11, color: "#444444" }}>{c.canal}</span>
                  <span style={{ fontSize: 11, color: c.c }}>${c.val.toLocaleString()} ({c.pct}%)</span>
                </div>
                <div className="pb"><div className="pf" style={{ width: c.pct + "%", background: c.c }} /></div>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="ct">Top 5 productos</div>
            {PRODUCTS.slice(0, 5).map((p, i) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < 4 ? "1px solid #2722201a" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 16, fontWeight: 700, color: "#999999", width: 16 }}>{i + 1}</span>
                  <div>
                    <div style={{ fontSize: 11, color: "#444444" }}>{p.name}</div>
                    <div style={{ fontSize: 9, color: "#999999" }}>{p.brand}</div>
                  </div>
                </div>
                <span style={{ color: "#c9a84c", fontSize: 11 }}>${(p.price * (10 - i)).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Cupones() {
  const [cupons, setCupons] = useState([]);
  const [tab, setTab] = useState("lista");
  const [nc, setNc] = useState({ code: "", desc: "", type: "%", value: "", channel: "Instagram", max: "" });
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    getCupones().then(res => setCupons(res.data)).catch(() => setCupons(CUPONS_DATA));
  }, []);

  const guardarCupon = async () => {
    try {
      await createCupon({ codigo: nc.code, descripcion: nc.desc, tipo: nc.type, valor: nc.value, canal: nc.channel, max_usos: nc.max || null });
      setMensaje("Cupon creado!");
      setNc({ code: "", desc: "", type: "%", value: "", channel: "Instagram", max: "" });
      getCupones().then(res => setCupons(res.data));
      setTab("lista");
      setTimeout(() => setMensaje(""), 3000);
    } catch (e) { setMensaje("Error al crear cupon"); }
  };

  const toggleCupon = async (c) => {
    try {
      await updateCupon(c.id, { ...c, activo: !c.activo });
      setCupons(p => p.map(x => x.id === c.id ? { ...x, activo: !x.activo } : x));
    } catch (e) {}
  };

  const cuponsAMostrar = cupons.length > 0 ? cupons : CUPONS_DATA.map(c => ({ ...c, activo: c.active, descripcion: c.desc, tipo: c.type, valor: c.value, canal: c.channel, max_usos: c.max, fecha_vencimiento: c.expires }));

  return (
    <div className="fade">
      <div className="ph"><div><div className="pt">Cupones</div><div className="ps">codigos - influencers - campanas</div></div></div>
      {mensaje && <div style={{ background: mensaje.includes("Error") ? "#c0392b12" : "#2d7a4f12", border: "1px solid " + (mensaje.includes("Error") ? "#c0392b" : "#2d7a4f"), borderRadius: 6, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: mensaje.includes("Error") ? "#c0392b" : "#2d7a4f" }}>{mensaje}</div>}
      <div className="g4" style={{ marginBottom: 16 }}>
        <MCard label="Activos" value={String(cuponsAMostrar.filter(c => c.activo || c.active).length)} color="#2d7a4f" />
        <MCard label="Usos totales" value={String(cuponsAMostrar.reduce((s, c) => s + (c.usos || c.uses || 0), 0))} color="#c9a84c" />
        <MCard label="Influencers" value="1" color="#2471a3" />
        <MCard label="Total cupones" value={String(cuponsAMostrar.length)} />
      </div>
      <div className="tabs">
        {[["lista", "CUPONES"], ["nuevo", "CREAR"], ["influencers", "INFLUENCERS"]].map(([id, l]) => (
          <div key={id} className={"tab " + (tab === id ? "on" : "")} onClick={() => setTab(id)}>{l}</div>
        ))}
      </div>
      {tab === "lista" && (
        <div className="card fade">
          <table>
            <thead><tr><th>Codigo</th><th>Descripcion</th><th>Descuento</th><th>Canal</th><th>Usos</th><th>Vence</th><th>Activo</th></tr></thead>
            <tbody>
              {cuponsAMostrar.map(c => (
                <tr key={c.id}>
                  <td style={{ color: "#c9a84c", letterSpacing: ".06em", fontWeight: 600 }}>{c.codigo || c.code}</td>
                  <td>{c.descripcion || c.desc}</td>
                  <td>{(c.tipo || c.type) === "%" ? (c.valor || c.value) + "%" : "$" + (c.valor || c.value || 0).toLocaleString()}</td>
                  <td><span className="badge bb">{c.canal || c.channel}</span></td>
                  <td>{c.usos || c.uses || 0}{(c.max_usos || c.max) ? "/" + (c.max_usos || c.max) : ""}</td>
                  <td style={{ fontSize: 10, color: "#999999" }}>{c.fecha_vencimiento || c.expires || "Sin venc."}</td>
                  <td><Sw on={c.activo !== undefined ? c.activo : c.active} toggle={() => toggleCupon(c)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === "nuevo" && (
        <div className="g2 fade">
          <div className="card">
            <div className="ct">Nuevo cupon</div>
            <div className="fg"><div className="fl">Codigo</div><input className="inp" placeholder="Ej: VERANO30" value={nc.code} onChange={e => setNc(p => ({ ...p, code: e.target.value.toUpperCase() }))} /></div>
            <div className="fg"><div className="fl">Descripcion</div><input className="inp" placeholder="Ej: Campana Instagram mayo" value={nc.desc} onChange={e => setNc(p => ({ ...p, desc: e.target.value }))} /></div>
            <div className="fg"><div className="fl">Tipo</div><select className="sel" value={nc.type} onChange={e => setNc(p => ({ ...p, type: e.target.value }))}><option value="%">Porcentaje (%)</option><option value="$">Monto fijo ($)</option></select></div>
            <div className="fg"><div className="fl">Valor</div><input className="inp" type="number" placeholder={nc.type === "%" ? "15" : "5000"} value={nc.value} onChange={e => setNc(p => ({ ...p, value: e.target.value }))} /></div>
            <div className="fg"><div className="fl">Canal</div><select className="sel" value={nc.channel} onChange={e => setNc(p => ({ ...p, channel: e.target.value }))}><option>Instagram</option><option>TikTok</option><option>Email</option><option>Influencer</option><option>Automatico</option></select></div>
            <div className="fg"><div className="fl">Max. usos (vacio = ilimitado)</div><input className="inp" type="number" placeholder="100" value={nc.max} onChange={e => setNc(p => ({ ...p, max: e.target.value }))} /></div>
            <button className="btn btn-p" style={{ width: "100%" }} onClick={guardarCupon}>Crear cupon</button>
          </div>
          <div className="card">
            <div className="ct">Vista previa</div>
            <div style={{ background: "#fafafa", borderRadius: 7, padding: 20, border: "2px dashed #272220", textAlign: "center", marginBottom: 14 }}>
              <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 28, fontWeight: 700, color: "#c9a84c", letterSpacing: ".1em" }}>{nc.code || "CODIGO"}</div>
              <div style={{ fontSize: 13, color: "#999999", marginTop: 6 }}>{nc.value ? (nc.type === "%" ? nc.value + "% de descuento" : "$" + parseInt(nc.value || "0").toLocaleString() + " de descuento") : "Descuento"}</div>
            </div>
            {["Codigos cortos y memorables convierten mas", "Inclui el canal: INSTA20, TIKTOK15", "Limite de usos genera urgencia", "Codigos de influencer = seguimiento exacto"].map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 7, marginBottom: 7, fontSize: 11, color: "#444444" }}><span style={{ color: "#c9a84c" }}>-</span>{t}</div>
            ))}
          </div>
        </div>
      )}
      {tab === "influencers" && (
        <div className="card fade">
          <table>
            <thead><tr><th>Influencer</th><th>Codigo</th><th>Red</th><th>Usos</th><th>Comision</th></tr></thead>
            <tbody>
              {cuponsAMostrar.filter(c => (c.canal || c.channel) === "Influencer").map((c, i) => (
                <tr key={i}>
                  <td style={{ color: "#111111" }}>{c.descripcion || c.desc}</td>
                  <td style={{ color: "#c9a84c" }}>{c.codigo || c.code}</td>
                  <td><span className="badge bb">Instagram</span></td>
                  <td>{c.usos || c.uses || 0}</td>
                  <td>10%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 12 }}><button className="btn btn-p btn-sm">+ Agregar influencer</button></div>
        </div>
      )}
    </div>
  );
}

function Fidelizacion() {
  const [tab, setTab] = useState("clientes");
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const tierNext = { Bronze: 500, Silver: 1000, Gold: 2000, Platinum: 99999 };

  useEffect(() => {
    getRanking().then(res => { setClientes(res.data); setLoading(false); }).catch(() => { setClientes(CLIENTS.map(c => ({ ...c, nombre: c.name, puntos: c.points, nivel: c.tier }))); setLoading(false); });
  }, []);

  const clientesAMostrar = clientes.length > 0 ? clientes : CLIENTS.map(c => ({ ...c, nombre: c.name, puntos: c.points, nivel: c.tier }));
  const totalPuntos = clientesAMostrar.reduce((s, c) => s + (c.puntos || 0), 0);

  return (
    <div className="fade">
      <div className="ph"><div><div className="pt">Fidelizacion</div><div className="ps">puntos - niveles - canjes</div></div></div>
      <div className="g4" style={{ marginBottom: 16 }}>
        <MCard label="Puntos emitidos" value={totalPuntos.toLocaleString()} color="#c9a84c" />
        <MCard label="Clientes con puntos" value={String(clientesAMostrar.filter(c => (c.puntos || 0) > 0).length)} color="#2d7a4f" />
        <MCard label="Premios disponibles" value={String(REWARDS_DISPLAY.length)} color="#2471a3" />
        <MCard label="Nivel Platinum" value={String(clientesAMostrar.filter(c => (c.nivel || c.tier) === "Platinum").length)} color="#7d3c98" />
      </div>
      <div className="tabs">
        {["clientes", "canjes"].map(t => <div key={t} className={"tab " + (tab === t ? "on" : "")} onClick={() => setTab(t)}>{t.toUpperCase()}</div>)}
      </div>
      {tab === "clientes" && (
        <div className="card fade">
          {loading ? <div style={{ textAlign: "center", color: "#999999", padding: 20 }}>Cargando...</div> :
          <table>
            <thead><tr><th>Cliente</th><th>Nivel</th><th>Puntos</th><th>Progreso al proximo nivel</th></tr></thead>
            <tbody>
              {clientesAMostrar.map((c, i) => {
                const nivel = c.nivel || c.tier || "Bronze";
                const puntos = c.puntos || c.points || 0;
                const next = tierNext[nivel] || 500;
                const pct = Math.min(Math.round((puntos / next) * 100), 100);
                return (
                  <tr key={c.id || i}>
                    <td><div style={{ color: "#111111" }}>{c.nombre || c.name}</div><div style={{ fontSize: 9, color: "#999999" }}>{c.email}</div></td>
                    <td><TierBadge tier={nivel} /></td>
                    <td style={{ fontFamily: "'Inter',sans-serif", fontSize: 18, fontWeight: 700, color: "#c9a84c" }}>{puntos.toLocaleString()}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1 }}><div className="pb"><div className="pf" style={{ width: pct + "%", background: "#c9a84c" }} /></div></div>
                        <span style={{ fontSize: 9, color: "#999999", width: 50 }}>{nivel === "Platinum" ? "MAX" : (next - puntos).toLocaleString() + "p"}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>}
        </div>
      )}
      {tab === "canjes" && (
        <div className="card fade">
          <table>
            <thead><tr><th>Premio</th><th>Puntos requeridos</th><th>Stock</th></tr></thead>
            <tbody>
              {REWARDS_DISPLAY.map(r => (
                <tr key={r.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <span style={{ fontSize: 18 }}>{r.emoji}</span>
                      <div><div style={{ color: "#111111" }}>{r.name}</div><div style={{ fontSize: 9, color: "#999999" }}>{r.brand}</div></div>
                    </div>
                  </td>
                  <td style={{ color: "#c9a84c", fontFamily: "'Cormorant Garamond',serif", fontSize: 18 }}>{r.pts}</td>
                  <td><span className={"badge " + (r.stock < 5 ? "br" : "bg")}>{r.stock}u</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PostventaWA() {
  const [rules, setRules] = useState([]);
  const [tab, setTab] = useState("reglas");
  const [sel, setSel] = useState(null);
  const [nuevaRegla, setNuevaRegla] = useState({ nombre: "", disparador: "post_compra", dias: 7, segmento: "Todos", mensaje: "" });
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    getReglas().then(res => setRules(res.data)).catch(() => setRules(WA_RULES.map(r => ({ ...r, activo: r.active, disparador: r.trigger, dias: 7, segmento: r.segment, mensaje: r.msg }))));
  }, []);

  const toggle = async (r) => {
    try {
      await updateReglaWA(r.id, { ...r, activo: !r.activo });
      setRules(p => p.map(x => x.id === r.id ? { ...x, activo: !x.activo } : x));
    } catch (e) {}
  };

  const guardarRegla = async () => {
    try {
      await createReglaWA(nuevaRegla);
      setMensaje("Regla creada!");
      setNuevaRegla({ nombre: "", disparador: "post_compra", dias: 7, segmento: "Todos", mensaje: "" });
      getReglas().then(res => setRules(res.data));
      setTab("reglas");
      setTimeout(() => setMensaje(""), 3000);
    } catch (e) { setMensaje("Error al crear regla"); }
  };

  const rulesAMostrar = rules.length > 0 ? rules : WA_RULES.map(r => ({ ...r, activo: r.active, mensaje: r.msg }));

  return (
    <div className="fade">
      <div className="ph">
        <div><div className="pt">Postventa WhatsApp</div><div className="ps">mensajes automaticos - seguimiento - reactivacion</div></div>
        <StatusDot color="#25d366" label="WHATSAPP BUSINESS" />
      </div>
      {mensaje && <div style={{ background: mensaje.includes("Error") ? "#c0392b12" : "#2d7a4f12", border: "1px solid " + (mensaje.includes("Error") ? "#c0392b" : "#2d7a4f"), borderRadius: 6, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: mensaje.includes("Error") ? "#c0392b" : "#2d7a4f" }}>{mensaje}</div>}
      <div className="g4" style={{ marginBottom: 16 }}>
        <MCard label="Reglas activas" value={String(rulesAMostrar.filter(r => r.activo || r.active).length)} color="#25d366" />
        <MCard label="Mensajes enviados" value={String(rulesAMostrar.reduce((s, r) => s + (r.sent || 0), 0))} color="#2d7a4f" />
        <MCard label="Total reglas" value={String(rulesAMostrar.length)} color="#c9a84c" />
        <MCard label="Tasa apertura" value="72%" color="#2471a3" />
      </div>
      <div className="tabs">
        {[["reglas", "REGLAS"], ["nueva", "NUEVA REGLA"]].map(([id, l]) => (
          <div key={id} className={"tab " + (tab === id ? "on" : "")} onClick={() => { setTab(id); setSel(null); }}>{l}</div>
        ))}
      </div>
      {tab === "reglas" && (
        <div className="fade">
          {rulesAMostrar.map((r, ri) => (
            <div key={r.id || ri} className="card" style={{ marginBottom: 12, borderLeft: "3px solid " + ((r.activo || r.active) ? "#25d366" : "#e8e8e8") }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
                    <div style={{ fontSize: 13, color: "#111111" }}>{r.nombre || r.name}</div>
                    <span className="badge bw">WhatsApp</span>
                    {!(r.activo || r.active) && <span className="badge bx">PAUSADO</span>}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 10, color: "#999999", marginBottom: 10 }}>
                    <span>{r.disparador || r.trigger}</span>
                    <span>{r.segmento || r.segment}</span>
                    {r.sent > 0 && <span>{r.sent} enviados</span>}
                  </div>
                  {sel === (r.id || ri) && (
                    <div style={{ background: "#0d1117", borderRadius: 9, overflow: "hidden", border: "1px solid #ffffff08", maxWidth: 320, marginBottom: 12 }}>
                      <div style={{ background: "#1f2937", padding: "10px 14px", display: "flex", alignItems: "center", gap: 9 }}>
                        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#c9a84c", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fafafa", fontWeight: 600 }}>L</div>
                        <div><div style={{ fontSize: 12, color: "#e5e7eb" }}>Lumiere Cosmeticos</div><div style={{ fontSize: 9, color: "#6b7280" }}>en linea</div></div>
                      </div>
                      <div style={{ padding: 14, background: "#111827" }}>
                        <div style={{ background: "#1f2d1f", borderRadius: "0 9px 9px 9px", padding: "9px 13px", maxWidth: "85%" }}>
                          <div style={{ fontSize: 12, color: "#d1fae5", lineHeight: 1.55 }}>
                            {(r.mensaje || r.msg || "").replace("{nombre}", "Maria").replace("{producto}", "Serum Vitamina C").replace("{puntos}", "1.240")}
                          </div>
                          <div style={{ fontSize: 9, color: "#6b7280", textAlign: "right", marginTop: 4 }}>ahora</div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 7 }}>
                    <button className="btn btn-g btn-sm" onClick={() => setSel(sel === (r.id || ri) ? null : (r.id || ri))}>{sel === (r.id || ri) ? "Ocultar" : "Ver mensaje"}</button>
                  </div>
                </div>
                <Sw on={r.activo || r.active || false} toggle={() => toggle(r)} />
              </div>
            </div>
          ))}
        </div>
      )}
      {tab === "nueva" && (
        <div className="g2 fade">
          <div className="card">
            <div className="ct">Nueva regla automatica</div>
            <div className="fg"><div className="fl">Nombre</div><input className="inp" placeholder="Ej: Seguimiento post compra" value={nuevaRegla.nombre} onChange={e => setNuevaRegla(p => ({ ...p, nombre: e.target.value }))} /></div>
            <div className="fg"><div className="fl">Disparador</div>
              <select className="sel" value={nuevaRegla.disparador} onChange={e => setNuevaRegla(p => ({ ...p, disparador: e.target.value }))}>
                <option value="post_compra">N dias despues de la compra</option>
                <option value="inactivo">Dias sin actividad</option>
                <option value="cumpleanos">Cumpleanos del cliente</option>
              </select>
            </div>
            <div className="fg"><div className="fl">Dias</div><input className="inp" type="number" placeholder="7" value={nuevaRegla.dias} onChange={e => setNuevaRegla(p => ({ ...p, dias: e.target.value }))} /></div>
            <div className="fg"><div className="fl">Segmento</div>
              <select className="sel" value={nuevaRegla.segmento} onChange={e => setNuevaRegla(p => ({ ...p, segmento: e.target.value }))}>
                <option>Todos</option><option>Gold y Platinum</option><option>Solo Tiendanube</option><option>Solo presencial</option>
              </select>
            </div>
            <div className="fg">
              <div className="fl">Mensaje</div>
              <textarea className="inp" rows={5} placeholder="Hola {nombre}! ..." style={{ resize: "vertical" }} value={nuevaRegla.mensaje} onChange={e => setNuevaRegla(p => ({ ...p, mensaje: e.target.value }))} />
            </div>
            <button className="btn btn-p" style={{ width: "100%" }} onClick={guardarRegla}>Crear regla</button>
          </div>
          <div className="card">
            <div className="ct">Buenas practicas</div>
            {["Mensajes cortos y personales convierten mas", "Inclui siempre el nombre del producto", "Una pregunta abierta invita a responder", "El emoji justo da calidez sin exceso", "Envia en horario diurno (10 a 20hs)"].map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 7, marginBottom: 9, fontSize: 11, color: "#444444" }}><span style={{ color: "#25d366" }}>v</span>{t}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PortalCliente() {
  const client = CLIENTS[0];
  const [tab, setTab] = useState("canjear");
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#0e0a08 0%,#1a1008 60%,#0e0a08 100%)", fontFamily: "'DM Mono',monospace" }}>
      <div style={{ padding: "16px 32px", borderBottom: "1px solid #ffffff0f", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 20, fontWeight: 700, fontWeight: 300, letterSpacing: ".18em", color: "#c9a84c" }}>LUMIERE</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 11, color: "#ffffff44" }}>{client.email}</span>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#c9a84c", display: "flex", alignItems: "center", justifyContent: "center", color: "#fafafa", fontSize: 13, fontWeight: 600 }}>{client.name[0]}</div>
        </div>
      </div>
      <div style={{ padding: "28px 32px", maxWidth: 860, margin: "0 auto" }}>
        <div style={{ background: "linear-gradient(135deg,#1e1208,#2a1a0a)", border: "1px solid #c9a96e33", borderRadius: 14, padding: 26, marginBottom: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 9, color: "#c9a84c88", letterSpacing: ".25em", textTransform: "uppercase", marginBottom: 5 }}>Bienvenida de nuevo</div>
              <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 24, fontWeight: 700, color: "#f0e8de", marginBottom: 14 }}>{client.name}</div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 20, background: "#c9a84c15", border: "1px solid #c9a96e44", fontSize: 9, color: "#c9a84c", letterSpacing: ".12em" }}>
                NIVEL {client.tier.toUpperCase()}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 52, fontWeight: 700, color: "#c9a84c", lineHeight: 1 }}>{client.points.toLocaleString()}</div>
              <div style={{ fontSize: 9, color: "#ffffff44", letterSpacing: ".2em", marginTop: 3 }}>PUNTOS DISPONIBLES</div>
              <div style={{ fontSize: 10, color: "#ffffff33", marginTop: 6 }}>Proximo nivel: {(2000 - client.points).toLocaleString()} pts</div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
          {[["canjear", "Canjear puntos"], ["cupones", "Mis cupones"], ["historial", "Mis compras"]].map(([id, l]) => (
            <button key={id} onClick={() => setTab(id)} style={{ padding: "8px 16px", borderRadius: 7, border: "1px solid", borderColor: tab === id ? "#c9a84c55" : "#ffffff0f", background: tab === id ? "#c9a84c12" : "transparent", color: tab === id ? "#c9a84c" : "#ffffff44", fontFamily: "'DM Mono',monospace", fontSize: 11, cursor: "pointer" }}>{l}</button>
          ))}
        </div>
        {tab === "canjear" && (
          <div>
            <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 20, fontWeight: 700, color: "#f0e8de", marginBottom: 14 }}>Canjea tus puntos</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
              {REWARDS_DISPLAY.map(r => {
                const can = client.points >= r.pts;
                return (
                  <div key={r.id} style={{ background: can ? "#1e1208" : "#120d07", border: "1px solid " + (can ? "#c9a84c33" : "#ffffff08"), borderRadius: 10, padding: 16, opacity: can ? 1 : 0.5 }}>
                    {can && <div style={{ background: "#2d7a4f", color: "#fafafa", fontSize: 8, padding: "2px 6px", borderRadius: 3, marginBottom: 8, width: "fit-content" }}>PODES CANJEAR</div>}
                    <div style={{ fontSize: 24, marginBottom: 8 }}>{r.emoji}</div>
                    <div style={{ fontSize: 11, color: "#e8ddd4" }}>{r.name}</div>
                    <div style={{ fontSize: 9, color: "#ffffff33", letterSpacing: ".1em", marginTop: 2 }}>{r.brand}</div>
                    <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 20, fontWeight: 700, color: "#c9a84c", marginTop: 10 }}>{r.pts.toLocaleString()}</div>
                    <div style={{ fontSize: 9, color: "#ffffff33" }}>PUNTOS</div>
                    {can && <button style={{ marginTop: 10, width: "100%", padding: "7px", borderRadius: 5, background: "#c9a84c15", border: "1px solid #c9a96e33", color: "#c9a84c", fontFamily: "'DM Mono',monospace", fontSize: 10, cursor: "pointer" }}>Canjear</button>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {tab === "cupones" && (
          <div>
            <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 20, fontWeight: 700, color: "#f0e8de", marginBottom: 14 }}>Tus cupones activos</div>
            {[{ code: "BDAY10", desc: "$10.000 de descuento por cumpleanos", exp: "Valido hasta: 30/06/2026" }, { code: "INSTA20", desc: "20% off en toda la tienda", exp: "Valido hasta: 31/05/2026" }].map((cp, i) => (
              <div key={i} style={{ background: "#1e1208", border: "1px dashed #c9a96e44", borderRadius: 10, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div>
                  <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 20, fontWeight: 700, color: "#c9a84c", letterSpacing: ".1em" }}>{cp.code}</div>
                  <div style={{ fontSize: 11, color: "#ffffff55", marginTop: 3 }}>{cp.desc}</div>
                  <div style={{ fontSize: 10, color: "#ffffff28", marginTop: 4 }}>{cp.exp}</div>
                </div>
                <button style={{ background: "#c9a84c15", border: "1px solid #c9a96e33", color: "#c9a84c", padding: "7px 14px", borderRadius: 5, fontFamily: "'DM Mono',monospace", fontSize: 10, cursor: "pointer" }}>Copiar</button>
              </div>
            ))}
          </div>
        )}
        {tab === "historial" && (
          <div>
            <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 20, fontWeight: 700, color: "#f0e8de", marginBottom: 14 }}>Historial de compras</div>
            {[
              { date: "24/05/2026", items: "Serum Vitamina C x 1", total: 8500, pts: 85, canal: "Local" },
              { date: "10/05/2026", items: "Base Liquida HD, Mascara x 2", total: 13700, pts: 137, canal: "Tiendanube" },
              { date: "28/04/2026", items: "Crema Hidratante FPS50 x 2", total: 12400, pts: 124, canal: "Local" },
            ].map((h, i) => (
              <div key={i} style={{ background: "#1a1108", border: "1px solid #ffffff08", borderRadius: 10, padding: "14px 18px", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 10, color: "#ffffff33", marginBottom: 4 }}>{h.date} - {h.canal}</div>
                  <div style={{ fontSize: 12, color: "#e8ddd4" }}>{h.items}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 20, fontWeight: 700, color: "#c9a84c" }}>${h.total.toLocaleString()}</div>
                  <div style={{ fontSize: 9, color: "#ffffff33", marginTop: 2 }}>+{h.pts} puntos</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


function Comisiones({ localId }) {
  const [datos, setDatos] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState("");

  const cargar = () => {
    setLoading(true);
    Promise.all([
      API.get("/comisiones/" + localId),
      API.get("/comisiones/" + localId + "/historial")
    ]).then(([d, h]) => {
      setDatos(d.data);
      setHistorial(h.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, [localId]);

  const marcarPagada = async () => {
    try {
      await API.put("/comisiones/" + localId + "/pagar");
      setMensaje("Comision marcada como pagada!");
      cargar();
      setTimeout(() => setMensaje(""), 3000);
    } catch (e) { setMensaje("Error al marcar como pagada"); }
  };

  const nivelColor = datos?.nivel === 2 ? "#c9a84c" : datos?.nivel === 1 ? "#2d7a4f" : "#999999";
  const nivelEmoji = datos?.nivel === 2 ? "🏆" : datos?.nivel === 1 ? "⭐" : "🎯";

  return (
    <div className="fade">
      <div className="ph">
        <div><div className="pt">Comisiones</div><div className="ps">facturacion del mes - metas - premios</div></div>
        <button className="btn btn-g btn-sm" onClick={cargar}>Actualizar</button>
      </div>
      {mensaje && <div style={{ background: mensaje.includes("Error") ? "#c0392b12" : "#2d7a4f12", border: "1px solid " + (mensaje.includes("Error") ? "#c0392b" : "#2d7a4f"), borderRadius: 6, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: mensaje.includes("Error") ? "#c0392b" : "#2d7a4f" }}>{mensaje}</div>}
      {loading ? <div style={{ textAlign: "center", color: "#999999", padding: 40 }}>Calculando comisiones...</div> : datos && (
        <>
          <div className="g3" style={{ marginBottom: 18 }}>
            <div className="card" style={{ borderTop: "3px solid " + nivelColor }}>
              <div className="ct">Facturacion del mes</div>
              <div className="metric" style={{ color: "#111111" }}>${parseFloat(datos.facturacion || 0).toLocaleString()}</div>
              <div className="msub">solo ventas presenciales</div>
            </div>
            <div className="card" style={{ borderTop: "3px solid " + nivelColor }}>
              <div className="ct">Comision ganada</div>
              <div className="metric" style={{ color: nivelColor }}>${parseFloat(datos.comision || 0).toLocaleString()}</div>
              <div className="msub">{nivelEmoji} {datos.nivel === 0 ? "Aun no alcanzada" : datos.nivel === 1 ? "Meta 1 alcanzada!" : "Meta maxima!"}</div>
            </div>
            <div className="card">
              <div className="ct">Proximo objetivo</div>
              <div className="metric" style={{ color: "#c9a84c" }}>
                {datos.nivel === 0 ? "$" + parseFloat(datos.falta_nivel1 || 0).toLocaleString() : datos.nivel === 1 ? "$" + parseFloat(datos.falta_nivel2 || 0).toLocaleString() : "MAX"}
              </div>
              <div className="msub">{datos.nivel === 2 ? "Meta maxima alcanzada!" : "para el proximo nivel"}</div>
            </div>
          </div>

          <div className="g2">
            <div className="card">
              <div className="ct">Progreso hacia las metas</div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: "#444444", fontWeight: 600 }}>Meta 1 — ${parseFloat(datos.umbral_1 || 0).toLocaleString()}</span>
                  <span style={{ fontSize: 12, color: "#2d7a4f", fontWeight: 600 }}>+${parseFloat(datos.comision_1 || 0).toLocaleString()}</span>
                </div>
                <div className="pb" style={{ height: 10 }}>
                  <div className="pf" style={{ width: datos.pct_nivel1 + "%", background: datos.nivel >= 1 ? "#2d7a4f" : "#c9a84c" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: "#999999" }}>${parseFloat(datos.facturacion || 0).toLocaleString()} facturado</span>
                  <span style={{ fontSize: 10, color: datos.nivel >= 1 ? "#2d7a4f" : "#999999" }}>{datos.pct_nivel1}%</span>
                </div>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: "#444444", fontWeight: 600 }}>Meta 2 — ${parseFloat(datos.umbral_2 || 0).toLocaleString()}</span>
                  <span style={{ fontSize: 12, color: "#c9a84c", fontWeight: 600 }}>+${parseFloat(datos.comision_2 || 0).toLocaleString()}</span>
                </div>
                <div className="pb" style={{ height: 10 }}>
                  <div className="pf" style={{ width: datos.pct_nivel2 + "%", background: datos.nivel >= 2 ? "#c9a84c" : "#dddddd" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: "#999999" }}>${parseFloat(datos.facturacion || 0).toLocaleString()} facturado</span>
                  <span style={{ fontSize: 10, color: datos.nivel >= 2 ? "#c9a84c" : "#999999" }}>{datos.pct_nivel2}%</span>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="ct">Estado del mes</div>
              <div style={{ background: nivelColor + "12", border: "1px solid " + nivelColor + "44", borderRadius: 8, padding: 16, marginBottom: 16, textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>{nivelEmoji}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: nivelColor }}>{datos.mensaje}</div>
              </div>
              {datos.comision > 0 && (
                <button className="btn btn-p" style={{ width: "100%" }} onClick={marcarPagada}>
                  Marcar comision como pagada
                </button>
              )}
            </div>
          </div>

          {historial.length > 0 && (
            <div className="card">
              <div className="ct">Historial de comisiones</div>
              <table>
                <thead><tr><th>Mes</th><th>Facturacion</th><th>Comision</th><th>Estado</th></tr></thead>
                <tbody>
                  {historial.map((h, i) => (
                    <tr key={i}>
                      <td>{h.mes}/{h.anio}</td>
                      <td>${parseFloat(h.facturacion_mes || 0).toLocaleString()}</td>
                      <td style={{ color: "#c9a84c", fontWeight: 600 }}>${parseFloat(h.comision_ganada || 0).toLocaleString()}</td>
                      <td><span className={"badge " + (h.pagada ? "bg" : "ba")}>{h.pagada ? "Pagada" : "Pendiente"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const NAV_SECTIONS = [
  { section: "GESTION", items: [{ id: "dashboard", icon: "◈", label: "Dashboard" }, { id: "pos", icon: "⊕", label: "Punto de Venta" }, { id: "inventory", icon: "⊞", label: "Inventario" }, { id: "clients", icon: "◉", label: "Clientes" }] },
  { section: "FINANZAS", items: [{ id: "finance", icon: "◎", label: "Finanzas" }, { id: "reports", icon: "◐", label: "Informes" }, { id: "comisiones", icon: "💰", label: "Comisiones" }] },
  { section: "MARKETING", items: [{ id: "cupones", icon: "★", label: "Cupones" }, { id: "fidelizacion", icon: "◆", label: "Fidelizacion" }, { id: "postventa", icon: "◇", label: "Postventa WA" }] },
  { section: "CLIENTE", items: [{ id: "portal", icon: "○", label: "Portal Cliente" }] },
];

function getPage(id) {
  if (id === "dashboard") return <Dashboard />;
  if (id === "pos") return <POS />;
  if (id === "inventory") return <Inventario />;
  if (id === "clients") return <Clientes />;
  if (id === "finance") return <Finanzas />;
  if (id === "reports") return <Informes />;
  if (id === "cupones") return <Cupones />;
  if (id === "fidelizacion") return <Fidelizacion />;
  if (id === "postventa") return <PostventaWA />;
  if (id === "portal") return <PortalCliente />;
  return <Dashboard />;
}



// LOGIN SCREEN
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email || !password) return setError("Completá todos los campos");
    setLoading(true);
    try {
      const res = await login({ email, password });
      localStorage.setItem("lumiere_token", res.data.token);
      localStorage.setItem("lumiere_user", JSON.stringify(res.data.usuario));
      onLogin(res.data.usuario);
    } catch (e) {
      setError("Email o contraseña incorrectos");
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #111111 0%, #222222 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ width: 360, background: "#ffffff", border: "1px solid #272220", borderRadius: 12, padding: 36 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 300, letterSpacing: ".18em", color: "#c9a84c" }}>LUMIERE</div>
          <div style={{ fontSize: 9, color: "#999999", letterSpacing: ".3em", marginTop: 4 }}>SISTEMA DE GESTION</div>
        </div>
        {error && <div style={{ background: "#c0392b12", border: "1px solid #d97070", borderRadius: 5, padding: "8px 12px", marginBottom: 16, fontSize: 11, color: "#c0392b" }}>{error}</div>}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 9, color: "#999999", letterSpacing: ".15em", marginBottom: 5 }}>EMAIL</div>
          <input className="inp" type="email" placeholder="tu@email.com" value={email} onChange={e => { setEmail(e.target.value); setError(""); }} />
        </div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 9, color: "#999999", letterSpacing: ".15em", marginBottom: 5 }}>CONTRASEÑA</div>
          <input className="inp" type="password" placeholder="••••••••" value={password} onChange={e => { setPassword(e.target.value); setError(""); }} onKeyDown={e => e.key === "Enter" && handleLogin()} />
        </div>
        <button className="btn btn-p" style={{ width: "100%", padding: 13 }} onClick={handleLogin} disabled={loading}>
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
      </div>
    </div>
  );
}

// LOCAL SELECTOR
function LocalSelector({ usuario, onSelect }) {
  const [locales, setLocales] = useState([]);

  useEffect(() => {
    API.get("/locales").then(res => setLocales(res.data)).catch(() => setLocales([{ id: 1, nombre: "Local 1 - Centro" }, { id: 2, nombre: "Local 2 - Norte" }]));
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#fafafa", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono', monospace" }}>
      <div style={{ width: 420, background: "#ffffff", border: "1px solid #272220", borderRadius: 12, padding: 36 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 300, letterSpacing: ".18em", color: "#c9a84c" }}>LUMIERE</div>
          <div style={{ fontSize: 11, color: "#999999", marginTop: 8 }}>Bienvenida, {usuario?.nombre || "usuario"}</div>
          <div style={{ fontSize: 9, color: "#999999", letterSpacing: ".2em", marginTop: 4 }}>SELECCIONA TU LOCAL</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {locales.map(l => (
            <div key={l.id} onClick={() => onSelect(l)}
              style={{ background: "#f8f8f8", border: "1px solid #272220", borderRadius: 8, padding: "18px 20px", cursor: "pointer", transition: "all .18s", display: "flex", justifyContent: "space-between", alignItems: "center" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#c9a84c"; e.currentTarget.style.background = "#c9a84c08"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#e8e8e8"; e.currentTarget.style.background = "#f8f8f8"; }}>
              <div>
                <div style={{ fontSize: 14, color: "#111111" }}>{l.nombre}</div>
                {l.direccion && <div style={{ fontSize: 10, color: "#999999", marginTop: 3 }}>{l.direccion}</div>}
              </div>
              <span style={{ color: "#c9a84c", fontSize: 16 }}>→</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 20, textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "#999999", cursor: "pointer" }} onClick={() => { localStorage.removeItem("lumiere_token"); localStorage.removeItem("lumiere_user"); window.location.reload(); }}>
            Cerrar sesion
          </div>
        </div>
      </div>
    </div>
  );
}

// PANEL SIN PERMISO
function SinPermiso() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 40 }}>🔒</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#111111" }}>Sin acceso</div>
      <div style={{ fontSize: 13, color: "#999999" }}>No tenes permiso para ver esta seccion</div>
    </div>
  );
}

// PANEL DE USUARIOS (solo jefe)
function Usuarios({ usuario: usuarioActual }) {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [nuevoUsuario, setNuevoUsuario] = useState({ nombre: "", email: "", password: "", rol: "vendedora", rol_id: 3, local_id: 1 });
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    API.get("/auth/usuarios").then(res => { setUsuarios(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const crearUsuario = async () => {
    try {
      await API.post("/auth/register", nuevoUsuario);
      setMensaje("Usuario creado!");
      setShowForm(false);
      setNuevoUsuario({ nombre: "", email: "", password: "", rol: "vendedora", rol_id: 3, local_id: 1 });
      API.get("/auth/usuarios").then(res => setUsuarios(res.data));
      setTimeout(() => setMensaje(""), 3000);
    } catch (e) { setMensaje("Error al crear usuario"); }
  };

  const cambiarPassword = async (id) => {
    const nueva = prompt("Nueva contrasena:");
    if (!nueva) return;
    try {
      await API.put("/auth/usuarios/" + id + "/password", { password: nueva });
      setMensaje("Contrasena actualizada!");
      setTimeout(() => setMensaje(""), 3000);
    } catch (e) { setMensaje("Error al cambiar contrasena"); }
  };

  const rolNombre = { jefe: "Jefe", administrativo: "Administrativo", vendedora: "Vendedora" };
  const rolColor = { jefe: "#c9a84c", administrativo: "#2471a3", vendedora: "#2d7a4f" };

  return (
    <div className="fade">
      <div className="ph">
        <div><div className="pt">Usuarios</div><div className="ps">gestion de equipo y permisos</div></div>
        <button className="btn btn-p btn-sm" onClick={() => setShowForm(!showForm)}>+ Nuevo usuario</button>
      </div>
      {mensaje && <div style={{ background: mensaje.includes("Error") ? "#c0392b12" : "#2d7a4f12", border: "1px solid " + (mensaje.includes("Error") ? "#c0392b" : "#2d7a4f"), borderRadius: 6, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: mensaje.includes("Error") ? "#c0392b" : "#2d7a4f" }}>{mensaje}</div>}
      {showForm && (
        <div className="card fade" style={{ marginBottom: 18 }}>
          <div className="ct">Nuevo usuario</div>
          <div className="g2">
            <div>
              <div className="fg"><div className="fl">Nombre</div><input className="inp" placeholder="Nombre completo" value={nuevoUsuario.nombre} onChange={e => setNuevoUsuario(p => ({ ...p, nombre: e.target.value }))} /></div>
              <div className="fg"><div className="fl">Email</div><input className="inp" type="email" placeholder="email@ejemplo.com" value={nuevoUsuario.email} onChange={e => setNuevoUsuario(p => ({ ...p, email: e.target.value }))} /></div>
              <div className="fg"><div className="fl">Contraseña</div><input className="inp" type="password" placeholder="Contraseña inicial" value={nuevoUsuario.password} onChange={e => setNuevoUsuario(p => ({ ...p, password: e.target.value }))} /></div>
            </div>
            <div>
              <div className="fg"><div className="fl">Rol</div>
                <select className="sel" value={nuevoUsuario.rol} onChange={e => {
                  const rolId = e.target.value === "jefe" ? 1 : e.target.value === "administrativo" ? 2 : 3;
                  setNuevoUsuario(p => ({ ...p, rol: e.target.value, rol_id: rolId }));
                }}>
                  <option value="jefe">Jefe</option>
                  <option value="administrativo">Administrativo</option>
                  <option value="vendedora">Vendedora</option>
                </select>
              </div>
              <div className="fg"><div className="fl">Local</div>
                <select className="sel" value={nuevoUsuario.local_id} onChange={e => setNuevoUsuario(p => ({ ...p, local_id: parseInt(e.target.value) }))}>
                  <option value={1}>Local 1</option>
                  <option value={2}>Local 2</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button className="btn btn-p" style={{ flex: 1 }} onClick={crearUsuario}>Crear</button>
                <button className="btn btn-g" style={{ flex: 1 }} onClick={() => setShowForm(false)}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="card">
        {loading ? <div style={{ color: "#999999", padding: 20 }}>Cargando...</div> :
        <table>
          <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Local</th><th>Acciones</th></tr></thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.id}>
                <td style={{ color: "#111111", fontWeight: 500 }}>{u.nombre}</td>
                <td>{u.email}</td>
                <td><span className="badge" style={{ background: (rolColor[u.rol] || "#999999") + "15", color: rolColor[u.rol] || "#999999" }}>{rolNombre[u.rol] || u.rol}</span></td>
                <td>{u.local_nombre || "—"}</td>
                <td><button className="btn btn-g btn-sm" onClick={() => cambiarPassword(u.id)}>Cambiar contraseña</button></td>
              </tr>
            ))}
          </tbody>
        </table>}
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="ct">Permisos por rol</div>
        <div className="g3">
          {[
            { rol: "Jefe", color: "#c9a84c", permisos: ["Todo sin restricciones", "Gestión de usuarios", "Todos los locales", "Configuracion del sistema"] },
            { rol: "Administrativo", color: "#2471a3", permisos: ["Dashboard", "Inventario", "Clientes", "Finanzas e Informes", "Solo lectura en Cupones"] },
            { rol: "Vendedora", color: "#2d7a4f", permisos: ["Punto de Venta", "Clientes", "Cupones (ver)", "Fidelizacion (ver)", "Postventa WhatsApp", "Alertas de stock"] },
          ].map(r => (
            <div key={r.rol} className="card" style={{ borderTop: "3px solid " + r.color }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#111111", marginBottom: 10 }}>{r.rol}</div>
              {r.permisos.map((p, i) => (
                <div key={i} style={{ display: "flex", gap: 7, marginBottom: 6, fontSize: 12, color: "#444444" }}>
                  <span style={{ color: r.color }}>✓</span>{p}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// APP PRINCIPAL CON LOGIN, MULTI-LOCAL Y PERMISOS
export default function AppWrapper() {
  const [usuario, setUsuario] = useState(null);
  const [local, setLocal] = useState(null);
  const [page, setPage] = useState("dashboard");

  useEffect(() => {
    const token = localStorage.getItem("lumiere_token");
    const user = localStorage.getItem("lumiere_user");
    if (token && user) {
      try {
        const u = JSON.parse(user);
        setUsuario(u);
        if (u.local) setLocal(u.local);
      } catch (e) {}
    }
  }, []);

  const handleLogin = (u) => {
    setUsuario(u);
    localStorage.setItem("lumiere_user", JSON.stringify(u));
    // Si el usuario tiene local asignado desde el backend, no mostrar selector
    // Pero siempre mostrar el selector para poder elegir
  };

  const handleLogout = () => {
    localStorage.removeItem("lumiere_token");
    localStorage.removeItem("lumiere_user");
    setUsuario(null);
    setLocal(null);
    setPage("dashboard");
  };

  const puedeVer = (modulo) => {
    if (!usuario) return false;
    if (usuario.rol === "jefe") return true;
    return usuario.permisos?.[modulo]?.ver === true;
  };

  const puedeModificar = (modulo) => {
    if (!usuario) return false;
    if (usuario.rol === "jefe") return true;
    return usuario.permisos?.[modulo]?.modificar === true;
  };

  if (!usuario) return (
    <>
      <style>{BASE_CSS}</style>
      <LoginScreen onLogin={handleLogin} />
    </>
  );

  if (!local) return (
    <>
      <style>{BASE_CSS}</style>
      <LocalSelector usuario={usuario} onSelect={l => setLocal(l)} />
    </>
  );

  const getPageWithLocal = (id) => {
    if (!puedeVer(id)) return <SinPermiso />;
    if (id === "dashboard") return <Dashboard localId={local.id} />;
    if (id === "pos") return <POS localId={local.id} />;
    if (id === "inventory") return <Inventario localId={local.id} />;
    if (id === "clients") return <Clientes localId={local.id} />;
    if (id === "finance") return <Finanzas localId={local.id} />;
    if (id === "reports") return <Informes localId={local.id} />;
    if (id === "cupones") return <Cupones localId={local.id} />;
    if (id === "fidelizacion") return <Fidelizacion localId={local.id} />;
    if (id === "postventa") return <PostventaWA localId={local.id} />;
    if (id === "portal") return <PortalCliente />;
    if (id === "usuarios") return <Usuarios usuario={usuario} />;
    if (id === "comisiones") return <Comisiones localId={local.id} />;
    return <Dashboard localId={local.id} />;
  };

  const NAV_CON_PERMISOS = NAV_SECTIONS.map(sec => ({
    ...sec,
    items: sec.items.filter(it => puedeVer(it.id))
  })).filter(sec => sec.items.length > 0);

  if (usuario.rol === "jefe") {
    const yaExiste = NAV_CON_PERMISOS.some(s => s.items.some(i => i.id === "usuarios"));
    if (!yaExiste) {
      NAV_CON_PERMISOS.push({ section: "CONFIGURACION", items: [{ id: "usuarios", icon: "👥", label: "Usuarios" }] });
    }
  }

  const rolBadgeColor = { jefe: "#c9a84c", administrativo: "#2471a3", vendedora: "#2d7a4f" };

  return (
    <>
      <style>{BASE_CSS}</style>
      <div className="layout">
        <aside className="sidebar">
          <div className="logo">
            <div className="logo-name">Lumiere</div>
            <div className="logo-sub">{local.nombre}</div>
          </div>
          <nav className="nav">
            {NAV_CON_PERMISOS.map(sec => (
              <div key={sec.section}>
                <div className="nav-section">{sec.section}</div>
                {sec.items.map(it => (
                  <div key={it.id} className={"nav-item " + (page === it.id ? "active" : "")} onClick={() => setPage(it.id)}>
                    <span className="nav-icon">{it.icon}</span>{it.label}
                  </div>
                ))}
              </div>
            ))}
          </nav>
          <div className="sb-footer">
            <div style={{ fontSize: 12, color: "#222222", fontWeight: 600, marginBottom: 4 }}>{usuario?.nombre || "Usuario"}</div>
            <div style={{ marginBottom: 10 }}>
              <span className="badge" style={{ background: (rolBadgeColor[usuario.rol] || "#999") + "15", color: rolBadgeColor[usuario.rol] || "#999" }}>
                {usuario.rol}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <StatusDot color="#2d7a4f" label="ARCA" />
              <StatusDot color="#25d366" label="TIENDANUBE" />
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: "#999999", cursor: "pointer" }} onClick={() => setLocal(null)}>
              ⇄ Cambiar local
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: "#999999", cursor: "pointer" }} onClick={handleLogout}>
              × Cerrar sesion
            </div>
          </div>
        </aside>
        <main className="main">
          {getPageWithLocal(page)}
        </main>
      </div>
    </>
  );
}