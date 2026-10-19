import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminConfirmationDialog, {
  AdminActionTarget,
  AdminActionDefinition,
  AuditEvent,
} from '../AdminConfirmationDialog';

const mockTarget: AdminActionTarget = {
  id: 'user_abc123',
  displayName: 'Jane Doe',
  email: 'jane@example.com',
  role: 'user',
};

const mockAction: AdminActionDefinition = {
  type: 'delete',
  label: 'Delete User',
  description: 'Permanently delete this user account and all associated data.',
  irreversible: true,
  scope:
    'All personal data, medical records, pet profiles, appointments, and financial transactions will be permanently removed. This cannot be reversed.',
};

describe('AdminConfirmationDialog', () => {
  const defaultProps = {
    open: true,
    target: mockTarget,
    action: mockAction,
    onConfirm: jest.fn().mockResolvedValue(undefined),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders when open', () => {
      render(<AdminConfirmationDialog {...defaultProps} />);
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      expect(screen.getByText('Delete User')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Permanently delete this user account and all associated data.'
        )
      ).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      render(<AdminConfirmationDialog {...defaultProps} open={false} />);
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('displays target identity from trusted data', () => {
      render(<AdminConfirmationDialog {...defaultProps} />);
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      expect(screen.getByText('jane@example.com')).toBeInTheDocument();
      expect(screen.getByText('user')).toBeInTheDocument();
      expect(screen.getByText(/ID: user_abc123/)).toBeInTheDocument();
    });

    it('displays scope and irreversible indicator', () => {
      render(<AdminConfirmationDialog {...defaultProps} />);
      expect(screen.getByText(/All personal data/)).toBeInTheDocument();
      expect(
        screen.getByText('This action is irreversible.')
      ).toBeInTheDocument();
    });

    it('renders the confirmation text input', () => {
      render(<AdminConfirmationDialog {...defaultProps} />);
      expect(
        screen.getByPlaceholderText(/Type "Jane Doe" to confirm/)
      ).toBeInTheDocument();
    });

    it('renders custom button labels', () => {
      render(
        <AdminConfirmationDialog
          {...defaultProps}
          confirmLabel="Yes, delete permanently"
          cancelLabel="No, keep account"
        />
      );
      expect(
        screen.getByRole('button', { name: /yes, delete permanently/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /no, keep account/i })
      ).toBeInTheDocument();
    });
  });

  describe('Confirmation security', () => {
    it('disables confirm button until target name is typed exactly', () => {
      render(<AdminConfirmationDialog {...defaultProps} />);
      const confirmBtn = screen.getByRole('button', {
        name: /yes, delete user/i,
      });
      expect(confirmBtn).toBeDisabled();

      const input = screen.getByPlaceholderText(/Type "Jane Doe" to confirm/);
      fireEvent.change(input, { target: { value: 'Wrong Name' } });
      expect(confirmBtn).toBeDisabled();

      fireEvent.change(input, { target: { value: 'Jane Doe' } });
      expect(confirmBtn).toBeEnabled();
    });

    it('is case-sensitive for the confirmation text', () => {
      render(<AdminConfirmationDialog {...defaultProps} />);
      const input = screen.getByPlaceholderText(/Type "Jane Doe" to confirm/);
      const confirmBtn = screen.getByRole('button', {
        name: /yes, delete user/i,
      });

      fireEvent.change(input, { target: { value: 'jane doe' } });
      expect(confirmBtn).toBeDisabled();
    });

    it('resets confirmation state when dialog reopens', () => {
      const { rerender } = render(
        <AdminConfirmationDialog {...defaultProps} />
      );
      const input = screen.getByPlaceholderText(/Type "Jane Doe" to confirm/);
      fireEvent.change(input, { target: { value: 'Jane Doe' } });

      // Reopen the dialog
      rerender(
        <AdminConfirmationDialog {...defaultProps} open={false} />
      );
      rerender(
        <AdminConfirmationDialog {...defaultProps} open={true} />
      );

      const newInput = screen.getByPlaceholderText(/Type "Jane Doe" to confirm/);
      expect(newInput).toHaveValue('');
    });
  });

  describe('Double-click prevention', () => {
    it('debounces rapid confirm clicks', async () => {
      const onConfirm = jest.fn().mockResolvedValue(undefined);
      render(
        <AdminConfirmationDialog
          {...defaultProps}
          onConfirm={onConfirm}
        />
      );

      const input = screen.getByPlaceholderText(/Type "Jane Doe" to confirm/);
      fireEvent.change(input, { target: { value: 'Jane Doe' } });

      const confirmBtn = screen.getByRole('button', {
        name: /yes, delete user/i,
      });

      // Simulate two rapid clicks
      fireEvent.click(confirmBtn);
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledTimes(1);
      });
    });

    it('disables buttons while processing', async () => {
      const onConfirm = jest.fn(
        () => new Promise<void>((resolve) => setTimeout(resolve, 1000))
      );
      render(
        <AdminConfirmationDialog
          {...defaultProps}
          onConfirm={onConfirm}
        />
      );

      const input = screen.getByPlaceholderText(/Type "Jane Doe" to confirm/);
      fireEvent.change(input, { target: { value: 'Jane Doe' } });

      const confirmBtn = screen.getByRole('button', {
        name: /yes, delete user/i,
      });
      const cancelBtn = screen.getByRole('button', { name: /cancel/i });

      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(screen.getByText(/processing/i)).toBeInTheDocument();
        expect(confirmBtn).toBeDisabled();
        expect(cancelBtn).toBeDisabled();
      });
    });
  });

  describe('Keyboard interaction', () => {
    it('closes on Escape when not processing', () => {
      render(<AdminConfirmationDialog {...defaultProps} />);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
    });

    it('does not close on Escape while processing', async () => {
      const onConfirm = jest.fn(
        () => new Promise<void>(() => {}) // never resolves
      );
      const onCancel = jest.fn();
      render(
        <AdminConfirmationDialog
          {...defaultProps}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      );

      const input = screen.getByPlaceholderText(/Type "Jane Doe" to confirm/);
      fireEvent.change(input, { target: { value: 'Jane Doe' } });
      fireEvent.click(
        screen.getByRole('button', { name: /yes, delete user/i })
      );

      await waitFor(() => {
        expect(screen.getByText(/processing/i)).toBeInTheDocument();
      });

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onCancel).not.toHaveBeenCalled();
    });
  });

  describe('Audit callbacks', () => {
    it('fires audit event with "confirmed" on successful confirmation', async () => {
      const onAudit = jest.fn();
      const onConfirm = jest.fn().mockResolvedValue(undefined);
      render(
        <AdminConfirmationDialog
          {...defaultProps}
          onConfirm={onConfirm}
          onAudit={onAudit}
        />
      );

      const input = screen.getByPlaceholderText(/Type "Jane Doe" to confirm/);
      fireEvent.change(input, { target: { value: 'Jane Doe' } });
      fireEvent.click(
        screen.getByRole('button', { name: /yes, delete user/i })
      );

      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalled();
        expect(onAudit).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'delete',
            targetId: 'user_abc123',
            outcome: 'confirmed',
          })
        );
      });
    });

    it('fires audit event with "cancelled" on cancel', () => {
      const onAudit = jest.fn();
      render(
        <AdminConfirmationDialog
          {...defaultProps}
          onAudit={onAudit}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(onAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'delete',
          targetId: 'user_abc123',
          outcome: 'cancelled',
        })
      );
    });

    it('fires audit event with "failed" when confirmation fails', async () => {
      const error = new Error('API error');
      const onAudit = jest.fn();
      const onConfirm = jest.fn().mockRejectedValue(error);
      render(
        <AdminConfirmationDialog
          {...defaultProps}
          onConfirm={onConfirm}
          onAudit={onAudit}
        />
      );

      const input = screen.getByPlaceholderText(/Type "Jane Doe" to confirm/);
      fireEvent.change(input, { target: { value: 'Jane Doe' } });
      fireEvent.click(
        screen.getByRole('button', { name: /yes, delete user/i })
      );

      await waitFor(() => {
        expect(onAudit).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'delete',
            targetId: 'user_abc123',
            outcome: 'failed',
          })
        );
      });
    });

    it('does not include sensitive payloads in audit event', async () => {
      const onAudit = jest.fn();
      render(
        <AdminConfirmationDialog
          {...defaultProps}
          onAudit={onAudit}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      const event: AuditEvent = onAudit.mock.calls[0][0];
      expect(event).not.toHaveProperty('email');
      expect(event).not.toHaveProperty('displayName');
      expect(event).not.toHaveProperty('password');
      expect(event).not.toHaveProperty('token');
    });
  });

  describe('Error handling', () => {
    it('displays external error when provided', () => {
      render(
        <AdminConfirmationDialog
          {...defaultProps}
          error="Something went wrong"
        />
      );
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('displays internal error from failed confirmation', async () => {
      const onConfirm = jest.fn().mockRejectedValue(new Error('Network failure'));
      render(
        <AdminConfirmationDialog
          {...defaultProps}
          onConfirm={onConfirm}
        />
      );

      const input = screen.getByPlaceholderText(/Type "Jane Doe" to confirm/);
      fireEvent.change(input, { target: { value: 'Jane Doe' } });
      fireEvent.click(
        screen.getByRole('button', { name: /yes, delete user/i })
      );

      await waitFor(() => {
        expect(screen.getByText('Network failure')).toBeInTheDocument();
      });
    });
  });

  describe('Backdrop interaction', () => {
    it('closes when backdrop is clicked', () => {
      render(<AdminConfirmationDialog {...defaultProps} />);
      const backdrop = document.querySelector('[aria-hidden="true"]');
      expect(backdrop).toBeInTheDocument();
      fireEvent.mouseDown(backdrop!);
      expect(defaultProps.onCancel).toHaveBeenCalled();
    });

    it('does not close on backdrop click while processing', async () => {
      const onConfirm = jest.fn(
        () => new Promise<void>(() => {}) // never resolves
      );
      const onCancel = jest.fn();
      render(
        <AdminConfirmationDialog
          {...defaultProps}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      );

      const input = screen.getByPlaceholderText(/Type "Jane Doe" to confirm/);
      fireEvent.change(input, { target: { value: 'Jane Doe' } });
      fireEvent.click(
        screen.getByRole('button', { name: /yes, delete user/i })
      );

      await waitFor(() => {
        expect(screen.getByText(/processing/i)).toBeInTheDocument();
      });

      const backdrop = document.querySelector('[aria-hidden="true"]');
      fireEvent.mouseDown(backdrop!);
      expect(onCancel).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('handles target with minimal fields', () => {
      const minimalTarget: AdminActionTarget = {
        id: 'user_1',
        displayName: 'John Smith',
      };
      render(
        <AdminConfirmationDialog
          {...defaultProps}
          target={minimalTarget}
        />
      );
      expect(screen.getByText('John Smith')).toBeInTheDocument();
      expect(screen.queryByText('jane@example.com')).not.toBeInTheDocument();
      expect(screen.queryByText('user')).not.toBeInTheDocument();
    });

    it('handles non-irreversible action', () => {
      const reversibleAction: AdminActionDefinition = {
        ...mockAction,
        irreversible: false,
        scope: 'User will be suspended for 30 days.',
      };
      render(
        <AdminConfirmationDialog
          {...defaultProps}
          action={reversibleAction}
        />
      );
      expect(
        screen.queryByText('This action is irreversible.')
      ).not.toBeInTheDocument();
      expect(screen.getByText(/User will be suspended/)).toBeInTheDocument();
    });

    it('shows processing state', async () => {
      const onConfirm = jest.fn(
        () => new Promise<void>((resolve) => setTimeout(resolve, 500))
      );
      render(
        <AdminConfirmationDialog
          {...defaultProps}
          onConfirm={onConfirm}
        />
      );

      const input = screen.getByPlaceholderText(/Type "Jane Doe" to confirm/);
      fireEvent.change(input, { target: { value: 'Jane Doe' } });
      fireEvent.click(
        screen.getByRole('button', { name: /yes, delete user/i })
      );

      expect(await screen.findByText(/processing/i)).toBeInTheDocument();
    });
  });
});