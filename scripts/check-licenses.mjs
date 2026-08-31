import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

const ALLOWLIST = new Set([
  "MIT",
  "Apache-2.0",
  "ISC",
  "BSD-3-Clause",
  "BSD-2-Clause",
  "0BSD",
  "Unlicense",
  "MPL-2.0",
  "Python-2.0",
  "CC0-1.0",
  "CC-BY-4.0",
  "WTFPL",
  "MIT-0",
]);

const DISALLOWED = new Set(["GPL", "GPL-2.0", "GPL-3.0", "LGPL", "LGPL-2.1", "LGPL-3.0", "AGPL", "AGPL-3.0", "BUSL-1.1", "SSPL-1.0"]);

// Packages approved with documented justification. The `@img/sharp-libvips-*`
// packages are the standard prebuilt native binaries shipped by the `sharp`
// image pipeline that Next.js depends on. `exit` is a tiny MIT utility whose
// license is not recorded in the lockfile. See docs/license-policy.md.
const APPROVED = new Set([
  "node_modules/@img/sharp-libvips-darwin-arm64",
  "node_modules/@img/sharp-libvips-linux-arm",
  "node_modules/@img/sharp-libvips-linux-arm64",
  "node_modules/@img/sharp-libvips-linux-ppc64",
  "node_modules/@img/sharp-libvips-linux-riscv64",
  "node_modules/@img/sharp-libvips-linux-s390x",
  "node_modules/@img/sharp-libvips-linux-x64",
  "node_modules/@img/sharp-libvips-linuxmusl-arm64",
  "node_modules/@img/sharp-libvips-linuxmusl-x64",
  "node_modules/exit",
]);

function normalize(license) {
  if (license && typeof license === "object") {
    license = license.type;
  }
  const value = String(license || "UNKNOWN");
  const expected = value
    .split(" OR ")[0]
    .split(" AND ")[0]
    .trim()
    .replace(/^\(|\)$/g, "")
    .split(" WITH ")[0]
    .split("+")[0]
    .trim()
    .replace(/\*$/, "")
    .trim();
  return expected || "UNKNOWN";
}

function isCopyleft(license) {
  return [...DISALLOWED].some((l) => license.includes(l));
}

export async function runLicenseCheck({ json = false } = {}) {
  const lockPath = join(ROOT, "package-lock.json");
  const lock = JSON.parse(await readFile(lockPath, "utf8"));
  const packages = lock.packages || {};

  const findings = [];

  for (const [name, meta] of Object.entries(packages)) {
    if (!name) {
      continue;
    }
    const license = normalize(meta.license);
    if (APPROVED.has(name)) {
      continue;
    }
    if (DISALLOWED.has(license) || isCopyleft(license)) {
      findings.push({ name, license, status: "disallowed" });
    } else if (!ALLOWLIST.has(license)) {
      findings.push({ name, license, status: "unreviewed" });
    }
  }

  const disallowed = findings.filter((f) => f.status === "disallowed");
  const unreviewed = findings.filter((f) => f.status === "unreviewed");

  if (json) {
    process.stdout.write(
      JSON.stringify({ ok: findings.length === 0, disallowed, unreviewed }) + "\n"
    );
    if (findings.length > 0) {
      process.exitCode = 1;
    }
    return;
  }

  for (const f of unreviewed) {
    process.stdout.write(`[license] unreviewed ${f.name} (${f.license})\n`);
  }
  for (const f of disallowed) {
    process.stderr.write(`[license] DISALLOWED ${f.name} (${f.license})\n`);
  }

  const reviewed = Object.keys(packages).length;
  if (findings.length === 0) {
    process.stdout.write(
      `[license] ${reviewed} packages: all licenses allowlisted\n`
    );
  } else {
    process.stderr.write(
      `[license] ${findings.length} package(s) require review: ${disallowed.length} disallowed, ${unreviewed.length} unreviewed\n`
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const json = process.argv.includes("--json");
  runLicenseCheck({ json }).catch((err) => {
    process.stderr.write(`[license] ${err.message}\n`);
    process.exitCode = 1;
  });
}
