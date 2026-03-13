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
}

export const STAGES: Stage[] = [
  {
    id: 1,
    name: "挑発を使ってみよう",
    description: "攻撃を吸い寄せて、アタッカーを守ろう",
    difficulty: 1,
    defender_uid: 100006912,
    defender_units: [
      {
        hero_id: 20200228,
        position: 1,
        extension_ids: [],
        skill_orders: [1, 2, 0],
      },
      {
        hero_id: 20400044,
        position: 2,
        extension_ids: [],
        skill_orders: [1, 2, 0],
      },
    ],
  },
  {
    id: 2,
    name: "フォーカスを合わせよう",
    description: "攻撃対象を合わせて、敵を倒そう",
    difficulty: 1,
    defender_uid: 100006912,
    defender_units: [
      {
        hero_id: 20440350,
        position: 1,
        extension_ids: [],
        skill_orders: [0, 1, 2],
      },
      {
        hero_id: 20340090,
        position: 2,
        extension_ids: [],
        skill_orders: [0, 1, 2],
      },
      {
        hero_id: 20230004,
        position: 3,
        extension_ids: [],
        skill_orders: [0, 1, 2],
      },
      {
        hero_id: 20200228,
        position: 4,
        extension_ids: [],
        skill_orders: [1, 2, 0],
      },
      {
        hero_id: 20400044,
        position: 5,
        extension_ids: [],
        skill_orders: [1, 2, 0],
      },
    ],
  },
  {
    id: 3,
    name: "弱点を突いてみよう",
    description: "弱点攻撃でダメージ1.3倍！軽減効果はないよ",
    difficulty: 1,
    defender_uid: 100006912,
    defender_units: [
      {
        hero_id: 20120143,
        position: 1,
        extension_ids: [],
        skill_orders: [0, 1, 2],
      },
      {
        hero_id: 20150088,
        position: 2,
        extension_ids: [],
        skill_orders: [0, 1, 2],
      },
      {
        hero_id: 20180055,
        position: 3,
        extension_ids: [],
        skill_orders: [0, 1, 2],
      },
      {
        hero_id: 20250030,
        position: 4,
        extension_ids: [],
        skill_orders: [0, 1, 2],
      },
      {
        hero_id: 20260039,
        position: 5,
        extension_ids: [],
        skill_orders: [0, 1, 2],
      },
    ],
  },
  {
    id: 4,
    name: "列攻撃を使おう",
    description: "範囲攻撃でまとめて倒そう",
    difficulty: 3,
    defender_uid: 100006912,
    defender_units: [
      {
        hero_id: 20200228,
        position: 1,
        extension_ids: [10761157],
        skill_orders: [1, 2, 0],
      },
      {
        hero_id: 20390852,
        position: 2,
        extension_ids: [10821496],
        skill_orders: [1, 2, 0],
      },
      {
        hero_id: 20390852,
        position: 3,
        extension_ids: [10821496],
        skill_orders: [1, 2, 0],
      },
      {
        hero_id: 20390852,
        position: 4,
        extension_ids: [10762414],
        skill_orders: [1, 2, 0],
      },
      {
        hero_id: 20390852,
        position: 5,
        extension_ids: [10761427],
        skill_orders: [1, 2, 0],
      },
    ],
  },
  {
    id: 5,
    name: "バトルは最大200アクション",
    description: "遅く倒せ",
    difficulty: 5,
    defender_uid: 100006912,
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
  },
];

