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
        : renderClass(name, schema);

    const body = [primary, ...pendingTypes].join("\n\n");

    // Only import what the file actually references. An unused import is a
    // Kotlin warning, and a module built with `allWarningsAsErrors` would fail
    // on 352 of them.
    const imports = [
      ["kotlinx.serialization.SerialName", /@SerialName\b/],
      ["kotlinx.serialization.Serializable", /@Serializable\b/],
      ["kotlinx.serialization.json.JsonElement", /\bJsonElement\b/],
      ["kotlinx.serialization.json.JsonObject", /\bJsonObject\b/],
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
