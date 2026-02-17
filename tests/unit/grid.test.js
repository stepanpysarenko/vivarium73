const { SIM_CONFIG } = require('../../src/config');
const { buildStateIndexes, isCellOccupied, isWithinRadius, isWithinFOV, getRandomEmptyCell, getVisibleFood } = require('../../src/grid');

describe('isCellOccupied', () => {
  it('returns true when food occupies cell', () => {
    const state = { food: [{ x: 1, y: 2 }], obstacles: [] };
    buildStateIndexes(state);
    expect(isCellOccupied(1, 2, state)).toBe(true);
  });

  it('returns false for empty cell', () => {
    const state = { food: [], obstacles: [] };
    buildStateIndexes(state);
    expect(isCellOccupied(0, 0, state)).toBe(false);
  });
});

describe('isWithinRadius', () => {
  it('true when point inside radius', () => {
    expect(isWithinRadius(0, 0, 1, 1, 5)).toBe(true);
  });

  it('false when point outside radius', () => {
    expect(isWithinRadius(0, 0, 3, 4, 9)).toBe(false);
  });
});

describe('isWithinFOV', () => {
  it('returns true when target is directly ahead', () => {
    expect(isWithinFOV(0, 0, 0, 5, 0, Math.PI / 2)).toBe(true);
  });

  it('returns false when target is behind', () => {
    expect(isWithinFOV(0, 0, 0, -5, 0, Math.PI / 2)).toBe(false);
  });

  it('returns true when target is within FOV cone', () => {
    expect(isWithinFOV(0, 0, 0, 5, 2, Math.PI / 2)).toBe(true);
  });

  it('returns false when target is outside FOV cone', () => {
    expect(isWithinFOV(0, 0, 0, 2, 5, Math.PI / 2)).toBe(false);
  });

  it('handles negative angles correctly', () => {
    expect(isWithinFOV(0, 0, -Math.PI / 2, 0, -5, Math.PI / 2)).toBe(true);
  });

  it('handles angle wraparound at pi boundary', () => {
    expect(isWithinFOV(0, 0, Math.PI, -5, 0, Math.PI / 2)).toBe(true);
    expect(isWithinFOV(0, 0, -Math.PI, -5, 0, Math.PI / 2)).toBe(true);
  });
});

describe('getVisibleFood with FOV', () => {
  it('only returns food within FOV cone', () => {
    const creature = { x: 0, y: 0, angle: 0 };
    const state = {
      food: [
        { x: 5, y: 0 },
        { x: -5, y: 0 },
        { x: 0, y: 15 }
      ]
    };

    const visible = getVisibleFood(creature, state, SIM_CONFIG);

    expect(visible.find(f => f.x === 5 && f.y === 0)).toBeDefined();
    expect(visible.find(f => f.x === -5 && f.y === 0)).toBeUndefined();
    expect(visible.find(f => f.x === 0 && f.y === 15)).toBeUndefined();
  });
});
