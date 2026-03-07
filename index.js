const { startServer } = require('./src/server');
const logger = require('./src/logger');

startServer().catch(err => {
    logger.error('Failed to start server:', err);
    process.exit(1);
});
