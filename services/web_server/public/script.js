(() => {
    'use strict';

    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');

    const el = {
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
                life: document.getElementById('stat-creature-life'),
                energy: document.getElementById('stat-creature-energy'),
                score: document.getElementById('stat-creature-score')
            }
        }
    };

    const app = {
        config: null,
        socket: null,
        reconnectScheduled: false,
        state: {
            current: null,
            next: null,
            prevMap: new Map(),
        },
        animation: {
            estimatedInterval: null,
            lastUpdateTime: null,
            scale: null,
            halfScale: null,
        },
        observedCreatureId: null,
    };

    const isLoading = () => document.body.classList.contains('loading');
    const showLoader = () => document.body.classList.add('loading');
    const hideLoader = () => document.body.classList.remove('loading');

    function updateGridStats() {
        el.stats.grid.restarts.textContent = app.state.current.stats.restarts;
        el.stats.grid.generation.textContent = app.state.current.stats.generation;
        el.stats.grid.creatures.textContent = app.state.current.stats.creatureCount;
        el.stats.grid.food.textContent = `${app.state.current.stats.foodCount}/${app.config.maxFoodCount}`;
    }

    function updateObservedCreatureStats() {
        if (!app.observedCreatureId) return;

        const creature = app.state.current.creatures.find(c => c.id === app.observedCreatureId);
        if (!creature) {
            stopObservingCreature();
            return;
        }

        el.stats.creature.id.textContent = `${creature.id}`;
        el.stats.creature.generation.textContent = `${creature.generation}`;
        el.stats.creature.life.textContent = formatTime(creature.msLived);
        el.stats.creature.energy.textContent = `${Math.round(creature.energy * 100)}%`;
        el.stats.creature.score.textContent = `${creature.score}`;
    }
    
    function resetAnimationState() {
        app.state.current = null;
        app.state.next = null;
        app.state.prevMap = new Map();
        app.animation.estimatedInterval = app.config.stateUpdateInterval;
        app.animation.lastUpdateTime = null;

        app.animation.scale = canvas.width / app.config.gridSize;
        app.animation.halfScale = app.animation.scale * 0.5;
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
        app.state.current.obstacles.forEach(({ x, y }) => {
            ctx.fillRect(x * app.animation.scale, y * app.animation.scale,
                app.animation.scale, app.animation.scale);
        });
    }

    function drawFood() {
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#008000';
        app.state.current.food.forEach(({ x, y }) => {
            ctx.fillRect(x * app.animation.scale, y * app.animation.scale,
                app.animation.scale, app.animation.scale);
        });
    }

    function drawCreatures(t, now) {
        app.state.current.creatures.forEach(creature => {
            let x, y, angle;
            const prev = app.state.prevMap.get(creature.id);
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
            ctx.translate(x * app.animation.scale + app.animation.halfScale,
                y * app.animation.scale + app.animation.halfScale);
            ctx.rotate(angle + Math.PI * 0.75); // rotate towards positive x-axis

            ctx.globalAlpha = creature.energy * 0.8 + 0.2;
            const flash = creature.flashing && Math.floor(now / 200) % 2 === 0;
            ctx.fillStyle = flash ? '#ff0000' : '#0000ff';

            if (creature.id === app.observedCreatureId) {
                ctx.shadowColor = '#0000ff';
                ctx.shadowBlur = 15;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
            } else {
                ctx.shadowBlur = 0;
            }

            ctx.fillRect(-app.animation.halfScale, -app.animation.halfScale,
                app.animation.scale, app.animation.scale);
            ctx.fillStyle = '#ffdd00';
            ctx.fillRect(-app.animation.halfScale, -app.animation.halfScale,
                app.animation.halfScale, app.animation.halfScale);
            ctx.restore();
        });
    }

    function draw() {
        if (app.state.next) {
            if (app.state.current) {
                app.state.prevMap = createCreatureMap(app.state.current.creatures);
            } else {
                app.state.prevMap = createCreatureMap(app.state.next.creatures);
            }

            if (app.state.current && isLoading()) hideLoader();

            if (app.animation.lastUpdateTime !== null) {
                const interval = app.state.next.timestamp - app.animation.lastUpdateTime;
                app.animation.estimatedInterval = 0.8 * app.animation.estimatedInterval + 0.2 * interval;
            }
            app.animation.lastUpdateTime = app.state.next.timestamp;

            app.state.current = app.state.next;
            app.state.next = null;

            updateGridStats();
            updateObservedCreatureStats();
        }

        if (app.state.current) {
            const now = performance.now();
            const t = Math.min((now - app.animation.lastUpdateTime) / app.animation.estimatedInterval, 1.2);

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
        if (app.socket) {
            if (app.socket.readyState === WebSocket.OPEN || app.socket.readyState === WebSocket.CONNECTING) {
                console.log('WS is already open or connecting - skipping new start');
                return;
            }

            try {
                app.socket.close();
            } catch (e) {
                console.warn('Failed to close existing WS:', e.message);
            }
        }

        app.socket = new WebSocket(app.config.webSocketUrl);

        app.socket.onopen = () => {
            console.log('Connected to WS server');
            resetAnimationState();
            stopObservingCreature();
        };

        app.socket.onmessage = event => {
            app.state.next = JSON.parse(event.data);
            app.state.next.timestamp = performance.now();
        };

        app.socket.onclose = () => {
            console.log('WS closed');
            showLoader();
            reconnect();
        };

        app.socket.onerror = error => console.error('WS error:', error);
    }

    function reconnect() {
        if (app.reconnectScheduled) return;
        app.reconnectScheduled = true;
        setTimeout(() => {
            if (!app.socket || app.socket.readyState !== WebSocket.OPEN) {
                console.log('Reconnecting WS...');
                startWebSocket();
            }
            app.reconnectScheduled = false;
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
            x: Math.floor(canvasX / (canvas.width / app.config.gridSize)),
            y: Math.floor(canvasY / (canvas.height / app.config.gridSize))
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

        app.observedCreatureId = creature.id;
        updateObservedCreatureStats();
        el.stats.grid.panel.classList.add('hidden');
        el.stats.creature.panel.classList.remove('hidden');
    }

    function stopObservingCreature() {
        el.stats.grid.panel.classList.remove('hidden');
        el.stats.creature.panel.classList.add('hidden');
        app.observedCreatureId = null;
    }

    async function onCanvasClick(e) {
        const { x, y } = getGridClickCoordinates(e);

        const clickedCreature = app.state.current.creatures.find(c => {
            const dx = c.x - x;
            const dy = c.y - y;
            return dx * dx + dy * dy < 2;
        });

        if (clickedCreature) {
            startObservingCreature(clickedCreature);
        } else if (app.observedCreatureId) {
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
        el.aboutToggle.addEventListener('click', () => {
            document.body.classList.toggle('about-visible');
            el.aboutToggle.textContent = document.body.classList.contains('about-visible') ? 'back' : 'about';
        });

        canvas.addEventListener('click', onCanvasClick);
        document.addEventListener('visibilitychange', onVisibilityChange);

        window.addEventListener('focus', reconnect);
        window.addEventListener('pageshow', reconnect);
        window.addEventListener('online', reconnect);
        window.addEventListener('beforeunload', () => {
            if (app.socket) app.socket.close();
        });
    }

    async function init() {
        try {
            const response = await fetch('/api/config');
            app.config = await response.json();
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
