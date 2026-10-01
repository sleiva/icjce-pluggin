# Generación por lotes en `generar-documento-auditoria`

Fecha: 2026-10-01 · Subproyecto 3 de 4 de la ampliación del motor documental · Estado: diseño aprobado en conversación, pendiente de revisión escrita.

Depende de los subproyectos 1 (condiciones, v0.5.0) y 2 (grupos repetibles, `main` desde 52ff135).

## Objetivo

Que el asistente HTML genere **N documentos** a partir de una plantilla v2, unos datos comunes y un listado de destinatarios cargado por el auditor (circularizaciones a bancos, clientes, proveedores, asesores legales). El listado se procesa solo en el navegador del auditor: no pasa por el chat ni por el modelo.

Fuera de alcance: grupos (tablas) distintos por destinatario —los grupos siguen siendo comunes al lote—, generación por lotes en línea de comandos, formato numérico configurable (subproyecto 4), hojas distintas de la primera en `.xlsx`.

## Evidencia

- **5350**, Guía de Actuación 09, modelo de carta de confirmación de asesores legales: datos comunes (auditor, fecha de cierre, umbral «superiores a ---- euros», fecha prevista del informe, dirección de respuesta) y datos por destinatario (despacho, dirección, «Muy Sr(s). nuestro(s)», «le(s)»); Anexo I de litigios por despacho (fuera de alcance).
- En `kg_icjce_*` no hay modelos con texto de cartas a bancos, clientes o proveedores; el patrón de NIA-ES 505 y la práctica es el mismo: carta común + nombre, dirección y, en clientes/proveedores, saldo a confirmar.
- Excel en español guarda CSV con `;` y, salvo «CSV UTF-8», en Windows-1252.

## 1. Esquema y validador

### Bloque `batch` (opcional, `schema_version: 2`)

```json
"batch": {
  "label": "Destinatarios",
  "fields": ["destinatario", "direccion", "tratamiento", "saldo"],
  "filename": "Confirmación {{destinatario}}"
}
```

- Claves admitidas: `label`, `fields`, `filename`.
- `label`: texto obligatorio (máximo 120), título de la sección del listado.
- `fields`: entre 1 y 20 identificadores, sin repetir, de campos declarados en `fields` con tipo `text`, `textarea`, `date` o `select`. Pueden tener `required` y `when`; se evalúan por fila.
- `filename`: texto obligatorio (máximo 200) que admite `{{campo}}` y `{{derivado}}` insertables y debe contener al menos un campo de `batch.fields`.
- Máximo 500 destinatarios por lote (lo aplica la carga).

### Errores nuevos

1. `batch` bajo `schema_version: 1` (`batch: requiere schema_version 2`); claves desconocidas.
2. `label` vacío; `fields` ausente, vacío, con más de 20 o con repeticiones.
3. `batch.fields[i]`: identificador que no es un campo (`batch.fields[2]: saldos no es un campo`); campo de tipo `checkbox`, `multiselect` o `group` (`batch.fields[1]: el campo incorrecciones es group y no puede venir del listado`).
4. `filename` vacío, con marcadores no válidos (mismas reglas que un texto normal) o sin ningún campo del lote (`batch.filename debe usar al menos un campo de batch.fields`).

### Aviso nuevo

- Campo del lote que no aparece en ningún texto ni en `filename`.

## 2. Lectura del listado (`assets/tabular.js`)

Módulo sin dependencias que expone `globalThis.DocTabular`; se incrusta en el HTML después de `docx.js` y antes del runtime, y se prueba en Node.

- `parseDelimited(text)` → `string[][]`. Separador detectado en la primera línea no vacía: tabulador si aparece; si no, `;` o `,` (el que más aparezca fuera de comillas). Comillas dobles, `""` como comilla literal, saltos de línea dentro de comillas, `\r\n` y `\r`. Se eliminan las filas cuyas celdas están todas vacías y se recortan los espacios de cada celda.
- `decodeText(bytes)` → texto. Quita el BOM UTF-8; intenta UTF-8 estricto (`TextDecoder('utf-8', { fatal: true })`); si falla, `windows-1252`.
- `readXlsx(bytes)` → `Promise<string[][]>`. Lee el directorio central del ZIP; descomprime con `DecompressionStream('deflate-raw')` (o sin compresión); resuelve la primera hoja mediante `xl/workbook.xml` y `xl/_rels/workbook.xml.rels`; textos compartidos (`xl/sharedStrings.xml`, concatenando los `<t>` de cada `<si>`), `inlineStr`, `str`, `b` (`VERDADERO`/`FALSO`) y números; huecos por referencia de celda. XML leído con expresiones acotadas y decodificación de entidades (`&amp;` `&lt;` `&gt;` `&quot;` `&apos;` `&#n;` `&#xh;`). Cada celda es un texto, salvo las numéricas, que se devuelven como `{ number: "1234.5" }` (valor en notación JavaScript) para que `mapRows` las convierta según el tipo del campo. `DocTabular` expone también `readZip(bytes)` → `Promise<Map<nombre, Uint8Array>>`, que usa `readXlsx` internamente.
- Límites: archivo ≤ 5 MB; contenido descomprimido total ≤ 20 MB; 500 filas de datos; 50 columnas. Superarlos lanza un error con mensaje en español.
- `mapRows(spec, table)` → `{ columns, ignored, errors, rows }`, donde `table` es la salida de `parseDelimited` o de `readXlsx`:
  - Primera fila = encabezados. Normalización para comparar: minúsculas, sin tildes, espacios y guiones convertidos a `_`, recortado. Un encabezado corresponde al campo cuyo `id` o `label` normalizado coincide.
  - `columns`: mapa campo → índice de columna. `ignored`: encabezados sin campo (aviso).
  - `errors` (bloquean la carga): falta la columna de un campo del lote con `required: true`; encabezados que apuntan al mismo campo; ninguna fila de datos; más de 500 filas.
  - `rows`: por fila, `{ values, errors }`. `values` solo contiene campos del lote. Conversión por tipo: `select` → opción equivalente tras normalizar (si no, error `Fila N: "x" no es una opción de <etiqueta>`); `date` → `aaaa-mm-dd` desde `dd/mm/aaaa`, `d/m/aaaa`, `aaaa-mm-dd` o número de serie de Excel (si no, error); `text`/`textarea` con número de Excel → formato `es-ES` con dos decimales si tiene parte decimal y sin decimales si es entero (redondeo a 2). Valores de CSV o pegados se conservan tal cual. `required` vacío en un campo visible para esa fila → error `Fila N: falta <etiqueta>` (la visibilidad se evalúa con `effectiveData` sobre los datos comunes más los de la fila).

## 3. Asistente y exportación

### Empaquetado (`assets/docx.js`)

Se mueven del runtime a `docx.js` el ZIP y el paquete DOCX:

- `zipStore(entries)` → `Uint8Array`: `entries` es `[nombre, texto | Uint8Array]`; mismo algoritmo actual (sin compresión, CRC-32, fecha y hora cero, UTF-8 en nombres).
- `docxPackage(output)` → `Uint8Array`: las cinco partes actuales (`[Content_Types].xml`, `_rels/.rels`, `word/document.xml`, `word/styles.xml`, `word/_rels/document.xml.rels`) con el mismo contenido.
- `DocExport` expone además `zipStore`, `docxPackage` y `safeFilename(name, used)`: elimina `/ \ : * ? " < > |` y caracteres de control, colapsa espacios, recorta a 80 caracteres, usa `documento` si queda vacío y, si `used` (un `Set`) ya lo contiene, añade ` (2)`, ` (3)`…; registra el resultado en `used`.
- Un DOCX individual tiene exactamente los mismos bytes que con el código anterior (prueba de referencia).

### Runtime (`assets/assistant-runtime.js`)

- Con `spec.batch`, selector «Un documento / Varios destinatarios» encima del formulario. En «Un documento» el comportamiento es el actual.
- En «Varios destinatarios»: los campos de `batch.fields` se ocultan del formulario común y aparece la sección `batch.label` con un `textarea` «Pega aquí las celdas copiadas de Excel (con la fila de encabezados)», un selector de archivo (`.xlsx`, `.csv`, `.txt`) y un botón «Cargar listado». Tras cargar: resumen (número de destinatarios, columnas reconocidas e ignoradas), errores de carga y lista de destinatarios con el nombre de archivo de cada uno y su estado. Seleccionar un destinatario muestra su documento en la vista previa; botones «‹ Anterior» y «Siguiente ›».
- Datos de cada documento = datos comunes del formulario + `values` de la fila (los de la fila prevalecen).
- Progreso en modo lote: obligatorios comunes visibles + el listado (cuenta como un campo: completo si hay al menos una fila, sin errores de carga ni de fila).
- «Generar documento» en modo lote: exige lo anterior y enfoca el primer problema; en el paso 2, «N documentos listos» y acciones «Descargar ZIP» (nombre del ZIP a partir del título de la plantilla), «Descargar este DOCX» (destinatario seleccionado) y «Exportar PDF» (todas las cartas en el área de impresión, cada una con `break-before: page` salvo la primera).
- Cambiar datos comunes o el listado invalida el resultado generado, como hoy.
- El listado no se guarda ni se envía a ningún sitio.

## 4. Pruebas y documentación

Pruebas en `tests/generar-documento/` (`node:test`, sin dependencias):

- `tabular.test.mjs`: `parseDelimited` (tabulador, `;`, `,`, comillas, `""`, saltos dentro de celda, `\r\n`, filas vacías); `decodeText` (UTF-8 con y sin BOM, Windows-1252 con `0xF1`); `readXlsx` con un `.xlsx` sintético construido en la prueba con `zipStore` y `CompressionStream('deflate-raw')` (textos compartidos, texto enriquecido, huecos, número, fecha serial, booleano) y rechazo por tamaño de archivo y de descompresión; `mapRows` (emparejamiento por id y etiqueta, columnas ignoradas, obligatoria ausente, fila con obligatorio vacío, `select` normalizado y erróneo, fechas, número de Excel a `es-ES`, límite de 500 filas, campo con `when` oculto en una fila).
- `docx.test.mjs`: `docxPackage` de la carta de encargo con los mismos bytes que una referencia capturada del runtime anterior; un ZIP con dos DOCX legible con `DocTabular.readZip`; `safeFilename`.
- `batch.test.mjs`: rechazo por cada error de la sección 1 y el aviso.
- `render-docx.test.mjs`: el HTML incrusta `DocTabular` después de `DocExport` y antes del runtime.
- Plantilla sintética `fixtures/confirmacion-saldos.v2.json` (texto inventado): comunes entidad, fecha de cierre, auditor, dirección de respuesta; lote destinatario, dirección, tratamiento (`select` «Sr.»/«Sres.» con derivado) y saldo.
- Navegador: pegar 3 filas, subir un `.xlsx` y un `.csv` en Windows-1252, errores por fila, navegación, ZIP con 3 DOCX, PDF con salto de página entre cartas, modo «Un documento» sin cambios.

Documentación:

- `references/esquema-json.md`: sección «Generación por lotes (v2)».
- `references/analisis-modelo.md`: regla para cartas enviadas a varios destinatarios con el mismo texto → datos del destinatario en `batch.fields`; los anexos distintos por destinatario no admiten lote.
- `SKILL.md`: mención de `batch` y obligación de indicar al usuario qué columnas debe preparar y que el listado no sale de su navegador.
- `scripts/validate.py`: comprueba la existencia de `assets/tabular.js`.

## Criterios de aceptación

- `node --test tests/generar-documento/*.test.mjs` y `scripts/validate.py` pasan.
- Las plantillas existentes producen el mismo `buildModel`, el mismo `document.xml` y el mismo paquete DOCX que antes.
- `confirmacion-saldos.v2.json` genera en el navegador un ZIP con un DOCX por destinatario a partir de un listado pegado, de un `.xlsx` y de un `.csv` en Windows-1252.
- Cada error nuevo de la sección 1 tiene una prueba de rechazo.
