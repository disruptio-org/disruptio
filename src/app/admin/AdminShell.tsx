'use client';

import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

const NAV_ITEMS = [
  { id: 'users', label: 'Users' },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const activeTab = NAV_ITEMS.find(n => pathname.includes(`/admin/${n.id}`))?.id || 'users';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '236px 1fr', minHeight: '100vh' }}>
      {/* Sidebar */}
      <div className="ds-sidebar">
        <div className="ds-sidebar-logo">
          <Image src="/logos/logo_white (1).svg" alt="disruptio" width={100} height={18} style={{ height: '18px', width: 'auto', cursor: 'pointer' }} onClick={() => router.push('/projects')} />
        </div>
        <div style={{
          padding: '16px 20px 8px',
          fontSize: '10px',
          letterSpacing: '.14em',
          color: 'var(--text-dim)',
        }}>
          ADMIN PANEL
        </div>
        <div className="ds-sidebar-nav">
          {NAV_ITEMS.map(item => (
            <div
              key={item.id}
              className={`ds-sidebar-item ${activeTab === item.id ? 'ds-sidebar-item--active' : ''}`}
              onClick={() => router.push(`/admin/${item.id}`)}
            >
              {item.label}
            </div>
          ))}
        </div>
        <ThemeToggle />
        <div className="ds-sidebar-back" onClick={() => router.push('/projects')}>
          ← BACK TO PROJECTS
        </div>
      </div>

      {/* Main */}
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          height: '60px', flex: 'none', borderBottom: '1px solid var(--border-default)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 32px', background: 'var(--bg-primary)',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <span style={{ color: 'var(--text-dim)', fontSize: '12px', letterSpacing: '.14em' }}>ADMIN:</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '15px' }}>User Management</span>
          </div>
        </div>
        <div style={{ flex: 1 }} className="ds-page-enter">
          {children}
        </div>
      </div>
    </div>
  );
}
