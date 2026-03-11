'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { AlertTriangle, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/src/components/ui/button';

export default function EnvWarning() {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const envExample = `NEXT_PUBLIC_CLIENT_ID=your_client_id_here
CLIENT_SECRET=your_client_secret_here`;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0f0a1e]">
      <Card className="w-full max-w-2xl glass-card border-0">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-20 h-20 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-yellow-500" />
          </div>
          <CardTitle className="text-3xl font-bold text-white">
            環境変数が設定されていません
          </CardTitle>
          <CardDescription className="text-neutral-300 text-lg">
            アプリケーションを実行するには、OAuth2 クライアントの設定が必要です。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <p className="text-sm text-neutral-400">
              `.env` ファイルを作成し、以下の環境変数を設定してください：
            </p>
            <div className="relative">
              <pre className="p-4 rounded-lg bg-black/40 text-neutral-200 font-mono text-sm overflow-x-auto border border-white/10">
                {envExample}
              </pre>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 text-neutral-400 hover:text-white"
                onClick={() => copyToClipboard(envExample, 'env')}
              >
                {copied === 'env' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 space-y-2">
            <h4 className="text-blue-400 font-semibold flex items-center">
              <span className="mr-2">💡</span> どこで取得できますか？
            </h4>
            <p className="text-sm text-neutral-300 leading-relaxed">
              Client ID と Client Secret は、<a href="https://bfh-developer-portal-front.vercel.app/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline font-medium">BFH Developer Portal</a> で取得することができます。
            </p>
          </div>

          <div className="text-center pt-4">
            <p className="text-xs text-neutral-500">
              設定完了後、開発サーバーを再起動してください。
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
