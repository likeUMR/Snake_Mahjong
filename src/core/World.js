import { CONFIG } from './config.js';
import { Snake } from '../entities/snake.js';
import { Food } from '../entities/food.js';
import { getSafeRandomPosition, storageManager } from './utils.js';
import { checkPotentialCollision } from '../logic/collisionLogic.js';
import { AIController } from '../ai/AIController.js';
import { getRobberyAction, findBestRobberyFromHand } from '../logic/mahjongLogic.js';
import { audioManager } from './audio.js';
import { victoryEffect } from '../ui/VictoryEffect.js';

export class World {
    constructor() {
        this.snakes = [];
        this.playerSnake = null;
        this.aiControllers = [];
        this.foods = [];
        this.effects = [];
        this.isGameOver = false;
        this.winner = null;
        this.isNewRecord = false;
    }

    setupGameObjects() {
        this.reset();
        const playerPos = getSafeRandomPosition(this.snakes);
        this.playerSnake = new Snake(playerPos.x, playerPos.y, '#3498db', 0); // Role 0: Player
        this.snakes.push(this.playerSnake);
        
        const aiConfigs = [
            { label: CONFIG.AI_LABELS.XIA_JIA },
            { label: CONFIG.AI_LABELS.DUI_JIA },
            { label: CONFIG.AI_LABELS.SHANG_JIA }
        ];

        aiConfigs.forEach((conf, index) => {
            const pos = getSafeRandomPosition(this.snakes);
            const aiSnake = new Snake(pos.x, pos.y, '#95a5a6', index + 1); // Role 1, 2, 3
            this.snakes.push(aiSnake);
            this.aiControllers.push(new AIController(aiSnake, conf.label));
        });

        audioManager.setListener(this.playerSnake); 
        this.spawnFood();
    }

    reset() {
        this.snakes = [];
        this.playerSnake = null;
        this.aiControllers = [];
        this.foods = [];
        this.effects = [];
        this.isGameOver = false;
        this.winner = null;
        this.isNewRecord = false;
    }

    spawnFood() {
        while (this.foods.length < CONFIG.MAX_FOOD_COUNT) {
            const x = Math.floor(Math.random() * CONFIG.SCENE_GRID_WIDTH);
            const y = Math.floor(Math.random() * CONFIG.SCENE_GRID_HEIGHT);
            const onSnake = this.snakes.some(snake => 
                snake.body.some(p => p.x === x && p.y === y)
            );
            const onFood = this.foods.some(f => f.gridX === x && f.gridY === y);
            if (!onSnake && !onFood) {
                this.foods.push(new Food(x, y));
            }
        }
    }

    spawnEffect(text, gridX, gridY, color = '#f1c40f') {
        this.effects.push({
            text: text,
            x: gridX * CONFIG.TILE_WIDTH + CONFIG.TILE_WIDTH / 2,
            y: gridY * CONFIG.TILE_HEIGHT,
            color: color,
            life: 1000 // 持续 1s
        });
    }

    checkIsShangJia(snakeA, snakeB) {
        const indexA = this.snakes.indexOf(snakeA);
        const indexB = this.snakes.indexOf(snakeB);
        if (indexA === -1 || indexB === -1) return false;
        const shangJiaIndex = (indexA - 1 + this.snakes.length) % this.snakes.length;
        return indexB === shangJiaIndex;
    }

    getWrappedHead(head, dir) {
        return { x: head.x + dir.x, y: head.y + dir.y };
    }

    updateHighlights() {
        if (!this.playerSnake) return;
        this.snakes.forEach(s => s.highlights = {}); // 清除旧高亮

        this.snakes.forEach(targetSnake => {
            if (targetSnake === this.playerSnake || targetSnake.isGhost) return;

            const isShangJia = this.checkIsShangJia(this.playerSnake, targetSnake);
            const isAttackerFull = this.playerSnake.tiles.filter(t => t !== null).length >= this.playerSnake.getMaxTiles();
            const attackerMaxTiles = this.playerSnake.getMaxTiles();
            
            for (let i = 1; i < targetSnake.tiles.length; i++) {
                const tile = targetSnake.tiles[i];
                const action = getRobberyAction(this.playerSnake.tiles, tile, isShangJia, isAttackerFull, attackerMaxTiles);
                
                if (action) {
                    if (action.type === 'hu') targetSnake.highlights[i] = CONFIG.COLOR_HU;
                    else if (action.type === 'kong' || action.type === 'kakan') targetSnake.highlights[i] = CONFIG.COLOR_KONG;
                    else if (action.type === 'pung') targetSnake.highlights[i] = CONFIG.COLOR_PUNG;
                    else if (action.type === 'chow') targetSnake.highlights[i] = CONFIG.COLOR_CHOW;
                }
            }
        });
    }

    update(deltaTime) {
        if (this.isGameOver) return;

        // 更新 AI
        this.aiControllers.forEach(controller => controller.update(deltaTime, this.snakes, this.foods, this));

        // 更新特效生命周期
        this.effects = this.effects.filter(e => {
            e.life -= deltaTime;
            e.y -= 0.5; // 文字向上漂浮
            return e.life > 0;
        });

        this.checkFoodCollisions();
        this.spawnFood();

        let anySnakeMoved = false;
        this.snakes.forEach(snake => {
            if (snake.needsSafeTurn) {
                const head = snake.body[0];
                const d = snake.direction;
                const candidates = [
                    d,                        // 1. 原方向
                    { x: -d.y, y: d.x },      // 2. 右转
                    { x: d.y, y: -d.x }       // 3. 左转
                ];

                let bestDir = null;
                for (const testDir of candidates) {
                    const nextH = this.getWrappedHead(head, testDir);
                    if (!checkPotentialCollision(snake, nextH, this.snakes)) {
                        bestDir = testDir;
                        break;
                    }
                }

                if (!bestDir) {
                    bestDir = candidates[Math.floor(Math.random() * candidates.length)];
                }

                snake.direction = bestDir;
                snake.nextDirection = bestDir;
                snake.needsSafeTurn = false;
            }

            if (snake.willMove(deltaTime)) {
                const nextHead = snake.getPotentialHead();
                const collision = checkPotentialCollision(snake, nextHead, this.snakes);

                if (collision) {
                    if (collision.type === 'head') {
                        snake.stun();
                        collision.target.stun();
                    } else if (collision.type === 'wall') {
                        snake.stun();
                    } else if (collision.type === 'body') {
                        if (snake === collision.target) {
                            snake.stun(true);
                        } else {
                            const targetSnake = collision.target;
                            const isShangJia = this.checkIsShangJia(snake, targetSnake);
                            const isAttackerFull = snake.tiles.filter(t => t !== null).length >= snake.getMaxTiles();
                            const attackerMaxTiles = snake.getMaxTiles();

                            const action = findBestRobberyFromHand(snake.tiles, targetSnake.tiles, isShangJia, isAttackerFull, attackerMaxTiles);

                            if (action) {
                                const robbedTile = targetSnake.loseTile(action.tileIndex);
                                if (robbedTile) {
                                    snake.grow(robbedTile, true);

                                    if (action.type === 'hu') {
                                        snake.isWin = true;
                                        snake.winResult = action.winResult;
                                        snake.playVoice('hu_ron');
                                    } else if (action.type === 'kakan') {
                                        robbedTile.isIron = true;
                                        robbedTile.groupId = action.kakanGroupId;
                                        snake.maxTilesBonus += 1;
                                        snake.playVoice('kakan');
                                        snake.needsSort = true;
                                    } else {
                                        snake.hardenTiles([...action.involvedTiles, robbedTile], action.isKong);
                                        snake.playVoice(action.type);
                                    }

                                    targetSnake.enterGhostMode();
                                    snake.executeMove(nextHead);
                                    anySnakeMoved = true;
                                    
                                    let effectColor = '#f1c40f';
                                    if (action.type === 'hu') {
                                        effectColor = CONFIG.COLOR_HU;
                                    } else if (action.type === 'kong' || action.type === 'kakan') {
                                        effectColor = CONFIG.COLOR_KONG;
                                        snake.score += CONFIG.SCORE_KONG;
                                    } else if (action.type === 'pung') {
                                        effectColor = CONFIG.COLOR_PUNG;
                                        snake.score += CONFIG.SCORE_PUNG;
                                    } else if (action.type === 'chow') {
                                        effectColor = CONFIG.COLOR_CHOW;
                                        snake.score += CONFIG.SCORE_CHOW;
                                    }
                                    
                                    this.spawnEffect(action.effectText, nextHead.x, nextHead.y, effectColor);
                                } else {
                                    snake.stun();
                                }
                            } else {
                                snake.stun();
                            }
                        }
                    }
                } else {
                    snake.executeMove(nextHead);
                    anySnakeMoved = true;
                }
            }

            if (snake.isWin && !this.isGameOver) {
                this.handleWin(snake);
            }
        });
        
        if (anySnakeMoved && !this.isGameOver) {
            this.updateHighlights();
        }
    }

    handleWin(snake) {
        this.isGameOver = true;
        this.winner = snake;
        snake.score += CONFIG.SCORE_HU;
        audioManager.playEndSound(snake === this.playerSnake);
        
        if (snake === this.playerSnake) {
            const result = storageManager.saveRecord(CONFIG.AI_DIFFICULTY, this.playerSnake.score, true);
            this.isNewRecord = result.newHighScore;
            // 触发胜利特效
            victoryEffect.trigger();
        } else {
            this.isNewRecord = false;
        }
    }

    checkFoodCollisions() {
        this.snakes.forEach(snake => {
            const head = snake.body[0];
            const foodIndex = this.foods.findIndex(f => f.gridX === head.x && f.gridY === head.y);
            if (foodIndex !== -1) {
                const food = this.foods[foodIndex];
                const growResult = snake.grow(food.tile);
                
                if (growResult) {
                    if (snake.isWin) {
                        snake.playVoice('hu_tsumo');
                    } else if (growResult.type === 'kong') {
                        this.spawnEffect(growResult.effectText, head.x, head.y, CONFIG.COLOR_KONG);
                        const kongScore = growResult.isConcealed ? CONFIG.SCORE_CONCEALED_KONG : CONFIG.SCORE_KONG;
                        snake.score += kongScore;
                        snake.playVoice('kong');
                    } else {
                        snake.score += CONFIG.SCORE_FOOD;
                        snake.playVoice('eat_food');
                    }
                }
                
                this.foods.splice(foodIndex, 1);
            }
        });
    }
}

