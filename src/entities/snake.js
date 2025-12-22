import { CONFIG } from '../core/config.js';
import { sortTiles, canHu } from '../logic/mahjongLogic.js';
import { assetManager } from '../core/utils.js';
import { audioManager } from '../core/audio.js';

export class Snake {
    constructor(x, y, color = '#2c3e50', roleIndex = 0) {
        this.body = [
            { x: x, y: y },
            { x: x - 1, y: y },
            { x: x - 2, y: y }
        ];
        this.tiles = [null, null, null]; 
        
        this.direction = { x: 1, y: 0 };
        this.nextDirection = { x: 1, y: 0 };
        this.color = color;
        
        this.roleIndex = roleIndex; // 0: Player, 1: AI1, 2: AI2, 3: AI3
        this.voiceRole = CONFIG.AUDIO_CHARACTERS[roleIndex];

        this.moveTimer = 0;
        this.speed = CONFIG.INITIAL_SNAKE_SPEED;
        this.needsSort = false;
        this.isWin = false;
        this.winResult = null; // 存储胡牌详情 { patterns, score }
        this.stunTimer = 0;
        this.isStunned = false;
        this.isGhost = false;
        this.ghostTimer = 0;
        this.shouldGhostAfterStun = false;

        this.maxTilesBonus = 0; 
        this.ironGroupCount = 0; 
        this.pendingShrink = 0; // 开发阶段 10：待缩短的长度
        this.score = 0; // 开发阶段 11：玩家分数
        this.needsSafeTurn = false; // 眩晕结束后是否需要安全转向
        
        // 渲染辅助：记录本帧哪些牌需要高亮边框 { index: color }
        this.highlights = {};
    }

    getMaxTiles() {
        return CONFIG.MAX_SNAKE_TILES + this.maxTilesBonus;
    }

    playVoice(actionType) {
        audioManager.playVoice(this.roleIndex, actionType, this.body[0]);
    }

    stun(shouldGhostAfter = false) {
        this.isStunned = true;
        this.stunTimer = CONFIG.STUN_DURATION;
        this.shouldGhostAfterStun = shouldGhostAfter;
        this.playVoice('xuanyun');
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
        // 不再立即 splice body，而是增加待缩短计数，让尾部在移动时“追赶”
        this.pendingShrink++;
        this.needsSort = true;
        return lostTile;
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
                this.needsSafeTurn = true; 
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
        return { 
            x: this.body[0].x + this.direction.x, 
            y: this.body[0].y + this.direction.y 
        };
    }

    executeMove(nextHead) {
        if (this.needsSort) {
            this.sortBodyTiles();
            this.needsSort = false;
        }
        this.body.unshift(nextHead);
        
        // 标准移动：去掉末尾
        this.body.pop();

        // 开发阶段 10：如果存在待缩短长度（如刚丢弃或失去牌），则再去掉一个末尾
        // 这实现了“后面的牌移动两次”的效果，快速补齐空位
        if (this.pendingShrink > 0 && this.body.length > 1) {
            this.body.pop();
            this.pendingShrink--;
        }

        this.checkWin();
    }

    checkWin() {
        const huResult = canHu(this.tiles, this.getMaxTiles());
        if (huResult) {
            this.isWin = true;
            this.winResult = huResult;
            return true;
        }
        return false;
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

    grow(tile, skipInternalDetection = false) {
        // 1. 预检杠 (加杠或暗杠)
        let isKong = false;
        let kakanGroupId = null;
        let internalIsAnkan = false; // 重命名以防潜在冲突
        let internalAnkanTiles = [];

        if (!skipInternalDetection) {
            // 加杠检测 (1个普通 + 3个铁牌)
            const ironTiles = this.tiles.filter(t => t && t.isIron);
            const groups = {};
            ironTiles.forEach(t => {
                if (t.groupId) {
                    if (!groups[t.groupId]) groups[t.groupId] = [];
                    groups[t.groupId].push(t);
                }
            });
            for (const gid in groups) {
                const group = groups[gid];
                if (group.length === 3 && 
                    group[0].type === tile.type && 
                    group[0].value === tile.value &&
                    group[1].value === tile.value) { // 确保是刻子而非顺子
                    kakanGroupId = gid;
                    isKong = true;
                    break;
                }
            }

            // 暗杠检测 (4个普通)
            const sameNormalTiles = this.tiles.filter(t => t && !t.isIron && t.type === tile.type && t.value === tile.value);
            if (sameNormalTiles.length === 3) {
                internalIsAnkan = true;
                internalAnkanTiles = [...sameNormalTiles, tile];
                isKong = true;
            }
        }

        const currentCount = this.tiles.filter(t => t !== null).length;
        // 如果不是杠且已经达到上限，且不是外部掠夺逻辑，则拒绝成长
        if (!isKong && !skipInternalDetection && currentCount >= this.getMaxTiles()) return null;
        
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
            // 如果有待缩短的长度，说明 body 里有多余的格子，直接抵消即可
            if (this.pendingShrink > 0) {
                this.pendingShrink--;
            } else {
                const lastPart = this.body[this.body.length - 1];
                this.body.push({ x: lastPart.x, y: lastPart.y });
            }
        }

        let result = { type: 'grow', tile };

        if (!skipInternalDetection) {
            if (kakanGroupId) {
                tile.isIron = true;
                tile.groupId = kakanGroupId;
                this.maxTilesBonus += 1;
                result.type = 'kong';
                result.isConcealed = false;
                result.effectText = '加杠！';
                this.playVoice('fulu');
            } else if (internalIsAnkan) {
                this.hardenTiles(internalAnkanTiles, true);
                result.type = 'kong';
                result.isConcealed = true;
                result.effectText = '暗杠！';
            }
        }

        this.checkWin();
        this.needsSort = true;
        return result;
    }

    hardenTiles(newTiles, isKong = false) {
        const groupId = `group_${Date.now()}_${Math.random()}`;
        newTiles.forEach(t => {
            t.isIron = true;
            t.groupId = groupId;
        });
        if (isKong) this.maxTilesBonus += 1;
        this.needsSort = true;
        this.playVoice('fulu');
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
            this.pendingShrink++;
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
        
        // 叠加一层非常淡的角色颜色
        ctx.save();
        ctx.globalAlpha = CONFIG.SNAKE_TILE_OVERLAY_ALPHA;
        ctx.fillStyle = this.color;
        ctx.fillRect(x, y, CONFIG.TILE_WIDTH, CONFIG.TILE_HEIGHT);
        ctx.restore();

        // 如果有高亮，绘制边框
        if (highlightColor) {
            ctx.strokeStyle = highlightColor;
            ctx.lineWidth = 3;
            ctx.strokeRect(x + 1.5, y + 1.5, CONFIG.TILE_WIDTH - 3, CONFIG.TILE_HEIGHT - 3);
        }

        // 绘制 SVG 背景图 (开发阶段 10 优化)
        const img = assetManager.getTileImage(tile);
        if (img && img.complete && img.naturalWidth !== 0) {
            // 保持一定的边距
            const padding = 2;
            ctx.drawImage(img, x + padding, y + padding, CONFIG.TILE_WIDTH - padding * 2, CONFIG.TILE_HEIGHT - padding * 2);
        } else if (tile.value === '白' && tile.type === CONFIG.MAHJONG_TYPES.YUAN) {
            // 白板保持空白，不显示文字
        } else {
            // 如果图片还没加载好，或者没有对应图片，作为降级方案显示文字（虽然按要求不应显示，但加载中展示一下有助于调试）
            // 如果你确定完全不需要文字，可以留空
            /*
            ctx.fillStyle = '#000';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            let label = tile.value;
            if (tile.type === CONFIG.MAHJONG_TYPES.WAN) label += '万';
            else if (tile.type === CONFIG.MAHJONG_TYPES.TIAO) label += '条';
            else if (tile.type === CONFIG.MAHJONG_TYPES.BING) label += '饼';
            ctx.fillText(label, x + CONFIG.TILE_WIDTH / 2, y + CONFIG.TILE_HEIGHT / 2);
            */
        }
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
