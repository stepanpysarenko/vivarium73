const express = require("express");
const cors = require("cors");
const path = require("path");
const axios = require("axios");

const app = express();
const PORT = 3000;
app.use(cors());
app.use(express.json());


app.use(express.static(path.join(__dirname, "../public")));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

const gridSize = 100;
const creatureCount = 20;

let creatures = Array.from({ length: creatureCount }, () => ({
    x: Math.floor(Math.random() * gridSize),
    y: Math.floor(Math.random() * gridSize)
}));

app.get("/initial-state", (req, res) => {
    res.json(creatures);
});

app.get("/move", async (req, res) => {
    try {
        const response = await axios.post("http://localhost:8000/move", creatures);
        console.log("creatures", creatures);
        creatures = response.data;
        res.json(creatures);
    } catch (error) {
        console.error("Error connecting to AI backend:", error);
        res.status(500).json({ error: "AI backend unreachable" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
