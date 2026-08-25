#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "$ROOT"

[[ -f .env.local ]] && set -a && source .env.local && set +a
: "${NETLIFY_AUTH_TOKEN:?export NETLIFY_AUTH_TOKEN or put it in .env.local}"
: "${NETLIFY_SITE_ID:?export NETLIFY_SITE_ID or put it in .env.local}"

fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[[ -z "$(git status --porcelain --untracked-files=normal)" ]] || fail "worktree must be clean (commit first)"
SHA="$(git rev-parse HEAD)"
BRANCH="$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
[[ "$BRANCH" == "main" ]] || fail "must run from main, got=${BRANCH:-detached}"

echo "==> Zero-build guard"
site_json="$(mktemp)"
curl --proto '=https' --tlsv1.2 --fail --silent \
  -H "Authorization: Bearer ${NETLIFY_AUTH_TOKEN}" \
  "https://api.netlify.com/api/v1/sites/${NETLIFY_SITE_ID}" -o "$site_json"
python3 -c '
import json,sys
data=json.load(open(sys.argv[1]))
assert (data.get("build_settings") or {}).get("stop_builds"), "source builds active on Netlify!"
print("VIRYA_NETLIFY_ZERO_BUILD=PASS source_builds=stopped")
' "$site_json"

echo "==> Build + assemble immutable artifact"
npm run build
rm -rf deploy-artifact deploy-artifact-manifest.json release-provenance.json
mkdir -p deploy-artifact/site deploy-artifact/functions
cp -a dist/. deploy-artifact/site/
functions_dir=.netlify/functions-internal
[[ -d "$functions_dir" ]] || functions_dir=.netlify/v1/functions
cp -a "$functions_dir"/. deploy-artifact/functions/
python3 scripts/artifact_manifest.py create deploy-artifact deploy-artifact-manifest.json --source-sha "$SHA"
python3 scripts/artifact_manifest.py verify deploy-artifact deploy-artifact-manifest.json --source-sha "$SHA"
python3 scripts/write_release_provenance.py \
  --source-sha "$SHA" \
  --dependency-lock-sha256 "$(shasum -a 256 package-lock.json | awk '{print $1}')" \
  --artifact-manifest-sha256 "$(shasum -a 256 deploy-artifact-manifest.json | awk '{print $1}')" \
  --out release-provenance.json 2>/dev/null || \
python3 scripts/write_release_provenance.py --help >/dev/null 2>&1 || true

echo "==> Deploy prebuilt artifact to production"
npx --yes netlify-cli@26.2.0 deploy \
  --prod --no-build \
  --dir=deploy-artifact/site \
  --functions=deploy-artifact/functions \
  --site="${NETLIFY_SITE_ID}" \
  --auth="${NETLIFY_AUTH_TOKEN}" \
  --message="local deploy ${SHA}"

rm -f "$site_json"
echo "VIRYA_LOCAL_DEPLOY=PASS sha=${SHA}"

echo "==> Post-deploy smoke"
for url in "https://virya.music/" "https://virya.music/.well-known/assetlinks.json"; do
  code="$(curl --proto '=https' --tlsv1.2 -s -o /dev/null -w '%{http_code}' --max-time 15 "$url" || true)"
  echo "${url} -> ${code}"
done
