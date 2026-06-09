# Changelog

All notable changes to `@laddro-app/schemas` are documented here.
This package follows [Semantic Versioning](https://semver.org/).

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
