'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'high-contrast';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    // Read from localStorage first, then fall back to system preference
    const stored = localStorage.getItem('petchain-theme') as Theme | null;
    if (stored && ['light', 'dark', 'high-contrast'].includes(stored)) {
      applyTheme(stored);
      setThemeState(stored);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const prefersHighContrast = window.matchMedia('(prefers-contrast: more)').matches;
      const systemTheme: Theme = prefersHighContrast ? 'high-contrast' : prefersDark ? 'dark' : 'light';
      applyTheme(systemTheme);
      setThemeState(systemTheme);
    }
  }, []);

  useEffect(() => {
    // Listen for system preference changes (only if user hasn't overridden)
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      const stored = localStorage.getItem('petchain-theme');
      if (!stored) {
        const newTheme: Theme = e.matches ? 'dark' : 'light';
        applyTheme(newTheme);
        setThemeState(newTheme);
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const applyTheme = (t: Theme) => {
    document.documentElement.setAttribute('data-theme', t);
  };

  const setTheme = (t: Theme) => {
    localStorage.setItem('petchain-theme', t);
    applyTheme(t);
    setThemeState(t);
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}