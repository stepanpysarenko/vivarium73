const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const toggleButton = document.getElementById("toggleButton");
var socket = null;

const SERVER_URL = "ws://localhost:3000";
const ANIMATION_DURATION = 100; // Smooth transition time in ms

let creatures = {};
let food = {}
let lastUpdateTime = performance.now();
let animationProgress = 0; // Tracks animation phase

function lerp(a, b, t) {
    return a + (b - a) * t;
}

// Function to smoothly render creatures
function draw() {
    const now = performance.now();
    const deltaTime = now - lastUpdateTime;
    lastUpdateTime = now;

    animationProgress += deltaTime / ANIMATION_DURATION;
    animationProgress = Math.min(animationProgress, 1); // Clamp between 0 and 1

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scale = canvas.width / 50; // Assuming gridSize = 100

    // Draw food
    ctx.fillStyle = "green";
    for (let { x, y } of Object.values(food)) {
        ctx.fillRect(x * scale, y * scale, scale, scale);
    }

    // Draw creatures smoothly
    ctx.fillStyle = "blue";
    for (let id in creatures) {
        let c = creatures[id];

        // Interpolating position
        let drawX = lerp(c.previousX, c.targetX, animationProgress);
        let drawY = lerp(c.previousY, c.targetY, animationProgress);

        ctx.fillRect(drawX * scale, drawY * scale, scale, scale);
    }

    requestAnimationFrame(draw); // Keep the animation loop running
}

function updateGameState(newGameState) {
    newGameState.creatures.forEach(creature => {
        const id = creature.id; // Ensure each creature has a unique ID

        if (!creatures[id]) {
            // Initialize new creature
            creatures[id] = {
                previousX: creature.x,
                previousY: creature.y,
                targetX: creature.x,
                targetY: creature.y
            };
        } else {
            // Update movement smoothly
            creatures[id].previousX = creatures[id].targetX;
            creatures[id].previousY = creatures[id].targetY;
            creatures[id].targetX = creature.x;
            creatures[id].targetY = creature.y;
        }
    });

    food = newGameState.food;

    animationProgress = 0; // Reset animation phase for smooth transition
}

// function draw(gameState) { 
//     ctx.clearRect(0, 0, canvas.width, canvas.height);
//     const scale = canvas.width / gameState.gridSize;

//     ctx.fillStyle = "green";
//     gameState.food.forEach(({ x, y }) => {
//         ctx.fillRect(x * scale, y * scale, scale, scale);
//     });

//     ctx.fillStyle = "blue";
//     gameState.creatures.forEach(({ x, y }) => {
//         ctx.fillRect(x * scale, y * scale, scale, scale);
//     });
// }

function start() {
    socket = new WebSocket(SERVER_URL);

    socket.onopen = () => {
        console.log("Connected to WebSocket server");
    };

    socket.onmessage = event => {
        // draw(gameState);
        const gameState = JSON.parse(event.data);
        updateGameState(gameState);
    };
    
    socket.onclose = () => {
        console.log("Connection to WebSocket server closed");
    };
    
    socket.onerror = error => {
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

document.addEventListener("DOMContentLoaded", () => {
    start();
    requestAnimationFrame(draw);
});
