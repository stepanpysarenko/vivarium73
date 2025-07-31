const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");
const path = require("path");
const { performance } = require("perf_hooks");

const CONFIG = require("./config");
const {
    initState,
    saveState,
    getPublicState,
    updateState
} = require("./state");
const registerRoutes = require("./routes");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.disable('x-powered-by');
app.use((req, res, next) => {
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Content-Security-Policy", "frame-ancestors 'none'");
    next();
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

registerRoutes(app);

wss.on("connection", (ws) => {
    console.log("Client connected");
    ws.on("close", () => console.log("Client disconnected"));
});

function broadcastState(state) {
    const data = JSON.stringify(state);
    for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(data);
            } catch (err) {
                console.warn("WebSocket send failed:", err.message);
            }
        }
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function handleStateUpdate() {
    const start = performance.now();
    await updateState();
    broadcastState(getPublicState());
    const elapsed = performance.now() - start;
    await sleep(Math.max(0, CONFIG.STATE_UPDATE_INTERVAL - elapsed));
}

async function loop() {
    let retries = 0;
    while (true) {
        try {
            await handleStateUpdate();
            retries = 0;
        } catch (err) {
            console.error("Critical error:", err);
            if (++retries >= CONFIG.STATE_UPDATE_LOOP_RETRY_LIMIT) {
                console.error("Retry limit reached. Exiting.");
                process.exit(1);
            }
        }
    }
}

function startServer(port = CONFIG.PORT) {
    server.listen(port, async () => {
        console.log(`Server running on http://localhost:${port}`);
        await initState();
        loop();

        if (CONFIG.STATE_SAVE_INTERVAL && CONFIG.STATE_SAVE_PATH) {
            setInterval(saveState, CONFIG.STATE_SAVE_INTERVAL);
        }
    });
}

function shutdown() {
    console.log("Shutting down...");
    saveState();
    wss.clients.forEach(c => c.readyState === WebSocket.OPEN && c.close());
    server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

module.exports = { app, startServer };
