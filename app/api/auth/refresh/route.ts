import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { BFH_TOKEN_URL, CLIENT_ID, CLIENT_SECRET } from '@/src/config/env';

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('bfh_refresh_token')?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: 'No refresh token available' }, { status: 400 });
  }

  try {
    const tokenUrl = BFH_TOKEN_URL;
    const clientId = CLIENT_ID!;
    const clientSecret = CLIENT_SECRET!;

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token refresh failed:', errorData);
      return NextResponse.json({ error: 'Token refresh failed', details: errorData }, { status: tokenResponse.status });
    }

    const tokenData = await tokenResponse.json();

    // 新しいアクセストークンを保存
    cookieStore.set('bfh_access_token', tokenData.access_token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokenData.expires_in || 3600,
      path: '/',
    });

    // 新しいリフレッシュトークンがあれば保存
    if (tokenData.refresh_token) {
      cookieStore.set('bfh_refresh_token', tokenData.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60,
        path: '/',
      });
    }

    return NextResponse.json({
      success: true,
      expires_in: tokenData.expires_in,
    });
  } catch (error) {
    console.error('Refresh error:', error);
    return NextResponse.json({ error: 'Unexpected error during refresh' }, { status: 500 });
  }
}
