// ============================================================
// ステージ設定
// ※ 編集は /admin/stages ページで行い、生成されたコードをここに貼り付けてpushしてください
// ============================================================

export interface DefenderUnit {
  hero_id: number;
  position: number;
  extension_ids: number[];   // スフィアのID（最大2つ）
  skill_orders: number[];    // [0,1,2] など（0=アート, 1=スフィア1, 2=スフィア2）
}

export interface Stage {
  id: number;
  name: string;
  description: string;
  difficulty: number;        // 1〜5（星の数）
  defender_uid: number;
  defender_units: DefenderUnit[];
  allowedBfhaIds: number[] | null; // null=全員OK, [0,1,5]=指定IDのみ
}

export const STAGES: Stage[] = [
  {
    id: 1,
    name: "1 BFHA：1 STAGE",
    description: "カスタムステージに挑戦できます。suiの手持ちのみ対応可能、作成後の設定変更不可。",
    difficulty: 1,
    defender_uid: 100006912,
    defender_units: [
      {
        hero_id: 20200228,
        position: 1,
        extension_ids: [],
        skill_orders: [1, 2, 0],
      },
    ],
    allowedBfhaIds: null,
  },
  {
    id: 2,
    name: "バトルは最大200アクション",
    description: "遅く倒せ",
    difficulty: 5,
    defender_uid: 100006911,
    defender_units: [
      {
        hero_id: 51980007,
        position: 1,
        extension_ids: [51430001, 191126652],
        skill_orders: [1, 2, 0],
      },
      {
        hero_id: 52060017,
        position: 2,
        extension_ids: [51180033, 51300044],
        skill_orders: [1, 2, 0],
      },
      {
        hero_id: 52020097,
        position: 3,
        extension_ids: [41180021, 51060002],
        skill_orders: [1, 2, 0],
      },
      {
        hero_id: 51630025,
        position: 4,
        extension_ids: [51180025, 51300008],
        skill_orders: [1, 2, 0],
      },
      {
        hero_id: 51250011,
        position: 5,
        extension_ids: [194303767, 51200009],
        skill_orders: [1, 2, 0],
      },
    ],
    allowedBfhaIds: null,
  },
  {
    id: 3,
    name: "Stage 3",
    description: "テスト1",
    difficulty: 3,
    defender_uid: 100006912,
    defender_units: [
      {
        hero_id: 51250011,
        position: 1,
        extension_ids: [],
        skill_orders: [1, 2, 0],
      },
    ],
    allowedBfhaIds: [1],
  },
];
