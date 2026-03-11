'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { ChevronLeft, Swords, Star, Trophy, Skull, Minus, ExternalLink } from 'lucide-react';
import { STAGES } from '@/src/config/stages';
import { useGetV1Me } from '@/src/api/generated/user/user';
import { useGetV1MeUnits, useGetV1MeSpheres } from '@/src/api/generated/assets/assets';
import { usePostV1BattleSimulate } from '@/src/api/generated/battle/battle';

// ---- 型定義 ----
interface HeroMetadata {
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
    ability_name: string;
  };
}

type BattleResult = {
  result: number; // 0=DRAW, 1=WIN, 2=LOSE
  battle_key: string;
  attacker_taken_damage: number;
  defender_taken_damage: number;
  player_name: string;
  opponent_name: string;
};

// ---- 自己fetchするユニットカード ----
function UnitSelectCard({
  heroId,
  isSelected,
  isDisabled,
  onClick,
}: {
  heroId: string;
  isSelected: boolean;
  isDisabled: boolean;
  onClick: () => void;
}) {
  const [meta, setMeta] = useState<HeroMetadata | null>(null);

  useEffect(() => {
    fetch(`/api/hero/metadata/${heroId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setMeta(d))
      .catch(() => {});
  }, [heroId]);

  return (
    <Card
      className={`cyber-card border-2 cursor-pointer transition-all ${
        isSelected
          ? 'border-red-600 bg-red-50 scale-[0.97]'
          : isDisabled
          ? 'border-neutral-200 opacity-40 cursor-not-allowed'
          : 'border-neutral-900 hover:border-red-400 hover:bg-neutral-50'
      }`}
      onClick={() => !isDisabled && onClick()}
    >
      <CardContent className="p-3 space-y-2">
        {meta?.image ? (
          <img src={meta.image} alt="" className="w-full h-20 object-cover rounded" />
        ) : (
          <div className="w-full h-20 bg-neutral-100 rounded animate-pulse" />
        )}
        <p className="font-bold text-xs uppercase text-center leading-tight truncate">
          {meta?.attributes?.type_name ?? `Unit #${heroId}`}
        </p>
        {meta?.attributes && (
          <div className="text-[10px] font-mono text-neutral-500 space-y-0.5">
            <p>HP {(meta.attributes.hp ?? 0).toLocaleString()}</p>
            <p>Lv {meta.attributes.lv ?? 1}</p>
          </div>
        )}
        {isSelected && (
          <p className="text-[10px] font-black text-red-600 uppercase text-center">✓ 選択中</p>
        )}
      </CardContent>
    </Card>
  );
}

// ---- 自己fetchするスフィアカード ----
function SphereSelectCard({
  sphereId,
  onClick,
}: {
  sphereId: string;
  onClick: () => void;
}) {
  const [meta, setMeta] = useState<SphereMetadata | null>(null);

  useEffect(() => {
    fetch(`/api/sphere/metadata/${sphereId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setMeta(d))
      .catch(() => {});
  }, [sphereId]);

  return (
    <Card
      className="cyber-card border-2 border-neutral-900 cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all"
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-2">
        {meta?.image ? (
          <img src={meta.image} alt="" className="w-full h-20 object-contain" />
        ) : (
          <div className="w-full h-20 bg-neutral-100 rounded animate-pulse" />
        )}
        <p className="font-bold text-xs uppercase text-center leading-tight">
          {meta?.attributes?.type_name ?? `Sphere #${sphereId}`}
        </p>
        {meta?.attributes && (
          <div className="text-[10px] font-mono text-neutral-500 space-y-0.5">
            {(meta.attributes.hp ?? 0) > 0 && <p>HP +{meta.attributes.hp}</p>}
            {(meta.attributes.phy ?? 0) > 0 && <p>PHY +{meta.attributes.phy}</p>}
            {(meta.attributes.int ?? 0) > 0 && <p>INT +{meta.attributes.int}</p>}
            {(meta.attributes.agi ?? 0) > 0 && <p>AGI +{meta.attributes.agi}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---- ユーティリティ ----
function DifficultyStars({ level }: { level: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`w-3 h-3 ${i < level ? 'text-yellow-500 fill-yellow-500' : 'text-neutral-300'}`} />
      ))}
    </div>
  );
}

// ---- 選択済みユニット行（スフィアスロット付き）----
function SelectedUnitRow({
  heroId,
  sphereIds,
  unitIdx,
  onSphereClick,
  onSphereRemove,
  onRemove,
}: {
  heroId: string;
  sphereIds: (string | null)[];
  unitIdx: number;
  onSphereClick: (slotIdx: number) => void;
  onSphereRemove: (slotIdx: number) => void;
  onRemove: () => void;
}) {
  const [meta, setMeta] = useState<HeroMetadata | null>(null);
  const [sphereMetas, setSphereMetas] = useState<(SphereMetadata | null)[]>([null, null]);

  useEffect(() => {
    fetch(`/api/hero/metadata/${heroId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setMeta(d))
      .catch(() => {});
  }, [heroId]);

  useEffect(() => {
    sphereIds.forEach((sId, i) => {
      if (!sId) return;
      fetch(`/api/sphere/metadata/${sId}`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          if (d) setSphereMetas((prev) => { const next = [...prev]; next[i] = d; return next; });
        })
        .catch(() => {});
    });
  }, [sphereIds]);

  return (
    <div className="flex items-center gap-3 p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
      <div className="w-12 h-12 flex-shrink-0">
        {meta?.image ? (
          <img src={meta.image} alt="" className="w-full h-full object-cover rounded" />
        ) : (
          <div className="w-full h-full bg-neutral-200 rounded animate-pulse" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm uppercase truncate">
          {meta?.attributes?.type_name ?? `Unit #${heroId}`}
        </p>
        <div className="flex gap-2 mt-1">
          {[0, 1].map((slotIdx) => {
            const sId = sphereIds[slotIdx];
            const sMeta = sphereMetas[slotIdx];
            return (
              <div key={slotIdx} className="flex items-center gap-1">
                <button
                  onClick={() => onSphereClick(slotIdx)}
                  className={`text-[10px] font-bold px-2 py-0.5 border rounded transition-colors ${sId ? 'border-blue-500 text-blue-700 bg-blue-50 hover:bg-blue-100' : 'border-neutral-300 text-neutral-400 hover:border-blue-400'}`}
                >
                  {sMeta?.attributes?.type_name ?? (sId ? `#${sId}` : `スフィア ${slotIdx + 1}`)}
                </button>
                {sId && (
                  <button onClick={() => onSphereRemove(slotIdx)} className="text-neutral-300 hover:text-red-500">×</button>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <button onClick={onRemove} className="text-neutral-300 hover:text-red-500 font-bold text-lg flex-shrink-0">×</button>
    </div>
  );
}

// ---- メインコンポーネント ----
export default function BattlePage() {
  const router = useRouter();
  const params = useParams();
  const stageId = Number(params.id);
  const stage = STAGES.find((s) => s.id === stageId);

  // APIデータ
  const { data: meData } = useGetV1Me();
  const { data: unitListData, isLoading: isLoadingUnits } = useGetV1MeUnits();
  const { data: sphereListData, isLoading: isLoadingSpheres } = useGetV1MeSpheres();

  // ---- 選択状態 ----
  // 選択ユニット: { heroId: string, sphereIds: [string, string] }[]
  const [selectedUnits, setSelectedUnits] = useState<{ heroId: string; sphereIds: (string | null)[] }[]>([]);
  const maxUnits = 5;

  // スフィア選択モーダル用
  const [spherePickTarget, setSpherePickTarget] = useState<{ unitIdx: number; slotIdx: number } | null>(null);

  // バトル結果
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null);
  const [battleError, setBattleError] = useState<string | null>(null);

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

  // ---- ユニット選択トグル ----
  const toggleUnit = (heroId: string) => {
    setSelectedUnits((prev) => {
      const exists = prev.find((u) => u.heroId === heroId);
      if (exists) {
        return prev.filter((u) => u.heroId !== heroId);
      }
      if (prev.length >= maxUnits) return prev;
      return [...prev, { heroId, sphereIds: [null, null] }];
    });
  };

  // ---- スフィアをスロットに設定 ----
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

  // ---- バトル開始 ----
  const handleBattle = () => {
    if (!meData?.user) return;
    setBattleError(null);

    const attackerUnits = selectedUnits.map((u, i) => ({
      hero_id: Number(u.heroId),
      position: i + 1,
      extension_ids: u.sphereIds.filter(Boolean).map(Number),
      skill_orders: [1, 2, 0],
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
              {isWin ? (
                <Trophy className="w-20 h-20 text-yellow-500 mx-auto mb-4" />
              ) : isDraw ? (
                <Minus className="w-20 h-20 text-neutral-500 mx-auto mb-4" />
              ) : (
                <Skull className="w-20 h-20 text-red-500 mx-auto mb-4" />
              )}
              <h1 className={`text-5xl font-black uppercase tracking-widest ${isWin ? 'text-yellow-600' : isDraw ? 'text-neutral-600' : 'text-red-600'}`}>
                {isWin ? 'VICTORY!' : isDraw ? 'DRAW' : 'DEFEAT'}
              </h1>
              <p className="text-neutral-500 font-mono mt-2">Stage {stage.id} — {stage.name}</p>
            </div>
            <CardContent className="pt-6 space-y-4 bg-white">
              <div className="grid grid-cols-2 gap-4 text-sm">
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
              </div>

              {replayUrl && (
                <a href={replayUrl} target="_blank" rel="noopener noreferrer">
                  <Button className="w-full bg-neutral-900 text-white hover:bg-blue-700 font-bold uppercase">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    リプレイを見る
                  </Button>
                </a>
              )}
              <Button
                variant="outline"
                className="w-full border-neutral-900 font-bold uppercase"
                onClick={() => { setBattleResult(null); }}
              >
                もう一度挑戦
              </Button>
              <Button
                variant="ghost"
                className="w-full font-bold uppercase text-neutral-500"
                onClick={() => router.push('/stages')}
              >
                ステージ選択に戻る
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ---- スフィア選択モーダル ----
  if (spherePickTarget !== null) {
    return (
      <div className="min-h-screen p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="cyber-card rounded-xl p-6 flex items-center space-x-4 bg-white">
            <Button variant="outline" size="icon" onClick={() => setSpherePickTarget(null)}
              className="cyber-button border-neutral-900 text-neutral-900 hover:bg-neutral-900 hover:text-white">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight">スフィアを選択</h2>
              <p className="text-neutral-500 font-mono text-sm">
                ユニット {spherePickTarget.unitIdx + 1} のスロット {spherePickTarget.slotIdx + 1}
              </p>
            </div>
          </div>

          {isLoadingSpheres ? (
            <p className="text-center text-neutral-500 font-mono">Loading...</p>
          ) : !sphereListData?.spheres?.length ? (
            <p className="text-center text-neutral-500 font-mono py-20">保有スフィアがありません</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {(sphereListData?.spheres ?? []).map((sphereId) => (
                <SphereSelectCard
                  key={sphereId}
                  sphereId={sphereId}
                  onClick={() => assignSphere(sphereId)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---- メイン編成画面 ----
  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ヘッダー */}
        <div className="cyber-card rounded-xl p-6 flex items-center justify-between bg-white">
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="icon" onClick={() => router.push('/stages')}
              className="cyber-button border-neutral-900 text-neutral-900 hover:bg-neutral-900 hover:text-white">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-xs font-bold text-neutral-400 font-mono uppercase">Stage {stage.id}</span>
                <DifficultyStars level={stage.difficulty} />
              </div>
              <h1 className="text-2xl font-black text-neutral-900 uppercase tracking-tight">{stage.name}</h1>
              <p className="text-neutral-500 font-mono text-sm">{stage.description}</p>
            </div>
          </div>
        </div>

        {/* 選択中ユニット表示 */}
        <Card className="cyber-card border-2 border-neutral-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider text-neutral-500">
              選択中のユニット ({selectedUnits.length} / {maxUnits})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedUnits.length === 0 ? (
              <p className="text-neutral-400 font-mono text-sm">下のリストからユニットを選んでください</p>
            ) : (
              <div className="space-y-3">
                {selectedUnits.map((u, unitIdx) => (
                  <SelectedUnitRow
                    key={u.heroId}
                    heroId={u.heroId}
                    sphereIds={u.sphereIds}
                    unitIdx={unitIdx}
                    onSphereClick={(slotIdx) => setSpherePickTarget({ unitIdx, slotIdx })}
                    onSphereRemove={(slotIdx) => removeSphere(unitIdx, slotIdx)}
                    onRemove={() => toggleUnit(u.heroId)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* バトル開始ボタン */}
        {battleError && (
          <p className="text-red-500 font-bold text-center font-mono">{battleError}</p>
        )}
        <Button
          className="w-full bg-red-700 hover:bg-red-800 text-white font-black text-lg uppercase tracking-widest py-6 disabled:opacity-40"
          disabled={selectedUnits.length === 0 || isBattling}
          onClick={handleBattle}
        >
          {isBattling ? (
            <span className="animate-pulse">⚔️ バトル中...</span>
          ) : (
            <>
              <Swords className="w-6 h-6 mr-2" />
              バトル開始！
            </>
          )}
        </Button>

        {/* ユニット一覧 */}
        <div>
          <h2 className="text-sm font-black uppercase tracking-wider text-neutral-500 mb-3">
            保有ユニット — タップして選択 ({selectedUnits.length}/{maxUnits})
          </h2>
          {isLoadingUnits ? (
            <p className="text-neutral-500 font-mono text-center py-10">Loading...</p>
          ) : !unitListData?.units?.length ? (
            <p className="text-neutral-400 font-mono text-center py-10">保有ユニットがありません</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {(unitListData?.units ?? []).map((heroId) => {
                const isSelected = selectedUnits.some((u) => u.heroId === heroId);
                const isDisabled = !isSelected && selectedUnits.length >= maxUnits;
                return (
                  <UnitSelectCard
                    key={heroId}
                    heroId={heroId}
                    isSelected={isSelected}
                    isDisabled={isDisabled}
                    onClick={() => toggleUnit(heroId)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
