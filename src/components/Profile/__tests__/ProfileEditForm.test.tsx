import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProfileEditForm } from '../ProfileEditForm';
import type { UserProfile, UserProfileData } from '@/lib/api/userAPI';

jest.mock('@/hooks/useAnnouncement', () => ({
  useAnnouncement: () => ({ announce: jest.fn() }),
}));

jest.mock('../AvatarUpload', () => ({
  AvatarUpload: () => <div data-testid="avatar-upload" />,
}));

const userProfile = {
  id: 'user-test',
  email: 'profile@example.invalid',
  firstName: 'Sample',
  lastName: 'User',
  phone: '',
  emailVerified: false,
  phoneVerified: false,
  isVerified: false,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
} satisfies UserProfile;

const editableProfile = {
  firstName: 'Sample',
  lastName: 'User',
  email: 'profile@example.invalid',
  phone: '',
  avatarUrl: '',
  dateOfBirth: '',
  address: '',
  city: '',
  country: '',
} satisfies UserProfileData;

const renderForm = (onSubmit: (data: UserProfileData) => Promise<void>) =>
  render(
    <ProfileEditForm
      user={userProfile}
      onSubmit={onSubmit}
      onAvatarUpload={jest.fn()}
    />,
  );

describe('ProfileEditForm', () => {
  it('renders the profile form with canonical user data and editable fields', () => {
    renderForm(jest.fn().mockResolvedValue(undefined));

    expect(screen.getByLabelText('First Name *')).toHaveValue('Sample');
    expect(screen.getByLabelText('Email *')).toHaveValue('profile@example.invalid');
    expect(screen.getByTestId('avatar-upload')).toBeInTheDocument();
  });

  it('prevents submission when required fields are empty', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<ProfileEditForm onSubmit={onSubmit} onAvatarUpload={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText('First name is required')).toBeInTheDocument();
    expect(screen.getByText('Last name is required')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits editable data and reports success or failure', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const { unmount } = renderForm(onSubmit);

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(editableProfile));
    expect(await screen.findByText('Profile updated successfully')).toBeInTheDocument();

    unmount();
    const failedSubmit = jest.fn().mockRejectedValue(new Error('Save failed'));
    renderForm(failedSubmit);
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(await screen.findByText('Save failed')).toBeInTheDocument();
  });
});
