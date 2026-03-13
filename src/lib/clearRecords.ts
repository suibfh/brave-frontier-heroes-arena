// ============================================================
// src/lib/clearRecords.ts
// ステージクリア記録 — localStorage ユーティリティ
// ============================================================

const STORAGE_KEY = 'bfh_arena_clear_records';

export type BattleOutcome = 'WIN' | 'DRAW' | 'LOSE';

export interface ClearRecord {
  stageId: number;
  firstClearedAt: string;   // 初回クリア日時 (ISO string)
  bestResult: BattleOutcome; // 最高結果（WIN > DRAW > LOSE の順）
  attempts: number;          // 総挑戦回数
  wins: number;              // 勝利回数
  draws: number;             // 引き分け回数
  lastPlayedAt: string;      // 最終プレイ日時 (ISO string)
}

type RecordsMap = Record<number, ClearRecord>;

// -------- 読み書き --------

function loadRecords(): RecordsMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveRecords(map: RecordsMap): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage が使えない環境（プライベートブラウザ容量超過等）は無視
  }
}

// -------- 結果の強さ比較 --------

const OUTCOME_RANK: Record<BattleOutcome, number> = { WIN: 2, DRAW: 1, LOSE: 0 };

function betterOutcome(a: BattleOutcome, b: BattleOutcome): BattleOutcome {
  return OUTCOME_RANK[a] >= OUTCOME_RANK[b] ? a : b;
}

// -------- Public API --------

/** バトル結果を保存（毎回呼ぶ） */
export function saveClearRecord(stageId: number, outcome: BattleOutcome): ClearRecord {
  const map = loadRecords();
  const now = new Date().toISOString();
  const existing = map[stageId];

  if (existing) {
    const updated: ClearRecord = {
      ...existing,
      bestResult: betterOutcome(existing.bestResult, outcome),
      attempts: existing.attempts + 1,
      wins:     outcome === 'WIN'  ? existing.wins  + 1 : existing.wins,
      draws:    outcome === 'DRAW' ? existing.draws + 1 : existing.draws,
      lastPlayedAt: now,
      // 初回クリア日時は WIN/DRAW 時にのみ上書きしない（初回のまま保持）
      firstClearedAt: existing.firstClearedAt,
    };
    map[stageId] = updated;
    saveRecords(map);
    return updated;
  } else {
    const created: ClearRecord = {
      stageId,
      firstClearedAt: now,
      bestResult: outcome,
      attempts: 1,
      wins:  outcome === 'WIN'  ? 1 : 0,
      draws: outcome === 'DRAW' ? 1 : 0,
      lastPlayedAt: now,
    };
    map[stageId] = created;
    saveRecords(map);
    return created;
  }
}

/** 1ステージの記録を取得（未プレイは null） */
export function getClearRecord(stageId: number): ClearRecord | null {
  const map = loadRecords();
  return map[stageId] ?? null;
}

/** 全ステージの記録を取得 */
export function getAllClearRecords(): RecordsMap {
  return loadRecords();
}

/** 指定ステージIDのリストが全部 WIN になっているか */
export function isAllCleared(stageIds: number[]): boolean {
  const map = loadRecords();
  return stageIds.every(id => map[id]?.bestResult === 'WIN');
}

/** 全記録をリセット（デバッグ用） */
export function resetAllRecords(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
