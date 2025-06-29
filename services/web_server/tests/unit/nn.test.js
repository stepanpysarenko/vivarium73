const axios = require('axios');
const CONFIG = require('../../src/config');
const { mutateWeights } = require('../../src/nn');

jest.mock('axios');

describe('mutateWeights', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns mutated weights on success', async () => {
    axios.post.mockResolvedValue({ data: { weights: [2, 3] } });
    await expect(mutateWeights([1])).resolves.toEqual([2, 3]);
    expect(axios.post).toHaveBeenCalledWith(
      CONFIG.NN_SERVICE_URL + '/weights/mutate',
      { weights: [1] }
    );
  });

  it('throws when request fails', async () => {
    axios.post.mockRejectedValue(new Error('network'));
    await expect(mutateWeights([1])).rejects.toThrow('network');
  });
});
