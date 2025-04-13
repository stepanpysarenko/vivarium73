const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const WebSocket = require("./node_modules/ws");
const { initState, updateState, getPublicState, saveState } = require("./game");
const CONFIG = require("./config");

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, "/public")));
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "/public", "index.html"));
});

app.get('/api/health', (req, res) => res.json({ status: "OK" })); // add ai-server health check endpoint ???

app.get('/api/wsurl', (req, res) => res.json({ wsUrl: CONFIG.WEBSOCKET_URL }));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
    console.log("New WebSocket connection");

    ws.on("close", () => {
        console.log("WebSocket disconnected");
    });
});

async function gameLoop() {
    while (true) {
        await updateState();
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(getPublicState()));
            }
        });
        await new Promise(resolve => setTimeout(resolve, CONFIG.STATE_UPDATE_INTERVAL));
    }
}

server.listen(CONFIG.PORT, async () => {
    console.log(`Server running at http://localhost:${CONFIG.PORT}`);
    await initState();
    gameLoop();

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
