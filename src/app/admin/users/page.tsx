'use client';

import { useState, useEffect, useCallback } from 'react';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  createdAt: string;
}

const ROLE_COLORS: Record<string, string> = {
  superadmin: '#8B5CF6',
  admin: '#3B82F6',
  editor: '#10B981',
  viewer: 'var(--text-dim)',
};

const STATUS_COLORS: Record<string, string> = {
  active: '#10B981',
  suspended: '#F39C12',
  deactivated: '#EF4444',
};

const ROLES = ['superadmin', 'admin', 'editor', 'viewer'] as const;

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ email: '', name: '', role: 'viewer', password: '' });
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin/users?${params}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    setAddLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });
      if (!res.ok) {
        const data = await res.json();
        setAddError(data.error || 'Failed to create user');
        return;
      }
      setAddForm({ email: '', name: '', role: 'viewer', password: '' });
      setShowAddForm(false);
      fetchUsers();
    } catch {
      setAddError('Network error');
    } finally {
      setAddLoading(false);
    }
  };

  const updateUser = async (userId: string, updates: Record<string, string>) => {
    setUpdatingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...data.user } : u));
      }
    } catch {
      // silent
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredUsers = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.email.toLowerCase().includes(q) || (u.name?.toLowerCase().includes(q) ?? false);
  });

  const labelStyle: React.CSSProperties = {
    fontSize: '10px',
    letterSpacing: '.1em',
    color: 'var(--text-dim)',
    textTransform: 'uppercase',
  };

  const thStyle: React.CSSProperties = {
    ...labelStyle,
    padding: '10px 16px',
    textAlign: 'left',
    borderBottom: '1px solid var(--border-default)',
    fontWeight: 500,
  };

  const tdStyle: React.CSSProperties = {
    padding: '10px 16px',
    fontSize: '13px',
    color: 'var(--text-primary)',
    borderBottom: '1px solid var(--border-default)',
    verticalAlign: 'middle',
  };

  return (
    <div style={{ padding: '32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
          <h1 style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '.14em', color: 'var(--text-primary)', margin: 0 }}>
            USER MANAGEMENT
          </h1>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)', letterSpacing: '.1em' }}>
            {filteredUsers.length} USER{filteredUsers.length !== 1 ? 'S' : ''}
          </span>
        </div>
        <button
          className="ds-btn-primary ds-btn-sm"
          onClick={() => setShowAddForm(!showAddForm)}
          style={{ letterSpacing: '.1em' }}
        >
          {showAddForm ? '[ CANCEL ]' : '[ ADD USER ]'}
        </button>
      </div>

      {/* Add User Form */}
      {showAddForm && (
        <div className="ds-card" style={{ marginBottom: '24px', padding: '20px' }}>
          <div style={{ ...labelStyle, marginBottom: '16px', fontSize: '11px' }}>NEW USER</div>
          <form onSubmit={handleAddUser} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', alignItems: 'end' }}>
            <div>
              <label className="ds-label" style={{ marginBottom: '6px', display: 'block' }}>EMAIL</label>
              <input
                className="ds-input"
                type="email"
                required
                value={addForm.email}
                onChange={e => setAddForm(p => ({ ...p, email: e.target.value }))}
                placeholder="user@example.com"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label className="ds-label" style={{ marginBottom: '6px', display: 'block' }}>NAME</label>
              <input
                className="ds-input"
                type="text"
                value={addForm.name}
                onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Full name"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label className="ds-label" style={{ marginBottom: '6px', display: 'block' }}>ROLE</label>
              <select
                className="ds-input"
                value={addForm.role}
                onChange={e => setAddForm(p => ({ ...p, role: e.target.value }))}
                style={{ width: '100%' }}
              >
                {ROLES.map(r => (
                  <option key={r} value={r}>{r.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="ds-label" style={{ marginBottom: '6px', display: 'block' }}>TEMP PASSWORD</label>
              <input
                className="ds-input"
                type="password"
                required
                value={addForm.password}
                onChange={e => setAddForm(p => ({ ...p, password: e.target.value }))}
                placeholder="••••••••"
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button className="ds-btn-primary ds-btn-sm" type="submit" disabled={addLoading} style={{ letterSpacing: '.1em' }}>
                {addLoading ? 'CREATING...' : '[ CREATE USER ]'}
              </button>
              {addError && (
                <span style={{ fontSize: '11px', color: '#EF4444', letterSpacing: '.05em' }}>{addError}</span>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div style={{ marginBottom: '20px' }}>
        <input
          className="ds-input"
          type="text"
          placeholder="Search by email or name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '320px' }}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-dim)', fontSize: '12px', letterSpacing: '.1em' }}>
          LOADING USERS...
        </div>
      ) : filteredUsers.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-dim)', fontSize: '12px', letterSpacing: '.1em' }}>
          NO USERS FOUND
        </div>
      ) : (
        <div className="ds-card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>EMAIL</th>
                <th style={thStyle}>NAME</th>
                <th style={thStyle}>ROLE</th>
                <th style={thStyle}>STATUS</th>
                <th style={thStyle}>CREATED</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(user => (
                <tr
                  key={user.id}
                  style={{
                    opacity: updatingId === user.id ? 0.5 : 1,
                    transition: 'opacity 150ms',
                  }}
                >
                  {/* Email */}
                  <td style={tdStyle}>
                    <span style={{ fontSize: '12px' }}>{user.email}</span>
                  </td>

                  {/* Name */}
                  <td style={tdStyle}>
                    <span style={{ color: user.name ? 'var(--text-primary)' : 'var(--text-faint)', fontSize: '12px' }}>
                      {user.name || '—'}
                    </span>
                  </td>

                  {/* Role */}
                  <td style={tdStyle}>
                    <select
                      className="ds-input"
                      value={user.role}
                      onChange={e => updateUser(user.id, { role: e.target.value })}
                      disabled={updatingId === user.id}
                      style={{
                        fontSize: '10px',
                        letterSpacing: '.1em',
                        padding: '4px 8px',
                        color: ROLE_COLORS[user.role] || 'var(--text-dim)',
                        borderColor: ROLE_COLORS[user.role] || 'var(--border-default)',
                        minWidth: '110px',
                      }}
                    >
                      {ROLES.map(r => (
                        <option key={r} value={r}>{r.toUpperCase()}</option>
                      ))}
                    </select>
                  </td>

                  {/* Status */}
                  <td style={tdStyle}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '10px',
                      letterSpacing: '.1em',
                      color: STATUS_COLORS[user.status] || 'var(--text-dim)',
                      textTransform: 'uppercase',
                    }}>
                      <span style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: STATUS_COLORS[user.status] || 'var(--text-dim)',
                        flexShrink: 0,
                      }} />
                      {user.status}
                    </span>
                  </td>

                  {/* Created */}
                  <td style={tdStyle}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {new Date(user.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </td>

                  {/* Actions */}
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <button
                      className="ds-btn-ghost ds-btn-sm"
                      onClick={() => updateUser(user.id, { status: user.status === 'active' ? 'suspended' : 'active' })}
                      disabled={updatingId === user.id}
                      style={{
                        fontSize: '10px',
                        letterSpacing: '.1em',
                        color: user.status === 'active' ? 'var(--warning)' : 'var(--success)',
                      }}
                    >
                      {user.status === 'active' ? 'SUSPEND' : 'ACTIVATE'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
