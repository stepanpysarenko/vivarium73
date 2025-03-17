const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

var socket;
var wsServerUrl;

let lastStateUpdateTime = performance.now();
let stateUpdateInterval;
let lastCanvasUpdateTime = performance.now();
let animationProgress = 1;

let gameState = { creatures: [], food: [], gridSize: 0 };

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function draw() {
    const now = performance.now();
    const deltaTime = now - lastCanvasUpdateTime;
    lastCanvasUpdateTime = now;

    if (animationProgress < 1) {
        animationProgress += deltaTime / stateUpdateInterval;
    }
    animationProgress = Math.min(animationProgress, 1);

    ctx.globalAlpha = 1;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scale = canvas.width / gameState.gridSize;

    ctx.fillStyle = "green";
    gameState.food.forEach(({ x, y }) => {
        ctx.fillRect(x * scale, y * scale, scale, scale);
    });

    gameState.creatures.forEach(({ x, y, prev_x, prev_y, energy, generation }) => {
        ctx.globalAlpha = energy / gameState.maxEnergy * 0.9 + 0.1;

        ctx.fillStyle = "blue";
        let drawX = lerp(prev_x, x, animationProgress);
        let drawY = lerp(prev_y, y, animationProgress);
        ctx.fillRect(drawX * scale, drawY * scale, scale, scale);  

        // yellow square to indicate current generation
        if (generation == gameState.stats.generation) {
            ctx.fillStyle = "yellow"; 
            ctx.fillRect(drawX * scale + scale * 0.25, drawY * scale + scale * 0.25,  scale * 0.5,  scale * 0.5);  
        }
    });

    requestAnimationFrame(draw);
}

function updateStats() {
    document.getElementById("generation").textContent = gameState.stats.generation;
    document.getElementById("creature-count").textContent = gameState.stats.creatureCount;
    document.getElementById("food-count").textContent = gameState.stats.foodCount;
}

function start() {
    socket = new WebSocket(wsServerUrl);

    socket.onopen = () => {
        console.log("Connected to WebSocket server");
    };

    socket.onmessage = event => {
        gameState = JSON.parse(event.data);
        stateUpdateInterval = performance.now() - lastStateUpdateTime;
        lastStateUpdateTime = performance.now();
        animationProgress = 0;
    };
    
    socket.onclose = () => {
        console.log("Connection to WebSocket server closed");
    };
    
    socket.onerror = error => {
        console.error("WebSocket error:", error);
    };
}

document.addEventListener("DOMContentLoaded", async () => {
    try {
        const response = await fetch("/api/wsurl");
        wsServerUrl = response.wsUrl;

        start();
        requestAnimationFrame(draw);
        setInterval(updateStats, 1000);
    } catch (error) {
        console.error("Error getting ws server url", error);
    }
});
