'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import {
  ChevronLeft, Swords, Crown, Skull, Minus,
  ExternalLink, Search, X, Sword, Shield, Copy, Check,
} from 'lucide-react';
import { useGetV1Me } from '@/src/api/generated/user/user';
import { useGetV1MeUnits, useGetV1MeSpheres } from '@/src/api/generated/assets/assets';
import { usePostV1Heroes } from '@/src/api/generated/hero/hero';
import { usePostV1Spheres } from '@/src/api/generated/sphere/sphere';
import { usePostV1BattleSimulate } from '@/src/api/generated/battle/battle';
import { useGetV1DeckTemplates } from '@/src/api/generated/deck/deck';

import type { HeroGameData, SphereGameData, SelectedUnit, BattleResult, DeckTemplate } from '@/src/types/battle';
import {
  UNIT_ATTR_MAP, UNIT_ATTR_IDS,
  UNIT_RARITY_MAP, UNIT_RARITY_FILTERS,
  SPHERE_RARITY_FILTERS, SPHERE_RARITY_MAP,
} from '@/src/lib/battle/constants';
import { heroMetaCache, fetchHeroMeta } from '@/src/lib/battle/cache';
import { FilterBtn } from '@/src/components/battle/ui';
import { useHeroMeta } from '@/src/components/battle/HeroDetailModal';
import { UnitMiniCard } from '@/src/components/battle/UnitMiniCard';
import { SphereMiniCard } from '@/src/components/battle/SphereMiniCard';
import { SelectedUnitRow } from '@/src/components/battle/SelectedUnitRow';
import { toFastUnitImageUrl } from '@/src/lib/battle/imageUrl';

// ============================================================
// シミュレータ用デッキカード（味方/敵反映ボタン付き）
// ============================================================
function SimDeckUnitIcon({ heroId }: { heroId: string }) {
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
  void tick;
  const meta = heroMetaCache[heroId] ?? null;
  return (
    <div className="w-7 h-7 rounded overflow-hidden bg-neutral-100 flex-shrink-0 border border-neutral-200">
      {meta?.image
        ? <img src={toFastUnitImageUrl(meta.image)} alt="" className="w-full h-full object-cover" />
        : <div className="w-full h-full animate-pulse bg-neutral-200" />}
    </div>
  );
}

interface SimDeckCardProps {
  deck: DeckTemplate;
  label: string;
  onLoadAlly: (deck: DeckTemplate) => void;
  onLoadEnemy: (deck: DeckTemplate) => void;
}

function SimDeckCard({ deck, label, onLoadAlly, onLoadEnemy }: SimDeckCardProps) {
  const sorted = [...deck.units].sort((a, b) => a.position - b.position);
  return (
    <div className="border-2 border-neutral-200 rounded-lg p-2 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black text-neutral-500 uppercase">{label}</span>
        <span className="text-[9px] font-mono text-neutral-400">{sorted.length}体</span>
      </div>
      <div className="flex gap-1 flex-wrap">
        {sorted.map((u, i) => (
          <SimDeckUnitIcon key={i} heroId={String(u.hero_id)} />
        ))}
      </div>
      {/* 反映ボタン */}
      <div className="flex gap-1.5 pt-0.5">
        <button
          onClick={() => onLoadAlly(deck)}
          className="flex-1 flex items-center justify-center gap-1 text-[10px] font-black py-1.5 rounded-lg border-2 border-blue-400 text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
        >
          <Sword className="w-3 h-3" />味方に反映
        </button>
        <button
          onClick={() => onLoadEnemy(deck)}
          className="flex-1 flex items-center justify-center gap-1 text-[10px] font-black py-1.5 rounded-lg border-2 border-red-400 text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
        >
          <Shield className="w-3 h-3" />敵に反映
        </button>
      </div>
    </div>
  );
}

interface SimDeckListProps {
  deckTemplates: DeckTemplate[];
  questDeckTemplates: DeckTemplate[];
  onLoadAlly: (deck: DeckTemplate) => void;
  onLoadEnemy: (deck: DeckTemplate) => void;
}

function SimDeckList({ deckTemplates, questDeckTemplates, onLoadAlly, onLoadEnemy }: SimDeckListProps) {
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
            <SimDeckCard key={deck.jin_id} deck={deck} label={`パーティ ${i + 1}`}
              onLoadAlly={onLoadAlly} onLoadEnemy={onLoadEnemy} />
          ))}
        </div>
      )}
      {questDeckTemplates.length > 0 && (
        <div className="space-y-2">
          <p className="text-[9px] font-black text-neutral-400 uppercase">クエストパーティ</p>
          {questDeckTemplates.map((deck, i) => (
            <SimDeckCard key={deck.jin_id} deck={deck} label={`クエストパーティ ${i + 1}`}
              onLoadAlly={onLoadAlly} onLoadEnemy={onLoadEnemy} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// スワップモーダル内ユニット行
// ============================================================
function SwapUnitRow({ unit, slotIdx, onSelect }: {
  unit: SelectedUnit; slotIdx: number; onSelect: () => void;
}) {
  const m = useHeroMeta(unit.heroId);
  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-200 hover:border-red-400 hover:bg-red-50 transition-colors text-left"
    >
      <div className="w-8 h-8 flex-shrink-0 rounded overflow-hidden bg-neutral-100">
        {m?.image
          ? <img src={toFastUnitImageUrl(m.image)} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-neutral-200 animate-pulse" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold uppercase truncate">
          {m?.attributes?.type_name ?? `Unit #${unit.heroId}`}
        </p>
        <p className="text-[9px] text-neutral-400 font-mono">スロット {slotIdx + 1}</p>
      </div>
      <span className="text-[10px] font-black text-red-500">入替</span>
    </button>
  );
}

// ============================================================
// パーティパネル（味方/敵共通）
// ============================================================
interface PartyPanelProps {
  side: 'ally' | 'enemy';
  partySlots: (SelectedUnit | null)[];
  sphereGameMap: Record<string, SphereGameData>;
  reorderMode: boolean;
  reorderFirstIdx: number | null;
  onUnitPickSlotSet: (slotIdx: number) => void;
  onSpherePickSet: (target: { unitIdx: number; slotIdx: number }) => void;
  onRemove: (slotIdx: number) => void;
  onSpherRemove: (partySlotIdx: number, slotIdx: number) => void;
  onSkillOrderChange: (partySlotIdx: number, orders: [number, number, number]) => void;
  onReorderTap: (slotIdx: number) => void;
  onReorderToggle: () => void;
}

function PartyPanel({
  side, partySlots, sphereGameMap,
  reorderMode, reorderFirstIdx,
  onUnitPickSlotSet, onSpherePickSet, onRemove, onSpherRemove,
  onSkillOrderChange, onReorderTap, onReorderToggle,
}: PartyPanelProps) {
  const maxUnits = 5;
  const selectedUnits = partySlots.filter((u): u is SelectedUnit => u !== null);
  const isAlly = side === 'ally';
  const accentCls = isAlly
    ? 'bg-blue-50 border-blue-200'
    : 'bg-red-50 border-red-200';
  const labelCls = isAlly ? 'text-blue-700' : 'text-red-700';
  const emptyBorderCls = isAlly
    ? 'border-blue-200 hover:border-blue-400 hover:bg-blue-100'
    : 'border-red-200 hover:border-red-400 hover:bg-red-100';
  const emptyPlusCls = isAlly ? 'text-blue-300 group-hover:text-blue-500' : 'text-red-300 group-hover:text-red-500';
  const emptyCircleCls = isAlly ? 'border-blue-200 group-hover:border-blue-400' : 'border-red-200 group-hover:border-red-400';

  return (
    <div className={`rounded-xl border-2 ${accentCls} p-3 space-y-2`}>
      {/* セクションヘッダー */}
      <div className="flex items-center justify-between">
        <p className={`text-[11px] font-black uppercase tracking-wider ${labelCls}`}>
          <span className="flex items-center gap-1">
            {isAlly
              ? <Sword className="w-3 h-3" />
              : <Shield className="w-3 h-3" />}
            {isAlly ? '味方' : '敵'} ({selectedUnits.length}/{maxUnits})
          </span>
        </p>
        {selectedUnits.length >= 2 && (
          <button
            onClick={onReorderToggle}
            className={`text-[10px] font-black px-2.5 py-1 rounded-lg border transition-all ${
              reorderMode
                ? 'bg-orange-500 text-white border-orange-500'
                : 'border-neutral-300 text-neutral-500 hover:border-neutral-500'
            }`}
          >
            {reorderMode ? '✓ 完了' : '⇅ 並替'}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {partySlots.map((u, slotIdx) => {
          if (u) {
            return (
              <SelectedUnitRow
                key={u.heroId} unit={u}
                onSphereClick={si => { if (!reorderMode) onSpherePickSet({ unitIdx: slotIdx, slotIdx: si }); }}
                onSphereRemove={si => { if (!reorderMode) onSpherRemove(slotIdx, si); }}
                onRemove={() => { if (!reorderMode) onRemove(slotIdx); }}
                onSkillOrderChange={orders => onSkillOrderChange(slotIdx, orders)}
                reorderMode={reorderMode}
                isReorderSelected={reorderFirstIdx === slotIdx}
                onReorderTap={() => onReorderTap(slotIdx)}
                onUnitReselect={() => onUnitPickSlotSet(slotIdx)}
                sphereGameData={u.sphereIds.map(sid => sid ? sphereGameMap[sid] : undefined)}
              />
            );
          }
          return (
            <button
              key={`empty-${slotIdx}`}
              onClick={() => { if (!reorderMode) onUnitPickSlotSet(slotIdx); }}
              className={`w-full border-2 border-dashed ${emptyBorderCls} rounded-lg py-3 flex items-center gap-3 px-3 transition-colors group`}
            >
              <div className={`w-9 h-9 rounded-full border-2 border-dashed ${emptyCircleCls} flex items-center justify-center flex-shrink-0`}>
                <span className={`text-lg font-black ${emptyPlusCls}`}>＋</span>
              </div>
              <div className="text-left">
                <p className="text-xs font-black text-neutral-400 uppercase">位置 {slotIdx + 1}</p>
                <p className="text-[10px] text-neutral-300 font-mono">タップしてユニット選択</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// メインページ
// ============================================================
export default function SimulatorPage() {
  const router = useRouter();

  // ---- API ----
  const { data: meData } = useGetV1Me();
  const { data: unitListData, isLoading: isLoadingUnits } = useGetV1MeUnits();
  const { data: sphereListData, isLoading: isLoadingSpheres } = useGetV1MeSpheres();
  const { data: deckData, isLoading: isLoadingDecks } = useGetV1DeckTemplates();

  // ---- ゲームデータ ----
  const [heroGameMap, setHeroGameMap]     = useState<Record<string, HeroGameData>>({});
  const [sphereGameMap, setSphereGameMap] = useState<Record<string, SphereGameData>>({});

  const { mutate: fetchHeroGameData } = usePostV1Heroes({
    mutation: {
      onSuccess: (data) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const datas: HeroGameData[] = (data as any)?.heroes?.hero_datas ?? [];
        const map: Record<string, HeroGameData> = {};
        datas.forEach(h => { map[String(h.hero_id)] = h; });
        setHeroGameMap(map);
      },
    },
  });

  const { mutate: fetchSphereGameData } = usePostV1Spheres({
    mutation: {
      onSuccess: (data) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const datas: SphereGameData[] = (data as any)?.spheres?.extension_datas ?? [];
        const map: Record<string, SphereGameData> = {};
        datas.forEach(s => { map[String(s.extension_id)] = s; });
        setSphereGameMap(prev => ({ ...prev, ...map }));
      },
    },
  });

  const heroFetchedRef   = useRef(false);
  const sphereFetchedRef = useRef(false);

  useEffect(() => {
    const units = unitListData?.units ?? [];
    if (heroFetchedRef.current || units.length === 0) return;
    heroFetchedRef.current = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fetchHeroGameData({ data: { hero_ids: units.map(Number) } } as any);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitListData?.units]);

  useEffect(() => {
    const spheres = sphereListData?.spheres ?? [];
    if (sphereFetchedRef.current || spheres.length === 0) return;
    sphereFetchedRef.current = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fetchSphereGameData({ data: { sphere_ids: spheres.map(Number) } } as any);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sphereListData?.spheres]);

  // ---- デッキプリフェッチ ----
  const allDeckHeroIds = useMemo(() => {
    const allDecks: DeckTemplate[] = [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...((deckData as any)?.deck_templates ?? []),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...((deckData as any)?.quest_deck_templates ?? []),
    ];
    return [...new Set(allDecks.flatMap(d => d.units.map(u => String(u.hero_id))))];
  }, [deckData]);

  useEffect(() => {
    if (allDeckHeroIds.length === 0) return;
    let idx = 0; const CONCURRENCY = 5; let active = 0;
    function next() {
      while (active < CONCURRENCY && idx < allDeckHeroIds.length) {
        const id = allDeckHeroIds[idx++];
        if (heroMetaCache[id]) { next(); return; }
        active++;
        fetchHeroMeta(id, () => { active--; next(); });
      }
    }
    next();
  }, [allDeckHeroIds]);

  // ---- UI 状態 ----
  // タブ: モバイルは全タブ、PCは asset/deck タブ
  const [activeTab, setActiveTab] = useState<'party' | 'units' | 'spheres' | 'decks'>('decks');

  const [unitSearch,   setUnitSearch]   = useState('');
  const [sphereSearch, setSphereSearch] = useState('');
  const [unitRarity,   setUnitRarity]   = useState<string | null>(null);
  const [unitAttr,     setUnitAttr]     = useState<number | null>(null);
  const [sphereRarity, setSphereRarity] = useState<string | null>(null);

  // ---- パーティ状態（味方・敵） ----
  const maxUnits = 5;
  const [allySlots,  setAllySlots]  = useState<(SelectedUnit | null)[]>(Array(maxUnits).fill(null));
  const [enemySlots, setEnemySlots] = useState<(SelectedUnit | null)[]>(Array(maxUnits).fill(null));

  // どちらのサイドを編集中か
  const [editingSide,     setEditingSide]     = useState<'ally' | 'enemy'>('ally');
  const [unitPickSlot,    setUnitPickSlot]     = useState<number | null>(null);
  const [spherePickTarget, setSpherePickTarget] = useState<{ unitIdx: number; slotIdx: number } | null>(null);
  const [swapHeroId,      setSwapHeroId]       = useState<string | null>(null);

  // 並べ替えモード（味方/敵それぞれ）
  const [allyReorderMode,   setAllyReorderMode]   = useState(false);
  const [allyReorderFirst,  setAllyReorderFirst]  = useState<number | null>(null);
  const [enemyReorderMode,  setEnemyReorderMode]  = useState(false);
  const [enemyReorderFirst, setEnemyReorderFirst] = useState<number | null>(null);

  // ---- バトル状態 ----
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null);
  const [battleError,  setBattleError]  = useState<string | null>(null);
  const [urlCopied,    setUrlCopied]    = useState(false);

  // ---- キャッシュスナップ（検索用） ----
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [unitMetaSnap, setUnitMetaSnap] = useState<Record<string, any>>({});
  useEffect(() => {
    const t = setInterval(() => {
      const nh = Object.entries(heroMetaCache).filter(([k]) => !unitMetaSnap[k]);
      if (nh.length) setUnitMetaSnap(p => ({ ...p, ...Object.fromEntries(nh) }));
    }, 500);
    return () => clearInterval(t);
  }, [unitMetaSnap]);

  // ---- フィルター ----
  const filteredUnits = (unitListData?.units ?? []).filter(id => {
    if (unitSearch) {
      const q = unitSearch.toLowerCase();
      const n = (unitMetaSnap[id]?.attributes?.type_name ?? heroGameMap[id]?.name ?? '').toLowerCase();
      const bb = (unitMetaSnap[id]?.attributes?.brave_burst ?? '').toLowerCase();
      if (!n.includes(q) && !bb.includes(q) && !id.includes(q)) return false;
    }
    const gd = heroGameMap[id];
    if (unitRarity && gd && UNIT_RARITY_MAP[gd.rarity] !== unitRarity) return false;
    if (unitAttr  && gd && gd.attribute !== unitAttr) return false;
    return true;
  });

  const filteredSpheres = (sphereListData?.spheres ?? []).filter(id => {
    if (sphereSearch) {
      const q = sphereSearch.toLowerCase();
      const n = (sphereGameMap[id]?.name_jp || sphereGameMap[id]?.name || '').toLowerCase();
      if (!n.includes(q) && !id.includes(q)) return false;
    }
    if (sphereRarity) {
      const gd = sphereGameMap[id];
      if (gd && SPHERE_RARITY_MAP[gd.rarity] !== sphereRarity) return false;
    }
    return true;
  });

  // ---- バトルAPI ----
  const { mutate: simulateBattle, isPending: isBattling } = usePostV1BattleSimulate({
    mutation: {
      onSuccess: (data) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res = data as any;
        setBattleResult({
          result:                res?.result                ?? 2,
          battle_key:            res?.battle_key            ?? '',
          attacker_taken_damage: res?.attacker_taken_damage ?? 0,
          defender_taken_damage: res?.defender_taken_damage ?? 0,
          action_counts:         res?.action_counts         ?? 0,
          player_name:           res?.player_name           ?? '',
          opponent_name:         res?.opponent_name         ?? '',
        });
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onError: (err: any) => {
        const detail = err?.response?.data?.message ?? err?.response?.data?.error ?? err?.message ?? 'バトルに失敗しました';
        setBattleError(`[${err?.response?.status ?? 'ERR'}] ${detail}`);
      },
    },
  });

  // ---- パーティ操作ヘルパー ----
  const makeSlotSetter = (setter: React.Dispatch<React.SetStateAction<(SelectedUnit | null)[]>>) => ({
    assign: (heroId: string, targetSlot?: number) => {
      setter(prev => {
        const next = [...prev];
        const existingIdx = next.findIndex(u => u?.heroId === heroId);
        if (existingIdx !== -1) { next[existingIdx] = null; return next; }
        const slot = targetSlot ?? next.findIndex(u => u === null);
        if (slot === -1 || slot >= maxUnits) return prev;
        const pv = next[slot];
        next[slot] = {
          heroId,
          sphereIds:   pv ? [...pv.sphereIds]   : [null, null],
          skillOrders: pv ? [...pv.skillOrders] as [number,number,number] : [0, 1, 2],
        };
        return next;
      });
      setUnitPickSlot(null);
    },
    remove: (slotIdx: number) => {
      setter(prev => { const n = [...prev]; n[slotIdx] = null; return n; });
    },
    assignSphere: (slotIdx: number, sphereId: string, unitIdx: number) => {
      setter(prev => {
        const n = [...prev]; const u = n[unitIdx];
        if (!u) return prev;
        const upd = { ...u, sphereIds: [...u.sphereIds] };
        upd.sphereIds[slotIdx] = sphereId;
        n[unitIdx] = upd; return n;
      });
    },
    removeSphere: (unitIdx: number, slotIdx: number) => {
      setter(prev => {
        const n = [...prev]; const u = n[unitIdx];
        if (!u) return prev;
        const upd = { ...u, sphereIds: [...u.sphereIds] };
        upd.sphereIds[slotIdx] = null;
        n[unitIdx] = upd; return n;
      });
    },
    updateSkill: (unitIdx: number, orders: [number,number,number]) => {
      setter(prev => {
        const n = [...prev]; const u = n[unitIdx];
        if (!u) return prev;
        n[unitIdx] = { ...u, skillOrders: orders }; return n;
      });
    },
    reorderSwap: (setter2: React.Dispatch<React.SetStateAction<(SelectedUnit | null)[]>>, a: number, b: number) => {
      setter2(prev => {
        const n = [...prev];
        [n[a], n[b]] = [n[b], n[a]];
        return n;
      });
    },
  });

  const allySetter  = makeSlotSetter(setAllySlots);
  const enemySetter = makeSlotSetter(setEnemySlots);

  const activeSetter = editingSide === 'ally' ? allySetter : enemySetter;
  const activeSlots  = editingSide === 'ally' ? allySlots  : enemySlots;

  // デッキテンプレートをパーティに読み込む
  const loadDeck = (deck: DeckTemplate, side: 'ally' | 'enemy') => {
    const setter = side === 'ally' ? setAllySlots : setEnemySlots;
    const next: (SelectedUnit | null)[] = Array(maxUnits).fill(null);
    const sorted = [...deck.units].sort((a, b) => a.position - b.position).slice(0, maxUnits);
    sorted.forEach((u, i) => {
      const sphereIds: [string | null, string | null] = [
        u.extension_ids[0] != null ? String(u.extension_ids[0]) : null,
        u.extension_ids[1] != null ? String(u.extension_ids[1]) : null,
      ];
      const skillOrders = (u.skill_orders?.length === 3 ? u.skill_orders : [0, 1, 2]) as [number, number, number];
      next[i] = { heroId: String(u.hero_id), sphereIds, skillOrders };
    });
    const allSphereIds = sorted.flatMap(u => u.extension_ids)
      .filter(id => id && id !== 0 && !sphereGameMap[String(id)]);
    if (allSphereIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fetchSphereGameData({ data: { sphere_ids: allSphereIds } } as any);
    }
    setter(next);
    // モバイルでは対応タブへ移動
    setActiveTab('party');
  };

  const handleBattle = () => {
    if (!meData?.user) return;
    setBattleError(null);
    const allyUnits  = allySlots.filter((u): u is SelectedUnit => u !== null);
    const enemyUnits = enemySlots.filter((u): u is SelectedUnit => u !== null);
    if (allyUnits.length === 0 || enemyUnits.length === 0) {
      setBattleError('味方と敵の両方にユニットを設定してください');
      return;
    }
    simulateBattle({
      data: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        attacker_uid: (meData.user as any).uid,
        attacker_units: allyUnits.map((u, i) => ({
          hero_id:       Number(u.heroId),
          position:      i + 1,
          extension_ids: u.sphereIds.filter(Boolean).map(Number),
          skill_orders:  u.skillOrders,
        })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        defender_uid: (meData.user as any).uid,
        defender_units: enemyUnits.map((u, i) => ({
          hero_id:       Number(u.heroId),
          position:      i + 1,
          extension_ids: u.sphereIds.filter(Boolean).map(Number),
          skill_orders:  u.skillOrders,
        })),
      },
    });
  };

  const replayUrl = battleResult?.battle_key
    ? `https://bravefrontierheroes.com/ja/battle/${battleResult.battle_key}?returnUrl=https://brave-four-heroes-arena.vercel.app/simulator`
    : null;

  const allyCount  = allySlots.filter(Boolean).length;
  const enemyCount = enemySlots.filter(Boolean).length;

  // ============================================================
  // 結果画面
  // ============================================================
  if (battleResult) {
    const isWin  = battleResult.result === 1;
    const isDraw = battleResult.result === 0;
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6">
          <Card className="cyber-card border-2 border-neutral-900 text-center overflow-hidden">
            <div className={`p-8 ${isWin ? 'bg-yellow-50' : isDraw ? 'bg-neutral-100' : 'bg-red-50'}`}>
              {isWin  ? <Crown  className="w-20 h-20 text-yellow-500 mx-auto mb-4" />
               : isDraw ? <Minus className="w-20 h-20 text-neutral-500 mx-auto mb-4" />
               :          <Skull className="w-20 h-20 text-red-500 mx-auto mb-4" />}
              <h1 className={`text-5xl font-black uppercase tracking-widest ${isWin ? 'text-yellow-600' : isDraw ? 'text-neutral-600' : 'text-red-600'}`}>
                {isWin ? '味方の勝ち' : isDraw ? 'DRAW' : '敵の勝ち'}
              </h1>
            </div>
            <CardContent className="pt-6 space-y-4 bg-white">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="text-center">
                  <p className="text-neutral-400 font-bold uppercase text-xs mb-1">受けたダメージ</p>
                  <p className="text-2xl font-black font-mono text-red-600">
                    {(battleResult.attacker_taken_damage ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-neutral-400 font-bold uppercase text-xs mb-1">与えたダメージ</p>
                  <p className="text-2xl font-black font-mono text-green-600">
                    {(battleResult.defender_taken_damage ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-neutral-400 font-bold uppercase text-xs mb-1">アクション数</p>
                  <p className="text-2xl font-black font-mono text-neutral-700">{battleResult.action_counts}</p>
                </div>
              </div>
              {/* 戦闘URL ボタン群 */}
              {replayUrl && (
                <div className="space-y-2">
                  {/* 戦闘を見る */}
                  <a href={replayUrl} target="_blank" rel="noopener noreferrer">
                    <Button className="w-full bg-neutral-900 text-white hover:bg-neutral-700 font-bold uppercase">
                      <ExternalLink className="w-4 h-4 mr-2" />戦闘を見る
                    </Button>
                  </a>
                  {/* URLコピー */}
                  <Button
                    variant="outline"
                    className={`w-full font-bold uppercase transition-colors ${
                      urlCopied
                        ? 'border-green-500 text-green-600 bg-green-50 hover:bg-green-50'
                        : 'border-neutral-300 text-neutral-600 hover:border-neutral-500'
                    }`}
                    onClick={() => {
                      navigator.clipboard.writeText(replayUrl).then(() => {
                        setUrlCopied(true);
                        setTimeout(() => setUrlCopied(false), 2500);
                      });
                    }}
                  >
                    {urlCopied
                      ? <><Check className="w-4 h-4 mr-2" />コピーしました</>
                      : <><Copy className="w-4 h-4 mr-2" />戦闘URLをコピー</>}
                  </Button>
                </div>
              )}
              {/* 編成に戻る */}
              <Button
                className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold uppercase mt-2"
                onClick={() => setBattleResult(null)}
              >
                編成画面に戻る
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ============================================================
  // スフィア選択画面
  // ============================================================
  if (spherePickTarget !== null) {
    return (
      <div className="min-h-screen p-3">
        <div className="max-w-4xl mx-auto space-y-3">
          <div className="flex items-center gap-3 bg-white border-2 border-neutral-900 rounded-xl p-3">
            <Button variant="outline" size="icon"
              onClick={() => { setSpherePickTarget(null); setActiveTab('party'); }}
              className="cyber-button border-neutral-900 text-neutral-900 hover:bg-neutral-900 hover:text-white flex-shrink-0 w-8 h-8">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1">
              <h2 className="text-base font-black uppercase">スフィアを選択</h2>
              <p className="text-neutral-500 font-mono text-xs">
                {editingSide === 'ally' ? '味方' : '敵'} — ユニット{spherePickTarget.unitIdx + 1} スロット{spherePickTarget.slotIdx + 1}
              </p>
            </div>
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input type="text" placeholder="検索..." value={sphereSearch}
                onChange={e => setSphereSearch(e.target.value)}
                className="pl-6 pr-3 py-1.5 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-blue-500 w-28" />
            </div>
          </div>
          <div className="flex gap-1.5 flex-wrap px-1">
            {SPHERE_RARITY_FILTERS.map(r => (
              <FilterBtn key={r} label={r} active={sphereRarity === r}
                onClick={() => setSphereRarity(sphereRarity === r ? null : r)} />
            ))}
          </div>
          {isLoadingSpheres ? (
            <p className="text-center text-neutral-500 font-mono py-10">Loading...</p>
          ) : !filteredSpheres.length ? (
            <p className="text-center text-neutral-500 font-mono py-10">スフィアが見つかりません</p>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
              {filteredSpheres.map(id => (
                <SphereMiniCard key={id} gameData={sphereGameMap[id]} onClick={() => {
                  activeSetter.assignSphere(spherePickTarget.slotIdx, id, spherePickTarget.unitIdx);
                  setSpherePickTarget(null);
                  setActiveTab('party');
                }} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================
  // メイン画面
  // ============================================================
  return (
    <div className="bg-neutral-50 flex flex-col" style={{ position: 'fixed', inset: 0 }}>

      {/* ヘッダー */}
      <div className="bg-white border-b-2 border-neutral-900 px-3 py-2 flex items-center gap-2 sticky top-0 z-10">
        <Button variant="outline" size="icon" onClick={() => router.push('/dashboard')}
          className="cyber-button border-neutral-900 text-neutral-900 hover:bg-neutral-900 hover:text-white flex-shrink-0 w-8 h-8">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-black text-neutral-900 uppercase tracking-tight">おれ vs おれ</h1>
          <p className="text-[10px] text-neutral-400 font-mono">テンプレパーティバトルシミュレータ</p>
        </div>
        <Button
          className="!bg-violet-700 hover:!bg-violet-800 !text-white font-black uppercase px-4 h-9 flex-shrink-0 disabled:opacity-40 text-xs"
          disabled={(allyCount === 0 || enemyCount === 0) || isBattling}
          onClick={handleBattle}
        >
          {isBattling
            ? <span className="animate-pulse flex items-center gap-1"><Swords className="w-3.5 h-3.5 mr-1" />戦闘中...</span>
            : <><Swords className="w-3.5 h-3.5 mr-1" />バトル！</>}
        </Button>
      </div>

      {battleError && (
        <p className="text-red-500 font-bold text-center font-mono text-xs py-1.5 bg-red-50">{battleError}</p>
      )}

      {/* 入れ替えモーダル */}
      {swapHeroId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
          onClick={() => setSwapHeroId(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-xl w-full max-w-sm shadow-xl overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="px-4 pt-4 pb-2 border-b border-neutral-100">
              <p className="text-xs font-black uppercase text-neutral-400">
                {editingSide === 'ally' ? '味方' : '敵'} — 入れ替え先を選択
              </p>
            </div>
            <div className="p-3 space-y-1.5">
              {activeSlots.map((u, slotIdx) => {
                if (!u) return null;
                return (
                  <SwapUnitRow key={slotIdx} unit={u} slotIdx={slotIdx}
                    onSelect={() => {
                      activeSetter.assign(swapHeroId, slotIdx);
                      setSwapHeroId(null);
                    }} />
                );
              })}
            </div>
            <div className="px-3 pb-3">
              <button onClick={() => setSwapHeroId(null)}
                className="w-full py-2 text-xs font-black text-neutral-400 hover:text-neutral-700 border border-neutral-200 rounded-lg">
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* モバイルタブ */}
      <div className="lg:hidden flex border-b border-neutral-200 bg-white">
        {(['party', 'units', 'spheres', 'decks'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wide transition-colors ${
              activeTab === tab ? 'border-b-2 border-violet-600 text-violet-600' : 'text-neutral-400 hover:text-neutral-700'
            }`}>
            {tab === 'party'    ? `味方/敵(${allyCount}+${enemyCount})`
             : tab === 'units'   ? 'ユニット'
             : tab === 'spheres' ? 'スフィア'
             : 'パーティ一覧'}
          </button>
        ))}
      </div>

      {/* ── メインレイアウト ── */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col lg:grid lg:grid-cols-[1fr_260px_260px_260px]">

        {/* ── 左: 味方 + 敵 パーティ ── */}
        <div className={`flex-col min-h-0 overflow-hidden border-r-2 border-neutral-200 ${
          activeTab === 'party' ? 'flex flex-1' : 'hidden lg:flex lg:flex-none'
        }`}>
          <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-3">
            {/* 味方 */}
            <PartyPanel
              side="ally"
              partySlots={allySlots}
              sphereGameMap={sphereGameMap}
              reorderMode={allyReorderMode}
              reorderFirstIdx={allyReorderFirst}
              onUnitPickSlotSet={slotIdx => {
                setEditingSide('ally');
                setUnitPickSlot(slotIdx);
                setActiveTab('units');
              }}
              onSpherePickSet={target => {
                setEditingSide('ally');
                setSpherePickTarget(target);
              }}
              onRemove={slotIdx => allySetter.remove(slotIdx)}
              onSpherRemove={(ui, si) => allySetter.removeSphere(ui, si)}
              onSkillOrderChange={(ui, orders) => allySetter.updateSkill(ui, orders)}
              onReorderTap={slotIdx => {
                if (allyReorderFirst === null) {
                  setAllyReorderFirst(slotIdx);
                } else if (allyReorderFirst === slotIdx) {
                  setAllyReorderFirst(null);
                } else {
                  allySetter.reorderSwap(setAllySlots, allyReorderFirst, slotIdx);
                  setAllyReorderFirst(null);
                }
              }}
              onReorderToggle={() => { setAllyReorderMode(r => !r); setAllyReorderFirst(null); }}
            />
            {/* 敵 */}
            <PartyPanel
              side="enemy"
              partySlots={enemySlots}
              sphereGameMap={sphereGameMap}
              reorderMode={enemyReorderMode}
              reorderFirstIdx={enemyReorderFirst}
              onUnitPickSlotSet={slotIdx => {
                setEditingSide('enemy');
                setUnitPickSlot(slotIdx);
                setActiveTab('units');
              }}
              onSpherePickSet={target => {
                setEditingSide('enemy');
                setSpherePickTarget(target);
              }}
              onRemove={slotIdx => enemySetter.remove(slotIdx)}
              onSpherRemove={(ui, si) => enemySetter.removeSphere(ui, si)}
              onSkillOrderChange={(ui, orders) => enemySetter.updateSkill(ui, orders)}
              onReorderTap={slotIdx => {
                if (enemyReorderFirst === null) {
                  setEnemyReorderFirst(slotIdx);
                } else if (enemyReorderFirst === slotIdx) {
                  setEnemyReorderFirst(null);
                } else {
                  enemySetter.reorderSwap(setEnemySlots, enemyReorderFirst, slotIdx);
                  setEnemyReorderFirst(null);
                }
              }}
              onReorderToggle={() => { setEnemyReorderMode(r => !r); setEnemyReorderFirst(null); }}
            />
          </div>
        </div>

        {/* ── 中: ユニット/スフィア（タブ切替） ── */}
        <div className={`flex-col min-h-0 overflow-hidden border-r-2 border-neutral-200 ${
          activeTab === 'units' ? 'flex flex-1' : 'hidden lg:flex lg:flex-none'
        }`}>
          {/* ユニット一覧 */}
          <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-2">
            {/* 編集中サイド表示 */}
            <div className={`text-[10px] font-black px-2 py-1 rounded-lg ${
              editingSide === 'ally' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
            }`}>
              {editingSide === 'ally' ? '味方に追加中' : '敵に追加中'}
              <span className="ml-2 text-neutral-400 font-normal">（パーティのユニット枠をタップで変更）</span>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input type="text" placeholder="名前 / BB名で検索..." value={unitSearch}
                onChange={e => setUnitSearch(e.target.value)}
                className="w-full pl-8 pr-8 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-violet-400 bg-white" />
              {unitSearch && (
                <button onClick={() => setUnitSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="w-3 h-3 text-neutral-400" />
                </button>
              )}
            </div>
            <div className="flex gap-1 flex-wrap">
              {UNIT_RARITY_FILTERS.map(r => (
                <FilterBtn key={r} label={r} active={unitRarity === r}
                  onClick={() => setUnitRarity(unitRarity === r ? null : r)} />
              ))}
            </div>
            <div className="flex gap-1 flex-wrap">
              {UNIT_ATTR_IDS.map(a => {
                const info = UNIT_ATTR_MAP[a];
                return (
                  <FilterBtn key={a} label={info.label} active={unitAttr === a} tw={info.tw}
                    onClick={() => setUnitAttr(unitAttr === a ? null : a)} />
                );
              })}
            </div>
            {unitPickSlot !== null && (
              <div className={`rounded-lg px-3 py-1.5 flex items-center justify-between border ${
                editingSide === 'ally' ? 'bg-blue-50 border-blue-300' : 'bg-red-50 border-red-300'
              }`}>
                <p className={`text-xs font-black ${editingSide === 'ally' ? 'text-blue-700' : 'text-red-700'}`}>
                  {editingSide === 'ally' ? '味方' : '敵'} 位置 {unitPickSlot + 1} にセット
                </p>
                <button onClick={() => setUnitPickSlot(null)}
                  className="text-neutral-400 hover:text-neutral-600">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <p className="text-[10px] text-neutral-400 font-mono">{filteredUnits.length}体</p>
            {isLoadingUnits ? (
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="aspect-square bg-neutral-100 rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 xl:grid-cols-4 gap-2">
                {filteredUnits.map(heroId => {
                  const activeParty = editingSide === 'ally' ? allySlots : enemySlots;
                  const isSelected = activeParty.some(u => u?.heroId === heroId);
                  const activeCount = activeParty.filter(Boolean).length;
                  return (
                    <UnitMiniCard
                      key={heroId} heroId={heroId} isSelected={isSelected} isDisabled={false}
                      gameData={heroGameMap[heroId]}
                      onClick={() => {
                        if (isSelected) {
                          const setter = editingSide === 'ally' ? setAllySlots : setEnemySlots;
                          setter(prev => prev.map(u => u?.heroId === heroId ? null : u));
                        } else if (activeCount >= maxUnits) {
                          setSwapHeroId(heroId);
                          setActiveTab('party');
                        } else {
                          activeSetter.assign(heroId, unitPickSlot ?? undefined);
                          setActiveTab('party');
                        }
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* ── スフィア一覧 ── */}
        <div className={`flex-col min-h-0 overflow-hidden border-r-2 border-neutral-200 ${
          activeTab === 'spheres' ? 'flex flex-1' : 'hidden lg:flex lg:flex-none'
        }`}>
          <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input type="text" placeholder="スフィア検索..." value={sphereSearch}
                onChange={e => setSphereSearch(e.target.value)}
                className="w-full pl-8 pr-8 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-violet-400 bg-white" />
              {sphereSearch && (
                <button onClick={() => setSphereSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="w-3 h-3 text-neutral-400" />
                </button>
              )}
            </div>
            <div className="flex gap-1 flex-wrap">
              {SPHERE_RARITY_FILTERS.map(r => (
                <FilterBtn key={r} label={r} active={sphereRarity === r}
                  onClick={() => setSphereRarity(sphereRarity === r ? null : r)} />
              ))}
            </div>
            <p className="text-[10px] text-neutral-400 font-mono">
              {filteredSpheres.length}個 — パーティのスフィア枠から装備
            </p>
            {isLoadingSpheres ? (
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="aspect-square bg-neutral-100 rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 xl:grid-cols-4 gap-2">
                {filteredSpheres.map(id => (
                  <SphereMiniCard key={id} gameData={sphereGameMap[id]} onClick={() => {}} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── 右: パーティ一覧（デッキテンプレート） ── */}
        <div className={`flex-col min-h-0 overflow-hidden ${
          activeTab === 'decks' ? 'flex flex-1' : 'hidden lg:flex lg:flex-none'
        }`}>
          <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-2">
            <p className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">パーティ一覧</p>
            <p className="text-[9px] text-neutral-400 font-mono">「味方に反映」「敵に反映」で編成に読み込みます</p>
            {isLoadingDecks ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-20 bg-neutral-100 rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <SimDeckList
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                deckTemplates={(deckData as any)?.deck_templates ?? []}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                questDeckTemplates={(deckData as any)?.quest_deck_templates ?? []}
                onLoadAlly={deck => loadDeck(deck, 'ally')}
                onLoadEnemy={deck => loadDeck(deck, 'enemy')}
              />
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
