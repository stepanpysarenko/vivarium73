function wrapAngle(angle) {
    const TWO_PI = 2 * Math.PI;
    return ((angle + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI;
}

module.exports = { wrapAngle };
