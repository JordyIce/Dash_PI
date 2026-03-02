// /api/data.js — Vercel Serverless Function
// Busca CSV direto do Google Sheets e retorna JSON processado
// A planilha precisa estar com compartilhamento "Qualquer pessoa com o link pode ver"

export default async function handler(req, res) {
  // Cache por 5 minutos (300s) — ajuste conforme necessidade
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const SHEET_ID = '15ng_u54tlEbOeMda59QQX3KEMCrYxqudXJqyYvFhGGE';
  const GID = '1423777639'; // gid da aba Pla1
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Google Sheets retornou status ${response.status}`);
    }
    const csv = await response.text();

    // Parse CSV
    const rows = parseCSV(csv);
    if (rows.length < 3) {
      return res.status(500).json({ error: 'Planilha vazia ou formato inesperado' });
    }

    // Row 0 = tipos (MANUAL/AUTOMATICO), Row 1 = headers, Row 2+ = dados
    const data = [];
    for (let i = 2; i < rows.length; i++) {
      const r = rows[i];
      if (!r[0] || r[0].trim() === '') continue;

      let valor = 0;
      if (r[8]) {
        const v = r[8].replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
        valor = parseFloat(v) || 0;
      }

      data.push({
        encarregado: (r[0] || '').trim(),
        supervisor: (r[1] || '-').trim(),
        tipo_turma: (r[2] || '').trim(),
        obra: (r[3] || '').trim(),
        cidade: (r[4] || '').trim(),
        data: parseDate(r[5]),
        serv_programado: (r[6] || '').trim(),
        serv_executado: (r[7] || '').trim(),
        valor,
        produziu: (r[9] || 'NÃO').trim().toUpperCase(),
        motivo_improd: (r[10] || '').trim(),
        coordenador: (r[11] || '').trim(),
        gerente: (r[12] || '').trim(),
      });
    }

    // Processar agregações
    const result = processData(data);
    return res.status(200).json(result);

  } catch (err) {
    console.error('Erro ao buscar planilha:', err);
    return res.status(500).json({ error: err.message });
  }
}

function parseDate(val) {
  if (!val) return null;
  val = val.trim();
  // Formato DD/MM/YYYY
  const match1 = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match1) {
    const [, d, m, y] = match1;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Formato YYYY-MM-DD
  const match2 = val.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match2) {
    const [, y, m, d] = match2;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Formato MM/DD/YYYY (Google Sheets US)
  const match3 = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match3) {
    return val; // já tentou acima
  }
  return null;
}

function parseCSV(text) {
  const rows = [];
  let current = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        current.push(cell);
        cell = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') i++;
        current.push(cell);
        cell = '';
        rows.push(current);
        current = [];
      } else {
        cell += ch;
      }
    }
  }
  if (cell || current.length > 0) {
    current.push(cell);
    rows.push(current);
  }
  return rows;
}

function processData(data) {
  const totalValor = data.reduce((s, r) => s + r.valor, 0);
  const totalSim = data.filter(r => r.produziu === 'SIM').length;
  const totalNao = data.filter(r => r.produziu !== 'SIM').length;
  const totalReg = data.length;
  const taxaProd = totalReg > 0 ? Math.round((totalSim / totalReg) * 1000) / 10 : 0;
  const encsSet = new Set(data.map(r => r.encarregado));

  const dates = data.map(r => r.data).filter(Boolean).sort();
  const dataInicio = dates[0] || '';
  const dataFim = dates[dates.length - 1] || '';

  // Daily
  const dailyMap = {};
  data.forEach(r => {
    if (!r.data) return;
    if (!dailyMap[r.data]) dailyMap[r.data] = { valor: 0, sim: 0, nao: 0, total: 0 };
    dailyMap[r.data].valor += r.valor;
    dailyMap[r.data].total++;
    if (r.produziu === 'SIM') dailyMap[r.data].sim++;
    else dailyMap[r.data].nao++;
  });
  const dailySorted = Object.entries(dailyMap).sort((a, b) => a[0].localeCompare(b[0]));
  let acum = 0;
  const daily = dailySorted.map(([d, v]) => {
    acum += v.valor;
    return { data: d, valor: Math.round(v.valor * 100) / 100, acumulado: Math.round(acum * 100) / 100, sim: v.sim, nao: v.nao, total: v.total };
  });

  // Motivos
  const motivosMap = {};
  data.filter(r => r.produziu !== 'SIM' && r.motivo_improd).forEach(r => {
    motivosMap[r.motivo_improd] = (motivosMap[r.motivo_improd] || 0) + 1;
  });
  const motivos = Object.entries(motivosMap)
    .map(([motivo, count]) => ({ motivo, count }))
    .sort((a, b) => b.count - a.count);

  // Encarregados
  const encMap = {};
  data.forEach(r => {
    if (!encMap[r.encarregado]) encMap[r.encarregado] = { valor: 0, sim: 0, nao: 0, total: 0 };
    encMap[r.encarregado].valor += r.valor;
    encMap[r.encarregado].total++;
    if (r.produziu === 'SIM') encMap[r.encarregado].sim++;
    else encMap[r.encarregado].nao++;
  });
  const encarregados = Object.entries(encMap)
    .map(([nome, v]) => ({
      nome,
      valor: Math.round(v.valor * 100) / 100,
      media: v.sim > 0 ? Math.round((v.valor / v.sim) * 100) / 100 : 0,
      sim: v.sim,
      nao: v.nao,
      total: v.total,
      taxa: v.total > 0 ? Math.round((v.sim / v.total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.valor - a.valor);

  // Tipos turma
  const tiposMap = {};
  data.forEach(r => {
    const t = r.tipo_turma || 'N/A';
    if (!tiposMap[t]) tiposMap[t] = { count: 0, valor: 0, sim: 0, nao: 0 };
    tiposMap[t].count++;
    tiposMap[t].valor += r.valor;
    if (r.produziu === 'SIM') tiposMap[t].sim++;
    else tiposMap[t].nao++;
  });
  const tipos_turma = Object.entries(tiposMap)
    .map(([tipo, v]) => ({ tipo, count: v.count }))
    .sort((a, b) => b.count - a.count);
  const turma_valor = Object.entries(tiposMap)
    .map(([tipo, v]) => ({ tipo, valor: Math.round(v.valor * 100) / 100, sim: v.sim, nao: v.nao }));

  // Weekly
  const weeklyMap = {};
  data.forEach(r => {
    if (!r.data) return;
    const dt = new Date(r.data + 'T12:00:00');
    const day = dt.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(dt);
    monday.setDate(dt.getDate() - diff);
    const wk = monday.toISOString().slice(0, 10);
    if (!weeklyMap[wk]) weeklyMap[wk] = { valor: 0, sim: 0, nao: 0 };
    weeklyMap[wk].valor += r.valor;
    if (r.produziu === 'SIM') weeklyMap[wk].sim++;
    else weeklyMap[wk].nao++;
  });
  const weekly = Object.entries(weeklyMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([semana, v]) => ({ semana, valor: Math.round(v.valor * 100) / 100, sim: v.sim, nao: v.nao }));

  // Coordenadores
  const coordMap = {};
  data.forEach(r => {
    const c = r.coordenador || 'N/A';
    if (!coordMap[c]) coordMap[c] = { valor: 0, sim: 0, nao: 0, total: 0 };
    coordMap[c].valor += r.valor;
    coordMap[c].total++;
    if (r.produziu === 'SIM') coordMap[c].sim++;
    else coordMap[c].nao++;
  });
  const coordenadores = Object.entries(coordMap)
    .map(([coord, v]) => ({ coord, valor: Math.round(v.valor * 100) / 100, sim: v.sim, nao: v.nao, total: v.total }));

  // Improd trend
  const improd_trend = dailySorted.map(([d, v]) => ({
    data: d,
    pct_improd: v.total > 0 ? Math.round((v.nao / v.total) * 1000) / 10 : 0,
    total: v.total,
    nao: v.nao,
  }));

  return {
    kpis: {
      total_valor: Math.round(totalValor * 100) / 100,
      total_registros: totalReg,
      total_sim: totalSim,
      total_nao: totalNao,
      taxa_produtividade: taxaProd,
      encarregados_unicos: encsSet.size,
      data_inicio: dataInicio,
      data_fim: dataFim,
    },
    daily,
    motivos,
    encarregados,
    tipos_turma,
    turma_valor,
    weekly,
    coordenadores,
    improd_trend,
    _updated: new Date().toISOString(),
  };
}
