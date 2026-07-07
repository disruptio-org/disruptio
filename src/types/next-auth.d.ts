import { DefaultSession } from 'next-auth';

/**
 * NextAuth type augmentation for Disruptio.
 * Adds role, status, and workspaceId to the session user.
 */
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
      status: string;
      workspaceId?: string;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    role: string;
    status: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    status: string;
    workspaceId?: string;
  }
}
