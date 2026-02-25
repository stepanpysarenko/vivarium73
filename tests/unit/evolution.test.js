const { SIM_CONFIG } = require('../../src/config');
const { appendTopPerformers } = require('../../src/evolution');

describe('appendTopPerformers', () => {
  it('adds creature and sorts by score', () => {
    const state = { topPerformers: [] };
    const a = { id: 1, generation: 1, weights: [], stats: { score: 200 } };
    const b = { id: 2, generation: 1, weights: [], stats: { score: 100 } };
    appendTopPerformers(a, state, SIM_CONFIG);
    appendTopPerformers(b, state, SIM_CONFIG);
    expect(state.topPerformers[0].stats.score).toBe(200);
    expect(state.topPerformers.length).toBe(2);
  });

  it('trims performers list to configured maximum', () => {
    const state = { topPerformers: [] };
    for (let i = 0; i < SIM_CONFIG.TOP_PERFORMERS_COUNT + 2; i++) {
      appendTopPerformers({ id: i, generation: 1, weights: [], stats: { score: i } }, state, SIM_CONFIG);
    }
    expect(state.topPerformers.length).toBeLessThanOrEqual(SIM_CONFIG.TOP_PERFORMERS_COUNT);
  });
});
