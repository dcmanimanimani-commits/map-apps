import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(process.cwd(), 'public', 'stickers');

const stickers = [
  { id: '01', name: 'じゃがいもくま', style: 'cute', bg: '#FFE8B8', accent: '#8B5E3C', emoji: '🥔' },
  { id: '02', name: 'りんごナイト', style: 'cool', bg: '#FFD6D6', accent: '#B91C1C', emoji: '🍎' },
  { id: '03', name: 'タワーガード', style: 'cool', bg: '#D9F7E8', accent: '#047857', emoji: '🗼' },
  { id: '04', name: 'アルプス', style: 'cool', bg: '#DBEAFE', accent: '#1D4ED8', emoji: '🏔️' },
  { id: '05', name: 'たこやき', style: 'cute', bg: '#FFEDD5', accent: '#C2410C', emoji: '🐙' },
  { id: '06', name: 'ももちゃん', style: 'cute', bg: '#FCE7F3', accent: '#DB2777', emoji: '🍑' },
  { id: '07', name: 'うどんサムライ', style: 'cool', bg: '#EDE9FE', accent: '#6D28D9', emoji: '🍜' },
  { id: '08', name: 'さくらじま', style: 'cool', bg: '#FEE2E2', accent: '#991B1B', emoji: '🌋' },
  { id: '09', name: 'ねこパトロール', style: 'cute', bg: '#FEF3C7', accent: '#B45309', emoji: '🐱' },
  { id: '10', name: 'ドラゴン', style: 'cool', bg: '#E0E7FF', accent: '#3730A3', emoji: '🐉' },
  { id: '11', name: 'うさぎ星', style: 'cute', bg: '#FDF2F8', accent: '#BE185D', emoji: '🐰' },
  { id: '12', name: 'ロケット', style: 'cool', bg: '#CFFAFE', accent: '#0E7490', emoji: '🚀' },
  { id: '13', name: 'ぱんだ', style: 'cute', bg: '#F3F4F6', accent: '#374151', emoji: '🐼' },
  { id: '14', name: 'サメ', style: 'cool', bg: '#BAE6FD', accent: '#0369A1', emoji: '🦈' },
  { id: '15', name: 'ちょうちょ', style: 'cute', bg: '#F5D0FE', accent: '#A21CAF', emoji: '🦋' },
  { id: '16', name: 'かめん', style: 'cool', bg: '#D1FAE5', accent: '#065F46', emoji: '🎭' },
  { id: '17', name: 'ほし', style: 'cute', bg: '#E0F2FE', accent: '#0284C7', emoji: '⭐' },
  { id: '18', name: 'ライオン', style: 'cool', bg: '#FEF08A', accent: '#A16207', emoji: '🦁' },
  { id: '19', name: 'アイス', style: 'cute', bg: '#FBCFE8', accent: '#9D174D', emoji: '🍦' },
  { id: '20', name: 'サンダー', style: 'cool', bg: '#FEF9C3', accent: '#854D0E', emoji: '⚡' },
  { id: '21', name: 'ふくろう', style: 'cute', bg: '#E7E5E4', accent: '#57534E', emoji: '🦉' },
  { id: '22', name: 'コンパス', style: 'cool', bg: '#CCFBF1', accent: '#0F766E', emoji: '🧭' },
  { id: '23', name: 'くまちゃん', style: 'cute', bg: '#FFEDD5', accent: '#9A3412', emoji: '🧸' },
  { id: '24', name: 'シールド', style: 'cool', bg: '#BFDBFE', accent: '#1E40AF', emoji: '🛡️' },
  { id: '25', name: 'にじ', style: 'cute', bg: '#FCE7F3', accent: '#7C3AED', emoji: '🌈' },
];

function svgFor({ id, name, style, bg, accent, emoji }) {
  const scallop = style === 'cute'
    ? 'M12 4 C18 4 22 8 22 14 C22 22 12 28 12 28 C12 28 2 22 2 14 C2 8 6 4 12 4 Z'
    : 'M4 6 L20 6 L22 14 L20 22 L4 22 L2 14 Z';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
  <defs>
    <linearGradient id="g-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg}"/>
      <stop offset="100%" stop-color="#ffffff"/>
    </linearGradient>
  </defs>
  <path d="${scallop}" transform="translate(36,10) scale(1.6)" fill="url(#g-${id})" stroke="${accent}" stroke-width="2.2"/>
  <circle cx="48" cy="50" r="24" fill="#ffffff" fill-opacity="0.72" stroke="${accent}" stroke-width="2"/>
  <text x="48" y="58" text-anchor="middle" font-size="28">${emoji}</text>
  <text x="48" y="86" text-anchor="middle" font-size="8" fill="${accent}" font-family="sans-serif">${name}</text>
</svg>`;
}

mkdirSync(OUT, { recursive: true });
for (const sticker of stickers) {
  writeFileSync(join(OUT, `sticker-${sticker.id}.svg`), svgFor(sticker), 'utf8');
}
console.log(`Generated ${stickers.length} stickers in ${OUT}`);
