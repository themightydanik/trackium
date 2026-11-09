#!/usr/bin/env python3
"""Verify the reviewed presentation snapshot without fetching Android or a backend."""
from pathlib import Path
import hashlib,json,re
R=Path(__file__).resolve().parents[1]
j=json.loads((R/'design-system/SOURCE.json').read_text());tokens=json.loads((R/'design-system/tokens.json').read_text());css=(R/'assets/v2/design-tokens.css').read_text()
assert tokens['version']==j['version']=='1.0.0'
assert re.fullmatch('[0-9a-f]{40}',j['canonical_commit'])
assert hashlib.sha256((R/'design-system/tokens.json').read_bytes()).hexdigest()==j['canonical_token_sha256']
for f,sha in j['files'].items():
 p=Path(f);assert not p.is_absolute() and '..' not in p.parts
 assert hashlib.sha256((R/p).read_bytes()).hexdigest()==sha,f
assert hashlib.sha256((R/'assets/img/logo.png').read_bytes()).hexdigest()==j['owner_source_wordmark_sha256']
assert set(tokens['schemes']['dark'])==set(tokens['schemes']['light'])
for mode in ['dark','light']:
 for key,value in tokens['schemes'][mode].items():
  name=re.sub('[A-Z]',lambda m:'-'+m[0].lower(),key)
  assert '--tc-'+name+': '+value+';' in css,(mode,key)
index=(R/'index.html').read_text();assert 'assets/v2/brand/mark.png' in index and 'assets/v2/design-tokens.css' in index
print('DS1 snapshot hashes, semantic role mappings and owner mark reference: PASS')

# Locally served map dependencies: locked bytes, reviewed redistribution licences.
v=json.loads((R/'tools/web-vendor-lock.json').read_text())
for f,sha in v['files'].items():
 assert hashlib.sha256((R/f).read_bytes()).hexdigest()==sha,f
assert v['leaflet']['license']=='BSD-2-Clause' and v['natural_earth']['license']=='public domain'
print('Pinned map assets and licence declarations: PASS')

assert j['header_mark']['sha256']==j['files']['assets/v2/brand/mark.png']
assert re.fullmatch('[0-9a-f]{40}',j['header_mark']['commit'])
