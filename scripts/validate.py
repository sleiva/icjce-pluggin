#!/usr/bin/env python3
"""Validate the portable schemas and cross-client invariants without credentials."""
import json
import re
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
    assert 'userConfig' not in claude, 'Claude must not request an API key'
    market = read('.claude-plugin/marketplace.json')
    assert market['plugins'][0]['name'] == portable['name']
    assert market['plugins'][0]['source'] == './'
    skills = sorted((ROOT / 'skills').glob('*/SKILL.md'))
    assert len(skills) == 1
    assert skills[0].parent.name == 'consultar-icjce-mcp'
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
    print('OK: official Agent Plugins 1.0 schemas; metadata, marketplace, skills and references')

if __name__ == '__main__':
    validate()
