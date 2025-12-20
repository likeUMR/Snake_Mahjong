import { CONFIG } from '../../core/config.js';

/**
 * Category 2: Yaku (Add-ons / Bonus Patterns)
 * These are only checked if a win shape is already confirmed.
 */

export function checkYaku(tiles) {
    const yakuList = [];
    
    // Prepare helpers
    const counts = new Map();
    const suits = new Set();
    let hasHonors = false;
    let hasTerminals = false; // 1, 9
    let hasSimples = false; // 2-8
    
    for (const tile of tiles) {
        const weight = tile.getSortWeight();
        const value = tile.value;
        const type = tile.type;
        
        counts.set(weight, (counts.get(weight) || 0) + 1);
        
        if (type === CONFIG.MAHJONG_TYPES.WAN || type === CONFIG.MAHJONG_TYPES.TIAO || type === CONFIG.MAHJONG_TYPES.BING) {
            suits.add(type);
            if (value === 1 || value === 9) hasTerminals = true;
            else hasSimples = true;
        } else {
            hasHonors = true;
        }
    }

    // 1. Tanyao (All Simples) - No 1, 9, or honors
    if (!hasTerminals && !hasHonors) {
        yakuList.push({ name: '断幺九', score: 1 });
    }

    // 2. Chinitsu / Honitsu (Flush)
    if (suits.size === 1) {
        if (!hasHonors) {
            yakuList.push({ name: '清一色', score: 6 });
        } else {
            yakuList.push({ name: '混一色', score: 3 });
        }
    } else if (suits.size === 0 && hasHonors) {
        yakuList.push({ name: '字一色', score: 13 });
    }

    // 3. Toitoi (All Pungs) - Hand consists only of triplets/quads and one pair
    // Note: This is easy to check via counts
    let pairCount = 0;
    let tripletCount = 0;
    for (const count of counts.values()) {
        if (count === 2) pairCount++;
        else if (count >= 3) tripletCount++;
    }
    // For Standard shape (3n+2), Toitoi means exactly 1 pair and the rest are triplets
    if (pairCount === 1 && (pairCount + tripletCount === counts.size)) {
        yakuList.push({ name: '对对胡', score: 2 });
    }

    // 4. Terminals & Honors
    if (!hasSimples) {
        if (hasHonors && hasTerminals) {
            yakuList.push({ name: '混老头', score: 2 });
        } else if (!hasHonors && hasTerminals) {
            yakuList.push({ name: '清幺九', score: 13 });
        }
    }

    // 5. Dragons (Sangen)
    const dragonWeights = [501, 502, 503]; // White, Fa, Chun
    let dragonTriplets = 0;
    let dragonPairs = 0;
    dragonWeights.forEach(w => {
        const c = counts.get(w) || 0;
        if (c >= 3) dragonTriplets++;
        else if (c === 2) dragonPairs++;
    });
    if (dragonTriplets === 3) yakuList.push({ name: '大三元', score: 13 });
    else if (dragonTriplets === 2 && dragonPairs === 1) yakuList.push({ name: '小三元', score: 4 });

    // 6. Winds (Suushii)
    const windWeights = [401, 402, 403, 404]; // E, S, W, N
    let windTriplets = 0;
    let windPairs = 0;
    windWeights.forEach(w => {
        const c = counts.get(w) || 0;
        if (c >= 3) windTriplets++;
        else if (c === 2) windPairs++;
    });
    if (windTriplets === 4) yakuList.push({ name: '大四喜', score: 13 });
    else if (windTriplets === 3 && windPairs === 1) yakuList.push({ name: '小四喜', score: 13 });

    return yakuList;
}

