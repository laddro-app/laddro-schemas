#!/usr/bin/env bash
# Regenerate TypeScript types from all *.v1.yaml specs into ts/src/*.gen.ts.
# Run from repo root: bash scripts/generate-ts.sh
set -euo pipefail

cd "$(dirname "$0")/.."

OUT_DIR=ts/src
mkdir -p "${OUT_DIR}"

declare -a SPECS=(
  "resume/resume.v1.yaml:resume.gen.ts"
  "cover-letter/cover-letter.v1.yaml:cover-letter.gen.ts"
  "tailor/tailor.v1.yaml:tailor.gen.ts"
  "skills/skills.v1.yaml:skills.gen.ts"
  "content/content.v1.yaml:content.gen.ts"
)

for entry in "${SPECS[@]}"; do
  spec="${entry%%:*}"
  out="${entry##*:}"
  out_file="${OUT_DIR}/${out}"
  echo "Generating ${out_file} from ${spec}..."
  npx --yes openapi-typescript@latest "${spec}" -o "${out_file}"
done

echo "Done."
