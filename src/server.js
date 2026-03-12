const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const { SERVER_CONFIG } = require("./config");
const { simulationManager } = require("./simulation");
const registerRoutes = require("./routes");
const logger = require("./logger");

const SIM_ID = 'main';

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });


app.disable('x-powered-by');
app.use((req, res, next) => {
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Content-Security-Policy", "frame-ancestors 'none'");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
});

app.use(express.json({ limit: "1kb" }));
app.use(express.static(path.join(__dirname, "../public")));

registerRoutes(app, () => simulationManager.get(SIM_ID));

function sendInitMessage(ws, sim) {
    try {
        ws.send(JSON.stringify({
            type: 'init',
            config: {
                envCode: SERVER_CONFIG.ENVIRONMENT,
                appVersion: SERVER_CONFIG.APP_VERSION,
                stateUpdateInterval: sim.config.STATE_UPDATE_INTERVAL_MS,
                gridSize: sim.config.GRID_SIZE,
                foodMaxCount: sim.config.FOOD_MAX_COUNT,
                creature: {
                    visibilityRadius: sim.config.CREATURE_VISIBILITY_RADIUS,
                    visibilityFovRadians: Math.round(sim.config.CREATURE_VISIBILITY_FOV_RADIANS * 100) / 100
                }
            },
            state: {
                obstacles: sim.getObstacles()
            }
        }));
    } catch (err) {
        logger.warn("WebSocket init send failed:", err.message);
    }
}

wss.on("connection", (ws) => {
    if (wss.clients.size > SERVER_CONFIG.WEBSOCKET_MAX_CLIENTS) {
        ws.close(1013, "Server full");
        return;
    }
    
    logger.debug("Client connected");
    sendInitMessage(ws, simulationManager.get(SIM_ID));

    ws.on("close", () => { logger.debug("Client disconnected"); });
});

function broadcastState(state) {
    const data = JSON.stringify({ type: 'state', ...state });
    for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(data);
            } catch (err) {
                logger.warn("WebSocket send failed:", err.message);
            }
        }
    }
}

async function startServer(port = SERVER_CONFIG.PORT) {
    const sim = await simulationManager.create(SIM_ID);
    server.listen(port, () => {
        logger.info(`Server running on http://localhost:${port}`);
        sim.start(state => broadcastState(state));
    });
}

async function shutdown() {
    logger.info("Shutting down...");
    const sim = simulationManager.get(SIM_ID);
    if (sim) {
        sim.stop();
        await sim.save();
    }
    wss.clients.forEach(c => c.readyState === WebSocket.OPEN && c.close());
    server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

module.exports = { app, startServer };

if (process.env.NODE_ENV === 'test') {
    module.exports.__testUtils = { wss, broadcastState };
}
