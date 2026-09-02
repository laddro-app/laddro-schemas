#!/usr/bin/env node
// Generate Kotlin (kotlinx.serialization) data classes from the OpenAPI 3.1
// component schemas, so the Android app consumes the same contract Go and
// TypeScript already do instead of hand-writing it a third time.
//
// Output: kotlin/src/main/kotlin/com/laddro/schemas/<pkg>/<Name>.kt
//
// Run from repo root: node scripts/generate-kotlin.mjs
//
// WHY NOT openapi-generator
// -------------------------
// The official Kotlin generator emits a whole client: Retrofit interfaces, an
// ApiClient, infrastructure classes and its own serializer wiring. The Android
// app already owns its network layer (ported from the iOS `WebRepository`
// contract, refresh-on-401 and all), so all it wants from here is the model
// layer. This emits plain `@Serializable` data classes and nothing else, with
// no dependency beyond kotlinx-serialization-json. It also needs no JVM to run.
//
// DATES ARE DELIBERATELY `String`
// -------------------------------
// The backend serialises dates with `toString`, NOT ISO 8601. Mapping
// `format: date-time` onto `Instant` here would make every such field fail to
// parse and silently vanish. Dates cross this boundary as strings and are
// parsed explicitly on the far side.

import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const OUT_ROOT = resolve(repoRoot, "kotlin/src/main/kotlin/com/laddro/schemas");
const BASE_PACKAGE = "com.laddro.schemas";

// `yaml` lives in ts/node_modules but this script sits in scripts/. Anchor
// resolution at the ts package, same as generate-json-schema.mjs.
const tsRequire = createRequire(resolve(repoRoot, "ts/package.json"));
const YAML = tsRequire("yaml");

const SPECS = [
  ["resume/resume.v1.yaml", "resume"],
  ["cover-letter/cover-letter.v1.yaml", "coverletter"],
  ["tailor/tailor.v1.yaml", "tailor"],
  ["skills/skills.v1.yaml", "skills"],
  ["content/content.v1.yaml", "content"],
  ["bullets/bullets.v1.yaml", "bullets"],
  ["inbox/inbox.v1.yaml", "inbox"],
];

// Kotlin hard keywords cannot be used bare as parameter names.
const KOTLIN_KEYWORDS = new Set([
  "as", "break", "class", "continue", "do", "else", "false", "for", "fun", "if",
  "in", "interface", "is", "null", "object", "package", "return", "super",
  "this", "throw", "true", "try", "typealias", "typeof", "val", "var", "when",
  "while",
]);

const pascal = (s) =>
  String(s)
    .replace(/[^A-Za-z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
    .replace(/^(.)/, (c) => c.toUpperCase());

const enumConstant = (s) => {
  let name = String(s)
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
  if (!name) name = "EMPTY";
  if (/^[0-9]/.test(name)) name = `V_${name}`;
  return name;
};

const propertyName = (s) => {
  const name = String(s).replace(/[^A-Za-z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""));
  return KOTLIN_KEYWORDS.has(name) ? `\`${name}\`` : name;
};

const refName = (ref) => pascal(ref.split("/").pop());

const kdoc = (text, indent = "") => {
  if (!text) return [];
  const lines = String(text).trim().split("\n");
  return [`${indent}/**`, ...lines.map((l) => `${indent} * ${l}`.trimEnd()), `${indent} */`];
};

/**
 * Emitted alongside the class that declared them: an inline `enum` or inline
 * `object` in a property has no name of its own, so it takes the parent's.
 */
let pendingTypes = [];

function kotlinType(schema, parentName, propName) {
  if (!schema || typeof schema !== "object") return "JsonElement";

  if (schema.$ref) return refName(schema.$ref);

  // A union is not expressible as one data class without a discriminator the
  // specs do not carry. Passing the raw tree through is honest; the call site
  // narrows it. Better than inventing a shape that silently drops fields.
  if (schema.oneOf || schema.anyOf || schema.allOf) return "JsonElement";

  const declaredName = pascal(`${parentName}${pascal(propName ?? "")}`);

  switch (schema.type) {
    case "string":
      if (Array.isArray(schema.enum)) {
        pendingTypes.push(renderEnum(declaredName, schema));
        return declaredName;
      }
      return "String";
    case "integer":
      return schema.format === "int64" ? "Long" : "Int";
    case "number":
      return "Double";
    case "boolean":
      return "Boolean";
    case "array":
      return `List<${kotlinType(schema.items, parentName, propName)}>`;
    case "object":
      if (schema.properties && Object.keys(schema.properties).length > 0) {
        pendingTypes.push(renderClass(declaredName, schema));
        return declaredName;
      }
      return "JsonObject";
    default:
      return "JsonElement";
  }
}

function defaultLiteral(schema, type) {
  if (schema.default === undefined) return null;
  const value = schema.default;
  if (Array.isArray(schema.enum)) return `${type}.${enumConstant(value)}`;
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (Array.isArray(value) && value.length === 0) return "emptyList()";
  return null;
}

function renderEnum(name, schema) {
  const lines = [...kdoc(schema.description), `@Serializable`, `enum class ${name} {`];
  for (const value of schema.enum) {
    lines.push(`    @SerialName(${JSON.stringify(String(value))}) ${enumConstant(value)},`);
  }
  lines.push("}");
  return lines.join("\n");
}

/**
 * A NAMED schema that is not an object must not become a class.
 *
 * `renderClass` emits `class Name` for anything with no `properties`, which is
 * right for a genuinely empty object and catastrophic for everything else. A
 * named `type: string` became an empty class that encodes to `{}` and cannot
 * decode `"2024-03"`, and a named `oneOf` became an empty class that erased
 * whichever variant it wrapped. Both compiled cleanly and silently destroyed
 * data on the first save — `MonthDate` would have dropped every start and end
 * date on a resume, and `ReorderableSection` would have flattened every
 * employment and education block to `{}`.
 *
 * `kotlinType` already resolves these shapes correctly for PROPERTIES; this
 * routes top-level declarations through the same understanding. Returns null
 * when the schema really is an object, leaving `renderClass` to handle it.
 */
function renderAlias(name, schema) {
  if (!schema || typeof schema !== "object") return null;
  if (schema.properties && Object.keys(schema.properties).length > 0) return null;
  if (Array.isArray(schema.enum)) return null;

  // A bare $ref at the top level is an alias for another named schema, not a
  // new shape. Emitting a class for it produced an empty one.
  if (schema.$ref) {
    return [...kdoc(schema.description), `typealias ${name} = ${refName(schema.$ref)}`].join("\n");
  }

  // A union WITH a discriminator is expressible as a sealed hierarchy, and
  // should be: it is the difference between the call site pattern-matching on
  // a type it understands and hand-parsing a JsonElement everywhere.
  if (schema.oneOf && schema.discriminator?.mapping) {
    return renderSealedUnion(name, schema);
  }

  // Without one there is no honest single data class, because nothing says
  // which variant a payload is. The call site narrows the JsonElement.
  if (schema.oneOf || schema.anyOf || schema.allOf) {
    return [...kdoc(schema.description), `typealias ${name} = JsonElement`].join("\n");
  }

  const scalar = {
    string: "String",
    integer: "Int",
    number: "Double",
    boolean: "Boolean",
  }[schema.type];

  if (scalar) {
    return [...kdoc(schema.description), `typealias ${name} = ${scalar}`].join("\n");
  }

  if (schema.type === "array") {
    return [
      ...kdoc(schema.description),
      `typealias ${name} = List<${kotlinType(schema.items, name, "item")}>`,
    ].join("\n");
  }

  // An object with no declared properties is legitimately an open map rather
  // than an empty class: the backend sends keys this spec does not enumerate.
  if (schema.type === "object" || schema.additionalProperties) {
    return [...kdoc(schema.description), `typealias ${name} = JsonObject`].join("\n");
  }

  return null;
}

/** SCREAMING_SNAKE constant name for a discriminator value. */
function constantName(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .toUpperCase();
}

/**
 * A discriminated `oneOf` as a sealed interface plus a routing serializer.
 *
 * The wire shape is FLAT — `{"type":"employment","items":[…]}` — not a wrapper
 * object, so the serializer reads the discriminator off the raw element before
 * choosing which variant serializer to run.
 *
 * An `Unknown` variant keeps any payload this build does not model, verbatim.
 * Round-tripping has to be lossless in both directions: a section type added by
 * the web app or a newer schema must survive an edit by an older client rather
 * than being silently dropped by it.
 */
function renderSealedUnion(name, schema) {
  const mapping = Object.entries(schema.discriminator.mapping);
  const property = schema.discriminator.propertyName ?? "type";
  const serializerName = `${name}Serializer`;

  const variants = mapping.map(([value, ref]) => ({
    value,
    constant: constantName(value),
    variant: pascal(value),
    target: refName(ref),
  }));

  const lines = [
    ...kdoc(schema.description),
    `@Serializable(with = ${serializerName}::class)`,
    `sealed interface ${name} {`,
    ``,
    `    /** The schema discriminator, which is also the variant's identity. */`,
    `    val ${propertyName(property)}: String`,
    ``,
  ];

  for (const v of variants) {
    lines.push(
      `    data class ${v.variant}(val value: ${v.target}) : ${name} {`,
      `        override val ${propertyName(property)}: String get() = ${v.constant}`,
      `    }`,
      ``,
    );
  }

  lines.push(
    `    /**`,
    `     * A variant this build does not model, kept verbatim. Never constructed`,
    `     * by hand; only ever produced by decoding.`,
    `     */`,
    `    data class Unknown(val raw: JsonObject) : ${name} {`,
    `        override val ${propertyName(property)}: String`,
    `            get() = raw[DISCRIMINATOR]?.jsonPrimitive?.content.orEmpty()`,
    `    }`,
    ``,
    `    companion object {`,
    `        const val DISCRIMINATOR: String = ${JSON.stringify(property)}`,
  );
  for (const v of variants) {
    lines.push(`        const val ${v.constant}: String = ${JSON.stringify(v.value)}`);
  }
  lines.push(`    }`, `}`, ``);

  // The serializer.
  lines.push(
    `/**`,
    ` * Routes [${name}] on its discriminator, reading and writing the FLAT object`,
    ` * the backend and the renderer both speak.`,
    ` *`,
    ` * JSON-only by construction: it needs the raw element to route before it`,
    ` * knows which variant serializer to call, and to hand an Unknown back`,
    ` * untouched.`,
    ` */`,
    `object ${serializerName} : KSerializer<${name}> {`,
    ``,
    `    // Borrowed from JsonObject rather than built with`,
    `    // buildClassSerialDescriptor, which is internal API. Nothing reads it:`,
    `    // the codec goes through JsonDecoder / JsonEncoder and bypasses it.`,
    `    override val descriptor: SerialDescriptor = JsonObject.serializer().descriptor`,
    ``,
    `    override fun deserialize(decoder: Decoder): ${name} {`,
    `        val input = requireNotNull(decoder as? JsonDecoder) {`,
    `            "${name} can only be read from JSON"`,
    `        }`,
    `        val element = input.decodeJsonElement().jsonObject`,
    `        val discriminator = element[${name}.DISCRIMINATOR]?.jsonPrimitive?.content`,
    ``,
    `        return when (discriminator) {`,
  );
  for (const v of variants) {
    lines.push(
      `            ${name}.${v.constant} ->`,
      `                ${name}.${v.variant}(input.json.decodeFromJsonElement(${v.target}.serializer(), element))`,
    );
  }
  lines.push(
    `            else -> ${name}.Unknown(element)`,
    `        }`,
    `    }`,
    ``,
    `    override fun serialize(encoder: Encoder, value: ${name}) {`,
    `        val output = requireNotNull(encoder as? JsonEncoder) {`,
    `            "${name} can only be written as JSON"`,
    `        }`,
    `        val element = when (value) {`,
  );
  for (const v of variants) {
    lines.push(
      `            is ${name}.${v.variant} ->`,
      `                output.json.encodeToJsonElement(${v.target}.serializer(), value.value)`,
    );
  }
  lines.push(
    `            is ${name}.Unknown -> value.raw`,
    `        }`,
    `        output.encodeJsonElement(element)`,
    `    }`,
    `}`,
  );

  return lines.join("\n");
}

function renderClass(name, schema) {
  const required = new Set(schema.required ?? []);
  const properties = Object.entries(schema.properties ?? {});

  if (properties.length === 0) {
    return [...kdoc(schema.description), `@Serializable`, `class ${name}`].join("\n");
  }

  const params = properties.map(([rawName, propSchema]) => {
    const type = kotlinType(propSchema, name, rawName);
    // `readOnly` fields are absent on write, so they are nullable regardless of
    // what `required` claims.
    const optional = !required.has(rawName) || propSchema.readOnly === true;
    const literal = defaultLiteral(propSchema, type);

    let suffix = "";
    if (optional) {
      suffix = literal !== null ? ` = ${literal}` : " = null";
    } else if (literal !== null) {
      suffix = ` = ${literal}`;
    }

    const doc = kdoc(propSchema.description, "    ");
    const serialName =
      propertyName(rawName).replace(/`/g, "") === rawName
        ? []
        : [`    @SerialName(${JSON.stringify(rawName)})`];

    return [
      ...doc,
      ...serialName,
      `    val ${propertyName(rawName)}: ${type}${optional ? "?" : ""}${suffix},`,
    ].join("\n");
  });

  return [
    ...kdoc(schema.description),
    `@Serializable`,
    `data class ${name}(`,
    ...params,
    `)`,
  ].join("\n");
}

let totalFiles = 0;
let totalTypes = 0;

for (const [specPath, packageName] of SPECS) {
  const spec = YAML.parse(readFileSync(resolve(repoRoot, specPath), "utf8"));
  const schemas = spec.components?.schemas ?? {};
  const outDir = resolve(OUT_ROOT, packageName);

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  let count = 0;
  for (const [schemaName, schema] of Object.entries(schemas)) {
    pendingTypes = [];
    const name = pascal(schemaName);

    const primary =
      schema.type === "string" && Array.isArray(schema.enum)
        ? renderEnum(name, schema)
        : renderAlias(name, schema) ?? renderClass(name, schema);

    const body = [primary, ...pendingTypes].join("\n\n");

    // Only import what the file actually references. An unused import is a
    // Kotlin warning, and a module built with `allWarningsAsErrors` would fail
    // on 352 of them.
    const imports = [
      ["kotlinx.serialization.SerialName", /@SerialName\b/],
      ["kotlinx.serialization.Serializable", /@Serializable\b/],
      ["kotlinx.serialization.json.JsonElement", /\bJsonElement\b/],
      ["kotlinx.serialization.json.JsonObject", /\bJsonObject\b/],
      // Only a discriminated union pulls these in.
      ["kotlinx.serialization.KSerializer", /\bKSerializer\b/],
      ["kotlinx.serialization.descriptors.SerialDescriptor", /\bSerialDescriptor\b/],
      ["kotlinx.serialization.encoding.Decoder", /\bDecoder\b/],
      ["kotlinx.serialization.encoding.Encoder", /\bEncoder\b/],
      ["kotlinx.serialization.json.JsonDecoder", /\bJsonDecoder\b/],
      ["kotlinx.serialization.json.JsonEncoder", /\bJsonEncoder\b/],
      ["kotlinx.serialization.json.jsonObject", /\.jsonObject\b/],
      ["kotlinx.serialization.json.jsonPrimitive", /\.jsonPrimitive\b/],
    ]
      .filter(([, pattern]) => pattern.test(body))
      .map(([path]) => `import ${path}`);

    const file = [
      "// GENERATED by scripts/generate-kotlin.mjs. Do not edit by hand.",
      `// Source: ${specPath} -> components.schemas.${schemaName}`,
      "",
      `package ${BASE_PACKAGE}.${packageName}`,
      "",
      ...imports,
      "",
      body,
      "",
    ].join("\n");

    writeFileSync(resolve(outDir, `${name}.kt`), file, "utf8");
    count += 1;
    totalTypes += 1 + pendingTypes.length;
  }

  totalFiles += count;
  console.log(`${specPath} -> kotlin/.../${packageName}/  (${count} schemas)`);
}

console.log(`\nDone. ${totalFiles} files, ${totalTypes} declared types.`);
