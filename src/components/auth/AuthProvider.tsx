'use client';

import { SessionProvider } from 'next-auth/react';
import { ConfirmProvider } from '@/components/ui/ConfirmDialog';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ConfirmProvider>{children}</ConfirmProvider>
    </SessionProvider>
  );
}
