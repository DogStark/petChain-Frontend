import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EmergencyPassOptions } from '../EmergencyPassOptions';
import { getEmergencyPassStatus } from '../emergencyPassStatus';

jest.mock('qrcode.react', () => ({
  QRCodeSVG: (props: { value: string }) => <svg data-testid="qr" data-value={props.value} />,
}));

const URL_ = 'https://app.test/pets/p1/emergency';
const future = new Date(Date.now() + 86_400_000).toISOString();
const past = new Date(Date.now() - 86_400_000).toISOString();

describe('getEmergencyPassStatus', () => {
  it('handles each state', () => {
    expect(getEmergencyPassStatus(null)).toBe('unavailable');
    expect(getEmergencyPassStatus({ isActive: false })).toBe('revoked');
    expect(getEmergencyPassStatus({ isActive: true, expiresAt: past })).toBe('expired');
    expect(getEmergencyPassStatus({ isActive: true, expiresAt: 'bad' })).toBe('expired');
    expect(getEmergencyPassStatus({ isActive: true, expiresAt: future })).toBe('active');
    expect(getEmergencyPassStatus({ isActive: true })).toBe('active');
    expect(getEmergencyPassStatus({ isActive: false, expiresAt: past })).toBe('revoked');
  });
});

describe('EmergencyPassOptions', () => {
  beforeEach(() => {
    window.print = jest.fn();
    global.URL.createObjectURL = jest.fn(() => 'blob:x');
    global.URL.revokeObjectURL = jest.fn();
  });

  it('shows public fields, status and expiry for an active code, and prints', () => {
    render(
      <EmergencyPassOptions
        petId="p1"
        petName="Rex"
        emergencyUrl={URL_}
        record={{ isActive: true, expiresAt: future, customMessage: 'Needs insulin' }}
        onRequestWalletPass={jest.fn()}
      />
    );
    expect(screen.getByTestId('pass-status')).toHaveTextContent('Active');
    expect(screen.getByText('Needs insulin')).toBeTruthy();
    expect(screen.getByTestId('qr').getAttribute('data-value')).toBe(URL_);
    fireEvent.click(screen.getByRole('button', { name: /print card/i }));
    expect(window.print).toHaveBeenCalled();
  });

  it('requests the wallet pass from the backend', async () => {
    const onRequest = jest.fn().mockResolvedValue(new Blob(['x']));
    render(
      <EmergencyPassOptions
        petId="p1"
        petName="Rex"
        emergencyUrl={URL_}
        record={{ isActive: true }}
        onRequestWalletPass={onRequest}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /add to wallet/i }));
    await waitFor(() => expect(onRequest).toHaveBeenCalledTimes(1));
    expect(screen.getByText('No expiration')).toBeTruthy();
  });

  it('shows an error when the backend refuses the wallet pass', async () => {
    const onRequest = jest.fn().mockRejectedValue(new Error('403'));
    render(
      <EmergencyPassOptions
        petId="p1"
        petName="Rex"
        emergencyUrl={URL_}
        record={{ isActive: true }}
        onRequestWalletPass={onRequest}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /add to wallet/i }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/could not be created/i);
  });

  it.each([
    ['revoked', { isActive: false, customMessage: 'secret note' }, /revoked/i],
    ['expired', { isActive: true, expiresAt: past, customMessage: 'secret note' }, /expired/i],
  ])('disables actions and hides the public data when %s', (_name, record, text) => {
    render(
      <EmergencyPassOptions
        petId="p1"
        petName="Rex"
        emergencyUrl={URL_}
        record={record}
        onRequestWalletPass={jest.fn()}
      />
    );
    expect(screen.getByRole('status').textContent).toMatch(text);
    expect((screen.getByRole('button', { name: /print card/i }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /add to wallet/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByTestId('qr')).toBeNull();
    expect(screen.queryByText('secret note')).toBeNull();
  });

  it('handles a missing record', () => {
    render(<EmergencyPassOptions petId="p1" petName="Rex" emergencyUrl={URL_} record={null} />);
    expect(screen.getByTestId('pass-status').textContent).toBe('Unavailable');
    expect((screen.getByRole('button', { name: /print card/i }) as HTMLButtonElement).disabled).toBe(true);
  });
});
