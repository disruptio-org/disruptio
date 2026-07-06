'use client';

import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

interface ProjectShellProps {
  project: {
    id: string;
    name: string;
    githubConnection: { status: string } | null;
  };
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview' },
  { id: 'context', label: 'Product Context' },
  { id: 'personas', label: 'Personas' },
  { id: 'ux-ui-guidelines', label: 'UX/UI Guidelines' },
  { id: 'design-style', label: 'Design Style' },
  { id: 'technology', label: 'Technology View' },
  { id: 'github', label: 'GitHub Repository' },
  { id: 'agents', label: 'Agents' },
  { id: 'features', label: 'Features' },
  { id: 'documentation', label: 'Documentation' },
  { id: 'settings', label: 'Settings' },
];

export default function ProjectShell({ project, children }: ProjectShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const activeTab = NAV_ITEMS.find(n => pathname.endsWith(`/${n.id}`))?.id || 'overview';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '236px 1fr', minHeight: '100vh' }}>
      {/* Sidebar */}
      <div className="ds-sidebar">
        <div className="ds-sidebar-logo">
          <Image src="/logos/logo_white (1).svg" alt="disruptio" width={100} height={18} style={{ height: '18px', width: 'auto', cursor: 'pointer' }} onClick={() => router.push('/projects')} />
        </div>
        <div className="ds-sidebar-nav">
          {NAV_ITEMS.map(item => (
            <div
              key={item.id}
              className={`ds-sidebar-item ${activeTab === item.id ? 'ds-sidebar-item--active' : ''}`}
              onClick={() => router.push(`/projects/${project.id}/${item.id}`)}
            >
              {item.label}
            </div>
          ))}
        </div>
        <ThemeToggle />
        <div className="ds-sidebar-back" onClick={() => router.push('/projects')}>
          ← ALL PROJECTS
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
            <span style={{ color: 'var(--text-dim)', fontSize: '12px', letterSpacing: '.14em' }}>PROJECT:</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '15px' }}>{project.name}</span>
          </div>
          {project.githubConnection && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              border: '1px solid var(--border-default)', padding: '6px 12px',
            }}>
              <span className={`ds-status-dot ${project.githubConnection.status === 'connected' ? 'ds-status-dot--active' : 'ds-status-dot--inactive'}`} />
              <span style={{ fontSize: '11px', letterSpacing: '.1em', color: 'var(--text-muted)' }}>
                GITHUB SYNC: {project.githubConnection.status === 'connected' ? 'ACTIVE' : 'INACTIVE'}
              </span>
            </div>
          )}
        </div>
        <div style={{ flex: 1 }} className="ds-page-enter">
          {children}
        </div>
      </div>
    </div>
  );
}
