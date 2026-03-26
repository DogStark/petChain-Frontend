import type { NextApiRequest, NextApiResponse } from 'next';
import { stellarSync } from '@/lib/blockchain/stellarSync';
import * as StellarSdk from '@stellar/stellar-sdk';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { record, secretKey, encryptionKey } = req.body;

    if (!record || !secretKey || !encryptionKey) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const keypair = StellarSdk.Keypair.fromSecret(secretKey);
    const result = await stellarSync.syncRecord(record, keypair, encryptionKey);

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
}
