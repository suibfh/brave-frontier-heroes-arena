'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { LogOut, User, Wallet, Trophy, Swords, Grid, Boxes, ExternalLink, ShieldCheck } from 'lucide-react';
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

  // Orval generated React Query hooks
  const { data: userDataRaw, isLoading: isLoadingUser, error: userError } = useGetV1Me();

  // Type guard for user data (API returns dynamic object)
  const userData = userDataRaw?.user ? {
    user: {
      uid: userDataRaw.user.uid as number,
      name: userDataRaw.user.name as string,
      eth: userDataRaw.user.eth as string,
      ipfs: userDataRaw.user.ipfs as string | undefined,
      country_code: userDataRaw.user.country_code as number | undefined,
      guild_id: userDataRaw.user.guild_id as number | undefined,
      land_type: userDataRaw.user.land_type as number | undefined,
      registerd: userDataRaw.user.registerd as number | undefined,
    }
  } : undefined;

  // Handle auth errors
  useEffect(() => {
    if (userError) {
      // React Query error handling
      const axiosError = userError as { response?: { status: number } };
      if (axiosError.response?.status === 401) {
        router.push('/login');
      }
    }
  }, [userError, router]);

  const loading = isLoadingUser;
  const error = userError
    ? (userError instanceof Error ? userError.message : 'Failed to load user data')
    : null;

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-card p-8 rounded-xl">
          <div className="animate-pulse text-white">Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="glass-card border-0 max-w-md">
          <CardHeader>
            <CardTitle className="text-red-400">Error</CardTitle>
            <CardDescription className="text-neutral-300">{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/login')} className="w-full">
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="cyber-card rounded-xl p-6 flex items-center justify-between bg-white">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900 mb-2 uppercase tracking-tight">
              Brave Frontier Heroes Dashboard
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

        {/* User Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="cyber-card border-2 border-neutral-900 shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold text-neutral-500 uppercase tracking-wider">
                User ID
              </CardTitle>
              <User className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-neutral-900 font-mono">
                {userData?.user?.uid || 'N/A'}
              </div>
            </CardContent>
          </Card>

          <Card className="cyber-card border-2 border-neutral-900 shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold text-neutral-500 uppercase tracking-wider">
                Username
              </CardTitle>
              <Swords className="h-4 w-4 text-pink-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-neutral-900">
                {userData?.user?.name || 'N/A'}
              </div>
            </CardContent>
          </Card>

          <Card className="cyber-card border-2 border-neutral-900 shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold text-neutral-500 uppercase tracking-wider">
                Wallet
              </CardTitle>
              <Wallet className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-neutral-900 font-mono">
                {userData?.user?.eth ?
                  `${userData.user.eth.slice(0, 6)}...${userData.user.eth.slice(-4)}`
                  : 'Not Connected'}
              </div>
            </CardContent>
          </Card>

          <Card className="cyber-card border-2 border-neutral-900 shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold text-neutral-500 uppercase tracking-wider">
                Guild ID
              </CardTitle>
              <Trophy className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-neutral-900 font-mono">
                {userData?.user?.guild_id || 'No Guild'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* User Details */}
        <Card className="cyber-card border-2 border-neutral-900">
          <CardHeader>
            <CardTitle className="text-neutral-900 font-bold uppercase tracking-tight">Profile Information</CardTitle>
            <CardDescription className="text-neutral-500 font-mono">
              Your account details and statistics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-sm text-neutral-500 font-bold uppercase">Name</div>
                  <div className="text-lg font-bold text-neutral-900">
                    {userData?.user?.name || 'N/A'}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm text-neutral-500 font-bold uppercase">User ID (UID)</div>
                  <div className="text-lg font-bold text-neutral-900 font-mono">
                    {userData?.user?.uid || 'N/A'}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm text-neutral-500 font-bold uppercase">Wallet Address (ETH)</div>
                  <div className="text-lg font-bold text-neutral-900 font-mono break-all">
                    {userData?.user?.eth || 'Not Connected'}
                  </div>
                </div>

                {userData?.user?.ipfs && (
                  <div className="space-y-2">
                    <div className="text-sm text-neutral-500 font-bold uppercase">IPFS</div>
                    <div className="text-lg font-bold text-neutral-900 font-mono break-all">
                      {userData.user.ipfs}
                    </div>
                  </div>
                )}

                {userData?.user?.guild_id && (
                  <div className="space-y-2">
                    <div className="text-sm text-neutral-500 font-bold uppercase">Guild ID</div>
                    <div className="text-lg font-bold text-neutral-900 font-mono">
                      {userData.user.guild_id}
                    </div>
                  </div>
                )}

                {userData?.user?.land_type !== undefined && (
                  <div className="space-y-2">
                    <div className="text-sm text-neutral-500 font-bold uppercase">Land Type</div>
                    <div className="text-lg font-bold text-neutral-900 font-mono">
                      {userData.user.land_type}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Units Section Link */}
          <Card className="cyber-card border-2 border-neutral-900 cursor-pointer hover:bg-neutral-50 transition-colors" onClick={() => router.push('/units')}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-neutral-900 font-bold flex items-center uppercase">
                  <Grid className="w-6 h-6 mr-2 text-purple-600" />
                  My Units
                </CardTitle>
                <CardDescription className="text-neutral-500 font-mono mt-1">
                  View and manage your hero units
                </CardDescription>
              </div>
              <ExternalLink className="w-6 h-6 text-neutral-400" />
            </CardHeader>
          </Card>

          {/* Spheres Section Link */}
          <Card className="cyber-card border-2 border-neutral-900 cursor-pointer hover:bg-neutral-50 transition-colors" onClick={() => router.push('/spheres')}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-neutral-900 font-bold flex items-center uppercase">
                  <Boxes className="w-6 h-6 mr-2 text-blue-600" />
                  My Spheres
                </CardTitle>
                <CardDescription className="text-neutral-500 font-mono mt-1">
                  View and manage your spheres
                </CardDescription>
              </div>
              <ExternalLink className="w-6 h-6 text-neutral-400" />
            </CardHeader>
          </Card>

          {/* Auth Debug Section Link */}
          <Card className="cyber-card border-2 border-neutral-900 cursor-pointer hover:bg-neutral-50 transition-colors" onClick={() => router.push('/auth-debug')}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-neutral-900 font-bold flex items-center uppercase">
                  <ShieldCheck className="w-6 h-6 mr-2 text-green-600" />
                  Auth Debug
                </CardTitle>
                <CardDescription className="text-neutral-500 font-mono mt-1">
                  Token refresh and developer info
                </CardDescription>
              </div>
              <ExternalLink className="w-6 h-6 text-neutral-400" />
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
}
