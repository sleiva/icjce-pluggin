(() => {
  'use strict';
  const { buildModel, effectiveData, filledRows, isEmpty } = globalThis.DocEvaluator;
  const { docxPackage } = globalThis.DocExport;
  const byId = id => document.getElementById(id);
  const form = byId('data-form');
  const wrappers = {};
  let finalDocument = null;

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
  const model = (data, markMissing = false) => buildModel(spec, data, { markMissing });
  const groupRows = field => [...wrappers[field.id].querySelectorAll(':scope > .group-rows > .group-row')];
  // Campos que cuentan para el progreso y primer elemento al que llevar el foco.
  const requirement = data => {
    const { data: effective, visible } = effectiveData(spec, data);
    const required = [];
    const missing = [];
    for (const field of spec.fields) {
      if (!visible[field.id]) continue;
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
    renderPreview(step === 2 ? finalDocument : null);
  }

  function renderPreview(documentModel = null) {
    const data = collect();
    const { visible } = effectiveData(spec, data);
    for (const field of spec.fields) wrappers[field.id].hidden = !visible[field.id];
    const preview = byId('preview');
    preview.replaceChildren();
    const output = documentModel || model(data, true);
    byId('app-title').textContent = output.title;
    byId('app-subtitle').textContent = output.subtitle || 'Rellena los datos y genera el documento';
    preview.append(element('h2', '', output.title));
    if (output.subtitle) preview.append(element('p', 'subtitle', output.subtitle));
    for (const section of output.sections) {
      preview.append(element('h3', '', section.heading));
      for (const item of section.paragraphs) preview.append(itemNode(item));
    }
    if (output.sources.length) {
      preview.append(element('h3', '', 'Fuentes'));
      for (const source of output.sources) preview.append(element('p', '', `${source.title}: ${source.url}`));
    }
    preview.append(element('p', 'draft-note', 'Documento de trabajo sujeto a revisión profesional.'));
    const { required, missing } = requirement(data);
    const complete = required.length - missing.length;
    byId('progress-fill').style.width = `${required.length ? Math.round(complete / required.length * 100) : 100}%`;
    byId('progress-text').textContent = `${complete} de ${required.length} campos obligatorios completados`;
    byId('preview-status').textContent = documentModel ? 'Listo para exportar' : `${output.stats.included} de ${output.stats.total} secciones incluidas según tus respuestas`;
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

  form.addEventListener('input', () => { finalDocument = null; renderPreview(); });
  form.addEventListener('change', () => { finalDocument = null; renderPreview(); });
  byId('generate-button').addEventListener('click', () => {
    const data = collect();
    const [first] = requirement(data).missing;
    if (first) {
      const input = first.focus;
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
    finalDocument = model(data);
    byId('review-summary').textContent = 'Documento generado. Comprueba el contenido y descarga el formato que necesites.';
    showStep(2);
  });
  document.querySelector('[data-next="1"]').addEventListener('click', () => showStep(1));
  document.querySelector('[data-step="1"]').addEventListener('click', () => showStep(1));
  document.querySelector('[data-step="2"]').addEventListener('click', () => { if (finalDocument) showStep(2); });
  byId('docx-button').addEventListener('click', () => {
    if (!finalDocument) return;
    const blob = new Blob([docxPackage(finalDocument)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${finalDocument.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'documento'}.docx`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 30000);
  });
  byId('pdf-button').addEventListener('click', () => { if (finalDocument) window.print(); });
  showStep(1);
})();
