/**
 * Fixture test exercising pet registration, access sharing, and ownership transfer
 * end to end against a local/test deployment (mocked Soroban / Stellar environment).
 *
 * Run with:
 *   npx ts-node --project tsconfig.test.json tests/integration/petContractFixture.test.ts
 */

import assert from 'assert';
import * as StellarSdk from '@stellar/stellar-sdk';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  \u2713 ${name}`);
    passed++;
  } catch (e: any) {
    console.error(`  \u2717 ${name}\n    ${e.message}`);
    failed++;
  }
}

// Local test deployment fixture for pet registration, access sharing, and ownership transfer
class MockPetContractDeployment {
  private pets = new Map<string, { owner: string; metadataHash: string }>();
  private accesses = new Map<string, Set<string>>(); // recordId -> set of accessor public keys

  registerPet(petId: string, owner: string, metadataHash: string): boolean {
    if (this.pets.has(petId)) {
      throw new Error(`Pet ${petId} already registered`);
    }
    this.pets.set(petId, { owner, metadataHash });
    return true;
  }

  getPet(petId: string) {
    const pet = this.pets.get(petId);
    if (!pet) throw new Error(`Pet ${petId} not found`);
    return pet;
  }

  transferOwnership(petId: string, currentOwner: string, newOwner: string): boolean {
    const pet = this.getPet(petId);
    if (pet.owner !== currentOwner) {
      throw new Error(`Unauthorized: ${currentOwner} is not the owner of ${petId}`);
    }
    pet.owner = newOwner;
    return true;
  }

  grantAccess(recordId: string, accessor: string): boolean {
    if (!this.accesses.has(recordId)) {
      this.accesses.set(recordId, new Set());
    }
    this.accesses.get(recordId)!.add(accessor);
    return true;
  }

  hasAccess(recordId: string, accessor: string): boolean {
    const accessSet = this.accesses.get(recordId);
    return accessSet ? accessSet.has(accessor) : false;
  }
}

async function main() {
  console.log('\n[Fixture Test] End-to-End Pet Registration, Access Sharing, & Ownership Transfer\n');

  const deployment = new MockPetContractDeployment();
  const ownerKeypair = StellarSdk.Keypair.random();
  const newOwnerKeypair = StellarSdk.Keypair.random();
  const vetKeypair = StellarSdk.Keypair.random();

  const petId = 'pet-12345';
  const metadataHash = 'abcdef0123456789';

  await test('1. Pet Registration: registers a new pet successfully', () => {
    const success = deployment.registerPet(petId, ownerKeypair.publicKey(), metadataHash);
    assert.strictEqual(success, true, 'registration should succeed');
    const pet = deployment.getPet(petId);
    assert.strictEqual(pet.owner, ownerKeypair.publicKey());
    assert.strictEqual(pet.metadataHash, metadataHash);
  });

  await test('2. Access Sharing: grants access to a vet accessor', () => {
    const recordId = `record-${petId}`;
    deployment.grantAccess(recordId, vetKeypair.publicKey());
    const hasAccess = deployment.hasAccess(recordId, vetKeypair.publicKey());
    assert.strictEqual(hasAccess, true, 'vet should have access after granting');

    const unauthorizedAccess = deployment.hasAccess(recordId, newOwnerKeypair.publicKey());
    assert.strictEqual(unauthorizedAccess, false, 'unauthorized user should not have access');
  });

  await test('3. Ownership Transfer: transfers pet ownership to a new owner', () => {
    const success = deployment.transferOwnership(
      petId,
      ownerKeypair.publicKey(),
      newOwnerKeypair.publicKey()
    );
    assert.strictEqual(success, true, 'ownership transfer should succeed');

    const pet = deployment.getPet(petId);
    assert.strictEqual(pet.owner, newOwnerKeypair.publicKey(), 'new owner should be recorded');
  });

  await test('4. Ownership Transfer Security: unauthorized transfer fails', () => {
    try {
      deployment.transferOwnership(
        petId,
        ownerKeypair.publicKey(), // old owner who no longer owns it
        vetKeypair.publicKey()
      );
      assert.fail('expected transfer to fail for non-owner');
    } catch (err: any) {
      assert.ok(
        err.message.includes('Unauthorized'),
        `expected unauthorized error, got: ${err.message}`
      );
    }
  });

  console.log(`\n  Passed: ${passed}  Failed: ${failed}\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error in fixture test:', err);
  process.exit(1);
});
