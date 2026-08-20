#!/usr/bin/env python3
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
my_signal = (ROOT / 'src/components/preact/signal/MySignal.tsx').read_text()
crowdrelay = (ROOT / 'src/lib/crowdrelay.ts').read_text()
client = (ROOT / 'src/lib/crowdrelay-client.ts').read_text()
token = (ROOT / 'src/components/preact/signal/SignalTokenAction.tsx').read_text()

assert 'crowdrelay.requestFanAccess(email, locale)' in my_signal
assert 'pendingHandoff &&' in my_signal
assert 'recoveryState' in my_signal
assert 'clearSynesthesiaHandoff()' not in my_signal.split('async function requestSessionRecovery', 1)[1].split('async function copyReferral', 1)[0]
assert 'fans/access' in client
assert 'localStorage' in crowdrelay and 'sessionStorage' in crowdrelay
assert 'pagePath(lang, "/my-signal/")' in token

# Browser alert() is not part of the Virya interaction language. Confirmations
# are separate destructive-action semantics and intentionally remain confirm().
for path in (ROOT / 'src').rglob('*'):
    if path.suffix not in {'.ts', '.tsx', '.js', '.jsx'}:
        continue
    text = path.read_text(errors='ignore')
    assert not re.search(r'(?<![\w.])alert\s*\(', text), f'browser alert() forbidden: {path}'
    assert 'window.alert(' not in text, f'window.alert() forbidden: {path}'
    assert 'x-forwarded-for' not in text.lower(), f'untrusted forwarded client IP forbidden: {path}'

print('VIRYA_SYNAESTHESIA_FALLBACK=PASS recovery=email-only handoff=preserved return=my-signal alert=forbidden')
