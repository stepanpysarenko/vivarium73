const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const restartsEl = document.getElementById("restarts");
const generationEl = document.getElementById("generation");
const creatureCountEl = document.getElementById("creature-count");
const foodCountEl = document.getElementById("food-count");

const aboutSection = document.getElementById("about-section");
const aboutToggle = document.getElementById("about-toggle");

let config = null;

let socket;
let wsServerUrl;
let reconnectScheduled = false;

let state;
let nextState;
let prevMap;
let estimatedInterval;
let lastUpdateTime;
let scale;
let halfScale;

function resetAnimationState() {
    if (!config) {
        console.warn("config is not loaded yet, cannot reset animation state");
        return;
    }

    state = null;
    nextState = null;
    prevMap = new Map();
    estimatedInterval = config.stateUpdateInterval;
    lastUpdateTime = null;

    scale = canvas.width / config.params.gridSize;
    halfScale = scale * 0.5;
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function lerpAngle(from, to, t) {
    let delta = to - from;
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;
    return from + delta * t;
}

function clearCanvas() {
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawObstacles() {
    ctx.fillStyle = "#e8e8e8"; // light gray
    state.obstacles.forEach(({ x, y }) => {
        ctx.fillRect(x * scale, y * scale, scale, scale);
    });
}

function drawFood() {
    ctx.fillStyle = "#008000"; // green
    state.food.forEach(({ x, y }) => {
        ctx.fillRect(x * scale, y * scale, scale, scale);
    });
}

function drawCreatures(t, now) {
    state.creatures.forEach((creature) => {
        let x, y, angle;
        const prev = prevMap.get(creature.id);
        if (prev) {
            x = lerp(prev.x, creature.x, t);
            y = lerp(prev.y, creature.y, t);
            angle = lerpAngle(prev.angle, creature.angle, t);
        } else {
            x = creature.x;
            y = creature.y;
            angle = creature.angle;
        }

        ctx.save();
        ctx.translate(x * scale + halfScale, y * scale + halfScale);
        ctx.rotate(angle + Math.PI * 0.75); // rotate towards positive x-axis

        ctx.globalAlpha = creature.energy / config.params.maxEnergy * 0.8 + 0.2;
        const flash = creature.flashing && (Math.floor(now / 200) % 2 === 0);
        ctx.fillStyle = flash ? "#ff0000" : "#0000ff"; // red : blue
        ctx.fillRect(-halfScale, -halfScale, scale, scale);
        ctx.fillStyle = "#ffdd00"; // yellow
        ctx.fillRect(-halfScale, -halfScale, halfScale, halfScale);
        ctx.restore();
    });
}

function draw() {
    if (nextState) {
        if (state) {
            prevMap = createCreatureMap(state.creatures);
        } else {
            prevMap = createCreatureMap(nextState.creatures);
        }

        if (lastUpdateTime !== null) {
            const interval = nextState.timestamp - lastUpdateTime;
            estimatedInterval = 0.8 * estimatedInterval + 0.2 * interval;
        }
        lastUpdateTime = nextState.timestamp;

        state = nextState;
        nextState = null;
        updateStats();
    }

    if (state) {
        const now = performance.now();
        const t = Math.min((now - lastUpdateTime) / estimatedInterval, 1.2);

        clearCanvas();
        drawObstacles();
        drawFood();
        drawCreatures(t, now);
    }

    requestAnimationFrame(draw);
}

function updateStats() {
    restartsEl.textContent = state.stats.restarts;
    generationEl.textContent = state.stats.generation;
    creatureCountEl.textContent = state.stats.creatureCount;
    foodCountEl.textContent = `${state.stats.foodCount}/${config.params.maxFoodCount}`;
}

function createCreatureMap(creatures) {
    return new Map(creatures.map(c => [c.id, {
        x: c.x,
        y: c.y,
        angle: c.angle
    }]));
}

function start() {
    if (socket) {
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
            console.log("WS is already open or connecting - skipping new start");
            return;
        }

        try {
            socket.close();
        } catch (e) {
            console.warn("Failed to close existing WS:", e.message);
        }
    }

    socket = new WebSocket(config.webSocketUrl);

    socket.onopen = () => {
        console.log("Connected to WS server");
        resetAnimationState();
    };

    socket.onmessage = event => {
        nextState = JSON.parse(event.data);
        nextState.timestamp = performance.now();
    };

    socket.onclose = () => {
        console.log("WS closed");
        reconnect();
    };

    socket.onerror = error => {
        console.error("WS error:", error);
    };
}

document.addEventListener("DOMContentLoaded", async () => {
    try {
        const response = await fetch("/api/config");
        config = await response.json();
        start();
        requestAnimationFrame(draw);
    } catch (error) {
        console.error("Error getting ws server url", error);
    }
});

function reconnect() {
    if (reconnectScheduled) return;
    reconnectScheduled = true;
    setTimeout(() => {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            console.log("Reconnecting WS...");
            start();
        }
        reconnectScheduled = false;
    }, 250);
}

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
        resetAnimationState();
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
            .then(reg => console.log('ServiceWorker registered:', reg))
            .catch(err => console.error('ServiceWorker registration failed:', err));
    });
}

aboutToggle.addEventListener("click", () => {
    document.body.classList.toggle("about-visible");
    aboutToggle.textContent = document.body.classList.contains("about-visible") ? "back" : "about";
});

function getGridCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;
    return {
        x: Math.floor(canvasX / (canvas.width / config.params.gridSize)),
        y: Math.floor(canvasY / (canvas.height / config.params.gridSize))
    };
}

canvas.addEventListener("click", async (e) => {
    const { x: gridX, y: gridY } = getGridCoordinates(e);

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