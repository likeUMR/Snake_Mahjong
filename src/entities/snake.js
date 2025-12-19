import { CONFIG } from '../core/config.js';
import { sortTiles, canHu } from '../logic/mahjongLogic.js';

export class Snake {
    constructor(x, y, color = '#2c3e50') {
        this.body = [
            { x: x, y: y },
            { x: x - 1, y: y },
            { x: x - 2, y: y }
        ];
        this.tiles = [null, null, null]; 
        
        this.direction = { x: 1, y: 0 };
        this.nextDirection = { x: 1, y: 0 };
        this.color = color;
        
        this.moveTimer = 0;
        this.speed = CONFIG.INITIAL_SNAKE_SPEED;
        this.needsSort = false;
        this.isWin = false;
        this.stunTimer = 0;
        this.isStunned = false;
        this.isGhost = false;
        this.ghostTimer = 0;
        this.shouldGhostAfterStun = false;

        this.maxTilesBonus = 0; 
        this.ironGroupCount = 0; 
        
        // 渲染辅助：记录本帧哪些牌需要高亮边框 { index: color }
        this.highlights = {};
    }

    getMaxTiles() {
        return CONFIG.MAX_SNAKE_TILES + this.maxTilesBonus;
    }

    stun(shouldGhostAfter = false) {
        this.isStunned = true;
        this.stunTimer = CONFIG.STUN_DURATION;
        this.shouldGhostAfterStun = shouldGhostAfter;
    }

    enterGhostMode() {
        this.isGhost = true;
        this.ghostTimer = CONFIG.GHOST_DURATION;
    }

    loseTile(index) {
        if (index < 0 || index >= this.tiles.length) return null;
        const lostTile = this.tiles[index];
        if (lostTile && lostTile.isIron) return null;
        this.tiles.splice(index, 1);
        if (index < this.body.length) this.body.splice(index, 1);
        this.needsSort = true;
        return lostTile;
    }

    forceTurn() {
        const directions = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];
        const perpendiculars = directions.filter(d => d.x * this.direction.x === 0 && d.y * this.direction.y === 0);
        const newDir = perpendiculars[Math.floor(Math.random() * perpendiculars.length)];
        this.nextDirection = newDir;
        this.direction = newDir; 
    }

    handleInput(key) {
        switch (key.toLowerCase()) {
            case 'w': if (this.direction.y === 0) this.nextDirection = { x: 0, y: -1 }; break;
            case 's': if (this.direction.y === 0) this.nextDirection = { x: 0, y: 1 }; break;
            case 'a': if (this.direction.x === 0) this.nextDirection = { x: -1, y: 0 }; break;
            case 'd': if (this.direction.x === 0) this.nextDirection = { x: 1, y: 0 }; break;
        }
    }

    willMove(deltaTime) {
        if (this.isStunned) {
            this.stunTimer -= deltaTime;
            if (this.stunTimer <= 0) {
                this.isStunned = false;
                if (this.shouldGhostAfterStun) {
                    this.enterGhostMode();
                    this.shouldGhostAfterStun = false;
                }
            }
            return false;
        }
        if (this.isGhost) {
            this.ghostTimer -= deltaTime;
            if (this.ghostTimer <= 0) this.isGhost = false;
        }
        this.moveTimer += deltaTime;
        if (this.moveTimer >= this.speed) {
            this.moveTimer = 0;
            return true;
        }
        return false;
    }

    getPotentialHead() {
        this.direction = this.nextDirection;
        let headX = this.body[0].x + this.direction.x;
        let headY = this.body[0].y + this.direction.y;
        if (headX < 0) headX = CONFIG.SCENE_GRID_WIDTH - 1;
        else if (headX >= CONFIG.SCENE_GRID_WIDTH) headX = 0;
        if (headY < 0) headY = CONFIG.SCENE_GRID_HEIGHT - 1;
        else if (headY >= CONFIG.SCENE_GRID_HEIGHT) headY = 0;
        return { x: headX, y: headY };
    }

    executeMove(nextHead) {
        if (this.needsSort) {
            this.sortBodyTiles();
            this.needsSort = false;
        }
        this.body.unshift(nextHead);
        this.body.pop();
        if (canHu(this.tiles, this.getMaxTiles())) this.isWin = true;
    }

    sortBodyTiles() {
        const ironTiles = this.tiles.filter(t => t && t.isIron);
        const normalTiles = this.tiles.filter(t => t && !t.isIron);
        const groups = {};
        ironTiles.forEach(t => {
            if (!groups[t.groupId]) groups[t.groupId] = [];
            groups[t.groupId].push(t);
        });
        const sortedGroupIds = Object.keys(groups).sort((a, b) => groups[a][0].getSortWeight() - groups[b][0].getSortWeight());
        const sortedIron = [];
        sortedGroupIds.forEach(id => {
            groups[id].sort((a, b) => a.getSortWeight() - b.getSortWeight());
            sortedIron.push(...groups[id]);
        });
        const sortedNormal = sortTiles(normalTiles);
        const newTiles = [null, ...sortedIron, ...sortedNormal];
        while (newTiles.length < this.body.length) newTiles.push(null);
        this.tiles = newTiles;
    }

    grow(tile) {
        if (this.tiles.filter(t => t !== null).length >= this.getMaxTiles()) return;
        let replaced = false;
        const firstNormalIdx = this.tiles.findIndex((t, i) => i > 0 && (!t || !t.isIron));
        const startSearch = firstNormalIdx === -1 ? 1 : firstNormalIdx;
        for (let i = startSearch; i < this.tiles.length; i++) {
            if (this.tiles[i] === null) {
                this.tiles[i] = tile;
                replaced = true;
                break;
            }
        }
        if (!replaced) {
            this.tiles.push(tile);
            const lastPart = this.body[this.body.length - 1];
            this.body.push({ x: lastPart.x, y: lastPart.y });
        }
        this.needsSort = true;
    }

    hardenTiles(newTiles, isKong = false) {
        const groupId = `group_${Date.now()}_${Math.random()}`;
        newTiles.forEach(t => {
            t.isIron = true;
            t.groupId = groupId;
        });
        if (isKong) this.maxTilesBonus += 1;
        this.needsSort = true;
    }

    discardTile(mahjongIndex) {
        const currentTiles = this.tiles.filter(t => t !== null);
        if (mahjongIndex < 0 || mahjongIndex >= currentTiles.length) return;
        const tileToDiscard = currentTiles[mahjongIndex];
        if (tileToDiscard.isIron) return;
        let actualIndex = -1;
        let count = 0;
        for (let i = 0; i < this.tiles.length; i++) {
            if (this.tiles[i] !== null) {
                if (count === mahjongIndex) {
                    actualIndex = i;
                    break;
                }
                count++;
            }
        }
        if (actualIndex !== -1) {
            this.tiles.splice(actualIndex, 1);
            if (actualIndex < this.body.length) this.body.splice(actualIndex, 1);
            this.needsSort = true;
        }
    }

    draw(ctx, offsetX, offsetY) {
        const mahjongCount = this.tiles.filter(t => t !== null).length;
        const isFull = mahjongCount >= this.getMaxTiles();
        ctx.save();
        if (this.isGhost) ctx.globalAlpha = 0.5;

        this.body.forEach((part, index) => {
            const x = part.x * CONFIG.TILE_WIDTH - offsetX;
            const y = part.y * CONFIG.TILE_HEIGHT - offsetY;
            
            if (index === 0) {
                ctx.fillStyle = isFull ? CONFIG.SNAKE_FULL_COLOR : this.color;
                ctx.fillRect(x, y, CONFIG.TILE_WIDTH, CONFIG.TILE_HEIGHT);
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 16px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(mahjongCount, x + CONFIG.TILE_WIDTH / 2, y + CONFIG.TILE_HEIGHT / 2);
            } else {
                const tile = this.tiles[index];
                const highlightColor = this.highlights[index]; // 获取该节的高亮颜色
                if (tile) {
                    this.drawTile(ctx, x, y, tile, highlightColor);
                } else {
                    ctx.fillStyle = '#95a5a6';
                    ctx.fillRect(x, y, CONFIG.TILE_WIDTH, CONFIG.TILE_HEIGHT);
                }
            }
            
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, CONFIG.TILE_WIDTH, CONFIG.TILE_HEIGHT);
        });
        ctx.restore();
    }

    drawTile(ctx, x, y, tile, highlightColor = null) {
        ctx.fillStyle = tile.isIron ? '#bdc3c7' : '#fff';
        ctx.fillRect(x, y, CONFIG.TILE_WIDTH, CONFIG.TILE_HEIGHT);
        
        // 如果有高亮，绘制边框
        if (highlightColor) {
            ctx.strokeStyle = highlightColor;
            ctx.lineWidth = 3;
            ctx.strokeRect(x + 1.5, y + 1.5, CONFIG.TILE_WIDTH - 3, CONFIG.TILE_HEIGHT - 3);
        }

        ctx.fillStyle = '#000';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        let label = tile.value;
        if (tile.type === CONFIG.MAHJONG_TYPES.WAN) label += '万';
        else if (tile.type === CONFIG.MAHJONG_TYPES.TIAO) label += '条';
        else if (tile.type === CONFIG.MAHJONG_TYPES.BING) label += '饼';
        ctx.fillText(label, x + CONFIG.TILE_WIDTH / 2, y + CONFIG.TILE_HEIGHT / 2);
    }

    // 新增：专门用于绘制眩晕文字，由 Game 统一调用确保在最上层
    drawStunLabel(ctx, offsetX, offsetY) {
        if (this.isStunned) {
            const head = this.body[0];
            const x = head.x * CONFIG.TILE_WIDTH - offsetX;
            const y = head.y * CONFIG.TILE_HEIGHT - offsetY;
            ctx.fillStyle = '#f1c40f'; 
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('眩晕', x + CONFIG.TILE_WIDTH / 2, y - 5);
        }
    }
}
