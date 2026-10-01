#!/usr/bin/env python3
"""Build one installable plugin from an explicit allowlist, never from the checkout wholesale."""
import argparse
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from validate import ROOT, read, validate

parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, default=ROOT / 'dist')
args = parser.parse_args()
validate()
manifest = read('plugin.json')
files = [ROOT / p for p in ('plugin.json', 'mcp.json', '.mcp.json',
         '.codex-plugin/plugin.json', '.claude-plugin/plugin.json',
         '.claude-plugin/marketplace.json', 'README.md')]
allowed_suffixes = {'.md', '.mjs', '.html', '.js', '.json', '.png'}
files += sorted(path for path in (ROOT / 'skills').rglob('*') if path.is_file() and path.suffix in allowed_suffixes)
for path in files:
    if path.is_symlink() or not path.is_file() or not path.resolve().is_relative_to(ROOT):
        raise ValueError(f'Unsafe package member: {path}')
args.output.mkdir(parents=True, exist_ok=True)
archive = args.output / f"{manifest['name']}-{manifest['version']}.zip"
with ZipFile(archive, 'w', ZIP_DEFLATED) as z:
    for path in files:
        z.write(path, f"{manifest['name']}/{path.relative_to(ROOT).as_posix()}")
with ZipFile(archive) as z:
    assert z.testzip() is None
    assert len(z.namelist()) == len(files)
print(archive.resolve())
