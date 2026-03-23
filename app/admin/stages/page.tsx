'use client';

import { useState } from 'react';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Plus, Trash2, Copy, Check, ChevronUp, ChevronDown, Star } from 'lucide-react';
import type { Stage, DefenderUnit } from '@/src/config/stages';
import { STAGES as INITIAL_STAGES } from '@/src/config/stages';

// ============================================================
// ヘルパー
// ============================================================
function newUnit(position: number): DefenderUnit {
  return { hero_id: 0, position, extension_ids: [], skill_orders: [1, 2, 0] };
}

function newStage(id: number): Stage {
  return {
    id,
    name: `Stage ${id}`,
    description: '',
    difficulty: 3,
    defender_uid: 0,
    defender_units: [newUnit(1)],
    allowedBfhaIds: null,
  };
}

function generateCode(stages: Stage[]): string {
  const stagesStr = stages.map((s) => {
    const unitsStr = s.defender_units.map((u) =>
      `      {\n        hero_id: ${u.hero_id},\n        position: ${u.position},\n        extension_ids: [${u.extension_ids.join(', ')}],\n        skill_orders: [${u.skill_orders.join(', ')}],\n      }`
    ).join(',\n');
    const bfhaStr = s.allowedBfhaIds === null ? 'null' : `[${s.allowedBfhaIds.join(', ')}]`;
    return `  {\n    id: ${s.id},\n    name: "${s.name}",\n    description: "${s.description}",\n    difficulty: ${s.difficulty},\n    defender_uid: ${s.defender_uid},\n    defender_units: [\n${unitsStr},\n    ],\n    allowedBfhaIds: ${bfhaStr},\n  }`;
  }).join(',\n');
  return `export const STAGES: Stage[] = [\n${stagesStr},\n];\n`;
}

// ============================================================
// 小コンポーネント
// ============================================================
function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" onClick={() => onChange(i)}>
          <Star className={`w-5 h-5 transition-colors ${i <= value ? 'text-yellow-500 fill-yellow-500' : 'text-neutral-300 hover:text-yellow-300'}`} />
        </button>
      ))}
    </div>
  );
}

function Input({ label, value, onChange, type = 'text', placeholder = '' }: {
  label: string; value: string | number; onChange: (v: string) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[11px] font-black uppercase text-neutral-500 block mb-0.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-neutral-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-neutral-600 font-mono"
      />
    </div>
  );
}

function UnitEditor({ unit, onUpdate, onRemove, canRemove }: {
  unit: DefenderUnit;
  onUpdate: (u: DefenderUnit) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const updateField = <K extends keyof DefenderUnit>(k: K, v: DefenderUnit[K]) =>
    onUpdate({ ...unit, [k]: v });

  return (
    <div className="border border-neutral-200 rounded-lg p-3 bg-neutral-50 space-y-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-black text-neutral-500 uppercase">ユニット (位置 {unit.position})</span>
        {canRemove && (
          <button onClick={onRemove} className="text-neutral-300 hover:text-red-500">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input label="Hero ID" type="number" value={unit.hero_id || ''}
          onChange={(v) => updateField('hero_id', Number(v))} placeholder="52200004" />
        <Input label="位置 (position)" type="number" value={unit.position}
          onChange={(v) => updateField('position', Number(v))} />
      </div>
      <Input label="スフィアIDs (カンマ区切り)" value={unit.extension_ids.join(', ')}
        onChange={(v) => updateField('extension_ids', v.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n) && n > 0))}
        placeholder="50910004, 50780080" />
      <Input label="skill_orders (カンマ区切り)" value={unit.skill_orders.join(', ')}
        onChange={(v) => updateField('skill_orders', v.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n)))}
        placeholder="1, 2, 0" />
    </div>
  );
}

// ============================================================
// メインコンポーネント
// ============================================================
export default function AdminStagesPage() {
  const [stages, setStages] = useState<Stage[]>(
    JSON.parse(JSON.stringify(INITIAL_STAGES)) // deep copy
  );
  const [copied, setCopied] = useState(false);

  const updateStage = (idx: number, s: Stage) => {
    setStages(prev => { const next = [...prev]; next[idx] = s; return next; });
  };

  const addStage = () => {
    const nextId = stages.length > 0 ? Math.max(...stages.map(s => s.id)) + 1 : 1;
    setStages(prev => [...prev, newStage(nextId)]);
  };

  const removeStage = (idx: number) => {
    setStages(prev => prev.filter((_, i) => i !== idx));
  };

  const moveStage = (idx: number, dir: -1 | 1) => {
    const swap = idx + dir;
    if (swap < 0 || swap >= stages.length) return;
    setStages(prev => {
      const next = [...prev];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      // idも入れ替えてシーケンシャルに保つ
      next.forEach((s, i) => { s.id = i + 1; });
      return next;
    });
  };

  const addUnit = (stageIdx: number) => {
    const stage = stages[stageIdx];
    const nextPos = stage.defender_units.length + 1;
    updateStage(stageIdx, {
      ...stage,
      defender_units: [...stage.defender_units, newUnit(nextPos)],
    });
  };

  const updateUnit = (stageIdx: number, unitIdx: number, unit: DefenderUnit) => {
    const stage = stages[stageIdx];
    const units = [...stage.defender_units];
    units[unitIdx] = unit;
    updateStage(stageIdx, { ...stage, defender_units: units });
  };

  const removeUnit = (stageIdx: number, unitIdx: number) => {
    const stage = stages[stageIdx];
    const units = stage.defender_units.filter((_, i) => i !== unitIdx)
      .map((u, i) => ({ ...u, position: i + 1 }));
    updateStage(stageIdx, { ...stage, defender_units: units });
  };

  const handleCopy = () => {
    const code = generateCode(stages);
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const generatedCode = generateCode(stages);

  return (
    <div className="min-h-screen bg-neutral-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-4">

        {/* ヘッダー */}
        <div className="bg-white border-2 border-neutral-900 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-0.5">管理者専用</p>
            <h1 className="text-xl font-black uppercase tracking-tight">Stage Editor</h1>
            <p className="text-xs text-neutral-400 font-mono mt-0.5">
              編集 → コードをコピー → src/config/stages.ts に貼り付け → push
            </p>
          </div>
          <Button
            onClick={handleCopy}
            className={`font-black uppercase tracking-wider px-5 py-2 transition-all ${
              copied ? 'bg-green-600 hover:bg-green-600 text-white' : 'bg-neutral-900 hover:bg-neutral-700 text-white'
            }`}
          >
            {copied ? <><Check className="w-4 h-4 mr-1.5" />コピー済み</> : <><Copy className="w-4 h-4 mr-1.5" />コードをコピー</>}
          </Button>
        </div>

        {/* ステージ一覧 */}
        {stages.map((stage, stageIdx) => (
          <Card key={stageIdx} className="border-2 border-neutral-200 bg-white">
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-neutral-400 font-mono w-8">#{stage.id}</span>
                <CardTitle className="text-sm font-black uppercase flex-1">{stage.name || '(無題)'}</CardTitle>
                <div className="flex items-center gap-1">
                  <button onClick={() => moveStage(stageIdx, -1)} disabled={stageIdx === 0}
                    className="p-1 text-neutral-400 hover:text-neutral-700 disabled:opacity-20">
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button onClick={() => moveStage(stageIdx, 1)} disabled={stageIdx === stages.length - 1}
                    className="p-1 text-neutral-400 hover:text-neutral-700 disabled:opacity-20">
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <button onClick={() => removeStage(stageIdx)}
                    className="p-1 text-neutral-300 hover:text-red-500 ml-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Input label="ステージ名" value={stage.name}
                  onChange={(v) => updateStage(stageIdx, { ...stage, name: v })} />
                <Input label="説明文" value={stage.description}
                  onChange={(v) => updateStage(stageIdx, { ...stage, description: v })} />
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <label className="text-[11px] font-black uppercase text-neutral-500 block mb-1">難易度</label>
                  <StarInput value={stage.difficulty}
                    onChange={(v) => updateStage(stageIdx, { ...stage, difficulty: v })} />
                </div>
                <div className="flex-1">
                  <Input label="Defender UID" type="number" value={stage.defender_uid || ''}
                    onChange={(v) => updateStage(stageIdx, { ...stage, defender_uid: Number(v) })}
                    placeholder="100006912" />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-black uppercase text-neutral-500 block mb-0.5">
                  BFHA ID制限 <span className="font-normal normal-case text-neutral-400">（空欄=全員OK、カンマ区切りでID指定）</span>
                </label>
                <input
                  type="text"
                  value={stage.allowedBfhaIds === null ? '' : stage.allowedBfhaIds.join(', ')}
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    if (raw === '') {
                      updateStage(stageIdx, { ...stage, allowedBfhaIds: null });
                    } else {
                      const ids = raw.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n) && n >= 0);
                      updateStage(stageIdx, { ...stage, allowedBfhaIds: ids });
                    }
                  }}
                  placeholder="0, 1, 5（空欄で全員アクセス可）"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-neutral-600 font-mono"
                />
                <p className="text-[10px] text-neutral-400 mt-0.5 font-mono">
                  {stage.allowedBfhaIds === null
                    ? '✓ 全員アクセス可'
                    : stage.allowedBfhaIds.length === 0
                      ? '⚠ 誰もアクセスできません（IDを入力してください）'
                      : `✓ BFHA ID: ${stage.allowedBfhaIds.join(', ')} を持つ人のみ`}
                </p>
              </div>

              {/* ディフェンダーユニット */}
              <div className="space-y-2">
                <p className="text-[11px] font-black uppercase text-neutral-500">ディフェンダーユニット ({stage.defender_units.length}体)</p>
                {stage.defender_units.map((unit, unitIdx) => (
                  <UnitEditor
                    key={unitIdx}
                    unit={unit}
                    onUpdate={(u) => updateUnit(stageIdx, unitIdx, u)}
                    onRemove={() => removeUnit(stageIdx, unitIdx)}
                    canRemove={stage.defender_units.length > 1}
                  />
                ))}
                <button
                  onClick={() => addUnit(stageIdx)}
                  className="w-full border border-dashed border-neutral-300 rounded-lg py-2 text-xs text-neutral-400 hover:border-neutral-500 hover:text-neutral-600 font-bold uppercase tracking-wider flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />ユニットを追加
                </button>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* ステージ追加 */}
        <button
          onClick={addStage}
          className="w-full border-2 border-dashed border-neutral-300 rounded-xl py-4 text-sm text-neutral-400 hover:border-neutral-500 hover:text-neutral-600 font-black uppercase tracking-wider flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />ステージを追加
        </button>

        {/* 生成されたコードプレビュー */}
        <Card className="border-2 border-neutral-200">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-black uppercase text-neutral-500">生成されたコード（src/config/stages.ts の末尾に貼り付け）</CardTitle>
              <button onClick={handleCopy}
                className={`text-[10px] font-black uppercase px-3 py-1 rounded-lg transition-all ${
                  copied ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}>
                {copied ? '✓ コピー済み' : 'コピー'}
              </button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <pre className="text-[10px] font-mono bg-neutral-50 border border-neutral-200 rounded-lg p-3 overflow-x-auto whitespace-pre text-neutral-700 max-h-64 overflow-y-auto">
              {generatedCode}
            </pre>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
