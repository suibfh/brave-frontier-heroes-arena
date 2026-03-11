'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { ChevronLeft, Boxes } from 'lucide-react';
import { CLIENT_ID, CLIENT_SECRET } from '@/src/config/env';
import { redirect } from 'next/navigation';
import { SphereCard } from '@/src/components/sphere-card';
import { useGetV1MeSpheres } from '@/src/api/generated/assets/assets';
import { usePostV1Spheres } from '@/src/api/generated/sphere/sphere';

export default function SpheresPage() {
  const router = useRouter();

  if (!CLIENT_ID || (typeof window === 'undefined' && !CLIENT_SECRET)) {
    if (typeof window !== 'undefined') {
      window.location.href = '/env-warning';
      return null;
    }
    redirect('/env-warning');
  }

  const { data: sphereListData, isLoading: isLoadingSpheres, error: spheresError } = useGetV1MeSpheres();

  // Sphere details state and mutation
  const [sphereDetails, setSphereDetails] = useState<{ [key: string]: any }>({});
  const { mutate: fetchSphereDetails } = usePostV1Spheres({
    mutation: {
      onSuccess: (data) => {
        // HandlersSphereDatasResponse might have spheres property
        setSphereDetails((data as any).spheres || {});
      },
    },
  });

  // Fetch sphere details when spheres are loaded
  useEffect(() => {
    if (sphereListData?.spheres && sphereListData.spheres.length > 0) {
      fetchSphereDetails({
        data: {
          sphere_ids: sphereListData.spheres.map(Number),
        },
      });
    }
  }, [sphereListData?.spheres, fetchSphereDetails]);

  // Handle auth errors
  useEffect(() => {
    if (spheresError && typeof spheresError === 'object' && 'status' in spheresError) {
      const error = spheresError as any;
      if (error.status === 401) {
        router.push('/login');
      }
    }
  }, [spheresError, router]);

  if (isLoadingSpheres) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-card p-8 rounded-xl">
          <div className="animate-pulse text-white">Loading Spheres...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="cyber-card rounded-xl p-6 flex items-center justify-between bg-white">
          <div className="flex items-center space-x-4">
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
                <Boxes className="w-8 h-8 mr-2 text-blue-600" />
                My Spheres
              </h1>
              <p className="text-neutral-600 font-mono">
                Total Spheres: {sphereListData?.count || 0}
              </p>
            </div>
          </div>
        </div>

        {/* Spheres Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {sphereListData?.spheres?.map((sphereId) => (
            <SphereCard
              key={sphereId}
              sphereId={sphereId}
              initialMetadata={sphereDetails[sphereId] as any}
            />
          ))}
          {(!sphereListData || !sphereListData.spheres || sphereListData.spheres.length === 0) && (
            <div className="col-span-full py-20 text-center cyber-card rounded-xl bg-white border-2 border-dashed border-neutral-300">
              <p className="text-neutral-500 italic text-lg font-mono">No spheres found in your wallet.</p>
              <Button
                onClick={() => router.push('/dashboard')}
                variant="link"
                className="text-blue-600 mt-4 font-bold uppercase"
              >
                Return to Dashboard
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
