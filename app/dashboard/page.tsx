'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { LogOut, IdCard, Swords, ExternalLink } from 'lucide-react';
import { CLIENT_ID, CLIENT_SECRET } from '@/src/config/env';
import { redirect } from 'next/navigation';
import { useGetV1Me } from '@/src/api/generated/user/user';

// ---- BFHA NFT セクション ----
interface NFTMeta { tokenId: number; name: string; image: string; }
interface BFHAData { balance: number; nfts: NFTMeta[]; }

function BFHASection({ address }: { address: string }) {
  const [data, setData]       = useState<BFHAData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) return;
    fetch(`/api/bfha?address=${address}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [address]);

  if (loading) {
    return (
      <div className="md:col-span-2 pt-2 border-t border-neutral-100">
        <div className="text-xs text-neutral-500 font-bold uppercase mb-2">
          Brush Field Home Atelier (BFHA)
        </div>
        <div className="flex gap-2">
          {[0, 1].map(i => (
            <div key={i} className="w-10 h-10 rounded-lg bg-neutral-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.balance === 0) {
    return (
      <div className="md:col-span-2 pt-2 border-t border-neutral-100">
        <div className="text-xs text-neutral-500 font-bold uppercase mb-1">
          Brush Field Home Atelier (BFHA)
        </div>
        <div className="text-sm text-neutral-400 font-mono">未所持</div>
      </div>
    );
  }

  return (
    <div className="md:col-span-2 pt-2 border-t border-neutral-100">
      <div className="text-xs text-neutral-500 font-bold uppercase mb-2">
        Brush Field Home Atelier (BFHA)
        <span className="ml-2 text-neutral-400 font-mono normal-case">{data.balance}点所持</span>
      </div>
      <div className="flex gap-2 flex-wrap">
        {data.nfts.map(nft => (
          <div key={nft.tokenId} className="flex flex-col items-center gap-0.5 group">
            <div className="w-10 h-10 rounded-lg overflow-hidden border border-neutral-200 bg-neutral-50 flex-shrink-0">
              {nft.image
                ? <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
                : <div className="w-full h-full bg-neutral-100" />}
            </div>
            <span className="text-[8px] font-mono text-neutral-400 max-w-[40px] truncate opacity-0 group-hover:opacity-100 transition-opacity">
              {nft.name}
            </span>
          </div>
        ))}
      </div>

      {/* 注意書き */}
      <p className="text-[11px] text-neutral-400 font-mono text-center pt-2 pb-6">
        ブレヒロメンテナンス中は一部機能が利用できない場合があります。時間をおいて再アクセスしてください。
      </p>

    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  if (!CLIENT_ID || (typeof window === 'undefined' && !CLIENT_SECRET)) {
    if (typeof window !== 'undefined') {
      window.location.href = '/env-warning';
      return null;
    }
    redirect('/env-warning');
  }

  const { data: userDataRaw, isLoading, error: userError } = useGetV1Me();

  const userData = userDataRaw?.user ? {
    user: {
      uid: userDataRaw.user.uid as number,
      name: userDataRaw.user.name as string,
      eth: userDataRaw.user.eth as string,
      land_type: userDataRaw.user.land_type as number | undefined,
    }
  } : undefined;

  useEffect(() => {
    if (userError) {
      const axiosError = userError as { response?: { status: number } };
      if (axiosError.response?.status === 401) router.push('/login');
    }
  }, [userError, router]);

  const handleログアウト = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (err) {
      console.error('ログアウト failed:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-neutral-500 font-mono">Loading...</div>
      </div>
    );
  }

  if (userError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="cyber-card border-0 max-w-md">
          <CardHeader>
            <CardTitle className="text-red-400">Error</CardTitle>
            <CardDescription className="text-neutral-500">Failed to load user data</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/login')} className="w-full">Back to Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="cyber-card rounded-xl p-4 sm:p-6 flex items-center justify-between gap-3 bg-white">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-3xl font-bold text-neutral-900 mb-1 uppercase tracking-tight leading-tight">
              Brave Frontier Heroes Arena
            </h1>
            <p className="text-sm text-neutral-600 font-mono truncate">
              ようこそ、{userData?.user?.name || 'Player'}!
            </p>
          </div>
          <Button
            onClick={handleログアウト}
            variant="outline"
            className="cyber-button border-neutral-900 text-neutral-900 hover:bg-neutral-900 hover:text-white flex-shrink-0"
          >
            <LogOut className="w-4 h-4 mr-2" />
            ログアウト
          </Button>
        </div>

        {/* プロフィール情報 */}
        <Card className="cyber-card border-2 border-neutral-900">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-4">
            <IdCard className="w-5 h-5 text-neutral-600" />
            <CardTitle className="text-neutral-900 font-bold uppercase tracking-tight">プロフィール情報</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-neutral-500 font-bold uppercase mb-1">プレイヤーネーム</div>
                <div className="text-lg font-bold text-neutral-900">{userData?.user?.name || 'N/A'}</div>
              </div>
              <div>
                <div className="text-xs text-neutral-500 font-bold uppercase mb-1">ブレヒロ ID</div>
                <div className="text-lg font-bold text-neutral-900 font-mono">{userData?.user?.uid || 'N/A'}</div>
              </div>
              <div className="md:col-span-2">
                <div className="text-xs text-neutral-500 font-bold uppercase mb-1">ウォレットアドレス</div>
                <div className="text-lg font-bold text-neutral-900 font-mono break-all">
                  {userData?.user?.eth || '未接続'}
                </div>
              </div>

              {userData?.user?.eth && (
                <BFHASection address={userData.user.eth as string} />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 gap-4">
          <Card className="cyber-card border-2 border-violet-600 cursor-pointer hover:bg-violet-50 transition-colors" onClick={() => router.push('/simulator')}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-neutral-900 font-bold flex items-center uppercase">
                  <Swords className="w-6 h-6 mr-2 text-neutral-600" />
                  おれ vs おれ
                </CardTitle>
                <CardDescription className="text-neutral-500 font-mono mt-1">
                  テンプレパーティバトルシミュレータ
                </CardDescription>
              </div>
              <ExternalLink className="w-5 h-5 text-neutral-400" />
            </CardHeader>
          </Card>

          <Card className="cyber-card border-2 border-red-600 cursor-pointer hover:bg-red-50 transition-colors" onClick={() => router.push('/stages')}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-neutral-900 font-bold flex items-center uppercase">
                  <Swords className="w-6 h-6 mr-2 text-neutral-600" />
                  バトルアリーナ
                </CardTitle>
                <CardDescription className="text-neutral-500 font-mono mt-1">
                  ステージを選んでバトルに挑戦！
                </CardDescription>
              </div>
              <ExternalLink className="w-5 h-5 text-neutral-400" />
            </CardHeader>
          </Card>
        </div>

      </div>

      {/* 注意書き */}
      <p className="text-[11px] text-neutral-400 font-mono text-center pt-2 pb-6">
        ブレヒロメンテナンス中は一部機能が利用できない場合があります。時間をおいて再アクセスしてください。
      </p>

    </div>
  );
}
