# Condiciones, casillas y textos derivados en `generar-documento-auditoria`

Fecha: 2026-10-01 · Subproyecto 1 de 4 de la ampliación del motor documental · Estado: diseño aprobado en conversación, pendiente de revisión escrita.

## Objetivo

La habilidad debe poder analizar **cualquier** modelo documental que encuentre en el MCP del ICJCE y representar fielmente su variación sin código específico por documento. Para ello el motor ofrece piezas genéricas (condiciones, casillas, selección múltiple, textos derivados) y la guía de análisis enseña a reconocer las marcas de variación de un modelo y traducirlas a esas piezas.

Fuera de alcance (subproyectos posteriores): grupos repetibles y tablas (2), modo lote desde CSV/Excel (3), campos calculados y comparaciones numéricas (4).

## Evidencia

Análisis de los modelos vigentes en `kg_icjce_processed_files` / `kg_icjce_chunks` (proyecto Supabase `boygddyuxkdljzpndusd`) y de fuentes públicas (NIA-ES 580, 210, 705R; ejemplos REA-CGE):

- **1728**, carta a responsables del gobierno, fase final (ES08/2018): unas diez secciones «Incluir esta sección sólo en caso de…» (incertidumbre material, énfasis, incorrecciones no corregidas, fraude, deficiencias de control, incumplimientos, partes vinculadas, grupos). Opinión «sustituir por con salvedades, desfavorable o denegación».
- **1163**, carta de encargo Guía 44R (vigente): cláusulas «Aplicable solamente a EIP / consolidados / cotizadas sujetas a LSC / no cotizadas sujetas a LSC / voluntarias». En línea: «[Accionistas/Socios]» seis veces, «[la dirección]» frente a «[la dirección y, cuando proceda, los administradores]».
- **2755**, ejemplos de informes ES10/2024 (vigente): sobre todo huecos de datos (destinatario, firma, ROAC, fecha); «[por encargo de…]» quince veces como fragmento opcional en línea; muchas notas al pie para el auditor.
- **NIA-ES 580 A10/A11, NIA-ES 210 A24**: conjuntos de cláusulas opcionales elegibles (selección múltiple).
- No se encontraron condiciones numéricas. La combinación lógica real llega a dos niveles.

## 1. Esquema JSON

### Versión

- `schema_version: 1` sigue válido sin cambios.
- Cualquier construcción nueva (tipos `checkbox`/`multiselect`, `when` en campos o párrafos, operadores distintos de `equals` simple en secciones, `derived`, `conditions`) exige `schema_version: 2`. El validador rechaza esas construcciones bajo `1`.
- Límites: hasta 80 campos y 80 secciones (antes 50/50). Resto de límites sin cambios.

### Campos

Tipos: `text`, `textarea`, `date`, `select` (existentes), más:

- `checkbox`: valor booleano. No admite `options`.
- `multiselect`: exige `options` (lista no vacía de textos únicos). Valor: lista de opciones marcadas.

Cualquier campo admite `when` (condición). Si la condición no se cumple, el campo:

1. no se muestra;
2. no es obligatorio;
3. se evalúa como vacío en condiciones, derivados y texto (aunque conserve en pantalla lo escrito para no perderlo si vuelve a mostrarse).

La condición `when` de un campo solo puede referenciar campos declarados antes que él (evita ciclos y permite evaluar la visibilidad en una pasada).

### Condiciones

Una condición es uno de estos objetos (exactamente una clave operadora por objeto):

| Forma | Significado | Tipos de campo admitidos |
|---|---|---|
| `{ "field": id, "equals": "v" }` | valor igual a `v` | `select`, `text` |
| `{ "field": id, "in": ["v1", "v2"] }` | valor en la lista (≥ 1 elemento) | `select`, `text` |
| `{ "field": id, "checked": true\|false }` | casilla marcada / no marcada | `checkbox` |
| `{ "field": id, "includes": "v" }` | la selección múltiple contiene `v` | `multiselect` |
| `{ "field": id, "filled": true\|false }` | campo no vacío / vacío | todos salvo `checkbox` |
| `{ "all": [c1, c2, …] }` | Y (≥ 2 elementos) | — |
| `{ "any": [c1, c2, …] }` | O (≥ 2 elementos) | — |
| `{ "not": c }` | NO | — |
| `{ "ref": nombre }` | condición con nombre | — |

- Profundidad máxima: 3 niveles de anidamiento contados desde la raíz, expandiendo `ref`.
- Para campos `select` y `multiselect`, los valores de `equals`, `in` e `includes` deben pertenecer literalmente a `options`.
- Se admite `when` en: campos, secciones, párrafos y casos de textos derivados.

### Condiciones con nombre

`"conditions": { "es_eip": { "field": "eip", "equals": "Sí" } }`. Se usan con `{ "ref": "es_eip" }`. Una condición con nombre no puede contener `ref`.

### Párrafos

Cada elemento de `paragraphs` es un texto (como hoy) o `{ "text": "…", "when": condición }`. El párrafo con `when` falso se omite.

Una sección cuyos párrafos visibles queden todos omitidos se elimina, título incluido. Una sección declarada con `paragraphs: []` es error.

### Textos derivados

```json
"derived": {
  "socios": {
    "cases": [ { "when": { "field": "forma", "equals": "S.L." }, "text": "socios" } ],
    "default": "accionistas"
  },
  "por_encargo": {
    "cases": [ { "when": { "field": "encargante", "filled": true }, "text": " por encargo de {{encargante}}" } ],
    "default": ""
  }
}
```

- `cases`: lista ordenada (≥ 1); gana el primer caso cuya condición se cumpla; si ninguno, `default` (obligatorio, puede ser `""`).
- Los textos de `cases` y `default` pueden contener `{{campo}}`, pero **no** `{{derivado}}`.
- En títulos, subtítulos, encabezados y párrafos, `{{derivado}}` se usa igual que `{{campo}}`.

### Espacio de nombres e inserción

- Campos, derivados y condiciones con nombre comparten un único espacio de identificadores (`[a-z][a-z0-9_]*`); no puede haber repeticiones.
- `{{id}}` solo puede referirse a campos `text`, `textarea`, `date`, `select` o a derivados. No a `checkbox`, `multiselect` ni condiciones.

## 2. Validador (`bin/generar-documento.mjs validate`)

Los **errores** detienen la validación y se informan con la ruta exacta (p. ej. `sections[4].paragraphs[2].when.equals`). Los **avisos** se imprimen y no bloquean.

Errores:

1. Valor de `equals`/`in`/`includes` que no está en `options` del campo; el mensaje sugiere la opción más parecida (comparación sin mayúsculas ni tildes, luego distancia de edición).
2. Operador incompatible con el tipo de campo (tabla de la sección 1).
3. Referencias sin resolver: `{{id}}` en cualquier texto (incluidos párrafos objeto y textos de derivados), `field` de condiciones, `ref`.
4. `{{id}}` que apunta a `checkbox`, `multiselect` o condición; `{{derivado}}` dentro de un derivado; `ref` dentro de una condición con nombre; `when` de un campo que usa un campo declarado después (o el propio).
5. Identificadores repetidos entre campos, derivados y condiciones.
6. Profundidad > 3; `all`/`any` con menos de 2 elementos; objeto de condición con cero o varias claves operadoras; claves desconocidas.
7. Construcciones de versión 2 bajo `schema_version: 1`.
8. Sección o párrafo **inalcanzable**: ninguna combinación de valores puede mostrarlo. Se comprueba enumerando las combinaciones de los campos que intervienen en su condición (valores de `select`, `checkbox` marcado/no, cada opción de `multiselect` presente/ausente, para campos `text`: vacío, cada valor citado en condiciones y «otro valor»; para `textarea`/`date`: vacío o no; aplicando la visibilidad de campos). Si el número de combinaciones relevantes supera 4096, se emite aviso en lugar de error.

Avisos:

- Campo no usado en ningún texto ni condición.
- Opción de `select`/`multiselect` que ninguna condición menciona (solo si el campo interviene en alguna condición y no se inserta como texto; es normal si esa opción es la rama por defecto).
- Marcas del modelo que parecen haberse colado en el texto: `[●]`, `XXX`, `[Incluir…]`, `[Adaptar…]`, notas al pie `[n]`, `[^n]`, `[RECUADRO]`.
- Comprobación de alcanzabilidad omitida por exceso de combinaciones.

`render` ejecuta la misma validación antes de generar el HTML.

## 3. Motor en el navegador

### Evaluador compartido

Archivo nuevo `assets/evaluator.js`, sin dependencias, utilizable en navegador y en Node (exporta en `globalThis` y como módulo):

- `isEmpty(field, value)`: única definición de vacío: texto que solo contiene espacios, lista sin elementos, casilla no marcada. Un `checkbox` con `required: true` obliga, por tanto, a marcarlo (uso típico: «confirmo que…»).
- `evaluate(condition, data, spec)`.
- `visibleFields(spec, data)`: aplica `when` de campos; los campos ocultos se tratan como vacíos en el resto de la evaluación.
- `buildModel(spec, data, { markMissing })`: resuelve visibilidad de campos, derivados, condiciones de sección y párrafo, elimina secciones vacías y sustituye marcadores. Devuelve `{ title, subtitle, sections: [{ heading, paragraphs: string[] }], sources, stats: { included, total } }`.

El renderizador inserta `evaluator.js` en el HTML junto a `assistant-runtime.js`. El validador de Node importa el mismo archivo.

### Runtime (`assets/assistant-runtime.js`)

- `collect()` devuelve valores tipados: `string` (`text`, `textarea`, `date`, `select`), `boolean` (`checkbox`), `string[]` (`multiselect`).
- `checkbox` se muestra como casilla con etiqueta; `multiselect` como grupo de casillas (`fieldset` con `legend`).
- En cada `input`/`change` se recalcula la visibilidad de campos; los ocultos conservan su contenido.
- Progreso y botón «Generar documento» cuentan solo los obligatorios visibles; el botón lleva el foco al primero sin completar.
- Vista previa: huecos sin rellenar como `[Etiqueta]`; un derivado cuyo caso depende de un campo vacío toma su `default`. Línea informativa «N de M secciones incluidas según tus respuestas».
- Vista previa, DOCX e impresión consumen `buildModel()`. `docxXml()` y `zip()` no cambian.

### Compatibilidad

Una plantilla v1 produce exactamente la misma salida que hoy (prueba de referencia).

## 4. Pruebas y documentación

### Pruebas (`node:test`, sin dependencias nuevas)

Directorio `tests/generar-documento/` (fuera de `skills/` para que `scripts/package.py` no empaquete las pruebas):

- `evaluator.test.mjs`: tablas de verdad por operador; campo oculto evaluado como vacío; orden de casos y `default` de derivados; eliminación de secciones vacías.
- `validator.test.mjs`: un caso de rechazo por cada error de la sección 2 (incluida la sugerencia «Favorable»), y cada aviso.
- `render.test.mjs`: `examples/carta-encargo.json` produce la misma salida de `buildModel()` que la referencia guardada; una plantilla de prueba v2 con todas las piezas valida, renderiza y genera el resultado esperado para dos o tres combinaciones de respuestas.
- Plantillas de prueba con estructura inspirada en 1728 y 1163 y **texto sintético**; no se incorpora texto del ICJCE al repositorio.

`scripts/validate.py` ejecuta `node --test tests/generar-documento/*.test.mjs` y comprueba la existencia de `assets/evaluator.js`.

### Documentación de la habilidad

- `references/analisis-modelo.md`: nueva sección «Reconocer la variación del modelo» con la tabla de correspondencias marca → pieza:

  | Marca en el modelo | Pieza |
  |---|---|
  | «Incluir esta sección/párrafo solo si…», «en su caso», «si procede», «cuando proceda» | `checkbox` + `when`; `multiselect` si son varias de la misma familia |
  | «Aplicable solo a EIP / consolidadas / cotizadas / voluntarias» | `select` + `equals`/`in`, con `all`/`any` si se cruzan |
  | Alternativas completas («sustituir por…», «Alternativa A/B») | `select` + un párrafo o sección por variante |
  | «[A/B]» dentro de la frase (Accionistas/Socios, Sociedad/Grupo, singular/plural) | `derived` ligado a un `select` |
  | Fragmento opcional en línea («[por encargo de…]») | `derived` con caso `filled` y `default` vacío |
  | Dato que solo se pide en una variante | campo con `when` |
  | Huecos («[ABC, S.A.]», «[XX de XXXX de 20XX]», «[describir…]») | campo `text`/`date`/`textarea` |
  | Notas al pie, «[Publicado mediante…]», instrucciones al auditor, recuadros | se eliminan; si condicionan algo, se convierten en condición |
  | Listas o tablas repetibles | aún no soportado: `textarea` y aviso al usuario |
  | Variación no representable fielmente | preguntar al usuario o asistentes separados; nunca aproximar |

  La matriz de inventario gana la columna «Marca del modelo → pieza». El control final exige `validate` sin errores y revisión explícita de cada aviso.
- `references/esquema-json.md`: documenta la versión 2 completa con un ejemplo mínimo de cada pieza.
- `SKILL.md`: remite a la nueva sección; sustituye la indicación de crear asistentes separados cuando se combinan condiciones; indica usar `schema_version: 2` cuando el modelo tenga variación.

## Sin cambios

Flujo MCP (buscar → leer → inventario → JSON → validar → renderizar), exportación DOCX y PDF, otros clientes y habilidades. El paquete de `dist/` se regenera con `scripts/package.py` en la entrega, no en este subproyecto.

## Criterios de aceptación

- Todas las pruebas de `node --test` y `scripts/validate.py` pasan.
- `examples/carta-encargo.json` genera salida idéntica a la actual.
- La plantilla de prueba v2 cubre cada operador, `checkbox`, `multiselect`, `when` en campo, sección y párrafo, `derived` y `conditions`, y se abre y exporta a DOCX en el navegador.
- Cada error de la sección 2 tiene una prueba de rechazo.
