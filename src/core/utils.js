import { CONFIG } from './config.js';

/**
 * Utility functions for the game.
 */

// Asset Manager to handle image loading and caching
export class AssetManager {
    constructor() {
        this.images = new Map();
        this.basePath = 'SVG_Background/';
        // 定义所有麻将牌清单，确保一次性加载
        this.tileList = [];
        this.loadedCount = 0;
        this.totalCount = 0;
    }

    initTileList() {
        // 万 (1-9m)
        for (let i = 1; i <= 9; i++) this.tileList.push(`${i}m`);
        // 条 (1-9s)
        for (let i = 1; i <= 9; i++) this.tileList.push(`${i}s`);
        // 饼 (1-9p)
        for (let i = 1; i <= 9; i++) this.tileList.push(`${i}p`);
        // 风/字 (1-7z)，其中 5z.svg (白板) 不存在
        for (let i = 1; i <= 7; i++) {
            if (i === 5) continue;
            this.tileList.push(`${i}z`);
        }
        // 特殊 0m, 0p, 0s (赤宝牌)
        this.tileList.push('0m', '0p', '0s');
        // 其他可能存在的 (根据目录截图：chun, dong, ju, lan, mei, qiu, xia, zu)
        this.tileList.push('chun', 'dong', 'ju', 'lan', 'mei', 'qiu', 'xia', 'zu');
    }

    async preloadAll() {
        if (this.tileList.length === 0) {
            this.initTileList();
        }
        this.totalCount = this.tileList.length;
        this.loadedCount = 0;

        const promises = this.tileList.map(name => {
            return new Promise((resolve) => {
                const path = `${this.basePath}${name}.svg`;
                if (this.images.has(path)) {
                    this.loadedCount++;
                    resolve();
                    return;
                }
                const img = new Image();
                img.onload = () => {
                    this.loadedCount++;
                    resolve();
                };
                img.onerror = () => {
                    console.warn(`Failed to load asset: ${path}`);
                    this.loadedCount++;
                    resolve(); // 失败也 resolve，避免阻塞游戏
                };
                img.src = path;
                this.images.set(path, img);
            });
        });
        await Promise.all(promises);
    }

    getProgress() {
        return this.totalCount === 0 ? 1 : this.loadedCount / this.totalCount;
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

// Storage Manager to handle persistence of scores and clear status
export class StorageManager {
    constructor() {
        this.KEY = 'SNAKE_MAHJONG_RECORDS';
        this.data = this.load();
    }

    load() {
        const json = localStorage.getItem(this.KEY);
        try {
            return json ? JSON.parse(json) : {};
        } catch (e) {
            console.error('Failed to parse storage data', e);
            return {};
        }
    }

    save() {
        localStorage.setItem(this.KEY, JSON.stringify(this.data));
    }

    /**
     * @param {string} difficulty 
     * @returns {{cleared: boolean, highScore: number}}
     */
    getRecord(difficulty) {
        return this.data[difficulty] || { cleared: false, highScore: 0 };
    }

    /**
     * @param {string} difficulty 
     * @param {number} score 
     * @param {boolean} won 
     * @returns {{newHighScore: boolean, firstClear: boolean}}
     */
    saveRecord(difficulty, score, won) {
        if (!won) return { newHighScore: false, firstClear: false };

        if (!this.data[difficulty]) {
            this.data[difficulty] = { cleared: false, highScore: 0 };
        }
        
        const record = this.data[difficulty];
        let firstClear = false;
        let newHighScore = false;

        if (!record.cleared) {
            record.cleared = true;
            firstClear = true;
        }
        
        if (score > record.highScore) {
            record.highScore = score;
            newHighScore = true;
        }
        
        this.save();
        return { newHighScore, firstClear };
    }
}

export const storageManager = new StorageManager();

/**
 * Detects if the current device is mobile.
 */
export function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
           (window.innerWidth < 1024 && 'ontouchstart' in window);
}

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
