'use client';

import { useTheme } from './ThemeProvider';

/** Accessible theme toggle button — switches between dark and light */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  const isDark = resolvedTheme === 'dark';

  const toggle = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 20px',
        background: 'transparent',
        border: 'none',
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
    >
      <span style={{ fontSize: '16px', lineHeight: 1 }}>
        {isDark ? '☀️' : '🌙'}
      </span>
      <span>{isDark ? 'LIGHT MODE' : 'DARK MODE'}</span>
    </button>
  );
}
