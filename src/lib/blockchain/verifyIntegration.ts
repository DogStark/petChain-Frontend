import * as StellarSdk from '@stellar/stellar-sdk';
import { stellarService } from './index';

async function verifyIntegration() {
  console.log('--- Starting Stellar Integration Verification ---');

  try {
    // 1. Create Account
    console.log('1. Creating a new test account...');
    const keypair = stellarService.createAccount();
    const publicKey = keypair.publicKey();
    console.log(`   Public Key: ${publicKey}`);

    // 2. Fund Account (Testnet)
    console.log('2. Funding account via Friendbot...');
    const funded = await stellarService.fundAccount(publicKey);
    if (funded) {
      console.log('   Account successfully funded!');
    }

    // 3. Fetch Account Details
    console.log('3. Fetching account details...');
    const details = await stellarService.getAccount(publicKey);
    console.log(`   Sequence: ${details.sequence}`);
    console.log('   Balances:');
    details.balances.forEach((b) => {
      if ('balance' in b) {
        console.log(`     - ${b.asset_type}: ${b.balance}`);
      }
    });

    // 4. Submit Transaction (Manage Data)
    console.log('4. Building and submitting a test transaction (manageData)...');
    const operation = StellarSdk.Operation.manageData({
      name: 'IntegrationTest',
      value: 'Success_' + Date.now(),
    }) as unknown as StellarSdk.xdr.Operation<StellarSdk.Operation>;

    const transaction = await stellarService.buildTransaction(publicKey, [operation]);
    transaction.sign(keypair);

    console.log('   Submitting transaction...');
    const result = await stellarService.submitTransaction(transaction);

    if (result.success) {
      console.log('   Transaction submitted successfully!');
      console.log(`   Hash: ${result.hash}`);
      console.log(`   Ledger: ${result.ledger}`);
      console.log(`   Fee Charged: ${result.feeCharged}`);
    } else {
      console.error(`   Transaction failed: ${result.error}`);
    }
  } catch (error) {
    console.error('--- Verification Failed ---');
    console.error(error instanceof Error ? error.message : error);
  }

  console.log('--- Verification Complete ---');
}

// In a real environment, we'd run this via ts-node or similar.
// For now, I'll provide the script for the user to see and I'll attempt a dry run if possible.
verifyIntegration();
