'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { ChevronLeft, Swords, Star, Trophy, CheckCircle2, Circle, RotateCcw } from 'lucide-react';
import { STAGES } from '@/src/config/stages';
import { getAllClearRecords, isAllCleared, resetAllRecords, type ClearRecord } from '@/src/lib/clearRecords';

function DifficultyStars({ level }: { level: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${i < level ? 'text-yellow-500 fill-yellow-500' : 'text-neutral-300'}`}
        />
      ))}
    </div>
  );
}

function ClearBadge({ record }: { record: ClearRecord | null }) {
  if (!record) {
    return (
      <span className="flex items-center gap-1 text-[10px] font-black text-neutral-300 uppercase">
        <Circle className="w-3 h-3" />
        未挑戦
      </span>
    );
  }
  if (record.bestResult === 'WIN') {
    return (
      <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600 uppercase bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
        <CheckCircle2 className="w-3 h-3" />
        WIN
      </span>
    );
  }
  if (record.bestResult === 'DRAW') {
    return (
      <span className="flex items-center gap-1 text-[10px] font-black text-yellow-600 uppercase bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full">
        <CheckCircle2 className="w-3 h-3" />
        DRAW
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[10px] font-black text-red-500 uppercase bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
      <Circle className="w-3 h-3" />
      挑戦中
    </span>
  );
}

export default function StagesPage() {
  const router = useRouter();
  const [records, setRecords] = useState<Record<number, ClearRecord>>({});
  const allStageIds = STAGES.map(s => s.id);

  // localStorageはSSR不可なのでuseEffectで読む
  useEffect(() => {
    setRecords(getAllClearRecords());
  }, []);

  const clearedCount = allStageIds.filter(id => records[id]?.bestResult === 'WIN').length;
  const allCleared = isAllCleared(allStageIds);
  const totalAttempts = Object.values(records).reduce((s, r) => s + r.attempts, 0);

  const handleReset = () => {
    if (confirm('全クリア記録をリセットしますか？')) {
      resetAllRecords();
      setRecords({});
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="cyber-card rounded-xl p-6 flex items-center space-x-4 bg-white">
          <Button
            onClick={() => router.push('/dashboard')}
            variant="outline"
            size="icon"
            className="cyber-button border-neutral-900 text-neutral-900 hover:bg-neutral-900 hover:text-white"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-neutral-900 uppercase tracking-tight flex items-center">
              <Swords className="w-8 h-8 mr-2 text-red-600" />
              Stage Select
            </h1>
            <p className="text-neutral-600 font-mono">挑戦するステージを選んでください</p>
          </div>
          {/* 進捗サマリー */}
          <div className="text-right hidden sm:block">
            <p className="text-2xl font-black text-neutral-900">{clearedCount}<span className="text-base font-mono text-neutral-400">/{allStageIds.length}</span></p>
            <p className="text-[10px] font-mono text-neutral-400 uppercase">Stages Cleared</p>
            {totalAttempts > 0 && (
              <p className="text-[10px] font-mono text-neutral-300">{totalAttempts} battles</p>
            )}
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
            return (
              <Card
                key={stage.id}
                className={`cyber-card border-2 cursor-pointer transition-all hover:scale-[1.02] ${
                  isWin
                    ? 'border-emerald-400 bg-emerald-50/30 hover:bg-emerald-50'
                    : 'border-neutral-900 hover:bg-neutral-50'
                }`}
                onClick={() => router.push(`/battle/${stage.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-400 font-mono uppercase">
                      Stage {stage.id}
                    </span>
                    <div className="flex items-center gap-2">
                      <ClearBadge record={record} />
                      <DifficultyStars level={stage.difficulty} />
                    </div>
                  </div>
                  <CardTitle className="text-xl font-black text-neutral-900 uppercase tracking-tight">
                    {stage.name}
                  </CardTitle>
                  <CardDescription className="text-neutral-500 font-mono text-sm">
                    {stage.description}
                  </CardDescription>
                  {/* 戦績 */}
                  {record && (
                    <p className="text-[10px] font-mono text-neutral-400">
                      {record.wins}勝 {record.draws}分 {record.attempts - record.wins - record.draws}敗 — {record.attempts}戦
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  <Button
                    className={`w-full font-bold uppercase tracking-wider transition-colors ${
                      isWin
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-neutral-900 text-white hover:bg-red-700'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/battle/${stage.id}`);
                    }}
                  >
                    <Swords className="w-4 h-4 mr-2" />
                    {record ? '再挑戦' : '挑戦する'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* リセットボタン（目立たせない） */}
        {totalAttempts > 0 && (
          <div className="text-center pt-2">
            <button
              onClick={handleReset}
              className="text-[10px] font-mono text-neutral-300 hover:text-red-400 transition-colors flex items-center gap-1 mx-auto"
            >
              <RotateCcw className="w-3 h-3" />
              クリア記録をリセット
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
