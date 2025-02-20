const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const gridSize = 100;
const scale = canvas.width / gridSize;

const interval = 100;
var timer = null;

let gameState = { creatures: [], food: [] };

async function resetState() {
    try {
        const response = await fetch("http://localhost:3000/reset-state");
    } catch (error) {
        console.error("Error reseting state:", error);
    }
}

async function fetchGameUpdate() {
    try {
        const response = await fetch("http://localhost:3000/move");
        gameState = await response.json();
    } catch (error) {
        console.error("Error fetching game update:", error);
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "green";
    gameState.food.forEach(({ x, y }) => {
        ctx.fillRect(x * scale, y * scale, scale, scale);
    });

    ctx.fillStyle = "blue";
    gameState.creatures.forEach(({ x, y }) => {
        ctx.fillRect(x * scale, y * scale, scale, scale);
    });
}

function gameLoop() {
    fetchGameUpdate()
    draw();
}

const toggleButton = document.getElementById("toggleButton");

function startSimulation() {
    console.log('Starting simulation...');
    timer = setInterval(gameLoop, interval);
    toggleButton.textContent = "Stop";
}

function stopSimulation() {
    console.log('Stopping simulation...');
    clearInterval(timer);
    timer = null;
    toggleButton.textContent = "Start";
}

function toggleSimulation() {
    if (timer) {
        stopSimulation();       
    } else {
        startSimulation();       
    }
}

function resetSimulation() {
    resetState();
}

document.addEventListener("DOMContentLoaded", async () => {
    startSimulation();
});