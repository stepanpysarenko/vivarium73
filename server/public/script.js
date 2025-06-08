const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const GRID_SIZE = 50;
const SCALE = canvas.width / GRID_SIZE;
const ANIMATION_DURATION = 550;

let socket, wsServerUrl, reconnectTimeout;
let state, prevMap, lastUpdateTime, estimatedInterval;

function resetAnimation() {
    state = null;
    prevMap = null;
    lastUpdateTime = performance.now();
    estimatedInterval = ANIMATION_DURATION;
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
    const t = Math.min((now - lastUpdateTime) / estimatedInterval, 2);

    if (state && prevMap) {
        ctx.globalAlpha = 1;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "#e8e8e8"; // light gray
        state.obstacles.forEach(({ x, y }) => {
            ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
        });

        ctx.fillStyle = "#008000"; // green
        state.food.forEach(({ x, y }) => {
            ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
        });

        state.creatures.forEach((creature) => {
            let drawX, drawY, angle;
            const prev = prevMap.get(creature.id);
            if (prev) {
                drawX = lerp(prev.x, creature.x, t);
                drawY = lerp(prev.y, creature.y, t);
                angle = lerpAngle(prev.facingAngle, creature.facingAngle, t);
            } else {
                drawX = creature.x;
                drawY = creature.y;
                angle = creature.facingAngle;
            }

            ctx.save();
            ctx.translate(drawX * SCALE + SCALE * 0.5, drawY * SCALE + SCALE * 0.5);
            ctx.rotate(angle + Math.PI * 0.75); // rotate towards positive x-axis

            ctx.globalAlpha = creature.energy / state.params.maxEnergy * 0.8 + 0.2;
            let flash = creature.updatesToFlash > 0 && (Math.floor(now / 200) % 2 == 0);
            ctx.fillStyle = flash ? "#ff0000" : "#0000ff"; // red : blue
            ctx.fillRect(-SCALE * 0.5, -SCALE * 0.5, SCALE, SCALE);
            ctx.fillStyle = "#ffdd00"; // yellow
            ctx.fillRect(-SCALE * 0.5, -SCALE * 0.5, SCALE * 0.5, SCALE * 0.5);
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
        facingAngle: c.facingAngle
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
        resetAnimation();
    };

    socket.onmessage = event => {
        const now = performance.now();
        const interval = now - lastUpdateTime;
        lastUpdateTime = now;
        estimatedInterval = 0.8 * estimatedInterval + 0.2 * interval;

        const newState = JSON.parse(event.data);

        if (state && state.stats.restarts === newState.stats.restarts) {
            prevMap = createCreatureMap(state.creatures);
        }
        else {
            prevMap = createCreatureMap(newState.creatures);
        }

        state = newState;
        updateStats();
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

document.getElementById("about-toggle").addEventListener("click", () => {
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
});

canvas.addEventListener("click", async (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;
    const gridX = Math.floor(canvasX / (canvas.width / GRID_SIZE));
    const gridY = Math.floor(canvasY / (canvas.height / GRID_SIZE));

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