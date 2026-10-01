/* DOCX del documento final a partir de `buildModel`: WordprocessingML, paquete ZIP y nombres
   de archivo. Sin dependencias; se incrusta en el HTML antes del runtime y lo prueban en Node. */
(function (root) {
  'use strict';
  const PAGE_WIDTH = 9638; // A4 (11906) menos márgenes de 1134 a cada lado, en twips.
  const BORDERS = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
    .map(side => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="999999"/>`).join('');

  const xml = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  const paragraphXml = (value, style = '') => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}<w:r><w:t xml:space="preserve">${xml(value)}</w:t></w:r></w:p>`;

  function tableXml(table) {
    const width = Math.floor(PAGE_WIDTH / table.headers.length);
    const cell = (text, header) => `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/></w:tcPr><w:p><w:r>${header ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p></w:tc>`;
    const head = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${table.headers.map(text => cell(text, true)).join('')}</w:tr>`;
    const body = table.rows.map(row => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${row.map(text => cell(text, false)).join('')}</w:tr>`).join('');
    const grid = table.headers.map(() => `<w:gridCol w:w="${width}"/>`).join('');
    return `<w:tbl><w:tblPr><w:tblW w:w="${PAGE_WIDTH}" w:type="dxa"/><w:tblBorders>${BORDERS}</w:tblBorders></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${head}${body}</w:tbl><w:p/>`;
  }

  // Viñeta «•» con sangría francesa: evita añadir numbering.xml al paquete.
  const listXml = items => items.map(text => `<w:p><w:pPr><w:ind w:left="360" w:hanging="240"/></w:pPr><w:r><w:t xml:space="preserve">${xml(`• ${text}`)}</w:t></w:r></w:p>`).join('');

  function itemXml(item) {
    if (typeof item === 'string') return paragraphXml(item);
    if (item.table) return tableXml(item.table);
    return listXml(item.list);
  }

  function docxXml(output) {
    const parts = [paragraphXml(output.title, 'Title')];
    if (output.subtitle) parts.push(paragraphXml(output.subtitle, 'Subtitle'));
    for (const section of output.sections) {
      parts.push(paragraphXml(section.heading, 'Heading1'));
      for (const item of section.paragraphs) parts.push(itemXml(item));
    }
    if (output.sources.length) {
      parts.push(paragraphXml('Fuentes', 'Heading1'));
      for (const source of output.sources) parts.push(paragraphXml(`${source.title}: ${source.url}`));
    }
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${parts.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`;
  }

  // ZIP sin compresión (método 0), con CRC-32 y fecha cero: el mismo formato de siempre,
  // para que un DOCX individual conserve sus bytes. Las entradas son [nombre, texto | bytes].
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  const crc32 = bytes => {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  };
  function zipStore(entries) {
    const encoder = new TextEncoder();
    const chunks = [];
    const directory = [];
    let offset = 0;
    const header = (size, signature) => { const bytes = new Uint8Array(size); new DataView(bytes.buffer).setUint32(0, signature, true); return bytes; };
    for (const [name, content] of entries) {
      const nameBytes = encoder.encode(name);
      const data = typeof content === 'string' ? encoder.encode(content) : content;
      const crc = crc32(data);
      const local = header(30, 0x04034b50);
      const lv = new DataView(local.buffer);
      lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true); lv.setUint32(14, crc, true);
      lv.setUint32(18, data.length, true); lv.setUint32(22, data.length, true); lv.setUint16(26, nameBytes.length, true);
      chunks.push(local, nameBytes, data);
      const central = header(46, 0x02014b50);
      const cv = new DataView(central.buffer);
      cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true);
      cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true);
      cv.setUint16(28, nameBytes.length, true); cv.setUint32(42, offset, true);
      directory.push(central, nameBytes);
      offset += local.length + nameBytes.length + data.length;
    }
    const directorySize = directory.reduce((sum, part) => sum + part.length, 0);
    const end = header(22, 0x06054b50);
    const ev = new DataView(end.buffer);
    ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true);
    ev.setUint32(12, directorySize, true); ev.setUint32(16, offset, true);
    const parts = [...chunks, ...directory, end];
    const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
    let at = 0;
    for (const part of parts) { out.set(part, at); at += part.length; }
    return out;
  }

  function docxPackage(output) {
  const contentTypes = '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>';
  const relationships = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
  const docRels = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
  const styles = '<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:pPr><w:spacing w:after="320"/></w:pPr><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:pPr><w:spacing w:after="280"/></w:pPr><w:rPr><w:color w:val="555555"/><w:sz w:val="24"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style></w:styles>';
    return zipStore([['[Content_Types].xml', contentTypes], ['_rels/.rels', relationships], ['word/document.xml', docxXml(output)], ['word/styles.xml', styles], ['word/_rels/document.xml.rels', docRels]]);
  }

  // Nombre de archivo seguro y único dentro de un lote; `used` acumula los ya asignados.
  function safeFilename(name, used) {
    const base = String(name).replace(/[\/\\:*?"<>|\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80).trim() || 'documento';
    let candidate = base;
    for (let n = 2; used.has(candidate.toLowerCase()); n++) candidate = `${base} (${n})`;
    used.add(candidate.toLowerCase());
    return candidate;
  }

  root.DocExport = { xml, paragraphXml, tableXml, listXml, docxXml, zipStore, docxPackage, safeFilename };
})(globalThis);
