import { Eye, EyeOff, Pin } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { useAssetPreferences } from '../../hooks/useAssetPreferences';
import { NATIVE_ASSET_KEY, organizeAssets } from '../../lib/wallet/assetPreferences';
import type { OrganizedAsset } from '../../lib/wallet/assetPreferences';
import type { WalletBalance, WalletNetwork } from '../../types/wallet';
import { formatBalance } from '../../utils/formatCurrency';

interface Props {
  balances: WalletBalance[];
  walletId: string;
  network: WalletNetwork;
}

type PendingFocus = { kind: 'pin'; key: string } | { kind: 'visibility' } | null;

function pluralAssets(count: number): string {
  return `${count} ${count === 1 ? 'asset' : 'assets'}`;
}

export default function WalletAssetList({ balances, walletId, network }: Props) {
  const { preferences, canPersist, togglePin, toggleHidden } = useAssetPreferences(
    walletId,
    network,
  );
  // Hidden assets stay out of the DOM until the user asks to see them.
  const [showHidden, setShowHidden] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const disclosureRef = useRef<HTMLButtonElement>(null);
  const pinButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocusRef = useRef<PendingFocus>(null);

  useEffect(() => {
    setShowHidden(false);
    setStatusMessage('');
  }, [walletId]);

  const { visible, hidden, total } = useMemo(
    () => organizeAssets(balances, preferences),
    [balances, preferences],
  );

  // Cards move between groups when toggled, so restore focus after re-render.
  useEffect(() => {
    const pending = pendingFocusRef.current;
    if (!pending) return;
    pendingFocusRef.current = null;
    if (pending.kind === 'pin') {
      pinButtonRefs.current.get(pending.key)?.focus();
    } else {
      (disclosureRef.current ?? headingRef.current)?.focus();
    }
  });

  useEffect(() => {
    if (hidden.length === 0) setShowHidden(false);
  }, [hidden.length]);

  function handleTogglePin(asset: OrganizedAsset) {
    togglePin(asset.key);
    pendingFocusRef.current = { kind: 'pin', key: asset.key };
    setStatusMessage(asset.pinned ? `${asset.label} unpinned.` : `${asset.label} pinned to top.`);
  }

  function handleToggleHidden(asset: OrganizedAsset) {
    toggleHidden(asset.key);
    pendingFocusRef.current = { kind: 'visibility' };
    const hiddenCount = asset.hidden ? hidden.length - 1 : hidden.length + 1;
    setStatusMessage(
      asset.hidden
        ? `${asset.label} shown. ${pluralAssets(hiddenCount)} hidden.`
        : `${asset.label} hidden. ${pluralAssets(hiddenCount)} hidden.`,
    );
  }

  function renderCard(asset: OrganizedAsset) {
    const { balance, key, label } = asset;
    const isNative = key === NATIVE_ASSET_KEY;

    return (
      <li
        key={key}
        className={`bg-white rounded-xl shadow-sm border p-5 ${
          asset.pinned ? 'border-blue-300' : 'border-gray-200'
        } ${asset.hidden ? 'opacity-70' : ''}`}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">
            {isNative ? 'XLM Balance' : label}
          </p>
          {asset.supported && (
            <div className="flex items-center gap-1 -mt-1 -me-1">
              <button
                type="button"
                ref={(el) => {
                  if (el) pinButtonRefs.current.set(key, el);
                  else pinButtonRefs.current.delete(key);
                }}
                onClick={() => handleTogglePin(asset)}
                aria-pressed={asset.pinned}
                aria-label={`Pin ${label}`}
                title={asset.pinned ? 'Unpin' : 'Pin to top'}
                className={`p-1.5 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  asset.pinned ? 'text-blue-600' : 'text-gray-400 hover:text-blue-600'
                }`}
              >
                <Pin size={14} aria-hidden="true" className={asset.pinned ? 'fill-current' : ''} />
              </button>
              {!isNative && (
                <button
                  type="button"
                  onClick={() => handleToggleHidden(asset)}
                  aria-pressed={asset.hidden}
                  aria-label={`Hide ${label}`}
                  title={asset.hidden ? 'Show in balances' : 'Hide from balances'}
                  className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {asset.hidden ? (
                    <Eye size={14} aria-hidden="true" />
                  ) : (
                    <EyeOff size={14} aria-hidden="true" />
                  )}
                </button>
              )}
            </div>
          )}
        </div>
        <p className="text-3xl font-bold text-gray-900">{formatBalance(balance.balance)}</p>
        {isNative && <p className="text-sm text-gray-400 mt-1">Stellar Lumens</p>}
        {!isNative && balance.limit && (
          <p className="text-sm text-gray-400 mt-1">Limit: {balance.limit}</p>
        )}
        {asset.pinned && <p className="text-xs text-blue-600 mt-1">Pinned</p>}
      </li>
    );
  }

  const hiddenListId = `wallet-hidden-assets-${walletId}`;

  return (
    <section aria-labelledby="wallet-assets-heading" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3
          id="wallet-assets-heading"
          ref={headingRef}
          tabIndex={-1}
          className="font-semibold text-gray-900 focus:outline-none"
        >
          Assets
        </h3>
        {total > 0 && (
          <p className="text-sm text-gray-500">
            Showing {visible.length} of {pluralAssets(total)}
          </p>
        )}
      </div>

      {total === 0 ? (
        <p className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 text-sm text-gray-500">
          This account does not hold any assets yet.
        </p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map(renderCard)}
        </ul>
      )}

      {hidden.length > 0 && (
        <div className="space-y-3">
          <button
            type="button"
            ref={disclosureRef}
            onClick={() => setShowHidden((s) => !s)}
            aria-expanded={showHidden}
            aria-controls={hiddenListId}
            className="text-sm text-blue-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          >
            {pluralAssets(hidden.length)} hidden · {showHidden ? 'Collapse' : 'Show'}
          </button>
          {showHidden && (
            <ul
              id={hiddenListId}
              aria-label="Hidden assets"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {hidden.map(renderCard)}
            </ul>
          )}
        </div>
      )}

      {!canPersist && (
        <p className="text-xs text-yellow-700">
          Asset preferences can&apos;t be saved on this device and will reset when you leave.
        </p>
      )}

      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </p>
    </section>
  );
}
