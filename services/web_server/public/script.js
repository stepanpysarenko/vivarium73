(() => {
    'use strict';

    const canvas = document.getElementById('canvas');
    const ctx = canvas ? canvas.getContext('2d') : null;

    if (!canvas || !ctx) {
        console.error('Canvas element or 2D context is missing.');
        return;
    }

    const ui = {
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

    const state = {
        config: null,
        socket: null,
        reconnectScheduled: false,
        reconnectDelay: 250,
        colors: COLOR_PALETTE.light,
        observedCreatureId: null,
        scale: 1,
        halfScale: 0.5,
        animation: {
            renderDelay: 100,
            extrapolationLimit: 50,
            bufferLimit: 10
        },
        frames: {
            buffer: [],
            latest: null
        }
    };

    const frameBuffer = {
        reset() {
            state.frames.buffer.length = 0;
            state.frames.latest = null;
        },
        push(frame) {
            state.frames.buffer.push(frame);
            state.frames.latest = frame;
            const excess = state.frames.buffer.length - state.animation.bufferLimit;
            if (excess > 0) {
                state.frames.buffer.splice(0, excess);
            }
        }
    };

    const isLoading = () => document.body.classList.contains('loading');
    const showLoader = () => document.body.classList.add('loading');
    const hideLoader = () => document.body.classList.remove('loading');

    const theme = {
        apply(dark, persist = false) {
            document.documentElement.classList.toggle('dark', dark);
            document.documentElement.classList.toggle('light', !dark);
            if (ui.themeToggle) {
                ui.themeToggle.textContent = dark ? 'light' : 'dark';
            }
            state.colors = dark ? COLOR_PALETTE.dark : COLOR_PALETTE.light;
            if (ui.metaThemeColor) {
                ui.metaThemeColor.setAttribute('content', state.colors.background);
            }

            if (persist) {
                localStorage.setItem('theme', dark ? 'dark' : 'light');
            }
        },
        loadPreferred() {
            const storedTheme = localStorage.getItem('theme');
            if (storedTheme) {
                this.apply(storedTheme === 'dark');
                return;
            }

            this.apply(window.matchMedia('(prefers-color-scheme: dark)').matches);
        }
    };

    const formatTime = ms => {
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
    };

    const statsView = {
        showGridPanel() {
            ui.stats.grid.panel.hidden = false;
            ui.stats.creature.panel.hidden = true;
        },
        showCreaturePanel() {
            ui.stats.grid.panel.hidden = true;
            ui.stats.creature.panel.hidden = false;
        },
        updateGrid() {
            const latest = state.frames.latest;
            if (!latest || !state.config) return;

            ui.stats.grid.restarts.textContent = latest.stats.restarts;
            ui.stats.grid.generation.textContent = latest.stats.generation;
            ui.stats.grid.creatures.textContent = latest.stats.creatureCount;
            ui.stats.grid.food.textContent = `${latest.stats.foodCount}/${state.config.maxFoodCount}`;
        },
        updateObserved() {
            if (!state.observedCreatureId) return;
            const latest = state.frames.latest;
            if (!latest) return;

            const creature = latest.creatureMap.get(state.observedCreatureId);
            if (!creature) {
                this.stopObserving();
                return;
            }

            ui.stats.creature.id.textContent = `${creature.id}`;
            ui.stats.creature.generation.textContent = `${creature.generation}`;
            ui.stats.creature.life.textContent = formatTime(creature.msLived);
            ui.stats.creature.energy.textContent = `${Math.round(creature.energy * 100)}%`;
            ui.stats.creature.score.textContent = `${creature.score}`;
        },
        startObserving(creature) {
            if (typeof gtag === 'function') {
                gtag('event', 'observe_creature');
            }

            state.observedCreatureId = creature.id;
            this.updateObserved();
            this.showCreaturePanel();
        },
        stopObserving() {
            if (state.observedCreatureId === null && ui.stats.creature.panel.hidden) {
                return;
            }

            state.observedCreatureId = null;
            this.showGridPanel();
        }
    };

    const lerp = (a, b, t) => a + (b - a) * t;
    const lerpAngle = (from, to, t) => {
        let delta = to - from;
        if (delta > Math.PI) delta -= 2 * Math.PI;
        if (delta < -Math.PI) delta += 2 * Math.PI;
        return from + delta * t;
    };

    const renderer = {
        updateScale() {
            if (!state.config || !state.config.gridSize) {
                console.error('Cannot set scale without grid size configuration.');
                return false;
            }

            state.scale = canvas.width / state.config.gridSize;
            state.halfScale = state.scale * 0.5;
            return true;
        },
        clear() {
            ctx.globalAlpha = 1;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        },
        drawObstacles() {
            const latest = state.frames.latest;
            if (!latest) return;

            ctx.globalAlpha = 1;
            ctx.fillStyle = state.colors.obstacle;
            latest.obstacles.forEach(({ x, y }) => {
                ctx.fillRect(x * state.scale, y * state.scale, state.scale, state.scale);
            });
        },
        drawFood() {
            const latest = state.frames.latest;
            if (!latest) return;

            ctx.globalAlpha = 1;
            ctx.fillStyle = state.colors.food;
            latest.food.forEach(({ x, y }) => {
                ctx.fillRect(x * state.scale, y * state.scale, state.scale, state.scale);
            });
        },
        drawCreatures(prevState, currentState, t, now) {
            currentState.creatures.forEach(creature => {
                let x;
                let y;
                let angle;
                const previous = prevState ? prevState.creatureMap.get(creature.id) : null;

                if (previous) {
                    x = lerp(previous.x, creature.x, t);
                    y = lerp(previous.y, creature.y, t);
                    const angleT = Math.min(t, 1);
                    angle = lerpAngle(previous.angle, creature.angle, angleT);
                } else {
                    x = creature.x;
                    y = creature.y;
                    angle = creature.angle;
                }

                ctx.save();
                ctx.translate(x * state.scale + state.halfScale, y * state.scale + state.halfScale);
                ctx.rotate(angle + Math.PI * 0.75);

                ctx.globalAlpha = creature.energy * 0.8 + 0.2;
                const flash = creature.flashing && Math.floor(now / 200) % 2 === 0;
                ctx.fillStyle = flash ? state.colors.creatureFlash : state.colors.creature;

                if (creature.id === state.observedCreatureId) {
                    ctx.shadowColor = state.colors.creatureObservedShadow;
                    ctx.shadowBlur = 15;
                    ctx.shadowOffsetX = 0;
                    ctx.shadowOffsetY = 0;
                } else {
                    ctx.shadowBlur = 0;
                }

                ctx.fillRect(-state.halfScale, -state.halfScale, state.scale, state.scale);
                ctx.fillStyle = state.colors.creatureSecondary;
                ctx.fillRect(-state.halfScale, -state.halfScale, state.halfScale, state.halfScale);
                ctx.restore();
            });
        },
        loop() {
            const now = performance.now();
            const renderTime = now - state.animation.renderDelay;
            const buffer = state.frames.buffer;

            if (!buffer.length) {
                requestAnimationFrame(renderer.loop);
                return;
            }

            let prevIndex = 0;
            while (prevIndex < buffer.length && buffer[prevIndex].timestamp <= renderTime) {
                prevIndex += 1;
            }

            let prevState;
            let nextState;
            let t;

            if (prevIndex === 0) {
                prevState = nextState = buffer[0];
                t = 0;
            } else if (prevIndex === buffer.length) {
                prevState = buffer[buffer.length - 2] || buffer[buffer.length - 1];
                nextState = buffer[buffer.length - 1];
                const interval = nextState.timestamp - prevState.timestamp || state.config.stateUpdateInterval;
                const maxTime = nextState.timestamp + state.animation.extrapolationLimit;
                const clamped = Math.min(renderTime, maxTime);
                t = (clamped - prevState.timestamp) / interval;
            } else {
                prevState = buffer[prevIndex - 1];
                nextState = buffer[prevIndex];
                t = (renderTime - prevState.timestamp) / (nextState.timestamp - prevState.timestamp);
            }

            renderer.clear();
            renderer.drawObstacles();
            renderer.drawFood();
            renderer.drawCreatures(prevState, nextState, t, now);

            requestAnimationFrame(renderer.loop);
        }
    };

    const interactions = {
        getGridClickCoordinates(event) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const canvasX = (event.clientX - rect.left) * scaleX;
            const canvasY = (event.clientY - rect.top) * scaleY;
            return {
                x: Math.floor(canvasX / state.scale),
                y: Math.floor(canvasY / state.scale)
            };
        },
        async placeFood(x, y) {
            if (typeof gtag === 'function') {
                gtag('event', 'place_food');
            }

            try {
                const response = await fetch('/api/place-food', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ x, y })
                });

                if (!response.ok) {
                    throw new Error(`Request failed with status ${response.status}`);
                }

                const data = await response.json();
                if (!data.success) {
                    console.error(data.error || 'Food placement unsuccessful.');
                }
            } catch (error) {
                console.error('Failed to place food', error);
            }
        },
        handleCanvasClick: async event => {
            const { x, y } = interactions.getGridClickCoordinates(event);
            const latestState = state.frames.latest;
            const creatures = latestState ? latestState.creatures : null;
            const clickedCreature = creatures ? creatures.find(c => {
                const dx = c.x - x;
                const dy = c.y - y;
                return dx * dx + dy * dy < 2;
            }) : null;

            if (clickedCreature) {
                statsView.startObserving(clickedCreature);
                return;
            }

            if (state.observedCreatureId) {
                statsView.stopObserving();
                return;
            }

            await interactions.placeFood(x, y);
        }
    };

    const connection = {
        open() {
            if (!state.config || !state.config.webSocketUrl) {
                console.error('Cannot open WebSocket: configuration missing.');
                return;
            }

            if (state.socket && (state.socket.readyState === WebSocket.OPEN || state.socket.readyState === WebSocket.CONNECTING)) {
                console.log('WS is already open or connecting - skipping new start');
                return;
            }

            if (state.socket) {
                this.close();
            }

            const socket = new WebSocket(state.config.webSocketUrl);
            state.socket = socket;

            socket.addEventListener('open', connection.handleOpen);
            socket.addEventListener('message', connection.handleMessage);
            socket.addEventListener('close', connection.handleClose);
            socket.addEventListener('error', connection.handleError);
        },
        handleOpen: () => {
            console.log('Connected to WS server');
            frameBuffer.reset();
            statsView.stopObserving();
        },
        handleMessage: event => {
            try {
                const snapshot = JSON.parse(event.data);
                snapshot.creatureMap = new Map(snapshot.creatures.map(creature => [creature.id, creature]));
                snapshot.timestamp = performance.now();
                frameBuffer.push(snapshot);

                if (isLoading()) {
                    hideLoader();
                }

                statsView.updateGrid();
                statsView.updateObserved();
            } catch (error) {
                console.error('Failed to process WS message', error);
            }
        },
        handleClose: () => {
            console.log('WS closed');
            state.socket = null;
            showLoader();
            connection.scheduleReconnect();
        },
        handleError: error => {
            console.error('WS error:', error);
        },
        scheduleReconnect: () => {
            if (!state.config || state.reconnectScheduled) {
                return;
            }

            state.reconnectScheduled = true;
            setTimeout(() => {
                state.reconnectScheduled = false;
                if (!state.socket || state.socket.readyState !== WebSocket.OPEN) {
                    console.log('Reconnecting WS...');
                    connection.open();
                }
            }, state.reconnectDelay);
        },
        close: () => {
            if (!state.socket) {
                return;
            }

            state.socket.removeEventListener('open', connection.handleOpen);
            state.socket.removeEventListener('message', connection.handleMessage);
            state.socket.removeEventListener('close', connection.handleClose);
            state.socket.removeEventListener('error', connection.handleError);

            try {
                state.socket.close();
            } catch (error) {
                console.warn('Failed to close existing WS:', error.message);
            }

            state.socket = null;
        }
    };

    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
            frameBuffer.reset();
            statsView.stopObserving();
            connection.scheduleReconnect();
        }
    };

    const registerServiceWorker = () => {
        if (!('serviceWorker' in navigator)) {
            return;
        }

        window.addEventListener('load', async () => {
            try {
                await navigator.serviceWorker.register('/service-worker.js');
                console.log('ServiceWorker registered');
            } catch (error) {
                console.error('ServiceWorker registration failed:', error);
            }
        });
    };

    const setupEventListeners = () => {
        if (ui.about && ui.aboutToggle) {
            ui.aboutToggle.addEventListener('click', () => {
                const showAbout = ui.about.hidden;
                ui.about.hidden = !showAbout;
                canvas.hidden = showAbout;
                ui.aboutToggle.textContent = showAbout ? 'grid' : 'about';
            });
        }

        if (ui.themeToggle) {
            ui.themeToggle.addEventListener('click', () => {
                const dark = !document.documentElement.classList.contains('dark');
                theme.apply(dark, true);
            });
        }

        canvas.addEventListener('click', interactions.handleCanvasClick);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        window.addEventListener('focus', connection.scheduleReconnect);
        window.addEventListener('pageshow', connection.scheduleReconnect);
        window.addEventListener('online', connection.scheduleReconnect);
        window.addEventListener('beforeunload', connection.close);
    };

    const init = async () => {
        statsView.showGridPanel();
        theme.loadPreferred();
        setupEventListeners();
        registerServiceWorker();

        try {
            const response = await fetch('/api/config');
            if (!response.ok) {
                throw new Error(`Failed to load config: ${response.status} ${response.statusText}`);
            }

            state.config = await response.json();
        } catch (error) {
            console.error('Error loading configuration', error);
            showLoader();
            return;
        }

        if (typeof state.config.stateUpdateInterval === 'number') {
            state.animation.renderDelay = state.config.stateUpdateInterval;
        }

        if (renderer.updateScale()) {
            requestAnimationFrame(renderer.loop);
        }

        connection.open();
    };

    document.addEventListener('DOMContentLoaded', init);
})();
