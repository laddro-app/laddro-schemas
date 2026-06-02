# laddro-schemas

Shared OpenAPI 3.1 schemas for Laddro APIs. Single source of truth for types
consumed by `laddro-web-app`, `laddro-backend`, and `laddro-career-api`. Also
the canonical document for LLM tool callers (ChatGPT Actions, Claude Tool Use)
that build resumes via the public Career API.

## Layout

```
resume/
  resume.v1.yaml                       OpenAPI 3.1 component schemas
  fixtures/
    completeness/                      canonical inputs + expected scores
    enforce-one-resume-limit/          canonical inputs + expected allow/block
scripts/
  generate-ts.sh                       runs openapi-typescript
  generate-go.sh                       runs oapi-codegen
ts/                                    TS package — published as @laddro-app/schemas
go/                                    Go module — github.com/laddro-app/laddro-schemas/go
```

## Consuming

### TypeScript (laddro-web-app, laddro-backend)

```bash
npm install @laddro-app/schemas
```

```ts
import type { components } from '@laddro-app/schemas/resume';

type Resume = components['schemas']['Resume'];
```

### Go (laddro-career-api)

```bash
go get github.com/laddro-app/laddro-schemas/go/resume
```

```go
import "github.com/laddro-app/laddro-schemas/go/resume"

var r resume.Resume
```

## Regenerating locally

```bash
bash scripts/generate-ts.sh
bash scripts/generate-go.sh
```

## Fixtures

`resume/fixtures/` holds canonical inputs paired with expected outputs for the
two cross-language algorithms:

- **completeness**: percentage score (0–100) a Resume DTO produces.
- **enforce-one-resume-limit**: whether a user is allowed to create another
  resume given their existing ones (rule: at least one existing resume must
  be ≥ 70% complete).

Every consumer of these algorithms (Go and TS) must pass every fixture in CI.
When the algorithm changes, the fixtures change here first, then both
implementations adapt.

## Versioning

SemVer. Breaking schema changes require a major version bump and release
notes. Generated packages are tagged at the same version as the underlying
schema.

## License

MIT — see `LICENSE`.
