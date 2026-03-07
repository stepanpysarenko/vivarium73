const { SERVER_CONFIG } = require("./config");

const _rlMap = new Map();
setInterval(() => {
    const now = Date.now();
    _rlMap.forEach((v, k) => { if (now > v.reset) _rlMap.delete(k); });
}, 300_000).unref();

function makeRateLimiter(windowMs, max) {
    return (req, res, next) => {
        const key = req.ip;
        const now = Date.now();
        const entry = _rlMap.get(key);
        if (!entry || now > entry.reset) {
            _rlMap.set(key, { count: 1, reset: now + windowMs });
            return next();
        }
        if (entry.count >= max) {
            return res.status(429).json({ error: "Too many requests" });
        }
        entry.count++;
        next();
    };
}

module.exports = function registerRoutes(app, getSim) {
    app.use("/api", makeRateLimiter(SERVER_CONFIG.RATE_LIMIT_WINDOW_MS, SERVER_CONFIG.RATE_LIMIT_MAX));
    app.get("/api/health", (req, res) => res.json({
        status: "OK",
        appVersion: SERVER_CONFIG.APP_VERSION
    }));

    app.get('/api/config', (req, res) => {
        const { config } = getSim();
        res.json({
            envCode: SERVER_CONFIG.ENVIRONMENT,
            appVersion: SERVER_CONFIG.APP_VERSION,
            webSocketUrl: SERVER_CONFIG.WEBSOCKET_URL,
            stateUpdateInterval: config.STATE_UPDATE_INTERVAL_MS,
            gridSize: config.GRID_SIZE,
            foodMaxCount: config.FOOD_MAX_COUNT,
            creature: {
                visibilityRadius: config.CREATURE_VISIBILITY_RADIUS,
                visibilityFovRadians: Math.round(config.CREATURE_VISIBILITY_FOV_RADIANS * 100) / 100
            }
        });
    });

    app.post("/api/place-food", (req, res) => {
        const sim = getSim();
        const { x, y } = req.body;
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return res.status(400).json({ success: false, error: "Invalid coordinates" });
        }

        const gridX = Math.floor(x);
        const gridY = Math.floor(y);
        if (gridX < 0 || gridX >= sim.config.GRID_SIZE || gridY < 0 || gridY >= sim.config.GRID_SIZE) {
            return res.status(400).json({ success: false, error: "Coordinates out of bounds" });
        }

        try {
            sim.addFood(gridX, gridY);
            res.status(201).json({ success: true });
        } catch (err) {
            res.status(400).json({ success: false, error: "Could not place food" });
        }
    });

};
