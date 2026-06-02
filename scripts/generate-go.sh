#!/usr/bin/env bash
# Regenerate Go types from resume.v1.yaml into go/resume/resume.gen.go.
# Run from repo root: bash scripts/generate-go.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SPEC="${REPO_ROOT}/resume/resume.v1.yaml"
OUT_DIR="${REPO_ROOT}/go/resume"

mkdir -p "${OUT_DIR}"

echo "Generating ${OUT_DIR}/resume.gen.go from ${SPEC}..."
# oapi-codegen writes its output to the file specified in cfg.yaml,
# resolved relative to its CWD — so cd into the target package dir first.
cd "${OUT_DIR}"
go run github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@latest \
  -config cfg.yaml \
  "${SPEC}"

echo "Done."
