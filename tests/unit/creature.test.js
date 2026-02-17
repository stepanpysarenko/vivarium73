const { getScore } = require('../../src/creature');

describe('getScore', () => {
  it('returns energyGained divided by 10, rounded', () => {
    expect(getScore({ stats: { energyGained: 100 } })).toBe(10);
  });

  it('returns 0 when no energy gained', () => {
    expect(getScore({ stats: { energyGained: 0 } })).toBe(0);
  });

  it('rounds to nearest integer', () => {
    expect(getScore({ stats: { energyGained: 135 } })).toBe(14);
    expect(getScore({ stats: { energyGained: 134 } })).toBe(13);
  });
});
