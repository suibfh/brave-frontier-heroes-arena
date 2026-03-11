'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { ChevronLeft, Grid } from 'lucide-react';
import { CLIENT_ID, CLIENT_SECRET } from '@/src/config/env';
import { redirect } from 'next/navigation';
import { UnitCard } from '@/src/components/unit-card';
import { useGetV1MeUnits } from '@/src/api/generated/assets/assets';
import { usePostV1Heroes } from '@/src/api/generated/hero/hero';

export default function UnitsPage() {
  const router = useRouter();

  if (!CLIENT_ID || (typeof window === 'undefined' && !CLIENT_SECRET)) {
    if (typeof window !== 'undefined') {
      window.location.href = '/env-warning';
      return null;
    }
    redirect('/env-warning');
  }

  const { data: unitListData, isLoading: isLoadingUnits, error: unitsError } = useGetV1MeUnits();

  // Hero details state and mutation
  const [heroDetails, setHeroDetails] = useState<{ [key: string]: any }>({});
  const { mutate: fetchHeroDetails } = usePostV1Heroes({
    mutation: {
      onSuccess: (data) => {
        setHeroDetails(data.heroes || {});
      },
    },
  });

  // Fetch hero details when units are loaded
  useEffect(() => {
    if (unitListData?.units && unitListData.units.length > 0) {
      fetchHeroDetails({
        data: {
          hero_ids: unitListData.units.map(Number),
        },
      });
    }
  }, [unitListData?.units, fetchHeroDetails]);

  // Handle auth errors
  useEffect(() => {
    if (unitsError && typeof unitsError === 'object' && 'status' in unitsError) {
      const error = unitsError as any;
      if (error.status === 401) {
        router.push('/login');
      }
    }
  }, [unitsError, router]);

  if (isLoadingUnits) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-card p-8 rounded-xl">
          <div className="animate-pulse text-white">Loading Units...</div>
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
                <Grid className="w-8 h-8 mr-2 text-purple-600" />
                My Units
              </h1>
              <p className="text-neutral-600 font-mono">
                Total Units: {unitListData?.count || 0}
              </p>
            </div>
          </div>
        </div>

        {/* Units Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {unitListData?.units?.map((unitId) => (
            <UnitCard
              key={unitId}
              heroId={unitId}
              initialMetadata={heroDetails[unitId] as any}
            />
          ))}
          {(!unitListData || !unitListData.units || unitListData.units.length === 0) && (
            <div className="col-span-full py-20 text-center cyber-card rounded-xl bg-white border-2 border-dashed border-neutral-300">
              <p className="text-neutral-500 italic text-lg font-mono">No units found in your wallet.</p>
              <Button
                onClick={() => router.push('/dashboard')}
                variant="link"
                className="text-purple-600 mt-4 font-bold uppercase"
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
