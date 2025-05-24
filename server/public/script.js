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
        maxEnergy: 0,
        maxFoodCount: 0
    }
};

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function lerpAngle(from, to, t) {
    let delta = to - from;

    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;

    return from + delta * t;
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

    ctx.fillStyle = "#e8e8e8"; // light gray
    state.obstacles.forEach(({ x, y }) => {
        ctx.fillRect(x * scale, y * scale, scale, scale);
    });

    ctx.fillStyle = "#008000"; // green
    state.food.forEach(({ x, y }) => {
        ctx.fillRect(x * scale, y * scale, scale, scale);
    });

    state.creatures.forEach(({ x, y, facingAngle, energy, prev, updatesToFlash }) => {
        let drawX = lerp(prev.x, x, animationProgress);
        let drawY = lerp(prev.y, y, animationProgress);
        let angle = lerpAngle(prev.facingAngle, facingAngle, animationProgress);
        angle = angle + Math.PI * 0.75; // rotate towards positive x-axis

        ctx.save();
        ctx.translate(drawX * scale + scale * 0.5, drawY * scale + scale * 0.5);
        ctx.rotate(angle);

        ctx.globalAlpha = energy / state.params.maxEnergy * 0.8 + 0.2;
        ctx.fillStyle = updatesToFlash > 0 && (Math.floor(now / 200) % 2 == 0) ? "#ff0000" : "#0000ff"; // red : blue
        ctx.fillRect(-scale * 0.5, -scale * 0.5, scale, scale);
        ctx.fillStyle = "#ffdd00"; // yellow
        ctx.fillRect(-scale * 0.5, -scale * 0.5, scale * 0.5, scale * 0.5);

        ctx.restore();
    });

    requestAnimationFrame(draw);
}

function updateStats() {
    document.getElementById("restarts").textContent = state.stats.restarts;
    document.getElementById("generation").textContent = state.stats.generation;
    document.getElementById("creature-count").textContent = state.stats.creatureCount;
    document.getElementById("food-count").textContent = state.stats.foodCount + "/" + state.params.maxFoodCount;
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
        updateStats();
    };

    socket.onclose = () => {
        console.log("WebSocket closed");
        if (retry) {
            reconnectTimeout = setTimeout(() => {
                console.log("Trying to reconnect...");
                start(true);
            }, 1000);
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

canvas.addEventListener("click", async (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;
    const gridX = Math.floor(canvasX / (canvas.width / state.params.gridSize));
    const gridY = Math.floor(canvasY / (canvas.height / state.params.gridSize));

    // for instant visual feedback
    var isFood = state.food.some(f => f.x == gridX && f.y == gridY);
    var isObstacle = state.obstacles.some(o => o.x == gridX && o.y == gridY);
    var foodLimitReached = state.food.length >= state.params.maxFoodCount;
    if (!isFood && !isObstacle && !foodLimitReached) {
        state.food.push({ x: gridX, y: gridY });
    }

    try {
        const res = await fetch("/api/place-food", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ x: gridX, y: gridY }),
        });
        const data = await res.json();
        if (!data.success) {
            console.error(data.error);
        }
    } catch (err) {
        console.error("Failed to place food", err);
    }
});