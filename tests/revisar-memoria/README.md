# Prueba de `revisar-memoria-cuentas`

La habilidad no tiene código: se prueba por su comportamiento. Esta carpeta contiene:

| Archivo | Para qué |
|---|---|
| [`cuentas-sinteticas.md`](cuentas-sinteticas.md) | Cuentas anuales inventadas de Talleres Ejemplo, S.L. (PGC PYMES, 2025 con comparativo 2024) con cinco defectos sembrados en la memoria. |
| [`esperado.md`](esperado.md) | Las cinco detecciones obligatorias, los requisitos de forma del informe y las otras detecciones legítimas que no penalizan. |
| [`resultados.md`](resultados.md) | Registro de cada ejecución: criterio a criterio, «Cumple» o «No cumple». |

## Qué se ha probado ya

El 02-10-2026 se ejecutó con subagentes de Claude (Sonnet) **sin MCP** y con búsqueda web:
sin la habilidad fallan las fuentes, los estados, la tabla de cruces, el aviso y la
comprobación de umbrales en la norma; con la habilidad cumple todos los criterios. Falta la
prueba **con el MCP del ICJCE autorizado**, que es la que comprueba que el modelo usa
`indice_norma` y `leer_articulo` y cita los enlaces que devuelven.

## Prueba con el MCP (manual)

### 1. Preparación

1. Instala el plugin o las habilidades en el cliente (Claude, ChatGPT, OpenCode o Hermes)
   siguiendo el [README](../../README.md) e inicia sesión en el MCP `icjce` con OAuth.
2. Comprueba que el cliente ve la habilidad `revisar-memoria-cuentas` y las herramientas
   `indice_norma`, `leer_articulo`, `buscar_documentos` y `leer_documento`.
3. Abre una conversación nueva para cada ejecución, de modo que no arrastre contexto.

### 2. Ejecución

Adjunta o pega el contenido de `cuentas-sinteticas.md` y escribe:

> Revisa la memoria de estas cuentas anuales frente al marco contable que les aplique y
> prepárame un informe de omisiones.

No menciones los defectos ni el marco: la prueba consiste en que los encuentre solo.

### 3. Qué comprobar

**Uso del MCP** (en el registro de llamadas a herramientas del cliente):

- [ ] Llama a `indice_norma` antes de `leer_articulo` para cada norma que cita.
- [ ] Consulta los umbrales en el TRLSC (artículos 257, 258 y 261) o en el RD 1515/2007
      (`norma='PGC PYMES'`) en lugar de darlos de memoria.
- [ ] Obtiene el modelo de memoria del PGC PYMES (`indice_norma` con `norma='PGC PYMES'` y
      un filtro como `memoria`) y lee las notas que contrasta.
- [ ] Busca el periodo medio de pago en la Ley 15/2010 o en la resolución del ICAC.
- [ ] Las fuentes del informe son los enlaces que devolvió el MCP, no URLs inventadas.

Si alguna llamada falla porque el nombre de la norma o del parámetro no coincide con lo que
espera el MCP (`norma`, `filtro`, fuente `contabilidad`), anótalo: es un ajuste de
`references/marcos-y-umbrales.md`.

**Contenido y forma del informe**: los criterios de [`esperado.md`](esperado.md):

- [ ] Las cinco detecciones con su estado.
- [ ] Marco PGC PYMES justificado con los umbrales de los dos ejercicios y las exclusiones.
- [ ] Fuente en cada requisito.
- [ ] Solo los estados Omisión, Incompleto, No aplica y A verificar.
- [ ] Tabla de cruces, puntos a revisar y aviso final.
- [ ] Sin opinión de auditoría ni juicio de importancia relativa.

### 4. Variantes recomendadas

| Variante | Cómo | Qué debe pasar |
|---|---|---|
| Sin MCP | Desconecta el MCP y repite | Avisa al principio de que no lo tiene y marca los requisitos como no contrastados con su texto. |
| Marco equivocado | Multiplica por tres el total activo y la cifra de negocios de los dos ejercicios, sin cambiar el marco declarado | Señala como primera observación que, al superar dos umbrales en dos ejercicios, no puede aplicar el PGC PYMES (umbrales leídos en la norma). |
| Formato | Aporta las cuentas en PDF o DOCX | Mismo resultado que con texto. |
| Otro cliente | Repite en ChatGPT, OpenCode o Hermes | Mismo resultado; anota diferencias en el uso de herramientas. |
| Cuentas reales | Solo con cuentas ya públicas (depositadas en el Registro Mercantil) o anonimizadas, y respetando la política de datos del cliente de IA | Detecciones plausibles; el auditor valida cada una. |

### 5. Registro

Añade una columna a la tabla de [`resultados.md`](resultados.md) por ejecución (cliente,
modelo, con o sin MCP, fecha) con «Cumple» o «No cumple» y una nota breve. Si un fallo se
corrige cambiando la habilidad, anota el cambio en «Cambios por iteración» y vuelve a
ejecutar la prueba. No copies informes completos ni datos de cuentas reales.
