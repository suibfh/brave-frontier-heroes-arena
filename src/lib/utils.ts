import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * battle_idからバトルログURLを生成
 * @param battleId - バトルID (例: 12345678)
 * @returns バトルログJSONのURL
 */
export function getBattleLogUrl(battleId: number | string): string {
  const id = battleId.toString();
  const directory = id.substring(0, 6);
  return `https://rsc.bravefrontierheroes.com/battle/duel/${directory}/${id}.json`;
}

/**
 * battle_idからバトル再生URLを生成
 * @param battleId - バトルID (例: 12345678)
 * @param lang - 言語コード (デフォルト: 'ja')
 * @returns バトル再生ページのURL
 */
export function getBattleReplayUrl(
  battleId: number | string,
  lang: string = 'ja'
): string {
  return `https://bravefrontierheroes.com/${lang}/battle/${battleId}`;
}

/**
 * ヒーローIDからメタデータURLを生成
 * @param heroId - ヒーローID
 * @returns メタデータJSONのURL
 */
export function getHeroMetadataUrl(heroId: number | string): string {
  return `https://core.bravefrontierheroes.com/metadata/units/${heroId}`;
}
