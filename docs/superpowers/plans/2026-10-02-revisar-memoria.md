# Habilidad revisar-memoria-cuentas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir al plugin `icjce-auditoria` la habilidad de análisis `revisar-memoria-cuentas`, que revisa la memoria de unas cuentas anuales frente al modelo de memoria de su marco y produce un informe de omisiones en el chat.

**Architecture:** Habilidad solo de prosa: `SKILL.md` y tres referencias (`marcos-y-umbrales.md`, `cruces-basicos.md`, `formato-informe.md`). El modelo anfitrión lee, contrasta y redacta con su conocimiento y la web; el MCP del ICJCE (`indice_norma` primero, `leer_articulo` después) aporta el texto oficial vigente. Se integra en `validate.py`, `install_opencode.py` y el README, y se prueba con cuentas sintéticas y dos subagentes (sin y con la habilidad).

**Tech Stack:** Markdown, Python 3 (`scripts/validate.py` con jsonschema y PyYAML), subagentes de Claude Code para la prueba de comportamiento.

**Spec:** `docs/superpowers/specs/2026-10-02-revisar-memoria-design.md`

## Global Constraints

- Texto en español, estilo de las habilidades existentes (`skills/consultar-icjce-mcp/SKILL.md`): herramientas del MCP nombradas sin prefijo; ninguna cadena `mcp__` en `SKILL.md`; descripción ≤ 1024 caracteres.
- Solo fuentes oficiales (BOE, ICAC/BOICAC, ICJCE). Ninguna referencia a manuales KPMG ni a «101 preguntas».
- Ningún importe de umbral fijo en las referencias: los umbrales se leen en la norma.
- Estados del informe exactamente: Omisión, Incompleto, No aplica, A verificar.
- Sin código nuevo en la habilidad.
- Escribe los caracteres no ASCII literalmente (no escapes `\u`); comprueba con `grep -c '\\u0' <archivo>` → 0.
- Las cuentas sintéticas son inventadas; las cuentas reales de clientes nunca se suben ni publican.

**User decisions (already made):**
- «las 3»: alcance PGC (normal/abreviada) y PGC PYMES, NOFCAC y adaptaciones sectoriales.
- «a, informe en el chat»: entregable en el chat (exportable a Word con la habilidad del cliente si existe).
- «a, con cruces básicos»: incluye cruces de cifras con balance y cuenta de pérdidas y ganancias.
- «los manuales de KPMG y 101 preguntas no va estar disponibles (es bibliografía interna)».
- Las habilidades son un complemento: el modelo usa siempre su conocimiento y su búsqueda web; las fuentes del MCP están actualizadas y prevalecen; primero `indice_norma`, luego `leer_articulo`.

---

### Task 1: Cuentas sintéticas y resultado esperado

**Goal:** Crear la prueba de comportamiento (cuentas inventadas con cinco defectos sembrados y el resultado esperado) y alinear el spec con el cuarto defecto.

**Files:**
- Create: `tests/revisar-memoria/cuentas-sinteticas.md`
- Create: `tests/revisar-memoria/esperado.md`
- Modify: `docs/superpowers/specs/2026-10-02-revisar-memoria-design.md:73`

**Acceptance Criteria:**
- [ ] Los dos archivos existen con el contenido exacto de abajo.
- [ ] En el spec, el cuarto defecto sembrado es «deudas con empresas del grupo sin nota de operaciones con partes vinculadas» (en lugar de «falta el número medio de empleados por sexo»).
- [ ] Ningún archivo contiene escapes `\u`.

**Verify:** `grep -c "partes vinculadas" docs/superpowers/specs/2026-10-02-revisar-memoria-design.md tests/revisar-memoria/esperado.md` → ≥ 1 en cada uno; `grep -c "por sexo" docs/superpowers/specs/2026-10-02-revisar-memoria-design.md` → 0

**Steps:**

- [ ] **Step 1: Crear** `tests/revisar-memoria/cuentas-sinteticas.md` — contenido completo:

````markdown
# Cuentas anuales de prueba — Talleres Ejemplo, S.L.

> **Datos inventados** para probar la habilidad `revisar-memoria-cuentas`. No corresponden a ninguna entidad real.

Ejercicio terminado el 31 de diciembre de 2025 (comparativo 2024). Sociedad de responsabilidad limitada, actividad de mecanizado de piezas metálicas. No pertenece a ningún grupo obligado a consolidar, no cotiza y su moneda funcional es el euro. La sociedad declara aplicar el Plan General de Contabilidad de Pequeñas y Medianas Empresas.

## Datos generales

| Concepto | 2025 | 2024 |
|---|---|---|
| Total activo | 1.812.000 € | 1.704.500 € |
| Importe neto de la cifra de negocios | 2.940.000 € | 2.715.000 € |
| Número medio de trabajadores | 14 | 13 |

## Balance (PGC PYMES) a 31 de diciembre

| Activo | 2025 | 2024 |
|---|---|---|
| A) Activo no corriente | 598.400 | 640.100 |
| I. Inmovilizado intangible | 12.000 | 15.000 |
| II. Inmovilizado material | 586.400 | 625.100 |
| B) Activo corriente | 1.213.600 | 1.064.400 |
| I. Existencias | 420.000 | 365.000 |
| II. Deudores comerciales y otras cuentas a cobrar | 610.300 | 548.900 |
| III. Efectivo y otros activos líquidos equivalentes | 183.300 | 150.500 |
| **Total activo** | **1.812.000** | **1.704.500** |

| Patrimonio neto y pasivo | 2025 | 2024 |
|---|---|---|
| A) Patrimonio neto | 1.026.300 | 940.000 |
| Capital | 60.000 | 60.000 |
| Reservas | 880.000 | 820.000 |
| Resultado del ejercicio | 86.300 | 60.000 |
| B) Pasivo no corriente | 280.000 | 330.000 |
| Deudas con entidades de crédito a largo plazo | 280.000 | 330.000 |
| C) Pasivo corriente | 505.700 | 434.500 |
| Deudas con empresas del grupo y asociadas a corto plazo | 150.000 | 150.000 |
| Acreedores comerciales y otras cuentas a pagar | 355.700 | 284.500 |
| **Total patrimonio neto y pasivo** | **1.812.000** | **1.704.500** |

## Cuenta de pérdidas y ganancias (PGC PYMES)

| Concepto | 2025 | 2024 |
|---|---|---|
| Importe neto de la cifra de negocios | 2.940.000 | 2.715.000 |
| Aprovisionamientos | (1.410.000) | (1.320.000) |
| Gastos de personal | (690.000) | (640.000) |
| Otros gastos de explotación | (560.000) | (540.000) |
| Amortización del inmovilizado | (95.700) | (92.000) |
| **Resultado de explotación** | **184.300** | **123.000** |
| Gastos financieros | (69.300) | (43.000) |
| **Resultado antes de impuestos** | **115.000** | **80.000** |
| Impuesto sobre beneficios | (28.700) | (20.000) |
| **Resultado del ejercicio** | **86.300** | **60.000** |

## Memoria (PGC PYMES)

### 1. Actividad de la empresa
Talleres Ejemplo, S.L. se constituyó en 1998 y tiene su domicilio en Valladolid. Su actividad es el mecanizado de piezas metálicas para la industria del automóvil.

### 2. Bases de presentación de las cuentas anuales
Las cuentas anuales se han preparado a partir de los registros contables de la sociedad, de acuerdo con el Plan General de Contabilidad de Pequeñas y Medianas Empresas, para mostrar la imagen fiel del patrimonio, de la situación financiera y de los resultados. No ha habido cambios de criterios contables ni corrección de errores. Las cifras se presentan en euros.

### 3. Aplicación de resultados
Los administradores proponen la siguiente aplicación del resultado del ejercicio:

| Base de reparto | Importe |
|---|---|
| Pérdidas y ganancias | 83.600 |
| **Aplicación** | |
| A reservas voluntarias | 83.600 |

### 4. Normas de registro y valoración
- **Inmovilizado intangible**: aplicaciones informáticas valoradas por su coste y amortizadas linealmente en cuatro años.
- **Inmovilizado material**: valorado por su coste de adquisición menos la amortización acumulada; se amortiza linealmente según la vida útil estimada (construcciones 33 años, maquinaria 10 años, utillaje 4 años).
- **Activos financieros y pasivos financieros**: se valoran a coste amortizado.
- **Impuesto sobre beneficios**: el gasto se determina por el impuesto corriente; no hay diferencias temporarias significativas.
- **Ingresos y gastos**: se registran según el principio de devengo.

### 5. Inmovilizado material e intangible

| Inmovilizado material | Saldo inicial | Altas | Bajas | Saldo final |
|---|---|---|---|---|
| Coste | 1.452.100 | 54.000 | — | 1.506.100 |
| Amortización acumulada | (827.000) | (66.700) | — | (893.700) |
| **Valor neto contable** | **625.100** | | | **612.400** |

| Inmovilizado intangible | Saldo inicial | Altas | Bajas | Saldo final |
|---|---|---|---|---|
| Coste | 40.000 | — | — | 40.000 |
| Amortización acumulada | (25.000) | (3.000) | — | (28.000) |
| **Valor neto contable** | **15.000** | | | **12.000** |

### 6. Activos financieros
Los deudores comerciales se valoran a coste amortizado. No se han registrado correcciones por deterioro en el ejercicio.

### 7. Pasivos financieros
Las deudas con entidades de crédito tienen vencimiento en 2031 y devengan un tipo de interés variable referenciado al euríbor. No existen garantías reales.

### 8. Fondos propios
El capital social está formado por 6.000 participaciones de 10 euros de valor nominal, totalmente desembolsadas.

### 9. Situación fiscal
El gasto por impuesto sobre beneficios del ejercicio asciende a 28.700 euros. La sociedad tiene abiertos a inspección los cuatro últimos ejercicios para los impuestos que le son aplicables.

### 10. Otra información
El número medio de personas empleadas en el ejercicio ha sido de 14. Los honorarios por la auditoría de las cuentas anuales del ejercicio han ascendido a 9.500 euros.

### 11. Hechos posteriores al cierre
No se han producido hechos posteriores significativos.
````

- [ ] **Step 2: Crear** `tests/revisar-memoria/esperado.md` — contenido completo:

````markdown
# Resultado esperado de la revisión — Talleres Ejemplo, S.L.

Prueba de comportamiento de `revisar-memoria-cuentas` sobre `cuentas-sinteticas.md` (datos inventados).

## Detecciones obligatorias (las cinco sembradas)

| # | Hallazgo esperado | Estado esperado |
|---|---|---|
| 1 | No hay información sobre el **periodo medio de pago a proveedores** (Ley 15/2010 y Resolución del ICAC; obligatoria también en la memoria del PGC PYMES). | Omisión |
| 2 | El **valor neto contable final del inmovilizado material** del cuadro de la nota 5 (612.400) no coincide con el balance (586.400). Además, la amortización del cuadro (66.700 + 3.000) no coincide con la de la cuenta de pérdidas y ganancias (95.700). | A verificar |
| 3 | Hay **existencias** significativas en balance (420.000) y la nota 4 no recoge su norma de registro y valoración (ni hay información sobre existencias). | Omisión o Incompleto |
| 4 | El balance muestra **deudas con empresas del grupo** (150.000) y la memoria no tiene nota de **operaciones con partes vinculadas**. | Omisión |
| 5 | La **aplicación del resultado** propuesta (83.600) no coincide con el resultado del ejercicio (86.300). | A verificar |

## Requisitos de forma

- Determina el marco (**PGC PYMES**) y lo justifica con las cifras de umbral de los dos ejercicios y la ausencia de exclusiones (no cotiza, no consolida, euro), indicando que los umbrales vigentes se comprueban en la norma (TRLSC / RD 1515/2007) y no de memoria.
- Cada requisito tiene una **fuente** (enlace del MCP, URL oficial del BOE/ICAC o, si no la ha podido contrastar, una marca explícita de que procede del conocimiento del modelo).
- Usa solo los estados **Omisión, Incompleto, No aplica, A verificar**.
- Incluye la tabla de cruces con los estados.
- Termina con la lista de puntos a revisar por el auditor y el **aviso** de que no sustituye el juicio profesional ni es una opinión de auditoría.
- No emite opinión de auditoría ni juzga la importancia relativa.
- Si no tiene el MCP del ICJCE, lo dice expresamente.
````

- [ ] **Step 3: Alinear el spec.** En la línea 73 del spec, sustituye `falta el número medio de empleados por sexo` por `hay deudas con empresas del grupo y no hay nota de operaciones con partes vinculadas`.

- [ ] **Step 4: Commit**

```bash
git add tests/revisar-memoria docs/superpowers/specs/2026-10-02-revisar-memoria-design.md
git commit -m "Add synthetic accounts for the memoria review test"
```

### Task 2: SKILL.md y referencias

**Goal:** Crear la habilidad `revisar-memoria-cuentas` con su `SKILL.md` y las tres referencias.

**Files:**
- Create: `skills/revisar-memoria-cuentas/SKILL.md`
- Create: `skills/revisar-memoria-cuentas/references/marcos-y-umbrales.md`
- Create: `skills/revisar-memoria-cuentas/references/cruces-basicos.md`
- Create: `skills/revisar-memoria-cuentas/references/formato-informe.md`

**Acceptance Criteria:**
- [ ] Los cuatro archivos existen con el contenido exacto de abajo.
- [ ] Frontmatter con `name: revisar-memoria-cuentas` y descripción de ≤ 1024 caracteres; sin `mcp__`.
- [ ] Ninguna referencia contiene importes en euros de umbrales ni las palabras KPMG o «101 preguntas».

**Verify:** `grep -rn -i "kpmg\|101 preguntas\|mcp__" skills/revisar-memoria-cuentas` → sin resultados; `grep -rn "[0-9]\.[0-9][0-9][0-9]" skills/revisar-memoria-cuentas` → sin resultados

**Steps:**

- [ ] **Step 1: Crear** `skills/revisar-memoria-cuentas/SKILL.md` — contenido completo:

````markdown
---
name: revisar-memoria-cuentas
description: Úsala cuando el auditor pida revisar la memoria de unas cuentas anuales, comprobar que contiene la información obligatoria, detectar omisiones o contrastarla con el PGC, el PGC PYMES, las NOFCAC o una adaptación sectorial del PGC, a partir de las cuentas aportadas como PDF, DOCX o texto. Produce un informe de revisión en el chat con el estado de cada requisito, los cruces básicos con el balance y la cuenta de pérdidas y ganancias, y la fuente oficial de cada requisito. No emite opinión de auditoría.
---

# Revisión de la memoria frente al marco contable

## Forma de trabajar

Esta habilidad **complementa** tu propio análisis: usa siempre tu conocimiento contable y, cuando esté disponible, la búsqueda web en fuentes oficiales (BOE, ICAC). El MCP del ICJCE te da más potencia: su texto de las normas es **oficial y está actualizado**, así que cuando cubre una norma es la referencia que citas y prevalece sobre lo que recuerdes. Si una fuente no está en el MCP, búscala en la web antes de pedírsela al usuario.

Para cualquier norma, **empieza por `indice_norma`** (índice oficial y vigente con el `block_id` y el enlace de cada artículo o disposición) y lee el literal con `leer_articulo` antes de afirmar lo que dice. No cites ningún apartado que no aparezca en el índice. Descubre las operaciones y sus parámetros en el propio cliente.

## Flujo

1. **Lee las cuentas** aportadas y anota: entidad, ejercicio y comparativo, forma social, si son individuales o consolidadas, formato de los estados (normal, abreviado, PYMES), sector y las cifras de umbral de los dos últimos ejercicios (total activo, importe neto de la cifra de negocios, número medio de trabajadores).
2. **Determina el marco** con `references/marcos-y-umbrales.md`. Comprueba los umbrales vigentes en la norma con `indice_norma` y `leer_articulo`; nunca los cites de memoria. Si el formato de las cuentas no corresponde al marco que resulta, esa es la primera observación del informe.
3. **Obtén el modelo de memoria vigente** del marco con `indice_norma` (por ejemplo `norma='PGC PYMES'` con `filtro='memoria'`) o, en una adaptación sectorial, con `buscar_documentos` y `leer_documento` en la fuente `contabilidad`. Lee en literal las notas que necesites contrastar con precisión. Añade las fuentes complementarias que correspondan al contenido de las cuentas (resoluciones del ICAC por tema, TRLSC, Ley 15/2010 y su resolución sobre el periodo medio de pago).
4. **Contrasta nota a nota** la memoria con el modelo y aplica los cruces de `references/cruces-basicos.md`.
5. **Redacta el informe** con la estructura de `references/formato-informe.md`.

## Reglas

- Cada requisito lleva su **fuente**: el enlace que devuelve el MCP o la URL oficial consultada. Si solo procede de tu conocimiento y no lo has podido contrastar, márcalo así.
- Usa solo estos estados: **Omisión** (falta información obligatoria), **Incompleto** (está, pero sin el contenido mínimo que exige la norma), **No aplica** (con la justificación) y **A verificar** (no puedes asegurarlo: una cifra que no cuadra o que puede estar mal leída, una lectura dudosa, un juicio de importancia relativa).
- No emitas opinión de auditoría ni juzgues la suficiencia o la importancia relativa de la información: señálalo como punto a revisar por el auditor.
- Las cuentas del cliente son **confidenciales**: trabájalas solo en esta conversación; no las publiques ni las subas a servicios externos.

**Si falta una fuente:** si el MCP no está disponible, dilo al principio del informe, trabaja con tu conocimiento y fuentes oficiales web, y marca que los requisitos no se han contrastado con el texto del MCP. Nunca afirmes haber consultado el MCP o la web si no lo hiciste.

## Referencias

| Para | Referencia |
|---|---|
| Elegir el marco (normal, abreviada, PYMES, consolidadas, adaptación sectorial) y localizar su modelo de memoria | `references/marcos-y-umbrales.md` |
| Partidas que obligan a informar y cifras que deben coincidir con los estados | `references/cruces-basicos.md` |
| Estructura del informe | `references/formato-informe.md` |
````

- [ ] **Step 2: Crear** `skills/revisar-memoria-cuentas/references/marcos-y-umbrales.md` — contenido completo:

````markdown
# Marco contable y modelo de memoria

Esta referencia orienta la decisión; las condiciones y los importes vigentes se leen siempre en la norma con `indice_norma` y `leer_articulo`.

## 1. Árbol de decisión

1. **¿Son cuentas consolidadas?** → Normas para la Formulación de Cuentas Anuales Consolidadas (`norma='NOFCAC'`), con su modelo de memoria consolidada. Comprueba también si el grupo podía estar dispensado de consolidar (Código de Comercio, art. 43) y el formato que corresponde.
2. **¿Le aplica una adaptación sectorial?** (entidades sin fines lucrativos, cooperativas, sociedades anónimas deportivas, federaciones deportivas, sector eléctrico, empresas vitivinícolas, otras) → su modelo de memoria, y el PGC (o el PGC PYMES, si la adaptación lo permite) para lo que no regule.
3. **Si no**, cuentas individuales:
   - **PGC PYMES** (`norma='PGC PYMES'`) si la entidad puede aplicarlo y ha optado por él.
   - **PGC** (`norma='PGC'`), con memoria **abreviada** si puede formular balance y memoria abreviados, o **normal** en otro caso.

## 2. Qué comprobar de los umbrales

- **Magnitudes**: total activo, importe neto de la cifra de negocios y número medio de trabajadores del ejercicio.
- **Regla**: se cumplen cuando, durante **dos ejercicios consecutivos**, a la fecha de cierre no se superan al menos dos de las tres magnitudes; se pierde la condición cuando se superan dos de ellas durante dos ejercicios consecutivos. En el primer ejercicio desde la constitución o la transformación, basta con cumplirlos al cierre de ese ejercicio. Confírmalo en la norma.
- **Dónde están**: Texto refundido de la Ley de Sociedades de Capital (`norma='TRLSC'`, filtro `abreviad`: balance y memoria abreviados, cuenta de pérdidas y ganancias abreviada) y Real Decreto 1515/2007 (`norma='PGC PYMES'`, ámbito de aplicación). Usa siempre los importes que figuren en el texto vigente que devuelva el MCP.
- **Quién no puede aplicar el PGC PYMES**, aunque cumpla los umbrales (confírmalo en la norma): entidades con valores admitidos a negociación en un mercado regulado, entidades que formen parte de un grupo que formule o deba formular cuentas consolidadas, entidades cuya moneda funcional no sea el euro y entidades financieras que capten fondos del público.
- **Incoherencias que son observación**: cuentas en formato PYMES o abreviado sin cumplir los umbrales; aplicación del PGC PYMES por una entidad excluida; memoria normal con estados abreviados, o al revés.

## 3. Dónde está cada modelo en el MCP

| Marco | Cómo localizar el modelo de memoria |
|---|---|
| PGC, memoria normal o abreviada | `indice_norma(norma='PGC', filtro='memoria')` y `leer_articulo` de los bloques del modelo |
| PGC PYMES | `indice_norma(norma='PGC PYMES', filtro='memoria')` |
| Cuentas consolidadas | `indice_norma(norma='NOFCAC', filtro='memoria')` |
| Adaptación sectorial | `buscar_documentos` en la fuente `contabilidad` con el nombre del sector y «memoria»; después `leer_documento` |
| Información adicional por tema | `indice_norma` de la resolución del ICAC del tema (patrimonio neto, inmovilizado, ingresos, instrumentos financieros, combinaciones de negocios, impuesto sobre beneficios, coste de producción, moneda extranjera, deterioro) |
| Información de la ley mercantil | `indice_norma(norma='TRLSC', filtro='memoria')` (contenido de la memoria y otros apartados obligatorios) |
| Periodo medio de pago | `indice_norma(norma='Ley 15/2010')` y la resolución del ICAC sobre la información a incorporar en la memoria |

Si el MCP no devuelve un modelo, búscalo en el BOE (texto consolidado) y cita esa URL.
````

- [ ] **Step 3: Crear** `skills/revisar-memoria-cuentas/references/cruces-basicos.md` — contenido completo:

````markdown
# Cruces básicos con los estados

Usa esta lista para que ninguna partida significativa de los estados quede sin su información en la memoria. El requisito exacto se localiza en el modelo de memoria del marco con `indice_norma`; esta lista no es una fuente.

## 1. Partidas que obligan a informar

| Si los estados muestran… | La memoria debería informar de… |
|---|---|
| Inmovilizado material, intangible o inversiones inmobiliarias | Normas de registro y valoración y cuadro de movimientos (saldo inicial, altas, bajas, amortizaciones, deterioros, saldo final) |
| Arrendamientos (gastos o activos por arrendamiento) | Naturaleza y condiciones de los contratos de arrendamiento |
| Activos y pasivos financieros | Categorías, criterios de valoración, vencimientos de las deudas, garantías y deterioros |
| Existencias | Norma de registro y valoración y, cuando proceda, correcciones valorativas |
| Saldos o transacciones en moneda extranjera | Criterios de conversión y diferencias de cambio |
| Impuesto sobre beneficios | Situación fiscal: gasto por impuesto, conciliación cuando proceda, diferencias temporarias, ejercicios abiertos a inspección |
| Provisiones o contingencias | Movimientos, naturaleza y estimaciones |
| Subvenciones, donaciones o legados | Importe, origen y criterios de imputación |
| Saldos o transacciones con empresas del grupo, asociadas, socios o administradores | Operaciones con partes vinculadas (naturaleza, saldos, transacciones) y retribuciones de administradores y alta dirección cuando proceda |
| Gastos de personal | Número medio de personas empleadas con el desglose que exija el modelo del marco |
| Honorarios de auditoría | Honorarios por la auditoría y por otros servicios cuando proceda |
| Acreedores comerciales | Periodo medio de pago a proveedores (Ley 15/2010 y su resolución del ICAC) |
| Cualquier entidad | Hechos posteriores al cierre, aplicación del resultado, bases de presentación (imagen fiel, comparación, cambios de criterio, errores) |
| Actividad con impacto ambiental | Información sobre medio ambiente cuando proceda |

## 2. Cifras que deberían coincidir

| Cruce | Si no coincide |
|---|---|
| Saldo final de cada cuadro de movimientos (inmovilizado, provisiones…) ↔ partida del balance | A verificar |
| Dotación a la amortización de los cuadros ↔ amortización de la cuenta de pérdidas y ganancias | A verificar |
| Base de reparto de la aplicación del resultado ↔ resultado del ejercicio | A verificar |
| Gasto por impuesto de la nota fiscal ↔ impuesto sobre beneficios de la cuenta de pérdidas y ganancias | A verificar |
| Desglose de la cifra de negocios ↔ importe neto de la cifra de negocios | A verificar |
| Saldos con partes vinculadas de la memoria ↔ partidas con empresas del grupo y asociadas del balance | A verificar |
| Capital y reservas de la nota de fondos propios ↔ patrimonio neto del balance | A verificar |

Una discrepancia es «A verificar», no una conclusión: puede deberse a una lectura incorrecta del documento, a reclasificaciones o a partidas que se presentan agrupadas.

## 3. Lo que no se juzga

La importancia relativa, la suficiencia del desglose y si una omisión afecta a la imagen fiel son juicios del auditor. Señálalos en la lista de puntos a revisar.
````

- [ ] **Step 4: Crear** `skills/revisar-memoria-cuentas/references/formato-informe.md` — contenido completo:

````markdown
# Formato del informe de revisión

Redacta el informe en el chat con estas secciones y en este orden. Si el usuario lo pide y el cliente dispone de una habilidad para crear documentos Word, puedes exportarlo.

## 1. Encabezado

- Entidad, ejercicio revisado y comparativo.
- **Marco aplicado** y motivo (cifras de umbral de los dos ejercicios, exclusiones comprobadas, formato de las cuentas).
- **Fuentes consultadas**: MCP del ICJCE (normas e índices leídos), búsqueda web (URLs oficiales) y fecha de la consulta. Si el MCP no estaba disponible, dilo aquí.

## 2. Resumen

Número de **omisiones**, de requisitos **incompletos** y de puntos **a verificar**, y los tres hallazgos más relevantes en una frase cada uno.

## 3. Revisión por nota

| Nota del modelo | Requisito | Estado | Observación | Fuente |
|---|---|---|---|---|

- Una fila por requisito relevante del modelo de memoria del marco; agrupa los que se cumplen sin incidencias si la tabla se hace muy larga, pero no omitas ninguna omisión ni incompleto.
- Estados: Omisión, Incompleto, No aplica, A verificar.
- Fuente: enlace del MCP o URL oficial; «conocimiento del modelo, sin contrastar» si es el caso.

## 4. Cruces con los estados

| Cruce | Estados | Memoria | Diferencia | Estado |
|---|---|---|---|---|

## 5. Puntos a revisar por el auditor

Lista numerada con lo que exige juicio profesional o comprobación en los registros: cifras a verificar, importancia relativa, suficiencia de desgloses y cualquier duda de lectura.

## 6. Aviso

> Esta revisión es una ayuda para el auditor: no sustituye su juicio profesional ni constituye una opinión de auditoría. Los requisitos citados deben comprobarse en la versión vigente de la norma aplicable al ejercicio.
````

- [ ] **Step 5: Comprobar** con los comandos de **Verify** y `grep -rc '\\u0' skills/revisar-memoria-cuentas` → 0 en todos.

- [ ] **Step 6: Commit**

```bash
git add skills/revisar-memoria-cuentas
git commit -m "Add revisar-memoria-cuentas skill"
```

### Task 3: Integración en validación, instalación y README

**Goal:** Que `validate.py`, el instalador de OpenCode y el README reconozcan la tercera habilidad.

**Files:**
- Modify: `scripts/validate.py:55` y `:75`
- Modify: `scripts/install_opencode.py:15`
- Modify: `README.md:3-6` y `:138-144`

**Acceptance Criteria:**
- [ ] `scripts/validate.py` exige exactamente las tres habilidades y su mensaje final dice «all three skills».
- [ ] `SKILLS` del instalador incluye `revisar-memoria-cuentas`.
- [ ] El README habla de tres habilidades, describe la nueva e incluye su instalación en Hermes.

**Verify:** `python3 scripts/validate.py` (con jsonschema y PyYAML instalados) → última línea `OK: plugin schemas; OpenCode and Hermes MCP; metadata, marketplace, all three skills, renderer assets and tests`

**Steps:**

- [ ] **Step 1: validate.py.** Línea 55:

```python
    assert {path.parent.name for path in skills} == {'consultar-icjce-mcp', 'generar-documento-auditoria', 'revisar-memoria-cuentas'}
```

Línea 75: sustituye `both skills` por `all three skills`.

- [ ] **Step 2: install_opencode.py.** Línea 15:

```python
SKILLS = ("consultar-icjce-mcp", "generar-documento-auditoria", "revisar-memoria-cuentas")
```

- [ ] **Step 3: README.** Línea 3: `El repositorio contiene tres habilidades compartidas por los cuatro clientes:`. Tras la línea 6 añade:

```markdown
- `revisar-memoria-cuentas` revisa la memoria de unas cuentas anuales frente al modelo de su marco (PGC normal o abreviado, PGC PYMES, NOFCAC o adaptación sectorial). Determina el marco con los umbrales vigentes, contrasta nota a nota con el índice y el texto oficial del MCP, cruza cifras con el balance y la cuenta de pérdidas y ganancias y devuelve en el chat un informe de omisiones con la fuente de cada requisito. No emite opinión de auditoría.
```

En la sección Hermes, cambia «Instala ambas habilidades:» por «Instala las tres habilidades:» y añade tras la línea de `generar-documento-auditoria`:

```sh
hermes skills install sleiva/icjce-pluggin/skills/revisar-memoria-cuentas
```

- [ ] **Step 4: Validar** con el comando de **Verify**; `grep -n "ambas\|dos habilidades" README.md` no debe referirse al conjunto de habilidades.

- [ ] **Step 5: Commit**

```bash
git add scripts/validate.py scripts/install_opencode.py README.md
git commit -m "Register revisar-memoria-cuentas in validation, installer and README"
```

### Task 4: Prueba de comportamiento (la ejecuta el controlador)

**Goal:** Comprobar con dos subagentes, uno sin la habilidad y otro con ella, que la habilidad cumple los criterios de `tests/revisar-memoria/esperado.md`, y registrar el resultado.

**Files:**
- Create: `tests/revisar-memoria/resultados.md`
- Modify (solo si la prueba con habilidad falla): `skills/revisar-memoria-cuentas/SKILL.md` o sus referencias

**Acceptance Criteria:**
- [ ] Con la habilidad: las cinco detecciones de `esperado.md`, marco PGC PYMES justificado, una fuente por requisito, solo los cuatro estados, tabla de cruces, puntos a revisar, aviso final y declaración de que no tiene el MCP.
- [ ] Sin la habilidad: al menos un criterio de `esperado.md` falla (línea base).
- [ ] `resultados.md` recoge, por criterio, cumple / no cumple en cada ejecución y los cambios hechos a la habilidad si hubo iteración.

**Verify:** `grep -c "Cumple\|No cumple" tests/revisar-memoria/resultados.md` → ≥ 2 filas por criterio de `esperado.md`

**Steps:**

- [ ] **Step 1: Línea base.** Lanza un subagente (sonnet) sin MCP del ICJCE con este encargo: «Eres el asistente de un auditor en España. Revisa la memoria de las cuentas de `tests/revisar-memoria/cuentas-sinteticas.md` frente al marco contable que les aplique y redacta en tu respuesta un informe de omisiones. Puedes usar la búsqueda web. No leas otros archivos del repositorio.» Guarda su respuesta en el workspace del plan.
- [ ] **Step 2: Con la habilidad.** Lanza otro subagente (sonnet) con el mismo encargo, añadiendo: «Antes de empezar, lee y sigue `skills/revisar-memoria-cuentas/SKILL.md` y las referencias que cita. No leas otros archivos del repositorio.» Guarda su respuesta.
- [ ] **Step 3: Evaluar** las dos respuestas criterio a criterio contra `esperado.md`.
- [ ] **Step 4: Iterar si falla** la ejecución con habilidad: corrige la instrucción del `SKILL.md` o de la referencia que explica el fallo (sin añadir importes ni bibliografía interna), vuelve a ejecutar el Step 2 y evalúa. Máximo tres iteraciones; ejecuta `python3 scripts/validate.py` tras cada cambio.
- [ ] **Step 5: Registrar** en `tests/revisar-memoria/resultados.md`: fecha, modelo de los subagentes, una tabla «Criterio | Sin habilidad | Con habilidad» con «Cumple» o «No cumple» y una nota breve, y la lista de cambios por iteración. No copies los informes completos.

- [ ] **Step 6: Commit**

```bash
git add tests/revisar-memoria/resultados.md skills/revisar-memoria-cuentas
git commit -m "Record behavior test of revisar-memoria-cuentas"
```
