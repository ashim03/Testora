/**
 * Shared IELTS ↔ PTE band scales. PTE is derived deterministically from the
 * calibrated IELTS band because raw model estimates are systematically off
 * (typical error 10-25 points); a single monotone mapping keeps every surface
 * of the product consistent.
 */
export const pteFromIelts = (band: number): number => {
  const mapping: Record<number, number> = {
    1: 10, 1.5: 15, 2: 20, 2.5: 25, 3: 30, 3.5: 35, 4: 40, 4.5: 43, 5: 46,
    5.5: 51, 6: 58, 6.5: 65, 7: 72, 7.5: 78, 8: 83, 8.5: 87, 9: 90,
  };
  return mapping[band] ?? 60;
};
