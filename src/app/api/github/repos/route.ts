import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { fetchUserRepos, fetchAuthenticatedUser } from '@/lib/github';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('github_access_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'GitHub not connected. Authorize first.' }, { status: 401 });
  }

  try {
    const [repos, user] = await Promise.all([
      fetchUserRepos(token),
      fetchAuthenticatedUser(token),
    ]);

    return NextResponse.json({
      user,
      repos,
      totalCount: repos.length,
      hasMore: false,
    });
  } catch (err: any) {
    console.error('GitHub repos fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch repositories', detail: err.message }, { status: 500 });
  }
}
