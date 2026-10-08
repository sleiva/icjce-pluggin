# ICJCE Auditoría — ChatGPT, Claude, OpenCode y Hermes Desktop

El repositorio contiene tres habilidades compartidas por los cuatro clientes:

- `consultar-icjce-mcp` guía las respuestas a consultas de auditoría en España. Parte del análisis técnico del modelo, busca siempre circulares y guías de actuación relacionadas en el MCP del ICJCE, contrasta las fuentes pertinentes y busca en la web información vigente o complementaria cuando está disponible. Conserva cinco referencias temáticas.
- `generar-documento-auditoria` se activa al expresar que se quiere o necesita hacer, preparar o emitir un informe, carta u otro documento de un encargo concreto, aunque no se pida «HTML». Localiza primero un modelo con `buscar_modelos_informe`, lo lee con `leer_documento` y usa el criterio técnico del modelo para adaptarlo al encargo. Los datos pendientes quedan como campos de un asistente HTML autónomo, que muestra el documento terminado y exporta DOCX o abre el diálogo para guardar un PDF.
- `revisar-memoria-cuentas` revisa la memoria de unas cuentas anuales frente al modelo de su marco (PGC normal o abreviado, PGC PYMES, NOFCAC o adaptación sectorial). Usa el conocimiento contable del modelo para analizar las cuentas, determina el marco con los umbrales vigentes, contrasta nota a nota con el texto oficial del MCP y fuentes web, cruza cifras con el balance y la cuenta de pérdidas y ganancias y devuelve en el chat un informe de omisiones con la fuente de cada requisito. No emite opinión de auditoría.

Los clientes quedan configurados para autenticarse con OAuth mediante Auth0. El servidor
MCP también acepta una API key para otras integraciones, pero este plugin no la solicita ni
la almacena.

| Cliente | Archivos del plugin | Inicio de sesión |
|---|---|---|
| ChatGPT / Agent Plugins 1.0 | `plugin.json`, `mcp.json`, `skills/` | OAuth con Auth0 al conectar el MCP |
| App de Claude (chat y Cowork) | `.claude-plugin/plugin.json`, `.mcp.json`, el mismo `skills/` | OAuth con Auth0 al conectar el MCP remoto |
| OpenCode 1.x | `opencode.json`, `skills/` o el instalador global | OAuth con Auth0 al ejecutar `opencode mcp auth icjce` |
| Hermes Agent Desktop | `skills/` como tap de GitHub y el MCP remoto en `config.yaml` | OAuth con Auth0 desde Hermes Desktop o `hermes mcp login icjce` |

## Endpoint

```text
https://icjce-api.nappai.tech/api/v2/mcp/6efc4933-077e-4dc0-b8d0-2a5cb46bf54a/mcp
```

El transporte es Streamable HTTP. Los dos archivos MCP contienen solo esta URL, sin
cabeceras de autenticación. El servidor publica los metadatos OAuth en:

```text
https://icjce-api.nappai.tech/.well-known/oauth-protected-resource
```

El Client ID CIMD configurado para OpenCode es la
URL pública del documento OAuth:

```text
https://icjce-api.nappai.tech/mcp/metadata/oauth.json
```

El documento devuelve ese mismo valor en `client_id` y declara los callbacks de
OpenCode. Registra la URL del documento como cliente CIMD en Auth0
antes de iniciar sesión con ella. El documento está en el servicio .NET y debe
estar desplegado y accesible por HTTPS.

No pegues contraseñas, tokens ni API keys en el chat.

## App de Claude: instalación y OAuth

En Claude, abre **Customize > Plugins > Add > Add marketplace** y añade
`https://github.com/sleiva/icjce-pluggin`. Instala `icjce-auditoria` desde ese marketplace.
El plugin incluye la dirección pública del MCP, sin API key. Sigue el inicio de sesión de
Auth0 cuando Claude te pida conectar el servidor. En **Customize > Connectors** puedes
comprobar la conexión y, si hace falta, volver a autenticarla.

El archivo `.mcp.json` solo declara el endpoint MCP: Claude usa su propio cliente
OAuth. Registra en Auth0 el documento CIMD de la app de Claude,
`https://claude.ai/oauth/mcp-oauth-client-metadata`, con el callback
`https://claude.ai/api/mcp/auth_callback`. Si utilizas Claude Code, registra
por separado `https://claude.ai/oauth/claude-code-client-metadata` y comprueba
el callback local que presenta al iniciar sesión. En **Advanced settings** del
conector no indiques un Client ID personalizado para este plugin.

También puedes subir el ZIP del plugin desde **Customize > Plugins**. El plugin instalado en
tu cuenta queda disponible en el chat de Claude y en Cowork. Si ya tenías un conector ICJCE
añadido manualmente, comprueba cuál usa el plugin para evitar dos conexiones al mismo servidor.

Referencias: [plugins en Claude](https://support.claude.com/en/articles/13837440-use-plugins-in-claude)
y [conectores MCP remotos](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).

## ChatGPT: instalación y OAuth

El ZIP contiene un único directorio `icjce-auditoria/`, con manifiesto Agent Plugins 1.0.
Puedes guardarlo como plugin privado mediante Plugin Creator, pasando el ZIP; después abre
el enlace que devuelve y habilita el plugin en tu cuenta o espacio de trabajo.
Crear o instalar el plugin no autentica el MCP. Al conectar el servidor, autoriza el acceso
en la pantalla de Auth0 con tu usuario. ChatGPT descubre el proveedor de identidad mediante
la respuesta `401` y los metadatos publicados por el servidor. El `mcp.json` no contiene
credenciales. Si ya tenías el plugin instalado, actualízalo antes de volver a conectar el MCP.

Referencia: [autenticación de plugins en ChatGPT](https://developers.openai.com/plugins/build/auth).

## OpenCode

Esta integración se validó con **OpenCode 1.16.0**, instalado en el equipo. Para usarla en
cualquier proyecto, clona este repositorio y ejecuta desde su raíz:

```sh
python3 scripts/install_opencode.py
opencode mcp auth icjce
opencode mcp list
```

El instalador copia las tres habilidades completas a `~/.config/opencode/skills/` y añade
solo la entrada `mcp.icjce` al `opencode.json` o `opencode.jsonc` existente. Conserva los
otros proveedores, servidores y comentarios; crea una copia de seguridad antes de modificar
la configuración. Reinicia OpenCode tras instalar. El acceso OAuth se completa en el
navegador; no se escribe ninguna API key en el repositorio.

`opencode.json` y el instalador usan el Client ID CIMD indicado arriba y el callback
`http://127.0.0.1:51217/callback`.

Si `opencode mcp auth icjce` termina en «Authentication failed», comprueba que el
Client ID del archivo coincida con el documento CIMD registrado en Auth0 y que
`http://127.0.0.1:51217/callback` figure en `redirect_uris` del documento.

El Client ID no es un secreto; el instalador lo añade a tu configuración local como
`mcp.icjce.oauth.clientId` y conserva los demás ajustes. No añadas un Client Secret a una
aplicación pública. Si ya existe `mcp.icjce` con otro Client ID o callback, el instalador
se detiene para que revises la configuración antes de probar. Si encuentra el
Client ID anterior `tpc_usH5S5S2xpb88ociR6yE63` con el callback conocido,
lo migra al Client ID CIMD y guarda una copia de seguridad.

También puedes abrir OpenCode **en la raíz de este repositorio** sin ejecutar el instalador:
`opencode.json` configura el MCP y descubre `./skills`. Así las instrucciones funcionan
solo en este proyecto. En OpenCode 1.x, la herramienta `skill` carga cada habilidad por
nombre y el cliente expone las herramientas del servidor MCP conectado.

La configuración de OpenCode 2 usa un esquema diferente (`mcp.servers` y `skills` como
lista). El `opencode.json` y el instalador de este repositorio apuntan a la versión 1.x
probada; revisa el esquema de tu versión si la actualizas.

Referencias: [habilidades](https://opencode.ai/docs/skills) y
[MCP remoto con OAuth](https://opencode.ai/docs/mcp-servers).

## Codex

El manifiesto del plugin declara el MCP. Para configurarlo manualmente, copia la entrada de
[`integrations/codex/config.toml.example`](integrations/codex/config.toml.example) a
`~/.codex/config.toml`, sin duplicar una entrada `mcp_servers.icjce` que ya exista.
Codex descubre OAuth mediante el servidor MCP y presenta su propio cliente CIMD:
`https://chatgpt.com/oauth/codex/client.json`. Registra ese documento por separado en
Auth0 y ejecuta `codex mcp login icjce`. El callback local puede usar un puerto
variable; comprueba en Auth0 que el redirect URI real sea aceptado. No declares
`client_id` ni un callback fijo en el plugin.

## Hermes Agent Desktop

Hermes Desktop comparte habilidades y MCP con la instalación de Hermes Agent. El repositorio
ya tiene el layout de un **tap** (`skills/<nombre>/SKILL.md`). Instala las tres habilidades:

```sh
hermes skills tap add sleiva/icjce-pluggin
hermes skills install sleiva/icjce-pluggin/skills/consultar-icjce-mcp
hermes skills install sleiva/icjce-pluggin/skills/generar-documento-auditoria
hermes skills install sleiva/icjce-pluggin/skills/revisar-memoria-cuentas
```

En Hermes Desktop, añade un servidor MCP HTTP con el nombre `icjce`, la URL indicada arriba
y autenticación **OAuth**. Puedes usar como guía
[`integrations/hermes/config.yaml.example`](integrations/hermes/config.yaml.example), o
configurarlo desde la terminal compartida con Desktop:

```sh
hermes mcp add icjce --url https://icjce-api.nappai.tech/api/v2/mcp/6efc4933-077e-4dc0-b8d0-2a5cb46bf54a/mcp --auth oauth
hermes mcp login icjce
hermes mcp test icjce
```

Abre una sesión nueva en Desktop para que cargue las habilidades. Las versiones recientes
de Hermes pueden instalar paquetes Agent Plugins 1.0 directamente desde GitHub, pero la
instalación comprobada en este equipo (Hermes Agent 0.19.0) utiliza el tap y la entrada MCP.
No dupliques el servidor `icjce` en `config.yaml` si ya lo registraste desde Desktop.

Referencias: [Hermes Desktop](https://hermes-agent.nousresearch.com/docs/user-guide/desktop),
[habilidades](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills) y
[MCP con OAuth](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp).

## Verificación funcional

1. Habilita la integración en el cliente elegido y completa el inicio de sesión en Auth0.
2. Comprueba que el MCP conecta y descubre operaciones como `indice_norma` y `leer_articulo`.
3. Solicita una consulta de auditoría con citas. Revisa que realmente llama al MCP y enlaza
   las URLs devueltas, sin inventarlas.
4. Sin conexión MCP, comprueba que avisa de la limitación y que puede continuar con
   fuentes oficiales web verificadas, sin fingir una consulta al MCP.
5. Prueba «quiero hacer un informe», «necesito hacer un informe de procedimientos acordados para Ecoembes, revisión completa no retail» y «tengo que emitir ese informe» sin mencionar HTML ni aportar todos los datos del encargo. Comprueba que se activa `generar-documento-auditoria` y se entrega un HTML con los datos pendientes como campos, botón **Generar documento**, vista del texto y exportación. Si faltan datos esenciales para identificar el modelo, debe pedir solo esos datos antes de generar el archivo.
6. Pide revisar la memoria de unas cuentas anuales (por ejemplo, las cuentas inventadas de
   [`tests/revisar-memoria/cuentas-sinteticas.md`](tests/revisar-memoria/cuentas-sinteticas.md)).
   Comprueba que determina el marco, consulta `indice_norma` antes de `leer_articulo` y
   entrega el informe con estados, fuentes, cruces y aviso final. El procedimiento completo
   está en [`tests/revisar-memoria/README.md`](tests/revisar-memoria/README.md).

La validación estática no prueba las respuestas normativas. El 01-10-2026 se comprobó que
el endpoint público devuelve metadatos OAuth, exige autenticación con `401` y publica 9
herramientas. La conexión, la generación documental y la revisión de la memoria deben probarse en cada cliente.

## Mantenimiento y ZIP

`skills/` es la copia canónica consumida por los clientes. El backend de NappAI es el origen
histórico de las referencias temáticas; `scripts/sincroniza.sh /ruta/al/backend` importa
solo esas referencias y conserva las tres habilidades adaptadas al plugin. Revisa el diff
antes de publicar. No ejecutes la sincronización como parte del empaquetado.

Mantén iguales los metadatos y la versión en `plugin.json`, `.codex-plugin/plugin.json` y
`.claude-plugin/plugin.json`.
El marketplace existente se conserva con su identidad `icjce` y origen local `./`.

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python scripts/validate.py
.venv/bin/python scripts/package.py --output dist
```

El empaquetador incluye solo manifiestos, documentación y skills, con los archivos ocultos
necesarios para Claude. Excluye Git, entornos, credenciales y herramientas de desarrollo.
Los esquemas oficiales utilizados están en `tests/schemas/` para validación sin red.

## Asistente de documentos

La habilidad `generar-documento-auditoria` trae un renderizador `.mjs` sin dependencias.
La plantilla JSON describe los campos requeridos, los párrafos y las variantes del modelo.
El asistente debe buscar primero el modelo en el MCP ICJCE, leerlo y comprobar apartado por apartado qué datos y variantes requiere; si el MCP no está disponible, puede usar un modelo aportado por el usuario o una fuente oficial verificada, indicando la limitación. El HTML
resultante incorpora todo el código y el logo; no vuelve a consultar al MCP ni envía los
datos rellenados. La descarga DOCX usa Office Open XML y el botón PDF abre la impresión
del navegador para elegir **Guardar como PDF**.

```sh
node skills/generar-documento-auditoria/bin/generar-documento.mjs validate skills/generar-documento-auditoria/examples/carta-encargo.json
node skills/generar-documento-auditoria/bin/generar-documento.mjs render skills/generar-documento-auditoria/examples/carta-encargo.json /tmp/carta-encargo.html
```

El diseño del asistente usa el logo proporcionado por el ICJCE y su paleta negra y roja.
Los documentos exportados quedan sin logo institucional y requieren revisión del auditor.

## Revisión de la memoria

La habilidad `revisar-memoria-cuentas` ayuda al auditor a revisar la memoria de unas cuentas
anuales frente al modelo de memoria del marco que les aplica. No tiene código: son
instrucciones y tres referencias que el modelo del cliente combina con su conocimiento, la
búsqueda web y el MCP del ICJCE, cuyo texto oficial y vigente prevalece cuando cubre la norma.

- **Entrada:** las cuentas anuales (balance, cuenta de pérdidas y ganancias y memoria) en PDF,
  DOCX o texto pegado en la conversación. Basta pedir, por ejemplo, «revisa la memoria de
  estas cuentas».
- **Marcos:** PGC con memoria normal o abreviada, PGC PYMES, NOFCAC para consolidadas y
  adaptaciones sectoriales (entidades sin fines lucrativos, cooperativas, sociedades
  anónimas deportivas…). Los umbrales se comprueban en el texto vigente del TRLSC y del
  RD 1515/2007, nunca de memoria.
- **Proceso:** lee las cuentas, determina el marco, obtiene el modelo de memoria con
  `indice_norma` (y `leer_articulo` para el literal), contrasta nota a nota y cruza cifras
  con los estados (cuadros de movimientos, amortización, aplicación del resultado, impuesto,
  partes vinculadas…).
- **Salida, en el chat:** encabezado con el marco y las fuentes consultadas, resumen, tabla
  por nota con estado (**Omisión**, **Incompleto**, **No aplica** o **A verificar**) y fuente
  de cada requisito, tabla de cruces, puntos a revisar por el auditor y aviso final. Se puede
  exportar a Word si el cliente tiene una habilidad para ello.
- **Límites:** no emite opinión de auditoría ni juzga la importancia relativa o la
  suficiencia de la información; no revisa políticas contables, informe de gestión ni EINF.
  Sin MCP, lo indica y marca los requisitos no contrastados con su texto.
- **Fuentes:** solo oficiales (BOE, ICAC, ICJCE).
- **Confidencialidad:** las cuentas del cliente se procesan solo en la conversación; la
  habilidad no las publica ni las sube a otros servicios. Revisa la política de datos del
  cliente de IA antes de aportar cuentas reales.

Las referencias están en
[`skills/revisar-memoria-cuentas/references/`](skills/revisar-memoria-cuentas/references/):
`marcos-y-umbrales.md` (elección del marco y localización del modelo en el MCP),
`cruces-basicos.md` (partidas que obligan a informar y cifras que deben coincidir) y
`formato-informe.md` (estructura del informe). La prueba de comportamiento y su
procedimiento manual están en [`tests/revisar-memoria/`](tests/revisar-memoria/README.md).
