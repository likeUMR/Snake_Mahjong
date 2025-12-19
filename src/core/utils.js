import { CONFIG } from './config.js';

/**
 * Utility functions for the game.
 */

/**
 * Generates a random position on the grid.
 */
export function getRandomGridPosition() {
    return {
        x: Math.floor(Math.random() * CONFIG.SCENE_GRID_WIDTH),
        y: Math.floor(Math.random() * CONFIG.SCENE_GRID_HEIGHT)
    };
}

/**
 * Checks if a position is occupied by any snake in the provided list.
 */
export function isPositionOccupiedBySnakes(x, y, snakes) {
    return snakes.some(snake => 
        snake.body.some(part => part.x === x && part.y === y)
    );
}

/**
 * Generates a random position that is not occupied by any existing snakes.
 * It also tries to ensure there's some space for the snake's initial body.
 */
export function getSafeRandomPosition(snakes, margin = 3) {
    let attempts = 0;
    while (attempts < 100) {
        const pos = getRandomGridPosition();
        
        // Simple check: is the head position occupied?
        // More complex check: would a small initial body (3 segments) overlap?
        let occupied = false;
        for (let i = 0; i < margin; i++) {
            if (isPositionOccupiedBySnakes(pos.x - i, pos.y, snakes) || 
                pos.x - i < 0 || pos.x - i >= CONFIG.SCENE_GRID_WIDTH) {
                occupied = true;
                break;
            }
        }
        
        if (!occupied) return pos;
        attempts++;
    }
    // Fallback if no safe position found (unlikely in a large grid)
    return getRandomGridPosition();
}
