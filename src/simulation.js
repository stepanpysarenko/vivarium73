const { performance } = require('perf_hooks');
const { SIM_CONFIG } = require('./config');
const { createState, saveState, getPublicState, updateState, addFood } = require('./state');
const { buildStateIndexes } = require('./grid');
const logger = require('./logger');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

class Simulation {
    constructor(id, configOverrides = {}) {
        this.id = id;
        this.config = { ...SIM_CONFIG, ...configOverrides };
        this._state = null;
        this._running = false;
        this._saveTimer = null;
    }

    async init() {
        this._state = await createState(this.config);
    }

    start(onTick) {
        this._running = true;
        this._loop(onTick);
        const { STATE_SAVE_INTERVAL_MS, STATE_SAVE_PATH } = this.config;
        if (STATE_SAVE_INTERVAL_MS && STATE_SAVE_PATH) {
            this._saveTimer = setInterval(
                () => saveState(this._state, STATE_SAVE_PATH),
                STATE_SAVE_INTERVAL_MS
            );
        }
    }

    stop() {
        this._running = false;
        if (this._saveTimer) {
            clearInterval(this._saveTimer);
            this._saveTimer = null;
        }
    }

    async save() {
        if (this.config.STATE_SAVE_PATH) {
            await saveState(this._state, this.config.STATE_SAVE_PATH);
        }
    }

    getPublicState() {
        return getPublicState(this._state, this.config);
    }

    addFood(x, y) {
        addFood(x, y, this._state, this.config);
    }

    async _loop(onTick) {
        let retries = 0;
        while (this._running) {
            const start = performance.now();
            try {
                const updateStart = performance.now();
                await updateState(this._state, this.config);
                const updateMs = (performance.now() - updateStart).toFixed(2);
                logger.debug(`[Simulation ${this.id}] tick: ${updateMs}ms`);
                onTick(this.getPublicState());
                retries = 0;
            } catch (err) {
                logger.error(`[Simulation ${this.id}] Critical error:`, err);
                if (++retries >= this.config.STATE_UPDATE_LOOP_RETRY_LIMIT) {
                    logger.error(`[Simulation ${this.id}] Retry limit reached. Stopping.`);
                    this._running = false;
                    break;
                }
            }
            const elapsed = performance.now() - start;
            await sleep(Math.max(0, this.config.STATE_UPDATE_INTERVAL_MS - elapsed));
        }
    }
}

class SimulationManager {
    constructor() {
        this._sims = new Map();
    }

    async create(id, configOverrides = {}) {
        const sim = new Simulation(id, configOverrides);
        await sim.init();
        this._sims.set(id, sim);
        return sim;
    }

    get(id) {
        return this._sims.get(id);
    }

    getAll() {
        return [...this._sims.values()];
    }
}

const simulationManager = new SimulationManager();

module.exports = { Simulation, simulationManager };

if (process.env.NODE_ENV === 'test') {
    module.exports.__testUtils = {
        setSimState(id, s) {
            const sim = simulationManager.get(id);
            if (sim) {
                sim._state = s;
                buildStateIndexes(s);
            }
        },
        getSimState(id) {
            return simulationManager.get(id)?._state;
        },
    };
}
