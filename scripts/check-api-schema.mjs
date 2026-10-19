/**
 * check-api-schema.mjs
 *
 * Compares the frontend's API client implementation against the canonical
 * backend OpenAPI schema (openapi.json). Detects:
 *
 *   - Endpoint paths used by the frontend that are missing from the schema
 *   - HTTP methods used by the frontend that are not declared for a path
 *   - Paths/methods in the schema that have no response codes defined
 *
 * Usage:
 *   node scripts/check-api-schema.mjs [--openapi path/to/openapi.json] [--strict]
 *
 * Exit codes:
 *   0 – no drift detected
 *   1 – drift detected (fails CI)
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SCHEMA_PATH = resolve(ROOT, 'backend/openapi.json');

// ── CLI flags ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const strict = args.includes('--strict');
const schemaPathArg = args.find((a) => a.startsWith('--openapi='));
const SCHEMA_PATH = schemaPathArg
  ? resolve(ROOT, schemaPathArg.replace('--openapi=', ''))
  : DEFAULT_SCHEMA_PATH;

// ── Parsing helpers ────────────────────────────────────────────────────────

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];
const TICK = '`';
const METHOD_RE = new RegExp(
  '\\.(' + METHODS.join('|') + ')\\(\\s*(' + TICK + '[^' + TICK + ']*' + TICK + "|'[^']*'|\"[^\"]*\")\\s*[,)]",
  'g'
);

/**
 * Parse endpoint calls from a single source file content string.
 * Returns an array of { method, path, file } objects.
 */
export function parseEndpointCalls(source, filePath) {
  const calls = [];
  let match;
  METHOD_RE.lastIndex = 0;

  while ((match = METHOD_RE.exec(source)) !== null) {
    let path = match[2];
    // Strip quotes / backticks
    path = path.replace(/^['"`]|['"`]$/g, '').trim();
    if (path) {
      calls.push({
        method: match[1].toUpperCase(),
        path,
        file: filePath,
      });
    }
  }
  return calls;
}

/**
 * Extract the base URL from an axios.create() call source.
 * Returns a path prefix like '/api/v1/appointments' or null.
 */
export function extractBaseUrl(source) {
  const match = source.match(/baseURL:\s*([^\n,]+)/);
  if (!match) return null;
  let base = match[1].replace(/['"`]/g, '').trim();

  // Resolve template literal `${getApiBaseUrl()}` or `${API_BASE_URL}`
  if (base.includes('getApiBaseUrl') || base.includes('API_BASE_URL')) {
    // Replace the base URL call with the known prefix
    base = base.replace(/\$\{getApiBaseUrl\(\)\}/g, '/api/v1');
    base = base.replace(/\$\{API_BASE_URL\}/g, '/api/v1');
    base = base.replace(/getApiBaseUrl\(\)/g, '/api/v1');
  }
  return base;
}

/**
 * Resolve a relative path expression to a normalized absolute path.
 * Converts `${variable}` to `{variable}` for OpenAPI-style template matching.
 */
export function resolvePath(pathExpr, baseUrl) {
  let p = pathExpr.trim();

  // Convert template literals ${var} to OpenAPI path params {var}
  p = p.replace(/\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, '{$1}');
  // Remove any remaining bare template variables that are just identifiers
  p = p.replace(/\$\{[^}]+\}/g, '').trim();
  // Remove leading/trailing +
  p = p.replace(/^\s*\+\s*/, '').replace(/\s*\+\s*$/, '').trim();

  // If we have a base URL, join the path relative to it
  // (axios resolves paths relative to baseURL even when they start with /)
  if (baseUrl) {
    const base = baseUrl.replace(/\/+$/, '');
    const relative = p.replace(/^\/+/, '');
    return `${base}/${relative}`;
  }

  // Without a base URL, ensure the path starts with /
  if (!p.startsWith('/')) p = `/${p}`;
  return p;
}

/**
 * Collect all endpoint calls from API client files.
 * Skips calls to external URLs (e.g. CoinGecko, Horizon).
 */
export function collectFrontendEndpoints(apiDir) {
  const files = readdirSync(apiDir).filter(
    (f) => f.endsWith('.ts') && !f.endsWith('.test.ts')
  );

  const endpoints = [];
  for (const file of files) {
    const filePath = resolve(apiDir, file);
    const source = readFileSync(filePath, 'utf-8');
    const baseUrl = extractBaseUrl(source);
    const calls = parseEndpointCalls(source, file);

    for (const call of calls) {
      // Skip calls to external full URLs (e.g. CoinGecko, Horizon)
      if (call.path.startsWith('http://') || call.path.startsWith('https://')) {
        continue;
      }

      // Skip calls to variables that resolve to external URLs
      if (/^[A-Z_]+$/.test(call.path) && !call.path.startsWith('/')) {
        // This is a bare variable like COINGECKO_BASE or STELLAR_HORIZON
        continue;
      }

      const normalizedPath = resolvePath(call.path, baseUrl);
      // Skip paths that still look like external URLs after resolution
      if (normalizedPath.startsWith('http://') || normalizedPath.startsWith('https://')) {
        continue;
      }
      endpoints.push({
        method: call.method,
        path: normalizedPath,
        file: call.file,
      });
    }
  }

  return endpoints;
}

/**
 * Normalize a schema path (strip global prefix if present).
 */
export function normalizeSchemaPath(rawPath, globalPrefix) {
  let p = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  if (globalPrefix && p.startsWith(`/${globalPrefix}`)) {
    p = p.slice(globalPrefix.length + 1) || '/';
    if (!p.startsWith('/')) p = `/${p}`;
  }
  return p;
}

/**
 * Load and validate an OpenAPI schema from a path.
 */
export function loadSchema(schemaPath) {
  if (!existsSync(schemaPath)) {
    return null;
  }
  const raw = readFileSync(schemaPath, 'utf-8');
  return JSON.parse(raw);
}

/**
 * Compare frontend endpoints against the OpenAPI schema.
 * Returns an array of issue strings (empty = clean).
 */
export function checkDrift(schema, frontendEndpoints) {
  const issues = [];

  if (!schema || !schema.paths) {
    issues.push('Schema has no paths defined');
    return issues;
  }

  // Build regex lookup from schema paths (keeping them as-is since frontend paths
  // also include the full /api/v1 prefix)
  const schemaEntries = [];
  for (const [rawPath, pathItem] of Object.entries(schema.paths)) {
    const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    // Build a regex that matches the path template with {param} placeholders
    const escaped = path.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regexStr = escaped.replace(/\\\{[\w-]+\\\}/g, '[^/]+');
    const regex = new RegExp(`^${regexStr}$`);

    const methods = {};
    for (const method of METHODS) {
      if (pathItem[method]) {
        const responses = pathItem[method].responses
          ? Object.keys(pathItem[method].responses)
          : [];
        methods[method.toUpperCase()] = { responses };
      }
    }
    schemaEntries.push({ path, regex, methods });
  }

  for (const fe of frontendEndpoints) {
    const method = fe.method;
    let path = fe.path.replace(/\/+$/, '') || '/';
    if (!path.startsWith('/')) path = `/${path}`;

    let matched = false;

    for (const entry of schemaEntries) {
      if (entry.regex.test(path)) {
        if (entry.methods[method]) {
          matched = true;
          const { responses } = entry.methods[method];
          if (responses.length === 0) {
            issues.push(
              `[no_response_codes] ${method} ${path} (${fe.file}) — no response codes in schema`
            );
          }
        }
        // If path matches but method doesn't, we don't flag it as missing endpoint
        // because the path itself exists (just possibly with a different method)
        break;
      }
    }

    if (!matched) {
      issues.push(
        `[missing_endpoint] ${method} ${path} (${fe.file}) — not found in API schema`
      );
    }
  }

  return issues;
}

// ── Main CLI entry point ───────────────────────────────────────────────────

function main() {
  const schema = loadSchema(SCHEMA_PATH);
  if (!schema) {
    if (strict) {
      console.error(`[drift] ❌ OpenAPI schema not found at ${SCHEMA_PATH} (--strict mode)`);
      process.exit(1);
    }
    console.warn(`[drift] ⚠️  OpenAPI schema not found at ${SCHEMA_PATH} — skipping drift check`);
    process.exit(0);
  }

  console.log(`[drift] Loaded OpenAPI schema from ${SCHEMA_PATH}`);
  console.log(`[drift]   Title: ${schema.info?.title ?? 'N/A'}`);
  console.log(`[drift]   Version: ${schema.info?.version ?? 'N/A'}`);
  console.log(`[drift]   Paths: ${Object.keys(schema.paths ?? {}).length}`);

  const apiDir = resolve(ROOT, 'src/lib/api');
  const frontendEndpoints = collectFrontendEndpoints(apiDir);

  console.log(`[drift] Frontend API calls found: ${frontendEndpoints.length}`);
  for (const ep of frontendEndpoints) {
    console.log(`[drift]   ${ep.method} ${ep.path} (${ep.file})`);
  }

  const issues = checkDrift(schema, frontendEndpoints);

  if (issues.length > 0) {
    console.error(`\n[drift] ❌ ${issues.length} drift issue(s) detected:\n`);
    for (const issue of issues) {
      console.error(`  - ${issue}`);
    }
    console.error(
      '\n[drift] API schema drift detected. Update the frontend API calls or the backend schema.'
    );
    process.exit(1);
  }

  console.log('[drift] ✅ No drift detected — frontend API calls match the OpenAPI schema.');
}

// Run when invoked directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}