import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { I18nProvider } from '@/i18n';

import ApiErrorAlert from './ApiErrorAlert';

describe('ApiErrorAlert', () => {
  it('announces a safe error and supports keyboard copying of the selectable ID', async () => {
    const user = userEvent.setup();
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(
      <I18nProvider>
        <ApiErrorAlert
          error={{
            response: {
              data: {
                code: 'UNKNOWN_CODE',
                message: 'private server details',
                correlationId: 'ec-public-ui-123abc',
              },
            },
          }}
        />
      </I18nProvider>,
    );

    const alert = screen.getByRole('alert');
    const correlationId = screen.getByLabelText('Selectable support reference ID');
    const copyButton = screen.getByRole('button', { name: 'Copy ID' });

    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(alert).not.toHaveTextContent('private server details');
    expect(correlationId).toHaveTextContent('ec-public-ui-123abc');
    expect(correlationId).toHaveClass('select-all');

    await user.tab();
    expect(correlationId).toHaveFocus();
    await user.tab();
    expect(copyButton).toHaveFocus();
    await user.keyboard('{Enter}');

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('ec-public-ui-123abc'));
    expect(await screen.findByRole('status')).toHaveTextContent('Reference ID copied.');
  });

  it('shows a safe generic alert when there is no correlation ID', () => {
    render(
      <I18nProvider>
        <ApiErrorAlert
          error={{
            response: {
              data: { code: 'UNKNOWN_CODE', message: 'private response detail' },
            },
          }}
        />
      </I18nProvider>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      "We couldn't complete the request. Please try again.",
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent('private response detail');
    expect(screen.queryByRole('button', { name: 'Copy ID' })).not.toBeInTheDocument();
  });

  it('announces clipboard failures without exposing exception details', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn().mockRejectedValue(new Error('clipboard internals')) },
    });

    render(
      <I18nProvider>
        <ApiErrorAlert
          error={{
            response: {
              data: { code: 'UNKNOWN_CODE', correlationId: 'ec-public-copy-123abc' },
            },
          }}
        />
      </I18nProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Copy ID' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Could not copy the reference ID. Select and copy it instead.',
    );
    expect(screen.getByRole('status')).not.toHaveTextContent('clipboard internals');
  });
});
