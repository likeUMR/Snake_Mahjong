import { CONFIG } from '../core/config.js';

/**
 * 预测性碰撞检测逻辑
 */

/**
 * 检查蛇 A 在移动到 nextHead 时是否会与 allSnakes 中的任何蛇发生碰撞
 * @returns {null | {type: 'head'|'body', target: Snake, bodyIndex?: number}}
 */
export function checkPotentialCollision(snakeA, nextHead, allSnakes) {
    // 如果 A 处于虚化状态，不主动触发碰撞
    if (snakeA.isGhost) return null;

    for (const snakeB of allSnakes) {
        // 如果 B 处于虚化状态，A 无法撞到 B
        if (snakeB.isGhost) continue;

        // 1. 检查蛇头对撞 (Head-to-head)
        const headB = snakeB.body[0];
        if (snakeA !== snakeB) {
            if (nextHead.x === headB.x && nextHead.y === headB.y) {
                return { type: 'head', target: snakeB };
            }
        }

        // 2. 检查撞到身体 (Head-to-body)
        // 注意：Phase 5 规定蛇头撞到对方身体才算碰撞
        // 如果是自己的身体，通常游戏不允许掉头（已在输入/AI层限制），但也应检查
        // 实际上 Phase 5 说了：“当身体接触的时候，不认为发生了碰撞”，即蛇头撞身体才算。
        // 这里遍历 snakeB 的所有身体节（排除它自己的头，头在上面判断过了）
        for (let i = 1; i < snakeB.body.length; i++) {
            const partB = snakeB.body[i];
            if (nextHead.x === partB.x && nextHead.y === partB.y) {
                // 撞到了身体
                return { type: 'body', target: snakeB, bodyIndex: i };
            }
        }
    }
    return null;
}
