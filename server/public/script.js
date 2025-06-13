const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const GRID_SIZE = 50;
const ANIMATION_DURATION = 300;

const scale = canvas.width / GRID_SIZE;

let socket;
let wsServerUrl;
let reconnectTimeout;

let state;
let nextState;
let prevMap;

function resetAnimationState() {
    state = null;
    nextState = null;
    prevMap = new Map();
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

function draw() {
    const now = performance.now();

    if (nextState) {
        prevMap = createCreatureMap(state ? state.creatures : nextState.creatures);
        state = nextState;
        nextState = null;
        updateStats();
    }

    if (state) {
        const t = Math.min((now - state.timestamp) / ANIMATION_DURATION, 1);

        ctx.globalAlpha = 1;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "#e8e8e8"; // light gray
        state.obstacles.forEach(({ x, y }) => {
            ctx.fillRect(x * scale, y * scale, scale, scale);
        });

        ctx.fillStyle = "#008000"; // green
        state.food.forEach(({ x, y }) => {
            ctx.fillRect(x * scale, y * scale, scale, scale);
        });

        state.creatures.forEach((creature) => {
            let drawX, drawY, drawAngle;
            const prev = prevMap.get(creature.id);
            if (prev) {
                drawX = lerp(prev.x, creature.x, t);
                drawY = lerp(prev.y, creature.y, t);
                drawAngle = lerpAngle(prev.angle, creature.angle, t);
            } else {
                drawX = creature.x;
                drawY = creature.y;
                drawAngle = creature.angle;
            }

            ctx.save();
            ctx.translate(drawX * scale + scale * 0.5, drawY * scale + scale * 0.5);
            ctx.rotate(drawAngle + Math.PI * 0.75); // rotate towards positive x-axis

            ctx.globalAlpha = creature.energy / state.params.maxEnergy * 0.8 + 0.2;
            const flash = creature.flashing && (Math.floor(now / 200) % 2 === 0);
            ctx.fillStyle = flash ? "#ff0000" : "#0000ff"; // red : blue
            ctx.fillRect(-scale * 0.5, -scale * 0.5, scale, scale);
            ctx.fillStyle = "#ffdd00"; // yellow
            ctx.fillRect(-scale * 0.5, -scale * 0.5, scale * 0.5, scale * 0.5);
            ctx.restore();
        });
    }

    requestAnimationFrame(draw);
}

function updateStats() {
    document.getElementById("restarts").textContent = state.stats.restarts;
    document.getElementById("generation").textContent = state.stats.generation;
    document.getElementById("creature-count").textContent = state.stats.creatureCount;
    document.getElementById("food-count").textContent = state.stats.foodCount + "/" + state.params.maxFoodCount;
}

function createCreatureMap(creatures) {
    return new Map(creatures.map(c => [c.id, {
        x: c.x,
        y: c.y,
        angle: c.angle
    }]));
}

function start(retry = true) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
    }

    socket = new WebSocket(wsServerUrl);

    socket.onopen = () => {
        console.log("Connected to WS server");
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
        }
        resetAnimationState();
    };

    socket.onmessage = event => {
        nextState = JSON.parse(event.data);
        nextState.timestamp = performance.now();
    };

    socket.onclose = () => {
        console.log("WS closed");
        if (retry) {
            reconnectTimeout = setTimeout(() => {
                console.log("Trying to reconnect...");
                start(true);
            }, 1000);
        }
    };

    socket.onerror = error => {
        console.error("WS error:", error);
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
            console.log("Reconnecting WS...");
            start(true);
        }
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

function toggleAbout() {
    const aboutSection = document.getElementById("about-section");
    const aboutToggle = document.getElementById("about-toggle");

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

document.getElementById("about-toggle").addEventListener("click", () => {
    const aboutSection = document.getElementById("about-section");
    const aboutToggle = document.getElementById("about-toggle");

    if (aboutSection.style.display === "block") {
        aboutSection.style.display = "none";
        canvas.style.display = "block";
        aboutToggle.innerHTML = "about";
    } else {
        aboutSection.style.display = "block";
        canvas.style.display = "none";
        aboutToggle.innerHTML = "back";
    }
});

function getGridCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;
    return {
        x: Math.floor(canvasX / (canvas.width / GRID_SIZE)),
        y: Math.floor(canvasY / (canvas.height / GRID_SIZE))
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