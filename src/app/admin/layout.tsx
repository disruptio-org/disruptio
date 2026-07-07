import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AdminShell from './AdminShell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/auth/login');

  const role = (session.user as any).role;
  if (role !== 'admin' && role !== 'superadmin') {
    redirect('/projects');
  }

  return <AdminShell>{children}</AdminShell>;
}
