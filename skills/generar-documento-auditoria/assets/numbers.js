/* Números del asistente documental: lectura en formato español, formato de salida y
   fórmulas seguras (sin eval) para los campos calculados. Sin dependencias; se incrusta en
   el HTML y lo usan el evaluador y el validador. */
(function (root) {
  'use strict';
  const NBSP = '\u00a0';
  const MAX_LENGTH = 500;
  const MAX_DEPTH = 10;
  const FUNCTIONS = { sum: [1, 1], min: [2, Infinity], max: [2, Infinity], round: [2, 2], abs: [1, 1] };

  // --- Lectura y formato --------------------------------------------------------

  function groupsOk(intPart, group) {
    const parts = intPart.split(group);
    return /^\d{1,3}$/.test(parts[0]) && parts.slice(1).every(part => /^\d{3}$/.test(part));
  }

  // Número, null (vacío) o NaN (no se entiende). Ignora la unidad final («%», «€», texto).
  function parseNumber(input) {
    if (input === null || input === undefined) return null;
    if (typeof input === 'number') return Number.isFinite(input) ? input : NaN;
    let text = String(input).trim();
    if (!text) return null;
    text = text.replace(/[^\d.,]+$/, '').trim();
    let sign = 1;
    if (text.startsWith('-')) { sign = -1; text = text.slice(1).trim(); }
    if (!/^[\d.,]+$/.test(text) || !/\d/.test(text)) return NaN;
    const dots = (text.match(/\./g) || []).length;
    const commas = (text.match(/,/g) || []).length;
    let normalized;
    if (dots && commas) {
      const decimal = text.lastIndexOf('.') > text.lastIndexOf(',') ? '.' : ',';
      const group = decimal === '.' ? ',' : '.';
      const [intPart, frac, extra] = text.split(decimal);
      if (extra !== undefined || !frac || frac.includes(group) || !groupsOk(intPart, group)) return NaN;
      normalized = `${intPart.split(group).join('')}.${frac}`;
    } else if (commas) {
      const [intPart, frac, extra] = text.split(',');
      if (extra !== undefined || !intPart || !frac) return NaN;
      normalized = `${intPart}.${frac}`;
    } else if (dots) {
      const parts = text.split('.');
      if (parts[0] !== '0' && groupsOk(text, '.')) normalized = parts.join('');
      else if (dots === 1 && parts[0] && parts[1]) normalized = text;
      else return NaN;
    } else normalized = text;
    const value = sign * Number(normalized);
    return Number.isFinite(value) ? value : NaN;
  }

  // Redondeo medio hacia arriba sobre la representación decimal (1,005 → 1,01).
  function fixed(abs, decimals) {
    const [mantissa, exponent] = abs.toExponential().split('e');
    const shifted = Math.round(Number(`${mantissa}e${Number(exponent) + decimals}`));
    return (shifted / 10 ** decimals).toFixed(decimals);
  }

  function formatNumber(value, decimals = 2, unit = '') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '';
    const digits = fixed(Math.abs(value), decimals);
    const [intPart, frac] = digits.split('.');
    const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const negative = value < 0 && /[1-9]/.test(digits);
    const text = `${negative ? '-' : ''}${grouped}${frac ? `,${frac}` : ''}`;
    return unit ? `${text}${NBSP}${unit}` : text;
  }

  // Número de Excel en un campo de texto: dígitos exactos, sin miles y con coma decimal.
  function plainNumber(text) {
    const value = Number(text);
    if (!Number.isFinite(value)) return String(text);
    const digits = Number.isInteger(value) ? String(value) : String(Number(value.toPrecision(15)));
    return /e/i.test(digits) ? String(text) : digits.replace('.', ',');
  }

  // --- Fórmulas -----------------------------------------------------------------

  function tokenize(expr) {
    const tokens = [];
    const pattern = /\s*(?:(\d+(?:\.\d+)?)|([a-z][a-z0-9_]*)|(\S))/gy;
    let match;
    while (pattern.lastIndex < expr.length && (match = pattern.exec(expr))) {
      const position = match.index + match[0].length - (match[1] || match[2] || match[3] || '').length + 1;
      if (match[1]) tokens.push({ type: 'num', value: Number(match[1]), position });
      else if (match[2]) tokens.push({ type: 'id', value: match[2], position });
      else if (match[3]) {
        if (!'+-*/(),.'.includes(match[3])) throw new Error(`carácter no válido "${match[3]}" en la posición ${position}`);
        tokens.push({ type: match[3], position });
      }
    }
    tokens.push({ type: 'end', position: expr.length + 1 });
    return tokens;
  }

  function compile(expr) {
    if (typeof expr !== 'string' || !expr.trim()) throw new Error('la fórmula está vacía');
    if (expr.length > MAX_LENGTH) throw new Error(`la fórmula no puede superar ${MAX_LENGTH} caracteres`);
    const tokens = tokenize(expr);
    let at = 0;
    let depth = 0;
    const refs = new Set();
    const sums = [];
    const peek = () => tokens[at];
    const take = type => {
      const token = tokens[at];
      if (token.type !== type) throw new Error(`se esperaba "${type}" en la posición ${token.position}`);
      at++;
      return token;
    };
    const nest = token => { if (++depth > MAX_DEPTH) throw new Error(`demasiados niveles de anidamiento en la posición ${token.position}`); };
    function expression() {
      let node = term();
      while (peek().type === '+' || peek().type === '-') { const op = tokens[at++].type; node = { type: 'op', op, left: node, right: term() }; }
      return node;
    }
    function term() {
      let node = factor();
      while (peek().type === '*' || peek().type === '/') { const op = tokens[at++].type; node = { type: 'op', op, left: node, right: factor() }; }
      return node;
    }
    function factor() {
      if (peek().type === '-') { const token = tokens[at++]; nest(token); const node = { type: 'neg', value: factor() }; depth--; return node; }
      return primary();
    }
    function primary() {
      const token = peek();
      if (token.type === 'num') { at++; return { type: 'num', value: token.value }; }
      if (token.type === '(') { at++; nest(token); const node = expression(); take(')'); depth--; return node; }
      if (token.type === 'id') {
        at++;
        if (peek().type === '(') return call(token);
        if (peek().type === '.') throw new Error(`${token.value}.… solo puede usarse dentro de sum, en la posición ${token.position}`);
        refs.add(token.value);
        return { type: 'ref', id: token.value };
      }
      if (token.type === 'end') throw new Error(`la fórmula termina antes de tiempo en la posición ${token.position}`);
      throw new Error(`no se esperaba "${token.type}" en la posición ${token.position}`);
    }
    function call(name) {
      const arity = Object.prototype.hasOwnProperty.call(FUNCTIONS, name.value) ? FUNCTIONS[name.value] : null;
      if (!arity) throw new Error(`función desconocida ${name.value} en la posición ${name.position}`);
      const open = take('(');
      nest(open);
      const args = [];
      if (name.value === 'sum') {
        const group = take('id');
        take('.');
        const sub = take('id');
        sums.push({ group: group.value, sub: sub.value });
        args.push({ type: 'member', group: group.value, sub: sub.value });
      } else {
        args.push(expression());
        while (peek().type === ',') { at++; args.push(expression()); }
      }
      if (peek().type === ',' && name.value === 'sum') throw new Error(`sum admite un solo argumento, en la posición ${peek().position}`);
      take(')');
      depth--;
      if (args.length < arity[0] || args.length > arity[1]) {
        const expected = arity[1] === Infinity ? `al menos ${arity[0]}` : String(arity[0]);
        throw new Error(`${name.value} necesita ${expected} argumentos, en la posición ${name.position}`);
      }
      if (name.value === 'round') {
        const digits = args[1];
        if (digits.type !== 'num' || !Number.isInteger(digits.value) || digits.value > 6) throw new Error(`el segundo argumento de round debe ser un entero de 0 a 6, en la posición ${name.position}`);
      }
      return { type: 'call', name: name.value, args };
    }
    const ast = expression();
    if (peek().type !== 'end') throw new Error(`no se esperaba "${peek().type === 'num' || peek().type === 'id' ? peek().value : peek().type}" en la posición ${peek().position}`);
    return { ast, refs: [...refs], sums };
  }

  // Resultado numérico o null (falta un dato, dato inválido o división por cero).
  function run(node, values, groups) {
    switch (node.type) {
      case 'num': return node.value;
      case 'ref': { const v = Object.prototype.hasOwnProperty.call(values, node.id) ? values[node.id] : null; return typeof v === 'number' && Number.isFinite(v) ? v : null; }
      case 'neg': { const v = run(node.value, values, groups); return v === null ? null : -v; }
      case 'op': {
        const a = run(node.left, values, groups);
        const b = run(node.right, values, groups);
        if (a === null || b === null) return null;
        if (node.op === '+') return a + b;
        if (node.op === '-') return a - b;
        if (node.op === '*') return a * b;
        return b === 0 ? null : a / b;
      }
      case 'call': {
        if (node.name === 'sum') {
          const { group, sub } = node.args[0];
          let total = 0;
          const rows = Object.prototype.hasOwnProperty.call(groups, group) ? groups[group] : [];
          for (const row of Array.isArray(rows) ? rows : []) {
            const v = parseNumber(row[sub]);
            if (v === null) continue;
            if (Number.isNaN(v)) return null;
            total += v;
          }
          return total;
        }
        const args = node.args.map(arg => run(arg, values, groups));
        if (args.some(v => v === null)) return null;
        if (node.name === 'min') return Math.min(...args);
        if (node.name === 'max') return Math.max(...args);
        if (node.name === 'abs') return Math.abs(args[0]);
        return Number(fixed(Math.abs(args[0]), args[1])) * Math.sign(args[0] || 1);
      }
      default: return null;
    }
  }

  root.DocNumbers = { parseNumber, formatNumber, plainNumber, compile, run };
})(globalThis);
