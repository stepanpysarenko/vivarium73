const { isCellOccupied, isWithinRadius, getRandomEmptyCell } = require('../../src/grid');

describe('isCellOccupied', () => {
  it('returns true when food occupies cell', () => {
    const state = { food: [{ x: 1, y: 2 }], obstacles: [] };
    expect(isCellOccupied(1, 2, state)).toBe(true);
  });

  it('returns false for empty cell', () => {
    const state = { food: [], obstacles: [] };
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

describe('getRandomEmptyCell', () => {
  it('never returns a cell occupied by obstacles', () => {
    const state = { food: [], obstacles: [{ x: 0, y: 0 }] };
    const { x, y } = getRandomEmptyCell(state);
    expect(x).not.toBe(0);
    expect(y).not.toBe(0);
  });
});
