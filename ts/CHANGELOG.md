# Changelog

All notable changes to `@laddro-app/schemas` are documented here.
This package follows [Semantic Versioning](https://semver.org/).

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
