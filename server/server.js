const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const WebSocket = require("./node_modules/ws");
const { getGameState, initGameState, updateGameState } = require("./game");

const GAME_STATE_UPDATE_INTERVAL_MS = 100;
const PORT = 3030;
const WS_URL = "ws://localhost:3030";

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, "../public")));
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../public", "index.html"));
});

app.get('/api/wsurl', (req, res) => res.json({ wsUrl: WS_URL }));

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
        await updateGameState();
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(getGameState()));
            }
        });
        await new Promise(resolve => setTimeout(resolve, GAME_STATE_UPDATE_INTERVAL_MS));      
    }
}

server.listen(PORT, async () => {
    console.log(`Server running at http://localhost:${PORT}`);
    initGameState();
    gameLoop();
});
