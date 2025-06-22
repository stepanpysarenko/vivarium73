const { parentPort } = require('worker_threads');
const CONFIG = require('./config');
const { initState, saveState, getPublicState, getPublicParams, updateState } = require('./state');
const { placeFood } = require('./actions');

async function main() {
  await initState();
  parentPort.postMessage({ type: 'ready', params: getPublicParams(), state: getPublicState() });

  while (true) {
    const start = performance.now();
    await updateState();
    parentPort.postMessage({ type: 'state', state: getPublicState() });

    const elapsed = performance.now() - start;
    const sleepTime = Math.max(0, CONFIG.STATE_UPDATE_INTERVAL - elapsed);
    await new Promise(r => setTimeout(r, sleepTime));
  }
}

parentPort.on('message', async (msg) => {
  if (!msg || !msg.type) return;
  switch (msg.type) {
    case 'placeFood':
      try {
        placeFood(msg.x, msg.y);
        parentPort.postMessage({ type: 'placeFoodResult', requestId: msg.requestId, success: true });
      } catch (err) {
        parentPort.postMessage({ type: 'placeFoodResult', requestId: msg.requestId, success: false, error: err.message });
      }
      break;
    case 'save':
      saveState();
      break;
    case 'shutdown':
      saveState();
      process.exit(0);
  }
});

main();
