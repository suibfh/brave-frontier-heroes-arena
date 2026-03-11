'use client';

import { ExternalLink } from 'lucide-react';
import { getBattleReplayUrl } from '@/src/lib/utils';
import { Button } from './ui/button';

interface BattleReplayLinkProps {
  battleId: string | number;
  lang?: string;
  className?: string;
}

export function BattleReplayLink({
  battleId,
  lang = 'ja',
  className = '',
}: BattleReplayLinkProps) {
  const replayUrl = getBattleReplayUrl(battleId, lang);

  return (
    <Button
      asChild
      variant="outline"
      className={`glass hover:glass-hover border-neutral-600 text-white ${className}`}
    >
      <a href={replayUrl} target="_blank" rel="noopener noreferrer">
        <ExternalLink className="w-4 h-4 mr-2" />
        バトルリプレイを見る
      </a>
    </Button>
  );
}
