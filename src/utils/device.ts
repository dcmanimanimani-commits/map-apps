/** iPad（Apple Pencil + Scribble 対応端末） */
export function supportsAppleScribble(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  const touchMac = navigator.maxTouchPoints > 1 && /Mac/i.test(ua);
  return /iPad/i.test(ua) || touchMac;
}
