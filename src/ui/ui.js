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

export class TutorialUI {
    constructor() {
        this.lines = [
            '教程：',
            'wasd控制移动',
            '通过碰撞达成吃、碰、杠、胡',
            '任意玩家胡牌则游戏结束'
        ];
    }

    draw(ctx, uiScale = 1) {
        const s = uiScale;
        const padding = CONFIG.TUTORIAL_UI_PADDING * s;
        const fontSize = CONFIG.TUTORIAL_UI_FONT_SIZE * s;
        const lineHeight = CONFIG.TUTORIAL_UI_LINE_HEIGHT * s;
        
        const x = padding;
        const y = padding;

        // 使用 Monospace 字体以获得更清晰、更有游戏感的像素效果
        ctx.font = `bold ${fontSize}px "Consolas", "Monaco", "Courier New", monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        
        this.lines.forEach((line, index) => {
            // 确保坐标为整数以获得最清晰的像素效果
            const lineX = Math.round(x);
            const lineY = Math.round(y + index * lineHeight);
            
            // 只有指定的“通过碰撞达成...”这一行才进行关键字高亮
            if (line === '通过碰撞达成吃、碰、杠、胡') {
                this.drawHighlightedLine(ctx, line, lineX, lineY);
            } else {
                ctx.fillStyle = CONFIG.TUTORIAL_UI_TEXT_COLOR;
                ctx.fillText(line, lineX, lineY);
            }
        });
    }

    /**
     * 绘制带有关键字高亮的单行文字
     */
    drawHighlightedLine(ctx, line, x, y) {
        const keywords = [
            { text: '吃', color: CONFIG.COLOR_CHOW },
            { text: '碰', color: CONFIG.COLOR_PUNG },
            { text: '杠', color: CONFIG.COLOR_KONG },
            { text: '胡', color: CONFIG.COLOR_HU }
        ];

        let currentX = x;
        let remaining = line;

        while (remaining.length > 0) {
            let firstMatch = null;
            let minIndex = Infinity;

            for (const kw of keywords) {
                let idx = remaining.indexOf(kw.text);
                
                // 排除“碰撞”中的“碰”字：如果匹配到“碰”且后面紧跟“撞”，则跳过该匹配，寻找下一个
                if (kw.text === '碰' && idx !== -1 && remaining[idx + 1] === '撞') {
                    idx = remaining.indexOf(kw.text, idx + 1);
                }

                if (idx !== -1 && idx < minIndex) {
                    minIndex = idx;
                    firstMatch = kw;
                }
            }

            if (firstMatch) {
                // 绘制匹配项之前的文字
                if (minIndex > 0) {
                    const textBefore = remaining.substring(0, minIndex);
                    ctx.fillStyle = CONFIG.TUTORIAL_UI_TEXT_COLOR;
                    ctx.fillText(textBefore, currentX, y);
                    currentX += ctx.measureText(textBefore).width;
                }

                // 绘制关键字
                ctx.fillStyle = firstMatch.color;
                ctx.fillText(firstMatch.text, currentX, y);
                currentX += ctx.measureText(firstMatch.text).width;

                // 截取剩余部分
                remaining = remaining.substring(minIndex + firstMatch.text.length);
            } else {
                // 绘制最后剩余的文字
                ctx.fillStyle = CONFIG.TUTORIAL_UI_TEXT_COLOR;
                ctx.fillText(remaining, currentX, y);
                remaining = '';
            }
        }
    }
}