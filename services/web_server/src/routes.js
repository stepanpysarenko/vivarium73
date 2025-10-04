const CONFIG = require("./config");
const { addFood } = require("./state");

module.exports = function registerRoutes(app) {
    app.get("/api/health", (req, res) => res.json({
        status: "OK", 
        appVersion: CONFIG.APP_VERSION
    }));

    app.get('/api/config', (req, res) => res.json({
        envCode: CONFIG.ENVIRONMENT,
        appVersion: CONFIG.APP_VERSION,
        webSocketUrl: CONFIG.WEBSOCKET_URL,
        stateUpdateInterval: CONFIG.STATE_UPDATE_INTERVAL,
        gridSize: CONFIG.GRID_SIZE,
        maxFoodCount: CONFIG.FOOD_MAX_COUNT
    }));

    app.post("/api/place-food", (req, res) => {
        const { x, y } = req.body;
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return res.status(400).json({ success: false, error: "Invalid coordinates" });
        }

        try {
            addFood(x, y);
            res.status(201).json({ success: true });
        } catch (err) {
            const status = err.message === "Max food count reached" || err.message === "Cell is occupied"
                ? 409
                : 400;
            res.status(status).json({ success: false, error: err.message });
        }
    });

};
