import { access, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const CUR = process.cwd();

const SCOPED_DIRECTORIES = [".next", "coverage", "dist", "build", ".turbo", "out"];
const FULL_DIRECTORIES = ["node_modules", ".cache", "performance/results"];
const SCOPED_FILES = [".eslintcache", "tsconfig.tsbuildinfo", "next-env.d.ts"];

const FORBIDDEN = new Set([".", "..", "", "/", ROOT, CUR]);

function resolveTarget(entry) {
  const target = resolve(join(ROOT, entry));
  if (FORBIDDEN.has(entry) || FORBIDDEN.has(target)) {
    throw new Error(`Refusing to remove forbidden target: ${target}`);
  }
  return target;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function runClean({ all = false, dryRun = false } = {}) {
  const directories = all
    ? [...SCOPED_DIRECTORIES, ...FULL_DIRECTORIES]
    : SCOPED_DIRECTORIES;
  const targets = [...directories, ...SCOPED_FILES];
  const removed = [];

  for (const entry of targets) {
    const full = resolve(join(ROOT, entry));
    if (!(await exists(full))) {
      continue;
    }
    if (dryRun) {
      removed.push(entry);
      continue;
    }
    await rm(resolveTarget(entry), { recursive: true, force: true });
    removed.push(entry);
  }

  if (removed.length > 0) {
    process.stdout.write(`Removed ${removed.length} item(s): ${removed.join(", ")}\n`);
  } else {
    process.stdout.write("Nothing to remove.\n");
  }
  process.stdout.write(`Scoped cleanup targets validated against the project root (${ROOT}).\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const all = process.argv.includes("--all");
  const dryRun = process.argv.includes("--dry-run");
  runClean({ all, dryRun }).catch((err) => {
    process.stderr.write(`[clean] ${err.message}\n`);
    process.exitCode = 1;
  });
}
