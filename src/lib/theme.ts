// Theme utilities — type-safe persistence and resolution
export type ThemePreference = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

const STORAGE_KEY = 'disruptio-theme';
const DEFAULT_THEME: ThemePreference = 'dark';

/** Read the saved theme preference from localStorage */
export function getStoredTheme(): ThemePreference {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light' || stored === 'system') return stored;
  } catch {
    // localStorage unavailable — fail silently
  }
  return DEFAULT_THEME;
}

/** Save theme preference to localStorage */
export function setStoredTheme(theme: ThemePreference): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // localStorage unavailable — fail silently
  }
}

/** Resolve 'system' to actual dark/light based on prefers-color-scheme */
export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'dark' || preference === 'light') return preference;
  // 'system' — check media query
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return 'dark';
}

/** Apply the theme to the document root */
export function applyTheme(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', resolved);
}

/**
 * Inline script string to inject in <head> for flash prevention.
 * Reads localStorage before React hydrates so the correct theme is set immediately.
 */
export const themeInitScript = `
(function() {
  try {
    var t = localStorage.getItem('${STORAGE_KEY}');
    if (t === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else if (t === 'system') {
      var m = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
      document.documentElement.setAttribute('data-theme', m ? 'light' : 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch(e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`;
