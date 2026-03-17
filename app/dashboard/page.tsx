'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { LogOut, IdCard, Swords, PersonStanding, Sword, ExternalLink } from 'lucide-react';
import { CLIENT_ID, CLIENT_SECRET } from '@/src/config/env';
import { redirect } from 'next/navigation';
import { useGetV1Me } from '@/src/api/generated/user/user';

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

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (err) {
      console.error('Logout failed:', err);
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
        <div className="cyber-card rounded-xl p-6 flex items-center justify-between bg-white">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900 mb-2 uppercase tracking-tight">
              Brave Frontier Heroes
            </h1>
            <p className="text-neutral-600 font-mono">
              Welcome back, {userData?.user?.name || 'Player'}!
            </p>
          </div>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="cyber-button border-neutral-900 text-neutral-900 hover:bg-neutral-900 hover:text-white"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>

        {/* Profile Information */}
        <Card className="cyber-card border-2 border-neutral-900">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-4">
            <IdCard className="w-5 h-5 text-neutral-600" />
            <div>
              <CardTitle className="text-neutral-900 font-bold uppercase tracking-tight">Profile Information</CardTitle>
              <CardDescription className="text-neutral-500 font-mono">Your account details</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-neutral-500 font-bold uppercase mb-1">Name</div>
                <div className="text-lg font-bold text-neutral-900">{userData?.user?.name || 'N/A'}</div>
              </div>
              <div>
                <div className="text-xs text-neutral-500 font-bold uppercase mb-1">User ID</div>
                <div className="text-lg font-bold text-neutral-900 font-mono">{userData?.user?.uid || 'N/A'}</div>
              </div>
              <div className="md:col-span-2">
                <div className="text-xs text-neutral-500 font-bold uppercase mb-1">Wallet Address</div>
                <div className="text-lg font-bold text-neutral-900 font-mono break-all">
                  {userData?.user?.eth || 'Not Connected'}
                </div>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="cyber-card border-2 border-red-600 cursor-pointer hover:bg-red-50 transition-colors md:col-span-2" onClick={() => router.push('/stages')}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-neutral-900 font-bold flex items-center uppercase">
                  <Swords className="w-6 h-6 mr-2 text-neutral-600" />
                  Battle Arena
                </CardTitle>
                <CardDescription className="text-neutral-500 font-mono mt-1">
                  ステージを選んでバトルに挑戦！
                </CardDescription>
              </div>
              <ExternalLink className="w-5 h-5 text-neutral-400" />
            </CardHeader>
          </Card>

          <Card className="cyber-card border-2 border-neutral-900 cursor-pointer hover:bg-neutral-50 transition-colors" onClick={() => router.push('/units')}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-neutral-900 font-bold flex items-center uppercase">
                  <PersonStanding className="w-6 h-6 mr-2 text-neutral-600" />
                  My Units
                </CardTitle>
                <CardDescription className="text-neutral-500 font-mono mt-1">
                  View and manage your hero units
                </CardDescription>
              </div>
              <ExternalLink className="w-5 h-5 text-neutral-400" />
            </CardHeader>
          </Card>

          <Card className="cyber-card border-2 border-neutral-900 cursor-pointer hover:bg-neutral-50 transition-colors" onClick={() => router.push('/spheres')}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-neutral-900 font-bold flex items-center uppercase">
                  <Sword className="w-6 h-6 mr-2 text-neutral-600" />
                  My Spheres
                </CardTitle>
                <CardDescription className="text-neutral-500 font-mono mt-1">
                  View and manage your spheres
                </CardDescription>
              </div>
              <ExternalLink className="w-5 h-5 text-neutral-400" />
            </CardHeader>
          </Card>
        </div>

      </div>
    </div>
  );
}
