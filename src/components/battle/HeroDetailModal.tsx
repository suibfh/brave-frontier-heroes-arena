'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { HeroGameData, HeroMetadata } from '@/src/types/battle';
import { RARITY_LABEL, UNIT_ATTR_MAP } from '@/src/lib/battle/constants';
import { fetchHeroMeta, heroMetaCache, fetchSkills, getSkill, isSkillsCacheReady } from '@/src/lib/battle/cache';
import { toFastUnitImageUrl } from '@/src/lib/battle/imageUrl';

// ---- useHeroMeta カスタムフック ----
export function useHeroMeta(heroId: string): HeroMetadata | null {
  const [meta, setMeta] = useState<HeroMetadata | null>(heroMetaCache[heroId] ?? null);
  useEffect(() => {
    fetchHeroMeta(heroId, setMeta);
  }, [heroId]);
  return meta;
}

// ---- HeroDetailModal ----
interface HeroDetailModalProps {
  heroId: string;
  gameData?: HeroGameData;
  onClose: () => void;
}

export function HeroDetailModal({ heroId, gameData, onClose }: HeroDetailModalProps) {
  const meta = useHeroMeta(heroId);
  const [skillsReady, setSkillsReady] = useState(isSkillsCacheReady());

  useEffect(() => {
    if (!isSkillsCacheReady()) fetchSkills(() => setSkillsReady(true));
  }, []);

  const rarityLabel = meta ? (RARITY_LABEL[meta.attributes.rarity] ?? meta.attributes.rarity) : '';
  const attrInfo = gameData ? UNIT_ATTR_MAP[gameData.attribute] : null;
  // APIの active=アートスキルID、passive=BBスキルID（名称と逆対応）
  const bbSkill  = skillsReady ? getSkill(gameData?.passive) : null;
  const artSkill = skillsReady ? getSkill(gameData?.active)  : null;

  const STAT_ROWS: [string, number][] = meta ? [
    ['HP',   meta.attributes.hp],
    ['攻撃', meta.attributes.phy],
    ['魔攻', meta.attributes.int],
    ['防御', meta.attributes.def],
    ['魔防', meta.attributes.spr],
    ['敏捷', meta.attributes.agi],
  ] : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-white border-2 border-neutral-900 rounded-xl max-w-sm w-full shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {meta ? (
          <>
            <div className="relative flex-shrink-0">
              <img src={toFastUnitImageUrl(meta.image)} alt="" className="w-full h-40 object-cover" />
              <button onClick={onClose} className="absolute top-2 right-2 bg-white rounded-full p-1 shadow">
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-2 left-2 flex gap-1">
                <span className="bg-black/70 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                  {rarityLabel}
                </span>
                {attrInfo && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${attrInfo.tw}`}>
                    {attrInfo.label}
                  </span>
                )}
              </div>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-black text-sm uppercase leading-tight">{gameData?.name_jp || gameData?.name || meta.attributes.type_name}</p>
                  <p className="text-xs text-neutral-400 font-mono">Lv {meta.attributes.lv}</p>
                </div>
                <span className="text-[10px] font-mono text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded flex-shrink-0">
                  #{heroId}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-[10px] font-mono">
                {STAT_ROWS.map(([k, v]) => (
                  <div key={k} className="bg-neutral-50 rounded px-2 py-1 flex justify-between">
                    <span className="text-neutral-400 font-bold">{k}</span>
                    <span className="font-bold">{(v ?? 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              {meta.attributes.brave_burst && (
                <div className="text-xs space-y-1">
                  <p className="font-black text-purple-700 text-[10px] uppercase">Brave Burst</p>
                  <p className="font-bold text-neutral-800">{meta.attributes.brave_burst}</p>
                  {bbSkill?.condition && (
                    <p className="text-neutral-400 leading-snug">発動条件: {bbSkill.condition}</p>
                  )}
                  {bbSkill && bbSkill.effects.length > 0 && (
                    <ul className="space-y-0.5">
                      {bbSkill.effects.map((e, i) => (
                        <li key={i} className="text-neutral-600 leading-snug pl-2 border-l-2 border-purple-200">{e}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {meta.attributes.art_skill && (
                <div className="text-xs space-y-1">
                  <p className="font-black text-pink-700 text-[10px] uppercase">Art Skill</p>
                  <p className="font-bold text-neutral-800">{meta.attributes.art_skill}</p>
                  {artSkill && artSkill.effects.length > 0 && (
                    <ul className="space-y-0.5">
                      {artSkill.effects.map((e, i) => (
                        <li key={i} className="text-neutral-600 leading-snug pl-2 border-l-2 border-pink-200">{e}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="h-48 animate-pulse bg-neutral-100 flex items-center justify-center">
            <p className="text-neutral-400 font-mono text-sm">Loading...</p>
          </div>
        )}
      </div>
    </div>
  );
}
