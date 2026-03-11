'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/src/components/ui/button';
// Removed generic Card import to use raw divs with new classes for cleaner control
import { LogIn, Terminal } from 'lucide-react';
import { BFH_AUTH_URL, CLIENT_ID, CLIENT_SECRET } from '@/src/config/env';
import { redirect } from 'next/navigation';

function LoginForm() {
  // サーバーサイドでのチェック（クライアントコンポーネント内でもサーバーで初回レンダリングされる）
  // ただし CLIENT_SECRET はクライアントサイドでは空になる
  if (!CLIENT_ID || (typeof window === 'undefined' && !CLIENT_SECRET)) {
    if (typeof window !== 'undefined') {
      window.location.href = '/env-warning';
      return null;
    }
    redirect('/env-warning');
  }
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  useEffect(() => {
    if (error) {
      console.error('Login error:', error);
    }
  }, [error]);

  const handleLogin = () => {
    const authUrl = BFH_AUTH_URL;
    const clientId = CLIENT_ID;
    const redirectUri = `${window.location.origin}/api/auth/callback`;

    if (!clientId) {
      console.error('CLIENT_ID is not configured. Please set NEXT_PUBLIC_CLIENT_ID in your .env file.');
      return;
    }

    // CSRF対策用のstateパラメータを生成（最低8文字以上）
    const state = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // stateをsessionStorageに保存（コールバック時に検証）
    sessionStorage.setItem('oauth_state', state);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'openid profile email offline_access',
      state: state,
    });

    window.location.href = `${authUrl}?${params.toString()}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      {/* Background Grid - Light Theme */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 0, 0, 0.05) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />

      <div className="w-full max-w-md cyber-card p-8">
        <div className="space-y-6 text-center">
          <div className="mx-auto w-20 h-20 flex items-center justify-center border-2 border-neutral-900 bg-white">
            <Terminal className="w-10 h-10 text-neutral-900" />
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-neutral-900 tracking-widest uppercase glitch-text" data-text="BFH Sandbox">
              BFH Sandbox
            </h1>
            <p className="text-neutral-500 font-mono text-xs tracking-wider">
              ACCESS RESTRICTED // AUTH REQUIRED
            </p>
          </div>

          <div className="space-y-4 pt-4">
            {error && (
              <div className="p-4 bg-red-50 border border-red-500 text-red-600 text-sm font-mono">
                [ERROR]:
                {error === 'token_exchange_failed' && 'TOKEN EXCHANGE FAILED'}
                {error === 'no_code' && 'MISSING AUTH CODE'}
                {error === 'unexpected_error' && 'SYSTEM ERROR'}
                {!['token_exchange_failed', 'no_code', 'unexpected_error'].includes(error) && error}
              </div>
            )}

            <button
              onClick={handleLogin}
              className="w-full h-14 cyber-button text-lg font-bold flex items-center justify-center gap-3"
            >
              <LogIn className="w-5 h-5" />
              CONNECT
            </button>

            <p className="text-[10px] text-center text-neutral-500 mt-6 font-mono uppercase">
              ブレヒロにログインします
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md cyber-card p-8 text-center text-neutral-900 font-mono animate-pulse">
          INITIALIZING...
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
