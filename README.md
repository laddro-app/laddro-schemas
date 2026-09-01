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
cover-letter/
  cover-letter.v1.yaml                 OpenAPI 3.1 component schemas
tailor/
  tailor.v1.yaml                       OpenAPI 3.1 component schemas
  fixtures/
    worker-output/<locale>/<industry>/ canonical JD inputs + expected JobDescription
                                       (14 locales × ≥8 industries — CI floor)
skills/
  skills.v1.yaml                       OpenAPI 3.1 component schemas
content/
  content.v1.yaml                      OpenAPI 3.1 component schemas
bullets/
  bullets.v1.yaml                      OpenAPI 3.1 component schemas
scripts/
  generate-ts.sh                       runs openapi-typescript
  generate-go.sh                       runs oapi-codegen
  generate-kotlin.mjs                  emits kotlinx.serialization data classes
ts/                                    TS package — published as @laddro-app/schemas
go/                                    Go module — github.com/laddro-app/laddro-schemas/go
kotlin/                                Gradle module — com.laddro:schemas (laddro-android)
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

```ts
import type { components } from '@laddro-app/schemas/tailor';

type JobDescription = components['schemas']['JobDescription'];
type TailorResponse = components['schemas']['TailorResponse'];
```

### Go (laddro-career-api, laddro-ai-core)

```bash
go get github.com/laddro-app/laddro-schemas/go/resume
go get github.com/laddro-app/laddro-schemas/go/tailor
```

```go
import (
  "github.com/laddro-app/laddro-schemas/go/resume"
  "github.com/laddro-app/laddro-schemas/go/tailor"
)

var r resume.Resume
var jd tailor.JobDescription
```

### Kotlin (laddro-android)

The Android app builds its models from here rather than hand-writing them the
way iOS did (`ApiModels.swift` is 82KB of hand-maintained contract).

```kotlin
import com.laddro.schemas.resume.Resume
import com.laddro.schemas.tailor.JobDescription
```

Plain `@Serializable` data classes and enums, nothing else. No Retrofit
interfaces and no generated client: the Android app owns its own network layer.
The only dependency is `kotlinx-serialization-json`.

Two deliberate choices:

- **Dates are `String`.** The backend serialises dates with `toString`, not ISO
  8601, so mapping `format: date-time` onto `Instant` would make every such
  field fail to parse and silently vanish. Parse explicitly at the call site.
- **`oneOf` / `anyOf` / `allOf` become `JsonElement`.** The specs carry no
  discriminator, so there is no honest single data class for a union. The call
  site narrows it.

> Not yet published to a Maven repository. Until that is decided, the module is
> consumed from source. See `kotlin/build.gradle.kts`.

## Regenerating locally

```bash
bash scripts/generate-ts.sh
bash scripts/generate-go.sh
node scripts/generate-kotlin.mjs
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
