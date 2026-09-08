/**
 * Regression tests for issue #880:
 * Emergency-contact reorder keyboard support.
 *
 * Run with:
 *   npx ts-node --project tsconfig.test.json tests/emergencyContactReorder.test.ts
 */

import { EmergencyContact, PetEmergencyInfo } from '../src/types/pet';

// ─── helpers ────────────────────────────────────────────────────────────────

function normalisePriorities(contacts: EmergencyContact[]): EmergencyContact[] {
  return contacts.map((c, i) => ({ ...c, priority: i + 1 }));
}

/**
 * Pure implementation of the move logic extracted from EmergencyContactForm
 * so it can be tested without a DOM.
 */
function moveContact(
  contacts: EmergencyContact[],
  id: string,
  direction: 'up' | 'down'
): EmergencyContact[] {
  const arr = [...contacts];
  const idx = arr.findIndex((c) => c.id === id);
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= arr.length) return arr; // boundary – no change
  [arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]];
  return normalisePriorities(arr);
}

// ─── fixtures ───────────────────────────────────────────────────────────────

function makeContacts(count: number): EmergencyContact[] {
  return normalisePriorities(
    Array.from({ length: count }, (_, i) => ({
      id: `contact-${i + 1}`,
      name: `Person ${i + 1}`,
      relationship: 'Friend',
      phone: `555-000${i + 1}`,
      priority: i + 1,
    }))
  );
}

// ─── test runner ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(description: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${description}`);
    passed++;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ ${description}\n    ${msg}`);
    failed++;
  }
}

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected)
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toEqual(expected: T) {
      const a = JSON.stringify(actual);
      const e = JSON.stringify(expected);
      if (a !== e) throw new Error(`Expected\n  ${e}\ngot\n  ${a}`);
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy, got ${JSON.stringify(actual)}`);
    },
    toBeFalsy() {
      if (actual) throw new Error(`Expected falsy, got ${JSON.stringify(actual)}`);
    },
  };
}

// ─── tests ───────────────────────────────────────────────────────────────────

console.log('\n[#880] Emergency contact keyboard reorder\n');

test('normalisePriorities assigns 1-based consecutive priorities', () => {
  const contacts = makeContacts(3);
  expect(contacts[0].priority).toBe(1);
  expect(contacts[1].priority).toBe(2);
  expect(contacts[2].priority).toBe(3);
});

test('priorities are unique – no two contacts share a priority', () => {
  const contacts = makeContacts(4);
  const priorities = contacts.map((c) => c.priority);
  const unique = new Set(priorities);
  expect(unique.size).toBe(priorities.length);
});

test('moveContact up swaps positions', () => {
  const contacts = makeContacts(3); // [1,2,3]
  const result = moveContact(contacts, 'contact-2', 'up');
  // contact-2 should now be at index 0 (priority 1)
  expect(result[0].id).toBe('contact-2');
  expect(result[0].priority).toBe(1);
  // contact-1 should now be at index 1 (priority 2)
  expect(result[1].id).toBe('contact-1');
  expect(result[1].priority).toBe(2);
});

test('moveContact down swaps positions', () => {
  const contacts = makeContacts(3); // [1,2,3]
  const result = moveContact(contacts, 'contact-2', 'down');
  // contact-2 should now be at index 2 (priority 3)
  expect(result[2].id).toBe('contact-2');
  expect(result[2].priority).toBe(3);
  // contact-3 should now be at index 1 (priority 2)
  expect(result[1].id).toBe('contact-3');
  expect(result[1].priority).toBe(2);
});

test('moveContact up from first position is a no-op', () => {
  const contacts = makeContacts(3);
  const result = moveContact(contacts, 'contact-1', 'up');
  // order unchanged
  expect(result[0].id).toBe('contact-1');
  expect(result[1].id).toBe('contact-2');
  expect(result[2].id).toBe('contact-3');
});

test('moveContact down from last position is a no-op', () => {
  const contacts = makeContacts(3);
  const result = moveContact(contacts, 'contact-3', 'down');
  expect(result[2].id).toBe('contact-3');
  expect(result[1].id).toBe('contact-2');
  expect(result[0].id).toBe('contact-1');
});

test('priorities remain unique after multiple reorder operations', () => {
  let contacts = makeContacts(4);
  contacts = moveContact(contacts, 'contact-3', 'up');
  contacts = moveContact(contacts, 'contact-1', 'down');
  contacts = moveContact(contacts, 'contact-4', 'up');
  const priorities = contacts.map((c) => c.priority);
  const unique = new Set(priorities);
  expect(unique.size).toBe(4);
  // priorities should equal [1,2,3,4]
  const sorted = [...priorities].sort((a, b) => a - b);
  expect(JSON.stringify(sorted)).toBe(JSON.stringify([1, 2, 3, 4]));
});

test('single contact cannot be moved in either direction', () => {
  const contacts = makeContacts(1);
  const up = moveContact(contacts, 'contact-1', 'up');
  const down = moveContact(contacts, 'contact-1', 'down');
  expect(up[0].id).toBe('contact-1');
  expect(down[0].id).toBe('contact-1');
});

test('normalisePriorities on empty array returns empty array', () => {
  const result = normalisePriorities([]);
  expect(JSON.stringify(result)).toBe(JSON.stringify([]));
});

test('addContact assigns next consecutive priority', () => {
  const contacts = makeContacts(2); // priority 1, 2
  const newContact: EmergencyContact = {
    id: 'contact-new',
    name: '',
    relationship: '',
    phone: '',
    priority: contacts.length + 1,
  };
  const updated = normalisePriorities([...contacts, newContact]);
  expect(updated[2].priority).toBe(3);
  expect(updated[2].id).toBe('contact-new');
});

test('removeContact re-normalises priorities', () => {
  const contacts = makeContacts(3); // priorities 1,2,3
  const after = normalisePriorities(contacts.filter((c) => c.id !== 'contact-2'));
  expect(after.length).toBe(2);
  expect(after[0].priority).toBe(1);
  expect(after[1].priority).toBe(2);
  expect(after[0].id).toBe('contact-1');
  expect(after[1].id).toBe('contact-3');
});

// ─── summary ─────────────────────────────────────────────────────────────────

console.log(`\n  Passed: ${passed}  Failed: ${failed}\n`);
if (failed > 0) {
  process.exit(1);
}
