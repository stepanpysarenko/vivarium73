const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

var socket;
var wsServerUrl;

const ANIMATION_DURATION = 500;
let lastCanvasUpdateTime = performance.now();
let animationProgress = 1;

let state = {
    creatures: [],
    food: [],
    params: {
        gridSize: 0,
        maxEnergy: 0
    }
};

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function draw() {
    const now = performance.now();
    const deltaTime = now - lastCanvasUpdateTime;
    lastCanvasUpdateTime = now;

    if (animationProgress < 1) {
        animationProgress += deltaTime / ANIMATION_DURATION;
    }
    animationProgress = Math.min(animationProgress, 1);

    ctx.globalAlpha = 1;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scale = canvas.width / state.params.gridSize;

    ctx.fillStyle = "green";
    state.food.forEach(({ x, y }) => {
        ctx.fillRect(x * scale, y * scale, scale, scale);
    });

    state.creatures.forEach(({ x, y, prev_x, prev_y, energy }) => {
        ctx.globalAlpha = energy / state.params.maxEnergy * 0.9 + 0.1;

        ctx.fillStyle = "blue";
        let drawX = lerp(prev_x, x, animationProgress);
        let drawY = lerp(prev_y, y, animationProgress);
        ctx.fillRect(drawX * scale, drawY * scale, scale, scale);
    });

    requestAnimationFrame(draw);
}

function updateStats() {
    document.getElementById("restarts").textContent = state.stats.restarts;
    document.getElementById("generation").textContent = state.stats.generation;
    document.getElementById("creature-count").textContent = state.stats.creatureCount;
    document.getElementById("food-count").textContent = state.stats.foodCount;
}

function start() {
    socket = new WebSocket(wsServerUrl);

    socket.onopen = () => {
        console.log("Connected to WebSocket server");
    };

    socket.onmessage = event => {
        state = JSON.parse(event.data);
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

function ensureWebSocketConnection() {
    if (!socket || socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) {
        console.log("Reconnecting to WebSocket server...");
        start();
    }
}

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
        ensureWebSocketConnection();
    }
});

window.addEventListener("focus", () => {
    ensureWebSocketConnection();
});

window.addEventListener("pageshow", () => {
    ensureWebSocketConnection();
});

window.addEventListener("beforeunload", () => {
    if (socket) {
        socket.close();
    }
});


if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(reg => console.log('SW registered:', reg))
            .catch(err => console.error('SW registration failed:', err));
    });
}

