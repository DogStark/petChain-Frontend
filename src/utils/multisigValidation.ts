import type { WalletSigner, MultiSigConfig, WalletMonitoringData } from '../types/wallet';

export interface ValidationWarning {
  field: string;
  message: string;
}

export interface ValidationResult {
  errors: string[];
  warnings: ValidationWarning[];
}

const STELLAR_KEY_LENGTH = 56;
const STELLAR_KEY_PREFIX = 'G';
const MAX_WEIGHT = 255;

function isValidStellarPublicKey(key: string): boolean {
  return (
    key.length === STELLAR_KEY_LENGTH && key.startsWith(STELLAR_KEY_PREFIX)
  );
}

function deduplicateSigners(signers: WalletSigner[]): number[] {
  const seen = new Map<string, number>();
  const duplicates: number[] = [];
  signers.forEach((s, idx) => {
    const pk = s.publicKey.trim();
    if (!pk) return;
    if (seen.has(pk)) {
      duplicates.push(idx);
    } else {
      seen.set(pk, idx);
    }
  });
  return duplicates;
}

export function validateMultisigConfig(
  signers: WalletSigner[],
  masterWeight: number,
  lowThreshold: number,
  medThreshold: number,
  highThreshold: number,
  walletPublicKey: string,
  accountData: WalletMonitoringData | null,
): ValidationResult {
  const errors: string[] = [];
  const warnings: ValidationWarning[] = [];

  const populatedSigners = signers.filter((s) => s.publicKey.trim());

  for (let i = 0; i < signers.length; i++) {
    const s = signers[i];
    const label = `Signer ${i + 1}`;

    if (!s.publicKey.trim()) {
      errors.push(`${label} must have a public key.`);
      continue;
    }

    if (!isValidStellarPublicKey(s.publicKey)) {
      errors.push(
        `${label}: "${s.publicKey.slice(0, 12)}…" is not a valid Stellar public key (must start with ${STELLAR_KEY_PREFIX}, ${STELLAR_KEY_LENGTH} chars).`,
      );
    }

    if (s.publicKey === walletPublicKey) {
      errors.push(
        `${label}: cannot add your own key as a co-signer — adjust the master weight instead.`,
      );
    }

    if (s.weight < 0 || s.weight > MAX_WEIGHT) {
      errors.push(`${label}: weight must be between 0 and ${MAX_WEIGHT}.`);
    }

    if (s.weight === 0 && s.publicKey.trim()) {
      warnings.push({
        field: `signer_${i}_weight`,
        message: `${label} has weight 0 and will not contribute to any threshold.`,
      });
    }
  }

  const duplicateIndices = deduplicateSigners(signers);
  if (duplicateIndices.length > 0) {
    const dupKeys = duplicateIndices
      .map((i) => `"${signers[i].publicKey.slice(0, 12)}…"`)
      .join(', ');
    errors.push(`Duplicate co-signer keys detected: ${dupKeys}. Each signer must be unique.`);
  }

  if (accountData) {
    const existingKeys = new Set(
      accountData.signers
        .filter((s) => s.publicKey !== walletPublicKey)
        .map((s) => s.publicKey),
    );
    const duplicatesWithExisting = populatedSigners.filter((s) =>
      existingKeys.has(s.publicKey),
    );
    if (duplicatesWithExisting.length > 0) {
      const dupKeys = duplicatesWithExisting
        .map((s) => `"${s.publicKey.slice(0, 12)}…"`)
        .join(', ');
      errors.push(
        `${dupKeys} already exist(s) on-chain as co-signer(s). Remove them first or use different keys.`,
      );
    }
  }

  if (masterWeight < 0 || masterWeight > MAX_WEIGHT) {
    errors.push(`Master weight must be between 0 and ${MAX_WEIGHT}.`);
  }

  if (masterWeight === 0 && populatedSigners.length === 0) {
    warnings.push({
      field: 'masterWeight',
      message: 'Master weight is 0 with no co-signers — the account may become inaccessible.',
    });
  }

  if (lowThreshold < 0) {
    errors.push('Low threshold must be non-negative.');
  }
  if (medThreshold < 0) {
    errors.push('Medium threshold must be non-negative.');
  }
  if (highThreshold < 0) {
    errors.push('High threshold must be non-negative.');
  }

  if (medThreshold < lowThreshold) {
    errors.push('Medium threshold must be ≥ low threshold.');
  }
  if (highThreshold < medThreshold) {
    errors.push('High threshold must be ≥ medium threshold.');
  }

  const totalWeight =
    populatedSigners.reduce((sum, s) => sum + (s.weight || 0), 0) + masterWeight;

  if (totalWeight === 0 && (lowThreshold > 0 || medThreshold > 0 || highThreshold > 0)) {
    errors.push(
      'Total available weight is 0 but thresholds are set — no transactions will be possible.',
    );
  }

  if (lowThreshold > totalWeight) {
    errors.push(
      `Low threshold (${lowThreshold}) exceeds total available weight (${totalWeight}) — low-weight operations will be impossible.`,
    );
  }
  if (medThreshold > totalWeight) {
    errors.push(
      `Medium threshold (${medThreshold}) exceeds total available weight (${totalWeight}) — payments will be impossible.`,
    );
  }
  if (highThreshold > totalWeight) {
    errors.push(
      `High threshold (${highThreshold}) exceeds total available weight (${totalWeight}) — account changes will be impossible.`,
    );
  }

  if (totalWeight > 0 && highThreshold === totalWeight) {
    warnings.push({
      field: 'highThreshold',
      message:
        'High threshold equals total weight — all signers must participate for account changes. If any signer is unavailable, account changes will be locked.',
    });
  }

  if (totalWeight > 0 && medThreshold === totalWeight) {
    warnings.push({
      field: 'medThreshold',
      message:
        'Medium threshold equals total weight — all signers must participate for payments. If any signer is unavailable, payments will be locked.',
    });
  }

  return { errors, warnings };
}

export function buildConfigSummary(
  signers: WalletSigner[],
  masterWeight: number,
  lowThreshold: number,
  medThreshold: number,
  highThreshold: number,
): { label: string; value: string; highlight?: boolean }[] {
  const populatedSigners = signers.filter((s) => s.publicKey.trim());
  const totalWeight =
    populatedSigners.reduce((sum, s) => sum + (s.weight || 0), 0) + masterWeight;

  return [
    { label: 'Co-signers', value: `${populatedSigners.length} signer(s)` },
    { label: 'Master Weight', value: String(masterWeight) },
    { label: 'Total Weight', value: String(totalWeight) },
    { label: 'Low Threshold', value: String(lowThreshold) },
    { label: 'Medium Threshold', value: String(medThreshold), highlight: true },
    { label: 'High Threshold', value: String(highThreshold), highlight: true },
  ];
}
