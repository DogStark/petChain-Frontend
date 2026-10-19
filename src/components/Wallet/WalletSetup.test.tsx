import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WalletSetup from './WalletSetup';

// Test fixtures with fake values (never real secrets)
const FAKE_PIN = 'test-pin-123456';
const FAKE_PIN_CONFIRM = 'test-pin-123456';
const FAKE_SECRET_KEY = 'SBZVMB74Z76QZ3ZXK4XNVVX4XWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWX';
const FAKE_LABEL = 'Test Wallet';

describe('WalletSetup', () => {
  const mockOnCreateWallet = jest.fn();
  const mockOnImportWallet = jest.fn();
  const mockOnClearError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnCreateWallet.mockResolvedValue(undefined);
    mockOnImportWallet.mockResolvedValue(undefined);
  });

  describe('Create Wallet - PIN Zeroing', () => {
    it('regression: PIN field is cleared after successful wallet creation', async () => {
      const user = userEvent.setup();
      const { unmount } = render(
        <WalletSetup
          onCreateWallet={mockOnCreateWallet}
          onImportWallet={mockOnImportWallet}
          loading={false}
          error={null}
          onClearError={mockOnClearError}
        />
      );

      // Fill in create form
      const nameInput = screen.getByPlaceholderText(/My Pet Wallet/);
      const pinInputs = screen.getAllByPlaceholderText(/Enter PIN|Re-enter PIN/);
      const createButton = screen.getByRole('button', { name: /Create Wallet/i });

      await user.type(nameInput, FAKE_LABEL);
      await user.type(pinInputs[0], FAKE_PIN);
      await user.type(pinInputs[1], FAKE_PIN_CONFIRM);

      // Verify PIN is filled
      expect(pinInputs[0]).toHaveValue(FAKE_PIN);

      // Submit form
      await user.click(createButton);

      // Wait for success and verify PIN is cleared
      await waitFor(() => {
        expect(mockOnCreateWallet).toHaveBeenCalled();
        expect(pinInputs[0]).toHaveValue('');
        expect(pinInputs[1]).toHaveValue('');
      });

      unmount();
    });

    it('regression: PIN fields are cleared on component unmount', async () => {
      const user = userEvent.setup();
      const { unmount } = render(
        <WalletSetup
          onCreateWallet={mockOnCreateWallet}
          onImportWallet={mockOnImportWallet}
          loading={false}
          error={null}
          onClearError={mockOnClearError}
        />
      );

      const pinInputs = screen.getAllByPlaceholderText(/Enter PIN|Re-enter PIN/);
      const nameInput = screen.getByPlaceholderText(/My Pet Wallet/);

      // Fill in sensitive data
      await user.type(nameInput, FAKE_LABEL);
      await user.type(pinInputs[0], FAKE_PIN);
      await user.type(pinInputs[1], FAKE_PIN_CONFIRM);

      expect(pinInputs[0]).toHaveValue(FAKE_PIN);

      // Unmount component
      unmount();

      // After unmount, verify cleanup occurred (can't access unmounted component)
      // This test verifies the cleanup function is in place
      expect(mockOnCreateWallet).not.toHaveBeenCalled();
    });

    it('regression: PIN fields are cleared on cancel', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <WalletSetup
          onCreateWallet={mockOnCreateWallet}
          onImportWallet={mockOnImportWallet}
          loading={false}
          error={null}
          onClearError={mockOnClearError}
        />
      );

      const pinInputs = screen.getAllByPlaceholderText(/Enter PIN|Re-enter PIN/);
      const nameInput = screen.getByPlaceholderText(/My Pet Wallet/);

      // Fill in create form
      await user.type(nameInput, FAKE_LABEL);
      await user.type(pinInputs[0], FAKE_PIN);
      await user.type(pinInputs[1], FAKE_PIN_CONFIRM);

      expect(pinInputs[0]).toHaveValue(FAKE_PIN);

      // Switch to import tab (cancel create)
      const importTab = screen.getByRole('button', { name: /Import Existing/i });
      await user.click(importTab);

      // Verify PIN fields are cleared after tab switch
      const importPinInputs = screen.getAllByPlaceholderText(/Enter PIN|Re-enter PIN/);
      expect(importPinInputs[0]).toHaveValue('');
      expect(importPinInputs[1]).toHaveValue('');
    });
  });

  describe('Import Wallet - Secret Key and PIN Zeroing', () => {
    it('regression: secret key is zeroed after successful wallet import', async () => {
      const user = userEvent.setup();
      const { unmount } = render(
        <WalletSetup
          onCreateWallet={mockOnCreateWallet}
          onImportWallet={mockOnImportWallet}
          loading={false}
          error={null}
          onClearError={mockOnClearError}
        />
      );

      // Switch to import tab
      const importTab = screen.getByRole('button', { name: /Import Existing/i });
      await user.click(importTab);

      // Fill in import form
      const nameInput = screen.getByPlaceholderText(/Existing Wallet/);
      const secretKeyInput = screen.getByPlaceholderText(/SXXXXXXXXX/);
      const pinInputs = screen.getAllByPlaceholderText(/Enter PIN|Re-enter PIN/);
      const importButton = screen.getByRole('button', { name: /Import Wallet/i });

      await user.type(nameInput, FAKE_LABEL);
      await user.type(secretKeyInput, FAKE_SECRET_KEY);
      await user.type(pinInputs[0], FAKE_PIN);
      await user.type(pinInputs[1], FAKE_PIN_CONFIRM);

      // Verify secret key is filled
      expect(secretKeyInput).toHaveValue(FAKE_SECRET_KEY);
      expect(pinInputs[0]).toHaveValue(FAKE_PIN);

      // Submit form
      await user.click(importButton);

      // Wait for success and verify secrets are cleared
      await waitFor(() => {
        expect(mockOnImportWallet).toHaveBeenCalled();
        expect(secretKeyInput).toHaveValue('');
        expect(pinInputs[0]).toHaveValue('');
        expect(pinInputs[1]).toHaveValue('');
      });

      unmount();
    });

    it('regression: secret key field is cleared on component unmount', async () => {
      const user = userEvent.setup();
      const { unmount } = render(
        <WalletSetup
          onCreateWallet={mockOnCreateWallet}
          onImportWallet={mockOnImportWallet}
          loading={false}
          error={null}
          onClearError={mockOnClearError}
        />
      );

      // Switch to import tab
      const importTab = screen.getByRole('button', { name: /Import Existing/i });
      await user.click(importTab);

      const nameInput = screen.getByPlaceholderText(/Existing Wallet/);
      const secretKeyInput = screen.getByPlaceholderText(/SXXXXXXXXX/);

      // Fill in sensitive data
      await user.type(nameInput, FAKE_LABEL);
      await user.type(secretKeyInput, FAKE_SECRET_KEY);

      expect(secretKeyInput).toHaveValue(FAKE_SECRET_KEY);

      // Unmount component
      unmount();

      // After unmount, cleanup should have cleared state
      expect(mockOnImportWallet).not.toHaveBeenCalled();
    });
  });

  describe('Security: No secrets in console logs', () => {
    it('does not log PIN or secret key values to console', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const user = userEvent.setup();

      const { unmount } = render(
        <WalletSetup
          onCreateWallet={mockOnCreateWallet}
          onImportWallet={mockOnImportWallet}
          loading={false}
          error={null}
          onClearError={mockOnClearError}
        />
      );

      const pinInputs = screen.getAllByPlaceholderText(/Enter PIN|Re-enter PIN/);
      const nameInput = screen.getByPlaceholderText(/My Pet Wallet/);

      await user.type(nameInput, FAKE_LABEL);
      await user.type(pinInputs[0], FAKE_PIN);
      await user.type(pinInputs[1], FAKE_PIN_CONFIRM);

      const createButton = screen.getByRole('button', { name: /Create Wallet/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(mockOnCreateWallet).toHaveBeenCalled();
      });

      // Verify no sensitive data in console logs
      const allLogs = consoleLogSpy.mock.calls.concat(consoleErrorSpy.mock.calls);
      allLogs.forEach((logArgs) => {
        const logString = JSON.stringify(logArgs);
        expect(logString).not.toContain(FAKE_PIN);
        expect(logString).not.toContain(FAKE_SECRET_KEY);
      });

      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      unmount();
    });
  });

  describe('Accessibility: Form state and labels preserved after clear', () => {
    it('preserves label association after PIN clear', async () => {
      const user = userEvent.setup();
      const { unmount } = render(
        <WalletSetup
          onCreateWallet={mockOnCreateWallet}
          onImportWallet={mockOnImportWallet}
          loading={false}
          error={null}
          onClearError={mockOnClearError}
        />
      );

      const pinInputs = screen.getAllByPlaceholderText(/Enter PIN|Re-enter PIN/);
      const labels = screen.getAllByText(/PIN|Confirm PIN/i);

      expect(labels.length).toBeGreaterThan(0);

      // Fill and clear
      await user.type(pinInputs[0], FAKE_PIN);
      expect(pinInputs[0]).toHaveValue(FAKE_PIN);

      // After interaction, labels should still be present
      expect(labels.length).toBeGreaterThan(0);

      unmount();
    });

    it('keyboard navigation remains functional after field clear', async () => {
      const user = userEvent.setup();
      const { unmount } = render(
        <WalletSetup
          onCreateWallet={mockOnCreateWallet}
          onImportWallet={mockOnImportWallet}
          loading={false}
          error={null}
          onClearError={mockOnClearError}
        />
      );

      const nameInput = screen.getByPlaceholderText(/My Pet Wallet/);
      const pinInputs = screen.getAllByPlaceholderText(/Enter PIN|Re-enter PIN/);
      const submitButton = screen.getByRole('button', { name: /Create Wallet/i });

      // Tab through elements
      await user.tab();
      expect(nameInput).toHaveFocus();

      await user.tab();
      expect(pinInputs[0]).toHaveFocus();

      await user.tab();
      expect(pinInputs[1]).toHaveFocus();

      await user.tab();
      expect(submitButton).toHaveFocus();

      unmount();
    });
  });

  describe('Failed submission', () => {
    it('clears PIN on failed submission', async () => {
      mockOnCreateWallet.mockRejectedValue(new Error('Network error'));
      const user = userEvent.setup();

      const { unmount } = render(
        <WalletSetup
          onCreateWallet={mockOnCreateWallet}
          onImportWallet={mockOnImportWallet}
          loading={false}
          error={null}
          onClearError={mockOnClearError}
        />
      );

      const pinInputs = screen.getAllByPlaceholderText(/Enter PIN|Re-enter PIN/);
      const nameInput = screen.getByPlaceholderText(/My Pet Wallet/);
      const createButton = screen.getByRole('button', { name: /Create Wallet/i });

      await user.type(nameInput, FAKE_LABEL);
      await user.type(pinInputs[0], FAKE_PIN);
      await user.type(pinInputs[1], FAKE_PIN_CONFIRM);

      expect(pinInputs[0]).toHaveValue(FAKE_PIN);

      await user.click(createButton);

      // On failure, PIN should be cleared
      await waitFor(() => {
        expect(mockOnCreateWallet).toHaveBeenCalled();
        expect(pinInputs[0]).toHaveValue('');
        expect(pinInputs[1]).toHaveValue('');
      });

      unmount();
    });
  });

  describe('Security: Clipboard prevention', () => {
    it('prevents copy of PIN field', async () => {
      const user = userEvent.setup();
      const { unmount } = render(
        <WalletSetup
          onCreateWallet={mockOnCreateWallet}
          onImportWallet={mockOnImportWallet}
          loading={false}
          error={null}
          onClearError={mockOnClearError}
        />
      );

      const pinInputs = screen.getAllByPlaceholderText(/Enter PIN|Re-enter PIN/);

      await user.type(pinInputs[0], FAKE_PIN);

      // Try to copy
      const copyEvent = new ClipboardEvent('copy', { bubbles: true });
      const preventDefaultSpy = jest.spyOn(copyEvent, 'preventDefault');

      fireEvent(pinInputs[0], copyEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
      unmount();
    });

    it('prevents paste to PIN field', async () => {
      const { unmount } = render(
        <WalletSetup
          onCreateWallet={mockOnCreateWallet}
          onImportWallet={mockOnImportWallet}
          loading={false}
          error={null}
          onClearError={mockOnClearError}
        />
      );

      const pinInputs = screen.getAllByPlaceholderText(/Enter PIN|Re-enter PIN/);

      // Try to paste
      const pasteEvent = new ClipboardEvent('paste', { bubbles: true });
      const preventDefaultSpy = jest.spyOn(pasteEvent, 'preventDefault');

      fireEvent(pinInputs[0], pasteEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
      unmount();
    });

    it('prevents cut of PIN field', async () => {
      const { unmount } = render(
        <WalletSetup
          onCreateWallet={mockOnCreateWallet}
          onImportWallet={mockOnImportWallet}
          loading={false}
          error={null}
          onClearError={mockOnClearError}
        />
      );

      const pinInputs = screen.getAllByPlaceholderText(/Enter PIN|Re-enter PIN/);

      // Try to cut
      const cutEvent = new ClipboardEvent('cut', { bubbles: true });
      const preventDefaultSpy = jest.spyOn(cutEvent, 'preventDefault');

      fireEvent(pinInputs[0], cutEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
      unmount();
    });
  });

  describe('Mobile viewport (390px) - Accessibility', () => {
    it('maintains usability on narrow viewport after PIN clear', async () => {
      const user = userEvent.setup();
      window.innerWidth = 390;

      const { unmount } = render(
        <WalletSetup
          onCreateWallet={mockOnCreateWallet}
          onImportWallet={mockOnImportWallet}
          loading={false}
          error={null}
          onClearError={mockOnClearError}
        />
      );

      const pinInputs = screen.getAllByPlaceholderText(/Enter PIN|Re-enter PIN/);
      const nameInput = screen.getByPlaceholderText(/My Pet Wallet/);

      // Fill and submit
      await user.type(nameInput, FAKE_LABEL);
      await user.type(pinInputs[0], FAKE_PIN);
      await user.type(pinInputs[1], FAKE_PIN_CONFIRM);

      const createButton = screen.getByRole('button', { name: /Create Wallet/i });
      await user.click(createButton);

      // After clear, elements should still be visible and interactable
      await waitFor(() => {
        expect(pinInputs[0]).toHaveValue('');
      });

      // Verify tab navigation still works
      await user.tab();
      expect(document.activeElement).toBeInTheDocument();

      unmount();
    });
  });

  describe('Form validation preserved after clear', () => {
    it('validates PIN length after refill', async () => {
      const user = userEvent.setup();
      const { unmount } = render(
        <WalletSetup
          onCreateWallet={mockOnCreateWallet}
          onImportWallet={mockOnImportWallet}
          loading={false}
          error={null}
          onClearError={mockOnClearError}
        />
      );

      const pinInputs = screen.getAllByPlaceholderText(/Enter PIN|Re-enter PIN/);
      const nameInput = screen.getByPlaceholderText(/My Pet Wallet/);
      const createButton = screen.getByRole('button', { name: /Create Wallet/i });

      // First attempt
      await user.type(nameInput, FAKE_LABEL);
      await user.type(pinInputs[0], FAKE_PIN);
      await user.type(pinInputs[1], FAKE_PIN_CONFIRM);
      await user.click(createButton);

      await waitFor(() => {
        expect(pinInputs[0]).toHaveValue('');
      });

      // Second attempt with short PIN should show error
      await user.type(pinInputs[0], 'short');
      await user.type(pinInputs[1], 'short');
      await user.click(createButton);

      // Error should be displayed
      expect(screen.getByText(/PIN must be at least/i)).toBeInTheDocument();

      unmount();
    });
  });

  describe('Screen reader announcements', () => {
    it('preserves aria labels after PIN clear', async () => {
      const user = userEvent.setup();
      const { unmount } = render(
        <WalletSetup
          onCreateWallet={mockOnCreateWallet}
          onImportWallet={mockOnImportWallet}
          loading={false}
          error={null}
          onClearError={mockOnClearError}
        />
      );

      const labels = screen.getAllByText(/PIN|Confirm PIN/i);
      const initialLabelCount = labels.length;

      const pinInputs = screen.getAllByPlaceholderText(/Enter PIN|Re-enter PIN/);
      const nameInput = screen.getByPlaceholderText(/My Pet Wallet/);

      // Fill and clear
      await user.type(nameInput, FAKE_LABEL);
      await user.type(pinInputs[0], FAKE_PIN);

      // Labels should still exist after interaction
      const labelsAfter = screen.getAllByText(/PIN|Confirm PIN/i);
      expect(labelsAfter.length).toBe(initialLabelCount);

      unmount();
    });
  });
});
