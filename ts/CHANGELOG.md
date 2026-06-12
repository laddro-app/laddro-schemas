# Changelog

All notable changes to `@laddro-app/schemas` are documented here.
This package follows [Semantic Versioning](https://semver.org/).

## 0.7.0 — 2026-06-12

### Added (cover-letter)
- `CoverLetterGenerateRequest` — request body for `POST /v1/cover-letter`
  on `laddro-ai-core`. Accepts a possibly-partial `initialContent`
  envelope (every personal + employer field optional), the V1 Resume, the
  raw JD, the locale, and an optional `tone`. ai-core fills empty fields
  from the resume (personal) and the JD (employer) and writes the body.
- `CoverLetterGenerateResponse` — wraps the existing `CoverLetterContent`
  (unchanged) with a `filled` array indicating which fields ai-core
  synthesized vs echoed (so the standalone CL editor can render "AI
  filled this" badges) and a `usage` block for token + model accounting.
- `CoverLetterPersonalDetailsPartial` — same fields as
  `CoverLetterPersonalDetails` but every field optional. Used inside
  `initialContent`.
- `GenerationUsage` — shared usage block (`promptTokens`, `outputTokens`,
  `model`). The first home for this shape; the tailor spec will reuse it
  once `/v1/tailor` reports the same accounting.

### Architectural context
- Companion plan: `obsidian/laddro/plans/cover-letter-ai-core.md`.
- This release adds types only; no consumer is on it yet. PR 2
  (`laddro-ai-core`) implements the endpoint; PR 3 (`laddro-backend`)
  adds the proxy client behind a flag; PR 4 flips the flag and deletes
  the in-Node Claude/OpenAI/Gemini cover-letter fallback chain.

## 0.5.0 — 2026-06-09

### Added (tailor 2.0.0 — BREAKING)
- `Skill.id` (uuid) and `Requirement.id` (uuid) are now required. The
  worker assigns these at extraction time so the frontend and the
  orchestrator can resolve `Suggestion.requirement_ref` to the exact
  Skill or Requirement it addresses. IDs are scoped to a single
  `TailorResponse` (not stable across worker calls).
- Two existing fixtures updated to include IDs.

### Changed
- Repo-level `redocly.yaml` added — silences the rules that don't
  apply to component-only specs (`no-empty-servers`, `no-unused-components`,
  `info-license`, `struct`) so `npm run lint` and CI lint stay green.
- `.github/workflows/verify.yml` openapi-lint job now covers
  `resume.v1.yaml`, `cover-letter.v1.yaml`, AND `tailor.v1.yaml`
  (previously only resume). The `LanguageItem.level` description with
  unquoted commas is fixed; `Resume.guidedFlowStatus` keeps `nullable:
  true` (OpenAPI 3.0 form) because oapi-codegen does not yet support
  the 3.1 union form — see comment in `redocly.yaml`.

## 0.4.0 — 2026-06-09

### Added
- New `tailor` namespace (`tailor/tailor.v1.yaml`, version `1.0.0`) — canonical
  contract for the honest-tailor pipeline (worker `JobDescription`, tailor
  `/v1/tailor` request/response, lazy `/v1/tailor/fill` request/response, and
  shared `Seniority` / `Skill` / `Requirement` / `CompatibilityScore` /
  `Suggestion` types). Consumed by `laddro-ai-nlp`, `laddro-ai-core`,
  `laddro-backend`, and `laddro-web-app`.
- Hard rules baked into the contract: every classification field
  (`Seniority.level`, `Skill.required`, `Requirement.category`) is a
  model output, NEVER a regex/keyword scan. Designed for all 14 locales ×
  all industries from day one.
- Export: `import type { TailorComponents } from '@laddro-app/schemas'`
  or subpath import `import type { components } from '@laddro-app/schemas/tailor'`.

## 0.3.0 — 2026-06-06

### Added
- `PersonalSection.links` — optional array (`maxItems: 5`) of user-supplied
  `{ label, url }` pairs on the Resume schema. Renders as a separate visual
  cluster attached to the contact area (second-line strip on single-column
  templates; sidebar block on sidebar templates). Existing fixed `website`
  and `linkedin` slots are unchanged.

### Schema
- Resume schema bumped to `1.2.0` (additive, non-breaking).

## 0.2.0 — 2026-06-04

- Resume schema `1.1.0`: added `SkillItem.level`, `ProjectItem.url`, and
  richer `Styling` fields (`photo`, `photoSize`, `margin`, `lineHeight`,
  `showProfileImage`, `pageNumbering`). Clarified HTML support in summary
  and item description fields.
- Initial cover-letter schema (`cover-letter.v1.yaml`).
