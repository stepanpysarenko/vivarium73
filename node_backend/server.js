const express = require("express");
const cors = require("cors");
const axios = require("axios");
const path = require("path");

const app = express();
const PORT = 3000;
const AI_BACKEND_URL = "http://localhost:8000/move";

const GRID_SIZE = 100;
const CREATURE_COUNT = 20;
const FOOD_COUNT = 20;

let gameState;

app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../public", "index.html"));
});

function randomPosition() {
    return { x: Math.floor(Math.random() * GRID_SIZE), y: Math.floor(Math.random() * GRID_SIZE) };
}

function randomWeights() {
    return [
        [Math.random() * 2 - 1, Math.random() * 2 - 1],
        [Math.random() * 2 - 1, Math.random() * 2 - 1]
    ];
}

function generateState() {
    gameState = {
        creatures: Array.from({ length: CREATURE_COUNT }, () => ({
            ...randomPosition(),
            weights: randomWeights()
        })),
        food: Array.from({ length: FOOD_COUNT }, randomPosition)
    };
}
generateState();


app.get("/reset-state", (req, res) => {
    generateState();
});

app.get("/move", async (req, res) => {
    try {
        const response = await axios.post(AI_BACKEND_URL, gameState);
        gameState = response.data;
        res.json(gameState);
    } catch (error) {
        console.error("Error connecting to AI backend: ", error.message);
        res.status(500).json({ error: "AI backend unavailable" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
