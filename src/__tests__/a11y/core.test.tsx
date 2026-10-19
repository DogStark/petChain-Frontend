import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { SkeletonCard, SkeletonLine, SkeletonAvatar } from '@/components/Skeleton';
import PasswordStrengthMeter from '@/components/PasswordStrengthMeter';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
    // eslint-disable-next-line jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

jest.mock('@/contexts/ThemeContext', () => ({
  __esModule: true,
  useTheme: () => ({ theme: 'light' as const, setTheme: jest.fn() }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Theme: 'light',
}));

// Deliberately import components that depend on the mocked modules.
// eslint-disable-next-line import/order, @typescript-eslint/no-var-requires
const SafeImage = require('@/components/SafeImage').default;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ThemeToggle } = require('@/components/ThemeToggle');

describe('A11y core components (WCAG A/AA)', () => {
  it('skeleton loaders are marked decorative and pass axe', async () => {
    const { container } = render(
      <div>
        <SkeletonLine width="40%" height="2rem" />
        <SkeletonCard />
        <SkeletonAvatar size={48} />
      </div>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('password strength meter passes axe for a complex password', async () => {
    const { container } = render(<PasswordStrengthMeter password="Str0ng!Pass2026" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('safe image degrades to an accessible placeholder image', async () => {
    const { container } = render(
      // @ts-expect-error SafeImage accepts src/alt props
      <SafeImage src={null} alt="Pet photo placeholder" data-testid="safeimage" />,
    );
    const img = container.querySelector('img[data-testid="safeimage"]');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('alt')).toBe('Pet photo placeholder');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('theme toggle exposes an accessible group and pressed state', async () => {
    const { container } = render(<ThemeToggle />);
    const group = screen.getByRole('group', { name: 'Theme selector' });
    expect(group).toBeTruthy();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('a semantic form with labels has no critical violations', async () => {
    const { container } = render(
      <form>
        <label htmlFor="pet-name">Pet name</label>
        <input id="pet-name" type="text" />
        <button type="submit">Save</button>
      </form>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
