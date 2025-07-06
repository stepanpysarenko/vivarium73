const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const WebSocket = require("ws");
const CONFIG = require("./config");
const { initState, saveState, getPublicState, getPublicParams, updateState, addFood } = require("./state");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../public", "index.html"));
});

app.get('/api/health', (req, res) => res.json({ status: "OK" }));

app.get('/api/config', (req, res) => res.json({
    webSocketUrl: CONFIG.WEBSOCKET_URL,
    stateUpdateInterval: CONFIG.STATE_UPDATE_INTERVAL,
    params: getPublicParams()
}));

app.post("/api/place-food", (req, res) => {
    const { x, y } = req.body;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return res.status(400).json({ success: false, error: "x and y must be numbers" });
    }

    try {
        addFood(x, y);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
    console.log("New WebSocket connection");

    ws.on("close", () => {
        console.log("WebSocket disconnected");
    });
});

function sendUpdate(state) {
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
    await sendUpdate(getPublicState());

    const elapsed = performance.now() - start;
    const sleepTime = Math.max(0, CONFIG.STATE_UPDATE_INTERVAL - elapsed);
    await sleep(sleepTime);
}

async function loop() {
    let retries = 0;
    while (true) {
        try {
            await handleStateUpdate();
        } catch (err) {
            console.error('Critical error in state update loop:', err);
            retries++;
            if (retries >= CONFIG.STATE_UPDATE_LOOP_RETRY_LIMIT) {
                console.log(`Retry limit reached (${CONFIG.STATE_UPDATE_LOOP_RETRY_LIMIT}). Exiting...`);
                process.exit(1);
            }
        }
    }
}

function startServer(port = CONFIG.PORT) {
    server.listen(port, async () => {
        console.log(`Server running at http://localhost:${port}`);
        await initState();
        loop();

        if (CONFIG.STATE_SAVE_INTERVAL !== null && CONFIG.STATE_SAVE_PATH !== null) {
            setInterval(saveState, CONFIG.STATE_SAVE_INTERVAL);
        }
    });
}

function shutdown() {
    console.log("Disconnecting clients...");
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.close();
        }
    });

    console.log("Saving data....");
    saveState();

    server.close(() => {
        console.log("HTTP server closed");
        console.log("Exiting...");
        process.exit(0);
    });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

module.exports = { app, startServer };
