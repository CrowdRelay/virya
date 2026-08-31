#!/usr/bin/env python3
"""Fail closed on mutable GitHub Actions refs and Netlify source builds."""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
HEX40 = re.compile(r"^[0-9a-f]{40}$")
USES = re.compile(r"^\s*-?\s*uses:\s*([^\s#]+)", re.MULTILINE)
failures: list[str] = []

workflow_dir = ROOT / ".github" / "workflows"
if workflow_dir.exists():
    for path in sorted(workflow_dir.glob("*.y*ml")):
        text = path.read_text()
        if not re.search(r"(?m)^permissions:\s*$", text):
            failures.append(f"{path.relative_to(ROOT)}: workflow permissions must be explicit")
        elif not re.search(r"(?m)^  contents:\s+(read|write)\s*$", text):
            failures.append(f"{path.relative_to(ROOT)}: top-level contents permission must be explicit")
        for ref in USES.findall(text):
            # Local and Docker actions are not Git refs managed by this policy.
            if ref.startswith("./") or ref.startswith("docker://"):
                continue
            if "@" not in ref:
                failures.append(f"{path.relative_to(ROOT)}: action has no @ref: {ref}")
                continue
            _, version = ref.rsplit("@", 1)
            if not HEX40.fullmatch(version):
                failures.append(
                    f"{path.relative_to(ROOT)}: mutable action ref forbidden: {ref}"
                )

netlify = ROOT / "netlify.toml"
if netlify.exists():
    text = netlify.read_text()
    if 'ignore = "exit 0"' not in text:
        failures.append("netlify.toml: linked source builds must be skipped")
    if re.search(r"(?m)^\s*command\s*=", text) or "[[plugins]]" in text:
        failures.append("netlify.toml: source build command/plugin is forbidden")
    deploy_workflows = "\n".join(
        p.read_text() for p in workflow_dir.glob("*.y*ml")
    ) if workflow_dir.exists() else ""
    if "netlify-cli" in deploy_workflows and "--no-build" not in deploy_workflows:
        failures.append("Netlify deploy workflow must pass --no-build")
    if "deploy-artifact/functions" in deploy_workflows and "include-hidden-files: true" not in deploy_workflows \
            and "deploy-artifact.tar.zst" not in deploy_workflows:
        failures.append("Netlify SSR promotion artifact must include hidden function build files (raw upload needs include-hidden-files: true; tarball capture them by default)")

# Per-change dependency security belongs to the build job so production
# deployment cannot pass while advisory scanning is red. Keeping it in that
# job also prevents a second, isolated npm ci. security.yml remains an
# independent scheduled/manual freshness scan.
build_workflow = workflow_dir / "build.yml"
if not build_workflow.exists():
    failures.append(".github/workflows/build.yml: canonical build workflow is required")
else:
    build_text = build_workflow.read_text()
    for contract in ("npm run security:audit", "needs: build"):
        if contract not in build_text:
            failures.append(f".github/workflows/build.yml: dependency-security contract missing: {contract}")
    if build_text.count("npm run security:audit") != 1:
        failures.append(".github/workflows/build.yml: dependency audit must have exactly one per-change owner")
    if build_text.count("npm ci --prefer-offline --no-audit --no-fund") != 1:
        failures.append(".github/workflows/build.yml: per-change workflow must install dependencies exactly once")
    for contract in ("--alias=candidate", "needs: candidate", "environment: production"):
        if contract not in build_text:
            failures.append(f".github/workflows/build.yml: candidate promotion contract missing: {contract}")

security_workflow = workflow_dir / "security.yml"
if not security_workflow.exists():
    failures.append(".github/workflows/security.yml: standalone dependency-security workflow is required")
else:
    security_text = security_workflow.read_text()
    for trigger in ("schedule", "workflow_dispatch"):
        if not re.search(rf"(?m)^  {re.escape(trigger)}:\s*$", security_text):
            failures.append(f".github/workflows/security.yml: missing {trigger} trigger")
    for duplicate_trigger in ("push", "pull_request"):
        if re.search(rf"(?m)^  {re.escape(duplicate_trigger)}:\s*$", security_text):
            failures.append(
                f".github/workflows/security.yml: {duplicate_trigger} duplicates build dependency-security"
            )
    if "npm run security:audit" not in security_text:
        failures.append(".github/workflows/security.yml: scheduled/manual dependency audit command is required")
    if "continue-on-error: true" in security_text:
        failures.append(".github/workflows/security.yml: dependency audit must fail closed")
    if "github.ref" not in security_text and "concurrency:" in security_text:
        failures.append(".github/workflows/security.yml: concurrency must not collapse unrelated refs")

rollback_workflow = workflow_dir / "rollback.yml"
if not rollback_workflow.exists():
    failures.append(".github/workflows/rollback.yml: rollback workflow is required")
else:
    rollback_text = rollback_workflow.read_text()
    if "workflow_dispatch" not in rollback_text:
        failures.append(".github/workflows/rollback.yml: rollback must be workflow_dispatch triggered")
    if "restoreSiteDeploy" not in rollback_text:
        failures.append(".github/workflows/rollback.yml: rollback must call restoreSiteDeploy API")
    if "environment: production" not in rollback_text:
        failures.append(".github/workflows/rollback.yml: rollback must gate on production environment")


if failures:
    for failure in failures:
        print(f"CI_POLICY=FAIL {failure}", file=sys.stderr)
    raise SystemExit(1)
print("CI_POLICY=PASS actions=sha-pinned netlify=source-build-disabled candidate-promotion=enabled")
