'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

interface HeroMetadata {
  name: string;
  description: string;
  image: string;
  timestamp: number;
  language: string;
  attributes: {
    type_name: string;
    rarity: string;
    lv: number;
    hp: number;
    phy: number;
    int: number;
    agi: number;
    spr: number;
    def: number;
    ex_ascension_phase: number;
    ex_ascension_level: number;
    brave_burst: string;
    art_skill: string;
  };
}

interface UnitCardProps {
  heroId: string | number;
  initialMetadata?: HeroMetadata;
  className?: string;
}

export function UnitCard({ heroId, initialMetadata, className = '' }: UnitCardProps) {
  const [metadata, setMetadata] = useState<HeroMetadata | null>(initialMetadata || null);
  const [loading, setLoading] = useState(!initialMetadata);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialMetadata) return;

    const fetchMetadata = async () => {
      try {
        const response = await fetch(`/api/hero/metadata/${heroId}`);

        if (!response.ok) {
          throw new Error('Failed to fetch hero metadata');
        }

        const data = await response.json();
        setMetadata(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchMetadata();
  }, [heroId]);

  if (loading) {
    return (
      <Card className={`cyber-card border-neutral-900 ${className}`}>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-48 bg-neutral-200 rounded-lg"></div>
            <div className="h-4 bg-neutral-200 rounded w-3/4"></div>
            <div className="h-4 bg-neutral-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !metadata) {
    return (
      <Card className={`cyber-card border-neutral-900 ${className}`}>
        <CardContent className="p-6 text-center text-red-500 font-bold font-mono">
          Error loading unit data
        </CardContent>
      </Card>
    );
  }

  const getRarityColor = (rarity: string) => {
    switch (rarity.toLowerCase()) {
      case 'common':
        return 'text-neutral-500 bg-neutral-200';
      case 'uncommon':
        return 'text-green-700 bg-green-100';
      case 'rare':
        return 'text-blue-700 bg-blue-100';
      case 'epic':
        return 'text-purple-700 bg-purple-100';
      case 'legendary':
        return 'text-orange-700 bg-orange-100';
      default:
        return 'text-neutral-900 bg-white';
    }
  };

  return (
    <Card className={`cyber-card border-2 border-neutral-900 overflow-hidden shadow-none hover:shadow-lg transition-shadow duration-300 ${className}`}>
      <div className="relative h-48 overflow-hidden bg-white border-b-2 border-neutral-900">
        <img
          src={metadata.image}
          alt={metadata.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-2 right-2">
          <span
            className={`px-3 py-1 text-xs font-black uppercase border border-current ${getRarityColor(
              metadata.attributes.rarity
            )}`}
          >
            {metadata.attributes.rarity}
          </span>
        </div>
      </div>

      <CardHeader className="bg-white border-b border-neutral-200">
        <CardTitle className="text-neutral-900 text-lg font-bold uppercase tracking-tight">
          {metadata.attributes.type_name}
        </CardTitle>
        <CardDescription className="text-neutral-500 text-sm font-mono">
          Level {metadata.attributes.lv}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 pt-4 bg-white">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="space-y-1">
            <div className="flex justify-between border-b border-neutral-100 pb-1">
              <span className="text-neutral-500 font-bold text-xs">HP</span>
              <span className="text-neutral-900 font-mono font-bold">
                {(metadata.attributes.hp ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between border-b border-neutral-100 pb-1">
              <span className="text-neutral-500 font-bold text-xs">PHY</span>
              <span className="text-neutral-900 font-mono font-bold">
                {(metadata.attributes.phy ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between border-b border-neutral-100 pb-1">
              <span className="text-neutral-500 font-bold text-xs">INT</span>
              <span className="text-neutral-900 font-mono font-bold">
                {(metadata.attributes.int ?? 0).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between border-b border-neutral-100 pb-1">
              <span className="text-neutral-500 font-bold text-xs">AGI</span>
              <span className="text-neutral-900 font-mono font-bold">
                {(metadata.attributes.agi ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between border-b border-neutral-100 pb-1">
              <span className="text-neutral-500 font-bold text-xs">SPR</span>
              <span className="text-neutral-900 font-mono font-bold">
                {(metadata.attributes.spr ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between border-b border-neutral-100 pb-1">
              <span className="text-neutral-500 font-bold text-xs">DEF</span>
              <span className="text-neutral-900 font-mono font-bold">
                {(metadata.attributes.def ?? 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t-2 border-neutral-100 space-y-2">
          <div>
            <p className="text-[10px] text-neutral-400 font-black uppercase mb-1">Brave Burst</p>
            <p className="text-sm text-purple-700 font-bold leading-tight">
              {metadata.attributes.brave_burst}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-neutral-400 font-black uppercase mb-1">Art Skill</p>
            <p className="text-sm text-pink-700 font-bold leading-tight">{metadata.attributes.art_skill}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
