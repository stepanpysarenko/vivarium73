(() => {
    'use strict';

    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');

    const ui = {
        about: document.getElementById('about'),
        aboutToggle: document.getElementById('about-toggle'),
        themeToggle: document.getElementById('theme-toggle'),
        metaThemeColor: document.querySelector('meta[name="theme-color"]'),
        appVersionTag: document.getElementById('app-version-tag'),
        envTag: document.getElementById('env-tag'),
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
            food: '#34a064',
            egg: '#d9b97c',
            creature: '#4169e1',
            creatureFlash: '#ff0000',
            creatureObservedHighlight: '#e8e8e8',
            creatureSecondary: '#ff9933'
        },
        dark: {
            background: '#282828',
            obstacle: '#3c3c3c',
            food: '#34a064',
            egg: '#d9b97c',
            creature: '#537bff',
            creatureFlash: '#ff0000',
            creatureObservedHighlight: '#e8e8e8',
            creatureSecondary: '#ffdd00'
        }
    };

    const app = {
        config: null,
        socket: null,
        reconnectScheduled: false,
        reconnectDelay: 250,
        colors: COLOR_PALETTE.light,
        observedCreatureId: null,
        observedAreaRadius: 2,
        scale: 1,
        halfScale: 0.5,
        animation: {
            renderDelay: 100,
            extrapolationLimit: 50,
            bufferSize: 10
        },
        state: {
            buffer: [],
            latest: null
        }
    };

    const stateBuffer = {
        reset() {
            app.state.buffer.length = 0;
            app.state.latest = null;
        },
        push(frame) {
            app.state.buffer.push(frame);
            app.state.latest = frame;
            const excess = app.state.buffer.length - app.animation.bufferSize;
            if (excess > 0) {
                app.state.buffer.splice(0, excess);
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
            ui.themeToggle.textContent = dark ? 'light' : 'dark';
            app.colors = dark ? COLOR_PALETTE.dark : COLOR_PALETTE.light;
            ui.metaThemeColor.setAttribute('content', app.colors.background);

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

    const stats = {
        showGridPanel() {
            ui.stats.grid.panel.hidden = false;
            ui.stats.creature.panel.hidden = true;
        },
        showCreaturePanel() {
            ui.stats.grid.panel.hidden = true;
            ui.stats.creature.panel.hidden = false;
        },
        updateGrid() {
            const latest = app.state.latest;
            if (!latest || !app.config) return;

            ui.stats.grid.restarts.textContent = latest.stats.restarts;
            ui.stats.grid.generation.textContent = latest.stats.generation;
            ui.stats.grid.creatures.textContent = latest.stats.creatureCount;
            ui.stats.grid.food.textContent = `${latest.stats.foodCount}/${app.config.maxFoodCount}`;
        },
        updateObserved() {
            if (app.observedCreatureId === null || !app.state.latest) return; 

            const creature = app.state.latest.creaturesMap.get(app.observedCreatureId);
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

            app.observedCreatureId = creature.id;
            this.updateObserved();
            this.showCreaturePanel();
        },
        stopObserving() {
            if (app.observedCreatureId === null && ui.stats.creature.panel.hidden) return;

            app.observedCreatureId = null;
            this.showGridPanel();
        }
    };

    const buildInfo = {
        update() {
            if (!app.config) return;

            if (app.config.envCode !== 'prod') {
                ui.envTag.textContent = app.config.envCode;
                ui.envTag.hidden = false;
            }

            const versionPrefix = app.config.appVersion === 'dev' ? '' : 'v';
            ui.appVersionTag.textContent = versionPrefix + app.config.appVersion;
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
        updateCanvasResolution() {
            const rect = canvas.getBoundingClientRect();
            if (!rect.width || !rect.height) return;

            const devicePixelRatio = window.devicePixelRatio || 1;
            const width = Math.round(rect.width * devicePixelRatio);
            const height = Math.round(rect.height * devicePixelRatio);

            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
            }
            console.log(`Canvas resolution set to ${canvas.width}x${canvas.height}`);
        },
        updateSettings() {
            renderer.updateCanvasResolution();

            app.scale = canvas.width / app.config.gridSize;
            app.halfScale = app.scale * 0.5;
            app.animation.renderDelay = app.config.stateUpdateInterval;
        },
        clear() {
            ctx.globalAlpha = 1;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        },
        drawObstacles() {
            if (!app.state.latest) return;

            ctx.globalAlpha = 1;
            ctx.fillStyle = app.colors.obstacle;
            app.state.latest.obstacles.forEach(({ x, y }) => {
                ctx.fillRect(x * app.scale, y * app.scale, app.scale, app.scale);
            });
        },
        drawFood() {
            if (!app.state.latest) return;

            ctx.globalAlpha = 1;
            ctx.fillStyle = app.colors.food;
            app.state.latest.food.forEach(({ x, y }) => {
                ctx.fillRect(x * app.scale, y * app.scale, app.scale, app.scale);
            });
        },
        drawEggs() {
            if (!app.state.latest) return;

            const eggs = app.state.latest.eggs || [];
            if (!eggs.length) return;

            ctx.save();
            ctx.globalAlpha = 0.9;
            ctx.fillStyle = app.colors.egg;
            const radius = app.halfScale * 0.35;

            eggs.forEach(({ x, y }) => {
                const centerX = x * app.scale + app.halfScale;
                const centerY = y * app.scale + app.halfScale;
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                ctx.fill();
            });

            ctx.restore();
        },
        drawObservedHighlight(x, y) {
            const centerX = x * app.scale + app.halfScale;
            const centerY = y * app.scale + app.halfScale;
            const radius = app.scale * app.observedAreaRadius;

            ctx.save();
            ctx.globalAlpha = 0.05;
            ctx.fillStyle = app.colors.creatureObservedHighlight;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        },
        drawCreatures(prevState, currentState, t, now) {
            currentState.creatures.forEach(creature => {
                let x, y, angle;
                const previous = prevState ? prevState.creaturesMap.get(creature.id) : null;

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

                if (creature.id === app.observedCreatureId) {
                    renderer.drawObservedHighlight(x, y);
                }

                ctx.save();
                ctx.translate(x * app.scale + app.halfScale, y * app.scale + app.halfScale);
                ctx.rotate(angle + Math.PI * 0.75); // rotate towards positive x-axis

                ctx.globalAlpha = creature.energy * 0.8 + 0.2;
                const flash = creature.flashing && Math.floor(now / 200) % 2 === 0;
                ctx.fillStyle = flash ? app.colors.creatureFlash : app.colors.creature;

                ctx.fillRect(-app.halfScale, -app.halfScale, app.scale, app.scale);
                ctx.fillStyle = app.colors.creatureSecondary;
                ctx.fillRect(-app.halfScale, -app.halfScale, app.halfScale, app.halfScale);
                ctx.restore();
            });
        },
        loop() {
            const now = performance.now();
            const renderTime = now - app.animation.renderDelay;
            const buffer = app.state.buffer;

            if (!buffer.length) {
                requestAnimationFrame(renderer.loop);
                return;
            }

            let prevIndex = 0;
            while (prevIndex < buffer.length && buffer[prevIndex].timestamp <= renderTime) {
                prevIndex++;
            }

            let prevState, nextState, t;
            if (prevIndex === 0) {
                prevState = nextState = buffer[0];
                t = 0;
            } else if (prevIndex === buffer.length) {
                prevState = buffer[buffer.length - 2] || buffer[buffer.length - 1];
                nextState = buffer[buffer.length - 1];
                const interval = nextState.timestamp - prevState.timestamp || app.config.stateUpdateInterval;
                const maxTime = nextState.timestamp + app.animation.extrapolationLimit;
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
            renderer.drawEggs();
            renderer.drawCreatures(prevState, nextState, t, now);

            requestAnimationFrame(renderer.loop);
        }
    };

    const actions = {
        getGridClickCoordinates(event) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const canvasX = (event.clientX - rect.left) * scaleX;
            const canvasY = (event.clientY - rect.top) * scaleY;
            return {
                x: Math.floor(canvasX / app.scale),
                y: Math.floor(canvasY / app.scale)
            };
        },
        async placeFood(x, y) {
            if (typeof gtag === 'function') {
                gtag('event', 'place_food');
            }

            const latestState = app.state.latest;
            if (!latestState || !app.config) {
                console.warn('State unavailable - cannot place food yet.');
                return;
            }

            if (latestState.food.length >= app.config.maxFoodCount) {
                console.warn('Max food count reached, cannot place more food.');
                return;
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
            const distanceThreshold = app.observedAreaRadius * app.observedAreaRadius;
            const { x, y } = actions.getGridClickCoordinates(event);
            const creatures = app.state.latest ? app.state.latest.creatures : null;
            let clickedCreature = null;
            let closestDistanceSq = Infinity;

            if (creatures) {
                for (const creature of creatures) {
                    const dx = creature.x - x;
                    const dy = creature.y - y;
                    const distanceSq = dx * dx + dy * dy;

                    if (distanceSq >= distanceThreshold) continue;
                    if (distanceSq >= closestDistanceSq) continue;

                    clickedCreature = creature;
                    closestDistanceSq = distanceSq;
                }
            }

            if (clickedCreature) {
                stats.startObserving(clickedCreature);
                return;
            }

            if (app.observedCreatureId !== null) {
                stats.stopObserving();
                return;
            }

            await actions.placeFood(x, y);
        }
    };

    const connection = {
        open() {
            if (!app.config || !app.config.webSocketUrl) {
                console.error('Cannot open WebSocket: configuration missing.');
                return;
            }

            if (app.socket && (app.socket.readyState === WebSocket.OPEN || app.socket.readyState === WebSocket.CONNECTING)) {
                console.log('WS is already open or connecting - skipping new start');
                return;
            }

            if (app.socket) {
                this.close();
            }

            app.socket = new WebSocket(app.config.webSocketUrl);
            app.socket.addEventListener('open', this.handleOpen);
            app.socket.addEventListener('message', this.handleMessage);
            app.socket.addEventListener('close', this.handleClose);
            app.socket.addEventListener('error', this.handleError);
        },
        handleOpen: () => {
            console.log('Connected to WS server');
            stateBuffer.reset();
            stats.stopObserving();
        },
        handleMessage: event => {
            try {
                const state = JSON.parse(event.data);
                state.creaturesMap = new Map(state.creatures.map(creature => [creature.id, creature]));
                state.timestamp = performance.now();
                stateBuffer.push(state);

                if (isLoading()) hideLoader();
                stats.updateGrid();
                stats.updateObserved();
            } catch (error) {
                console.error('Failed to process WS message', error);
            }
        },
        handleClose: () => {
            console.log('WS closed');
            app.socket = null;
            showLoader();
            connection.scheduleReconnect();
        },
        handleError: error => {
            console.error('WS error:', error);
        },
        scheduleReconnect: () => {
            if (!app.config || app.reconnectScheduled) {
                return;
            }

            app.reconnectScheduled = true;
            setTimeout(() => {
                app.reconnectScheduled = false;
                if (!app.socket || app.socket.readyState !== WebSocket.OPEN) {
                    console.log('Reconnecting WS...');
                    connection.open();
                }
            }, app.reconnectDelay);
        },
        close: () => {
            if (!app.socket) {
                return;
            }

            app.socket.removeEventListener('open', connection.handleOpen);
            app.socket.removeEventListener('message', connection.handleMessage);
            app.socket.removeEventListener('close', connection.handleClose);
            app.socket.removeEventListener('error', connection.handleError);

            try {
                app.socket.close();
            } catch (error) {
                console.warn('Failed to close existing WS:', error.message);
            }

            app.socket = null;
        }
    };

    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
            stateBuffer.reset();
            stats.stopObserving();
            connection.scheduleReconnect();
        }
    };

    const registerServiceWorker = () => {
        if (!('serviceWorker' in navigator)) return;

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
        ui.aboutToggle.addEventListener('click', () => {
            const showAbout = ui.about.hidden;
            ui.about.hidden = !showAbout;
            canvas.hidden = showAbout;
            ui.aboutToggle.textContent = showAbout ? 'grid' : 'about';
        });

        ui.themeToggle.addEventListener('click', () => {
            const dark = !document.documentElement.classList.contains('dark');
            theme.apply(dark, true);
        });

        canvas.addEventListener('click', actions.handleCanvasClick);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        window.addEventListener('focus', connection.scheduleReconnect);
        window.addEventListener('pageshow', connection.scheduleReconnect);
        window.addEventListener('online', connection.scheduleReconnect);
        window.addEventListener('resize', renderer.updateSettings);
        window.addEventListener('orientationchange', renderer.updateSettings);
        window.addEventListener('beforeunload', connection.close);
    };

    const init = async () => {
        stats.showGridPanel();
        theme.loadPreferred();
        registerServiceWorker();

        try {
            const response = await fetch('/api/config');
            if (!response.ok) {
                throw new Error(`Failed to load config: ${response.status} ${response.statusText}`);
            }

            app.config = await response.json();
            buildInfo.update();
        } catch (error) {
            console.error('Error loading configuration', error);
            showLoader();
            return;
        }

        setupEventListeners();
        renderer.updateSettings();
        requestAnimationFrame(renderer.loop);
        connection.open();
    };

    document.addEventListener('DOMContentLoaded', init);
})();
