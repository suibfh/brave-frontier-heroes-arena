import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { BFH_TOKEN_URL, CLIENT_ID, CLIENT_SECRET } from '@/src/config/env';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  // エラーハンドリング
  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/login?error=no_code', request.url)
    );
  }

  try {
    // トークンエンドポイントへのリクエスト
    const tokenUrl = BFH_TOKEN_URL;
    const clientId = CLIENT_ID!;
    const clientSecret = CLIENT_SECRET!;
    const redirectUri = `${request.nextUrl.origin}/api/auth/callback`;

    // Basic認証のためのBase64エンコード
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange failed:', errorData);
      return NextResponse.redirect(
        new URL('/login?error=token_exchange_failed', request.url)
      );
    }

    const tokenData = await tokenResponse.json();

    // アクセストークンをクッキーに保存（httpOnly: falseでクライアントサイドからアクセス可能）
    const cookieStore = await cookies();
    cookieStore.set('bfh_access_token', tokenData.access_token, {
      httpOnly: false, // Orval生成のReact Query hooksで使用するためfalse
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokenData.expires_in || 3600, // デフォルト1時間
      path: '/',
    });

    // リフレッシュトークンも保存（存在する場合）
    if (tokenData.refresh_token) {
      cookieStore.set('bfh_refresh_token', tokenData.refresh_token, {
        httpOnly: true, // リフレッシュトークンは安全のためhttpOnly維持
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60, // 30日
        path: '/',
      });
    }

    // ダッシュボードへリダイレクト
    return NextResponse.redirect(new URL('/dashboard', request.url));
  } catch (error) {
    console.error('Authentication error:', error);
    return NextResponse.redirect(
      new URL('/login?error=unexpected_error', request.url)
    );
  }
}
