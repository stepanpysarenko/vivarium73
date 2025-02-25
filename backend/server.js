const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const WebSocket = require("ws");
const { gameState, updateGameState } = require("./game");

const GAME_STATE_UPDATE_INTERVAL = 100; //ms
const PORT = 3000;

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, "../public")));
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../public", "index.html"));
});

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
                client.send(JSON.stringify(gameState));
            }
        });
        await new Promise(resolve => setTimeout(resolve, GAME_STATE_UPDATE_INTERVAL));
    }
}

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    gameLoop();
});
