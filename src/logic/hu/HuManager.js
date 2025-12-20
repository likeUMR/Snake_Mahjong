import { checkStandard, checkSevenPairs, checkThirteenOrphans } from './BasicShapes.js';
import { checkYaku } from './YakuChecker.js';

/**
 * Orchestrates the two-tier Hu detection system.
 * Category 1: Check basic shapes first.
 * Category 2: If Category 1 matches, check for Yaku bonuses.
 */
export function evaluateHu(tiles) {
    if (!tiles || tiles.length < 2) return null;

    const validTiles = tiles.filter(t => t !== null);
    
    let baseResult = null;

    // Category 1: Check basic shapes in order of priority/rarity
    if (checkThirteenOrphans(validTiles)) {
        baseResult = { name: '国士无双', score: 13 };
    } else if (checkSevenPairs(validTiles)) {
        baseResult = { name: '七对子', score: 2 };
    } else if (checkStandard(validTiles)) {
        baseResult = { name: '平胡', score: 1 };
    }

    if (!baseResult) return null;

    // Category 2: Check for Yaku patterns
    const bonusYaku = checkYaku(validTiles);
    
    // Combine patterns
    const patterns = [baseResult.name];
    let totalScore = baseResult.score;

    bonusYaku.forEach(y => {
        // Avoid duplicate names if baseResult already covers it (though unlikely with these categories)
        if (!patterns.includes(y.name)) {
            patterns.push(y.name);
            totalScore += y.score;
        }
    });

    return {
        isWin: true,
        patterns: patterns,
        score: totalScore
    };
}









