'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { saveClearRecord } from '@/src/lib/clearRecords';
import { Card, CardContent } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { DifficultyStars } from '@/src/components/ui/difficulty-stars';
import { ChevronLeft, Swords, Crown, Skull, Minus, ExternalLink, Search, X } from 'lucide-react';
import { STAGES } from '@/src/config/stages';
import { useGetV1Me } from '@/src/api/generated/user/user';
import { useGetV1MeUnits, useGetV1MeSpheres } from '@/src/api/generated/assets/assets';
import { usePostV1Heroes } from '@/src/api/generated/hero/hero';
import { usePostV1Spheres } from '@/src/api/generated/sphere/sphere';
import { usePostV1BattleSimulate } from '@/src/api/generated/battle/battle';
import { useGetV1DeckTemplates } from '@/src/api/generated/deck/deck';

import type { HeroGameData, SphereGameData, SelectedUnit, BattleResult, DeckTemplate } from '@/src/types/battle';
import { UNIT_ATTR_MAP, UNIT_ATTR_IDS, UNIT_RARITY_MAP, UNIT_RARITY_FILTERS, SPHERE_RARITY_FILTERS, SPHERE_RARITY_MAP } from '@/src/lib/battle/constants';
import { heroMetaCache, fetchHeroMeta } from '@/src/lib/battle/cache';

import { FilterBtn } from '@/src/components/battle/ui';
import { useHeroMeta } from '@/src/components/battle/HeroDetailModal';
import { UnitMiniCard } from '@/src/components/battle/UnitMiniCard';
import { SphereMiniCard } from '@/src/components/battle/SphereMiniCard';
import { SelectedUnitRow } from '@/src/components/battle/SelectedUnitRow';
import { DeckTemplateList } from '@/src/components/battle/DeckCard';
import { toFastUnitImageUrl } from '@/src/lib/battle/imageUrl';

// ============================================================
// スワップモーダル内のユニット行
// ============================================================
function SwapUnitRow({ unit, slotIdx, onSelect }: {
  unit: SelectedUnit;
  slotIdx: number;
  onSelect: () => void;
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
// メインコンポーネント
// ============================================================
export default function BattlePage() {
  const router = useRouter();
  const params = useParams();
  const stageId = Number(params.id);
  const stage = STAGES.find(s => s.id === stageId);

  // ---- API フック ----
  const { data: meData } = useGetV1Me();
  const { data: unitListData, isLoading: isLoadingUnits } = useGetV1MeUnits();
  const { data: sphereListData, isLoading: isLoadingSpheres } = useGetV1MeSpheres();
  const { data: deckData, isLoading: isLoadingDecks } = useGetV1DeckTemplates();

  // ---- ゲームデータ（rarity/attribute） ----
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

  // ---- デッキ内ユニットのプリフェッチ ----
  const allDeckHeroIds = useMemo(() => {
    const allDecks: DeckTemplate[] = [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...((deckData as any)?.deck_templates ?? []),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...((deckData as any)?.quest_deck_templates ?? []),
    ];
    return [...new Set(allDecks.flatMap(d => d.units.map(u => String(u.hero_id))))];
  }, [deckData]);

  // ---- デッキ内スフィアのプリフェッチ ----
  const allDeckSphereIds = useMemo(() => {
    const allDecks: DeckTemplate[] = [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...((deckData as any)?.deck_templates ?? []),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...((deckData as any)?.quest_deck_templates ?? []),
    ];
    return [...new Set(
      allDecks.flatMap(d => d.units.flatMap(u => u.extension_ids))
        .filter((id): id is number => !!id && id !== 0)
        .map(String)
    )];
  }, [deckData]);

  const deckSphereFetchedRef = useRef(false);
  useEffect(() => {
    if (deckSphereFetchedRef.current || allDeckSphereIds.length === 0) return;
    // まだ sphereGameMap にないIDだけ fetch する
    const missing = allDeckSphereIds.filter(id => !sphereGameMap[id]);
    if (missing.length === 0) return;
    deckSphereFetchedRef.current = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fetchSphereGameData({ data: { sphere_ids: missing.map(Number) } } as any);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDeckSphereIds]);

  useEffect(() => {
    if (allDeckHeroIds.length === 0) return;
    let idx = 0;
    const CONCURRENCY = 5;
    let active = 0;
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
  const [unitSearch,   setUnitSearch]   = useState('');
  const [sphereSearch, setSphereSearch] = useState('');
  const [activeTab,    setActiveTab]    = useState<'party' | 'units' | 'spheres' | 'decks'>('decks');
  const [unitRarity,   setUnitRarity]   = useState<string | null>(null);
  const [unitAttr,     setUnitAttr]     = useState<number | null>(null);
  const [sphereRarity, setSphereRarity] = useState<string | null>(null);

  // ---- パーティ状態 ----
  const maxUnits = 5;
  const [partySlots, setPartySlots] = useState<(SelectedUnit | null)[]>(Array(maxUnits).fill(null));
  const selectedUnits = partySlots.filter((u): u is SelectedUnit => u !== null);
  const [spherePickTarget, setSpherePickTarget] = useState<{ unitIdx: number; slotIdx: number } | null>(null);
  const [unitPickSlot, setUnitPickSlot] = useState<number | null>(null);
  const [swapHeroId,  setSwapHeroId]   = useState<string | null>(null);
  const [reorderMode, setReorderMode]  = useState(false);
  const [reorderFirstIdx, setReorderFirstIdx] = useState<number | null>(null);

  // ---- バトル状態 ----
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null);
  const [battleError,  setBattleError]  = useState<string | null>(null);

  // ---- NFTキャッシュ定期同期（検索のため） ----
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [unitMetaSnap, setUnitMetaSnap] = useState<Record<string, any>>({});
  useEffect(() => {
    const t = setInterval(() => {
      const nh = Object.entries(heroMetaCache).filter(([k]) => !unitMetaSnap[k]);
      if (nh.length) setUnitMetaSnap(p => ({ ...p, ...Object.fromEntries(nh) }));
    }, 500);
    return () => clearInterval(t);
  }, [unitMetaSnap]);

  // ---- フィルター済みリスト ----
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
  }).sort((a, b) => {
    const ra = heroGameMap[a]?.rarity ?? 0;
    const rb = heroGameMap[b]?.rarity ?? 0;
    return rb - ra; // レアリティ高い順
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
  }).sort((a, b) => {
    const ra = sphereGameMap[a]?.rarity ?? 0;
    const rb = sphereGameMap[b]?.rarity ?? 0;
    return rb - ra; // レアリティ高い順
  });

  // ---- バトルシミュレーション ----
  const { mutate: simulateBattle, isPending: isBattling } = usePostV1BattleSimulate({
    mutation: {
      onSuccess: (data) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res = data as any;
        const result: number = res?.result ?? 2;
        setBattleResult({
          result,
          battle_key:            res?.battle_key            ?? '',
          attacker_taken_damage: res?.attacker_taken_damage ?? 0,
          defender_taken_damage: res?.defender_taken_damage ?? 0,
          action_counts:         res?.action_counts         ?? 0,
          player_name:           res?.player_name           ?? '',
          opponent_name:         res?.opponent_name         ?? '',
        });
        const outcome = result === 1 ? 'WIN' : result === 0 ? 'DRAW' : 'LOSE';
        saveClearRecord(stageId, outcome);
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onError: (err: any) => {
        const detail = err?.response?.data?.message ?? err?.response?.data?.error ?? err?.message ?? 'バトルに失敗しました';
        setBattleError(`[${err?.response?.status ?? 'ERR'}] ${detail}`);
      },
    },
  });

  // ---- ステージ未存在 ----
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

  // ---- アクション ----
  const assignUnitToSlot = (heroId: string, targetSlot?: number) => {
    setPartySlots(prev => {
      const next = [...prev];
      const existingIdx = next.findIndex(u => u?.heroId === heroId);
      if (existingIdx !== -1) { next[existingIdx] = null; return next; }
      const slot = targetSlot ?? next.findIndex(u => u === null);
      if (slot === -1 || slot >= maxUnits) return prev;
      const prev_unit = next[slot];
      next[slot] = {
        heroId,
        sphereIds:   prev_unit ? [...prev_unit.sphereIds]   : [null, null],
        skillOrders: prev_unit ? [...prev_unit.skillOrders] as [number,number,number] : [0, 1, 2],
      };
      return next;
    });
    setUnitPickSlot(null);
  };

  const removeUnitFromSlot = (slotIdx: number) => {
    setPartySlots(prev => { const next = [...prev]; next[slotIdx] = null; return next; });
  };

  const loadDeckTemplate = (deck: DeckTemplate) => {
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
    const allSphereIds = sorted.flatMap(u => u.extension_ids).filter(id => id && id !== 0 && !sphereGameMap[String(id)]);
    if (allSphereIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fetchSphereGameData({ data: { sphere_ids: allSphereIds } } as any);
    }
    setPartySlots(next);
    setActiveTab('party');
  };

  const toggleUnit = (heroId: string) => {
    const inParty = partySlots.some(u => u?.heroId === heroId);
    if (inParty) {
      setPartySlots(prev => prev.map(u => u?.heroId === heroId ? null : u));
    } else {
      assignUnitToSlot(heroId, unitPickSlot ?? undefined);
    }
  };

  const assignSphere = (sphereId: string) => {
    if (!spherePickTarget) return;
    const { unitIdx: partySlotIdx, slotIdx } = spherePickTarget;
    setPartySlots(prev => {
      const next = [...prev];
      const unit = next[partySlotIdx];
      if (!unit) return prev;
      const updated = { ...unit, sphereIds: [...unit.sphereIds] };
      updated.sphereIds[slotIdx] = sphereId;
      next[partySlotIdx] = updated;
      return next;
    });
    setSpherePickTarget(null);
    setActiveTab('party');
  };

  const removeSphere = (partySlotIdx: number, slotIdx: number) => {
    setPartySlots(prev => {
      const next = [...prev];
      const unit = next[partySlotIdx];
      if (!unit) return prev;
      const updated = { ...unit, sphereIds: [...unit.sphereIds] };
      updated.sphereIds[slotIdx] = null;
      next[partySlotIdx] = updated;
      return next;
    });
  };

  const handleReorderTap = (partySlotIdx: number) => {
    if (reorderFirstIdx === null) {
      setReorderFirstIdx(partySlotIdx);
    } else if (reorderFirstIdx === partySlotIdx) {
      setReorderFirstIdx(null);
    } else {
      setPartySlots(prev => {
        const next = [...prev];
        [next[reorderFirstIdx], next[partySlotIdx]] = [next[partySlotIdx], next[reorderFirstIdx]];
        return next;
      });
      setReorderFirstIdx(null);
    }
  };

  const updateSkillOrders = (partySlotIdx: number, newOrders: [number, number, number]) => {
    setPartySlots(prev => {
      const next = [...prev];
      const unit = next[partySlotIdx];
      if (!unit) return prev;
      next[partySlotIdx] = { ...unit, skillOrders: newOrders };
      return next;
    });
  };

  const handleBattle = () => {
    if (!meData?.user) return;
    setBattleError(null);
    const attackerUnits = selectedUnits.map((u, i) => ({
      hero_id:       Number(u.heroId),
      position:      i + 1,
      extension_ids: u.sphereIds.filter(Boolean).map(Number),
      skill_orders:  u.skillOrders,
    }));
    simulateBattle({
      data: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        attacker_uid:   (meData.user as any).uid,
        attacker_units: attackerUnits,
        defender_uid:   stage.defender_uid,
        defender_units: stage.defender_units,
      },
    });
  };

  const replayUrl = battleResult?.battle_key
    ? `https://bravefrontierheroes.com/ja/battle/${battleResult.battle_key}?returnUrl=https://brave-four-heroes-arena.vercel.app/stages`
    : null;

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
               :          <Skull className="w-20 h-20 text-red-500    mx-auto mb-4" />}
              <h1 className={`text-5xl font-black uppercase tracking-widest ${isWin ? 'text-yellow-600' : isDraw ? 'text-neutral-600' : 'text-red-600'}`}>
                {isWin ? 'WIN' : isDraw ? 'DRAW' : 'LOSE'}
              </h1>
              <p className="text-neutral-500 font-mono mt-2">Stage {stage.id} — {stage.name}</p>
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
              {replayUrl && (
                <Button
                  className="w-full bg-neutral-900 text-white hover:bg-blue-700 font-bold uppercase"
                  onClick={() => window.open(replayUrl, '_blank', 'noopener,noreferrer')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />戦闘を見る
                </Button>
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

  // ============================================================
  // スフィア選択画面
  // ============================================================
  if (spherePickTarget !== null) {
    return (
      <div className="min-h-screen p-3">
        <div className="max-w-4xl mx-auto space-y-3">
          <div className="flex items-center gap-3 bg-white border-2 border-neutral-900 rounded-xl p-3">
            <Button
              variant="outline" size="icon"
              onClick={() => { setSpherePickTarget(null); setActiveTab('party'); }}
              className="cyber-button border-neutral-900 text-neutral-900 hover:bg-neutral-900 hover:text-white flex-shrink-0 w-8 h-8"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1">
              <h2 className="text-base font-black uppercase">スフィアを選択</h2>
              <p className="text-neutral-500 font-mono text-xs">
                ユニット{spherePickTarget.unitIdx + 1} — スロット{spherePickTarget.slotIdx + 1}
              </p>
            </div>
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text" placeholder="検索..." value={sphereSearch}
                onChange={e => setSphereSearch(e.target.value)}
                className="pl-6 pr-3 py-1.5 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-blue-500 w-28"
              />
            </div>
          </div>
          <div className="flex gap-1.5 flex-wrap px-1">
            {SPHERE_RARITY_FILTERS.map(r => (
              <FilterBtn key={r} label={r} active={sphereRarity === r} onClick={() => setSphereRarity(sphereRarity === r ? null : r)} />
            ))}
          </div>
          {isLoadingSpheres ? (
            <p className="text-center text-neutral-500 font-mono py-10">Loading...</p>
          ) : !filteredSpheres.length ? (
            <p className="text-center text-neutral-500 font-mono py-10">スフィアが見つかりません</p>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
              {filteredSpheres.map(id => (
                <SphereMiniCard key={id} gameData={sphereGameMap[id]} onClick={() => assignSphere(id)} />
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
    <div className="battle-layout bg-neutral-50 flex flex-col" style={{ position: 'fixed', inset: 0 }}>
      {/* ヘッダー */}
      <div className="bg-white border-b-2 border-neutral-900 px-3 py-2 flex items-center gap-2 sticky top-0 z-10">
        <Button
          variant="outline" size="icon"
          onClick={() => router.push('/stages')}
          className="cyber-button border-neutral-900 text-neutral-900 hover:bg-neutral-900 hover:text-white flex-shrink-0 w-8 h-8"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-neutral-400 font-mono uppercase">Stage {stage.id}</span>
            <DifficultyStars level={stage.difficulty} size="sm" />
          </div>
          <h1 className="text-sm font-black text-neutral-900 uppercase tracking-tight truncate">{stage.name}</h1>
        </div>
        <Button
          className="!bg-red-700 hover:!bg-red-800 !text-white font-black uppercase px-4 h-9 flex-shrink-0 disabled:opacity-40 text-xs"
          disabled={selectedUnits.length === 0 || isBattling}
          onClick={handleBattle}
        >
          {isBattling
            ? <span className="animate-pulse">⚔️ 戦闘中...</span>
            : <><Swords className="w-3.5 h-3.5 mr-1" />バトル！</>}
        </Button>
      </div>

      {battleError && (
        <p className="text-red-500 font-bold text-center font-mono text-xs py-1.5 bg-red-50">{battleError}</p>
      )}

      {/* 5体満員・入れ替えモーダル */}
      {swapHeroId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4" onClick={() => setSwapHeroId(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-xl w-full max-w-sm shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-4 pt-4 pb-2 border-b border-neutral-100">
              <p className="text-xs font-black uppercase text-neutral-400">入れ替え先を選択</p>
              <p className="text-[10px] text-neutral-400 font-mono mt-0.5">タップしたユニットと入れ替えます</p>
            </div>
            <div className="p-3 space-y-1.5">
              {partySlots.map((u, slotIdx) => {
                if (!u) return null;
                return (
                  <SwapUnitRow
                    key={slotIdx} unit={u} slotIdx={slotIdx}
                    onSelect={() => { assignUnitToSlot(swapHeroId, slotIdx); setSwapHeroId(null); }}
                  />
                );
              })}
            </div>
            <div className="px-3 pb-3">
              <button onClick={() => setSwapHeroId(null)} className="w-full py-2 text-xs font-black text-neutral-400 hover:text-neutral-700 border border-neutral-200 rounded-lg">
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
            className={`flex-1 py-2 text-[11px] font-black uppercase tracking-wide transition-colors ${
              activeTab === tab ? 'border-b-2 border-red-600 text-red-600' : 'text-neutral-400 hover:text-neutral-700'
            }`}>
            {tab === 'party'    ? `パーティ (${selectedUnits.length}/${maxUnits})`
             : tab === 'units'   ? 'ユニット'
             : tab === 'spheres' ? 'スフィア'
             : 'パーティ一覧'}
          </button>
        ))}
      </div>

      {/* 4カラム — PCは固定高さグリッド、各カラム内でスクロール */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col lg:grid lg:grid-cols-[260px_1fr_1fr_220px]">

        {/* ── パーティ ── */}
        <div className={`flex-col border-r-2 border-neutral-200 min-h-0 overflow-hidden ${activeTab !== 'party' ? 'hidden lg:flex lg:flex-none' : 'flex flex-1'}`}>
          <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">
                パーティ ({selectedUnits.length}/{maxUnits})
              </p>
              {selectedUnits.length >= 2 && !unitPickSlot && (
                <button
                  onClick={() => { setReorderMode(r => !r); setReorderFirstIdx(null); }}
                  className={`text-[10px] font-black px-2.5 py-1 rounded-lg border transition-all ${
                    reorderMode
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'border-neutral-300 text-neutral-500 hover:border-neutral-500'
                  }`}
                >
                  {reorderMode ? '✓ 完了' : '⇅ 並び替え'}
                </button>
              )}
            </div>
            <div className="space-y-2">
              {partySlots.map((u, slotIdx) => {
                if (u) {
                  return (
                    <SelectedUnitRow
                      key={u.heroId} unit={u}
                      onSphereClick={si => { if (!reorderMode) setSpherePickTarget({ unitIdx: slotIdx, slotIdx: si }); }}
                      onSphereRemove={si => { if (!reorderMode) removeSphere(slotIdx, si); }}
                      onRemove={() => { if (!reorderMode) removeUnitFromSlot(slotIdx); }}
                      onSkillOrderChange={orders => updateSkillOrders(slotIdx, orders)}
                      reorderMode={reorderMode}
                      isReorderSelected={reorderFirstIdx === slotIdx}
                      onReorderTap={() => handleReorderTap(slotIdx)}
                      onUnitReselect={() => { setUnitPickSlot(slotIdx); setActiveTab('units'); }}
                      sphereGameData={u.sphereIds.map(sid => sid ? sphereGameMap[sid] : undefined)}
                    />
                  );
                }
                return (
                  <button
                    key={`empty-${slotIdx}`}
                    onClick={() => { if (!reorderMode) { setUnitPickSlot(slotIdx); setActiveTab('units'); } }}
                    className="w-full border-2 border-dashed border-neutral-300 rounded-lg py-3 flex items-center gap-3 px-3 hover:border-red-400 hover:bg-red-50 transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-full border-2 border-dashed border-neutral-300 flex items-center justify-center group-hover:border-red-400 flex-shrink-0">
                      <span className="text-neutral-400 text-lg font-black group-hover:text-red-500">＋</span>
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
        </div>

        {/* ── ユニット一覧 ── */}
        <div className={`flex-col border-r-2 border-neutral-200 min-h-0 overflow-hidden ${activeTab !== 'units' ? 'hidden lg:flex lg:flex-none' : 'flex flex-1'}`}>
          <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input type="text" placeholder="名前 / BB名で検索..." value={unitSearch}
                onChange={e => setUnitSearch(e.target.value)}
                className="w-full pl-8 pr-8 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-red-400 bg-white"
              />
              {unitSearch && (
                <button onClick={() => setUnitSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="w-3 h-3 text-neutral-400" />
                </button>
              )}
            </div>
            <div className="flex gap-1 flex-wrap">
              {UNIT_RARITY_FILTERS.map(r => (
                <FilterBtn key={r} label={r} active={unitRarity === r} onClick={() => setUnitRarity(unitRarity === r ? null : r)} />
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
              <div className="bg-red-50 border border-red-300 rounded-lg px-3 py-1.5 flex items-center justify-between">
                <p className="text-xs font-black text-red-700">位置 {unitPickSlot + 1} にセット</p>
                <button onClick={() => setUnitPickSlot(null)} className="text-red-400 hover:text-red-600">
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
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {filteredUnits.map(heroId => {
                  const isSelected = selectedUnits.some(u => u.heroId === heroId);
                  return (
                    <UnitMiniCard
                      key={heroId} heroId={heroId} isSelected={isSelected} isDisabled={false}
                      gameData={heroGameMap[heroId]}
                      onClick={() => {
                        if (isSelected) {
                          toggleUnit(heroId);
                        } else if (selectedUnits.length >= maxUnits) {
                          setSwapHeroId(heroId);
                          setActiveTab('party');
                        } else {
                          assignUnitToSlot(heroId, unitPickSlot ?? undefined);
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
        <div className={`flex-col border-r-2 border-neutral-200 min-h-0 overflow-hidden ${activeTab !== 'spheres' ? 'hidden lg:flex lg:flex-none' : 'flex flex-1'}`}>
          <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input type="text" placeholder="スフィア検索..." value={sphereSearch}
                onChange={e => setSphereSearch(e.target.value)}
                className="w-full pl-8 pr-8 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-blue-400 bg-white"
              />
              {sphereSearch && (
                <button onClick={() => setSphereSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="w-3 h-3 text-neutral-400" />
                </button>
              )}
            </div>
            <div className="flex gap-1 flex-wrap">
              {SPHERE_RARITY_FILTERS.map(r => (
                <FilterBtn key={r} label={r} active={sphereRarity === r} onClick={() => setSphereRarity(sphereRarity === r ? null : r)} />
              ))}
            </div>
            <p className="text-[10px] text-neutral-400 font-mono">
              {filteredSpheres.length}個 — パーティタブのスロットから装備
            </p>
            {isLoadingSpheres ? (
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="aspect-square bg-neutral-100 rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {filteredSpheres.map(id => (
                  <SphereMiniCard key={id} gameData={sphereGameMap[id]} onClick={() => {}} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── デッキテンプレート ── */}
        <div className={`flex-col border-l-2 border-neutral-200 min-h-0 overflow-hidden ${activeTab !== 'decks' ? 'hidden lg:flex lg:flex-none' : 'flex flex-1'}`}>
          <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-2">
            <p className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">パーティ一覧</p>
            <p className="text-[9px] text-neutral-400 font-mono">読み込むと編成に反映されます</p>
            {isLoadingDecks ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 bg-neutral-100 rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <DeckTemplateList
                deckTemplates={(deckData as any)?.deck_templates ?? []}
                questDeckTemplates={(deckData as any)?.quest_deck_templates ?? []}
                sphereGameMap={sphereGameMap}
                onLoad={loadDeckTemplate}
              />
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
