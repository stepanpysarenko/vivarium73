const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");
const path = require("path");

const { SERVER_CONFIG } = require("./config");
const { simulationManager } = require("./simulation");
const registerRoutes = require("./routes");
const logger = require("./logger");

const SIM_ID = 'main';

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.disable('x-powered-by');
app.use((req, res, next) => {
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Content-Security-Policy", "frame-ancestors 'none'");
    next();
});

app.use(cors({ origin: SERVER_CONFIG.CORS_ORIGIN }));
app.use(express.json({ limit: "1kb" }));
app.use(express.static(path.join(__dirname, "../public")));

registerRoutes(app, () => simulationManager.get(SIM_ID));

wss.on("connection", (ws) => {
    logger.debug("Client connected");
    ws.on("close", () => logger.debug("Client disconnected"));
});

function broadcastState(state) {
    const data = JSON.stringify(state);
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

function startServer(port = SERVER_CONFIG.PORT) {
    server.listen(port, async () => {
        logger.info(`Server running on http://localhost:${port}`);
        const sim = await simulationManager.create(SIM_ID);
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
