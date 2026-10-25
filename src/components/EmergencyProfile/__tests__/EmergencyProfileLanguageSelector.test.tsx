import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';

jest.mock('@/utils/profileLanguage', () => ({
  resolveProfileLanguage: jest.fn(),
}));
import { resolveProfileLanguage } from '@/utils/profileLanguage';
const mockResolve = resolveProfileLanguage as jest.Mock;

import { EmergencyProfileLanguageSelector } from '../EmergencyProfileLanguageSelector';
import type { LanguageResolution } from '@/utils/profileLanguage';

const fullEn: LanguageResolution = {
  requested: 'en',
  resolved: 'en',
  usedFallback: false,
  coverage: 1,
  isPartial: false,
  missingKeys: 0,
  label: 'English',
  nativeName: 'English',
  dir: 'ltr',
};

const partialEs: LanguageResolution = {
  requested: 'es',
  resolved: 'en',
  usedFallback: true,
  coverage: 0.5,
  isPartial: true,
  missingKeys: 50,
  label: 'English',
  nativeName: 'Spanish',
  dir: 'ltr',
};

beforeEach(() => {
  mockResolve.mockReset();
  mockResolve.mockReturnValue(fullEn);
});

describe('EmergencyProfileLanguageSelector', () => {
  it('renders a labelled language picker with every supported locale', () => {
    render(<EmergencyProfileLanguageSelector current="en" onChange={jest.fn()} />);
    expect(
      screen.getByRole('heading', { name: /profile language/i }),
    ).toBeInTheDocument();
    // 10 supported languages from the i18n registry.
    expect(screen.getAllByRole('option')).toHaveLength(10);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('confirms a fully translated selection to the owner', () => {
    render(<EmergencyProfileLanguageSelector current="en" onChange={jest.fn()} />);
    expect(
      screen.getByText(/the public profile will be shown in english \(100% translated\)/i),
    ).toBeInTheDocument();
  });

  it('warns and explains when falling back to the baseline language', () => {
    mockResolve.mockReturnValue(partialEs);
    render(<EmergencyProfileLanguageSelector current="es" onChange={jest.fn()} />);
    expect(
      screen.getByText(/“spanish” is only 50% translated/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/shown in english/i)).toBeInTheDocument();
  });

  it('reports the chosen language to the parent on change', () => {
    const onChange = jest.fn();
    render(<EmergencyProfileLanguageSelector current="en" onChange={onChange} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ja' } });
    expect(onChange).toHaveBeenCalledWith('ja');
  });

  it('has no detectable accessibility violations', async () => {
    const { container } = render(
      <EmergencyProfileLanguageSelector current="en" onChange={jest.fn()} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
