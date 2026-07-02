'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [spinIdx, setSpinIdx] = useState(0);

  const spinChars = ['/', '-', '\\', '|'];

  const handleLogin = async () => {
    if (loading) return;
    setError('');

    if (!email.trim()) { setError('Email address is required'); return; }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError('Invalid email format'); return; }
    if (password.length < 4) { setError('Invalid password format'); return; }

    setLoading(true);
    const interval = setInterval(() => setSpinIdx(prev => (prev + 1) % 4), 130);

    const result = await signIn('credentials', {
      email: email.trim(),
      password,
      redirect: false,
    });

    clearInterval(interval);

    if (result?.error) {
      setError('Invalid credentials. Access denied.');
      setLoading(false);
    } else {
      router.push('/projects');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Left: brand statement */}
      <div style={{
        flex: 1,
        background: '#000000',
        borderRight: '1px solid #1F1F1F',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '56px 64px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Image src="/logos/logo_white (1).svg" alt="disruptio" width={200} height={34} style={{ height: '34px', width: 'auto' }} />
          <span style={{
            color: '#FF2A2A',
            fontSize: '30px',
            fontWeight: 700,
            lineHeight: 1,
            animation: 'dsBlink 1.1s step-end infinite',
          }}>_</span>
        </div>
        <div>
          <div style={{
            color: '#B3B3B3',
            fontSize: '22px',
            lineHeight: 1.55,
            fontWeight: 500,
            maxWidth: '440px',
          }}>
            &quot;Turn product chaos into executable software intelligence.&quot;
          </div>
          <div style={{
            marginTop: '28px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: '#5A5A5A',
            fontSize: '12px',
          }}>
            <span style={{ color: '#FF2A2A' }}>&gt;</span>
            <span>context.compile --agents=4 --strict</span>
          </div>
        </div>
        <div style={{ color: '#3A3A3A', fontSize: '11px', letterSpacing: '.08em' }}>
          DISRUPTIO // MVP CONSOLE v0.1
        </div>
      </div>

      {/* Right: form console */}
      <div style={{
        flex: 1,
        background: '#0D0D0D',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px',
      }}>
        <div style={{ width: '100%', maxWidth: '380px' }}>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#FFFFFF' }}>Welcome back.</div>
          <div style={{ marginTop: '8px', color: '#8A8A8A', fontSize: '14px' }}>Enter your credentials.</div>
          <div style={{ marginTop: '36px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span className="ds-label">EMAIL ADDRESS</span>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="you@disruptio.org"
                spellCheck={false}
                className="ds-input"
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span className="ds-label">PASSWORD</span>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="••••••••••••"
                className="ds-input"
              />
            </label>
            {error && (
              <div style={{ color: '#FF2A2A', fontSize: '12px', marginTop: '-8px' }}>{error}</div>
            )}
            <button onClick={handleLogin} className="ds-btn-primary" style={{ padding: '15px 0', fontSize: '14px', letterSpacing: '.14em' }}>
              {loading ? `AUTHENTICATING ${spinChars[spinIdx]}` : 'LOGIN'}
            </button>
          </div>
          <div style={{ marginTop: '24px', color: '#4A4A4A', fontSize: '11px' }}>
            No account?{' '}
            <span style={{ color: '#8A8A8A', borderBottom: '1px solid #2A2A2A', cursor: 'pointer' }}>
              Request workspace access
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
