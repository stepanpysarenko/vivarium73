const CONFIG = require("./config");
const { addFood, getFoodCount } = require("./state");

function placeFood(x, y) {
    const coordinatesValid = typeof x === "number" && typeof y == "number" 
        && x >= 0 && x <= CONFIG.GRID_SIZE && y >= 0 && y <= CONFIG.GRID_SIZE;
    if (!coordinatesValid) {
        throw new Error("Invalid coordinates");
    }

    if (getFoodCount() >= CONFIG.FOOD_MAX_COUNT) {
         throw new Error("Max food count reached");
    }

    addFood(x, y);
}

module.exports = {
    placeFood,
};
