const { SERVER_CONFIG } = require("./config");
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

const level = LEVELS[SERVER_CONFIG.LOG_LEVEL] ?? LEVELS.info;

const logger = {
    error: (...args) => level >= LEVELS.error && console.error(...args),
    warn:  (...args) => level >= LEVELS.warn  && console.warn(...args),
    info:  (...args) => level >= LEVELS.info  && console.log(...args),
    debug: (...args) => level >= LEVELS.debug && console.debug(...args),
};

module.exports = logger;
