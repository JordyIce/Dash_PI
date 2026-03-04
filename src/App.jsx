import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
  ComposedChart, Area, Legend, Line
} from "recharts";

var MONTH_NAMES = {
  '01': 'Janeiro', '02': 'Fevereiro', '03': 'Marco', '04': 'Abril',
  '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
  '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro'
};
function computeData(records) {
  var totalValor = records.reduce(function(s, r) { return s + r.v; }, 0);
  var totalSim = records.filter(function(r) { return r.p === 'SIM'; }).length;
  var totalNao = records.filter(function(r) { return r.p !== 'SIM'; }).length;
  var totalReg = records.length;
  var taxa = totalReg > 0 ? Math.round((totalSim / totalReg) * 1000) / 10 : 0;
  var encsSet = new Set(records.map(function(r) { return r.e; }));
  var dates = [...new Set(records.map(function(r) { return r.d; }).filter(Boolean))].sort();
  var dm = {};
  records.forEach(function(r) {
    if (!r.d) return;
    if (!dm[r.d]) dm[r.d] = { valor: 0, sim: 0, nao: 0, total: 0 };
    dm[r.d].valor += r.v; dm[r.d].total++;
    r.p === 'SIM' ? dm[r.d].sim++ : dm[r.d].nao++;
  });
  var ac = 0;
  var daily = Object.entries(dm).sort(function(a, b) { return a[0].localeCompare(b[0]); }).map(function(entry) {
    ac += entry[1].valor;
    return { data: entry[0], valor: Math.round(entry[1].valor * 100) / 100, acumulado: Math.round(ac * 100) / 100, sim: entry[1].sim, nao: entry[1].nao, total: entry[1].total };
  });
  var mm = {};
  records.filter(function(r) { return r.p !== 'SIM' && r.m; }).forEach(function(r) { mm[r.m] = (mm[r.m] || 0) + 1; });
  var motivos = Object.entries(mm).map(function(e) { return { motivo: e[0], count: e[1] }; }).sort(function(a, b) { return b.count - a.count; });
  var em = {};
  records.forEach(function(r) {
    if (!em[r.e]) em[r.e] = { valor: 0, sim: 0, nao: 0, total: 0 };
    em[r.e].valor += r.v; em[r.e].total++;
    r.p === 'SIM' ? em[r.e].sim++ : em[r.e].nao++;
  });
  var encarregados = Object.entries(em).map(function(e) {
    var v = e[1];
    return { nome: e[0], valor: Math.round(v.valor * 100) / 100, media: v.sim > 0 ? Math.round((v.valor / v.sim) * 100) / 100 : 0, sim: v.sim, nao: v.nao, total: v.total, taxa: v.total > 0 ? Math.round((v.sim / v.total) * 1000) / 10 : 0 };
  }).sort(function(a, b) { return b.valor - a.valor; });
  var tm = {};
  records.forEach(function(r) { var t = r.tt || 'N/A'; if (!tm[t]) tm[t] = { count: 0 }; tm[t].count++; });
  var tipos_turma = Object.entries(tm).map(function(e) { return { tipo: e[0], count: e[1].count }; }).sort(function(a, b) { return b.count - a.count; });
  var wm = {};
  records.forEach(function(r) {
    if (!r.d) return;
    var dt = new Date(r.d + 'T12:00:00'); var day = dt.getDay();
    var diff = day === 0 ? 6 : day - 1;
    var mon = new Date(dt); mon.setDate(dt.getDate() - diff);
    var wk = mon.toISOString().slice(0, 10);
    if (!wm[wk]) wm[wk] = { valor: 0, sim: 0, nao: 0 };
    wm[wk].valor += r.v; r.p === 'SIM' ? wm[wk].sim++ : wm[wk].nao++;
  });
  var weekly = Object.entries(wm).sort(function(a, b) { return a[0].localeCompare(b[0]); }).map(function(e) { return { semana: e[0], valor: Math.round(e[1].valor * 100) / 100, sim: e[1].sim, nao: e[1].nao }; });
  var improd_trend = Object.entries(dm).sort(function(a, b) { return a[0].localeCompare(b[0]); }).map(function(e) {
    return { data: e[0], pct_improd: e[1].total > 0 ? Math.round((e[1].nao / e[1].total) * 1000) / 10 : 0, total: e[1].total, nao: e[1].nao };
  });
  return {
    kpis: { total_valor: Math.round(totalValor * 100) / 100, total_registros: totalReg, total_sim: totalSim, total_nao: totalNao, taxa_produtividade: taxa, encarregados_unicos: encsSet.size, data_inicio: dates[0] || '', data_fim: dates[dates.length - 1] || '' },
    daily: daily, motivos: motivos, encarregados: encarregados, tipos_turma: tipos_turma, weekly: weekly, improd_trend: improd_trend,
  };
}
var fmt = function(v) { return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
var fmtK = function(v) { return v >= 1000 ? 'R$ ' + (v / 1000).toFixed(0) + 'k' : 'R$ ' + v.toFixed(0); };
var shortDate = function(d) { if (!d) return ''; var p = d.split('-'); return p[2] + '/' + p[1]; };
var shortName = function(n) { var p = n.split(' '); return p.length > 2 ? p[0] + ' ' + p[p.length - 1] : n; };

var C = { bg: '#0a1628', card: '#111d33', cardBorder: '#1a2d4a', accent: '#3b82f6', cyan: '#06b6d4', green: '#10b981', red: '#ef4444', orange: '#f59e0b', purple: '#8b5cf6', pink: '#ec4899', text: '#e2e8f0', textMuted: '#94a3b8', textDim: '#64748b' };
var PIE_C = ['#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#10b981', '#f97316'];

var dateInputStyle = {
  background: '#1a2d4a',
  color: '#e2e8f0',
  border: '1px solid #3b82f6',
  borderRadius: 8,
  padding: '6px 10px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  outline: 'none',
  fontFamily: "'JetBrains Mono', monospace",
  colorScheme: 'dark',
};

function KPI({ label, value, sub, color, icon }) {
  return (
    <div style={{ background: 'linear-gradient(135deg, ' + C.card + ' 0%, ' + C.bg + ' 100%)', border: '1px solid ' + C.cardBorder, borderRadius: 16, padding: '20px 24px', position: 'relative', overflow: 'hidden' }}>
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
  return (<div style={{ background: C.card, border: '1px solid ' + C.cardBorder, borderRadius: 16, padding: 20, ...style }}>{children}</div>);
}
function Tip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '10px 14px', fontSize: 12, zIndex: 999 }}>
      <div style={{ fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>{label}</div>
      {payload.map(function(p, i) { return (<div key={i} style={{ color: p.color || '#e2e8f0', marginTop: 2 }}>{p.name}: {typeof p.value === 'number' && p.value > 500 ? fmt(p.value) : p.value}</div>); })}
    </div>
  );
}

var TABS = ['Geral', 'Turmas', 'Improdutividade'];

// Atalhos rapidos de periodo
function getQuickRange(key, allDates) {
  if (!allDates || allDates.length === 0) return { start: '', end: '' };
  var today = allDates[allDates.length - 1]; // ultima data disponivel
  var d = new Date(today + 'T12:00:00');
  if (key === 'today') {
    return { start: today, end: today };
  }
  if (key === '7d') {
    var s7 = new Date(d); s7.setDate(d.getDate() - 6);
    return { start: s7.toISOString().slice(0, 10), end: today };
  }
  if (key === '15d') {
    var s15 = new Date(d); s15.setDate(d.getDate() - 14);
    return { start: s15.toISOString().slice(0, 10), end: today };
  }
  if (key === '30d') {
    var s30 = new Date(d); s30.setDate(d.getDate() - 29);
    return { start: s30.toISOString().slice(0, 10), end: today };
  }
  if (key === 'month') {
    var mStart = today.substring(0, 7) + '-01';
    return { start: mStart, end: today };
  }
  return { start: '', end: '' };
}

export default function App() {
  var [allRecords, setAllRecords] = useState(null);
  var [loading, setLoading] = useState(true);
  var [error, setError] = useState(null);
  var [tab, setTab] = useState('Geral');
  var [dateStart, setDateStart] = useState('');
  var [dateEnd, setDateEnd] = useState('');
  var [turmaFilter, setTurmaFilter] = useState('all');
  var [baseFilter, setBaseFilter] = useState('all');
  var [updated, setUpdated] = useState(null);
  var [activeQuick, setActiveQuick] = useState('all');

  var load = async function() {
    setLoading(true); setError(null);
    try {
      var res = await fetch('/api/data');
      if (!res.ok) throw new Error('Erro ' + res.status);
      var json = await res.json();
      if (json.error) throw new Error(json.error);
      setAllRecords(json.records); setUpdated(new Date());
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(function() { load(); var iv = setInterval(load, 5*60*1000); return function() { clearInterval(iv); }; }, []);

  var allDates = useMemo(function() {
    if (!allRecords) return [];
    return [...new Set(allRecords.map(function(r) { return r.d; }).filter(Boolean))].sort();
  }, [allRecords]);

  var turmaTypes = useMemo(function() {
    if (!allRecords) return [];
    return [...new Set(allRecords.map(function(r) { return r.tt; }).filter(Boolean))].sort();
  }, [allRecords]);

  var baseTypes = useMemo(function() {
    if (!allRecords) return [];
    return [...new Set(allRecords.map(function(r) { return r.b; }).filter(Boolean))].sort();
  }, [allRecords]);

  function applyQuick(key) {
    setActiveQuick(key);
    if (key === 'all') {
      setDateStart(''); setDateEnd('');
      return;
    }
    var range = getQuickRange(key, allDates);
    setDateStart(range.start);
    setDateEnd(range.end);
  }

  // Quando o usuario muda a data manualmente, desativa o atalho
  function onDateStartChange(v) { setDateStart(v); setActiveQuick('custom'); }
  function onDateEndChange(v) { setDateEnd(v); setActiveQuick('custom'); }

  // Label do periodo selecionado
  var periodLabel = useMemo(function() {
    if (!dateStart && !dateEnd) return 'Todos os dados';
    var s = dateStart ? dateStart.split('-').reverse().join('/') : '...';
    var e = dateEnd ? dateEnd.split('-').reverse().join('/') : '...';
    if (dateStart === dateEnd && dateStart) return s;
    return s + '  a  ' + e;
  }, [dateStart, dateEnd]);

  var fd = useMemo(function() {
    if (!allRecords) return null;
    var filtered = allRecords;
    if (dateStart) { filtered = filtered.filter(function(r) { return r.d && r.d >= dateStart; }); }
    if (dateEnd) { filtered = filtered.filter(function(r) { return r.d && r.d <= dateEnd; }); }
    if (turmaFilter !== 'all') filtered = filtered.filter(function(r) { return r.tt === turmaFilter; });
    if (baseFilter !== 'all') filtered = filtered.filter(function(r) { return r.b === baseFilter; });
    return computeData(filtered);
  }, [allRecords, dateStart, dateEnd, turmaFilter, baseFilter]);

  if (loading && !allRecords) return (<div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: C.text, fontFamily: "'Segoe UI', sans-serif" }}><div style={{ fontSize: 48, marginBottom: 20 }}>&#128202;</div><div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Carregando Dashboard...</div><div style={{ fontSize: 14, color: C.textDim }}>Buscando dados da planilha Google Sheets</div></div>);
  if (error && !allRecords) return (<div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: C.text, fontFamily: "'Segoe UI', sans-serif" }}><div style={{ fontSize: 48, marginBottom: 20 }}>&#9888;&#65039;</div><div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: C.red }}>Erro ao carregar dados</div><div style={{ fontSize: 14, color: C.textDim, marginBottom: 20, maxWidth: 400, textAlign: 'center' }}>{error}</div><button onClick={load} style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Tentar Novamente</button></div>);
  if (!fd) return null;
  var dailyChart = fd.daily.map(function(d) { return { ...d, label: shortDate(d.data) }; });
  var encChart = fd.encarregados.filter(function(e) { return e.valor > 0; }).slice(0, 12).map(function(e) { return { ...e, nome: shortName(e.nome) }; });
  var improdChart = fd.improd_trend.map(function(d) { return { ...d, label: shortDate(d.data) }; });
  var topMot = fd.motivos.slice(0, 6);
  var totMot = topMot.reduce(function(s, m) { return s + m.count; }, 0);
  var quickButtons = [
    { k: 'all', l: 'Tudo' },
    { k: 'today', l: 'Hoje' },
    { k: '7d', l: '7 dias' },
    { k: '15d', l: '15 dias' },
    { k: '30d', l: '30 dias' },
    { k: 'month', l: 'Mes atual' },
  ];
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'Segoe UI', -apple-system, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap" rel="stylesheet" />
      <div style={{ background: 'linear-gradient(135deg, #0f2847 0%, #1a1a3e 50%, #0a1628 100%)', borderBottom: '1px solid ' + C.cardBorder, padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 5, height: 36, background: 'linear-gradient(180deg, ' + C.accent + ', ' + C.cyan + ')', borderRadius: 3 }} />
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>OPERACAO PIAUI - CONTRATO LPT</h1>
            <div style={{ fontSize: 13, color: C.textDim, marginTop: 2 }}>Dados ao vivo do Google Sheets{updated && <span> &middot; {updated.toLocaleTimeString('pt-BR')}</span>}{loading && <span style={{ color: C.orange }}> &middot; Atualizando...</span>}</div>
          </div>
        </div>
        <button onClick={load} style={{ background: 'transparent', border: '1px solid ' + C.cardBorder, color: C.textMuted, borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>&#128260;</button>
      </div>

      {/* Barra de filtros */}
      <div style={{ padding: '14px 28px', background: '#0d1b30', borderBottom: '1px solid ' + C.cardBorder, display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>

        {/* PERIODO - atalhos rapidos */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: C.textDim, fontWeight: 600 }}>PERIODO:</span>
          {quickButtons.map(function(q) { return (
            <button key={q.k} onClick={function() { applyQuick(q.k); }} style={{
              background: activeQuick === q.k ? C.accent : 'transparent',
              border: '1px solid ' + (activeQuick === q.k ? C.accent : C.cardBorder),
              color: activeQuick === q.k ? '#fff' : C.textMuted,
              borderRadius: 8, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}>{q.l}</button>
          ); })}
        </div>

        <div style={{ width: 1, height: 24, background: C.cardBorder }} />

        {/* PERIODO - inputs de data */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: C.textDim, fontWeight: 600 }}>DE:</span>
          <input
            type="date"
            value={dateStart}
            onChange={function(e) { onDateStartChange(e.target.value); }}
            min={allDates[0] || ''}
            max={dateEnd || allDates[allDates.length - 1] || ''}
            style={dateInputStyle}
          />
          <span style={{ fontSize: 11, color: C.textDim, fontWeight: 600 }}>ATE:</span>
          <input
            type="date"
            value={dateEnd}
            onChange={function(e) { onDateEndChange(e.target.value); }}
            min={dateStart || allDates[0] || ''}
            max={allDates[allDates.length - 1] || ''}
            style={dateInputStyle}
          />
        </div>

        <div style={{ width: 1, height: 24, background: C.cardBorder }} />

        {/* BASE */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: C.textDim, fontWeight: 600 }}>BASE:</span>
          <button onClick={function() { setBaseFilter('all'); }} style={{ background: baseFilter === 'all' ? C.cyan : 'transparent', border: '1px solid ' + (baseFilter === 'all' ? C.cyan : C.cardBorder), color: baseFilter === 'all' ? '#fff' : C.textMuted, borderRadius: 8, padding: '5px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Todas</button>
          {baseTypes.map(function(b) { return (<button key={b} onClick={function() { setBaseFilter(b); }} style={{ background: baseFilter === b ? C.cyan : 'transparent', border: '1px solid ' + (baseFilter === b ? C.cyan : C.cardBorder), color: baseFilter === b ? '#fff' : C.textMuted, borderRadius: 8, padding: '5px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{b}</button>); })}
        </div>

        <div style={{ width: 1, height: 24, background: C.cardBorder }} />

        {/* TURMA */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: C.textDim, fontWeight: 600 }}>TURMA:</span>
          <button onClick={function() { setTurmaFilter('all'); }} style={{ background: turmaFilter === 'all' ? C.purple : 'transparent', border: '1px solid ' + (turmaFilter === 'all' ? C.purple : C.cardBorder), color: turmaFilter === 'all' ? '#fff' : C.textMuted, borderRadius: 8, padding: '5px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Todas</button>
          {turmaTypes.map(function(t) { return (<button key={t} onClick={function() { setTurmaFilter(t); }} style={{ background: turmaFilter === t ? C.purple : 'transparent', border: '1px solid ' + (turmaFilter === t ? C.purple : C.cardBorder), color: turmaFilter === t ? '#fff' : C.textMuted, borderRadius: 8, padding: '5px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{t}</button>); })}
        </div>
      </div>

      {/* Info do periodo + Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', background: '#0d1b30', borderBottom: '1px solid ' + C.cardBorder }}>
        <div style={{ display: 'flex' }}>
          {TABS.map(function(t) { return (<button key={t} onClick={function() { setTab(t); }} style={{ background: 'none', border: 'none', color: tab === t ? C.accent : C.textDim, fontSize: 13, fontWeight: 700, padding: '12px 20px', cursor: 'pointer', borderBottom: tab === t ? '2px solid ' + C.accent : '2px solid transparent', letterSpacing: 0.5 }}>{t.toUpperCase()}</button>); })}
        </div>
        <div style={{ fontSize: 11, color: C.textMuted, fontFamily: "'JetBrains Mono', monospace", padding: '8px 0' }}>
          {periodLabel}
        </div>
      </div>

      <div style={{ padding: '20px 28px', maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <KPI icon="&#128176;" label="Total Produzido" value={fmt(fd.kpis.total_valor)} sub={fd.daily.length + ' dias'} color={C.green} />
          <KPI icon="&#128202;" label="Taxa Produtividade" value={fd.kpis.taxa_produtividade + '%'} sub={fd.kpis.total_sim + ' de ' + fd.kpis.total_registros} color={fd.kpis.taxa_produtividade > 50 ? C.green : C.red} />
          <KPI icon="&#9989;" label="Produtivos" value={fd.kpis.total_sim} sub={fd.kpis.total_nao + ' improdutivos'} color={C.accent} />
          <KPI icon="&#128119;" label="Encarregados" value={fd.kpis.encarregados_unicos} sub="turmas" color={C.purple} />
          <KPI icon="&#128200;" label="Media/Dia" value={fmtK(fd.kpis.total_valor / Math.max(fd.daily.length, 1))} sub="valor produzido" color={C.cyan} />
        </div>
        {tab === 'Geral' && (<>
          <Box style={{ marginBottom: 20 }}>
            <Sec>Producao Diaria vs Acumulada</Sec>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={dailyChart} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="bg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.accent} stopOpacity={0.9} /><stop offset="100%" stopColor={C.accent} stopOpacity={0.3} /></linearGradient>
                  <linearGradient id="ag1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.cyan} stopOpacity={0.15} /><stop offset="100%" stopColor={C.cyan} stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" tick={{ fill: C.textDim, fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
                <YAxis yAxisId="l" tick={{ fill: C.textDim, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={function(v) { return (v / 1000).toFixed(0) + 'k'; }} />
                <YAxis yAxisId="r" orientation="right" tick={{ fill: C.textDim, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={function(v) { return (v / 1000).toFixed(0) + 'k'; }} />
                <Tooltip content={<Tip />} />
                <Bar yAxisId="l" dataKey="valor" name="Valor Diario" fill="url(#bg1)" radius={[4, 4, 0, 0]} />
                <Area yAxisId="r" type="monotone" dataKey="acumulado" name="Acumulado" stroke={C.cyan} fill="url(#ag1)" strokeWidth={2.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </Box>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <Box>
              <Sec>Producao Semanal</Sec>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={fd.weekly.map(function(w) { return { ...w, label: shortDate(w.semana) }; })} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="label" tick={{ fill: C.textDim, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: C.textDim, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={function(v) { return (v / 1000).toFixed(0) + 'k'; }} />
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
        {tab === 'Turmas' && (<>
          <Box style={{ marginBottom: 20 }}>
            <Sec>Ranking de Encarregados - Valor Produzido</Sec>
            <ResponsiveContainer width="100%" height={380}>
              <BarChart data={encChart} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" tick={{ fill: C.textDim, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={function(v) { return (v / 1000).toFixed(0) + 'k'; }} />
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
                {fd.encarregados.filter(function(e) { return e.total >= 5; }).sort(function(a, b) { return b.taxa - a.taxa; }).map(function(e, i) { return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, padding: '6px 0' }}>
                    <div style={{ width: 130, fontSize: 11, color: C.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shortName(e.nome)}</div>
                    <div style={{ flex: 1, height: 20, background: '#1e293b', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ width: e.taxa + '%', height: '100%', borderRadius: 10, background: e.taxa >= 60 ? 'linear-gradient(90deg, ' + C.green + ', #34d399)' : e.taxa >= 40 ? 'linear-gradient(90deg, ' + C.orange + ', #fbbf24)' : 'linear-gradient(90deg, ' + C.red + ', #f87171)' }} />
                    </div>
                    <div style={{ width: 45, textAlign: 'right', fontSize: 12, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: e.taxa >= 60 ? C.green : e.taxa >= 40 ? C.orange : C.red }}>{e.taxa}%</div>
                  </div>
                ); })}
              </div>
            </Box>
            <Box>
              <Sec>Distribuicao por Tipo de Turma</Sec>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={fd.tipos_turma} dataKey="count" nameKey="tipo" cx="50%" cy="50%" innerRadius={65} outerRadius={110} paddingAngle={3} strokeWidth={0}>
                    {fd.tipos_turma.map(function(_, i) { return <Cell key={i} fill={PIE_C[i % PIE_C.length]} />; })}
                  </Pie>
                  <Tooltip formatter={function(v, name) { return [v + ' registros', name]; }} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, fontSize: 12 }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: C.textMuted }} />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </div>
          <Box>
            <Sec>Detalhamento por Encarregado</Sec>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr style={{ borderBottom: '1px solid ' + C.cardBorder }}>
                  {['Encarregado', 'Valor Total', 'Media/Serv', 'Prod', 'Improd', 'Total', 'Taxa'].map(function(h) { return (<th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: C.textDim, fontWeight: 600, fontSize: 11 }}>{h}</th>); })}
                </tr></thead>
                <tbody>
                  {fd.encarregados.map(function(e, i) { return (
                    <tr key={i} style={{ borderBottom: '1px solid ' + C.cardBorder + '15' }}>
                      <td style={{ padding: '8px 12px', color: C.text, fontWeight: 500 }}>{e.nome}</td>
                      <td style={{ padding: '8px 12px', fontFamily: "'JetBrains Mono', monospace", color: C.green }}>{fmt(e.valor)}</td>
                      <td style={{ padding: '8px 12px', fontFamily: "'JetBrains Mono', monospace", color: C.textMuted }}>{fmt(e.media)}</td>
                      <td style={{ padding: '8px 12px', color: C.green }}>{e.sim}</td>
                      <td style={{ padding: '8px 12px', color: C.red }}>{e.nao}</td>
                      <td style={{ padding: '8px 12px', color: C.textMuted }}>{e.total}</td>
                      <td style={{ padding: '8px 12px' }}><span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", background: e.taxa >= 60 ? '#10b98120' : e.taxa >= 40 ? '#f59e0b20' : '#ef444420', color: e.taxa >= 60 ? C.green : e.taxa >= 40 ? C.orange : C.red }}>{e.taxa}%</span></td>
                    </tr>
                  ); })}
                </tbody>
              </table>
            </div>
          </Box>
        </>)}
        {tab === 'Improdutividade' && (<>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <Box>
              <Sec>Motivos Macro - Improdutividade</Sec>
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie data={topMot} dataKey="count" nameKey="motivo" cx="50%" cy="50%" innerRadius={70} outerRadius={120} paddingAngle={3} strokeWidth={0}>
                    {topMot.map(function(_, i) { return <Cell key={i} fill={PIE_C[i % PIE_C.length]} />; })}
                  </Pie>
                  <Tooltip formatter={function(v, name) { return [v + ' (' + ((v / totMot) * 100).toFixed(1) + '%)', name]; }} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 8 }}>
                {topMot.map(function(m, i) { return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.textMuted }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: PIE_C[i] }} />
                    {m.motivo} ({m.count})
                  </div>
                ); })}
              </div>
            </Box>
            <Box>
              <Sec>Ranking de Motivos</Sec>
              <div style={{ marginTop: 8 }}>
                {fd.motivos.map(function(m, i) {
                  var pct = fd.kpis.total_nao > 0 ? (m.count / fd.kpis.total_nao) * 100 : 0;
                  return (
                    <div key={i} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 11, color: C.textMuted }}>{m.motivo}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: C.text }}>{m.count} <span style={{ color: C.textDim }}>({pct.toFixed(1)}%)</span></span>
                      </div>
                      <div style={{ height: 8, background: '#1e293b', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: pct + '%', height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, ' + PIE_C[i % PIE_C.length] + ', ' + PIE_C[i % PIE_C.length] + 'aa)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Box>
          </div>
          <Box>
            <Sec>Tendencia % Improdutividade Diaria</Sec>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={improdChart} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="ig1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.red} stopOpacity={0.25} /><stop offset="100%" stopColor={C.red} stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" tick={{ fill: C.textDim, fontSize: 10 }} axisLine={false} tickLine={false} interval={3} />
                <YAxis tick={{ fill: C.textDim, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={function(v) { return v + '%'; }} domain={[0, 100]} />
                <Tooltip formatter={function(v) { return [v + '%']; }} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, fontSize: 12 }} />
                <Area type="monotone" dataKey="pct_improd" name="% Improdutivo" stroke={C.red} fill="url(#ig1)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="pct_improd" stroke={C.red} strokeWidth={2.5} dot={{ r: 3, fill: C.red }} activeDot={{ r: 5 }} name="% Improdutivo" />
              </ComposedChart>
            </ResponsiveContainer>
          </Box>
        </>)}

        <div style={{ marginTop: 28, padding: '16px 0', borderTop: '1px solid ' + C.cardBorder, textAlign: 'center', color: C.textDim, fontSize: 11 }}>
          Dashboard Operacao Piaui - Contrato LPT &middot; Dados ao vivo do Google Sheets &middot; Auto-refresh a cada 5 min
        </div>
      </div>
    </div>
  );
}
