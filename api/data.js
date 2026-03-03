export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');

  const SHEET_ID = '15ng_u54tlEbOeMda59QQX3KEMCrYxqudXJqyYvFhGGE';
  const GID = '1423777639';
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Sheet fetch failed: ${response.status}`);
    const csv = await response.text();

    const lines = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < csv.length; i++) {
      const ch = csv[i];
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === '\n' && !inQuotes) { lines.push(current); current = ''; }
      else { current += ch; }
    }
    if (current) lines.push(current);

    function parseLine(line) {
      const fields = [];
      let field = '';
      let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') { inQ = !inQ; }
        else if (c === ',' && !inQ) { fields.push(field.trim()); field = ''; }
        else { field += c; }
      }
      fields.push(field.trim());
      return fields;
    }

    const header = parseLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'));

    const rows = [];
    for (let k = 1; k < lines.length; k++) {
      if (!lines[k].trim()) continue;
      const fields = parseLine(lines[k]);
      const row = {};
      header.forEach((h, idx) => { row[h] = fields[idx] || ''; });
      rows.push(row);
    }

    function parseDate(d) {
      if (!d) return null;
      let m = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (m) {
        const day = parseInt(m[1]), mon = parseInt(m[2]);
        if (day > 12) return `${m[3]}-${String(mon).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        if (mon > 12) return `${m[3]}-${String(day).padStart(2,'0')}-${String(mon).padStart(2,'0')}`;
        return `${m[3]}-${String(mon).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      }
      m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) return d;
      return null;
    }

    function parseVal(v) {
      if (!v) return 0;
      const clean = v.replace(/R\$\s*/g, '').replace(/\./g, '').replace(',', '.').trim();
      const n = parseFloat(clean);
      return isNaN(n) ? 0 : n;
    }

    const records = rows.map(r => ({
      e: (r.encarregado || '').trim().toUpperCase(),
      tt: (r.tipo_turma || '').trim().toUpperCase(),
      d: parseDate(r.data),
      v: parseVal(r.valor),
      p: (r.produziu || '').trim().toUpperCase() === 'SIM' ? 'SIM' : 'NAO',
      m: (r.motivo_improd || '').trim().toUpperCase(),
    })).filter(r => r.d && r.e);

    res.status(200).json({ records, updated: new Date().toISOString() });
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: err.message });
  }
}
