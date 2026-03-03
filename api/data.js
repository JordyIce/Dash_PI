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

    // Find motivo column - prefer exact matches first
    var motivoCol = findCol(['motivo_improd', 'motivo_improdutividade', 'motivo_da_improdutividade']);
    var motPartial = null;
    if (!motivoCol) {
      // Look for column containing BOTH motivo and improd
      for (var hi = 0; hi < header.length; hi++) {
        if (header[hi].indexOf('motivo') !== -1 && header[hi].indexOf('improd') !== -1) {
          motPartial = header[hi];
          break;
        }
      }
    }
    if (!motivoCol && !motPartial) {
      // Fallback: any column with motivo
      for (var hi2 = 0; hi2 < header.length; hi2++) {
        if (header[hi2].indexOf('motivo') !== -1) {
          motPartial = header[hi2];
          break;
        }
      }
    }

    // Sanitize motivo values - filter out data that leaked from other columns
    function isValidMotivo(val) {
      if (!val) return false;
      var v = val.trim();
      if (v === '') return false;
      var upper = v.toUpperCase();
      // Filter out SIM/NAO (from PRODUZIU column)
      if (upper === 'NAO' || upper === 'SIM' || upper === 'N' || upper === 'S') return false;
      // Filter out pure numbers (from VALOR or other numeric columns)
      if (/^[\d.,]+$/.test(v)) return false;
      // Filter out currency values
      if (/^R\$/i.test(v)) return false;
      // Filter out dates
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v)) return false;
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
      // Filter out short numbers (1-3 digits only)
      if (/^\d{1,3}$/.test(v)) return false;
      // Valid motivo
      return true;
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

      // Clean motivo - only keep valid reason strings
      var cleanMotivo = isValidMotivo(mt) ? mt.trim().toUpperCase() : '';

      return {
        e: enc.trim().toUpperCase(),
        tt: tt.trim().toUpperCase(),
        d: parseDate(dt),
        v: valor,
        p: produziu,
        m: cleanMotivo,
      };
    }).filter(function(r) { return r.d && r.e; });

    res.status(200).json({
      records: records,
      updated: new Date().toISOString(),
      total: records.length,
      columns: header,
      rawColumns: rawHeader,
      motivoColUsed: motivoCol || motPartial || 'none'
    });
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: err.message });
  }
}
