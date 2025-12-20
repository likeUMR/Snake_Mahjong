import { CONFIG } from '../../core/config.js';

/**
 * Category 1: Basic Japanese Mahjong Winning Shapes
 */

/**
 * 1. Standard Shape (4 Sets + 1 Pair)
 * Note: Dynamic hand size (3n+2)
 */
export function checkStandard(tiles) {
    if (tiles.length % 3 !== 2) return false;

    const counts = new Map();
    for (const tile of tiles) {
        const key = tile.getSortWeight();
        counts.set(key, (counts.get(key) || 0) + 1);
    }

    const uniqueKeys = Array.from(counts.keys());
    for (const key of uniqueKeys) {
        if (counts.get(key) >= 2) {
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

function canDecompose(counts) {
    if (counts.size === 0) return true;

    const firstKey = Math.min(...counts.keys());
    const count = counts.get(firstKey);

    // Try Pung (3 of the same)
    if (count >= 3) {
        const nextCounts = new Map(counts);
        nextCounts.set(firstKey, count - 3);
        if (nextCounts.get(firstKey) === 0) nextCounts.delete(firstKey);
        if (canDecompose(nextCounts)) return true;
    }

    // Try Chow (1-2-3 sequence) - only for Wan, Tiao, Bing (weights < 300)
    if (firstKey < 300) {
        const key2 = firstKey + 1;
        const key3 = firstKey + 2;
        
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

/**
 * 2. Seven Pairs (Chitoitsu)
 * Strictly 14 tiles, 7 distinct pairs.
 */
export function checkSevenPairs(tiles) {
    if (tiles.length !== 14) return false;

    const counts = new Map();
    for (const tile of tiles) {
        const key = tile.getSortWeight();
        counts.set(key, (counts.get(key) || 0) + 1);
    }

    if (counts.size !== 7) return false;

    for (const count of counts.values()) {
        if (count !== 2) return false;
    }

    return true;
}

/**
 * 3. Thirteen Orphans (Kokushi Musou)
 * Strictly 14 tiles. 13 types of terminals/honors + 1 duplicate.
 */
export function checkThirteenOrphans(tiles) {
    if (tiles.length !== 14) return false;

    const terminalWeights = [
        101, 109, // 1m, 9m
        201, 209, // 1s, 9s
        301, 309, // 1p, 9p
        401, 402, 403, 404, // E, S, W, N
        501, 502, 503  // White, Fa, Chun (Z)
    ];

    const counts = new Map();
    for (const tile of tiles) {
        const weight = tile.getSortWeight();
        if (!terminalWeights.includes(weight)) return false;
        counts.set(weight, (counts.get(weight) || 0) + 1);
    }

    if (counts.size !== 13) return false;

    // Must have all 13 types
    return terminalWeights.every(w => counts.has(w));
}









