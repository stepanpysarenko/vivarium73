const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const { Worker } = require("worker_threads");
const WebSocket = require("../node_modules/ws");
const CONFIG = require("./config");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../public", "index.html"));
});

app.get('/api/health', (req, res) => res.json({ status: "OK" }));
let latestState = null;
let publicParams = null;
const pending = new Map();

const worker = new Worker(path.join(__dirname, 'sim_worker.js'));

worker.on('message', (msg) => {
    if (msg.requestId && pending.has(msg.requestId)) {
        const { resolve } = pending.get(msg.requestId);
        pending.delete(msg.requestId);
        return resolve(msg);
    }
    if (msg.type === 'ready') {
        publicParams = msg.params;
        latestState = msg.state;
    } else if (msg.type === 'state') {
        latestState = msg.state;
        sendState(latestState);
    }
});

worker.on('error', (err) => console.error('Worker error:', err));

function sendToWorker(message) {
    return new Promise((resolve) => {
        const requestId = Math.random().toString(36).slice(2);
        pending.set(requestId, { resolve });
        worker.postMessage({ ...message, requestId });
    });
}

app.get('/api/config', (req, res) => res.json({
    webSocketUrl: CONFIG.WEBSOCKET_URL,
    stateUpdateInterval: CONFIG.STATE_UPDATE_INTERVAL,
    params: publicParams
}));

app.post("/api/place-food", async (req, res) => {
    const { x, y } = req.body;
    try {
        const result = await sendToWorker({ type: 'placeFood', x, y });
        if (result.success) {
            res.json({ success: true });
        } else {
            res.status(400).json({ error: result.error });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
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

server.listen(CONFIG.PORT, () => {
    console.log(`Server running at http://localhost:${CONFIG.PORT}`);
    if (CONFIG.STATE_SAVE_INTERVAL !== null) {
        setInterval(() => worker.postMessage({ type: 'save' }), CONFIG.STATE_SAVE_INTERVAL);
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
    worker.postMessage({ type: 'shutdown' });

    server.close(() => {
        console.log("HTTP server closed");
        console.log("Shutting down...");
        process.exit(0);
    });
}

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);
