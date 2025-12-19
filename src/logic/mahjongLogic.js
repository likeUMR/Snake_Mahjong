import { CONFIG } from '../core/config.js';

/**
 * Sorting logic for Mahjong tiles.
 */
export function sortTiles(tiles) {
    return tiles.filter(t => t !== null).sort((a, b) => a.getSortWeight() - b.getSortWeight());
}

/**
 * Checks if a set of tiles constitutes a winning hand (Hu).
 * Standard Hu: 3n + 2 tiles, forming n sets (pung or chow) and 1 pair.
 */
export function canHu(tiles, maxTiles = CONFIG.MAX_SNAKE_TILES) {
    const validTiles = tiles.filter(t => t !== null);
    // 必须达到满手牌（动态上限）且符合 3n+2 结构才能胡牌
    if (validTiles.length !== maxTiles || validTiles.length % 3 !== 2) {
        return false;
    }

    // Convert tiles to a map for easier counting
    const counts = new Map();
    for (const tile of validTiles) {
        const key = tile.getSortWeight();
        counts.set(key, (counts.get(key) || 0) + 1);
    }

    // Try each possible pair
    const uniqueKeys = Array.from(counts.keys());
    for (const key of uniqueKeys) {
        if (counts.get(key) >= 2) {
            // Potential pair found
            const remainingCounts = new Map(counts);
            remainingCounts.set(key, remainingCounts.get(key) - 2);
            if (remainingCounts.get(key) === 0) remainingCounts.delete(key);

            if (canDecompose(remainingCounts)) {
                return true;
            }
        }
    }

    return false;
}

/**
 * 判定杠：手牌中是否有3张相同的牌
 * 返回参与杠的牌组
 */
export function canKong(tiles, targetTile) {
    if (!targetTile) return null;
    const matches = tiles.filter(t => t && !t.isIron && t.type === targetTile.type && t.value === targetTile.value);
    return matches.length >= 3 ? matches.slice(0, 3) : null;
}

/**
 * 判定碰：手牌中是否有2张相同的牌
 * 返回参与碰的牌组
 */
export function canPung(tiles, targetTile) {
    if (!targetTile) return null;
    const matches = tiles.filter(t => t && !t.isIron && t.type === targetTile.type && t.value === targetTile.value);
    return matches.length >= 2 ? matches.slice(0, 2) : null;
}

/**
 * 判定吃：目标牌是否能与手牌凑成顺子（仅限万条筒）
 * 返回参与吃的牌组
 */
export function canChow(tiles, targetTile) {
    if (!targetTile || (
        targetTile.type !== CONFIG.MAHJONG_TYPES.WAN && 
        targetTile.type !== CONFIG.MAHJONG_TYPES.TIAO && 
        targetTile.type !== CONFIG.MAHJONG_TYPES.BING
    )) {
        return null;
    }

    const v = targetTile.value;
    const sameTypeNormalTiles = tiles.filter(t => t && !t.isIron && t.type === targetTile.type);
    
    // 检查三种情况：(v-2, v-1, [v]), (v-1, [v], v+1), ([v], v+1, v+2)
    const findTile = (val) => sameTypeNormalTiles.find(t => t.value === val);
    
    // Case 1: v-2, v-1
    let t1 = findTile(v - 2);
    let t2 = findTile(v - 1);
    if (t1 && t2) return [t1, t2];

    // Case 2: v-1, v+1
    t1 = findTile(v - 1);
    t2 = findTile(v + 1);
    if (t1 && t2) return [t1, t2];

    // Case 3: v+1, v+2
    t1 = findTile(v + 1);
    t2 = findTile(v + 2);
    if (t1 && t2) return [t1, t2];

    return null;
}

/**
 * 统一掠夺判定入口 (杠 > 碰 > 吃)
 * 用于预指示高亮和实际碰撞判定，确保逻辑完全一致
 */
export function getRobberyAction(attackerTiles, targetTile, isShangJia) {
    if (!targetTile || targetTile.isIron) return null;

    // 1. 判定杠
    let involvedTiles = canKong(attackerTiles, targetTile);
    if (involvedTiles) {
        return { type: 'kong', involvedTiles, effectText: '杠！', isKong: true };
    }

    // 2. 判定碰
    involvedTiles = canPung(attackerTiles, targetTile);
    if (involvedTiles) {
        return { type: 'pung', involvedTiles, effectText: '碰！', isKong: false };
    }

    // 3. 判定吃 (仅对上家)
    if (isShangJia) {
        involvedTiles = canChow(attackerTiles, targetTile);
        if (involvedTiles) {
            return { type: 'chow', involvedTiles, effectText: '吃！', isKong: false };
        }
    }

    return null;
}

/**
 * 扫描对方全手牌，找出优先级最高的掠夺动作 (杠 > 碰 > 吃)
 * 严格符合阶段 6 的逻辑：A 撞了 B，检查 A 是否能使用 B 身体中的“任何一张”牌
 */
export function findBestRobberyFromHand(attackerTiles, targetTiles, isShangJia) {
    // 1. 扫描是否有可以“杠”的牌 (优先级最高)
    for (let i = 0; i < targetTiles.length; i++) {
        const tile = targetTiles[i];
        if (!tile || tile.isIron) continue;
        const action = getRobberyAction(attackerTiles, tile, isShangJia);
        if (action && action.type === 'kong') return { ...action, tileIndex: i };
    }

    // 2. 扫描是否有可以“碰”的牌
    for (let i = 0; i < targetTiles.length; i++) {
        const tile = targetTiles[i];
        if (!tile || tile.isIron) continue;
        const action = getRobberyAction(attackerTiles, tile, isShangJia);
        if (action && action.type === 'pung') return { ...action, tileIndex: i };
    }

    // 3. 扫描是否有可以“吃”的牌 (仅上家)
    if (isShangJia) {
        for (let i = 0; i < targetTiles.length; i++) {
            const tile = targetTiles[i];
            if (!tile || tile.isIron) continue;
            const action = getRobberyAction(attackerTiles, tile, isShangJia);
            if (action && action.type === 'chow') return { ...action, tileIndex: i };
        }
    }

    return null;
}

function canDecompose(counts) {
    if (counts.size === 0) return true;

    // Get the "smallest" tile
    const firstKey = Math.min(...counts.keys());
    const count = counts.get(firstKey);

    // Try forming a pung (3 of the same)
    if (count >= 3) {
        const nextCounts = new Map(counts);
        nextCounts.set(firstKey, count - 3);
        if (nextCounts.get(firstKey) === 0) nextCounts.delete(firstKey);
        if (canDecompose(nextCounts)) return true;
    }

    // Try forming a chow (1-2-3 sequence)
    // Only possible for wan, tiao, bing (weights < 300)
    if (firstKey < 300) {
        const key2 = firstKey + 1;
        const key3 = firstKey + 2;
        
        // Ensure they are of the same suit (typeWeight is multiple of 100)
        const suit = Math.floor(firstKey / 100);
        if (Math.floor(key2 / 100) === suit && Math.floor(key3 / 100) === suit &&
            counts.has(key2) && counts.has(key3)) {
            
            const nextCounts = new Map(counts);
            nextCounts.set(firstKey, counts.get(firstKey) - 1);
            nextCounts.set(key2, counts.get(key2) - 1);
            nextCounts.set(key3, counts.get(key3) - 1);
            
            [firstKey, key2, key3].forEach(k => {
                if (nextCounts.get(k) === 0) nextCounts.delete(k);
            });

            if (canDecompose(nextCounts)) return true;
        }
    }

    return false;
}
