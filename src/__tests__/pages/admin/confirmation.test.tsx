import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminConfirmationDialog, {
  AdminActionTarget,
  AdminActionDefinition,
} from '@/components/Admin/AdminConfirmationDialog';

// ─── A minimal admin page integration test ──────────────────────────────
// This test verifies that AdminConfirmationDialog works correctly when
// embedded in an admin page that manages users (suspend, delete, verify).

const mockAdminUser: AdminActionTarget = {
  id: 'user_42',
  displayName: 'Alice Johnson',
  email: 'alice@petchain.com',
  role: 'user',
};

const suspendAction: AdminActionDefinition = {
  type: 'suspend',
  label: 'Suspend User',
  description: 'Temporarily suspend this user account.',
  irreversible: false,
  scope:
    'The user will lose access to their account for the suspension period. Their data will remain intact and can be reinstated.',
};

const deleteAction: AdminActionDefinition = {
  type: 'delete',
  label: 'Delete User',
  description: 'Permanently delete this user account and all associated data.',
  irreversible: true,
  scope:
    'All personal data, medical records, pet profiles, appointments, and financial transactions will be permanently removed.',
};

describe('Admin page integration – AdminConfirmationDialog', () => {
  // ── Suspend action ──────────────────────────────────────────────────────
  describe('Suspend user flow', () => {
    it('completes a suspension after typing the target name', async () => {
      const onConfirm = jest.fn().mockResolvedValue(undefined);
      const onCancel = jest.fn();
      const onAudit = jest.fn();

      render(
        <AdminConfirmationDialog
          open
          target={mockAdminUser}
          action={suspendAction}
          onConfirm={onConfirm}
          onCancel={onCancel}
          onAudit={onAudit}
        />
      );

      // Verify target info is displayed
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      expect(screen.getByText('alice@petchain.com')).toBeInTheDocument();
      expect(screen.getByText('user')).toBeInTheDocument();

      // Verify action details
      expect(screen.getByText('Suspend User')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Temporarily suspend this user account.'
        )
      ).toBeInTheDocument();

      // Confirm button starts disabled
      const confirmBtn = screen.getByRole('button', { name: /yes, suspend user/i });
      expect(confirmBtn).toBeDisabled();

      // Type the target name to enable confirmation
      const input = screen.getByPlaceholderText(/Type "Alice Johnson" to confirm/);
      fireEvent.change(input, { target: { value: 'Alice Johnson' } });

      expect(confirmBtn).toBeEnabled();
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onAudit).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'suspend',
            targetId: 'user_42',
            outcome: 'confirmed',
          })
        );
      });
    });
  });

  // ── Delete action (irreversible) ────────────────────────────────────────
  describe('Delete user flow (irreversible)', () => {
    it('displays irreversible warning and requires typed confirmation', async () => {
      const onConfirm = jest.fn().mockResolvedValue(undefined);
      const onCancel = jest.fn();

      render(
        <AdminConfirmationDialog
          open
          target={mockAdminUser}
          action={deleteAction}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      );

      // Verify irreversible warning
      expect(
        screen.getByText('This action is irreversible.')
      ).toBeInTheDocument();

      // Scope is displayed
      expect(
        screen.getByText(/All personal data/)
      ).toBeInTheDocument();

      // Confirm is disabled until name is typed
      const confirmBtn = screen.getByRole('button', { name: /yes, delete user/i });
      expect(confirmBtn).toBeDisabled();

      // Type wrong name – still disabled
      const input = screen.getByPlaceholderText(/Type "Alice Johnson" to confirm/);
      fireEvent.change(input, { target: { value: 'Wrong Name' } });
      expect(confirmBtn).toBeDisabled();

      // Correct name enables it
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.change(input, { target: { value: 'Alice Johnson' } });
      expect(confirmBtn).toBeEnabled();
    });
  });

  // ── Error recovery ──────────────────────────────────────────────────────
  describe('Error recovery', () => {
    it('shows error from API and allows retry', async () => {
      // First call fails, second succeeds
      const onConfirm = jest
        .fn()
        .mockRejectedValueOnce(new Error('Service unavailable'))
        .mockResolvedValueOnce(undefined);

      const onAudit = jest.fn();

      render(
        <AdminConfirmationDialog
          open
          target={mockAdminUser}
          action={suspendAction}
          onConfirm={onConfirm}
          onCancel={jest.fn()}
          onAudit={onAudit}
        />
      );

      // Attempt confirmation – will fail
      const input = screen.getByPlaceholderText(/Type "Alice Johnson" to confirm/);
      fireEvent.change(input, { target: { value: 'Alice Johnson' } });

      const confirmBtn = screen.getByRole('button', { name: /yes, suspend user/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(screen.getByText('Service unavailable')).toBeInTheDocument();
        expect(onAudit).toHaveBeenCalledWith(
          expect.objectContaining({ outcome: 'failed' })
        );
      });

      // Retry – should succeed
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledTimes(2);
        expect(onAudit).toHaveBeenCalledWith(
          expect.objectContaining({ outcome: 'confirmed' })
        );
      });
    });
  });

  // ── Cancellation ────────────────────────────────────────────────────────
  describe('Cancellation', () => {
    it('cancels and fires audit event', () => {
      const onCancel = jest.fn();
      const onAudit = jest.fn();

      render(
        <AdminConfirmationDialog
          open
          target={mockAdminUser}
          action={deleteAction}
          onConfirm={jest.fn()}
          onCancel={onCancel}
          onAudit={onAudit}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(onCancel).toHaveBeenCalled();
      expect(onAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'delete',
          targetId: 'user_42',
          outcome: 'cancelled',
        })
      );
    });
  });
});