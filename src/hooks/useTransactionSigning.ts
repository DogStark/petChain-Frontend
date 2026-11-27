import { useCallback, useMemo, useState } from 'react';
import type {
  HardwareWalletAdapter,
  HardwareWalletDevice,
  HardwareWalletStatus,
  HardwareWalletVendor,
  SignedTransactionPreview,
  SigningMethod,
} from '@/types/wallet';
import { stellarService } from '@/lib/blockchain';
import type { SigningRequest } from '@/lib/blockchain/types';

export interface UseTransactionSigningOptions {
  /** Base64 envelope XDR of the unsigned transaction. */
  envelopeXdr: string;
  /** Stellar public key expected to sign. */
  publicKey: string;
  networkPassphrase: string;
  /** Fee (in stroops) of the transaction, shown in the preview. */
  fee?: string;
  /** Number of operations in the transaction, shown in the preview. */
  operationCount?: number;
  /** Hardware wallet adapters available to the user. */
  adapters?: HardwareWalletAdapter[];
  /** Broadcasts a signed envelope XDR. Defaults to the shared Stellar service. */
  broadcast?: (envelopeXdr: string) => Promise<{ hash: string }>;
}

export interface UseTransactionSigningResult {
  method: SigningMethod;
  setMethod: (method: SigningMethod) => void;
  status: HardwareWalletStatus;
  device: HardwareWalletDevice | null;
  error: string | null;
  signed: SignedTransactionPreview | null;
  isSigning: boolean;
  isBroadcasting: boolean;
  broadcastHash: string | null;
  connectHardwareWallet: (vendor: HardwareWalletVendor) => Promise<void>;
  disconnectHardwareWallet: () => Promise<void>;
  sign: (secretKey?: string) => Promise<SignedTransactionPreview | null>;
  broadcastSigned: () => Promise<string | null>;
  reset: () => void;
}

const DEFAULT_DERIVATION_PATH = "44'/148'/0'";

function buildPreview(
  method: SigningMethod,
  result: { envelopeXdr: string; hash: string; signers: string[] },
  options: UseTransactionSigningOptions
): SignedTransactionPreview {
  return {
    signingMethod: method,
    envelopeXdr: result.envelopeXdr,
    hash: result.hash,
    sourcePublicKey: options.publicKey,
    networkPassphrase: options.networkPassphrase,
    fee: options.fee ?? '0',
    operationCount: options.operationCount ?? 0,
    signers: result.signers,
  };
}

/**
 * Drives the transaction signing confirmation flow: signing method selection,
 * hardware wallet connection, signing, and broadcast of the signed envelope.
 */
export function useTransactionSigning(
  options: UseTransactionSigningOptions
): UseTransactionSigningResult {
  const { envelopeXdr, publicKey, networkPassphrase, adapters = [], broadcast } = options;

  const [method, setMethodState] = useState<SigningMethod>('software');
  const [status, setStatus] = useState<HardwareWalletStatus>('disconnected');
  const [device, setDevice] = useState<HardwareWalletDevice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signed, setSigned] = useState<SignedTransactionPreview | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastHash, setBroadcastHash] = useState<string | null>(null);

  const request: SigningRequest = useMemo(
    () => ({ envelopeXdr, publicKey, networkPassphrase }),
    [envelopeXdr, publicKey, networkPassphrase]
  );

  const setMethod = useCallback((next: SigningMethod) => {
    setMethodState(next);
    setError(null);
    setSigned(null);
  }, []);

  const connectHardwareWallet = useCallback(
    async (vendor: HardwareWalletVendor) => {
      const adapter = adapters.find((candidate) => candidate.vendor === vendor);
      if (!adapter) {
        setStatus('error');
        setError(`No ${vendor} adapter is available in this browser.`);
        return;
      }

      setStatus('connecting');
      setError(null);
      try {
        const connected = await adapter.connect();
        if (connected.publicKey !== publicKey) {
          await adapter.disconnect();
          setStatus('error');
          setError('The connected device does not hold the expected account key.');
          return;
        }
        setDevice(connected);
        setStatus('connected');
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Failed to connect hardware wallet.');
      }
    },
    [adapters, publicKey]
  );

  const disconnectHardwareWallet = useCallback(async () => {
    const adapter = device ? adapters.find((candidate) => candidate.vendor === device.vendor) : null;
    try {
      await adapter?.disconnect();
    } finally {
      setDevice(null);
      setStatus('disconnected');
    }
  }, [adapters, device]);

  const sign = useCallback(
    async (secretKey?: string) => {
      setIsSigning(true);
      setError(null);
      try {
        let result;
        if (method === 'software') {
          if (!secretKey) throw new Error('A secret key is required for software signing.');
          result = stellarService.signWithKeypair(request, secretKey);
        } else {
          if (!device) throw new Error('Connect a hardware wallet before signing.');
          const adapter = adapters.find((candidate) => candidate.vendor === device.vendor);
          if (!adapter) throw new Error('Hardware wallet adapter is no longer available.');
          const signedXdr = await adapter.signTransaction(
            request.envelopeXdr,
            device.derivationPath
          );
          result = {
            envelopeXdr: signedXdr,
            hash: stellarService.hashEnvelope(signedXdr, networkPassphrase),
            signers: [device.publicKey],
          };
        }
        const preview = buildPreview(method, result, options);
        setSigned(preview);
        return preview;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Signing failed.');
        return null;
      } finally {
        setIsSigning(false);
      }
    },
    [adapters, device, method, networkPassphrase, options, request]
  );

  const broadcastSigned = useCallback(async () => {
    if (!signed) {
      setError('Sign the transaction before broadcasting.');
      return null;
    }
    setIsBroadcasting(true);
    setError(null);
    try {
      const submit =
        broadcast ??
        (async (xdr: string) => {
          const transaction = stellarService.transactionFromXdr(xdr, networkPassphrase);
          const result = await stellarService.submitTransaction(transaction);
          if (!result.success || !result.hash) {
            throw new Error(result.error ?? 'Broadcast failed.');
          }
          return { hash: result.hash };
        });
      const { hash } = await submit(signed.envelopeXdr);
      setBroadcastHash(hash);
      return hash;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Broadcast failed.');
      return null;
    } finally {
      setIsBroadcasting(false);
    }
  }, [broadcast, networkPassphrase, signed]);

  const reset = useCallback(() => {
    setSigned(null);
    setError(null);
    setBroadcastHash(null);
  }, []);

  return {
    method,
    setMethod,
    status,
    device,
    error,
    signed,
    isSigning,
    isBroadcasting,
    broadcastHash,
    connectHardwareWallet,
    disconnectHardwareWallet,
    sign,
    broadcastSigned,
    reset,
  };
}

export { DEFAULT_DERIVATION_PATH };
