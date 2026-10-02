import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { I18nProvider, useTranslation } from './index';

function MissingTranslationProbe() {
  const { t, setLanguage } = useTranslation();

  return (
    <>
      <button onClick={() => void setLanguage('es')}>Switch to Spanish</button>
      <span>{t('validation.invalidPhone')}</span>
    </>
  );
}

describe('translation fallback', () => {
  it('uses the English translation when a key is missing from the selected locale', async () => {
    render(
      <I18nProvider>
        <MissingTranslationProbe />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Switch to Spanish' }));

    await waitFor(() => {
      expect(
        screen.getByText('Enter a valid phone number in international format'),
      ).toBeInTheDocument();
    });
  });
});