# Plugin ICJCE para Claude Code

Convierte a Claude en un **técnico de auditoría del ICJCE**: responde a preguntas de auditores de
cuentas en España leyendo la norma vigente y la doctrina oficial en las fuentes, y citándolas con
enlace. Lo que el modelo sabe de memoria solo le sirve para saber qué buscar.

Trae dos skills, que se cargan solas cuando la pregunta lo pide:

| Skill | Qué hace |
|---|---|
| `experto-auditoria-icjce` | La persona del experto. Clasifica la pregunta y carga la referencia de su área: auditoría (NIA-ES, LAC/RLAC/RUE, informe), independencia, calidad (NIGC 1-ES y 2-ES), contabilidad (PGC, RICAC, consultas del ICAC) u otras actuaciones (procedimientos acordados, revisión limitada, informes especiales) |
| `consultar-icjce-mcp` | Cómo se usan las tools del MCP: cuál va primero, cómo se cita y qué hacer si el MCP no está |

**Las skills no sirven sin el MCP del ICJCE**: son un índice de qué buscar y con qué tool; el
contenido (el artículo, la circular, la consulta) lo trae el MCP. Sin él, el experto no debe
responder como si lo hubiera consultado.

## 1. Instalar el plugin

```sh
claude plugin marketplace add sleiva/icjce-pluggin
claude plugin install icjce-auditoria@icjce
```

Actualizar a la última versión: `claude plugin update icjce-auditoria@icjce`.

> El repositorio es privado: tu cuenta de GitHub necesita acceso a `sleiva/icjce-pluggin`.

## 2. Instalar el MCP del ICJCE

El MCP es un servidor HTTP (Streamable HTTP) que sirve NappAI desde un flujo con el componente
**ICJCE MCP Server**. Necesitas dos datos:

- **La URL del servidor**: `https://<host>/api/v2/mcp/<flow_id>/mcp`, donde `<flow_id>` es el
  identificador del flujo que tiene el componente ICJCE MCP Server. En desarrollo:
  `http://localhost:5163/api/v2/mcp/<flow_id>/mcp`.
- **Tu API key de NappAI**, que va en la cabecera `x-api-key`.

Regístralo con el nombre **`icjce`** —las skills llaman a las tools como `mcp__icjce__…`, así que
con otro nombre no las encuentran—:

```sh
 claude mcp add --scope user --transport http icjce \
  "https://<host>/api/v2/mcp/<flow_id>/mcp" \
  --header "x-api-key: PEGA_TU_API_KEY"
```

La línea empieza con un espacio a propósito: con `setopt HIST_IGNORE_SPACE` (zsh) o
`HISTCONTROL=ignorespace` (bash) la key no queda en el historial del shell. La credencial se
guarda en tu configuración de usuario (`~/.claude.json`). Volver a ejecutar el comando
**reemplaza** el registro: es también la forma de rotar la key.

**No pegues la key en el chat**: lo que se escribe ahí queda en la conversación y viaja al modelo.

### Comprobar que funciona

1. Reabre Claude Code y ejecuta `/mcp`: `icjce` debe salir **connected**, con sus tools
   (`indice_norma`, `leer_articulo`, `buscar_documentos`, `mapa_independencia`…).
2. Pregunta algo que solo se responde leyendo la norma, por ejemplo:
   *«¿Puede el auditor de una EIP prestarle servicios de valoración? Cita el precepto.»*
   La respuesta debe citar con enlace (BOE, EUR-Lex, ICAC, ICJCE) y en la traza deben verse
   llamadas a `mcp__icjce__…`.

Si el MCP no conecta, Claude **responde igual pero sin tools**, de memoria y sin avisar. Por eso
la comprobación del punto 2 importa: si no ves llamadas a `mcp__icjce__…`, el MCP no está.

### Sin registrarlo (solo para una sesión)

```sh
claude --mcp-config '{"mcpServers":{"icjce":{"type":"http","url":"https://<host>/api/v2/mcp/<flow_id>/mcp","headers":{"x-api-key":"PEGA_TU_API_KEY"}}}}'
```

Deja la key en el historial y en la lista de procesos: úsalo solo para probar.

### Claude Desktop / otros clientes

Añade el servidor en la configuración MCP del cliente:

```json
{
  "mcpServers": {
    "icjce": {
      "type": "http",
      "url": "https://<host>/api/v2/mcp/<flow_id>/mcp",
      "headers": { "x-api-key": "PEGA_TU_API_KEY" }
    }
  }
}
```

## Desinstalar

```sh
claude mcp remove icjce --scope user
claude plugin uninstall icjce-auditoria@icjce
```

---

## Para quien mantiene esto

Las skills **no se editan aquí**. Su fuente vive en el backend de NappAI, junto al código del MCP
(`nappai/base/kgraph/auditoriaV2/mcp/experto-auditoria-icjce/` y `.../consultar-icjce-mcp/`),
donde unos tests vigilan que no deriven. Para publicar una versión:

```sh
scripts/sincroniza.sh /ruta/a/nappai-ai-backend   # copia las skills desde el backend
# sube "version" en .claude-plugin/plugin.json
git add -A && git commit -m "…" && git push
```

| Fichero | Qué es |
|---|---|
| `.claude-plugin/plugin.json` | La ficha del plugin: nombre, versión, descripción. El único sitio donde se toca la versión |
| `.claude-plugin/marketplace.json` | Lo que permite `claude plugin marketplace add sleiva/icjce-pluggin` |
| `skills/` | Copia de las skills del backend (no editar a mano) |
| `scripts/sincroniza.sh` | Copia las skills desde el backend |
