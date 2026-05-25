import { useState } from "react";

const C = {
  bg: "#0c0b0a", surface: "#131110", card: "#1a1714", border: "#272220",
  accent: "#c9a96e", accentDim: "#c9a96e22", accentHover: "#e0c08a",
  text: "#f0ece4", textSoft: "#c4bdb4", textMuted: "#7a706a",
  green: "#6bbf8e", greenDim: "#6bbf8e18",
  red: "#d97070", redDim: "#d9707018",
  blue: "#7aaed4", blueDim: "#7aaed418",
  purple: "#b888e0", purpleDim: "#b888e018",
  wa: "#25d366", waDim: "#25d36618",
};

const BASE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300&family=DM+Mono:wght@300;400;500&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'DM Mono', monospace; background: #0c0b0a; color: #f0ece4; min-height: 100vh; }
::-webkit-scrollbar { width: 3px; }
::-webkit-scrollbar-thumb { background: #272220; border-radius: 2px; }
@keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .4; } }
.fade { animation: fadeUp .25s ease forwards; }
.pulse { animation: pulse 2s infinite; }
.layout { display: flex; min-height: 100vh; }
.sidebar { width: 210px; background: #131110; border-right: 1px solid #272220; display: flex; flex-direction: column; position: fixed; height: 100vh; z-index: 20; overflow-y: auto; }
.logo { padding: 24px 20px 16px; border-bottom: 1px solid #272220; }
.logo-name { font-family: 'Cormorant Garamond', serif; font-size: 22px; font-weight: 300; letter-spacing: .18em; color: #c9a96e; text-transform: uppercase; }
.logo-sub { font-size: 9px; color: #7a706a; letter-spacing: .3em; margin-top: 3px; text-transform: uppercase; }
.nav { padding: 12px 10px; flex: 1; }
.nav-section { font-size: 8px; letter-spacing: .3em; color: #7a706a; padding: 10px 10px 4px; text-transform: uppercase; }
.nav-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 5px; cursor: pointer; font-size: 11px; letter-spacing: .07em; color: #7a706a; transition: all .18s; margin-bottom: 1px; border: 1px solid transparent; }
.nav-item:hover { color: #c4bdb4; background: #1a1714; }
.nav-item.active { color: #c9a96e; background: #c9a96e22; border-color: #c9a96e33; }
.nav-icon { font-size: 13px; width: 18px; text-align: center; flex-shrink: 0; }
.sb-footer { padding: 12px 18px; border-top: 1px solid #272220; }
.main { margin-left: 210px; flex: 1; padding: 28px 34px; min-height: 100vh; }
.ph { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 26px; }
.pt { font-family: 'Cormorant Garamond', serif; font-size: 32px; font-weight: 300; letter-spacing: .04em; line-height: 1; }
.ps { font-size: 9px; color: #7a706a; letter-spacing: .2em; margin-top: 5px; text-transform: uppercase; }
.g4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 18px; }
.g3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin-bottom: 18px; }
.g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 18px; }
.card { background: #1a1714; border: 1px solid #272220; border-radius: 8px; padding: 18px; }
.ct { font-size: 9px; letter-spacing: .22em; text-transform: uppercase; color: #7a706a; margin-bottom: 10px; }
.metric { font-family: 'Cormorant Garamond', serif; font-size: 34px; font-weight: 300; line-height: 1; }
.msub { font-size: 11px; color: #7a706a; margin-top: 5px; }
.badge { display: inline-flex; padding: 2px 7px; border-radius: 3px; font-size: 9px; letter-spacing: .08em; font-weight: 500; }
.bg { background: #6bbf8e18; color: #6bbf8e; }
.br { background: #d9707018; color: #d97070; }
.bb { background: #7aaed418; color: #7aaed4; }
.bp { background: #b888e018; color: #b888e0; }
.ba { background: #c9a96e22; color: #c9a96e; }
.bw { background: #25d36618; color: #25d366; }
.bx { background: #ffffff08; color: #7a706a; border: 1px solid #272220; }
.btn { padding: 9px 18px; border-radius: 5px; font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: .08em; cursor: pointer; border: none; transition: all .18s; }
.btn-p { background: #c9a96e; color: #0c0b0a; font-weight: 500; }
.btn-p:hover { background: #e0c08a; }
.btn-g { background: transparent; color: #7a706a; border: 1px solid #272220; }
.btn-g:hover { border-color: #c9a96e; color: #c9a96e; }
.btn-sm { padding: 5px 11px; font-size: 10px; }
.inp { width: 100%; background: #0c0b0a; border: 1px solid #272220; border-radius: 5px; padding: 9px 13px; color: #f0ece4; font-family: 'DM Mono', monospace; font-size: 12px; outline: none; transition: border-color .18s; }
.inp:focus { border-color: #c9a96e; }
.inp::placeholder { color: #7a706a; }
.sel { background: #0c0b0a; border: 1px solid #272220; border-radius: 5px; padding: 9px 13px; color: #f0ece4; font-family: 'DM Mono', monospace; font-size: 12px; outline: none; width: 100%; }
.fg { margin-bottom: 12px; }
.fl { font-size: 9px; color: #7a706a; letter-spacing: .15em; text-transform: uppercase; margin-bottom: 5px; }
.tabs { display: flex; margin-bottom: 20px; border-bottom: 1px solid #272220; }
.tab { padding: 8px 16px; font-size: 10px; letter-spacing: .12em; color: #7a706a; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all .18s; }
.tab.on { color: #c9a96e; border-bottom-color: #c9a96e; }
.tab:hover { color: #c4bdb4; }
.divider { height: 1px; background: #272220; margin: 14px 0; }
.pb { height: 5px; background: #272220; border-radius: 3px; overflow: hidden; }
.pf { height: 100%; border-radius: 3px; transition: width .5s; }
.sw-wrap { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.sw { width: 34px; height: 18px; border-radius: 9px; position: relative; transition: background .2s; flex-shrink: 0; }
.sw.on { background: #6bbf8e; }
.sw.off { background: #272220; }
.sw-dot { position: absolute; top: 2px; width: 14px; height: 14px; border-radius: 50%; background: white; transition: left .2s; }
.sw.on .sw-dot { left: 18px; }
.sw.off .sw-dot { left: 2px; }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; font-size: 9px; letter-spacing: .2em; text-transform: uppercase; color: #7a706a; padding: 9px 11px; font-weight: 400; border-bottom: 1px solid #272220; }
td { padding: 10px 11px; font-size: 11px; color: #c4bdb4; border-bottom: 1px solid #2722201a; }
tr:last-child td { border-bottom: none; }
tr:hover td { background: #c9a96e0a; }
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
      <div className="metric" style={{ color: color || "#f0ece4" }}>{value}</div>
      {sub && <div className="msub">{sub}</div>}
    </div>
  );
}

function TierBadge({ tier }) {
  const cls = tier === "Platinum" ? "bp" : tier === "Gold" ? "ba" : tier === "Silver" ? "bb" : "bx";
  return <span className={"badge " + cls}>{tier}</span>;
}

function Dashboard() {
  const bars = [82, 95, 88, 110, 142];
  const meses = ["Ene", "Feb", "Mar", "Abr", "May"];
  return (
    <div className="fade">
      <div className="ph">
        <div>
          <div className="pt">Dashboard</div>
          <div className="ps">mayo 2026 - resumen ejecutivo</div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <StatusDot color="#25d366" label="TIENDANUBE" />
          <StatusDot color="#6bbf8e" label="ARCA" />
        </div>
      </div>
      <div className="g4">
        <MCard label="Ventas del mes" value="$142k" sub="+ 18% vs abril" />
        <MCard label="Facturas emitidas" value="41" sub="5 hoy" />
        <MCard label="Stock critico" value="3" sub="requieren pedido" color="#d97070" />
        <MCard label="Clientes activos" value="187" sub="+12 este mes" />
      </div>
      <div className="g2">
        <div className="card">
          <div className="ct">Ventas mensuales 2026</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 80, marginTop: 10 }}>
            {bars.map((b, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ width: "100%", height: Math.round((b / 142) * 100) + "%", borderRadius: "2px 2px 0 0", background: i === 4 ? "#c9a96e" : "#272220", minHeight: 3 }} />
                <div style={{ fontSize: 9, color: "#7a706a" }}>{meses[i]}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="ct">Ultimas facturas</div>
          <table>
            <thead><tr><th>Nro</th><th>Cliente</th><th>Total</th><th>Estado</th></tr></thead>
            <tbody>
              {[
                { id: "F-0041", client: "Garcia, Maria", total: 17300 },
                { id: "F-0040", client: "Lopez, Ana", total: 9100 },
                { id: "F-0039", client: "Cosmetica SA", total: 48600 },
                { id: "F-0038", client: "Rodriguez, Paula", total: 6200 },
              ].map(s => (
                <tr key={s.id}>
                  <td style={{ color: "#c9a96e" }}>{s.id}</td>
                  <td>{s.client}</td>
                  <td>${s.total.toLocaleString()}</td>
                  <td><span className="badge bg">emitida</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="g3">
        <div className="card">
          <div className="ct">Flujo de caja mayo</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            {[{ l: "INGRESOS", v: "$142k", c: "#6bbf8e" }, { l: "EGRESOS", v: "$89k", c: "#d97070" }, { l: "NETO", v: "$53k", c: "#c9a96e" }].map(r => (
              <div key={r.l}>
                <div style={{ fontSize: 9, color: "#7a706a", letterSpacing: ".15em" }}>{r.l}</div>
                <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, color: r.c, marginTop: 4 }}>{r.v}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="ct">Punto de equilibrio</div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 34, color: "#c9a96e" }}>$89k</div>
          <div style={{ fontSize: 11, color: "#6bbf8e", marginTop: 6 }}>Ventas actuales: $142k (+59%)</div>
          <div className="pb" style={{ marginTop: 10 }}><div className="pf" style={{ width: "100%", background: "#6bbf8e" }} /></div>
        </div>
        <div className="card">
          <div className="ct">Top clientes</div>
          {CLIENTS.slice(0, 4).map(c => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 11, color: "#c4bdb4" }}>{c.name.split(",")[0]}</div>
                <div style={{ fontSize: 9, color: "#7a706a" }}>{c.points.toLocaleString()} pts</div>
              </div>
              <TierBadge tier={c.tier} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function POS() {
  const [cart, setCart] = useState([]);
  const [clientInput, setClientInput] = useState("");
  const [tipoFac, setTipoFac] = useState("B");
  const add = (p) => setCart(prev => {
    const e = prev.find(i => i.id === p.id);
    return e ? prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i) : [...prev, { ...p, qty: 1 }];
  });
  const remove = (id) => setCart(prev => prev.filter(i => i.id !== id));
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  return (
    <div className="fade">
      <div className="ph">
        <div><div className="pt">Punto de Venta</div><div className="ps">facturacion electronica - arca</div></div>
        <StatusDot color="#6bbf8e" label="ARCA CONECTADO" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 310px", gap: 16, height: "calc(100vh - 150px)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
          <input className="inp" placeholder="Buscar producto o escanear codigo..." />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, overflowY: "auto", flex: 1 }}>
            {PRODUCTS.map(p => (
              <div key={p.id} onClick={() => add(p)}
                style={{ background: "#1a1714", border: "1px solid #272220", borderRadius: 7, padding: 14, cursor: "pointer", transition: "border-color .18s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "#c9a96e"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "#272220"}>
                <div style={{ fontSize: 9, color: "#7a706a", letterSpacing: ".12em" }}>{p.brand}</div>
                <div style={{ fontSize: 12, color: "#c4bdb4", marginTop: 3 }}>{p.name}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 10 }}>
                  <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: "#c9a96e" }}>${p.price.toLocaleString()}</div>
                  <span className={"badge " + (p.stock < p.min ? "br" : "bg")}>{p.stock}u</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: "#131110", border: "1px solid #272220", borderRadius: 8, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #272220", fontSize: 9, letterSpacing: ".2em", color: "#7a706a" }}>COMPROBANTE EN CURSO</div>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid #272220" }}>
            <input className="inp" placeholder="CUIT / DNI cliente" value={clientInput} onChange={e => setClientInput(e.target.value)} style={{ marginBottom: 8 }} />
            <div style={{ display: "flex", gap: 4 }}>
              {["A", "B", "Remito"].map(t => (
                <button key={t} onClick={() => setTipoFac(t)} className="btn btn-sm"
                  style={{ flex: 1, background: tipoFac === t ? "#c9a96e22" : "transparent", border: "1px solid " + (tipoFac === t ? "#c9a96e" : "#272220"), color: tipoFac === t ? "#c9a96e" : "#7a706a" }}>
                  {t === "Remito" ? "Remito" : "Fac. " + t}
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
            {cart.length === 0
              ? <div style={{ textAlign: "center", color: "#7a706a", fontSize: 11, marginTop: 28 }}>Selecciona productos para agregar al ticket</div>
              : cart.map(i => (
                <div key={i.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1a1714", borderRadius: 5, padding: "8px 10px", marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#c4bdb4" }}>{i.name}</div>
                    <div style={{ fontSize: 9, color: "#7a706a" }}>{i.brand}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: "#c9a96e", fontSize: 10 }}>x{i.qty}</div>
                      <div style={{ fontSize: 11 }}>${(i.price * i.qty).toLocaleString()}</div>
                    </div>
                    <div onClick={() => remove(i.id)} style={{ cursor: "pointer", color: "#7a706a", fontSize: 16, lineHeight: 1, padding: "0 4px" }}>x</div>
                  </div>
                </div>
              ))}
          </div>
          <div style={{ padding: "14px 16px", borderTop: "1px solid #272220" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
              <div style={{ fontSize: 9, color: "#7a706a", letterSpacing: ".15em" }}>TOTAL</div>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, color: "#c9a96e" }}>${total.toLocaleString()}</div>
            </div>
            <button className="btn btn-p" style={{ width: "100%", padding: 12 }}>Emitir Factura {tipoFac} - ARCA</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Inventario() {
  const [tab, setTab] = useState("stock");
  return (
    <div className="fade">
      <div className="ph">
        <div><div className="pt">Inventario</div><div className="ps">stock - punto de pedido - alertas</div></div>
        <button className="btn btn-p btn-sm">+ Nuevo producto</button>
      </div>
      <div className="tabs">
        {["stock", "alertas", "movimientos"].map(t => <div key={t} className={"tab " + (tab === t ? "on" : "")} onClick={() => setTab(t)}>{t.toUpperCase()}</div>)}
      </div>
      {tab === "stock" && (
        <div className="card fade">
          <table>
            <thead><tr><th>Producto</th><th>Stock</th><th>Minimo</th><th>Lead time</th><th>Punto pedido</th><th>Costo</th><th>Estado</th></tr></thead>
            <tbody>
              {PRODUCTS.map(p => {
                const pp = Math.ceil(1.2 * p.lead + p.min);
                const needs = p.stock <= pp;
                const pct = Math.min(Math.round((p.stock / (p.min * 3)) * 100), 100);
                return (
                  <tr key={p.id}>
                    <td><div style={{ color: "#f0ece4" }}>{p.name}</div><div style={{ fontSize: 9, color: "#7a706a" }}>{p.brand}</div></td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18 }}>{p.stock}</span>
                        <div style={{ width: 50 }}><div className="pb"><div className="pf" style={{ width: pct + "%", background: pct < 30 ? "#d97070" : pct < 60 ? "#c9a96e" : "#6bbf8e" }} /></div></div>
                      </div>
                    </td>
                    <td>{p.min}</td>
                    <td>{p.lead}d</td>
                    <td style={{ color: "#c9a96e" }}>{pp}u</td>
                    <td>${p.cost.toLocaleString()}</td>
                    <td><span className={"badge " + (needs ? "br" : "bg")}>{needs ? "PEDIR" : "OK"}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {tab === "alertas" && (
        <div className="fade">
          {PRODUCTS.filter(p => p.stock <= p.min + 3).map(p => (
            <div key={p.id} style={{ background: "#d9707018", border: "1px solid #d9707033", borderRadius: 6, padding: "12px 16px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, color: "#c4bdb4" }}>{p.name} - {p.brand}</div>
                <div style={{ fontSize: 10, color: "#7a706a", marginTop: 2 }}>Stock: {p.stock}u | Minimo: {p.min}u | Lead: {p.lead}d</div>
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
                { d: "23/05", p: "Aceite Rosa Mosqueta", t: "Ajuste", q: -1, r: "AJ-0004" },
              ].map((m, i) => (
                <tr key={i}>
                  <td>{m.d}</td><td>{m.p}</td>
                  <td><span className={"badge " + (m.t === "Venta" ? "bb" : m.t === "Ingreso" ? "bg" : "ba")}>{m.t}</span></td>
                  <td style={{ color: m.q > 0 ? "#6bbf8e" : "#d97070" }}>{m.q > 0 ? "+" : ""}{m.q}</td>
                  <td style={{ color: "#c9a96e" }}>{m.r}</td>
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
  const tierNext = { Bronze: 500, Silver: 1000, Gold: 2000, Platinum: 99999 };
  return (
    <div className="fade">
      <div className="ph">
        <div><div className="pt">Clientes</div><div className="ps">gestion - fidelizacion - historial</div></div>
        <button className="btn btn-p btn-sm">+ Nuevo cliente</button>
      </div>
      <div className="g3">
        {[{ t: "Platinum", n: 1, c: "#b888e0" }, { t: "Gold", n: 1, c: "#c9a96e" }, { t: "Silver", n: 2, c: "#7aaed4" }].map(t => (
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
          <table>
            <thead><tr><th>Cliente</th><th>CUIT</th><th>Compras</th><th>Total</th><th>Puntos</th><th>Nivel</th></tr></thead>
            <tbody>
              {CLIENTS.map(c => {
                const next = tierNext[c.tier];
                const pct = Math.min(Math.round((c.points / next) * 100), 100);
                return (
                  <tr key={c.id}>
                    <td><div style={{ color: "#f0ece4" }}>{c.name}</div><div style={{ fontSize: 9, color: "#7a706a" }}>{c.email}</div></td>
                    <td style={{ fontSize: 10 }}>{c.cuit}</td>
                    <td>{c.purchases}</td>
                    <td>${c.total.toLocaleString()}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, color: "#c9a96e" }}>{c.points.toLocaleString()}</span>
                        <div style={{ width: 40 }}><div className="pb"><div className="pf" style={{ width: pct + "%", background: "#c9a96e" }} /></div></div>
                      </div>
                    </td>
                    <td><TierBadge tier={c.tier} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {tab === "niveles" && (
        <div className="g2 fade">
          {[
            { tier: "Bronze", min: 0, max: 499, c: "#c9a96e", perks: ["1 pt cada $100", "Cupon bienvenida"] },
            { tier: "Silver", min: 500, max: 999, c: "#7aaed4", perks: ["1.2 pts cada $100", "Acceso preventas", "Envio gratis +$5k"] },
            { tier: "Gold", min: 1000, max: 1999, c: "#c9a96e", perks: ["1.5 pts cada $100", "5% descuento exclusivo", "Regalo de cumpleanos"] },
            { tier: "Platinum", min: 2000, max: null, c: "#b888e0", perks: ["2 pts cada $100", "10% descuento", "Envio gratis siempre", "Lanzamientos anticipados"] },
          ].map(n => (
            <div key={n.tier} className="card" style={{ borderLeft: "3px solid " + n.c }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: n.c }}>{n.tier}</div>
                <div style={{ fontSize: 10, color: "#7a706a" }}>{n.min.toLocaleString()}{n.max ? " - " + n.max.toLocaleString() + " pts" : "+ pts"}</div>
              </div>
              {n.perks.map((p, i) => (
                <div key={i} style={{ display: "flex", gap: 7, marginBottom: 6, fontSize: 11, color: "#c4bdb4" }}>
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
  return (
    <div className="fade">
      <div className="ph"><div><div className="pt">Finanzas</div><div className="ps">flujo de efectivo - costos - equilibrio</div></div></div>
      <div className="tabs">
        {["flujo", "costos", "equilibrio"].map(t => <div key={t} className={"tab " + (tab === t ? "on" : "")} onClick={() => setTab(t)}>{t.toUpperCase()}</div>)}
      </div>
      {tab === "flujo" && (
        <div className="fade">
          <div className="g3">
            {[{ l: "Ingresos mayo", v: "$142.300", c: "#6bbf8e" }, { l: "Egresos mayo", v: "$89.150", c: "#d97070" }, { l: "Resultado neto", v: "$53.150", c: "#c9a96e" }].map(m => (
              <div key={m.l} className="card"><div className="ct">{m.l}</div><div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, color: m.c }}>{m.v}</div></div>
            ))}
          </div>
          <div className="card">
            <table>
              <thead><tr><th>Fecha</th><th>Concepto</th><th>Tipo</th><th>Importe</th></tr></thead>
              <tbody>
                {[
                  { d: "24/05", c: "Ventas del dia", t: "I", imp: 17300 },
                  { d: "24/05", c: "Compra L'OREAL", t: "E", imp: 42000 },
                  { d: "23/05", c: "Ventas del dia", t: "I", imp: 54800 },
                  { d: "22/05", c: "Alquiler local", t: "E", imp: 35000 },
                  { d: "22/05", c: "Ventas del dia", t: "I", imp: 21400 },
                ].map((m, i) => (
                  <tr key={i}>
                    <td>{m.d}</td><td>{m.c}</td>
                    <td><span className={"badge " + (m.t === "I" ? "bg" : "br")}>{m.t === "I" ? "Ingreso" : "Egreso"}</span></td>
                    <td style={{ color: m.t === "I" ? "#6bbf8e" : "#d97070" }}>{m.t === "I" ? "+" : "-"}${m.imp.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {tab === "costos" && (
        <div className="g2 fade">
          <div className="card">
            <div className="ct">Costos fijos mensuales</div>
            {[{ l: "Alquiler", v: 35000 }, { l: "Personal", v: 28000 }, { l: "Servicios", v: 4200 }, { l: "Plataformas", v: 3800 }].map(c => (
              <div key={c.l} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid #272220" }}>
                <span style={{ fontSize: 12, color: "#c4bdb4" }}>{c.l}</span>
                <span style={{ color: "#c9a96e" }}>${c.v.toLocaleString()}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10 }}>
              <span style={{ fontSize: 12, color: "#f0ece4" }}>TOTAL FIJOS</span>
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
                    <span style={{ fontSize: 11, color: "#c4bdb4" }}>{p.name}</span>
                    <span style={{ fontSize: 11, color: "#6bbf8e" }}>{mg}%</span>
                  </div>
                  <div className="pb"><div className="pf" style={{ width: mg + "%", background: "#6bbf8e" }} /></div>
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
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 48, color: "#c9a96e" }}>$89.000</div>
            <div style={{ fontSize: 11, color: "#7a706a", marginTop: 4 }}>ventas minimas para cubrir costos</div>
            <div className="divider" />
            {[{ l: "Costos fijos", v: "$71.000" }, { l: "Margen promedio", v: "48%" }, { l: "Formula: CF / Margen", v: "$71k / 0.48" }].map(r => (
              <div key={r.l} style={{ display: "flex", justifyContent: "space-between", marginBottom: 9 }}>
                <span style={{ fontSize: 11, color: "#7a706a" }}>{r.l}</span>
                <span style={{ fontSize: 11, color: "#c4bdb4" }}>{r.v}</span>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="ct">Situacion actual</div>
            {[{ l: "Ventas actuales", v: "$142.000", c: "#6bbf8e" }, { l: "Punto equilibrio", v: "$89.000", c: "#c9a96e" }, { l: "Margen seguridad", v: "+59%", c: "#6bbf8e" }].map(r => (
              <div key={r.l} style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: "#7a706a" }}>{r.l}</span>
                <span style={{ color: r.c }}>{r.v}</span>
              </div>
            ))}
            <div className="pb" style={{ height: 10, marginTop: 8 }}>
              <div className="pf" style={{ width: "100%", background: "linear-gradient(90deg,#d97070 0%,#c9a96e 63%,#6bbf8e 100%)" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontSize: 9, color: "#7a706a" }}>$0</span>
              <span style={{ fontSize: 9, color: "#c9a96e" }}>PE $89k</span>
              <span style={{ fontSize: 9, color: "#6bbf8e" }}>$142k</span>
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
            {[{ c: "A", n: 2, pct: "65%", col: "#6bbf8e", desc: "80% de ventas" }, { c: "B", n: 2, pct: "25%", col: "#7aaed4", desc: "15% de ventas" }, { c: "C", n: 2, pct: "10%", col: "#7a706a", desc: "5% de ventas" }].map(t => (
              <div key={t.c} className="card">
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div className="ct">Clase {t.c}</div>
                  <span className={"badge " + (t.c === "A" ? "bg" : t.c === "B" ? "bb" : "bx")}>{t.n} prov.</span>
                </div>
                <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 30, color: t.col }}>{t.pct}</div>
                <div style={{ fontSize: 10, color: "#7a706a" }}>{t.desc}</div>
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
                      <td style={{ color: "#f0ece4" }}>{p.name}</td>
                      <td>${p.ventas.toLocaleString()}</td>
                      <td>{p.pct}%</td>
                      <td><span className={"badge " + (p.clase === "A" ? "bg" : p.clase === "B" ? "bb" : "bx")}>{p.clase}</span></td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <div style={{ flex: 1 }}><div className="pb"><div className="pf" style={{ width: acum + "%", background: p.clase === "A" ? "#6bbf8e" : p.clase === "B" ? "#7aaed4" : "#7a706a" }} /></div></div>
                          <span style={{ fontSize: 9, color: "#7a706a", width: 28 }}>{acum}%</span>
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
                  <td><div style={{ color: "#f0ece4" }}>{p.name}</div><div style={{ fontSize: 9, color: "#7a706a" }}>{p.brand}</div></td>
                  <td>{p.stock}u</td>
                  <td style={{ color: "#c9a96e" }}>${(p.stock * p.cost).toLocaleString()}</td>
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
            {[{ canal: "Presencial (POS)", pct: 62, val: 88226, c: "#c9a96e" }, { canal: "Tiendanube (online)", pct: 38, val: 54074, c: "#b888e0" }].map(c => (
              <div key={c.canal} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 11, color: "#c4bdb4" }}>{c.canal}</span>
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
                  <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 16, color: "#7a706a", width: 16 }}>{i + 1}</span>
                  <div>
                    <div style={{ fontSize: 11, color: "#c4bdb4" }}>{p.name}</div>
                    <div style={{ fontSize: 9, color: "#7a706a" }}>{p.brand}</div>
                  </div>
                </div>
                <span style={{ color: "#c9a96e", fontSize: 11 }}>${(p.price * (10 - i)).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Cupones() {
  const [cupons, setCupons] = useState(CUPONS_DATA);
  const [tab, setTab] = useState("lista");
  const [nc, setNc] = useState({ code: "", desc: "", type: "%", value: "", channel: "Instagram", max: "" });
  return (
    <div className="fade">
      <div className="ph"><div><div className="pt">Cupones</div><div className="ps">codigos - influencers - campanas</div></div></div>
      <div className="g4" style={{ marginBottom: 16 }}>
        <MCard label="Activos" value={String(cupons.filter(c => c.active).length)} color="#6bbf8e" />
        <MCard label="Usos este mes" value={String(cupons.reduce((s, c) => s + c.uses, 0))} color="#c9a96e" />
        <MCard label="Venta generada" value="$284k" />
        <MCard label="Influencers" value="1" color="#7aaed4" />
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
              {cupons.map(c => (
                <tr key={c.id}>
                  <td style={{ color: "#c9a96e", letterSpacing: ".06em", fontWeight: 600 }}>{c.code}</td>
                  <td>{c.desc}</td>
                  <td>{c.type === "%" ? c.value + "%" : "$" + c.value.toLocaleString()}</td>
                  <td><span className="badge bb">{c.channel}</span></td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      {c.uses}{c.max ? "/" + c.max : ""}
                      {c.max && <div style={{ width: 40 }}><div className="pb"><div className="pf" style={{ width: Math.min(Math.round((c.uses / c.max) * 100), 100) + "%", background: c.uses >= c.max ? "#d97070" : "#c9a96e" }} /></div></div>}
                    </div>
                  </td>
                  <td style={{ fontSize: 10, color: "#7a706a" }}>{c.expires || "Sin venc."}</td>
                  <td><Sw on={c.active} toggle={() => setCupons(p => p.map(x => x.id === c.id ? { ...x, active: !x.active } : x))} /></td>
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
            <button className="btn btn-p" style={{ width: "100%" }}>Crear cupon</button>
          </div>
          <div className="card">
            <div className="ct">Vista previa</div>
            <div style={{ background: "#0c0b0a", borderRadius: 7, padding: 20, border: "2px dashed #272220", textAlign: "center", marginBottom: 14 }}>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, color: "#c9a96e", letterSpacing: ".1em" }}>{nc.code || "CODIGO"}</div>
              <div style={{ fontSize: 13, color: "#7a706a", marginTop: 6 }}>{nc.value ? (nc.type === "%" ? nc.value + "% de descuento" : "$" + parseInt(nc.value || "0").toLocaleString() + " de descuento") : "Descuento"}</div>
            </div>
            {["Codigos cortos y memorables convierten mas", "Inclui el canal: INSTA20, TIKTOK15", "Limite de usos genera urgencia", "Codigos de influencer = seguimiento exacto"].map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 7, marginBottom: 7, fontSize: 11, color: "#c4bdb4" }}><span style={{ color: "#c9a96e" }}>-</span>{t}</div>
            ))}
          </div>
        </div>
      )}
      {tab === "influencers" && (
        <div className="card fade">
          <table>
            <thead><tr><th>Influencer</th><th>Codigo</th><th>Red</th><th>Usos</th><th>Venta generada</th><th>Comision</th></tr></thead>
            <tbody>
              {[
                { name: "Sofia Moreno", code: "INFLUENCER_SOF", red: "Instagram", uses: 34, venta: 248200, com: "10%" },
                { name: "Vale Gomez", code: "VALE_COSMO", red: "TikTok", uses: 0, venta: 0, com: "8%" },
              ].map((inf, i) => (
                <tr key={i}>
                  <td><div style={{ color: "#f0ece4" }}>@{inf.name.toLowerCase().replace(" ", "_")}</div><div style={{ fontSize: 9, color: "#7a706a" }}>{inf.name}</div></td>
                  <td style={{ color: "#c9a96e" }}>{inf.code}</td>
                  <td><span className="badge bb">{inf.red}</span></td>
                  <td>{inf.uses}</td>
                  <td style={{ color: "#6bbf8e" }}>${inf.venta.toLocaleString()}</td>
                  <td>{inf.com}</td>
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
  const tierNext = { Bronze: 500, Silver: 1000, Gold: 2000, Platinum: 99999 };
  return (
    <div className="fade">
      <div className="ph"><div><div className="pt">Fidelizacion</div><div className="ps">puntos - niveles - canjes</div></div></div>
      <div className="g4" style={{ marginBottom: 16 }}>
        <MCard label="Puntos emitidos" value="6.590" color="#c9a96e" />
        <MCard label="Puntos canjeados" value="1.240" color="#6bbf8e" />
        <MCard label="Tasa de canje" value="18%" color="#7aaed4" />
        <MCard label="Premios activos" value={String(REWARDS_DISPLAY.length)} />
      </div>
      <div className="tabs">
        {["clientes", "canjes"].map(t => <div key={t} className={"tab " + (tab === t ? "on" : "")} onClick={() => setTab(t)}>{t.toUpperCase()}</div>)}
      </div>
      {tab === "clientes" && (
        <div className="card fade">
          <table>
            <thead><tr><th>Cliente</th><th>Nivel</th><th>Puntos</th><th>Progreso al proximo nivel</th></tr></thead>
            <tbody>
              {CLIENTS.map(c => {
                const next = tierNext[c.tier];
                const pct = Math.min(Math.round((c.points / next) * 100), 100);
                return (
                  <tr key={c.id}>
                    <td><div style={{ color: "#f0ece4" }}>{c.name}</div><div style={{ fontSize: 9, color: "#7a706a" }}>{c.email}</div></td>
                    <td><TierBadge tier={c.tier} /></td>
                    <td style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, color: "#c9a96e" }}>{c.points.toLocaleString()}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1 }}><div className="pb"><div className="pf" style={{ width: pct + "%", background: "#c9a96e" }} /></div></div>
                        <span style={{ fontSize: 9, color: "#7a706a", width: 50 }}>{c.tier === "Platinum" ? "MAX" : (next - c.points).toLocaleString() + "p"}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {tab === "canjes" && (
        <div className="card fade">
          <table>
            <thead><tr><th>Premio</th><th>Puntos requeridos</th><th>Stock</th><th>Canjes</th></tr></thead>
            <tbody>
              {REWARDS_DISPLAY.map(r => (
                <tr key={r.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <span style={{ fontSize: 18 }}>{r.emoji}</span>
                      <div><div style={{ color: "#f0ece4" }}>{r.name}</div><div style={{ fontSize: 9, color: "#7a706a" }}>{r.brand}</div></div>
                    </div>
                  </td>
                  <td style={{ color: "#c9a96e", fontFamily: "'Cormorant Garamond',serif", fontSize: 18 }}>{r.pts}</td>
                  <td><span className={"badge " + (r.stock < 5 ? "br" : "bg")}>{r.stock}u</span></td>
                  <td>{Math.floor(r.pts / 100)}</td>
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
  const [rules, setRules] = useState(WA_RULES);
  const [tab, setTab] = useState("reglas");
  const [sel, setSel] = useState(null);
  const toggle = (id) => setRules(p => p.map(r => r.id === id ? { ...r, active: !r.active } : r));
  return (
    <div className="fade">
      <div className="ph">
        <div><div className="pt">Postventa WhatsApp</div><div className="ps">mensajes automaticos - seguimiento - reactivacion</div></div>
        <StatusDot color="#25d366" label="WHATSAPP BUSINESS" />
      </div>
      <div className="g4" style={{ marginBottom: 16 }}>
        <MCard label="Mensajes enviados" value="344" color="#25d366" />
        <MCard label="Tasa de apertura" value="72%" color="#6bbf8e" />
        <MCard label="Recompras generadas" value="38" color="#c9a96e" />
        <MCard label="Reglas activas" value={String(rules.filter(r => r.active).length)} color="#7aaed4" />
      </div>
      <div className="tabs">
        {[["reglas", "REGLAS"], ["programados", "PROGRAMADOS"], ["nueva", "NUEVA REGLA"]].map(([id, l]) => (
          <div key={id} className={"tab " + (tab === id ? "on" : "")} onClick={() => { setTab(id); setSel(null); }}>{l}</div>
        ))}
      </div>
      {tab === "reglas" && (
        <div className="fade">
          {rules.map(r => (
            <div key={r.id} className="card" style={{ marginBottom: 12, borderLeft: "3px solid " + (r.active ? "#25d366" : "#272220") }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
                    <div style={{ fontSize: 13, color: "#f0ece4" }}>{r.name}</div>
                    <span className="badge bw">WhatsApp</span>
                    {!r.active && <span className="badge bx">PAUSADO</span>}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 10, color: "#7a706a", marginBottom: 10 }}>
                    <span>{r.trigger}</span>
                    <span>{r.segment}</span>
                    <span>{r.sent} enviados</span>
                    <span>{r.sent > 0 ? Math.round((r.opened / r.sent) * 100) : 0}% apertura</span>
                  </div>
                  {sel === r.id && (
                    <div style={{ background: "#0d1117", borderRadius: 9, overflow: "hidden", border: "1px solid #ffffff08", maxWidth: 320, marginBottom: 12 }}>
                      <div style={{ background: "#1f2937", padding: "10px 14px", display: "flex", alignItems: "center", gap: 9 }}>
                        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#c9a96e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#0c0b0a", fontWeight: 600, flexShrink: 0 }}>L</div>
                        <div><div style={{ fontSize: 12, color: "#e5e7eb" }}>Lumiere Cosmeticos</div><div style={{ fontSize: 9, color: "#6b7280" }}>en linea</div></div>
                      </div>
                      <div style={{ padding: 14, background: "#111827" }}>
                        <div style={{ background: "#1f2d1f", borderRadius: "0 9px 9px 9px", padding: "9px 13px", maxWidth: "85%" }}>
                          <div style={{ fontSize: 12, color: "#d1fae5", lineHeight: 1.55 }}>
                            {r.msg.replace("{nombre}", "Maria").replace("{producto}", "Serum Vitamina C").replace("{puntos}", "1.240")}
                          </div>
                          <div style={{ fontSize: 9, color: "#6b7280", textAlign: "right", marginTop: 4 }}>10:34</div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 7 }}>
                    <button className="btn btn-g btn-sm" onClick={() => setSel(sel === r.id ? null : r.id)}>{sel === r.id ? "Ocultar" : "Ver mensaje"}</button>
                    <button className="btn btn-g btn-sm">Editar</button>
                  </div>
                </div>
                <Sw on={r.active} toggle={() => toggle(r.id)} />
              </div>
            </div>
          ))}
        </div>
      )}
      {tab === "programados" && (
        <div className="g2 fade">
          <div className="card">
            <div className="ct">Cola de mensajes</div>
            <div style={{ position: "relative", paddingLeft: 20 }}>
              <div style={{ position: "absolute", left: 6, top: 0, bottom: 0, width: 1, background: "#272220" }} />
              {[
                { cl: "Lucia Fernandez", r: "Como te esta yendo?", d: "Hoy", s: "enviado" },
                { cl: "Ana Lopez", r: "Saludo cumpleanos", d: "28/05", s: "programado" },
                { cl: "Maria Garcia", r: "Reposicion inteligente", d: "10/06", s: "programado" },
                { cl: "Paula Rodriguez", r: "Reactivacion inactivos", d: "04/06", s: "programado" },
              ].map((m, i) => (
                <div key={i} style={{ position: "relative", marginBottom: 16 }}>
                  <div style={{ position: "absolute", left: -17, top: 3, width: 9, height: 9, borderRadius: "50%", background: m.s === "enviado" ? "#6bbf8e" : "#7a706a", border: "2px solid #0c0b0a" }} />
                  <div style={{ fontSize: 12, color: "#f0ece4" }}>{m.cl}</div>
                  <div style={{ fontSize: 10, color: "#7a706a", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                    {m.r} - {m.d}
                    <span className={"badge " + (m.s === "enviado" ? "bg" : "bb")}>{m.s}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="ct">Proximos 7 dias</div>
            {[{ d: "Hoy", n: 2 }, { d: "Manana", n: 1 }, { d: "26/05", n: 3 }, { d: "27/05", n: 1 }, { d: "28/05", n: 4 }].map((d, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: i < 4 ? "1px solid #2722201a" : "none" }}>
                <span style={{ fontSize: 11, color: "#c4bdb4" }}>{d.d}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 70 }}><div className="pb"><div className="pf" style={{ width: Math.round((d.n / 4) * 100) + "%", background: "#25d366" }} /></div></div>
                  <span className="badge bw">{d.n} msgs</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {tab === "nueva" && (
        <div className="g2 fade">
          <div className="card">
            <div className="ct">Nueva regla automatica</div>
            <div className="fg"><div className="fl">Nombre</div><input className="inp" placeholder="Ej: Seguimiento post compra" /></div>
            <div className="fg"><div className="fl">Disparador</div>
              <select className="sel"><option>N dias despues de la compra</option><option>Dias sin actividad</option><option>Cumpleanos del cliente</option><option>Puntos por vencer</option></select>
            </div>
            <div className="fg"><div className="fl">Dias</div><input className="inp" type="number" placeholder="7" /></div>
            <div className="fg"><div className="fl">Segmento</div>
              <select className="sel"><option>Todos los clientes</option><option>Gold y Platinum</option><option>Solo Tiendanube</option><option>Solo presencial</option></select>
            </div>
            <div className="fg">
              <div className="fl">Mensaje - usa nombre, producto, puntos entre llaves</div>
              <textarea className="inp" rows={5} placeholder="Hola nombre! ..." style={{ resize: "vertical" }} />
            </div>
            <button className="btn btn-p" style={{ width: "100%" }}>Crear regla</button>
          </div>
          <div className="card">
            <div className="ct">Buenas practicas</div>
            {["Mensajes cortos y personales convierten mas", "Inclui siempre el nombre del producto", "Una pregunta abierta invita a responder", "El emoji justo da calidez sin exceso", "Envia en horario diurno (10 a 20hs)"].map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 7, marginBottom: 9, fontSize: 11, color: "#c4bdb4" }}><span style={{ color: "#25d366" }}>v</span>{t}</div>
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
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 300, letterSpacing: ".18em", color: "#c9a96e" }}>LUMIERE</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 11, color: "#ffffff44" }}>{client.email}</span>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#c9a96e", display: "flex", alignItems: "center", justifyContent: "center", color: "#0c0b0a", fontSize: 13, fontWeight: 600 }}>{client.name[0]}</div>
        </div>
      </div>
      <div style={{ padding: "28px 32px", maxWidth: 860, margin: "0 auto" }}>
        <div style={{ background: "linear-gradient(135deg,#1e1208,#2a1a0a)", border: "1px solid #c9a96e33", borderRadius: 14, padding: 26, marginBottom: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 9, color: "#c9a96e88", letterSpacing: ".25em", textTransform: "uppercase", marginBottom: 5 }}>Bienvenida de nuevo</div>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 300, color: "#f0e8de", marginBottom: 14 }}>{client.name}</div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 20, background: "#c9a96e18", border: "1px solid #c9a96e44", fontSize: 9, color: "#c9a96e", letterSpacing: ".12em" }}>
                NIVEL {client.tier.toUpperCase()}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 52, fontWeight: 300, color: "#c9a96e", lineHeight: 1 }}>{client.points.toLocaleString()}</div>
              <div style={{ fontSize: 9, color: "#ffffff44", letterSpacing: ".2em", marginTop: 3 }}>PUNTOS DISPONIBLES</div>
              <div style={{ fontSize: 10, color: "#ffffff33", marginTop: 6 }}>Proximo nivel: {(2000 - client.points).toLocaleString()} pts</div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
          {[["canjear", "Canjear puntos"], ["cupones", "Mis cupones"], ["historial", "Mis compras"]].map(([id, l]) => (
            <button key={id} onClick={() => setTab(id)} style={{ padding: "8px 16px", borderRadius: 7, border: "1px solid", borderColor: tab === id ? "#c9a96e55" : "#ffffff0f", background: tab === id ? "#c9a96e14" : "transparent", color: tab === id ? "#c9a96e" : "#ffffff44", fontFamily: "'DM Mono',monospace", fontSize: 11, cursor: "pointer" }}>{l}</button>
          ))}
        </div>
        {tab === "canjear" && (
          <div>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 300, color: "#f0e8de", marginBottom: 14 }}>Canjea tus puntos</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
              {REWARDS_DISPLAY.map(r => {
                const can = client.points >= r.pts;
                return (
                  <div key={r.id} style={{ background: can ? "#1e1208" : "#120d07", border: "1px solid " + (can ? "#c9a96e33" : "#ffffff08"), borderRadius: 10, padding: 16, opacity: can ? 1 : 0.5 }}>
                    {can && <div style={{ background: "#6bbf8e", color: "#0c0b0a", fontSize: 8, padding: "2px 6px", borderRadius: 3, marginBottom: 8, width: "fit-content" }}>PODES CANJEAR</div>}
                    <div style={{ fontSize: 24, marginBottom: 8 }}>{r.emoji}</div>
                    <div style={{ fontSize: 11, color: "#e8ddd4" }}>{r.name}</div>
                    <div style={{ fontSize: 9, color: "#ffffff33", letterSpacing: ".1em", marginTop: 2 }}>{r.brand}</div>
                    <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: "#c9a96e", marginTop: 10 }}>{r.pts.toLocaleString()}</div>
                    <div style={{ fontSize: 9, color: "#ffffff33" }}>PUNTOS</div>
                    {can && <button style={{ marginTop: 10, width: "100%", padding: "7px", borderRadius: 5, background: "#c9a96e18", border: "1px solid #c9a96e33", color: "#c9a96e", fontFamily: "'DM Mono',monospace", fontSize: 10, cursor: "pointer" }}>Canjear</button>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {tab === "cupones" && (
          <div>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 300, color: "#f0e8de", marginBottom: 14 }}>Tus cupones activos</div>
            {[{ code: "BDAY10", desc: "$10.000 de descuento por cumpleanos", exp: "Valido hasta: 30/06/2026" }, { code: "INSTA20", desc: "20% off en toda la tienda", exp: "Valido hasta: 31/05/2026" }].map((cp, i) => (
              <div key={i} style={{ background: "#1e1208", border: "1px dashed #c9a96e44", borderRadius: 10, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div>
                  <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: "#c9a96e", letterSpacing: ".1em" }}>{cp.code}</div>
                  <div style={{ fontSize: 11, color: "#ffffff55", marginTop: 3 }}>{cp.desc}</div>
                  <div style={{ fontSize: 10, color: "#ffffff28", marginTop: 4 }}>{cp.exp}</div>
                </div>
                <button style={{ background: "#c9a96e18", border: "1px solid #c9a96e33", color: "#c9a96e", padding: "7px 14px", borderRadius: 5, fontFamily: "'DM Mono',monospace", fontSize: 10, cursor: "pointer" }}>Copiar</button>
              </div>
            ))}
          </div>
        )}
        {tab === "historial" && (
          <div>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 300, color: "#f0e8de", marginBottom: 14 }}>Historial de compras</div>
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
                  <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: "#c9a96e" }}>${h.total.toLocaleString()}</div>
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

const NAV_SECTIONS = [
  { section: "GESTION", items: [{ id: "dashboard", icon: "◈", label: "Dashboard" }, { id: "pos", icon: "⊕", label: "Punto de Venta" }, { id: "inventory", icon: "⊞", label: "Inventario" }, { id: "clients", icon: "◉", label: "Clientes" }] },
  { section: "FINANZAS", items: [{ id: "finance", icon: "◎", label: "Finanzas" }, { id: "reports", icon: "◐", label: "Informes" }] },
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

export default function App() {
  const [page, setPage] = useState("dashboard");
  return (
    <>
      <style>{BASE_CSS}</style>
      <div className="layout">
        <aside className="sidebar">
          <div className="logo">
            <div className="logo-name">Lumiere</div>
            <div className="logo-sub">Sistema de gestion</div>
          </div>
          <nav className="nav">
            {NAV_SECTIONS.map(sec => (
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
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <StatusDot color="#6bbf8e" label="ARCA" />
              <StatusDot color="#25d366" label="TIENDANUBE" />
              <StatusDot color="#25d366" label="WHATSAPP" />
            </div>
          </div>
        </aside>
        <main className="main">
          {getPage(page)}
        </main>
      </div>
    </>
  );
}