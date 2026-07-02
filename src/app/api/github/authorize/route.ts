import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI!;

// Request maximum permissions
const SCOPES = [
  'repo',              // Full control of private repositories
  'admin:org',         // Full control of orgs and teams
  'admin:repo_hook',   // Full control of repository hooks
  'admin:org_hook',    // Full control of organization hooks
  'delete_repo',       // Delete repositories
  'workflow',          // Update GitHub Action workflows
  'read:user',         // Read user profile data
  'user:email',        // Read user email addresses
].join(' ');

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Generate state token for CSRF protection
  const state = crypto.randomBytes(32).toString('hex');

  const cookieStore = await cookies();
  cookieStore.set('github_oauth_state', state, {
    httpOnly: true,
    secure: false, // localhost
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  });

  const authUrl = new URL('https://github.com/login/oauth/authorize');
  authUrl.searchParams.set('client_id', GITHUB_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', GITHUB_REDIRECT_URI);
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('state', state);

  return NextResponse.redirect(authUrl.toString());
}
