const { getScore } = require('../../src/creature');

describe('getScore', () => {
  it('calculates food per turn', () => {
    const creature = { stats: { totalFoodCollected: 4, updatesSurvived: 2 } };
    expect(getScore(creature)).toBeCloseTo(2);
  });

  it('uses one turn minimum to avoid division by zero', () => {
    const creature = { stats: { totalFoodCollected: 3, updatesSurvived: 0 } };
    expect(getScore(creature)).toBeCloseTo(3);
  });
});
