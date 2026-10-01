/* WordprocessingML del documento final a partir de `buildModel`. Sin dependencias; se
   incrusta en el HTML (antes del runtime, que empaqueta el DOCX) y lo prueban en Node. */
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

  root.DocExport = { xml, paragraphXml, tableXml, listXml, docxXml };
})(globalThis);
