(() => {
    'use strict';

    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');

    const elements = {
        aboutToggle: document.getElementById('about-toggle'),
        stats: {
            grid: {
                panel: document.getElementById('stats-grid'),
                restarts: document.getElementById('stats-grid-restarts'),
                generation: document.getElementById('stats-grid-generation'),
                creatures: document.getElementById('stats-grid-creatures'),
                food: document.getElementById('stats-grid-food')
            },
            creature: {
                panel: document.getElementById('stats-creature'),
                id: document.getElementById('stat-creature-id'),
                generation: document.getElementById('stat-creature-generation'),
                energy: document.getElementById('stat-creature-energy'),
                score: document.getElementById('stat-creature-score'),
                life: document.getElementById('stat-creature-life')
            }
        }
    };

    let config;
    let socket;
    let reconnectScheduled = false;

    let state;
    let nextState;
    let prevMap;
    let estimatedInterval;
    let lastUpdateTime;
    let scale;
    let halfScale;

    let observedCreatureId;

    const isLoading = () => document.body.classList.contains('loading');
    const showLoader = () => document.body.classList.add('loading');
    const hideLoader = () => document.body.classList.remove('loading');

    function updateGridStats() {
        elements.stats.grid.restarts.textContent = state.stats.restarts;
        elements.stats.grid.generation.textContent = state.stats.generation;
        elements.stats.grid.creatures.textContent = state.stats.creatureCount;
        elements.stats.grid.food.textContent = `${state.stats.foodCount}/${config.maxFoodCount}`;
    }

    function updateObservedCreatureStats() {
        if (!observedCreatureId) return;

        const creature = state.creatures.find(c => c.id === observedCreatureId);
        if (!creature) {
            stopObservingCreature();
            return;
        }

        elements.stats.creature.id.textContent = `id${creature.id}`;
        elements.stats.creature.generation.textContent = `${creature.generation}`;
        elements.stats.creature.energy.textContent = `${Math.round(creature.energy * 100)}%`;
        elements.stats.creature.score.textContent = `${creature.score}`;
        elements.stats.creature.life.textContent = formatTime(creature.msLived);
    }

    function resetAnimationState() {
        state = null;
        nextState = null;
        prevMap = new Map();
        estimatedInterval = config.stateUpdateInterval;
        lastUpdateTime = null;

        scale = canvas.width / config.gridSize;
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
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#e8e8e8';
        state.obstacles.forEach(({ x, y }) => {
            ctx.fillRect(x * scale, y * scale, scale, scale);
        });
    }

    function drawFood() {
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#008000';
        state.food.forEach(({ x, y }) => {
            ctx.fillRect(x * scale, y * scale, scale, scale);
        });
    }

    function drawCreatures(t, now) {
        state.creatures.forEach(creature => {
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

            ctx.globalAlpha = creature.energy * 0.8 + 0.2;
            const flash = creature.flashing && Math.floor(now / 200) % 2 === 0;
            ctx.fillStyle = flash ? '#ff0000' : '#0000ff';

            if (creature.id === observedCreatureId) {
                ctx.shadowColor = '#0000ff';
                ctx.shadowBlur = 15;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
            } else {
                ctx.shadowBlur = 0;
            }

            ctx.fillRect(-halfScale, -halfScale, scale, scale);
            ctx.fillStyle = '#ffdd00';
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

            if (state && isLoading()) hideLoader();

            if (lastUpdateTime !== null) {
                const interval = nextState.timestamp - lastUpdateTime;
                estimatedInterval = 0.8 * estimatedInterval + 0.2 * interval;
            }
            lastUpdateTime = nextState.timestamp;

            state = nextState;
            nextState = null;

            updateGridStats();
            updateObservedCreatureStats();
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

    const createCreatureMap = creatures => new Map(creatures.map(c => [c.id, {
        x: c.x,
        y: c.y,
        angle: c.angle
    }]));

    function startWebSocket() {
        if (socket) {
            if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
                console.log('WS is already open or connecting - skipping new start');
                return;
            }

            try {
                socket.close();
            } catch (e) {
                console.warn('Failed to close existing WS:', e.message);
            }
        }

        socket = new WebSocket(config.webSocketUrl);

        socket.onopen = () => {
            console.log('Connected to WS server');
            resetAnimationState();
            stopObservingCreature();
        };

        socket.onmessage = event => {
            nextState = JSON.parse(event.data);
            nextState.timestamp = performance.now();
        };

        socket.onclose = () => {
            console.log('WS closed');
            showLoader();
            reconnect();
        };

        socket.onerror = error => console.error('WS error:', error);
    }

    function reconnect() {
        if (reconnectScheduled) return;
        reconnectScheduled = true;
        setTimeout(() => {
            if (!socket || socket.readyState !== WebSocket.OPEN) {
                console.log('Reconnecting WS...');
                startWebSocket();
            }
            reconnectScheduled = false;
        }, 250);
    }

    function onVisibilityChange() {
        if (document.visibilityState === 'visible') {
            resetAnimationState();
            stopObservingCreature();
            reconnect();
        }
    }

    function getGridClickCoordinates(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const canvasX = (e.clientX - rect.left) * scaleX;
        const canvasY = (e.clientY - rect.top) * scaleY;
        return {
            x: Math.floor(canvasX / (canvas.width / config.gridSize)),
            y: Math.floor(canvasY / (canvas.height / config.gridSize))
        };
    }

    async function placeFood(x, y) {
        if (typeof gtag === 'function') gtag('event', 'place_food');

        try {
            const res = await fetch('/api/place-food', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ x, y })
            });
            const data = await res.json();
            if (!data.success) {
                console.error(data.error);
            }
        } catch (err) {
            console.error('Failed to place food', err);
        }
    }

    function formatTime(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const totalMinutes = Math.floor(totalSeconds / 60);
        const totalHours = Math.floor(totalMinutes / 60);
        const totalDays = Math.floor(totalHours / 24);

        if (totalSeconds < 60) {
            return `${totalSeconds}s`;
        } else if (totalMinutes < 180) {
            return `${totalMinutes}m`;
        } else if (totalHours < 72) {
            return `${totalHours}h`;
        }
        return `${totalDays}d`;
    }

    function startObservingCreature(creature) {
        if (typeof gtag === 'function') gtag('event', 'observe_creature');

        observedCreatureId = creature.id;
        elements.stats.grid.panel.classList.add('hidden');
        elements.stats.creature.panel.classList.remove('hidden');
    }

    function stopObservingCreature() {
        elements.stats.grid.panel.classList.remove('hidden');
        elements.stats.creature.panel.classList.add('hidden');
        observedCreatureId = null;
    }

    async function onCanvasClick(e) {
        const { x, y } = getGridClickCoordinates(e);

        const clickedCreature = state.creatures.find(c => {
            const dx = c.x - x;
            const dy = c.y - y;
            return dx * dx + dy * dy < 2;
        });

        if (clickedCreature) {
            startObservingCreature(clickedCreature);
        } else if (observedCreatureId) {
            stopObservingCreature();
        } else {
            placeFood(x, y);
        }
    }

    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/service-worker.js')
                    .then(() => console.log('ServiceWorker registered'))
                    .catch(err => console.error('ServiceWorker registration failed:', err));
            });
        }
    }

    function setupEventListeners() {
        elements.aboutToggle.addEventListener('click', () => {
            document.body.classList.toggle('about-visible');
            elements.aboutToggle.textContent = document.body.classList.contains('about-visible') ? 'back' : 'about';
        });

        canvas.addEventListener('click', onCanvasClick);
        document.addEventListener('visibilitychange', onVisibilityChange);

        window.addEventListener('focus', reconnect);
        window.addEventListener('pageshow', reconnect);
        window.addEventListener('online', reconnect);
        window.addEventListener('beforeunload', () => {
            if (socket) socket.close();
        });
    }

    async function init() {
        try {
            const response = await fetch('/api/config');
            config = await response.json();
            startWebSocket();
            requestAnimationFrame(draw);
        } catch (error) {
            console.error('Error getting WS server url', error);
        }

        setupEventListeners();
        registerServiceWorker();
    }

    document.addEventListener('DOMContentLoaded', init);

})();
