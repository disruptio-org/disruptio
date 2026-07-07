'use client';

/**
 * ThemeProvider — React context for managing light/dark theme across the Disruptio app.
 *
 * Architecture:
 * - Theme preference ('dark' | 'light' | 'system') is stored in localStorage
 * - An inline <script> in layout.tsx reads localStorage BEFORE React hydrates
 *   to prevent flash of wrong theme (FOUC)
 * - ThemeProvider sets `data-theme` attribute on <html>, which triggers CSS
 *   variable overrides defined in globals.css
 * - Components should use CSS variables (var(--bg-primary), etc.) not hex colors
 *
 * Usage in components:
 * ```tsx
 * import { useTheme } from '@/components/theme/ThemeProvider';
 *
 * function MyComponent() {
 *   const { resolvedTheme, setTheme } = useTheme();
 *   // resolvedTheme is always 'dark' or 'light' (never 'system')
 *   // Use CSS variables in styles, not conditional colors
 * }
 * ```
 *
 * Adding theme-aware styles to a new component:
 * 1. Use CSS variables from globals.css (e.g., var(--bg-primary), var(--text-primary))
 * 2. Never hardcode hex colors — they won't adapt to theme changes
 * 3. If you need a new token, add it to :root, [data-theme='dark'], AND [data-theme='light']
 * 4. Test in both themes before submitting
 *
 * @see src/lib/theme.ts — Low-level theme utilities (storage, resolution, application)
 * @see src/components/theme/ThemeToggle.tsx — UI toggle button
 * @see src/app/globals.css — CSS variable definitions for both themes
 */

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import {
  type ThemePreference,
  type ResolvedTheme,
  getStoredTheme,
  setStoredTheme,
  resolveTheme,
  applyTheme,
} from '@/lib/theme';

interface ThemeContextValue {
  /** The user's raw preference: 'dark' | 'light' | 'system' */
  theme: ThemePreference;
  /** The actual resolved theme applied to the UI */
  resolvedTheme: ResolvedTheme;
  /** Update the theme preference */
  setTheme: (theme: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(() => getStoredTheme());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(theme));

  const setTheme = useCallback((newTheme: ThemePreference) => {
    setThemeState(newTheme);
    setStoredTheme(newTheme);
    const resolved = resolveTheme(newTheme);
    setResolvedTheme(resolved);
    applyTheme(resolved);
  }, []);

  // On mount: apply theme & listen for system changes
  useEffect(() => {
    const resolved = resolveTheme(theme);
    setResolvedTheme(resolved);
    applyTheme(resolved);

    // Listen for system color scheme changes (relevant when preference is 'system')
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = () => {
      if (theme === 'system') {
        const newResolved = resolveTheme('system');
        setResolvedTheme(newResolved);
        applyTheme(newResolved);
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Hook to access theme context */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
