# ICJCE Auditoría — ChatGPT, Claude, OpenCode y Hermes Desktop

El repositorio contiene dos habilidades compartidas por los cuatro clientes:

- `consultar-icjce-mcp` guía las respuestas a consultas de auditoría en España. Combina el análisis del modelo, los textos del MCP del ICJCE y la búsqueda web de fuentes oficiales cuando está disponible. Conserva cinco referencias temáticas.
- `generar-documento-auditoria` localiza primero un modelo con `buscar_modelos_informe`, lee el texto con `leer_documento` y extrae los datos que debe aportar el auditor. A partir de ese análisis prepara un asistente HTML autónomo por conversación. Muestra el documento terminado y exporta DOCX o abre el diálogo para guardar un PDF.

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

No pegues contraseñas, tokens ni API keys en el chat.

## App de Claude: instalación y OAuth

En Claude, abre **Customize > Plugins > Add > Add marketplace** y añade
`https://github.com/sleiva/icjce-pluggin`. Instala `icjce-auditoria` desde ese marketplace.
El plugin incluye la dirección pública del MCP, sin API key. Sigue el inicio de sesión de
Auth0 cuando Claude te pida conectar el servidor. En **Customize > Connectors** puedes
comprobar la conexión y, si hace falta, volver a autenticarla.

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

El instalador copia las dos habilidades completas a `~/.config/opencode/skills/` y añade
solo la entrada `mcp.icjce` al `opencode.json` o `opencode.jsonc` existente. Conserva los
otros proveedores, servidores y comentarios; crea una copia de seguridad antes de modificar
la configuración. Reinicia OpenCode tras instalar. El acceso OAuth se completa en el
navegador; no se escribe ninguna API key en el repositorio.

También puedes abrir OpenCode **en la raíz de este repositorio** sin ejecutar el instalador:
`opencode.json` configura el MCP y descubre `./skills`. Así las instrucciones funcionan
solo en este proyecto. En OpenCode 1.x, la herramienta `skill` carga cada habilidad por
nombre y el cliente expone las herramientas del servidor MCP conectado.

La configuración de OpenCode 2 usa un esquema diferente (`mcp.servers` y `skills` como
lista). El `opencode.json` y el instalador de este repositorio apuntan a la versión 1.x
probada; revisa el esquema de tu versión si la actualizas.

Referencias: [habilidades](https://opencode.ai/docs/skills) y
[MCP remoto con OAuth](https://opencode.ai/docs/mcp-servers).

## Hermes Agent Desktop

Hermes Desktop comparte habilidades y MCP con la instalación de Hermes Agent. El repositorio
ya tiene el layout de un **tap** (`skills/<nombre>/SKILL.md`). Instala ambas habilidades:

```sh
hermes skills tap add sleiva/icjce-pluggin
hermes skills install sleiva/icjce-pluggin/skills/consultar-icjce-mcp
hermes skills install sleiva/icjce-pluggin/skills/generar-documento-auditoria
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
5. Pide preparar una carta o informe a partir de un modelo. Comprueba que se entrega un
   HTML con formulario, botón **Generar documento**, vista del texto y exportación.

La validación estática no prueba las respuestas normativas. El 01-10-2026 se comprobó que
el endpoint público devuelve metadatos OAuth, exige autenticación con `401` y publica 9
herramientas. La conexión y la generación documental deben probarse en cada cliente.

## Mantenimiento y ZIP

`skills/` es la copia canónica consumida por los clientes. El backend de NappAI es el origen
histórico de las referencias temáticas; `scripts/sincroniza.sh /ruta/al/backend` importa
solo esas referencias y conserva ambas habilidades adaptadas al plugin. Revisa el diff
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
