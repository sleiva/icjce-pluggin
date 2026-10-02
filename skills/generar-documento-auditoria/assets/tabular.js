/* Lectura del listado de un lote: celdas pegadas desde Excel, CSV (UTF-8 o Windows-1252) y
   .xlsx (primera hoja), y emparejamiento con los campos `batch` de la plantilla. Sin
   dependencias; se incrusta en el HTML y lo prueban en Node. Usa DocEvaluator (evaluator.js)
   y DocNumbers (numbers.js). */
(function (root) {
  'use strict';
  const LIMITS = { fileBytes: 5 * 1024 * 1024, unzippedBytes: 20 * 1024 * 1024, rows: 500, columns: 50 };
  const MAX_COLUMN_INDEX = 16384;
  const fail = message => { throw new Error(message); };

  // --- Texto delimitado -------------------------------------------------------

  function detectSeparator(text) {
    const first = text.split(/\r\n|\n|\r/).find(line => line.trim()) || '';
    if (first.includes('\t')) return '\t';
    let inQuotes = false;
    let semicolons = 0;
    let commas = 0;
    for (const char of first) {
      if (char === '"') inQuotes = !inQuotes;
      else if (!inQuotes && char === ';') semicolons++;
      else if (!inQuotes && char === ',') commas++;
    }
    return semicolons >= commas && semicolons > 0 ? ';' : (commas > 0 ? ',' : ';');
  }

  function parseDelimited(text) {
    const separator = detectSeparator(text);
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (inQuotes) {
        if (char === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (char === '"') inQuotes = false;
        else cell += char;
      } else if (char === '"' && !cell.trim()) { cell = ''; inQuotes = true; }
      else if (char === separator) { row.push(cell); cell = ''; }
      else if (char === '\n' || char === '\r') {
        if (char === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += char;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.map(cells => cells.map(value => value.trim())).filter(cells => cells.some(value => value));
  }

  function decodeText(bytes) {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
    if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
    let data = bytes;
    if (data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf) data = data.subarray(3);
    try { return new TextDecoder('utf-8', { fatal: true }).decode(data); }
    catch { return new TextDecoder('windows-1252').decode(data); }
  }

  // --- ZIP y .xlsx ------------------------------------------------------------

  async function inflate(data, limit) {
    const reader = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
    const chunks = [];
    let length = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) { await reader.cancel(); fail('El archivo descomprimido supera el máximo de 20 MB'); }
      chunks.push(value);
    }
    const out = new Uint8Array(length);
    let at = 0;
    for (const chunk of chunks) { out.set(chunk, at); at += chunk.length; }
    return out;
  }

  async function readZip(bytes) {
    try { return await parseZip(bytes); } catch (error) { return guard(error); }
  }

  async function parseZip(bytes) {
    if (bytes.length > LIMITS.fileBytes) fail('El archivo supera el máximo de 5 MB');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let end = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
      if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
    }
    if (end < 0) fail('El archivo no es un .xlsx válido');
    const count = view.getUint16(end + 10, true);
    let at = view.getUint32(end + 16, true);
    const files = new Map();
    let total = 0;
    for (let k = 0; k < count; k++) {
      if (view.getUint32(at, true) !== 0x02014b50) fail('El archivo no es un .xlsx válido');
      const method = view.getUint16(at + 10, true);
      const compressed = view.getUint32(at + 20, true);
      const size = view.getUint32(at + 24, true);
      const nameLength = view.getUint16(at + 28, true);
      const extraLength = view.getUint16(at + 30, true);
      const commentLength = view.getUint16(at + 32, true);
      const local = view.getUint32(at + 42, true);
      const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength));
      at += 46 + nameLength + extraLength + commentLength;
      if (total + size > LIMITS.unzippedBytes) fail('El archivo descomprimido supera el máximo de 20 MB');
      const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
      const data = bytes.subarray(start, start + compressed);
      if (method === 0) {
        if (total + data.length > LIMITS.unzippedBytes) fail('El archivo descomprimido supera el máximo de 20 MB');
        total += data.length;
        files.set(name, data);
      } else if (method === 8) {
        const out = await inflate(data, LIMITS.unzippedBytes - total);
        total += out.length;
        files.set(name, out);
      } else fail('El .xlsx usa una compresión no admitida');
    }
    return files;
  }

  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  const unescape = text => text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, code) => {
    if (code[0] !== '#') return entities[code.toLowerCase()];
    return String.fromCodePoint(code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10));
  });
  const textOf = xml => [...xml.matchAll(/<t\b[^<>]*?>((?:(?!<t\b)[\s\S])*?)<\/t>/g)].map(m => unescape(m[1])).join('');
  const attr = (tag, name) => { const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`)); return m ? unescape(m[1]) : null; };
  const columnIndex = ref => [...ref.replace(/\d+$/, '')].reduce((n, char) => n * 26 + char.charCodeAt(0) - 64, 0) - 1;

  const INVALID = 'El archivo no es un .xlsx válido';
  const KNOWN = /^El archivo (supera|descomprimido|no es un \.xlsx)|^El \.xlsx usa|^No se encuentra|^El listado/;
  // Cualquier fallo inesperado al leer el archivo se presenta como archivo no válido.
  const guard = error => { throw error instanceof Error && KNOWN.test(error.message) ? error : new Error(INVALID); };

  async function readXlsx(bytes) {
    try { return await parseXlsx(bytes); } catch (error) { return guard(error); }
  }

  async function parseXlsx(bytes) {
    const files = await readZip(bytes);
    const read = name => (files.has(name) ? new TextDecoder().decode(files.get(name)) : null);
    const workbook = read('xl/workbook.xml');
    if (!workbook) fail('El archivo no es un .xlsx válido');
    const sheet = workbook.match(/<sheet\s[^>]*>/);
    const relId = sheet && (attr(sheet[0], 'r:id') || attr(sheet[0], 'id'));
    const rels = read('xl/_rels/workbook.xml.rels') || '';
    const rel = [...rels.matchAll(/<Relationship\s[^>]*>/g)].map(m => m[0]).find(tag => attr(tag, 'Id') === relId);
    const target = rel ? attr(rel, 'Target') : 'worksheets/sheet1.xml';
    const sheetXml = read(target.startsWith('/') ? target.slice(1) : `xl/${target}`);
    if (!sheetXml) fail('No se encuentra la primera hoja del .xlsx');
    const shared = [...(read('xl/sharedStrings.xml') || '').matchAll(/<si\b[^<>]*?>((?:(?!<si\b)[\s\S])*?)<\/si>/g)].map(m => textOf(m[1]));
    const rows = [];
    for (const rowMatch of sheetXml.matchAll(/<row\b[^<>]*?(?:\/>|>((?:(?!<row\b)[\s\S])*?)<\/row>)/g)) {
      const cells = [];
      for (const cell of (rowMatch[1] || '').matchAll(/<c\b([^<>]*?)(?:\/>|>((?:(?!<c\b)[\s\S])*?)<\/c>)/g)) {
        const tag = `<c${cell[1]}>`;
        const body = cell[2] || '';
        const ref = attr(tag, 'r');
        const index = ref ? columnIndex(ref) : cells.length;
        if (index >= MAX_COLUMN_INDEX) continue;
        const type = attr(tag, 't');
        const raw = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
        let value = '';
        if (type === 's') value = shared[Number(raw)] ?? '';
        else if (type === 'inlineStr') value = textOf(body);
        else if (type === 'str') value = raw === undefined ? '' : unescape(raw);
        else if (type === 'b') value = raw === '1' ? 'VERDADERO' : 'FALSO';
        else if (raw !== undefined && raw !== '') value = { number: unescape(raw) };
        while (cells.length < index) cells.push('');
        cells[index] = typeof value === 'string' ? value.trim() : value;
      }
      if (cells.some(value => (typeof value === 'string' ? value : value.number))) rows.push(cells);
      if (rows.length > LIMITS.rows + 1) fail(`El listado no puede tener más de ${LIMITS.rows} destinatarios`);
    }
    return rows;
  }

  // --- Emparejamiento con la plantilla ------------------------------------------

  const normalize = text => String(text).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/[\s-]+/g, '_');
  const cellText = cell => (cell && typeof cell === 'object' ? cell.number : (cell || ''));

  function excelDate(serial) {
    const n = Number(serial);
    if (!(n >= 1 && n <= 2958465)) return null;
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(Number(serial) * 86400000));
    const text = date.toISOString().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
  }

  function toDate(cell) {
    if (cell && typeof cell === 'object') return Number.isFinite(Number(cell.number)) ? excelDate(cell.number) : null;
    const text = cell.trim();
    let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return valid(+m[1], +m[2], +m[3]);
    m = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (m) return valid(+m[3], +m[2], +m[1]);
    return null;
  }

  function valid(year, month, day) {
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return date.toISOString().slice(0, 10);
  }

  function mapRows(spec, table, common = {}) {
    const fields = spec.batch.fields.map(id => spec.fields.find(field => field.id === id));
    const [headers = [], ...data] = table;
    const columns = {};
    const ignored = [];
    const errors = [];
    headers.forEach((header, index) => {
      const key = normalize(cellText(header));
      if (!key) return;
      const field = fields.find(item => normalize(item.id) === key || normalize(item.label) === key);
      if (!field) { ignored.push(cellText(header)); return; }
      if (columns[field.id] !== undefined) errors.push(`Las columnas «${cellText(headers[columns[field.id]])}» y «${cellText(header)}» corresponden al mismo campo (${field.label})`);
      else columns[field.id] = index;
    });
    // Un obligatorio con `when` puede no aplicar a ninguna fila: se comprueba fila a fila.
    for (const field of fields) if (field.required && !field.when && columns[field.id] === undefined) errors.push(`Falta la columna obligatoria «${field.label}»`);
    if (!data.length) errors.push('El listado no tiene filas de destinatarios');
    if (data.length > LIMITS.rows) errors.push(`El listado no puede tener más de ${LIMITS.rows} destinatarios`);
    if (headers.filter(header => normalize(cellText(header))).length > LIMITS.columns) errors.push(`El listado no puede tener más de ${LIMITS.columns} columnas`);
    const rows = data.slice(0, LIMITS.rows).map((cells, k) => {
      const line = k + 2;
      const values = {};
      const rowErrors = [];
      for (const field of fields) {
        if (columns[field.id] === undefined) continue;
        const cell = cells[columns[field.id]] ?? '';
        const text = cellText(cell).trim();
        if (!text) { values[field.id] = ''; continue; }
        if (field.type === 'select') {
          const option = field.options.find(item => normalize(item) === normalize(text));
          if (option) values[field.id] = option;
          else { values[field.id] = text; rowErrors.push(`Fila ${line}: "${text}" no es una opción de ${field.label}`); }
        } else if (field.type === 'date') {
          const date = toDate(cell);
          if (date) values[field.id] = date;
          else { values[field.id] = text; rowErrors.push(`Fila ${line}: "${text}" no es una fecha válida para ${field.label}`); }
        } else if (field.type === 'number') {
          // Un número de Excel se guarda sin ambigüedad («1,234» es 1,234 y no 1.234).
          values[field.id] = typeof cell === 'object' ? root.DocNumbers.plainNumber(cell.number) : text;
          if (Number.isNaN(root.DocNumbers.parseNumber(values[field.id]))) rowErrors.push(`Fila ${line}: "${text}" no es un número válido para ${field.label}`);
        } else values[field.id] = typeof cell === 'object' ? root.DocNumbers.plainNumber(cell.number) : text;
      }
      const { visible } = root.DocEvaluator.effectiveData(spec, { ...common, ...values });
      for (const field of fields) {
        if (field.required && visible[field.id] && !String(values[field.id] || '').trim()) rowErrors.push(`Fila ${line}: falta ${field.label}`);
      }
      return { values, errors: rowErrors };
    });
    return { columns, ignored, errors, rows };
  }

  root.DocTabular = { LIMITS, parseDelimited, decodeText, readZip, readXlsx, mapRows };
})(globalThis);
