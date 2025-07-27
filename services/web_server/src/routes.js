const CONFIG = require("./config");
const { addFood, getCreature } = require("./state");
const { getScore } = require("./creature");

module.exports = function registerRoutes(app) {
    app.get("/api/health", (req, res) => res.json({ status: "OK" }));

    app.get('/api/config', (req, res) => res.json({
        webSocketUrl: CONFIG.WEBSOCKET_URL,
        stateUpdateInterval: CONFIG.STATE_UPDATE_INTERVAL,
        gridSize: CONFIG.GRID_SIZE,
        maxFoodCount: CONFIG.FOOD_MAX_COUNT,
        maxEnergy: CONFIG.CREATURE_MAX_ENERGY
    }));

    app.post("/api/place-food", (req, res) => {
        const { x, y } = req.body;
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return res.status(400).json({ success: false, error: "Invalid coordinates" });
        }

        try {
            addFood(x, y);
            res.json({ success: true });
        } catch (err) {
            res.status(400).json({ success: false, error: err.message });
        }
    });

    app.get("/api/creature/:id", (req, res) => {
        const id = parseInt(req.params.id, 10);
        const creature = getCreature(id);
        if (!creature) {
            return res.status(404).json({ error: "Creature not found" });
        }

        res.json({
            id: creature.id,
            generation: creature.generation,
            totalFoodCollected: creature.stats.totalFoodCollected,
            updatesSurvived: creature.stats.updatesSurvived,
            score: getScore(creature)
        });
    });
};
