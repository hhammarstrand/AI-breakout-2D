const TOTAL_SECTORS = 4;

export const gameState = {
  totalSectors: TOTAL_SECTORS,
  completedSectors: 0,
};

export function isSectorUnlocked(num) { return num <= gameState.completedSectors + 1; }
export function isSectorCompleted(num) { return num <= gameState.completedSectors; }
export function isSectorActive(num) { return num === gameState.completedSectors + 1; }

export function completeSector(num) {
  if (num === gameState.completedSectors + 1 && num <= TOTAL_SECTORS) {
    gameState.completedSectors = num;
    return true;
  }
  return false;
}
