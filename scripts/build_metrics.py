#!/usr/bin/env python3
from __future__ import annotations
import argparse, gzip, json
from pathlib import Path

CODE = {'.js','.mjs','.css','.wasm'}

def collect(root: Path):
    files=[p for p in root.rglob('*') if p.is_file()]
    code=[p for p in files if p.suffix.lower() in CODE]
    index=root/'index.html'
    if not index.is_file(): raise SystemExit('dist/index.html missing')
    index_bytes=index.read_bytes()
    return {
        'schema':1,
        'fileCount':len(files),
        'codeBytes':sum(p.stat().st_size for p in code),
        'largestCodeBytes':max((p.stat().st_size for p in code), default=0),
        'homepageHtmlBytes':len(index_bytes),
        'homepageGzipBytes':len(gzip.compress(index_bytes, compresslevel=9, mtime=0)),
    }

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('root',type=Path); ap.add_argument('output',type=Path); a=ap.parse_args()
    data=collect(a.root); a.output.parent.mkdir(parents=True,exist_ok=True); a.output.write_text(json.dumps(data,indent=2,sort_keys=True)+'\n')
    print('VIRYA_BUILD_METRICS=PASS '+ ' '.join(f'{k}={v}' for k,v in data.items() if k!='schema'))
if __name__=='__main__': main()
