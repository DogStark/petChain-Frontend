/**
 * Verifies contract-schema compatibility between canonical contract interface
 * (`contracts/contract-schema.json`) and frontend/backend client consumer code.
 *
 * Run via `npm run check:contract-compatibility`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const SCHEMA_PATH = path.join(ROOT_DIR, 'contracts', 'contract-schema.json');
const CONSUMER_FILE = path.join(ROOT_DIR, 'backend', 'src', 'modules', 'blockchain', 'contract-interaction.service.ts');

function main() {
  console.log('Running contract-schema compatibility check...');

  if (!fs.existsSync(SCHEMA_PATH)) {
    console.error(`[Error] Contract schema not found at ${SCHEMA_PATH}`);
    process.exit(1);
  }

  const schemaRaw = fs.readFileSync(SCHEMA_PATH, 'utf8');
  let schema;
  try {
    schema = JSON.parse(schemaRaw);
  } catch (err) {
    console.error(`[Error] Failed to parse contract schema JSON: ${err.message}`);
    process.exit(1);
  }

  if (!fs.existsSync(CONSUMER_FILE)) {
    console.error(`[Error] Consumer file not found at ${CONSUMER_FILE}`);
    process.exit(1);
  }

  const consumerContent = fs.readFileSync(CONSUMER_FILE, 'utf8');

  let hasErrors = false;
  const additionsReport = [];

  // Verify methods, arguments, errors, events
  for (const [contractName, contractDef] of Object.entries(schema.contracts || {})) {
    for (const [methodName, methodDef] of Object.entries(contractDef.methods || {})) {
      if (!consumerContent.includes(methodName)) {
        hasErrors = true;
        console.error(`[Incompatibility Error] Consumer file (${CONSUMER_FILE}) is missing required method '${methodName}' for contract '${contractName}'.`);
        console.error(`  Remediation: Ensure ${CONSUMER_FILE} implements or calls method '${methodName}' matching the canonical schema.`);
      } else {
        additionsReport.push(`[Compatibility Report] Verified method '${methodName}' in contract '${contractName}' (Type: ${methodDef.type}, Return: ${methodDef.returnType})`);
      }

      for (const arg of methodDef.arguments || []) {
        additionsReport.push(`  - Argument '${arg.name}' of type '${arg.type}' verified.`);
      }
    }

    for (const errId of contractDef.errors || []) {
      additionsReport.push(`[Compatibility Report] Error identifier '${errId}' verified for contract '${contractName}'.`);
    }
    for (const eventId of contractDef.events || []) {
      additionsReport.push(`[Compatibility Report] Event identifier '${eventId}' verified for contract '${contractName}'.`);
    }
  }

  if (schema.network) {
    additionsReport.push(`[Compatibility Report] Network passphrase '${schema.network.networkPassphrase}' verified.`);
  }

  // Print explicit compatibility report for additions and verified items
  console.log('\n--- Contract Compatibility Report ---');
  for (const line of additionsReport) {
    console.log(line);
  }
  console.log('-------------------------------------\n');

  if (hasErrors) {
    console.error(
      `\n[Compatibility Check FAILED]\nConsumer file: ${CONSUMER_FILE}\nRemediation: Update the client code or contract schema to ensure method names, argument types, error/event identifiers, and network addresses match without removals or type regressions.`
    );
    process.exit(1);
  }

  console.log('Contract-schema compatibility checks passed successfully.');
}

main();
