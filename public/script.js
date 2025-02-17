const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const gridSize = 100;
const scale = canvas.width / gridSize;
let animationFrameId;
let creatures = [];

document.addEventListener("DOMContentLoaded", async () => {
    try {
        const response = await fetch("http://localhost:3000/initial-state");
        const initialState = await response.json();
        initializeSimulation(initialState);
    } catch (error) {
        console.error("Error fetching initial state:", error);
    }
});

function initializeSimulation(initialState) {
    creatures = initialState;
    draw();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    creatures.forEach(creature => {
        ctx.fillStyle = "blue";
        ctx.fillRect(creature.x * scale, creature.y * scale, scale, scale);
    });
}

async function updateCreatures() {
    try {
        const response = await fetch("http://localhost:3000/move");
        const newPositions = await response.json();
        creatures = newPositions;
    } catch (error) {
        console.error("Failed to fetch data", error);
    }
}

function gameLoop() {
    updateCreatures();
    draw();
    animationFrameId = requestAnimationFrame(gameLoop);
}

const toggleButton = document.getElementById("toggleButton");

function startSimulation() {
    console.log('Starting simulation...');
    gameLoop();
    toggleButton.textContent = "Stop";
}

function stopSimulation() {
    console.log('Stopping simulation...');
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
    toggleButton.textContent = "Start";
}

function toggleSimulation() {
    if (animationFrameId) {
        stopSimulation();       
    } else {
        startSimulation();       
    }
}

startSimulation()