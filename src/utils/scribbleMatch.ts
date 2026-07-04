/** Apple Scribble が入力した文字と正解を比較 */
export function matchScribbleChar(written: string, expected: string): boolean {
  const normalized = written.normalize('NFKC').trim();
  if (!normalized) return false;
  const chars = [...normalized];
  return chars[0] === expected;
}
