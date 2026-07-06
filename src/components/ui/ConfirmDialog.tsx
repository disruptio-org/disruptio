'use client';

import { useState, useCallback, createContext, useContext } from 'react';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue>({ confirm: () => Promise.resolve(false) });

export function useConfirm() {
  return useContext(ConfirmContext).confirm;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{
    open: boolean;
    options: ConfirmOptions;
    resolve: ((value: boolean) => void) | null;
  }>({ open: false, options: { message: '' }, resolve: null });

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setState({ open: true, options, resolve });
    });
  }, []);

  const handleClose = (result: boolean) => {
    state.resolve?.(result);
    setState({ open: false, options: { message: '' }, resolve: null });
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state.open && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => handleClose(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
              zIndex: 9998, backdropFilter: 'blur(2px)',
            }}
          />
          {/* Modal */}
          <div style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 9999, background: '#0D0D0D',
            border: `1px solid ${state.options.danger ? '#FF2A2A' : '#2A2A2A'}`,
            padding: '28px 32px', minWidth: '380px', maxWidth: '480px',
            fontFamily: '"JetBrains Mono", monospace',
          }}>
            {state.options.title && (
              <div style={{
                fontSize: '11px', letterSpacing: '.14em', fontWeight: 700,
                color: state.options.danger ? '#FF2A2A' : '#FFFFFF',
                marginBottom: '16px',
              }}>
                {state.options.title}
              </div>
            )}
            <div style={{
              fontSize: '13px', color: '#B3B3B3', lineHeight: 1.7,
              marginBottom: '24px',
            }}>
              {state.options.message}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                className="ds-btn-ghost ds-btn-sm"
                onClick={() => handleClose(false)}
              >
                {state.options.cancelLabel || 'CANCEL'}
              </button>
              <button
                className={state.options.danger ? 'ds-btn-primary ds-btn-sm' : 'ds-btn-primary ds-btn-sm'}
                style={state.options.danger ? { background: '#FF2A2A', borderColor: '#FF2A2A' } : {}}
                onClick={() => handleClose(true)}
              >
                {state.options.confirmLabel || 'CONFIRM'}
              </button>
            </div>
          </div>
        </>
      )}
    </ConfirmContext.Provider>
  );
}
