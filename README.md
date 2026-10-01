# ICJCE Auditoría — ChatGPT y Claude

El plugin contiene dos habilidades compartidas por ChatGPT y Claude:

- `consultar-icjce-mcp` guía las respuestas a consultas de auditoría en España. Combina el análisis del modelo, los textos del MCP del ICJCE y la búsqueda web de fuentes oficiales cuando está disponible. Conserva cinco referencias temáticas.
- `generar-documento-auditoria` prepara un asistente HTML autónomo por conversación para rellenar un modelo de informe, carta u otro documento. El formulario se deriva de un JSON generado por el modelo. Muestra el documento terminado y exporta DOCX o abre el diálogo para guardar un PDF.

Ambos clientes quedan configurados para autenticarse con OAuth mediante Auth0. El servidor
MCP también acepta una API key para otras integraciones, pero este plugin no la solicita ni
la almacena.

| Cliente | Archivos del plugin | Inicio de sesión |
|---|---|---|
| ChatGPT / Agent Plugins 1.0 | `plugin.json`, `mcp.json`, `skills/` | OAuth con Auth0 al conectar el MCP |
| App de Claude (chat y Cowork) | `.claude-plugin/plugin.json`, `.mcp.json`, el mismo `skills/` | OAuth con Auth0 al conectar el MCP remoto |

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

## Verificación funcional

1. Habilita el plugin en ChatGPT o en la app de Claude y completa el inicio de sesión en Auth0.
2. Comprueba que el MCP conecta y descubre operaciones como `indice_norma` y `leer_articulo`.
3. Solicita una consulta de auditoría con citas. Revisa que realmente llama al MCP y enlaza
   las URLs devueltas, sin inventarlas.
4. Sin conexión MCP, comprueba que avisa de la limitación y que puede continuar con
   fuentes oficiales web verificadas, sin fingir una consulta al MCP.
5. Pide preparar una carta o informe a partir de un modelo. Comprueba que se entrega un
   HTML con formulario, botón **Generar documento**, vista del texto y exportación.

La validación estática no prueba las respuestas normativas. El 01-10-2026 se comprobó que
el endpoint público devuelve metadatos OAuth, exige autenticación con `401` y publica 9
herramientas. El usuario completó el login de Auth0, pero el descubrimiento de herramientas
en ChatGPT y Claude todavía requiere verificación funcional.

## Mantenimiento y ZIP

`skills/` es la única copia consumida por ambos clientes. El backend de NappAI es el origen
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
El modelo debe leer antes las fuentes del MCP o un modelo aportado por el usuario. El HTML
resultante incorpora todo el código y el logo; no vuelve a consultar al MCP ni envía los
datos rellenados. La descarga DOCX usa Office Open XML y el botón PDF abre la impresión
del navegador para elegir **Guardar como PDF**.

```sh
node skills/generar-documento-auditoria/bin/generar-documento.mjs validate skills/generar-documento-auditoria/examples/carta-encargo.json
node skills/generar-documento-auditoria/bin/generar-documento.mjs render skills/generar-documento-auditoria/examples/carta-encargo.json /tmp/carta-encargo.html
```

El diseño del asistente usa el logo proporcionado por el ICJCE y su paleta negra y roja.
Los documentos exportados quedan sin logo institucional y requieren revisión del auditor.
