import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!;
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI!;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  // Handle GitHub denial
  if (error) {
    return NextResponse.redirect(new URL('/projects/connect-github?error=access_denied', req.url));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/projects/connect-github?error=missing_params', req.url));
  }

  // Verify state (CSRF protection)
  const cookieStore = await cookies();
  const storedState = cookieStore.get('github_oauth_state')?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(new URL('/projects/connect-github?error=invalid_state', req.url));
  }

  // Clear the state cookie
  cookieStore.delete('github_oauth_state');

  // Exchange code for access token
  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: GITHUB_REDIRECT_URI,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('GitHub token error:', tokenData);
      return NextResponse.redirect(new URL('/projects/connect-github?error=token_exchange_failed', req.url));
    }

    const accessToken = tokenData.access_token;
    const tokenType = tokenData.token_type;
    const scope = tokenData.scope;

    // Store the token in an HttpOnly cookie (encrypted)
    // In production, you'd encrypt this; for MVP, we store it directly in a secure cookie
    cookieStore.set('github_access_token', accessToken, {
      httpOnly: true,
      secure: false, // localhost
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    // Redirect back with success
    return NextResponse.redirect(new URL('/projects/connect-github?authorized=true&scope=' + encodeURIComponent(scope || ''), req.url));
  } catch (err) {
    console.error('GitHub callback error:', err);
    return NextResponse.redirect(new URL('/projects/connect-github?error=server_error', req.url));
  }
}
