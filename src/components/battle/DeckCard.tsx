'use client';

import { useState, useEffect } from 'react';
import type { DeckTemplate, SphereGameData } from '@/src/types/battle';
import { heroMetaCache, fetchHeroMeta } from '@/src/lib/battle/cache';
import { toFastUnitImageUrl, getSphereImageUrl } from '@/src/lib/battle/imageUrl';


// ---- DeckUnitIcon ----
function DeckUnitIcon({ heroId }: { heroId: string }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (heroMetaCache[heroId]) return;
    fetchHeroMeta(heroId, () => setTick(v => v + 1));
    const t = setInterval(() => {
      if (heroMetaCache[heroId]) { setTick(v => v + 1); clearInterval(t); }
    }, 200);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroId]);
  const meta = heroMetaCache[heroId] ?? null;
  void tick;

  return (
    <div className="w-10 h-10 rounded overflow-hidden bg-neutral-100 flex-shrink-0 border border-neutral-200">
      {meta?.image
        ? <img src={toFastUnitImageUrl(meta.image)} alt="" className="w-full h-full object-cover" />
        : <div className="w-full h-full animate-pulse bg-neutral-200" />}
    </div>
  );
}

// ---- DeckSphereIcon ----
function DeckSphereIcon({ sphereData }: { sphereData: SphereGameData }) {
  const url = getSphereImageUrl(sphereData);
  return (
    <div className="w-6 h-6 rounded overflow-hidden bg-neutral-100 flex-shrink-0 border border-neutral-200">
      {url
        ? <img src={url} alt="" className="w-full h-full object-contain p-px" />
        : <div className="w-full h-full animate-pulse bg-neutral-200" />}
    </div>
  );
}

// ---- DeckCard ----
interface DeckCardProps {
  deck: DeckTemplate;
  label: string;
  sphereGameMap: Record<string, SphereGameData>;
  onLoad: (deck: DeckTemplate) => void;
}

export function DeckCard({ deck, label, sphereGameMap, onLoad }: DeckCardProps) {
  const sorted = [...deck.units].sort((a, b) => a.position - b.position);
  return (
    <button
      onClick={() => onLoad(deck)}
      className="w-full text-left border-2 border-neutral-200 hover:border-red-400 hover:bg-red-50 rounded-lg p-2 transition-all group"
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-black text-neutral-500 uppercase">{label}</span>
        <span className="text-[9px] font-mono text-neutral-400">{sorted.length}体</span>
      </div>
      {/* ユニット+スフィアのセルを横並び */}
      <div className="flex gap-2 flex-wrap">
        {sorted.map((u, i) => {
          const spheres = [
            u.extension_ids[0] ? sphereGameMap[String(u.extension_ids[0])] ?? null : null,
            u.extension_ids[1] ? sphereGameMap[String(u.extension_ids[1])] ?? null : null,
          ];
          const hasAnySphere = spheres.some(Boolean);
          return (
            <div key={i} className="flex flex-col items-center gap-0.5">
              {/* ユニットアイコン */}
              <DeckUnitIcon heroId={String(u.hero_id)} />
              {/* スフィア2枠（常に表示、未装備は空枠） */}
              {hasAnySphere && (
                <div className="flex gap-0.5">
                  {spheres.map((s, si) =>
                    s ? (
                      <DeckSphereIcon key={si} sphereData={s} />
                    ) : (
                      <div key={si} className="w-6 h-6 rounded border border-dashed border-neutral-200 bg-neutral-50 flex-shrink-0" />
                    )
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[9px] text-red-500 font-black mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        ▶ タップして編成に反映
      </p>
    </button>
  );
}

// ---- DeckTemplateList ----
interface DeckTemplateListProps {
  deckTemplates: DeckTemplate[];
  questDeckTemplates: DeckTemplate[];
  sphereGameMap: Record<string, SphereGameData>;
  onLoad: (deck: DeckTemplate) => void;
}

export function DeckTemplateList({ deckTemplates, questDeckTemplates, sphereGameMap, onLoad }: DeckTemplateListProps) {
  if (deckTemplates.length === 0 && questDeckTemplates.length === 0) {
    return (
      <p className="text-[10px] text-neutral-400 font-mono py-4 text-center">
        パーティテンプレートがありません
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {deckTemplates.length > 0 && (
        <div className="space-y-2">
          <p className="text-[9px] font-black text-neutral-400 uppercase">通常パーティ</p>
          {deckTemplates.map((deck, i) => (
            <DeckCard key={deck.jin_id} deck={deck} label={`パーティ ${i + 1}`} sphereGameMap={sphereGameMap} onLoad={onLoad} />
          ))}
        </div>
      )}
      {questDeckTemplates.length > 0 && (
        <div className="space-y-2">
          <p className="text-[9px] font-black text-neutral-400 uppercase">クエストパーティ</p>
          {questDeckTemplates.map((deck, i) => (
            <DeckCard key={deck.jin_id} deck={deck} label={`クエストパーティ ${i + 1}`} sphereGameMap={sphereGameMap} onLoad={onLoad} />
          ))}
        </div>
      )}
    </div>
  );
}
