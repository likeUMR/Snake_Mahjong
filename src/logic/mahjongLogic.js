import { CONFIG } from '../core/config.js';
import { evaluateHu } from './hu/HuManager.js';

/**
 * Sorting logic for Mahjong tiles.
 */
export function sortTiles(tiles) {
    return tiles.filter(t => t !== null).sort((a, b) => a.getSortWeight() - b.getSortWeight());
}

/**
 * Checks if a set of tiles constitutes a winning hand (Hu).
 * Uses the advanced evaluateHu for detailed results.
 */
export function canHu(tiles, maxTiles = CONFIG.MAX_SNAKE_TILES) {
    const validTiles = tiles.filter(t => t !== null);
    
    // 计算杠的数量以判定有效长度
    const groups = {};
    validTiles.forEach(t => {
        if (t.isIron && t.groupId) {
            if (!groups[t.groupId]) groups[t.groupId] = [];
            groups[t.groupId].push(t);
        }
    });
    let kongCount = 0;
    for (const gid in groups) {
        if (groups[gid].length === 4) kongCount++;
    }

    // 必须达到满手牌（动态上限）且符合 3n+2 结构才能胡牌
    // 每有一个杠，物理牌数增加1，但有效牌数（3n+2）计算时需要减去杠数
    if (validTiles.length !== maxTiles || (validTiles.length - kongCount) % 3 !== 2) {
        return null;
    }

    return evaluateHu(validTiles);
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
 * 统一掠夺判定入口 (胡 > 杠 > 碰 > 吃)
 * 用于预指示高亮和实际碰撞判定，确保逻辑完全一致
 * 开发阶段 10 新规：当长度达到上限后，不能吃碰，只能杠
 */
export function getRobberyAction(attackerTiles, targetTile, isShangJia, isAttackerFull = false, attackerMaxTiles = CONFIG.MAX_SNAKE_TILES) {
    if (!targetTile || targetTile.isIron) return null;

    // 0. 判定胡 (最高优先级)
    // 只有当拿走这张牌能让自己胡牌时，才判定为胡
    const potentialTiles = [...attackerTiles, targetTile];
    const huResult = canHu(potentialTiles, attackerMaxTiles);
    if (huResult) {
        return { type: 'hu', involvedTiles: [], effectText: '胡！', isKong: false, winResult: huResult };
    }

    // 1. 判定杠 (任何时候都可以杠)
    let involvedTiles = canKong(attackerTiles, targetTile);
    if (involvedTiles) {
        return { type: 'kong', involvedTiles, effectText: '杠！', isKong: true };
    }

    // 如果攻击者已满，不能进行后续的碰和吃判定
    if (isAttackerFull) return null;

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
 * 计算弃置哪张牌最优 (开发阶段 10)
 * 返回当前牌库(去除非铁牌后的)中建议弃置的牌的索引
 */
export function recommendDiscardTile(tiles) {
    const validTiles = tiles.filter(t => t !== null && !t.isIron);
    if (validTiles.length === 0) return -1;

    const scores = validTiles.map((tile, index) => {
        let score = 0;
        const v = tile.value;
        const type = tile.type;

        // 1. 相同牌判定 (刻子/对子潜力)
        const sameTiles = validTiles.filter(t => t.type === type && t.value === v);
        const count = sameTiles.length;
        if (count >= 3) score += 100;
        else if (count === 2) score += 60;

        // 2. 顺子潜力 (仅限序牌)
        if (type === CONFIG.MAHJONG_TYPES.WAN || type === CONFIG.MAHJONG_TYPES.TIAO || type === CONFIG.MAHJONG_TYPES.BING) {
            const sameTypeTiles = validTiles.filter(t => t.type === type);
            const values = sameTypeTiles.map(t => t.value);

            if (values.includes(v - 1)) score += 30;
            if (values.includes(v + 1)) score += 30;
            if (values.includes(v - 2)) score += 10;
            if (values.includes(v + 2)) score += 10;

            // 边张/幺九牌稍微减分 (1, 9 潜力较小)
            if (v === 1 || v === 9) score -= 5;
        } else {
            // 字牌若无对子刻子，价值较低
            if (count === 1) score -= 10;
        }

        return { index, score };
    });

    // 找到分值最低的牌 (可能有多张，取第一张)
    scores.sort((a, b) => a.score - b.score);
    const bestToDiscard = scores[0];

    // 我们需要返回在原 tiles 数组（包含铁牌和 null）中的索引，或者在 UI 展示的非铁牌数组中的索引？
    // 根据 Snake.discardTile(mahjongIndex) 的定义，它接收的是非 null 牌的索引。
    // 但是 Snake.discardTile 内部会跳过铁牌。
    
    // 重新映射回“非 null 牌”的索引
    const allNonNullTiles = tiles.filter(t => t !== null);
    const targetTile = validTiles[bestToDiscard.index];
    return allNonNullTiles.indexOf(targetTile);
}

/**
 * 扫描对方全手牌，找出优先级最高的掠夺动作 (胡 > 杠 > 碰 > 吃)
 * 严格符合阶段 6 的逻辑：A 撞了 B，检查 A 是否能使用 B 身体中的“任何一张”牌
 */
export function findBestRobberyFromHand(attackerTiles, targetTiles, isShangJia, isAttackerFull = false, attackerMaxTiles = CONFIG.MAX_SNAKE_TILES) {
    // 0. 扫描是否有可以“胡”的牌 (优先级最高)
    for (let i = 0; i < targetTiles.length; i++) {
        const tile = targetTiles[i];
        if (!tile || tile.isIron) continue;
        const action = getRobberyAction(attackerTiles, tile, isShangJia, isAttackerFull, attackerMaxTiles);
        if (action && action.type === 'hu') return { ...action, tileIndex: i };
    }

    // 1. 扫描是否有可以“杠”的牌
    for (let i = 0; i < targetTiles.length; i++) {
        const tile = targetTiles[i];
        if (!tile || tile.isIron) continue;
        const action = getRobberyAction(attackerTiles, tile, isShangJia, isAttackerFull, attackerMaxTiles);
        if (action && action.type === 'kong') return { ...action, tileIndex: i };
    }

    // 如果攻击者已满，不能进行后续的碰和吃判定
    if (isAttackerFull) return null;

    // 2. 扫描是否有可以“碰”的牌
    for (let i = 0; i < targetTiles.length; i++) {
        const tile = targetTiles[i];
        if (!tile || tile.isIron) continue;
        const action = getRobberyAction(attackerTiles, tile, isShangJia, isAttackerFull, attackerMaxTiles);
        if (action && action.type === 'pung') return { ...action, tileIndex: i };
    }

    // 3. 扫描是否有可以“吃”的牌 (仅上家)
    if (isShangJia) {
        for (let i = 0; i < targetTiles.length; i++) {
            const tile = targetTiles[i];
            if (!tile || tile.isIron) continue;
            const action = getRobberyAction(attackerTiles, tile, isShangJia, isAttackerFull, attackerMaxTiles);
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
