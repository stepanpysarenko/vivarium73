const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
var socket = null;

const stats = document.getElementById("stats");

const SERVER_URL = "ws://localhost:3000";
const ANIMATION_DURATION = 100; 

let lastUpdateTime = performance.now();
let animationProgress = 1;
let gameState = { creatures: [], food: [], gridSize: 0 };
let topCreatureId = null;

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function draw() {
    const now = performance.now();
    const deltaTime = now - lastUpdateTime;
    lastUpdateTime = now;

    if (animationProgress < 1) {
        animationProgress += deltaTime / ANIMATION_DURATION;
    }
    animationProgress = Math.min(animationProgress, 1);

    ctx.globalAlpha = 1;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scale = canvas.width / gameState.gridSize;

    // draw food
    ctx.fillStyle = "green";
    gameState.food.forEach(({ x, y }) => {
        ctx.fillRect(x * scale, y * scale, scale, scale);
    });

    // draw creature
    gameState.creatures.forEach(({ x, y, prev_x, prev_y, energy, generation }) => {
        ctx.fillStyle = "blue";
        ctx.globalAlpha = energy / gameState.maxEnergy * 0.9 + 0.1;
        let drawX = lerp(prev_x, x, animationProgress);
        let drawY = lerp(prev_y, y, animationProgress);
        ctx.fillRect(drawX * scale, drawY * scale, scale, scale);

        if (generation > 0) {
            ctx.fillStyle = "black";
            ctx.font = "16px sans-serif";
            ctx.fillText(generation, drawX * scale + 5, drawY * scale + 16);
        }      
    });

    requestAnimationFrame(draw);
}

function updateStats(){
    stats.innerHTML = gameState.creatures.length;
}

function start() {
    socket = new WebSocket(SERVER_URL);

    socket.onopen = () => {
        console.log("Connected to WebSocket server");
    };

    socket.onmessage = event => {
        gameState = JSON.parse(event.data);
        animationProgress = 0;
    };
    
    socket.onclose = () => {
        console.log("Connection to WebSocket server closed");
    };
    
    socket.onerror = error => {
        console.error("WebSocket error:", error);
    };
}

document.addEventListener("DOMContentLoaded", () => {
    start();
    requestAnimationFrame(draw);
    setInterval(updateStats, 1000);
});
