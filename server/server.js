const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const WebSocket = require("./node_modules/ws");
const { getState, saveState, initState, updateState } = require("./game");
const CONFIG = require("./config");

const {
    PORT,
    WEBSOCKET_URL,
    STATE_SAVE_INTERVAL,
    STATE_UPDATE_INTERVAL 
} = CONFIG;

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, "/public")));
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "/public", "index.html"));
});

app.get('/api/health', (req, res) => res.json({ status: "OK" })); // add ai-server health check endpoint ???

app.get('/api/wsurl', (req, res) => res.json({ wsUrl: WEBSOCKET_URL }));

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
                client.send(JSON.stringify(getState()));
            }
        });
        await new Promise(resolve => setTimeout(resolve, STATE_UPDATE_INTERVAL));
    }
}

process.on("SIGINT", () => {
    console.log("SIGINT received. Saving state before shutdown...");
    saveState();
    process.exit(0);
});

process.on("SIGTERM", () => {
    console.log("SIGTERM received. Saving state before shutdown...");
    saveState();
    process.exit(0);
});

server.listen(PORT, async () => {
    console.log(`Server running at http://localhost:${PORT}`);
    await initState();
    gameLoop();

    if (STATE_SAVE_INTERVAL !== null) {
        setInterval(saveState, STATE_SAVE_INTERVAL);
    }
});
