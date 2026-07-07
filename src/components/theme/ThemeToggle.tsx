'use client';

import { useTheme } from './ThemeProvider';

/**
 * Accessible theme toggle button — switches between dark and light themes.
 *
 * ## Usage
 * ```tsx
 * import { ThemeToggle } from '@/components/theme/ThemeToggle';
 *
 * <ThemeToggle />
 * ```
 *
 * ## Design system alignment
 * - Uses `--space-*` tokens for padding (8px grid).
 * - Uses `--text-dim` / `--text-primary` for color states.
 * - Uses `--accent` for focus-visible outline.
 * - Font: JetBrains Mono via `--font-mono`.
 *
 * ## Accessibility
 * - `aria-label` communicates the **current** theme and the action the button
 *   will perform (e.g. "Currently dark theme. Switch to light theme").
 * - Focus-visible outline meets WCAG 2.1 focus-indicator requirements.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  const isDark = resolvedTheme === 'dark';

  const toggle = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <button
      onClick={toggle}
      aria-label={
        isDark
          ? 'Currently dark theme. Switch to light theme'
          : 'Currently light theme. Switch to dark theme'
      }
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: 'var(--space-3) var(--space-5)',
        background: 'transparent',
        border: 'none',
        outline: 'none',
        color: 'var(--text-dim)',
        fontFamily: 'var(--font-mono)',
        fontSize: '12px',
        letterSpacing: '0.1em',
        cursor: 'pointer',
        transition: 'color var(--transition-fast)',
        width: '100%',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}
      onFocus={(e) => {
        e.currentTarget.style.outline = '2px solid var(--accent)';
        e.currentTarget.style.outlineOffset = '-2px';
      }}
      onBlur={(e) => {
        e.currentTarget.style.outline = 'none';
      }}
    >
      <span style={{ fontSize: '16px', lineHeight: 1 }}>
        {isDark ? '☀️' : '🌙'}
      </span>
      {/* Active-state indicator dot — shows which theme is currently selected */}
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: 'var(--accent)',
          flexShrink: 0,
        }}
        aria-hidden="true"
      />
      <span>{isDark ? 'LIGHT MODE' : 'DARK MODE'}</span>
    </button>
  );
}
