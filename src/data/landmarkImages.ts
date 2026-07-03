/** 自動生成: npm run fetch:landmark-images */
export const landmarkImages: Record<string, string> = {
  "北海道:0": "/landmarks/01-0.jpg",
  "北海道:1": "/landmarks/01-1.jpg",
  "北海道:2": "/landmarks/01-2.jpg",
  "北海道:3": "/landmarks/01-3.jpg",
  "青森県:2": "/landmarks/02-2.jpg",
  "秋田県:0": "/landmarks/05-0.jpg",
  "秋田県:1": "/landmarks/05-1.jpg",
  "秋田県:2": "/landmarks/05-2.jpg",
  "秋田県:3": "/landmarks/05-3.jpg",
  "山形県:3": "/landmarks/06-3.jpg",
  "新潟県:3": "/landmarks/15-3.jpg",
  "富山県:0": "/landmarks/16-0.jpg",
  "富山県:1": "/landmarks/16-1.jpg",
  "富山県:2": "/landmarks/16-2.jpg",
  "富山県:3": "/landmarks/16-3.jpg",
  "石川県:0": "/landmarks/17-0.jpg",
  "奈良県:3": "/landmarks/29-3.jpg",
  "和歌山県:0": "/landmarks/30-0.jpg",
  "和歌山県:1": "/landmarks/30-1.jpg",
  "和歌山県:2": "/landmarks/30-2.jpg",
  "大分県:1": "/landmarks/44-1.jpg",
  "大分県:2": "/landmarks/44-2.jpg",
  "宮崎県:1": "/landmarks/45-1.jpg",
  "宮崎県:2": "/landmarks/45-2.jpg",
  "宮崎県:3": "/landmarks/45-3.jpg",
  "鹿児島県:0": "/landmarks/46-0.jpg"
};

export function getLandmarkImage(kanji: string, index: number): string | undefined {
  return landmarkImages[`${kanji}:${index}`];
}
