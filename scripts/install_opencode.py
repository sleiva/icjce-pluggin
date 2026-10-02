#!/usr/bin/env python3
"""Install ICJCE skills and remote MCP in an existing OpenCode 1.x profile."""

import argparse
import json
import os
import shutil
import sys
import tempfile
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MCP = json.loads((ROOT / "opencode.json").read_text(encoding="utf-8"))["mcp"]["icjce"]
SKILLS = ("consultar-icjce-mcp", "generar-documento-auditoria", "revisar-memoria-cuentas")
LEGACY_CLIENT_ID = "tpc_usH5S5S2xpb88ociR6yE63"


def without_comments(source: str) -> str:
    """Replace JSONC comments with whitespace, keeping character offsets intact."""
    chars = list(source)
    i = 0
    quoted = False
    escaped = False
    while i < len(chars):
        char = chars[i]
        if quoted:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                quoted = False
            i += 1
            continue
        if char == '"':
            quoted = True
            i += 1
            continue
        if char == "/" and i + 1 < len(chars) and chars[i + 1] == "/":
            start = i
            while i < len(chars) and chars[i] not in "\r\n":
                i += 1
            for j in range(start, i):
                chars[j] = " "
            continue
        if char == "/" and i + 1 < len(chars) and chars[i + 1] == "*":
            start = i
            end = source.find("*/", i + 2)
            if end < 0:
                raise ValueError("Comentario JSONC sin cerrar")
            i = end + 2
            for j in range(start, i):
                if chars[j] not in "\r\n":
                    chars[j] = " "
            continue
        i += 1
    return "".join(chars)


def parse_jsonc(source: str) -> dict:
    clean = list(without_comments(source))
    quoted = escaped = False
    for i, char in enumerate(clean):
        if quoted:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                quoted = False
            continue
        if char == '"':
            quoted = True
        elif char == ",":
            j = i + 1
            while j < len(clean) and clean[j].isspace():
                j += 1
            if j < len(clean) and clean[j] in "}]":
                clean[i] = " "
    value = json.loads("".join(clean))
    if not isinstance(value, dict):
        raise ValueError("La configuración debe ser un objeto JSON")
    return value


def object_after_member(source: str, name: str) -> int:
    """Find the opening brace of a top-level object member in offset-stable JSONC."""
    clean = without_comments(source)
    depth = 0
    quoted = escaped = False
    i = 0
    while i < len(clean):
        char = clean[i]
        if quoted:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                quoted = False
            i += 1
            continue
        if char == '"':
            start = i
            i += 1
            while i < len(clean):
                if clean[i] == "\\":
                    i += 2
                elif clean[i] == '"':
                    i += 1
                    break
                else:
                    i += 1
            if depth == 1 and json.loads(clean[start:i]) == name:
                j = i
                while clean[j].isspace():
                    j += 1
                if clean[j] == ":":
                    j += 1
                    while clean[j].isspace():
                        j += 1
                    if clean[j] != "{":
                        raise ValueError(f"{name} debe ser un objeto")
                    return j
            continue
        if char in "{[":
            depth += 1
        elif char in "}]":
            depth -= 1
        i += 1
    raise ValueError(f"No se encontró {name}")


def nested_object_after_member(source: str, parent_open: int, name: str) -> int:
    """Find an object member directly inside a known JSONC object."""
    clean = without_comments(source)
    depth = 1
    i = parent_open + 1
    while i < len(clean) and depth:
        if clean[i] == '"':
            start = i
            i += 1
            while i < len(clean):
                if clean[i] == "\\":
                    i += 2
                elif clean[i] == '"':
                    i += 1
                    break
                else:
                    i += 1
            if depth == 1 and json.loads(clean[start:i]) == name:
                j = i
                while clean[j].isspace():
                    j += 1
                if clean[j] != ":":
                    continue
                j += 1
                while clean[j].isspace():
                    j += 1
                if clean[j] != "{":
                    raise ValueError(f"{name} debe ser un objeto")
                return j
            continue
        if clean[i] in "{[":
            depth += 1
        elif clean[i] in "}]":
            depth -= 1
        i += 1
    raise ValueError(f"No se encontró {name} dentro del objeto")


def add_mcp(source: str, client_id: str | None = None, redirect_uri: str | None = None) -> str:
    if redirect_uri and not client_id:
        raise ValueError("--redirect-uri requiere --client-id")
    if client_id is None:
        client_id = MCP["oauth"]["clientId"]
        redirect_uri = MCP["oauth"]["redirectUri"]
    config = parse_jsonc(source)
    if "icjce" in config.get("mcp", {}):
        if config["mcp"]["icjce"].get("url") != MCP["url"]:
            raise ValueError("Ya existe un MCP 'icjce' con otra URL; revísalo manualmente")
        oauth = config["mcp"]["icjce"].get("oauth")
        if oauth is not None:
            if not isinstance(oauth, dict):
                raise ValueError("icjce ya contiene otro Client ID; revísalo antes de continuar")
            if oauth.get("clientId") == LEGACY_CLIENT_ID and client_id == MCP["oauth"]["clientId"]:
                if oauth.get("redirectUri") != MCP["oauth"]["redirectUri"]:
                    raise ValueError("icjce usa un callback distinto; revísalo antes de migrar a CIMD")
                old_value = json.dumps(LEGACY_CLIENT_ID)
                if source.count(old_value) != 1:
                    raise ValueError("No se pudo localizar de forma inequívoca el Client ID anterior")
                result = source.replace(old_value, json.dumps(client_id), 1)
                if parse_jsonc(result)["mcp"]["icjce"]["oauth"]["clientId"] != client_id:
                    raise ValueError("No se pudo validar el Client ID CIMD resultante")
                return result
            if oauth.get("clientId") != client_id:
                raise ValueError("icjce ya contiene otro Client ID; revísalo antes de continuar")
            if not redirect_uri or oauth.get("redirectUri") == redirect_uri:
                return source
            if oauth.get("redirectUri"):
                raise ValueError("icjce ya contiene otra URL de retorno; revísala manualmente")
            mcp_open = object_after_member(source, "mcp")
            icjce_open = nested_object_after_member(source, mcp_open, "icjce")
            oauth_open = nested_object_after_member(source, icjce_open, "oauth")
            result = source[:oauth_open + 1] + f'"redirectUri": {json.dumps(redirect_uri)}, ' + source[oauth_open + 1:]
            if parse_jsonc(result)["mcp"]["icjce"]["oauth"]["redirectUri"] != redirect_uri:
                raise ValueError("No se pudo validar la URL de retorno resultante")
            return result
        mcp_open = object_after_member(source, "mcp")
        icjce_open = nested_object_after_member(source, mcp_open, "icjce")
        oauth_data = {"clientId": client_id}
        if redirect_uri:
            oauth_data["redirectUri"] = redirect_uri
        result = source[:icjce_open + 1] + f'\n      "oauth": {json.dumps(oauth_data)},' + source[icjce_open + 1:]
        if parse_jsonc(result)["mcp"]["icjce"]["oauth"]["clientId"] != client_id:
            raise ValueError("No se pudo validar el Client ID resultante")
        return result
    entry_data = dict(MCP)
    if client_id:
        entry_data["oauth"] = {"clientId": client_id}
        if redirect_uri:
            entry_data["oauth"]["redirectUri"] = redirect_uri
    entry = json.dumps(entry_data, ensure_ascii=False, indent=2).replace("\n", "\n    ")
    if "mcp" in config:
        if not isinstance(config["mcp"], dict):
            raise ValueError("mcp debe ser un objeto")
        pos = object_after_member(source, "mcp") + 1
        insertion = f'\n    "icjce": {entry}' + ("," if config["mcp"] else "")
    else:
        pos = without_comments(source).find("{") + 1
        insertion = f'\n  "mcp": {{\n    "icjce": {entry}\n  }}' + ("," if config else "")
    result = source[:pos] + insertion + source[pos:]
    if parse_jsonc(result)["mcp"]["icjce"]["url"] != MCP["url"]:
        raise ValueError("No se pudo validar la configuración resultante")
    return result


def install(config_dir: Path, client_id: str | None = None, redirect_uri: str | None = None) -> None:
    config_dir.mkdir(parents=True, exist_ok=True)
    config_path = next((config_dir / name for name in ("opencode.jsonc", "opencode.json") if (config_dir / name).exists()), config_dir / "opencode.json")
    if (config_dir / "opencode.jsonc").exists() and (config_dir / "opencode.json").exists():
        raise ValueError("Hay opencode.json y opencode.jsonc; resuelve cuál utiliza OpenCode antes de instalar")
    old = config_path.read_text(encoding="utf-8") if config_path.exists() else '{\n  "$schema": "https://opencode.ai/config.json"\n}\n'
    updated = add_mcp(old, client_id, redirect_uri)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    with tempfile.TemporaryDirectory(prefix="icjce-opencode-") as temporary:
        staging = Path(temporary)
        for skill in SKILLS:
            shutil.copytree(ROOT / "skills" / skill, staging / skill)
        if updated != old or not config_path.exists():
            if config_path.exists():
                shutil.copy2(config_path, config_path.with_name(f"{config_path.name}.bak-{stamp}"))
            with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=config_dir, prefix=".icjce-opencode-", delete=False) as output:
                output.write(updated)
                temporary_config = Path(output.name)
            if config_path.exists():
                shutil.copymode(config_path, temporary_config)
            os.replace(temporary_config, config_path)
        destination = config_dir / "skills"
        destination.mkdir(exist_ok=True)
        for skill in SKILLS:
            target = destination / skill
            if target.is_dir() and not target.is_symlink():
                source_files = {p.relative_to(staging / skill): p.read_bytes() for p in (staging / skill).rglob("*") if p.is_file()}
                target_files = {p.relative_to(target): p.read_bytes() for p in target.rglob("*") if p.is_file()}
                if source_files == target_files:
                    continue
            if target.exists() or target.is_symlink():
                backup = destination / f"{skill}.bak-{stamp}"
                target.rename(backup)
            shutil.move(str(staging / skill), str(target))
    print(f"Configuración: {config_path}")
    print(f"Habilidades: {destination}")
    print("Reinicia OpenCode y ejecuta: opencode mcp auth icjce")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config-dir", type=Path, default=Path.home() / ".config" / "opencode")
    parser.add_argument("--client-id", help="Client ID CIMD (URL HTTPS del documento OAuth registrado en Auth0)")
    parser.add_argument("--redirect-uri", help="URL de retorno incluida en el documento CIMD")
    args = parser.parse_args()
    try:
        install(args.config_dir.expanduser(), args.client_id, args.redirect_uri)
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"Instalación detenida: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
