import type { AvatarLevel } from './characterAssets';

export type AdventureSkillId =
  | 'poop-slip'
  | 'roll-invincible'
  | 'jet-dash'
  | 'sticky-trail'
  | 'crutch-spin'
  | 'kind-slow'
  | 'chomp-remove'
  | 'water-fan'
  | 'fire-fan';

export interface AdventureSkillDef {
  id: AdventureSkillId;
  name: string;
  shortLabel: string;
  description: string;
  cooldownMs: number;
}

export const ADVENTURE_SKILLS: Record<AvatarLevel, AdventureSkillDef> = {
  1: {
    id: 'poop-slip',
    name: 'うんぴトラップ',
    shortLabel: 'うんぴ',
    description: '後ろにうんぴを置く。鬼は当たると3秒すべる。',
    cooldownMs: 12000,
  },
  2: {
    id: 'roll-invincible',
    name: 'ごろごろ',
    shortLabel: 'ごろ',
    description: '2秒だけ無敵。鬼に当たってもつかまらない。',
    cooldownMs: 12000,
  },
  3: {
    id: 'jet-dash',
    name: 'ジェット',
    shortLabel: 'JET',
    description: '今の方向へ1秒だけ超加速。',
    cooldownMs: 12000,
  },
  4: {
    id: 'sticky-trail',
    name: 'ねばねば',
    shortLabel: 'ねば',
    description: '5秒間うしろにねばねばを出し、鬼を止める。',
    cooldownMs: 12000,
  },
  5: {
    id: 'crutch-spin',
    name: '松葉づえ',
    shortLabel: '杖',
    description: '近くの鬼をくるっと弾き飛ばす。',
    cooldownMs: 12000,
  },
  6: {
    id: 'kind-slow',
    name: 'お年寄りに優しく',
    shortLabel: 'やさしさ',
    description: '5秒間、近くの鬼のスピード半減。',
    cooldownMs: 12000,
  },
  7: {
    id: 'chomp-remove',
    name: 'むしゃむしゃ',
    shortLabel: 'むしゃ',
    description: '正面の鬼1体を食べて消す。',
    cooldownMs: 12000,
  },
  8: {
    id: 'water-fan',
    name: '水鉄砲',
    shortLabel: 'みず',
    description: '正面に水を噴射して鬼を吹き飛ばす。',
    cooldownMs: 12000,
  },
  9: {
    id: 'fire-fan',
    name: 'ファイア',
    shortLabel: '炎',
    description: '正面に炎を吐いて鬼を消す。',
    cooldownMs: 12000,
  },
};
