const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const interval = 40; // 25 FPS
var timer = null;

let gameState = {creatures: [], food: [], gridSize: 0};

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
    const scale = canvas.width / gameState.gridSize;

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
    fetchGameUpdate();
    draw();
}

const toggleButton = document.getElementById("toggleButton");

function start() {
    console.log('Starting...');
    timer = setInterval(gameLoop, interval);
    toggleButton.textContent = "Stop";
}

function stop() {
    console.log('Stopping...');
    clearInterval(timer);
    timer = null;
    toggleButton.textContent = "Start";
}

function toggle() {
    if (timer) {
        stop();       
    } else {
        start();       
    }
}

function reset() {
    resetState();
}

document.addEventListener("DOMContentLoaded", async () => {
    start();
});