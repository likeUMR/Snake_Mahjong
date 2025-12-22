import { CONFIG } from '../core/config.js';
import { assetManager } from '../core/utils.js';
import { audioManager } from '../core/audio.js';

export class DiscardUI {
    constructor() {
        this.uiTiles = []; // To store rects for click detection
    }

    draw(ctx, canvas, snakeTiles, uiScale = 1) {
        const tiles = snakeTiles.filter(t => t !== null);
        if (tiles.length === 0) {
            this.uiTiles = [];
            return;
        }

        const s = uiScale;
        const tileUIWidth = CONFIG.DISCARD_UI_WIDTH * s;
        const tileUIHeight = CONFIG.DISCARD_UI_HEIGHT * s;
        const spacing = CONFIG.DISCARD_UI_SPACING * s;
        
        // Group tiles: iron groups first, then others
        const ironGroups = [];
        const seenGroupIds = new Set();
        tiles.forEach(t => {
            if (t.isIron && !seenGroupIds.has(t.groupId)) {
                const group = tiles.filter(other => other.groupId === t.groupId);
                ironGroups.push(group);
                seenGroupIds.add(t.groupId);
            }
        });
        
        const normalTiles = tiles.filter(t => !t.isIron);
        
        // Calculate total width
        let totalWidth = 0;
        ironGroups.forEach(group => {
            totalWidth += group.length * tileUIWidth; // No spacing within iron group
            totalWidth += spacing;
        });
        totalWidth += normalTiles.length * (tileUIWidth + spacing);
        if (totalWidth > 0) totalWidth -= spacing;

        const screenWidth = canvas.width / (window.devicePixelRatio || 1);
        const screenHeight = canvas.height / (window.devicePixelRatio || 1);

        const startX = (screenWidth - totalWidth) / 2;
        const startY = screenHeight - tileUIHeight - 30 * s;

        // Draw background panel
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        const padding = 15 * s;
        ctx.roundRect(startX - padding, startY - padding, totalWidth + padding * 2, tileUIHeight + padding * 2, 15 * s);
        ctx.fill();

        this.uiTiles = []; // Reset
        let currentX = startX;

        // Draw iron groups
        ironGroups.forEach(group => {
            group.forEach((tile, subIndex) => {
                const x = currentX + subIndex * tileUIWidth;
                const y = startY;
                
                // Find actual index in 'tiles' for this tile
                const originalIndex = tiles.indexOf(tile);
                this.uiTiles.push({ x, y, width: tileUIWidth, height: tileUIHeight, tileIndex: originalIndex, isIron: true });

                this.drawSingleTile(ctx, x, y, tileUIWidth, tileUIHeight, tile, s);
            });
            currentX += group.length * tileUIWidth + spacing;
        });

        // Draw normal tiles
        normalTiles.forEach(tile => {
            const x = currentX;
            const y = startY;
            
            const originalIndex = tiles.indexOf(tile);
            this.uiTiles.push({ x, y, width: tileUIWidth, height: tileUIHeight, tileIndex: originalIndex, isIron: false });

            this.drawSingleTile(ctx, x, y, tileUIWidth, tileUIHeight, tile, s);
            currentX += tileUIWidth + spacing;
        });
    }

    drawSingleTile(ctx, x, y, width, height, tile, s = 1) {
        // Draw tile background
        ctx.fillStyle = tile.isIron ? '#bdc3c7' : 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, 5 * s);
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1 * s;
        ctx.stroke();

        // 绘制 SVG 背景图 (开发阶段 10 优化)
        const img = assetManager.getTileImage(tile);
        if (img && img.complete && img.naturalWidth !== 0) {
            const padding = 10 * s;
            ctx.drawImage(img, x + padding, y + padding, width - padding * 2, height - padding * 2);
        } else if (tile.value === '白' && tile.type === CONFIG.MAHJONG_TYPES.YUAN) {
            // 白板保持空白
        }
    }

    handleMouseDown(e, canvas, onDiscard) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        for (const uiTile of this.uiTiles) {
            if (mouseX >= uiTile.x && mouseX <= uiTile.x + uiTile.width &&
                mouseY >= uiTile.y && mouseY <= uiTile.y + uiTile.height) {
                
                if (!uiTile.isIron) {
                    audioManager.playVoice(0, 'discard_tile');
                    onDiscard(uiTile.tileIndex);
                    return true;
                }
            }
        }
        return false;
    }
}

