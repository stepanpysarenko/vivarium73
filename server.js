const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = 3000;
app.use(cors());

app.use(express.static(path.join(__dirname, "public")));

const gridSize = 100;
const creatureCount = 20;

let creatures = Array.from({ length: creatureCount }, () => ({
    x: Math.floor(Math.random() * gridSize),
    y: Math.floor(Math.random() * gridSize)
}));

app.get("/move", (req, res) => {
    creatures = creatures.map(creature => ({
        x: Math.max(0, Math.min(gridSize - 1, creature.x + (Math.random() > 0.5 ? 1 : -1))),
        y: Math.max(0, Math.min(gridSize - 1, creature.y + (Math.random() > 0.5 ? 1 : -1)))
    }));
    res.json(creatures);
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
