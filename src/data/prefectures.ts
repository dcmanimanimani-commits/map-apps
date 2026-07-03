export interface Prefecture {
  id: number;
  kanji: string;
  hiragana: string;
  region: string;
  subRegion?: string;
  landmark: string;
  landmarkEmoji: string;
  color: string;
}

/** 参考地図どおりの地方別カラー */
export const REGION_COLORS: Record<string, string> = {
  北海道: '#1a4080',
  東北: '#4a90d9',
  関東: '#1a7030',
  中部: '#7cb342',
  近畿: '#ff7700',
  中国: '#c87830',
  四国: '#e8a0b0',
  九州: '#c41e7a',
  沖縄: '#c41e7a',
};

export function getRegionColor(region: string): string {
  return REGION_COLORS[region] ?? '#888888';
}

export function getShortKanji(kanji: string): string {
  if (kanji === '北海道') return '北海道';
  return kanji.replace(/[都道府県]/g, '');
}

/** 地図ラベル用の短いひらがな */
export function getShortHiragana(kanji: string, hiragana: string): string {
  if (kanji === '北海道') return hiragana;
  return hiragana.replace(/(けん|とう|ふ|と)$/, '');
}

export function getKanjiChars(kanji: string): string[] {
  return [...getShortKanji(kanji)];
}

/** 手書き練習用（県・府・都も含む） */
export function getWriteKanjiChars(kanji: string): string[] {
  return [...kanji];
}

export function shufflePrefectures(pool: Prefecture[]): Prefecture[] {
  const list = [...pool];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export function buildKanjiWriteQueue(mode: 'regional' | 'national', regionId?: string): Prefecture[] {
  if (mode === 'national') {
    return shufflePrefectures(prefectures).slice(0, 20);
  }
  if (!regionId) return [];
  return shufflePrefectures(getPrefecturesByRegion(regionId));
}

const P = (
  id: number,
  kanji: string,
  hiragana: string,
  region: string,
  landmark: string,
  landmarkEmoji: string,
  subRegion?: string,
): Prefecture => ({
  id,
  kanji,
  hiragana,
  region,
  subRegion,
  landmark,
  landmarkEmoji,
  color: getRegionColor(region),
});

export const prefectures: Prefecture[] = [
  P(1, '北海道', 'ほっかいどう', '北海道', 'ジャガイモ・雪まつり', '🥔'),
  P(2, '青森県', 'あおもりけん', '東北', 'りんご・ねぶた祭り', '🍎'),
  P(3, '岩手県', 'いわてけん', '東北', 'わんこそば・平泉', '🍜'),
  P(4, '宮城県', 'みやぎけん', '東北', '牛タン・松島', '🐮'),
  P(5, '秋田県', 'あきたけん', '東北', 'きりたんぽ・なまはげ', '🌾'),
  P(6, '山形県', 'やまがたけん', '東北', 'さくらんぼ・蔵王', '🍒'),
  P(7, '福島県', 'ふくしまけん', '東北', '桃・会津ままどう', '🍑'),
  P(8, '茨城県', 'いばらきけん', '関東', 'メロン・偕楽園', '🍈'),
  P(9, '栃木県', 'とちぎけん', '関東', 'いちご・日光', '🍓'),
  P(10, '群馬県', 'ぐんまけん', '関東', 'こんにゃく・草津温泉', '♨️'),
  P(11, '埼玉県', 'さいたまけん', '関東', '草加せんべい', '🍘'),
  P(12, '千葉県', 'ちばけん', '関東', '落花生・ディズニーランド', '🥜'),
  P(13, '東京都', 'とうきょうと', '関東', '東京タワー・スカイツリー', '🗼'),
  P(14, '神奈川県', 'かながわけん', '関東', '横浜中華街・鎌倉大仏', '⛩️'),
  P(15, '新潟県', 'にいがたけん', '中部', 'コシヒカリ・佐渡', '🍚', '甲信越'),
  P(16, '富山県', 'とやまけん', '中部', 'ホタルイカ・立山', '🦑', '北陸'),
  P(17, '石川県', 'いしかわけん', '中部', '金沢・兼六園', '🏯', '北陸'),
  P(18, '福井県', 'ふくいけん', '中部', '越前ガニ・東尋坊', '🦀', '北陸'),
  P(19, '山梨県', 'やまなしけん', '中部', 'ぶどう・富士山', '🍇', '甲信越'),
  P(20, '長野県', 'ながのけん', '中部', 'そば・軽井沢', '🏔️', '甲信越'),
  P(21, '岐阜県', 'ぎふけん', '中部', '飛騨牛・白川郷', '🏠', '東海'),
  P(22, '静岡県', 'しずおかけん', '中部', 'お茶・富士山', '🍵', '東海'),
  P(23, '愛知県', 'あいちけん', '中部', '味噌カツ・名古屋城', '🏰', '東海'),
  P(24, '三重県', 'みえけん', '近畿', '伊勢神宮・松阪牛', '🐄'),
  P(25, '滋賀県', 'しがけん', '近畿', '琵琶湖・彦根城', '🌊'),
  P(26, '京都府', 'きょうとふ', '近畿', '金閣寺・お抹茶', '⛩️'),
  P(27, '大阪府', 'おおさかふ', '近畿', 'たこ焼き・通天閣', '🐙'),
  P(28, '兵庫県', 'ひょうごけん', '近畿', '神戸牛・姫路城', '🏯'),
  P(29, '奈良県', 'ならけん', '近畿', '鹿・東大寺', '🦌'),
  P(30, '和歌山県', 'わかやまけん', '近畿', 'みかん・高野山', '🍊'),
  P(31, '鳥取県', 'とっとりけん', '中国', '二十世紀梨・砂丘', '🍐'),
  P(32, '島根県', 'しまねけん', '中国', '出雲そば・出雲大社', '⛩️'),
  P(33, '岡山県', 'おかやまけん', '中国', '桃太郎・後楽園', '🍑'),
  P(34, '広島県', 'ひろしまけん', '中国', 'お好み焼き・宮島', '🍳'),
  P(35, '山口県', 'やまぐちけん', '中国', 'ふぐ・錦帯橋', '🐡'),
  P(36, '徳島県', 'とくしまけん', '四国', 'すだち・阿波踊り', '💃'),
  P(37, '香川県', 'かがわけん', '四国', 'うどん・金刀比羅宮', '🍜'),
  P(38, '愛媛県', 'えひめけん', '四国', 'みかん・道後温泉', '🍊'),
  P(39, '高知県', 'こうちけん', '四国', 'かつおのたたき・よさこい', '🐟'),
  P(40, '福岡県', 'ふくおかけん', '九州', '博多ラーメン・太宰府', '🍜'),
  P(41, '佐賀県', 'さがけん', '九州', '有田焼・バルーン', '🎈'),
  P(42, '長崎県', 'ながさきけん', '九州', 'カステラ・ハウステンボス', '🍰'),
  P(43, '熊本県', 'くまもとけん', '九州', '熊本城・くまモン', '🐻'),
  P(44, '大分県', 'おおいたけん', '九州', '温泉・別府', '♨️'),
  P(45, '宮崎県', 'みやざきけん', '九州', 'マンゴー・高千穂', '🥭'),
  P(46, '鹿児島県', 'かごしまけん', '九州', 'さつまいも・桜島', '🌋'),
  P(47, '沖縄県', 'おきなわけん', '九州', 'シーサー・美ら海', '🏝️'),
];

export const prefectureByKanji = new Map(prefectures.map((p) => [p.kanji, p]));
export const prefectureById = new Map(prefectures.map((p) => [p.id, p]));

export function getRandomPrefecture(exclude?: Prefecture, pool = prefectures): Prefecture {
  const list = exclude ? pool.filter((p) => p.id !== exclude.id) : pool;
  return list[Math.floor(Math.random() * list.length)];
}

export function getPrefecturesByRegion(regionId: string): Prefecture[] {
  const regionMap: Record<string, string> = {
    hokkaido: '北海道',
    tohoku: '東北',
    kanto: '関東',
    chubu: '中部',
    kinki: '近畿',
    chugoku: '中国',
    shikoku: '四国',
    kyushu: '九州',
  };
  const label = regionMap[regionId];
  return prefectures.filter((p) => p.region === label);
}
