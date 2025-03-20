const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const WebSocket = require("./node_modules/ws");
const { getGameState, initGameState, updateGameState } = require("./game");
const CONFIG = require("./config");

const { PORT, WEBSOCKET_URL, STATE_UPDATE_INTERVAL } = CONFIG;

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, "../public")));
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../public", "index.html"));
});

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
        await updateGameState();
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(getGameState()));
            }
        });
        await new Promise(resolve => setTimeout(resolve, STATE_UPDATE_INTERVAL));      
    }
}

server.listen(PORT, async () => {
    console.log(`Server running at http://localhost:${PORT}`);
    await initGameState();
    gameLoop();
});
