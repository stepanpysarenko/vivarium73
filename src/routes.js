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

    app.post("/api/place-food", (req, res) => {
        const sim = getSim();
        const { x, y } = req.body;
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return res.status(400).json({ success: false, error: "Invalid coordinates" });
        }

        const gridX = Math.floor(x);
        const gridY = Math.floor(y);

        try {
            sim.addFood(gridX, gridY);
            res.status(201).json({ success: true });
        } catch (err) {
            res.status(400).json({ success: false, error: "Could not place food" });
        }
    });

};
