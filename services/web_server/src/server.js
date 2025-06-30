const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const WebSocket = require("ws");
const CONFIG = require("./config");
const { initState, saveState, getPublicState, getPublicParams, updateState } = require("./state");
const { placeFood } = require("./actions");

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
    try {
        placeFood(x, y);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
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

function sendState(state) {
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

async function loop() {
    while (true) {
        try {
            const start = performance.now();

            await updateState();
            await sendState(getPublicState());

            const elapsed = performance.now() - start;
            const sleepTime = Math.max(0, CONFIG.STATE_UPDATE_INTERVAL - elapsed);
            await sleep(sleepTime);
        } catch (err) {
            console.error('Error in loop:', err);
        }
    }
}

function startServer(port = CONFIG.PORT) {
    server.listen(port, async () => {
        console.log(`Server running at http://localhost:${port}`);
        await initState();
        loop();

        if (CONFIG.STATE_SAVE_INTERVAL !== null) {
            setInterval(saveState, CONFIG.STATE_SAVE_INTERVAL);
        }
    });
}

function gracefulShutdown() {
    console.log("Shutting down...");
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.close();
        }
    });

    console.log("Saving data before shutdown...");
    saveState();

    server.close(() => {
        console.log("HTTP server closed");
        console.log("Exiting...");
        process.exit(0);
    });
}

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

module.exports = { app, startServer };
