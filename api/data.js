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

    // Parser CSV passo unico - trata aspas, virgulas e quebras de linha internas
    function parseCSV(text) {
      var rows = [];
      var row = [];
      var field = '';
      var inQuotes = false;
      var i = 0;
      while (i < text.length) {
        var ch = text[i];
        if (inQuotes) {
          if (ch === '"') {
            if (i + 1 < text.length && text[i + 1] === '"') {
              field += '"';
              i += 2;
              continue;
            }
            inQuotes = false;
            i++;
            continue;
          }
          field += ch;
          i++;
          continue;
        }
        if (ch === '"') { inQuotes = true; i++; continue; }
        if (ch === ',') { row.push(field.trim()); field = ''; i++; continue; }
        if (ch === '\r') { i++; continue; }
        if (ch === '\n') { row.push(field.trim()); rows.push(row); row = []; field = ''; i++; continue; }
        field += ch;
        i++;
      }
      if (field || row.length > 0) { row.push(field.trim()); rows.push(row); }
      return rows;
    }

    var allRows = parseCSV(csv);
    var headerRowIdx = allRows.length > 1 ? 1 : 0;
    var dataStartIdx = allRows.length > 1 ? 2 : 1;

    var rawHeader = allRows[headerRowIdx];
    var header = rawHeader.map(function(h) {
      return h.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
    });

    var rows = [];
    for (var k = dataStartIdx; k < allRows.length; k++) {
      var fields = allRows[k];
      if (!fields || fields.length === 0) continue;
      if (fields.join('').trim() === '') continue;
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

    var motivoCol = findCol(['motivo_improd', 'motivo_improdutividade', 'motivo_da_improdutividade', 'motivo_de_improdutividade']);
    var motPartial = null;
    if (!motivoCol) {
      for (var hi = 0; hi < header.length; hi++) {
        if (header[hi].indexOf('motivo') !== -1 && header[hi].indexOf('improd') !== -1) {
          motPartial = header[hi];
          break;
        }
      }
    }
    if (!motivoCol && !motPartial) {
      for (var hi2 = 0; hi2 < header.length; hi2++) {
        if (header[hi2].indexOf('motivo') !== -1) {
          motPartial = header[hi2];
          break;
        }
      }
    }

    function isValidMotivo(val) {
      if (!val) return false;
      var v = val.trim();
      if (v === '') return false;
      var upper = v.toUpperCase();
      if (upper === 'NAO' || upper === 'SIM' || upper === 'N' || upper === 'S') return false;
      if (/^[\d.,]+$/.test(v)) return false;
      if (/^R\$/i.test(v)) return false;
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v)) return false;
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
      if (/^\d{1,3}$/.test(v)) return false;
      return true;
    }

    var records = rows.map(function(r) {
      var enc = getField(r, ['encarregado', 'encarregados', 'enc']);
      var tt = getField(r, ['tipo_turma', 'tipo_de_turma', 'ipo_de_turma', 'tipo']);
      var dt = getField(r, ['data', 'datas']);
      var vl = getField(r, ['valor', 'valores']);
      var base = getField(r, ['centro_de_servico', 'centro_servico', 'base']);

      var mt = '';
      if (motivoCol) { mt = r[motivoCol] || ''; }
      else if (motPartial) { mt = r[motPartial] || ''; }

      var valor = parseVal(vl);
      var produziu = valor > 0 ? 'SIM' : 'NAO';
      var cleanMotivo = isValidMotivo(mt) ? mt.trim().toUpperCase() : '';

      return {
        e: enc.trim().toUpperCase(),
        tt: tt.trim().toUpperCase(),
        d: parseDate(dt),
        v: valor,
        p: produziu,
        m: cleanMotivo,
        b: base.trim().toUpperCase(),
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
