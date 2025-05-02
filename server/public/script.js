const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

var socket;
var wsServerUrl;

const ANIMATION_DURATION = 500;
let lastCanvasUpdateTime = performance.now();
let animationProgress = 1;

let reconnectTimeout = null;

let state = {
    creatures: [],
    food: [],
    obstacles: [],
    stats: {
        restarts: 0,
        generation: 0,
        creatureCount: 0,
        foodCount: 0
    },
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

    ctx.fillStyle = "#f0f0f0";
    state.obstacles.forEach(({ x, y }) => {
        ctx.fillRect(x * scale, y * scale, scale, scale);
    });

    ctx.fillStyle = "green";
    state.food.forEach(({ x, y }) => {
        ctx.fillRect(x * scale, y * scale, scale, scale);
    });

    state.creatures.forEach(({ x, y, facing_angle, prev_x, prev_y, prev_facing_angle, energy }) => {
        ctx.globalAlpha = energy / state.params.maxEnergy * 0.9 + 0.1;
        ctx.fillStyle = "blue";
        let drawX = lerp(prev_x, x, animationProgress);
        let drawY = lerp(prev_y, y, animationProgress);
        let angle = lerp(prev_facing_angle, facing_angle, animationProgress);

        ctx.save();
        ctx.translate(drawX * scale + scale, drawY * scale);
        ctx.rotate(angle);

        ctx.beginPath();
        ctx.moveTo(scale, 0);
        ctx.lineTo(-scale, scale * 0.7);
        ctx.lineTo(-scale, -scale * 0.7);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "yellow";
        ctx.fillRect(0, 0, 1, 1);

        ctx.restore();
    });

    requestAnimationFrame(draw);
}

function updateStats() {
    document.getElementById("restarts").textContent = state.stats.restarts;
    document.getElementById("generation").textContent = state.stats.generation;
    document.getElementById("creature-count").textContent = state.stats.creatureCount;
    document.getElementById("food-count").textContent = state.stats.foodCount;
}

function start(retry = true) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
    }

    socket = new WebSocket(wsServerUrl);

    socket.onopen = () => {
        console.log("Connected to WebSocket server");
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
        }
    };

    socket.onmessage = event => {
        state = JSON.parse(event.data);
        animationProgress = 0;
    };

    socket.onclose = () => {
        console.log("WebSocket closed");
        if (retry) {
            reconnectTimeout = setTimeout(() => {
                console.log("Trying to reconnect...");
                start(true);
            }, 2000);
        }
    };

    socket.onerror = error => {
        console.error("WebSocket error:", error);
    };
}

document.addEventListener("DOMContentLoaded", async () => {
    try {
        const response = await fetch("/api/wsurl");
        const data = await response.json();
        wsServerUrl = data.wsUrl;

        start();
        requestAnimationFrame(draw);
        setInterval(updateStats, 1000);
    } catch (error) {
        console.error("Error getting ws server url", error);
    }
});

function reconnect() {
    setTimeout(() => {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            console.log("Ensuring WS connection...");
            start(true);
        }
    }, 250);
}

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
        reconnect();
    }
});

window.addEventListener("focus", reconnect);
window.addEventListener("pageshow", reconnect);
window.addEventListener("online", reconnect);

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

function toggleAbout() {
    const aboutSection = document.getElementById("about-section");
    const aboutToggle = document.getElementById("about-toggle");
    const canvas = document.getElementById("canvas");
    if (aboutSection.style.display === "block") {
        aboutSection.style.display = "none";
        canvas.style.display = "block";
        aboutToggle.innerHTML = "about";
    } else {
        aboutSection.style.display = "block";
        canvas.style.display = "none";
        aboutToggle.innerHTML = "back";
    }
}