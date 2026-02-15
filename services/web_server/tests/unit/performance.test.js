const CONFIG = require('../../src/config');
const { appendTopPerformers } = require('../../src/performance');

describe('appendTopPerformers', () => {
  it('adds creature and sorts by score', () => {
    const state = { topPerformers: [] };
    const a = { stats: { score: 200, totalFoodCollected: 2, updatesSurvived: 1 } };
    const b = { stats: { score: 100, totalFoodCollected: 1, updatesSurvived: 1 } };
    appendTopPerformers(a, state);
    appendTopPerformers(b, state);
    expect(state.topPerformers[0]).toBe(a);
    expect(state.topPerformers.length).toBe(2);
  });

  it('trims performers list to configured maximum', () => {
    const state = { topPerformers: [] };
    for (let i = 0; i < CONFIG.TOP_PERFORMERS_COUNT + 2; i++) {
      appendTopPerformers({ stats: { totalFoodCollected: i + 1, updatesSurvived: 1 } }, state);
    }
    expect(state.topPerformers.length).toBeLessThanOrEqual(CONFIG.TOP_PERFORMERS_COUNT);
  });
});
