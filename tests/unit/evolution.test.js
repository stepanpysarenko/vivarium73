const { SIM_CONFIG } = require('../../src/config');
const { appendTopPerformers } = require('../../src/evolution');

describe('appendTopPerformers', () => {
  it('adds creature and sorts by score', () => {
    const state = { topPerformers: [] };
    const a = { stats: { score: 200, totalFoodCollected: 2, updatesSurvived: 1 } };
    const b = { stats: { score: 100, totalFoodCollected: 1, updatesSurvived: 1 } };
    appendTopPerformers(a, state, SIM_CONFIG);
    appendTopPerformers(b, state, SIM_CONFIG);
    expect(state.topPerformers[0]).toBe(a);
    expect(state.topPerformers.length).toBe(2);
  });

  it('trims performers list to configured maximum', () => {
    const state = { topPerformers: [] };
    for (let i = 0; i < SIM_CONFIG.TOP_PERFORMERS_COUNT + 2; i++) {
      appendTopPerformers({ stats: { totalFoodCollected: i + 1, updatesSurvived: 1 } }, state, SIM_CONFIG);
    }
    expect(state.topPerformers.length).toBeLessThanOrEqual(SIM_CONFIG.TOP_PERFORMERS_COUNT);
  });
});
