#!/usr/bin/env bash
# Actualiza las referencias temáticas desde el backend sin sobrescribir la habilidad
# única del plugin, que combina MCP, análisis del modelo y búsqueda web.
#
#   scripts/sincroniza.sh [/ruta/a/nappai-ai-backend]
#
# Deja los cambios en el árbol de trabajo con `git status` a la vista; no commitea ni empuja.
set -euo pipefail

BACKEND="${1:-/Users/projects/nappai/nappai-ai-backend}"
SRC="$BACKEND/nappai/base/kgraph/auditoriaV2/mcp/experto-auditoria-icjce/references"
DEST="$(cd "$(dirname "$0")/.." && pwd)/skills/consultar-icjce-mcp/references"

for reference in auditoria.md independencia.md calidad.md contabilidad.md otras_actuaciones.md; do
  if [[ ! -f "$SRC/$reference" ]]; then
    echo "No encuentro $SRC/$reference" >&2
    exit 1
  fi
  cp "$SRC/$reference" "$DEST/$reference"
done

git -C "$DEST/../../.." status --short
