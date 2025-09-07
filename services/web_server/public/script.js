(() => {
    'use strict';

    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const obstacleLayer = document.createElement('canvas');
    const obstacleCtx = obstacleLayer.getContext('2d');

    const el = {
        about: document.getElementById('about'),
        aboutToggle: document.getElementById('about-toggle'),
        themeToggle: document.getElementById('theme-toggle'),
        metaThemeColor: document.querySelector('meta[name="theme-color"]'),
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

    const COLOR_PALETTE = {
        light: {
            background: '#f8f8f8',
            obstacle: '#e8e8e8',
            food: '#008000',
            creature: '#0000ff',
            creatureFlash: '#ff0000',
            creatureObservedShadow: '#0000ff',
            creatureSecondary: '#ff9933'
        },
        dark: {
            background: '#282828',
            obstacle: '#3c3c3c',
            food: '#34a064',
            creature: '#537bff',
            creatureFlash: '#ff0000',
            creatureObservedShadow: '#537bff',
            creatureSecondary: '#ffdd00'
        }
    };

    const app = {
        config: null,
        socket: null,
        reconnectScheduled: false,
        reconnectDelay: 250,
        state: {
            buffer: [],
            latest: null
        },
        scale: null,
        halfScale: null,
        animation: {
            renderDelay: 50,
            extrapolationLimit: 50,
            bufferLimit: 10
        },
        observedCreatureId: null,
        colors: null,
        prevGridStats: {},
        prevCreatureStats: {}
    };

    const isLoading = () => document.body.classList.contains('loading');
    const showLoader = () => document.body.classList.add('loading');
    const hideLoader = () => document.body.classList.remove('loading');

    function setTheme(dark, persist = false) {
        document.documentElement.classList.toggle('dark', dark);
        document.documentElement.classList.toggle('light', !dark);
        el.themeToggle.textContent = dark ? 'light' : 'dark';
        app.colors = dark ? COLOR_PALETTE.dark : COLOR_PALETTE.light;
        el.metaThemeColor.setAttribute('content', app.colors.background);
        updateObstacleLayer();

        if (persist) {
            localStorage.setItem('theme', dark ? 'dark' : 'light');
        }
    }

    function updateGridStats() {
        if (!app.state.latest) return;
        const stats = app.state.latest.stats;
        const prev = app.prevGridStats;
        if (prev.restarts !== stats.restarts) {
            el.stats.grid.restarts.textContent = stats.restarts;
        }
        if (prev.generation !== stats.generation) {
            el.stats.grid.generation.textContent = stats.generation;
        }
        if (prev.creatureCount !== stats.creatureCount) {
            el.stats.grid.creatures.textContent = stats.creatureCount;
        }
        const foodText = `${stats.foodCount}/${app.config.maxFoodCount}`;
        if (prev.foodText !== foodText) {
            el.stats.grid.food.textContent = foodText;
        }
        app.prevGridStats = { ...stats, foodText };
    }

    function updateObservedCreatureStats() {
        if (!app.observedCreatureId || !app.state.latest) return;

        const creature = app.state.latest.creatureMap.get(app.observedCreatureId);
        if (!creature) {
            stopObservingCreature();
            return;
        }

        const prev = app.prevCreatureStats;
        if (prev.id !== creature.id) {
            el.stats.creature.id.textContent = `${creature.id}`;
        }
        if (prev.generation !== creature.generation) {
            el.stats.creature.generation.textContent = `${creature.generation}`;
        }
        const lifeText = formatTime(creature.msLived);
        if (prev.lifeText !== lifeText) {
            el.stats.creature.life.textContent = lifeText;
        }
        const energyText = `${Math.round(creature.energy * 100)}%`;
        if (prev.energyText !== energyText) {
            el.stats.creature.energy.textContent = energyText;
        }
        if (prev.score !== creature.score) {
            el.stats.creature.score.textContent = `${creature.score}`;
        }
        app.prevCreatureStats = {
            id: creature.id,
            generation: creature.generation,
            lifeText,
            energyText,
            score: creature.score
        };
    }

    function setScale() {
        app.scale = canvas.width / app.config.gridSize;
        app.halfScale = app.scale * 0.5;
        obstacleLayer.width = canvas.width;
        obstacleLayer.height = canvas.height;
        updateObstacleLayer();
    }

    function resetAnimationState() {
        app.state.buffer.length = 0;
        app.state.latest = null;
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

    function updateObstacleLayer() {
        if (!app.state.latest) return;
        obstacleCtx.clearRect(0, 0, obstacleLayer.width, obstacleLayer.height);
        obstacleCtx.fillStyle = app.colors.obstacle;
        app.state.latest.obstacles.forEach(({ x, y }) => {
            obstacleCtx.fillRect(x * app.scale, y * app.scale, app.scale, app.scale);
        });
    }

    function drawFood() {
        if (!app.state.latest) return;
        ctx.globalAlpha = 1;
        ctx.fillStyle = app.colors.food;
        app.state.latest.food.forEach(({ x, y }) => {
            ctx.fillRect(x * app.scale, y * app.scale, app.scale, app.scale);
        });
    }

    function drawCreatures(prevState, currentState, t, now) {
        currentState.creatures.forEach(creature => {
            let x, y, angle;
            const prev = prevState?.creatureMap.get(creature.id);
            if (prev) {
                x = lerp(prev.x, creature.x, t);
                y = lerp(prev.y, creature.y, t);
                const angleT = Math.min(t, 1);
                angle = lerpAngle(prev.angle, creature.angle, angleT);
            } else {
                x = creature.x;
                y = creature.y;
                angle = creature.angle;
            }

            ctx.save();
            ctx.translate(x * app.scale + app.halfScale, y * app.scale + app.halfScale);
            ctx.rotate(angle + Math.PI * 0.75); // rotate towards positive x-axis

            ctx.globalAlpha = creature.energy * 0.8 + 0.2;
            const flash = creature.flashing && Math.floor(now / 200) % 2 === 0;
            ctx.fillStyle = flash ? app.colors.creatureFlash : app.colors.creature;

            if (creature.id === app.observedCreatureId) {
                ctx.shadowColor = app.colors.creatureObservedShadow;
                ctx.shadowBlur = 15;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
            } else {
                ctx.shadowBlur = 0;
            }

            ctx.fillRect(-app.halfScale, -app.halfScale, app.scale, app.scale);
            ctx.fillStyle = app.colors.creatureSecondary;
            ctx.fillRect(-app.halfScale, -app.halfScale, app.halfScale, app.halfScale);
            ctx.restore();
        });
    }

    function draw() {
        const now = performance.now();
        const renderTime = now - app.animation.renderDelay;
        const buffer = app.state.buffer;

        if (!buffer.length) {
            requestAnimationFrame(draw);
            return;
        }

        while (buffer.length >= 2 && buffer[1].timestamp <= renderTime) {
            buffer.shift();
        }

        let prevState, nextState, t;
        if (buffer.length === 1) {
            prevState = nextState = buffer[0];
            const interval = app.config.stateUpdateInterval;
            const maxTime = prevState.timestamp + app.animation.extrapolationLimit;
            const clamped = Math.min(renderTime, maxTime);
            t = (clamped - prevState.timestamp) / interval;
        } else {
            prevState = buffer[0];
            nextState = buffer[1];
            t = (renderTime - prevState.timestamp) / (nextState.timestamp - prevState.timestamp);
        }

        clearCanvas();
        ctx.drawImage(obstacleLayer, 0, 0);
        drawFood();
        drawCreatures(prevState, nextState, t, now);

        requestAnimationFrame(draw);
    }

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
            const state = JSON.parse(event.data);
            state.creatureMap = new Map(state.creatures.map(c => [c.id, c]));
            state.timestamp = performance.now();
            app.state.buffer.push(state);
            app.state.latest = state;
            updateObstacleLayer();
            if (app.state.buffer.length > app.animation.bufferLimit) {
                const excess = app.state.buffer.length - app.animation.bufferLimit;
                app.state.buffer.splice(0, excess);
            }
            
            if (isLoading()) hideLoader();
            updateGridStats();
            updateObservedCreatureStats();
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
        }, app.reconnectDelay);
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
            x: Math.floor(canvasX / app.scale),
            y: Math.floor(canvasY / app.scale)
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
        const seconds = Math.floor(ms / 1000);
        if (seconds < 60) {
            return `${seconds}s`;
        }

        const minutes = Math.floor(seconds / 60);
        if (minutes < 180) {
            return `${minutes}m`;
        }

        const hours = Math.floor(minutes / 60);
        if (hours < 72) {
            return `${hours}h`;
        }

        const days = Math.floor(hours / 24);
        return `${days}d`;
    }

    function startObservingCreature(creature) {
        if (typeof gtag === 'function') gtag('event', 'observe_creature');

        app.observedCreatureId = creature.id;
        updateObservedCreatureStats();

        el.stats.grid.panel.hidden = true;
        el.stats.creature.panel.hidden = false;
    }

    function stopObservingCreature() {
        el.stats.grid.panel.hidden = false;
        el.stats.creature.panel.hidden = true;

        app.observedCreatureId = null;
    }

    async function onCanvasClick(e) {
        const { x, y } = getGridClickCoordinates(e);

        const clickedCreature = app.state.latest?.creatures.find(c => {
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
            el.about.hidden = !el.about.hidden;
            canvas.hidden = !canvas.hidden;
            el.aboutToggle.textContent = el.about.hidden ? 'about' : 'grid';
        });

        el.themeToggle.addEventListener('click', () => {
            const dark = !document.documentElement.classList.contains('dark');
            setTheme(dark, true);
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

        const storedTheme = localStorage.getItem('theme');
        if (storedTheme) {
            setTheme(storedTheme === 'dark');
        } else {
            setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches);
        }

        try {
            const response = await fetch('/api/config');
            app.config = await response.json();
            app.animation.renderDelay = app.config.stateUpdateInterval;
            setScale();
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
