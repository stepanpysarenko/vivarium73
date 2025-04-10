const fs = require('fs');
const path = require('path');
const CONFIG = require('./config');

const { STATE_SAVE_PATH, TOP_PERFORMERS_SAVE_PATH } = CONFIG;

function saveState(state) {
    const filePath = path.resolve(STATE_SAVE_PATH);
    try {
        const data = JSON.stringify(state, null, 4);
        fs.writeFileSync(filePath, data, 'utf8');
        console.log('State successfully saved to', filePath);
    } catch (error) {
        console.error(`Error saving state to ${filePath}:`, error.message);
    }
}

function loadState() {
    const filePath = path.resolve(STATE_SAVE_PATH);
    try {
        if (!fs.existsSync(filePath)) {
            console.warn(`State file not found at ${filePath}`);
            return null;
        }
        const fileData = fs.readFileSync(filePath, 'utf8');
        const state = JSON.parse(fileData);
        console.log(`State successfully loaded from ${filePath}`);
        return state;
    } catch (error) {
        console.error(`Error loading state from ${filePath}:`, error.message);
        return null;
    }
}

function saveTopPerformers(topPerformers) {
    const filePath = path.resolve(TOP_PERFORMERS_SAVE_PATH);
    try {
        const data = JSON.stringify(topPerformers, null, 4);
        fs.writeFileSync(filePath, data, 'utf8');
        console.log('Top performers saved to', filePath);
    } catch (error) {
        console.error(`Error saving top performers:`, error.message);
    }
}

function loadTopPerformers() {
    const filePath = path.resolve(TOP_PERFORMERS_SAVE_PATH);
    try {
        if (!fs.existsSync(filePath)) {
            return [];
        }
        const fileData = fs.readFileSync(filePath, 'utf8');
        const performers = JSON.parse(fileData);
        console.log(`Top performers loaded from ${filePath}`);
        return performers;
    } catch (error) {
        console.error(`Error loading top performers:`, error.message);
        return [];
    }
}

module.exports = {
    saveState,
    loadState,
    saveTopPerformers,
    loadTopPerformers
};
