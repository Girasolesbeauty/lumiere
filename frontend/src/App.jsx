import { useState, useEffect, useRef, Fragment } from "react";
import { getProductos, createVenta, getClientes, getFlujo, getPuntoEquilibrio, agregarEgreso, getResumenFinanzas, getVentas, getAlertasStock, getCupones, createCupon, updateCupon, getRanking, getReglas, createRegla as createReglaWA, updateRegla as updateReglaWA, login, register } from "./api";
import API from "./api";

const LOGO_TICKET = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAXwAAABPAQAAAADABUPQAAADzElEQVR4nO2WsW7jRhCGvx0REgMYMYGkcADD4iO4TGGc+Qh5BAF5gXuA4DwGUqSL3yB+FPouRbq4Sk0dXLikAwGhFJKTYklqSelyKVJ6CmkxO//MP7s7M3RG81XJf5YXgR9fMnhJWLsYoBGAdQTwICNrcwpWwcKsPLUCrs2scmZmcGPWwrWZXpsVwI2VnJZCBbvexWO/aOAedoHGb28Q7sC001RAZUANJTzDJgTkNEi3OpQNFNCGKgUVFCg6zQ4oUXiGFnKwMGcglwagDFS9CKj3OhKB07pbnxb00YpFGWHMipBtyzuyaMPbmf4CQHKBapfR2UlMy9VFz3ZZQONu5a2Akq281gWhZ5fU5E7LvaoWvkdKB5chyZwCSA/IA/A1why+6DcVIPXrDBysqhEgRgpgHuo061lUc0imMYR4qlLwZ1XGENdTQH7gI6nY38xIWkCmSjtiOKaUTrz4qvgTKBKIgscUWTaNoADUkFp2zPlvIAQ7IZ1fx8Zr54CtIgpb57zrFqWWqIUzGoV0zMDB3ZjSposMHK8RqhFgnQBE3c/jobmymyTtoAKDmS/XiaywCUA8SiFnesXAGegYcOLfA/DtuJq9LJRctGM3SAJ077GYNAEyEHIWg/bSo3NwxfiNLM2AKwoZOkbnslj7Szk7ZAQz9Wl2EZY5/vgLzyktoR4nmSFDucDoUTuOSVpKuJtWPv0eVx3cRoJQMRx5Mt2lu/hAJK33bvb16LOqJ5WXA0ILHTGi1r/wir8xiBu4D0v+O8pEElPue40BZmXNcwZEKBrQtAqQmHvTjqigLRBD8bgDuGtCRu2OeyTieRe2Gn9geVU5hGpDCg9OWTuntakiwjbuj8d1VdPCNgHHNgkruOKWVBwM3RGlFoi6VzadD3FHGwY32WPlc097WHjhcyATVuB6N95O4AxiuBy3XQeokIStob/CCBKIGXdexSGcwEmvSbqb1RmsYD4ZHSvmYKbc2IEUMzOz3JmZwk0B3FjNsnSfa74TeTno3p+TV8Ar4BXwfwBicJMJ4Rvr8ycAW+3+G906nj4CT2njlG/ABQ1tTymHfV/6UoAiBQwd9cthIl3AsvtgWvxM/Mc5LHI+XDVvcs5zrg8jAPsmayNVaDQBnPeLmG5W1rdjiwHwMWNNm/RMM4LvjBbeH48wTFFJgKUnWPCU7U0GwEXOEt6N+BUApKC8+UQOPSXScC/8UPm3p+EAokm3HgO2f8EPOrbIIApU+1OCNaDRT8PeAwDvM8iPnVIGECHBGEzxU3MWRjyYPb8PqxczM/tgtlya63TlPz7qiaBHsxEpAAAAAElFTkSuQmCC";

// Formato de moneda argentino: $10.000,00 (punto de miles, coma decimal, 2 decimales)
const fmt = (n) => "$" + (parseFloat(n) || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Formato de numero sin signo $ (para cantidades)
const fmtNum = (n) => (parseFloat(n) || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
@keyframes fadeUp { from { opacity: 0; } to { opacity: 1; } }
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
  const cls = tier === "Black" ? "bp" : tier === "Platinum" ? "bp" : tier === "Gold" ? "ba" : tier === "Silver" ? "bb" : "bx";
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
      const [ventasRes, prodRes, clientesRes, finRes, factExtRes] = await Promise.all([
        API.get("/ventas?" + params),
        API.get("/productos"),
        API.get("/clientes"),
        API.get("/finanzas/flujo?" + params).catch(() => ({ data: { resumen: { ingresos: 0, egresos: 0, neto: 0 } } })),
        API.get("/finanzas/facturacion-externa?" + params).catch(() => ({ data: { total: 0 } }))
      ]);
      const ventas = ventasRes.data || [];
      const productos = prodRes.data || [];
      const clientes = clientesRes.data || [];
      const fin = finRes.data?.resumen || { ingresos: 0, egresos: 0, neto: 0 };

      const factExterna = parseFloat(factExtRes?.data?.total || 0);
      const totalVentas = ventas.reduce((s, v) => s + parseFloat(v.total || 0), 0) + factExterna;
      const cantVentas = ventas.length;
      const ticketProm = cantVentas > 0 ? (totalVentas - factExterna) / cantVentas : 0;
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
              <div style={{ fontSize: 11, color: "#666666", marginTop: 2 }}>Total adeudado: {fmt(totalAdeudado)} - revisalo en Proveedores</div>
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
            <KPI titulo="Ventas del mes" valor={fmt(Math.round(data.totalVentas))} sub={data.cantVentas + " transacciones"} color="#2d7a4f" />
            <KPI titulo="Resultado neto" valor={fmt(Math.round(data.fin.neto || 0))} sub={"Ingresos - Egresos"} color={data.fin.neto >= 0 ? "#2d7a4f" : "#c0392b"} alerta={data.fin.neto < 0} />
            <KPI titulo="Margen bruto" valor={data.margenBruto + "%"} sub="sobre costo de ventas" color={data.margenBruto >= 40 ? "#2d7a4f" : data.margenBruto >= 20 ? "#e67e22" : "#c0392b"} />
          </div>
          <div className="g3" style={{ marginBottom: 20 }}>
            <KPI titulo="Ticket promedio" valor={fmt(Math.round(data.ticketProm))} sub="por transaccion" color="#2471a3" />
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
                { l: "Ticket promedio", v: data.ticketProm, ok: 5000, alerta: 2000, fmt: v => fmt(Math.round(v)) },
                { l: "Resultado neto", v: data.fin.neto, ok: 1, alerta: 0, fmt: v => fmt(Math.round(v)) },
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
                      <td style={{ color: "#2d7a4f", fontWeight: 600 }}>{fmt(parseFloat(v.total || 0))}</td>
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

function VentasOnline({ localId, usuario }) {
  const [productos, setProductos] = useState([]);
  const [mediosPago, setMediosPago] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [cart, setCart] = useState([]);
  const [medioPagoId, setMedioPagoId] = useState("");
  const [pagoMixto, setPagoMixto] = useState(false);
  const [pagosMixtos, setPagosMixtos] = useState([]); // [{medio_pago_id, medio_pago_nombre, importe}]
  const [referencia, setReferencia] = useState("");
  const [fechaVenta, setFechaVenta] = useState(() => new Date().toISOString().slice(0, 10));
  const [clientes, setClientes] = useState([]);
  const [buscarCli, setBuscarCli] = useState("");
  const [cliSel, setCliSel] = useState(null);
  const [ventasOnlineList, setVentasOnlineList] = useState([]);
  const [editandoVO, setEditandoVO] = useState(null);
  const [voTotal, setVoTotal] = useState("");
  const [voFecha, setVoFecha] = useState("");
  const [voLocal, setVoLocal] = useState("1");
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const localParam = Number(localId) === 2 ? "ush" : "rg";
    API.get("/productos?local=" + localParam).then(res => setProductos(res.data)).catch(() => {});
    API.get("/clientes").then(res => setClientes(res.data)).catch(() => {});
    cargarVentasOnline();
    API.get("/medios-pago").then(res => setMediosPago(res.data)).catch(() => {});
  }, [localId]);

  const filtrados = busqueda.trim().length > 0
    ? productos.filter(p => (p.nombre || "").toLowerCase().includes(busqueda.toLowerCase()) || (p.codigo_barras || "").includes(busqueda)).slice(0, 8)
    : [];

  const add = (p) => {
    setCart(prev => {
      const e = prev.find(i => i.id === p.id);
      return e ? prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i) : [...prev, { ...p, qty: 1 }];
    });
    setBusqueda("");
  };
  const cambiarQty = (id, d) => setCart(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(1, i.qty + d) } : i));
  const cambiarPrecio = (id, v) => setCart(prev => prev.map(i => i.id === id ? { ...i, precio: v, price: v } : i));
  const remove = (id) => setCart(prev => prev.filter(i => i.id !== id));



  const total = cart.reduce((s, i) => s + (i.precio || i.price || 0) * i.qty, 0);

  const esJefe = usuario?.rol === "jefe" || usuario?.rol === "admin";

  const eliminarVentaOnline = async (v) => {
    if (!confirm("Eliminar la venta " + v.numero_factura + "? Se revierte el stock y se saca del cierre.")) return;
    try {
      await API.delete("/ventas/online/" + v.id);
      cargarVentasOnline();
    } catch (e) { alert("Error al eliminar: " + (e?.response?.data?.error || "")); }
  };

  const abrirEditarVO = (v) => {
    setEditandoVO(v);
    setVoTotal(String(v.total));
    setVoFecha(String(v.creado_en).slice(0, 10));
    setVoLocal(String(v.local_id));
  };

  const guardarEditarVO = async () => {
    try {
      await API.put("/ventas/online/" + editandoVO.id, {
        total: parseFloat(voTotal),
        local_id: Number(voLocal),
        fecha: voFecha
      });
      setEditandoVO(null);
      cargarVentasOnline();
    } catch (e) { alert("Error al editar: " + (e?.response?.data?.error || "")); }
  };

  const cargarVentasOnline = () => {
    const hoy = new Date();
    const m = hoy.getMonth() + 1, a = hoy.getFullYear();
    API.get("/ventas?mes=" + m + "&anio=" + a + "&local_id=" + (localId || 1))
      .then(res => setVentasOnlineList((res.data || []).filter(v => v.canal === "online")))
      .catch(() => {});
  };

  const registrar = async () => {
    if (cart.length === 0) return setMensaje("Agrega al menos un producto");
    let medioPagoIdFinal = null, medioPagoNombreFinal = null, pagosFinal = undefined;
    if (pagoMixto) {
      if (pagosMixtos.length === 0 || pagosMixtos.some(p => !p.medio_pago_id)) return setMensaje("Elegi el medio de pago en cada linea del pago dividido");
      const suma = pagosMixtos.reduce((s, p) => s + (parseFloat(p.importe) || 0), 0);
      if (Math.abs(suma - total) >= 1) return setMensaje("La suma de los pagos (" + fmt(suma) + ") no coincide con el total (" + fmt(total) + ")");
      medioPagoIdFinal = pagosMixtos[0].medio_pago_id || null;
      medioPagoNombreFinal = pagosMixtos.map(p => p.medio_pago_nombre).join(" + ");
      pagosFinal = pagosMixtos;
    } else {
      if (!medioPagoId) return setMensaje("Elegi el medio de pago");
      const m = mediosPago.find(x => String(x.id) === String(medioPagoId));
      medioPagoIdFinal = m?.id || null;
      medioPagoNombreFinal = m?.nombre || null;
    }
    setGuardando(true);
    try {
      const items = cart.map(i => ({ producto_id: i.id, cantidad: i.qty, precio_unitario: i.precio || i.price || 0 }));
      await API.post("/ventas/online", {
        items, total,
        medio_pago_id: medioPagoIdFinal,
        medio_pago_nombre: medioPagoNombreFinal,
        pagos: pagosFinal,
        local_id: Number(localId) === 2 ? 2 : 1,
        usuario_id: usuario?.id || null,
        referencia: referencia || null,
        fecha: fechaVenta || null,
        cliente_id: cliSel?.id || null
      });
      setMensaje("Venta online registrada! Se sumo al cierre y se desconto del stock (sin facturar).");
      setCart([]); setMedioPagoId(""); setPagoMixto(false); setPagosMixtos([]); setReferencia(""); setCliSel(null); setBuscarCli(""); cargarVentasOnline();
      const localParam = Number(localId) === 2 ? "ush" : "rg";
      API.get("/productos?local=" + localParam).then(res => setProductos(res.data)).catch(() => {});
      setTimeout(() => setMensaje(""), 4000);
    } catch (e) {
      setMensaje("Error: " + (e?.response?.data?.error || "no se pudo registrar"));
    }
    setGuardando(false);
  };

  return (
    <div className="fade">
      <div className="ph">
        <div><div className="pt">Ventas Online</div><div className="ps">cargar ventas de la tienda (ya facturadas) - descuentan stock y suman al cierre</div>
      <div style={{ background: Number(localId) === 2 ? "#2471a315" : "#c9a84c15", color: Number(localId) === 2 ? "#2471a3" : "#c9a84c", padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: 13, fontWeight: 600, textAlign: "center" }}>
        Cargando ventas en: {Number(localId) === 2 ? "USHUAIA" : "RIO GRANDE"}
      </div></div>
      </div>

      {mensaje && <div className="card" style={{ marginBottom: 12, padding: 12, background: mensaje.startsWith("Error") ? "#fdecea" : "#eafaf1", color: mensaje.startsWith("Error") ? "#c0392b" : "#1e7e4f", fontSize: 13 }}>{mensaje}</div>}

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 340px" }}>
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Buscar producto</div>
            <input className="inp" placeholder="Nombre o codigo de barras" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            {filtrados.length > 0 && (
              <div style={{ marginTop: 8, border: "1px solid #eee", borderRadius: 6 }}>
                {filtrados.map(p => (
                  <div key={p.id} onClick={() => add(p)} style={{ padding: "8px 10px", cursor: "pointer", borderBottom: "1px solid #f2f2f2", fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                    <span>{p.nombre}</span>
                    <span style={{ color: "#888" }}>{fmt(p.precio || p.price || 0)} · stock {Number(localId) === 2 ? (p.stock_ush || 0) : (p.stock_rg || 0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ flex: "1 1 340px" }}>
          <div className="card">
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Productos de la venta</div>
            {cart.length === 0 ? <div style={{ fontSize: 12, color: "#999", padding: "12px 0" }}>Todavia no agregaste productos</div> : cart.map(i => (
              <div key={i.id} style={{ background: "#fff", border: "1px solid #eee", borderRadius: 6, padding: "8px 10px", marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{i.nombre || i.name}</span>
                  <span onClick={() => remove(i.id)} style={{ cursor: "pointer", color: "#ccc", fontSize: 16 }}>x</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={() => cambiarQty(i.id, -1)} style={{ width: 24, height: 24, borderRadius: 4, border: "1px solid #e8e8e8", background: "#f7f7f7", cursor: "pointer", fontWeight: 700 }}>−</button>
                  <span style={{ minWidth: 22, textAlign: "center", fontSize: 13 }}>{i.qty}</span>
                  <button onClick={() => cambiarQty(i.id, 1)} style={{ width: 24, height: 24, borderRadius: 4, border: "1px solid #e8e8e8", background: "#f7f7f7", cursor: "pointer", fontWeight: 700 }}>+</button>
                  <span style={{ fontSize: 9, color: "#999", marginLeft: 4 }}>$</span>
                  <input type="number" value={i.precio || i.price || ""} onChange={e => cambiarPrecio(i.id, parseFloat(e.target.value) || 0)} style={{ width: 80, fontSize: 11, padding: "4px 6px", border: "1px solid #e8e8e8", borderRadius: 4, textAlign: "right" }} />
                  <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 600 }}>{fmt((i.precio || i.price || 0) * i.qty)}</span>
                </div>
              </div>
            ))}

            <div style={{ borderTop: "1px solid #eee", marginTop: 10, paddingTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, marginBottom: 10 }}>
                <span>Total</span><span>{fmt(total)}</span>
              </div>
              <div className="fg" style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <div className="fl" style={{ marginBottom: 0 }}>{pagoMixto ? "Pago dividido" : "Medio de pago"}</div>
                  <button type="button" onClick={() => { setPagoMixto(!pagoMixto); if (!pagoMixto) { setPagosMixtos([{ medio_pago_id: null, medio_pago_nombre: "", importe: "" }]); } else { setPagosMixtos([]); } }} style={{ fontSize: 10, padding: "2px 8px", border: "1px solid #c9a84c", borderRadius: 4, background: pagoMixto ? "#c9a84c" : "#fff", color: pagoMixto ? "#fff" : "#c9a84c", cursor: "pointer" }}>{pagoMixto ? "Pago simple" : "Dividir pago"}</button>
                </div>

                {!pagoMixto && (
                  <select className="inp" value={medioPagoId} onChange={e => setMedioPagoId(e.target.value)}>
                    <option value="">Seleccionar...</option>
                    {mediosPago.map(m => (<option key={m.id} value={m.id}>{m.nombre}</option>))}
                  </select>
                )}

                {pagoMixto && (
                  <div>
                    {pagosMixtos.map((pg, idx) => (
                      <div key={idx} style={{ display: "flex", gap: 4, marginBottom: 4, alignItems: "center" }}>
                        <select className="sel" style={{ fontSize: 11, padding: "6px", flex: 1 }} value={pg.medio_pago_id || ""} onChange={e => {
                          const m = mediosPago.find(x => x.id === parseInt(e.target.value));
                          setPagosMixtos(prev => prev.map((x, i) => i === idx ? { ...x, medio_pago_id: m?.id || null, medio_pago_nombre: m?.nombre || "" } : x));
                        }}>
                          <option value="">Medio...</option>
                          {mediosPago.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                        </select>
                        <input type="number" placeholder="$" value={pg.importe} onChange={e => setPagosMixtos(prev => prev.map((x, i) => i === idx ? { ...x, importe: e.target.value } : x))} style={{ width: 90, fontSize: 11, padding: "6px", border: "1px solid #e8e8e8", borderRadius: 4, textAlign: "right" }} />
                        {pagosMixtos.length > 1 && <span onClick={() => setPagosMixtos(prev => prev.filter((_, i) => i !== idx))} style={{ cursor: "pointer", color: "#ccc", fontSize: 16 }}>×</span>}
                      </div>
                    ))}
                    <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                      <button type="button" onClick={() => setPagosMixtos(prev => [...prev, { medio_pago_id: null, medio_pago_nombre: "", importe: "" }])} style={{ fontSize: 10, padding: "4px 8px", border: "1px dashed #c9a84c", borderRadius: 4, background: "#fff", color: "#c9a84c", cursor: "pointer", flex: 1 }}>+ Agregar medio</button>
                      <button type="button" onClick={() => { const n = pagosMixtos.length || 1; const parte = Math.round((total / n) * 100) / 100; setPagosMixtos(prev => prev.map(x => ({ ...x, importe: String(parte) }))); }} style={{ fontSize: 10, padding: "4px 8px", border: "1px solid #e8e8e8", borderRadius: 4, background: "#f7f7f7", cursor: "pointer", flex: 1 }}>Dividir igual</button>
                    </div>
                    {(() => {
                      const suma = pagosMixtos.reduce((s, p) => s + (parseFloat(p.importe) || 0), 0);
                      const dif = total - suma;
                      return <div style={{ fontSize: 10, textAlign: "right", color: Math.abs(dif) < 1 ? "#2d7a4f" : "#c0392b" }}>Suma: {fmt(suma)} / Total: {fmt(total)} {Math.abs(dif) >= 1 ? "(falta " + fmt(dif) + ")" : "✓"}</div>;
                    })()}
                  </div>
                )}
              </div>
              <div className="fg" style={{ marginBottom: 8 }}>
                <div className="fl">Clienta (opcional, para sumar puntos)</div>
                {cliSel ? (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "#f7f5f0", borderRadius: 6 }}>
                    <span style={{ fontSize: 12 }}>{cliSel.nombre} {cliSel.cuit_dni ? "(" + cliSel.cuit_dni + ")" : ""}</span>
                    <span onClick={() => { setCliSel(null); setBuscarCli(""); }} style={{ cursor: "pointer", color: "#c9a84c", fontSize: 12 }}>quitar</span>
                  </div>
                ) : (
                  <div>
                    <input className="inp" placeholder="Buscar por nombre o DNI" value={buscarCli} onChange={e => setBuscarCli(e.target.value)} />
                    {buscarCli.trim().length > 0 && (
                      <div style={{ border: "1px solid #eee", borderRadius: 6, marginTop: 4, maxHeight: 160, overflowY: "auto" }}>
                        {clientes.filter(cl => (cl.nombre || "").toLowerCase().includes(buscarCli.toLowerCase()) || (cl.cuit_dni || "").includes(buscarCli)).slice(0, 6).map(cl => (
                          <div key={cl.id} onClick={() => { setCliSel(cl); setBuscarCli(""); }} style={{ padding: "8px 10px", cursor: "pointer", borderBottom: "1px solid #f2f2f2", fontSize: 12 }}>{cl.nombre} <span style={{ color: "#999" }}>{cl.cuit_dni ? "(" + cl.cuit_dni + ")" : ""}</span></div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="fg" style={{ marginBottom: 8 }}>
                <div className="fl">Fecha de la venta (dia / mes / año)</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {(() => {
                    const partes = (fechaVenta || "").split("-"); // [YYYY, MM, DD]
                    const anioSel = partes[0] || String(new Date().getFullYear());
                    const mesSel = partes[1] || "01";
                    const diaSel = partes[2] || "01";
                    const setParte = (tipo, val) => {
                      let a = anioSel, m = mesSel, d = diaSel;
                      if (tipo === "d") d = val;
                      if (tipo === "m") m = val;
                      if (tipo === "a") a = val;
                      // Ajustar dia maximo del mes
                      const maxDia = new Date(parseInt(a), parseInt(m), 0).getDate();
                      if (parseInt(d) > maxDia) d = String(maxDia).padStart(2, "0");
                      setFechaVenta(a + "-" + m + "-" + d);
                    };
                    const anioActual = new Date().getFullYear();
                    return (
                      <>
                        <select className="inp" style={{ flex: 1 }} value={diaSel} onChange={e => setParte("d", e.target.value)}>
                          {Array.from({ length: 31 }, (_, k) => String(k + 1).padStart(2, "0")).map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <select className="inp" style={{ flex: 1 }} value={mesSel} onChange={e => setParte("m", e.target.value)}>
                          {[["01","Ene"],["02","Feb"],["03","Mar"],["04","Abr"],["05","May"],["06","Jun"],["07","Jul"],["08","Ago"],["09","Sep"],["10","Oct"],["11","Nov"],["12","Dic"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                        <select className="inp" style={{ flex: 1 }} value={anioSel} onChange={e => setParte("a", e.target.value)}>
                          {[anioActual - 1, anioActual, anioActual + 1].map(a => <option key={a} value={String(a)}>{a}</option>)}
                        </select>
                      </>
                    );
                  })()}
                </div>
              </div>
              <div className="fg" style={{ marginBottom: 10 }}>
                <div className="fl">Referencia (opcional)</div>
                <input className="inp" placeholder="Ej: pedido #123 Tiendanube" value={referencia} onChange={e => setReferencia(e.target.value)} />
              </div>
              <button className="btn btn-p" style={{ width: "100%" }} disabled={guardando} onClick={registrar}>{guardando ? "Registrando..." : "Registrar venta online"}</button>
              <div style={{ fontSize: 10, color: "#888", marginTop: 8, textAlign: "center" }}>No se factura en ARCA (ya facturada en la tienda). Descuenta del stock de {Number(localId) === 2 ? "Ushuaia" : "Rio Grande"}.</div>
            </div>
          </div>
        </div>
      </div>
    
      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Ventas online de este mes ({ventasOnlineList.length})</div>
        {ventasOnlineList.length === 0 ? <div style={{ fontSize: 12, color: "#999" }}>No hay ventas online este mes.</div> : (
          <table style={{ width: "100%", fontSize: 12 }}>
            <thead><tr style={{ color: "#888", textAlign: "left" }}><th style={{ padding: "6px 0" }}>Numero</th><th>Fecha</th><th style={{ textAlign: "right" }}>Total</th>{esJefe && <th></th>}</tr></thead>
            <tbody>
              {ventasOnlineList.map(v => (
                <tr key={v.id} style={{ borderTop: "1px solid #f0f0f0" }}>
                  <td style={{ padding: "7px 0" }}>{v.numero_factura}</td>
                  <td>{v.creado_en ? String(v.creado_en).slice(8, 10) + "/" + String(v.creado_en).slice(5, 7) + "/" + String(v.creado_en).slice(0, 4) : "-"}</td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>{fmt(parseFloat(v.total))}</td>
                  {esJefe && (
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <span onClick={() => abrirEditarVO(v)} style={{ cursor: "pointer", color: "#c9a84c", fontSize: 11, marginRight: 8 }}>editar</span>
                      <span onClick={() => eliminarVentaOnline(v)} style={{ cursor: "pointer", color: "#c0392b", fontSize: 11 }}>eliminar</span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    
      {editandoVO && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setEditandoVO(null)}>
          <div className="card" style={{ width: 400, maxWidth: "92vw" }} onClick={e => e.stopPropagation()}>
            <div className="ct">Editar venta online {editandoVO.numero_factura}</div>
            <div className="fg" style={{ marginBottom: 8 }}>
              <div className="fl">Total ($)</div>
              <input className="inp" type="number" value={voTotal} onChange={e => setVoTotal(e.target.value)} />
            </div>
            <div className="fg" style={{ marginBottom: 8 }}>
              <div className="fl">Fecha</div>
              <input className="inp" type="date" value={voFecha} onChange={e => setVoFecha(e.target.value)} />
            </div>
            <div className="fg" style={{ marginBottom: 12 }}>
              <div className="fl">Local</div>
              <select className="sel" value={voLocal} onChange={e => setVoLocal(e.target.value)}>
                <option value="1">Rio Grande</option>
                <option value="2">Ushuaia</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-p" style={{ flex: 1 }} onClick={guardarEditarVO}>Guardar</button>
              <button className="btn btn-g" style={{ flex: 1 }} onClick={() => setEditandoVO(null)}>Cancelar</button>
            </div>
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
  const [kitsPos, setKitsPos] = useState([]);
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
  const [referenciaVenta, setReferenciaVenta] = useState("");
  const [tipoDescuento, setTipoDescuento] = useState("%");
  const [medioPagoSel, setMedioPagoSel] = useState(null);
  const [pagoMixto, setPagoMixto] = useState(false);
  const [pagosMixtos, setPagosMixtos] = useState([]); // [{medio_pago_id, medio_pago_nombre, importe}]
  const [insumosPos, setInsumosPos] = useState([]);
  const [insumosPosActivo, setInsumosPosActivo] = useState(false);
  const [insumosSel, setInsumosSel] = useState({});
  const [mostrarInsumos, setMostrarInsumos] = useState(false);
  const [ultimoRecibo, setUltimoRecibo] = useState(null);
  const [ventaPendienteArca, setVentaPendienteArca] = useState(null);
  const [promociones, setPromociones] = useState([]);
  const [configTicket, setConfigTicket] = useState({ mostrar_cliente: true, mostrar_numero: true, mostrar_fecha: true, mensaje_pie: "Gracias por tu compra!", texto_extra: "" });
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
      setPreventasPendientes((res.data || []).filter(v => v.estado_pago !== "cancelada" && v.estado_pago !== "confirmada"));
    } catch (e) {}
  };

  useEffect(() => {
    const localParam = localId === 2 ? "ush" : "rg";
    API.get("/productos?local=" + localParam).then(res => setProductos(res.data)).catch(() => setProductos(PRODUCTS));
    API.get("/kits").then(res => setKitsPos(res.data || [])).catch(() => {});
    API.get("/medios-pago").then(res => setMediosPago(res.data)).catch(() => setMediosPago([]));
    API.get("/insumos/para-pos?local_id=" + (localId || 1)).then(res => { setInsumosPos(res.data?.insumos || []); setInsumosPosActivo(res.data?.activo === true); }).catch(() => { setInsumosPos([]); setInsumosPosActivo(false); });
    API.get("/config-ticket").then(res => { if (res.data) setConfigTicket(res.data); }).catch(() => {});
    API.get("/promociones?activas=true&vigentes=true").then(res => setPromociones(res.data || [])).catch(() => setPromociones([]));
    cargarPreventas();
  }, [localId]);

  const onEscaneo = (e) => {
    if (e.key !== "Enter") return;
    const cod = busqueda.trim();
    if (!cod) return;
    const lista = productos.length > 0 ? productos : PRODUCTS;
    // Buscar por codigo de barras exacto (lo que manda el escaner)
    const exacto = lista.find(p => (p.codigo_barras || p.codigo || "").toString() === cod);
    if (exacto) {
      add(exacto);
      setBusqueda("");
    }
  };

  const add = (p) => setCart(prev => {
    const e = prev.find(i => i.id === p.id);
    return e ? prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i) : [...prev, { ...p, qty: 1 }];
  });
  const remove = (id) => setCart(prev => prev.filter(i => i.id !== id));

  const agregarAjusteDiferencia = () => {
    const montoStr = prompt("Monto de la diferencia a facturar ($):");
    if (!montoStr) return;
    const monto = parseFloat(montoStr);
    if (isNaN(monto) || monto <= 0) { alert("Monto invalido"); return; }
    const ref = prompt("Referencia (ej: Diferencia pedido ON-0105):") || "";
    setCart(prev => [...prev, {
      id: "ajuste-" + Date.now(),
      es_ajuste: true,
      nombre: "Diferencia pedido online" + (ref ? " (" + ref + ")" : ""),
      precio: monto,
      qty: 1,
      disponible: 9999
    }]);
    if (ref) setReferenciaVenta(ref);
  };

  // Expande los kits en sus productos componentes (para descontar stock real).
  // El precio del kit (con descuento) se reparte proporcional entre los componentes.
  const expandirItemsCart = () => {
    const out = [];
    for (const it of cart) {
      const precioFinal = (it.precio || it.price || 0) * (1 - (it.descuento_pct || 0) / 100);
      if (it.es_kit && Array.isArray(it.kit_items) && it.kit_items.length > 0) {
        const comps = it.kit_items.map(ki => {
          const prod = productos.find(p => String(p.id) === String(ki.producto_id)) || {};
          return { producto_id: ki.producto_id, cant: (ki.cantidad || 1), base: (parseFloat(prod.precio || prod.price || 0)) * (ki.cantidad || 1) };
        });
        const sumaBase = comps.reduce((s, x) => s + x.base, 0) || 1;
        for (const cmp of comps) {
          const precioUnitComp = (precioFinal * (cmp.base / sumaBase)) / cmp.cant;
          out.push({ producto_id: cmp.producto_id, cantidad: cmp.cant * it.qty, precio_unitario: precioUnitComp });
        }
      } else if (it.es_ajuste) {
        out.push({ producto_id: null, cantidad: it.qty, precio_unitario: precioFinal });
      } else {
        out.push({ producto_id: it.id, cantidad: it.qty, precio_unitario: precioFinal });
      }
    }
    return out;
  };

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

  // ===== MOTOR DE PROMOCIONES =====
  // Determina el "tipo" de medio de pago elegido (para promos condicionadas)
  const medioPagoTipoActual = (() => {
    if (!medioPagoSel) return null;
    const n = (medioPagoSel.nombre || "").toLowerCase();
    if (n.includes("efectivo")) return "efectivo";
    if (n.includes("transfer")) return "transferencia";
    if (n.includes("debito") || n.includes("débito")) return "debito";
    if (n.includes("credito") || n.includes("crédito") || n.includes("cuota")) return "credito";
    return null;
  })();

  const precioItem = (i) => (i.precio || i.price || 0) * (1 - (i.descuento_pct || 0) / 100);
  const itemAplica = (promo, i) => {
    if (promo.aplica_a === "todo") return true;
    if (promo.aplica_a === "categorias") return (promo.categorias || []).includes(i.categoria);
    if (promo.aplica_a === "productos") return (promo.productos_ids || []).map(Number).includes(i.id);
    return false;
  };

  // Calcula el descuento total de promos y arma avisos de cross-selling
  const promoCalc = (() => {
    let totalDesc = 0;
    const aplicadas = [];
    const avisos = [];
    const subBase = cart.reduce((s, i) => s + precioItem(i) * i.qty, 0);

    for (const promo of promociones) {
      // Filtro por medio de pago (si la promo lo exige)
      if (promo.medio_pago_tipo && promo.medio_pago_tipo !== medioPagoTipoActual) continue;
      let desc = 0;

      if (promo.tipo === "descuento") {
        const base = cart.filter(i => itemAplica(promo, i)).reduce((s, i) => s + precioItem(i) * i.qty, 0);
        if (base > 0) desc = base * (parseFloat(promo.valor) / 100);
      }

      else if (promo.tipo === "monto") {
        if (subBase >= parseFloat(promo.monto_minimo || 0) && parseFloat(promo.monto_minimo || 0) > 0) {
          desc = subBase * (parseFloat(promo.valor) / 100);
        }
      }

      else if (promo.tipo === "nxm") {
        const nx = parseInt(promo.nx), ny = parseInt(promo.ny);
        if (nx > 0 && ny > 0 && nx > ny) {
          const elegibles = cart.filter(i => itemAplica(promo, i));
          if (promo.mismo_producto) {
            for (const i of elegibles) {
              const grupos = Math.floor(i.qty / nx);
              const gratisPorGrupo = nx - ny;
              desc += grupos * gratisPorGrupo * precioItem(i);
            }
          } else {
            const totalUnid = elegibles.reduce((s, i) => s + i.qty, 0);
            const grupos = Math.floor(totalUnid / nx);
            const gratis = grupos * (nx - ny);
            // los mas baratos gratis
            const expandido = [];
            elegibles.forEach(i => { for (let k = 0; k < i.qty; k++) expandido.push(precioItem(i)); });
            expandido.sort((a, b) => a - b);
            for (let k = 0; k < gratis && k < expandido.length; k++) desc += expandido[k];
          }
        }
      }

      else if (promo.tipo === "cross") {
        const tieneDisparador = cart.some(i => i.id === parseInt(promo.cross_producto_id));
        const itemRegalo = cart.find(i => i.id === parseInt(promo.cross_producto_regalo_id));
        if (tieneDisparador && itemRegalo) {
          desc = precioItem(itemRegalo) * (parseFloat(promo.valor) / 100);
        } else if (tieneDisparador && !itemRegalo) {
          const prodRegalo = promo.cross_producto_regalo_id;
          avisos.push({ promo: promo.nombre, valor: promo.valor, productoId: prodRegalo });
        }
      }

      if (desc > 0) {
        // Regla de combinacion: si NO es combinable, compite; nos quedamos con el mejor set despues.
        aplicadas.push({ promo, desc, combinable: promo.combinable === true });
      }
    }

    // Combinables se suman siempre. No combinables: solo la mejor entre las no combinables.
    const combinables = aplicadas.filter(a => a.combinable);
    const noComb = aplicadas.filter(a => !a.combinable);
    let sumaComb = combinables.reduce((s, a) => s + a.desc, 0);
    let mejorNoComb = noComb.reduce((m, a) => a.desc > m ? a.desc : m, 0);
    totalDesc = sumaComb + mejorNoComb;

    const usadas = [...combinables.map(a => a.promo.nombre)];
    if (mejorNoComb > 0) {
      const gan = noComb.find(a => a.desc === mejorNoComb);
      if (gan) usadas.push(gan.promo.nombre);
    }
    return { totalDesc, avisos, usadas };
  })();

  const coef = medioPagoSel ? parseFloat(medioPagoSel.coeficiente) : 1;
  const subtotalBase = cart.reduce((s, i) => s + (i.precio || i.price) * i.qty * (1 - (i.descuento_pct || 0) / 100), 0);
  const descuentoCupon = cuponAplicado ? (cuponAplicado.tipo === "%" ? subtotalBase * (cuponAplicado.valor / 100) : cuponAplicado.valor) : 0;
  const descuentoManualCalc = descuentoManual ? (tipoDescuento === "%" ? subtotalBase * (parseFloat(descuentoManual) / 100) : parseFloat(descuentoManual)) : 0;
  const descuentoPromos = promoCalc.totalDesc;
  const descuento = descuentoCupon + descuentoManualCalc + descuentoPromos;
  const subtotalConDesc = subtotalBase - descuento;
  const total = Math.round(subtotalConDesc * coef);
  const intereses = total - subtotalConDesc;
  const montoAplicadoGC = giftCardAplicada ? Math.min(parseFloat(giftCardAplicada.saldo), total) : 0;
  // Si la gift card es de migracion (ya facturada en el sistema viejo), esa parte NO se factura de nuevo en ARCA.
  const montoGCMigracion = (giftCardAplicada && giftCardAplicada.es_migracion) ? montoAplicadoGC : 0;
  const totalAFacturar = Math.max(total - montoGCMigracion, 0);
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
      const res = await API.get("/clientes");
      const dniLimpio = (dni || "").replace(/[^0-9]/g, "");
      const encontrado = res.data.find(c => (c.cuit_dni || "").replace(/[^0-9]/g, "") === dniLimpio);
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

  const imprimirRecibo = (datos) => {
    const localNombre = localId === 2 ? "Ushuaia" : "Rio Grande";
    const fecha = new Date().toLocaleString("es-AR");
    const cfg = configTicket || {};
    const lineas = datos.items.map(i =>
      `<tr><td style="text-align:left">${i.cantidad}x ${i.nombre}</td><td style="text-align:right">$${(i.precio_unitario * i.cantidad).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>`
    ).join("");
    const html = `
      <html><head><meta charset="utf-8"><style>
        @page { size: 80mm auto; margin: 0; }
        body { width: 72mm; margin: 0 auto; font-family: monospace; font-size: 12px; color: #000; padding: 6px; }
        .c { text-align: center; }
        .b { font-weight: bold; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 1px 0; font-size: 12px; }
        hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
        .tot { font-size: 15px; font-weight: bold; }
        img.logo { width: 60mm; display: block; margin: 0 auto 4px; }
      </style></head><body>
        <img class="logo" src="${LOGO_TICKET}" />
        <div class="c">${localNombre}</div>
        ${cfg.mostrar_fecha !== false ? `<div class="c" style="font-size:10px">${fecha}</div>` : ""}
        ${(cfg.mostrar_numero !== false && datos.numero) ? `<div class="c" style="font-size:10px">Comprobante ${datos.numero}</div>` : ""}
        ${(cfg.mostrar_cliente !== false && datos.cliente) ? `<div class="c" style="font-size:10px">Cliente: ${datos.cliente}</div>` : ""}
        <hr>
        <table>${lineas}</table>
        <hr>
        <table><tr><td class="tot">TOTAL</td><td class="tot" style="text-align:right">$${datos.total.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr></table>
        <hr>
        <div class="c">${cfg.mensaje_pie || "Gracias por tu compra!"}</div>
        ${cfg.texto_extra ? `<div class="c" style="font-size:10px">${cfg.texto_extra}</div>` : ""}
        <br><br>
      </body></html>`;
    const w = window.open("", "_blank", "width=380,height=600");
    if (!w) { setMensaje("Habilita las ventanas emergentes para imprimir el recibo"); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 300);
  };

  const reintentarFacturacion = async (ventaId) => {
    setLoading(true);
    try {
      const items = expandirItemsCart();
      const arcaRes = await API.post("/arca/emitir", { tipo: tipoFac, items, total: totalAFacturar, cliente_cuit: clienteSeleccionado?.cuit_dni || null, venta_id: ventaId });
      setMensaje("✅ " + arcaRes.data.mensaje + " | CAE: " + arcaRes.data.cae);
      const datosRecibo = {
        items: cart.map(i => ({ nombre: i.nombre || i.name, cantidad: i.qty, precio_unitario: (i.precio || i.price) * (1 - (i.descuento_pct || 0) / 100) })),
        total: total, cliente: clienteSeleccionado?.nombre || null,
        numero: arcaRes.data.nroComprobante ? (String(arcaRes.data.puntoVenta || 5).padStart(4,"0") + "-" + String(arcaRes.data.nroComprobante).padStart(8,"0")) : null
      };
      setUltimoRecibo(datosRecibo);
      imprimirRecibo(datosRecibo);
      setVentaPendienteArca(null);
      setCart([]); setDniInput(""); setCupon(""); setCuponAplicado(null); setPagoMixto(false); setPagosMixtos([]); setMedioPagoSel(null);
      setClienteSeleccionado(null); setShowNuevoCliente(false);
      setMedioPagoSel(null); setPreventa(false); setNombrePreventa(""); setDescuentoManual(""); setTipoDescuento("%"); setInsumosSel({}); setMostrarInsumos(false); setReferenciaVenta("");
      quitarGiftCard();
      setTimeout(() => setMensaje(""), 8000);
    } catch (arcaErr) {
      setMensaje("⚠️ ARCA sigue dando error: " + (arcaErr.response?.data?.error || arcaErr.message) + ". Podes reintentar de nuevo.");
    }
    setLoading(false);
  };

  const emitirFactura = async () => {
    // Si hay una venta ya registrada esperando facturacion, reintenta SOLO eso (no duplica la venta)
    if (ventaPendienteArca) return reintentarFacturacion(ventaPendienteArca);
    if (cart.length === 0) return setMensaje("Agrega productos al ticket");
    if (restaPagar > 0 && !pagoMixto && !medioPagoSel) return setMensaje("Selecciona un medio de pago para la diferencia");
    if (restaPagar > 0 && pagoMixto) {
      const sumaPagos = pagosMixtos.reduce((s, p) => s + (parseFloat(p.importe) || 0), 0);
      if (pagosMixtos.some(p => !p.medio_pago_id)) return setMensaje("Elegi el medio de pago en cada linea del pago dividido");
      if (Math.abs(sumaPagos - restaPagar) >= 1) return setMensaje("La suma de los pagos (" + fmt(sumaPagos) + ") debe ser igual al total (" + fmt(restaPagar) + ")");
    }
    setLoading(true);
    try {
      const items = expandirItemsCart();
      const ventaRes = await createVenta({
        cliente_id: clienteSeleccionado?.id || null,
        tipo_factura: tipoFac, items, canal: "presencial",
        cupon_codigo: cupon || null, local_id: localId || 1,
        medio_pago_id: pagoMixto && pagosMixtos.length > 0 ? (pagosMixtos[0].medio_pago_id || null) : (medioPagoSel?.id || null),
        medio_pago_nombre: pagoMixto && pagosMixtos.length > 0 ? pagosMixtos.map(p => p.medio_pago_nombre).join(" + ") : (restaPagar > 0 ? medioPagoSel?.nombre : "Gift Card"),
        pagos: pagoMixto && pagosMixtos.length > 0 ? pagosMixtos : undefined,
        total_con_interes: total, es_preventa: preventa,
        nombre_preventa: preventa ? nombrePreventa : null,
        monto_gift_card: montoAplicadoGC,
        insumos_usados: (!preventa && insumosPosActivo) ? Object.values(insumosSel).filter(v => v && v !== "ninguna").map(v => parseInt(v)) : [],
        referencia: referenciaVenta || null
      });
      if (giftCardAplicada && montoAplicadoGC > 0) {
        try {
          await API.post("/gift-cards/" + giftCardAplicada.id + "/canjear", {
            importe: montoAplicadoGC, venta_id: ventaRes.data.id, usuario_id: usuario?.id || null
          });
        } catch (gcErr) {}
      }
      let arcaFallo = false;
      if (!preventa && totalAFacturar <= 0) {
        // Todo se pago con gift card de migracion: ya se facturo en el sistema anterior, no se factura de nuevo.
        setMensaje("✅ Venta registrada. No se factura en ARCA (pagada con gift card ya facturada en el sistema anterior).");
        const datosReciboMig = {
          items: cart.map(i => ({ nombre: i.nombre || i.name, cantidad: i.qty, precio_unitario: (i.precio || i.price) * (1 - (i.descuento_pct || 0) / 100) })),
          total: total, cliente: clienteSeleccionado?.nombre || null, numero: null
        };
        setUltimoRecibo(datosReciboMig);
        imprimirRecibo(datosReciboMig);
      } else if (!preventa) {
        try {
          const arcaRes = await API.post("/arca/emitir", { tipo: tipoFac, items, total: totalAFacturar, cliente_cuit: clienteSeleccionado?.cuit_dni || null, venta_id: ventaRes.data.id });
          setMensaje("✅ " + arcaRes.data.mensaje + " | CAE: " + arcaRes.data.cae + (montoGCMigracion > 0 ? " (facturado " + fmt(totalAFacturar) + ", el resto fue gift card ya facturada)" : ""));
          const datosRecibo = {
            items: cart.map(i => ({ nombre: i.nombre || i.name, cantidad: i.qty, precio_unitario: (i.precio || i.price) * (1 - (i.descuento_pct || 0) / 100) })),
            total: total,
            cliente: clienteSeleccionado?.nombre || null,
            numero: arcaRes.data.nroComprobante ? (String(arcaRes.data.puntoVenta || 5).padStart(4,"0") + "-" + String(arcaRes.data.nroComprobante).padStart(8,"0")) : null
          };
          setUltimoRecibo(datosRecibo);
          imprimirRecibo(datosRecibo);
        } catch (arcaErr) {
          arcaFallo = true;
          setVentaPendienteArca(ventaRes.data.id);
          setMensaje("⚠️ La venta se registro pero ARCA dio error: " + (arcaErr.response?.data?.error || arcaErr.message) + ". Apreta \"Reintentar facturacion\" para volver a intentar (no se duplica la venta).");
        }
      } else {
        setMensaje("Preventa registrada para " + nombrePreventa + "!");
      }
      if (!arcaFallo) {
        setCart([]); setDniInput(""); setCupon(""); setCuponAplicado(null); setPagoMixto(false); setPagosMixtos([]); setMedioPagoSel(null);
        setClienteSeleccionado(null); setShowNuevoCliente(false);
        setMedioPagoSel(null); setPreventa(false); setNombrePreventa(""); setDescuentoManual(""); setTipoDescuento("%"); setInsumosSel({}); setMostrarInsumos(false);
        quitarGiftCard();
      }
      setTimeout(() => setMensaje(""), 8000);
    } catch (error) { setMensaje("Error al emitir factura: " + (error?.response?.data?.error || error?.message || "desconocido")); console.error("DETALLE FACTURA:", error); }
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

  // Kits normalizados como si fueran productos (para mostrarlos en el buscador del POS)
  const kitsComoProducto = (kitsPos || []).filter(k => k.activo !== false).map(k => ({
    id: "kit-" + k.id,
    es_kit: true,
    kit_id: k.id,
    kit_items: k.items || k.kit_items || [],
    nombre: k.nombre,
    marca: "KIT",
    precio: parseFloat(k.precio || 0),
    disponible: 9999,
    stock: 9999
  }));

  const listaCompleta = [...kitsComoProducto, ...(productos.length > 0 ? productos : PRODUCTS)];
  const productosAMostrar = listaCompleta.filter(p =>
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
                <div style={{ fontSize: 11, color: "#65676B", marginTop: 2 }}>{new Date(p.creado_en).toLocaleDateString("es-AR")} - {fmt(parseFloat(p.total))}</div>
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
                    <span style={{ color: "#65676B" }}>{fmt(parseFloat(it.precio_unitario || 0))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {confirmandoPreventa && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, overflowY: "auto", padding: "20px" }}>
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
          <input className="inp" placeholder="Escanea o busca por nombre, marca o codigo..." value={busqueda} onChange={e => setBusqueda(e.target.value)} onKeyDown={onEscaneo} autoFocus />
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
                  const accion = (soloTransito && !p.es_kit) ? (() => agregarComoPreventa(p)) : (() => add(p));
                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid #f5f5f5", cursor: sinStock ? "not-allowed" : "pointer", opacity: sinStock ? 0.45 : 1 }}
                      onClick={() => { if (!sinStock) accion(); }}>
                      <td style={{ padding: "4px 10px" }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#111111" }}>{p.nombre || p.name}</div>
                        <div style={{ fontSize: 9, color: "#888888" }}>{p.marca || p.brand || ""}</div>
                      </td>
                      <td style={{ padding: "4px 8px", textAlign: "right", fontSize: 12, fontWeight: 700, color: "#c9a84c" }}>{fmt((p.precio || p.price || 0))}</td>
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
              : cart.map(i => {
                const precioUnit = i.precio || i.price || 0;
                const precioConDesc = precioUnit * (1 - (i.descuento_pct || 0) / 100);
                return (
                <div key={i.id} style={{ background: "#ffffff", borderRadius: 6, padding: "8px 10px", marginBottom: 6, border: "1px solid #e8e4dc" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{i.nombre || i.name}</div>
                      <div style={{ fontSize: 10, color: "#888888" }}>{i.marca || i.brand}</div>
                    </div>
                    <div onClick={() => remove(i.id)} style={{ cursor: "pointer", color: "#cccccc", fontSize: 18, lineHeight: 1, paddingLeft: 6 }}>x</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <button onClick={() => setCart(prev => prev.map(x => x.id === i.id && x.qty > 1 ? { ...x, qty: x.qty - 1 } : x))} style={{ width: 24, height: 24, borderRadius: 4, border: "1px solid #e8e8e8", background: "#f7f7f7", cursor: "pointer", fontSize: 15, fontWeight: 700, lineHeight: 1, color: "#555555" }}>−</button>
                      <span style={{ fontSize: 13, fontWeight: 600, minWidth: 22, textAlign: "center" }}>{i.qty}</span>
                      <button onClick={() => add(i)} style={{ width: 24, height: 24, borderRadius: 4, border: "1px solid #e8e8e8", background: "#f7f7f7", cursor: "pointer", fontSize: 15, fontWeight: 700, lineHeight: 1, color: "#555555" }}>+</button>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                      <span style={{ fontSize: 9, color: "#999999" }}>$</span>
                      <input type="number" min="0" value={i.precio || i.price || ""} onChange={e => { const v = parseFloat(e.target.value) || 0; setCart(prev => prev.map(x => x.id === i.id ? { ...x, precio: v, price: v } : x)); }} style={{ width: 78, fontSize: 11, padding: "4px 6px", border: "1px solid #e8e8e8", borderRadius: 4, textAlign: "right" }} title="Precio unitario (editable)" />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <input type="number" min="0" max="100" placeholder="0" value={i.descuento_pct || ""} onChange={e => { const v = e.target.value === "" ? 0 : Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)); setCart(prev => prev.map(x => x.id === i.id ? { ...x, descuento_pct: v } : x)); }} style={{ width: 40, fontSize: 11, padding: "4px 5px", border: "1px solid #e8e8e8", borderRadius: 4, textAlign: "center" }} title="% descuento a este producto" />
                      <span style={{ fontSize: 10, color: "#888888" }}>% off</span>
                    </div>
                    <div style={{ marginLeft: "auto", textAlign: "right", minWidth: 72 }}>
                      {(i.descuento_pct > 0) && <div style={{ fontSize: 9, color: "#aaaaaa", textDecoration: "line-through" }}>{fmt(precioUnit * i.qty)}</div>}
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{fmt(precioConDesc * i.qty)}</div>
                    </div>
                  </div>
                </div>
                );
              })
            }
          </div>
          <div style={{ padding: "10px 14px", borderTop: "1px solid #ddd9d0", background: "#f0ece4" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 11, color: "#666666", fontWeight: 600 }}>SUBTOTAL</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: "#111111" }}>{fmt(subtotalBase)}</span>
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
                  <div style={{ fontSize: 9, color: "#65676B" }}>{fmt(parseFloat(giftCardAplicada.saldo))}</div>
                </div>
                <span onClick={quitarGiftCard} style={{ cursor: "pointer", color: "#c0392b", fontSize: 10 }}>X</span>
              </div>
            )}
            {errorGC && <div style={{ fontSize: 9, color: "#c0392b", marginBottom: 6 }}>{errorGC}</div>}
            {giftCardAplicada && (
              <div style={{ fontSize: 10, marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#65676B" }}>Gift card</span>
                <span style={{ fontWeight: 700, color: "#2d7a4f" }}>-{fmt(montoAplicadoGC)}</span>
              </div>
            )}
            {!preventa && (
              <div style={{ marginBottom: 8 }}>
                <button className="btn btn-sm" style={{ width: "100%", background: "#f7f5f0", color: "#2471a3", border: "1px dashed #2471a3" }} onClick={agregarAjusteDiferencia}>+ Facturar diferencia de pedido online</button>
              </div>
            )}
            {!preventa && insumosPosActivo && insumosPos.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                {!mostrarInsumos ? (
                  <button className="btn btn-sm" style={{ width: "100%", background: "#f7f5f0", color: "#c9a84c", border: "1px dashed #c9a84c" }} onClick={() => setMostrarInsumos(true)}>+ Agregar insumo (bolsa, caja, ramo...)</button>
                ) : (
                  <div style={{ background: "#f7f5f0", borderRadius: 8, padding: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#65676B" }}>Insumos usados (se descuentan del stock, no se facturan)</span>
                      <span onClick={() => { setMostrarInsumos(false); setInsumosSel({}); }} style={{ cursor: "pointer", fontSize: 11, color: "#999" }}>ocultar</span>
                    </div>
                    {insumosPos.map(ins => {
                      const marcado = insumosSel[ins.id] && insumosSel[ins.id] !== "ninguna";
                      return (
                        <label key={ins.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: 12, cursor: "pointer" }}>
                          <input type="checkbox" checked={!!marcado} onChange={e => setInsumosSel(p => ({ ...p, [ins.id]: e.target.checked ? String(ins.id) : "ninguna" }))} />
                          <span>{ins.nombre}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {restaPagar > 0 && (
              <div style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: "#888" }}>{pagoMixto ? "Pago dividido" : "Medio de pago"}</span>
                  <button onClick={() => { setPagoMixto(!pagoMixto); if (!pagoMixto) { setPagosMixtos([{ medio_pago_id: null, medio_pago_nombre: "", importe: "" }]); } else { setPagosMixtos([]); } }} style={{ fontSize: 10, padding: "2px 8px", border: "1px solid #c9a84c", borderRadius: 4, background: pagoMixto ? "#c9a84c" : "#fff", color: pagoMixto ? "#fff" : "#c9a84c", cursor: "pointer" }}>{pagoMixto ? "Pago simple" : "Dividir pago"}</button>
                </div>

                {!pagoMixto && (
                  <select className="sel" style={{ fontSize: 11, padding: "8px 10px", width: "100%" }} value={medioPagoSel?.id || ""} onChange={e => {
                    const m = mediosPago.find(x => x.id === parseInt(e.target.value));
                    setMedioPagoSel(m || null);
                  }}>
                    <option value="">{giftCardAplicada ? "Pago diferencia..." : "Medio de pago..."}</option>
                    {mediosPago.map(m => (
                      <option key={m.id} value={m.id}>{m.nombre}</option>
                    ))}
                  </select>
                )}

                {pagoMixto && (
                  <div>
                    {pagosMixtos.map((pg, idx) => (
                      <div key={idx} style={{ display: "flex", gap: 4, marginBottom: 4, alignItems: "center" }}>
                        <select className="sel" style={{ fontSize: 10, padding: "6px", flex: 1 }} value={pg.medio_pago_id || ""} onChange={e => {
                          const m = mediosPago.find(x => x.id === parseInt(e.target.value));
                          setPagosMixtos(prev => prev.map((x, i) => i === idx ? { ...x, medio_pago_id: m?.id || null, medio_pago_nombre: m?.nombre || "" } : x));
                        }}>
                          <option value="">Medio...</option>
                          {mediosPago.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                        </select>
                        <input type="number" placeholder="$" value={pg.importe} onChange={e => setPagosMixtos(prev => prev.map((x, i) => i === idx ? { ...x, importe: e.target.value } : x))} style={{ width: 80, fontSize: 11, padding: "6px", border: "1px solid #e8e8e8", borderRadius: 4, textAlign: "right" }} />
                        {pagosMixtos.length > 1 && <span onClick={() => setPagosMixtos(prev => prev.filter((_, i) => i !== idx))} style={{ cursor: "pointer", color: "#ccc", fontSize: 16 }}>×</span>}
                      </div>
                    ))}
                    <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                      <button onClick={() => setPagosMixtos(prev => [...prev, { medio_pago_id: null, medio_pago_nombre: "", importe: "" }])} style={{ fontSize: 10, padding: "4px 8px", border: "1px dashed #c9a84c", borderRadius: 4, background: "#fff", color: "#c9a84c", cursor: "pointer", flex: 1 }}>+ Agregar medio</button>
                      <button onClick={() => { const n = pagosMixtos.length || 1; const parte = Math.round((restaPagar / n) * 100) / 100; setPagosMixtos(prev => prev.map(x => ({ ...x, importe: String(parte) }))); }} style={{ fontSize: 10, padding: "4px 8px", border: "1px solid #e8e8e8", borderRadius: 4, background: "#f7f7f7", cursor: "pointer", flex: 1 }}>Dividir igual</button>
                    </div>
                    {(() => {
                      const suma = pagosMixtos.reduce((s, p) => s + (parseFloat(p.importe) || 0), 0);
                      const dif = restaPagar - suma;
                      return <div style={{ fontSize: 10, textAlign: "right", color: Math.abs(dif) < 1 ? "#2d7a4f" : "#c0392b" }}>Suma: {fmt(suma)} / Total: {fmt(restaPagar)} {Math.abs(dif) >= 1 ? "(falta " + fmt(dif) + ")" : "✓"}</div>;
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
          <div style={{ background: "#f0ece4", border: "1px solid #ddd9d0", borderRadius: 8, padding: "10px 12px" }}>
            {promoCalc.avisos.length > 0 && (
              <div style={{ background: "#2d7a4f", border: "2px solid #1e5637", borderRadius: 8, padding: "12px 14px", marginBottom: 8, fontSize: 13, color: "#ffffff", fontWeight: 700, boxShadow: "0 2px 8px rgba(45,122,79,0.4)" }}>
                {promoCalc.avisos.map((a, k) => {
                  const prod = productos.find(p => p.id === parseInt(a.productoId));
                  return <div key={k} style={{ marginBottom: 4 }}>🎁 Ofrecele: {a.valor}% OFF en {prod ? (prod.nombre || prod.name) : "producto"} ({a.promo})</div>;
                })}
              </div>
            )}
            {descuento > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, fontSize: 10, color: "#2d7a4f" }}>
                <span>Descuento{promoCalc.usadas.length > 0 ? " (" + promoCalc.usadas.join(", ") + ")" : ""}</span><span>-{fmt(descuento)}</span>
              </div>
            )}
            {intereses > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, fontSize: 10, color: "#c0392b" }}>
                <span>Intereses</span><span>+{fmt(intereses)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: "#65676B", fontWeight: 600 }}>{restaPagar > 0 && giftCardAplicada ? "FALTA PAGAR" : "TOTAL"}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#111111" }}>{fmt((restaPagar > 0 ? restaPagar : total))}</div>
            </div>
            <button className="btn btn-p" style={{ width: "100%", padding: 11, fontSize: 12, opacity: loading ? 0.7 : 1, background: ventaPendienteArca ? "#e67e22" : undefined }} onClick={emitirFactura} disabled={loading}>
              {loading ? "Procesando..." : ventaPendienteArca ? "⚠️ Reintentar facturacion" : preventa ? "Registrar Preventa" : "Factura " + tipoFac}
            </button>
            {ultimoRecibo && (
              <button className="btn btn-g btn-sm" style={{ width: "100%", marginTop: 6, fontSize: 11 }} onClick={() => imprimirRecibo(ultimoRecibo)}>Reimprimir ultimo recibo</button>
            )}
          </div>
        </div>
      </div>

      {showEmitirGC && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, overflowY: "auto", padding: "20px" }}>
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
                  <div style={{ fontSize: 12, color: "#65676B", marginTop: 4 }}>Saldo: {fmt(parseFloat(gcEmitidaOk.saldo))}</div>
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
  const [editandoProd, setEditandoProd] = useState(null);
  const [eliminandoProd, setEliminandoProd] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroCat, setFiltroCat] = useState("");
  const [filtroStock, setFiltroStock] = useState("");
  const [filtroMarcaAlertas, setFiltroMarcaAlertas] = useState("");
  const [vistaLocal, setVistaLocal] = useState("mi");
  const [nuevo, setNuevo] = useState({
    nombre: "", marca: "", codigo: "", categoria: "", precio: "", costo: "",
    stock: "", stock_minimo: "", proveedor_id: "", descripcion: ""
  });

  const categorias = ["Capilar", "Facial", "Maquillaje", "Accesorio", "Corporal", "Spa", "Perfume"];

  const cargar = async () => {
    setLoading(true);
    try {
      const [prodRes, provRes] = await Promise.all([
        API.get("/productos?local=" + (Number(localId) === 2 ? "ush" : "rg")),
        API.get("/proveedores")
      ]);
      const prods = prodRes.data || [];
      setProductos(prods);
      setAlertas(prods.filter(p => (Number(localId) === 2 ? (p.stock_ush || 0) : (p.stock_rg || 0)) <= (p.stock_minimo || 5)));
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
    setValorAjuste(String(Number(localId) === 2 ? (p.stock_ush || 0) : (p.stock_rg || 0)));
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

  const abrirEditarProd = (p) => {
    setEditandoProd(p);
    setNuevo({
      nombre: p.nombre || "", marca: p.marca || "", codigo: p.codigo_barras || p.codigo || "",
      categoria: p.categoria || "", precio: p.precio || p.price || "", costo: p.costo || p.cost || "",
      stock: "", stock_minimo: p.stock_minimo || "", proveedor_id: p.proveedor_id || "", descripcion: ""
    });
    setShowForm(true);
  };

  const guardarEdicionProd = async () => {
    if (!nuevo.nombre || !nuevo.precio) return setMensaje("Completa al menos nombre y precio");
    try {
      await API.put("/productos/" + editandoProd.id, {
        nombre: nuevo.nombre, marca: nuevo.marca, codigo_barras: nuevo.codigo,
        categoria: nuevo.categoria, precio: parseFloat(nuevo.precio),
        costo: parseFloat(nuevo.costo) || 0,
        stock: editandoProd.stock || 0,
        stock_minimo: parseInt(nuevo.stock_minimo) || 5,
        lead_time_dias: editandoProd.lead_time_dias || 0
      });
      setMensaje("Producto actualizado!");
      setNuevo({ nombre: "", marca: "", codigo: "", categoria: "", precio: "", costo: "", stock: "", stock_minimo: "", proveedor_id: "", descripcion: "" });
      setShowForm(false); setEditandoProd(null);
      cargar();
      setTimeout(() => setMensaje(""), 3000);
    } catch (e) { setMensaje("Error al actualizar: " + (e.response?.data?.error || e.message)); }
  };

  const eliminarProd = async () => {
    try {
      await API.delete("/productos/" + eliminandoProd.id);
      setMensaje("Producto eliminado");
      setEliminandoProd(null);
      cargar();
      setTimeout(() => setMensaje(""), 3000);
    } catch (e) { setMensaje(e.response?.data?.error || "Error al eliminar"); setEliminandoProd(null); }
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
          <div className="ct">{editandoProd ? "Editar producto" : "Nuevo producto"}</div>
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
              {!editandoProd && (<div className="fg"><div className="fl">Stock inicial</div><input className="inp" type="number" placeholder="10" value={nuevo.stock} onChange={e => setNuevo(p => ({ ...p, stock: e.target.value }))} /></div>)}
              {editandoProd && <div style={{ fontSize: 10, color: "#65676B", marginBottom: 12 }}>El stock se modifica con el boton "Ajustar".</div>}
              <div className="fg"><div className="fl">Stock minimo (alerta)</div><input className="inp" type="number" placeholder="5" value={nuevo.stock_minimo} onChange={e => setNuevo(p => ({ ...p, stock_minimo: e.target.value }))} /></div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button className="btn btn-p" style={{ flex: 1 }} onClick={editandoProd ? guardarEdicionProd : guardarProducto}>{editandoProd ? "Guardar cambios" : "Crear producto"}</button>
                <button className="btn btn-g" style={{ flex: 1 }} onClick={() => { setShowForm(false); setEditandoProd(null); }}>Cancelar</button>
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
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {[["mi", Number(localId) === 2 ? "Ushuaia (mi local)" : "Rio Grande (mi local)"], ["otro", Number(localId) === 2 ? "Rio Grande" : "Ushuaia"], ["consolidado", "Consolidado"]].map(([id, l]) => (
            <button key={id} className="btn btn-sm" style={{ fontSize: 11, background: vistaLocal === id ? "#c9a84c" : "#ffffff", color: vistaLocal === id ? "#ffffff" : "#65676B", border: "1px solid " + (vistaLocal === id ? "#c9a84c" : "#E4E6EB") }} onClick={() => setVistaLocal(id)}>{l}</button>
          ))}
        </div>
      )}
      {tab === "stock" && (
        <div className="card fade" style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input className="inp" placeholder="Buscar por nombre, marca, codigo, categoria o proveedor..." value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ flex: 1, minWidth: 240 }} />
          <select className="sel" style={{ width: 180 }} value={filtroCat} onChange={e => setFiltroCat(e.target.value)}>
            <option value="">Todas las categorias</option>
            {[...new Set(productos.map(p => p.categoria).filter(Boolean))].sort().map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <select className="sel" style={{ width: 170 }} value={filtroStock} onChange={e => setFiltroStock(e.target.value)}>
            <option value="">Todo el stock</option>
            <option value="bajo">Stock bajo</option>
            <option value="sin">Sin stock</option>
          </select>
          {(busqueda || filtroCat || filtroStock) && <button className="btn btn-g btn-sm" onClick={() => { setBusqueda(""); setFiltroCat(""); setFiltroStock(""); }}>Limpiar</button>}
        </div>
      )}
      {tab === "stock" && (
        <div className="card fade">
          {loading ? (
            <div style={{ color: "#65676B", padding: 20 }}>Cargando inventario...</div>
          ) : (
          <table>
            <thead><tr><th>Producto</th><th>Marca</th><th>Categoria</th><th>Codigo</th><th>Precio</th><th>Costo</th><th>Stock</th><th>Reservado</th><th>Disponible</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {productos.filter(p => {
                const q = busqueda.trim().toLowerCase();
                if (q) {
                  const campos = [p.nombre, p.marca, p.codigo_barras, p.codigo, p.categoria, p.proveedor_nombre].map(x => (x || "").toString().toLowerCase());
                  if (!campos.some(x => x.includes(q))) return false;
                }
                if (filtroCat && p.categoria !== filtroCat) return false;
                const disp = p.disponible !== undefined ? p.disponible : (p.stock || 0);
                if (filtroStock === "bajo" && !(disp <= (p.stock_minimo || 5))) return false;
                if (filtroStock === "sin" && !((p.stock || 0) === 0)) return false;
                return true;
              }).map(p => {
                // Stock segun la pestaña (mi local / otro / consolidado)
                const stockVista = vistaLocal === "consolidado"
                  ? ((p.stock_rg || 0) + (p.stock_ush || 0))
                  : vistaLocal === "otro"
                    ? (Number(localId) === 2 ? (p.stock_rg || 0) : (p.stock_ush || 0))
                    : (Number(localId) === 2 ? (p.stock_ush || 0) : (p.stock_rg || 0));
                // Reservado del local que corresponde a la vista
                const reservadoVista = vistaLocal === "consolidado"
                  ? ((p.reservado_rg || 0) + (p.reservado_ush || 0))
                  : vistaLocal === "otro"
                    ? (Number(localId) === 2 ? (p.reservado_rg || 0) : (p.reservado_ush || 0))
                    : (Number(localId) === 2 ? (p.reservado_ush || 0) : (p.reservado_rg || 0));
                const reservado = reservadoVista;
                const disponible = Math.max(stockVista - reservadoVista, 0);
                const bajo = disponible <= (p.stock_minimo || 5);
                const margen = p.price && p.cost ? Math.round(((p.price - p.cost) / p.price) * 100) : null;
                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 500 }}>{p.nombre || p.name}</td>
                    <td style={{ fontSize: 11, color: "#65676B" }}>{p.marca || p.brand || "-"}</td>
                    <td style={{ fontSize: 11, color: "#65676B" }}>{p.categoria || "-"}</td>
                    <td style={{ fontSize: 11, color: "#65676B" }}>{p.codigo_barras || p.codigo || "-"}</td>
                    <td style={{ color: "#c9a84c" }}>{fmt(parseFloat(p.price || p.precio || 0))}</td>
                    <td style={{ fontSize: 11, color: "#65676B" }}>{p.cost || p.costo ? fmt(parseFloat(p.cost || p.costo)) : "-"}</td>
                    <td><span className="badge bx">{stockVista}</span></td>
                    <td style={{ fontSize: 11 }}>{reservado > 0 ? <span style={{ color: "#c9a84c", fontWeight: 600 }}>{reservado}</span> : <span style={{ color: "#cccccc" }}>-</span>}</td>
                    <td><span className={"badge " + (bajo ? "br" : "bg")}>{disponible}</span></td>
                    <td style={{ fontSize: 10, color: margen ? "#2d7a4f" : "#65676B" }}>{margen ? margen + "%" : "-"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        {vistaLocal === "mi" && <button className="btn btn-sm" style={{ fontSize: 10 }} onClick={() => abrirAjuste(p)}>Ajustar</button>}
                        <button className="btn btn-sm" style={{ fontSize: 10 }} onClick={() => abrirEditarProd(p)}>Editar</button>
                        {(usuario?.rol === "jefe" || usuario?.rol === "admin") && <button className="btn btn-sm" style={{ fontSize: 10, color: "#c0392b" }} onClick={() => setEliminandoProd(p)}>Eliminar</button>}
                      </div>
                    </td>
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
                    <td>{p.transito_rg > 0 ? <span className="badge bb">{p.transito_rg}</span> : <span style={{ color: "#cccccc" }}>-</span>}</td>
                    <td>{p.reservado_rg > 0 ? <span style={{ color: "#c9a84c", fontWeight: 600, fontSize: 11 }}>{p.reservado_rg}</span> : <span style={{ color: "#cccccc" }}>-</span>}</td>
                    <td>{p.transito_ush > 0 ? <span className="badge bb">{p.transito_ush}</span> : <span style={{ color: "#cccccc" }}>-</span>}</td>
                    <td>{p.reservado_ush > 0 ? <span style={{ color: "#c9a84c", fontWeight: 600, fontSize: 11 }}>{p.reservado_ush}</span> : <span style={{ color: "#cccccc" }}>-</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {tab === "alertas" && (
        <div className="fade">
          {alertas.length > 0 && (
            <div className="card fade" style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <select className="sel" style={{ width: 200 }} value={filtroMarcaAlertas} onChange={e => setFiltroMarcaAlertas(e.target.value)}>
                <option value="">Todas las marcas</option>
                {[...new Set(alertas.map(p => p.marca).filter(Boolean))].sort().map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              {filtroMarcaAlertas && <button className="btn btn-g btn-sm" onClick={() => setFiltroMarcaAlertas("")}>Limpiar</button>}
            </div>
          )}
          {alertas.length === 0 ? (
            <div style={{ textAlign: "center", color: "#2d7a4f", padding: 30, fontSize: 12 }}>No hay alertas de stock por ahora</div>
          ) : alertas.filter(p => !filtroMarcaAlertas || p.marca === filtroMarcaAlertas).length === 0 ? (
            <div style={{ textAlign: "center", color: "#65676B", padding: 30, fontSize: 12 }}>No hay alertas para esa marca</div>
          ) : alertas.filter(p => !filtroMarcaAlertas || p.marca === filtroMarcaAlertas).map(p => (
            <div key={p.id} style={{ background: "#c0392b12", border: "1px solid #d9707033", borderRadius: 6, padding: "12px 16px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, color: "#444444" }}>{p.nombre || p.name} - {p.marca || p.brand}</div>
                <div style={{ fontSize: 10, color: "#65676B", marginTop: 2 }}>Stock: {p.stock || 0} | Minimo: {p.stock_minimo || 5}</div>
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
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, overflowY: "auto", padding: "20px" }}>
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
                      <div style={{ fontSize: 24, fontWeight: 700, color: "#2d7a4f" }}>{fmt(calcResultado)}</div>
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
      {eliminandoProd && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, overflowY: "auto", padding: "20px" }}>
          <div className="card" style={{ width: 400, background: "#ffffff" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: "#c0392b" }}>Eliminar producto</div>
            <div style={{ fontSize: 13, color: "#444444", marginBottom: 6 }}>Vas a eliminar <b>{eliminandoProd.nombre}</b> de forma permanente.</div>
            <div style={{ fontSize: 11, color: "#65676B", marginBottom: 16 }}>Esta accion no se puede deshacer. Si el producto tiene ventas registradas, el sistema no lo va a borrar para no romper el historial.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-g" style={{ flex: 1 }} onClick={() => setEliminandoProd(null)}>Cancelar</button>
              <button className="btn btn-p" style={{ flex: 1, background: "#c0392b" }} onClick={eliminarProd}>Si, eliminar</button>
            </div>
          </div>
        </div>
      )}
      {ajustando && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, overflowY: "auto", padding: "20px" }}>
          <div className="card" style={{ width: 400, background: "#ffffff" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Ajustar stock</div>
            <div style={{ fontSize: 12, color: "#65676B", marginBottom: 14 }}>{ajustando.nombre} - stock actual: <b>{(Number(localId) === 2 ? (ajustando.stock_ush || 0) : (ajustando.stock_rg || 0))}</b></div>
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
                <div style={{ fontSize: 11, color: "#65676B", marginTop: 4 }}>Nuevo stock: {(Number(localId) === 2 ? (ajustando.stock_ush || 0) : (ajustando.stock_rg || 0)) + parseInt(valorAjuste)}</div>
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
  const [migrarCli, setMigrarCli] = useState(null);
  const [migMonto, setMigMonto] = useState("");
  const [migFecha, setMigFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [migHist, setMigHist] = useState([]);
  const [migMsg, setMigMsg] = useState("");
  const tierNext = { Bronze: 2000, Silver: 5000, Gold: 10000, Platinum: 20000, Black: 99999 };

  useEffect(() => {
    getClientes().then(res => { setClientes(res.data); setLoading(false); }).catch(() => { setClientes(CLIENTS.map(c => ({ ...c, nombre: c.name, puntos: c.points, nivel: c.tier, total_compras: c.total, cuit_dni: c.cuit }))); setLoading(false); });
  }, []);

  const abrirMigrar = async (cli) => {
    setMigrarCli(cli); setMigMonto(""); setMigFecha(new Date().toISOString().slice(0, 10)); setMigMsg("");
    try { const r = await API.get("/clientes/" + cli.id + "/migrar-puntos"); setMigHist(r.data || []); } catch (e) { setMigHist([]); }
  };
  const guardarMigracion = async (confirmar) => {
    if (!migMonto || parseFloat(migMonto) <= 0) { setMigMsg("Ingresa un monto valido"); return; }
    try {
      await API.post("/clientes/" + migrarCli.id + "/migrar-puntos", {
        monto: parseFloat(migMonto), fecha_compra: migFecha, confirmar_duplicado: confirmar === true
      });
      const puntos = Math.floor(parseFloat(migMonto) / 100);
      setMigMsg("Listo! Se sumaron " + puntos + " puntos.");
      setMigMonto("");
      const r = await API.get("/clientes/" + migrarCli.id + "/migrar-puntos"); setMigHist(r.data || []);
      // refrescar lista de clientes
      getClientes().then(res => setClientes(res.data || [])).catch(() => {});
    } catch (e) {
      if (e?.response?.status === 409 && e.response.data?.posible_duplicado) {
        setMigMsg("DUP:" + e.response.data.error);
      } else {
        setMigMsg("Error: " + (e?.response?.data?.error || "no se pudo cargar"));
      }
    }
  };

  const resetearPortalCliente = async (cli) => {
    if (!confirm("Resetear la contrasena del portal de " + (cli.nombre || cli.name) + "? Va a poder volver a registrarse con su DNI.")) return;
    try {
      await API.post("/clientes/" + cli.id + "/resetear-portal");
      setMensaje("Contrasena del portal reseteada. La clienta ya puede registrarse de nuevo con su DNI.");
      setTimeout(() => setMensaje(""), 4000);
    } catch (e) {
      setMensaje("Error al resetear la contrasena del portal");
    }
  };

  const guardarCliente = async () => {
    if (!nuevoCliente.nombre || !nuevoCliente.nombre.trim()) { setMensaje("El nombre es obligatorio"); return; }
    if (!nuevoCliente.telefono || !nuevoCliente.telefono.trim()) { setMensaje("El celular es obligatorio"); return; }
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
              <div className="fg"><div className="fl">Nombre *</div><input className="inp" placeholder="Nombre completo" value={nuevoCliente.nombre} onChange={e => setNuevoCliente(p => ({ ...p, nombre: e.target.value }))} /></div>
              <div className="fg"><div className="fl">Email (opcional)</div><input className="inp" placeholder="email@gmail.com" value={nuevoCliente.email} onChange={e => setNuevoCliente(p => ({ ...p, email: e.target.value }))} /></div>
              <div className="fg"><div className="fl">CUIT / DNI (opcional)</div><input className="inp" placeholder="20-12345678-9" value={nuevoCliente.cuit_dni} onChange={e => setNuevoCliente(p => ({ ...p, cuit_dni: e.target.value }))} /></div>
            </div>
            <div>
              <div className="fg"><div className="fl">Celular *</div><input className="inp" placeholder="+54 9 351 000 0000" value={nuevoCliente.telefono} onChange={e => setNuevoCliente(p => ({ ...p, telefono: e.target.value }))} /></div>
              <div className="fg"><div className="fl">Fecha de nacimiento (opcional)</div><input className="inp" type="date" value={nuevoCliente.fecha_nacimiento} onChange={e => setNuevoCliente(p => ({ ...p, fecha_nacimiento: e.target.value }))} /></div>
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
            <thead><tr><th>Cliente</th><th>CUIT/DNI</th><th>Total compras</th><th>Puntos</th><th>Nivel</th><th>Portal</th></tr></thead>
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
                    <td>{fmt((c.total_compras || c.total || 0))}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 18, fontWeight: 700, color: "#c9a84c" }}>{fmtNum(puntos)}</span>
                        <div style={{ width: 40 }}><div className="pb"><div className="pf" style={{ width: pct + "%", background: "#c9a84c" }} /></div></div>
                      </div>
                    </td>
                    <td><TierBadge tier={nivel} /></td>
                    <td>
                      <button className="btn btn-sm" style={{ fontSize: 10, marginRight: 4 }} onClick={() => resetearPortalCliente(c)}>Resetear clave</button>
                      <button className="btn btn-sm" style={{ fontSize: 10, background: "#c9a84c", color: "#fff" }} onClick={() => abrirMigrar(c)}>Migrar puntos</button>
                    </td>
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
            { tier: "Bronze", min: 0, max: 1999, c: "#c9a84c", perks: ["1 pt cada $100", "Cupon bienvenida"] },
            { tier: "Silver", min: 2000, max: 4999, c: "#2471a3", perks: ["1.2 pts cada $100", "Acceso preventas", "Envio gratis +$5k"] },
            { tier: "Gold", min: 5000, max: 9999, c: "#c9a84c", perks: ["1.5 pts cada $100", "5% descuento exclusivo", "Regalo de cumpleanos"] },
            { tier: "Platinum", min: 10000, max: 19999, c: "#7d3c98", perks: ["2 pts cada $100", "10% descuento", "Envio gratis siempre", "Lanzamientos anticipados"] },
            { tier: "Black", min: 20000, max: null, c: "#1a1a1a", perks: ["2.5 pts cada $100", "15% descuento", "Envio gratis siempre", "Atencion VIP", "Regalos exclusivos"] },
          ].map(n => (
            <div key={n.tier} className="card" style={{ borderLeft: "3px solid " + n.c }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 20, fontWeight: 700, color: n.c }}>{n.tier}</div>
                <div style={{ fontSize: 10, color: "#65676B" }}>{fmtNum(n.min)}{n.max ? " - " +fmtNum(n.max) + " pts" : "+ pts"}</div>
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
    
      {migrarCli && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setMigrarCli(null)}>
          <div className="card" style={{ width: 460, maxWidth: "92vw", maxHeight: "88vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <div className="ct" style={{ margin: 0 }}>Migrar puntos de compra anterior</div>
              <span onClick={() => setMigrarCli(null)} style={{ cursor: "pointer", fontSize: 20, color: "#999" }}>×</span>
            </div>
            <div style={{ fontSize: 12, color: "#65676B", marginBottom: 12 }}>{migrarCli.nombre || migrarCli.name} · suma 1 punto cada $100 (no factura)</div>

            {migMsg && (
              <div style={{ marginBottom: 10, padding: 10, borderRadius: 6, fontSize: 12,
                background: migMsg.startsWith("Error") ? "#fdecea" : migMsg.startsWith("DUP:") ? "#fff8e1" : "#eafaf1",
                color: migMsg.startsWith("Error") ? "#c0392b" : migMsg.startsWith("DUP:") ? "#8a6d00" : "#1e7e4f" }}>
                {migMsg.startsWith("DUP:") ? migMsg.slice(4) : migMsg}
                {migMsg.startsWith("DUP:") && (
                  <div style={{ marginTop: 8 }}>
                    <button className="btn btn-sm" style={{ background: "#c0392b", color: "#fff", marginRight: 6 }} onClick={() => guardarMigracion(true)}>Cargar igual</button>
                    <button className="btn btn-sm" onClick={() => setMigMsg("")}>Cancelar</button>
                  </div>
                )}
              </div>
            )}

            <div className="fg" style={{ marginBottom: 8 }}>
              <div className="fl">Monto de la compra</div>
              <input className="inp" type="number" placeholder="0" value={migMonto} onChange={e => setMigMonto(e.target.value)} />
              {migMonto && parseFloat(migMonto) > 0 && <div style={{ fontSize: 11, color: "#2d7a4f", marginTop: 4 }}>= {Math.floor(parseFloat(migMonto) / 100)} puntos</div>}
            </div>
            <div className="fg" style={{ marginBottom: 12 }}>
              <div className="fl">Fecha del comprobante</div>
              <input className="inp" type="date" value={migFecha} onChange={e => setMigFecha(e.target.value)} />
            </div>
            <button className="btn btn-p" style={{ width: "100%", marginBottom: 14 }} onClick={() => guardarMigracion(false)}>Cargar puntos</button>

            <div style={{ fontSize: 11, fontWeight: 600, color: "#888", marginBottom: 6 }}>CARGAS ANTERIORES DE ESTA CLIENTA</div>
            {migHist.length === 0 ? <div style={{ fontSize: 12, color: "#999" }}>Sin cargas previas.</div> : (
              <table style={{ width: "100%", fontSize: 11 }}>
                <thead><tr style={{ color: "#888", textAlign: "left" }}><th style={{ padding: "4px 0" }}>Fecha compra</th><th style={{ textAlign: "right" }}>Monto</th><th style={{ textAlign: "right" }}>Puntos</th><th style={{ textAlign: "right" }}>Cargado</th></tr></thead>
                <tbody>
                  {migHist.map(h => (
                    <tr key={h.id} style={{ borderTop: "1px solid #f0f0f0" }}>
                      <td style={{ padding: "5px 0" }}>{h.fecha_compra ? new Date(h.fecha_compra).toLocaleDateString("es-AR") : "-"}</td>
                      <td style={{ textAlign: "right" }}>{fmt(parseFloat(h.monto))}</td>
                      <td style={{ textAlign: "right", color: "#2d7a4f" }}>{h.puntos}</td>
                      <td style={{ textAlign: "right", color: "#999" }}>{h.creado_en ? new Date(h.creado_en).toLocaleDateString("es-AR") : "-"}</td>
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

function Finanzas({ localId, usuario }) {
  const [tab, setTab] = useState("flujo");
  const [tabLocal, setTabLocal] = useState("rg");
  const [flujo, setFlujo] = useState(null);
  const [flujoEst, setFlujoEst] = useState(null);
  const [comisiones, setComisiones] = useState(null);
  const [cmv, setCmv] = useState(null);
  const [factExterna, setFactExterna] = useState(null);
  const [factExtMonto, setFactExtMonto] = useState("");
  const [factExtLocal, setFactExtLocal] = useState("1");
  const [equilibrio, setEquilibrio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nuevoEgreso, setNuevoEgreso] = useState({ concepto: "", importe: "", categoria_id: "", forma_pago: "", cuenta_pago_id: "", local_id: "" });
  const [categoriasCosto, setCategoriasCosto] = useState([]);
  const [cuentasPago, setCuentasPago] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [mesFiltro, setMesFiltro] = useState(new Date().getMonth() + 1);
  const [anioFiltro, setAnioFiltro] = useState(new Date().getFullYear());
  const [ultimoEgreso, setUltimoEgreso] = useState(null);

  const cargarUltimoEgreso = () => {
    if (!usuario?.id) return;
    API.get("/finanzas/mi-ultimo-egreso?usuario_id=" + usuario.id)
      .then(res => setUltimoEgreso(res.data || null))
      .catch(() => {});
  };

  useEffect(() => { cargarUltimoEgreso(); }, [usuario?.id]);

  const cargarDatos = (local) => {
    setLoading(true);
    const localParam = local || tabLocal;
    const params = `mes=${mesFiltro}&anio=${anioFiltro}&local_id=${localParam}`;
    Promise.allSettled([
      API.get(`/finanzas/flujo?${params}`),
      API.get(`/finanzas/flujo-estructurado?${params}`),
      API.get(`/finanzas/comisiones?${params}`),
      API.get(`/finanzas/cmv?${params}`),
      API.get(`/finanzas/facturacion-externa?mes=${mesFiltro}&anio=${anioFiltro}&local_id=${localParam}`),
      getPuntoEquilibrio(),
      API.get("/categorias-costo"),
      API.get("/cuentas-pago?solo_pago=true")
    ]).then((res) => {
      const val = (i) => res[i].status === "fulfilled" ? res[i].value : null;
      if (val(0)) setFlujo(val(0).data);
      if (val(1)) setFlujoEst(val(1).data);
      if (val(2)) setComisiones(val(2).data);
      if (val(3)) setCmv(val(3).data);
      if (val(4)) setFactExterna(val(4).data);
      if (val(5)) setEquilibrio(val(5).data);
      if (val(6)) setCategoriasCosto(val(6).data);
      if (val(7)) setCuentasPago(val(7).data);
      setLoading(false);
    });
  };

  useEffect(() => { cargarDatos(); }, [tabLocal, mesFiltro, anioFiltro]);

  const guardarFactExterna = async () => {
    if (!factExtMonto || parseFloat(factExtMonto) <= 0) { setMensaje("Ingresa un monto valido"); return; }
    try {
      await API.post("/finanzas/facturacion-externa", {
        monto: parseFloat(factExtMonto), local_id: parseInt(factExtLocal),
        mes: mesFiltro, anio: anioFiltro, descripcion: "Sistema anterior"
      });
      setMensaje("Facturacion del sistema anterior guardada!");
      setFactExtMonto("");
      cargarDatos();
      setTimeout(() => setMensaje(""), 3000);
    } catch (e) {
      setMensaje("Error al guardar la facturacion externa");
    }
  };

  const guardarEgreso = async () => {
    try {
      await agregarEgreso({ ...nuevoEgreso, referencia: "Manual", usuario_id: usuario?.id || null });
      setMensaje("Egreso registrado!");
      setNuevoEgreso({ concepto: "", importe: "", categoria_id: "", forma_pago: "", cuenta_pago_id: "", local_id: "" });
      cargarDatos();
      cargarUltimoEgreso();
      setTimeout(() => setMensaje(""), 3000);
    } catch (e) { setMensaje("Error al registrar egreso"); }
  };

  const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  const SeccionFlujo = ({ titulo, detalle, total, color }) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: color + "15", borderRadius: "6px 6px 0 0", borderLeft: "3px solid " + color }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: color, letterSpacing: ".1em" }}>{titulo}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: color }}>{fmt(parseFloat(total || 0))}</span>
      </div>
      {Object.entries(detalle || {}).map(([k, v]) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 12px", borderBottom: "1px solid #f0f0f0", background: "#fafafa" }}>
          <span style={{ fontSize: 12, color: "#444444" }}>{k}</span>
          <span style={{ fontSize: 12, color: "#666666" }}>{fmt(parseFloat(v || 0))}</span>
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
            <div className="card"><div className="ct">Ingresos del mes</div><div style={{ fontSize: 26, fontWeight: 700, color: "#2d7a4f" }}>{fmt(parseFloat(flujo?.resumen?.ingresos || 0))}</div></div>
            <div className="card"><div className="ct">Egresos del mes</div><div style={{ fontSize: 26, fontWeight: 700, color: "#c0392b" }}>{fmt(parseFloat(flujo?.resumen?.egresos || 0))}</div></div>
            <div className="card"><div className="ct">Resultado neto</div><div style={{ fontSize: 26, fontWeight: 700, color: "#c9a84c" }}>{fmt(parseFloat(flujo?.resumen?.neto || 0))}</div></div>
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
                      <td style={{ color: m.tipo === "I" ? "#2d7a4f" : "#c0392b" }}>{m.tipo === "I" ? "+" : "-"}{fmt(parseFloat(m.importe))}</td>
                    </tr>
                  ))}
                  {(flujo?.movimientos || []).length === 0 && (<tr><td colSpan={5} style={{ color: "#65676B", textAlign: "center" }}>Sin movimientos</td></tr>)}
                </tbody>
              </table>
              )}
            </div>
            <div className="card">
              <div className="ct">Registrar egreso</div>
              {ultimoEgreso && (
                <div style={{ background: "#c9a84c12", border: "1px solid #c9a84c", borderRadius: 6, padding: "8px 12px", marginBottom: 12, fontSize: 11, color: "#8a6d1f" }}>
                  Ultima vez que cargaste datos: {new Date(ultimoEgreso.creado_en).toLocaleDateString("es-AR")} a las {new Date(ultimoEgreso.creado_en).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })} - {ultimoEgreso.concepto} ({fmt(parseFloat(ultimoEgreso.importe))})
                </div>
              )}
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

          {comisiones && (
            <div className="card" style={{ marginTop: 14 }}>
              <div className="ct">Resultado neto despues de comisiones e IIBB</div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", fontSize: 13 }}>
                <span style={{ color: "#444" }}>Ventas del mes (este sistema)</span>
                <span style={{ fontWeight: 600 }}>{fmt(comisiones.total_ventas)}</span>
              </div>
              {factExterna && factExterna.total > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", fontSize: 13 }}>
                  <span style={{ color: "#444" }}>Facturacion sistema anterior</span>
                  <span style={{ fontWeight: 600 }}>{fmt(factExterna.total)}</span>
                </div>
              )}
              {factExterna && factExterna.total > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", fontSize: 13, borderTop: "1px solid #eee" }}>
                  <span style={{ color: "#444", fontWeight: 600 }}>Facturacion total del mes</span>
                  <span style={{ fontWeight: 700 }}>{fmt(comisiones.total_ventas + factExterna.total)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", fontSize: 13, color: "#c0392b" }}>
                <span>Comisiones por medio de pago</span>
                <span>- {fmt(comisiones.total_comisiones)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", fontSize: 13, color: "#c0392b" }}>
                <span>IIBB ({comisiones.iibb_pct}% sobre {fmt(comisiones.base_iibb)}, sin efectivo)</span>
                <span>- {fmt(comisiones.iibb)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 4px", borderTop: "2px solid #2d7a4f", marginTop: 6, fontSize: 15, fontWeight: 700 }}>
                <span>Resultado neto</span>
                <span style={{ color: "#2d7a4f" }}>{fmt(comisiones.resultado_neto)}</span>
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#888", marginBottom: 6 }}>DETALLE DE COMISIONES POR MEDIO DE PAGO</div>
                <table style={{ width: "100%", fontSize: 11 }}>
                  <thead><tr style={{ color: "#888", textAlign: "left" }}><th style={{ padding: "4px 0" }}>Medio</th><th>Ventas</th><th style={{ textAlign: "right" }}>Monto</th><th style={{ textAlign: "right" }}>%</th><th style={{ textAlign: "right" }}>Comision</th></tr></thead>
                  <tbody>
                    {comisiones.detalle.map((d, idx) => (
                      <tr key={idx} style={{ borderTop: "1px solid #f0f0f0" }}>
                        <td style={{ padding: "5px 0" }}>{d.medio}</td>
                        <td>{d.ventas}</td>
                        <td style={{ textAlign: "right" }}>{fmt(d.monto)}</td>
                        <td style={{ textAlign: "right" }}>{d.comision_pct}%</td>
                        <td style={{ textAlign: "right", color: "#c0392b" }}>{fmt(d.comision)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

          <div className="card" style={{ marginTop: 14 }}>
            <div className="ct">Facturacion del sistema anterior</div>
            <div style={{ fontSize: 11, color: "#65676B", marginBottom: 10 }}>Carga lo que facturaste con el software viejo este mes. Suma a la facturacion del mes (sin recalcular comisiones).</div>
            {factExterna && factExterna.registros && factExterna.registros.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                {factExterna.registros.map((r, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", borderBottom: "1px solid #f0f0f0" }}>
                    <span style={{ color: "#444" }}>{r.local_id === 2 ? "Ushuaia" : "Rio Grande"}</span>
                    <span style={{ fontWeight: 600 }}>{fmt(parseFloat(r.monto))}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "8px 0 0", fontWeight: 700 }}>
                  <span>Total</span><span style={{ color: "#c9a84c" }}>{fmt(factExterna.total)}</span>
                </div>
              </div>
            )}
            <div className="fg" style={{ marginBottom: 8 }}>
              <div className="fl">Local</div>
              <select className="inp" value={factExtLocal} onChange={e => setFactExtLocal(e.target.value)}>
                <option value="1">Rio Grande</option>
                <option value="2">Ushuaia</option>
              </select>
            </div>
            <div className="fg" style={{ marginBottom: 10 }}>
              <div className="fl">Monto facturado</div>
              <input className="inp" type="number" placeholder="0" value={factExtMonto} onChange={e => setFactExtMonto(e.target.value)} />
            </div>
            <button className="btn btn-p" style={{ width: "100%" }} onClick={guardarFactExterna}>Guardar facturacion anterior</button>
            {(comisiones || factExterna) && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: "2px solid #c9a84c" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0" }}>
                  <span style={{ color: "#444" }}>Ventas este sistema</span>
                  <span style={{ fontWeight: 600 }}>{fmt(comisiones ? comisiones.total_ventas : 0)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0" }}>
                  <span style={{ color: "#444" }}>Facturacion sistema anterior</span>
                  <span style={{ fontWeight: 600 }}>{fmt(factExterna ? factExterna.total : 0)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "8px 0 0", fontWeight: 700 }}>
                  <span>Facturacion total del mes</span>
                  <span style={{ color: "#c9a84c" }}>{fmt((comisiones ? comisiones.total_ventas : 0) + (factExterna ? factExterna.total : 0))}</span>
                </div>
              </div>
            )}
          </div>

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
                  <span style={{ fontSize: 24, fontWeight: 700, color: "white" }}>{fmt(parseFloat(flujoEst.resultado_neto || 0))}</span>
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
                    <span style={{ fontSize: 12, fontWeight: 600, color: r.c }}>{fmt(parseFloat(r.v || 0))}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", marginTop: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>RESULTADO NETO</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: flujoEst.resultado_neto >= 0 ? "#2d7a4f" : "#c0392b" }}>{fmt(parseFloat(flujoEst.resultado_neto || 0))}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "costos" && (
        <div className="g2 fade">
          <div className="card">
            <div className="ct">Costos reales del mes (cargados en el flujo)</div>
            {(() => {
              const grupos = [];
              if (flujoEst) {
                const push = (label, obj) => { if (obj && obj.detalle) Object.entries(obj.detalle).forEach(([k, v]) => grupos.push({ l: k + " (" + label + ")", v })); };
                push("variable", flujoEst.variables);
                push("fijo", flujoEst.fijos);
                push("admin", flujoEst.admin);
                push("sueldo", flujoEst.sueldos);
                push("impuesto", flujoEst.impuestos);
              }
              if (grupos.length === 0) return <div style={{ fontSize: 12, color: "#999", padding: "10px 0" }}>Todavia no hay costos cargados este mes. Cargalos en la pestaña Flujo.</div>;
              return grupos.map((c, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid #f0f0f0" }}>
                  <span style={{ fontSize: 12, color: "#444444" }}>{c.l}</span>
                  <span style={{ color: "#c9a84c" }}>{fmt(c.v)}</span>
                </div>
              ));
            })()}
          </div>
          <div className="card">
            <div className="ct">Costo de mercaderia vendida (CMV)</div>
            {cmv ? (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13 }}>
                  <span style={{ color: "#444" }}>Ventas del mes</span>
                  <span style={{ fontWeight: 600 }}>{fmt(cmv.ventas)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13, color: "#c0392b" }}>
                  <span>CMV (costo de lo vendido)</span>
                  <span>- {fmt(cmv.cmv)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 4px", borderTop: "2px solid #2d7a4f", marginTop: 6, fontSize: 14, fontWeight: 700 }}>
                  <span>Margen bruto</span>
                  <span style={{ color: "#2d7a4f" }}>{fmt(cmv.margen_bruto)} ({Math.round(cmv.margen_pct)}%)</span>
                </div>
                <div style={{ fontSize: 10, color: "#888", marginTop: 8 }}>El CMV usa el costo cargado en cada producto vendido este mes.</div>
              </div>
            ) : <div style={{ fontSize: 12, color: "#999", padding: "10px 0" }}>Sin datos de CMV este mes.</div>}
          </div>
        </div>
      )}

      {tab === "equilibrio" && (
        <div className="g2 fade">
          <div className="card">
            <div className="ct">Punto de equilibrio</div>
            {loading ? <div style={{ color: "#65676B" }}>Calculando...</div> : <div>
              <div style={{ fontSize: 48, fontWeight: 700, color: "#c9a84c" }}>{fmt(parseFloat(equilibrio?.punto_equilibrio || 0))}</div>
              <div style={{ fontSize: 11, color: "#65676B", marginTop: 4 }}>ventas minimas para cubrir costos</div>
              <div className="divider" />
              {[
                { l: "Costos fijos", v: fmt(parseFloat(equilibrio?.costos_fijos || 0)) },
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
              { l: "Ventas actuales", v: fmt(parseFloat(equilibrio?.ventas_actuales || 0)), c: "#2d7a4f" },
              { l: "Punto equilibrio", v: fmt(parseFloat(equilibrio?.punto_equilibrio || 0)), c: "#c9a84c" },
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
                <div className="card"><div className="ct">Total ventas</div><div style={{ fontSize: 28, fontWeight: 700, color: "#2d7a4f" }}>{fmt(datos.totalVentas)}</div></div>
                <div className="card"><div className="ct">Cantidad de ventas</div><div style={{ fontSize: 28, fontWeight: 700, color: "#c9a84c" }}>{datos.cantVentas}</div></div>
                <div className="card"><div className="ct">Ticket promedio</div><div style={{ fontSize: 28, fontWeight: 700, color: "#2471a3" }}>{fmt(Math.round(datos.ticketProm))}</div></div>
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
                          <td style={{ color: "#2d7a4f", fontWeight: 600 }}>{fmt(parseFloat(v.total || 0))}</td>
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
                            <span style={{ fontSize: 12, color: "#c9a84c", fontWeight: 600 }}>{fmt(total)} ({pct}%)</span>
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

const NIVELES_INF = {
  inicial: { label: "Nivel Inicial", pct: 2, emoji: "\uD83C\uDF31" },
  medio: { label: "Nivel Medio", pct: 3, emoji: "\uD83C\uDF38" },
  alto: { label: "Nivel Alto", pct: 4, emoji: "\uD83D\uDC8E" },
  top: { label: "Top Influencer", pct: 5, emoji: "\uD83D\uDC51" }
};

function Cupones() {
  const [cupons, setCupons] = useState([]);
  const [tab, setTab] = useState("lista");
  const [nc, setNc] = useState({ code: "", desc: "", type: "%", value: "", channel: "Instagram", max: "" });
  const [mensaje, setMensaje] = useState("");
  const [influencers, setInfluencers] = useState([]);
  const [showNuevoInf, setShowNuevoInf] = useState(false);
  const [nuevoInf, setNuevoInf] = useState({ nombre: "", instagram: "", telefono: "", nivel: "inicial", cuponModo: "nuevo", cupon_id: "", nuevoCodigo: "", nuevoTipo: "%", nuevoValor: "" });
  const [pagandoInf, setPagandoInf] = useState(null);
  const [montoPago, setMontoPago] = useState("");
  const [notaPago, setNotaPago] = useState("");
  const [clientesInf, setClientesInf] = useState([]);
  const [buscarCliInf, setBuscarCliInf] = useState("");
  const [cliSelInf, setCliSelInf] = useState(null);
  const [editandoInf, setEditandoInf] = useState(null);

  const cargarInfluencers = () => {
    API.get("/influencers").then(res => setInfluencers(res.data || [])).catch(() => {});
  };

  useEffect(() => {
    getCupones().then(res => setCupons(res.data)).catch(() => setCupons(CUPONS_DATA));
    cargarInfluencers();
    API.get("/clientes").then(res => setClientesInf(res.data || [])).catch(() => {});
  }, []);

  const abrirNuevoInf = () => {
    setEditandoInf(null);
    setNuevoInf({ nombre: "", instagram: "", telefono: "", nivel: "inicial", cuponModo: "nuevo", cupon_id: "", nuevoCodigo: "", nuevoTipo: "%", nuevoValor: "" });
    setCliSelInf(null); setBuscarCliInf("");
    setShowNuevoInf(true);
  };

  const abrirEditarInf = (inf) => {
    setEditandoInf(inf);
    setNuevoInf({
      nombre: inf.nombre || "", instagram: inf.instagram || "", telefono: inf.telefono || "",
      nivel: inf.nivel || "inicial", cuponModo: "existente", cupon_id: inf.cupon_id || "",
      nuevoCodigo: "", nuevoTipo: "%", nuevoValor: ""
    });
    setCliSelInf(inf.cliente_id ? { id: inf.cliente_id, nombre: inf.cliente_nombre || "Clienta vinculada" } : null);
    setBuscarCliInf("");
    setShowNuevoInf(true);
  };

  const guardarInfluencer = async () => {
    if (!nuevoInf.nombre.trim()) return setMensaje("Falta el nombre de la influencer");
    if (!editandoInf && nuevoInf.cuponModo === "existente" && !nuevoInf.cupon_id) return setMensaje("Elegi un cupon existente");
    if (!editandoInf && nuevoInf.cuponModo === "nuevo" && !nuevoInf.nuevoCodigo.trim()) return setMensaje("Falta el codigo del cupon nuevo");
    try {
      if (editandoInf) {
        await API.put("/influencers/" + editandoInf.id, {
          nombre: nuevoInf.nombre, instagram: nuevoInf.instagram || null, telefono: nuevoInf.telefono || null,
          nivel: nuevoInf.nivel,
          cliente_id: cliSelInf?.id || null
        });
        setMensaje("Influencer actualizada!");
      } else {
        await API.post("/influencers", {
          nombre: nuevoInf.nombre, instagram: nuevoInf.instagram || null, telefono: nuevoInf.telefono || null,
          nivel: nuevoInf.nivel,
          cupon_id: nuevoInf.cuponModo === "existente" ? parseInt(nuevoInf.cupon_id) : null,
          crear_cupon: nuevoInf.cuponModo === "nuevo" ? { codigo: nuevoInf.nuevoCodigo, tipo: nuevoInf.nuevoTipo, valor: parseFloat(nuevoInf.nuevoValor) || 0 } : null,
          cliente_id: cliSelInf?.id || null
        });
        setMensaje("Influencer agregada!");
      }
      setShowNuevoInf(false);
      setEditandoInf(null);
      setNuevoInf({ nombre: "", instagram: "", telefono: "", nivel: "inicial", cuponModo: "nuevo", cupon_id: "", nuevoCodigo: "", nuevoTipo: "%", nuevoValor: "" });
      setCliSelInf(null); setBuscarCliInf("");
      cargarInfluencers();
      getCupones().then(res => setCupons(res.data));
      setTimeout(() => setMensaje(""), 3000);
    } catch (e) { setMensaje("Error: " + (e?.response?.data?.error || "no se pudo guardar")); }
  };

  const toggleInfluencer = async (inf) => {
    try {
      await API.put("/influencers/" + inf.id, { activo: !inf.activo });
      cargarInfluencers();
    } catch (e) {}
  };

  const registrarPagoInf = async () => {
    const monto = parseFloat(montoPago);
    if (isNaN(monto) || monto <= 0) return setMensaje("Monto invalido");
    try {
      await API.post("/influencers/" + pagandoInf.id + "/pagos", { monto, notas: notaPago || null });
      setMensaje("Pago registrado!");
      setPagandoInf(null); setMontoPago(""); setNotaPago("");
      cargarInfluencers();
      setTimeout(() => setMensaje(""), 3000);
    } catch (e) { setMensaje("Error al registrar pago"); }
  };

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
        <MCard label="Influencers" value={String(influencers.filter(i => i.activo).length)} color="#2471a3" />
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
                  <td>{(c.tipo || c.type) === "%" ? (c.valor || c.value) + "%" : fmt((c.valor || c.value || 0))}</td>
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
              <div style={{ fontSize: 13, color: "#65676B", marginTop: 6 }}>{nc.value ? (nc.type === "%" ? nc.value + "% de descuento" : fmt(parseInt(nc.value || "0")) + " de descuento") : "Descuento"}</div>
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
            <thead><tr><th>Influencer</th><th>Nivel</th><th>Cupon</th><th>Vendido</th><th>Comision</th><th>Pagado</th><th>Pendiente</th><th>Activa</th><th></th></tr></thead>
            <tbody>
              {influencers.map(inf => {
                const niv = NIVELES_INF[inf.nivel] || NIVELES_INF.inicial;
                return (
                  <tr key={inf.id}>
                    <td style={{ color: "#111111", fontWeight: 600 }}>{inf.nombre}{inf.instagram ? <div style={{ fontSize: 10, color: "#888" }}>@{inf.instagram}</div> : null}</td>
                    <td><span className="badge bb">{niv.emoji} {niv.label} ({inf.comision_pct}%)</span></td>
                    <td style={{ color: "#c9a84c" }}>{inf.cupon_codigo || "-"}</td>
                    <td>{fmt(parseFloat(inf.total_vendido || 0))}</td>
                    <td style={{ color: "#2d7a4f", fontWeight: 600 }}>{fmt(parseFloat(inf.comision_generada || 0))}</td>
                    <td>{fmt(parseFloat(inf.total_pagado || 0))}</td>
                    <td style={{ color: parseFloat(inf.pendiente || 0) > 0 ? "#c0392b" : "#2d7a4f", fontWeight: 600 }}>{fmt(parseFloat(inf.pendiente || 0))}</td>
                    <td><Sw on={inf.activo} toggle={() => toggleInfluencer(inf)} /></td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <span onClick={() => abrirEditarInf(inf)} style={{ cursor: "pointer", color: "#65676B", fontSize: 11, marginRight: 8 }}>editar</span>
                      <span onClick={() => setPagandoInf(inf)} style={{ cursor: "pointer", color: "#c9a84c", fontSize: 11 }}>Registrar pago</span>
                    </td>
                  </tr>
                );
              })}
              {influencers.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: "center", color: "#999", padding: 20, fontSize: 12 }}>Todavia no hay influencers cargadas</td></tr>
              )}
            </tbody>
          </table>
          <div style={{ marginTop: 12 }}><button className="btn btn-p btn-sm" onClick={abrirNuevoInf}>+ Agregar influencer</button></div>
        </div>
      )}

      {showNuevoInf && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShowNuevoInf(false)}>
          <div className="card" style={{ width: 440, maxWidth: "92vw" }} onClick={e => e.stopPropagation()}>
            <div className="ct">{editandoInf ? "Editar influencer" : "Agregar influencer"}</div>
            <div className="fg"><div className="fl">Nombre</div><input className="inp" value={nuevoInf.nombre} onChange={e => setNuevoInf(p => ({ ...p, nombre: e.target.value }))} /></div>
            <div className="fg"><div className="fl">Instagram (opcional)</div><input className="inp" placeholder="usuario" value={nuevoInf.instagram} onChange={e => setNuevoInf(p => ({ ...p, instagram: e.target.value }))} /></div>
            <div className="fg"><div className="fl">Telefono (opcional)</div><input className="inp" value={nuevoInf.telefono} onChange={e => setNuevoInf(p => ({ ...p, telefono: e.target.value }))} /></div>
            <div className="fg">
              <div className="fl">Nivel</div>
              <select className="sel" value={nuevoInf.nivel} onChange={e => setNuevoInf(p => ({ ...p, nivel: e.target.value }))}>
                {Object.entries(NIVELES_INF).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label} ({v.pct}%)</option>)}
              </select>
            </div>
            {!editandoInf && (
            <div className="fg">
              <div className="fl">Cupon</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <button type="button" onClick={() => setNuevoInf(p => ({ ...p, cuponModo: "nuevo" }))} style={{ flex: 1, fontSize: 11, padding: "6px", border: "1px solid " + (nuevoInf.cuponModo === "nuevo" ? "#c9a84c" : "#e8e8e8"), borderRadius: 4, background: nuevoInf.cuponModo === "nuevo" ? "#c9a84c15" : "#fff", color: nuevoInf.cuponModo === "nuevo" ? "#c9a84c" : "#65676B", cursor: "pointer" }}>Crear cupon nuevo</button>
                <button type="button" onClick={() => setNuevoInf(p => ({ ...p, cuponModo: "existente" }))} style={{ flex: 1, fontSize: 11, padding: "6px", border: "1px solid " + (nuevoInf.cuponModo === "existente" ? "#c9a84c" : "#e8e8e8"), borderRadius: 4, background: nuevoInf.cuponModo === "existente" ? "#c9a84c15" : "#fff", color: nuevoInf.cuponModo === "existente" ? "#c9a84c" : "#65676B", cursor: "pointer" }}>Usar cupon existente</button>
              </div>
              {nuevoInf.cuponModo === "nuevo" ? (
                <div style={{ display: "flex", gap: 6 }}>
                  <input className="inp" placeholder="CODIGO" style={{ flex: 2 }} value={nuevoInf.nuevoCodigo} onChange={e => setNuevoInf(p => ({ ...p, nuevoCodigo: e.target.value.toUpperCase() }))} />
                  <select className="sel" style={{ flex: 1 }} value={nuevoInf.nuevoTipo} onChange={e => setNuevoInf(p => ({ ...p, nuevoTipo: e.target.value }))}>
                    <option value="%">%</option><option value="$">$</option>
                  </select>
                  <input className="inp" type="number" placeholder="5" style={{ flex: 1 }} value={nuevoInf.nuevoValor} onChange={e => setNuevoInf(p => ({ ...p, nuevoValor: e.target.value }))} />
                </div>
              ) : (
                <select className="sel" value={nuevoInf.cupon_id} onChange={e => setNuevoInf(p => ({ ...p, cupon_id: e.target.value }))}>
                  <option value="">Seleccionar cupon...</option>
                  {cuponsAMostrar.map(c => <option key={c.id} value={c.id}>{c.codigo || c.code}</option>)}
                </select>
              )}
            </div>
            )}
            <div className="fg">
              <div className="fl">Vincular con una clienta (opcional, para que tenga acceso al portal)</div>
              {cliSelInf ? (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "#f7f5f0", borderRadius: 6 }}>
                  <span style={{ fontSize: 12 }}>{cliSelInf.nombre} {cliSelInf.cuit_dni ? "(" + cliSelInf.cuit_dni + ")" : ""}</span>
                  <span onClick={() => { setCliSelInf(null); setBuscarCliInf(""); }} style={{ cursor: "pointer", color: "#c9a84c", fontSize: 12 }}>quitar</span>
                </div>
              ) : (
                <div>
                  <input className="inp" placeholder="Buscar por nombre o DNI" value={buscarCliInf} onChange={e => setBuscarCliInf(e.target.value)} />
                  {buscarCliInf.trim().length > 0 && (
                    <div style={{ border: "1px solid #eee", borderRadius: 6, marginTop: 4, maxHeight: 160, overflowY: "auto" }}>
                      {clientesInf.filter(cl => (cl.nombre || "").toLowerCase().includes(buscarCliInf.toLowerCase()) || (cl.cuit_dni || "").includes(buscarCliInf)).slice(0, 6).map(cl => (
                        <div key={cl.id} onClick={() => { setCliSelInf(cl); setBuscarCliInf(""); }} style={{ padding: "8px 10px", cursor: "pointer", borderBottom: "1px solid #f2f2f2", fontSize: 12 }}>{cl.nombre} <span style={{ color: "#999" }}>{cl.cuit_dni ? "(" + cl.cuit_dni + ")" : ""}</span></div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="btn btn-p" style={{ flex: 1 }} onClick={guardarInfluencer}>Guardar</button>
              <button className="btn btn-g" style={{ flex: 1 }} onClick={() => setShowNuevoInf(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {pagandoInf && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setPagandoInf(null)}>
          <div className="card" style={{ width: 360, maxWidth: "92vw" }} onClick={e => e.stopPropagation()}>
            <div className="ct">Registrar pago a {pagandoInf.nombre}</div>
            <div style={{ fontSize: 12, color: "#65676B", marginBottom: 10 }}>Pendiente: {fmt(parseFloat(pagandoInf.pendiente || 0))}</div>
            <div className="fg"><div className="fl">Monto ($)</div><input className="inp" type="number" value={montoPago} onChange={e => setMontoPago(e.target.value)} /></div>
            <div className="fg"><div className="fl">Nota (opcional)</div><input className="inp" placeholder="Ej: transferencia" value={notaPago} onChange={e => setNotaPago(e.target.value)} /></div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="btn btn-p" style={{ flex: 1 }} onClick={registrarPagoInf}>Guardar</button>
              <button className="btn btn-g" style={{ flex: 1 }} onClick={() => setPagandoInf(null)}>Cancelar</button>
            </div>
          </div>
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
  const [nuevoPremio, setNuevoPremio] = useState({ nombre: "", descripcion: "", puntos_requeridos: "", imagen_url: "", stock_total: "", solo_mes_cumpleanos: false, nivel_minimo: "Bronze" });
  const [precioCalc, setPrecioCalc] = useState("");
  const [editandoPremio, setEditandoPremio] = useState(null);
  const [codigoValidar, setCodigoValidar] = useState("");
  const [resultadoValidacion, setResultadoValidacion] = useState(null);
  const tierNext = { Bronze: 2000, Silver: 5000, Gold: 10000, Platinum: 20000, Black: 99999 };

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

  const editarPremio = (p) => {
    setEditandoPremio(p);
    setNuevoPremio({
      nombre: p.nombre || "", descripcion: p.descripcion || "",
      puntos_requeridos: String(p.puntos_requeridos || ""),
      imagen_url: p.imagen_url || "",
      stock_total: p.stock_total != null ? String(p.stock_total) : "",
      solo_mes_cumpleanos: p.solo_mes_cumpleanos === true,
      nivel_minimo: p.nivel_minimo || "Bronze"
    });
    setShowForm(true);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const guardarPremio = async () => {
    if (!nuevoPremio.nombre || !nuevoPremio.puntos_requeridos) return setMensaje("Completa nombre y puntos requeridos");
    try {
      const datos = {
        ...nuevoPremio,
        puntos_requeridos: parseInt(nuevoPremio.puntos_requeridos),
        stock_total: nuevoPremio.stock_total ? parseInt(nuevoPremio.stock_total) : null
      };
      if (editandoPremio) {
        await API.put("/fidelizacion/premios/" + editandoPremio.id, datos);
        setMensaje("Premio actualizado!");
        setEditandoPremio(null);
      } else {
        await API.post("/fidelizacion/premios", datos);
        setMensaje("Premio creado!");
      }
      setShowForm(false);
      setNuevoPremio({ nombre: "", descripcion: "", puntos_requeridos: "", imagen_url: "", stock_total: "", solo_mes_cumpleanos: false, nivel_minimo: "Bronze" });
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
        <MCard label="Puntos emitidos" value={fmtNum(totalPuntos)} color="#c9a84c" />
        <MCard label="Clientes con puntos" value={String(clientesAMostrar.filter(c => (c.puntos || 0) > 0).length)} color="#2d7a4f" />
        <MCard label="Premios activos" value={String(premios.filter(p => p.activo).length)} color="#2471a3" />
        <MCard label="Nivel Platinum" value={String(clientesAMostrar.filter(c => (c.nivel || c.tier) === "Platinum").length)} color="#7d3c98" />
        <MCard label="Nivel Black" value={String(clientesAMostrar.filter(c => (c.nivel || c.tier) === "Black").length)} color="#1a1a1a" />
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
                    <td style={{ fontFamily: "'Inter',sans-serif", fontSize: 18, fontWeight: 700, color: "#c9a84c" }}>{fmtNum(puntos)}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1 }}><div className="pb"><div className="pf" style={{ width: pct + "%", background: "#c9a84c" }} /></div></div>
                        <span style={{ fontSize: 9, color: "#65676B", width: 50 }}>{nivel ===fmtNum("Platinum" ? "MAX" : (next - puntos)) + "p"}</span>
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
            <button className="btn btn-p btn-sm" onClick={() => { setShowForm(!showForm); setEditandoPremio(null); setNuevoPremio({ nombre: "", descripcion: "", puntos_requeridos: "", imagen_url: "", stock_total: "", solo_mes_cumpleanos: false, nivel_minimo: "Bronze" }); }}>+ Nuevo premio</button>
          </div>
          {showForm && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "#65676B", letterSpacing: ".1em", marginBottom: 14 }}>NUEVO PREMIO</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="fg"><div className="fl">Nombre del premio</div><input className="inp" placeholder="Ej: Envio gratis" value={nuevoPremio.nombre} onChange={e => setNuevoPremio(p => ({ ...p, nombre: e.target.value }))} /></div>
                <div className="fg"><div className="fl">Puntos requeridos</div><input className="inp" type="number" placeholder="500" value={nuevoPremio.puntos_requeridos} onChange={e => setNuevoPremio(p => ({ ...p, puntos_requeridos: e.target.value }))} /></div>
              </div>
              <div style={{ background: "#f7f5f0", borderRadius: 8, padding: 12, marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: "#c9a84c" }}>💡 Calculadora de puntos sugeridos</div>
                <div style={{ fontSize: 11, color: "#65676B", marginBottom: 8 }}>Regla: el cliente tiene que gastar 5 veces el valor del regalo. Puntos = precio de venta ÷ 20.</div>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                  <div style={{ flex: 1 }}>
                    <div className="fl">Precio de venta del regalo</div>
                    <input className="inp" type="number" placeholder="8000" value={precioCalc} onChange={e => setPrecioCalc(e.target.value)} />
                  </div>
                  <div style={{ textAlign: "center", minWidth: 90 }}>
                    <div style={{ fontSize: 10, color: "#888" }}>Puntos</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#2d7a4f" }}>{precioCalc && parseFloat(precioCalc) > 0 ? Math.round(parseFloat(precioCalc) / 20) : "—"}</div>
                  </div>
                  <button className="btn btn-sm" style={{ background: "#c9a84c", color: "#fff", whiteSpace: "nowrap" }} disabled={!precioCalc || parseFloat(precioCalc) <= 0} onClick={() => setNuevoPremio(p => ({ ...p, puntos_requeridos: String(Math.round(parseFloat(precioCalc) / 20)) }))}>Usar estos puntos</button>
                </div>
              </div>
              <div className="fg"><div className="fl">Descripcion</div><input className="inp" placeholder="Breve descripcion del premio" value={nuevoPremio.descripcion} onChange={e => setNuevoPremio(p => ({ ...p, descripcion: e.target.value }))} /></div>
              <div className="fg"><div className="fl">URL de imagen (opcional)</div><input className="inp" placeholder="https://..." value={nuevoPremio.imagen_url} onChange={e => setNuevoPremio(p => ({ ...p, imagen_url: e.target.value }))} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="fg"><div className="fl">Stock disponible (vacio = ilimitado)</div><input className="inp" type="number" placeholder="Ej: 10" value={nuevoPremio.stock_total} onChange={e => setNuevoPremio(p => ({ ...p, stock_total: e.target.value }))} /></div>
                <div className="fg" style={{ display: "flex", alignItems: "center", paddingTop: 18 }}>
                  <div className="fg" style={{ marginBottom: 10 }}>
                    <div className="fl">Nivel minimo para canjear</div>
                    <select className="inp" value={nuevoPremio.nivel_minimo} onChange={e => setNuevoPremio(p => ({ ...p, nivel_minimo: e.target.value }))}>
                      <option value="Bronze">Bronze (todos)</option>
                      <option value="Silver">Silver o superior</option>
                      <option value="Gold">Gold o superior</option>
                      <option value="Platinum">Platinum o superior</option>
                      <option value="Black">Black (solo Black)</option>
                    </select>
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer" }}>
                    <input type="checkbox" checked={nuevoPremio.solo_mes_cumpleanos} onChange={e => setNuevoPremio(p => ({ ...p, solo_mes_cumpleanos: e.target.checked }))} />
                    Solo disponible en el mes de cumpleanos de la clienta
                  </label>
                </div>
              </div>
              <button className="btn btn-p" style={{ width: "100%", marginTop: 8 }} onClick={guardarPremio}>{editandoPremio ? "Guardar cambios" : "Crear premio"}</button>
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
                      {p.nivel_minimo && p.nivel_minimo !== "Bronze" && <span className="badge" style={{ background: "#1a1a1a15", color: "#1a1a1a", fontSize: 8, marginLeft: 4 }}>{p.nivel_minimo}+</span>}
                    </div>
                    {p.descripcion && <div style={{ fontSize: 10, color: "#65676B", marginTop: 3 }}>{p.descripcion}</div>}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: "#c9a84c" }}>{p.puntos_requeridos} pts</span>
                      <span className={"badge " + (disp !== null && disp < 5 ? "br" : "bg")}>{disp === null ? "ilimitado" : disp + "u"}</span>
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                      <button className="btn btn-sm" style={{ flex: 1, background: "#c9a84c", color: "#fff" }} onClick={() => editarPremio(p)}>Editar</button>
                      {p.activo && <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => desactivarPremio(p)}>Desactivar</button>}
                    </div>
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

function Pedidos({ localId }) {
  const [pedidos, setPedidos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [buscarCli, setBuscarCli] = useState("");
  const [buscarProd, setBuscarProd] = useState("");
  const [cliSel, setCliSel] = useState(null);
  const [prodSel, setProdSel] = useState(null);
  const [itemNuevo, setItemNuevo] = useState("");
  const [filtroLista, setFiltroLista] = useState("");
  const [mensaje, setMensaje] = useState("");

  const cargar = () => {
    API.get("/pedidos?estado=esperando").then(res => setPedidos(res.data)).catch(() => {});
  };
  useEffect(() => {
    cargar();
    getClientes().then(res => setClientes(res.data)).catch(() => {});
    const localParam = Number(localId) === 2 ? "ush" : "rg";
    API.get("/productos?local=" + localParam).then(res => setProductos(res.data)).catch(() => {});
  }, [localId]);

  const pedidosFiltrados = filtroLista.trim().length > 0
    ? pedidos.filter(p => {
        const t = filtroLista.toLowerCase();
        return (p.cliente_nombre || "").toLowerCase().includes(t)
          || (p.telefono || "").includes(filtroLista)
          || (p.cuit_dni || "").includes(filtroLista)
          || (p.producto_nombre || "").toLowerCase().includes(t);
      })
    : pedidos;

  const cliFiltrados = buscarCli.trim().length > 0
    ? clientes.filter(c => (c.nombre || "").toLowerCase().includes(buscarCli.toLowerCase()) || (c.cuit_dni || "").includes(buscarCli) || (c.telefono || "").includes(buscarCli)).slice(0, 6)
    : [];
  const prodFiltrados = buscarProd.trim().length > 0
    ? productos.filter(p => (p.nombre || "").toLowerCase().includes(buscarProd.toLowerCase())).slice(0, 6)
    : [];

  const guardar = async () => {
    if (!cliSel) return setMensaje("Elegi la clienta");
    if (!prodSel && !itemNuevo.trim()) return setMensaje("Elegi un producto o escribi una sugerencia");
    try {
      await API.post("/pedidos", {
        cliente_id: cliSel.id,
        producto_id: prodSel ? prodSel.id : null,
        producto_texto: !prodSel && itemNuevo.trim() ? itemNuevo.trim() : null
      });
      setMensaje(prodSel ? "Pedido anotado! Cuando llegue stock va a aparecer en Postventa." : "Sugerencia de producto anotada!");
      setCliSel(null); setProdSel(null); setBuscarCli(""); setBuscarProd(""); setItemNuevo("");
      cargar();
      setTimeout(() => setMensaje(""), 4000);
    } catch (e) { setMensaje("Error al anotar el pedido"); }
  };

  const borrar = async (id) => {
    if (!confirm("Borrar este pedido?")) return;
    try { await API.delete("/pedidos/" + id); cargar(); } catch (e) {}
  };

  return (
    <div className="fade">
      <div className="ph">
        <div><div className="pt">Pedidos de clientas</div><div className="ps">productos que las clientas estan esperando - avisan en Postventa cuando llega stock</div></div>
      </div>

      {mensaje && <div className="card" style={{ marginBottom: 12, padding: 12, background: mensaje.startsWith("Error") ? "#fdecea" : "#eafaf1", color: mensaje.startsWith("Error") ? "#c0392b" : "#1e7e4f", fontSize: 13 }}>{mensaje}</div>}

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Anotar nuevo pedido</div>
        <div className="g2">
          <div>
            <div className="fl">Clienta</div>
            {cliSel ? (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "#f7f5f0", borderRadius: 6 }}>
                <span style={{ fontSize: 12 }}>{cliSel.nombre} ({cliSel.cuit_dni})</span>
                <span onClick={() => setCliSel(null)} style={{ cursor: "pointer", color: "#c9a84c", fontSize: 12 }}>cambiar</span>
              </div>
            ) : (
              <div>
                <input className="inp" placeholder="Buscar clienta por nombre o DNI" value={buscarCli} onChange={e => setBuscarCli(e.target.value)} />
                {cliFiltrados.length > 0 && (
                  <div style={{ border: "1px solid #eee", borderRadius: 6, marginTop: 4 }}>
                    {cliFiltrados.map(cl => (
                      <div key={cl.id} onClick={() => { setCliSel(cl); setBuscarCli(""); }} style={{ padding: "8px 10px", cursor: "pointer", borderBottom: "1px solid #f2f2f2", fontSize: 12 }}>{cl.nombre} <span style={{ color: "#999" }}>({cl.cuit_dni})</span></div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div>
            <div className="fl">Producto que espera</div>
            {prodSel ? (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "#f7f5f0", borderRadius: 6 }}>
                <span style={{ fontSize: 12 }}>{prodSel.nombre}</span>
                <span onClick={() => setProdSel(null)} style={{ cursor: "pointer", color: "#c9a84c", fontSize: 12 }}>cambiar</span>
              </div>
            ) : (
              <div>
                <input className="inp" placeholder="Buscar producto" value={buscarProd} onChange={e => setBuscarProd(e.target.value)} />
                {prodFiltrados.length > 0 && (
                  <div style={{ border: "1px solid #eee", borderRadius: 6, marginTop: 4 }}>
                    {prodFiltrados.map(pr => (
                      <div key={pr.id} onClick={() => { setProdSel(pr); setBuscarProd(""); setItemNuevo(""); }} style={{ padding: "8px 10px", cursor: "pointer", borderBottom: "1px solid #f2f2f2", fontSize: 12 }}>{pr.nombre} <span style={{ color: (pr.stock_rg || 0) + (pr.stock_ush || 0) > 0 ? "#2d7a4f" : "#c0392b" }}>· stock {(pr.stock_rg || 0) + (pr.stock_ush || 0)}</span></div>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed #e0e0e0" }}>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>¿No lo encontras? Anotalo como sugerencia de producto a traer:</div>
                  <input className="inp" placeholder="Ej: Serum vitamina C marca X" value={itemNuevo} onChange={e => setItemNuevo(e.target.value)} />
                </div>
              </div>
            )}
          </div>
        </div>
        <button className="btn btn-p" style={{ marginTop: 12 }} onClick={guardar}>Anotar pedido</button>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Pedidos en espera ({pedidos.length})</div>
          <input className="inp" style={{ maxWidth: 260 }} placeholder="Buscar por clienta, celular, DNI o producto" value={filtroLista} onChange={e => setFiltroLista(e.target.value)} />
        </div>
        {pedidos.length === 0 ? <div style={{ fontSize: 12, color: "#999", padding: "10px 0" }}>No hay pedidos en espera.</div> : pedidosFiltrados.length === 0 ? <div style={{ fontSize: 12, color: "#999", padding: "10px 0" }}>No se encontraron pedidos con esa busqueda.</div> : (
          <table style={{ width: "100%", fontSize: 12 }}>
            <thead><tr style={{ color: "#888", textAlign: "left" }}><th style={{ padding: "6px 0" }}>Clienta</th><th>Contacto</th><th>Producto</th><th style={{ textAlign: "center" }}>Stock</th><th></th></tr></thead>
            <tbody>
              {pedidosFiltrados.map(p => (
                <tr key={p.id} style={{ borderTop: "1px solid #f0f0f0" }}>
                  <td style={{ padding: "8px 0" }}>{p.cliente_nombre}</td>
                  <td style={{ fontSize: 11, color: "#65676B" }}>{p.telefono || "-"}{p.cuit_dni ? " · DNI " + p.cuit_dni : ""}</td>
                  <td>{p.producto_nombre} {p.es_sugerencia && <span className="badge" style={{ background: "#c9a84c22", color: "#c9a84c", fontSize: 8 }}>sugerencia</span>}</td>
                  <td style={{ textAlign: "center", color: p.es_sugerencia ? "#999" : (p.stock_total > 0 ? "#2d7a4f" : "#c0392b"), fontWeight: 600 }}>{p.es_sugerencia ? "—" : (p.stock_total > 0 ? "Disponible!" : "0")}</td>
                  <td style={{ textAlign: "right" }}><span onClick={() => borrar(p.id)} style={{ cursor: "pointer", color: "#ccc", fontSize: 15 }}>×</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ fontSize: 10, color: "#888", marginTop: 10 }}>Cuando un producto tiene stock, el aviso para la clienta aparece en la seccion Postventa.</div>
      </div>
    </div>
  );
}

function PostventaWA() {
  const [rules, setRules] = useState([]);
  const [tab, setTab] = useState("reglas");
  const [pedidosListos, setPedidosListos] = useState([]);
  const avisarPedido = async (pd) => {
    const texto = "Hola " + (pd.cliente_nombre || "") + "! Te avisamos que ya tenemos stock de " + pd.producto_nombre + ". Te esperamos! - Girasoles Beauty";
    let tel = (pd.telefono || "").replace(/[^0-9]/g, "");
    if (!tel) { alert("Esta clienta no tiene telefono cargado"); return; }
    let numero = tel;
    if (!numero.startsWith("54")) numero = "549" + numero;
    else if (numero.startsWith("54") && !numero.startsWith("549")) numero = "549" + numero.slice(2);
    window.open("https://wa.me/" + numero + "?text=" + encodeURIComponent(texto), "_blank");
    try { await API.post("/pedidos/" + pd.id + "/avisar"); setPedidosListos(prev => prev.filter(x => x.id !== pd.id)); } catch (e) {}
  };
  useEffect(() => { API.get("/pedidos/con-stock").then(res => setPedidosListos(res.data)).catch(() => {}); }, []);
  const [sel, setSel] = useState(null);
  const [nuevaRegla, setNuevaRegla] = useState({ nombre: "", disparador: "post_compra", dias: 7, segmento: "Todos", mensaje: "" });
  const [pendientesWA, setPendientesWA] = useState([]);
  const [cargandoWA, setCargandoWA] = useState(false);
  const [plantillaWA, setPlantillaWA] = useState("Hola {nombre}! Soy de Girasoles Beauty 🌻 Te escribo para saber como te fue con tu compra. Cualquier consulta estamos para ayudarte!");
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

  const cargarPendientesWA = () => {
    setCargandoWA(true);
    API.get("/postventa/pendientes-whatsapp?dias=7")
      .then(res => setPendientesWA(res.data || []))
      .catch(() => setPendientesWA([]))
      .finally(() => setCargandoWA(false));
  };

  const armarMensajeWA = (cli) => plantillaWA
    .replace("{nombre}", (cli.nombre || "").split(",")[0].trim())
    .replace("{producto}", cli.ultimo_producto || "tu compra");

  const enviarWA = async (cli) => {
    const texto = armarMensajeWA(cli);
    const tel = (cli.telefono || "").replace(/[^0-9]/g, "");
    // Argentina: agregar 54 y 9 si no estan (para celulares)
    let numero = tel;
    if (!numero.startsWith("54")) numero = "549" + numero;
    else if (numero.startsWith("54") && !numero.startsWith("549")) numero = "549" + numero.slice(2);
    window.open("https://wa.me/" + numero + "?text=" + encodeURIComponent(texto), "_blank");
    try {
      await API.post("/postventa/marcar-enviado", { cliente_id: cli.id, mensaje: texto });
      setPendientesWA(prev => prev.map(p => p.id === cli.id ? { ...p, ya_enviado: true } : p));
    } catch (e) {}
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
        {[["reglas", "REGLAS"], ["enviar", "ENVIAR HOY"], ["pedidos", "PEDIDOS LISTOS" + (pedidosListos.length > 0 ? " (" + pedidosListos.length + ")" : "")], ["nueva", "NUEVA REGLA"]].map(([id, l]) => (
          <div key={id} className={"tab " + (tab === id ? "on" : "")} onClick={() => { setTab(id); setSel(null); if (id === "enviar") cargarPendientesWA(); }}>{l}</div>
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
      {tab === "pedidos" && (
        <div className="card fade">
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Pedidos de clientas con stock disponible</div>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 12 }}>Productos que las clientas esperaban y ya tienen stock. Envia el aviso por WhatsApp.</div>
          {pedidosListos.length === 0 ? <div style={{ fontSize: 12, color: "#999", padding: "10px 0" }}>No hay pedidos con stock disponible ahora.</div> : pedidosListos.map(pd => (
            <div key={pd.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f0f0f0" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{pd.cliente_nombre}</div>
                <div style={{ fontSize: 11, color: "#888" }}>{pd.producto_nombre} · stock {pd.stock_total}</div>
              </div>
              <button className="btn btn-sm" style={{ background: "#25D366", color: "#fff", fontSize: 12 }} onClick={() => avisarPedido(pd)}>Enviar WhatsApp</button>
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
      {tab === "enviar" && (
        <div className="fade">
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="ct">Mensaje a enviar (podes editarlo)</div>
            <textarea className="inp" rows={3} style={{ resize: "vertical" }} value={plantillaWA} onChange={e => setPlantillaWA(e.target.value)} />
            <div style={{ fontSize: 10, color: "#65676B", marginTop: 6 }}>Usa {"{nombre}"} y {"{producto}"} y se reemplazan solos por los datos de cada cliente.</div>
          </div>
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div className="ct" style={{ margin: 0 }}>Clientes que compraron hace 7 dias</div>
              <button className="btn btn-g btn-sm" onClick={cargarPendientesWA}>Actualizar</button>
            </div>
            {cargandoWA ? (
              <div style={{ color: "#65676B", padding: 20, fontSize: 12 }}>Cargando...</div>
            ) : pendientesWA.length === 0 ? (
              <div style={{ textAlign: "center", color: "#65676B", padding: 24, fontSize: 12 }}>No hay clientes con compra de hace 7 dias (o no tienen telefono cargado)</div>
            ) : (
              <table>
                <thead><tr><th>Cliente</th><th>Telefono</th><th>Ultima compra</th><th></th></tr></thead>
                <tbody>
                  {pendientesWA.map(cli => (
                    <tr key={cli.id} style={{ opacity: cli.ya_enviado ? 0.5 : 1 }}>
                      <td style={{ fontWeight: 600 }}>{cli.nombre}</td>
                      <td style={{ fontSize: 11 }}>{cli.telefono}</td>
                      <td style={{ fontSize: 11, color: "#65676B" }}>{cli.ultimo_producto || "-"}</td>
                      <td style={{ textAlign: "right" }}>
                        {cli.ya_enviado ? (
                          <span style={{ fontSize: 10, color: "#2d7a4f", fontWeight: 600 }}>Enviado ✓</span>
                        ) : (
                          <button className="btn btn-sm" style={{ background: "#25d366", color: "#ffffff", fontSize: 11, fontWeight: 700 }} onClick={() => enviarWA(cli)}>Enviar WhatsApp</button>
                        )}
                      </td>
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
    } catch (e) { setMensaje("Error: " + (e?.response?.data?.error || "no se pudo guardar")); }
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
                    <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 48, fontWeight: 700, color: "#c9a84c" }}>{fmt(resultado)}</div>
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
  const [nueva, setNueva] = useState({ monto: "", beneficiario_nombre: "", beneficiario_telefono: "", cliente_id: "", migracion: false, forma_pago: "" });
  const [mediosPago, setMediosPago] = useState([]);

  const cargar = () => {
    setLoading(true);
    Promise.all([API.get("/gift-cards"), API.get("/clientes"), API.get("/medios-pago")])
      .then(([gc, cl, mp]) => { setGiftcards(gc.data || []); setClientes(cl.data || []); setMediosPago(mp.data || []); setLoading(false); })
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
      setNueva({ monto: "", beneficiario_nombre: "", beneficiario_telefono: "", cliente_id: "", migracion: false, forma_pago: "" });
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
        <MCard label="Total emitido (historico)" value={fmt(totalEmitido)} color="#c9a84c" />
        <MCard label="Saldo vivo (sin canjear)" value={fmt(totalSaldoVivo)} color="#2d7a4f" />
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
                  <td style={{ fontSize: 12 }}>{fmt(parseFloat(g.monto_inicial))}</td>
                  <td><span className={"badge " + (parseFloat(g.saldo) === 0 ? "br" : parseFloat(g.saldo) < parseFloat(g.monto_inicial) ? "ba" : "bg")}>{fmt(parseFloat(g.saldo))}</span></td>
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
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, overflowY: "auto", padding: "20px" }}>
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
            {!nueva.migracion && (
              <div className="fg" style={{ marginBottom: 8 }}>
                <div className="fl">Forma de pago</div>
                <select className="inp" value={nueva.forma_pago} onChange={e => setNueva(p => ({ ...p, forma_pago: e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  {mediosPago.map(m => <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
                </select>
              </div>
            )}
            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 0", cursor: "pointer", marginBottom: 4 }}>
              <input type="checkbox" checked={nueva.migracion} onChange={e => setNueva(p => ({ ...p, migracion: e.target.checked }))} style={{ marginTop: 2 }} />
              <span style={{ fontSize: 11, color: "#111111" }}>Gift card ya vendida (del sistema anterior). No cuenta como ingreso de hoy en la caja.</span>
            </label>
            <div style={{ fontSize: 10, color: "#65676B", marginBottom: 14 }}>{nueva.migracion ? "Se crea la gift card para poder canjearla, pero NO suma al cierre de hoy (ya se cobro antes)." : "Al emitirla se cobra el monto ahora y se genera el ingreso de caja. La factura se hace recien cuando se canjea por productos."}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-g" style={{ flex: 1 }} onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="btn btn-p" style={{ flex: 1 }} onClick={emitir}>Emitir y cobrar</button>
            </div>
          </div>
        </div>
      )}

      {verMov && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, overflowY: "auto", padding: "20px" }}>
          <div className="card" style={{ width: 420, background: "#ffffff" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{verMov.codigo}</div>
            <div style={{ fontSize: 11, color: "#65676B", marginBottom: 14 }}>{verMov.beneficiario_nombre} - Saldo actual: <b style={{ color: "#2d7a4f" }}>{fmt(parseFloat(verMov.saldo))}</b></div>
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
                      <div style={{ color: m.tipo === "emision" ? "#2d7a4f" : "#c0392b" }}>{m.tipo === "emision" ? "+" : "-"}{fmt(parseFloat(m.importe))}</div>
                      <div style={{ fontSize: 10, color: "#65676B" }}>saldo: {fmt(parseFloat(m.saldo_resultante))}</div>
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
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#c9a84c" }}>{fmt(parseFloat(p.total || 0))}</div>
                </div>
                <div style={{ background: "#f8f8f8", borderRadius: 6, padding: "6px 10px", marginBottom: 10 }}>
                  {items.map((it, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "3px 0", borderBottom: idx < items.length - 1 ? "1px solid #f0f0f0" : "none" }}>
                      <span>{it.nombre} x{it.cantidad}</span>
                      <span style={{ color: "#65676B" }}>{fmt(parseFloat(it.precio || 0))}</span>
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
                    <td style={{ color: "#c9a84c", fontWeight: 600 }}>{fmt(parseFloat(p.total || 0))}</td>
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
    <div style={{ minHeight: "100vh", background: "#F0F2F5", fontFamily: "'Inter',sans-serif" }}>
      <div style={{ padding: "16px 32px", borderBottom: "1px solid #E4E6EB", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 20, fontWeight: 700, fontWeight: 300, letterSpacing: ".18em", color: "#c9a84c" }}>LUMIERE</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 11, color: "#5C5F66" }}>{client.email}</span>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#c9a84c", display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff", fontSize: 13, fontWeight: 600 }}>{client.name[0]}</div>
        </div>
      </div>
      <div style={{ padding: "28px 32px", maxWidth: 860, margin: "0 auto" }}>
        <div style={{ background: "#ffffff", border: "1px solid #E4E6EB", borderRadius: 14, padding: 26, marginBottom: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 9, color: "#c9a84c88", letterSpacing: ".25em", textTransform: "uppercase", marginBottom: 5 }}>Bienvenida de nuevo</div>
              <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 24, fontWeight: 700, color: "#1C1E21", marginBottom: 14 }}>{client.name}</div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 20, background: "#c9a84c15", border: "1px solid #E4E6EB", fontSize: 9, color: "#c9a84c", letterSpacing: ".12em" }}>
                NIVEL {client.tier.toUpperCase()}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 52, fontWeight: 700, color: "#c9a84c", lineHeight: 1 }}>{fmtNum(client.points)}</div>
              <div style={{ fontSize: 9, color: "#5C5F66", letterSpacing: ".2em", marginTop: 3 }}>PUNTOS DISPONIBLES</div>
              <div style={{ fontSize: 10, color: "#8a8d92", marginTop: 6 }}>Proximo nivel: {fmtNum((2000 - client.points))} pts</div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
          {[["canjear", "Canjear puntos"], ["cupones", "Mis cupones"], ["historial", "Mis compras"]].map(([id, l]) => (
            <button key={id} onClick={() => setTab(id)} style={{ padding: "8px 16px", borderRadius: 7, border: "1px solid", borderColor: tab === id ? "#c9a84c55" : "#E4E6EB", background: tab === id ? "#c9a84c12" : "transparent", color: tab === id ? "#c9a84c" : "#5C5F66", fontFamily: "'Inter',sans-serif", fontSize: 11, cursor: "pointer" }}>{l}</button>
          ))}
        </div>
        {tab === "canjear" && (
          <div>
            <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 20, fontWeight: 700, color: "#1C1E21", marginBottom: 14 }}>Canjea tus puntos</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
              {REWARDS_DISPLAY.map(r => {
                const can = client.points >= r.pts;
                return (
                  <div key={r.id} style={{ background: can ? "#ffffff" : "#ffffff", border: "1px solid " + (can ? "#c9a84c33" : "#ffffff"), borderRadius: 10, padding: 16, opacity: can ? 1 : 0.5 }}>
                    {can && <div style={{ background: "#2d7a4f", color: "#ffffff", fontSize: 8, padding: "2px 6px", borderRadius: 3, marginBottom: 8, width: "fit-content" }}>PODES CANJEAR</div>}
                    <div style={{ fontSize: 24, marginBottom: 8 }}>{r.emoji}</div>
                    <div style={{ fontSize: 11, color: "#1C1E21" }}>{r.name}</div>
                    <div style={{ fontSize: 9, color: "#8a8d92", letterSpacing: ".1em", marginTop: 2 }}>{r.brand}</div>
                    <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 20, fontWeight: 700, color: "#c9a84c", marginTop: 10 }}>{fmtNum(r.pts)}</div>
                    <div style={{ fontSize: 9, color: "#8a8d92" }}>PUNTOS</div>
                    {can && <button style={{ marginTop: 10, width: "100%", padding: "7px", borderRadius: 5, background: "#c9a84c15", border: "1px solid #E4E6EB", color: "#c9a84c", fontFamily: "'Inter',sans-serif", fontSize: 10, cursor: "pointer" }}>Canjear</button>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {tab === "cupones" && (
          <div>
            <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 20, fontWeight: 700, color: "#1C1E21", marginBottom: 14 }}>Tus cupones activos</div>
            {[{ code: "BDAY10", desc: "$10.000 de descuento por cumpleanos", exp: "Valido hasta: 30/06/2026" }, { code: "INSTA20", desc: "20% off en toda la tienda", exp: "Valido hasta: 31/05/2026" }].map((cp, i) => (
              <div key={i} style={{ background: "#ffffff", border: "1px dashed #E4E6EB", borderRadius: 10, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div>
                  <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 20, fontWeight: 700, color: "#c9a84c", letterSpacing: ".1em" }}>{cp.code}</div>
                  <div style={{ fontSize: 11, color: "#5C5F66", marginTop: 3 }}>{cp.desc}</div>
                  <div style={{ fontSize: 10, color: "#E4E6EB", marginTop: 4 }}>{cp.exp}</div>
                </div>
                <button style={{ background: "#c9a84c15", border: "1px solid #E4E6EB", color: "#c9a84c", padding: "7px 14px", borderRadius: 5, fontFamily: "'Inter',sans-serif", fontSize: 10, cursor: "pointer" }}>Copiar</button>
              </div>
            ))}
          </div>
        )}
        {tab === "historial" && (
          <div>
            <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 20, fontWeight: 700, color: "#1C1E21", marginBottom: 14 }}>Historial de compras</div>
            {[
              { date: "24/05/2026", items: "Serum Vitamina C x 1", total: 8500, pts: 85, canal: "Local" },
              { date: "10/05/2026", items: "Base Liquida HD, Mascara x 2", total: 13700, pts: 137, canal: "Tiendanube" },
              { date: "28/04/2026", items: "Crema Hidratante FPS50 x 2", total: 12400, pts: 124, canal: "Local" },
            ].map((h, i) => (
              <div key={i} style={{ background: "#ffffff", border: "1px solid #ffffff", borderRadius: 10, padding: "14px 18px", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 10, color: "#8a8d92", marginBottom: 4 }}>{h.date} - {h.canal}</div>
                  <div style={{ fontSize: 12, color: "#1C1E21" }}>{h.items}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 20, fontWeight: 700, color: "#c9a84c" }}>{fmt(h.total)}</div>
                  <div style={{ fontSize: 9, color: "#8a8d92", marginTop: 2 }}>+{h.pts} puntos</div>
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
  const [hist, setHist] = useState(null);
  const [sel, setSel] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(true);

  const cargar = () => {
    setLoading(true);
    Promise.all([
      API.get("/comisiones/" + (localId || 1)),
      API.get("/comisiones/" + (localId || 1) + "/historial")
    ]).then(([d, h]) => {
      setDatos(d.data);
      setHist(h.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };
  useEffect(() => { cargar(); setSel([]); }, [localId]);

  const toggle = (id) => setSel(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const pagarSeleccionadas = async () => {
    if (sel.length === 0) return setMensaje("Selecciona al menos un dia");
    if (!confirm("Marcar como pagadas " + sel.length + " comisiones? Se van a sumar como egreso al flujo de efectivo.")) return;
    try {
      const res = await API.put("/comisiones/" + (localId || 1) + "/pagar", { ids: sel });
      setMensaje("Pagadas! Total: " + fmt(res.data.total_pagado) + " (" + res.data.dias_pagados + " dias)");
      setSel([]);
      cargar();
      setTimeout(() => setMensaje(""), 4000);
    } catch (e) { setMensaje("Error al marcar como pagadas"); }
  };

  const localNombre = Number(localId) === 2 ? "Ushuaia" : "Rio Grande";

  return (
    <div className="fade">
      <div className="ph">
        <div><div className="pt">Comisiones {localNombre}</div><div className="ps">comision diaria por facturacion - se paga cuando vos marcas</div></div>
      </div>

      {mensaje && <div className="card" style={{ marginBottom: 12, padding: 12, background: mensaje.startsWith("Error") ? "#fdecea" : "#eafaf1", color: mensaje.startsWith("Error") ? "#c0392b" : "#1e7e4f", fontSize: 13 }}>{mensaje}</div>}

      {loading ? <div style={{ color: "#65676B", padding: 20 }}>Cargando...</div> : (
        <div>
          {/* Comision de HOY */}
          {datos && (
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="ct">Comision de hoy</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: "#65676B" }}>Facturado hoy</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{fmt(parseFloat(datos.facturacion || 0))}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "#65676B" }}>Comision</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#2d7a4f" }}>{fmt(parseFloat(datos.comision || 0))}</div>
                </div>
              </div>
              {/* Metas */}
              {[[datos.umbral_1, datos.comision_1, 1, "#2d7a4f"], [datos.umbral_2, datos.comision_2, 2, "#c9a84c"], [datos.umbral_3, datos.comision_3, 3, "#8e44ad"]].map(([um, co, niv, col], idx) => (
                parseFloat(um) > 0 ? (
                  <div key={idx} style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: "#444" }}>Meta {niv}: {fmt(parseFloat(um))}</span>
                      <span style={{ fontSize: 11, color: col, fontWeight: 600 }}>+{fmt(parseFloat(co))}</span>
                    </div>
                    <div className="pb" style={{ height: 8 }}>
                      <div className="pf" style={{ width: Math.min(Math.round((parseFloat(datos.facturacion || 0) / parseFloat(um)) * 100), 100) + "%", background: (datos.nivel >= niv) ? col : "#dddddd" }} />
                    </div>
                  </div>
                ) : null
              ))}
            </div>
          )}

          {/* Historial diario */}
          {hist && (
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div className="ct" style={{ margin: 0 }}>Historial de comisiones</div>
                {sel.length > 0 && <button className="btn btn-p btn-sm" onClick={pagarSeleccionadas}>Marcar pagadas ({sel.length})</button>}
              </div>

              <div className="g2" style={{ marginBottom: 12 }}>
                <div style={{ background: "#f7f5f0", borderRadius: 8, padding: 10, textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "#888" }}>PENDIENTE DE PAGO</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#c0392b" }}>{fmt(hist.total_pendiente || 0)}</div>
                </div>
                <div style={{ background: "#f7f5f0", borderRadius: 8, padding: 10, textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "#888" }}>YA PAGADO</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#2d7a4f" }}>{fmt(hist.total_pagado || 0)}</div>
                </div>
              </div>

              {(!hist.registros || hist.registros.length === 0) ? <div style={{ fontSize: 12, color: "#999", padding: "10px 0" }}>Todavia no hay comisiones registradas.</div> : (
                <table style={{ width: "100%", fontSize: 12 }}>
                  <thead><tr style={{ color: "#888", textAlign: "left" }}><th style={{ padding: "6px 0" }}></th><th>Fecha</th><th style={{ textAlign: "right" }}>Facturado</th><th style={{ textAlign: "right" }}>Comision</th><th style={{ textAlign: "center" }}>Estado</th></tr></thead>
                  <tbody>
                    {hist.registros.map(row => (
                      <tr key={row.id} style={{ borderTop: "1px solid #f0f0f0" }}>
                        <td style={{ padding: "7px 0" }}>{!row.pagada && <input type="checkbox" checked={sel.includes(row.id)} onChange={() => toggle(row.id)} />}</td>
                        <td>{row.fecha ? (String(row.fecha).slice(8, 10) + "/" + String(row.fecha).slice(5, 7) + "/" + String(row.fecha).slice(0, 4)) : "-"}</td>
                        <td style={{ textAlign: "right" }}>{fmt(parseFloat(row.facturacion_mes || 0))}</td>
                        <td style={{ textAlign: "right", fontWeight: 600 }}>{fmt(parseFloat(row.comision_ganada || 0))}</td>
                        <td style={{ textAlign: "center" }}>{row.pagada ? <span style={{ color: "#2d7a4f", fontSize: 11 }}>Pagada</span> : <span style={{ color: "#c0392b", fontSize: 11 }}>Pendiente</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}
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
                <div><span style={{ fontSize: 20, fontWeight: 700, color: "#2d7a4f" }}>{fmt(conUrgencia.reduce((s, o) => s + parseFloat(o.total || 0), 0))}</span><div style={{ fontSize: 10, color: "#65676B" }}>total pendiente</div></div>
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
                        <span style={{ fontSize: 15, fontWeight: 700, color: "#111111" }}>{fmt(parseFloat(o.total || 0))}</span>
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
          <div style={{ fontSize: 28, fontWeight: 700, color: saldoColor }}>{fmt(saldo)}</div>
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
                      {m.tipo === "ingreso" ? "+" : "-"}{fmt(parseFloat(m.importe))}
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

function CajaRespaldo({ usuario }) {
  const [total, setTotal] = useState(0);
  const [movimientos, setMovimientos] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [modo, setModo] = useState("guardar");
  const [importe, setImporte] = useState("");
  const [concepto, setConcepto] = useState("");
  const [cuentaId, setCuentaId] = useState("");
  const [mensaje, setMensaje] = useState("");

  const cargar = () => {
    API.get("/caja-respaldo").then(res => {
      setTotal(parseFloat(res.data?.total || 0));
      setMovimientos(res.data?.movimientos || []);
    }).catch(() => {});
  };
  useEffect(() => {
    cargar();
    API.get("/cuentas-pago?solo_pago=true").then(res => setCuentas(res.data || [])).catch(() => {});
  }, []);

  const registrar = async () => {
    if (!importe || parseFloat(importe) <= 0) return setMensaje("Ingresa un importe valido");
    try {
      await API.post("/caja-respaldo/" + modo, {
        importe: parseFloat(importe),
        concepto: concepto || null,
        cuenta_pago_id: cuentaId || null,
        usuario_id: usuario?.id || null
      });
      setMensaje(modo === "guardar" ? "Plata guardada en la reserva!" : "Plata retirada de la reserva!");
      setImporte(""); setConcepto(""); setCuentaId("");
      cargar();
      setTimeout(() => setMensaje(""), 3000);
    } catch (e) {
      setMensaje("Error: " + (e?.response?.data?.error || "no se pudo registrar"));
    }
  };

  const borrar = async (id) => {
    if (!confirm("Borrar este movimiento de la reserva?")) return;
    try { await API.delete("/caja-respaldo/" + id); cargar(); } catch (e) {}
  };

  return (
    <div>
      <div className="ph">
        <div><div className="pt">Caja de Respaldo</div><div className="ps">plata que tenemos guardada a favor</div></div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "#65676B", textTransform: "uppercase", letterSpacing: 1 }}>Total guardado</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#2d7a4f" }}>{fmt(total)}</div>
        </div>
      </div>

      {mensaje && <div style={{ background: mensaje.startsWith("Error") ? "#fdecea" : "#eafaf1", color: mensaje.startsWith("Error") ? "#c0392b" : "#1e7e4f", padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{mensaje}</div>}

      <div className="g2" style={{ alignItems: "start" }}>
        <div className="card">
          <div className="ct">Nuevo movimiento</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <button className="btn" style={{ flex: 1, background: modo === "guardar" ? "#2d7a4f" : "#f0f0f0", color: modo === "guardar" ? "#fff" : "#65676B" }} onClick={() => setModo("guardar")}>Guardar plata</button>
            <button className="btn" style={{ flex: 1, background: modo === "sacar" ? "#c0392b" : "#f0f0f0", color: modo === "sacar" ? "#fff" : "#65676B" }} onClick={() => setModo("sacar")}>Sacar plata</button>
          </div>
          <div className="fg" style={{ marginBottom: 8 }}>
            <div className="fl">Importe ($)</div>
            <input className="inp" type="number" placeholder="0" value={importe} onChange={e => setImporte(e.target.value)} />
          </div>
          <div className="fg" style={{ marginBottom: 8 }}>
            <div className="fl">{modo === "guardar" ? "Cuenta de banco de donde sale" : "Cuenta de banco a donde vuelve"} (opcional)</div>
            <select className="sel" value={cuentaId} onChange={e => setCuentaId(e.target.value)}>
              <option value="">Seleccionar...</option>
              {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="fg" style={{ marginBottom: 12 }}>
            <div className="fl">Concepto (opcional)</div>
            <input className="inp" placeholder="Ej: ahorro del mes" value={concepto} onChange={e => setConcepto(e.target.value)} />
          </div>
          <button className="btn btn-p" style={{ width: "100%" }} onClick={registrar}>{modo === "guardar" ? "Guardar en la reserva" : "Sacar de la reserva"}</button>
        </div>

        <div className="card">
          <div className="ct">Historial de la reserva</div>
          {movimientos.length === 0 ? <div style={{ fontSize: 12, color: "#999", padding: "10px 0" }}>Sin movimientos todavia.</div> : (
            <table style={{ width: "100%", fontSize: 12 }}>
              <thead><tr style={{ color: "#888", textAlign: "left" }}><th style={{ padding: "6px 0" }}>Fecha</th><th>Concepto</th><th style={{ textAlign: "center" }}>Tipo</th><th style={{ textAlign: "right" }}>Importe</th><th></th></tr></thead>
              <tbody>
                {movimientos.map(m => (
                  <tr key={m.id} style={{ borderTop: "1px solid #f0f0f0" }}>
                    <td style={{ padding: "8px 0" }}>{m.creado_en ? new Date(m.creado_en).toLocaleDateString("es-AR") : "-"}</td>
                    <td>{m.concepto || "-"}</td>
                    <td style={{ textAlign: "center" }}><span className="badge" style={{ background: m.tipo === "guardar" ? "#2d7a4f15" : "#c0392b15", color: m.tipo === "guardar" ? "#2d7a4f" : "#c0392b", fontSize: 9 }}>{m.tipo === "guardar" ? "guardado" : "retirado"}</span></td>
                    <td style={{ textAlign: "right", fontWeight: 600, color: m.tipo === "guardar" ? "#2d7a4f" : "#c0392b" }}>{m.tipo === "guardar" ? "+" : "-"}{fmt(parseFloat(m.importe))}</td>
                    <td style={{ textAlign: "right" }}><span onClick={() => borrar(m.id)} style={{ cursor: "pointer", color: "#ccc", fontSize: 15 }}>×</span></td>
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
  const [tabLocal, setTabLocal] = useState(localId === 2 ? "ush" : "rg");
  const [comprobantes, setComprobantes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState(null);
  const [configTicket, setConfigTicket] = useState({ mostrar_cliente: true, mostrar_numero: true, mostrar_fecha: true, mensaje_pie: "Gracias por tu compra!", texto_extra: "" });

  useEffect(() => { API.get("/config-ticket").then(res => { if (res.data) setConfigTicket(res.data); }).catch(() => {}); }, []);

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
      const localParam = tabLocal === "rg" ? "&local_id=1" : tabLocal === "ush" ? "&local_id=2" : "";
      const proms = meses.map(({ m, a }) => API.get("/ventas?mes=" + m + "&anio=" + a + localParam));
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

  useEffect(() => { cargar(); }, [desde, hasta, tabLocal]);

  const fmtNro = (v) => {
    const pv = v.punto_venta || 5;
    const nro = v.nro_comprobante;
    if (!nro) return v.numero_factura || "-";
    return String(pv).padStart(4, "0") + "-" + String(nro).padStart(8, "0");
  };

  const totalPeriodo = comprobantes.reduce((s, v) => s + parseFloat(v.total || 0), 0);

  const reimprimir = (v) => {
    const localNombre = (v.local_id === 2 || v.local_id === "2") ? "Ushuaia" : "Rio Grande";
    const fecha = new Date(v.creado_en || v.fecha).toLocaleString("es-AR");
    const cfg = configTicket || {};
    const items = v.items || [];
    const lineas = items.map(i =>
      `<tr><td style="text-align:left">${i.cantidad}x ${i.nombre}</td><td style="text-align:right">$${(parseFloat(i.precio_unitario) * i.cantidad).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>`
    ).join("");
    const html = `
      <html><head><meta charset="utf-8"><style>
        @page { size: 80mm auto; margin: 0; }
        body { width: 72mm; margin: 0 auto; font-family: monospace; font-size: 12px; color: #000; padding: 6px; }
        .c { text-align: center; }
        .b { font-weight: bold; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 1px 0; font-size: 12px; }
        hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
        .tot { font-size: 15px; font-weight: bold; }
        img.logo { width: 60mm; display: block; margin: 0 auto 4px; }
      </style></head><body>
        <img class="logo" src="${LOGO_TICKET}" />
        <div class="c">${localNombre}</div>
        <div class="c" style="font-size:9px; color:#555">REIMPRESION</div>
        ${cfg.mostrar_fecha !== false ? `<div class="c" style="font-size:10px">${fecha}</div>` : ""}
        ${(cfg.mostrar_numero !== false) ? `<div class="c" style="font-size:10px">Comprobante ${fmtNro(v)}</div>` : ""}
        ${(cfg.mostrar_cliente !== false && v.cliente_nombre) ? `<div class="c" style="font-size:10px">Cliente: ${v.cliente_nombre}</div>` : ""}
        <hr>
        <table>${lineas}</table>
        <hr>
        <table><tr><td class="tot">TOTAL</td><td class="tot" style="text-align:right">$${parseFloat(v.total || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr></table>
        <hr>
        <div class="c">${cfg.mensaje_pie || "Gracias por tu compra!"}</div>
        ${cfg.texto_extra ? `<div class="c" style="font-size:10px">${cfg.texto_extra}</div>` : ""}
        <br><br>
      </body></html>`;
    const w = window.open("", "_blank", "width=380,height=600");
    if (!w) { alert("Habilita las ventanas emergentes para imprimir el recibo"); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 300);
  };

  return (
    <div className="fade">
      <div className="ph">
        <div><div className="pt">Comprobantes</div><div className="ps">facturas emitidas - ARCA</div></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div><div style={{ fontSize: 9, color: "#65676B" }}>Desde</div><input className="inp" type="date" style={{ width: 140, padding: "6px 8px", fontSize: 12 }} value={desde} onChange={e => setDesde(e.target.value)} /></div>
          <div><div style={{ fontSize: 9, color: "#65676B" }}>Hasta</div><input className="inp" type="date" style={{ width: 140, padding: "6px 8px", fontSize: 12 }} value={hasta} onChange={e => setHasta(e.target.value)} /></div>
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
      <div className="g3" style={{ marginBottom: 16 }}>
        <MCard label="Comprobantes" value={String(comprobantes.length)} color="#c9a84c" />
        <MCard label="Total facturado" value={fmt(totalPeriodo)} color="#2d7a4f" />
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
                <Fragment key={i}>
                  <tr>
                    <td style={{ fontSize: 12, fontWeight: 600, color: "#c9a84c" }}>{fmtNro(v)}</td>
                    <td style={{ fontSize: 11, color: "#65676B" }}>{new Date(v.creado_en || v.fecha).toLocaleDateString("es-AR")}</td>
                    <td style={{ fontSize: 12 }}>{v.cliente_nombre || "Consumidor final"}</td>
                    <td style={{ fontSize: 11 }}>{v.tipo_factura || "B"}</td>
                    <td style={{ fontSize: 11, color: "#65676B" }}>{v.cae || "-"}</td>
                    <td style={{ color: "#2d7a4f", fontWeight: 600 }}>{fmt(parseFloat(v.total || 0))}</td>
                    <td>
                      <span style={{ cursor: "pointer", color: "#2C3E5C", fontSize: 11 }} onClick={() => setExpandido(expandido === i ? null : i)}>{expandido === i ? "Ocultar" : "Ver"}</span>
                      {" "}
                      <span style={{ cursor: "pointer", color: "#c9a84c", fontSize: 11, marginLeft: 8 }} onClick={() => reimprimir(v)}>Reimprimir</span>
                    </td>
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
                                  <td style={{ fontSize: 11 }}>{fmt(parseFloat(it.precio_unitario || 0))}</td>
                                  <td style={{ fontSize: 11, fontWeight: 600 }}>{fmt((parseFloat(it.precio_unitario || 0) * parseInt(it.cantidad || 0)))}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                        <div style={{ fontSize: 10, color: "#65676B", marginTop: 8 }}>Medio de pago: {v.medio_pago || "-"}{v.cae_vto ? " | CAE vto: " + v.cae_vto : ""}</div>
                      </td>
                    </tr>
                  )}
                </Fragment>
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
                      <td style={{ color: "#2d7a4f", fontWeight: 600 }}>{fmt(r.total)}</td>
                      <td style={{ fontSize: 12 }}>{fmt(r.ticketProm)}</td>
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
                <div style={{ fontSize: 13, color: "#2d7a4f", fontWeight: 600 }}>{fmt(r.total)}</div>
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
      const esMismoDia = (f) => {
        if (!f) return false;
        // Si la fecha viene como texto ISO (ej "2026-07-11..."), comparar los primeros 10 chars
        // para evitar el corrimiento por zona horaria. Si no, usar el metodo normal.
        const s = String(f);
        if (s.length >= 10 && s[4] === "-" && s[7] === "-") {
          return s.slice(0, 10) === fecha;
        }
        return fmtFecha(new Date(f)) === fecha;
      };
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
  // Sumar las gift cards emitidas (ingreso de caja) a su forma de pago
  (movsDia || []).forEach(mv => {
    if (mv.tipo === "I" && (mv.concepto || "").startsWith("Gift Card") && mv.forma_pago) {
      const m = mv.forma_pago;
      if (!porMedio[m]) porMedio[m] = { cantidad: 0, total: 0 };
      porMedio[m].cantidad += 1;
      porMedio[m].total += parseFloat(mv.importe || 0);
    }
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
        <div style={{ padding: "6px 4px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#111111" }}>Cierre de Caja</div>
            <div style={{ fontSize: 11, color: "#65676B" }}>{fmtDia(fecha)}</div>
          </div>
        </div>

        {/* Total del dia bien grande, estilo protagonista */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "stretch", flexWrap: "wrap" }}>
          <div style={{ flex: "2 1 300px", background: "linear-gradient(135deg, #2d7a4f, #256b44)", borderRadius: 14, padding: "18px 24px", boxShadow: "0 4px 14px rgba(45,122,79,0.25)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontSize: 11, color: "#ffffffcc", letterSpacing: ".15em", fontWeight: 600 }}>TOTAL DEL DIA</div>
            <div style={{ fontSize: 38, fontWeight: 800, color: "#ffffff", lineHeight: 1.1 }}>{fmt(totalDia)}</div>
            <div style={{ fontSize: 11, color: "#ffffffcc", marginTop: 2 }}>{ventasDia.length} ventas{totalGiftCards > 0 ? " + " + fmt(totalGiftCards) + " en gift cards" : ""}</div>
          </div>
          <div style={{ flex: "1 1 150px", display: "flex", flexDirection: "column" }}><MCard label="VENTAS" value={ventasDia.length} sub="del dia" color="#2471a3" /></div>
          <div style={{ flex: "1 1 150px", display: "flex", flexDirection: "column" }}><MCard label="TICKET PROMEDIO" value={fmt(ventasDia.length > 0 ? totalVentasNeto / ventasDia.length : 0)} sub="por venta" color="#8e44ad" /></div>
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
                        <td style={{ color: "#2d7a4f", fontWeight: 600 }}>{fmt(d.total)}</td>
                      </tr>
                    ))}
                    {totalGiftCards > 0 && (
                      <tr>
                        <td style={{ fontSize: 12, color: "#c9a84c" }}>Gift Cards emitidas</td>
                        <td style={{ fontSize: 12, color: "#65676B" }}>{giftCardsDia.length}</td>
                        <td style={{ color: "#c9a84c", fontWeight: 600 }}>{fmt(totalGiftCards)}</td>
                      </tr>
                    )}
                    <tr style={{ borderTop: "2px solid #eeeeee" }}>
                      <td style={{ fontWeight: 700 }}>TOTAL</td>
                      <td style={{ fontWeight: 700, color: "#65676B" }}>{ventasDia.length}</td>
                      <td style={{ fontWeight: 700, color: "#2d7a4f" }}>{fmt(totalDia)}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
            <div>
              <div className="card" style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: "#65676B", letterSpacing: ".1em", marginBottom: 10 }}>EFECTIVO EN CAJA</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: efectivoEsperado < 0 ? "#c0392b" : "#111111" }}>{fmt(efectivoEsperado)}</div>
                <div style={{ fontSize: 10, color: "#65676B", marginTop: 4 }}>ventas {fmt(ventasEfectivo)} + ingresos {fmt(ingresosManuales)} - egresos {fmt(egresosDia)}</div>
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
                          <td style={{ fontWeight: 600, color: m.tipo === "ingreso" ? "#2d7a4f" : "#c0392b" }}>{m.tipo === "ingreso" ? "+" : "-"}{fmt(parseFloat(m.importe || 0))}</td>
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
                  <td style={{ fontWeight: 600 }}>{fmt(parseFloat(v.total))}</td>
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
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, overflowY: "auto", padding: "20px" }}>
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
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, overflowY: "auto", padding: "20px" }}>
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
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, overflowY: "auto", padding: "20px" }}>
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
  const [busquedaProd, setBusquedaProd] = useState("");
  const [conteo, setConteo] = useState({});
  const [recibidoHist, setRecibidoHist] = useState([]);
  const [notaItem, setNotaItem] = useState({});
  const [extra, setExtra] = useState({ producto_id: "", cantidad: "", costo_unitario: "" });

  const cargar = async () => {
    setLoading(true);
    try {
      const [ordRes, prodRes, provRes] = await Promise.all([
        API.get("/ordenes-ingreso"),
        API.get("/productos?local=" + (Number(localId) === 2 ? "ush" : "rg")),
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

  const recargarItems = async () => {
    if (!ordenDetalle) return;
    try {
      const res = await API.get("/ordenes-ingreso/" + ordenDetalle.id + "/items");
      setItemsDetalle(res.data || []);
    } catch (e) {}
  };

  const editarItemOrden = async (it) => {
    const cantStr = prompt("Cantidad total del producto \"" + it.producto_nombre + "\":", it.cantidad_total);
    if (cantStr === null) return;
    const cant = parseInt(cantStr);
    if (isNaN(cant) || cant < 0) { setMensaje("Cantidad invalida"); return; }
    // Distribucion: si la orden manejaba rg/ush, preguntamos; si no, todo va al total
    let rg = it.cantidad_rg || 0, ush = it.cantidad_ush || 0;
    if ((it.cantidad_rg || 0) > 0 || (it.cantidad_ush || 0) > 0) {
      const rgStr = prompt("Cantidad para RIO GRANDE:", it.cantidad_rg || 0);
      if (rgStr === null) return;
      const ushStr = prompt("Cantidad para USHUAIA:", it.cantidad_ush || 0);
      if (ushStr === null) return;
      rg = parseInt(rgStr) || 0; ush = parseInt(ushStr) || 0;
    } else {
      rg = cant; ush = 0;
    }
    const costoStr = prompt("Costo unitario ($):", it.costo_unitario || 0);
    if (costoStr === null) return;
    try {
      await API.put("/ordenes-ingreso/" + ordenDetalle.id + "/items/" + it.id + "/editar", {
        cantidad_total: cant, cantidad_rg: rg, cantidad_ush: ush, costo_unitario: parseFloat(costoStr) || 0
      });
      setMensaje("Item actualizado!");
      recargarItems();
      setTimeout(() => setMensaje(""), 2500);
    } catch (e) { setMensaje("Error: " + (e?.response?.data?.error || e.message)); }
  };

  const eliminarItemOrden = async (it) => {
    if (!confirm("Eliminar el producto \"" + it.producto_nombre + "\" de esta orden?")) return;
    try {
      await API.delete("/ordenes-ingreso/" + ordenDetalle.id + "/items/" + it.id);
      setMensaje("Item eliminado!");
      recargarItems();
      setTimeout(() => setMensaje(""), 2500);
    } catch (e) { setMensaje("Error: " + (e?.response?.data?.error || e.message)); }
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
                {ordenes.filter(o => o.estado !== "recibida" && o.estado !== "pagada").map((o, i) => {
                  const completoMiLocal = localActual === "rg" ? o.rg_completo : o.ush_completo;
                  return (
                  <tr key={i}>
                    <td style={{ fontSize: 12, fontWeight: 600 }}>{o.numero_factura || "-"}</td>
                    <td style={{ fontSize: 12 }}>{o.proveedor_nombre || "-"}</td>
                    <td style={{ fontSize: 11, color: "#65676B" }}>{o.fecha_factura ? new Date(o.fecha_factura).toLocaleDateString("es-AR") : "-"}</td>
                    <td>
                      {completoMiLocal
                        ? <span className="badge" style={{ background: "#2d7a4f15", color: "#2d7a4f" }}>recibido en {localNombre}</span>
                        : <span className="badge" style={{ background: "#c9a84c15", color: "#c9a84c" }}>{o.estado}</span>}
                    </td>
                    <td style={{ fontSize: 12, color: "#2d7a4f", fontWeight: 600 }}>{fmt(parseFloat(o.total || 0))}</td>
                    <td>
                      {completoMiLocal
                        ? <button className="btn btn-sm" style={{ background: "#f0ece4", color: "#2d7a4f", border: "1px solid #2d7a4f" }} onClick={() => verDetalle(o)}>Recibido</button>
                        : <button className="btn btn-sm" style={{ background: "#2d7a4f", color: "white" }} onClick={() => verDetalle(o)}>Recibir</button>}
                    </td>
                  </tr>
                  );
                })}
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
              <div style={{ position: "relative" }}>
                {itemTemp.producto_id ? (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "#f7f5f0", borderRadius: 6 }}>
                    <span style={{ fontSize: 12 }}>{(productos.find(p => String(p.id) === String(itemTemp.producto_id)) || {}).nombre || "Producto"}</span>
                    <span onClick={() => { setItemTemp(p => ({ ...p, producto_id: "" })); setBusquedaProd(""); }} style={{ cursor: "pointer", color: "#c9a84c", fontSize: 12 }}>cambiar</span>
                  </div>
                ) : (
                  <div>
                    <input className="inp" placeholder="Buscar producto por nombre o codigo" value={busquedaProd} onChange={e => setBusquedaProd(e.target.value)} />
                    {busquedaProd.trim().length > 0 && (
                      <div style={{ position: "absolute", zIndex: 10, background: "#fff", border: "1px solid #eee", borderRadius: 6, width: "100%", maxHeight: 220, overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
                        {productos.filter(pr => (pr.nombre || "").toLowerCase().includes(busquedaProd.toLowerCase()) || (pr.codigo_barras || "").includes(busquedaProd)).slice(0, 10).map(pr => (
                          <div key={pr.id} onClick={() => { setItemTemp(p => ({ ...p, producto_id: pr.id })); setBusquedaProd(""); }} style={{ padding: "8px 10px", cursor: "pointer", borderBottom: "1px solid #f2f2f2", fontSize: 12 }}>
                            {pr.nombre}{pr.codigo_barras ? <span style={{ color: "#999" }}> · {pr.codigo_barras}</span> : null}
                          </div>
                        ))}
                        {productos.filter(pr => (pr.nombre || "").toLowerCase().includes(busquedaProd.toLowerCase()) || (pr.codigo_barras || "").includes(busquedaProd)).length === 0 && (
                          <div style={{ padding: "8px 10px", fontSize: 12, color: "#999" }}>Sin resultados</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
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
                      <td style={{ fontSize: 11, fontWeight: 600 }}>{fmt((it.costo_unitario * it.cantidad_total))}</td>
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
                    <span style={{ fontWeight: 600 }}>{fmt(sumaItems)}</span>
                  </div>
                  {totalFactura > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 4 }}>
                      <span style={{ color: "#666666" }}>Total de la factura</span>
                      <span style={{ fontWeight: 600 }}>{fmt(totalFactura)}</span>
                    </div>
                  )}
                  {!coincide && (
                    <div style={{ fontSize: 11, color: "#c0392b", fontWeight: 600, marginTop: 6 }}>
                      Diferencia de {fmt(Math.abs(sumaItems - totalFactura))} - revisa los costos unitarios antes de crear la orden
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
                      <td style={{ fontSize: 12 }}>{it.producto_nombre}{it.es_extra ? <span className="badge" style={{ background: "#c9a84c15", color: "#c9a84c", marginLeft: 6 }}>extra</span> : ""}
                        <span style={{ marginLeft: 8, whiteSpace: "nowrap" }}>
                          <span onClick={() => editarItemOrden(it)} style={{ cursor: "pointer", color: "#c9a84c", fontSize: 10, marginRight: 6 }}>editar</span>
                          <span onClick={() => eliminarItemOrden(it)} style={{ cursor: "pointer", color: "#c0392b", fontSize: 10 }}>eliminar</span>
                        </span></td>
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
    setForm(f => ({ ...f, items: [...f.items, { ...itemTemp, producto_nombre: prod?.nombre || "", producto_precio: (prod?.precio || prod?.price || 0) }] }));
    setItemTemp({ producto_id: "", cantidad: 1 });
  };

  const quitarItem = (idx) => {
    const setForm = editando ? setEditando : setNuevo;
    setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  };

  const guardar = async () => {
    const form = editando || nuevo;
    if (!form.nombre || form.items.length === 0) return setMensaje("Completa nombre y al menos un producto");
    // El precio del kit es la suma de los productos (calculado, no editable)
    const precioKit = form.items.reduce((s, it) => s + (parseFloat(it.producto_precio || 0) * parseInt(it.cantidad || 1)), 0);
    const formConPrecio = { ...form, precio: Math.round(precioKit) };
    try {
      if (editando) {
        await API.put("/kits/" + editando.id, formConPrecio);
        setMensaje("Kit actualizado!");
        setEditando(null);
      } else {
        await API.post("/kits", formConPrecio);
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
                        <div style={{ fontSize: 18, fontWeight: 700, color: "#c9a84c" }}>{fmt(parseFloat(kit.precio || 0))}</div>
                        {ahorro > 0 && <div style={{ fontSize: 10, color: "#2d7a4f" }}>Ahorro: {fmt(Math.round(ahorro))}</div>}
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
              <div className="fl">Precio del kit (suma de los productos)</div>
              <div style={{ padding: "10px 12px", background: "#f7f5f0", borderRadius: 8, fontSize: 18, fontWeight: 700, color: "#2d7a4f" }}>{fmt(Math.round(precioSugerido))}</div>
              <div style={{ fontSize: 10, color: "#65676B", marginTop: 4 }}>El descuento se aplica despues, al vender el kit en el Punto de Venta.</div>
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
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#c9a84c" }}>{fmt(Math.round(precioSugerido))}</span>
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

function Insumos({ localId, usuario }) {
  const [tab, setTab] = useState("stock");
  const [insumos, setInsumos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [ajustando, setAjustando] = useState(null);
  const [modoAjuste, setModoAjuste] = useState("exacto");
  const [valorAjuste, setValorAjuste] = useState("");
  const [errorAjuste, setErrorAjuste] = useState("");
  const [nuevo, setNuevo] = useState({ nombre: "", categoria: "", unidad: "unidad", proveedor_id: "", costo: "", stock_rg: "", stock_ush: "", stock_minimo: "" });

  const localNombre = localId === 2 ? "Ushuaia" : "Rio Grande";
  const stockLocal = (i) => localId === 2 ? (i.stock_ush || 0) : (i.stock_rg || 0);

  const cargar = async () => {
    setLoading(true);
    try {
      const [insRes, provRes, alertRes] = await Promise.all([
        API.get("/insumos"),
        API.get("/proveedores"),
        API.get("/insumos/alertas?local_id=" + (localId || 1))
      ]);
      setInsumos(insRes.data || []);
      setProveedores(provRes.data || []);
      setAlertas(alertRes.data || []);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { cargar(); }, [localId]);

  const guardar = async () => {
    if (!nuevo.nombre) return setMensaje("Completa al menos el nombre");
    try {
      if (editando) {
        await API.put("/insumos/" + editando.id, {
          nombre: nuevo.nombre, categoria: nuevo.categoria, unidad: nuevo.unidad,
          proveedor_id: nuevo.proveedor_id || null, costo: parseFloat(nuevo.costo) || 0,
          stock_minimo: parseInt(nuevo.stock_minimo) || 5
        });
        setMensaje("Insumo actualizado!");
      } else {
        await API.post("/insumos", {
          nombre: nuevo.nombre, categoria: nuevo.categoria, unidad: nuevo.unidad,
          proveedor_id: nuevo.proveedor_id || null, costo: parseFloat(nuevo.costo) || 0,
          stock_rg: parseInt(nuevo.stock_rg) || 0, stock_ush: parseInt(nuevo.stock_ush) || 0,
          stock_minimo: parseInt(nuevo.stock_minimo) || 5
        });
        setMensaje("Insumo creado!");
      }
      setNuevo({ nombre: "", categoria: "", unidad: "unidad", proveedor_id: "", costo: "", stock_rg: "", stock_ush: "", stock_minimo: "" });
      setShowForm(false); setEditando(null);
      cargar();
      setTimeout(() => setMensaje(""), 3000);
    } catch (e) { setMensaje("Error al guardar: " + (e.response?.data?.error || e.message)); }
  };

  const abrirEditar = (i) => {
    setEditando(i);
    setNuevo({ nombre: i.nombre, categoria: i.categoria || "", unidad: i.unidad || "unidad", proveedor_id: i.proveedor_id || "", costo: i.costo || "", stock_rg: "", stock_ush: "", stock_minimo: i.stock_minimo || "" });
    setShowForm(true);
  };

  const eliminar = async (i) => {
    if (!confirm("Quitar el insumo \"" + i.nombre + "\"?")) return;
    try {
      await API.delete("/insumos/" + i.id);
      setMensaje("Insumo quitado");
      cargar();
      setTimeout(() => setMensaje(""), 3000);
    } catch (e) { setMensaje("Error al quitar"); }
  };

  const abrirAjuste = (i) => {
    setAjustando(i);
    setModoAjuste("exacto");
    setValorAjuste(String(stockLocal(i)));
    setErrorAjuste("");
  };

  const confirmarAjuste = async () => {
    if (valorAjuste === "" || isNaN(parseInt(valorAjuste))) return setErrorAjuste("Ingresa un numero valido");
    try {
      const res = await API.put("/insumos/" + ajustando.id + "/ajustar-stock", {
        local_id: localId || 1, modo: modoAjuste, valor: valorAjuste
      });
      setMensaje("Stock ajustado: " + res.data.stock_anterior + "u -> " + res.data.stock_nuevo + "u (" + localNombre + ")");
      setAjustando(null);
      cargar();
      setTimeout(() => setMensaje(""), 4000);
    } catch (e) { setErrorAjuste(e.response?.data?.error || "Error al ajustar"); }
  };

  return (
    <div className="fade">
      <div className="ph">
        <div><div className="pt">Insumos</div><div className="ps">stock de uso interno - {localNombre}</div></div>
        <button className="btn btn-p btn-sm" onClick={() => { setEditando(null); setNuevo({ nombre: "", categoria: "", unidad: "unidad", proveedor_id: "", costo: "", stock_rg: "", stock_ush: "", stock_minimo: "" }); setShowForm(!showForm); }}>+ Nuevo insumo</button>
      </div>
      {mensaje && (
        <div style={{ background: mensaje.includes("Error") ? "#c0392b12" : "#2d7a4f12", border: "1px solid " + (mensaje.includes("Error") ? "#c0392b" : "#2d7a4f"), borderRadius: 6, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: mensaje.includes("Error") ? "#c0392b" : "#2d7a4f" }}>
          {mensaje}
        </div>
      )}
      {showForm && (
        <div className="card fade" style={{ marginBottom: 18 }}>
          <div className="ct">{editando ? "Editar insumo" : "Nuevo insumo"}</div>
          <div className="g2">
            <div>
              <div className="fg"><div className="fl">Nombre *</div><input className="inp" placeholder="Ej: Bolsa chica" value={nuevo.nombre} onChange={e => setNuevo(p => ({ ...p, nombre: e.target.value }))} /></div>
              <div className="fg"><div className="fl">Categoria</div><input className="inp" placeholder="Ej: Packaging, Limpieza, Oficina" value={nuevo.categoria} onChange={e => setNuevo(p => ({ ...p, categoria: e.target.value }))} /></div>
              <div className="fg"><div className="fl">Unidad</div>
                <select className="sel" value={nuevo.unidad} onChange={e => setNuevo(p => ({ ...p, unidad: e.target.value }))}>
                  <option value="unidad">Unidad</option>
                  <option value="caja">Caja</option>
                  <option value="rollo">Rollo</option>
                  <option value="litro">Litro</option>
                  <option value="paquete">Paquete</option>
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
              <div className="fg"><div className="fl">Costo de reposicion ($)</div><input className="inp" type="number" placeholder="0" value={nuevo.costo} onChange={e => setNuevo(p => ({ ...p, costo: e.target.value }))} /></div>
              {!editando && (
                <div style={{ display: "flex", gap: 8 }}>
                  <div className="fg" style={{ flex: 1 }}><div className="fl">Stock Rio Grande</div><input className="inp" type="number" placeholder="0" value={nuevo.stock_rg} onChange={e => setNuevo(p => ({ ...p, stock_rg: e.target.value }))} /></div>
                  <div className="fg" style={{ flex: 1 }}><div className="fl">Stock Ushuaia</div><input className="inp" type="number" placeholder="0" value={nuevo.stock_ush} onChange={e => setNuevo(p => ({ ...p, stock_ush: e.target.value }))} /></div>
                </div>
              )}
              {editando && <div style={{ fontSize: 10, color: "#65676B", marginBottom: 12 }}>El stock se modifica con el boton "Ajustar" de cada insumo, no desde aca.</div>}
              <div className="fg"><div className="fl">Stock minimo (alerta)</div><input className="inp" type="number" placeholder="5" value={nuevo.stock_minimo} onChange={e => setNuevo(p => ({ ...p, stock_minimo: e.target.value }))} /></div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button className="btn btn-p" style={{ flex: 1 }} onClick={guardar}>{editando ? "Guardar cambios" : "Crear insumo"}</button>
                <button className="btn btn-g" style={{ flex: 1 }} onClick={() => { setShowForm(false); setEditando(null); }}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="tabs">
        {["stock", "alertas"].map(t => (
          <div key={t} className={"tab " + (tab === t ? "on" : "")} onClick={() => setTab(t)}>
            {t === "stock" ? "STOCK" : "ALERTAS" + (alertas.length > 0 ? " (" + alertas.length + ")" : "")}
          </div>
        ))}
      </div>
      {tab === "stock" && (
        <div className="card fade">
          {loading ? (
            <div style={{ color: "#65676B", padding: 20 }}>Cargando insumos...</div>
          ) : insumos.length === 0 ? (
            <div style={{ textAlign: "center", color: "#65676B", padding: 30, fontSize: 12 }}>Sin insumos cargados todavia</div>
          ) : (
            <table>
              <thead><tr><th>Insumo</th><th>Categoria</th><th>Unidad</th><th>Proveedor</th><th>Stock {localNombre}</th><th>Minimo</th><th></th></tr></thead>
              <tbody>
                {insumos.map(i => {
                  const st = stockLocal(i);
                  const bajo = st <= (i.stock_minimo || 5);
                  return (
                    <tr key={i.id}>
                      <td style={{ fontWeight: 500 }}>{i.nombre}</td>
                      <td style={{ fontSize: 11, color: "#65676B" }}>{i.categoria || "-"}</td>
                      <td style={{ fontSize: 11, color: "#65676B" }}>{i.unidad || "-"}</td>
                      <td style={{ fontSize: 11, color: "#65676B" }}>{i.proveedor_nombre || "-"}</td>
                      <td><span className={"badge " + (bajo ? "br" : "bg")}>{st}u</span></td>
                      <td style={{ fontSize: 11, color: "#65676B" }}>{i.stock_minimo || 5}u</td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="btn btn-sm" style={{ fontSize: 10 }} onClick={() => abrirAjuste(i)}>Ajustar</button>
                          <button className="btn btn-sm" style={{ fontSize: 10 }} onClick={() => abrirEditar(i)}>Editar</button>
                          <button className="btn btn-sm" style={{ fontSize: 10, color: "#c0392b" }} onClick={() => eliminar(i)}>Quitar</button>
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
      {tab === "alertas" && (
        <div className="fade">
          {alertas.length === 0 ? (
            <div style={{ textAlign: "center", color: "#2d7a4f", padding: 30, fontSize: 12 }}>No hay insumos por debajo del minimo en {localNombre}</div>
          ) : alertas.map(i => (
            <div key={i.id} style={{ background: "#c0392b12", border: "1px solid #d9707033", borderRadius: 6, padding: "12px 16px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, color: "#444444" }}>{i.nombre}{i.categoria ? " - " + i.categoria : ""}</div>
                <div style={{ fontSize: 10, color: "#65676B", marginTop: 2 }}>Stock {localNombre}: {stockLocal(i)}u | Minimo: {i.stock_minimo || 5}u{i.proveedor_nombre ? " | Proveedor: " + i.proveedor_nombre : ""}</div>
              </div>
              <button className="btn btn-p btn-sm" onClick={() => abrirAjuste(i)}>Ajustar stock</button>
            </div>
          ))}
        </div>
      )}
      {ajustando && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, overflowY: "auto", padding: "20px" }}>
          <div className="card" style={{ width: 400, background: "#ffffff" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Ajustar stock - {localNombre}</div>
            <div style={{ fontSize: 12, color: "#65676B", marginBottom: 14 }}>{ajustando.nombre} - stock actual: <b>{stockLocal(ajustando)}u</b></div>
            {errorAjuste && (
              <div style={{ background: "#c0392b12", border: "1px solid #c0392b", borderRadius: 6, padding: "8px 12px", marginBottom: 10, fontSize: 11, color: "#c0392b" }}>{errorAjuste}</div>
            )}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button className="btn btn-sm" style={{ flex: 1, background: modoAjuste === "exacto" ? "#c9a84c15" : "transparent", border: "1px solid " + (modoAjuste === "exacto" ? "#c9a84c" : "#e8e8e8"), color: modoAjuste === "exacto" ? "#c9a84c" : "#65676B" }} onClick={() => { setModoAjuste("exacto"); setValorAjuste(String(stockLocal(ajustando))); }}>Poner cantidad exacta</button>
              <button className="btn btn-sm" style={{ flex: 1, background: modoAjuste === "diferencia" ? "#c9a84c15" : "transparent", border: "1px solid " + (modoAjuste === "diferencia" ? "#c9a84c" : "#e8e8e8"), color: modoAjuste === "diferencia" ? "#c9a84c" : "#65676B" }} onClick={() => { setModoAjuste("diferencia"); setValorAjuste(""); }}>Sumar / restar</button>
            </div>
            <div className="fg">
              <div className="fl">{modoAjuste === "exacto" ? "Stock real (numero final)" : "Diferencia (ej: 10 o -3)"}</div>
              <input className="inp" type="number" placeholder={modoAjuste === "exacto" ? "Ej: 50" : "Ej: -3"} value={valorAjuste} onChange={e => setValorAjuste(e.target.value)} />
              {modoAjuste === "diferencia" && valorAjuste !== "" && !isNaN(parseInt(valorAjuste)) && (
                <div style={{ fontSize: 11, color: "#65676B", marginTop: 4 }}>Nuevo stock: {Math.max(stockLocal(ajustando) + parseInt(valorAjuste), 0)}u</div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="btn btn-g" style={{ flex: 1 }} onClick={() => setAjustando(null)}>Cancelar</button>
              <button className="btn btn-p" style={{ flex: 1 }} onClick={confirmarAjuste}>Confirmar ajuste</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function ConfigInsumos({ localId }) {
  const [activo, setActivo] = useState(false);
  const [insumos, setInsumos] = useState([]);
  const [seleccionados, setSeleccionados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const localNombre = localId === 2 ? "Ushuaia" : "Rio Grande";

  const cargar = async () => {
    setLoading(true);
    try {
      const res = await API.get("/insumos/config-pos?local_id=" + (localId || 1));
      setActivo(res.data?.activo === true);
      setInsumos(res.data?.insumos || []);
      setSeleccionados((res.data?.insumos || []).filter(i => i.en_pos).map(i => i.id));
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { cargar(); }, [localId]);

  const toggle = (id) => {
    setSeleccionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const guardar = async () => {
    try {
      await API.put("/insumos/config-pos", { local_id: localId || 1, activo, insumos_ids: seleccionados });
      setMensaje("Configuracion guardada para " + localNombre + "!");
      setTimeout(() => setMensaje(""), 3000);
    } catch (e) { setMensaje("Error al guardar"); }
  };

  return (
    <div className="fade">
      <div className="ph">
        <div><div className="pt">Insumos en el Punto de Venta</div><div className="ps">configuracion de {localNombre}</div></div>
        <button className="btn btn-p btn-sm" onClick={guardar}>Guardar configuracion</button>
      </div>
      {mensaje && (
        <div style={{ background: mensaje.includes("Error") ? "#c0392b12" : "#2d7a4f12", border: "1px solid " + (mensaje.includes("Error") ? "#c0392b" : "#2d7a4f"), borderRadius: 6, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: mensaje.includes("Error") ? "#c0392b" : "#2d7a4f" }}>{mensaje}</div>
      )}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Descontar insumos en cada venta</div>
            <div style={{ fontSize: 11, color: "#65676B", marginTop: 2 }}>Si esta activo, en el POS aparece un selector por cada insumo elegido abajo, y la vendedora debe indicar cual entrego antes de cobrar.</div>
          </div>
          <div className="sw-wrap" onClick={() => setActivo(!activo)}>
            <div className={"sw " + (activo ? "on" : "off")}><div className="sw-dot" /></div>
          </div>
        </div>
      </div>
      {activo && (
        <div className="card fade">
          <div className="ct">Insumos que se descuentan en el POS de {localNombre}</div>
          {loading ? (
            <div style={{ color: "#65676B", padding: 20 }}>Cargando...</div>
          ) : insumos.length === 0 ? (
            <div style={{ textAlign: "center", color: "#65676B", padding: 20, fontSize: 12 }}>No hay insumos cargados. Crealos primero en la seccion Insumos.</div>
          ) : (
            <div>
              {insumos.map(i => (
                <label key={i.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 8px", borderBottom: "1px solid #f5f5f5", cursor: "pointer" }}>
                  <input type="checkbox" checked={seleccionados.includes(i.id)} onChange={() => toggle(i.id)} />
                  <div>
                    <div style={{ fontSize: 13, color: "#111111" }}>{i.nombre}</div>
                    {i.categoria && <div style={{ fontSize: 10, color: "#65676B" }}>{i.categoria}</div>}
                  </div>
                </label>
              ))}
              <div style={{ fontSize: 11, color: "#65676B", marginTop: 12 }}>{seleccionados.length} insumo(s) se mostraran en el POS de {localNombre}.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


function ConfigTicket() {
  const [cfg, setCfg] = useState({ mostrar_cliente: true, mostrar_numero: true, mostrar_fecha: true, mensaje_pie: "Gracias por tu compra!", texto_extra: "" });
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    API.get("/config-ticket").then(res => { if (res.data) setCfg(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const guardar = async () => {
    try {
      await API.put("/config-ticket", cfg);
      setMensaje("Configuracion del ticket guardada!");
      setTimeout(() => setMensaje(""), 3000);
    } catch (e) { setMensaje("Error al guardar"); }
  };

  const Check = ({ campo, label }) => (
    <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 8px", borderBottom: "1px solid #f5f5f5", cursor: "pointer" }}>
      <input type="checkbox" checked={cfg[campo] !== false} onChange={e => setCfg(p => ({ ...p, [campo]: e.target.checked }))} />
      <span style={{ fontSize: 13, color: "#111111" }}>{label}</span>
    </label>
  );

  return (
    <div className="fade">
      <div className="ph">
        <div><div className="pt">Configuracion del Ticket</div><div className="ps">que se imprime en el recibo del cliente</div></div>
        <button className="btn btn-p btn-sm" onClick={guardar}>Guardar</button>
      </div>
      {mensaje && (
        <div style={{ background: mensaje.includes("Error") ? "#c0392b12" : "#2d7a4f12", border: "1px solid " + (mensaje.includes("Error") ? "#c0392b" : "#2d7a4f"), borderRadius: 6, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: mensaje.includes("Error") ? "#c0392b" : "#2d7a4f" }}>{mensaje}</div>
      )}
      {loading ? <div style={{ color: "#65676B", padding: 20 }}>Cargando...</div> : (
        <div className="g2">
          <div className="card">
            <div className="ct">Datos que se muestran</div>
            <Check campo="mostrar_fecha" label="Fecha y hora" />
            <Check campo="mostrar_numero" label="Numero de comprobante" />
            <Check campo="mostrar_cliente" label="Nombre del cliente" />
            <div style={{ fontSize: 10, color: "#65676B", marginTop: 10 }}>El logo, el local, los productos y el total siempre se muestran.</div>
          </div>
          <div className="card">
            <div className="ct">Textos del pie</div>
            <div className="fg"><div className="fl">Mensaje de agradecimiento</div><input className="inp" value={cfg.mensaje_pie || ""} onChange={e => setCfg(p => ({ ...p, mensaje_pie: e.target.value }))} placeholder="Gracias por tu compra!" /></div>
            <div className="fg"><div className="fl">Texto extra (redes, telefono, direccion)</div><textarea className="inp" rows={3} value={cfg.texto_extra || ""} onChange={e => setCfg(p => ({ ...p, texto_extra: e.target.value }))} placeholder="Ej: @girasoles.beauty | Tel: 2964..." /></div>
          </div>
        </div>
      )}
    </div>
  );
}


function Promociones() {
  const [promos, setPromos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [mediosPago, setMediosPago] = useState([]);
  const [tab, setTab] = useState("lista");
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [editando, setEditando] = useState(null);
  const vacio = { nombre: "", tipo: "descuento", valor: "", aplica_a: "todo", productos_ids: [], categorias: [], nx: "", ny: "", mismo_producto: true, producto_descuento_id: "", cross_producto_id: "", cross_producto_regalo_id: "", monto_minimo: "", medio_pago_tipo: "", combinable: false, fecha_inicio: "", fecha_fin: "", activo: true };
  const [form, setForm] = useState(vacio);

  const cargar = async () => {
    setLoading(true);
    try {
      const [pr, prod] = await Promise.all([API.get("/promociones"), API.get("/productos")]);
      setPromos(pr.data || []);
      setProductos(prod.data || []);
      setCategorias([...new Set((prod.data || []).map(p => p.categoria).filter(Boolean))].sort());
      try { const mp = await API.get("/medios-pago"); setMediosPago(mp.data || []); } catch (e) {}
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const guardar = async () => {
    if (!form.nombre) return setMensaje("Ponele un nombre a la promo");
    const payload = {
      ...form,
      valor: parseFloat(form.valor) || 0,
      nx: form.nx ? parseInt(form.nx) : null,
      ny: form.ny ? parseInt(form.ny) : null,
      monto_minimo: form.monto_minimo ? parseFloat(form.monto_minimo) : null,
      producto_descuento_id: form.producto_descuento_id || null,
      cross_producto_id: form.cross_producto_id || null,
      cross_producto_regalo_id: form.cross_producto_regalo_id || null,
      medio_pago_tipo: form.medio_pago_tipo || null,
      fecha_inicio: form.fecha_inicio || null,
      fecha_fin: form.fecha_fin || null,
      productos_ids: form.productos_ids.map(x => parseInt(x)),
    };
    try {
      if (editando) { await API.put("/promociones/" + editando.id, payload); setMensaje("Promocion actualizada!"); }
      else { await API.post("/promociones", payload); setMensaje("Promocion creada!"); }
      setForm(vacio); setEditando(null); setTab("lista"); cargar();
      setTimeout(() => setMensaje(""), 3000);
    } catch (e) { setMensaje("Error: " + (e.response?.data?.error || e.message)); }
  };

  const editar = (p) => {
    setEditando(p);
    setForm({
      ...vacio, ...p,
      valor: p.valor ?? "", nx: p.nx ?? "", ny: p.ny ?? "", monto_minimo: p.monto_minimo ?? "",
      productos_ids: p.productos_ids || [], categorias: p.categorias || [],
      producto_descuento_id: p.producto_descuento_id || "", cross_producto_id: p.cross_producto_id || "",
      cross_producto_regalo_id: p.cross_producto_regalo_id || "", medio_pago_tipo: p.medio_pago_tipo || "",
      fecha_inicio: p.fecha_inicio ? p.fecha_inicio.slice(0,10) : "", fecha_fin: p.fecha_fin ? p.fecha_fin.slice(0,10) : "",
    });
    setTab("nueva");
  };

  const toggle = async (p) => {
    try { await API.put("/promociones/" + p.id + "/toggle"); cargar(); } catch (e) {}
  };

  const eliminar = async (p) => {
    if (!confirm("Eliminar la promo \"" + p.nombre + "\"?")) return;
    try { await API.delete("/promociones/" + p.id); setMensaje("Promo eliminada"); cargar(); setTimeout(() => setMensaje(""), 3000); } catch (e) {}
  };

  const tipoLabel = { descuento: "Descuento % / $", nxm: "NxM (2x1, 3x2...)", cross: "Cross-selling", monto: "Por monto" };
  const nombreProd = (id) => productos.find(p => p.id === parseInt(id))?.nombre || "-";

  const toggleCat = (cat) => setForm(f => ({ ...f, categorias: f.categorias.includes(cat) ? f.categorias.filter(x => x !== cat) : [...f.categorias, cat] }));
  const toggleProd = (id) => setForm(f => ({ ...f, productos_ids: f.productos_ids.includes(id) ? f.productos_ids.filter(x => x !== id) : [...f.productos_ids, id] }));

  return (
    <div className="fade">
      <div className="ph">
        <div><div className="pt">Promociones</div><div className="ps">descuentos y promos automaticas del POS</div></div>
        <button className="btn btn-p btn-sm" onClick={() => { setEditando(null); setForm(vacio); setTab("nueva"); }}>+ Nueva promocion</button>
      </div>
      {mensaje && <div style={{ background: mensaje.includes("Error") ? "#c0392b12" : "#2d7a4f12", border: "1px solid " + (mensaje.includes("Error") ? "#c0392b" : "#2d7a4f"), borderRadius: 6, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: mensaje.includes("Error") ? "#c0392b" : "#2d7a4f" }}>{mensaje}</div>}
      <div className="tabs">
        <div className={"tab " + (tab === "lista" ? "on" : "")} onClick={() => setTab("lista")}>PROMOCIONES</div>
        <div className={"tab " + (tab === "nueva" ? "on" : "")} onClick={() => setTab("nueva")}>{editando ? "EDITAR" : "NUEVA"}</div>
      </div>

      {tab === "lista" && (
        <div className="card fade">
          {loading ? <div style={{ color: "#65676B", padding: 20 }}>Cargando...</div> : promos.length === 0 ? (
            <div style={{ textAlign: "center", color: "#65676B", padding: 30, fontSize: 12 }}>No hay promociones creadas todavia</div>
          ) : (
            <table>
              <thead><tr><th>Nombre</th><th>Tipo</th><th>Detalle</th><th>Medio pago</th><th>Vigencia</th><th>Activa</th><th></th></tr></thead>
              <tbody>
                {promos.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.nombre}</td>
                    <td><span className="badge bb">{tipoLabel[p.tipo] || p.tipo}</span></td>
                    <td style={{ fontSize: 11, color: "#65676B" }}>
                      {p.tipo === "descuento" && (p.valor + (p.aplica_a === "todo" ? "% en todo" : "% en seleccion"))}
                      {p.tipo === "nxm" && ("Lleva " + p.nx + " paga " + p.ny)}
                      {p.tipo === "cross" && ("Llevando " + nombreProd(p.cross_producto_id) + ", " + p.valor + "% en " + nombreProd(p.cross_producto_regalo_id))}
                      {p.tipo === "monto" && ("Gastando +$" + p.monto_minimo + ", " + p.valor + "% off")}
                    </td>
                    <td style={{ fontSize: 11, color: "#65676B" }}>{p.medio_pago_tipo || "Todos"}</td>
                    <td style={{ fontSize: 10, color: "#65676B" }}>{p.fecha_inicio ? new Date(p.fecha_inicio).toLocaleDateString("es-AR") : "-"} a {p.fecha_fin ? new Date(p.fecha_fin).toLocaleDateString("es-AR") : "sin fin"}</td>
                    <td><Sw on={p.activo} toggle={() => toggle(p)} /></td>
                    <td><div style={{ display: "flex", gap: 4 }}>
                      <button className="btn btn-sm" style={{ fontSize: 10 }} onClick={() => editar(p)}>Editar</button>
                      <button className="btn btn-sm" style={{ fontSize: 10, color: "#c0392b" }} onClick={() => eliminar(p)}>Quitar</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "nueva" && (
        <div className="card fade">
          <div className="ct">{editando ? "Editar promocion" : "Nueva promocion"}</div>
          <div className="g2">
            <div>
              <div className="fg"><div className="fl">Nombre de la promo</div><input className="inp" placeholder="Ej: 20% linea facial" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} /></div>
              <div className="fg"><div className="fl">Tipo de promo</div>
                <select className="sel" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                  <option value="descuento">Descuento % / $</option>
                  <option value="nxm">NxM (2x1, 3x2, 4x3...)</option>
                  <option value="cross">Cross-selling (llevando X, Y con descuento)</option>
                  <option value="monto">Por monto (gastando +$X)</option>
                </select>
              </div>

              {(form.tipo === "descuento" || form.tipo === "monto" || form.tipo === "cross") && (
                <div className="fg"><div className="fl">Valor del descuento (%)</div><input className="inp" type="number" placeholder="20" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} /></div>
              )}
              {form.tipo === "monto" && (
                <div className="fg"><div className="fl">Monto minimo de compra ($)</div><input className="inp" type="number" placeholder="50000" value={form.monto_minimo} onChange={e => setForm(f => ({ ...f, monto_minimo: e.target.value }))} /></div>
              )}
              {form.tipo === "nxm" && (
                <div style={{ display: "flex", gap: 8 }}>
                  <div className="fg" style={{ flex: 1 }}><div className="fl">Lleva (N)</div><input className="inp" type="number" placeholder="2" value={form.nx} onChange={e => setForm(f => ({ ...f, nx: e.target.value }))} /></div>
                  <div className="fg" style={{ flex: 1 }}><div className="fl">Paga (M)</div><input className="inp" type="number" placeholder="1" value={form.ny} onChange={e => setForm(f => ({ ...f, ny: e.target.value }))} /></div>
                </div>
              )}
              {form.tipo === "nxm" && (
                <div className="fg"><div className="fl">Producto que se descuenta (el gratis)</div>
                  <select className="sel" value={form.producto_descuento_id} onChange={e => setForm(f => ({ ...f, producto_descuento_id: e.target.value }))}>
                    <option value="">El de menor precio del grupo</option>
                    {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
              )}
              {form.tipo === "cross" && (
                <div>
                  <div className="fg"><div className="fl">Producto que dispara (llevando este...)</div>
                    <select className="sel" value={form.cross_producto_id} onChange={e => setForm(f => ({ ...f, cross_producto_id: e.target.value }))}>
                      <option value="">Seleccionar...</option>
                      {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </div>
                  <div className="fg"><div className="fl">Producto con descuento (...este tiene % off)</div>
                    <select className="sel" value={form.cross_producto_regalo_id} onChange={e => setForm(f => ({ ...f, cross_producto_regalo_id: e.target.value }))}>
                      <option value="">Seleccionar...</option>
                      {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div>
              {(form.tipo === "descuento" || form.tipo === "nxm") && (
                <div className="fg"><div className="fl">Aplica a</div>
                  <select className="sel" value={form.aplica_a} onChange={e => setForm(f => ({ ...f, aplica_a: e.target.value }))}>
                    <option value="todo">Todos los productos</option>
                    <option value="categorias">Categorias especificas</option>
                    <option value="productos">Productos especificos</option>
                  </select>
                </div>
              )}
              {form.aplica_a === "categorias" && (form.tipo === "descuento" || form.tipo === "nxm") && (
                <div className="fg"><div className="fl">Categorias</div>
                  <div style={{ maxHeight: 120, overflowY: "auto", border: "1px solid #E4E6EB", borderRadius: 8, padding: 8 }}>
                    {categorias.map(cat => (
                      <label key={cat} style={{ display: "flex", gap: 8, fontSize: 12, padding: "3px 0", cursor: "pointer" }}>
                        <input type="checkbox" checked={form.categorias.includes(cat)} onChange={() => toggleCat(cat)} />{cat}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {form.aplica_a === "productos" && (form.tipo === "descuento" || form.tipo === "nxm") && (
                <div className="fg"><div className="fl">Productos ({form.productos_ids.length})</div>
                  <div style={{ maxHeight: 120, overflowY: "auto", border: "1px solid #E4E6EB", borderRadius: 8, padding: 8 }}>
                    {productos.map(p => (
                      <label key={p.id} style={{ display: "flex", gap: 8, fontSize: 12, padding: "3px 0", cursor: "pointer" }}>
                        <input type="checkbox" checked={form.productos_ids.includes(p.id)} onChange={() => toggleProd(p.id)} />{p.nombre}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="fg"><div className="fl">Solo con este medio de pago (opcional)</div>
                <select className="sel" value={form.medio_pago_tipo} onChange={e => setForm(f => ({ ...f, medio_pago_tipo: e.target.value }))}>
                  <option value="">Cualquier medio de pago</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="debito">Debito</option>
                  <option value="credito">Credito</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div className="fg" style={{ flex: 1 }}><div className="fl">Desde</div><input className="inp" type="date" value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} /></div>
                <div className="fg" style={{ flex: 1 }}><div className="fl">Hasta</div><input className="inp" type="date" value={form.fecha_fin} onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value }))} /></div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer", padding: "8px 0" }}>
                <input type="checkbox" checked={form.combinable} onChange={e => setForm(f => ({ ...f, combinable: e.target.checked }))} />
                Se puede combinar con otras promociones
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer", padding: "8px 0" }}>
                <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} />
                Activa
              </label>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button className="btn btn-p" style={{ flex: 1 }} onClick={guardar}>{editando ? "Guardar cambios" : "Crear promocion"}</button>
                <button className="btn btn-g" style={{ flex: 1 }} onClick={() => { setForm(vacio); setEditando(null); setTab("lista"); }}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


const NAV_SECTIONS = [
  { section: "VENTAS", color: "#e67e22", items: [{ id: "dashboard", icon: "📊", label: "Dashboard" }, { id: "pos", icon: "🛒", label: "Punto de Venta" }, { id: "ventas-online", icon: "🌐", label: "Ventas Online" }] },
  { section: "STOCK", color: "#7d3c98", items: [{ id: "inventory", icon: "📦", label: "Inventario" }, { id: "ordenes", icon: "🚚", label: "Ingresos" }, { id: "inconsistencias", icon: "⚠️", label: "Inconsistencias" }, { id: "kits", icon: "🎁", label: "Kits" }, { id: "insumos", icon: "🛍️", label: "Insumos" }, { id: "control-inv", icon: "🔍", label: "Control de Inventario" }] },
  { section: "CAJA", color: "#2d7a4f", items: [{ id: "caja", icon: "💵", label: "Caja" }, { id: "caja-respaldo", icon: "🏦", label: "Caja de Respaldo" }, { id: "cierre", icon: "🔒", label: "Cierre de Caja" }, { id: "giftcards", icon: "🎀", label: "Gift Cards" }] },
  { section: "CLIENTES", color: "#c9a84c", items: [{ id: "clients", icon: "👥", label: "Clientes" }, { id: "pedidos", icon: "📦", label: "Pedidos" }, { id: "fidelizacion", icon: "⭐", label: "Fidelizacion" }] },
  { section: "FINANZAS", color: "#2471a3", items: [{ id: "finance", icon: "💰", label: "Finanzas" }, { id: "reports", icon: "📋", label: "Informes" }, { id: "comprobantes", icon: "🧾", label: "Comprobantes" }, { id: "comisiones", icon: "💎", label: "Comisiones" }, { id: "proveedores", icon: "🏭", label: "Proveedores" }, { id: "calculadoras", icon: "🧮", label: "Calculadoras" }, { id: "productividad", icon: "🏆", label: "Productividad" }] },
  { section: "MARKETING", color: "#e74c3c", items: [{ id: "cupones", icon: "🏷️", label: "Cupones" }, { id: "promociones", icon: "🎉", label: "Promociones" }] },
  { section: "POSTVENTA", color: "#25d366", items: [{ id: "postventa", icon: "💬", label: "Postventa WA" }] },
  { section: "INTEGRACIONES", color: "#2471a3", items: [{ id: "tiendanube", icon: "🛍️", label: "Tiendanube" }] },
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
    "Comprobantes": [["comprobantes.ver","Ver comprobantes"]],
    "Calculadoras": [["calculadoras.ver","Ver calculadoras de precio"]],
    "Productividad": [["productividad.ver","Ver productividad"]],
    "Inventario": [["inventario.ver","Ver stock"],["inventario.crear","Crear productos"],["inventario.alertas","Ver alertas"]],
    "Insumos": [["insumos.ver","Ver insumos"]],
    "Control de Inventario": [["control_inv.ver","Ver control de inventario"]],
    "Clientes": [["clientes.ver","Ver clientes"],["clientes.crear","Crear clientes"],["clientes.editar","Editar clientes"]],
    "Caja": [["caja.ver","Ver caja"],["caja.movimiento","Registrar movimientos"]],
    "Giftcards": [["giftcards.ver","Ver gift cards"]],
    "Caja de Respaldo": [["caja_respaldo.ver","Ver caja de respaldo"]],
    "Cierre de Caja": [["cierre_caja.ver","Ver cierre de caja"]],
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
      "inventory": "inventario.ver", "ordenes": "ordenes.ver", "inconsistencias": "ordenes.ver", "kits": "kits.ver", "insumos": "insumos.ver", "control-inv": "control_inv.ver", "config-insumos": "inventario.ver", "config-ticket": "inventario.ver",
      "clients": "clientes.ver", "fidelizacion": "fidelizacion.ver",
      "finance": "finanzas.flujo", "reports": "informes.ventas", "comprobantes": "comprobantes.ver",
      "comisiones": "comisiones.propias", "proveedores": "proveedores.ver",
      "calculadoras": "calculadoras.ver", "productividad": "productividad.ver",
      "cupones": "cupones.ver", "promociones": "cupones.ver", "postventa": "postventa.ver", "portal": "clientes.ver",
      "caja": "caja.ver", "caja-respaldo": "caja_respaldo.ver", "cierre": "cierre_caja.ver", "giftcards": "giftcards.ver",
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
    if (id === "ventas-online") return <VentasOnline localId={local.id} usuario={usuario} />;
    if (id === "inventory") return <Inventario localId={local.id} usuario={usuario} />;
    if (id === "clients") return <Clientes localId={local.id} />;
    if (id === "pedidos") return <Pedidos localId={local.id} />;
    if (id === "finance") return <Finanzas localId={local.id} usuario={usuario} />;
    if (id === "reports") return <Informes localId={local.id} />;
    if (id === "calculadoras") return <Calculadoras usuario={usuario} />;
    if (id === "comprobantes") return <Comprobantes localId={local.id} />;
    if (id === "productividad") return <Productividad localId={local.id} />;
    if (id === "cupones") return <Cupones localId={local.id} />;
    if (id === "promociones") return <Promociones />;
    if (id === "fidelizacion") return <Fidelizacion localId={local.id} />;
    if (id === "postventa") return <PostventaWA localId={local.id} />;
    if (id === "tiendanube") return <Tiendanube localId={local.id} usuario={usuario} />;
    if (id === "portal") return <PortalCliente />;
    if (id === "usuarios") return <Usuarios usuario={usuario} />;
    if (id === "comisiones") return <Comisiones localId={local.id} />;
    if (id === "caja") return <Caja localId={local.id} usuario={usuario} />;
    if (id === "caja-respaldo") return <CajaRespaldo usuario={usuario} />;
    if (id === "cierre") return <CierreCaja localId={local.id} usuario={usuario} />;
    if (id === "giftcards") return <GiftCards localId={local.id} usuario={usuario} />;
    if (id === "ordenes") return <OrdenesIngreso localId={local.id} usuario={usuario} />;
    if (id === "kits") return <Kits />;
    if (id === "insumos") return <Insumos localId={local.id} usuario={usuario} />;
    if (id === "control-inv") return <ControlInventario localId={local.id} usuario={usuario} />;
    if (id === "config-insumos") return <ConfigInsumos localId={local.id} />;
    if (id === "config-ticket") return <ConfigTicket />;
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
      NAV_CON_PERMISOS.push({ section: "CONFIGURACION", items: [{ id: "usuarios", icon: "-", label: "Usuarios" }, { id: "config-insumos", icon: "🛍️", label: "Insumos en POS" }, { id: "config-ticket", icon: "🧾", label: "Ticket" }] });
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