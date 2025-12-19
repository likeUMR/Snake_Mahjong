import { CONFIG } from '../core/config.js';
import { getRandomTile } from './mahjong.js';

export class Food {
    constructor(x, y) {
        this.gridX = x;
        this.gridY = y;
        this.tile = getRandomTile();
    }

    draw(ctx, offsetX, offsetY) {
        const x = this.gridX * CONFIG.TILE_WIDTH - offsetX;
        const y = this.gridY * CONFIG.TILE_HEIGHT - offsetY;
        
        // Draw back of mahjong tile (as specified in phase 1.2: "生成时背面向上")
        ctx.fillStyle = '#1e5a1e'; // Dark green back
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.fillRect(x, y, CONFIG.TILE_WIDTH, CONFIG.TILE_HEIGHT);
        ctx.strokeRect(x, y, CONFIG.TILE_WIDTH, CONFIG.TILE_HEIGHT);
    }
}

