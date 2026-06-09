# Tailor worker-output fixtures

Ground-truth job-description → `JobDescription` pairs used to evaluate the
`laddro-ai-nlp` semantic worker and the `laddro-ai-core` tailor pipeline that
consumes its output.

Every fixture is the canonical answer to the question:

> Given THIS raw JD text in THIS locale, what should the worker emit?

The worker is "good" when it matches every fixture in this directory across
all 14 locales × ≥8 industries. CI enforces this as the **all-locales × all-
industries floor** baked into `tailor/tailor.v1.yaml`.

---

## Coverage matrix

|              | tech | marketing | design | sales | healthcare | blue_collar | legal | academic |
|--------------|:----:|:---------:|:------:|:-----:|:----------:|:-----------:|:-----:|:--------:|
| **en**       |  ✅  |    ☐      |   ☐    |   ☐   |    ✅      |     ☐       |   ☐   |    ☐     |
| **de**       |  ☐   |    ☐      |   ☐    |   ☐   |    ☐       |     ☐       |   ☐   |    ☐     |
| **es**       |  ☐   |    ☐      |   ☐    |   ☐   |    ☐       |     ☐       |   ☐   |    ☐     |
| **fr**       |  ☐   |    ☐      |   ☐    |   ☐   |    ☐       |     ☐       |   ☐   |    ☐     |
| **it**       |  ☐   |    ☐      |   ☐    |   ☐   |    ☐       |     ☐       |   ☐   |    ☐     |
| **nl**       |  ☐   |    ☐      |   ☐    |   ☐   |    ☐       |     ☐       |   ☐   |    ☐     |
| **pl**       |  ☐   |    ☐      |   ☐    |   ☐   |    ☐       |     ☐       |   ☐   |    ☐     |
| **pt**       |  ☐   |    ☐      |   ☐    |   ☐   |    ☐       |     ☐       |   ☐   |    ☐     |
| **is**       |  ☐   |    ☐      |   ☐    |   ☐   |    ☐       |     ☐       |   ☐   |    ☐     |
| **fi**       |  ☐   |    ☐      |   ☐    |   ☐   |    ☐       |     ☐       |   ☐   |    ☐     |
| **sv**       |  ☐   |    ☐      |   ☐    |   ☐   |    ☐       |     ☐       |   ☐   |    ☐     |
| **no**       |  ☐   |    ☐      |   ☐    |   ☐   |    ☐       |     ☐       |   ☐   |    ☐     |
| **da**       |  ☐   |    ☐      |   ☐    |   ☐   |    ☐       |     ☐       |   ☐   |    ☐     |
| **et**       |  ☐   |    ☐      |   ☐    |   ☐   |    ☐       |     ☐       |   ☐   |    ☐     |

**2/112 cells populated.** The two ✅ cells are format-locking examples. Every
other cell is pending native-speaker authoring — **do not auto-generate non-en
fixtures**. The whole point of this eval set is to catch the failure mode
where the worker only works in English-translated-to-X. Auto-generated
fixtures would have the same English-shape bias and the eval would pass on
broken behavior.

### How to claim a cell (native speakers)

1. Read the **Authoring template** below.
2. Find or write a realistic JD in your locale (≥150 words, real phrasing).
3. Create `<locale>/<industry>/<slug>.input.json` and `<locale>/<industry>/<slug>.expected.json`.
4. Open a PR titled `feat(tailor): <locale>/<industry> eval fixture — <slug>`.
5. Flip the matrix cell to ✅ in the same PR.

Industries (the 8 the schema commits to):

- `tech`         — software, data, IT, devops, hardware engineering
- `marketing`    — growth, brand, content, performance marketing
- `design`       — product, UX, visual, industrial design
- `sales`        — AE, SDR, account management, business development
- `healthcare`   — nursing, allied health, physician, paramedic
- `blue_collar`  — trades, manufacturing, logistics, agriculture
- `legal`        — paralegal, attorney, compliance, in-house counsel
- `academic`     — teaching (K–12 and tertiary), research, librarianship

If your role doesn't cleanly fit one of these eight, add a sibling industry
in a separate PR that updates this README first, then the fixture.

---

## File format

Each fixture is two JSON files sharing a slug:

```
tailor/fixtures/worker-output/
  <locale>/
    <industry>/
      <slug>.input.json       # WorkerAnalyzeRequest
      <slug>.expected.json    # WorkerAnalyzeResponse  ( = JobDescription )
```

Both files validate against `tailor.v1.yaml` schemas with the same name.
CI runs JSON shape checks on every file under this tree.

### `<slug>.input.json`

Matches `WorkerAnalyzeRequest` exactly. Two fields:

```json
{
  "text": "<the raw JD, as a user would paste it>",
  "locale": "<one of: en de es fr it nl pl pt is fi sv no da et>"
}
```

The text field is **verbatim** — preserve line breaks, headings, bullet
markers (`•`, `-`, `–`, `*`), real (or realistic) company names, real
seniority and years-of-experience phrasing in the locale's own idiom. JDs
that read like translated English are out — the whole eval set fails its
purpose if every locale shares English JD structure.

### `<slug>.expected.json`

Matches `JobDescription` exactly. Carries every field the schema requires
plus optional fields the model should be able to produce.

```json
{
  "raw_text": "<must equal input.text verbatim>",
  "locale":   "<must equal input.locale>",
  "title":    "<from NER; empty string if not detectable>",
  "company":  "<from NER; empty string if none>",
  "seniority": {
    "level":      "<entry | mid | senior | lead | unknown>",
    "years_min":  0,
    "years_max":  0,
    "confidence": 0.0
  },
  "skills":       [ ...Skill ],
  "requirements": [ ...Requirement ]
}
```

#### What confidence means in fixtures

Each `confidence` field in `expected.json` is the **floor a good worker
should reach**, not an exact match required. Use these ranges:

| Confidence | When to use |
|------------|-------------|
| `0.90`–`0.95` | Unambiguous in any reading. Skill named literally, seniority stated as "senior", category obvious. |
| `0.70`–`0.85` | Borderline. Span could mean two things. Soft-skill phrasing. Indirect seniority signal ("5+ years"). |
| `< 0.70`     | Don't include. If a good worker would be < 70% confident, the field is too noisy to evaluate against. Omit it from `skills[]` / `requirements[]`. |

For `Seniority.level`, use `unknown` instead of low confidence when the JD
genuinely doesn't say.

#### `Skill.required` discipline

`required: true` only when the JD's own span classifies it as a hard
requirement in the locale's normal idiom for that — never default to true
"because JDs are maximalist." When the model is below the confidence floor,
the fixture **omits the skill** rather than including it with low confidence.

The same applies to all model-classified fields. We're not training on
ambiguous cases.

#### `source_quote` discipline

Every `source_quote` MUST be a verbatim substring of `raw_text`. CI checks
this. Spans are the JD's actual words in the JD's actual language —
**never** translated, paraphrased, or normalized.

#### `Skill.esco_id`

Real `escoUri` from the ESCO graph when a clean link exists; empty string
when no link. Lookup against `laddro-ai-core/internal/rules/occupation_skills.json`
(2,409 occupations, 11,864 skills with canonical URIs).

The worker isn't required to emit the exact ID we wrote — it's required to
emit an `esco_id` for skills where one obviously exists in ESCO. Eval rule
is "did the worker link it" not "did the worker pick the same URI we did."

---

## Eval comparison rules

How CI (and the eval harness in `laddro-ai-nlp`) decides whether a worker
output passes against a fixture. Field-by-field:

| Field | Comparison rule | Pass when |
|-------|-----------------|-----------|
| `raw_text`, `locale` | Exact string equality | match |
| `title`, `company` | Either empty in both OR fuzzy-match (Levenshtein ≤ 0.2 of length) | match or both empty |
| `seniority.level` | Exact enum match | exact match |
| `seniority.years_min/max` | Exact integer | exact match |
| `seniority.confidence` | Worker confidence ≥ fixture confidence | meets floor |
| `skills[]` | Set comparison by `normalized` label, F1 ≥ 0.80 | per-fixture F1 floor |
| `skills[].required` | For matched skills, exact bool match | exact match |
| `skills[].esco_id` | When fixture has a non-empty value, worker must also have a non-empty value (URIs need not be identical) | both linked or both empty |
| `skills[].source_quote` | Worker quote must be a substring of `raw_text` AND token-overlap ≥ 0.7 with fixture quote | overlap floor |
| `requirements[]` | Set comparison by `(category, fuzzy-text)`, F1 ≥ 0.75 | per-fixture F1 floor |
| `requirements[].category` | Exact enum match | exact match |

A fixture passes when **every** rule above passes. A worker version passes
when **every fixture in this tree** passes. There is no per-locale or per-
industry waiver.

---

## Authoring template

Copy this when adding a fixture. Replace `<...>` placeholders; keep field
order identical so diffs stay readable.

`<slug>.input.json`:
```json
{
  "text": "<paste the JD verbatim — preserve line breaks and bullets>",
  "locale": "<en|de|...|et>"
}
```

`<slug>.expected.json`:
```json
{
  "raw_text":   "<must equal input.text verbatim>",
  "locale":     "<must equal input.locale>",
  "title":      "<NER output or empty>",
  "company":    "<NER output or empty>",
  "seniority": {
    "level":      "<entry|mid|senior|lead|unknown>",
    "years_min":  0,
    "years_max":  0,
    "confidence": 0.90
  },
  "skills": [
    {
      "label":        "<as-written in the JD, source language>",
      "normalized":   "<lowercase canonical, deduped>",
      "esco_id":      "<http://data.europa.eu/esco/skill/... or empty>",
      "required":     true,
      "confidence":   0.90,
      "source_quote": "<verbatim substring of raw_text>"
    }
  ],
  "requirements": [
    {
      "text":         "<verbatim substring of raw_text>",
      "category":     "<skill|responsibility|qualification|experience|soft>",
      "confidence":   0.85,
      "source_quote": "<verbatim substring of raw_text>"
    }
  ]
}
```

---

## Provenance & licensing

JD content in fixtures should be either:

1. **Original** — written by the contributor for the eval, modeled on
   patterns common in their locale (preferred — avoids any IP concern).
2. **Adapted** — a real public posting, paraphrased enough that the
   structure remains realistic but the original wording is not
   reproduced verbatim. Note the source job board in the commit message.

Do not paste verbatim from a paywalled or proprietary source. Do not
include real contact details, internal hiring URLs, or anything a
recruiter might consider confidential.

---

## Format-locking examples (current ✅ cells)

The two populated cells are authored by Claude as worked format examples,
not as locale-quality ground truth. They demonstrate:

- `en/tech/senior-backend-engineer` — the dense tech case: many skills,
  some with ESCO links, some without; mixed required/nice-to-have.
- `en/healthcare/registered-nurse` — proves non-tech category
  distribution: skewed toward `qualification` and `soft`, with anchored
  clinical-skill spans the recommender will need to handle.

When native authoring catches up, English speakers should review and
replace these with locale-grade fixtures of their own, or sign off on
keeping the current ones. Either is fine; the format claim doesn't depend
on which person wrote them, only on the structure.
