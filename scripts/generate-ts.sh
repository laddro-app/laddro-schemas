#!/usr/bin/env bash
# Regenerate TypeScript types from resume.v1.yaml into ts/src/resume.gen.ts.
# Run from repo root: bash scripts/generate-ts.sh
set -euo pipefail

cd "$(dirname "$0")/.."

OUT_DIR=ts/src
OUT_FILE="${OUT_DIR}/resume.gen.ts"

mkdir -p "${OUT_DIR}"

echo "Generating ${OUT_FILE} from resume/resume.v1.yaml..."
npx --yes openapi-typescript@latest resume/resume.v1.yaml -o "${OUT_FILE}"

echo "Done."
