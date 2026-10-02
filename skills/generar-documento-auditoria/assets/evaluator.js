/* Evaluador de plantillas del asistente documental: condiciones, visibilidad de campos,
   textos derivados, grupos repetibles, números y documento final. Usa DocNumbers
   (numbers.js) para los campos numéricos; se incrusta en el HTML y lo importa el validador
   de Node, de modo que lo comprobado es lo que se ejecuta. */
(function (root) {
  'use strict';
  const PLACEHOLDER = /\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g;
  const own = (object, key) => Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);
  const textOf = value => (typeof value === 'string' ? value.trim() : '');
  const numbers = () => root.DocNumbers;
  const NUMERIC = ['number', 'computed'];
  const COMPARE = ['gt', 'gte', 'lt', 'lte', 'eq'];
  const compiled = new WeakMap();

  // Fórmula compilada de un campo `computed` (se compila una vez por plantilla).
  function formula(spec, field) {
    let cache = compiled.get(spec);
    if (!cache) { cache = new Map(); compiled.set(spec, cache); }
    if (!cache.has(field.id)) cache.set(field.id, numbers().compile(field.expr));
    return cache.get(field.id);
  }

  // Valor numérico de un campo `number` (texto escrito) o `computed` (ya calculado), o null.
  function numberOf(field, value) {
    if (field.type === 'computed') return typeof value === 'number' && Number.isFinite(value) ? value : null;
    const parsed = numbers().parseNumber(value);
    return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null;
  }

  function emptyValue(field) {
    if (field.type === 'checkbox') return false;
    if (field.type === 'multiselect' || field.type === 'group') return [];
    return '';
  }

  // Filas de un grupo con algún subcampo relleno; las filas en blanco no cuentan.
  function filledRows(field, value) {
    if (!Array.isArray(value)) return [];
    return value.filter(row => row && typeof row === 'object' && field.fields.some(sub => textOf(row[sub.id])));
  }

  function isEmpty(field, value) {
    if (field.type === 'checkbox') return value !== true;
    if (field.type === 'multiselect') return !Array.isArray(value) || value.length === 0;
    if (field.type === 'group') return filledRows(field, value).length === 0;
    if (NUMERIC.includes(field.type)) return numberOf(field, value) === null;
    return typeof value !== 'string' || !value.trim();
  }

  function evaluate(condition, data, spec) {
    if (!condition) return true;
    if ('all' in condition) return condition.all.every(item => evaluate(item, data, spec));
    if ('any' in condition) return condition.any.some(item => evaluate(item, data, spec));
    if ('not' in condition) return !evaluate(condition.not, data, spec);
    if ('ref' in condition) {
      const target = own(spec.conditions, condition.ref) ? spec.conditions[condition.ref] : null;
      if (!target) throw new Error(`Condición desconocida: ${condition.ref}`);
      return evaluate(target, data, spec);
    }
    const field = spec.fields.find(item => item.id === condition.field);
    if (!field) throw new Error(`Campo desconocido: ${condition.field}`);
    const value = data[condition.field];
    const text = textOf(value);
    if ('equals' in condition) return text === condition.equals;
    if ('in' in condition) return condition.in.includes(text);
    if ('checked' in condition) return (value === true) === condition.checked;
    if ('includes' in condition) return Array.isArray(value) && value.includes(condition.includes);
    if ('filled' in condition) return !isEmpty(field, value) === condition.filled;
    const op = COMPARE.find(key => key in condition);
    if (op) {
      const left = numberOf(field, value);
      const target = condition[op];
      const other = typeof target === 'number' ? null : spec.fields.find(item => item.id === target);
      const right = typeof target === 'number' ? target : (other ? numberOf(other, data[target]) : null);
      if (left === null || right === null) return false;
      if (op === 'gt') return left > right;
      if (op === 'gte') return left >= right;
      if (op === 'lt') return left < right;
      if (op === 'lte') return left <= right;
      return left === right;
    }
    throw new Error('Condición no reconocida');
  }

  // Los campos con `when` solo pueden depender de campos anteriores (lo exige el
  // validador), así que basta una pasada en orden. Un campo oculto vale vacío y un
  // grupo conserva solo sus filas con contenido.
  // Un `computed` se calcula aquí, en orden, con los valores ya resueltos; `invalid` marca
  // los `number` escritos de forma no numérica.
  function effectiveData(spec, raw) {
    const source = raw || {};
    const data = {};
    const visible = {};
    const invalid = {};
    const values = {};
    const groups = {};
    for (const field of spec.fields) {
      const shown = !field.when || evaluate(field.when, data, spec);
      visible[field.id] = shown;
      if (field.type === 'computed') {
        const { ast } = formula(spec, field);
        data[field.id] = shown ? numbers().run(ast, values, groups) : null;
        values[field.id] = data[field.id];
        continue;
      }
      const value = shown && source[field.id] !== undefined ? source[field.id] : emptyValue(field);
      data[field.id] = field.type === 'group' ? filledRows(field, value) : value;
      if (field.type === 'group') groups[field.id] = data[field.id];
      if (field.type === 'number') {
        const parsed = numbers().parseNumber(value);
        invalid[field.id] = Number.isNaN(parsed);
        values[field.id] = numberOf(field, value);
      }
    }
    return { data, visible, invalid };
  }

  // Texto de un valor en el documento: los números con su formato; los demás, recortados.
  function display(field, value) {
    if (field && NUMERIC.includes(field.type)) {
      const n = numberOf(field, value);
      return n === null ? '' : numbers().formatNumber(n, field.decimals ?? 2, field.unit || '');
    }
    return textOf(value);
  }

  // `row` y `group` permiten usar los subcampos de una fila dentro de un `repeat`.
  function fill(template, data, derived, spec, markMissing, row, group) {
    return template.replace(PLACEHOLDER, (_, id) => {
      if (Object.prototype.hasOwnProperty.call(derived, id)) return derived[id];
      const sub = group ? group.fields.find(item => item.id === id) : null;
      const field = sub || spec.fields.find(item => item.id === id);
      const text = display(field, sub ? row[id] : data[id]);
      if (text || !markMissing) return text;
      return `[${field ? field.label : id}]`;
    });
  }

  function resolveDerived(spec, data, markMissing) {
    const out = {};
    for (const [id, definition] of Object.entries(spec.derived || {})) {
      const hit = definition.cases.find(item => evaluate(item.when, data, spec));
      out[id] = fill(hit ? hit.text : definition.default, data, {}, spec, markMissing);
    }
    return out;
  }

  // Elementos de documento de un párrafo `repeat`: textos, `{ table }` o `{ list }`.
  function repeatItems(item, spec, data, derived, markMissing) {
    const group = spec.fields.find(field => field.id === item.repeat);
    const rows = data[item.repeat] || [];
    const format = (template, row) => fill(template, data, derived, spec, markMissing, row, group);
    if (!rows.length) return item.empty ? [format(item.empty, {})] : [];
    if (item.as === 'table') {
      const columns = (item.columns || group.fields.map(sub => sub.id)).map(id => group.fields.find(sub => sub.id === id));
      return [{ table: {
        headers: columns.map(sub => sub.label),
        rows: rows.map(row => columns.map(sub => format(`{{${sub.id}}}`, row))),
      } }];
    }
    if (item.as === 'list') return [{ list: rows.map(row => format(item.item, row)) }];
    return rows.flatMap(row => item.paragraphs.map(template => format(template, row)));
  }

  function buildModel(spec, raw, options) {
    const markMissing = Boolean(options && options.markMissing);
    const { data } = effectiveData(spec, raw);
    const derived = resolveDerived(spec, data, markMissing);
    const format = template => fill(template, data, derived, spec, markMissing);
    const sections = [];
    for (const section of spec.sections) {
      if (section.when && !evaluate(section.when, data, spec)) continue;
      const paragraphs = [];
      for (const entry of section.paragraphs) {
        const item = typeof entry === 'string' ? { text: entry } : entry;
        if (item.when && !evaluate(item.when, data, spec)) continue;
        if (item.repeat) paragraphs.push(...repeatItems(item, spec, data, derived, markMissing));
        else paragraphs.push(format(item.text));
      }
      if (paragraphs.length) sections.push({ heading: format(section.heading), paragraphs });
    }
    return {
      title: format(spec.title),
      subtitle: spec.subtitle ? format(spec.subtitle) : '',
      sections,
      sources: spec.include_sources_in_output ? (spec.sources || []) : [],
      stats: { included: sections.length, total: spec.sections.length },
    };
  }

  // Un texto suelto (por ejemplo, el nombre de archivo de un lote) con campos y derivados.
  function renderText(spec, raw, template, options) {
    const markMissing = Boolean(options && options.markMissing);
    const { data } = effectiveData(spec, raw);
    return fill(template, data, resolveDerived(spec, data, markMissing), spec, markMissing);
  }

  root.DocEvaluator = { PLACEHOLDER, emptyValue, filledRows, isEmpty, evaluate, effectiveData, buildModel, renderText, numberOf };
})(globalThis);
