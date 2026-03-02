import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
  ComposedChart, Area, Legend, Line
} from "recharts";

const fmt = (v) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtK = (v) => v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${v.toFixed(0)}`;
const shortDate = (d) => { if (!d) return ''; const p = d.split('-'); return `${p[2]}/${p[1]}`; };
const shortName = (n) => { const p = n.split(' '); return p.length > 2 ? `${p[0]} ${p[p.length - 1]}` : n; };

const C = {
  bg: '#0a1628', card: '#111d33', cardBorder: '#1a2d4a',
  accent: '#3b82f6', cyan: '#06b6d4',
  green: '#10b981', red: '#ef4444', orange: '#f59e0b',
  purple: '#8b5cf6', pink: '#ec4899',
  text: '#e2e8f0', textMuted: '#94a3b8', textDim: '#64748b',
};
const PIE_C = ['#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#10b981', '#f97316'];

function KPI({ label, value, sub, color, icon }) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${C.card} 0%, ${C.bg} 100%)`,
      border: `1px solid ${C.cardBorder}`, borderRadius: 16,
      padding: '20px 24px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: color, opacity: 0.07 }} />
      <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>{icon} {label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: C.text, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.textDim, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function Sec({ children }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 700, color: C.textMuted, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 3, height: 16, background: C.accent, borderRadius: 2 }} />
      {children}
    </div>
  );
}

function Box({ children, style }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 16, padding: 20, ...style }}>
      {children}
    </div>
  );
}

function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '10px 14px', fontSize: 12, zIndex: 999 }}>
      <div style={{ fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || '#e2e8f0', marginTop: 2 }}>
          {p.name}: {typeof p.value === 'number' && p.value > 500 ? fmt(p.value) : p.value}
        </div>
      ))}
    </div>
  );
}

const TABS = ['Geral', 'Turmas', 'Improdutividade'];

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('Geral');
  const [month, setMonth] = useState('all');
  const [updated, setUpdated] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/data');
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      setUpdated(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, []);

  const fd = useMemo(() => {
    if (!data) return null;
    if (month === 'all') return data;
    const prefix = month === 'jan' ? '2026-01' : '2026-02';
    const daily = data.daily.filter(d => d.data.startsWith(prefix));
    let ac = 0;
    const dr = daily.map(d => { ac += d.valor; return { ...d, acumulado: ac }; });
    const tv = daily.reduce((s, d) => s + d.valor, 0);
    const ts = daily.reduce((s, d) => s + d.sim, 0);
    const tn = daily.reduce((s, d) => s + d.nao, 0);
    const tr = ts + tn;
    return {
      ...data, daily: dr,
      improd_trend: data.improd_trend.filter(d => d.data.startsWith(prefix)),
      kpis: { ...data.kpis, total_valor: tv, total_sim: ts, total_nao: tn, total_registros: tr, taxa_produtividade: tr > 0 ? Math.round((ts / tr) * 1000) / 10 : 0 },
    };
  }, [data, month]);

  // LOADING
  if (loading && !data) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: C.text, fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ fontSize: 48, marginBottom: 20 }}>📊</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Carregando Dashboard...</div>
      <div style={{ fontSize: 14, color: C.textDim }}>Buscando dados da planilha Google Sheets</div>
      <div style={{ marginTop: 24, width: 200, height: 4, background: C.cardBorder, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: '40%', height: '100%', background: C.accent, borderRadius: 2, animation: 'ld 1.5s ease-in-out infinite' }} />
      </div>
      <style>{`@keyframes ld { 0%{transform:translateX(-100%)} 50%{transform:translateX(250%)} 100%{transform:translateX(-100%)} }`}</style>
    </div>
  );

  // ERROR
  if (error && !data) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: C.text, fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ fontSize: 48, marginBottom: 20 }}>⚠️</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: C.red }}>Erro ao carregar dados</div>
      <div style={{ fontSize: 14, color: C.textDim, marginBottom: 20, maxWidth: 400, textAlign: 'center' }}>{error}</div>
      <button onClick={load} style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Tentar Novamente</button>
    </div>
  );

  if (!fd) return null;

  const dailyChart = fd.daily.map(d => ({ ...d, label: shortDate(d.data) }));
  const encChart = data.encarregados.filter(e => e.valor > 0).slice(0, 12).map(e => ({ ...e, nome: shortName(e.nome) }));
  const improdChart = fd.improd_trend.map(d => ({ ...d, label: shortDate(d.data) }));
  const topMot = data.motivos.slice(0, 6);
  const totMot = topMot.reduce((s, m) => s + m.count, 0);

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'Segoe UI', -apple-system, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap" rel="stylesheet" />

      {/* HEADER */}
      <div style={{ background: 'linear-gradient(135deg, #0f2847 0%, #1a1a3e 50%, #0a1628 100%)', borderBottom: `1px solid ${C.cardBorder}`, padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 5, height: 36, background: `linear-gradient(180deg, ${C.accent}, ${C.cyan})`, borderRadius: 3 }} />
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>OPERAÇÃO PIAUÍ — CONTRATO LPT</h1>
            <div style={{ fontSize: 13, color: C.textDim, marginTop: 2 }}>
              Produção Geral &middot; Dados ao vivo do Google Sheets
              {updated && <span> &middot; {updated.toLocaleTimeString('pt-BR')}</span>}
              {loading && <span style={{ color: C.orange }}> &middot; Atualizando...</span>}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={load} style={{ background: 'transparent', border: `1px solid ${C.cardBorder}`, color: C.textMuted, borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', marginRight: 4 }}>🔄</button>
          {[{ k: 'all', l: 'Tudo' }, { k: 'jan', l: 'Jan' }, { k: 'fev', l: 'Fev' }].map(f => (
            <button key={f.k} onClick={() => setMonth(f.k)} style={{
              background: month === f.k ? C.accent : 'transparent',
              border: `1px solid ${month === f.k ? C.accent : C.cardBorder}`,
              color: month === f.k ? '#fff' : C.textMuted,
              borderRadius: 8, padding: '6px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>{f.l}</button>
          ))}
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', padding: '0 28px', background: '#0d1b30', borderBottom: `1px solid ${C.cardBorder}` }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: 'none', border: 'none', color: tab === t ? C.accent : C.textDim,
            fontSize: 13, fontWeight: 700, padding: '12px 20px', cursor: 'pointer',
            borderBottom: tab === t ? `2px solid ${C.accent}` : '2px solid transparent', letterSpacing: 0.5,
          }}>{t.toUpperCase()}</button>
        ))}
      </div>

      <div style={{ padding: '20px 28px', maxWidth: 1400, margin: '0 auto' }}>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <KPI icon="💰" label="Total Produzido" value={fmt(fd.kpis.total_valor)} sub={`${fd.daily.length} dias`} color={C.green} />
          <KPI icon="📊" label="Taxa Produtividade" value={`${fd.kpis.taxa_produtividade}%`} sub={`${fd.kpis.total_sim} de ${fd.kpis.total_registros}`} color={fd.kpis.taxa_produtividade > 50 ? C.green : C.red} />
          <KPI icon="✅" label="Produtivos" value={fd.kpis.total_sim} sub={`${fd.kpis.total_nao} improdutivos`} color={C.accent} />
          <KPI icon="👷" label="Encarregados" value={fd.kpis.encarregados_unicos} sub="turmas" color={C.purple} />
          <KPI icon="📈" label="Média/Dia" value={fmtK(fd.kpis.total_valor / Math.max(fd.daily.length, 1))} sub="valor produzido" color={C.cyan} />
        </div>

        {/* ========== GERAL ========== */}
        {tab === 'Geral' && (<>
          <Box style={{ marginBottom: 20 }}>
            <Sec>Produção Diária vs Acumulada</Sec>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={dailyChart} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="bg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.accent} stopOpacity={0.9} /><stop offset="100%" stopColor={C.accent} stopOpacity={0.3} /></linearGradient>
                  <linearGradient id="ag1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.cyan} stopOpacity={0.15} /><stop offset="100%" stopColor={C.cyan} stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" tick={{ fill: C.textDim, fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
                <YAxis yAxisId="l" tick={{ fill: C.textDim, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <YAxis yAxisId="r" orientation="right" tick={{ fill: C.textDim, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<Tip />} />
                <Bar yAxisId="l" dataKey="valor" name="Valor Diário" fill="url(#bg1)" radius={[4, 4, 0, 0]} />
                <Area yAxisId="r" type="monotone" dataKey="acumulado" name="Acumulado" stroke={C.cyan} fill="url(#ag1)" strokeWidth={2.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </Box>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <Box>
              <Sec>Produção Semanal</Sec>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.weekly.map(w => ({ ...w, label: shortDate(w.semana) }))} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="label" tick={{ fill: C.textDim, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: C.textDim, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<Tip />} />
                  <Bar dataKey="valor" name="Valor" fill={C.accent} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
            <Box>
              <Sec>Turmas Produtivas vs Improdutivas / Dia</Sec>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={dailyChart} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="label" tick={{ fill: C.textDim, fontSize: 10 }} axisLine={false} tickLine={false} interval={3} />
                  <YAxis tick={{ fill: C.textDim, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<Tip />} />
                  <Bar dataKey="sim" name="Produtivas" stackId="a" fill={C.green} />
                  <Bar dataKey="nao" name="Improdutivas" stackId="a" fill={C.red} opacity={0.7} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </div>
        </>)}

        {/* ========== TURMAS ========== */}
        {tab === 'Turmas' && (<>
          <Box style={{ marginBottom: 20 }}>
            <Sec>Ranking de Encarregados — Valor Produzido</Sec>
            <ResponsiveContainer width="100%" height={380}>
              <BarChart data={encChart} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" tick={{ fill: C.textDim, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <YAxis dataKey="nome" type="category" tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} width={140} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="valor" name="Valor Total" fill={C.accent} radius={[0, 6, 6, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </Box>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <Box>
              <Sec>Taxa de Produtividade por Encarregado</Sec>
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {data.encarregados.filter(e => e.total >= 5).sort((a, b) => b.taxa - a.taxa).map((e, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, padding: '6px 0' }}>
                    <div style={{ width: 130, fontSize: 11, color: C.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shortName(e.nome)}</div>
                    <div style={{ flex: 1, height: 20, background: '#1e293b', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ width: `${e.taxa}%`, height: '100%', borderRadius: 10, background: e.taxa >= 60 ? `linear-gradient(90deg, ${C.green}, #34d399)` : e.taxa >= 40 ? `linear-gradient(90deg, ${C.orange}, #fbbf24)` : `linear-gradient(90deg, ${C.red}, #f87171)` }} />
                    </div>
                    <div style={{ width: 45, textAlign: 'right', fontSize: 12, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: e.taxa >= 60 ? C.green : e.taxa >= 40 ? C.orange : C.red }}>{e.taxa}%</div>
                  </div>
                ))}
              </div>
            </Box>
            <Box>
              <Sec>Distribuição por Tipo de Turma</Sec>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={data.tipos_turma} dataKey="count" nameKey="tipo" cx="50%" cy="50%" innerRadius={65} outerRadius={110} paddingAngle={3} strokeWidth={0}>
                    {data.tipos_turma.map((_, i) => <Cell key={i} fill={PIE_C[i % PIE_C.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v, name) => [`${v} registros`, name]} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, fontSize: 12 }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: C.textMuted }} />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </div>

          {/* Table */}
          <Box>
            <Sec>Detalhamento por Encarregado</Sec>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
                    {['Encarregado', 'Valor Total', 'Média/Serv', 'Prod', 'Improd', 'Total', 'Taxa'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: C.textDim, fontWeight: 600, fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.encarregados.map((e, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${C.cardBorder}15` }}>
                      <td style={{ padding: '8px 12px', color: C.text, fontWeight: 500 }}>{e.nome}</td>
                      <td style={{ padding: '8px 12px', fontFamily: "'JetBrains Mono', monospace", color: C.green }}>{fmt(e.valor)}</td>
                      <td style={{ padding: '8px 12px', fontFamily: "'JetBrains Mono', monospace", color: C.textMuted }}>{fmt(e.media)}</td>
                      <td style={{ padding: '8px 12px', color: C.green }}>{e.sim}</td>
                      <td style={{ padding: '8px 12px', color: C.red }}>{e.nao}</td>
                      <td style={{ padding: '8px 12px', color: C.textMuted }}>{e.total}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", background: e.taxa >= 60 ? '#10b98120' : e.taxa >= 40 ? '#f59e0b20' : '#ef444420', color: e.taxa >= 60 ? C.green : e.taxa >= 40 ? C.orange : C.red }}>{e.taxa}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Box>
        </>)}

        {/* ========== IMPRODUTIVIDADE ========== */}
        {tab === 'Improdutividade' && (<>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <Box>
              <Sec>Motivos Macro — Improdutividade</Sec>
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie data={topMot} dataKey="count" nameKey="motivo" cx="50%" cy="50%" innerRadius={70} outerRadius={120} paddingAngle={3} strokeWidth={0}>
                    {topMot.map((_, i) => <Cell key={i} fill={PIE_C[i % PIE_C.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v, name) => [`${v} (${((v / totMot) * 100).toFixed(1)}%)`, name]} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 8 }}>
                {topMot.map((m, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.textMuted }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: PIE_C[i] }} />
                    {m.motivo} ({m.count})
                  </div>
                ))}
              </div>
            </Box>
            <Box>
              <Sec>Ranking de Motivos</Sec>
              <div style={{ marginTop: 8 }}>
                {data.motivos.map((m, i) => {
                  const pct = (m.count / data.kpis.total_nao) * 100;
                  return (
                    <div key={i} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 11, color: C.textMuted }}>{m.motivo}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: C.text }}>{m.count} <span style={{ color: C.textDim }}>({pct.toFixed(1)}%)</span></span>
                      </div>
                      <div style={{ height: 8, background: '#1e293b', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: `linear-gradient(90deg, ${PIE_C[i % PIE_C.length]}, ${PIE_C[i % PIE_C.length]}aa)` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Box>
          </div>

          <Box>
            <Sec>Tendência % Improdutividade Diária</Sec>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={improdChart} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="ig1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.red} stopOpacity={0.25} /><stop offset="100%" stopColor={C.red} stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" tick={{ fill: C.textDim, fontSize: 10 }} axisLine={false} tickLine={false} interval={3} />
                <YAxis tick={{ fill: C.textDim, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                <Tooltip formatter={(v) => [`${v}%`]} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, fontSize: 12 }} />
                <Area type="monotone" dataKey="pct_improd" name="% Improdutivo" stroke={C.red} fill="url(#ig1)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="pct_improd" stroke={C.red} strokeWidth={2.5} dot={{ r: 3, fill: C.red }} activeDot={{ r: 5 }} name="% Improdutivo" />
              </ComposedChart>
            </ResponsiveContainer>
          </Box>
        </>)}

        {/* FOOTER */}
        <div style={{ marginTop: 28, padding: '16px 0', borderTop: `1px solid ${C.cardBorder}`, textAlign: 'center', color: C.textDim, fontSize: 11 }}>
          Dashboard Operação Piauí — Contrato LPT &middot; Dados ao vivo do Google Sheets &middot; Auto-refresh a cada 5 min
        </div>
      </div>
    </div>
  );
}
