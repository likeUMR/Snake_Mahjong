import { CONFIG } from '../core/config.js';
import { canKong, canPung, canChow, recommendDiscardTile, getRobberyAction } from '../logic/mahjongLogic.js';

export const AI_STATE = {
    WANDER: 'wander',
    FORAGE: 'forage',
    CHASE: 'chase',
    ESCAPE: 'escape'
};

export class AIController {
    constructor(snake, label) {
        this.snake = snake;
        this.label = label; // { text, color }
        this.state = AI_STATE.WANDER;
        this.stateTimer = 0;
        this.target = null; // Can be a food object or a body part object {x, y, tile}
        
        this.aiTurnTimer = 0;
        this.aiTurnInterval = this.getRandomAIInterval();
    }

    getRandomAIInterval() {
        return CONFIG.AI_MOVE_INTERVAL_MIN + Math.random() * (CONFIG.AI_MOVE_INTERVAL_MAX - CONFIG.AI_MOVE_INTERVAL_MIN);
    }

    checkAutoDiscard() {
        const mahjongCount = this.snake.tiles.filter(t => t !== null).length;
        // 当达到满牌上限时，自动弃掉一张最优牌
        if (mahjongCount >= this.snake.getMaxTiles()) {
            const discardIndex = recommendDiscardTile(this.snake.tiles);
            if (discardIndex !== -1) {
                const discardedTile = this.snake.tiles.filter(t => t !== null)[discardIndex];
                if (discardedTile) {
                    console.log(`[AI Debug] ${this.label.text} 满牌，自动弃牌: ${discardedTile.value}${discardedTile.type}`);
                }
                this.snake.discardTile(discardIndex);
            }
        }
    }

    update(deltaTime, allSnakes, allFoods, game) {
        if (this.snake.isStunned) return;

        // 开发阶段 10：AI 弃牌逻辑
        this.checkAutoDiscard();

        this.stateTimer += deltaTime;

        // 1. 状态逻辑更新 (决定当前处于哪个状态)
        this.handleState(deltaTime, allSnakes, allFoods, game);

        // 2. 转向逻辑
        if (this.state === AI_STATE.WANDER) {
            // 游走状态：继承计时器，到点才换向
            this.aiTurnTimer += deltaTime;
            if (this.aiTurnTimer >= this.aiTurnInterval) {
                this.aiTurnTimer = 0;
                this.aiTurnInterval = this.getRandomAIInterval();
                this.executeMovement();
            }
        } else {
            // 非游走状态（觅食、追逐、逃跑）：
            // 每一帧都执行移动计算，以实现更灵敏的追踪效果
            // 此时 aiTurnTimer 不会增加，实现了离开游走状态时“暂停”计时器的效果
            this.executeMovement();
        }
        
        // 即将撞墙检测 (Edge avoidance)
        const head = this.snake.body[0];
        const nextX = head.x + this.snake.direction.x;
        const nextY = head.y + this.snake.direction.y;
        
        if (nextX < 0 || nextX >= CONFIG.SCENE_GRID_WIDTH || 
            nextY < 0 || nextY >= CONFIG.SCENE_GRID_HEIGHT) {
            this.makeAIRandomMove();
        }
    }

    handleState(deltaTime, allSnakes, allFoods, game) {
        const oldState = this.state;
        switch (this.state) {
            case AI_STATE.WANDER:
                if (this.stateTimer >= CONFIG.AI_STATE_WANDER_TIME) {
                    this.stateTimer = 0;
                    this.evaluateState(allSnakes, allFoods, game);
                }
                break;
            case AI_STATE.CHASE:
                if (this.stateTimer >= CONFIG.AI_STATE_CHASE_TIME || !this.isTargetValid(allSnakes, allFoods)) {
                    this.state = AI_STATE.WANDER;
                    this.stateTimer = 0;
                    this.target = null;
                }
                break;
            case AI_STATE.ESCAPE:
                if (this.stateTimer >= CONFIG.AI_STATE_ESCAPE_TIME || !this.isTargetValid(allSnakes, allFoods)) {
                    this.state = AI_STATE.WANDER;
                    this.stateTimer = 0;
                    this.target = null;
                }
                break;
            case AI_STATE.FORAGE:
                // 觅食状态在吃到目标或目标消失后退回游走
                if (!this.isTargetValid(allSnakes, allFoods)) {
                    this.state = AI_STATE.WANDER;
                    this.stateTimer = 0;
                    this.target = null;
                }
                break;
        }
        if (oldState !== this.state) {
            console.log(`[AI Debug] ${this.label.text}: ${oldState} -> ${this.state}`);
        }
    }

    evaluateState(allSnakes, allFoods, game) {
        const head = this.snake.body[0];

        // 1. 检查视野内是否有可掠夺的目标 (Chase)
        let closestChase = null;
        let minChaseDist = Infinity;

        for (const other of allSnakes) {
            if (other === this.snake || other.isGhost) continue;
            
            // 检查每节身体
            for (let i = 1; i < other.body.length; i++) {
                const part = other.body[i];
                const dist = this.getDist(head, part);
                if (dist <= CONFIG.AI_FOV_RADIUS) {
                    const tile = other.tiles[i];
                    if (!tile || tile.isIron) continue;

                    // 判定自己是否能吃碰杠对方的这张牌
                    const isAttackerFull = this.snake.tiles.filter(t => t !== null).length >= this.snake.getMaxTiles();
                    const isShangJia = game.checkIsShangJia(this.snake, other);
                    const action = getRobberyAction(this.snake.tiles, tile, isShangJia, isAttackerFull);
                    let canRob = !!action;

                    if (canRob && dist < minChaseDist) {
                        minChaseDist = dist;
                        closestChase = { type: 'body', snake: other, index: i, x: part.x, y: part.y };
                    }
                }
            }
        }

        if (closestChase) {
            this.state = AI_STATE.CHASE;
            this.target = closestChase;
            this.stateTimer = 0;
            console.log(`[AI Debug] ${this.label.text} 锁定追逐目标: ${closestChase.snake.color} 第 ${closestChase.index} 节牌`);
            return;
        }

        // 2. 检查视野内是否有可以掠夺自己的目标 (Escape)
        let closestEscape = null;
        let minEscapeDist = Infinity;

        for (const other of allSnakes) {
            if (other === this.snake || other.isGhost) continue;
            
            // 检查自己的每一节非铁牌身体是否会被对方掠夺
            for (let i = 1; i < this.snake.body.length; i++) {
                const myPart = this.snake.body[i];
                const myTile = this.snake.tiles[i];
                if (!myTile || myTile.isIron) continue;

                const distToOtherHead = this.getDist(other.body[0], myPart);
                if (distToOtherHead <= CONFIG.AI_FOV_RADIUS) {
                    const isOtherFull = other.tiles.filter(t => t !== null).length >= other.getMaxTiles();
                    const isOtherShangJia = game.checkIsShangJia(other, this.snake);
                    const action = getRobberyAction(other.tiles, myTile, isOtherShangJia, isOtherFull);
                    let canBeRobbed = !!action;

                    if (canBeRobbed) {
                        const distToMe = this.getDist(head, other.body[0]);
                        if (distToMe < minEscapeDist) {
                            minEscapeDist = distToMe;
                            closestEscape = { type: 'snake', snake: other, x: other.body[0].x, y: other.body[0].y };
                        }
                    }
                }
            }
        }

        if (closestEscape) {
            this.state = AI_STATE.ESCAPE;
            this.target = closestEscape;
            this.stateTimer = 0;
            console.log(`[AI Debug] ${this.label.text} 发现威胁，逃离: ${closestEscape.snake.color}`);
            return;
        }

        // 3. 检查视野内是否有食物 (Forage)
        let closestFood = null;
        let minFoodDist = Infinity;

        for (const food of allFoods) {
            const dist = this.getDist(head, { x: food.gridX, y: food.gridY });
            if (dist <= CONFIG.AI_FOV_RADIUS && dist < minFoodDist) {
                minFoodDist = dist;
                closestFood = food;
            }
        }

        if (closestFood) {
            this.state = AI_STATE.FORAGE;
            this.target = closestFood;
            this.stateTimer = 0;
            console.log(`[AI Debug] ${this.label.text} 前往觅食: ${closestFood.tile.value}${closestFood.tile.type}`);
            return;
        }

        // 维持游走
        this.state = AI_STATE.WANDER;
    }

    isTargetValid(allSnakes, allFoods) {
        if (!this.target) return false;
        
        if (this.state === AI_STATE.FORAGE) {
            return allFoods.includes(this.target);
        }
        
        if (this.state === AI_STATE.CHASE) {
            const s = this.target.snake;
            if (!allSnakes.includes(s) || s.isGhost) return false;
            // 更新目标坐标（目标是移动的）
            const part = s.body[this.target.index];
            if (!part) return false;
            this.target.x = part.x;
            this.target.y = part.y;
            return true;
        }

        if (this.state === AI_STATE.ESCAPE) {
            const s = this.target.snake;
            if (!allSnakes.includes(s) || s.isGhost) return false;
            // 更新目标坐标
            this.target.x = s.body[0].x;
            this.target.y = s.body[0].y;
            return true;
        }

        return false;
    }

    executeMovement() {
        if (this.state === AI_STATE.WANDER) {
            this.makeAIRandomMove();
        } else if (this.state === AI_STATE.CHASE || this.state === AI_STATE.FORAGE) {
            const targetPos = this.state === AI_STATE.FORAGE ? 
                { x: this.target.gridX, y: this.target.gridY } : 
                { x: this.target.x, y: this.target.y };
            this.moveTowards(targetPos);
        } else if (this.state === AI_STATE.ESCAPE) {
            this.moveAwayFrom({ x: this.target.x, y: this.target.y });
        }
    }

    moveTowards(pos) {
        const head = this.snake.body[0];
        // 考虑网格循环的最短位移
        let dx = pos.x - head.x;
        let dy = pos.y - head.y;

        if (Math.abs(dx) > CONFIG.SCENE_GRID_WIDTH / 2) {
            dx = dx > 0 ? dx - CONFIG.SCENE_GRID_WIDTH : dx + CONFIG.SCENE_GRID_WIDTH;
        }
        if (Math.abs(dy) > CONFIG.SCENE_GRID_HEIGHT / 2) {
            dy = dy > 0 ? dy - CONFIG.SCENE_GRID_HEIGHT : dy + CONFIG.SCENE_GRID_HEIGHT;
        }

        const possibleDirs = [];
        if (dx !== 0) possibleDirs.push({ x: dx > 0 ? 1 : -1, y: 0 });
        if (dy !== 0) possibleDirs.push({ x: 0, y: dy > 0 ? 1 : -1 });

        // 过滤掉掉头方向
        const validDirs = possibleDirs.filter(d => {
            return !(d.x === -this.snake.direction.x && d.y === -this.snake.direction.y);
        });

        if (validDirs.length > 0) {
            this.snake.nextDirection = validDirs[Math.floor(Math.random() * validDirs.length)];
        } else {
            this.makeAIRandomMove();
        }
    }

    moveAwayFrom(pos) {
        const head = this.snake.body[0];
        // 逃跑也需要考虑网格循环
        let dx = head.x - pos.x;
        let dy = head.y - pos.y;

        if (Math.abs(dx) > CONFIG.SCENE_GRID_WIDTH / 2) {
            dx = dx > 0 ? dx - CONFIG.SCENE_GRID_WIDTH : dx + CONFIG.SCENE_GRID_WIDTH;
        }
        if (Math.abs(dy) > CONFIG.SCENE_GRID_HEIGHT / 2) {
            dy = dy > 0 ? dy - CONFIG.SCENE_GRID_HEIGHT : dy + CONFIG.SCENE_GRID_HEIGHT;
        }

        const possibleDirs = [];
        if (dx !== 0) possibleDirs.push({ x: dx > 0 ? 1 : -1, y: 0 });
        else possibleDirs.push({ x: 1, y: 0 }, { x: -1, y: 0 });

        if (dy !== 0) possibleDirs.push({ x: 0, y: dy > 0 ? 1 : -1 });
        else possibleDirs.push({ x: 0, y: 1 }, { x: 0, y: -1 });

        const validDirs = possibleDirs.filter(d => {
            return !(d.x === -this.snake.direction.x && d.y === -this.snake.direction.y);
        });

        if (validDirs.length > 0) {
            this.snake.nextDirection = validDirs[Math.floor(Math.random() * validDirs.length)];
        } else {
            this.makeAIRandomMove();
        }
    }

    makeAIRandomMove() {
        const directions = [
            { x: 0, y: -1 }, // Up
            { x: 0, y: 1 },  // Down
            { x: -1, y: 0 }, // Left
            { x: 1, y: 0 }   // Right
        ];

        const validDirections = directions.filter(d => {
            return !(d.x === -this.snake.direction.x && d.y === -this.snake.direction.y);
        });

        const newDir = validDirections[Math.floor(Math.random() * validDirections.length)];
        this.snake.nextDirection = newDir;
    }

    getDist(p1, p2) {
        let dx = Math.abs(p1.x - p2.x);
        let dy = Math.abs(p1.y - p2.y);
        if (dx > CONFIG.SCENE_GRID_WIDTH / 2) dx = CONFIG.SCENE_GRID_WIDTH - dx;
        if (dy > CONFIG.SCENE_GRID_HEIGHT / 2) dy = CONFIG.SCENE_GRID_HEIGHT - dy;
        return Math.sqrt(dx * dx + dy * dy);
    }

    drawLabel(ctx) {
        if (this.label) {
            const head = this.snake.body[0];
            const centerX = head.x * CONFIG.TILE_WIDTH + CONFIG.TILE_WIDTH / 2;
            const centerY = head.y * CONFIG.TILE_HEIGHT + CONFIG.TILE_HEIGHT / 2;
            const labelY = head.y * CONFIG.TILE_HEIGHT - (CONFIG.LABEL_FLOAT_HEIGHT * CONFIG.TILE_HEIGHT);

            // 1. 绘制称号 (蛇头上方)
            ctx.fillStyle = this.label.color || 'white';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(this.label.text, centerX, labelY);

            // 2. 调试显示状态 (完全重叠在蛇头中心数字位置)
            const stateNames = {
                'wander': '游走',
                'forage': '觅食',
                'chase': '追逐',
                'escape': '逃跑'
            };
            ctx.fillStyle = '#f1c40f'; // 使用黄色确保在白色数字之上可见
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            // ctx.fillText(stateNames[this.state] || this.state, centerX, centerY);
            ctx.fillText("DEBUG:" + (stateNames[this.state] || this.state || "NULL"), centerX, centerY);
        }
    }
}
