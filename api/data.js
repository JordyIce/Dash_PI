export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');

  var SHEET_ID = '15ng_u54tlEbOeMda59QQX3KEMCrYxqudXJqyYvFhGGE';
  var GID = '1423777639';
  var url = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/export?format=csv&gid=' + GID;

  try {
    var response = await fetch(url);
    if (!response.ok) throw new Error('Sheet fetch failed: ' + response.status);
    var csv = await response.text();

    var lines = [];
    var current = '';
    var inQuotes = false;
    for (var i = 0; i < csv.length; i++) {
      var ch = csv[i];
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === '\n' && !inQuotes) { lines.push(current); current = ''; }
      else { current += ch; }
    }
    if (current) lines.push(current);

    function parseLine(line) {
      var fields = [];
      var field = '';
      var inQ = false;
      for (var j = 0; j < line.length; j++) {
        var c = line[j];
        if (c === '"') { inQ = !inQ; }
        else if (c === ',' && !inQ) { fields.push(field.trim()); field = ''; }
        else { field += c; }
      }
      fields.push(field.trim());
      return fields;
    }

    var headerLine = lines.length > 1 ? lines[1] : lines[0];
    var dataStartIdx = lines.length > 1 ? 2 : 1;

    var rawHeader = parseLine(headerLine);
    var header = rawHeader.map(function(h) {
      return h.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
    });

    var rows = [];
    for (var k = dataStartIdx; k < lines.length; k++) {
      if (!lines[k].trim()) continue;
      var fields = parseLine(lines[k]);
      var row = {};
      header.forEach(function(h, idx) { row[h] = fields[idx] || ''; });
      rows.push(row);
    }

    function parseDate(d) {
      if (!d) return null;
      var m = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (m) {
        var day = parseInt(m[1]), mon = parseInt(m[2]);
        if (day > 12) return m[3] + '-' + String(mon).padStart(2, '0') + '-' + String(day).padStart(2, '0');
        if (mon > 12) return m[3] + '-' + String(day).padStart(2, '0') + '-' + String(mon).padStart(2, '0');
        return m[3] + '-' + String(mon).padStart(2, '0') + '-' + String(day).padStart(2, '0');
      }
      m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) return d;
      return null;
    }

    function parseVal(v) {
      if (!v) return 0;
      var clean = v.replace(/R\$\s*/g, '').replace(/\./g, '').replace(',', '.').trim();
      var n = parseFloat(clean);
      return isNaN(n) ? 0 : n;
    }

    function getField(row, names) {
      for (var i = 0; i < names.length; i++) {
        if (row[names[i]] !== undefined && row[names[i]] !== '') return row[names[i]];
      }
      return '';
    }

    function findCol(names) {
      for (var i = 0; i < names.length; i++) {
        if (header.indexOf(names[i]) !== -1) return names[i];
      }
      return null;
    }

    var motivoCol = findCol(['motivo_improd', 'motivo_improdutividade', 'motivo', 'motivos']);
    var motPartial = null;
    if (!motivoCol) {
      for (var hi = 0; hi < header.length; hi++) {
        if (header[hi].indexOf('motivo') !== -1 || header[hi].indexOf('improd') !== -1) {
          motPartial = header[hi];
          break;
        }
      }
    }

    var records = rows.map(function(r) {
      var enc = getField(r, ['encarregado', 'encarregados', 'enc']);
      var tt = getField(r, ['tipo_turma', 'tipo_de_turma', 'ipo_de_turma', 'tipo']);
      var dt = getField(r, ['data', 'datas']);
      var vl = getField(r, ['valor', 'valores']);

      var mt = '';
      if (motivoCol) { mt = r[motivoCol] || ''; }
      else if (motPartial) { mt = r[motPartial] || ''; }

      var valor = parseVal(vl);
      var produziu = valor > 0 ? 'SIM' : 'NAO';

      return {
        e: enc.trim().toUpperCase(),
        tt: tt.trim().toUpperCase(),
        d: parseDate(dt),
        v: valor,
        p: produziu,
        m: mt.trim().toUpperCase(),
      };
    }).filter(function(r) { return r.d && r.e; });

    res.status(200).json({ records: records, updated: new Date().toISOString(), total: records.length, columns: header });
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: err.message });
  }
}
