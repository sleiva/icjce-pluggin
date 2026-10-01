#!/usr/bin/env python3
"""Validate the portable schemas and cross-client invariants without credentials."""
import json
import re
import subprocess
from pathlib import Path
import jsonschema
import yaml

ROOT = Path(__file__).resolve().parents[1]

def read(path):
    return json.loads((ROOT / path).read_text())

def validate():
    for name in ('plugin', 'mcp'):
        schema = read(f'tests/schemas/{name}.schema.json')
        jsonschema.Draft202012Validator(schema).validate(read(f'{name}.json'))
    portable, claude = read('plugin.json'), read('.claude-plugin/plugin.json')
    codex = read('.codex-plugin/plugin.json')
    for field in ('name', 'version', 'description', 'author', 'repository'):
        assert portable[field] == claude[field], f'Metadata drift: {field}'
        assert portable[field] == codex[field], f'Codex metadata drift: {field}'
    assert codex['interface'] == {
        **portable['extensions']['com.openai']['interface'],
        'capabilities': [],
    }
    assert codex['mcpServers'] == './.mcp.json'
    assert len(portable['extensions']['com.openai']['interface']['shortDescription']) <= 30
    server = read('mcp.json')['mcpServers']['icjce']
    native = read('.mcp.json')['mcpServers']['icjce']
    assert server['type'] == 'streamable-http' and native['type'] == 'http'
    assert server['url'] == native['url'] and server['url'].startswith('https://')
    assert 'headers' not in server, 'Portable MCP must use OAuth without custom headers'
    assert 'headers' not in native, 'Claude MCP must use OAuth without custom headers'
    assert 'oauth' not in native, 'Claude and Codex must use their own OAuth clients'
    assert 'userConfig' not in claude, 'Claude must not request an API key'
    opencode = read('opencode.json')
    assert opencode['mcp']['icjce'] == {
        'type': 'remote', 'url': server['url'], 'enabled': True,
        'oauth': {
            'clientId': 'https://icjce-api.nappai.tech/mcp/metadata/oauth.json',
            'redirectUri': 'http://127.0.0.1:51217/callback',
        },
    }, 'OpenCode MCP must match the portable endpoint'
    assert opencode['skills'] == {'paths': ['./skills']}
    hermes = yaml.safe_load((ROOT / 'integrations/hermes/config.yaml.example').read_text())
    assert hermes['mcp_servers']['icjce'] == {
        'url': server['url'], 'auth': 'oauth',
    }, 'Hermes MCP must match the portable endpoint'
    market = read('.claude-plugin/marketplace.json')
    assert market['plugins'][0]['name'] == portable['name']
    assert market['plugins'][0]['source'] == './'
    skills = sorted((ROOT / 'skills').glob('*/SKILL.md'))
    assert {path.parent.name for path in skills} == {'consultar-icjce-mcp', 'generar-documento-auditoria'}
    for path in skills:
        text = path.read_text()
        front = yaml.safe_load(text.split('---', 2)[1])
        assert front['name'] == path.parent.name
        assert 0 < len(front['description']) <= 1024
        assert 'mcp__' not in text and 'REQUIRED SUB-SKILL' not in text
        for ref in re.findall(r'`(references/[^`]+\.md)`', text):
            assert (path.parent / ref).is_file(), ref
    for path in (ROOT / 'skills').rglob('*'):
        assert not path.is_symlink(), f'Symlink not allowed: {path}'
    renderer = ROOT / 'skills/generar-documento-auditoria'
    for relative in ('bin/generar-documento.mjs', 'bin/validar-plantilla.mjs',
                     'assets/assistant.html', 'assets/assistant-runtime.js',
                     'assets/evaluator.js', 'assets/docx.js', 'assets/icjce-logo.png',
                     'examples/carta-encargo.json', 'references/esquema-json.md'):
        assert (renderer / relative).is_file(), relative
    tests = sorted(str(path) for path in (ROOT / 'tests/generar-documento').glob('*.test.mjs'))
    assert tests, 'Faltan las pruebas del renderizador'
    subprocess.run(['node', '--test', *tests], cwd=ROOT, check=True)
    print('OK: plugin schemas; OpenCode and Hermes MCP; metadata, marketplace, both skills, renderer assets and tests')

if __name__ == '__main__':
    validate()
