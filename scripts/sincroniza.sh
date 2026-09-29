#!/usr/bin/env bash
# Copia las skills desde el backend, que es su FUENTE. No se editan aquí a mano: una copia
# mantenida a mano divergiría sin avisar (el plugin enseñaría un método que el MCP ya cambió).
#
#   scripts/sincroniza.sh [/ruta/a/nappai-ai-backend]
#
# Deja los cambios en el árbol de trabajo con `git status` a la vista; no commitea ni empuja.
set -euo pipefail

BACKEND="${1:-/Users/projects/nappai/nappai-ai-backend}"
SRC="$BACKEND/nappai/base/kgraph/auditoriaV2/mcp"
DEST="$(cd "$(dirname "$0")/.." && pwd)/skills"

for skill in experto-auditoria-icjce consultar-icjce-mcp; do
  if [[ ! -f "$SRC/$skill/SKILL.md" ]]; then
    echo "No encuentro $SRC/$skill/SKILL.md" >&2
    exit 1
  fi
  rm -rf "${DEST:?}/$skill"
  cp -R "$SRC/$skill" "$DEST/$skill"
  find "$DEST/$skill" -name '__pycache__' -prune -exec rm -rf {} +
done

git -C "$DEST/.." status --short
