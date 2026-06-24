import { useState, useEffect, useRef, Fragment } from "react";
import { getProductos, createVenta, getClientes, getFlujo, getPuntoEquilibrio, agregarEgreso, getResumenFinanzas, getVentas, getAlertasStock, getCupones, createCupon, updateCupon, getRanking, getReglas, createRegla as createReglaWA, updateRegla as updateReglaWA, login, register } from "./api";
import API from "./api";

const C = {
  bg: "#f2f2ef", surface: "#ffffff", card: "#f5f5f5", border: "#e8e8e8",
  accent: "#c9a84c", accentDim: "#c9a84c15", accentHover: "#e8c86a",
  text: "#111111", textSoft: "#444444", textMuted: "#65676B",
  green: "#2d7a4f", greenDim: "#2d7a4f12",
  red: "#c0392b", redDim: "#c0392b12",
  blue: "#2471a3", blueDim: "#2471a312",
  purple: "#7d3c98", purpleDim: "#7d3c9812",
  wa: "#25d366", waDim: "#25d36618",
};

const BASE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #root { margin: 0; padding: 0; width: 100%; overflow-x: hidden; }
body { font-family: 'Inter', sans-serif; background: #F0F2F5; color: #1C1E21; min-height: 100vh; margin: 0; width: 100vw; overflow-x: hidden; -webkit-font-smoothing: antialiased; }
::-webkit-scrollbar { width: 3px; }
::-webkit-scrollbar-thumb { background: #e0e0e0; border-radius: 2px; }
@keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .4; } }
.fade { animation: fadeUp .25s ease forwards; }
.pulse { animation: pulse 2s infinite; }
.layout { display: flex; min-height: 100vh; width: 100%; }
.sidebar { width: 220px; background: #2C3E5C; border-right: none; box-shadow: 2px 0 8px rgba(0,0,0,0.12); display: flex; flex-direction: column; position: fixed; height: 100vh; z-index: 20; overflow-y: auto; }
.logo { padding: 22px 20px 16px; border-bottom: 1px solid rgba(255,255,255,0.15); }
.logo-name { font-family: 'Inter', sans-serif; font-size: 20px; font-weight: 800; letter-spacing: .05em; color: #ffffff; text-transform: uppercase; }
.logo-sub { font-size: 9px; color: rgba(255,255,255,0.65); letter-spacing: .3em; margin-top: 3px; text-transform: uppercase; }
.nav { padding: 12px 10px; flex: 1; }
.nav-section { font-size: 8px; letter-spacing: .25em; color: rgba(255,255,255,0.75); padding: 10px 10px 4px; text-transform: uppercase; }
.nav-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.95); transition: all .18s; margin-bottom: 3px; border: 1px solid transparent; }
.nav-item:hover { color: #ffffff; background: rgba(255,255,255,0.15); }
.nav-item.active { color: #ffffff; font-weight: 700; background: rgba(255,255,255,0.2); border-color: rgba(255,255,255,0.15); }
.nav-icon { font-size: 13px; width: 18px; text-align: center; flex-shrink: 0; }
.sb-footer { padding: 12px 18px; border-top: 1px solid rgba(255,255,255,0.15); }
.main { margin-left: 220px; flex: 1; padding: 20px 24px; min-height: 100vh; background: #F0F2F5; width: calc(100vw - 220px); }
.ph { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 26px; }
.pt { font-family: 'Inter', sans-serif; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; line-height: 1; color: #1C1E21; }
.ps { font-size: 11px; color: #5C5F66; font-weight: 400; margin-top: 5px; }
.g4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 18px; }
.g3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin-bottom: 18px; }
.g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 18px; }
.card { background: #ffffff; border: 1px solid #E4E6EB; box-shadow: 0 3px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.05); border-radius: 12px; padding: 18px; }
.ct { font-size: 10px; letter-spacing: .15em; text-transform: uppercase; color: #5C5F66; font-weight: 600; margin-bottom: 10px; }
.metric { font-family: 'Inter', sans-serif; font-size: 32px; font-weight: 700; line-height: 1; }
.msub { font-size: 12px; color: #5C5F66; font-weight: 400; margin-top: 5px; }
.badge { display: inline-flex; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
.bg { background: #2d7a4f12; color: #2d7a4f; }
.br { background: #c0392b12; color: #c0392b; }
.bb { background: #2C3E5C12; color: #2C3E5C; }
.bp { background: #7d3c9812; color: #7d3c98; }
.ba { background: #c9a84c15; color: #c9a84c; }
.bw { background: #25d36618; color: #25d366; }
.bx { background: #F0F2F5; color: #5C5F66; border: 1px solid #E4E6EB; }
.btn { padding: 11px 20px; border-radius: 10px; font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 700; cursor: pointer; border: none; transition: all .12s; box-shadow: 0 3px 0 rgba(0,0,0,0.18), 0 4px 8px rgba(0,0,0,0.12); position: relative; top: 0; }
.btn:active { top: 3px; box-shadow: 0 0px 0 rgba(0,0,0,0.18), 0 1px 2px rgba(0,0,0,0.1); }
.btn-p { background: linear-gradient(180deg, #36486A 0%, #2C3E5C 100%); color: #ffffff; font-weight: 700; box-shadow: 0 3px 0 #1C2A40, 0 4px 8px rgba(44,62,92,0.3); }
.btn-p:active { box-shadow: 0 0px 0 #1C2A40, 0 1px 2px rgba(44,62,92,0.2); }
.btn-p:hover { background: linear-gradient(180deg, #3D5078 0%, #324567 100%); }
.btn-g { background: linear-gradient(180deg, #FAFBFC 0%, #E4E6EB 100%); color: #1C1E21; border: none; box-shadow: 0 3px 0 #C7CAD1, 0 4px 6px rgba(0,0,0,0.08); }
.btn-g:active { box-shadow: 0 0px 0 #C7CAD1, 0 1px 2px rgba(0,0,0,0.06); }
.btn-g:hover { background: linear-gradient(180deg, #FFFFFF 0%, #D8DADF 100%); }
.btn-sm { padding: 7px 13px; font-size: 10px; box-shadow: 0 2px 0 rgba(0,0,0,0.15), 0 2px 5px rgba(0,0,0,0.1); }
.btn-sm:active { box-shadow: 0 0px 0 rgba(0,0,0,0.15), 0 1px 2px rgba(0,0,0,0.08); }
.inp { width: 100%; background: #F0F2F5; border: 1px solid #E4E6EB; border-radius: 10px; padding: 12px 14px; color: #1C1E21; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 400; outline: none; transition: all .15s; box-shadow: inset 0 1px 3px rgba(0,0,0,0.06); }
.inp:focus { border-color: #2C3E5C; background: #ffffff; }
.inp::placeholder { color: #9CA1A6; }
.sel { background: #F0F2F5; border: 1px solid #E4E6EB; border-radius: 10px; padding: 12px 14px; color: #1C1E21; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 400; outline: none; width: 100%; box-shadow: inset 0 1px 3px rgba(0,0,0,0.06); }
.fg { margin-bottom: 12px; }
.fl { font-size: 11px; color: #5C5F66; font-weight: 600; margin-bottom: 6px; }
.tabs { display: flex; margin-bottom: 20px; border-bottom: 1px solid #E4E6EB; }
.tab { padding: 8px 16px; font-size: 12px; font-weight: 500; color: #5C5F66; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all .18s; }
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
tr:hover td { background: #f0f0ed; }
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
  emoji: r.emoji === "ok_hand" ? "👌" : r.emoji === "droplet" ? "💧" : r.emoji === "lipstick" ? "💄" : r.emoji === "gift" ? "🎁" : r.emoji === "herb" ? "🌿" : "🌸",
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

function Dashboard({ localId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tabLocal, setTabLocal] = useState("rg");
  const [vencimientos, setVencimientos] = useState([]);
  const mes = new Date().getMonth() + 1;
  const anio = new Date().getFullYear();

  useEffect(() => {
    API.get("/ordenes-ingreso/alertas/vencimientos").then(res => setVencimientos(res.data || [])).catch(() => {});
  }, []);

  const cargar = async () => {
    setLoading(true);
    try {
      const local = tabLocal === "rg" ? "1" : tabLocal === "ush" ? "2" : "";
      const params = "mes=" + mes + "&anio=" + anio + (local ? "&local_id=" + local : "");
      const [ventasRes, prodRes, clientesRes, finRes] = await Promise.all([
        API.get("/ventas?" + params),
        API.get("/productos"),
        API.get("/clientes"),
        API.get("/finanzas/flujo?" + params).catch(() => ({ data: { resumen: { ingresos: 0, egresos: 0, neto: 0 } } }))
      ]);
      const ventas = ventasRes.data || [];
      const productos = prodRes.data || [];
      const clientes = clientesRes.data || [];
      const fin = finRes.data?.resumen || { ingresos: 0, egresos: 0, neto: 0 };

      const totalVentas = ventas.reduce((s, v) => s + parseFloat(v.total || 0), 0);
      const cantVentas = ventas.length;
      const ticketProm = cantVentas > 0 ? totalVentas / cantVentas : 0;
      const costoVentas = ventas.reduce((s, v) => s + parseFloat(v.costo_total || 0), 0);
      const margenBruto = totalVentas > 0 ? Math.round(((totalVentas - costoVentas) / totalVentas) * 100) : 0;
      const stockBajo = productos.filter(p => (p.stock || 0) <= (p.stock_minimo || 5));
      const sinStock = productos.filter(p => !p.stock || p.stock === 0);
      const clientesNuevos = clientes.filter(c => {
        const fecha = new Date(c.creado_en || c.fecha);
        return fecha.getMonth() + 1 === mes && fecha.getFullYear() === anio;
      }).length;

      // Ventas por medio de pago
      const ventasPorMedio = {};
      ventas.forEach(v => {
        const m = v.medio_pago || "Efectivo";
        ventasPorMedio[m] = (ventasPorMedio[m] || 0) + parseFloat(v.total || 0);
      });

      // Top productos por ventas (from venta_items if available)
      const prodVentas = {};
      ventas.forEach(v => {
        if (v.items) v.items.forEach(i => {
          prodVentas[i.nombre] = (prodVentas[i.nombre] || 0) + i.cantidad;
        });
      });

      setData({ ventas, totalVentas, cantVentas, ticketProm, margenBruto, costoVentas, stockBajo, sinStock, clientesNuevos, clientes, fin, ventasPorMedio, prodVentas, productos });
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { cargar(); }, [tabLocal]);

  const KPI = ({ titulo, valor, sub, color, alerta }) => (
    <div className="card" style={{ borderTop: "3px solid " + (alerta ? "#c0392b" : (color || "#c9a84c")) }}>
      <div className="ct">{titulo}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: alerta ? "#c0392b" : (color || "#111111") }}>{valor}</div>
      {sub && <div style={{ fontSize: 11, color: "#65676B", marginTop: 4 }}>{sub}</div>}
    </div>
  );

  const Semaforo = ({ valor, umbralOk, umbralAlerta, formato }) => {
    const color = valor >= umbralOk ? "#2d7a4f" : valor >= umbralAlerta ? "#e67e22" : "#c0392b";
    const icono = valor >= umbralOk ? "🟢" : valor >= umbralAlerta ? "🟡" : "🔴";
    return <span style={{ color, fontSize: 12, fontWeight: 700 }}>{icono} {formato ? formato(valor) : valor}</span>;
  };

  return (
    <div className="fade">
      <div className="ph">
        <div><div className="pt">Dashboard</div><div className="ps">{"KPIs del mes de " + ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"][mes-1]}</div></div>
        <button className="btn btn-g btn-sm" onClick={cargar}>Actualizar</button>
      </div>
      {vencimientos.length > 0 && (() => {
        const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
        const vencidas = vencimientos.filter(v => new Date(v.fecha_vencimiento) < hoy).length;
        const totalAdeudado = vencimientos.reduce((s, v) => s + parseFloat(v.total || 0), 0);
        return (
          <div style={{ background: vencidas > 0 ? "#c0392b12" : "#c9a84c12", border: "1px solid " + (vencidas > 0 ? "#c0392b" : "#c9a84c"), borderRadius: 8, padding: "12px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: vencidas > 0 ? "#c0392b" : "#c9a84c" }}>
                {vencidas > 0 ? vencidas + " factura" + (vencidas > 1 ? "s" : "") + " vencida" + (vencidas > 1 ? "s" : "") + (vencimientos.length > vencidas ? " y " + (vencimientos.length - vencidas) + " por vencer" : "") : vencimientos.length + " factura" + (vencimientos.length > 1 ? "s" : "") + " vence" + (vencimientos.length > 1 ? "n" : "") + " en los proximos 7 dias"}
              </div>
              <div style={{ fontSize: 11, color: "#666666", marginTop: 2 }}>Total adeudado: ${totalAdeudado.toLocaleString("es-AR", { maximumFractionDigits: 0 })} - revisalo en Proveedores</div>
            </div>
          </div>
        );
      })()}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["rg","ush","consolidado"].map(l => (
          <button key={l} onClick={() => setTabLocal(l)} className="btn btn-sm"
            style={{ background: tabLocal === l ? "#c9a84c15" : "transparent", border: "1px solid " + (tabLocal === l ? "#c9a84c" : "#e8e8e8"), color: tabLocal === l ? "#c9a84c" : "#65676B", fontWeight: tabLocal === l ? 600 : 400 }}>
            {l === "rg" ? "Rio Grande" : l === "ush" ? "Ushuaia" : "Consolidado"}
          </button>
        ))}
      </div>
      {loading ? (
        <div style={{ textAlign: "center", color: "#65676B", padding: 40 }}>Cargando KPIs...</div>
      ) : data && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#65676B", letterSpacing: ".1em", marginBottom: 10 }}>FINANCIERO</div>
          <div className="g3" style={{ marginBottom: 20 }}>
            <KPI titulo="Ventas del mes" valor={"$" + Math.round(data.totalVentas).toLocaleString()} sub={data.cantVentas + " transacciones"} color="#2d7a4f" />
            <KPI titulo="Resultado neto" valor={"$" + Math.round(data.fin.neto || 0).toLocaleString()} sub={"Ingresos - Egresos"} color={data.fin.neto >= 0 ? "#2d7a4f" : "#c0392b"} alerta={data.fin.neto < 0} />
            <KPI titulo="Margen bruto" valor={data.margenBruto + "%"} sub="sobre costo de ventas" color={data.margenBruto >= 40 ? "#2d7a4f" : data.margenBruto >= 20 ? "#e67e22" : "#c0392b"} />
          </div>
          <div className="g3" style={{ marginBottom: 20 }}>
            <KPI titulo="Ticket promedio" valor={"$" + Math.round(data.ticketProm).toLocaleString()} sub="por transaccion" color="#2471a3" />
            <KPI titulo="Clientes nuevos" valor={data.clientesNuevos} sub="este mes" color="#7d3c98" />
            <KPI titulo="Total clientes" valor={data.clientes.length} sub="en la base" color="#2471a3" />
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: "#65676B", letterSpacing: ".1em", marginBottom: 10, marginTop: 4 }}>INVENTARIO</div>
          <div className="g3" style={{ marginBottom: 20 }}>
            <KPI titulo="Productos totales" valor={data.productos.length} sub="en catalogo" />
            <KPI titulo="Stock bajo" valor={data.stockBajo.length} sub="bajo el minimo" alerta={data.stockBajo.length > 0} color="#e67e22" />
            <KPI titulo="Sin stock" valor={data.sinStock.length} sub="agotados" alerta={data.sinStock.length > 0} color="#c0392b" />
          </div>

          <div className="g2" style={{ marginBottom: 20 }}>
            <div className="card">
              <div className="ct">Semaforo de salud del negocio</div>
              {[
                { l: "Margen bruto", v: data.margenBruto, ok: 40, alerta: 20, fmt: v => v + "%" },
                { l: "Ticket promedio", v: data.ticketProm, ok: 5000, alerta: 2000, fmt: v => "$" + Math.round(v).toLocaleString() },
                { l: "Resultado neto", v: data.fin.neto, ok: 1, alerta: 0, fmt: v => "$" + Math.round(v).toLocaleString() },
                { l: "Stock bajo", v: data.stockBajo.length === 0 ? 1 : data.stockBajo.length > 5 ? -1 : 0, ok: 1, alerta: 0, fmt: () => data.stockBajo.length === 0 ? "OK" : data.stockBajo.length + " productos" },
              ].map(r => (
                <div key={r.l} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f5f5f5" }}>
                  <span style={{ fontSize: 12, color: "#444444" }}>{r.l}</span>
                  <Semaforo valor={r.v} umbralOk={r.ok} umbralAlerta={r.alerta} formato={r.fmt} />
                </div>
              ))}
            </div>
            <div className="card">
              <div className="ct">Ventas por medio de pago</div>
              {Object.keys(data.ventasPorMedio).length === 0 ? (
                <div style={{ color: "#65676B", fontSize: 12, textAlign: "center", padding: 20 }}>Sin datos este mes</div>
              ) : (
                <div>
                  {Object.entries(data.ventasPorMedio).sort((a,b) => b[1]-a[1]).slice(0, 6).map(([medio, total]) => {
                    const pct = data.totalVentas > 0 ? Math.round((total / data.totalVentas) * 100) : 0;
                    return (
                      <div key={medio} style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                          <span style={{ fontSize: 11, color: "#444444" }}>{medio}</span>
                          <span style={{ fontSize: 11, color: "#c9a84c", fontWeight: 600 }}>{pct}%</span>
                        </div>
                        <div className="pb"><div className="pf" style={{ width: pct + "%" }} /></div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {data.stockBajo.length > 0 && (
            <div className="card" style={{ borderLeft: "3px solid #c0392b", marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div className="ct" style={{ color: "#c0392b", margin: 0 }}>Alertas de stock</div>
                <span style={{ fontSize: 10, background: "#c0392b15", color: "#c0392b", padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>{data.stockBajo.length} productos</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {data.stockBajo.slice(0, 8).map((p, i) => (
                  <div key={i} style={{ background: "#c0392b08", border: "1px solid #c0392b22", borderRadius: 6, padding: "6px 10px", fontSize: 11 }}>
                    <div style={{ fontWeight: 600, color: "#444444" }}>{p.nombre}</div>
                    <div style={{ color: "#c0392b" }}>Stock: {p.stock || 0}u</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card">
            <div className="ct">Ultimas ventas</div>
            {data.ventas.length === 0 ? (
              <div style={{ color: "#65676B", fontSize: 12, textAlign: "center", padding: 20 }}>Sin ventas este mes</div>
            ) : (
              <table>
                <thead><tr><th>Fecha</th><th>Cliente</th><th>Medio</th><th>Total</th></tr></thead>
                <tbody>
                  {data.ventas.slice(0, 8).map((v, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: 11, color: "#65676B" }}>{new Date(v.creado_en || v.fecha).toLocaleDateString("es-AR")}</td>
                      <td style={{ fontSize: 12 }}>{v.cliente_nombre || "Consumidor final"}</td>
                      <td style={{ fontSize: 11 }}>{v.medio_pago || "-"}</td>
                      <td style={{ color: "#2d7a4f", fontWeight: 600 }}>${parseFloat(v.total || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function POS({ localId, usuario }) {
  const [cart, setCart] = useState([]);
  const [inicioVenta, setInicioVenta] = useState(null);
  const [modoPrueba, setModoPrueba] = useState(false);
  const [gcCodigo, setGcCodigo] = useState("");
  const [gcAplicada, setGcAplicada] = useState(null);
  const [gcMsg, setGcMsg] = useState("");
  const [dniInput, setDniInput] = useState("");
  const [tipoFac, setTipoFac] = useState("B");
  const [productos, setProductos] = useState([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [showNuevoCliente, setShowNuevoCliente] = useState(false);
  const [nuevoClienteDni, setNuevoClienteDni] = useState({ nombre: "", telefono: "" });
  const [cupon, setCupon] = useState("");
  const [cuponAplicado, setCuponAplicado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [preventa, setPreventa] = useState(false);
  const [nombrePreventa, setNombrePreventa] = useState("");
  const [mediosPago, setMediosPago] = useState([]);
  const [descuentoManual, setDescuentoManual] = useState("");
  const [tipoDescuento, setTipoDescuento] = useState("%");
  const [medioPagoSel, setMedioPagoSel] = useState(null);
  const [codigoGC, setCodigoGC] = useState("");
  const [giftCardAplicada, setGiftCardAplicada] = useState(null);
  const [errorGC, setErrorGC] = useState("");
  const [buscandoGC, setBuscandoGC] = useState(false);
  const [tabPos, setTabPos] = useState("venta");
  const [preventasPendientes, setPreventasPendientes] = useState([]);
  const [confirmandoPreventa, setConfirmandoPreventa] = useState(null);
  const [medioPagoConfirmacion, setMedioPagoConfirmacion] = useState("");
  const [errorConfirmacion, setErrorConfirmacion] = useState("");

  const cargarPreventas = async () => {
    try {
      const res = await API.get("/ventas?es_preventa=true&local_id=" + (localId || 1));
      setPreventasPendientes((res.data || []).filter(v => v.estado !== "cancelada" && v.estado !== "entregada"));
    } catch (e) {}
  };

  useEffect(() => {
    const localParam = localId === 2 ? "ush" : "rg";
    API.get("/productos?local=" + localParam).then(res => setProductos(res.data)).catch(() => setProductos(PRODUCTS));
    API.get("/medios-pago").then(res => setMediosPago(res.data)).catch(() => setMediosPago([]));
    cargarPreventas();
  }, [localId]);

  const add = (p) => setCart(prev => {
    const e = prev.find(i => i.id === p.id);
    return e ? prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i) : [...prev, { ...p, qty: 1 }];
  });
  const remove = (id) => setCart(prev => prev.filter(i => i.id !== id));

  const agregarComoPreventa = (p) => {
    if (!preventa) setPreventa(true);
    add(p);
  };

  const [showEmitirGC, setShowEmitirGC] = useState(false);
  const [nuevaGC, setNuevaGC] = useState({ monto: "", beneficiario_nombre: "", beneficiario_telefono: "" });
  const [errorEmitirGC, setErrorEmitirGC] = useState("");
  const [gcEmitidaOk, setGcEmitidaOk] = useState(null);

  const emitirGiftCardPOS = async () => {
    if (!nuevaGC.monto || parseFloat(nuevaGC.monto) <= 0) return setErrorEmitirGC("Ingresa un monto valido");
    if (!nuevaGC.beneficiario_nombre) return setErrorEmitirGC("Falta el nombre de quien recibe la gift card");
    setErrorEmitirGC("");
    try {
      const res = await API.post("/gift-cards", {
        ...nuevaGC, cliente_id: clienteSeleccionado?.id || null,
        local_id: localId || 1, emitida_por: usuario?.id || null
      });
      setGcEmitidaOk(res.data);
      setNuevaGC({ monto: "", beneficiario_nombre: "", beneficiario_telefono: "" });
    } catch (e) { setErrorEmitirGC(e.response?.data?.error || "Error al emitir la gift card"); }
  };

  const coef = medioPagoSel ? parseFloat(medioPagoSel.coeficiente) : 1;
  const subtotalBase = cart.reduce((s, i) => s + (i.precio || i.price) * i.qty, 0);
  const descuentoCupon = cuponAplicado ? (cuponAplicado.tipo === "%" ? subtotalBase * (cuponAplicado.valor / 100) : cuponAplicado.valor) : 0;
  const descuentoManualCalc = descuentoManual ? (tipoDescuento === "%" ? subtotalBase * (parseFloat(descuentoManual) / 100) : parseFloat(descuentoManual)) : 0;
  const descuento = descuentoCupon + descuentoManualCalc;
  const subtotalConDesc = subtotalBase - descuento;
  const total = Math.round(subtotalConDesc * coef);
  const intereses = total - subtotalConDesc;
  const montoAplicadoGC = giftCardAplicada ? Math.min(parseFloat(giftCardAplicada.saldo), total) : 0;
  const restaPagar = Math.max(total - montoAplicadoGC, 0);

  const buscarGiftCard = async () => {
    if (!codigoGC.trim()) return;
    setErrorGC(""); setBuscandoGC(true);
    try {
      const res = await API.get("/gift-cards/codigo/" + codigoGC.trim().toUpperCase());
      if (res.data.estado === "agotada" || parseFloat(res.data.saldo) <= 0) {
        setErrorGC("Esta gift card ya no tiene saldo disponible");
      } else {
        setGiftCardAplicada(res.data);
      }
    } catch (e) {
      setErrorGC(e.response?.data?.error || "Codigo no encontrado");
    }
    setBuscandoGC(false);
  };

  const quitarGiftCard = () => {
    setGiftCardAplicada(null);
    setCodigoGC("");
    setErrorGC("");
  };

  const buscarClientePorDni = async (dni) => {
    setDniInput(dni);
    if (dni.length < 7) { setClienteSeleccionado(null); return; }
    setBuscandoCliente(true);
    try {
      const res = await API.get("/clientes?local_id=" + (localId || 1));
      const encontrado = res.data.find(c => c.cuit_dni === dni);
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
      else setMensaje("Cupon invalido");
      setTimeout(() => setMensaje(""), 2000);
    } catch (e) {}
  };

  const emitirFactura = async () => {
    if (cart.length === 0) return setMensaje("Agrega productos al ticket");
    if (restaPagar > 0 && !medioPagoSel) return setMensaje("Selecciona un medio de pago para la diferencia");
    setLoading(true);
    try {
      const items = cart.map(i => ({ producto_id: i.id, cantidad: i.qty, precio_unitario: i.precio || i.price }));
      const ventaRes = await createVenta({
        cliente_id: clienteSeleccionado?.id || null,
        tipo_factura: tipoFac, items, canal: "presencial",
        cupon_codigo: cupon || null, local_id: localId || 1,
        medio_pago_id: medioPagoSel?.id || null, medio_pago_nombre: restaPagar > 0 ? medioPagoSel?.nombre : "Gift Card",
        total_con_interes: total, es_preventa: preventa,
        nombre_preventa: preventa ? nombrePreventa : null,
        monto_gift_card: montoAplicadoGC
      });
      if (giftCardAplicada && montoAplicadoGC > 0) {
        try {
          await API.post("/gift-cards/" + giftCardAplicada.id + "/canjear", {
            importe: montoAplicadoGC, venta_id: ventaRes.data.id, usuario_id: usuario?.id || null
          });
        } catch (gcErr) {}
      }
      if (!preventa) {
        try {
          const arcaRes = await API.post("/arca/emitir", { tipo: tipoFac, items, total, cliente_cuit: clienteSeleccionado?.cuit_dni || null, venta_id: ventaRes.data.id });
          setMensaje("✅ " + arcaRes.data.mensaje + " | CAE: " + arcaRes.data.cae);
        } catch (arcaErr) {
          setMensaje("Venta registrada pero error en ARCA: " + arcaErr.message);
        }
      } else {
        setMensaje("Preventa registrada para " + nombrePreventa + "!");
      }
      setCart([]); setDniInput(""); setCupon(""); setCuponAplicado(null);
      setClienteSeleccionado(null); setShowNuevoCliente(false);
      setMedioPagoSel(null); setPreventa(false); setNombrePreventa(""); setDescuentoManual(""); setTipoDescuento("%");
      quitarGiftCard();
      setTimeout(() => setMensaje(""), 8000);
    } catch (error) { setMensaje("Error al emitir factura"); }
    setLoading(false);
  };

  const abrirConfirmacionEntrega = (p) => {
    setConfirmandoPreventa(p);
    setMedioPagoConfirmacion(p.medio_pago_id || "");
    setErrorConfirmacion("");
  };

  const confirmarEntregaPreventa = async () => {
    if (!confirmandoPreventa) return;
    if (!medioPagoConfirmacion) return setErrorConfirmacion("Selecciona el medio de pago");
    setErrorConfirmacion("");
    try {
      const m = mediosPago.find(x => x.id === parseInt(medioPagoConfirmacion));
      const totalOriginal = parseFloat(confirmandoPreventa.total || 0);
      const coefM = m ? parseFloat(m.coeficiente) : 1;
      const totalConInteres = Math.round(totalOriginal * coefM);
      await API.put("/ventas/" + confirmandoPreventa.id + "/confirmar-entrega", {
        medio_pago_id: m?.id || null,
        medio_pago_nombre: m?.nombre || null,
        total_con_interes: totalConInteres,
        usuario_id: usuario?.id || null
      });
      setMensaje("Entrega confirmada! Stock descontado y reserva liberada.");
      setConfirmandoPreventa(null);
      cargarPreventas();
      setTimeout(() => setMensaje(""), 5000);
    } catch (e) {
      setErrorConfirmacion(e.response?.data?.error || "Error al confirmar la entrega");
    }
  };

  const cancelarPreventa = async (p) => {
    try {
      await API.put("/ventas/" + p.id, { estado: "cancelada" });
      setMensaje("Preventa cancelada, reserva liberada.");
      cargarPreventas();
      setTimeout(() => setMensaje(""), 4000);
    } catch (e) { setMensaje("Error al cancelar la preventa"); }
  };

  const productosAMostrar = (productos.length > 0 ? productos : PRODUCTS).filter(p =>
    !busqueda || (p.nombre || p.name || "").toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.marca || p.brand || "").toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.codigo_barras || p.codigo || "").toLowerCase().includes(busqueda.toLowerCase())
  );

  if (tabPos === "preventas") {
    return (
      <div className="fade">
        <div className="ph">
          <div><div className="pt">Punto de Venta</div><div className="ps">facturacion electronica - arca</div></div>
          <StatusDot color="#2d7a4f" label="ARCA" />
        </div>
        <div className="tabs">
          <div className="tab" onClick={() => setTabPos("venta")}>NUEVA VENTA</div>
          <div className="tab on" onClick={() => { setTabPos("preventas"); cargarPreventas(); }}>
            PREVENTAS {preventasPendientes.length > 0 && <span style={{ background: "#2471a3", color: "white", borderRadius: 10, fontSize: 8, padding: "1px 5px", marginLeft: 4 }}>{preventasPendientes.length}</span>}
          </div>
        </div>
        {mensaje && (
          <div style={{ background: mensaje.includes("Error") ? "#c0392b12" : "#2d7a4f12", border: "1px solid " + (mensaje.includes("Error") ? "#c0392b" : "#2d7a4f"), borderRadius: 6, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: mensaje.includes("Error") ? "#c0392b" : "#2d7a4f" }}>
            {mensaje}
          </div>
        )}
        {preventasPendientes.length === 0 ? (
          <div style={{ textAlign: "center", color: "#65676B", padding: 40, fontSize: 13 }}>No hay preventas pendientes</div>
        ) : preventasPendientes.map(p => (
          <div key={p.id} className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{p.nombre_preventa || "Consumidor Final"}</div>
                {p.cliente_nombre && <div style={{ fontSize: 11, color: "#2d7a4f" }}>{p.cliente_nombre} {p.cliente_dni ? "- DNI: " + p.cliente_dni : ""}</div>}
                <div style={{ fontSize: 11, color: "#65676B", marginTop: 2 }}>{new Date(p.creado_en).toLocaleDateString("es-AR")} - ${parseFloat(p.total).toLocaleString()}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-p btn-sm" onClick={() => abrirConfirmacionEntrega(p)}>Confirmar entrega</button>
                <button className="btn btn-g btn-sm" onClick={() => cancelarPreventa(p)}>Cancelar</button>
              </div>
            </div>
            {p.items && p.items.length > 0 && (
              <div style={{ background: "#f8f8f8", borderRadius: 6, padding: "6px 10px" }}>
                {p.items.map((it, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "3px 0", borderBottom: idx < p.items.length - 1 ? "1px solid #f0f0f0" : "none" }}>
                    <span style={{ color: "#444444" }}>{it.nombre || it.producto_nombre} x{it.cantidad}</span>
                    <span style={{ color: "#65676B" }}>${parseFloat(it.precio_unitario || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {confirmandoPreventa && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
            <div className="card" style={{ width: 380, background: "#ffffff" }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Confirmar entrega</div>
              <div style={{ fontSize: 12, color: "#65676B", marginBottom: 14 }}>{confirmandoPreventa.nombre_preventa || "Consumidor Final"} viene a retirar su pedido. Esto descuenta del stock real y libera la reserva.</div>
              {errorConfirmacion && (
                <div style={{ background: "#c0392b12", border: "1px solid #c0392b", borderRadius: 6, padding: "8px 12px", marginBottom: 10, fontSize: 11, color: "#c0392b" }}>{errorConfirmacion}</div>
              )}
              <div className="fl">Medio de pago</div>
              <select className="sel" style={{ marginBottom: 14 }} value={medioPagoConfirmacion} onChange={e => setMedioPagoConfirmacion(e.target.value)}>
                <option value="">Seleccionar...</option>
                {["efectivo", "transferencia", "debito", "credito", "plataforma"].map(tipo => (
                  <optgroup key={tipo} label={tipo === "efectivo" ? "Efectivo" : tipo === "transferencia" ? "Transferencia" : tipo === "debito" ? "Debito" : tipo === "credito" ? "Credito" : "Plataformas"}>
                    {mediosPago.filter(m => m.tipo === tipo).map(m => (
                      <option key={m.id} value={m.id}>{m.nombre}{m.con_interes ? " (+" + Math.round((parseFloat(m.coeficiente) - 1) * 100) + "%)" : ""}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-g" style={{ flex: 1 }} onClick={() => setConfirmandoPreventa(null)}>Cancelar</button>
                <button className="btn btn-p" style={{ flex: 1 }} onClick={confirmarEntregaPreventa}>Confirmar y cobrar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fade">
      <div className="ph">
        <div><div className="pt">Punto de Venta</div><div className="ps">facturacion electronica - arca</div></div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {usuario?.rol === "jefe" && (
            <div className="sw-wrap" onClick={() => { setModoPrueba(!modoPrueba); setMensaje(""); }}>
              <div className={"sw " + (modoPrueba ? "on" : "off")}><div className="sw-dot" /></div>
              <span style={{ fontSize: 11, color: modoPrueba ? "#c0392b" : "#65676B" }}>Modo prueba</span>
            </div>
          )}
          <div className="sw-wrap" onClick={() => { setPreventa(!preventa); setMensaje(""); }}>
            <div className={"sw " + (preventa ? "on" : "off")}><div className="sw-dot" /></div>
            <span style={{ fontSize: 11, color: preventa ? "#2471a3" : "#65676B" }}>Preventa</span>
          </div>
          <StatusDot color="#2d7a4f" label="ARCA" />
        </div>
      </div>
      {modoPrueba && (
        <div style={{ background: "#c0392b12", border: "1px solid #c0392b", borderRadius: 6, padding: "10px 16px", marginBottom: 12, fontSize: 12, color: "#c0392b", fontWeight: 600 }}>
          🧪 MODO PRUEBA ACTIVO — las ventas NO se facturan en ARCA. Desactivalo para vender de verdad.
        </div>
      )}
      <div className="tabs">
        <div className="tab on" onClick={() => setTabPos("venta")}>NUEVA VENTA</div>
        <div className="tab" onClick={() => { setTabPos("preventas"); cargarPreventas(); }}>
          PREVENTAS {preventasPendientes.length > 0 && <span style={{ background: "#2471a3", color: "white", borderRadius: 10, fontSize: 8, padding: "1px 5px", marginLeft: 4 }}>{preventasPendientes.length}</span>}
        </div>
      </div>
      {mensaje && (
        <div style={{ background: mensaje.includes("Error") ? "#c0392b12" : "#2d7a4f12", border: "1px solid " + (mensaje.includes("Error") ? "#c0392b" : "#2d7a4f"), borderRadius: 6, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: mensaje.includes("Error") ? "#c0392b" : "#2d7a4f" }}>
          {mensaje}
        </div>
      )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 340px", gap: 12, height: "calc(100vh - 160px)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, overflow: "hidden" }}>
          <input className="inp" placeholder="Buscar por nombre, marca o codigo..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          <div style={{ overflowY: "auto", flex: 1, background: "#ffffff", border: "1px solid #e8e8e8", borderRadius: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ position: "sticky", top: 0, background: "#f8f8f8", zIndex: 1 }}>
                <tr>
                  <th style={{ textAlign: "left", fontSize: 10, color: "#888888", padding: "7px 10px", fontWeight: 600, borderBottom: "2px solid #eeeeee" }}>PRODUCTO</th>
                  <th style={{ textAlign: "right", fontSize: 10, color: "#888888", padding: "7px 8px", fontWeight: 600, borderBottom: "2px solid #eeeeee" }}>PRECIO</th>
                  <th style={{ textAlign: "center", fontSize: 10, color: "#888888", padding: "7px 8px", fontWeight: 600, borderBottom: "2px solid #eeeeee" }}>STOCK</th>
                  <th style={{ borderBottom: "2px solid #eeeeee", padding: "7px 4px", width: 70 }}></th>
                </tr>
              </thead>
              <tbody>
                {productosAMostrar.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: "center", color: "#cccccc", padding: 30, fontSize: 12 }}>Sin productos</td></tr>
                ) : productosAMostrar.map(p => {
                  const disp = p.disponible !== undefined ? p.disponible : (p.stock || 0);
                  const transitoLocal = p.transito_local || 0;
                  const soloTransito = disp <= 0 && transitoLocal > 0;
                  const sinStock = disp <= 0 && transitoLocal <= 0;
                  const accion = soloTransito ? (() => agregarComoPreventa(p)) : (() => add(p));
                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid #f5f5f5", cursor: sinStock ? "not-allowed" : "pointer", opacity: sinStock ? 0.45 : 1 }}
                      onClick={() => { if (!sinStock) accion(); }}>
                      <td style={{ padding: "4px 10px" }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#111111" }}>{p.nombre || p.name}</div>
                        <div style={{ fontSize: 9, color: "#888888" }}>{p.marca || p.brand || ""}</div>
                      </td>
                      <td style={{ padding: "4px 8px", textAlign: "right", fontSize: 12, fontWeight: 700, color: "#c9a84c" }}>${(p.precio || p.price || 0).toLocaleString()}</td>
                      <td style={{ padding: "4px 8px", textAlign: "center" }}>
                        <span className={"badge " + (sinStock ? "br" : "bg")} style={{ fontSize: 9 }}>{disp}u</span>
                      </td>
                      <td style={{ padding: "4px 4px", textAlign: "right" }}>
                        {!sinStock && (
                          <button onClick={e => { e.stopPropagation(); accion(); }}
                            style={{ background: soloTransito ? "#7d3c98" : "#2d7a4f", color: "white", border: "none", borderRadius: 5, padding: "4px 8px", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
                            {soloTransito ? "+Pre" : "+"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div style={{ background: "#faf8f4", border: "1px solid #ddd9d0", borderRadius: 8, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid #ddd9d0", fontSize: 10, color: "#666666", fontWeight: 700, letterSpacing: ".1em", background: preventa ? "#2471a320" : "#f0ece4" }}>
            {preventa ? "PREVENTA" : "COMPROBANTE EN CURSO"} ({cart.length} items)
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
            {cart.length === 0
              ? <div style={{ textAlign: "center", color: "#8A8D91", fontSize: 12, marginTop: 40 }}>Agrega productos desde la lista</div>
              : cart.map(i => (
                <div key={i.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#ffffff", borderRadius: 6, padding: "8px 10px", marginBottom: 6, border: "1px solid #e8e4dc" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{i.nombre || i.name}</div>
                    <div style={{ fontSize: 10, color: "#888888" }}>{i.marca || i.brand}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button onClick={() => setCart(prev => prev.map(x => x.id === i.id && x.qty > 1 ? { ...x, qty: x.qty - 1 } : x))} style={{ width: 22, height: 22, borderRadius: 4, border: "1px solid #e8e8e8", background: "white", cursor: "pointer" }}>-</button>
                    <span style={{ fontSize: 12, fontWeight: 600, minWidth: 20, textAlign: "center" }}>{i.qty}</span>
                    <button onClick={() => add(i)} style={{ width: 22, height: 22, borderRadius: 4, border: "1px solid #e8e8e8", background: "white", cursor: "pointer" }}>+</button>
                    <div style={{ minWidth: 70, textAlign: "right", fontSize: 12, fontWeight: 600 }}>${((i.precio || i.price) * i.qty).toLocaleString()}</div>
                    <div onClick={() => remove(i.id)} style={{ cursor: "pointer", color: "#cccccc", fontSize: 18 }}>x</div>
                  </div>
                </div>
              ))
            }
          </div>
          <div style={{ padding: "10px 14px", borderTop: "1px solid #ddd9d0", background: "#f0ece4" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 11, color: "#666666", fontWeight: 600 }}>SUBTOTAL</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: "#111111" }}>${subtotalBase.toLocaleString()}</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, overflow: "hidden" }}>
          <div style={{ background: "#faf8f4", border: "1px solid #ddd9d0", borderRadius: 8, padding: "10px 12px", overflowY: "auto", flex: 1 }}>
            {preventa ? (
              <div className="fg"><input className="inp" placeholder="Nombre cliente (preventa)" value={nombrePreventa} onChange={e => setNombrePreventa(e.target.value)} style={{ fontSize: 11, padding: "8px 10px" }} /></div>
            ) : (
              <div>
                <div style={{ position: "relative", marginBottom: 6 }}>
                  <input className="inp" placeholder="DNI del cliente" value={dniInput} onChange={e => buscarClientePorDni(e.target.value)} style={{ fontSize: 11, padding: "8px 10px" }} />
                </div>
                {clienteSeleccionado && clienteSeleccionado.id && (
                  <div style={{ background: "#2d7a4f12", border: "1px solid #2d7a4f33", borderRadius: 6, padding: "6px 10px", marginBottom: 6, fontSize: 10 }}>
                    <div style={{ fontWeight: 600, color: "#2d7a4f" }}>{clienteSeleccionado.nombre}</div>
                    <div style={{ color: "#666666" }}>{clienteSeleccionado.puntos || 0} pts</div>
                  </div>
                )}
                {showNuevoCliente && !clienteSeleccionado && (
                  <div style={{ background: "#2471a312", border: "1px solid #2471a333", borderRadius: 6, padding: 8, marginBottom: 6 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#2471a3", marginBottom: 6 }}>Cliente nuevo</div>
                    <input className="inp" placeholder="Nombre" value={nuevoClienteDni.nombre} onChange={e => setNuevoClienteDni(p => ({ ...p, nombre: e.target.value }))} style={{ marginBottom: 4, fontSize: 11, padding: "6px 10px" }} />
                    <input className="inp" placeholder="Telefono" value={nuevoClienteDni.telefono} onChange={e => setNuevoClienteDni(p => ({ ...p, telefono: e.target.value }))} style={{ marginBottom: 4, fontSize: 11, padding: "6px 10px" }} />
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn btn-p btn-sm" style={{ flex: 1, fontSize: 9 }} onClick={crearClienteRapido}>Guardar</button>
                      <button className="btn btn-g btn-sm" style={{ flex: 1, fontSize: 9 }} onClick={() => { setShowNuevoCliente(false); setClienteSeleccionado({ id: null, nombre: "Consumidor Final", puntos: 0 }); }}>CF</button>
                    </div>
                  </div>
                )}
                {!clienteSeleccionado && !showNuevoCliente && (
                  <button className="btn btn-g btn-sm" style={{ width: "100%", marginBottom: 6, fontSize: 10 }} onClick={() => setClienteSeleccionado({ id: null, nombre: "Consumidor Final", puntos: 0 })}>Consumidor Final</button>
                )}
                <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                  <input className="inp" placeholder="Cupon" value={cupon} onChange={e => setCupon(e.target.value)} style={{ flex: 1, fontSize: 11, padding: "6px 10px" }} />
                  <button className="btn btn-g btn-sm" style={{ fontSize: 9 }} onClick={aplicarCupon}>OK</button>
                </div>
                {cuponAplicado && <div style={{ fontSize: 9, color: "#2d7a4f", marginBottom: 4 }}>Descuento aplicado</div>}
                <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                  <input className="inp" type="number" placeholder="Desc. manual" value={descuentoManual} onChange={e => setDescuentoManual(e.target.value)} style={{ flex: 1, fontSize: 11, padding: "6px 10px" }} />
                  <select className="sel" style={{ width: 50, padding: "6px 4px", fontSize: 10 }} value={tipoDescuento} onChange={e => setTipoDescuento(e.target.value)}>
                    <option value="$">$</option>
                    <option value="%">%</option>
                  </select>
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
              {["A", "B", "Remito"].map(t => (
                <button key={t} onClick={() => setTipoFac(t)} className="btn btn-sm"
                  style={{ flex: 1, fontSize: 9, padding: "5px 4px", background: tipoFac === t ? "#c9a84c15" : "transparent", border: "1px solid " + (tipoFac === t ? "#c9a84c" : "#e8e8e8"), color: tipoFac === t ? "#c9a84c" : "#65676B" }}>
                  {t === "Remito" ? "Rem" : "Fac " + t}
                </button>
              ))}
            </div>
            <button className="btn btn-sm" style={{ width: "100%", marginBottom: 6, background: "transparent", border: "1px solid #c9a84c44", color: "#c9a84c", fontSize: 9 }} onClick={() => { setShowEmitirGC(true); setGcEmitidaOk(null); setErrorEmitirGC(""); }}>Emitir Gift Card</button>
            {!giftCardAplicada ? (
              <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                <input className="inp" placeholder="GIFT-XXXX" value={codigoGC} onChange={e => setCodigoGC(e.target.value)} onKeyDown={e => e.key === "Enter" && buscarGiftCard()} style={{ flex: 1, textTransform: "uppercase", fontSize: 11, padding: "6px 10px" }} />
                <button className="btn btn-sm" style={{ fontSize: 9 }} onClick={buscarGiftCard} disabled={buscandoGC}>GC</button>
              </div>
            ) : (
              <div style={{ background: "#2d7a4f12", border: "1px solid #2d7a4f44", borderRadius: 6, padding: "6px 8px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#2d7a4f", fontFamily: "monospace" }}>{giftCardAplicada.codigo}</div>
                  <div style={{ fontSize: 9, color: "#65676B" }}>${parseFloat(giftCardAplicada.saldo).toLocaleString("es-AR")}</div>
                </div>
                <span onClick={quitarGiftCard} style={{ cursor: "pointer", color: "#c0392b", fontSize: 10 }}>X</span>
              </div>
            )}
            {errorGC && <div style={{ fontSize: 9, color: "#c0392b", marginBottom: 6 }}>{errorGC}</div>}
            {giftCardAplicada && (
              <div style={{ fontSize: 10, marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#65676B" }}>Gift card</span>
                <span style={{ fontWeight: 700, color: "#2d7a4f" }}>-${montoAplicadoGC.toLocaleString("es-AR")}</span>
              </div>
            )}
            {restaPagar > 0 && (
            <select className="sel" style={{ marginBottom: 6, fontSize: 11, padding: "8px 10px" }} value={medioPagoSel?.id || ""} onChange={e => {
              const m = mediosPago.find(x => x.id === parseInt(e.target.value));
              setMedioPagoSel(m || null);
            }}>
              <option value="">{giftCardAplicada ? "Pago diferencia..." : "Medio de pago..."}</option>
              {mediosPago.map(m => (
                <option key={m.id} value={m.id}>{m.nombre}</option>
              ))}
            </select>
            )}
          </div>
          <div style={{ background: "#f0ece4", border: "1px solid #ddd9d0", borderRadius: 8, padding: "10px 12px" }}>
            {descuento > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, fontSize: 10, color: "#2d7a4f" }}>
                <span>Descuento</span><span>-${descuento.toLocaleString()}</span>
              </div>
            )}
            {intereses > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, fontSize: 10, color: "#c0392b" }}>
                <span>Intereses</span><span>+${intereses.toLocaleString()}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: "#65676B", fontWeight: 600 }}>{restaPagar > 0 && giftCardAplicada ? "FALTA PAGAR" : "TOTAL"}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#111111" }}>${(restaPagar > 0 ? restaPagar : total).toLocaleString()}</div>
            </div>
            <button className="btn btn-p" style={{ width: "100%", padding: 11, fontSize: 12, opacity: loading ? 0.7 : 1 }} onClick={emitirFactura} disabled={loading}>
              {loading ? "Procesando..." : preventa ? "Registrar Preventa" : "Factura " + tipoFac}
            </button>
          </div>
        </div>
      </div>

      {showEmitirGC && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="card" style={{ width: 380, background: "#ffffff" }}>
            {!gcEmitidaOk ? (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>🎁 Emitir Gift Card</div>
                {errorEmitirGC && <div style={{ background: "#c0392b12", border: "1px solid #c0392b", borderRadius: 6, padding: "8px 12px", marginBottom: 10, fontSize: 11, color: "#c0392b" }}>{errorEmitirGC}</div>}
                <div className="fg"><div className="fl">Monto ($)</div><input className="inp" type="number" placeholder="10000" value={nuevaGC.monto} onChange={e => setNuevaGC(p => ({ ...p, monto: e.target.value }))} /></div>
                <div className="fg"><div className="fl">Nombre de quien la recibe</div><input className="inp" placeholder="Ej: Maria Lopez" value={nuevaGC.beneficiario_nombre} onChange={e => setNuevaGC(p => ({ ...p, beneficiario_nombre: e.target.value }))} /></div>
                <div className="fg"><div className="fl">Telefono (opcional)</div><input className="inp" placeholder="Ej: 2964123456" value={nuevaGC.beneficiario_telefono} onChange={e => setNuevaGC(p => ({ ...p, beneficiario_telefono: e.target.value }))} /></div>
                <div style={{ fontSize: 10, color: "#65676B", marginBottom: 14 }}>Se cobra el monto ahora como ingreso de caja. La gift card queda lista para usarse en cualquier venta futura.</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-g" style={{ flex: 1 }} onClick={() => setShowEmitirGC(false)}>Cancelar</button>
                  <button className="btn btn-p" style={{ flex: 1 }} onClick={emitirGiftCardPOS}>Emitir y cobrar</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: "#2d7a4f" }}>Gift Card emitida!</div>
                <div style={{ fontSize: 11, color: "#65676B", marginBottom: 14 }}>Entregale este codigo a {gcEmitidaOk.beneficiario_nombre}</div>
                <div style={{ background: "#2d7a4f12", border: "1px solid #2d7a4f44", borderRadius: 8, padding: 16, textAlign: "center", marginBottom: 14 }}>
                  <div style={{ fontFamily: "monospace", fontSize: 24, fontWeight: 700, color: "#2d7a4f" }}>{gcEmitidaOk.codigo}</div>
                  <div style={{ fontSize: 12, color: "#65676B", marginTop: 4 }}>Saldo: ${parseFloat(gcEmitidaOk.saldo).toLocaleString("es-AR")}</div>
                </div>
                <button className="btn btn-p" style={{ width: "100%" }} onClick={() => setShowEmitirGC(false)}>Cerrar</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Inventario({ localId, usuario }) {
  const [tab, setTab] = useState("stock");
  const [productos, setProductos] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [transito, setTransito] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ajustando, setAjustando] = useState(null);
  const [modoAjuste, setModoAjuste] = useState("exacto");
  const [valorAjuste, setValorAjuste] = useState("");
  const [motivoAjuste, setMotivoAjuste] = useState("");
  const [errorAjuste, setErrorAjuste] = useState("");
  const [showCalc, setShowCalc] = useState(false);
  const [calculadoras, setCalculadoras] = useState([]);
  const [calcSel, setCalcSel] = useState(null);
  const [calcValores, setCalcValores] = useState({});
  const [calcResultado, setCalcResultado] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [proveedores, setProveedores] = useState([]);
  const [nuevo, setNuevo] = useState({
    nombre: "", marca: "", codigo: "", categoria: "", precio: "", costo: "",
    stock: "", stock_minimo: "", proveedor_id: "", descripcion: ""
  });

  const categorias = ["Capilar", "Facial", "Maquillaje", "Accesorio", "Corporal", "Spa", "Perfume"];

  const cargar = async () => {
    setLoading(true);
    try {
      const [prodRes, provRes] = await Promise.all([
        API.get("/productos"),
        API.get("/proveedores")
      ]);
      const prods = prodRes.data || [];
      setProductos(prods);
      setAlertas(prods.filter(p => (p.stock || 0) <= (p.stock_minimo || 5)));
      setProveedores(provRes.data || []);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { cargar(); }, [localId]);

  const cargarTransito = async () => {
    try {
      const res = await API.get("/productos/stock/transito");
      setTransito(res.data || []);
    } catch (e) {}
  };

  const cargarCalculadoras = async () => {
    try {
      const res = await API.get("/calculadoras");
      setCalculadoras(res.data || []);
      if (res.data?.length > 0) setCalcSel(res.data[0]);
    } catch (e) {}
  };

  const abrirAjuste = (p) => {
    setAjustando(p);
    setModoAjuste("exacto");
    setValorAjuste(String(p.stock || 0));
    setMotivoAjuste("");
    setErrorAjuste("");
  };

  const confirmarAjuste = async () => {
    if (!motivoAjuste.trim()) return setErrorAjuste("El motivo es obligatorio");
    if (valorAjuste === "" || isNaN(parseInt(valorAjuste))) return setErrorAjuste("Ingresa un numero valido");
    try {
      const res = await API.put("/productos/" + ajustando.id + "/ajustar-stock", {
        modo: modoAjuste, valor: valorAjuste, motivo: motivoAjuste,
        usuario_id: usuario?.id || null, usuario_nombre: usuario?.nombre || null, local_id: localId || 1
      });
      setMensaje("Stock ajustado: " + res.data.stock_anterior + "u -> " + res.data.stock_nuevo + "u");
      setAjustando(null);
      cargar();
      setTimeout(() => setMensaje(""), 4000);
    } catch (e) { setErrorAjuste(e.response?.data?.error || "Error al ajustar el stock"); }
  };

  const guardarProducto = async () => {
    if (!nuevo.nombre || !nuevo.precio) return setMensaje("Completa al menos nombre y precio");
    try {
      await API.post("/productos", {
        nombre: nuevo.nombre,
        marca: nuevo.marca,
        codigo_barras: nuevo.codigo,
        categoria: nuevo.categoria,
        precio: parseFloat(nuevo.precio),
        costo: parseFloat(nuevo.costo) || 0,
        stock: parseInt(nuevo.stock) || 0,
        stock_minimo: parseInt(nuevo.stock_minimo) || 5,
        local_id: 1
      });
      setMensaje("Producto creado!");
      setNuevo({ nombre: "", marca: "", codigo: "", categoria: "", precio: "", costo: "", stock: "", stock_minimo: "", proveedor_id: "", descripcion: "" });
      setShowForm(false);
      cargar();
      setTimeout(() => setMensaje(""), 3000);
    } catch (e) { setMensaje("Error al crear producto: " + (e.response?.data?.error || e.message)); }
  };

  return (
    <div className="fade">
      <div className="ph">
        <div><div className="pt">Inventario</div><div className="ps">stock - punto de pedido - alertas</div></div>
        <button className="btn btn-p btn-sm" onClick={() => setShowForm(!showForm)}>+ Nuevo producto</button>
      </div>
      {mensaje && (
        <div style={{ background: mensaje.includes("Error") ? "#c0392b12" : "#2d7a4f12", border: "1px solid " + (mensaje.includes("Error") ? "#c0392b" : "#2d7a4f"), borderRadius: 6, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: mensaje.includes("Error") ? "#c0392b" : "#2d7a4f" }}>
          {mensaje}
        </div>
      )}
      {showForm && (
        <div className="card fade" style={{ marginBottom: 18 }}>
          <div className="ct">Nuevo producto</div>
          <div className="g2">
            <div>
              <div className="fg"><div className="fl">Nombre *</div><input className="inp" placeholder="Ej: Serum Vitamina C" value={nuevo.nombre} onChange={e => setNuevo(p => ({ ...p, nombre: e.target.value }))} /></div>
              <div className="fg"><div className="fl">Marca</div><input className="inp" placeholder="Ej: L'Oreal" value={nuevo.marca} onChange={e => setNuevo(p => ({ ...p, marca: e.target.value }))} /></div>
              <div className="fg"><div className="fl">Codigo</div><input className="inp" placeholder="Ej: SVC-001" value={nuevo.codigo} onChange={e => setNuevo(p => ({ ...p, codigo: e.target.value }))} /></div>
              <div className="fg"><div className="fl">Categoria</div>
                <select className="sel" value={nuevo.categoria} onChange={e => setNuevo(p => ({ ...p, categoria: e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="fg"><div className="fl">Proveedor</div>
                <select className="sel" value={nuevo.proveedor_id} onChange={e => setNuevo(p => ({ ...p, proveedor_id: e.target.value }))}>
                  <option value="">Sin proveedor</option>
                  {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
            </div>
            <div>
              <div className="fg">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div className="fl">Precio de venta ($) *</div>
                  <span onClick={() => { setShowCalc(true); setCalcValores({ costo: nuevo.costo || "" }); setCalcResultado(null); cargarCalculadoras(); }} style={{ fontSize: 10, color: "#c9a84c", cursor: "pointer", textDecoration: "underline" }}>🧮 Calcular precio</span>
                </div>
                <input className="inp" type="number" placeholder="2500" value={nuevo.precio} onChange={e => setNuevo(p => ({ ...p, precio: e.target.value }))} />
              </div>
              <div className="fg"><div className="fl">Costo ($)</div><input className="inp" type="number" placeholder="1200" value={nuevo.costo} onChange={e => setNuevo(p => ({ ...p, costo: e.target.value }))} />
                {nuevo.precio && nuevo.costo && (
                  <div style={{ fontSize: 10, color: "#2d7a4f", marginTop: 3 }}>
                    Margen: {Math.round(((parseFloat(nuevo.precio) - parseFloat(nuevo.costo)) / parseFloat(nuevo.precio)) * 100)}%
                  </div>
                )}
              </div>
              <div className="fg"><div className="fl">Stock inicial</div><input className="inp" type="number" placeholder="10" value={nuevo.stock} onChange={e => setNuevo(p => ({ ...p, stock: e.target.value }))} /></div>
              <div className="fg"><div className="fl">Stock minimo (alerta)</div><input className="inp" type="number" placeholder="5" value={nuevo.stock_minimo} onChange={e => setNuevo(p => ({ ...p, stock_minimo: e.target.value }))} /></div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button className="btn btn-p" style={{ flex: 1 }} onClick={guardarProducto}>Crear producto</button>
                <button className="btn btn-g" style={{ flex: 1 }} onClick={() => setShowForm(false)}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="tabs">
        {["stock", "transito", "alertas", "movimientos"].map(t => (
          <div key={t} className={"tab " + (tab === t ? "on" : "")} onClick={() => { setTab(t); if (t === "transito") cargarTransito(); }}>
            {t === "stock" ? "STOCK" : t === "transito" ? "EN TRANSITO" : t === "alertas" ? "ALERTAS" + (alertas.length > 0 ? " (" + alertas.length + ")" : "") : "MOVIMIENTOS"}
          </div>
        ))}
      </div>
      {tab === "stock" && (
        <div className="card fade">
          {loading ? (
            <div style={{ color: "#65676B", padding: 20 }}>Cargando inventario...</div>
          ) : (
          <table>
            <thead><tr><th>Producto</th><th>Marca</th><th>Categoria</th><th>Codigo</th><th>Precio</th><th>Costo</th><th>Stock</th><th>Reservado</th><th>Disponible</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {productos.map(p => {
                const reservado = p.reservado || 0;
                const disponible = p.disponible !== undefined ? p.disponible : Math.max((p.stock || 0) - reservado, 0);
                const bajo = disponible <= (p.stock_minimo || 5);
                const margen = p.price && p.cost ? Math.round(((p.price - p.cost) / p.price) * 100) : null;
                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 500 }}>{p.nombre || p.name}</td>
                    <td style={{ fontSize: 11, color: "#65676B" }}>{p.marca || p.brand || "-"}</td>
                    <td style={{ fontSize: 11, color: "#65676B" }}>{p.categoria || "-"}</td>
                    <td style={{ fontSize: 11, color: "#65676B" }}>{p.codigo_barras || p.codigo || "-"}</td>
                    <td style={{ color: "#c9a84c" }}>${parseFloat(p.price || p.precio || 0).toLocaleString()}</td>
                    <td style={{ fontSize: 11, color: "#65676B" }}>{p.cost || p.costo ? "$" + parseFloat(p.cost || p.costo).toLocaleString() : "-"}</td>
                    <td><span className="badge bx">{p.stock || 0}u</span></td>
                    <td style={{ fontSize: 11 }}>{reservado > 0 ? <span style={{ color: "#c9a84c", fontWeight: 600 }}>{reservado}u</span> : <span style={{ color: "#cccccc" }}>-</span>}</td>
                    <td><span className={"badge " + (bajo ? "br" : "bg")}>{disponible}u</span></td>
                    <td style={{ fontSize: 10, color: margen ? "#2d7a4f" : "#65676B" }}>{margen ? margen + "%" : "-"}</td>
                    <td><button className="btn btn-sm" style={{ fontSize: 10 }} onClick={() => abrirAjuste(p)}>Ajustar</button></td>
                  </tr>
                );
              })}
              {productos.length === 0 && <tr><td colSpan={11} style={{ color: "#65676B", textAlign: "center" }}>Sin productos</td></tr>}
            </tbody>
          </table>
          )}
        </div>
      )}
      {tab === "transito" && (
        <div className="card fade">
          {transito.length === 0 ? (
            <div style={{ fontSize: 12, color: "#65676B", textAlign: "center", padding: 30 }}>No hay stock en transito por el momento</div>
          ) : (
            <table>
              <thead><tr><th>Producto</th><th>Codigo</th><th>Transito RG</th><th>Reservado RG</th><th>Transito USH</th><th>Reservado USH</th></tr></thead>
              <tbody>
                {transito.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 500 }}>{p.nombre}{p.marca ? <span style={{ fontSize: 10, color: "#65676B", marginLeft: 6 }}>{p.marca}</span> : ""}</td>
                    <td style={{ fontSize: 11, color: "#65676B" }}>{p.codigo_barras || "-"}</td>
                    <td>{p.transito_rg > 0 ? <span className="badge bb">{p.transito_rg}u</span> : <span style={{ color: "#cccccc" }}>-</span>}</td>
                    <td>{p.reservado_rg > 0 ? <span style={{ color: "#c9a84c", fontWeight: 600, fontSize: 11 }}>{p.reservado_rg}u</span> : <span style={{ color: "#cccccc" }}>-</span>}</td>
                    <td>{p.transito_ush > 0 ? <span className="badge bb">{p.transito_ush}u</span> : <span style={{ color: "#cccccc" }}>-</span>}</td>
                    <td>{p.reservado_ush > 0 ? <span style={{ color: "#c9a84c", fontWeight: 600, fontSize: 11 }}>{p.reservado_ush}u</span> : <span style={{ color: "#cccccc" }}>-</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {tab === "alertas" && (
        <div className="fade">
          {alertas.length === 0 ? (
            <div style={{ textAlign: "center", color: "#2d7a4f", padding: 30, fontSize: 12 }}>No hay alertas de stock por ahora</div>
          ) : alertas.map(p => (
            <div key={p.id} style={{ background: "#c0392b12", border: "1px solid #d9707033", borderRadius: 6, padding: "12px 16px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, color: "#444444" }}>{p.nombre || p.name} - {p.marca || p.brand}</div>
                <div style={{ fontSize: 10, color: "#65676B", marginTop: 2 }}>Stock: {p.stock || 0}u | Minimo: {p.stock_minimo || 5}u</div>
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
      {showCalc && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="card" style={{ width: 420, background: "#ffffff" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>🧮 Calcular precio</div>
            <div style={{ fontSize: 11, color: "#65676B", marginBottom: 14 }}>El resultado se va a cargar automaticamente en el campo de precio.</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              {calculadoras.map(c => (
                <button key={c.id} onClick={() => { setCalcSel(c); setCalcValores({ costo: nuevo.costo || "" }); setCalcResultado(null); }}
                  style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid", borderColor: calcSel?.id === c.id ? "#c9a84c" : "#e8e8e8", background: calcSel?.id === c.id ? "#c9a84c12" : "transparent", color: calcSel?.id === c.id ? "#c9a84c" : "#666666", fontSize: 11, fontWeight: calcSel?.id === c.id ? 600 : 400, cursor: "pointer" }}>
                  {c.nombre}
                </button>
              ))}
            </div>
            {calcSel && (
              <div>
                <div style={{ fontSize: 10, color: "#65676B", fontFamily: "monospace", marginBottom: 12, background: "#f9f9f9", padding: "6px 10px", borderRadius: 6 }}>
                  {calcSel.tipo === "desde_costo"
                    ? `(costo × ${calcSel.margen}${parseFloat(calcSel.iva) > 0 ? " × " + (1 + parseFloat(calcSel.iva) / 100).toFixed(3) + " imp." : ""}) + extras`
                    : `(precio venta × ${calcSel.margen}) + extras`}
                </div>
                {calcSel.tipo === "desde_costo" ? (
                  <div className="fg"><div className="fl">Costo unitario ($)</div>
                    <input className="inp" type="number" placeholder="10000" value={calcValores.costo || ""} onChange={e => setCalcValores(v => ({ ...v, costo: e.target.value }))} />
                  </div>
                ) : (
                  <div className="fg"><div className="fl">Precio de venta del proveedor ($)</div>
                    <input className="inp" type="number" placeholder="15000" value={calcValores.precio_venta || ""} onChange={e => setCalcValores(v => ({ ...v, precio_venta: e.target.value }))} />
                  </div>
                )}
                {(calcSel.extras || []).map(e => (
                  <div key={e.key} className="fg"><div className="fl">{e.label} ($)</div>
                    <input className="inp" type="number" placeholder="0" value={calcValores[e.key] || ""} onChange={ev => setCalcValores(v => ({ ...v, [e.key]: ev.target.value }))} />
                  </div>
                ))}
                <button className="btn btn-p" style={{ width: "100%", marginTop: 4 }} onClick={() => {
                  const extras = (calcSel.extras || []).reduce((s, e) => s + (parseFloat(calcValores[e.key]) || 0), 0);
                  let precio = 0;
                  if (calcSel.tipo === "desde_costo") {
                    const costo = parseFloat(calcValores.costo) || 0;
                    precio = (costo * parseFloat(calcSel.margen) * (1 + parseFloat(calcSel.iva) / 100)) + extras;
                  } else {
                    precio = (parseFloat(calcValores.precio_venta) || 0) * parseFloat(calcSel.margen) + extras;
                  }
                  setCalcResultado(Math.round(precio));
                }}>Calcular</button>
                {calcResultado !== null && (
                  <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: 8, background: "#2d7a4f12", border: "1px solid #2d7a4f33", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 10, color: "#65676B" }}>Precio sugerido</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: "#2d7a4f" }}>${calcResultado.toLocaleString("es-AR")}</div>
                    </div>
                    <button className="btn btn-p" onClick={() => { setNuevo(p => ({ ...p, precio: String(calcResultado) })); setShowCalc(false); setCalcResultado(null); }}>
                      Usar este precio
                    </button>
                  </div>
                )}
              </div>
            )}
            <button className="btn btn-g" style={{ width: "100%", marginTop: 12 }} onClick={() => { setShowCalc(false); setCalcResultado(null); }}>Cerrar</button>
          </div>
        </div>
      )}
      {ajustando && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="card" style={{ width: 400, background: "#ffffff" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Ajustar stock</div>
            <div style={{ fontSize: 12, color: "#65676B", marginBottom: 14 }}>{ajustando.nombre} - stock actual: <b>{ajustando.stock || 0}u</b></div>
            {errorAjuste && (
              <div style={{ background: "#c0392b12", border: "1px solid #c0392b", borderRadius: 6, padding: "8px 12px", marginBottom: 10, fontSize: 11, color: "#c0392b" }}>{errorAjuste}</div>
            )}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button className="btn btn-sm" style={{ flex: 1, background: modoAjuste === "exacto" ? "#c9a84c15" : "transparent", border: "1px solid " + (modoAjuste === "exacto" ? "#c9a84c" : "#e8e8e8"), color: modoAjuste === "exacto" ? "#c9a84c" : "#65676B" }} onClick={() => { setModoAjuste("exacto"); setValorAjuste(String(ajustando.stock || 0)); }}>Poner cantidad exacta</button>
              <button className="btn btn-sm" style={{ flex: 1, background: modoAjuste === "diferencia" ? "#c9a84c15" : "transparent", border: "1px solid " + (modoAjuste === "diferencia" ? "#c9a84c" : "#e8e8e8"), color: modoAjuste === "diferencia" ? "#c9a84c" : "#65676B" }} onClick={() => { setModoAjuste("diferencia"); setValorAjuste(""); }}>Sumar / restar</button>
            </div>
            <div className="fg">
              <div className="fl">{modoAjuste === "exacto" ? "Stock real (numero final)" : "Diferencia (ej: 3 o -2)"}</div>
              <input className="inp" type="number" placeholder={modoAjuste === "exacto" ? "Ej: 8" : "Ej: -2"} value={valorAjuste} onChange={e => setValorAjuste(e.target.value)} />
              {modoAjuste === "diferencia" && valorAjuste !== "" && !isNaN(parseInt(valorAjuste)) && (
                <div style={{ fontSize: 11, color: "#65676B", marginTop: 4 }}>Nuevo stock: {(ajustando.stock || 0) + parseInt(valorAjuste)}u</div>
              )}
            </div>
            <div className="fg">
              <div className="fl">Motivo (obligatorio)</div>
              <input className="inp" placeholder="Ej: conteo fisico, producto roto, error de carga" value={motivoAjuste} onChange={e => setMotivoAjuste(e.target.value)} />
            </div>
            <div style={{ fontSize: 10, color: "#65676B", marginBottom: 12 }}>Este ajuste queda registrado con tu nombre y la fecha.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-g" style={{ flex: 1 }} onClick={() => setAjustando(null)}>Cancelar</button>
              <button className="btn btn-p" style={{ flex: 1 }} onClick={confirmarAjuste}>Confirmar ajuste</button>
            </div>
          </div>
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
          {loading ? <div style={{ textAlign: "center", color: "#65676B", padding: 20 }}>Cargando clientes...</div> : (
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
                    <td><div style={{ color: "#111111" }}>{c.nombre || c.name}</div><div style={{ fontSize: 9, color: "#65676B" }}>{c.email}</div></td>
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
          </table>
        )}
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
                <div style={{ fontSize: 10, color: "#65676B" }}>{n.min.toLocaleString()}{n.max ? " - " + n.max.toLocaleString() + " pts" : "+ pts"}</div>
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

function Finanzas({ localId }) {
  const [tab, setTab] = useState("flujo");
  const [tabLocal, setTabLocal] = useState("rg");
  const [flujo, setFlujo] = useState(null);
  const [flujoEst, setFlujoEst] = useState(null);
  const [equilibrio, setEquilibrio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nuevoEgreso, setNuevoEgreso] = useState({ concepto: "", importe: "", categoria_id: "", forma_pago: "", cuenta_pago_id: "", local_id: "" });
  const [categoriasCosto, setCategoriasCosto] = useState([]);
  const [cuentasPago, setCuentasPago] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [mesFiltro, setMesFiltro] = useState(new Date().getMonth() + 1);
  const [anioFiltro, setAnioFiltro] = useState(new Date().getFullYear());

  const cargarDatos = (local) => {
    setLoading(true);
    const localParam = local || tabLocal;
    const params = `mes=${mesFiltro}&anio=${anioFiltro}&local_id=${localParam}`;
    Promise.all([
      API.get(`/finanzas/flujo?${params}`),
      API.get(`/finanzas/flujo-estructurado?${params}`),
      getPuntoEquilibrio(),
      API.get("/categorias-costo"),
      API.get("/cuentas-pago?solo_pago=true")
    ]).then(([f, fe, e, cats, cuentas]) => {
      setFlujo(f.data);
      setFlujoEst(fe.data);
      setEquilibrio(e.data);
      setCategoriasCosto(cats.data);
      setCuentasPago(cuentas.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { cargarDatos(); }, [tabLocal, mesFiltro, anioFiltro]);

  const guardarEgreso = async () => {
    try {
      await agregarEgreso({ ...nuevoEgreso, referencia: "Manual" });
      setMensaje("Egreso registrado!");
      setNuevoEgreso({ concepto: "", importe: "", categoria_id: "", forma_pago: "", cuenta_pago_id: "", local_id: "" });
      cargarDatos();
      setTimeout(() => setMensaje(""), 3000);
    } catch (e) { setMensaje("Error al registrar egreso"); }
  };

  const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  const SeccionFlujo = ({ titulo, detalle, total, color }) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: color + "15", borderRadius: "6px 6px 0 0", borderLeft: "3px solid " + color }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: color, letterSpacing: ".1em" }}>{titulo}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: color }}>${parseFloat(total || 0).toLocaleString()}</span>
      </div>
      {Object.entries(detalle || {}).map(([k, v]) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 12px", borderBottom: "1px solid #f0f0f0", background: "#fafafa" }}>
          <span style={{ fontSize: 12, color: "#444444" }}>{k}</span>
          <span style={{ fontSize: 12, color: "#666666" }}>${parseFloat(v || 0).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="fade">
      <div className="ph">
        <div><div className="pt">Finanzas</div><div className="ps">flujo de efectivo - costos - equilibrio</div></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select className="sel" style={{ width: 120, padding: "6px 10px", fontSize: 12 }} value={mesFiltro} onChange={e => setMesFiltro(parseInt(e.target.value))}>
            {meses.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select className="sel" style={{ width: 80, padding: "6px 10px", fontSize: 12 }} value={anioFiltro} onChange={e => setAnioFiltro(parseInt(e.target.value))}>
            {[2024,2025,2026,2027].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>
      {mensaje && <div style={{ background: mensaje.includes("Error") ? "#c0392b12" : "#2d7a4f12", border: "1px solid " + (mensaje.includes("Error") ? "#c0392b" : "#2d7a4f"), borderRadius: 6, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: mensaje.includes("Error") ? "#c0392b" : "#2d7a4f" }}>{mensaje}</div>}
      
      <div className="tabs">
        {["flujo", "estructurado", "costos", "equilibrio"].map(t => (
          <div key={t} className={"tab " + (tab === t ? "on" : "")} onClick={() => setTab(t)}>
            {t === "flujo" ? "MOVIMIENTOS" : t === "estructurado" ? "FLUJO DE EFECTIVO" : t === "costos" ? "COSTOS" : "EQUILIBRIO"}
          </div>
        ))}
      </div>

      {(tab === "flujo" || tab === "estructurado") && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {["rg", "ush", "consolidado"].map(l => (
            <button key={l} onClick={() => setTabLocal(l)} className="btn btn-sm"
              style={{ background: tabLocal === l ? "#c9a84c15" : "transparent", border: "1px solid " + (tabLocal === l ? "#c9a84c" : "#e8e8e8"), color: tabLocal === l ? "#c9a84c" : "#65676B", fontWeight: tabLocal === l ? 600 : 400 }}>
              {l === "rg" ? "Rio Grande" : l === "ush" ? "Ushuaia" : "Consolidado"}
            </button>
          ))}
        </div>
      )}

      {tab === "flujo" && (
        <div className="fade">
          <div className="g3">
            <div className="card"><div className="ct">Ingresos del mes</div><div style={{ fontSize: 26, fontWeight: 700, color: "#2d7a4f" }}>${parseFloat(flujo?.resumen?.ingresos || 0).toLocaleString()}</div></div>
            <div className="card"><div className="ct">Egresos del mes</div><div style={{ fontSize: 26, fontWeight: 700, color: "#c0392b" }}>${parseFloat(flujo?.resumen?.egresos || 0).toLocaleString()}</div></div>
            <div className="card"><div className="ct">Resultado neto</div><div style={{ fontSize: 26, fontWeight: 700, color: "#c9a84c" }}>${parseFloat(flujo?.resumen?.neto || 0).toLocaleString()}</div></div>
          </div>
          <div className="g2">
            <div className="card">
              <div className="ct">Movimientos</div>
              {loading ? <div style={{ color: "#65676B" }}>Cargando...</div> : (
              <table>
                <thead><tr><th>Concepto</th><th>Categoria</th><th>Tipo</th><th>Cuenta</th><th>Importe</th></tr></thead>
                <tbody>
                  {(flujo?.movimientos || []).slice(0, 15).map((m, i) => (
                    <tr key={i}>
                      <td>{m.concepto}</td>
                      <td style={{ fontSize: 10, color: "#65676B" }}>{m.categoria_nombre || "-"}</td>
                      <td><span className={"badge " + (m.tipo === "I" ? "bg" : "br")}>{m.tipo === "I" ? "Ingreso" : "Egreso"}</span></td>
                      <td style={{ fontSize: 10, color: "#65676B" }}>{m.cuenta_nombre || m.forma_pago || "-"}</td>
                      <td style={{ color: m.tipo === "I" ? "#2d7a4f" : "#c0392b" }}>{m.tipo === "I" ? "+" : "-"}${parseFloat(m.importe).toLocaleString()}</td>
                    </tr>
                  ))}
                  {(flujo?.movimientos || []).length === 0 && (<tr><td colSpan={5} style={{ color: "#65676B", textAlign: "center" }}>Sin movimientos</td></tr>)}
                </tbody>
              </table>
              )}
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
              <div className="fg">
                <div className="fl">Forma de pago</div>
                <select className="sel" value={nuevoEgreso.forma_pago} onChange={e => setNuevoEgreso(p => ({ ...p, forma_pago: e.target.value, cuenta_pago_id: "" }))}>
                  <option value="">Seleccionar...</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="echeck">eCheck</option>
                  <option value="efectivo">Efectivo</option>
                </select>
              </div>
              {nuevoEgreso.forma_pago && (
                <div className="fg">
                  <div className="fl">Cuenta / Caja</div>
                  <select className="sel" value={nuevoEgreso.cuenta_pago_id} onChange={e => setNuevoEgreso(p => ({ ...p, cuenta_pago_id: e.target.value }))}>
                    <option value="">Seleccionar cuenta...</option>
                    {cuentasPago.filter(c => {
                      if (nuevoEgreso.forma_pago === "efectivo") return c.tipo === "efectivo";
                      if (nuevoEgreso.forma_pago === "echeck") return c.tipo === "echeck";
                      return c.tipo === "transferencia";
                    }).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
              )}
              <div className="fg">
                <div className="fl">Local</div>
                <select className="sel" value={nuevoEgreso.local_id} onChange={e => setNuevoEgreso(p => ({ ...p, local_id: e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  <option value="1">Rio Grande</option>
                  <option value="2">Ushuaia</option>
                  <option value="compartido">Compartido (50/50)</option>
                </select>
              </div>
              <button className="btn btn-p" style={{ width: "100%" }} onClick={guardarEgreso}>Registrar egreso</button>
            </div>
          </div>
        </div>
      )}

      {tab === "estructurado" && (
        <div className="fade">
          {loading ? <div style={{ color: "#65676B", padding: 20 }}>Cargando...</div> : flujoEst && (
            <div className="g2">
              <div>
                <SeccionFlujo titulo="INGRESOS" detalle={flujoEst.ingresos?.detalle} total={flujoEst.ingresos?.total} color="#2d7a4f" />
                <SeccionFlujo titulo="COSTOS VARIABLES" detalle={flujoEst.variables?.detalle} total={flujoEst.variables?.total} color="#e67e22" />
                <SeccionFlujo titulo="COSTOS FIJOS" detalle={flujoEst.fijos?.detalle} total={flujoEst.fijos?.total} color="#2471a3" />
                <SeccionFlujo titulo="GASTOS ADMINISTRATIVOS" detalle={flujoEst.admin?.detalle} total={flujoEst.admin?.total} color="#7d3c98" />
                <SeccionFlujo titulo="SUELDOS" detalle={flujoEst.sueldos?.detalle} total={flujoEst.sueldos?.total} color="#c0392b" />
                <SeccionFlujo titulo="IMPUESTOS" detalle={flujoEst.impuestos?.detalle} total={flujoEst.impuestos?.total} color="#c9a84c" />
                <div style={{ background: (flujoEst.resultado_neto >= 0 ? "#2d7a4f" : "#c0392b"), borderRadius: 8, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "white", letterSpacing: ".1em" }}>RESULTADO NETO</span>
                  <span style={{ fontSize: 24, fontWeight: 700, color: "white" }}>${parseFloat(flujoEst.resultado_neto || 0).toLocaleString()}</span>
                </div>
              </div>
              <div className="card">
                <div className="ct">Resumen del mes</div>
                {[
                  { l: "Total ingresos", v: flujoEst.ingresos?.total, c: "#2d7a4f" },
                  { l: "Costos variables", v: flujoEst.variables?.total, c: "#e67e22" },
                  { l: "Costos fijos", v: flujoEst.fijos?.total, c: "#2471a3" },
                  { l: "Gastos admin", v: flujoEst.admin?.total, c: "#7d3c98" },
                  { l: "Sueldos", v: flujoEst.sueldos?.total, c: "#c0392b" },
                  { l: "Impuestos", v: flujoEst.impuestos?.total, c: "#c9a84c" },
                  { l: "Total egresos", v: flujoEst.total_egresos, c: "#c0392b" },
                ].map(r => (
                  <div key={r.l} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f0f0f0" }}>
                    <span style={{ fontSize: 12, color: "#444444" }}>{r.l}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: r.c }}>${parseFloat(r.v || 0).toLocaleString()}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", marginTop: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>RESULTADO NETO</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: flujoEst.resultado_neto >= 0 ? "#2d7a4f" : "#c0392b" }}>${parseFloat(flujoEst.resultado_neto || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "costos" && (
        <div className="g2 fade">
          <div className="card">
            <div className="ct">Costos fijos mensuales</div>
            {[{ l: "Alquiler", v: 35000 }, { l: "Personal", v: 28000 }, { l: "Servicios", v: 4200 }, { l: "Plataformas", v: 3800 }].map(c => (
              <div key={c.l} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid #f0f0f0" }}>
                <span style={{ fontSize: 12, color: "#444444" }}>{c.l}</span>
                <span style={{ color: "#c9a84c" }}>${c.v.toLocaleString()}</span>
              </div>
            ))}
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
            {loading ? <div style={{ color: "#65676B" }}>Calculando...</div> : <div>
              <div style={{ fontSize: 48, fontWeight: 700, color: "#c9a84c" }}>${parseFloat(equilibrio?.punto_equilibrio || 0).toLocaleString()}</div>
              <div style={{ fontSize: 11, color: "#65676B", marginTop: 4 }}>ventas minimas para cubrir costos</div>
              <div className="divider" />
              {[
                { l: "Costos fijos", v: "$" + parseFloat(equilibrio?.costos_fijos || 0).toLocaleString() },
                { l: "Margen promedio", v: (equilibrio?.margen_promedio || 0) + "%" },
                { l: "Margen seguridad", v: equilibrio?.margen_seguridad || "0%" },
              ].map(r => (
                <div key={r.l} style={{ display: "flex", justifyContent: "space-between", marginBottom: 9 }}>
                  <span style={{ fontSize: 11, color: "#65676B" }}>{r.l}</span>
                  <span style={{ fontSize: 11, color: "#444444" }}>{r.v}</span>
                </div>
              ))}
            </div>}
          </div>
          <div className="card">
            <div className="ct">Situacion actual</div>
            {[
              { l: "Ventas actuales", v: "$" + parseFloat(equilibrio?.ventas_actuales || 0).toLocaleString(), c: "#2d7a4f" },
              { l: "Punto equilibrio", v: "$" + parseFloat(equilibrio?.punto_equilibrio || 0).toLocaleString(), c: "#c9a84c" },
              { l: "Superado", v: equilibrio?.superado ? "SI" : "NO", c: equilibrio?.superado ? "#2d7a4f" : "#c0392b" },
            ].map(r => (
              <div key={r.l} style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: "#65676B" }}>{r.l}</span>
                <span style={{ color: r.c }}>{r.v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Informes({ localId }) {
  const [tab, setTab] = useState("ventas");
  const [tabLocal, setTabLocal] = useState("rg");
  const [loading, setLoading] = useState(true);
  const [datos, setDatos] = useState(null);
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [anio, setAnio] = useState(new Date().getFullYear());

  const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  const cargar = async () => {
    setLoading(true);
    try {
      const local = tabLocal === "consolidado" ? "" : tabLocal === "rg" ? "1" : "2";
      const params = "mes=" + mes + "&anio=" + anio + (local ? "&local_id=" + local : "");
      const [ventasRes, invRes] = await Promise.all([
        API.get("/ventas?" + params),
        API.get("/productos")
      ]);
      const ventas = ventasRes.data || [];
      const productos = invRes.data || [];
      const totalVentas = ventas.reduce((s, v) => s + parseFloat(v.total || 0), 0);
      const cantVentas = ventas.length;
      const ticketProm = cantVentas > 0 ? totalVentas / cantVentas : 0;
      const ventasPorMedio = {};
      ventas.forEach(v => {
        const medio = v.medio_pago || "Efectivo";
        ventasPorMedio[medio] = (ventasPorMedio[medio] || 0) + parseFloat(v.total || 0);
      });
      const stockBajo = productos.filter(p => (p.stock || 0) <= (p.stock_minimo || p.min || 5));
      setDatos({ ventas, totalVentas, cantVentas, ticketProm, ventasPorMedio, stockBajo, productos });
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { cargar(); }, [tabLocal, mes, anio]);

  return (
    <div className="fade">
      <div className="ph">
        <div><div className="pt">Informes</div><div className="ps">ventas - stock - medios de pago</div></div>
        <div style={{ display: "flex", gap: 8 }}>
          <select className="sel" style={{ width: 120, padding: "6px 10px", fontSize: 12 }} value={mes} onChange={e => setMes(parseInt(e.target.value))}>
            {meses.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select className="sel" style={{ width: 80, padding: "6px 10px", fontSize: 12 }} value={anio} onChange={e => setAnio(parseInt(e.target.value))}>
            {[2024,2025,2026,2027].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["rg", "ush", "consolidado"].map(l => (
          <button key={l} onClick={() => setTabLocal(l)} className="btn btn-sm"
            style={{ background: tabLocal === l ? "#c9a84c15" : "transparent", border: "1px solid " + (tabLocal === l ? "#c9a84c" : "#e8e8e8"), color: tabLocal === l ? "#c9a84c" : "#65676B", fontWeight: tabLocal === l ? 600 : 400 }}>
            {l === "rg" ? "Rio Grande" : l === "ush" ? "Ushuaia" : "Consolidado"}
          </button>
        ))}
      </div>
      <div className="tabs">
        {["ventas", "stock", "medios"].map(t => (
          <div key={t} className={"tab " + (tab === t ? "on" : "")} onClick={() => setTab(t)}>
            {t === "ventas" ? "VENTAS" : t === "stock" ? "STOCK" : "MEDIOS DE PAGO"}
          </div>
        ))}
      </div>
      {loading ? (
        <div style={{ color: "#65676B", padding: 30, textAlign: "center" }}>Cargando...</div>
      ) : datos && (
        <div>
          {tab === "ventas" && (
            <div className="fade">
              <div className="g3" style={{ marginBottom: 18 }}>
                <div className="card"><div className="ct">Total ventas</div><div style={{ fontSize: 28, fontWeight: 700, color: "#2d7a4f" }}>${datos.totalVentas.toLocaleString()}</div></div>
                <div className="card"><div className="ct">Cantidad de ventas</div><div style={{ fontSize: 28, fontWeight: 700, color: "#c9a84c" }}>{datos.cantVentas}</div></div>
                <div className="card"><div className="ct">Ticket promedio</div><div style={{ fontSize: 28, fontWeight: 700, color: "#2471a3" }}>${Math.round(datos.ticketProm).toLocaleString()}</div></div>
              </div>
              <div className="card">
                <div className="ct">Ultimas ventas del mes</div>
                {datos.ventas.length === 0 ? (
                  <div style={{ color: "#65676B", textAlign: "center", padding: 20, fontSize: 12 }}>Sin ventas en este periodo</div>
                ) : (
                  <table>
                    <thead><tr><th>Fecha</th><th>Cliente</th><th>Medio</th><th>Items</th><th>Total</th></tr></thead>
                    <tbody>
                      {datos.ventas.slice(0, 20).map((v, i) => (
                        <tr key={i}>
                          <td style={{ fontSize: 11, color: "#65676B" }}>{new Date(v.creado_en || v.fecha).toLocaleDateString("es-AR")}</td>
                          <td style={{ fontSize: 12 }}>{v.cliente_nombre || "Consumidor final"}</td>
                          <td style={{ fontSize: 11 }}>{v.medio_pago || "-"}</td>
                          <td style={{ fontSize: 11, color: "#65676B" }}>{v.items_count || "-"}</td>
                          <td style={{ color: "#2d7a4f", fontWeight: 600 }}>${parseFloat(v.total || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
          {tab === "stock" && (
            <div className="fade">
              <div className="g2">
                <div className="card">
                  <div className="ct">Productos con stock bajo ({datos.stockBajo.length})</div>
                  {datos.stockBajo.length === 0 ? (
                    <div style={{ color: "#2d7a4f", textAlign: "center", padding: 20, fontSize: 12 }}>Todos los productos tienen stock suficiente</div>
                  ) : (
                    <table>
                      <thead><tr><th>Producto</th><th>Stock actual</th><th>Minimo</th></tr></thead>
                      <tbody>
                        {datos.stockBajo.map((p, i) => (
                          <tr key={i}>
                            <td>
                              <div style={{ fontSize: 12 }}>{p.nombre}</div>
                              <div style={{ fontSize: 10, color: "#65676B" }}>{p.marca}</div>
                            </td>
                            <td><span className="badge br">{p.stock || 0}u</span></td>
                            <td style={{ color: "#65676B", fontSize: 12 }}>{p.stock_minimo || p.min || 5}u</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <div className="card">
                  <div className="ct">Resumen de inventario</div>
                  {[
                    { l: "Total productos", v: datos.productos.length },
                    { l: "Con stock bajo", v: datos.stockBajo.length, c: datos.stockBajo.length > 0 ? "#c0392b" : "#2d7a4f" },
                    { l: "Sin stock", v: datos.productos.filter(p => !p.stock || p.stock === 0).length, c: "#c0392b" },
                  ].map(r => (
                    <div key={r.l} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f0f0f0" }}>
                      <span style={{ fontSize: 12, color: "#444444" }}>{r.l}</span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: r.c || "#111111" }}>{r.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {tab === "medios" && (
            <div className="fade">
              <div className="card">
                <div className="ct">Ventas por medio de pago</div>
                {Object.keys(datos.ventasPorMedio).length === 0 ? (
                  <div style={{ color: "#65676B", textAlign: "center", padding: 20, fontSize: 12 }}>Sin datos para este periodo</div>
                ) : (
                  <div>
                    {Object.entries(datos.ventasPorMedio).sort((a,b) => b[1]-a[1]).map(([medio, total]) => {
                      const pct = datos.totalVentas > 0 ? Math.round((total / datos.totalVentas) * 100) : 0;
                      return (
                        <div key={medio} style={{ marginBottom: 14 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 12, color: "#444444" }}>{medio}</span>
                            <span style={{ fontSize: 12, color: "#c9a84c", fontWeight: 600 }}>${total.toLocaleString()} ({pct}%)</span>
                          </div>
                          <div className="pb"><div className="pf" style={{ width: pct + "%" }} /></div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
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
                  <td style={{ fontSize: 10, color: "#65676B" }}>{c.fecha_vencimiento || c.expires || "Sin venc."}</td>
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
              <div style={{ fontSize: 13, color: "#65676B", marginTop: 6 }}>{nc.value ? (nc.type === "%" ? nc.value + "% de descuento" : "$" + parseInt(nc.value || "0").toLocaleString() + " de descuento") : "Descuento"}</div>
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
  const [premios, setPremios] = useState([]);
  const [canjes, setCanjes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [nuevoPremio, setNuevoPremio] = useState({ nombre: "", descripcion: "", puntos_requeridos: "", imagen_url: "", stock_total: "", solo_mes_cumpleanos: false });
  const [codigoValidar, setCodigoValidar] = useState("");
  const [resultadoValidacion, setResultadoValidacion] = useState(null);
  const tierNext = { Bronze: 500, Silver: 1000, Gold: 2000, Platinum: 99999 };

  useEffect(() => {
    getRanking().then(res => { setClientes(res.data); setLoading(false); }).catch(() => { setClientes(CLIENTS.map(c => ({ ...c, nombre: c.name, puntos: c.points, nivel: c.tier }))); setLoading(false); });
    cargarPremios();
  }, []);

  const cargarPremios = () => {
    API.get("/fidelizacion/premios?todos=true").then(res => setPremios(res.data || [])).catch(() => {});
  };

  const cargarCanjes = () => {
    API.get("/fidelizacion/canjes").then(res => setCanjes(res.data || [])).catch(() => {});
  };

  const clientesAMostrar = clientes.length > 0 ? clientes : CLIENTS.map(c => ({ ...c, nombre: c.name, puntos: c.points, nivel: c.tier }));
  const totalPuntos = clientesAMostrar.reduce((s, c) => s + (c.puntos || 0), 0);

  const guardarPremio = async () => {
    if (!nuevoPremio.nombre || !nuevoPremio.puntos_requeridos) return setMensaje("Completa nombre y puntos requeridos");
    try {
      await API.post("/fidelizacion/premios", {
        ...nuevoPremio,
        puntos_requeridos: parseInt(nuevoPremio.puntos_requeridos),
        stock_total: nuevoPremio.stock_total ? parseInt(nuevoPremio.stock_total) : null
      });
      setMensaje("Premio creado!");
      setShowForm(false);
      setNuevoPremio({ nombre: "", descripcion: "", puntos_requeridos: "", imagen_url: "", stock_total: "", solo_mes_cumpleanos: false });
      cargarPremios();
      setTimeout(() => setMensaje(""), 3000);
    } catch (e) { setMensaje("Error al crear el premio"); }
  };

  const desactivarPremio = async (p) => {
    try {
      await API.delete("/fidelizacion/premios/" + p.id);
      setMensaje("Premio desactivado");
      cargarPremios();
      setTimeout(() => setMensaje(""), 3000);
    } catch (e) { setMensaje("Error al desactivar"); }
  };

  const validarCodigo = async () => {
    if (!codigoValidar.trim()) return;
    setResultadoValidacion(null);
    try {
      const res = await API.post("/fidelizacion/validar-canje", { codigo: codigoValidar.trim().toUpperCase() });
      setResultadoValidacion({ ok: true, mensaje: res.data.mensaje, canje: res.data.canje });
      setCodigoValidar("");
      cargarCanjes();
    } catch (e) {
      setResultadoValidacion({ ok: false, mensaje: e.response?.data?.error || "Error al validar" });
    }
  };

  return (
    <div className="fade">
      <div className="ph"><div><div className="pt">Fidelizacion</div><div className="ps">puntos - niveles - canjes</div></div></div>
      <div className="g4" style={{ marginBottom: 16 }}>
        <MCard label="Puntos emitidos" value={totalPuntos.toLocaleString()} color="#c9a84c" />
        <MCard label="Clientes con puntos" value={String(clientesAMostrar.filter(c => (c.puntos || 0) > 0).length)} color="#2d7a4f" />
        <MCard label="Premios activos" value={String(premios.filter(p => p.activo).length)} color="#2471a3" />
        <MCard label="Nivel Platinum" value={String(clientesAMostrar.filter(c => (c.nivel || c.tier) === "Platinum").length)} color="#7d3c98" />
      </div>
      {mensaje && <div style={{ background: mensaje.includes("Error") ? "#c0392b12" : "#2d7a4f12", border: "1px solid " + (mensaje.includes("Error") ? "#c0392b" : "#2d7a4f"), borderRadius: 6, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: mensaje.includes("Error") ? "#c0392b" : "#2d7a4f" }}>{mensaje}</div>}
      <div className="tabs">
        {["clientes", "premios", "validar"].map(t => <div key={t} className={"tab " + (tab === t ? "on" : "")} onClick={() => { setTab(t); if (t === "validar") cargarCanjes(); }}>{t === "clientes" ? "CLIENTES" : t === "premios" ? "PREMIOS" : "VALIDAR CANJE"}</div>)}
      </div>
      {tab === "clientes" && (
        <div className="card fade">
          {loading ? <div style={{ textAlign: "center", color: "#65676B", padding: 20 }}>Cargando...</div> : (
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
                    <td><div style={{ color: "#111111" }}>{c.nombre || c.name}</div><div style={{ fontSize: 9, color: "#65676B" }}>{c.email}</div></td>
                    <td><TierBadge tier={nivel} /></td>
                    <td style={{ fontFamily: "'Inter',sans-serif", fontSize: 18, fontWeight: 700, color: "#c9a84c" }}>{puntos.toLocaleString()}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1 }}><div className="pb"><div className="pf" style={{ width: pct + "%", background: "#c9a84c" }} /></div></div>
                        <span style={{ fontSize: 9, color: "#65676B", width: 50 }}>{nivel === "Platinum" ? "MAX" : (next - puntos).toLocaleString() + "p"}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        </div>
      )}
      {tab === "premios" && (
        <div className="fade">
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button className="btn btn-p btn-sm" onClick={() => setShowForm(!showForm)}>+ Nuevo premio</button>
          </div>
          {showForm && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "#65676B", letterSpacing: ".1em", marginBottom: 14 }}>NUEVO PREMIO</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="fg"><div className="fl">Nombre del premio</div><input className="inp" placeholder="Ej: Envio gratis" value={nuevoPremio.nombre} onChange={e => setNuevoPremio(p => ({ ...p, nombre: e.target.value }))} /></div>
                <div className="fg"><div className="fl">Puntos requeridos</div><input className="inp" type="number" placeholder="500" value={nuevoPremio.puntos_requeridos} onChange={e => setNuevoPremio(p => ({ ...p, puntos_requeridos: e.target.value }))} /></div>
              </div>
              <div className="fg"><div className="fl">Descripcion</div><input className="inp" placeholder="Breve descripcion del premio" value={nuevoPremio.descripcion} onChange={e => setNuevoPremio(p => ({ ...p, descripcion: e.target.value }))} /></div>
              <div className="fg"><div className="fl">URL de imagen (opcional)</div><input className="inp" placeholder="https://..." value={nuevoPremio.imagen_url} onChange={e => setNuevoPremio(p => ({ ...p, imagen_url: e.target.value }))} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="fg"><div className="fl">Stock disponible (vacio = ilimitado)</div><input className="inp" type="number" placeholder="Ej: 10" value={nuevoPremio.stock_total} onChange={e => setNuevoPremio(p => ({ ...p, stock_total: e.target.value }))} /></div>
                <div className="fg" style={{ display: "flex", alignItems: "center", paddingTop: 18 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer" }}>
                    <input type="checkbox" checked={nuevoPremio.solo_mes_cumpleanos} onChange={e => setNuevoPremio(p => ({ ...p, solo_mes_cumpleanos: e.target.checked }))} />
                    Solo disponible en el mes de cumpleanos de la clienta
                  </label>
                </div>
              </div>
              <button className="btn btn-p" style={{ width: "100%", marginTop: 8 }} onClick={guardarPremio}>Crear premio</button>
            </div>
          )}
          {premios.length === 0 ? (
            <div className="card"><div style={{ textAlign: "center", color: "#65676B", padding: 30, fontSize: 12 }}>No hay premios creados todavia</div></div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
              {premios.map(p => {
                const disp = p.stock_total === null ? null : Math.max(p.stock_total - (p.stock_usado || 0), 0);
                return (
                  <div key={p.id} className="card" style={{ opacity: p.activo ? 1 : 0.5 }}>
                    {p.imagen_url && <img src={p.imagen_url} alt={p.nombre} style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 8, marginBottom: 10 }} />}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{p.nombre}</div>
                      {p.solo_mes_cumpleanos && <span className="badge" style={{ background: "#7d3c9815", color: "#7d3c98", fontSize: 8 }}>cumple</span>}
                    </div>
                    {p.descripcion && <div style={{ fontSize: 10, color: "#65676B", marginTop: 3 }}>{p.descripcion}</div>}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: "#c9a84c" }}>{p.puntos_requeridos} pts</span>
                      <span className={"badge " + (disp !== null && disp < 5 ? "br" : "bg")}>{disp === null ? "ilimitado" : disp + "u"}</span>
                    </div>
                    {p.activo && <button className="btn btn-sm" style={{ width: "100%", marginTop: 10 }} onClick={() => desactivarPremio(p)}>Desactivar</button>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {tab === "validar" && (
        <div className="fade">
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "#65676B", letterSpacing: ".1em", marginBottom: 10 }}>VALIDAR CODIGO DE CANJE</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="inp" placeholder="PREMIO-XXXX" value={codigoValidar} onChange={e => setCodigoValidar(e.target.value)} onKeyDown={e => e.key === "Enter" && validarCodigo()} style={{ textTransform: "uppercase" }} />
              <button className="btn btn-p" onClick={validarCodigo}>Validar</button>
            </div>
            {resultadoValidacion && (
              <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 6, background: resultadoValidacion.ok ? "#2d7a4f12" : "#c0392b12", border: "1px solid " + (resultadoValidacion.ok ? "#2d7a4f" : "#c0392b"), fontSize: 12, color: resultadoValidacion.ok ? "#2d7a4f" : "#c0392b" }}>
                {resultadoValidacion.mensaje}
              </div>
            )}
          </div>
          <div className="card">
            <div style={{ fontSize: 11, color: "#65676B", letterSpacing: ".1em", marginBottom: 10 }}>HISTORIAL DE CANJES</div>
            {canjes.length === 0 ? (
              <div style={{ fontSize: 12, color: "#65676B", textAlign: "center", padding: 20 }}>Todavia no hay canjes registrados</div>
            ) : (
              <table>
                <thead><tr><th>Codigo</th><th>Premio</th><th>Clienta</th><th>Puntos</th><th>Estado</th><th>Fecha</th></tr></thead>
                <tbody>
                  {canjes.map((c, i) => (
                    <tr key={i}>
                      <td style={{ fontFamily: "monospace", fontWeight: 600 }}>{c.codigo}</td>
                      <td style={{ fontSize: 12 }}>{c.premio_nombre}</td>
                      <td style={{ fontSize: 12 }}>{c.cliente_nombre}</td>
                      <td style={{ fontSize: 12 }}>{c.puntos_usados}</td>
                      <td><span className={"badge " + (c.estado === "usado" ? "bg" : "ba")}>{c.estado}</span></td>
                      <td style={{ fontSize: 10, color: "#65676B" }}>{new Date(c.creado_en).toLocaleDateString("es-AR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
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
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 10, color: "#65676B", marginBottom: 10 }}>
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

function Calculadoras({ usuario }) {
  const [calculadoras, setCalculadoras] = useState([]);
  const [seleccionada, setSeleccionada] = useState(null);
  const [valores, setValores] = useState({});
  const [resultado, setResultado] = useState(null);
  const [tab, setTab] = useState("usar");
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ nombre: "", descripcion: "", tipo: "desde_costo", margen: "2", iva: "17.5", extras: [] });
  const [extraTemp, setExtraTemp] = useState("");
  const [mensaje, setMensaje] = useState("");
  const esJefe = usuario?.rol === "jefe" || usuario?.rol === "administrativo";

  const cargar = () => {
    API.get("/calculadoras").then(res => {
      setCalculadoras(res.data || []);
      if (res.data?.length > 0 && !seleccionada) setSeleccionada(res.data[0]);
    }).catch(() => {});
  };

  useEffect(() => { cargar(); }, []);

  useEffect(() => {
    if (seleccionada) { setValores({}); setResultado(null); }
  }, [seleccionada?.id]);

  const calcular = () => {
    if (!seleccionada) return;
    const extras = (seleccionada.extras || []).reduce((s, e) => s + (parseFloat(valores[e.key]) || 0), 0);
    let precio = 0;
    if (seleccionada.tipo === "desde_costo") {
      const costo = parseFloat(valores.costo) || 0;
      const margen = parseFloat(seleccionada.margen) || 1;
      const iva = parseFloat(seleccionada.iva) || 0;
      precio = (costo * margen * (1 + iva / 100)) + extras;
    } else {
      const precioVenta = parseFloat(valores.precio_venta) || 0;
      const margen = parseFloat(seleccionada.margen) || 1;
      precio = (precioVenta * margen) + extras;
    }
    setResultado(Math.round(precio));
  };

  const guardar = async () => {
    if (!form.nombre) return setMensaje("El nombre es obligatorio");
    try {
      if (editando) {
        await API.put("/calculadoras/" + editando.id, { ...form, margen: parseFloat(form.margen), iva: parseFloat(form.iva) });
        setMensaje("Calculadora actualizada");
      } else {
        await API.post("/calculadoras", { ...form, margen: parseFloat(form.margen), iva: parseFloat(form.iva) });
        setMensaje("Calculadora creada");
      }
      setShowForm(false); setEditando(null);
      setForm({ nombre: "", descripcion: "", tipo: "desde_costo", margen: "2", iva: "17.5", extras: [] });
      cargar();
      setTimeout(() => setMensaje(""), 3000);
    } catch (e) { setMensaje("Error al guardar"); }
  };

  const abrirEditar = (c) => {
    setEditando(c);
    setForm({ nombre: c.nombre, descripcion: c.descripcion || "", tipo: c.tipo, margen: String(c.margen), iva: String(c.iva), extras: c.extras || [] });
    setShowForm(true); setTab("admin");
  };

  const eliminar = async (c) => {
    try {
      await API.delete("/calculadoras/" + c.id);
      setMensaje("Calculadora eliminada");
      if (seleccionada?.id === c.id) setSeleccionada(null);
      cargar();
      setTimeout(() => setMensaje(""), 3000);
    } catch (e) { setMensaje("Error al eliminar"); }
  };

  const agregarExtra = () => {
    if (!extraTemp.trim()) return;
    const key = extraTemp.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    setForm(f => ({ ...f, extras: [...f.extras, { label: extraTemp.trim(), key }] }));
    setExtraTemp("");
  };

  const formulaTexto = (c) => {
    if (!c) return "";
    const extras = (c.extras || []).map(e => e.label).join(" + ");
    if (c.tipo === "desde_costo") {
      return `(costo × ${c.margen}${parseFloat(c.iva) > 0 ? " × " + (1 + parseFloat(c.iva) / 100).toFixed(3) + " (imp.)" : ""})${extras ? " + " + extras : ""}`;
    }
    return `(precio venta × ${c.margen})${extras ? " + " + extras : ""}`;
  };

  return (
    <div className="fade">
      <div className="ph">
        <div><div className="pt">Calculadoras de Precio</div><div className="ps">formulas configurables por tipo de producto</div></div>
        {esJefe && <button className="btn btn-p btn-sm" onClick={() => { setTab("admin"); setShowForm(true); setEditando(null); setForm({ nombre: "", descripcion: "", tipo: "desde_costo", margen: "2", iva: "17.5", extras: [] }); }}>+ Nueva calculadora</button>}
      </div>
      {mensaje && <div style={{ background: mensaje.includes("Error") ? "#c0392b12" : "#2d7a4f12", border: "1px solid " + (mensaje.includes("Error") ? "#c0392b" : "#2d7a4f"), borderRadius: 6, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: mensaje.includes("Error") ? "#c0392b" : "#2d7a4f" }}>{mensaje}</div>}
      <div className="tabs">
        <div className={"tab " + (tab === "usar" ? "on" : "")} onClick={() => setTab("usar")}>CALCULAR</div>
        {esJefe && <div className={"tab " + (tab === "admin" ? "on" : "")} onClick={() => setTab("admin")}>ADMINISTRAR</div>}
      </div>

      {tab === "usar" && (
        <div className="fade">
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {calculadoras.map(c => (
              <button key={c.id} onClick={() => setSeleccionada(c)}
                style={{ padding: "8px 16px", borderRadius: 7, border: "1px solid", borderColor: seleccionada?.id === c.id ? "#c9a84c55" : "#e8e8e8", background: seleccionada?.id === c.id ? "#c9a84c12" : "transparent", color: seleccionada?.id === c.id ? "#c9a84c" : "#666666", fontSize: 12, fontWeight: seleccionada?.id === c.id ? 600 : 400, cursor: "pointer" }}>
                {c.nombre}
              </button>
            ))}
          </div>
          {seleccionada && (
            <div className="g2">
              <div className="card">
                <div style={{ fontSize: 11, color: "#65676B", letterSpacing: ".1em", marginBottom: 4 }}>FORMULA</div>
                <div style={{ fontSize: 13, color: "#444444", marginBottom: 16, fontFamily: "monospace" }}>{formulaTexto(seleccionada)}</div>
                {seleccionada.tipo === "desde_costo" ? (
                  <div className="fg"><div className="fl">Costo unitario ($)</div>
                    <input className="inp" type="number" placeholder="10000" value={valores.costo || ""} onChange={e => setValores(v => ({ ...v, costo: e.target.value }))} />
                  </div>
                ) : (
                  <div className="fg"><div className="fl">Precio de venta del proveedor ($)</div>
                    <input className="inp" type="number" placeholder="15000" value={valores.precio_venta || ""} onChange={e => setValores(v => ({ ...v, precio_venta: e.target.value }))} />
                  </div>
                )}
                {(seleccionada.extras || []).map(e => (
                  <div key={e.key} className="fg"><div className="fl">{e.label} ($)</div>
                    <input className="inp" type="number" placeholder="0" value={valores[e.key] || ""} onChange={ev => setValores(v => ({ ...v, [e.key]: ev.target.value }))} />
                  </div>
                ))}
                <button className="btn btn-p" style={{ width: "100%", marginTop: 8 }} onClick={calcular}>Calcular precio</button>
              </div>
              <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                {resultado !== null ? (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: "#65676B", letterSpacing: ".1em", marginBottom: 8 }}>PRECIO SUGERIDO</div>
                    <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 48, fontWeight: 700, color: "#c9a84c" }}>${resultado.toLocaleString("es-AR")}</div>
                    <div style={{ fontSize: 11, color: "#65676B", marginTop: 8 }}>con {seleccionada.nombre}</div>
                  </div>
                ) : (
                  <div style={{ textAlign: "center", color: "#cccccc", fontSize: 12 }}>Ingresa los valores y calculá</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "admin" && esJefe && (
        <div className="fade">
          {showForm && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "#65676B", letterSpacing: ".1em", marginBottom: 14 }}>{editando ? "EDITAR CALCULADORA" : "NUEVA CALCULADORA"}</div>
              <div className="fg"><div className="fl">Nombre</div><input className="inp" placeholder="Ej: Capilar, Maquillaje..." value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} /></div>
              <div className="fg"><div className="fl">Descripcion (opcional)</div><input className="inp" placeholder="Para que tipo de productos aplica" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} /></div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <button className="btn btn-sm" style={{ flex: 1, background: form.tipo === "desde_costo" ? "#c9a84c15" : "transparent", border: "1px solid " + (form.tipo === "desde_costo" ? "#c9a84c" : "#e8e8e8"), color: form.tipo === "desde_costo" ? "#c9a84c" : "#65676B" }} onClick={() => setForm(f => ({ ...f, tipo: "desde_costo" }))}>Desde costo</button>
                <button className="btn btn-sm" style={{ flex: 1, background: form.tipo === "desde_precio_venta" ? "#c9a84c15" : "transparent", border: "1px solid " + (form.tipo === "desde_precio_venta" ? "#c9a84c" : "#e8e8e8"), color: form.tipo === "desde_precio_venta" ? "#c9a84c" : "#65676B" }} onClick={() => setForm(f => ({ ...f, tipo: "desde_precio_venta" }))}>Desde precio venta proveedor</button>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div className="fg" style={{ flex: 1 }}><div className="fl">Multiplicador de margen</div><input className="inp" type="number" step="0.1" placeholder="2" value={form.margen} onChange={e => setForm(f => ({ ...f, margen: e.target.value }))} /></div>
                {form.tipo === "desde_costo" && <div className="fg" style={{ flex: 1 }}><div className="fl">Impuestos (%)</div><input className="inp" type="number" step="0.5" placeholder="17.5" value={form.iva} onChange={e => setForm(f => ({ ...f, iva: e.target.value }))} /></div>}
              </div>
              <div style={{ fontSize: 11, color: "#65676B", letterSpacing: ".1em", marginBottom: 8 }}>CAMPOS EXTRAS (costos adicionales)</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input className="inp" placeholder="Ej: Costo bolsa, Costo envio..." value={extraTemp} onChange={e => setExtraTemp(e.target.value)} onKeyDown={e => e.key === "Enter" && agregarExtra()} style={{ flex: 1 }} />
                <button className="btn btn-sm" onClick={agregarExtra}>+ Agregar</button>
              </div>
              {form.extras.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                  {form.extras.map((e, i) => (
                    <span key={i} style={{ background: "#f5f5f5", padding: "3px 10px", borderRadius: 12, fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
                      {e.label}
                      <span style={{ cursor: "pointer", color: "#c0392b" }} onClick={() => setForm(f => ({ ...f, extras: f.extras.filter((_, j) => j !== i) }))}>×</span>
                    </span>
                  ))}
                </div>
              )}
              <div style={{ background: "#f9f9f9", borderRadius: 6, padding: "8px 12px", marginBottom: 12, fontSize: 11, color: "#666666", fontFamily: "monospace" }}>
                Vista previa: {formulaTexto({ ...form, margen: parseFloat(form.margen), iva: parseFloat(form.iva) })}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-g" style={{ flex: 1 }} onClick={() => { setShowForm(false); setEditando(null); }}>Cancelar</button>
                <button className="btn btn-p" style={{ flex: 1 }} onClick={guardar}>{editando ? "Guardar cambios" : "Crear calculadora"}</button>
              </div>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {calculadoras.map(c => (
              <div key={c.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{c.nombre}</div>
                  <div style={{ fontSize: 11, color: "#65676B", marginTop: 2 }}>{formulaTexto(c)}</div>
                  {c.descripcion && <div style={{ fontSize: 10, color: "#8A8D91", marginTop: 2 }}>{c.descripcion}</div>}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-sm" onClick={() => abrirEditar(c)}>Editar</button>
                  <button className="btn btn-sm" style={{ color: "#c0392b" }} onClick={() => eliminar(c)}>Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GiftCards({ localId, usuario }) {
  const [tab, setTab] = useState("pendientes");
  const [giftcards, setGiftcards] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [verMov, setVerMov] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [nueva, setNueva] = useState({ monto: "", beneficiario_nombre: "", beneficiario_telefono: "", cliente_id: "" });

  const cargar = () => {
    setLoading(true);
    Promise.all([API.get("/gift-cards"), API.get("/clientes")])
      .then(([gc, cl]) => { setGiftcards(gc.data || []); setClientes(cl.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, []);

  const emitir = async () => {
    if (!nueva.monto || parseFloat(nueva.monto) <= 0) return setMensaje("Ingresa un monto valido");
    if (!nueva.beneficiario_nombre) return setMensaje("Falta el nombre de quien recibe la gift card");
    try {
      const res = await API.post("/gift-cards", { ...nueva, local_id: localId || 1, emitida_por: usuario?.id || null });
      setMensaje("Gift card emitida! Codigo: " + res.data.codigo);
      setShowForm(false);
      setNueva({ monto: "", beneficiario_nombre: "", beneficiario_telefono: "", cliente_id: "" });
      cargar();
      setTimeout(() => setMensaje(""), 6000);
    } catch (e) { setMensaje(e.response?.data?.error || "Error al emitir la gift card"); }
  };

  const verMovimientos = async (gc) => {
    setVerMov(gc);
    try {
      const res = await API.get("/gift-cards/" + gc.id + "/movimientos");
      setMovimientos(res.data || []);
    } catch (e) { setMovimientos([]); }
  };

  const anularGiftCard = async (gc) => {
    const motivo = prompt("Motivo de la anulacion (obligatorio):");
    if (!motivo || !motivo.trim()) return;
    try {
      await API.post("/anulaciones/giftcard/" + gc.id, { motivo, usuario_id: usuario?.id, usuario_nombre: usuario?.nombre, usuario_rol: usuario?.rol });
      setMensaje("Gift card anulada");
      cargar();
      setTimeout(() => setMensaje(""), 3000);
    } catch (e) { setMensaje(e.response?.data?.error || "Error al anular"); }
  };

  const pendientes = giftcards.filter(g => g.estado === "activa" && parseFloat(g.saldo) === parseFloat(g.monto_inicial));
  const parciales = giftcards.filter(g => g.estado === "activa" && parseFloat(g.saldo) > 0 && parseFloat(g.saldo) < parseFloat(g.monto_inicial));
  const agotadas = giftcards.filter(g => g.estado === "agotada");
  const totalEmitido = giftcards.reduce((s, g) => s + parseFloat(g.monto_inicial || 0), 0);
  const totalSaldoVivo = giftcards.reduce((s, g) => s + parseFloat(g.saldo || 0), 0);

  const listaSegunTab = tab === "pendientes" ? pendientes : tab === "parciales" ? parciales : agotadas;

  return (
    <div className="fade">
      <div className="ph">
        <div><div className="pt">Gift Cards</div><div className="ps">emision y seguimiento de saldo</div></div>
        <button className="btn btn-p btn-sm" onClick={() => setShowForm(true)}>+ Emitir Gift Card</button>
      </div>
      <div className="g3" style={{ marginBottom: 16 }}>
        <MCard label="Total emitido (historico)" value={"$" + totalEmitido.toLocaleString("es-AR", { maximumFractionDigits: 0 })} color="#c9a84c" />
        <MCard label="Saldo vivo (sin canjear)" value={"$" + totalSaldoVivo.toLocaleString("es-AR", { maximumFractionDigits: 0 })} color="#2d7a4f" />
        <MCard label="Gift cards emitidas" value={String(giftcards.length)} color="#2C3E5C" />
      </div>
      {mensaje && <div style={{ background: mensaje.includes("Error") || mensaje.includes("Falta") || mensaje.includes("valido") ? "#c0392b12" : "#2d7a4f12", border: "1px solid " + (mensaje.includes("Error") || mensaje.includes("Falta") ? "#c0392b" : "#2d7a4f"), borderRadius: 6, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: mensaje.includes("Error") || mensaje.includes("Falta") ? "#c0392b" : "#2d7a4f", fontWeight: 600 }}>{mensaje}</div>}
      <div className="tabs">
        <div className={"tab " + (tab === "pendientes" ? "on" : "")} onClick={() => setTab("pendientes")}>SIN USAR ({pendientes.length})</div>
        <div className={"tab " + (tab === "parciales" ? "on" : "")} onClick={() => setTab("parciales")}>CON SALDO PARCIAL ({parciales.length})</div>
        <div className={"tab " + (tab === "agotadas" ? "on" : "")} onClick={() => setTab("agotadas")}>CANJEADAS COMPLETO ({agotadas.length})</div>
      </div>
      <div className="card">
        {loading ? (
          <div style={{ textAlign: "center", color: "#65676B", padding: 20, fontSize: 12 }}>Cargando...</div>
        ) : listaSegunTab.length === 0 ? (
          <div style={{ textAlign: "center", color: "#65676B", padding: 30, fontSize: 12 }}>No hay gift cards en esta categoria</div>
        ) : (
          <table>
            <thead><tr><th>Codigo</th><th>Beneficiario</th><th>Monto inicial</th><th>Saldo</th><th>Cliente vinculada</th><th>Emitida</th><th></th></tr></thead>
            <tbody>
              {listaSegunTab.map(g => (
                <tr key={g.id}>
                  <td style={{ fontFamily: "monospace", fontWeight: 700, color: "#2C3E5C" }}>{g.codigo}</td>
                  <td style={{ fontSize: 12 }}>{g.beneficiario_nombre}{g.beneficiario_telefono ? <div style={{ fontSize: 10, color: "#65676B" }}>{g.beneficiario_telefono}</div> : null}</td>
                  <td style={{ fontSize: 12 }}>${parseFloat(g.monto_inicial).toLocaleString("es-AR")}</td>
                  <td><span className={"badge " + (parseFloat(g.saldo) === 0 ? "br" : parseFloat(g.saldo) < parseFloat(g.monto_inicial) ? "ba" : "bg")}>${parseFloat(g.saldo).toLocaleString("es-AR")}</span></td>
                  <td style={{ fontSize: 11, color: "#65676B" }}>{g.cliente_nombre || "-"}</td>
                  <td style={{ fontSize: 10, color: "#65676B" }}>{new Date(g.creado_en).toLocaleDateString("es-AR")}</td>
                  <td><div style={{ display: "flex", gap: 4 }}><button className="btn btn-sm" onClick={() => verMovimientos(g)}>Ver historial</button>{(usuario?.rol === "jefe" || usuario?.rol === "administrativo") && !g.anulada && <button className="btn btn-sm" style={{ color: "#c0392b" }} onClick={() => anularGiftCard(g)}>Anular</button>}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="card" style={{ width: 400, background: "#ffffff" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Emitir Gift Card</div>
            <div className="fg"><div className="fl">Monto ($)</div><input className="inp" type="number" placeholder="10000" value={nueva.monto} onChange={e => setNueva(p => ({ ...p, monto: e.target.value }))} /></div>
            <div className="fg"><div className="fl">Nombre de quien la recibe</div><input className="inp" placeholder="Ej: Maria Lopez" value={nueva.beneficiario_nombre} onChange={e => setNueva(p => ({ ...p, beneficiario_nombre: e.target.value }))} /></div>
            <div className="fg"><div className="fl">Telefono (opcional)</div><input className="inp" placeholder="Ej: 2964123456" value={nueva.beneficiario_telefono} onChange={e => setNueva(p => ({ ...p, beneficiario_telefono: e.target.value }))} /></div>
            <div className="fg"><div className="fl">Vincular a clienta existente (opcional)</div>
              <select className="sel" value={nueva.cliente_id} onChange={e => setNueva(p => ({ ...p, cliente_id: e.target.value }))}>
                <option value="">Sin vincular</option>
                {clientes.map(c => (<option key={c.id} value={c.id}>{c.nombre}</option>))}
              </select>
            </div>
            <div style={{ fontSize: 10, color: "#65676B", marginBottom: 14 }}>Al emitirla se cobra el monto ahora y se genera el ingreso de caja. La factura se hace recien cuando se canjea por productos.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-g" style={{ flex: 1 }} onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="btn btn-p" style={{ flex: 1 }} onClick={emitir}>Emitir y cobrar</button>
            </div>
          </div>
        </div>
      )}

      {verMov && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="card" style={{ width: 420, background: "#ffffff" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{verMov.codigo}</div>
            <div style={{ fontSize: 11, color: "#65676B", marginBottom: 14 }}>{verMov.beneficiario_nombre} - Saldo actual: <b style={{ color: "#2d7a4f" }}>${parseFloat(verMov.saldo).toLocaleString("es-AR")}</b></div>
            {movimientos.length === 0 ? (
              <div style={{ fontSize: 12, color: "#65676B", textAlign: "center", padding: 16 }}>Sin movimientos</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 300, overflowY: "auto" }}>
                {movimientos.map((m, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderBottom: "1px solid #E4E6EB", paddingBottom: 6 }}>
                    <div>
                      <span style={{ fontWeight: 600, color: m.tipo === "emision" ? "#2d7a4f" : "#c0392b" }}>{m.tipo === "emision" ? "Emision" : "Canje"}</span>
                      <div style={{ fontSize: 10, color: "#65676B" }}>{new Date(m.creado_en).toLocaleDateString("es-AR")}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: m.tipo === "emision" ? "#2d7a4f" : "#c0392b" }}>{m.tipo === "emision" ? "+" : "-"}${parseFloat(m.importe).toLocaleString("es-AR")}</div>
                      <div style={{ fontSize: 10, color: "#65676B" }}>saldo: ${parseFloat(m.saldo_resultante).toLocaleString("es-AR")}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button className="btn btn-g" style={{ width: "100%", marginTop: 14 }} onClick={() => setVerMov(null)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}


function Tiendanube({ localId, usuario }) {
  const [tab, setTab] = useState("pedidos");
  const [pedidos, setPedidos] = useState([]);
  const [vinculos, setVinculos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [tnProductos, setTnProductos] = useState([]);
  const [busqTN, setBusqTN] = useState("");
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [status, setStatus] = useState(null);
  const [vinculando, setVinculando] = useState(null);
  const [tnSeleccionado, setTnSeleccionado] = useState(null);

  const cargar = async () => {
    setLoading(true);
    try {
      const [pedRes, vincRes, prodRes, stRes] = await Promise.all([
        API.get("/tiendanube/pedidos-locales"),
        API.get("/tiendanube/vinculos"),
        API.get("/productos"),
        API.get("/tiendanube/status")
      ]);
      setPedidos(pedRes.data || []);
      setVinculos(vincRes.data || []);
      setProductos(prodRes.data || []);
      setStatus(stRes.data);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const autorizar = async (p) => {
    try {
      await API.post("/tiendanube/pedidos-locales/" + p.id + "/autorizar", { usuario_nombre: usuario?.nombre });
      setMensaje("Stock descontado para pedido #" + p.numero);
      cargar();
      setTimeout(() => setMensaje(""), 4000);
    } catch (e) { setMensaje(e.response?.data?.error || "Error al autorizar"); }
  };

  const rechazar = async (p) => {
    try {
      await API.post("/tiendanube/pedidos-locales/" + p.id + "/rechazar");
      setMensaje("Pedido rechazado");
      cargar();
      setTimeout(() => setMensaje(""), 3000);
    } catch (e) { setMensaje("Error al rechazar"); }
  };

  const buscarEnTN = async () => {
    if (!busqTN.trim()) return;
    try {
      const res = await API.get("/tiendanube/buscar-producto?q=" + encodeURIComponent(busqTN));
      setTnProductos(res.data || []);
    } catch (e) { setMensaje("Error al buscar en Tiendanube"); }
  };

  const guardarVinculo = async () => {
    if (!vinculando || !tnSeleccionado) return;
    try {
      await API.post("/tiendanube/vinculos", {
        producto_id: vinculando.id,
        tn_product_id: tnSeleccionado.id,
        tn_variant_id_rg: tnSeleccionado.variantes?.[0]?.id || null,
        tn_variant_id_ush: tnSeleccionado.variantes?.[1]?.id || tnSeleccionado.variantes?.[0]?.id || null
      });
      setMensaje("Vinculado: " + vinculando.nombre + " con " + tnSeleccionado.nombre);
      setVinculando(null);
      setTnSeleccionado(null);
      setTnProductos([]);
      setBusqTN("");
      cargar();
      setTimeout(() => setMensaje(""), 4000);
    } catch (e) { setMensaje("Error al vincular"); }
  };

  const desvincular = async (v) => {
    try {
      await API.delete("/tiendanube/vinculos/" + v.producto_id);
      setMensaje("Desvinculado");
      cargar();
      setTimeout(() => setMensaje(""), 3000);
    } catch (e) { setMensaje("Error"); }
  };

  const pendientes = pedidos.filter(p => p.estado === "pendiente");
  const procesados = pedidos.filter(p => p.estado !== "pendiente");

  return (
    <div className="fade">
      <div className="ph">
        <div>
          <div className="pt">Tiendanube</div>
          <div className="ps">{status?.ok ? status.tienda + " - conectada" : "sin conexion"}</div>
        </div>
        {status?.ok && <span className="badge bg">Conectada</span>}
      </div>
      {mensaje && <div style={{ background: mensaje.includes("Error") ? "#c0392b12" : "#2d7a4f12", border: "1px solid " + (mensaje.includes("Error") ? "#c0392b" : "#2d7a4f"), borderRadius: 6, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: mensaje.includes("Error") ? "#c0392b" : "#2d7a4f" }}>{mensaje}</div>}
      <div className="tabs">
        <div className={"tab " + (tab === "pedidos" ? "on" : "")} onClick={() => setTab("pedidos")}>PEDIDOS {pendientes.length > 0 && <span style={{ background: "#c0392b", color: "white", borderRadius: 10, fontSize: 8, padding: "1px 5px", marginLeft: 4 }}>{pendientes.length}</span>}</div>
        <div className={"tab " + (tab === "vincular" ? "on" : "")} onClick={() => setTab("vincular")}>VINCULAR PRODUCTOS</div>
        <div className={"tab " + (tab === "historial" ? "on" : "")} onClick={() => setTab("historial")}>HISTORIAL</div>
      </div>
      {tab === "pedidos" && (
        <div className="fade">
          {pendientes.length === 0 ? (
            <div className="card" style={{ textAlign: "center", color: "#65676B", padding: 30, fontSize: 12 }}>No hay pedidos pendientes de autorizar</div>
          ) : pendientes.map(p => {
            const items = p.productos || [];
            return (
              <div key={p.id} className="card" style={{ marginBottom: 12, borderLeft: "3px solid #c9a84c" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>Pedido #{p.numero}</div>
                    <div style={{ fontSize: 11, color: "#65676B" }}>{p.cliente_nombre}{p.cliente_email ? " - " + p.cliente_email : ""}</div>
                    <div style={{ fontSize: 10, color: "#65676B" }}>{new Date(p.creado_en).toLocaleDateString("es-AR")} {new Date(p.creado_en).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#c9a84c" }}>${parseFloat(p.total || 0).toLocaleString("es-AR")}</div>
                </div>
                <div style={{ background: "#f8f8f8", borderRadius: 6, padding: "6px 10px", marginBottom: 10 }}>
                  {items.map((it, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "3px 0", borderBottom: idx < items.length - 1 ? "1px solid #f0f0f0" : "none" }}>
                      <span>{it.nombre} x{it.cantidad}</span>
                      <span style={{ color: "#65676B" }}>${parseFloat(it.precio || 0).toLocaleString("es-AR")}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-p btn-sm" style={{ flex: 2 }} onClick={() => autorizar(p)}>Autorizar descuento de stock</button>
                  <button className="btn btn-g btn-sm" style={{ flex: 1 }} onClick={() => rechazar(p)}>Ignorar</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {tab === "vincular" && (
        <div className="fade">
          {vinculando && (
            <div className="card" style={{ marginBottom: 16, borderLeft: "3px solid #2471a3" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Vincular: {vinculando.nombre}</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <input className="inp" placeholder="Buscar en Tiendanube..." value={busqTN} onChange={e => setBusqTN(e.target.value)} onKeyDown={e => e.key === "Enter" && buscarEnTN()} style={{ flex: 1 }} />
                <button className="btn btn-p btn-sm" onClick={buscarEnTN}>Buscar</button>
              </div>
              {tnProductos.length > 0 && (
                <div style={{ maxHeight: 200, overflowY: "auto", marginBottom: 10 }}>
                  {tnProductos.map(tp => (
                    <div key={tp.id} onClick={() => setTnSeleccionado(tp)}
                      style={{ padding: "8px 10px", borderRadius: 6, marginBottom: 4, cursor: "pointer", background: tnSeleccionado?.id === tp.id ? "#2471a312" : "#f8f8f8", border: "1px solid " + (tnSeleccionado?.id === tp.id ? "#2471a3" : "#e8e8e8") }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{tp.nombre}</div>
                      <div style={{ fontSize: 10, color: "#65676B" }}>{(tp.variantes || []).length} variante(s)</div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-g btn-sm" style={{ flex: 1 }} onClick={() => { setVinculando(null); setTnProductos([]); setTnSeleccionado(null); }}>Cancelar</button>
                {tnSeleccionado && <button className="btn btn-p btn-sm" style={{ flex: 1 }} onClick={guardarVinculo}>Confirmar vinculo</button>}
              </div>
            </div>
          )}
          <div className="g2">
            <div className="card">
              <div className="ct">PRODUCTOS SIN VINCULAR</div>
              {productos.filter(p => !vinculos.find(v => v.producto_id === p.id)).length === 0 ? (
                <div style={{ fontSize: 12, color: "#65676B", textAlign: "center", padding: 20 }}>Todos los productos estan vinculados</div>
              ) : (
                <div style={{ maxHeight: 400, overflowY: "auto" }}>
                  {productos.filter(p => !vinculos.find(v => v.producto_id === p.id)).map(p => (
                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #f5f5f5" }}>
                      <div>
                        <div style={{ fontSize: 12 }}>{p.nombre}</div>
                        <div style={{ fontSize: 10, color: "#65676B" }}>{p.marca || ""}</div>
                      </div>
                      <button className="btn btn-sm" style={{ fontSize: 9 }} onClick={() => { setVinculando(p); setTnProductos([]); setTnSeleccionado(null); setBusqTN(p.nombre || ""); }}>Vincular</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="card">
              <div className="ct">PRODUCTOS VINCULADOS ({vinculos.length})</div>
              {vinculos.length === 0 ? (
                <div style={{ fontSize: 12, color: "#65676B", textAlign: "center", padding: 20 }}>Sin vinculos creados</div>
              ) : (
                <div style={{ maxHeight: 400, overflowY: "auto" }}>
                  {vinculos.map(v => (
                    <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #f5f5f5" }}>
                      <div>
                        <div style={{ fontSize: 12 }}>{v.producto_nombre}</div>
                        <div style={{ fontSize: 10, color: "#65676B" }}>TN ID: {v.tn_product_id}</div>
                      </div>
                      <button className="btn btn-sm" style={{ color: "#c0392b", fontSize: 9 }} onClick={() => desvincular(v)}>Desvincular</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {tab === "historial" && (
        <div className="card fade">
          {procesados.length === 0 ? (
            <div style={{ fontSize: 12, color: "#65676B", textAlign: "center", padding: 30 }}>Sin pedidos procesados todavia</div>
          ) : (
            <table>
              <thead><tr><th>Pedido</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Autorizado por</th><th>Fecha</th></tr></thead>
              <tbody>
                {procesados.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>#{p.numero}</td>
                    <td style={{ fontSize: 12 }}>{p.cliente_nombre}</td>
                    <td style={{ color: "#c9a84c", fontWeight: 600 }}>${parseFloat(p.total || 0).toLocaleString("es-AR")}</td>
                    <td><span className={"badge " + (p.estado === "procesado" ? "bg" : "br")}>{p.estado}</span></td>
                    <td style={{ fontSize: 11, color: "#65676B" }}>{p.autorizado_por || "-"}</td>
                    <td style={{ fontSize: 10, color: "#65676B" }}>{new Date(p.creado_en).toLocaleDateString("es-AR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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

  const nivelColor = datos?.nivel === 2 ? "#c9a84c" : datos?.nivel === 1 ? "#2d7a4f" : "#65676B";
  const nivelEmoji = datos?.nivel === 2 ? "🏆" : datos?.nivel === 1 ? "⭐" : "🎯";

  return (
    <div className="fade">
      <div className="ph">
        <div><div className="pt">Comisiones</div><div className="ps">facturacion del mes - metas - premios</div></div>
        <button className="btn btn-g btn-sm" onClick={cargar}>Actualizar</button>
      </div>
      {mensaje && (
        <div style={{ background: mensaje.includes("Error") ? "#c0392b12" : "#2d7a4f12", border: "1px solid " + (mensaje.includes("Error") ? "#c0392b" : "#2d7a4f"), borderRadius: 6, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: mensaje.includes("Error") ? "#c0392b" : "#2d7a4f" }}>
          {mensaje}
        </div>
      )}
      {!loading && datos && (
        <div>
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
                  <span style={{ fontSize: 12, color: "#444444", fontWeight: 600 }}>Meta 1 "" ${parseFloat(datos.umbral_1 || 0).toLocaleString()}</span>
                  <span style={{ fontSize: 12, color: "#2d7a4f", fontWeight: 600 }}>+${parseFloat(datos.comision_1 || 0).toLocaleString()}</span>
                </div>
                <div className="pb" style={{ height: 10 }}>
                  <div className="pf" style={{ width: datos.pct_nivel1 + "%", background: datos.nivel >= 1 ? "#2d7a4f" : "#c9a84c" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: "#65676B" }}>${parseFloat(datos.facturacion || 0).toLocaleString()} facturado</span>
                  <span style={{ fontSize: 10, color: datos.nivel >= 1 ? "#2d7a4f" : "#65676B" }}>{datos.pct_nivel1}%</span>
                </div>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: "#444444", fontWeight: 600 }}>Meta 2 "" ${parseFloat(datos.umbral_2 || 0).toLocaleString()}</span>
                  <span style={{ fontSize: 12, color: "#c9a84c", fontWeight: 600 }}>+${parseFloat(datos.comision_2 || 0).toLocaleString()}</span>
                </div>
                <div className="pb" style={{ height: 10 }}>
                  <div className="pf" style={{ width: datos.pct_nivel2 + "%", background: datos.nivel >= 2 ? "#c9a84c" : "#dddddd" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: "#65676B" }}>${parseFloat(datos.facturacion || 0).toLocaleString()} facturado</span>
                  <span style={{ fontSize: 10, color: datos.nivel >= 2 ? "#c9a84c" : "#65676B" }}>{datos.pct_nivel2}%</span>
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
        </div>
      )}
      {loading && <div style={{ textAlign: "center", color: "#65676B", padding: 40 }}>Calculando comisiones...</div>}
    </div>
  );
}

function Proveedores() {
  const [tab, setTab] = useState("lista");
  const [proveedores, setProveedores] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [vencimientos, setVencimientos] = useState([]);
  const [todasOrdenes, setTodasOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [nuevo, setNuevo] = useState({ nombre: "", cuit: "", email: "", telefono: "", whatsapp: "", dias_pago: 30, forma_pago: "transferencia", banco: "", cbu: "", alias: "", titular_cuenta: "", categoria: "mercaderia", notas: "" });

  const cargar = () => {
    Promise.all([API.get("/proveedores"), API.get("/cuentas-pago")])
      .then(([p, c]) => { setProveedores(p.data); setCuentas(c.data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  const cargarCuentasAPagar = () => {
    Promise.all([API.get("/ordenes-ingreso/alertas/vencimientos"), API.get("/ordenes-ingreso")])
      .then(([v, o]) => {
        setVencimientos(v.data || []);
        setTodasOrdenes((o.data || []).filter(x => x.estado !== "pagada"));
      })
      .catch(() => {});
  };

  useEffect(() => { cargar(); }, []);

  const marcarPagada = async (orden) => {
    try {
      await API.put("/ordenes-ingreso/" + orden.id + "/pagar", {});
      setMensaje("Marcada como pagada: " + (orden.numero_factura || ""));
      cargarCuentasAPagar();
      setTimeout(() => setMensaje(""), 3000);
    } catch (e) { setMensaje("Error al marcar como pagada"); }
  };

  const guardar = async () => {
    try {
      await API.post("/proveedores", nuevo);
      setMensaje("Proveedor guardado!");
      setShowForm(false);
      setNuevo({ nombre: "", cuit: "", email: "", telefono: "", whatsapp: "", dias_pago: 30, forma_pago: "transferencia", banco: "", cbu: "", alias: "", titular_cuenta: "", categoria: "mercaderia", notas: "" });
      cargar();
      setTimeout(() => setMensaje(""), 3000);
    } catch (e) { setMensaje("Error al guardar proveedor"); }
  };

  const categoriaColor = { mercaderia: "#c9a84c", servicios: "#2471a3", admin: "#7d3c98" };

  return (
    <div className="fade">
      <div className="ph">
        <div><div className="pt">Proveedores</div><div className="ps">gestion - datos bancarios - condiciones de pago</div></div>
        <button className="btn btn-p btn-sm" onClick={() => setShowForm(!showForm)}>+ Nuevo proveedor</button>
      </div>
      {mensaje && <div style={{ background: mensaje.includes("Error") ? "#c0392b12" : "#2d7a4f12", border: "1px solid " + (mensaje.includes("Error") ? "#c0392b" : "#2d7a4f"), borderRadius: 6, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: mensaje.includes("Error") ? "#c0392b" : "#2d7a4f" }}>{mensaje}</div>}
      
      {showForm && (
        <div className="card fade" style={{ marginBottom: 18 }}>
          <div className="ct">Nuevo proveedor</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <div className="fg"><div className="fl">Nombre</div><input className="inp" placeholder="Nombre del proveedor" value={nuevo.nombre} onChange={e => setNuevo(p => ({ ...p, nombre: e.target.value }))} /></div>
              <div className="fg"><div className="fl">CUIT</div><input className="inp" placeholder="30-12345678-9" value={nuevo.cuit} onChange={e => setNuevo(p => ({ ...p, cuit: e.target.value }))} /></div>
              <div className="fg"><div className="fl">Categoria</div>
                <select className="sel" value={nuevo.categoria} onChange={e => setNuevo(p => ({ ...p, categoria: e.target.value }))}>
                  <option value="mercaderia">Mercaderia</option>
                  <option value="servicios">Servicios</option>
                  <option value="admin">Administrativo</option>
                </select>
              </div>
              <div className="fg"><div className="fl">Dias de pago</div><input className="inp" type="number" placeholder="30" value={nuevo.dias_pago} onChange={e => setNuevo(p => ({ ...p, dias_pago: e.target.value }))} /></div>
              <div className="fg"><div className="fl">Forma de pago habitual</div>
                <select className="sel" value={nuevo.forma_pago} onChange={e => setNuevo(p => ({ ...p, forma_pago: e.target.value }))}>
                  <option value="transferencia">Transferencia</option>
                  <option value="echeck">eCheck</option>
                  <option value="efectivo">Efectivo</option>
                </select>
              </div>
            </div>
            <div>
              <div className="fg"><div className="fl">Email</div><input className="inp" placeholder="proveedor@email.com" value={nuevo.email} onChange={e => setNuevo(p => ({ ...p, email: e.target.value }))} /></div>
              <div className="fg"><div className="fl">Telefono</div><input className="inp" placeholder="+54 11 0000 0000" value={nuevo.telefono} onChange={e => setNuevo(p => ({ ...p, telefono: e.target.value }))} /></div>
              <div className="fg"><div className="fl">WhatsApp</div><input className="inp" placeholder="+54 9 11 0000 0000" value={nuevo.whatsapp} onChange={e => setNuevo(p => ({ ...p, whatsapp: e.target.value }))} /></div>
              <div className="fg"><div className="fl">Notas</div><textarea className="inp" rows={3} placeholder="Condiciones especiales, contacto, etc." value={nuevo.notas} onChange={e => setNuevo(p => ({ ...p, notas: e.target.value }))} /></div>
            </div>
            <div>
              <div className="ct" style={{ marginBottom: 10 }}>Datos bancarios</div>
              <div className="fg"><div className="fl">Banco</div><input className="inp" placeholder="Santander / Galicia / etc." value={nuevo.banco} onChange={e => setNuevo(p => ({ ...p, banco: e.target.value }))} /></div>
              <div className="fg"><div className="fl">CBU</div><input className="inp" placeholder="0000000000000000000000" value={nuevo.cbu} onChange={e => setNuevo(p => ({ ...p, cbu: e.target.value }))} /></div>
              <div className="fg"><div className="fl">Alias</div><input className="inp" placeholder="alias.proveedor" value={nuevo.alias} onChange={e => setNuevo(p => ({ ...p, alias: e.target.value }))} /></div>
              <div className="fg"><div className="fl">Titular</div><input className="inp" placeholder="Nombre del titular" value={nuevo.titular_cuenta} onChange={e => setNuevo(p => ({ ...p, titular_cuenta: e.target.value }))} /></div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button className="btn btn-p" style={{ flex: 1 }} onClick={guardar}>Guardar</button>
                <button className="btn btn-g" style={{ flex: 1 }} onClick={() => setShowForm(false)}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="tabs">
        <div className={"tab " + (tab === "lista" ? "on" : "")} onClick={() => setTab("lista")}>PROVEEDORES</div>
        <div className={"tab " + (tab === "cuentas" ? "on" : "")} onClick={() => setTab("cuentas")}>CUENTAS DE PAGO</div>
        <div className={"tab " + (tab === "pagar" ? "on" : "")} onClick={() => { setTab("pagar"); cargarCuentasAPagar(); }}>
          CUENTAS A PAGAR {vencimientos.length > 0 && <span style={{ background: "#c0392b", color: "white", borderRadius: 10, fontSize: 8, padding: "1px 5px", marginLeft: 4 }}>{vencimientos.length}</span>}
        </div>
      </div>

      {tab === "lista" && (
        <div className="fade">
          {loading ? <div style={{ color: "#65676B", padding: 20 }}>Cargando...</div> :
          proveedores.length === 0 ? (
            <div style={{ textAlign: "center", color: "#65676B", padding: 40, fontSize: 13 }}>No hay proveedores cargados aun</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {proveedores.map(p => (
                <div key={p.id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#111111" }}>{p.nombre}</div>
                      <div style={{ fontSize: 10, color: "#65676B" }}>{p.cuit}</div>
                    </div>
                    <span className="badge" style={{ background: (categoriaColor[p.categoria] || "#999") + "15", color: categoriaColor[p.categoria] || "#999" }}>{p.categoria}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                    <div style={{ background: "#fafafa", borderRadius: 6, padding: "8px 10px" }}>
                      <div style={{ fontSize: 9, color: "#65676B", marginBottom: 3 }}>CONDICION DE PAGO</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#c9a84c" }}>{p.dias_pago} dias</div>
                      <div style={{ fontSize: 10, color: "#666666" }}>{p.forma_pago}</div>
                    </div>
                    <div style={{ background: "#fafafa", borderRadius: 6, padding: "8px 10px" }}>
                      <div style={{ fontSize: 9, color: "#65676B", marginBottom: 3 }}>CONTACTO</div>
                      {p.telefono && <div style={{ fontSize: 11, color: "#444444" }}>{p.telefono}</div>}
                      {p.whatsapp && <div style={{ fontSize: 10, color: "#25d366" }}>WA: {p.whatsapp}</div>}
                      {p.email && <div style={{ fontSize: 10, color: "#2471a3" }}>{p.email}</div>}
                    </div>
                  </div>
                  {(p.cbu || p.alias) && (
                    <div style={{ background: "#f0f7ff", borderRadius: 6, padding: "8px 10px", marginBottom: 8 }}>
                      <div style={{ fontSize: 9, color: "#2471a3", marginBottom: 3 }}>DATOS BANCARIOS</div>
                      {p.banco && <div style={{ fontSize: 11, color: "#444444" }}>{p.banco} "" {p.titular_cuenta}</div>}
                      {p.alias && <div style={{ fontSize: 11, color: "#111111", fontWeight: 600 }}>Alias: {p.alias}</div>}
                      {p.cbu && <div style={{ fontSize: 10, color: "#666666" }}>CBU: {p.cbu}</div>}
                    </div>
                  )}
                  {p.notas && <div style={{ fontSize: 10, color: "#65676B", fontStyle: "italic" }}>{p.notas}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "cuentas" && (
        <div className="fade">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            {cuentas.map(c => (
              <div key={c.id} className="card" style={{ borderLeft: "3px solid " + (c.tipo === "efectivo" ? "#2d7a4f" : c.tipo === "transferencia" ? "#2471a3" : c.tipo === "echeck" ? "#c9a84c" : "#65676B") }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111111" }}>{c.nombre}</div>
                  {c.solo_acreditacion && <span className="badge bb" style={{ fontSize: 9 }}>Solo acreditacion</span>}
                </div>
                <div style={{ fontSize: 10, color: "#65676B", marginBottom: 4 }}>{c.titular}</div>
                <span className="badge" style={{ background: c.tipo === "efectivo" ? "#2d7a4f12" : c.tipo === "transferencia" ? "#2471a312" : "#c9a84c15", color: c.tipo === "efectivo" ? "#2d7a4f" : c.tipo === "transferencia" ? "#2471a3" : "#c9a84c", fontSize: 9 }}>{c.tipo}</span>
                {c.alias && <div style={{ fontSize: 11, color: "#444444", marginTop: 6 }}>Alias: {c.alias}</div>}
                {c.cbu && <div style={{ fontSize: 10, color: "#666666" }}>CBU: {c.cbu}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "pagar" && (() => {
        const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
        const conUrgencia = todasOrdenes.map(o => {
          const venc = o.fecha_vencimiento ? new Date(o.fecha_vencimiento) : null;
          const diasRestantes = venc ? Math.ceil((venc - hoy) / (1000 * 60 * 60 * 24)) : null;
          let urgencia = "normal";
          if (diasRestantes !== null) {
            if (diasRestantes < 0) urgencia = "vencida";
            else if (diasRestantes <= 7) urgencia = "proxima";
          }
          return { ...o, diasRestantes, urgencia };
        }).sort((a, b) => {
          const orden = { vencida: 0, proxima: 1, normal: 2 };
          if (orden[a.urgencia] !== orden[b.urgencia]) return orden[a.urgencia] - orden[b.urgencia];
          return (a.diasRestantes ?? 999) - (b.diasRestantes ?? 999);
        });
        const colores = { vencida: { bg: "#c0392b12", border: "#c0392b", text: "#c0392b" }, proxima: { bg: "#c9a84c12", border: "#c9a84c", text: "#c9a84c" }, normal: { bg: "#fafafa", border: "#e8e8e8", text: "#666666" } };
        return (
          <div className="fade">
            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "#65676B", letterSpacing: ".1em", marginBottom: 4 }}>RESUMEN</div>
              <div style={{ display: "flex", gap: 20 }}>
                <div><span style={{ fontSize: 20, fontWeight: 700, color: "#c0392b" }}>{conUrgencia.filter(o => o.urgencia === "vencida").length}</span><div style={{ fontSize: 10, color: "#65676B" }}>vencidas</div></div>
                <div><span style={{ fontSize: 20, fontWeight: 700, color: "#c9a84c" }}>{conUrgencia.filter(o => o.urgencia === "proxima").length}</span><div style={{ fontSize: 10, color: "#65676B" }}>vencen en 7 dias</div></div>
                <div><span style={{ fontSize: 20, fontWeight: 700, color: "#2d7a4f" }}>${conUrgencia.reduce((s, o) => s + parseFloat(o.total || 0), 0).toLocaleString("es-AR", { maximumFractionDigits: 0 })}</span><div style={{ fontSize: 10, color: "#65676B" }}>total pendiente</div></div>
              </div>
            </div>
            {conUrgencia.length === 0 ? (
              <div className="card"><div style={{ fontSize: 12, color: "#65676B", textAlign: "center", padding: 30 }}>No hay facturas pendientes de pago</div></div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {conUrgencia.map((o, i) => {
                  const c = colores[o.urgencia];
                  return (
                    <div key={i} className="card" style={{ background: c.bg, border: "1px solid " + c.border, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{o.proveedor_nombre || "-"} <span style={{ color: "#65676B", fontWeight: 400 }}>- {o.numero_factura || "sin numero"}</span></div>
                        <div style={{ fontSize: 11, color: c.text, marginTop: 2, fontWeight: 600 }}>
                          {o.urgencia === "vencida" ? "Vencida hace " + Math.abs(o.diasRestantes) + " dias" : o.urgencia === "proxima" ? (o.diasRestantes === 0 ? "Vence hoy" : "Vence en " + o.diasRestantes + " dias") : "Vence " + new Date(o.fecha_vencimiento).toLocaleDateString("es-AR")}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: "#111111" }}>${parseFloat(o.total || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 })}</span>
                        <button className="btn btn-sm" style={{ background: "#2d7a4f", color: "white" }} onClick={() => marcarPagada(o)}>Marcar pagada</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

function Caja({ localId, usuario }) {
  const [movimientos, setMovimientos] = useState([]);
  const [saldo, setSaldo] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [cuentas, setCuentas] = useState([]);
  const [nuevo, setNuevo] = useState({
    tipo: "ingreso", importe: "", concepto: "", destino_origen: "", cuenta_destino_id: ""
  });

  const cargar = async () => {
    setLoading(true);
    try {
      const [movRes, saldoRes, cuentasRes] = await Promise.all([
        API.get("/caja?local_id=" + (localId || 1)),
        API.get("/caja/saldo?local_id=" + (localId || 1)),
        API.get("/cuentas-pago?solo_pago=true")
      ]);
      setMovimientos(movRes.data);
      setSaldo(saldoRes.data.saldo);
      setCuentas(cuentasRes.data);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { cargar(); }, [localId]);

  const anularMovimiento = async (m) => {
    const motivo = prompt("Motivo de la anulacion (obligatorio):");
    if (!motivo || !motivo.trim()) return;
    try {
      await API.post("/anulaciones/movimiento/" + m.id, { motivo, usuario_id: usuario?.id, usuario_nombre: usuario?.nombre, usuario_rol: usuario?.rol });
      setMensaje("Movimiento anulado");
      cargar();
      setTimeout(() => setMensaje(""), 3000);
    } catch (e) { setMensaje(e.response?.data?.error || "Error al anular"); }
  };

  const guardar = async () => {
    if (!nuevo.importe || !nuevo.concepto) return setMensaje("Completa importe y concepto");
    try {
      await API.post("/caja", { ...nuevo, local_id: localId || 1, usuario_id: usuario?.id || null });
      setMensaje(nuevo.tipo === "ingreso" ? "Ingreso registrado!" : "Egreso registrado!");
      setNuevo({ tipo: "ingreso", importe: "", concepto: "", destino_origen: "", cuenta_destino_id: "" });
      cargar();
      setTimeout(() => setMensaje(""), 3000);
    } catch (e) { setMensaje("Error al registrar"); }
  };

  const saldoColor = saldo >= 0 ? "#2d7a4f" : "#c0392b";

  return (
    <div className="fade">
      <div className="ph">
        <div><div className="pt">Caja</div><div className="ps">movimientos de efectivo</div></div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, color: "#65676B", letterSpacing: ".1em" }}>SALDO ACTUAL</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: saldoColor }}>${saldo.toLocaleString()}</div>
        </div>
      </div>
      {mensaje && (
        <div style={{ background: mensaje.includes("Error") ? "#c0392b12" : "#2d7a4f12", border: "1px solid " + (mensaje.includes("Error") ? "#c0392b" : "#2d7a4f"), borderRadius: 6, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: mensaje.includes("Error") ? "#c0392b" : "#2d7a4f" }}>
          {mensaje}
        </div>
      )}
      <div className="g2">
        <div className="card">
          <div className="ct">Nuevo movimiento</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {["ingreso", "egreso"].map(t => (
              <button key={t} onClick={() => setNuevo(p => ({ ...p, tipo: t }))} className="btn btn-sm"
                style={{ flex: 1, background: nuevo.tipo === t ? (t === "ingreso" ? "#2d7a4f15" : "#c0392b15") : "transparent",
                  border: "1px solid " + (nuevo.tipo === t ? (t === "ingreso" ? "#2d7a4f" : "#c0392b") : "#e8e8e8"),
                  color: nuevo.tipo === t ? (t === "ingreso" ? "#2d7a4f" : "#c0392b") : "#65676B", fontWeight: nuevo.tipo === t ? 600 : 400 }}>
                {t === "ingreso" ? "Ingreso" : "Egreso"}
              </button>
            ))}
          </div>
          <div className="fg"><div className="fl">Importe ($)</div>
            <input className="inp" type="number" placeholder="5000" value={nuevo.importe} onChange={e => setNuevo(p => ({ ...p, importe: e.target.value }))} />
          </div>
          <div className="fg"><div className="fl">Concepto</div>
            <input className="inp" placeholder={nuevo.tipo === "ingreso" ? "Ej: Venta presencial..." : "Ej: Pago proveedor..."} value={nuevo.concepto} onChange={e => setNuevo(p => ({ ...p, concepto: e.target.value }))} />
          </div>
          {nuevo.tipo === "egreso" && (
            <div>
              <div className="fg"><div className="fl">Destino del efectivo</div>
                <select className="sel" value={nuevo.destino_origen} onChange={e => setNuevo(p => ({ ...p, destino_origen: e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  <option value="pago_proveedor">Pago a proveedor</option>
                  <option value="deposito_cuenta">Deposito en cuenta bancaria</option>
                  <option value="gasto_operativo">Gasto operativo</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              {nuevo.destino_origen === "deposito_cuenta" && (
                <div className="fg"><div className="fl">Cuenta destino</div>
                  <select className="sel" value={nuevo.cuenta_destino_id} onChange={e => setNuevo(p => ({ ...p, cuenta_destino_id: e.target.value }))}>
                    <option value="">Seleccionar cuenta...</option>
                    {cuentas.filter(c => c.tipo === "transferencia").map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
          {nuevo.tipo === "ingreso" && (
            <div className="fg"><div className="fl">Origen</div>
              <select className="sel" value={nuevo.destino_origen} onChange={e => setNuevo(p => ({ ...p, destino_origen: e.target.value }))}>
                <option value="">Seleccionar...</option>
                <option value="venta_presencial">Venta presencial</option>
                <option value="deposito_recibido">Deposito recibido</option>
                <option value="otro">Otro</option>
              </select>
            </div>
          )}
          <button className="btn btn-p" style={{ width: "100%" }} onClick={guardar}>Registrar</button>
        </div>
        <div className="card">
          <div className="ct">Movimientos recientes</div>
          {loading ? (
            <div style={{ color: "#65676B", fontSize: 12 }}>Cargando...</div>
          ) : movimientos.length === 0 ? (
            <div style={{ textAlign: "center", color: "#65676B", padding: 20, fontSize: 12 }}>Sin movimientos registrados</div>
          ) : (
            <table>
              <thead><tr><th>Fecha</th><th>Concepto</th><th>Tipo</th><th>Importe</th><th></th></tr></thead>
              <tbody>
                {movimientos.slice(0, 15).map((m, i) => (
                  <tr key={i} style={{ opacity: m.anulado ? 0.4 : 1 }}>
                    <td style={{ fontSize: 10, color: "#65676B" }}>{new Date(m.creado_en).toLocaleDateString("es-AR")}</td>
                    <td>
                      <div style={{ fontSize: 12, textDecoration: m.anulado ? "line-through" : "none" }}>{m.concepto}</div>
                      {m.destino_origen && <div style={{ fontSize: 9, color: "#65676B" }}>{m.destino_origen.replace(/_/g, " ")}</div>}
                      {m.anulado && <div style={{ fontSize: 9, color: "#c0392b" }}>ANULADO: {m.motivo_anulacion}</div>}
                    </td>
                    <td><span className={"badge " + (m.tipo === "ingreso" ? "bg" : "br")}>{m.tipo}</span></td>
                    <td style={{ color: m.tipo === "ingreso" ? "#2d7a4f" : "#c0392b", fontWeight: 600 }}>
                      {m.tipo === "ingreso" ? "+" : "-"}${parseFloat(m.importe).toLocaleString()}
                    </td>
                    <td>{!m.anulado && (usuario?.rol === "jefe" || usuario?.rol === "administrativo") && <button className="btn btn-sm" style={{ color: "#c0392b", fontSize: 9 }} onClick={() => anularMovimiento(m)}>Anular</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function Comprobantes({ localId }) {
  const hoy = new Date();
  const fmtFecha = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const [desde, setDesde] = useState(fmtFecha(primerDiaMes));
  const [hasta, setHasta] = useState(fmtFecha(hoy));
  const [comprobantes, setComprobantes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState(null);

  const cargar = async () => {
    setLoading(true);
    try {
      const anio = parseInt(desde.slice(0, 4));
      const mesD = parseInt(desde.slice(5, 7));
      const mesH = parseInt(hasta.slice(5, 7));
      const anioH = parseInt(hasta.slice(0, 4));
      const meses = [];
      let m = mesD, a = anio;
      while (a < anioH || (a === anioH && m <= mesH)) {
        meses.push({ m, a });
        m++;
        if (m > 12) { m = 1; a++; }
        if (meses.length > 24) break;
      }
      const proms = meses.map(({ m, a }) => API.get("/ventas?mes=" + m + "&anio=" + a + "&local_id=" + (localId || 1)));
      const results = await Promise.all(proms);
      let todas = [];
      results.forEach(r => { todas = todas.concat(r.data || []); });
      const filtradas = todas.filter(v => {
        if (!v.cae || v.es_preventa === true || v.canal === "prueba") return false;
        const f = fmtFecha(new Date(v.creado_en || v.fecha));
        return f >= desde && f <= hasta;
      });
      filtradas.sort((a, b) => new Date(b.creado_en || b.fecha) - new Date(a.creado_en || a.fecha));
      setComprobantes(filtradas);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { cargar(); }, [desde, hasta, localId]);

  const fmtNro = (v) => {
    const pv = v.punto_venta || 5;
    const nro = v.nro_comprobante;
    if (!nro) return v.numero_factura || "-";
    return String(pv).padStart(4, "0") + "-" + String(nro).padStart(8, "0");
  };

  const totalPeriodo = comprobantes.reduce((s, v) => s + parseFloat(v.total || 0), 0);

  return (
    <div className="fade">
      <div className="ph">
        <div><div className="pt">Comprobantes</div><div className="ps">facturas emitidas - ARCA</div></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div><div style={{ fontSize: 9, color: "#65676B" }}>Desde</div><input className="inp" type="date" style={{ width: 140, padding: "6px 8px", fontSize: 12 }} value={desde} onChange={e => setDesde(e.target.value)} /></div>
          <div><div style={{ fontSize: 9, color: "#65676B" }}>Hasta</div><input className="inp" type="date" style={{ width: 140, padding: "6px 8px", fontSize: 12 }} value={hasta} onChange={e => setHasta(e.target.value)} /></div>
        </div>
      </div>
      <div className="g3" style={{ marginBottom: 16 }}>
        <MCard label="Comprobantes" value={String(comprobantes.length)} color="#c9a84c" />
        <MCard label="Total facturado" value={"$" + totalPeriodo.toLocaleString("es-AR", { maximumFractionDigits: 0 })} color="#2d7a4f" />
        <MCard label="Periodo" value={desde.split("-").reverse().join("/") + " al " + hasta.split("-").reverse().join("/")} color="#2C3E5C" />
      </div>
      <div className="card">
        {loading ? (
          <div style={{ textAlign: "center", color: "#65676B", fontSize: 12 }}>Cargando comprobantes...</div>
        ) : comprobantes.length === 0 ? (
          <div style={{ fontSize: 12, color: "#65676B", textAlign: "center", padding: 30 }}>No hay comprobantes emitidos en este periodo</div>
        ) : (
          <table>
            <thead><tr><th>Comprobante</th><th>Fecha</th><th>Cliente</th><th>Tipo</th><th>CAE</th><th>Total</th><th></th></tr></thead>
            <tbody>
              {comprobantes.map((v, i) => (
                <React.Fragment key={i}>
                  <tr>
                    <td style={{ fontSize: 12, fontWeight: 600, color: "#c9a84c" }}>{fmtNro(v)}</td>
                    <td style={{ fontSize: 11, color: "#65676B" }}>{new Date(v.creado_en || v.fecha).toLocaleDateString("es-AR")}</td>
                    <td style={{ fontSize: 12 }}>{v.cliente_nombre || "Consumidor final"}</td>
                    <td style={{ fontSize: 11 }}>{v.tipo_factura || "B"}</td>
                    <td style={{ fontSize: 11, color: "#65676B" }}>{v.cae || "-"}</td>
                    <td style={{ color: "#2d7a4f", fontWeight: 600 }}>${parseFloat(v.total || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 })}</td>
                    <td><span style={{ cursor: "pointer", color: "#2C3E5C", fontSize: 11 }} onClick={() => setExpandido(expandido === i ? null : i)}>{expandido === i ? "Ocultar" : "Ver"}</span></td>
                  </tr>
                  {expandido === i && (
                    <tr>
                      <td colSpan="7" style={{ background: "#F0F2F5", padding: "10px 14px" }}>
                        <div style={{ fontSize: 10, color: "#65676B", letterSpacing: ".1em", marginBottom: 6 }}>DETALLE</div>
                        {(v.items || []).length === 0 ? (
                          <div style={{ fontSize: 11, color: "#65676B" }}>Sin detalle de productos</div>
                        ) : (
                          <table>
                            <thead><tr><th>Producto</th><th>Cant</th><th>Precio</th><th>Subtotal</th></tr></thead>
                            <tbody>
                              {v.items.map((it, j) => (
                                <tr key={j}>
                                  <td style={{ fontSize: 11 }}>{it.nombre}{it.marca ? " - " + it.marca : ""}</td>
                                  <td style={{ fontSize: 11, color: "#65676B" }}>{it.cantidad}</td>
                                  <td style={{ fontSize: 11 }}>${parseFloat(it.precio_unitario || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 })}</td>
                                  <td style={{ fontSize: 11, fontWeight: 600 }}>${(parseFloat(it.precio_unitario || 0) * parseInt(it.cantidad || 0)).toLocaleString("es-AR", { maximumFractionDigits: 0 })}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                        <div style={{ fontSize: 10, color: "#65676B", marginTop: 8 }}>Medio de pago: {v.medio_pago || "-"}{v.cae_vto ? " | CAE vto: " + v.cae_vto : ""}</div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Productividad({ localId }) {
  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargar = async () => {
    setLoading(true);
    try {
      const res = await API.get("/ventas?mes=" + mes + "&anio=" + anio + "&local_id=" + (localId || 1));
      setVentas((res.data || []).filter(v => v.es_preventa !== true));
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { cargar(); }, [mes, anio, localId]);

  const porVend = {};
  ventas.forEach(v => {
    const nombre = v.vendedora_nombre || "Sin asignar";
    if (!porVend[nombre]) porVend[nombre] = { cantidad: 0, total: 0, sumaDuracion: 0, conDuracion: 0, horas: {} };
    const g = porVend[nombre];
    g.cantidad += 1;
    g.total += parseFloat(v.total || 0);
    if (v.duracion_segundos) { g.sumaDuracion += parseInt(v.duracion_segundos); g.conDuracion += 1; }
    const f = new Date(v.creado_en || v.fecha);
    const h = f.getFullYear() + "-" + f.getMonth() + "-" + f.getDate() + "-" + f.getHours();
    g.horas[h] = true;
  });

  const ranking = Object.entries(porVend).map(([nombre, g]) => {
    const ticketProm = g.cantidad > 0 ? g.total / g.cantidad : 0;
    const tiempoProm = g.conDuracion > 0 ? g.sumaDuracion / g.conDuracion : null;
    const cantHoras = Object.keys(g.horas).length;
    const ventasPorHora = cantHoras > 0 ? g.cantidad / cantHoras : 0;
    return { nombre, cantidad: g.cantidad, total: g.total, ticketProm, tiempoProm, ventasPorHora };
  }).sort((a, b) => b.total - a.total);

  const fmtTiempo = (seg) => {
    if (seg === null || seg === undefined) return "-";
    if (seg < 60) return Math.round(seg) + "s";
    const m = Math.floor(seg / 60);
    const s = Math.round(seg % 60);
    return m + "m " + s + "s";
  };

  const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const totalGeneral = ranking.reduce((s, r) => s + r.total, 0);

  return (
    <div className="fade">
      <div className="ph">
        <div><div className="pt">Productividad</div><div className="ps">metricas por vendedora</div></div>
        <div style={{ display: "flex", gap: 8 }}>
          <select className="sel" style={{ width: 120, padding: "6px 10px", fontSize: 12 }} value={mes} onChange={e => setMes(parseInt(e.target.value))}>
            {meses.map((m, i) => (<option key={i} value={i + 1}>{m}</option>))}
          </select>
          <select className="sel" style={{ width: 90, padding: "6px 10px", fontSize: 12 }} value={anio} onChange={e => setAnio(parseInt(e.target.value))}>
            {[hoy.getFullYear(), hoy.getFullYear() - 1].map(a => (<option key={a} value={a}>{a}</option>))}
          </select>
        </div>
      </div>
      {loading ? (
        <div className="card" style={{ textAlign: "center", color: "#65676B", fontSize: 12 }}>Cargando...</div>
      ) : (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "#65676B", letterSpacing: ".1em", marginBottom: 10 }}>RANKING DE VENDEDORAS</div>
            {ranking.length === 0 ? (
              <div style={{ fontSize: 12, color: "#65676B" }}>Sin ventas en este periodo</div>
            ) : (
              <table>
                <thead><tr><th>#</th><th>Vendedora</th><th>Ventas</th><th>Total</th><th>Ticket prom.</th><th>Tiempo prom.</th><th>Ventas/hora</th></tr></thead>
                <tbody>
                  {ranking.map((r, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 700, color: (i === 0 ? "#c9a84c" : "#65676B") }}>{i + 1}</td>
                      <td style={{ fontSize: 12, fontWeight: 600 }}>{r.nombre}</td>
                      <td style={{ fontSize: 12 }}>{r.cantidad}</td>
                      <td style={{ color: "#2d7a4f", fontWeight: 600 }}>${r.total.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</td>
                      <td style={{ fontSize: 12 }}>${r.ticketProm.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</td>
                      <td style={{ fontSize: 12 }}>{fmtTiempo(r.tiempoProm)}</td>
                      <td style={{ fontSize: 12 }}>{r.ventasPorHora.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="g3">
            {ranking.slice(0, 3).map((r, i) => (
              <div key={i} className="card" style={{ borderTop: "3px solid " + (i === 0 ? "#c9a84c" : i === 1 ? "#65676B" : "#cd7f32") }}>
                <div style={{ fontSize: 10, color: "#65676B", letterSpacing: ".1em" }}>{i === 0 ? "TOP VENDEDORA" : "#" + (i + 1)}</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{r.nombre}</div>
                <div style={{ fontSize: 13, color: "#2d7a4f", fontWeight: 600 }}>${r.total.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</div>
                <div style={{ fontSize: 11, color: "#65676B" }}>{r.cantidad} ventas - {totalGeneral > 0 ? Math.round(r.total / totalGeneral * 100) : 0}% del total</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CierreCaja({ localId, usuario }) {
  const hoy = new Date();
  const fmtFecha = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const [fecha, setFecha] = useState(fmtFecha(hoy));
  const [ventasDia, setVentasDia] = useState([]);
  const [movsDia, setMovsDia] = useState([]);
  const [giftCardsDia, setGiftCardsDia] = useState([]);
  const [loading, setLoading] = useState(true);
  const resumenRef = useRef(null);

  const cambiarDia = (dias) => {
    const d = new Date(fecha + "T12:00:00");
    d.setDate(d.getDate() + dias);
    setFecha(fmtFecha(d));
  };

  const esHoy = fecha === fmtFecha(hoy);

  const cargar = async () => {
    setLoading(true);
    try {
      const anio = parseInt(fecha.slice(0, 4));
      const mes = parseInt(fecha.slice(5, 7));
      const [ventasRes, movRes, gcRes] = await Promise.all([
        API.get("/ventas?mes=" + mes + "&anio=" + anio + "&local_id=" + (localId || 1)),
        API.get("/caja?local_id=" + (localId || 1)),
        API.get("/gift-cards?local_id=" + (localId || 1))
      ]);
      const esMismoDia = (f) => { if (!f) return false; return fmtFecha(new Date(f)) === fecha; };
      setVentasDia((ventasRes.data || []).filter(v => esMismoDia(v.creado_en || v.fecha) && v.es_preventa !== true && v.canal !== "prueba"));
      setMovsDia((movRes.data || []).filter(m => esMismoDia(m.creado_en || m.fecha)));
      setGiftCardsDia((gcRes.data || []).filter(g => esMismoDia(g.creado_en)));
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { cargar(); }, [fecha, localId]);

  const porMedio = {};
  ventasDia.forEach(v => {
    const m = v.medio_pago || "Efectivo";
    if (!porMedio[m]) porMedio[m] = { cantidad: 0, total: 0 };
    porMedio[m].cantidad += 1;
    porMedio[m].total += parseFloat(v.total || 0) - parseFloat(v.monto_gift_card || 0);
  });
  const mediosOrdenados = Object.entries(porMedio).sort((a, b) => b[1].total - a[1].total);
  const totalVentasNeto = ventasDia.reduce((s, v) => s + parseFloat(v.total || 0) - parseFloat(v.monto_gift_card || 0), 0);
  const totalGiftCards = giftCardsDia.reduce((s, g) => s + parseFloat(g.monto_inicial || 0), 0);
  const totalDia = totalVentasNeto + totalGiftCards;
  const ventasEfectivo = ventasDia.filter(v => (v.medio_pago || "Efectivo").toLowerCase().includes("efectivo")).reduce((s, v) => s + parseFloat(v.total || 0) - parseFloat(v.monto_gift_card || 0), 0);
  const ingresosManuales = movsDia.filter(m => m.tipo === "ingreso").reduce((s, m) => s + parseFloat(m.importe || 0), 0);
  const egresosDia = movsDia.filter(m => m.tipo === "egreso").reduce((s, m) => s + parseFloat(m.importe || 0), 0);
  const efectivoEsperado = ventasEfectivo + ingresosManuales - egresosDia;

  const descargarImagen = async () => {
    if (!resumenRef.current) return;
    try {
      const { default: html2canvas } = await import("https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.esm.js");
      const canvas = await html2canvas(resumenRef.current, { backgroundColor: "#ffffff", scale: 2 });
      const link = document.createElement("a");
      link.download = "cierre-" + fecha + ".png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) {
      alert("Error al generar imagen: " + e.message);
    }
  };

  const fmtDia = (f) => {
    const [y, m, d] = f.split("-");
    return d + "/" + m + "/" + y;
  };

  return (
    <div className="fade">
      <div className="ph">
        <div><div className="pt">Cierre de Caja</div><div className="ps">resumen del dia por medio de pago</div></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn btn-g btn-sm" onClick={() => cambiarDia(-1)}>← Anterior</button>
          <input className="inp" type="date" style={{ width: 150, padding: "6px 10px", fontSize: 12 }} value={fecha} onChange={e => setFecha(e.target.value)} />
          <button className="btn btn-g btn-sm" onClick={() => cambiarDia(1)} disabled={esHoy} style={{ opacity: esHoy ? 0.4 : 1 }}>Siguiente →</button>
          {esHoy && <span style={{ fontSize: 11, color: "#2d7a4f", fontWeight: 600 }}>HOY</span>}
          <button className="btn btn-p btn-sm" onClick={descargarImagen}>📲 Descargar</button>
        </div>
      </div>

      {!esHoy && (
        <div style={{ background: "#2471a312", border: "1px solid #2471a3", borderRadius: 6, padding: "8px 14px", marginBottom: 12, fontSize: 11, color: "#2471a3", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Viendo cierre del {fmtDia(fecha)}</span>
          <span style={{ cursor: "pointer", fontWeight: 600 }} onClick={() => setFecha(fmtFecha(hoy))}>Ver hoy</span>
        </div>
      )}

      <div ref={resumenRef} style={{ background: "#ffffff", padding: 4, borderRadius: 8 }}>
        <div style={{ padding: "10px 0 16px", borderBottom: "1px solid #f0f0f0", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#111111" }}>LUMIERE — Cierre de Caja</div>
            <div style={{ fontSize: 11, color: "#65676B" }}>{fmtDia(fecha)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#65676B" }}>TOTAL DEL DIA</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#2d7a4f" }}>${totalDia.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</div>
            <div style={{ fontSize: 10, color: "#65676B" }}>{ventasDia.length} ventas{totalGiftCards > 0 ? " + $" + totalGiftCards.toLocaleString("es-AR", { maximumFractionDigits: 0 }) + " gift cards" : ""}</div>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", color: "#65676B", padding: 30 }}>Cargando...</div>
        ) : (
          <div className="g2">
            <div className="card">
              <div style={{ fontSize: 11, color: "#65676B", letterSpacing: ".1em", marginBottom: 10 }}>VENTAS POR MEDIO DE PAGO</div>
              {mediosOrdenados.length === 0 && totalGiftCards === 0 ? (
                <div style={{ fontSize: 12, color: "#65676B", textAlign: "center", padding: 20 }}>Sin ventas en esta fecha</div>
              ) : (
                <table>
                  <thead><tr><th>Medio</th><th>Cant</th><th>Total</th></tr></thead>
                  <tbody>
                    {mediosOrdenados.map(([medio, d], i) => (
                      <tr key={i}>
                        <td style={{ fontSize: 12 }}>{medio}</td>
                        <td style={{ fontSize: 12, color: "#65676B" }}>{d.cantidad}</td>
                        <td style={{ color: "#2d7a4f", fontWeight: 600 }}>${d.total.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</td>
                      </tr>
                    ))}
                    {totalGiftCards > 0 && (
                      <tr>
                        <td style={{ fontSize: 12, color: "#c9a84c" }}>Gift Cards emitidas</td>
                        <td style={{ fontSize: 12, color: "#65676B" }}>{giftCardsDia.length}</td>
                        <td style={{ color: "#c9a84c", fontWeight: 600 }}>${totalGiftCards.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</td>
                      </tr>
                    )}
                    <tr style={{ borderTop: "2px solid #eeeeee" }}>
                      <td style={{ fontWeight: 700 }}>TOTAL</td>
                      <td style={{ fontWeight: 700, color: "#65676B" }}>{ventasDia.length}</td>
                      <td style={{ fontWeight: 700, color: "#2d7a4f" }}>${totalDia.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
            <div>
              <div className="card" style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: "#65676B", letterSpacing: ".1em", marginBottom: 10 }}>EFECTIVO EN CAJA</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: efectivoEsperado < 0 ? "#c0392b" : "#111111" }}>${efectivoEsperado.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</div>
                <div style={{ fontSize: 10, color: "#65676B", marginTop: 4 }}>ventas ${ventasEfectivo.toLocaleString("es-AR", { maximumFractionDigits: 0 })} + ingresos ${ingresosManuales.toLocaleString("es-AR", { maximumFractionDigits: 0 })} - egresos ${egresosDia.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</div>
              </div>
              {movsDia.length > 0 && (
                <div className="card">
                  <div style={{ fontSize: 11, color: "#65676B", letterSpacing: ".1em", marginBottom: 10 }}>MOVIMIENTOS DE CAJA</div>
                  <table>
                    <thead><tr><th>Tipo</th><th>Concepto</th><th>Importe</th></tr></thead>
                    <tbody>
                      {movsDia.map((m, i) => (
                        <tr key={i}>
                          <td><span className="badge" style={{ background: m.tipo === "ingreso" ? "#2d7a4f15" : "#c0392b15", color: m.tipo === "ingreso" ? "#2d7a4f" : "#c0392b" }}>{m.tipo}</span></td>
                          <td style={{ fontSize: 11 }}>{m.concepto || "-"}</td>
                          <td style={{ fontWeight: 600, color: m.tipo === "ingreso" ? "#2d7a4f" : "#c0392b" }}>{m.tipo === "ingreso" ? "+" : "-"}${parseFloat(m.importe || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {!loading && ventasDia.length > 0 && (usuario?.rol === "jefe" || usuario?.rol === "administrativo") && (
        <div className="card" style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, color: "#65676B", letterSpacing: ".1em", marginBottom: 10 }}>HISTORIAL DE VENTAS DEL DIA</div>
          <table>
            <thead><tr><th>Factura</th><th>Cliente</th><th>Total</th><th>Medio</th><th></th></tr></thead>
            <tbody>
              {ventasDia.map((v, i) => (
                <tr key={i} style={{ opacity: v.anulada ? 0.4 : 1 }}>
                  <td style={{ fontSize: 11, fontFamily: "monospace", textDecoration: v.anulada ? "line-through" : "none" }}>{v.numero_factura}</td>
                  <td style={{ fontSize: 12 }}>{v.cliente_nombre || "Consumidor final"}{v.anulada && <div style={{ fontSize: 9, color: "#c0392b" }}>ANULADA: {v.motivo_anulacion}</div>}</td>
                  <td style={{ fontWeight: 600 }}>${parseFloat(v.total).toLocaleString("es-AR")}</td>
                  <td style={{ fontSize: 11, color: "#65676B" }}>{v.medio_pago}</td>
                  <td>{!v.anulada && <button className="btn btn-sm" style={{ color: "#c0392b", fontSize: 9 }} onClick={async () => {
                    const motivo = prompt("Motivo de la anulacion (obligatorio):");
                    if (!motivo || !motivo.trim()) return;
                    try {
                      await API.post("/anulaciones/venta/" + v.id, { motivo, usuario_id: usuario?.id, usuario_nombre: usuario?.nombre, usuario_rol: usuario?.rol });
                      cargar();
                      alert("Venta anulada correctamente");
                    } catch (e) { alert(e.response?.data?.error || "Error al anular"); }
                  }}>Anular</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ControlInventario({ localId, usuario }) {
  const [vista, setVista] = useState("lista");
  const [controles, setControles] = useState([]);
  const [config, setConfig] = useState(null);
  const [showNuevo, setShowNuevo] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [tipoNuevo, setTipoNuevo] = useState("total");
  const [categoriaNuevo, setCategoriaNuevo] = useState("");
  const [categorias, setCategorias] = useState([]);
  const [controlActivo, setControlActivo] = useState(null);
  const [items, setItems] = useState([]);
  const [filtroItems, setFiltroItems] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [showFinalizar, setShowFinalizar] = useState(false);
  const [ajustarStock, setAjustarStock] = useState(true);
  const [notasFin, setNotasFin] = useState("");
  const [resultadoFinal, setResultadoFinal] = useState(null);

  const cargar = async () => {
    try {
      const [c, cfg, prods] = await Promise.all([
        API.get("/controles-inventario?local_id=" + (localId || 1)),
        API.get("/controles-inventario/config?local_id=" + (localId || 1)),
        API.get("/productos")
      ]);
      setControles(c.data || []);
      setConfig(cfg.data);
      const cats = [...new Set((prods.data || []).map(p => p.categoria).filter(Boolean))];
      setCategorias(cats);
    } catch (e) {}
  };

  useEffect(() => { cargar(); }, [localId]);

  const abrirControl = async (ctrl) => {
    try {
      const res = await API.get("/controles-inventario/" + ctrl.id);
      setControlActivo(res.data);
      setItems(res.data.items || []);
      setVista("conteo");
    } catch (e) {}
  };

  const crearNuevo = async () => {
    if (tipoNuevo === "categoria" && !categoriaNuevo) return setMensaje("Elegi una categoria");
    try {
      const res = await API.post("/controles-inventario", {
        tipo: tipoNuevo, categoria: tipoNuevo === "categoria" ? categoriaNuevo : null,
        local_id: localId || 1, usuario_id: usuario?.id, usuario_nombre: usuario?.nombre
      });
      setShowNuevo(false); setCategoriaNuevo(""); setTipoNuevo("total");
      abrirControl(res.data);
    } catch (e) { setMensaje("Error al crear control"); }
  };

  const contarItem = async (item, valor) => {
    if (valor === "" || isNaN(parseInt(valor))) return;
    try {
      const res = await API.put("/controles-inventario/" + controlActivo.id + "/contar/" + item.id, { stock_contado: parseInt(valor) });
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, ...res.data } : i));
    } catch (e) {}
  };

  const finalizarControl = async () => {
    try {
      const res = await API.post("/controles-inventario/" + controlActivo.id + "/finalizar", {
        ajustar_stock: ajustarStock, usuario_id: usuario?.id, usuario_nombre: usuario?.nombre, notas: notasFin
      });
      setResultadoFinal(res.data);
      setShowFinalizar(false);
      cargar();
    } catch (e) { setMensaje("Error al finalizar"); }
  };

  const guardarConfig = async () => {
    try {
      await API.put("/controles-inventario/config", { local_id: localId || 1, dias_aviso: config.dias_aviso, avisos_activos: config.avisos_activos });
      setShowConfig(false);
      setMensaje("Configuracion guardada");
      setTimeout(() => setMensaje(""), 2500);
    } catch (e) { setMensaje("Error al guardar"); }
  };

  const cancelarControl = async (ctrl) => {
    if (!confirm("Cancelar este control en curso?")) return;
    await API.delete("/controles-inventario/" + ctrl.id);
    cargar();
  };

  const itemsFiltrados = items
    .filter(i => filtroItems === "todos" || (filtroItems === "pendientes" && i.estado === "pendiente") || (filtroItems === "faltantes" && i.estado === "faltante") || (filtroItems === "sobrantes" && i.estado === "sobrante") || (filtroItems === "correctos" && i.estado === "correcto"))
    .filter(i => !busqueda || (i.producto_nombre || "").toLowerCase().includes(busqueda.toLowerCase()) || (i.producto_marca || "").toLowerCase().includes(busqueda.toLowerCase()));

  const totalContados = items.filter(i => i.estado !== "pendiente").length;
  const totalCorrectos = items.filter(i => i.estado === "correcto").length;
  const totalFaltantes = items.filter(i => i.estado === "faltante").length;
  const totalSobrantes = items.filter(i => i.estado === "sobrante").length;
  const progreso = items.length > 0 ? Math.round((totalContados / items.length) * 100) : 0;

  if (vista === "conteo" && controlActivo) {
    if (resultadoFinal) {
      return (
        <div className="fade">
          <div className="ph"><div><div className="pt">Control finalizado</div><div className="ps">{controlActivo.tipo === "total" ? "Conteo total" : "Categoria: " + controlActivo.categoria}</div></div></div>
          <div className="g4" style={{ marginBottom: 16 }}>
            <MCard label="Items contados" value={String(resultadoFinal.correctos + resultadoFinal.faltantes + resultadoFinal.sobrantes)} color="#2C3E5C" />
            <MCard label="Correctos" value={String(resultadoFinal.correctos)} color="#2d7a4f" />
            <MCard label="Faltantes" value={String(resultadoFinal.faltantes)} color="#c0392b" />
            <MCard label="Sobrantes" value={String(resultadoFinal.sobrantes)} color="#c9a84c" />
          </div>
          {resultadoFinal.ajustado && <div style={{ background: "#2d7a4f12", border: "1px solid #2d7a4f", borderRadius: 6, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: "#2d7a4f" }}>El stock se ajusto automaticamente con el motivo "Control de inventario #{controlActivo.id}"</div>}
          <button className="btn btn-p" onClick={() => { setVista("lista"); setControlActivo(null); setItems([]); setResultadoFinal(null); }}>Volver al listado</button>
        </div>
      );
    }
    return (
      <div className="fade">
        <div className="ph">
          <div><div className="pt">Conteo de inventario #{controlActivo.id}</div><div className="ps">{controlActivo.tipo === "total" ? "Conteo total" : "Categoria: " + controlActivo.categoria}</div></div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-g btn-sm" onClick={() => { setVista("lista"); setControlActivo(null); }}>Guardar y salir</button>
            <button className="btn btn-p btn-sm" onClick={() => setShowFinalizar(true)} disabled={totalContados === 0}>Finalizar conteo</button>
          </div>
        </div>
        <div className="g4" style={{ marginBottom: 16 }}>
          <MCard label="Progreso" value={progreso + "%"} sub={totalContados + " / " + items.length} color="#2C3E5C" />
          <MCard label="Correctos" value={String(totalCorrectos)} color="#2d7a4f" />
          <MCard label="Faltantes" value={String(totalFaltantes)} color="#c0392b" />
          <MCard label="Sobrantes" value={String(totalSobrantes)} color="#c9a84c" />
        </div>
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input className="inp" placeholder="Buscar producto..." value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ flex: 1 }} />
            <select className="sel" value={filtroItems} onChange={e => setFiltroItems(e.target.value)} style={{ width: 160 }}>
              <option value="todos">Todos</option>
              <option value="pendientes">Pendientes</option>
              <option value="correctos">Correctos</option>
              <option value="faltantes">Faltantes</option>
              <option value="sobrantes">Sobrantes</option>
            </select>
          </div>
        </div>
        <div className="card">
          <table>
            <thead><tr><th>Producto</th><th>Stock sistema</th><th>Stock contado</th><th>Diferencia</th><th>Estado</th></tr></thead>
            <tbody>
              {itemsFiltrados.map(it => (
                <tr key={it.id} style={{ background: it.estado === "faltante" ? "#c0392b08" : it.estado === "sobrante" ? "#c9a84c08" : it.estado === "correcto" ? "#2d7a4f08" : "transparent" }}>
                  <td>
                    <div style={{ fontSize: 12 }}>{it.producto_nombre}</div>
                    <div style={{ fontSize: 10, color: "#65676B" }}>{it.producto_marca} - {it.producto_categoria}</div>
                  </td>
                  <td style={{ fontWeight: 600 }}>{it.stock_sistema}</td>
                  <td>
                    <input type="number" className="inp" defaultValue={it.stock_contado ?? ""} style={{ width: 80, padding: "6px 10px", fontSize: 12 }}
                      onBlur={e => contarItem(it, e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }} />
                  </td>
                  <td style={{ fontWeight: 700, color: !it.diferencia ? "#65676B" : it.diferencia < 0 ? "#c0392b" : "#c9a84c" }}>{it.diferencia !== null && it.diferencia !== undefined ? (it.diferencia > 0 ? "+" : "") + it.diferencia : "-"}</td>
                  <td><span className={"badge " + (it.estado === "correcto" ? "bg" : it.estado === "faltante" ? "br" : it.estado === "sobrante" ? "ba" : "bx")}>{it.estado}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {showFinalizar && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
            <div className="card" style={{ width: 420, background: "#ffffff" }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Finalizar conteo</div>
              <div style={{ fontSize: 12, color: "#65676B", marginBottom: 14 }}>{totalContados} items contados - {totalCorrectos} correctos, {totalFaltantes} faltantes, {totalSobrantes} sobrantes</div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginBottom: 12, cursor: "pointer" }}>
                <input type="checkbox" checked={ajustarStock} onChange={e => setAjustarStock(e.target.checked)} />
                Ajustar stock automaticamente segun el conteo
              </label>
              <div className="fg"><div className="fl">Notas (opcional)</div><input className="inp" value={notasFin} onChange={e => setNotasFin(e.target.value)} /></div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-g" style={{ flex: 1 }} onClick={() => setShowFinalizar(false)}>Cancelar</button>
                <button className="btn btn-p" style={{ flex: 1 }} onClick={finalizarControl}>Finalizar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const enCurso = controles.find(c => c.estado === "en_curso");

  return (
    <div className="fade">
      <div className="ph">
        <div><div className="pt">Control de Inventario</div><div className="ps">conteo fisico vs stock del sistema</div></div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-g btn-sm" onClick={() => setShowConfig(true)}>⚙ Config</button>
          <button className="btn btn-p btn-sm" onClick={() => setShowNuevo(true)}>+ Nuevo control</button>
        </div>
      </div>
      {mensaje && <div style={{ background: mensaje.includes("Error") ? "#c0392b12" : "#2d7a4f12", border: "1px solid " + (mensaje.includes("Error") ? "#c0392b" : "#2d7a4f"), borderRadius: 6, padding: "10px 16px", marginBottom: 14, fontSize: 12, color: mensaje.includes("Error") ? "#c0392b" : "#2d7a4f" }}>{mensaje}</div>}
      {enCurso && (
        <div className="card" style={{ background: "#c9a84c08", border: "1px solid #c9a84c44", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#c9a84c" }}>Hay un control en curso (#{enCurso.id})</div>
            <div style={{ fontSize: 11, color: "#65676B" }}>{enCurso.tipo === "total" ? "Conteo total" : "Categoria: " + enCurso.categoria} - {new Date(enCurso.creado_en).toLocaleDateString("es-AR")}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-sm" style={{ color: "#c0392b" }} onClick={() => cancelarControl(enCurso)}>Cancelar</button>
            <button className="btn btn-p btn-sm" onClick={() => abrirControl(enCurso)}>Continuar</button>
          </div>
        </div>
      )}
      <div className="card">
        <div style={{ fontSize: 11, color: "#65676B", letterSpacing: ".1em", marginBottom: 10 }}>HISTORIAL DE CONTROLES</div>
        {controles.filter(c => c.estado === "finalizado").length === 0 ? (
          <div style={{ textAlign: "center", color: "#65676B", padding: 20, fontSize: 12 }}>Aun no se realizo ningun control finalizado</div>
        ) : (
          <table>
            <thead><tr><th>Fecha</th><th>Tipo</th><th>Items</th><th>Correctos</th><th>Faltantes</th><th>Sobrantes</th><th>Stock ajustado</th></tr></thead>
            <tbody>
              {controles.filter(c => c.estado === "finalizado").map(c => (
                <tr key={c.id}>
                  <td style={{ fontSize: 11 }}>{new Date(c.finalizado_en).toLocaleDateString("es-AR")}</td>
                  <td style={{ fontSize: 12 }}>{c.tipo === "total" ? "Total" : c.categoria}</td>
                  <td>{c.total_items}</td>
                  <td><span className="badge bg">{c.items_correctos}</span></td>
                  <td><span className="badge br">{c.items_faltantes}</span></td>
                  <td><span className="badge ba">{c.items_sobrantes}</span></td>
                  <td>{c.ajustar_stock ? <span className="badge bg">si</span> : <span className="badge bx">no</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {showNuevo && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="card" style={{ width: 400, background: "#ffffff" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Nuevo control de inventario</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button className="btn btn-sm" style={{ flex: 1, background: tipoNuevo === "total" ? "#2C3E5C15" : "transparent", border: "1px solid " + (tipoNuevo === "total" ? "#2C3E5C" : "#E4E6EB"), color: tipoNuevo === "total" ? "#2C3E5C" : "#65676B" }} onClick={() => setTipoNuevo("total")}>Conteo total</button>
              <button className="btn btn-sm" style={{ flex: 1, background: tipoNuevo === "categoria" ? "#2C3E5C15" : "transparent", border: "1px solid " + (tipoNuevo === "categoria" ? "#2C3E5C" : "#E4E6EB"), color: tipoNuevo === "categoria" ? "#2C3E5C" : "#65676B" }} onClick={() => setTipoNuevo("categoria")}>Por categoria</button>
            </div>
            {tipoNuevo === "categoria" && (
              <div className="fg"><div className="fl">Categoria</div>
                <select className="sel" value={categoriaNuevo} onChange={e => setCategoriaNuevo(e.target.value)}>
                  <option value="">Elegi una categoria</option>
                  {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="btn btn-g" style={{ flex: 1 }} onClick={() => setShowNuevo(false)}>Cancelar</button>
              <button className="btn btn-p" style={{ flex: 1 }} onClick={crearNuevo}>Crear y comenzar</button>
            </div>
          </div>
        </div>
      )}
      {showConfig && config && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="card" style={{ width: 400, background: "#ffffff" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Configuracion de avisos</div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginBottom: 14, cursor: "pointer" }}>
              <input type="checkbox" checked={config.avisos_activos} onChange={e => setConfig({ ...config, avisos_activos: e.target.checked })} />
              Mostrar aviso cuando pase mucho tiempo sin control
            </label>
            <div className="fg"><div className="fl">Cada cuantos dias avisar (default: 30)</div>
              <input className="inp" type="number" value={config.dias_aviso} onChange={e => setConfig({ ...config, dias_aviso: parseInt(e.target.value) || 30 })} />
            </div>
            <div style={{ fontSize: 10, color: "#65676B", marginBottom: 12 }}>{config.ultimo_control ? "Ultimo control: " + new Date(config.ultimo_control).toLocaleDateString("es-AR") : "Nunca se realizo un control"}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-g" style={{ flex: 1 }} onClick={() => setShowConfig(false)}>Cancelar</button>
              <button className="btn btn-p" style={{ flex: 1 }} onClick={guardarConfig}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OrdenesIngreso({ localId, usuario }) {
  const localActual = localId === 2 ? "ush" : "rg";
  const localNombre = localId === 2 ? "Ushuaia" : "Rio Grande";
  const [ordenes, setOrdenes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("lista");
  const [ordenDetalle, setOrdenDetalle] = useState(null);
  const [itemsDetalle, setItemsDetalle] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [nueva, setNueva] = useState({ proveedor_id: "", numero_factura: "", total: "", notas: "", items: [] });
  const [itemTemp, setItemTemp] = useState({ producto_id: "", cantidad_rg: "", cantidad_ush: "", costo_unitario: "" });
  const [conteo, setConteo] = useState({});
  const [recibidoHist, setRecibidoHist] = useState([]);
  const [notaItem, setNotaItem] = useState({});
  const [extra, setExtra] = useState({ producto_id: "", cantidad: "", costo_unitario: "" });

  const cargar = async () => {
    setLoading(true);
    try {
      const [ordRes, prodRes, provRes] = await Promise.all([
        API.get("/ordenes-ingreso"),
        API.get("/productos"),
        API.get("/proveedores")
      ]);
      setOrdenes(ordRes.data || []);
      setProductos(prodRes.data || []);
      setProveedores(provRes.data || []);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const cargarRecibido = async () => {
    try {
      const res = await API.get("/ordenes-ingreso/reporte/recibido");
      setRecibidoHist(res.data || []);
    } catch (e) {}
  };

  const agregarItem = () => {
    if (!itemTemp.producto_id) return setMensaje("Elegi un producto");
    const prod = productos.find(p => p.id === parseInt(itemTemp.producto_id));
    if (!prod) return;
    const cantRg = parseInt(itemTemp.cantidad_rg) || 0;
    const cantUsh = parseInt(itemTemp.cantidad_ush) || 0;
    if (cantRg + cantUsh === 0) return setMensaje("Ingresa cantidad para algun local");
    setNueva(p => ({
      ...p,
      items: [...p.items, {
        producto_id: prod.id, producto_nombre: prod.nombre,
        cantidad_rg: cantRg, cantidad_ush: cantUsh,
        cantidad_total: cantRg + cantUsh,
        costo_unitario: parseFloat(itemTemp.costo_unitario) || parseFloat(prod.costo) || 0
      }]
    }));
    setItemTemp({ producto_id: "", cantidad_rg: "", cantidad_ush: "", costo_unitario: "" });
    setMensaje("");
  };

  const quitarItemNueva = (idx) => {
    setNueva(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));
  };

  const crearOrden = async () => {
    if (!nueva.proveedor_id) return setMensaje("Elegi un proveedor");
    if (nueva.items.length === 0) return setMensaje("Agrega al menos un producto");
    try {
      const total = nueva.items.reduce((s, it) => s + it.costo_unitario * it.cantidad_total, 0);
      await API.post("/ordenes-ingreso", { ...nueva, total: nueva.total || total });
      setMensaje("Orden creada! Stock en transito cargado.");
      setNueva({ proveedor_id: "", numero_factura: "", total: "", notas: "", items: [] });
      cargar();
      setTab("lista");
    } catch (e) { setMensaje("Error al crear orden: " + (e.response?.data?.error || e.message)); }
  };

  const verDetalle = async (orden) => {
    setOrdenDetalle(orden);
    try {
      const res = await API.get("/ordenes-ingreso/" + orden.id + "/items");
      setItemsDetalle(res.data || []);
      const c = {};
      (res.data || []).forEach(it => {
        c[it.id] = localActual === "rg" ? (it.recibido_rg || it.cantidad_rg) : (it.recibido_ush || it.cantidad_ush);
      });
      setConteo(c);
    } catch (e) {}
    setTab("recibir");
  };

  const confirmarItem = async (item) => {
    const cant = parseInt(conteo[item.id]);
    if (isNaN(cant) || cant < 0) return setMensaje("Cantidad invalida");
    try {
      await API.put("/ordenes-ingreso/" + ordenDetalle.id + "/items/" + item.id + "/recibir", {
        local: localActual, cantidad: cant, nota: notaItem[item.id] || null, usuario_nombre: usuario?.nombre || null
      });
      setMensaje("Item confirmado: " + item.producto_nombre);
      const res = await API.get("/ordenes-ingreso/" + ordenDetalle.id + "/items");
      setItemsDetalle(res.data || []);
      setTimeout(() => setMensaje(""), 2500);
    } catch (e) { setMensaje("Error al confirmar: " + (e.response?.data?.error || e.message)); }
  };

  const agregarExtra = async () => {
    if (!extra.producto_id || !extra.cantidad) return setMensaje("Completa producto y cantidad del extra");
    const prod = productos.find(p => p.id === parseInt(extra.producto_id));
    try {
      await API.post("/ordenes-ingreso/" + ordenDetalle.id + "/item-extra", {
        producto_id: prod.id, producto_nombre: prod.nombre,
        cantidad: parseInt(extra.cantidad), local: localActual,
        costo_unitario: parseFloat(extra.costo_unitario) || 0
      });
      setMensaje("Item extra agregado!");
      setExtra({ producto_id: "", cantidad: "", costo_unitario: "" });
      const res = await API.get("/ordenes-ingreso/" + ordenDetalle.id + "/items");
      setItemsDetalle(res.data || []);
    } catch (e) { setMensaje("Error al agregar extra: " + (e.response?.data?.error || e.message)); }
  };

  const esperadoLocal = (it) => localActual === "rg" ? it.cantidad_rg : it.cantidad_ush;
  const recibidoLocal = (it) => localActual === "rg" ? it.recibido_rg : it.recibido_ush;
  const revisadoLocal = (it) => localActual === "rg" ? it.revisado_rg : it.revisado_ush;

  return (
    <div className="fade">
      <div className="ph">
        <div><div className="pt">Ingreso de Mercaderia</div><div className="ps">recepcion en {localNombre}</div></div>
        <div style={{ display: "flex", gap: 8 }}>
          {tab !== "lista" && tab !== "recibido" && <button className="btn btn-sm" onClick={() => { setTab("lista"); setOrdenDetalle(null); }}>Volver</button>}
          {usuario?.rol === "jefe" && (tab === "lista" || tab === "recibido") && <button className="btn btn-p btn-sm" onClick={() => setTab("nueva")}>+ Nueva orden</button>}
        </div>
      </div>

      {mensaje && (
        <div style={{ background: mensaje.includes("Error") ? "#c0392b12" : "#2d7a4f12", border: "1px solid " + (mensaje.includes("Error") ? "#c0392b" : "#2d7a4f"), borderRadius: 6, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: mensaje.includes("Error") ? "#c0392b" : "#2d7a4f" }}>{mensaje}</div>
      )}

      {(tab === "lista" || tab === "recibido") && (
        <div className="tabs">
          <div className={"tab " + (tab === "lista" ? "on" : "")} onClick={() => setTab("lista")}>POR RECIBIR</div>
          <div className={"tab " + (tab === "recibido" ? "on" : "")} onClick={() => { setTab("recibido"); cargarRecibido(); }}>STOCK RECIBIDO</div>
        </div>
      )}

      {tab === "lista" && (
        <div className="card">
          {loading ? (<div style={{ textAlign: "center", color: "#65676B", fontSize: 12 }}>Cargando...</div>) : ordenes.filter(o => o.estado !== "recibida" && o.estado !== "pagada").length === 0 ? (
            <div style={{ fontSize: 12, color: "#65676B", textAlign: "center", padding: 30 }}>No hay ordenes pendientes de recibir</div>
          ) : (
            <table>
              <thead><tr><th>Factura</th><th>Proveedor</th><th>Fecha</th><th>Estado</th><th>Total</th><th></th></tr></thead>
              <tbody>
                {ordenes.filter(o => o.estado !== "recibida" && o.estado !== "pagada").map((o, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: 12, fontWeight: 600 }}>{o.numero_factura || "-"}</td>
                    <td style={{ fontSize: 12 }}>{o.proveedor_nombre || "-"}</td>
                    <td style={{ fontSize: 11, color: "#65676B" }}>{o.fecha_factura ? new Date(o.fecha_factura).toLocaleDateString("es-AR") : "-"}</td>
                    <td><span className="badge" style={{ background: "#c9a84c15", color: "#c9a84c" }}>{o.estado}</span></td>
                    <td style={{ fontSize: 12, color: "#2d7a4f", fontWeight: 600 }}>${parseFloat(o.total || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 })}</td>
                    <td><button className="btn btn-sm" style={{ background: "#2d7a4f", color: "white" }} onClick={() => verDetalle(o)}>Recibir</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "recibido" && (
        <div className="card">
          {recibidoHist.length === 0 ? (
            <div style={{ fontSize: 12, color: "#65676B", textAlign: "center", padding: 30 }}>Todavia no hay stock recibido registrado</div>
          ) : (
            <table>
              <thead><tr><th>Producto</th><th>Factura</th><th>Proveedor</th><th>Local</th><th>Cantidad</th><th>Fecha</th><th>Recibido por</th></tr></thead>
              <tbody>
                {recibidoHist.map((r, i) => {
                  const filas = [];
                  if (r.revisado_rg) filas.push({ local: "RG", cant: r.recibido_rg, fecha: r.fecha_recepcion_rg, por: r.recibido_por_rg });
                  if (r.revisado_ush) filas.push({ local: "USH", cant: r.recibido_ush, fecha: r.fecha_recepcion_ush, por: r.recibido_por_ush });
                  return filas.map((f, j) => (
                    <tr key={i + "-" + j}>
                      <td style={{ fontSize: 12 }}>{r.producto_nombre}{r.es_extra ? <span className="badge" style={{ background: "#c9a84c15", color: "#c9a84c", marginLeft: 6 }}>extra</span> : ""}</td>
                      <td style={{ fontSize: 11, color: "#65676B" }}>{r.numero_factura || "-"}</td>
                      <td style={{ fontSize: 11 }}>{r.proveedor_nombre || "-"}</td>
                      <td style={{ fontSize: 11 }}>{f.local}</td>
                      <td style={{ fontSize: 12, color: "#2d7a4f", fontWeight: 600 }}>{f.cant}u</td>
                      <td style={{ fontSize: 11, color: "#65676B" }}>{f.fecha ? new Date(f.fecha).toLocaleDateString("es-AR") + " " + new Date(f.fecha).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : "-"}</td>
                      <td style={{ fontSize: 11 }}>{f.por || "-"}</td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "nueva" && (
        <div className="g2">
          <div className="card">
            <div style={{ fontSize: 11, color: "#65676B", letterSpacing: ".1em", marginBottom: 14 }}>DATOS DE LA ORDEN</div>
            <div className="fg"><div className="fl">Proveedor</div>
              <select className="sel" value={nueva.proveedor_id} onChange={e => setNueva(p => ({ ...p, proveedor_id: e.target.value }))}>
                <option value="">Seleccionar proveedor...</option>
                {proveedores.map(pr => (<option key={pr.id} value={pr.id}>{pr.nombre}</option>))}
              </select>
            </div>
            <div className="fg"><div className="fl">Numero de factura</div><input className="inp" value={nueva.numero_factura} onChange={e => setNueva(p => ({ ...p, numero_factura: e.target.value }))} /></div>
            <div className="fg"><div className="fl">Total factura ($)</div><input className="inp" type="number" value={nueva.total} onChange={e => setNueva(p => ({ ...p, total: e.target.value }))} /></div>
            <div className="fg"><div className="fl">Notas</div><textarea className="inp" rows={2} placeholder="Observaciones..." value={nueva.notas} onChange={e => setNueva(p => ({ ...p, notas: e.target.value }))} /></div>
            <div style={{ fontSize: 11, color: "#65676B", letterSpacing: ".1em", margin: "16px 0 10px" }}>AGREGAR PRODUCTO (dividi por local)</div>
            <div className="fg"><div className="fl">Producto</div>
              <select className="sel" value={itemTemp.producto_id} onChange={e => setItemTemp(p => ({ ...p, producto_id: e.target.value }))}>
                <option value="">Seleccionar...</option>
                {productos.map(pr => (<option key={pr.id} value={pr.id}>{pr.nombre}</option>))}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div className="fg" style={{ flex: 1 }}><div className="fl">Cant. Rio Grande</div><input className="inp" type="number" placeholder="10" value={itemTemp.cantidad_rg} onChange={e => setItemTemp(p => ({ ...p, cantidad_rg: e.target.value }))} /></div>
              <div className="fg" style={{ flex: 1 }}><div className="fl">Cant. Ushuaia</div><input className="inp" type="number" placeholder="0" value={itemTemp.cantidad_ush} onChange={e => setItemTemp(p => ({ ...p, cantidad_ush: e.target.value }))} /></div>
              <div className="fg" style={{ flex: 1 }}><div className="fl">Costo unit. ($)</div><input className="inp" type="number" placeholder="1500" value={itemTemp.costo_unitario} onChange={e => setItemTemp(p => ({ ...p, costo_unitario: e.target.value }))} /></div>
            </div>
            <button className="btn btn-sm" style={{ width: "100%" }} onClick={agregarItem}>+ Agregar producto</button>
          </div>
          <div className="card">
            <div style={{ fontSize: 11, color: "#65676B", letterSpacing: ".1em", marginBottom: 14 }}>PRODUCTOS EN ESTA ORDEN ({nueva.items.length})</div>
            {nueva.items.length === 0 ? (<div style={{ fontSize: 12, color: "#65676B", textAlign: "center", padding: 20 }}>Sin productos agregados</div>) : (
              <table>
                <thead><tr><th>Producto</th><th>RG</th><th>USH</th><th>Costo unit.</th><th>Subtotal</th><th></th></tr></thead>
                <tbody>
                  {nueva.items.map((it, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: 11 }}>{it.producto_nombre}</td>
                      <td style={{ fontSize: 11 }}>{it.cantidad_rg}</td>
                      <td style={{ fontSize: 11 }}>{it.cantidad_ush}</td>
                      <td style={{ fontSize: 11 }}>${it.costo_unitario}</td>
                      <td style={{ fontSize: 11, fontWeight: 600 }}>${(it.costo_unitario * it.cantidad_total).toLocaleString("es-AR", { maximumFractionDigits: 0 })}</td>
                      <td><span style={{ cursor: "pointer", color: "#c0392b", fontSize: 14 }} onClick={() => quitarItemNueva(i)}>x</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {nueva.items.length > 0 && (() => {
              const sumaItems = nueva.items.reduce((s, it) => s + it.costo_unitario * it.cantidad_total, 0);
              const totalFactura = parseFloat(nueva.total) || 0;
              const coincide = totalFactura === 0 || Math.abs(sumaItems - totalFactura) < 1;
              return (
                <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 6, background: coincide ? "#2d7a4f12" : "#c0392b12", border: "1px solid " + (coincide ? "#2d7a4f" : "#c0392b") }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: "#666666" }}>Suma de productos</span>
                    <span style={{ fontWeight: 600 }}>${sumaItems.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</span>
                  </div>
                  {totalFactura > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 4 }}>
                      <span style={{ color: "#666666" }}>Total de la factura</span>
                      <span style={{ fontWeight: 600 }}>${totalFactura.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</span>
                    </div>
                  )}
                  {!coincide && (
                    <div style={{ fontSize: 11, color: "#c0392b", fontWeight: 600, marginTop: 6 }}>
                      Diferencia de ${Math.abs(sumaItems - totalFactura).toLocaleString("es-AR", { maximumFractionDigits: 0 })} - revisa los costos unitarios antes de crear la orden
                    </div>
                  )}
                </div>
              );
            })()}
            <button className="btn btn-p" style={{ width: "100%", marginTop: 14 }} onClick={crearOrden}>Crear orden</button>
          </div>
        </div>
      )}

      {tab === "recibir" && ordenDetalle && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "#65676B", letterSpacing: ".1em", marginBottom: 4 }}>RECIBIENDO EN {localNombre.toUpperCase()}</div>
            <div style={{ fontSize: 13, color: "#444444" }}>Factura {ordenDetalle.numero_factura || "-"} - {ordenDetalle.proveedor_nombre || ""}</div>
            <div style={{ fontSize: 11, color: "#65676B", marginTop: 4 }}>Conta la mercaderia fisica y confirma cada item. Si la cantidad no coincide, dejala como llego y agrega una nota.</div>
            {(() => {
              const delLocal = itemsDetalle.filter(it => esperadoLocal(it) > 0 || it.es_extra);
              const recibidos = delLocal.filter(it => revisadoLocal(it)).length;
              const completo = delLocal.length > 0 && recibidos === delLocal.length;
              return (
                <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 6, background: completo ? "#2d7a4f12" : "#c9a84c12", border: "1px solid " + (completo ? "#2d7a4f" : "#c9a84c"), fontSize: 12, color: completo ? "#2d7a4f" : "#c9a84c", fontWeight: 600 }}>
                  {completo ? "Recepcion completa: " : "Progreso: "}{recibidos} de {delLocal.length} items recibidos
                </div>
              );
            })()}
          </div>
          <div className="card" style={{ marginBottom: 16 }}>
            <table>
              <thead><tr><th>Producto</th><th>Esperado</th><th>Contado</th><th>Nota (si hay diferencia)</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {itemsDetalle.filter(it => esperadoLocal(it) > 0 || it.es_extra).map((it, i) => {
                  const esp = esperadoLocal(it);
                  const cont = conteo[it.id];
                  const dif = cont !== undefined && cont !== "" ? parseInt(cont) - esp : 0;
                  return (
                    <tr key={i} style={{ background: revisadoLocal(it) ? "#2d7a4f08" : "transparent" }}>
                      <td style={{ fontSize: 12 }}>{it.producto_nombre}{it.es_extra ? <span className="badge" style={{ background: "#c9a84c15", color: "#c9a84c", marginLeft: 6 }}>extra</span> : ""}</td>
                      <td style={{ fontSize: 12, color: "#65676B" }}>{esp}</td>
                      <td><input className="inp" type="number" style={{ width: 70, padding: "4px 8px" }} value={conteo[it.id] ?? ""} onChange={e => setConteo(c => ({ ...c, [it.id]: e.target.value }))} /></td>
                      <td>
                        {dif !== 0 && !it.es_extra ? (
                          <input className="inp" placeholder={dif > 0 ? "llegaron " + dif + " de mas" : "faltan " + Math.abs(dif)} style={{ padding: "4px 8px", fontSize: 11 }} value={notaItem[it.id] || ""} onChange={e => setNotaItem(n => ({ ...n, [it.id]: e.target.value }))} />
                        ) : (<span style={{ fontSize: 11, color: "#65676B" }}>{revisadoLocal(it) ? "ok" : "-"}</span>)}
                      </td>
                      <td>{revisadoLocal(it) ? <span style={{ fontSize: 11, color: "#2d7a4f", fontWeight: 600 }}>Recibido ({recibidoLocal(it)})</span> : <span style={{ fontSize: 11, color: "#c9a84c" }}>Pendiente</span>}</td>
                      <td><button className="btn btn-sm" onClick={() => confirmarItem(it)}>{revisadoLocal(it) ? "Recontar" : "Confirmar"}</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="card">
            <div style={{ fontSize: 11, color: "#65676B", letterSpacing: ".1em", marginBottom: 10 }}>AGREGAR ITEM EXTRA (regalo del proveedor, no estaba en la orden)</div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <div className="fg" style={{ flex: 2, marginBottom: 0 }}><div className="fl">Producto</div>
                <select className="sel" value={extra.producto_id} onChange={e => setExtra(p => ({ ...p, producto_id: e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  {productos.map(pr => (<option key={pr.id} value={pr.id}>{pr.nombre}</option>))}
                </select>
              </div>
              <div className="fg" style={{ flex: 1, marginBottom: 0 }}><div className="fl">Cantidad</div><input className="inp" type="number" value={extra.cantidad} onChange={e => setExtra(p => ({ ...p, cantidad: e.target.value }))} /></div>
              <button className="btn btn-sm" onClick={agregarExtra}>+ Agregar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// REPORTE INCONSISTENCIAS
function Inconsistencias() {
  const [datos, setDatos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get("/ordenes-ingreso/reporte/inconsistencias")
      .then(res => { setDatos(res.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const dif = (recibido, esperado) => (parseInt(recibido) || 0) - (parseInt(esperado) || 0);

  return (
    <div className="fade">
      <div className="ph">
        <div><div className="pt">Inconsistencias de Recepcion</div><div className="ps">diferencias para reclamar a proveedores</div></div>
      </div>
      <div className="card">
        {loading ? (<div style={{ textAlign: "center", color: "#65676B", fontSize: 12 }}>Cargando...</div>) : datos.length === 0 ? (
          <div style={{ fontSize: 12, color: "#65676B", textAlign: "center", padding: 30 }}>No hay inconsistencias registradas. Todo llego correcto!</div>
        ) : (
          <table>
            <thead><tr><th>Factura</th><th>Proveedor</th><th>Producto</th><th>Local</th><th>Esperado</th><th>Recibido</th><th>Diferencia</th><th>Nota</th></tr></thead>
            <tbody>
              {datos.map((d, i) => {
                const filas = [];
                if (d.revisado_rg && d.recibido_rg !== d.cantidad_rg) filas.push({ local: "RG", esp: d.cantidad_rg, rec: d.recibido_rg });
                if (d.revisado_ush && d.recibido_ush !== d.cantidad_ush) filas.push({ local: "USH", esp: d.cantidad_ush, rec: d.recibido_ush });
                if (d.es_extra) filas.push({ local: d.cantidad_rg > 0 ? "RG" : "USH", esp: 0, rec: d.cantidad_rg + d.cantidad_ush, extra: true });
                if (filas.length === 0 && d.nota_inconsistencia) filas.push({ local: "-", esp: "-", rec: "-" });
                return filas.map((f, j) => (
                  <tr key={i + "-" + j}>
                    <td style={{ fontSize: 11 }}>{d.numero_factura || "-"}</td>
                    <td style={{ fontSize: 11 }}>{d.proveedor_nombre || "-"}</td>
                    <td style={{ fontSize: 12 }}>{d.producto_nombre}{f.extra ? <span className="badge" style={{ background: "#c9a84c15", color: "#c9a84c", marginLeft: 6 }}>extra/regalo</span> : ""}</td>
                    <td style={{ fontSize: 11 }}>{f.local}</td>
                    <td style={{ fontSize: 12, color: "#65676B" }}>{f.esp}</td>
                    <td style={{ fontSize: 12 }}>{f.rec}</td>
                    <td>{f.extra ? <span style={{ color: "#c9a84c", fontSize: 12 }}>+{f.rec} regalo</span> : (typeof f.esp === "number" ? (() => { const v = dif(f.rec, f.esp); return <span style={{ color: v < 0 ? "#c0392b" : "#2d7a4f", fontWeight: 600, fontSize: 12 }}>{v > 0 ? "+" : ""}{v}</span>; })() : "-")}</td>
                    <td style={{ fontSize: 11, color: "#666666" }}>{d.nota_inconsistencia || "-"}</td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Kits() {
  const [kits, setKits] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("lista");
  const [mensaje, setMensaje] = useState("");
  const [editando, setEditando] = useState(null);
  const [nuevo, setNuevo] = useState({ nombre: "", descripcion: "", precio: "", items: [] });
  const [itemTemp, setItemTemp] = useState({ producto_id: "", cantidad: 1 });

  const cargar = async () => {
    setLoading(true);
    try {
      const [kitsRes, prodRes] = await Promise.all([API.get("/kits"), API.get("/productos")]);
      setKits(kitsRes.data);
      setProductos(prodRes.data);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const agregarItem = () => {
    if (!itemTemp.producto_id || !itemTemp.cantidad) return;
    const prod = productos.find(p => p.id === parseInt(itemTemp.producto_id));
    const setForm = editando ? setEditando : setNuevo;
    setForm(f => ({ ...f, items: [...f.items, { ...itemTemp, producto_nombre: prod?.nombre || "", producto_precio: prod?.price || 0 }] }));
    setItemTemp({ producto_id: "", cantidad: 1 });
  };

  const quitarItem = (idx) => {
    const setForm = editando ? setEditando : setNuevo;
    setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  };

  const guardar = async () => {
    const form = editando || nuevo;
    if (!form.nombre || form.items.length === 0) return setMensaje("Completa nombre y al menos un producto");
    try {
      if (editando) {
        await API.put("/kits/" + editando.id, form);
        setMensaje("Kit actualizado!");
        setEditando(null);
      } else {
        await API.post("/kits", form);
        setMensaje("Kit creado!");
        setNuevo({ nombre: "", descripcion: "", precio: "", items: [] });
      }
      setTab("lista");
      cargar();
      setTimeout(() => setMensaje(""), 3000);
    } catch (e) { setMensaje("Error al guardar kit"); }
  };

  const eliminar = async (id) => {
    try {
      await API.delete("/kits/" + id);
      setMensaje("Kit desactivado");
      cargar();
      setTimeout(() => setMensaje(""), 3000);
    } catch (e) { setMensaje("Error al eliminar"); }
  };

  const vender = async (kit) => {
    try {
      await API.post("/kits/" + kit.id + "/vender", { cantidad: 1 });
      setMensaje("Kit vendido! Stock actualizado.");
      cargar();
      setTimeout(() => setMensaje(""), 3000);
    } catch (e) { setMensaje(e.response?.data?.error || "Error al vender kit"); }
  };

  const editar = (kit) => {
    setEditando({ ...kit, items: (kit.items || []).filter(i => i.producto_id).map(i => ({ producto_id: i.producto_id, cantidad: i.cantidad, producto_nombre: i.producto_nombre, producto_precio: i.producto_precio })) });
    setTab("nuevo");
  };

  const form = editando || nuevo;
  const setForm = editando ? setEditando : setNuevo;
  const precioSugerido = form.items.reduce((s, i) => s + (parseFloat(i.producto_precio || 0) * parseInt(i.cantidad || 1)), 0);

  return (
    <div className="fade">
      <div className="ph">
        <div><div className="pt">Kits y Combos</div><div className="ps">packs de productos con descuento de stock automatico</div></div>
        <button className="btn btn-p btn-sm" onClick={() => { setEditando(null); setNuevo({ nombre: "", descripcion: "", precio: "", items: [] }); setTab("nuevo"); }}>+ Nuevo kit</button>
      </div>
      {mensaje && (
        <div style={{ background: mensaje.includes("Error") ? "#c0392b12" : "#2d7a4f12", border: "1px solid " + (mensaje.includes("Error") ? "#c0392b" : "#2d7a4f"), borderRadius: 6, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: mensaje.includes("Error") ? "#c0392b" : "#2d7a4f" }}>
          {mensaje}
        </div>
      )}
      <div className="tabs">
        <div className={"tab " + (tab === "lista" ? "on" : "")} onClick={() => setTab("lista")}>KITS</div>
        <div className={"tab " + (tab === "nuevo" ? "on" : "")} onClick={() => setTab("nuevo")}>{editando ? "EDITAR KIT" : "NUEVO KIT"}</div>
      </div>
      {tab === "lista" && (
        <div className="fade">
          {loading ? (
            <div style={{ color: "#65676B", padding: 20 }}>Cargando...</div>
          ) : kits.length === 0 ? (
            <div className="card" style={{ textAlign: "center", color: "#65676B", padding: 30 }}>Sin kits creados. Crea tu primer combo!</div>
          ) : (
            <div className="g2">
              {kits.map(kit => {
                const items = (kit.items || []).filter(i => i.producto_id);
                const totalPrecioProductos = items.reduce((s, i) => s + (parseFloat(i.producto_precio || 0) * parseInt(i.cantidad || 1)), 0);
                const ahorro = totalPrecioProductos - parseFloat(kit.precio || 0);
                return (
                  <div key={kit.id} className="card" style={{ borderTop: "3px solid #c9a84c" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#111111" }}>{kit.nombre}</div>
                        {kit.descripcion && <div style={{ fontSize: 11, color: "#65676B", marginTop: 2 }}>{kit.descripcion}</div>}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: "#c9a84c" }}>${parseFloat(kit.precio || 0).toLocaleString()}</div>
                        {ahorro > 0 && <div style={{ fontSize: 10, color: "#2d7a4f" }}>Ahorro: ${Math.round(ahorro).toLocaleString()}</div>}
                      </div>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      {items.map((item, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "4px 0", borderBottom: "1px solid #f5f5f5" }}>
                          <span style={{ color: "#444444" }}>{item.producto_nombre}</span>
                          <span style={{ color: "#65676B" }}>x{item.cantidad}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-p btn-sm" style={{ flex: 2 }} onClick={() => vender(kit)}>Vender kit</button>
                      <button className="btn btn-g btn-sm" style={{ flex: 1 }} onClick={() => editar(kit)}>Editar</button>
                      <button className="btn btn-sm" style={{ flex: 1, border: "1px solid #c0392b22", color: "#c0392b" }} onClick={() => eliminar(kit.id)}>Quitar</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {tab === "nuevo" && (
        <div className="g2 fade">
          <div className="card">
            <div className="ct">{editando ? "Editar kit" : "Nuevo kit"}</div>
            <div className="fg"><div className="fl">Nombre del kit</div>
              <input className="inp" placeholder="Ej: Kit Cuidado Facial Completo" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
            </div>
            <div className="fg"><div className="fl">Descripcion (opcional)</div>
              <input className="inp" placeholder="Ej: Ideal para piel seca..." value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
            </div>
            <div className="fg">
              <div className="fl">Precio del kit ($) {precioSugerido > 0 && <span style={{ fontSize: 10, color: "#65676B", marginLeft: 6 }}>Suma: ${Math.round(precioSugerido).toLocaleString()}</span>}</div>
              <input className="inp" type="number" placeholder={Math.round(precioSugerido * 0.9) || "15000"} value={form.precio} onChange={e => setForm(f => ({ ...f, precio: e.target.value }))} />
            </div>
            <div className="divider" />
            <div className="ct">Agregar productos al kit</div>
            <div className="fg"><div className="fl">Producto</div>
              <select className="sel" value={itemTemp.producto_id} onChange={e => setItemTemp(p => ({ ...p, producto_id: e.target.value }))}>
                <option value="">Seleccionar...</option>
                {productos.map(p => <option key={p.id} value={p.id}>{p.nombre} (Stock: {p.stock || 0})</option>)}
              </select>
            </div>
            <div className="fg"><div className="fl">Cantidad</div>
              <input className="inp" type="number" min="1" value={itemTemp.cantidad} onChange={e => setItemTemp(p => ({ ...p, cantidad: parseInt(e.target.value) || 1 }))} />
            </div>
            <button className="btn btn-g btn-sm" style={{ width: "100%", marginBottom: 12 }} onClick={agregarItem}>+ Agregar al kit</button>
            <button className="btn btn-p" style={{ width: "100%" }} onClick={guardar}>{editando ? "Guardar cambios" : "Crear kit"}</button>
            {editando && <button className="btn btn-g" style={{ width: "100%", marginTop: 8 }} onClick={() => { setEditando(null); setTab("lista"); }}>Cancelar</button>}
          </div>
          <div className="card">
            <div className="ct">Productos en este kit ({form.items.length})</div>
            {form.items.length === 0 ? (
              <div style={{ color: "#65676B", fontSize: 12, textAlign: "center", padding: 20 }}>Sin productos agregados</div>
            ) : (
              <div>
                {form.items.map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f5f5f5" }}>
                    <div>
                      <div style={{ fontSize: 12, color: "#444444" }}>{item.producto_nombre}</div>
                      <div style={{ fontSize: 10, color: "#65676B" }}>x{item.cantidad}</div>
                    </div>
                    <button onClick={() => quitarItem(i)} style={{ background: "none", border: "none", color: "#c0392b", cursor: "pointer", fontSize: 16 }}>x</button>
                  </div>
                ))}
                <div style={{ marginTop: 12, padding: "10px 0", borderTop: "2px solid #f0f0f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: "#444444" }}>Suma de productos</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#c9a84c" }}>${Math.round(precioSugerido).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const NAV_SECTIONS = [
  { section: "VENTAS", color: "#e67e22", items: [{ id: "dashboard", icon: "📊", label: "Dashboard" }, { id: "pos", icon: "🛒", label: "Punto de Venta" }] },
  { section: "STOCK", color: "#7d3c98", items: [{ id: "inventory", icon: "📦", label: "Inventario" }, { id: "ordenes", icon: "🚚", label: "Ingresos" }, { id: "inconsistencias", icon: "⚠️", label: "Inconsistencias" }, { id: "kits", icon: "🎁", label: "Kits" }] },
  { section: "CAJA", color: "#2d7a4f", items: [{ id: "caja", icon: "💵", label: "Caja" }, { id: "cierre", icon: "🔒", label: "Cierre de Caja" }, { id: "giftcards", icon: "🎀", label: "Gift Cards" }] },
  { section: "CLIENTES", color: "#c9a84c", items: [{ id: "clients", icon: "👥", label: "Clientes" }, { id: "clientes-analitica", icon: "📈", label: "Analitica Clientes" }, { id: "fidelizacion", icon: "⭐", label: "Fidelizacion" }] },
  { section: "FINANZAS", color: "#2471a3", items: [{ id: "finance", icon: "💰", label: "Finanzas" }, { id: "reports", icon: "📋", label: "Informes" }, { id: "comprobantes", icon: "🧾", label: "Comprobantes" }, { id: "comisiones", icon: "💎", label: "Comisiones" }, { id: "proveedores", icon: "🏭", label: "Proveedores" }, { id: "calculadoras", icon: "🧮", label: "Calculadoras" }, { id: "productividad", icon: "🏆", label: "Productividad" }] },
  { section: "MARKETING", color: "#e74c3c", items: [{ id: "cupones", icon: "🏷️", label: "Cupones" }] },
  { section: "POSTVENTA", color: "#25d366", items: [{ id: "postventa", icon: "💬", label: "Postventa WA" }] },
  { section: "CLIENTE", color: "#65676B", items: [{ id: "portal", icon: "👤", label: "Portal Cliente" }] },
];





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
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #2C3E5C 0%, #1C2A40 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ width: 360, background: "#ffffff", border: "1px solid #272220", borderRadius: 12, padding: 36 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 300, letterSpacing: ".18em", color: "#c9a84c" }}>LUMIERE</div>
          <div style={{ fontSize: 9, color: "#65676B", letterSpacing: ".3em", marginTop: 4 }}>SISTEMA DE GESTION</div>
        </div>
        {error && <div style={{ background: "#c0392b12", border: "1px solid #d97070", borderRadius: 5, padding: "8px 12px", marginBottom: 16, fontSize: 11, color: "#c0392b" }}>{error}</div>}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 9, color: "#65676B", letterSpacing: ".15em", marginBottom: 5 }}>EMAIL</div>
          <input className="inp" type="email" placeholder="tu@email.com" value={email} onChange={e => { setEmail(e.target.value); setError(""); }} />
        </div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 9, color: "#65676B", letterSpacing: ".15em", marginBottom: 5 }}>CONTRASEÑA</div>
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
    <div style={{ minHeight: "100vh", background: "#F0F2F5", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono', monospace" }}>
      <div style={{ width: 420, background: "#ffffff", border: "1px solid #272220", borderRadius: 12, padding: 36 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 300, letterSpacing: ".18em", color: "#c9a84c" }}>LUMIERE</div>
          <div style={{ fontSize: 11, color: "#65676B", marginTop: 8 }}>Bienvenida, {usuario?.nombre || "usuario"}</div>
          <div style={{ fontSize: 9, color: "#65676B", letterSpacing: ".2em", marginTop: 4 }}>SELECCIONA TU LOCAL</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {locales.map(l => (
            <div key={l.id} onClick={() => onSelect(l)}
              style={{ background: "#f8f8f8", border: "1px solid #272220", borderRadius: 8, padding: "18px 20px", cursor: "pointer", transition: "all .18s", display: "flex", justifyContent: "space-between", alignItems: "center" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#c9a84c"; e.currentTarget.style.background = "#c9a84c08"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#e8e8e8"; e.currentTarget.style.background = "#f8f8f8"; }}>
              <div>
                <div style={{ fontSize: 14, color: "#111111" }}>{l.nombre}</div>
                {l.direccion && <div style={{ fontSize: 10, color: "#65676B", marginTop: 3 }}>{l.direccion}</div>}
              </div>
              <span style={{ color: "#c9a84c", fontSize: 16 }}></span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 20, textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "#65676B", cursor: "pointer" }} onClick={() => { localStorage.removeItem("lumiere_token"); localStorage.removeItem("lumiere_user"); window.location.reload(); }}>
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
      <div style={{ fontSize: 40 }}></div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#111111" }}>Sin acceso</div>
      <div style={{ fontSize: 13, color: "#65676B" }}>No tenes permiso para ver esta seccion</div>
    </div>
  );
}

function Usuarios({ usuario: usuarioActual }) {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editandoPermisos, setEditandoPermisos] = useState(null);
  const [permisosUsuario, setPermisosUsuario] = useState([]);
  const [nuevoUsuario, setNuevoUsuario] = useState({ nombre: "", email: "", password: "", rol: "vendedora", rol_id: 3, local_id: 1 });
  const rolColor = { jefe: "#c9a84c", administrativo: "#2471a3", vendedora: "#2d7a4f" };
  const rolNombre = { jefe: "Jefe", administrativo: "Administrativo", vendedora: "Vendedora" };

  const TODOS_PERMISOS = {
    "POS": [["pos.ver","Ver Punto de Venta"],["pos.venta","Registrar ventas"],["pos.preventa","Hacer preventas"],["pos.descuento","Aplicar descuentos"]],
    "Finanzas": [["finanzas.flujo","Ver flujo de efectivo"],["finanzas.egreso","Registrar egresos"],["finanzas.equilibrio","Ver punto de equilibrio"],["finanzas.costos","Ver costos"]],
    "Inventario": [["inventario.ver","Ver stock"],["inventario.crear","Crear productos"],["inventario.alertas","Ver alertas"]],
    "Clientes": [["clientes.ver","Ver clientes"],["clientes.crear","Crear clientes"],["clientes.editar","Editar clientes"]],
    "Caja": [["caja.ver","Ver caja"],["caja.movimiento","Registrar movimientos"]],
    "Informes": [["informes.ventas","Ver ventas"],["informes.stock","Ver stock"],["informes.medios","Ver medios de pago"]],
    "Comisiones": [["comisiones.propias","Ver propias"],["comisiones.todas","Ver todas"]],
    "Proveedores": [["proveedores.ver","Ver proveedores"],["proveedores.crear","Crear/editar"]],
    "Kits": [["kits.ver","Ver kits"],["kits.crear","Crear/editar"],["kits.vender","Vender kits"]],
    "Ordenes de Ingreso": [["ordenes.ver","Ver ordenes"],["ordenes.crear","Crear ordenes"],["ordenes.recibir","Recibir mercaderia"]],
    "Usuarios": [["usuarios.ver","Ver usuarios"],["usuarios.crear","Crear usuarios"],["usuarios.permisos","Modificar permisos"]],
    "Marketing": [["cupones.ver","Ver cupones"],["cupones.gestionar","Gestionar cupones"],["fidelizacion.ver","Ver fidelizacion"],["fidelizacion.gestionar","Gestionar fidelizacion"],["postventa.ver","Ver postventa WA"],["postventa.gestionar","Gestionar postventa WA"]],
    "Tiendanube": [["tiendanube.ver","Ver Tiendanube"]]
  };

  const cargar = async () => {
    setLoading(true);
    try {
      const res = await API.get("/auth/usuarios");
      setUsuarios(res.data);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const crearUsuario = async () => {
    if (!nuevoUsuario.nombre || !nuevoUsuario.email || !nuevoUsuario.password) return setMensaje("Completa todos los campos");
    try {
      await API.post("/auth/register", nuevoUsuario);
      setMensaje("Usuario creado!");
      setShowForm(false);
      setNuevoUsuario({ nombre: "", email: "", password: "", rol: "vendedora", rol_id: 3, local_id: 1 });
      cargar();
      setTimeout(() => setMensaje(""), 3000);
    } catch (e) { setMensaje("Error: " + (e.response?.data?.error || e.message)); }
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

  const abrirPermisos = async (u) => {
    setEditandoPermisos(u);
    try {
      const res = await API.get("/permisos/" + u.id);
      setPermisosUsuario(res.data || []);
    } catch (e) { setPermisosUsuario([]); }
  };

  const togglePermiso = (permiso) => {
    setPermisosUsuario(prev => prev.includes(permiso) ? prev.filter(p => p !== permiso) : [...prev, permiso]);
  };

  const toggleGrupo = (perms) => {
    const claves = perms.map(p => p[0]);
    const todosActivos = claves.every(c => permisosUsuario.includes(c));
    if (todosActivos) setPermisosUsuario(prev => prev.filter(p => !claves.includes(p)));
    else setPermisosUsuario(prev => [...new Set([...prev, ...claves])]);
  };

  const guardarPermisos = async () => {
    try {
      await API.put("/permisos/" + editandoPermisos.id, { permisos: permisosUsuario });
      setMensaje("Permisos guardados!");
      setEditandoPermisos(null);
      setTimeout(() => setMensaje(""), 3000);
    } catch (e) { setMensaje("Error al guardar permisos"); }
  };

  if (editandoPermisos) {
    return (
      <div className="fade">
        <div className="ph">
          <div>
            <div className="pt">Permisos de {editandoPermisos.nombre}</div>
            <div className="ps">{rolNombre[editandoPermisos.rol] || editandoPermisos.rol} — {permisosUsuario.length} permisos activos</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-g btn-sm" onClick={() => setPermisosUsuario([])}>Quitar todo</button>
            <button className="btn btn-g btn-sm" onClick={() => setPermisosUsuario(Object.values(TODOS_PERMISOS).flat().map(p => p[0]))}>Dar todo</button>
            <button className="btn btn-g btn-sm" onClick={() => setEditandoPermisos(null)}>Cancelar</button>
            <button className="btn btn-p btn-sm" onClick={guardarPermisos}>Guardar permisos</button>
          </div>
        </div>
        {mensaje && <div style={{ background: "#2d7a4f12", border: "1px solid #2d7a4f", borderRadius: 6, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: "#2d7a4f" }}>{mensaje}</div>}
        <div className="g2">
          {Object.entries(TODOS_PERMISOS).map(([modulo, perms]) => {
            const claves = perms.map(p => p[0]);
            const activos = claves.filter(c => permisosUsuario.includes(c)).length;
            const todosActivos = activos === claves.length;
            return (
              <div key={modulo} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div className="ct" style={{ margin: 0 }}>{modulo}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 10, color: "#65676B" }}>{activos}/{claves.length}</span>
                    <div onClick={() => toggleGrupo(perms)} style={{ width: 36, height: 20, borderRadius: 10, background: todosActivos ? "#c9a84c" : "#e0e0e0", cursor: "pointer", position: "relative", transition: "background .2s" }}>
                      <div style={{ position: "absolute", top: 2, left: todosActivos ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "white", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                    </div>
                  </div>
                </div>
                {perms.map(([clave, label]) => (
                  <div key={clave} onClick={() => togglePermiso(clave)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid #f5f5f5", cursor: "pointer" }}>
                    <span style={{ fontSize: 12, color: permisosUsuario.includes(clave) ? "#111111" : "#65676B" }}>{label}</span>
                    <div style={{ width: 28, height: 16, borderRadius: 8, background: permisosUsuario.includes(clave) ? "#2d7a4f" : "#e0e0e0", position: "relative", transition: "background .2s" }}>
                      <div style={{ position: "absolute", top: 2, left: permisosUsuario.includes(clave) ? 14 : 2, width: 12, height: 12, borderRadius: "50%", background: "white", transition: "left .2s" }} />
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

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
              <div className="fg"><div className="fl">Contrasena</div><input className="inp" type="password" placeholder="Contrasena inicial" value={nuevoUsuario.password} onChange={e => setNuevoUsuario(p => ({ ...p, password: e.target.value }))} /></div>
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
                  <option value={1}>Rio Grande</option>
                  <option value={2}>Ushuaia</option>
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
        {loading ? <div style={{ color: "#65676B", padding: 20 }}>Cargando...</div> : (
          <table>
            <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Local</th><th>Acciones</th></tr></thead>
            <tbody>
              {usuarios.map(u => (
                <tr key={u.id}>
                  <td style={{ color: "#111111", fontWeight: 500 }}>{u.nombre}</td>
                  <td>{u.email}</td>
                  <td><span className="badge" style={{ background: (rolColor[u.rol] || "#65676B") + "15", color: rolColor[u.rol] || "#65676B" }}>{rolNombre[u.rol] || u.rol}</span></td>
                  <td>{u.local_nombre || "-"}</td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn btn-p btn-sm" onClick={() => abrirPermisos(u)}>Permisos</button>
                      <button className="btn btn-g btn-sm" onClick={() => cambiarPassword(u.id)}>Contrasena</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
        cargarMisPermisos(u.id);
      } catch (e) {}
    }
  }, []);

  const handleLogin = (u) => {
    setUsuario(u);
    localStorage.setItem("lumiere_user", JSON.stringify(u));
    cargarMisPermisos(u.id);
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

  const [permisosActivos, setPermisosActivos] = useState([]);

  const cargarMisPermisos = async (uid) => {
    try {
      const res = await API.get("/permisos/" + uid);
      setPermisosActivos(res.data || []);
    } catch (e) {}
  };

  const puedeVer = (modulo) => {
    if (!usuario) return false;
    if (usuario.rol === "jefe" || usuario.rol_id === 1) return true;
 const mapaModulos = {
      "pos": "pos.ver", "dashboard": "pos.ver",
      "inventory": "inventario.ver", "ordenes": "ordenes.ver", "inconsistencias": "ordenes.ver", "kits": "kits.ver",
      "clients": "clientes.ver", "clientes-analitica": "clientes.ver", "fidelizacion": "fidelizacion.ver",
      "finance": "finanzas.flujo", "reports": "informes.ventas", "comprobantes": "finanzas.flujo",
      "comisiones": "comisiones.propias", "proveedores": "proveedores.ver",
      "calculadoras": "finanzas.flujo", "productividad": "finanzas.flujo",
      "cupones": "cupones.ver", "postventa": "postventa.ver", "portal": "clientes.ver",
      "caja": "caja.ver", "cierre": "caja.ver", "giftcards": "caja.ver",
      "usuarios": "usuarios.ver", "tiendanube": "tiendanube.ver",
    };
    const permiso = mapaModulos[modulo];
    if (!permiso) return true;
    return permisosActivos.includes(permiso);
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
    if (id === "inventory") return <Inventario localId={local.id} usuario={usuario} />;
    if (id === "clients") return <Clientes localId={local.id} />;
    if (id === "finance") return <Finanzas localId={local.id} />;
    if (id === "reports") return <Informes localId={local.id} />;
    if (id === "calculadoras") return <Calculadoras usuario={usuario} />;
    if (id === "comprobantes") return <Comprobantes localId={local.id} />;
    if (id === "productividad") return <Productividad localId={local.id} />;
    if (id === "cupones") return <Cupones localId={local.id} />;
    if (id === "fidelizacion") return <Fidelizacion localId={local.id} />;
    if (id === "postventa") return <PostventaWA localId={local.id} />;
    if (id === "tiendanube") return <Tiendanube localId={local.id} usuario={usuario} />;
    if (id === "portal") return <PortalCliente />;
    if (id === "usuarios") return <Usuarios usuario={usuario} />;
    if (id === "comisiones") return <Comisiones localId={local.id} />;
    if (id === "caja") return <Caja localId={local.id} usuario={usuario} />;
    if (id === "cierre") return <CierreCaja localId={local.id} usuario={usuario} />;
    if (id === "giftcards") return <GiftCards localId={local.id} usuario={usuario} />;
    if (id === "ordenes") return <OrdenesIngreso localId={local.id} usuario={usuario} />;
    if (id === "kits") return <Kits />;
    if (id === "inconsistencias") return <Inconsistencias />;
    if (id === "proveedores") return <Proveedores />;
    return <Dashboard localId={local.id} />;
  };

  const NAV_CON_PERMISOS = NAV_SECTIONS.map(sec => ({
    ...sec,
    items: sec.items.filter(it => puedeVer(it.id))
  })).filter(sec => sec.items.length > 0);

  if (usuario.rol === "jefe") {
    const yaExiste = NAV_CON_PERMISOS.some(s => s.items.some(i => i.id === "usuarios"));
    if (!yaExiste) {
      NAV_CON_PERMISOS.push({ section: "CONFIGURACION", items: [{ id: "usuarios", icon: "-", label: "Usuarios" }] });
    }
  }

  const rolBadgeColor = { jefe: "#c9a84c", administrativo: "#2471a3", vendedora: "#2d7a4f" };

  return (
    <>
      <style>{BASE_CSS}</style>
      <div className="layout" style={{ width: "100vw", margin: 0 }}>
        <aside className="sidebar">
          <div className="logo">
            <div className="logo-name">Lumiere</div>
            <div className="logo-sub">{local.nombre}</div>
          </div>
          <nav className="nav">
            {NAV_CON_PERMISOS.map(sec => (
              <div key={sec.section}>
                <div className="nav-section" style={{ color: "rgba(255,255,255,0.6)" }}>{sec.section}</div>
                {sec.items.map(it => {
                  const isActive = page === it.id;
                  const col = sec.color || "#c9a84c";
                  return (
                    <div key={it.id}
                      className={"nav-item " + (isActive ? "active" : "")}
                      style={isActive ? { background: col + "25", borderColor: col + "60", color: "#ffffff" } : {}}
                      onClick={() => setPage(it.id)}>
                      <span style={{ fontSize: 15, flexShrink: 0 }}>{it.icon}</span>
                      <span style={{ color: isActive ? "#ffffff" : "rgba(255,255,255,0.85)", transition: "color .18s" }}>{it.label}</span>
                    </div>
                  );
                })}
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
            <div style={{ marginTop: 12, fontSize: 11, color: "#65676B", cursor: "pointer" }} onClick={() => setLocal(null)}>Cambiar local</div>
            <div style={{ marginTop: 6, fontSize: 11, color: "#65676B", cursor: "pointer" }} onClick={handleLogout}>Cerrar sesion</div>
          </div>
        </aside>
        <main className="main">
          {getPageWithLocal(page)}
        </main>
      </div>
    </>
  );
}