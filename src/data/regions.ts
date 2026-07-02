export interface StudyRegion {
  id: string;
  name: string;
  emoji: string;
  color: string;
  description: string;
  subRegions?: { id: string; name: string; emoji: string }[];
}

export const studyRegions: StudyRegion[] = [
  {
    id: 'hokkaido',
    name: '北海道',
    emoji: '🥔',
    color: '#1a4080',
    description: '北の大きな島！',
  },
  {
    id: 'tohoku',
    name: '東北地方',
    emoji: '🍎',
    color: '#4a90d9',
    description: 'りんごと雪の地方',
  },
  {
    id: 'kanto',
    name: '関東地方',
    emoji: '🗼',
    color: '#1a7030',
    description: '首都がある地方',
  },
  {
    id: 'chubu',
    name: '中部地方',
    emoji: '🏔️',
    color: '#7cb342',
    description: '日本のまんなか！3つのエリアに分かれるよ',
    subRegions: [
      { id: 'hokuriku', name: '北陸', emoji: '🦀' },
      { id: 'koshinetsu', name: '甲信越', emoji: '🍇' },
      { id: 'tokai', name: '東海', emoji: '🍵' },
    ],
  },
  {
    id: 'kinki',
    name: '近畿地方',
    emoji: '🐙',
    color: '#ff7700',
    description: '大阪・京都がある地方',
  },
  {
    id: 'chugoku',
    name: '中国地方',
    emoji: '🍑',
    color: '#c87830',
    description: '本州の西の方',
  },
  {
    id: 'shikoku',
    name: '四国地方',
    emoji: '🍜',
    color: '#e8a0b0',
    description: '4つの県がある島',
  },
  {
    id: 'kyushu',
    name: '九州地方',
    emoji: '🌋',
    color: '#c41e7a',
    description: '九州と沖縄の島',
  },
];

export function getStudyRegion(id: string): StudyRegion | undefined {
  return studyRegions.find((r) => r.id === id);
}

export function getProgressKey(regionId: string, subRegionId?: string): string {
  return subRegionId ? `${regionId}:${subRegionId}` : regionId;
}
