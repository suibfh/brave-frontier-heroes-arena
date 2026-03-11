'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { ChevronLeft, RefreshCw, ShieldCheck, Clock, AlertCircle, Info, Copy, Check } from 'lucide-react';
import { CLIENT_ID } from '@/src/config/env';
import Cookies from 'js-cookie';

export default function AuthDebugPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<{ hasAccessToken: boolean; hasRefreshToken: boolean } | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/auth/token-status');
      const data = await res.json();
      setTokenStatus(data);
    } catch (err) {
      console.error('Failed to fetch token status', err);
    }
  };

  useEffect(() => {
    fetchStatus();

    // アクセストークンの有効期限を簡易的にチェック（Cookieから）
    // 本来はサーバーから取得するのが望ましいが、デモ用
    const checkExpiry = () => {
      // Cookies.get('bfh_access_token') は値しか取れないので、
      // 実際には発行時のタイムスタンプを保存しておくなどの工夫が必要
      // ここでは、トークンが存在するかどうかを確認するに留める
    };

    checkExpiry();
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/auth/refresh', { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: `トークンを更新しました。新しい有効期限: ${data.expires_in}秒` });
        fetchStatus();
      } else {
        setMessage({ type: 'error', text: `更新に失敗しました: ${data.error}` });
      }
    } catch (err) {
      setMessage({ type: 'error', text: '通信エラーが発生しました' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="cyber-card rounded-xl p-6 flex items-center space-x-4 bg-white">
          <Button
            onClick={() => router.push('/dashboard')}
            variant="outline"
            size="icon"
            className="cyber-button border-neutral-900 text-neutral-900 hover:bg-neutral-900 hover:text-white"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-neutral-900 flex items-center uppercase tracking-tight">
              <ShieldCheck className="w-8 h-8 mr-2 text-green-600" />
              Auth Debug & Refresh
            </h1>
            <p className="text-neutral-600 font-mono">
              OAuth2 トークンの状態確認とリフレッシュの技術解説
            </p>
          </div>
        </div>

        {/* Token Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="cyber-card border-2 border-neutral-900 shadow-none">
            <CardHeader>
              <CardTitle className="text-neutral-900 flex items-center font-bold uppercase">
                <Clock className="w-5 h-5 mr-2 text-blue-600" />
                現在のトークン状態
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center p-3 rounded-lg bg-neutral-100 border border-neutral-200">
                <span className="text-neutral-500 font-bold text-sm">Access Token</span>
                {tokenStatus?.hasAccessToken ? (
                  <span className="text-green-700 font-bold flex items-center bg-green-100 px-2 py-1 rounded text-xs uppercase">
                    <ShieldCheck className="w-3 h-3 mr-1" /> 有効
                  </span>
                ) : (
                  <span className="text-red-700 font-bold flex items-center bg-red-100 px-2 py-1 rounded text-xs uppercase">
                    <AlertCircle className="w-3 h-3 mr-1" /> 無し
                  </span>
                )}
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-neutral-100 border border-neutral-200">
                <span className="text-neutral-500 font-bold text-sm">Refresh Token</span>
                {tokenStatus?.hasRefreshToken ? (
                  <span className="text-green-700 font-bold flex items-center bg-green-100 px-2 py-1 rounded text-xs uppercase">
                    <ShieldCheck className="w-3 h-3 mr-1" /> 有効
                  </span>
                ) : (
                  <span className="text-red-700 font-bold flex items-center bg-red-100 px-2 py-1 rounded text-xs uppercase">
                    <AlertCircle className="w-3 h-3 mr-1" /> 無し
                  </span>
                )}
              </div>

              <div className="pt-4">
                <Button
                  onClick={handleRefresh}
                  disabled={loading || !tokenStatus?.hasRefreshToken}
                  className="w-full cyber-button bg-neutral-900 text-white hover:bg-neutral-800 border-2 border-neutral-900 font-bold uppercase"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  トークンをリフレッシュする
                </Button>
              </div>

              {message && (
                <div className={`p-4 rounded-none border-l-4 font-mono text-xs ${message.type === 'success'
                    ? 'bg-green-50 border-green-500 text-green-800'
                    : 'bg-red-50 border-red-500 text-red-800'
                  }`}>
                  {message.text}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="cyber-card border-2 border-neutral-900 shadow-none">
            <CardHeader>
              <CardTitle className="text-neutral-900 flex items-center font-bold uppercase">
                <Info className="w-5 h-5 mr-2 text-purple-600" />
                技術解説
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-neutral-600 space-y-4 leading-relaxed font-mono">
              <p>
                Brave Frontier Heroes の OAuth2 認証では、アクセストークンの有効期限が切れた際、
                <code className="text-purple-700 bg-purple-100 px-1 rounded font-bold">refresh_token</code>
                を使用して新しいアクセストークンを取得できます。
              </p>
              <div className="space-y-2">
                <h4 className="text-neutral-900 font-bold uppercase text-xs">リフレッシュの流れ:</h4>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>ログイン時に <code className="text-pink-700 font-bold">offline_access</code> スコープを要求</li>
                  <li>トークン取得時に <code className="text-pink-700 font-bold">refresh_token</code> が発行される</li>
                  <li>有効期限が切れる前に、このトークンをトークンエンドポイントへ送信</li>
                  <li>新しいアクセストークン（および新しいリフレッシュトークン）を受け取る</li>
                </ol>
              </div>
              <p className="text-xs text-neutral-400 italic mt-4 border-t border-dashed border-neutral-300 pt-2">
                ※ このデモでは、リフレッシュトークンをサーバーサイドの Secure/HttpOnly Cookie で管理し、
                ブラウザ側からは直接触れられない安全な構成をとっています。
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Developer Console Hint */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="cyber-card border-2 border-neutral-900 shadow-none">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-neutral-900 text-lg font-bold uppercase">Developer Tips</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="text-neutral-400 hover:text-neutral-900 h-8 w-8 hover:bg-neutral-100"
                onClick={() => copyToClipboard(`document.cookie.includes('bfh_access_token');`, 'tips')}
              >
                {copied === 'tips' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="bg-neutral-50 p-4 rounded-none border border-neutral-300 font-mono text-xs text-neutral-600">
                <p className="text-blue-600 font-bold">// Client-side (Publicly accessible)</p>
                <p>document.cookie.includes('bfh_access_token'); <span className="text-neutral-400">// true</span></p>
                <p className="mt-2 text-blue-600 font-bold">// Server-side (HttpOnly)</p>
                <p>const refreshToken = cookies().get('bfh_refresh_token');</p>
              </div>
            </CardContent>
          </Card>

          <Card className="cyber-card border-2 border-neutral-900 shadow-none">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-neutral-900 text-lg font-bold uppercase">curl Example (Direct)</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="text-neutral-400 hover:text-neutral-900 h-8 w-8 hover:bg-neutral-100"
                onClick={() => copyToClipboard(`curl -X POST https://auth.bravefrontierheroes.com/oauth2/token \\
  -H "Authorization: Basic $(echo -n '${CLIENT_ID || 'YOUR_CLIENT_ID'}:YOUR_CLIENT_SECRET' | base64)" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=refresh_token" \\
  -d "refresh_token=YOUR_REFRESH_TOKEN"`, 'curl')}
              >
                {copied === 'curl' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="bg-neutral-50 p-4 rounded-none border border-neutral-300 font-mono text-xs text-neutral-600 overflow-x-auto">
                <p className="text-neutral-400 italic mb-2"># BFHエンドポイントを直接叩く場合</p>
                <pre className="whitespace-pre-wrap break-all">
                  {`curl -X POST https://auth.bravefrontierheroes.com/oauth2/token \\
  -H "Authorization: Basic \$(echo -n '${CLIENT_ID || 'YOUR_CLIENT_ID'}:YOUR_CLIENT_SECRET' | base64)" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=refresh_token" \\
  -d "refresh_token=YOUR_REFRESH_TOKEN"`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
