const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const gridSize = 100;
const scale = canvas.width / gridSize;
const creatureCount = 20;
let animationFrameId;

const creatures = Array.from({ length: creatureCount }, () => ({
    x: Math.floor(Math.random() * gridSize),
    y: Math.floor(Math.random() * gridSize)
}));

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    creatures.forEach(creature => {
        ctx.fillStyle = "blue";
        ctx.fillRect(creature.x * scale, creature.y * scale, scale, scale);
    });
}

async function updateCreatures() {
    try {
        const response = await fetch("http://localhost:3000/move");
        const newPositions = await response.json();
        creatures.forEach((creature, index) => {
            creature.x = newPositions[index].x;
            creature.y = newPositions[index].y;
        });
    } catch (error) {
        console.error("Failed to fetch data", error);
    }
}

function gameLoop() {
    updateCreatures();
    draw();
    animationFrameId = requestAnimationFrame(gameLoop);
}

function startSimulation() {
    if (!animationFrameId) {
        console.log('Starting simulation...');
        gameLoop();
    }
}

function stopSimulation() {
    if (animationFrameId) {
        console.log('Stopping simulation...');
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

function toggleSimulation() {
    const button = document.getElementById("toggleButton");
    if (animationFrameId) {
        stopSimulation();
        button.textContent = "Start";
    } else {
        startSimulation();
        button.textContent = "Stop";
    }
}

gameLoop();