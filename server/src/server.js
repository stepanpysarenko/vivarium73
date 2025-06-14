const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const WebSocket = require("../node_modules/ws");
const CONFIG = require("./config");
const { initState, saveState, getPublicState, updateState } = require("./state");
const { placeFood } = require("./actions");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../public", "index.html"));
});

app.get('/api/health', (req, res) => res.json({ status: "OK" }));
app.get('/api/wsurl', (req, res) => res.json({ wsUrl: CONFIG.WEBSOCKET_URL }));

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

async function loop() {
    while (true) {
        const start = performance.now();

        await updateState();
        await sendState(getPublicState());

        const elapsed = performance.now() - start;
        const sleepTime = Math.max(0, CONFIG.STATE_UPDATE_INTERVAL - elapsed);

        await new Promise(resolve => setTimeout(resolve, sleepTime));
    }
}

server.listen(CONFIG.PORT, async () => {
    console.log(`Server running at http://localhost:${CONFIG.PORT}`);
    await initState();
    loop();

    if (CONFIG.STATE_SAVE_INTERVAL !== null) {
        setInterval(saveState, CONFIG.STATE_SAVE_INTERVAL);
    }
});

function gracefulShutdown() {
    console.log("Shutting down gracefully...");
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.close();
        }
    });

    console.log("Saving data before shutdown...");
    saveState();

    server.close(() => {
        console.log("HTTP server closed");
        console.log("Shutting down...");
        process.exit(0);
    });
}

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);
