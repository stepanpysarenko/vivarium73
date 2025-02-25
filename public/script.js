const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const toggleButton = document.getElementById("toggleButton");
var socket = null;

const SERVER_URL = "ws://localhost:3000";

function draw(gameState) { 
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

function start() {
    socket = new WebSocket(SERVER_URL);

    socket.onopen = event => {
        console.log("Connected to WebSocket server:", event.currentTarget.url);
    };

    socket.onmessage = event => {
        const gameState = JSON.parse(event.data);
        // console.log("Updated game state:", gameState);
        draw(gameState);
    };
    
    socket.onclose = () => {
        console.log("Connection to WebSocket server closed");
    };
    
    socket.onerror = (error) => {
        console.error("WebSocket error:", error);
    };

    toggleButton.textContent = "Stop";
}

function stop() {
    socket.close();
    socket = null;
    toggleButton.textContent = "Start";
}

function toggle() {   
    if (socket) {
        stop();       
    } else {
        start();       
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    start();
});