import { CONFIG } from './config.js';

/**
 * Utility functions for the game.
 */

// Asset Manager to handle image loading and caching
export class AssetManager {
    constructor() {
        this.images = new Map();
        this.basePath = 'SVG_Background/';
    }

    getTileImageName(tile) {
        if (!tile) return null;
        
        let suffix = '';
        if (tile.type === CONFIG.MAHJONG_TYPES.WAN) suffix = 'm';
        else if (tile.type === CONFIG.MAHJONG_TYPES.TIAO) suffix = 's';
        else if (tile.type === CONFIG.MAHJONG_TYPES.BING) suffix = 'p';
        else if (tile.type === CONFIG.MAHJONG_TYPES.FENG || tile.type === CONFIG.MAHJONG_TYPES.YUAN) {
            suffix = 'z';
            const specialMapping = {
                '东': '1', '南': '2', '西': '3', '北': '4',
                '白': '5', '发': '6', '中': '7'
            };
            return (specialMapping[tile.value] || '') + suffix;
        }

        return tile.value + suffix;
    }

    getTileImage(tile) {
        const name = this.getTileImageName(tile);
        if (!name) return null;
        
        const path = `${this.basePath}${name}.svg`;
        if (this.images.has(path)) {
            return this.images.get(path);
        }

        const img = new Image();
        img.src = path;
        this.images.set(path, img);
        return img;
    }
}

export const assetManager = new AssetManager();

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
