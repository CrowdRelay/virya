#!/usr/bin/env python3
from __future__ import annotations
import argparse,json
from pathlib import Path
RULES={
 'codeBytes':(1.20,32*1024),
 'largestCodeBytes':(1.25,16*1024),
 'homepageGzipBytes':(1.20,4*1024),
 'fileCount':(1.25,5),
}
def main():
 ap=argparse.ArgumentParser();ap.add_argument('current',type=Path);ap.add_argument('previous',type=Path);a=ap.parse_args()
 cur=json.loads(a.current.read_text()); prev=json.loads(a.previous.read_text()); fails=[]
 for key,(ratio,noise) in RULES.items():
  c=float(cur[key]); p=float(prev[key]); limit=max(p*ratio,p+noise)
  if c>limit: fails.append(f'{key}:{c:g}>{limit:g}(prev={p:g})')
 if fails: raise SystemExit('VIRYA_BUILD_REGRESSION=FAIL '+','.join(fails))
 print('VIRYA_BUILD_REGRESSION=PASS baseline=previous-successful-main')
if __name__=='__main__': main()
