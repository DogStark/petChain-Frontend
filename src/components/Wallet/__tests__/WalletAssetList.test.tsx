import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import React from 'react';


import { getAssetPreferencesStorageKey } from '@/lib/wallet/assetPreferences';
import type { WalletBalance } from '@/types/wallet';

import WalletAssetList from '../WalletAssetList';

const ISSUER = 'GAISSUERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

const balances: WalletBalance[] = [
  { asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: ISSUER, balance: '25.0000000' },
  { asset_type: 'credit_alphanum12', asset_code: 'PETTOKEN', asset_issuer: ISSUER, balance: '7.0000000' },
  { asset_type: 'native', balance: '100.0000000' },
];

const STORAGE_KEY = getAssetPreferencesStorageKey('wallet-1', 'TESTNET');

function renderList(props: Partial<React.ComponentProps<typeof WalletAssetList>> = {}) {
  return render(
    <WalletAssetList balances={balances} walletId="wallet-1" network="TESTNET" {...props} />,
  );
}

function cardLabels(list: HTMLElement): string[] {
  return within(list)
    .getAllByRole('listitem')
    .map((item) => item.querySelector('p')?.textContent ?? '');
}

describe('WalletAssetList', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.restoreAllMocks();
  });

  it('shows every asset with XLM first and no hidden disclosure by default', () => {
    renderList();

    expect(cardLabels(screen.getAllByRole('list')[0])).toEqual(['XLM Balance', 'USDC', 'PETTOKEN']);
    expect(screen.getByText('Showing 3 of 3 assets')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /hidden/ })).not.toBeInTheDocument();
  });

  it('hides an asset, keeps the total accurate and discloses it on demand', async () => {
    const user = userEvent.setup();
    renderList();

    await user.click(screen.getByRole('button', { name: 'Hide USDC' }));

    expect(screen.queryByText('25.00')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 2 of 3 assets')).toBeInTheDocument();
    const disclosure = screen.getByRole('button', { name: '1 asset hidden · Show' });
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    expect(disclosure).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('USDC hidden. 1 asset hidden.');

    await user.click(disclosure);
    expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    const hiddenList = screen.getByRole('list', { name: 'Hidden assets' });
    expect(within(hiddenList).getByText('USDC')).toBeInTheDocument();

    const unhide = within(hiddenList).getByRole('button', { name: 'Hide USDC' });
    expect(unhide).toHaveAttribute('aria-pressed', 'true');
    await user.click(unhide);

    expect(screen.queryByRole('list', { name: 'Hidden assets' })).not.toBeInTheDocument();
    expect(screen.getByText('Showing 3 of 3 assets')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Assets' })).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('USDC shown. 0 assets hidden.');
  });

  it('pins assets to the top in pin order and keeps focus on the toggle', async () => {
    const user = userEvent.setup();
    renderList();

    await user.click(screen.getByRole('button', { name: 'Pin PETTOKEN' }));
    await user.click(screen.getByRole('button', { name: 'Pin USDC' }));

    expect(cardLabels(screen.getByRole('list'))).toEqual(['PETTOKEN', 'USDC', 'XLM Balance']);
    expect(screen.getByRole('button', { name: 'Pin USDC' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Pin USDC' })).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('USDC pinned to top.');
  });

  it('is operable with the keyboard alone', async () => {
    const user = userEvent.setup();
    renderList();

    screen.getByRole('button', { name: 'Pin XLM' }).focus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Pin USDC' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Hide USDC' })).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('button', { name: '1 asset hidden · Show' })).toHaveFocus();
    await user.keyboard(' ');
    expect(screen.getByRole('list', { name: 'Hidden assets' })).toBeInTheDocument();
  });

  it('does not offer a hide control for XLM', () => {
    renderList();

    expect(screen.getByRole('button', { name: 'Pin XLM' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hide XLM' })).not.toBeInTheDocument();
  });

  it('persists preferences per wallet and network', async () => {
    const user = userEvent.setup();
    const { unmount } = renderList();

    await user.click(screen.getByRole('button', { name: 'Hide PETTOKEN' }));
    unmount();

    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({
      pinned: [],
      hidden: [`PETTOKEN:${ISSUER}`],
    });

    const { unmount: unmountAgain } = renderList();
    expect(screen.getByRole('button', { name: '1 asset hidden · Show' })).toBeInTheDocument();
    unmountAgain();

    renderList({ walletId: 'wallet-2' });
    expect(screen.queryByRole('button', { name: /hidden/ })).not.toBeInTheDocument();
  });

  it('ignores stale or corrupted stored preferences', () => {
    window.localStorage.setItem(STORAGE_KEY, '{"hidden":["GONE:ISSUER"],"pinned":');
    renderList();

    expect(screen.getByText('Showing 3 of 3 assets')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /hidden/ })).not.toBeInTheDocument();
  });

  it('keeps working for the session when storage is denied', async () => {
    jest.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Denied', 'SecurityError');
    });
    const user = userEvent.setup();
    renderList();

    await user.click(screen.getByRole('button', { name: 'Hide USDC' }));

    expect(screen.getByRole('button', { name: '1 asset hidden · Show' })).toBeInTheDocument();
    expect(screen.getByText(/can't be saved on this device/)).toBeInTheDocument();
  });

  it('shows the denied-storage notice when preferences cannot be read', () => {
    jest.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('Denied', 'SecurityError');
    });
    renderList();

    expect(screen.getByText(/can't be saved on this device/)).toBeInTheDocument();
    expect(screen.getByText('Showing 3 of 3 assets')).toBeInTheDocument();
  });

  it('renders an empty state when the account holds no assets', () => {
    renderList({ balances: [] });

    expect(screen.getByText('This account does not hold any assets yet.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('shows unsupported assets without pin or hide controls', () => {
    renderList({ balances: [{ asset_type: 'liquidity_pool_shares', balance: '3.0000000' }] });

    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('has no detectable accessibility violations with hidden assets revealed', async () => {
    const user = userEvent.setup();
    const { container } = renderList();

    await user.click(screen.getByRole('button', { name: 'Hide USDC' }));
    await user.click(screen.getByRole('button', { name: '1 asset hidden · Show' }));

    expect(await axe(container)).toHaveNoViolations();
  });
});
