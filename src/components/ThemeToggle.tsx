'use client';

import { useTheme, Theme } from '@/contexts/ThemeContext';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const themes: { label: string; value: Theme; icon: string }[] = [
    { label: 'Light', value: 'light', icon: '☀️' },
    { label: 'Dark', value: 'dark', icon: '🌙' },
    { label: 'High Contrast', value: 'high-contrast', icon: '⚡' },
  ];

  return (
    <div role="group" aria-label="Theme selector" className="flex items-center gap-1">
      {themes.map(({ label, value, icon }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          aria-pressed={theme === value}
          aria-label={`Switch to ${label} mode`}
          title={label}
          className={`
            px-2 py-1 rounded text-sm transition-all duration-200
            ${
              theme === value
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'
            }
          `}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}
