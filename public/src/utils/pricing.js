export function getSizeMultiplier(sqft, scaleFactor) {
  if (scaleFactor === 0) return 1;
  const effectiveSqft = Math.max(Number(sqft) || 0, 2500);
  const baseline = 4000;
  const ratio = effectiveSqft / baseline;
  return 1 + (ratio - 1) * scaleFactor;
}
