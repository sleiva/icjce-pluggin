/* Evaluador de plantillas del asistente documental: condiciones, visibilidad de campos,
   textos derivados y documento final. Sin dependencias; se incrusta en el HTML y lo
   importa el validador de Node, de modo que lo comprobado es lo que se ejecuta. */
(function (root) {
  'use strict';
  const PLACEHOLDER = /\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g;

  function emptyValue(field) {
    if (field.type === 'checkbox') return false;
    if (field.type === 'multiselect') return [];
    return '';
  }

  function isEmpty(field, value) {
    if (field.type === 'checkbox') return value !== true;
    if (field.type === 'multiselect') return !Array.isArray(value) || value.length === 0;
    return typeof value !== 'string' || !value.trim();
  }

  function evaluate(condition, data, spec) {
    if (!condition) return true;
    if ('all' in condition) return condition.all.every(item => evaluate(item, data, spec));
    if ('any' in condition) return condition.any.some(item => evaluate(item, data, spec));
    if ('not' in condition) return !evaluate(condition.not, data, spec);
    if ('ref' in condition) {
      const target = spec.conditions && Object.prototype.hasOwnProperty.call(spec.conditions, condition.ref) ? spec.conditions[condition.ref] : null;
      if (!target) throw new Error(`Condición desconocida: ${condition.ref}`);
      return evaluate(target, data, spec);
    }
    const field = spec.fields.find(item => item.id === condition.field);
    if (!field) throw new Error(`Campo desconocido: ${condition.field}`);
    const value = data[condition.field];
    const text = typeof value === 'string' ? value.trim() : '';
    if ('equals' in condition) return text === condition.equals;
    if ('in' in condition) return condition.in.includes(text);
    if ('checked' in condition) return (value === true) === condition.checked;
    if ('includes' in condition) return Array.isArray(value) && value.includes(condition.includes);
    if ('filled' in condition) return !isEmpty(field, value) === condition.filled;
    throw new Error('Condición no reconocida');
  }

  // Los campos con `when` solo pueden depender de campos anteriores (lo exige el
  // validador), así que basta una pasada en orden. Un campo oculto vale vacío.
  function effectiveData(spec, raw) {
    const source = raw || {};
    const data = {};
    const visible = {};
    for (const field of spec.fields) {
      const shown = !field.when || evaluate(field.when, data, spec);
      visible[field.id] = shown;
      data[field.id] = shown && source[field.id] !== undefined ? source[field.id] : emptyValue(field);
    }
    return { data, visible };
  }

  function fill(template, data, derived, spec, markMissing) {
    return template.replace(PLACEHOLDER, (_, id) => {
      if (Object.prototype.hasOwnProperty.call(derived, id)) return derived[id];
      const value = data[id];
      const text = typeof value === 'string' ? value.trim() : '';
      if (text || !markMissing) return text;
      const field = spec.fields.find(item => item.id === id);
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

  function buildModel(spec, raw, options) {
    const markMissing = Boolean(options && options.markMissing);
    const { data } = effectiveData(spec, raw);
    const derived = resolveDerived(spec, data, markMissing);
    const format = template => fill(template, data, derived, spec, markMissing);
    const sections = [];
    for (const section of spec.sections) {
      if (section.when && !evaluate(section.when, data, spec)) continue;
      const paragraphs = section.paragraphs
        .map(item => (typeof item === 'string' ? { text: item } : item))
        .filter(item => !item.when || evaluate(item.when, data, spec))
        .map(item => format(item.text));
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

  root.DocEvaluator = { PLACEHOLDER, emptyValue, isEmpty, evaluate, effectiveData, buildModel };
})(globalThis);
