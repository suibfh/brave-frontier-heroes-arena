'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { ChevronLeft, Swords, Star, Trophy, Skull, Minus, ExternalLink, Search, X, Info, ArrowUp, ArrowDown } from 'lucide-react';
import { STAGES } from '@/src/config/stages';
import { useGetV1Me } from '@/src/api/generated/user/user';
import { useGetV1MeUnits, useGetV1MeSpheres } from '@/src/api/generated/assets/assets';
import { usePostV1BattleSimulate } from '@/src/api/generated/battle/battle';

// ============================================================
// 型定義
// ============================================================
interface HeroMetadata {
  name: string;
  image: string;
  attributes: {
    type_name: string;
    rarity: string;       // 実際の文字列値はデバッグログで確認
    element?: string;     // 属性（文字列の場合）
    attribute?: string;   // 属性（別フィールド名の場合）
    lv: number;
    hp: number;
    phy: number;
    int: number;
    agi: number;
    spr: number;
    def: number;
    brave_burst?: string;
    art_skill?: string;
  };
}

interface SphereMetadata {
  name: string;
  image: string;
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
    ability_name?: string;
  };
}

type SelectedUnit = {
  heroId: string;
  skillOrders: [number, number, number]; // 0=アートスキル, 1=スフィア1, 2=スフィア2
  sphereIds: (string | null)[];
};

type BattleResult = {
  result: number;
  battle_key: string;
  attacker_taken_damage: number;
  defender_taken_damage: number;
  player_name: string;
  opponent_name: string;
};

// ============================================================
// グローバルキャッシュ（再ロード防止・重複fetch防止）
// ============================================================
const heroCache: Record<string, HeroMetadata> = {};
const sphereCache: Record<string, SphereMetadata> = {};
const heroFetching = new Set<string>();
const sphereFetching = new Set<string>();

function fetchHeroMeta(heroId: string, onDone: (d: HeroMetadata) => void) {
  if (heroCache[heroId]) { onDone(heroCache[heroId]); return; }
  if (heroFetching.has(heroId)) return;
  heroFetching.add(heroId);
  fetch(`/api/hero/metadata/${heroId}`)
    .then((r) => r.ok ? r.json() : null)
    .then((d) => { if (d) { heroCache[heroId] = d; onDone(d); } })
    .catch(() => {})
    .finally(() => heroFetching.delete(heroId));
}

function fetchSphereMeta(sphereId: string, onDone: (d: SphereMetadata) => void) {
  if (sphereCache[sphereId]) { onDone(sphereCache[sphereId]); return; }
  if (sphereFetching.has(sphereId)) return;
  sphereFetching.add(sphereId);
  fetch(`/api/sphere/metadata/${sphereId}`)
    .then((r) => r.ok ? r.json() : null)
    .then((d) => { if (d) { sphereCache[sphereId] = d; onDone(d); } })
    .catch(() => {})
    .finally(() => sphereFetching.delete(sphereId));
}

function useHeroMeta(heroId: string) {
  const [meta, setMeta] = useState<HeroMetadata | null>(heroCache[heroId] ?? null);
  useEffect(() => { fetchHeroMeta(heroId, setMeta); }, [heroId]);
  return meta;
}

function useSphereMeta(sphereId: string | null) {
  const [meta, setMeta] = useState<SphereMetadata | null>(sphereId ? (sphereCache[sphereId] ?? null) : null);
  useEffect(() => {
    if (!sphereId) { setMeta(null); return; }
    fetchSphereMeta(sphereId, setMeta);
  }, [sphereId]);
  return meta;
}

// ============================================================
// ユーティリティ
// ============================================================
function DifficultyStars({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`w-3 h-3 ${i < level ? 'text-yellow-500 fill-yellow-500' : 'text-neutral-300'}`} />
      ))}
    </div>
  );
}

// ============================================================
// 詳細ポップアップ
// ============================================================
function HeroDetailModal({ heroId, onClose }: { heroId: string; onClose: () => void }) {
  const meta = useHeroMeta(heroId);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="bg-white border-2 border-neutral-900 rounded-xl max-w-sm w-full shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {meta ? (
          <>
            <div className="relative">
              <img src={meta.image} alt="" className="w-full h-48 object-cover" />
              <button onClick={onClose} className="absolute top-2 right-2 bg-white rounded-full p-1 shadow"><X className="w-4 h-4" /></button>
              <span className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">{meta.attributes.rarity}</span>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <p className="font-black text-sm uppercase">{meta.attributes.type_name}</p>
                <p className="text-xs text-neutral-400 font-mono">Lv {meta.attributes.lv}</p>
                {/* デバッグ: 実際のrarity/element値確認用（確認後に削除） */}
                <p className="text-[9px] text-orange-400 font-mono">
                  rarity="{meta.attributes.rarity}" element="{meta.attributes.element ?? meta.attributes.attribute ?? '?'}"
                </p>
              </div>
              <div className="grid grid-cols-3 gap-1 text-[10px] font-mono">
                {([['HP', meta.attributes.hp], ['PHY', meta.attributes.phy], ['INT', meta.attributes.int],
                   ['AGI', meta.attributes.agi], ['SPR', meta.attributes.spr], ['DEF', meta.attributes.def]] as [string, number][]).map(([k, v]) => (
                  <div key={k} className="bg-neutral-50 rounded px-2 py-1 flex justify-between">
                    <span className="text-neutral-400 font-bold">{k}</span>
                    <span className="font-bold">{(v ?? 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              {meta.attributes.brave_burst && (
                <div className="text-xs">
                  <p className="font-black text-purple-700 text-[10px] uppercase mb-0.5">Brave Burst</p>
                  <p className="text-neutral-600 leading-snug">{meta.attributes.brave_burst}</p>
                </div>
              )}
              {meta.attributes.art_skill && (
                <div className="text-xs">
                  <p className="font-black text-pink-700 text-[10px] uppercase mb-0.5">Art Skill</p>
                  <p className="text-neutral-600 leading-snug">{meta.attributes.art_skill}</p>
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

function SphereDetailModal({ sphereId, onClose }: { sphereId: string; onClose: () => void }) {
  const meta = useSphereMeta(sphereId);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="bg-white border-2 border-neutral-900 rounded-xl max-w-xs w-full shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {meta ? (
          <>
            <div className="relative bg-neutral-50 flex items-center justify-center h-36">
              <img src={meta.image} alt="" className="h-full object-contain" />
              <button onClick={onClose} className="absolute top-2 right-2 bg-white rounded-full p-1 shadow"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-3">
              <p className="font-black text-sm uppercase">{meta.attributes.type_name}</p>
              <div className="grid grid-cols-3 gap-1 text-[10px] font-mono">
                {([['HP', meta.attributes.hp], ['PHY', meta.attributes.phy], ['INT', meta.attributes.int],
                   ['AGI', meta.attributes.agi], ['SPR', meta.attributes.spr], ['DEF', meta.attributes.def]] as [string, number][]).map(([k, v]) => (
                  (v ?? 0) > 0 ? (
                    <div key={k} className="bg-blue-50 rounded px-2 py-1 flex justify-between">
                      <span className="text-blue-400 font-bold">{k}</span>
                      <span className="font-bold text-blue-700">+{v}</span>
                    </div>
                  ) : null
                ))}
              </div>
              {meta.attributes.ability_name && (
                <p className="text-xs text-neutral-600">{meta.attributes.ability_name}</p>
              )}
            </div>
          </>
        ) : (
          <div className="h-36 animate-pulse bg-neutral-100" />
        )}
      </div>
    </div>
  );
}

// ============================================================
// 小さいユニットカード
// ============================================================
function UnitMiniCard({ heroId, isSelected, isDisabled, onClick }: {
  heroId: string; isSelected: boolean; isDisabled: boolean; onClick: () => void;
}) {
  const meta = useHeroMeta(heroId);
  const [showDetail, setShowDetail] = useState(false);

  return (
    <>
      <div
        className={`relative border-2 rounded-lg cursor-pointer transition-all select-none ${
          isSelected ? 'border-red-600 bg-red-50'
          : isDisabled ? 'border-neutral-200 opacity-40 cursor-not-allowed'
          : 'border-neutral-300 hover:border-red-400 bg-white hover:bg-neutral-50'
        }`}
        onClick={() => !isDisabled && onClick()}
      >
        {meta && (
          <button className="absolute top-1 right-1 z-10 bg-white/80 rounded-full p-0.5 hover:bg-white"
            onClick={(e) => { e.stopPropagation(); setShowDetail(true); }}>
            <Info className="w-3 h-3 text-neutral-400" />
          </button>
        )}
        {meta?.image ? (
          <img src={meta.image} alt="" className="w-full aspect-square object-cover rounded-t-md" />
        ) : (
          <div className="w-full aspect-square bg-neutral-100 rounded-t-md animate-pulse" />
        )}
        <div className="px-1.5 py-1">
          <p className="text-[10px] font-bold uppercase leading-tight truncate">
            {meta?.attributes?.type_name ?? `#${heroId}`}
          </p>
          {meta?.attributes && (
            <p className="text-[9px] font-mono text-neutral-400">HP {(meta.attributes.hp ?? 0).toLocaleString()}</p>
          )}
        </div>
        {isSelected && (
          <div className="absolute inset-0 rounded-lg pointer-events-none flex items-start justify-start p-1">
            <span className="text-white font-black text-[9px] bg-red-600 px-1 rounded">✓</span>
          </div>
        )}
      </div>
      {showDetail && <HeroDetailModal heroId={heroId} onClose={() => setShowDetail(false)} />}
    </>
  );
}

// ============================================================
// 小さいスフィアカード
// ============================================================
function SphereMiniCard({ sphereId, onClick }: { sphereId: string; onClick: () => void }) {
  const meta = useSphereMeta(sphereId);
  const [showDetail, setShowDetail] = useState(false);

  return (
    <>
      <div
        className="relative border-2 border-neutral-300 rounded-lg cursor-pointer hover:border-blue-500 bg-white hover:bg-blue-50 transition-all"
        onClick={onClick}
      >
        {meta && (
          <button className="absolute top-1 right-1 z-10 bg-white/80 rounded-full p-0.5 hover:bg-white"
            onClick={(e) => { e.stopPropagation(); setShowDetail(true); }}>
            <Info className="w-3 h-3 text-neutral-400" />
          </button>
        )}
        {meta?.image ? (
          <img src={meta.image} alt="" className="w-full aspect-square object-contain p-1" />
        ) : (
          <div className="w-full aspect-square bg-neutral-100 rounded-t-md animate-pulse" />
        )}
        <div className="px-1.5 py-1">
          <p className="text-[10px] font-bold uppercase leading-tight truncate">
            {meta?.attributes?.type_name ?? `#${sphereId}`}
          </p>
          {meta?.attributes && (
            <p className="text-[9px] font-mono text-blue-500">
              {(meta.attributes.hp ?? 0) > 0 ? `HP+${meta.attributes.hp}`
               : (meta.attributes.phy ?? 0) > 0 ? `PHY+${meta.attributes.phy}`
               : (meta.attributes.int ?? 0) > 0 ? `INT+${meta.attributes.int}` : ''}
            </p>
          )}
        </div>
      </div>
      {showDetail && <SphereDetailModal sphereId={sphereId} onClose={() => setShowDetail(false)} />}
    </>
  );
}

// ============================================================
// 選択済みユニット行
// ============================================================
const SKILL_LABELS = ['アート', 'スフィア1', 'スフィア2'];
const SKILL_COLORS = [
  'bg-pink-100 text-pink-700',
  'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700',
];

function SelectedUnitRow({ unit, onSphereClick, onSphereRemove, onRemove, onSkillOrderChange }: {
  unit: SelectedUnit;
  onSphereClick: (slotIdx: number) => void;
  onSphereRemove: (slotIdx: number) => void;
  onRemove: () => void;
  onSkillOrderChange: (newOrders: [number, number, number]) => void;
}) {
  const meta = useHeroMeta(unit.heroId);
  const sphere0Meta = useSphereMeta(unit.sphereIds[0] ?? null);
  const sphere1Meta = useSphereMeta(unit.sphereIds[1] ?? null);
  const sphereMetas = [sphere0Meta, sphere1Meta];

  const moveSkill = (idx: number, dir: -1 | 1) => {
    const newOrders = [...unit.skillOrders] as [number, number, number];
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx > 2) return;
    [newOrders[idx], newOrders[swapIdx]] = [newOrders[swapIdx], newOrders[idx]];
    onSkillOrderChange(newOrders);
  };

  return (
    <div className="border border-neutral-200 rounded-lg bg-white overflow-hidden">
      <div className="flex items-center gap-2 p-2 border-b border-neutral-100">
        <div className="w-9 h-9 flex-shrink-0 rounded overflow-hidden bg-neutral-100">
          {meta?.image ? <img src={meta.image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full animate-pulse bg-neutral-200" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-xs uppercase truncate">{meta?.attributes?.type_name ?? `Unit #${unit.heroId}`}</p>
          {meta?.attributes && <p className="text-[9px] text-neutral-400 font-mono">HP {(meta.attributes.hp ?? 0).toLocaleString()}</p>}
        </div>
        <button onClick={onRemove} className="text-neutral-300 hover:text-red-500 font-bold text-sm px-1">×</button>
      </div>

      {/* スフィアスロット */}
      <div className="flex gap-1.5 px-2 py-1.5">
        {[0, 1].map((slotIdx) => {
          const sId = unit.sphereIds[slotIdx];
          const sMeta = sphereMetas[slotIdx];
          return (
            <div key={slotIdx} className="flex items-center gap-1 flex-1">
              <button
                onClick={() => onSphereClick(slotIdx)}
                className={`flex-1 flex items-center gap-1 text-[10px] font-bold px-1.5 py-1 border rounded transition-colors text-left min-w-0 ${
                  sId ? 'border-blue-400 text-blue-700 bg-blue-50 hover:bg-blue-100'
                      : 'border-dashed border-neutral-300 text-neutral-400 hover:border-blue-400'
                }`}
              >
                {sMeta?.image && (
                  <img src={sMeta.image} alt="" className="w-5 h-5 object-contain flex-shrink-0 rounded" />
                )}
                <span className="truncate">
                  {sMeta?.attributes?.type_name ?? (sId ? `#${sId}` : `＋ S${slotIdx + 1}`)}
                </span>
              </button>
              {sId && <button onClick={() => onSphereRemove(slotIdx)} className="text-neutral-300 hover:text-red-500 text-xs leading-none flex-shrink-0">×</button>}
            </div>
          );
        })}
      </div>

      {/* スキル行動順 */}
      <div className="px-2 pb-2">
        <p className="text-[9px] text-neutral-400 font-bold uppercase mb-1">行動順</p>
        <div className="space-y-0.5">
          {unit.skillOrders.map((skillIdx, orderIdx) => (
            <div key={orderIdx} className="flex items-center gap-1">
              <span className="text-[9px] font-mono text-neutral-400 w-3">{orderIdx + 1}.</span>
              <span className={`flex-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${SKILL_COLORS[skillIdx]}`}>
                {SKILL_LABELS[skillIdx]}
              </span>
              <button onClick={() => moveSkill(orderIdx, -1)} disabled={orderIdx === 0}
                className="p-0.5 text-neutral-400 hover:text-neutral-700 disabled:opacity-20">
                <ArrowUp className="w-3 h-3" />
              </button>
              <button onClick={() => moveSkill(orderIdx, 1)} disabled={orderIdx === 2}
                className="p-0.5 text-neutral-400 hover:text-neutral-700 disabled:opacity-20">
                <ArrowDown className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// メインコンポーネント
// ============================================================
export default function BattlePage() {
  const router = useRouter();
  const params = useParams();
  const stageId = Number(params.id);
  const stage = STAGES.find((s) => s.id === stageId);

  const { data: meData } = useGetV1Me();
  const { data: unitListData, isLoading: isLoadingUnits } = useGetV1MeUnits();
  const { data: sphereListData, isLoading: isLoadingSpheres } = useGetV1MeSpheres();

  const [unitSearch, setUnitSearch] = useState('');
  const [sphereSearch, setSphereSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'party' | 'units' | 'spheres'>('units');

  // フィルター状態
  const [unitRarityFilter, setUnitRarityFilter] = useState<string | null>(null);
  const [unitAttrFilter, setUnitAttrFilter] = useState<string | null>(null);
  const [sphereRarityFilter, setSphereRarityFilter] = useState<string | null>(null);

  // ユニットレアリティ（NFTメタデータのrarity文字列、実際の値確認後に調整）
  const UNIT_RARITIES = ['LL', 'L', 'E', 'R', 'U'] as const;
  // ユニット属性（NFTメタデータの実際のフィールド名・値は確認後に調整）
  const UNIT_ATTRS = [
    { label: '炎', value: 'fire' },
    { label: '水', value: 'water' },
    { label: '樹', value: 'earth' },
    { label: '雷', value: 'thunder' },
    { label: '光', value: 'light' },
    { label: '闇', value: 'dark' },
  ] as const;
  const SPHERE_RARITIES = ['L', 'E', 'R', 'U', 'C'] as const;

  const [selectedUnits, setSelectedUnits] = useState<SelectedUnit[]>([]);
  const maxUnits = 5;

  const [spherePickTarget, setSpherePickTarget] = useState<{ unitIdx: number; slotIdx: number } | null>(null);
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null);
  const [battleError, setBattleError] = useState<string | null>(null);

  // 検索用にキャッシュを定期的に同期
  const [unitMetaSnapshot, setUnitMetaSnapshot] = useState<Record<string, HeroMetadata>>({});
  const [sphereMetaSnapshot, setSphereMetaSnapshot] = useState<Record<string, SphereMetadata>>({});
  useEffect(() => {
    const timer = setInterval(() => {
      const newHero = Object.entries(heroCache).filter(([k]) => !unitMetaSnapshot[k]);
      const newSphere = Object.entries(sphereCache).filter(([k]) => !sphereMetaSnapshot[k]);
      if (newHero.length > 0) setUnitMetaSnapshot((p) => ({ ...p, ...Object.fromEntries(newHero) }));
      if (newSphere.length > 0) setSphereMetaSnapshot((p) => ({ ...p, ...Object.fromEntries(newSphere) }));
    }, 500);
    return () => clearInterval(timer);
  }, [unitMetaSnapshot, sphereMetaSnapshot]);

  const filteredUnits = (unitListData?.units ?? []).filter((id) => {
    const meta = unitMetaSnapshot[id];
    if (unitSearch) {
      const q = unitSearch.toLowerCase();
      if (!(meta?.attributes?.type_name ?? '').toLowerCase().includes(q) && !id.includes(q)) return false;
    }
    if (unitRarityFilter) {
      const r = (meta?.attributes?.rarity ?? '').toLowerCase();
      // 実際のrarity文字列が確認できたらここを調整
      // デバッグ: コンソールに実際値が出るのでそれで確認
      if (!r.includes(unitRarityFilter.toLowerCase())) return false;
    }
    if (unitAttrFilter) {
      const el = (meta?.attributes?.element ?? meta?.attributes?.attribute ?? '').toLowerCase();
      if (!el.includes(unitAttrFilter.toLowerCase())) return false;
    }
    return true;
  });

  const filteredSpheres = (sphereListData?.spheres ?? []).filter((id) => {
    const meta = sphereMetaSnapshot[id];
    if (sphereSearch) {
      const q = sphereSearch.toLowerCase();
      if (!(meta?.attributes?.type_name ?? '').toLowerCase().includes(q) && !id.includes(q)) return false;
    }
    if (sphereRarityFilter) {
      const r = (meta?.attributes?.rarity ?? '').toLowerCase();
      if (!r.includes(sphereRarityFilter.toLowerCase())) return false;
    }
    return true;
  });

  const { mutate: simulateBattle, isPending: isBattling } = usePostV1BattleSimulate({
    mutation: {
      onSuccess: (data) => {
        const res = data as any;
        setBattleResult({
          result: res?.result ?? 2,
          battle_key: res?.battle_key ?? '',
          attacker_taken_damage: res?.attacker_taken_damage ?? 0,
          defender_taken_damage: res?.defender_taken_damage ?? 0,
          player_name: res?.player_name ?? '',
          opponent_name: res?.opponent_name ?? '',
        });
      },
      onError: (err: any) => {
        const detail = err?.response?.data?.message ?? err?.response?.data?.error ?? err?.message ?? 'バトルに失敗しました';
        setBattleError(`[${err?.response?.status ?? 'ERR'}] ${detail}`);
      },
    },
  });

  if (!stage) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 font-bold text-xl mb-4">ステージが見つかりません</p>
          <Button onClick={() => router.push('/stages')}>ステージ選択に戻る</Button>
        </div>
      </div>
    );
  }

  const toggleUnit = (heroId: string) => {
    setSelectedUnits((prev) => {
      const exists = prev.find((u) => u.heroId === heroId);
      if (exists) return prev.filter((u) => u.heroId !== heroId);
      if (prev.length >= maxUnits) return prev;
      return [...prev, { heroId, sphereIds: [null, null], skillOrders: [0, 1, 2] }];
    });
  };

  const assignSphere = (sphereId: string) => {
    if (!spherePickTarget) return;
    const { unitIdx, slotIdx } = spherePickTarget;
    setSelectedUnits((prev) => {
      const next = [...prev];
      const unit = { ...next[unitIdx], sphereIds: [...next[unitIdx].sphereIds] };
      unit.sphereIds[slotIdx] = sphereId;
      next[unitIdx] = unit;
      return next;
    });
    setSpherePickTarget(null);
    setActiveTab('party');
  };

  const removeSphere = (unitIdx: number, slotIdx: number) => {
    setSelectedUnits((prev) => {
      const next = [...prev];
      const unit = { ...next[unitIdx], sphereIds: [...next[unitIdx].sphereIds] };
      unit.sphereIds[slotIdx] = null;
      next[unitIdx] = unit;
      return next;
    });
  };

  const updateSkillOrders = (unitIdx: number, newOrders: [number, number, number]) => {
    setSelectedUnits((prev) => {
      const next = [...prev];
      next[unitIdx] = { ...next[unitIdx], skillOrders: newOrders };
      return next;
    });
  };

  const handleBattle = () => {
    if (!meData?.user) return;
    setBattleError(null);
    const attackerUnits = selectedUnits.map((u, i) => ({
      hero_id: Number(u.heroId),
      position: i + 1,
      extension_ids: u.sphereIds.filter(Boolean).map(Number),
      skill_orders: u.skillOrders,
    }));
    simulateBattle({
      data: {
        attacker_uid: (meData.user as any).uid,
        attacker_units: attackerUnits,
        defender_uid: stage.defender_uid,
        defender_units: stage.defender_units,
      },
    });
  };

  const replayUrl = battleResult?.battle_key
    ? `https://bravefrontierheroes.com/battle/${battleResult.battle_key}?returnUrl=https://brave-four-heroes-arena.vercel.app/stages`
    : null;

  // ---- 結果画面 ----
  if (battleResult) {
    const isWin = battleResult.result === 1;
    const isDraw = battleResult.result === 0;
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6">
          <Card className="cyber-card border-2 border-neutral-900 text-center overflow-hidden">
            <div className={`p-8 ${isWin ? 'bg-yellow-50' : isDraw ? 'bg-neutral-100' : 'bg-red-50'}`}>
              {isWin ? <Trophy className="w-20 h-20 text-yellow-500 mx-auto mb-4" />
               : isDraw ? <Minus className="w-20 h-20 text-neutral-500 mx-auto mb-4" />
               : <Skull className="w-20 h-20 text-red-500 mx-auto mb-4" />}
              <h1 className={`text-5xl font-black uppercase tracking-widest ${isWin ? 'text-yellow-600' : isDraw ? 'text-neutral-600' : 'text-red-600'}`}>
                {isWin ? 'VICTORY!' : isDraw ? 'DRAW' : 'DEFEAT'}
              </h1>
              <p className="text-neutral-500 font-mono mt-2">Stage {stage.id} — {stage.name}</p>
            </div>
            <CardContent className="pt-6 space-y-4 bg-white">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-center">
                  <p className="text-neutral-400 font-bold uppercase text-xs mb-1">受けたダメージ</p>
                  <p className="text-2xl font-black font-mono text-red-600">{(battleResult.attacker_taken_damage ?? 0).toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-neutral-400 font-bold uppercase text-xs mb-1">与えたダメージ</p>
                  <p className="text-2xl font-black font-mono text-green-600">{(battleResult.defender_taken_damage ?? 0).toLocaleString()}</p>
                </div>
              </div>
              {replayUrl && (
                <a href={replayUrl} target="_blank" rel="noopener noreferrer">
                  <Button className="w-full bg-neutral-900 text-white hover:bg-blue-700 font-bold uppercase">
                    <ExternalLink className="w-4 h-4 mr-2" />リプレイを見る
                  </Button>
                </a>
              )}
              <Button variant="outline" className="w-full border-neutral-900 font-bold uppercase" onClick={() => setBattleResult(null)}>
                もう一度挑戦
              </Button>
              <Button variant="ghost" className="w-full font-bold uppercase text-neutral-500" onClick={() => router.push('/stages')}>
                ステージ選択に戻る
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ---- スフィア選択画面 ----
  if (spherePickTarget !== null) {
    return (
      <div className="min-h-screen p-3">
        <div className="max-w-4xl mx-auto space-y-3">
          <div className="flex items-center gap-3 bg-white border-2 border-neutral-900 rounded-xl p-3">
            <Button variant="outline" size="icon" onClick={() => { setSpherePickTarget(null); setActiveTab('party'); }}
              className="border-neutral-900 hover:bg-neutral-900 hover:text-white">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1">
              <h2 className="text-base font-black uppercase">スフィアを選択</h2>
              <p className="text-neutral-500 font-mono text-xs">ユニット{spherePickTarget.unitIdx + 1} — スロット{spherePickTarget.slotIdx + 1}</p>
            </div>
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input type="text" placeholder="検索..." value={sphereSearch} onChange={(e) => setSphereSearch(e.target.value)}
                className="pl-6 pr-3 py-1.5 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-blue-500 w-28" />
            </div>
          </div>
          {isLoadingSpheres ? (
            <p className="text-center text-neutral-500 font-mono py-10">Loading...</p>
          ) : !filteredSpheres.length ? (
            <p className="text-center text-neutral-500 font-mono py-10">スフィアが見つかりません</p>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
              {filteredSpheres.map((sphereId) => (
                <SphereMiniCard key={sphereId} sphereId={sphereId} onClick={() => assignSphere(sphereId)} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================
  // メイン編成画面
  // ============================================================
  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {/* ヘッダー */}
      <div className="bg-white border-b-2 border-neutral-900 px-3 py-2 flex items-center gap-2 sticky top-0 z-10">
        <Button variant="outline" size="icon" onClick={() => router.push('/stages')}
          className="border-neutral-900 hover:bg-neutral-900 hover:text-white flex-shrink-0 w-8 h-8">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-neutral-400 font-mono uppercase">Stage {stage.id}</span>
            <DifficultyStars level={stage.difficulty} />
          </div>
          <h1 className="text-sm font-black text-neutral-900 uppercase tracking-tight truncate">{stage.name}</h1>
        </div>
        <Button
          className="bg-red-700 hover:bg-red-800 text-white font-black uppercase px-4 h-9 flex-shrink-0 disabled:opacity-40 text-xs"
          disabled={selectedUnits.length === 0 || isBattling}
          onClick={handleBattle}
        >
          {isBattling
            ? <span className="animate-pulse">⚔️ 戦闘中...</span>
            : <><Swords className="w-3.5 h-3.5 mr-1" />バトル！</>}
        </Button>
      </div>

      {battleError && <p className="text-red-500 font-bold text-center font-mono text-xs py-1.5 bg-red-50">{battleError}</p>}

      {/* モバイルタブ */}
      <div className="lg:hidden flex border-b border-neutral-200 bg-white">
        {(['party', 'units', 'spheres'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-[11px] font-black uppercase tracking-wide transition-colors ${
              activeTab === tab ? 'border-b-2 border-red-600 text-red-600' : 'text-neutral-400 hover:text-neutral-700'
            }`}>
            {tab === 'party' ? `パーティ (${selectedUnits.length}/${maxUnits})` : tab === 'units' ? 'ユニット' : 'スフィア'}
          </button>
        ))}
      </div>

      {/* 3カラムレイアウト（デスクトップ） */}
      <div className="flex-1 lg:grid lg:grid-cols-[260px_1fr_1fr] lg:overflow-hidden">

        {/* パーティ編成 */}
        <div className={`lg:flex lg:flex-col lg:border-r-2 border-neutral-200 lg:overflow-y-auto ${activeTab !== 'party' ? 'hidden lg:flex' : ''}`}>
          <div className="p-3 space-y-2">
            <p className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">
              パーティ ({selectedUnits.length}/{maxUnits})
            </p>
            {selectedUnits.length === 0 ? (
              <p className="text-neutral-400 font-mono text-xs py-6 text-center border border-dashed border-neutral-200 rounded-lg">
                ユニットを選んでください
              </p>
            ) : (
              <div className="space-y-2">
                {selectedUnits.map((u, unitIdx) => (
                  <SelectedUnitRow
                    key={u.heroId}
                    unit={u}
                    onSphereClick={(slotIdx) => setSpherePickTarget({ unitIdx, slotIdx })}
                    onSphereRemove={(slotIdx) => removeSphere(unitIdx, slotIdx)}
                    onRemove={() => toggleUnit(u.heroId)}
                    onSkillOrderChange={(newOrders) => updateSkillOrders(unitIdx, newOrders)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ユニット一覧 */}
        <div className={`lg:flex lg:flex-col lg:border-r-2 border-neutral-200 lg:overflow-y-auto ${activeTab !== 'units' ? 'hidden lg:flex' : ''}`}>
          <div className="p-3 space-y-2">
            {/* 検索 */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input type="text" placeholder="ユニット検索..." value={unitSearch} onChange={(e) => setUnitSearch(e.target.value)}
                className="w-full pl-8 pr-8 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-red-400 bg-white" />
              {unitSearch && <button onClick={() => setUnitSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-3 h-3 text-neutral-400" /></button>}
            </div>
            {/* レアリティフィルター */}
            <div className="flex gap-1 flex-wrap">
              {UNIT_RARITIES.map((r) => (
                <button key={r} onClick={() => setUnitRarityFilter(unitRarityFilter === r ? null : r)}
                  className={`text-[10px] font-black px-2 py-0.5 rounded border transition-colors ${
                    unitRarityFilter === r ? 'bg-neutral-900 text-white border-neutral-900' : 'border-neutral-300 text-neutral-500 hover:border-neutral-500'
                  }`}>
                  {r}
                </button>
              ))}
            </div>
            {/* 属性フィルター（画像は後で差し替え、今はテキスト） */}
            <div className="flex gap-1 flex-wrap">
              {UNIT_ATTRS.map((a) => (
                <button key={a.value} onClick={() => setUnitAttrFilter(unitAttrFilter === a.value ? null : a.value)}
                  className={`text-[10px] font-black px-2 py-0.5 rounded border transition-colors ${
                    unitAttrFilter === a.value ? 'bg-neutral-900 text-white border-neutral-900' : 'border-neutral-300 text-neutral-500 hover:border-neutral-500'
                  }`}>
                  {a.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-neutral-400 font-mono">{filteredUnits.length}体</p>
            {isLoadingUnits ? (
              <div className="grid grid-cols-3 gap-2">{Array.from({ length: 9 }).map((_, i) => <div key={i} className="aspect-square bg-neutral-100 rounded animate-pulse" />)}</div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {filteredUnits.map((heroId) => {
                  const isSelected = selectedUnits.some((u) => u.heroId === heroId);
                  const isDisabled = !isSelected && selectedUnits.length >= maxUnits;
                  return (
                    <UnitMiniCard key={heroId} heroId={heroId} isSelected={isSelected} isDisabled={isDisabled}
                      onClick={() => { toggleUnit(heroId); if (!isSelected) setActiveTab('party'); }} />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* スフィア一覧 */}
        <div className={`lg:flex lg:flex-col lg:overflow-y-auto ${activeTab !== 'spheres' ? 'hidden lg:flex' : ''}`}>
          <div className="p-3 space-y-2">
            {/* 検索 */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input type="text" placeholder="スフィア検索..." value={sphereSearch} onChange={(e) => setSphereSearch(e.target.value)}
                className="w-full pl-8 pr-8 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-blue-400 bg-white" />
              {sphereSearch && <button onClick={() => setSphereSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-3 h-3 text-neutral-400" /></button>}
            </div>
            {/* レアリティフィルター */}
            <div className="flex gap-1 flex-wrap">
              {SPHERE_RARITIES.map((r) => (
                <button key={r} onClick={() => setSphereRarityFilter(sphereRarityFilter === r ? null : r)}
                  className={`text-[10px] font-black px-2 py-0.5 rounded border transition-colors ${
                    sphereRarityFilter === r ? 'bg-neutral-900 text-white border-neutral-900' : 'border-neutral-300 text-neutral-500 hover:border-neutral-500'
                  }`}>
                  {r}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-neutral-400 font-mono">{filteredSpheres.length}個 — パーティタブのスロットから装備</p>
            {isLoadingSpheres ? (
              <div className="grid grid-cols-3 gap-2">{Array.from({ length: 9 }).map((_, i) => <div key={i} className="aspect-square bg-neutral-100 rounded animate-pulse" />)}</div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {filteredSpheres.map((sphereId) => (
                  <SphereMiniCard key={sphereId} sphereId={sphereId} onClick={() => {}} />
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
