'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { saveClearRecord } from '@/src/lib/clearRecords';
import { Card, CardContent } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { ChevronLeft, Swords, Star, Crown, Skull, Minus, ExternalLink, Search, X, Info, ArrowUp, ArrowDown } from 'lucide-react';
import { STAGES } from '@/src/config/stages';
import { useGetV1Me } from '@/src/api/generated/user/user';
import { useGetV1MeUnits, useGetV1MeSpheres } from '@/src/api/generated/assets/assets';
import { usePostV1Heroes } from '@/src/api/generated/hero/hero';
import { usePostV1Spheres } from '@/src/api/generated/sphere/sphere';
import { usePostV1BattleSimulate } from '@/src/api/generated/battle/battle';
import { useGetV1DeckTemplates } from '@/src/api/generated/deck/deck';

// ============================================================
// 型定義
// ============================================================
interface HeroMetadata {
  name: string;
  image: string;
  attributes: {
    type_name: string;
    rarity: string;   // "Legendary" / "Epic" / "Rare" / "Uncommon"
    lv: number;
    hp: number; phy: number; int: number; agi: number; spr: number; def: number;
    brave_burst?: string;
    art_skill?: string;
  };
}

// /v1/heroes のゲームデータ（attribute はここだけにある）
interface HeroGameData {
  hero_id: number;
  rarity: number;
  attribute: number; // 1=炎, 2=水, 3=樹, 4=雷, 5=光, 6=闇
  name: string;
  name_jp: string;
  lv: number;
  param: { hp: number; phy: number; int: number; vit: number; mnd: number; agi: number };
  active?: number;   // BBスキルID → skills_v2.json で引く
  passive?: number;  // アートスキルID → skills_v2.json で引く
}

// /v1/spheres のゲームデータ
interface SphereGameData {
  extension_id: number;
  extension_type: number; // 画像番号 → https://rsc.bravefrontierheroes.com/rsc/sphere/{extension_type}.png
  rarity: number;
  name: string;
  name_jp: string;
  lv: number;
  param: { hp: number; phy: number; int: number; vit: number; mnd: number; agi: number };
  sphere_skill?: string;
  active?: number; // スフィアスキルID → skills_v2.json で引く
}

type SelectedUnit = {
  heroId: string;
  skillOrders: [number, number, number]; // [first, second, third] 各値は 0=アート, 1=スフィア1, 2=スフィア2
  sphereIds: (string | null)[];
};

// デッキテンプレート型
interface DeckUnit {
  hero_id: number;
  extension_ids: number[];
  position: number;
  skill_orders: number[];
}
interface DeckTemplate {
  jin_id: number;
  units: DeckUnit[];
}

type BattleResult = {
  result: number;
  battle_key: string;
  attacker_taken_damage: number;
  defender_taken_damage: number;
  action_counts: number;
  player_name: string;
  opponent_name: string;
};

// ============================================================
// 定数 — rarity/attribute マッピング
// rarity数値確定: 5=L(LL), 4=E, 3=R, 2=U (1=Commonはゲーム内限定で使わない)
// attribute数値確定: 1=炎, 2=水, 3=樹, 4=雷, 5=光, 6=闇
// ============================================================
const UNIT_RARITY_MAP: Record<number, string> = {
  5: 'L', 4: 'E', 3: 'R', 2: 'U',
};
const SPHERE_RARITY_MAP: Record<number, string> = {
  5: 'L', 4: 'E', 3: 'R', 2: 'U', 1: 'C',
};
// NFTメタデータのrarity文字列 → 表示ラベル
const RARITY_LABEL: Record<string, string> = {
  Legendary: 'L', Epic: 'E', Rare: 'R', Uncommon: 'U', Common: 'C',
};
// フィルターボタン順
const UNIT_RARITY_FILTERS  = ['L', 'E', 'R', 'U'] as const;
const SPHERE_RARITY_FILTERS = ['L', 'E', 'R', 'U', 'C'] as const;

const UNIT_ATTR_MAP: Record<number, { label: string; tw: string }> = {
  1: { label: '炎', tw: 'bg-red-100 text-red-700 border-red-300' },
  2: { label: '水', tw: 'bg-sky-100 text-sky-700 border-sky-300' },
  3: { label: '樹', tw: 'bg-green-100 text-green-700 border-green-300' },
  4: { label: '雷', tw: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  5: { label: '光', tw: 'bg-orange-100 text-orange-700 border-orange-300' },
  6: { label: '闇', tw: 'bg-purple-100 text-purple-700 border-purple-300' },
};
const UNIT_ATTR_IDS = [1, 2, 3, 4, 5, 6];

// ============================================================
// 画像URL変換（小サムネイル用）
// .../unit/2000/unit_ills_thum_4002024.png
//  → .../unit/4002024/unit_ills_thum_4002024.png
// ============================================================
// グローバルキャッシュ（再マウント時も再fetchしない）
// ============================================================
const heroMetaCache: Record<string, HeroMetadata> = {};

// skills_v2.json キャッシュ
// 構造: [{skill_id, name:{ja,...}, description:{ja:{condition?,effects:[]}}}]
// → skill_id をキーにしたマップに変換して使う
interface SkillEntry { condition?: string; effects: string[] }
let skillsCache: Record<string, SkillEntry> | null = null;
let skillsFetching = false;
let skillsCallbacks: (() => void)[] = [];

function fetchSkills(cb: () => void) {
  if (skillsCache) { cb(); return; }
  skillsCallbacks.push(cb);
  if (skillsFetching) return;
  skillsFetching = true;
  fetch('https://rsc.bravefrontierheroes.com/data/skills_v2.json')
    .then(r => r.ok ? r.json() : null)
    .then((arr: any[]) => {
      const map: Record<string, SkillEntry> = {};
      if (Array.isArray(arr)) {
        arr.forEach(s => {
          const ja = s?.description?.ja;
          if (s?.skill_id != null) {
            map[String(s.skill_id)] = {
              condition: ja?.condition,
              effects: ja?.effects ?? [],
            };
          }
        });
      }
      skillsCache = map;
      skillsCallbacks.forEach(fn => fn());
      skillsCallbacks = [];
    })
    .catch(() => { skillsCache = {}; skillsCallbacks.forEach(fn => fn()); skillsCallbacks = []; })
    .finally(() => { skillsFetching = false; });
}

function getSkill(id?: number): SkillEntry | null {
  if (!id || !skillsCache) return null;
  return skillsCache[String(id)] ?? null;
}
const heroMetaFetching = new Set<string>();

function fetchHeroMeta(heroId: string, cb: (d: HeroMetadata) => void) {
  if (heroMetaCache[heroId]) { cb(heroMetaCache[heroId]); return; }
  if (heroMetaFetching.has(heroId)) return;
  heroMetaFetching.add(heroId);
  fetch(`/api/hero/metadata/${heroId}`)
    .then(r => r.ok ? r.json() : null)
    .then(d => { if (d) { heroMetaCache[heroId] = d; cb(d); } })
    .catch(() => {})
    .finally(() => heroMetaFetching.delete(heroId));
}

function getSphereImageUrl(gameData?: SphereGameData): string | null {
  if (gameData?.extension_type) return `https://rsc.bravefrontierheroes.com/rsc/sphere/${gameData.extension_type}.png`;
  return null;
}

function useHeroMeta(heroId: string) {
  const [meta, setMeta] = useState<HeroMetadata | null>(heroMetaCache[heroId] ?? null);
  useEffect(() => { fetchHeroMeta(heroId, setMeta); }, [heroId]);
  return meta;
}


// ============================================================
// 画像URL変換
// メタデータ例: .../rsc/unit/2000/unit_ills_thum_4002024.png
//    → 高速版: .../rsc/unit/4002024/unit_ills_thum_4002024.png
// スフィアは変換不要（元URLそのまま）
// ============================================================
function toFastUnitImageUrl(url: string): string {
  if (!url) return url;
  const m = url.match(/unit_ills_thum_(\d+)\.png/);
  if (!m) return url;
  const id = m[1];
  return `https://rsc.bravefrontierheroes.com/rsc/unit/${id}/unit_ills_thum_${id}.png`;
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
// ユニット詳細モーダル（gameDataも受け取って属性表示）
// ============================================================
function HeroDetailModal({ heroId, gameData, onClose }: {
  heroId: string;
  gameData?: HeroGameData;
  onClose: () => void;
}) {
  const meta = useHeroMeta(heroId);
  const [skillsReady, setSkillsReady] = useState(skillsCache !== null);
  useEffect(() => { if (!skillsCache) fetchSkills(() => setSkillsReady(true)); }, []);

  const rarityLabel = meta ? (RARITY_LABEL[meta.attributes.rarity] ?? meta.attributes.rarity) : '';
  const attrInfo = gameData ? UNIT_ATTR_MAP[gameData.attribute] : null;
  // APIの active=アートスキルID、passive=BBスキルID（名称と逆対応）
  const bbSkill  = skillsReady ? getSkill(gameData?.passive) : null;
  const artSkill = skillsReady ? getSkill(gameData?.active)  : null;

  // ステータス表示: HP/攻撃/魔攻/防御/魔防/敏捷
  const STAT_ROWS: [string, number][] = meta ? [
    ['HP',   meta.attributes.hp],
    ['攻撃', meta.attributes.phy],
    ['魔攻', meta.attributes.int],
    ['防御', meta.attributes.def],
    ['魔防', meta.attributes.spr],
    ['敏捷', meta.attributes.agi],
  ] : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="bg-white border-2 border-neutral-900 rounded-xl max-w-sm w-full shadow-xl overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {meta ? (
          <>
            <div className="relative flex-shrink-0">
              <img src={toFastUnitImageUrl(meta.image)} alt="" className="w-full h-40 object-cover" />
              <button onClick={onClose} className="absolute top-2 right-2 bg-white rounded-full p-1 shadow"><X className="w-4 h-4" /></button>
              <div className="absolute bottom-2 left-2 flex gap-1">
                <span className="bg-black/70 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">{rarityLabel}</span>
                {attrInfo && <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${attrInfo.tw}`}>{attrInfo.label}</span>}
              </div>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto">
              {/* 名前・Lv・ID */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-black text-sm uppercase leading-tight">{meta.attributes.type_name}</p>
                  <p className="text-xs text-neutral-400 font-mono">Lv {meta.attributes.lv}</p>
                </div>
                <span className="text-[10px] font-mono text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded flex-shrink-0">#{heroId}</span>
              </div>
              {/* ステータス */}
              <div className="grid grid-cols-3 gap-1 text-[10px] font-mono">
                {STAT_ROWS.map(([k, v]) => (
                  <div key={k} className="bg-neutral-50 rounded px-2 py-1 flex justify-between">
                    <span className="text-neutral-400 font-bold">{k}</span>
                    <span className="font-bold">{(v ?? 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              {/* BB */}
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
              {/* Art Skill */}
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

// ============================================================
// スフィア詳細モーダル
// ============================================================
function SphereDetailModal({ gameData, onClose }: {
  gameData?: SphereGameData;
  onClose: () => void;
}) {
  const [skillsReady, setSkillsReady] = useState(skillsCache !== null);
  useEffect(() => { if (!skillsCache) fetchSkills(() => setSkillsReady(true)); }, []);
  if (!gameData) return null;
  const imageUrl = getSphereImageUrl(gameData);
  const sphereSkill = skillsReady ? getSkill(gameData.active) : null;
  const rarityLabel = SPHERE_RARITY_MAP[gameData.rarity] ?? '';
  const p = gameData.param;
  const PARAM_KEYS: [string, number][] = [
    ['HP', p.hp ?? 0], ['攻撃', p.phy ?? 0], ['魔攻', p.int ?? 0],
    ['防御', p.vit ?? 0], ['魔防', p.mnd ?? 0], ['敏捷', p.agi ?? 0],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="bg-white border-2 border-neutral-900 rounded-xl max-w-xs w-full shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="relative bg-neutral-50 flex items-center justify-center h-32">
          {imageUrl
            ? <img src={imageUrl} alt="" className="h-full object-contain" />
            : <div className="w-full h-full animate-pulse bg-neutral-200" />}
          <button onClick={onClose} className="absolute top-2 right-2 bg-white rounded-full p-1 shadow"><X className="w-4 h-4" /></button>
          {rarityLabel && (
            <span className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">{rarityLabel}</span>
          )}
        </div>
        <div className="p-4 space-y-3">
          {/* 名前・Lv・ID */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-black text-sm uppercase leading-tight">{gameData.name_jp || gameData.name}</p>
              <p className="text-xs text-neutral-400 font-mono">Lv {gameData.lv}</p>
            </div>
            <span className="text-[10px] font-mono text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded flex-shrink-0">#{gameData.extension_id}</span>
          </div>
          {/* ステータス */}
          <div className="grid grid-cols-3 gap-1 text-[10px] font-mono">
            {PARAM_KEYS.map(([k, v]) => (v > 0 ? (
              <div key={k} className="bg-blue-50 rounded px-2 py-1 flex justify-between">
                <span className="text-blue-400 font-bold">{k}</span>
                <span className="font-bold text-blue-700">+{v}</span>
              </div>
            ) : null))}
          </div>
          {/* スフィア効果 */}
          {sphereSkill && sphereSkill.effects.length > 0 && (
            <div className="text-xs space-y-1">
              <p className="font-black text-blue-700 text-[10px] uppercase">Sphere Skill</p>
              <ul className="space-y-0.5">
                {sphereSkill.effects.map((e, i) => (
                  <li key={i} className="text-neutral-600 leading-snug pl-2 border-l-2 border-blue-200">{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ユニットミニカード
// ============================================================
function UnitMiniCard({ heroId, isSelected, isDisabled, gameData, onClick }: {
  heroId: string; isSelected: boolean; isDisabled: boolean;
  gameData?: HeroGameData; onClick: () => void;
}) {
  const meta = useHeroMeta(heroId);
  const [showDetail, setShowDetail] = useState(false);
  const attrInfo = gameData ? UNIT_ATTR_MAP[gameData.attribute] : null;
  const rarityLabel = meta ? (RARITY_LABEL[meta.attributes.rarity] ?? '') : '';

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
        {/* 属性バッジ */}
        {attrInfo && (
          <span className={`absolute top-1 left-1 z-10 text-[8px] font-black px-1 rounded border ${attrInfo.tw}`}>
            {attrInfo.label}
          </span>
        )}
        {/* 詳細ボタン（タップしやすいサイズ） */}
        {meta && (
          <button className="absolute top-0 right-0 z-10 w-8 h-8 flex items-center justify-center bg-white/90 rounded-bl-lg rounded-tr-md hover:bg-white active:bg-white"
            onClick={e => { e.stopPropagation(); setShowDetail(true); }}>
            <Info className="w-5 h-5 text-neutral-500" />
          </button>
        )}
        {meta?.image ? (
          <img src={toFastUnitImageUrl(meta.image)} alt="" loading="lazy" className="w-full aspect-square object-cover rounded-t-md" />
        ) : (
          <div className="w-full aspect-square bg-neutral-100 rounded-t-md animate-pulse" />
        )}
        <div className="px-1.5 py-1">
          <div className="flex items-center gap-1 mb-0.5">
            {rarityLabel && <span className="text-[8px] font-black text-neutral-400 uppercase">{rarityLabel}</span>}
            <p className="text-[10px] font-bold uppercase leading-tight truncate flex-1">
              {meta?.attributes?.type_name ?? `#${heroId}`}
            </p>
          </div>
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
      {showDetail && <HeroDetailModal heroId={heroId} gameData={gameData} onClose={() => setShowDetail(false)} />}
    </>
  );
}

// ============================================================
// スフィアミニカード
// ============================================================
function SphereMiniCard({ gameData, onClick }: {
  gameData?: SphereGameData; onClick: () => void;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const imageUrl = getSphereImageUrl(gameData);
  const rarityLabel = gameData ? (SPHERE_RARITY_MAP[gameData.rarity] ?? '') : '';
  const p = gameData?.param;
  const mainStat = p ? (
    (p.hp ?? 0) > 0 ? `HP+${p.hp}` :
    (p.phy ?? 0) > 0 ? `PHY+${p.phy}` :
    (p.int ?? 0) > 0 ? `INT+${p.int}` : ''
  ) : '';

  return (
    <>
      <div
        className="relative border-2 border-neutral-300 rounded-lg cursor-pointer hover:border-blue-500 bg-white hover:bg-blue-50 transition-all"
        onClick={onClick}
      >
        {rarityLabel && (
          <span className="absolute top-1 left-1 z-10 text-[8px] font-black text-neutral-500 bg-white/90 px-1 rounded">
            {rarityLabel}
          </span>
        )}
        {gameData && (
          <button className="absolute top-0 right-0 z-10 w-8 h-8 flex items-center justify-center bg-white/90 rounded-bl-lg rounded-tr-md hover:bg-white active:bg-white"
            onClick={e => { e.stopPropagation(); setShowDetail(true); }}>
            <Info className="w-5 h-5 text-neutral-500" />
          </button>
        )}
        {imageUrl
          ? <img src={imageUrl} alt="" loading="lazy" className="w-full aspect-square object-contain p-1" />
          : <div className="w-full aspect-square bg-neutral-100 rounded-t-md animate-pulse" />}
        <div className="px-1.5 py-1">
          <p className="text-[10px] font-bold uppercase leading-tight truncate">
            {gameData?.name_jp || gameData?.name || `#${gameData?.extension_id}`}
          </p>
          {mainStat && <p className="text-[9px] font-mono text-blue-500">{mainStat}</p>}
        </div>
      </div>
      {showDetail && <SphereDetailModal gameData={gameData} onClose={() => setShowDetail(false)} />}
    </>
  );
}

// ============================================================
// 選択済みユニット行（スフィアアイコン付き + スキル順）
// ============================================================
const SKILL_LABELS = ['アート', 'スフィア1', 'スフィア2'];
const SKILL_COLORS = ['bg-pink-100 text-pink-700', 'bg-blue-100 text-blue-700', 'bg-green-100 text-green-700'];

function SelectedUnitRow({ unit, onSphereClick, onSphereRemove, onRemove, onSkillOrderChange,
  reorderMode, isReorderSelected, onReorderTap, onUnitReselect, sphereGameData }: {
  unit: SelectedUnit;
  onSphereClick: (slotIdx: number) => void;
  onSphereRemove: (slotIdx: number) => void;
  onRemove: () => void;
  onSkillOrderChange: (newOrders: [number, number, number]) => void;
  reorderMode: boolean;
  isReorderSelected: boolean;
  onReorderTap: () => void;
  onUnitReselect: () => void;
  sphereGameData?: (SphereGameData | undefined)[];
}) {
  const meta = useHeroMeta(unit.heroId);
  const sphereMetas = sphereGameData ?? [undefined, undefined];
  const [showSkills, setShowSkills] = useState(false);

  const moveSkill = (idx: number, dir: -1 | 1) => {
    const newOrders = [...unit.skillOrders] as [number, number, number];
    const swap = idx + dir;
    if (swap < 0 || swap > 2) return;
    [newOrders[idx], newOrders[swap]] = [newOrders[swap], newOrders[idx]];
    onSkillOrderChange(newOrders);
  };

  // スフィア合算ステータス計算
  type StatKey = 'hp' | 'phy' | 'int' | 'agi' | 'spr' | 'def';
  const STAT_KEYS: StatKey[] = ['hp', 'phy', 'int', 'def', 'spr', 'agi'];
  const STAT_LABELS: Record<StatKey, string> = { hp: 'HP', phy: '攻撃', int: '魔攻', def: '防御', spr: '魔防', agi: '敏捷' };
  const baseStats = meta?.attributes
    ? { hp: meta.attributes.hp, phy: meta.attributes.phy, int: meta.attributes.int,
        agi: meta.attributes.agi, spr: meta.attributes.spr, def: meta.attributes.def }
    : null;
  const sphereBonus = STAT_KEYS.reduce((acc, k) => {
    const gd0 = sphereGameData?.[0]; const gd1 = sphereGameData?.[1];
    acc[k] = ((k === 'hp' ? gd0?.param?.hp : k === 'phy' ? gd0?.param?.phy : k === 'int' ? gd0?.param?.int : k === 'agi' ? gd0?.param?.agi : k === 'spr' ? gd0?.param?.mnd : k === 'def' ? gd0?.param?.vit : gd0?.param?.agi) ?? 0)
           + ((k === 'hp' ? gd1?.param?.hp : k === 'phy' ? gd1?.param?.phy : k === 'int' ? gd1?.param?.int : k === 'agi' ? gd1?.param?.agi : k === 'spr' ? gd1?.param?.mnd : k === 'def' ? gd1?.param?.vit : gd1?.param?.agi) ?? 0);
    return acc;
  }, {} as Record<StatKey, number>);
  const totalStats = baseStats
    ? STAT_KEYS.reduce((acc, k) => { acc[k] = baseStats[k] + sphereBonus[k]; return acc; }, {} as Record<StatKey, number>)
    : null;

  const hasBB = !!meta?.attributes?.brave_burst;
  const hasArt = !!meta?.attributes?.art_skill;

  return (
    <div
      onClick={reorderMode ? onReorderTap : undefined}
      className={`border-2 rounded-lg bg-white overflow-hidden transition-all ${
        reorderMode
          ? isReorderSelected
            ? 'border-orange-500 ring-2 ring-orange-300 cursor-pointer shadow-md scale-[1.01]'
            : 'border-neutral-400 cursor-pointer hover:border-orange-400 hover:shadow'
          : 'border-neutral-200'
      }`}
    >
      {/* ユニット */}
      <div className="flex items-center gap-2 p-2 border-b border-neutral-100">
        <button
          onClick={!reorderMode ? onUnitReselect : undefined}
          className={`w-9 h-9 flex-shrink-0 rounded overflow-hidden bg-neutral-100 relative group ${!reorderMode ? 'cursor-pointer' : ''}`}
        >
          {meta?.image
            ? <img src={toFastUnitImageUrl(meta.image)} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full animate-pulse bg-neutral-200" />}
          {!reorderMode && (
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded flex items-center justify-center">
              <span className="text-white text-[8px] font-black opacity-0 group-hover:opacity-100">変更</span>
            </div>
          )}
        </button>
        <div
          onClick={!reorderMode ? onUnitReselect : undefined}
          className={`flex-1 min-w-0 ${!reorderMode ? 'cursor-pointer' : ''}`}
        >
          <p className="font-bold text-xs uppercase truncate">{meta?.attributes?.type_name ?? `Unit #${unit.heroId}`}</p>
          {/* ステータス6種（スフィア合算） */}
          {totalStats ? (
            <div className="grid grid-cols-3 gap-x-2 gap-y-0 mt-0.5">
              {STAT_KEYS.map(k => (
                <div key={k} className="flex items-baseline gap-0.5">
                  <span className="text-[8px] font-black text-neutral-400 w-5 flex-shrink-0">{STAT_LABELS[k]}</span>
                  <span className="text-[9px] font-mono text-neutral-700">{totalStats[k].toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-3 w-20 rounded animate-pulse bg-neutral-100 mt-1" />
          )}
        </div>
        {reorderMode ? (
          <span className={`text-[10px] font-black px-2 py-0.5 rounded ${isReorderSelected ? 'bg-orange-500 text-white' : 'bg-neutral-200 text-neutral-500'}`}>
            {isReorderSelected ? '選択中' : 'タップ'}
          </span>
        ) : (
          <button onClick={onRemove} className="text-neutral-300 hover:text-red-500 font-bold text-sm px-1 flex-shrink-0">×</button>
        )}
      </div>

      {/* スフィアスロット（色分け: スフィア1=青, スフィア2=緑） */}
      <div className="flex gap-1.5 px-2 py-1.5">
        {([
          { label: 'スフィア1', filledCls: 'border-blue-400 text-blue-700 bg-blue-50 hover:bg-blue-100', emptyCls: 'border-dashed border-blue-200 text-blue-300 hover:border-blue-400 hover:text-blue-400' },
          { label: 'スフィア2', filledCls: 'border-green-400 text-green-700 bg-green-50 hover:bg-green-100', emptyCls: 'border-dashed border-green-200 text-green-300 hover:border-green-400 hover:text-green-400' },
        ] as const).map(({ label, filledCls, emptyCls }, slotIdx) => {
          const sId = unit.sphereIds[slotIdx];
          const sMeta = sphereMetas[slotIdx];
          return (
            <div key={slotIdx} className="flex items-center gap-1 flex-1 min-w-0">
              <button
                onClick={() => onSphereClick(slotIdx)}
                className={`flex-1 flex items-center gap-1 text-[10px] font-bold px-1.5 py-1 border rounded transition-colors text-left min-w-0 ${sId ? filledCls : emptyCls}`}
              >
                {getSphereImageUrl(sphereMetas[slotIdx])
                  ? <img src={getSphereImageUrl(sphereMetas[slotIdx])!} alt="" className="w-5 h-5 object-contain flex-shrink-0 rounded" />
                  : <span className="text-[9px] font-black flex-shrink-0 opacity-60">{label[0]}{label.slice(-1)}</span>}
                <span className="truncate">
                  {sphereMetas[slotIdx]?.name_jp || sphereMetas[slotIdx]?.name || (sId ? `#${sId}` : label)}
                </span>
              </button>
              {sId && (
                <button onClick={() => onSphereRemove(slotIdx)}
                  className="text-neutral-300 hover:text-red-500 text-xs leading-none flex-shrink-0">×</button>
              )}
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

      {/* BB・アートスキル */}
      {(hasBB || hasArt) && !reorderMode && (
        <div className="border-t border-neutral-100">
          <button
            onClick={e => { e.stopPropagation(); setShowSkills(v => !v); }}
            className="w-full flex items-center justify-between px-2 py-1 text-[9px] font-black text-neutral-400 uppercase hover:bg-neutral-50 transition-colors"
          >
            <span>スキル詳細</span>
            <span>{showSkills ? '▲' : '▼'}</span>
          </button>
          {showSkills && (
            <div className="px-2 pb-2 space-y-1.5">
              {hasBB && (
                <div>
                  <p className="text-[8px] font-black text-purple-600 uppercase mb-0.5">Brave Burst</p>
                  <p className="text-[10px] text-neutral-600 leading-snug">{meta!.attributes.brave_burst}</p>
                </div>
              )}
              {hasArt && (
                <div>
                  <p className="text-[8px] font-black text-red-500 uppercase mb-0.5">Art Skill</p>
                  <p className="text-[10px] text-neutral-600 leading-snug">{meta!.attributes.art_skill}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// フィルターボタン（共通）
// ============================================================
// ============================================================
// デッキテンプレートリスト
// ============================================================
function DeckUnitIcon({ heroId }: { heroId: string }) {
  // useHeroMeta はマウント時の初期値を使うため、マウント後にキャッシュが埋まっても
  // 再レンダリングされない。独自カウンタで強制再評価する。
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (heroMetaCache[heroId]) return; // すでにキャッシュ済みなら不要
    const t = setInterval(() => {
      if (heroMetaCache[heroId]) { setTick(v => v + 1); clearInterval(t); }
    }, 200);
    return () => clearInterval(t);
  }, [heroId]);
  const meta = heroMetaCache[heroId] ?? null;
  return (
    <div className="w-7 h-7 rounded overflow-hidden bg-neutral-100 flex-shrink-0 border border-neutral-200">
      {meta?.image
        ? <img src={toFastUnitImageUrl(meta.image)} alt="" className="w-full h-full object-cover" />
        : <div className="w-full h-full animate-pulse bg-neutral-200" />}
    </div>
  );
}

function DeckCard({ deck, label, onLoad }: {
  deck: DeckTemplate;
  label: string;
  onLoad: (deck: DeckTemplate) => void;
}) {
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
      <div className="flex gap-1 flex-wrap">
        {sorted.map((u, i) => (
          <DeckUnitIcon key={i} heroId={String(u.hero_id)} />
        ))}
      </div>
      <p className="text-[9px] text-red-500 font-black mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        ▶ タップして編成に反映
      </p>
    </button>
  );
}

function DeckTemplateList({ deckTemplates, questDeckTemplates, heroMetaCache: _cache, onLoad }: {
  deckTemplates: DeckTemplate[];
  questDeckTemplates: DeckTemplate[];
  heroMetaCache: Record<string, unknown>;
  onLoad: (deck: DeckTemplate) => void;
}) {
  if (deckTemplates.length === 0 && questDeckTemplates.length === 0) {
    return <p className="text-[10px] text-neutral-400 font-mono py-4 text-center">パーティテンプレートがありません</p>;
  }
  return (
    <div className="space-y-3">
      {deckTemplates.length > 0 && (
        <div className="space-y-2">
          <p className="text-[9px] font-black text-neutral-400 uppercase">通常パーティ</p>
          {deckTemplates.map((deck, i) => (
            <DeckCard key={deck.jin_id} deck={deck} label={`パーティ ${i + 1}`} onLoad={onLoad} />
          ))}
        </div>
      )}
      {questDeckTemplates.length > 0 && (
        <div className="space-y-2">
          <p className="text-[9px] font-black text-neutral-400 uppercase">クエストパーティ</p>
          {questDeckTemplates.map((deck, i) => (
            <DeckCard key={deck.jin_id} deck={deck} label={`クエストパーティ ${i + 1}`} onLoad={onLoad} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterBtn({ label, active, tw, onClick }: {
  label: string; active: boolean; tw?: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className={`text-[10px] font-black px-2 py-0.5 rounded border transition-colors ${
        active ? (tw ? tw.replace('border-', 'bg-neutral-900 text-white border-') : 'bg-neutral-900 text-white border-neutral-900')
               : `border-neutral-300 text-neutral-500 hover:border-neutral-500 ${tw ?? ''}`
      }`}>
      {label}
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

  const { data: meData } = useGetV1Me();
  const { data: unitListData, isLoading: isLoadingUnits } = useGetV1MeUnits();
  const { data: sphereListData, isLoading: isLoadingSpheres } = useGetV1MeSpheres();
  const { data: deckData, isLoading: isLoadingDecks } = useGetV1DeckTemplates();

  // ゲームデータ（rarity/attribute）— Orvalフックで認証済みリクエスト
  const [heroGameMap, setHeroGameMap]     = useState<Record<string, HeroGameData>>({});
  const [sphereGameMap, setSphereGameMap] = useState<Record<string, SphereGameData>>({});
  const { mutate: fetchHeroGameData } = usePostV1Heroes({
    mutation: {
      onSuccess: (data) => {
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
    fetchHeroGameData({ data: { hero_ids: units.map(Number) } } as any);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitListData?.units]);

  useEffect(() => {
    const spheres = sphereListData?.spheres ?? [];
    if (sphereFetchedRef.current || spheres.length === 0) return;
    sphereFetchedRef.current = true;
    fetchSphereGameData({ data: { sphere_ids: spheres.map(Number) } } as any);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sphereListData?.spheres]);

  // スフィアメタをバックグラウンドでプリフェッチ（検索のため）
  // デッキ内ユニットをバックグラウンドでプリフェッチ（デッキタブのアイコン表示のため）
  // allDeckHeroIds を useMemo で安定させ、配列の中身が変わった時だけ useEffect を再実行する
  const allDeckHeroIds = useMemo(() => {
    const allDecks: DeckTemplate[] = [
      ...((deckData as any)?.deck_templates ?? []),
      ...((deckData as any)?.quest_deck_templates ?? []),
    ];
    return [...new Set(allDecks.flatMap(d => d.units.map(u => String(u.hero_id))))];
  }, [deckData]);

  useEffect(() => {
    if (allDeckHeroIds.length === 0) return;
    let idx = 0;
    const CONCURRENCY = 5;
    let active = 0;
    function next() {
      while (active < CONCURRENCY && idx < allDeckHeroIds.length) {
        const id = allDeckHeroIds[idx++];
        if (heroMetaCache[id]) { active > 0 ? null : next(); return; }
        active++;
        fetchHeroMeta(id, () => { active--; next(); });
      }
    }
    next();
  }, [allDeckHeroIds]);

  // UI状態
  const [unitSearch,    setUnitSearch]    = useState('');
  const [sphereSearch,  setSphereSearch]  = useState('');
  const [activeTab,     setActiveTab]     = useState<'party' | 'units' | 'spheres' | 'decks'>('decks');
  const [unitRarity,    setUnitRarity]    = useState<string | null>(null);
  const [unitAttr,      setUnitAttr]      = useState<number | null>(null);
  const [sphereRarity,  setSphereRarity]  = useState<string | null>(null);

  // パーティ状態
  // 5スロット固定配列（null=空き）でスロット位置を管理
  const maxUnits = 5;
  const [partySlots, setPartySlots] = useState<(SelectedUnit | null)[]>(Array(maxUnits).fill(null));
  // 後方互換用: null除いたリスト（バトル送信時など）
  const selectedUnits = partySlots.filter((u): u is SelectedUnit => u !== null);
  const [spherePickTarget, setSpherePickTarget] = useState<{ unitIdx: number; slotIdx: number } | null>(null);
  const [unitPickSlot, setUnitPickSlot] = useState<number | null>(null); // 空スロットタップ時の対象スロット番号
  const [swapHeroId, setSwapHeroId] = useState<string | null>(null);     // 5体満員時の入れ替え対象ユニットID
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderFirstIdx, setReorderFirstIdx] = useState<number | null>(null);

  // バトル状態
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null);
  const [battleError,  setBattleError]  = useState<string | null>(null);

  // 検索のためNFTキャッシュを定期同期
  const [unitMetaSnap,   setUnitMetaSnap]   = useState<Record<string, HeroMetadata>>({});
  useEffect(() => {
    const t = setInterval(() => {
      const nh = Object.entries(heroMetaCache).filter(([k]) => !unitMetaSnap[k]);
      if (nh.length) setUnitMetaSnap(p => ({ ...p, ...Object.fromEntries(nh) }));
    }, 500);
    return () => clearInterval(t);
  }, [unitMetaSnap]);

  // フィルター済みリスト
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

  const { mutate: simulateBattle, isPending: isBattling } = usePostV1BattleSimulate({
    mutation: {
      onSuccess: (data) => {
        const res = data as any;
        const result: number = res?.result ?? 2;
        setBattleResult({
          result,
          battle_key: res?.battle_key ?? '',
          attacker_taken_damage: res?.attacker_taken_damage ?? 0,
          defender_taken_damage: res?.defender_taken_damage ?? 0,
          action_counts: res?.action_counts ?? 0,
          player_name: res?.player_name ?? '',
          opponent_name: res?.opponent_name ?? '',
        });
        // クリア記録を保存
        const outcome = result === 1 ? 'WIN' : result === 0 ? 'DRAW' : 'LOSE';
        saveClearRecord(stageId, outcome);
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

  // アクション
  // スロット指定でユニットをセット（unitPickSlot指定時）or 末尾の空きスロットへ
  const assignUnitToSlot = (heroId: string, targetSlot?: number) => {
    setPartySlots(prev => {
      const next = [...prev];
      // すでにどこかにいたら外す（同じユニットを再タップした場合 = 除外）
      const existingIdx = next.findIndex(u => u?.heroId === heroId);
      if (existingIdx !== -1) {
        next[existingIdx] = null;
        return next;
      }
      // 入れ先を決定
      const slot = targetSlot ?? next.findIndex(u => u === null);
      if (slot === -1 || slot >= maxUnits) return prev;
      // スロットにすでに別ユニットがいる場合: スフィア・スキル順を引き継いで差し替え
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

  // デッキテンプレートをパーティに読み込む
  const loadDeckTemplate = (deck: DeckTemplate) => {
    const next: (SelectedUnit | null)[] = Array(maxUnits).fill(null);
    const sorted = [...deck.units].sort((a, b) => a.position - b.position).slice(0, maxUnits);
    sorted.forEach((u, i) => {
      const sphereIds: [string | null, string | null] = [
        u.extension_ids[0] != null ? String(u.extension_ids[0]) : null,
        u.extension_ids[1] != null ? String(u.extension_ids[1]) : null,
      ];
      const skillOrders = (u.skill_orders?.length === 3
        ? u.skill_orders
        : [0, 1, 2]) as [number, number, number];
      next[i] = { heroId: String(u.hero_id), sphereIds, skillOrders };
    });
    // sphereGameMap にないスフィアID（特殊スフィア等）を追加fetch
    const allSphereIds = sorted.flatMap(u => u.extension_ids).filter(id => id && id !== 0 && !sphereGameMap[String(id)]);
    if (allSphereIds.length > 0) {
      fetchSphereGameData({ data: { sphere_ids: allSphereIds } } as any);
    }
    setPartySlots(next);
    setActiveTab('party');
  };

  // 後方互換（ユニット一覧のカードから直接タップ時）
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
    ? `https://bravefrontierheroes.com/ja/battle/${battleResult.battle_key}?returnUrl=https://brave-four-heroes-arena.vercel.app/stages`
    : null;

  // ---- 結果画面 ----
  if (battleResult) {
    const isWin  = battleResult.result === 1;
    const isDraw = battleResult.result === 0;
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6">
          <Card className="cyber-card border-2 border-neutral-900 text-center overflow-hidden">
            <div className={`p-8 ${isWin ? 'bg-yellow-50' : isDraw ? 'bg-neutral-100' : 'bg-red-50'}`}>
              {isWin ? <Crown className="w-20 h-20 text-yellow-500 mx-auto mb-4" />
               : isDraw ? <Minus className="w-20 h-20 text-neutral-500 mx-auto mb-4" />
               : <Skull className="w-20 h-20 text-red-500 mx-auto mb-4" />}
              <h1 className={`text-5xl font-black uppercase tracking-widest ${isWin ? 'text-yellow-600' : isDraw ? 'text-neutral-600' : 'text-red-600'}`}>
                {isWin ? 'WIN' : isDraw ? 'DRAW' : 'LOSE'}
              </h1>
              <p className="text-neutral-500 font-mono mt-2">Stage {stage.id} — {stage.name}</p>
            </div>
            <CardContent className="pt-6 space-y-4 bg-white">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="text-center">
                  <p className="text-neutral-400 font-bold uppercase text-xs mb-1">受けたダメージ</p>
                  <p className="text-2xl font-black font-mono text-red-600">{(battleResult.attacker_taken_damage ?? 0).toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-neutral-400 font-bold uppercase text-xs mb-1">与えたダメージ</p>
                  <p className="text-2xl font-black font-mono text-green-600">{(battleResult.defender_taken_damage ?? 0).toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-neutral-400 font-bold uppercase text-xs mb-1">アクション数</p>
                  <p className="text-2xl font-black font-mono text-neutral-700">{battleResult.action_counts}</p>
                </div>
              </div>
              {replayUrl && (
                <a href={replayUrl} target="_blank" rel="noopener noreferrer">
                  <Button className="w-full bg-neutral-900 text-white hover:bg-blue-700 font-bold uppercase">
                    <ExternalLink className="w-4 h-4 mr-2" />戦闘を見る
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
              className="cyber-button border-neutral-900 text-neutral-900 hover:bg-neutral-900 hover:text-white flex-shrink-0 w-8 h-8">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1">
              <h2 className="text-base font-black uppercase">スフィアを選択</h2>
              <p className="text-neutral-500 font-mono text-xs">ユニット{spherePickTarget.unitIdx + 1} — スロット{spherePickTarget.slotIdx + 1}</p>
            </div>
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input type="text" placeholder="検索..." value={sphereSearch} onChange={e => setSphereSearch(e.target.value)}
                className="pl-6 pr-3 py-1.5 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-blue-500 w-28" />
            </div>
          </div>
          {/* レアリティフィルター */}
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
  // メイン編成画面（3カラム）
  // ============================================================
  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {/* ヘッダー */}
      <div className="bg-white border-b-2 border-neutral-900 px-3 py-2 flex items-center gap-2 sticky top-0 z-10">
        <Button variant="outline" size="icon" onClick={() => router.push('/stages')}
          className="cyber-button border-neutral-900 text-neutral-900 hover:bg-neutral-900 hover:text-white flex-shrink-0 w-8 h-8">
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
          className="!bg-red-700 hover:!bg-red-800 !text-white font-black uppercase px-4 h-9 flex-shrink-0 disabled:opacity-40 text-xs"
          disabled={selectedUnits.length === 0 || isBattling}
          onClick={handleBattle}
        >
          {isBattling ? <span className="animate-pulse">⚔️ 戦闘中...</span> : <><Swords className="w-3.5 h-3.5 mr-1" />バトル！</>}
        </Button>
      </div>

      {battleError && <p className="text-red-500 font-bold text-center font-mono text-xs py-1.5 bg-red-50">{battleError}</p>}

      {/* 入れ替えモーダル（5体満員時） */}
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
                const m = heroMetaCache[u.heroId];
                return (
                  <button key={slotIdx}
                    onClick={() => { assignUnitToSlot(swapHeroId, slotIdx); setSwapHeroId(null); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-200 hover:border-red-400 hover:bg-red-50 transition-colors text-left"
                  >
                    <div className="w-8 h-8 flex-shrink-0 rounded overflow-hidden bg-neutral-100">
                      {m?.image
                        ? <img src={toFastUnitImageUrl(m.image)} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full bg-neutral-200 animate-pulse" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold uppercase truncate">{m?.attributes?.type_name ?? `Unit #${u.heroId}`}</p>
                      <p className="text-[9px] text-neutral-400 font-mono">スロット {slotIdx + 1}</p>
                    </div>
                    <span className="text-[10px] font-black text-red-500">入替</span>
                  </button>
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
            className={`flex-1 py-2 text-[11px] font-black uppercase tracking-wide transition-colors ${
              activeTab === tab ? 'border-b-2 border-red-600 text-red-600' : 'text-neutral-400 hover:text-neutral-700'
            }`}>
            {tab === 'party' ? `パーティ (${selectedUnits.length}/${maxUnits})` : tab === 'units' ? 'ユニット' : tab === 'spheres' ? 'スフィア' : 'パーティ一覧'}
          </button>
        ))}
      </div>

      {/* 3カラム */}
      <div className="flex-1 lg:grid lg:grid-cols-[260px_1fr_1fr_220px] lg:overflow-hidden">

        {/* ── パーティ ── */}
        <div className={`lg:flex lg:flex-col lg:border-r-2 border-neutral-200 lg:overflow-y-auto ${activeTab !== 'party' ? 'hidden lg:flex' : ''}`}>
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">パーティ ({selectedUnits.length}/{maxUnits})</p>
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
                      <SelectedUnitRow key={u.heroId} unit={u}
                        onSphereClick={si => { if (!reorderMode) setSpherePickTarget({ unitIdx: slotIdx, slotIdx: si }); }}
                        onSphereRemove={si => { if (!reorderMode) removeSphere(slotIdx, si); }}
                        onRemove={() => { if (!reorderMode) removeUnitFromSlot(slotIdx); }}
                        onSkillOrderChange={orders => updateSkillOrders(slotIdx, orders)}
                        reorderMode={reorderMode}
                        isReorderSelected={reorderFirstIdx === slotIdx}
                        onReorderTap={() => handleReorderTap(slotIdx)}
                        onUnitReselect={() => { setUnitPickSlot(slotIdx); setActiveTab('units'); }}
                        sphereGameData={u.sphereIds.map(sid => sid ? sphereGameMap[sid] : undefined)} />
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
        <div className={`lg:flex lg:flex-col lg:border-r-2 border-neutral-200 lg:overflow-y-auto ${activeTab !== 'units' ? 'hidden lg:flex' : ''}`}>
          <div className="p-3 space-y-2">
            {/* 検索 */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input type="text" placeholder="名前 / BB名で検索..." value={unitSearch} onChange={e => setUnitSearch(e.target.value)}
                className="w-full pl-8 pr-8 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-red-400 bg-white" />
              {unitSearch && <button onClick={() => setUnitSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-3 h-3 text-neutral-400" /></button>}
            </div>
            {/* レアリティ */}
            <div className="flex gap-1 flex-wrap">
              {UNIT_RARITY_FILTERS.map(r => (
                <FilterBtn key={r} label={r} active={unitRarity === r} onClick={() => setUnitRarity(unitRarity === r ? null : r)} />
              ))}
            </div>
            {/* 属性 */}
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
              <div className="grid grid-cols-3 gap-2">{Array.from({length:9}).map((_,i)=><div key={i} className="aspect-square bg-neutral-100 rounded animate-pulse"/>)}</div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {filteredUnits.map(heroId => {
                  const isSelected = selectedUnits.some(u => u.heroId === heroId);
                  const isDisabled = false; // 満員時は入れ替えモーダルで対応するので disabled にしない
                  return (
                    <UnitMiniCard key={heroId} heroId={heroId} isSelected={isSelected} isDisabled={isDisabled}
                      gameData={heroGameMap[heroId]}
                      onClick={() => {
                        if (isSelected) {
                          toggleUnit(heroId);
                        } else if (selectedUnits.length >= maxUnits) {
                          // 満員→入れ替えモーダル
                          setSwapHeroId(heroId);
                          setActiveTab('party');
                        } else {
                          assignUnitToSlot(heroId, unitPickSlot ?? undefined);
                          setActiveTab('party');
                        }
                      }} />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── スフィア一覧 ── */}
        <div className={`lg:flex lg:flex-col lg:overflow-y-auto ${activeTab !== 'spheres' ? 'hidden lg:flex' : ''}`}>
          <div className="p-3 space-y-2">
            {/* 検索 */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input type="text" placeholder="スフィア検索..." value={sphereSearch} onChange={e => setSphereSearch(e.target.value)}
                className="w-full pl-8 pr-8 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-blue-400 bg-white" />
              {sphereSearch && <button onClick={() => setSphereSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-3 h-3 text-neutral-400" /></button>}
            </div>
            {/* レアリティ */}
            <div className="flex gap-1 flex-wrap">
              {SPHERE_RARITY_FILTERS.map(r => (
                <FilterBtn key={r} label={r} active={sphereRarity === r} onClick={() => setSphereRarity(sphereRarity === r ? null : r)} />
              ))}
            </div>
            <p className="text-[10px] text-neutral-400 font-mono">{filteredSpheres.length}個 — パーティタブのスロットから装備</p>
            {isLoadingSpheres ? (
              <div className="grid grid-cols-3 gap-2">{Array.from({length:9}).map((_,i)=><div key={i} className="aspect-square bg-neutral-100 rounded animate-pulse"/>)}</div>
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
        <div className={`lg:flex lg:flex-col lg:border-l-2 border-neutral-200 lg:overflow-y-auto ${activeTab !== 'decks' ? 'hidden lg:flex' : ''}`}>
          <div className="p-3 space-y-2">
            <p className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">パーティ一覧</p>
            <p className="text-[9px] text-neutral-400 font-mono">読み込むと編成に反映されます</p>
            {isLoadingDecks ? (
              <div className="space-y-2">{Array.from({length:4}).map((_,i)=><div key={i} className="h-16 bg-neutral-100 rounded animate-pulse"/>)}</div>
            ) : (
              <DeckTemplateList
                deckTemplates={(deckData as any)?.deck_templates ?? []}
                questDeckTemplates={(deckData as any)?.quest_deck_templates ?? []}
                heroMetaCache={heroMetaCache}
                onLoad={loadDeckTemplate}
              />
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
