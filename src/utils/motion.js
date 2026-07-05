// PRODUCT.md requires reduced-motion support: timers and state updates must
// never rely on animation, and decorative motion (twinkle, entrances) must
// switch off entirely when the viewer asked for it. Web-only check — this
// app ships exclusively as an Expo web export.
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
