/** 県庁所在地（代表庁舎）の経緯度 [longitude, latitude] */
export interface PrefectureCapital {
  kanji: string;
  lon: number;
  lat: number;
}

export const PREFECTURE_CAPITALS: PrefectureCapital[] = [
  { kanji: '北海道', lon: 141.3469, lat: 43.0642 },
  { kanji: '青森県', lon: 140.74, lat: 40.8244 },
  { kanji: '岩手県', lon: 141.1527, lat: 39.7036 },
  { kanji: '宮城県', lon: 140.8694, lat: 38.2682 },
  { kanji: '秋田県', lon: 140.1024, lat: 39.7186 },
  { kanji: '山形県', lon: 140.3636, lat: 38.2404 },
  { kanji: '福島県', lon: 140.4747, lat: 37.75 },
  { kanji: '茨城県', lon: 140.4468, lat: 36.3418 },
  { kanji: '栃木県', lon: 139.8836, lat: 36.5658 },
  { kanji: '群馬県', lon: 139.0608, lat: 36.3911 },
  { kanji: '埼玉県', lon: 139.6489, lat: 35.8617 },
  { kanji: '千葉県', lon: 140.1233, lat: 35.6047 },
  { kanji: '東京都', lon: 139.6917, lat: 35.6896 },
  { kanji: '神奈川県', lon: 139.638, lat: 35.4478 },
  { kanji: '新潟県', lon: 139.0236, lat: 37.9022 },
  { kanji: '富山県', lon: 137.2113, lat: 36.6953 },
  { kanji: '石川県', lon: 136.6256, lat: 36.5947 },
  { kanji: '福井県', lon: 136.2216, lat: 36.0652 },
  { kanji: '山梨県', lon: 138.5689, lat: 35.6642 },
  { kanji: '長野県', lon: 138.181, lat: 36.6513 },
  { kanji: '岐阜県', lon: 136.7607, lat: 35.3912 },
  { kanji: '静岡県', lon: 138.3831, lat: 34.9756 },
  { kanji: '愛知県', lon: 136.9066, lat: 35.1815 },
  { kanji: '三重県', lon: 136.5086, lat: 34.7303 },
  { kanji: '滋賀県', lon: 135.8686, lat: 35.0045 },
  { kanji: '京都府', lon: 135.7556, lat: 35.0211 },
  { kanji: '大阪府', lon: 135.5023, lat: 34.6863 },
  { kanji: '兵庫県', lon: 135.1955, lat: 34.6913 },
  { kanji: '奈良県', lon: 135.8336, lat: 34.6851 },
  { kanji: '和歌山県', lon: 135.1675, lat: 34.2261 },
  { kanji: '鳥取県', lon: 134.2377, lat: 35.5014 },
  { kanji: '島根県', lon: 133.0505, lat: 35.4723 },
  { kanji: '岡山県', lon: 133.935, lat: 34.6618 },
  { kanji: '広島県', lon: 132.4553, lat: 34.3963 },
  { kanji: '山口県', lon: 131.4714, lat: 34.1859 },
  { kanji: '徳島県', lon: 134.5593, lat: 34.0658 },
  { kanji: '香川県', lon: 134.0434, lat: 34.3401 },
  { kanji: '愛媛県', lon: 132.7657, lat: 33.8416 },
  { kanji: '高知県', lon: 133.5311, lat: 33.5597 },
  { kanji: '福岡県', lon: 130.4017, lat: 33.6064 },
  { kanji: '佐賀県', lon: 130.3019, lat: 33.2494 },
  { kanji: '長崎県', lon: 129.8737, lat: 32.7448 },
  { kanji: '熊本県', lon: 130.7417, lat: 32.7898 },
  { kanji: '大分県', lon: 131.6126, lat: 33.2382 },
  { kanji: '宮崎県', lon: 131.4239, lat: 31.9111 },
  { kanji: '鹿児島県', lon: 130.5571, lat: 31.5602 },
  { kanji: '沖縄県', lon: 127.6809, lat: 26.2124 },
];

export const prefectureCapitalByKanji = new Map(
  PREFECTURE_CAPITALS.map((c) => [c.kanji, c]),
);
