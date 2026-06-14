#!/usr/bin/env bash
# Regenerate Go types from all *.v1.yaml specs.
# Run from repo root: bash scripts/generate-go.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

declare -a SPECS=(
  "resume/resume.v1.yaml:go/resume"
  "cover-letter/cover-letter.v1.yaml:go/coverletter"
  "tailor/tailor.v1.yaml:go/tailor"
  "skills/skills.v1.yaml:go/skills"
  "content/content.v1.yaml:go/content"
  "bullets/bullets.v1.yaml:go/bullets"
)

for entry in "${SPECS[@]}"; do
  spec="${REPO_ROOT}/${entry%%:*}"
  out_dir="${REPO_ROOT}/${entry##*:}"
  mkdir -p "${out_dir}"
  echo "Generating in ${out_dir} from ${spec}..."
  # oapi-codegen writes its output to the file specified in cfg.yaml,
  # resolved relative to its CWD — so cd into the target package dir first.
  (
    cd "${out_dir}"
    go run github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@latest \
      -config cfg.yaml \
      "${spec}"
  )
done

echo "Done."
