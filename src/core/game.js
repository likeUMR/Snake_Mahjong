import { CONFIG } from './config.js';
import { Snake } from '../entities/snake.js';
import { Food } from '../entities/food.js';
import { DiscardUI } from '../ui/ui.js';
import { getSafeRandomPosition } from './utils.js';
import { checkPotentialCollision } from '../logic/collisionLogic.js';
import { AIController } from '../ai/AIController.js';
import { canHu, getRobberyAction, findBestRobberyFromHand } from '../logic/mahjongLogic.js';

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.snakes = [];
        this.aiControllers = [];
        this.effects = []; // 暂时的特效文字 [{text, x, y, life}]
        
        const playerPos = getSafeRandomPosition(this.snakes);
        this.snake = new Snake(playerPos.x, playerPos.y, '#3498db');
        this.snakes.push(this.snake);
        
        const aiConfigs = [
            { label: CONFIG.AI_LABELS.XIA_JIA },
            { label: CONFIG.AI_LABELS.DUI_JIA },
            { label: CONFIG.AI_LABELS.SHANG_JIA }
        ];

        aiConfigs.forEach(conf => {
            const pos = getSafeRandomPosition(this.snakes);
            const aiSnake = new Snake(pos.x, pos.y, '#95a5a6');
            this.snakes.push(aiSnake);
            this.aiControllers.push(new AIController(aiSnake, conf.label));
        });

        this.foods = [];
        this.cameraX = 0;
        this.cameraY = 0;
        this.scale = 1;
        this.isGameOver = false;
        this.winner = null;
        this.discardUI = new DiscardUI();
        
        this.lastTime = 0;
        
        window.addEventListener('keydown', (e) => this.snake.handleInput(e.key));
        window.addEventListener('resize', () => this.resize());
        this.canvas.addEventListener('mousedown', (e) => {
            if (this.isGameOver) return;
            this.discardUI.handleMouseDown(e, this.canvas, (index) => {
                this.snake.discardTile(index);
            });
        });
        
        this.resize();
        this.spawnFood();
        
        const head = this.snake.body[0];
        this.cameraX = head.x * CONFIG.TILE_WIDTH + CONFIG.TILE_WIDTH / 2;
        this.cameraY = head.y * CONFIG.TILE_HEIGHT + CONFIG.TILE_HEIGHT / 2;
        
        requestAnimationFrame((time) => this.loop(time));
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.scale = this.canvas.height / (CONFIG.CAMERA_VERTICAL_FOV * CONFIG.TILE_HEIGHT);
    }

    spawnFood() {
        while (this.foods.length < CONFIG.MAX_FOOD_COUNT) {
            const x = Math.floor(Math.random() * CONFIG.SCENE_GRID_WIDTH);
            const y = Math.floor(Math.random() * CONFIG.SCENE_GRID_HEIGHT);
            const onSnake = this.snakes.some(snake => 
                snake.body.some(p => p.x === x && p.y === y)
            );
            const onFood = this.foods.some(f => f.gridX === x && f.gridY === f.gridY && f.gridX === x && f.gridY === y);
            if (!onSnake && !onFood) {
                this.foods.push(new Food(x, y));
            }
        }
    }

    spawnEffect(text, gridX, gridY) {
        this.effects.push({
            text: text,
            x: gridX * CONFIG.TILE_WIDTH + CONFIG.TILE_WIDTH / 2,
            y: gridY * CONFIG.TILE_HEIGHT,
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

    /**
     * 计算并更新所有蛇身体中可以被真人玩家吃碰杠的牌的高亮状态
     */
    updateHighlights() {
        this.snakes.forEach(s => s.highlights = {}); // 清除旧高亮

        this.snakes.forEach(targetSnake => {
            if (targetSnake === this.snake || targetSnake.isGhost) return;

            const isShangJia = this.checkIsShangJia(this.snake, targetSnake);
            
            for (let i = 1; i < targetSnake.tiles.length; i++) {
                const tile = targetSnake.tiles[i];
                // 使用统一判定入口
                const action = getRobberyAction(this.snake.tiles, tile, isShangJia);
                
                if (action) {
                    if (action.type === 'kong') targetSnake.highlights[i] = CONFIG.COLOR_KONG;
                    else if (action.type === 'pung') targetSnake.highlights[i] = CONFIG.COLOR_PUNG;
                    else if (action.type === 'chow') targetSnake.highlights[i] = CONFIG.COLOR_CHOW;
                }
            }
        });
    }

    update(time) {
        if (this.isGameOver) return;
        const deltaTime = time - this.lastTime;
        this.lastTime = time;

        // 更新 AI
        this.aiControllers.forEach(controller => controller.update(deltaTime, this.snakes, this.foods, this));

        // 更新特效生命周期
        this.effects = this.effects.filter(e => {
            e.life -= deltaTime;
            e.y -= 0.5; // 文字向上漂浮
            return e.life > 0;
        });

        // 顺序处理移动
        let anySnakeMoved = false;
        this.snakes.forEach(snake => {
            if (snake.willMove(deltaTime)) {
                const nextHead = snake.getPotentialHead();
                const collision = checkPotentialCollision(snake, nextHead, this.snakes);

                if (collision) {
                    if (collision.type === 'head') {
                        snake.stun();
                        snake.forceTurn();
                        collision.target.stun();
                        collision.target.forceTurn();
                    } else if (collision.type === 'body') {
                        if (snake === collision.target) {
                            snake.stun(true);
                            snake.forceTurn();
                        } else {
                            const targetSnake = collision.target;
                            const isShangJia = this.checkIsShangJia(snake, targetSnake);

                            // 核心修改：不再只检查 collision.bodyIndex 对应的牌
                            // 而是扫描对方全手牌，寻找符合“杠 > 碰 > 吃”优先级的第一个动作
                            const action = findBestRobberyFromHand(snake.tiles, targetSnake.tiles, isShangJia);

                            if (action) {
                                // 掠夺成功逻辑：根据 action.tileIndex 移除对应的牌
                                const robbedTile = targetSnake.loseTile(action.tileIndex);
                                if (robbedTile) {
                                    snake.grow(robbedTile);
                                    snake.hardenTiles([...action.involvedTiles, robbedTile], action.isKong);
                                    targetSnake.enterGhostMode();
                                    snake.executeMove(nextHead);
                                    anySnakeMoved = true;
                                    this.spawnEffect(action.effectText, nextHead.x, nextHead.y);
                                } else {
                                    snake.stun();
                                    snake.forceTurn();
                                }
                            } else {
                                // 对方身上没有任何牌可以被我掠夺，判定撞击失败，我方眩晕
                                snake.stun();
                                snake.forceTurn();
                            }
                        }
                    }
                } else {
                    snake.executeMove(nextHead);
                    anySnakeMoved = true;
                }
                
                if (snake.isWin) {
                    this.isGameOver = true;
                    this.winner = snake;
                }
            }
        });
        
        if (anySnakeMoved && !this.isGameOver) {
            this.checkFoodCollisions();
            this.spawnFood();
            this.updateHighlights(); // 牌库变化，更新提示
        }
        
        this.updateCamera();
    }

    checkFoodCollisions() {
        this.snakes.forEach(snake => {
            const head = snake.body[0];
            const foodIndex = this.foods.findIndex(f => f.gridX === head.x && f.gridY === head.y);
            if (foodIndex !== -1) {
                const food = this.foods[foodIndex];
                snake.grow(food.tile);
                this.foods.splice(foodIndex, 1);
            }
        });
    }

    updateCamera() {
        const head = this.snake.body[0];
        const targetX = head.x * CONFIG.TILE_WIDTH + CONFIG.TILE_WIDTH / 2;
        const targetY = head.y * CONFIG.TILE_HEIGHT + CONFIG.TILE_HEIGHT / 2;
        this.cameraX += (targetX - this.cameraX) * CONFIG.CAMERA_FOLLOW_SPEED;
        this.cameraY += (targetY - this.cameraY) * CONFIG.CAMERA_FOLLOW_SPEED;
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();
        this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.scale(this.scale, this.scale);
        this.ctx.translate(-this.cameraX, -this.cameraY);
        
        this.drawGrid();
        this.foods.forEach(food => food.draw(this.ctx, 0, 0));
        this.snakes.forEach(snake => snake.draw(this.ctx, 0, 0));
        
        // 绘制特效文字
        this.effects.forEach(e => {
            this.ctx.fillStyle = '#f1c40f';
            this.ctx.font = 'bold 20px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.globalAlpha = e.life / 1000;
            this.ctx.fillText(e.text, e.x, e.y);
            this.ctx.globalAlpha = 1.0;
        });

        // 最后统一绘制 AI 标签和眩晕文字，确保在最上层
        this.aiControllers.forEach(controller => controller.drawLabel(this.ctx));
        this.snakes.forEach(snake => snake.drawStunLabel(this.ctx, 0, 0));

        this.ctx.restore();
        
        this.discardUI.draw(this.ctx, this.canvas, this.snake.tiles);
        
        if (this.isGameOver) {
            if (this.winner === this.snake) this.drawVictory();
            else {
                const winnerController = this.aiControllers.find(c => c.snake === this.winner);
                this.drawDefeat(winnerController ? winnerController.label : null);
            }
        }
    }

    drawVictory() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#f1c40f';
        this.ctx.font = 'bold 60px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('游戏胜利 (VICTORY)', this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.font = '24px Arial';
        this.ctx.fillText('你胡牌了！', this.canvas.width / 2, this.canvas.height / 2 + 60);
    }

    drawDefeat(winnerLabel) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#e74c3c';
        this.ctx.font = 'bold 60px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        const labelText = winnerLabel ? winnerLabel.text : 'AI';
        this.ctx.fillText('游戏失败 (DEFEAT)', this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.font = '24px Arial';
        this.ctx.fillText(`${labelText} 胡牌了！`, this.canvas.width / 2, this.canvas.height / 2 + 60);
    }

    drawGrid() {
        this.ctx.strokeStyle = '#34495e';
        this.ctx.lineWidth = 1 / this.scale;
        for (let i = 0; i <= CONFIG.SCENE_GRID_WIDTH; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(i * CONFIG.TILE_WIDTH, 0);
            this.ctx.lineTo(i * CONFIG.TILE_WIDTH, CONFIG.SCENE_GRID_HEIGHT * CONFIG.TILE_HEIGHT);
            this.ctx.stroke();
        }
        for (let j = 0; j <= CONFIG.SCENE_GRID_HEIGHT; j++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, j * CONFIG.TILE_HEIGHT);
            this.ctx.lineTo(CONFIG.SCENE_GRID_WIDTH * CONFIG.TILE_WIDTH, j * CONFIG.TILE_HEIGHT);
            this.ctx.stroke();
        }
    }

    loop(time) {
        this.update(time);
        this.draw();
        requestAnimationFrame((t) => this.loop(t));
    }
}

new Game();
