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
  emoji: r.emoji === "ok_hand" ? "ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¨" : r.emoji === "droplet" ? "ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§" : r.emoji === "lipstick" ? "ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¾" : r.emoji === "gift" ? "ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â½ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â" : r.emoji === "herb" ? "ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿" : "ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸",
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
  const mes = new Date().getMonth() + 1;
  const anio = new Date().getFullYear();

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
      {sub && <div style={{ fontSize: 11, color: "#999999", marginTop: 4 }}>{sub}</div>}
    </div>
  );

  const Semaforo = ({ valor, umbralOk, umbralAlerta, formato }) => {
    const color = valor >= umbralOk ? "#2d7a4f" : valor >= umbralAlerta ? "#e67e22" : "#c0392b";
    const icono = valor >= umbralOk ? "ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ÂÃƒâ€šÃ‚Â" : valor >= umbralAlerta ? "ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ÂÃƒâ€šÃ‚Â" : "ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ÂÃƒâ€šÃ‚Â";
    return <span style={{ color, fontSize: 12, fontWeight: 700 }}>{icono} {formato ? formato(valor) : valor}</span>;
  };

  return (
    <div className="fade">
      <div className="ph">
        <div><div className="pt">Dashboard</div><div className="ps">{"KPIs del mes de " + ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"][mes-1]}</div></div>
        <button className="btn btn-g btn-sm" onClick={cargar}>Actualizar</button>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["rg","ush","consolidado"].map(l => (
          <button key={l} onClick={() => setTabLocal(l)} className="btn btn-sm"
            style={{ background: tabLocal === l ? "#c9a84c15" : "transparent", border: "1px solid " + (tabLocal === l ? "#c9a84c" : "#e8e8e8"), color: tabLocal === l ? "#c9a84c" : "#999999", fontWeight: tabLocal === l ? 600 : 400 }}>
            {l === "rg" ? "Rio Grande" : l === "ush" ? "Ushuaia" : "Consolidado"}
          </button>
        ))}
      </div>
      {loading ? (
        <div style={{ textAlign: "center", color: "#999999", padding: 40 }}>Cargando KPIs...</div>
      ) : data && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#999999", letterSpacing: ".1em", marginBottom: 10 }}>FINANCIERO</div>
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

          <div style={{ fontSize: 11, fontWeight: 700, color: "#999999", letterSpacing: ".1em", marginBottom: 10, marginTop: 4 }}>INVENTARIO</div>
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
                <div style={{ color: "#999999", fontSize: 12, textAlign: "center", padding: 20 }}>Sin datos este mes</div>
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
              <div style={{ color: "#999999", fontSize: 12, textAlign: "center", padding: 20 }}>Sin ventas este mes</div>
            ) : (
              <table>
                <thead><tr><th>Fecha</th><th>Cliente</th><th>Medio</th><th>Total</th></tr></thead>
                <tbody>
                  {data.ventas.slice(0, 8).map((v, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: 11, color: "#999999" }}>{new Date(v.creado_en || v.fecha).toLocaleDateString("es-AR")}</td>
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

function POS({ localId }) {
  const [cart, setCart] = useState([]);
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
  const [tipoDescuento, setTipoDescuento] = useState("$");
  const [medioPagoSel, setMedioPagoSel] = useState(null);
  const [tabPos, setTabPos] = useState("venta");
  const [preventasPendientes, setPreventasPendientes] = useState([]);

  const cargarPreventas = async () => {
    try {
      const res = await API.get("/ventas?es_preventa=true&local_id=" + (localId || 1));
      setPreventasPendientes((res.data || []).filter(v => v.estado === "preventa"));
    } catch (e) {}
  };

  useEffect(() => {
    getProductos().then(res => setProductos(res.data)).catch(() => setProductos(PRODUCTS));
    API.get("/medios-pago").then(res => setMediosPago(res.data)).catch(() => setMediosPago([]));
    cargarPreventas();
  }, [localId]);

  const add = (p) => setCart(prev => {
    const e = prev.find(i => i.id === p.id);
    return e ? prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i) : [...prev, { ...p, qty: 1 }];
  });
  const remove = (id) => setCart(prev => prev.filter(i => i.id !== id));

  const coef = medioPagoSel ? parseFloat(medioPagoSel.coeficiente) : 1;
  const subtotalBase = cart.reduce((s, i) => s + (i.precio || i.price) * i.qty, 0);
  const descuentoCupon = cuponAplicado ? (cuponAplicado.tipo === "%" ? subtotalBase * (cuponAplicado.valor / 100) : cuponAplicado.valor) : 0;
  const descuentoManualCalc = descuentoManual ? (tipoDescuento === "%" ? subtotalBase * (parseFloat(descuentoManual) / 100) : parseFloat(descuentoManual)) : 0;
  const descuento = descuentoCupon + descuentoManualCalc;
  const subtotalConDesc = subtotalBase - descuento;
  const total = Math.round(subtotalConDesc * coef);
  const intereses = total - subtotalConDesc;

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
    if (!medioPagoSel) return setMensaje("Selecciona un medio de pago");
    setLoading(true);
    try {
      const items = cart.map(i => ({ producto_id: i.id, cantidad: i.qty, precio_unitario: i.precio || i.price }));
      const ventaRes = await createVenta({
        cliente_id: clienteSeleccionado?.id || null,
        tipo_factura: tipoFac, items, canal: "presencial",
        cupon_codigo: cupon || null, local_id: localId || 1,
        medio_pago_id: medioPagoSel.id, medio_pago_nombre: medioPagoSel.nombre,
        total_con_interes: total, es_preventa: preventa,
        nombre_preventa: preventa ? nombrePreventa : null
      });
      if (!preventa) {
        try {
          const arcaRes = await API.post("/arca/emitir", { tipo: tipoFac, items, total, cliente_cuit: clienteSeleccionado?.cuit_dni || null, venta_id: ventaRes.data.id });
          setMensaje("ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ " + arcaRes.data.mensaje + " | CAE: " + arcaRes.data.cae);
        } catch (arcaErr) {
          setMensaje("Venta registrada pero error en ARCA: " + arcaErr.message);
        }
      } else {
        setMensaje("Preventa registrada para " + nombrePreventa + "!");
      }
      setCart([]); setDniInput(""); setCupon(""); setCuponAplicado(null);
      setClienteSeleccionado(null); setShowNuevoCliente(false);
      setMedioPagoSel(null); setPreventa(false); setNombrePreventa(""); setDescuentoManual(""); setTipoDescuento("$");
      setTimeout(() => setMensaje(""), 8000);
    } catch (error) { setMensaje("Error al emitir factura"); }
    setLoading(false);
  };

  const confirmarPreventa = async (p) => {
    try {
      const res = await API.get("/ventas/" + p.id);
      const vd = res.data;
      setCart((vd.items || []).map(i => ({ id: i.producto_id, nombre: i.producto_nombre, precio: i.precio_unitario, qty: i.cantidad, stock: 99 })));
      setClienteSeleccionado({ id: p.cliente_id, nombre: p.nombre_preventa || "Consumidor Final", puntos: 0 });
      setTabPos("venta");
      setMensaje("Preventa cargada!");
      await API.put("/ventas/" + p.id, { estado: "cancelada" });
      cargarPreventas();
    } catch (e) { setMensaje("Error al cargar preventa"); }
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
        {preventasPendientes.length === 0 ? (
          <div style={{ textAlign: "center", color: "#999999", padding: 40, fontSize: 13 }}>No hay preventas pendientes</div>
        ) : preventasPendientes.map(p => (
          <div key={p.id} className="card" style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{p.nombre_preventa || "Consumidor Final"}</div>
              <div style={{ fontSize: 11, color: "#999999", marginTop: 3 }}>{new Date(p.creado_en).toLocaleDateString("es-AR")} "" ${parseFloat(p.total).toLocaleString()}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-p btn-sm" onClick={() => confirmarPreventa(p)}>Confirmar venta</button>
              <button className="btn btn-g btn-sm" onClick={async () => { await API.put("/ventas/" + p.id, { estado: "cancelada" }); cargarPreventas(); }}>Cancelar</button>
            </div>
          </div>
        ))}
      </div>
    );
  }

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
      <div className="tabs">
        <div className="tab on" onClick={() => setTabPos("venta")}>NUEVA VENTA</div>
        <div className={"tab"} onClick={() => { setTabPos("preventas"); cargarPreventas(); }}>
          PREVENTAS {preventasPendientes.length > 0 && <span style={{ background: "#2471a3", color: "white", borderRadius: 10, fontSize: 8, padding: "1px 5px", marginLeft: 4 }}>{preventasPendientes.length}</span>}
        </div>
      </div>
      {mensaje && (
        <div style={{ background: mensaje.includes("Error") ? "#c0392b12" : "#2d7a4f12", border: "1px solid " + (mensaje.includes("Error") ? "#c0392b" : "#2d7a4f"), borderRadius: 6, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: mensaje.includes("Error") ? "#c0392b" : "#2d7a4f" }}>
          {mensaje}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16, height: "calc(100vh - 220px)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, overflow: "hidden" }}>
          <input className="inp" placeholder="Buscar producto..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, overflowY: "auto", flex: 1 }}>
            {productosAMostrar.map(p => (
              <div key={p.id} onClick={() => add(p)}
                style={{ background: "#ffffff", border: "1px solid #e8e8e8", borderRadius: 7, padding: 14, cursor: "pointer", transition: "all .18s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#c9a84c"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#e8e8e8"; }}>
                <div style={{ fontSize: 9, color: "#999999", textTransform: "uppercase" }}>{p.marca || p.brand}</div>
                <div style={{ fontSize: 12, color: "#333333", marginTop: 3, fontWeight: 500 }}>{p.nombre || p.name}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 10 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#c9a84c" }}>${(p.precio || p.price).toLocaleString()}</div>
                  <span className={"badge " + (p.stock < (p.stock_minimo || 5) ? "br" : "bg")}>{p.stock}u</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: "#ffffff", border: "1px solid #e8e8e8", borderRadius: 8, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #f0f0f0", fontSize: 10, color: "#999999", fontWeight: 600, background: preventa ? "#2471a312" : "#fafafa" }}>
            {preventa ? "PREVENTA" : "COMPROBANTE EN CURSO"}
          </div>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid #f0f0f0" }}>
            {preventa ? (
              <input className="inp" placeholder="Nombre del cliente (preventa)" value={nombrePreventa} onChange={e => setNombrePreventa(e.target.value)} />
            ) : (
              <div>
                <div style={{ position: "relative", marginBottom: 6 }}>
                  <input className="inp" placeholder="DNI del cliente (opcional)" value={dniInput} onChange={e => buscarClientePorDni(e.target.value)} />
                  {buscandoCliente && <div style={{ position: "absolute", right: 10, top: 10, fontSize: 10, color: "#999999" }}>buscando...</div>}
                </div>
                {clienteSeleccionado && clienteSeleccionado.id && (
                  <div style={{ background: "#2d7a4f12", border: "1px solid #2d7a4f33", borderRadius: 6, padding: "8px 12px", marginBottom: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#2d7a4f" }}>{clienteSeleccionado.nombre}</div>
                    <div style={{ fontSize: 10, color: "#666666" }}>{clienteSeleccionado.puntos || 0} pts - {clienteSeleccionado.nivel || "Bronze"}</div>
                  </div>
                )}
                {showNuevoCliente && !clienteSeleccionado && (
                  <div style={{ background: "#2471a312", border: "1px solid #2471a333", borderRadius: 6, padding: 10, marginBottom: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#2471a3", marginBottom: 8 }}>Cliente nuevo</div>
                    <input className="inp" placeholder="Nombre completo" value={nuevoClienteDni.nombre} onChange={e => setNuevoClienteDni(p => ({ ...p, nombre: e.target.value }))} style={{ marginBottom: 6 }} />
                    <input className="inp" placeholder="Telefono (opcional)" value={nuevoClienteDni.telefono} onChange={e => setNuevoClienteDni(p => ({ ...p, telefono: e.target.value }))} style={{ marginBottom: 6 }} />
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
                {cuponAplicado && <div style={{ fontSize: 10, color: "#2d7a4f", marginBottom: 4 }}>Descuento aplicado</div>}
                <div style={{ display: "flex", gap: 6, marginBottom: 4, alignItems: "center" }}>
                  <input className="inp" type="number" placeholder="Descuento manual ($)" value={descuentoManual} onChange={e => setDescuentoManual(e.target.value)} style={{ flex: 1 }} />
                  <select className="sel" style={{ width: 60, padding: "10px 6px", fontSize: 11 }} value={tipoDescuento} onChange={e => setTipoDescuento(e.target.value)}>
                    <option value="$">$</option>
                    <option value="%">%</option>
                  </select>
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
              {["A", "B", "Remito"].map(t => (
                <button key={t} onClick={() => setTipoFac(t)} className="btn btn-sm"
                  style={{ flex: 1, background: tipoFac === t ? "#c9a84c15" : "transparent", border: "1px solid " + (tipoFac === t ? "#c9a84c" : "#e8e8e8"), color: tipoFac === t ? "#c9a84c" : "#999999" }}>
                  {t === "Remito" ? "Remito" : "Fac. " + t}
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
            {cart.length === 0
              ? <div style={{ textAlign: "center", color: "#cccccc", fontSize: 12, marginTop: 20 }}>Selecciona productos</div>
              : cart.map(i => (
                <div key={i.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fafafa", borderRadius: 6, padding: "8px 10px", marginBottom: 6, border: "1px solid #f0f0f0" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{i.nombre || i.name}</div>
                    <div style={{ fontSize: 10, color: "#999999" }}>{i.marca || i.brand}</div>
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
            {cart.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div className="fl">Medio de pago</div>
                <select className="sel" value={medioPagoSel?.id || ""} onChange={e => {
                  const m = mediosPago.find(x => x.id === parseInt(e.target.value));
                  setMedioPagoSel(m || null);
                }}>
                  <option value="">Seleccionar...</option>
                  {["efectivo", "transferencia", "debito", "credito", "plataforma"].map(tipo => (
                    <optgroup key={tipo} label={tipo === "efectivo" ? "Efectivo" : tipo === "transferencia" ? "Transferencia" : tipo === "debito" ? "Debito" : tipo === "credito" ? "Credito" : "Plataformas"}>
                      {mediosPago.filter(m => m.tipo === tipo).map(m => (
                        <option key={m.id} value={m.id}>
                          {m.nombre}{m.con_interes ? " (+" + Math.round((parseFloat(m.coeficiente) - 1) * 100) + "%)" : ""}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
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
                <span style={{ fontSize: 11, color: "#c0392b" }}>Intereses</span>
                <span style={{ fontSize: 11, color: "#c0392b" }}>+${intereses.toLocaleString()}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: "#999999", fontWeight: 600 }}>TOTAL</div>
              <div style={{ fontSize: 30, fontWeight: 700, color: "#111111" }}>${total.toLocaleString()}</div>
            </div>
            <button className="btn btn-p" style={{ width: "100%", padding: 13, fontSize: 13, opacity: loading ? 0.7 : 1 }} onClick={emitirFactura} disabled={loading}>
              {loading ? "Procesando..." : preventa ? "Registrar Preventa" : "Emitir Factura " + tipoFac + " - ARCA"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Inventario({ localId }) {
  const [tab, setTab] = useState("stock");
  const [productos, setProductos] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);
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
              <div className="fg"><div className="fl">Precio de venta ($) *</div><input className="inp" type="number" placeholder="2500" value={nuevo.precio} onChange={e => setNuevo(p => ({ ...p, precio: e.target.value }))} /></div>
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
        {["stock", "alertas", "movimientos"].map(t => (
          <div key={t} className={"tab " + (tab === t ? "on" : "")} onClick={() => setTab(t)}>
            {t === "stock" ? "STOCK" : t === "alertas" ? "ALERTAS" + (alertas.length > 0 ? " (" + alertas.length + ")" : "") : "MOVIMIENTOS"}
          </div>
        ))}
      </div>
      {tab === "stock" && (
        <div className="card fade">
          {loading ? (
            <div style={{ color: "#999999", padding: 20 }}>Cargando inventario...</div>
          ) : (
          <table>
            <thead><tr><th>Producto</th><th>Marca</th><th>Categoria</th><th>Codigo</th><th>Precio</th><th>Costo</th><th>Stock</th><th>Estado</th></tr></thead>
            <tbody>
              {productos.map(p => {
                const bajo = (p.stock || 0) <= (p.stock_minimo || 5);
                const margen = p.price && p.cost ? Math.round(((p.price - p.cost) / p.price) * 100) : null;
                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 500 }}>{p.nombre || p.name}</td>
                    <td style={{ fontSize: 11, color: "#999999" }}>{p.marca || p.brand || "-"}</td>
                    <td style={{ fontSize: 11, color: "#999999" }}>{p.categoria || "-"}</td>
                    <td style={{ fontSize: 11, color: "#999999" }}>{p.codigo_barras || p.codigo || "-"}</td>
                    <td style={{ color: "#c9a84c" }}>${parseFloat(p.price || p.precio || 0).toLocaleString()}</td>
                    <td style={{ fontSize: 11, color: "#999999" }}>{p.cost || p.costo ? "$" + parseFloat(p.cost || p.costo).toLocaleString() : "-"}</td>
                    <td><span className={"badge " + (bajo ? "br" : "bg")}>{p.stock || 0}u</span></td>
                    <td style={{ fontSize: 10, color: margen ? "#2d7a4f" : "#999999" }}>{margen ? margen + "%" : "-"}</td>
                  </tr>
                );
              })}
              {productos.length === 0 && <tr><td colSpan={8} style={{ color: "#999999", textAlign: "center" }}>Sin productos</td></tr>}
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
                <div style={{ fontSize: 10, color: "#999999", marginTop: 2 }}>Stock: {p.stock || 0}u | Minimo: {p.stock_minimo || 5}u</div>
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
          {loading ? <div style={{ textAlign: "center", color: "#999999", padding: 20 }}>Cargando clientes...</div> : (
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
              style={{ background: tabLocal === l ? "#c9a84c15" : "transparent", border: "1px solid " + (tabLocal === l ? "#c9a84c" : "#e8e8e8"), color: tabLocal === l ? "#c9a84c" : "#999999", fontWeight: tabLocal === l ? 600 : 400 }}>
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
              {loading ? <div style={{ color: "#999999" }}>Cargando...</div> : (
              <table>
                <thead><tr><th>Concepto</th><th>Categoria</th><th>Tipo</th><th>Cuenta</th><th>Importe</th></tr></thead>
                <tbody>
                  {(flujo?.movimientos || []).slice(0, 15).map((m, i) => (
                    <tr key={i}>
                      <td>{m.concepto}</td>
                      <td style={{ fontSize: 10, color: "#999999" }}>{m.categoria_nombre || "-"}</td>
                      <td><span className={"badge " + (m.tipo === "I" ? "bg" : "br")}>{m.tipo === "I" ? "Ingreso" : "Egreso"}</span></td>
                      <td style={{ fontSize: 10, color: "#999999" }}>{m.cuenta_nombre || m.forma_pago || "-"}</td>
                      <td style={{ color: m.tipo === "I" ? "#2d7a4f" : "#c0392b" }}>{m.tipo === "I" ? "+" : "-"}${parseFloat(m.importe).toLocaleString()}</td>
                    </tr>
                  ))}
                  {(flujo?.movimientos || []).length === 0 && (<tr><td colSpan={5} style={{ color: "#999999", textAlign: "center" }}>Sin movimientos</td></tr>)}
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
          {loading ? <div style={{ color: "#999999", padding: 20 }}>Cargando...</div> : flujoEst && (
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
            {loading ? <div style={{ color: "#999999" }}>Calculando...</div> : <div>
              <div style={{ fontSize: 48, fontWeight: 700, color: "#c9a84c" }}>${parseFloat(equilibrio?.punto_equilibrio || 0).toLocaleString()}</div>
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
                <span style={{ fontSize: 11, color: "#999999" }}>{r.l}</span>
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
            style={{ background: tabLocal === l ? "#c9a84c15" : "transparent", border: "1px solid " + (tabLocal === l ? "#c9a84c" : "#e8e8e8"), color: tabLocal === l ? "#c9a84c" : "#999999", fontWeight: tabLocal === l ? 600 : 400 }}>
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
        <div style={{ color: "#999999", padding: 30, textAlign: "center" }}>Cargando...</div>
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
                  <div style={{ color: "#999999", textAlign: "center", padding: 20, fontSize: 12 }}>Sin ventas en este periodo</div>
                ) : (
                  <table>
                    <thead><tr><th>Fecha</th><th>Cliente</th><th>Medio</th><th>Items</th><th>Total</th></tr></thead>
                    <tbody>
                      {datos.ventas.slice(0, 20).map((v, i) => (
                        <tr key={i}>
                          <td style={{ fontSize: 11, color: "#999999" }}>{new Date(v.creado_en || v.fecha).toLocaleDateString("es-AR")}</td>
                          <td style={{ fontSize: 12 }}>{v.cliente_nombre || "Consumidor final"}</td>
                          <td style={{ fontSize: 11 }}>{v.medio_pago || "-"}</td>
                          <td style={{ fontSize: 11, color: "#999999" }}>{v.items_count || "-"}</td>
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
                              <div style={{ fontSize: 10, color: "#999999" }}>{p.marca}</div>
                            </td>
                            <td><span className="badge br">{p.stock || 0}u</span></td>
                            <td style={{ color: "#999999", fontSize: 12 }}>{p.stock_minimo || p.min || 5}u</td>
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
                  <div style={{ color: "#999999", textAlign: "center", padding: 20, fontSize: 12 }}>Sin datos para este periodo</div>
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
          {loading ? <div style={{ textAlign: "center", color: "#999999", padding: 20 }}>Cargando...</div> : (
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
          </table>
        )}
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
  const nivelEmoji = datos?.nivel === 2 ? "ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â " : datos?.nivel === 1 ? "ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â" : "ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â½ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯";

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
                  <span style={{ fontSize: 10, color: "#999999" }}>${parseFloat(datos.facturacion || 0).toLocaleString()} facturado</span>
                  <span style={{ fontSize: 10, color: datos.nivel >= 1 ? "#2d7a4f" : "#999999" }}>{datos.pct_nivel1}%</span>
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
        </div>
      )}
      {loading && <div style={{ textAlign: "center", color: "#999999", padding: 40 }}>Calculando comisiones...</div>}
    </div>
  );
}

function Proveedores() {
  const [tab, setTab] = useState("lista");
  const [proveedores, setProveedores] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [nuevo, setNuevo] = useState({ nombre: "", cuit: "", email: "", telefono: "", whatsapp: "", dias_pago: 30, forma_pago: "transferencia", banco: "", cbu: "", alias: "", titular_cuenta: "", categoria: "mercaderia", notas: "" });

  const cargar = () => {
    Promise.all([API.get("/proveedores"), API.get("/cuentas-pago")])
      .then(([p, c]) => { setProveedores(p.data); setCuentas(c.data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, []);

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
      </div>

      {tab === "lista" && (
        <div className="fade">
          {loading ? <div style={{ color: "#999999", padding: 20 }}>Cargando...</div> :
          proveedores.length === 0 ? (
            <div style={{ textAlign: "center", color: "#999999", padding: 40, fontSize: 13 }}>No hay proveedores cargados aun</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {proveedores.map(p => (
                <div key={p.id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#111111" }}>{p.nombre}</div>
                      <div style={{ fontSize: 10, color: "#999999" }}>{p.cuit}</div>
                    </div>
                    <span className="badge" style={{ background: (categoriaColor[p.categoria] || "#999") + "15", color: categoriaColor[p.categoria] || "#999" }}>{p.categoria}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                    <div style={{ background: "#fafafa", borderRadius: 6, padding: "8px 10px" }}>
                      <div style={{ fontSize: 9, color: "#999999", marginBottom: 3 }}>CONDICION DE PAGO</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#c9a84c" }}>{p.dias_pago} dias</div>
                      <div style={{ fontSize: 10, color: "#666666" }}>{p.forma_pago}</div>
                    </div>
                    <div style={{ background: "#fafafa", borderRadius: 6, padding: "8px 10px" }}>
                      <div style={{ fontSize: 9, color: "#999999", marginBottom: 3 }}>CONTACTO</div>
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
                  {p.notas && <div style={{ fontSize: 10, color: "#999999", fontStyle: "italic" }}>{p.notas}</div>}
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
              <div key={c.id} className="card" style={{ borderLeft: "3px solid " + (c.tipo === "efectivo" ? "#2d7a4f" : c.tipo === "transferencia" ? "#2471a3" : c.tipo === "echeck" ? "#c9a84c" : "#999999") }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111111" }}>{c.nombre}</div>
                  {c.solo_acreditacion && <span className="badge bb" style={{ fontSize: 9 }}>Solo acreditacion</span>}
                </div>
                <div style={{ fontSize: 10, color: "#999999", marginBottom: 4 }}>{c.titular}</div>
                <span className="badge" style={{ background: c.tipo === "efectivo" ? "#2d7a4f12" : c.tipo === "transferencia" ? "#2471a312" : "#c9a84c15", color: c.tipo === "efectivo" ? "#2d7a4f" : c.tipo === "transferencia" ? "#2471a3" : "#c9a84c", fontSize: 9 }}>{c.tipo}</span>
                {c.alias && <div style={{ fontSize: 11, color: "#444444", marginTop: 6 }}>Alias: {c.alias}</div>}
                {c.cbu && <div style={{ fontSize: 10, color: "#666666" }}>CBU: {c.cbu}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
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
          <div style={{ fontSize: 10, color: "#999999", letterSpacing: ".1em" }}>SALDO ACTUAL</div>
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
                  color: nuevo.tipo === t ? (t === "ingreso" ? "#2d7a4f" : "#c0392b") : "#999999", fontWeight: nuevo.tipo === t ? 600 : 400 }}>
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
            <div style={{ color: "#999999", fontSize: 12 }}>Cargando...</div>
          ) : movimientos.length === 0 ? (
            <div style={{ textAlign: "center", color: "#999999", padding: 20, fontSize: 12 }}>Sin movimientos registrados</div>
          ) : (
            <table>
              <thead><tr><th>Fecha</th><th>Concepto</th><th>Tipo</th><th>Importe</th></tr></thead>
              <tbody>
                {movimientos.slice(0, 15).map((m, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: 10, color: "#999999" }}>{new Date(m.creado_en).toLocaleDateString("es-AR")}</td>
                    <td>
                      <div style={{ fontSize: 12 }}>{m.concepto}</div>
                      {m.destino_origen && <div style={{ fontSize: 9, color: "#999999" }}>{m.destino_origen.replace(/_/g, " ")}</div>}
                    </td>
                    <td><span className={"badge " + (m.tipo === "ingreso" ? "bg" : "br")}>{m.tipo}</span></td>
                    <td style={{ color: m.tipo === "ingreso" ? "#2d7a4f" : "#c0392b", fontWeight: 600 }}>
                      {m.tipo === "ingreso" ? "+" : "-"}${parseFloat(m.importe).toLocaleString()}
                    </td>
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

function OrdenesIngreso({ localId }) {
  const [ordenes, setOrdenes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("lista");
  const [ordenDetalle, setOrdenDetalle] = useState(null);
  const [itemsDetalle, setItemsDetalle] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [nueva, setNueva] = useState({ proveedor_id: "", notas: "", items: [] });
  const [itemTemp, setItemTemp] = useState({ producto_id: "", cantidad_esperada: "", costo_unitario: "" });

  const cargar = async () => {
    setLoading(true);
    try {
      const [ordRes, prodRes, provRes] = await Promise.all([
        API.get("/ordenes-ingreso?local_id=" + (localId || 1)),
        API.get("/productos"),
        API.get("/proveedores")
      ]);
      setOrdenes(ordRes.data);
      setProductos(prodRes.data);
      setProveedores(provRes.data);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { cargar(); }, [localId]);

  const agregarItem = () => {
    if (!itemTemp.producto_id || !itemTemp.cantidad_esperada) return;
    const prod = productos.find(p => p.id === parseInt(itemTemp.producto_id));
    setNueva(n => ({ ...n, items: [...n.items, { ...itemTemp, producto_nombre: prod?.nombre || "" }] }));
    setItemTemp({ producto_id: "", cantidad_esperada: "", costo_unitario: "" });
  };

  const crearOrden = async () => {
    if (!nueva.proveedor_id || nueva.items.length === 0) return setMensaje("Selecciona proveedor y al menos un producto");
    try {
      await API.post("/ordenes-ingreso", { ...nueva, local_id: localId || 1 });
      setMensaje("Orden creada!");
      setNueva({ proveedor_id: "", notas: "", items: [] });
      setTab("lista");
      cargar();
      setTimeout(() => setMensaje(""), 3000);
    } catch (e) { setMensaje("Error al crear orden"); }
  };

  const verDetalle = async (orden) => {
    setOrdenDetalle(orden);
    const res = await API.get("/ordenes-ingreso/" + orden.id + "/items");
    setItemsDetalle(res.data.map(i => ({ ...i, cantidad_recibida: i.cantidad_recibida || 0 })));
    setTab("recibir");
  };

  const recibirMercaderia = async () => {
    try {
      await API.put("/ordenes-ingreso/" + ordenDetalle.id + "/recibir", { items: itemsDetalle });
      setMensaje("Mercaderia recibida! Stock actualizado.");
      setTab("lista");
      setOrdenDetalle(null);
      cargar();
      setTimeout(() => setMensaje(""), 3000);
    } catch (e) { setMensaje("Error al recibir"); }
  };

  return (
    <div className="fade">
      <div className="ph">
        <div><div className="pt">Ordenes de Ingreso</div><div className="ps">recepcion de mercaderia por local</div></div>
        <button className="btn btn-p btn-sm" onClick={() => setTab("nueva")}>+ Nueva orden</button>
      </div>
      {mensaje && (
        <div style={{ background: mensaje.includes("Error") ? "#c0392b12" : "#2d7a4f12", border: "1px solid " + (mensaje.includes("Error") ? "#c0392b" : "#2d7a4f"), borderRadius: 6, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: mensaje.includes("Error") ? "#c0392b" : "#2d7a4f" }}>
          {mensaje}
        </div>
      )}
      <div className="tabs">
        {["lista", "nueva"].map(t => (
          <div key={t} className={"tab " + (tab === t ? "on" : "")} onClick={() => setTab(t)}>
            {t === "lista" ? "ORDENES" : t === "nueva" ? "NUEVA ORDEN" : "RECIBIR"}
          </div>
        ))}
        {tab === "recibir" && <div className="tab on">RECIBIR MERCADERIA</div>}
      </div>
      {tab === "lista" && (
        <div className="fade">
          {loading ? (
            <div style={{ color: "#999999", padding: 20 }}>Cargando...</div>
          ) : ordenes.length === 0 ? (
            <div className="card" style={{ textAlign: "center", color: "#999999", padding: 30 }}>Sin ordenes de ingreso</div>
          ) : (
            <div className="card">
              <table>
                <thead><tr><th>ID</th><th>Proveedor</th><th>Estado</th><th>Fecha</th><th></th></tr></thead>
                <tbody>
                  {ordenes.map(o => (
                    <tr key={o.id}>
                      <td style={{ color: "#999999", fontSize: 11 }}>#{o.id}</td>
                      <td>{o.proveedor_nombre || "Sin proveedor"}</td>
                      <td><span className={"badge " + (o.estado === "recibida" ? "bg" : "ba")}>{o.estado}</span></td>
                      <td style={{ fontSize: 11, color: "#999999" }}>{new Date(o.creado_en).toLocaleDateString("es-AR")}</td>
                      <td>
                        {o.estado === "pendiente" && (
                          <button className="btn btn-p btn-sm" onClick={() => verDetalle(o)}>Recibir</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {tab === "nueva" && (
        <div className="g2 fade">
          <div className="card">
            <div className="ct">Datos de la orden</div>
            <div className="fg"><div className="fl">Proveedor</div>
              <select className="sel" value={nueva.proveedor_id} onChange={e => setNueva(n => ({ ...n, proveedor_id: e.target.value }))}>
                <option value="">Seleccionar proveedor...</option>
                {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div className="fg"><div className="fl">Notas</div>
              <input className="inp" placeholder="Observaciones..." value={nueva.notas} onChange={e => setNueva(n => ({ ...n, notas: e.target.value }))} />
            </div>
            <div className="divider" />
            <div className="ct">Agregar productos</div>
            <div className="fg"><div className="fl">Producto</div>
              <select className="sel" value={itemTemp.producto_id} onChange={e => setItemTemp(p => ({ ...p, producto_id: e.target.value }))}>
                <option value="">Seleccionar...</option>
                {productos.map(p => <option key={p.id} value={p.id}>{p.nombre} {p.marca ? "- " + p.marca : ""}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div className="fg" style={{ flex: 1 }}><div className="fl">Cantidad</div>
                <input className="inp" type="number" placeholder="10" value={itemTemp.cantidad_esperada} onChange={e => setItemTemp(p => ({ ...p, cantidad_esperada: e.target.value }))} />
              </div>
              <div className="fg" style={{ flex: 1 }}><div className="fl">Costo unit. ($)</div>
                <input className="inp" type="number" placeholder="1500" value={itemTemp.costo_unitario} onChange={e => setItemTemp(p => ({ ...p, costo_unitario: e.target.value }))} />
              </div>
            </div>
            <button className="btn btn-g btn-sm" style={{ width: "100%", marginBottom: 12 }} onClick={agregarItem}>+ Agregar producto</button>
            <button className="btn btn-p" style={{ width: "100%" }} onClick={crearOrden}>Crear orden</button>
          </div>
          <div className="card">
            <div className="ct">Productos en esta orden ({nueva.items.length})</div>
            {nueva.items.length === 0 ? (
              <div style={{ color: "#999999", fontSize: 12, textAlign: "center", padding: 20 }}>Sin productos agregados</div>
            ) : (
              <table>
                <thead><tr><th>Producto</th><th>Cant.</th><th>Costo</th></tr></thead>
                <tbody>
                  {nueva.items.map((item, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: 12 }}>{item.producto_nombre}</td>
                      <td>{item.cantidad_esperada}</td>
                      <td>{item.costo_unitario ? "$" + item.costo_unitario : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
      {tab === "recibir" && ordenDetalle && (
        <div className="card fade">
          <div className="ct">Recibir mercaderia - Orden #{ordenDetalle.id}</div>
          <div style={{ fontSize: 12, color: "#999999", marginBottom: 16 }}>
            Proveedor: {ordenDetalle.proveedor_nombre} | Fecha: {new Date(ordenDetalle.creado_en).toLocaleDateString("es-AR")}
          </div>
          <table>
            <thead><tr><th>Producto</th><th>Esperado</th><th>Recibido</th></tr></thead>
            <tbody>
              {itemsDetalle.map((item, i) => (
                <tr key={i}>
                  <td>{item.producto_nombre}</td>
                  <td style={{ color: "#c9a84c" }}>{item.cantidad_esperada}</td>
                  <td>
                    <input className="inp" type="number" style={{ width: 70, padding: "4px 8px" }}
                      value={item.cantidad_recibida}
                      onChange={e => {
                        const updated = [...itemsDetalle];
                        updated[i].cantidad_recibida = parseInt(e.target.value) || 0;
                        setItemsDetalle(updated);
                      }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button className="btn btn-g" style={{ flex: 1 }} onClick={() => { setTab("lista"); setOrdenDetalle(null); }}>Cancelar</button>
            <button className="btn btn-p" style={{ flex: 2 }} onClick={recibirMercaderia}>Confirmar recepcion y actualizar stock</button>
          </div>
        </div>
      )}
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
            <div style={{ color: "#999999", padding: 20 }}>Cargando...</div>
          ) : kits.length === 0 ? (
            <div className="card" style={{ textAlign: "center", color: "#999999", padding: 30 }}>Sin kits creados. Crea tu primer combo!</div>
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
                        {kit.descripcion && <div style={{ fontSize: 11, color: "#999999", marginTop: 2 }}>{kit.descripcion}</div>}
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
                          <span style={{ color: "#999999" }}>x{item.cantidad}</span>
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
              <div className="fl">Precio del kit ($) {precioSugerido > 0 && <span style={{ fontSize: 10, color: "#999999", marginLeft: 6 }}>Suma: ${Math.round(precioSugerido).toLocaleString()}</span>}</div>
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
              <div style={{ color: "#999999", fontSize: 12, textAlign: "center", padding: 20 }}>Sin productos agregados</div>
            ) : (
              <div>
                {form.items.map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f5f5f5" }}>
                    <div>
                      <div style={{ fontSize: 12, color: "#444444" }}>{item.producto_nombre}</div>
                      <div style={{ fontSize: 10, color: "#999999" }}>x{item.cantidad}</div>
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
  { section: "GESTION", items: [{ id: "dashboard", icon: "*", label: "Dashboard" }, { id: "pos", icon: "+", label: "Punto de Venta" }, { id: "inventory", icon: "#", label: "Inventario" }, { id: "caja", icon: "$", label: "Caja" }, { id: "ordenes", icon: "i", label: "Ingresos" }, { id: "kits", icon: "K", label: "Kits" }, { id: "clients", icon: "@", label: "Clientes" }] },
  { section: "FINANZAS", items: [{ id: "finance", icon: "%", label: "Finanzas" }, { id: "reports", icon: "~", label: "Informes" }, { id: "comisiones", icon: "c", label: "Comisiones" }, { id: "proveedores", icon: "p", label: "Proveedores" }] },
  { section: "MARKETING", items: [{ id: "cupones", icon: "k", label: "Cupones" }, { id: "fidelizacion", icon: "f", label: "Fidelizacion" }, { id: "postventa", icon: "w", label: "Postventa WA" }] },
  { section: "CLIENTE", items: [{ id: "portal", icon: "o", label: "Portal Cliente" }] },
];





// LOGIN SCREEN
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email || !password) return setError("CompletÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ todos los campos");
    setLoading(true);
    try {
      const res = await login({ email, password });
      localStorage.setItem("lumiere_token", res.data.token);
      localStorage.setItem("lumiere_user", JSON.stringify(res.data.usuario));
      onLogin(res.data.usuario);
    } catch (e) {
      setError("Email o contraseÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â±a incorrectos");
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
          <div style={{ fontSize: 9, color: "#999999", letterSpacing: ".15em", marginBottom: 5 }}>CONTRASEÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¹Ã…â€œA</div>
          <input className="inp" type="password" placeholder="ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢" value={password} onChange={e => { setPassword(e.target.value); setError(""); }} onKeyDown={e => e.key === "Enter" && handleLogin()} />
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
              <span style={{ color: "#c9a84c", fontSize: 16 }}></span>
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
      <div style={{ fontSize: 40 }}></div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#111111" }}>Sin acceso</div>
      <div style={{ fontSize: 13, color: "#999999" }}>No tenes permiso para ver esta seccion</div>
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
                    <span style={{ fontSize: 10, color: "#999999" }}>{activos}/{claves.length}</span>
                    <div onClick={() => toggleGrupo(perms)} style={{ width: 36, height: 20, borderRadius: 10, background: todosActivos ? "#c9a84c" : "#e0e0e0", cursor: "pointer", position: "relative", transition: "background .2s" }}>
                      <div style={{ position: "absolute", top: 2, left: todosActivos ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "white", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                    </div>
                  </div>
                </div>
                {perms.map(([clave, label]) => (
                  <div key={clave} onClick={() => togglePermiso(clave)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid #f5f5f5", cursor: "pointer" }}>
                    <span style={{ fontSize: 12, color: permisosUsuario.includes(clave) ? "#111111" : "#999999" }}>{label}</span>
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
        {loading ? <div style={{ color: "#999999", padding: 20 }}>Cargando...</div> : (
          <table>
            <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Local</th><th>Acciones</th></tr></thead>
            <tbody>
              {usuarios.map(u => (
                <tr key={u.id}>
                  <td style={{ color: "#111111", fontWeight: 500 }}>{u.nombre}</td>
                  <td>{u.email}</td>
                  <td><span className="badge" style={{ background: (rolColor[u.rol] || "#999999") + "15", color: rolColor[u.rol] || "#999999" }}>{rolNombre[u.rol] || u.rol}</span></td>
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
      "pos": "pos.ver", "inventory": "inventario.ver", "clients": "clientes.ver",
      "finance": "finanzas.flujo", "reports": "informes.ventas", "comisiones": "comisiones.propias",
      "proveedores": "proveedores.ver", "cupones": "cupones.ver", "fidelizacion": "fidelizacion.ver",
      "postventa": "postventa.ver", "portal": "clientes.ver", "caja": "caja.ver",
      "ordenes": "ordenes.ver", "kits": "kits.ver", "usuarios": "usuarios.ver",
      "dashboard": "pos.ver", "tiendanube": "tiendanube.ver",
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
    if (id === "caja") return <Caja localId={local.id} usuario={usuario} />;
    if (id === "ordenes") return <OrdenesIngreso localId={local.id} />;
    if (id === "kits") return <Kits />;
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
            <div style={{ marginTop: 12, fontSize: 11, color: "#999999", cursor: "pointer" }} onClick={() => setLocal(null)}>Cambiar local</div>
            <div style={{ marginTop: 6, fontSize: 11, color: "#999999", cursor: "pointer" }} onClick={handleLogout}>Cerrar sesion</div>
          </div>
        </aside>
        <main className="main">
          {getPageWithLocal(page)}
        </main>
      </div>
    </>
  );
}