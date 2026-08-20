#!/usr/bin/env python3
"""Write a secretless content-root receipt for an immutable release artifact."""
from __future__ import annotations
import argparse, hashlib, json, re
from pathlib import Path

GIT_SHA = re.compile(r"^[0-9a-f]{40}$")
OPENAPI_SHA = re.compile(r"^[0-9a-f]{64}$")
ROOT = Path(__file__).resolve().parents[1]
CONTRACT_SOURCE = ROOT / "src/lib/crowdrelay-client.ts"
CONTRACT_RE = re.compile(r"@generated-contract\s+openapi-sha256:\s*([0-9a-f]{64})")
REQUIRED_CAPABILITIES = [
    "area_wallet_postgres_v2",
    "ticketing_v1",
    "tenant_regional_profile_v1",
]

def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()

def crowdrelay_contract() -> dict[str, object]:
    if not CONTRACT_SOURCE.is_file():
        raise SystemExit(f"CrowdRelay generated contract source missing: {CONTRACT_SOURCE}")
    match = CONTRACT_RE.search(CONTRACT_SOURCE.read_text())
    if match is None or OPENAPI_SHA.fullmatch(match.group(1)) is None:
        raise SystemExit("CrowdRelay OpenAPI fingerprint missing from generated Virya contract")
    return {
        "apiMajor": "1",
        "openapiSha256": match.group(1),
        "requiredCapabilities": REQUIRED_CAPABILITIES,
    }

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-sha", required=True)
    parser.add_argument("--lockfile", required=True, type=Path)
    parser.add_argument("--artifact-manifest", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    if not GIT_SHA.fullmatch(args.source_sha):
        raise SystemExit("source SHA must be a full lowercase Git SHA")
    for path in (args.lockfile, args.artifact_manifest):
        if not path.is_file():
            raise SystemExit(f"required provenance input missing: {path}")
    receipt = {
        "schema": 2,
        "sourceSha": args.source_sha,
        "dependencyLockSha256": sha256(args.lockfile),
        "artifactManifestSha256": sha256(args.artifact_manifest),
        "crowdrelayContract": crowdrelay_contract(),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n")
    print(
        "RELEASE_PROVENANCE=PASS "
        f"source={receipt['sourceSha']} manifest={receipt['artifactManifestSha256']} "
        f"crowdrelay={receipt['crowdrelayContract']['openapiSha256']}"
    )
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
