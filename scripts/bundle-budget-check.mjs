import { access, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

const REQUIRED_METRICS = ["LCP", "FID", "CLS", "TTFB", "INP", "FCP"];
const REQUIRED_ROUTES = ["wallet", "analytics", "clinics"];

function joinRoot(file) {
  return file.startsWith("/") ? file : join(ROOT, file);
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function parseArgs(argv) {
  const reportIndex = argv.indexOf("--report");
  const report = reportIndex !== -1 ? argv[reportIndex + 1] : null;
  const json = argv.includes("--json");
  return { report, json };
}

export async function runBundleCheck(budgetFile, { report = null, json = false } = {}) {
  const budgetPath = joinRoot(budgetFile);
  const raw = await readFile(budgetPath, "utf8");
  const budgets = JSON.parse(raw);

  const errors = [];
  const warnings = [];

  const metricNames = (budgets.budgets || []).map((b) => b.metric);
  for (const metric of REQUIRED_METRICS) {
    if (!metricNames.includes(metric)) {
      errors.push(`missing budget metric "${metric}"`);
    }
  }

  const routes = budgets.routes || {};
  for (const route of REQUIRED_ROUTES) {
    if (!routes[route]) {
      warnings.push(`no route-level budget for "/${route}"`);
    }
  }

  if (report) {
    const reportPath = joinRoot(report);
    if (await exists(reportPath)) {
      const parsed = JSON.parse(await readFile(reportPath, "utf8"));
      for (const [route, budget] of Object.entries(routes)) {
        const observed = parsed[route];
        if (observed !== undefined && budget.maxBytes !== undefined) {
          if (observed > budget.maxBytes) {
            errors.push(
              `route "/${route}" JS (${observed} bytes) exceeds budget (${budget.maxBytes} bytes)`
            );
          } else if (observed > budget.warnBytes) {
            warnings.push(
              `route "/${route}" JS (${observed} bytes) approaches budget (${budget.warnBytes} bytes)`
            );
          }
        }
      }
    } else {
      warnings.push(`report file not found: ${reportPath}`);
    }
  }

  if (json) {
    process.stdout.write(
      JSON.stringify({ ok: errors.length === 0, errors, warnings }) + "\n"
    );
    process.exitCode = errors.length === 0 ? 0 : 1;
    return;
  }

  warnings.forEach((w) => console.log(`[bundle] warn: ${w}`));
  if (errors.length > 0) {
    errors.forEach((e) => console.error(`[bundle] error: ${e}`));
    process.exitCode = 1;
    return;
  }
  console.log(`[bundle] budgets OK (${REQUIRED_ROUTES.length} route budgets checked)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const budgetFile = process.argv[2] || "performance-budgets.json";
  const { report, json } = parseArgs(process.argv.slice(3));
  runBundleCheck(budgetFile, { report, json }).catch((err) => {
    console.error(`[bundle] ${err.message}`);
    process.exitCode = 1;
  });
}
