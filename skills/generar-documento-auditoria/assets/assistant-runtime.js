(() => {
  'use strict';
  const { buildModel, effectiveData, filledRows, isEmpty, renderText } = globalThis.DocEvaluator;
  const { docxPackage, zipStore, safeFilename } = globalThis.DocExport;
  const { LIMITS, parseDelimited, decodeText, readXlsx, mapRows } = globalThis.DocTabular;
  const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const byId = id => document.getElementById(id);
  const form = byId('data-form');
  const wrappers = {};
  let finalDocument = null;
  // Modo lote: listado leído (con encabezados), documentos generados y destinatario visible.
  let mode = 'single';
  let batchTable = null;
  let batchLoadError = '';
  let finalDocuments = null;
  let selected = 0;
  const batchFields = new Set(spec.batch ? spec.batch.fields : []);
  const inBatch = () => mode === 'batch';
  const batchState = () => (inBatch() && batchTable ? mapRows(spec, batchTable, commonData()) : null);
  const currentFinal = () => (finalDocuments ? finalDocuments[selected].output : finalDocument);
  const filenames = (state, common) => {
    const used = new Set();
    return state.rows.map(row => safeFilename(renderText(spec, { ...common, ...row.values }, spec.batch.filename), used));
  };
  const slug = title => title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'documento';
  const download = (bytes, name, type) => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([bytes], { type }));
    link.download = name;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 30000);
  };

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const collect = () => {
    const data = {};
    for (const field of spec.fields) {
      if (field.type === 'checkbox') data[field.id] = byId(`field-${field.id}`).checked;
      else if (field.type === 'multiselect') data[field.id] = [...form.querySelectorAll(`input[name="${field.id}"]:checked`)].map(input => input.value);
      else if (field.type === 'group') data[field.id] = groupRows(field).map(card => Object.fromEntries(field.fields.map(sub => [sub.id, card.querySelector(`[data-sub="${sub.id}"]`).value])));
      else data[field.id] = byId(`field-${field.id}`).value;
    }
    return data;
  };
  // En modo lote, los campos del lote solo vienen del listado: se vacían en los datos comunes.
  const commonData = () => {
    const data = collect();
    if (inBatch()) for (const id of batchFields) data[id] = '';
    return data;
  };
  const model = (data, markMissing = false) => buildModel(spec, data, { markMissing });
  const groupRows = field => [...wrappers[field.id].querySelectorAll(':scope > .group-rows > .group-row')];
  // Campos que cuentan para el progreso y primer elemento al que llevar el foco.
  const requirement = data => {
    const { data: effective, visible } = effectiveData(spec, data);
    const required = [];
    const missing = [];
    for (const field of spec.fields) {
      if (!visible[field.id] || (inBatch() && batchFields.has(field.id))) continue;
      if (field.type !== 'group') {
        if (!field.required) continue;
        required.push(field);
        if (isEmpty(field, effective[field.id])) missing.push({ field, focus: field.type === 'multiselect' ? form.querySelector(`input[name="${field.id}"]`) : byId(`field-${field.id}`) });
        continue;
      }
      // Un grupo cuenta si exige filas o si alguna fila rellena tiene subcampos obligatorios.
      const needed = Math.max(field.required ? 1 : 0, field.min_rows || 0);
      const cards = groupRows(field);
      const filled = cards.filter((card, k) => filledRows(field, [data[field.id][k]]).length);
      if (!needed && !(filled.length && field.fields.some(sub => sub.required))) continue;
      required.push(field);
      let focus = null;
      for (const card of filled) {
        const sub = field.fields.find(item => item.required && !card.querySelector(`[data-sub="${item.id}"]`).value.trim());
        if (sub) { focus = card.querySelector(`[data-sub="${sub.id}"]`); break; }
      }
      if (!focus && filled.length < needed) focus = cards.find(card => !filled.includes(card))?.querySelector('[data-sub]') || wrappers[field.id].querySelector('.add-row');
      if (focus) missing.push({ field, focus });
    }
    // En modo lote el listado cuenta como un campo obligatorio más.
    if (inBatch()) {
      const listField = { label: spec.batch.label };
      required.push(listField);
      const state = batchState();
      if (!state || state.errors.length || !state.rows.length || state.rows.some(row => row.errors.length)) {
        missing.push({ field: listField, focus: byId('batch-paste'), message: `Carga un listado sin errores en «${spec.batch.label}»` });
      }
    }
    return { required, missing };
  };

  function showStep(step) {
    byId('step-1').hidden = step !== 1;
    byId('step-2').hidden = step !== 2;
    for (const button of document.querySelectorAll('[data-step]')) {
      if (Number(button.dataset.step) === step) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    }
    byId('preview-title').textContent = step === 1 ? 'Vista previa' : 'Documento generado';
    byId('preview-hint').textContent = step === 1 ? 'Se actualiza al escribir' : 'Revisa el texto antes de exportar';
    renderPreview(step === 2 ? currentFinal() : null);
  }

  function renderInto(container, output) {
    container.append(element('h2', '', output.title));
    if (output.subtitle) container.append(element('p', 'subtitle', output.subtitle));
    for (const section of output.sections) {
      container.append(element('h3', '', section.heading));
      for (const item of section.paragraphs) container.append(itemNode(item));
    }
    if (output.sources.length) {
      container.append(element('h3', '', 'Fuentes'));
      for (const source of output.sources) container.append(element('p', '', `${source.title}: ${source.url}`));
    }
    container.append(element('p', 'draft-note', 'Documento de trabajo sujeto a revisión profesional.'));
  }

  function renderPreview(documentModel = null) {
    const data = commonData();
    const { visible } = effectiveData(spec, data);
    for (const field of spec.fields) wrappers[field.id].hidden = !visible[field.id] || (inBatch() && batchFields.has(field.id));
    const state = batchState();
    if (state && state.rows.length) selected = Math.min(selected, state.rows.length - 1);
    if (spec.batch) renderBatchPanel(state, data);
    const source = state && state.rows.length ? { ...data, ...state.rows[selected].values } : data;
    const preview = byId('preview');
    preview.replaceChildren();
    const output = documentModel || model(source, true);
    byId('app-title').textContent = output.title;
    byId('app-subtitle').textContent = output.subtitle || 'Rellena los datos y genera el documento';
    renderInto(preview, output);
    const { required, missing } = requirement(data);
    const complete = required.length - missing.length;
    byId('progress-fill').style.width = `${required.length ? Math.round(complete / required.length * 100) : 100}%`;
    byId('progress-text').textContent = `${complete} de ${required.length} campos obligatorios completados`;
    byId('preview-status').textContent = documentModel ? 'Listo para exportar' : `${output.stats.included} de ${output.stats.total} secciones incluidas según tus respuestas`;
  }

  function renderBatchPanel(state, common) {
    byId('batch-panel').hidden = !inBatch();
    const total = finalDocuments ? finalDocuments.length : (state ? state.rows.length : 0);
    byId('recipient-nav').hidden = !inBatch() || !total;
    byId('recipient-label').textContent = `Destinatario ${selected + 1} de ${total}`;
    byId('batch-prev').disabled = selected <= 0;
    byId('batch-next').disabled = selected >= total - 1;
    const summary = byId('batch-summary');
    const errors = byId('batch-errors');
    const list = byId('batch-list');
    errors.replaceChildren();
    list.replaceChildren();
    if (batchLoadError) { summary.textContent = ''; errors.append(element('li', '', batchLoadError)); return; }
    if (!state) { summary.textContent = 'Aún no se ha cargado ningún listado.'; return; }
    const recognised = Object.keys(state.columns).map(id => spec.fields.find(field => field.id === id).label);
    summary.textContent = `${state.rows.length} destinatarios · columnas reconocidas: ${recognised.join(', ') || 'ninguna'}${state.ignored.length ? ` · ignoradas: ${state.ignored.join(', ')}` : ''}`;
    const messages = [...state.errors, ...state.rows.flatMap(row => row.errors)];
    for (const message of messages.slice(0, 20)) errors.append(element('li', '', message));
    if (messages.length > 20) errors.append(element('li', '', `… y ${messages.length - 20} más`));
    const names = filenames(state, common);
    state.rows.forEach((row, k) => {
      const button = element('button', k === selected ? 'recipient current' : 'recipient', `${row.errors.length ? '⚠' : '✓'} ${names[k]}`);
      button.type = 'button';
      button.addEventListener('click', () => { selected = k; renderPreview(byId('step-2').hidden ? null : currentFinal()); });
      const item = element('li');
      item.append(button);
      list.append(item);
    });
  }

  function itemNode(item) {
    if (typeof item === 'string') return element('p', '', item);
    if (item.list) {
      const list = element('ul');
      for (const text of item.list) list.append(element('li', '', text));
      return list;
    }
    const table = element('table');
    const head = element('tr');
    for (const text of item.table.headers) head.append(element('th', '', text));
    table.append(element('thead'), element('tbody'));
    table.tHead.append(head);
    for (const row of item.table.rows) {
      const line = element('tr');
      for (const text of row) line.append(element('td', '', text));
      table.tBodies[0].append(line);
    }
    return table;
  }

  let rowCounter = 0;
  function addRow(field, values = {}) {
    const rows = wrappers[field.id].querySelector('.group-rows');
    const card = element('div', 'group-row');
    const n = rowCounter++;
    for (const sub of field.fields) {
      const id = `field-${field.id}-${n}-${sub.id}`;
      const label = element('label', '', sub.label);
      label.htmlFor = id;
      if (sub.required) label.append(element('span', '', ' *'));
      let input;
      if (sub.type === 'textarea') { input = element('textarea'); input.rows = 3; }
      else if (sub.type === 'select') {
        input = element('select');
        const empty = element('option', '', 'Selecciona una opción');
        empty.value = '';
        input.append(empty);
        for (const option of sub.options) { const item = element('option', '', option); item.value = option; input.append(item); }
      } else { input = element('input'); input.type = sub.type; }
      input.id = id;
      input.dataset.sub = sub.id;
      input.value = values[sub.id] || '';
      card.append(label, input);
      if (sub.help) card.append(element('p', 'help', sub.help));
    }
    const remove = element('button', 'secondary remove-row', 'Quitar');
    remove.type = 'button';
    remove.addEventListener('click', () => { card.remove(); syncRows(field); finalDocument = null; renderPreview(); });
    card.append(remove);
    rows.append(card);
    syncRows(field);
  }
  function syncRows(field) {
    const count = groupRows(field).length;
    wrappers[field.id].querySelector('.add-row').disabled = count >= (field.max_rows ?? 50);
    for (const button of wrappers[field.id].querySelectorAll('.remove-row')) button.disabled = count <= (field.min_rows || 0);
  }

  function checkLabel(input, text) {
    const label = element('label', 'check');
    label.append(input, document.createTextNode(` ${text}`));
    return label;
  }

  for (const field of spec.fields) {
    const wrapper = element(field.type === 'multiselect' || field.type === 'group' ? 'fieldset' : 'div', 'field');
    wrappers[field.id] = wrapper;
    if (field.type === 'group') {
      wrapper.id = `field-${field.id}`;
      const legend = element('legend', '', field.label);
      if (field.required) legend.append(element('span', '', ' *'));
      wrapper.append(legend);
      if (field.help) wrapper.append(element('p', 'help', field.help));
      wrapper.append(element('div', 'group-rows'));
      const add = element('button', 'secondary add-row', 'Añadir fila');
      add.type = 'button';
      add.addEventListener('click', () => { addRow(field); finalDocument = null; renderPreview(); });
      wrapper.append(add);
      form.append(wrapper);
      const initial = Array.isArray(field.value) ? field.value : [];
      for (const values of initial) addRow(field, values);
      for (let k = initial.length; k < (field.min_rows || 0); k++) addRow(field);
      syncRows(field);
      continue;
    } else if (field.type === 'checkbox') {
      const input = element('input');
      input.type = 'checkbox';
      input.id = `field-${field.id}`;
      input.name = field.id;
      input.checked = field.value === true;
      const label = checkLabel(input, field.label);
      if (field.required) label.append(element('span', '', ' *'));
      wrapper.append(label);
    } else if (field.type === 'multiselect') {
      wrapper.id = `field-${field.id}`;
      const legend = element('legend', '', field.label);
      if (field.required) legend.append(element('span', '', ' *'));
      wrapper.append(legend);
      for (const [k, option] of field.options.entries()) {
        const input = element('input');
        input.type = 'checkbox';
        input.id = `field-${field.id}-${k}`;
        input.name = field.id;
        input.value = option;
        input.checked = Array.isArray(field.value) && field.value.includes(option);
        wrapper.append(checkLabel(input, option));
      }
    } else {
      const label = element('label', '', field.label);
      label.htmlFor = `field-${field.id}`;
      if (field.required) label.append(element('span', '', ' *'));
      let input;
      if (field.type === 'textarea') input = element('textarea');
      else if (field.type === 'select') {
        input = element('select');
        const empty = element('option', '', 'Selecciona una opción');
        empty.value = '';
        input.append(empty);
        for (const option of field.options) {
          const item = element('option', '', option);
          item.value = option;
          input.append(item);
        }
      } else input = element('input');
      if (field.type !== 'select' && field.type !== 'textarea') input.type = field.type;
      input.id = `field-${field.id}`;
      input.name = field.id;
      input.required = Boolean(field.required);
      input.value = field.value || '';
      if (field.type === 'textarea') input.rows = 4;
      wrapper.append(label, input);
    }
    if (field.help) wrapper.append(element('p', 'help', field.help));
    form.append(wrapper);
  }
  const sourceList = byId('source-list');
  for (const source of spec.sources || []) {
    const item = element('li');
    const link = element('a', '', source.title);
    link.href = source.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    item.append(link);
    sourceList.append(item);
  }
  byId('sources-wrap').hidden = !sourceList.childElementCount;

  if (spec.batch) {
    const bar = element('div', 'mode-bar');
    for (const [value, text] of [['single', 'Un documento'], ['batch', 'Varios destinatarios']]) {
      const button = element('button', value === mode ? 'mode current' : 'mode', text);
      button.type = 'button';
      button.dataset.mode = value;
      button.addEventListener('click', () => {
        mode = value;
        for (const item of bar.children) item.className = item.dataset.mode === mode ? 'mode current' : 'mode';
        finalDocument = null; finalDocuments = null; selected = 0;
        renderPreview();
      });
      bar.append(button);
    }
    form.before(bar);
    const panel = element('fieldset', 'field batch-panel');
    panel.id = 'batch-panel';
    panel.hidden = true;
    panel.append(element('legend', '', spec.batch.label));
    const columns = spec.batch.fields.map(id => spec.fields.find(field => field.id === id).label).join(' · ');
    panel.append(element('p', 'help', `Columnas: ${columns}. La primera fila debe contener los encabezados. El listado no sale de este navegador.`));
    const paste = element('textarea');
    paste.id = 'batch-paste';
    paste.rows = 5;
    paste.placeholder = 'Pega aquí las celdas copiadas de Excel (con la fila de encabezados)';
    const file = element('input');
    file.type = 'file';
    file.id = 'batch-file';
    file.accept = '.xlsx,.csv,.txt';
    const load = element('button', 'secondary add-row', 'Cargar listado');
    load.type = 'button';
    load.id = 'batch-load';
    const summary = element('p', 'small');
    summary.id = 'batch-summary';
    const errors = element('ul', 'batch-errors');
    errors.id = 'batch-errors';
    const list = element('ol', 'batch-list');
    list.id = 'batch-list';
    panel.append(paste, file, load, summary, errors, list);
    form.after(panel);
    load.addEventListener('click', async () => {
      batchLoadError = ''; selected = 0; finalDocument = null; finalDocuments = null;
      try {
        const picked = file.files && file.files[0];
        if (picked) {
          if (picked.size > LIMITS.fileBytes) throw new Error('El archivo supera el máximo de 5 MB');
          const bytes = new Uint8Array(await picked.arrayBuffer());
          batchTable = /\.xlsx$/i.test(picked.name) ? await readXlsx(bytes) : parseDelimited(decodeText(bytes));
        } else if (paste.value.trim()) batchTable = parseDelimited(paste.value);
        else throw new Error('Pega el listado o elige un archivo .xlsx o .csv');
      } catch (error) {
        batchTable = null;
        batchLoadError = error.message;
      }
      renderPreview();
    });
    const nav = element('div', 'recipient-nav');
    nav.id = 'recipient-nav';
    nav.hidden = true;
    const prev = element('button', 'secondary', '‹ Anterior');
    prev.type = 'button';
    prev.id = 'batch-prev';
    const label = element('span', 'small');
    label.id = 'recipient-label';
    const next = element('button', 'secondary', 'Siguiente ›');
    next.type = 'button';
    next.id = 'batch-next';
    const move = delta => { selected += delta; renderPreview(byId('step-2').hidden ? null : currentFinal()); };
    prev.addEventListener('click', () => move(-1));
    next.addEventListener('click', () => move(1));
    nav.append(prev, label, next);
    document.querySelector('.preview-head').append(nav);
    const zip = element('button', 'primary', 'Descargar ZIP');
    zip.type = 'button';
    zip.id = 'zip-button';
    zip.hidden = true;
    byId('docx-button').before(zip);
    zip.addEventListener('click', () => {
      if (!finalDocuments) return;
      download(zipStore(finalDocuments.map(doc => [`${doc.name}.docx`, docxPackage(doc.output)])), `${slug(spec.title)}.zip`, 'application/zip');
    });
  }

  form.addEventListener('input', () => { finalDocument = null; finalDocuments = null; renderPreview(); });
  form.addEventListener('change', () => { finalDocument = null; finalDocuments = null; renderPreview(); });
  byId('generate-button').addEventListener('click', () => {
    const data = commonData();
    const [first] = requirement(data).missing;
    if (first) {
      const input = first.focus;
      if (first.message) {
        input.focus();
        byId('progress-text').textContent = first.message;
        return;
      }
      if (input.tagName === 'BUTTON') {
        input.focus();
        byId('progress-text').textContent = `Añade al menos una fila en «${first.field.label}»`;
        return;
      }
      input.setCustomValidity('Completa este campo');
      input.reportValidity();
      input.focus();
      input.setCustomValidity('');
      return;
    }
    if (inBatch()) {
      const state = batchState();
      const names = filenames(state, data);
      finalDocuments = state.rows.map((row, k) => ({ output: model({ ...data, ...row.values }), name: names[k] }));
      selected = Math.min(selected, finalDocuments.length - 1);
      finalDocument = finalDocuments[selected].output;
      byId('zip-button').hidden = false;
      byId('docx-button').textContent = 'Descargar este DOCX';
      byId('review-summary').textContent = `${finalDocuments.length} documentos listos. Revísalos con «‹ Anterior / Siguiente ›» y descarga el ZIP o el PDF.`;
      showStep(2);
      return;
    }
    finalDocuments = null;
    finalDocument = model(data);
    if (spec.batch) { byId('zip-button').hidden = true; byId('docx-button').textContent = 'Descargar DOCX'; }
    byId('review-summary').textContent = 'Documento generado. Comprueba el contenido y descarga el formato que necesites.';
    showStep(2);
  });
  document.querySelector('[data-next="1"]').addEventListener('click', () => showStep(1));
  document.querySelector('[data-step="1"]').addEventListener('click', () => showStep(1));
  document.querySelector('[data-step="2"]').addEventListener('click', () => { if (currentFinal()) showStep(2); });
  byId('docx-button').addEventListener('click', () => {
    const output = currentFinal();
    if (!output) return;
    download(docxPackage(output), finalDocuments ? `${finalDocuments[selected].name}.docx` : `${slug(output.title)}.docx`, DOCX_TYPE);
  });
  byId('pdf-button').addEventListener('click', () => {
    if (!finalDocuments) { if (finalDocument) window.print(); return; }
    // Todas las cartas del lote, cada una en una página nueva.
    const preview = byId('preview');
    preview.replaceChildren();
    finalDocuments.forEach((doc, k) => {
      const page = element('div', k ? 'doc-page break' : 'doc-page');
      renderInto(page, doc.output);
      preview.append(page);
    });
    window.print();
    renderPreview(currentFinal());
  });
  showStep(1);
})();
