# Dependency & Supply-Chain Policy

This document defines the minimum repeatable dependency-license and supply-chain checks for the frontend, and the procedure for approving a package whose license falls outside the allowlist.

## Scope

The frontend depends on wallet/crypto (`@stellar/stellar-sdk`), image processing (`sharp`), Firebase, charts (`recharts`), and many transitive utilities. Each of these introduces licensing and supply-chain risk. This policy ensures every installed package has a reviewed license and that provenance is pinned.

## How to Run the Check

```bash
node scripts/check-licenses.mjs
```

The checker reads `package-lock.json`, inspects the `license` field of every installed package, and reports:

- **Disallowed** licenses (GPL / LGPL / AGPL and similar copyleft, SSPL/BUSL) - blocks the check.
- **Unreviewed** licenses (not on the allowlist) - blocks the check until reviewed.
- A passing result (`all licenses allowlisted`) when every package is accounted for.

Use `node scripts/check-licenses.mjs --json` for machine-readable output.

## Allowlist

The default allowlist contains permissive and OSI-approved licenses:

`MIT`, `Apache-2.0`, `ISC`, `BSD-3-Clause`, `BSD-2-Clause`, `0BSD`, `Unlicense`, `MPL-2.0`, `Python-2.0`, `CC0-1.0`, `CC-BY-4.0`, `WTFPL`, `MIT-0`.

## Approved-With-Justification

Packages that are not permissively licensed but are deemed acceptable are recorded in an explicit `APPROVED` set in `scripts/check-licenses.mjs`, each with a documented reason:

| Package | License | Justification |
|---------|---------|---------------|
| `@img/sharp-libvips-*` (platform binaries) | `LGPL-3.0` | Standard prebuilt native binaries shipped by the `sharp` image pipeline that Next.js depends on for image optimization. Dynamically linked and vetted as part of the Next.js toolchain. |
| `exit` | not recorded in lock | Tiny MIT utility (transitive through Jest) whose license metadata is absent from the lockfile. |

## Disallowed Licenses

GPL-family, AGPL, LGPL (outside the sharp binaries above), SSPL, and BUSL are blocked by default. Adding a disallowed-license package requires an architectural review and an explicit decision recorded here before being approved.

## Locking and Pinning CI

- Installations use `npm ci`, which installs exactly the versions pinned in `package-lock.json`. This guarantees reproducible, offline-capable installs and a stable SBOM.
- CI actions must be pinned to a specific SHA or a vetted immutable tag, not a floating major version, to prevent supply-chain drift.
- Treat the lockfile as a security artifact: review lockfile changes alongside code changes.

## Procedure for Approving a New Dependency

1. Add the dependency with `npm install <pkg>` (this updates the lockfile).
2. Run `node scripts/check-licenses.mjs`.
3. If the package is disallowed or unreviewed, review its license and provenance, document the decision in this file, and (only if justified) add it to `APPROVED` or the allowlist.
4. Confirm `npm ci` succeeds cleanly offline before committing.

## CI Integration

This check is intended to run on every pull request, alongside `npm audit` and CodeQL, so that licensing regressions are caught before merge.
