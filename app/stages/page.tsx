'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { ChevronLeft, Swords, Star, Trophy, CheckCircle2, Circle, RotateCcw } from 'lucide-react';
import { STAGES } from '@/src/config/stages';
import { getAllClearRecords, isAllCleared, resetAllRecords, type ClearRecord } from '@/src/lib/clearRecords';
import { usePostV1Heroes } from '@/src/api/generated/hero/hero';

// ============================================================
// ユニット画像URL変換（battle/page.tsx と同じロジック）
// ============================================================
function toFastUnitImageUrl(url: string): string {
  if (!url) return url;
  const m = url.match(/unit_ills_thum_(\d+)\.png/);
  if (!m) return url;
  const id = m[1];
  return `https://rsc.bravefrontierheroes.com/rsc/unit/${id}/unit_ills_thum_${id}.png`;
}

// メタデータキャッシュ（ページ内グローバル）
const heroMetaCache: Record<string, string> = {}; // heroId → imageUrl
const heroAttrCache: Record<string, number> = {};  // heroId → attribute

const UNIT_ATTR_MAP: Record<number, { label: string; tw: string }> = {
  1: { label: '炎', tw: 'bg-red-100 text-red-700' },
  2: { label: '水', tw: 'bg-sky-100 text-sky-700' },
  3: { label: '樹', tw: 'bg-green-100 text-green-700' },
  4: { label: '雷', tw: 'bg-yellow-100 text-yellow-700' },
  5: { label: '光', tw: 'bg-orange-100 text-orange-700' },
  6: { label: '闇', tw: 'bg-purple-100 text-purple-700' },
};

// ============================================================
// 敵ユニットアイコン
// ============================================================
function EnemyUnitIcon({ heroId }: { heroId: number }) {
  const [imageUrl, setImageUrl] = useState<string | null>(heroMetaCache[String(heroId)] ?? null);
  const [attribute, setAttribute] = useState<number | null>(heroAttrCache[String(heroId)] ?? null);

  useEffect(() => {
    if (heroMetaCache[String(heroId)]) {
      setImageUrl(heroMetaCache[String(heroId)]);
      setAttribute(heroAttrCache[String(heroId)] ?? null);
      return;
    }
    fetch(`/api/hero/metadata/${heroId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.image) {
          heroMetaCache[String(heroId)] = d.image;
          setImageUrl(d.image);
        }
      })
      .catch(() => {});
  }, [heroId]);

  const attrInfo = attribute ? UNIT_ATTR_MAP[attribute] : null;

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="w-10 h-10 rounded overflow-hidden bg-neutral-100 border border-neutral-200 flex-shrink-0">
        {imageUrl
          ? <img src={toFastUnitImageUrl(imageUrl)} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full animate-pulse bg-neutral-200" />}
      </div>
      {attrInfo && (
        <span className={`text-[8px] font-black px-1 rounded ${attrInfo.tw}`}>{attrInfo.label}</span>
      )}
    </div>
  );
}

// ============================================================
// ユーティリティ
// ============================================================
function DifficultyStars({ level }: { level: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`w-4 h-4 ${i < level ? 'text-yellow-500 fill-yellow-500' : 'text-neutral-300'}`} />
      ))}
    </div>
  );
}

function ClearBadge({ record }: { record: ClearRecord | null }) {
  if (!record) return (
    <span className="flex items-center gap-1 text-[10px] font-black text-neutral-300 uppercase">
      <Circle className="w-3 h-3" />未挑戦
    </span>
  );
  if (record.bestResult === 'WIN') return (
    <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600 uppercase bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
      <CheckCircle2 className="w-3 h-3" />WIN
    </span>
  );
  if (record.bestResult === 'DRAW') return (
    <span className="flex items-center gap-1 text-[10px] font-black text-yellow-600 uppercase bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full">
      <CheckCircle2 className="w-3 h-3" />DRAW
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-[10px] font-black text-red-500 uppercase bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
      <Circle className="w-3 h-3" />挑戦中
    </span>
  );
}

// ============================================================
// メインコンポーネント
// ============================================================
export default function StagesPage() {
  const router = useRouter();
  const [records, setRecords] = useState<Record<number, ClearRecord>>({});
  const allStageIds = STAGES.map(s => s.id);
  const fetchedRef = useRef(false);

  useEffect(() => { setRecords(getAllClearRecords()); }, []);

  // 全ステージの敵ユニットIDをまとめてゲームデータ取得（属性のため）
  const { mutate: fetchHeroGameData } = usePostV1Heroes({
    mutation: {
      onSuccess: (data) => {
        const datas = (data as any)?.heroes?.hero_datas ?? [];
        datas.forEach((h: any) => { heroAttrCache[String(h.hero_id)] = h.attribute; });
      },
    },
  });

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    const allHeroIds = [...new Set(STAGES.flatMap(s => s.defender_units.map(u => u.hero_id)))];
    fetchHeroGameData({ data: { hero_ids: allHeroIds } } as any);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearedCount = allStageIds.filter(id => records[id]?.bestResult === 'WIN').length;
  const allCleared = isAllCleared(allStageIds);
  const totalAttempts = Object.values(records).reduce((s, r) => s + r.attempts, 0);

  const handleReset = () => {
    if (confirm('全クリア記録をリセットしますか？')) { resetAllRecords(); setRecords({}); }
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="cyber-card rounded-xl p-6 flex items-center space-x-4 bg-white">
          <Button onClick={() => router.push('/dashboard')} variant="outline" size="icon"
            className="cyber-button border-neutral-900 text-neutral-900 hover:bg-neutral-900 hover:text-white">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-neutral-900 uppercase tracking-tight flex items-center">
              <Swords className="w-8 h-8 mr-2 text-neutral-600" />
              Stage Select
            </h1>
            <p className="text-neutral-600 font-mono">挑戦するステージを選んでください</p>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-2xl font-black text-neutral-900">{clearedCount}<span className="text-base font-mono text-neutral-400">/{allStageIds.length}</span></p>
            <p className="text-[10px] font-mono text-neutral-400 uppercase">Stages Cleared</p>
            {totalAttempts > 0 && <p className="text-[10px] font-mono text-neutral-300">{totalAttempts} battles</p>}
          </div>
        </div>

        {/* 全クリアバナー */}
        {allCleared && (
          <div className="bg-gradient-to-r from-yellow-400 to-orange-400 rounded-xl p-5 flex items-center gap-4 shadow-lg">
            <Trophy className="w-10 h-10 text-white flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xl font-black text-white uppercase tracking-tight">全ステージ制覇！</p>
              <p className="text-yellow-100 text-sm font-mono">おめでとうございます！全 {allStageIds.length} ステージをクリアしました</p>
            </div>
          </div>
        )}

        {/* Stage Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {STAGES.map((stage) => {
            const record = records[stage.id] ?? null;
            const isWin = record?.bestResult === 'WIN';
            const sortedUnits = [...stage.defender_units].sort((a, b) => a.position - b.position);
            return (
              <Card key={stage.id}
                className={`cyber-card border-2 cursor-pointer transition-all hover:scale-[1.02] ${
                  isWin ? 'border-emerald-400 bg-emerald-50/30 hover:bg-emerald-50' : 'border-neutral-900 hover:bg-neutral-50'
                }`}
                onClick={() => router.push(`/battle/${stage.id}`)}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-400 font-mono uppercase">Stage {stage.id}</span>
                    <div className="flex items-center gap-2">
                      <ClearBadge record={record} />
                      <DifficultyStars level={stage.difficulty} />
                    </div>
                  </div>
                  <CardTitle className="text-xl font-black text-neutral-900 uppercase tracking-tight">{stage.name}</CardTitle>
                  <CardDescription className="text-neutral-500 font-mono text-sm">{stage.description}</CardDescription>
                  {record && (
                    <p className="text-[10px] font-mono text-neutral-400">
                      {record.wins}勝 {record.draws}分 {record.attempts - record.wins - record.draws}敗 — {record.attempts}戦
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* 敵ユニットアイコン */}
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-neutral-400 uppercase tracking-wider w-8 flex-shrink-0">敵</span>
                    <div className="flex gap-2 flex-wrap">
                      {sortedUnits.map((u) => (
                        <EnemyUnitIcon key={u.position} heroId={u.hero_id} />
                      ))}
                    </div>
                  </div>
                  {/* 挑戦ボタン */}
                  <Button
                    className={`w-full font-bold uppercase tracking-wider transition-colors ${
                      isWin ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-neutral-900 text-white hover:bg-red-700'
                    }`}
                    onClick={(e) => { e.stopPropagation(); router.push(`/battle/${stage.id}`); }}
                  >
                    <Swords className="w-4 h-4 mr-2" />
                    {record ? '再挑戦' : '挑戦する'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {totalAttempts > 0 && (
          <div className="text-center pt-2">
            <button onClick={handleReset}
              className="text-[10px] font-mono text-neutral-300 hover:text-red-400 transition-colors flex items-center gap-1 mx-auto">
              <RotateCcw className="w-3 h-3" />クリア記録をリセット
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
