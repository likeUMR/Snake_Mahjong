import { CONFIG } from './config.js';
import { Snake } from '../entities/snake.js';
import { Food } from '../entities/food.js';
import { DiscardUI, TutorialUI, StartScreen } from '../ui/ui.js';
import { getSafeRandomPosition, assetManager } from './utils.js';
import { checkPotentialCollision } from '../logic/collisionLogic.js';
import { AIController } from '../ai/AIController.js';
import { canHu, getRobberyAction, findBestRobberyFromHand } from '../logic/mahjongLogic.js';
import { audioManager } from './audio.js';

const GAME_STATE = {
    LOADING: 'loading',
    START_SCREEN: 'start_screen',
    PLAYING: 'playing',
    GAME_OVER: 'game_over'
};

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.state = GAME_STATE.LOADING;
        this.snakes = [];
        this.aiControllers = [];
        this.effects = []; // 暂时的特效文字 [{text, x, y, life}]
        this.foods = [];   // 修复：初始化食物数组
        
        this.cameraX = (CONFIG.SCENE_GRID_WIDTH * CONFIG.TILE_WIDTH) / 2;
        this.cameraY = (CONFIG.SCENE_GRID_HEIGHT * CONFIG.TILE_HEIGHT) / 2;
        this.scale = 1;    // 修复：初始化缩放
        this.uiScale = 1;  // 修复：初始化 UI 缩放
        
        this.isGameOver = false;
        this.winner = null;
        this.isAssetsLoaded = false; // 新载标志
        this.discardUI = new DiscardUI();
        this.tutorialUI = new TutorialUI();
        this.startScreen = new StartScreen();
        
        this.lastTime = 0;

        // 初始化开始界面动画参数
        const angle = Math.random() * Math.PI * 2;
        this.startScreenCam = {
            x: Math.random() * 1000,
            y: Math.random() * 1000,
            vx: Math.cos(angle),
            vy: Math.sin(angle)
        };
        this.decorationTiles = this.generateDecorationTiles();

        window.addEventListener('keydown', (e) => {
            if (this.state !== GAME_STATE.PLAYING) return;
            audioManager.resumeAudio();
            this.snake.handleInput(e.key);
        });
        window.addEventListener('resize', () => this.resize());
        this.canvas.addEventListener('mousedown', (e) => {
            audioManager.resumeAudio();
            
            if (this.state === GAME_STATE.START_SCREEN) {
                this.startScreen.handleMouseDown(e, this.canvas, (diffId) => {
                    audioManager.playVoice(0, 'click'); // 播放点击音效
                    CONFIG.AI_DIFFICULTY = diffId;
                    this.setupGameObjects(); // 初始化游戏对象
                    this.state = GAME_STATE.PLAYING;
                    audioManager.startBgm(); // 修复：正式进入游戏后再开始背景音乐
                });
                return;
            }

            if (this.state !== GAME_STATE.PLAYING) return;
            if (this.isGameOver) return;

            this.discardUI.handleMouseDown(e, this.canvas, (index) => {
                this.snake.discardTile(index);
            });
        });

        this.resize();
        this.init();
    }

    async init() {
        // 开始循环，显示加载进度
        requestAnimationFrame((time) => this.loop(time));

        // 1. 初始化 BGM 清单 (异步执行，不阻塞游戏启动)
        // 注意：audioManager.initBgm 现在内部会 await BGM 加载
        const bgmPromise = audioManager.initBgm();

        // 2. 并行加载核心资源 (图像和关键音效)
        const assetPromise = assetManager.preloadAll();
        const essentialPromise = audioManager.preloadEssential();

        await Promise.all([
            bgmPromise,
            assetPromise,
            essentialPromise
        ]);

        this.isAssetsLoaded = true;
        this.state = GAME_STATE.START_SCREEN;
    }

    setupGameObjects() {
        const playerPos = getSafeRandomPosition(this.snakes);
        this.snake = new Snake(playerPos.x, playerPos.y, '#3498db', 0); // Role 0: Player
        this.snakes.push(this.snake);
        
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

        audioManager.setListener(this.snake); 
        this.spawnFood();
    }

    generateDecorationTiles() {
        const tiles = [];
        const count = 40; // 装饰牌数量
        const range = 50; 
        for (let i = 0; i < count; i++) {
            tiles.push({
                // 确保坐标是格子的整数倍，从而准确放置在格子中心
                x: Math.floor(Math.random() * range) * CONFIG.TILE_WIDTH,
                y: Math.floor(Math.random() * range) * CONFIG.TILE_HEIGHT
            });
        }
        return tiles;
    }

    updateStartScreenAnim(deltaTime) {
        // 速度单位换算：速度(格/秒) * (毫秒/1000) * 格子像素大小
        const speedX = this.startScreenCam.vx * CONFIG.START_SCREEN_CAM_SPEED * (deltaTime / 1000) * CONFIG.TILE_WIDTH;
        const speedY = this.startScreenCam.vy * CONFIG.START_SCREEN_CAM_SPEED * (deltaTime / 1000) * CONFIG.TILE_HEIGHT;
        
        const wrapWidth = 50 * CONFIG.TILE_WIDTH;
        const wrapHeight = 50 * CONFIG.TILE_HEIGHT;

        const oldX = this.startScreenCam.x;
        const oldY = this.startScreenCam.y;

        // 核心修复：在这里直接对相机坐标取模，防止数值无限增大导致浮点数精度丢失而卡顿
        this.startScreenCam.x = (this.startScreenCam.x + speedX + wrapWidth) % wrapWidth;
        this.startScreenCam.y = (this.startScreenCam.y + speedY + wrapHeight) % wrapHeight;
    }

    drawInfiniteBackground(ctx, width, height) {
        const cam = this.startScreenCam;
        const tw = CONFIG.TILE_WIDTH;
        const th = CONFIG.TILE_HEIGHT;

        // 计算开始界面的独立缩放（基于配置的视野格数）
        const startScreenScale = height / (CONFIG.START_SCREEN_VERTICAL_FOV * th);
        
        ctx.save();
        ctx.scale(startScreenScale, startScreenScale);

        // 将屏幕像素宽高转为逻辑单位
        const logicalW = width / startScreenScale;
        const logicalH = height / startScreenScale;

        // 1. 绘制无限网格
        ctx.strokeStyle = CONFIG.GRID_LINE_COLOR;
        ctx.lineWidth = 1;

        const offsetX = cam.x % tw;
        const offsetY = cam.y % th;

        // 绘制垂直线
        for (let x = -offsetX; x < logicalW + tw; x += tw) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, logicalH);
            ctx.stroke();
        }

        // 绘制水平线
        for (let y = -offsetY; y < logicalH + th; y += th) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(logicalW, y);
            ctx.stroke();
        }

        // 2. 绘制装饰性食物牌 (背面向上)
        const wrapWidth = 50 * tw;
        const wrapHeight = 50 * th;

        ctx.fillStyle = '#1e5a1e';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;

        this.decorationTiles.forEach(tile => {
            // 计算基础绘制坐标
            let drawX = (tile.x - cam.x);
            let drawY = (tile.y - cam.y);

            // 核心修复：利用双重循环（逻辑上 2x2 的块）来处理装饰物在边界消失又出现的情况
            // 简单处理：只需要检查当前点及其在 wrap 附近的镜像点是否在屏幕内
            for (let ox = -wrapWidth; ox <= wrapWidth; ox += wrapWidth) {
                for (let oy = -wrapHeight; oy <= wrapHeight; oy += wrapHeight) {
                    const finalX = drawX + ox;
                    const finalY = drawY + oy;

                    if (finalX > -tw && finalX < logicalW && finalY > -th && finalY < logicalH) {
                        ctx.fillRect(finalX, finalY, tw, th);
                        ctx.strokeRect(finalX, finalY, tw, th);
                    }
                }
            }
        });

        ctx.restore();
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = window.innerWidth * dpr;
        this.canvas.height = window.innerHeight * dpr;
        this.canvas.style.width = window.innerWidth + 'px';
        this.canvas.style.height = window.innerHeight + 'px';
        
        this.ctx.resetTransform();
        this.ctx.scale(dpr, dpr);
        
        this.scale = window.innerHeight / (CONFIG.CAMERA_VERTICAL_FOV * CONFIG.TILE_HEIGHT);
        // 基准值为 4K (2160px)
        this.uiScale = window.innerHeight / 1080;
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

    /**
     * 计算并更新所有蛇身体中可以被真人玩家吃碰杠的牌的高亮状态
     */
    updateHighlights() {
        this.snakes.forEach(s => s.highlights = {}); // 清除旧高亮

        this.snakes.forEach(targetSnake => {
            if (targetSnake === this.snake || targetSnake.isGhost) return;

            const isShangJia = this.checkIsShangJia(this.snake, targetSnake);
            const isAttackerFull = this.snake.tiles.filter(t => t !== null).length >= this.snake.getMaxTiles();
            const attackerMaxTiles = this.snake.getMaxTiles();
            
            for (let i = 1; i < targetSnake.tiles.length; i++) {
                const tile = targetSnake.tiles[i];
                // 使用统一判定入口
                const action = getRobberyAction(this.snake.tiles, tile, isShangJia, isAttackerFull, attackerMaxTiles);
                
                if (action) {
                    if (action.type === 'hu') targetSnake.highlights[i] = CONFIG.COLOR_HU;
                    else if (action.type === 'kong' || action.type === 'kakan') targetSnake.highlights[i] = CONFIG.COLOR_KONG;
                    else if (action.type === 'pung') targetSnake.highlights[i] = CONFIG.COLOR_PUNG;
                    else if (action.type === 'chow') targetSnake.highlights[i] = CONFIG.COLOR_CHOW;
                }
            }
        });
    }

    update(time) {
        const deltaTime = time - this.lastTime;
        this.lastTime = time;

        if (this.state === GAME_STATE.LOADING) {
            return; // 加载中保持静止
        }

        if (this.state === GAME_STATE.START_SCREEN) {
            this.updateStartScreenAnim(deltaTime);
            return;
        }

        if (this.state !== GAME_STATE.PLAYING || this.isGameOver) return;

        // 更新 AI
        this.aiControllers.forEach(controller => controller.update(deltaTime, this.snakes, this.foods, this));

        // 更新特效生命周期
        this.effects = this.effects.filter(e => {
            e.life -= deltaTime;
            e.y -= 0.5; // 文字向上漂浮
            return e.life > 0;
        });

        // 开发阶段 10 优化：先检测食物碰撞，确保在移动前完成 grow 和排序
        this.checkFoodCollisions();
        this.spawnFood();

        // 顺序处理移动
        let anySnakeMoved = false;
        this.snakes.forEach(snake => {
            // 开发阶段 11 补充：眩晕结束后的安全转向逻辑
            if (snake.needsSafeTurn) {
                const head = snake.body[0];
                const d = snake.direction;
                // 候选方向优先级：原方向 > 右转 > 左转
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

                // 如果都不安全，则在三者中随机选一个
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
                        // 撞墙眩晕
                        snake.stun();
                    } else if (collision.type === 'body') {
                        if (snake === collision.target) {
                            snake.stun(true);
                        } else {
                            const targetSnake = collision.target;
                            const isShangJia = this.checkIsShangJia(snake, targetSnake);
                            const isAttackerFull = snake.tiles.filter(t => t !== null).length >= snake.getMaxTiles();
                            const attackerMaxTiles = snake.getMaxTiles();

                            // 核心修改：不再只检查 collision.bodyIndex 对应的牌
                            // 顺次扫描对方全手牌，寻找符合“胡 > 杠 > 碰 > 吃”优先级的第一个动作
                            const action = findBestRobberyFromHand(snake.tiles, targetSnake.tiles, isShangJia, isAttackerFull, attackerMaxTiles);

                            if (action) {
                                // 掠夺成功逻辑：根据 action.tileIndex 移除对应的牌
                                    const robbedTile = targetSnake.loseTile(action.tileIndex);
                                if (robbedTile) {
                                    snake.grow(robbedTile, true);

                                    // 如果是胡牌掠夺，不需要 harden，但需要记录结果
                                    if (action.type === 'hu') {
                                        snake.isWin = true;
                                        snake.winResult = action.winResult;
                                        snake.playVoice('hu_ron');
                                    } else if (action.type === 'kakan') {
                                        // 处理加杠：将掠夺到的牌加入到已有的铁牌组中
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
                                    
                                    // 统一颜色映射
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
                                // 对方身上没有任何牌可以被我掠夺，判定撞击失败，我方眩晕
                                snake.stun();
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
                    snake.score += CONFIG.SCORE_HU;
                    audioManager.playEndSound(snake === this.snake);
                }
            }
        });
        
        if (anySnakeMoved && !this.isGameOver) {
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

    updateCamera() {
        if (!this.snake) return;
        const head = this.snake.body[0];
        const targetX = head.x * CONFIG.TILE_WIDTH + CONFIG.TILE_WIDTH / 2;
        const targetY = head.y * CONFIG.TILE_HEIGHT + CONFIG.TILE_HEIGHT / 2;
        this.cameraX += (targetX - this.cameraX) * CONFIG.CAMERA_FOLLOW_SPEED;
        this.cameraY += (targetY - this.cameraY) * CONFIG.CAMERA_FOLLOW_SPEED;
    }

    draw() {
        const dpr = window.devicePixelRatio || 1;
        const width = this.canvas.width / dpr;
        const height = this.canvas.height / dpr;

        // 1. 绘制底层背景
        if (this.state === GAME_STATE.LOADING || this.state === GAME_STATE.START_SCREEN) {
            // 绘制无限滚动背景
            this.ctx.fillStyle = CONFIG.GRID_OUTSIDE_COLOR;
            this.ctx.fillRect(0, 0, width, height);
            this.drawInfiniteBackground(this.ctx, width, height);
        } else {
            // 绘制真实游戏背景
            this.ctx.fillStyle = CONFIG.GRID_OUTSIDE_COLOR;
            this.ctx.fillRect(0, 0, width, height);

            this.ctx.save();
            this.ctx.translate(width / 2, height / 2);
            this.ctx.scale(this.scale, this.scale);
            this.ctx.translate(-this.cameraX, -this.cameraY);
            
            // 绘制地图背景色
            this.ctx.fillStyle = CONFIG.GRID_INSIDE_COLOR;
            this.ctx.fillRect(0, 0, CONFIG.SCENE_GRID_WIDTH * CONFIG.TILE_WIDTH, CONFIG.SCENE_GRID_HEIGHT * CONFIG.TILE_HEIGHT);

            this.drawGrid();
            this.foods.forEach(food => food.draw(this.ctx, 0, 0));

            // 只有在正式游戏或结束时才绘制蛇和动态文字
            if (this.state === GAME_STATE.PLAYING || this.state === GAME_STATE.GAME_OVER) {
                this.snakes.forEach(snake => snake.draw(this.ctx, 0, 0));
                
                // 绘制特效文字
                this.effects.forEach(e => {
                    this.ctx.fillStyle = e.color || '#f1c40f';
                    this.ctx.font = `bold ${CONFIG.EFFECT_TEXT_SIZE}px Arial`;
                    this.ctx.textAlign = 'center';
                    this.ctx.globalAlpha = e.life / 1000;
                    this.ctx.fillText(e.text, e.x, e.y);
                    this.ctx.globalAlpha = 1.0;
                });

                // 绘制 AI 标签和眩晕文字
                this.aiControllers.forEach(controller => controller.drawLabel(this.ctx));
                this.snakes.forEach(snake => snake.drawStunLabel(this.ctx, 0, 0));
            }

            this.ctx.restore();
        }

        // 2. 绘制 UI 层
        if (this.state === GAME_STATE.LOADING || this.state === GAME_STATE.START_SCREEN) {
            const assetProgress = assetManager.getProgress();
            const audioProgress = audioManager.getProgress();
            const totalProgress = (assetProgress + audioProgress) / 2;
            
            this.startScreen.update(totalProgress, this.isAssetsLoaded);
            this.startScreen.draw(this.ctx, width, height, this.uiScale);
            return;
        }

        this.discardUI.draw(this.ctx, this.canvas, this.snake.tiles, this.uiScale);
        this.tutorialUI.draw(this.ctx, this.uiScale);
        
        this.drawLeaderboard();
        
        if (this.isGameOver) {
            if (this.winner === this.snake) this.drawVictory();
            else {
                const winnerController = this.aiControllers.find(c => c.snake === this.winner);
                this.drawDefeat(winnerController ? winnerController.label : null);
            }
        }
    }

    drawLeaderboard() {
        const dpr = window.devicePixelRatio || 1;
        const logicalWidth = this.canvas.width / dpr;
        const logicalHeight = this.canvas.height / dpr;

        const s = this.uiScale;
        const padding = CONFIG.LEADERBOARD_PADDING * s;
        const width = CONFIG.LEADERBOARD_WIDTH * s;
        const entryHeight = CONFIG.LEADERBOARD_ENTRY_HEIGHT * s;
        const titleHeight = CONFIG.LEADERBOARD_TITLE_HEIGHT * s;
        
        // Sort snakes by score
        const sortedSnakes = [...this.snakes].sort((a, b) => b.score - a.score);
        
        const height = titleHeight + sortedSnakes.length * entryHeight + padding;
        const x = logicalWidth - width - padding;
        const y = padding;

        // Background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, width, height, 10 * s);
        this.ctx.fill();

        // Title
        this.ctx.fillStyle = '#f1c40f';
        this.ctx.font = `bold ${CONFIG.LEADERBOARD_TITLE_FONT_SIZE * s}px Arial`;
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText('排行榜 (Leaderboard)', x + 15 * s, y + 15 * s);

        // Entries
        this.ctx.font = `${CONFIG.LEADERBOARD_ENTRY_FONT_SIZE * s}px Arial`;
        sortedSnakes.forEach((snake, index) => {
            const entryY = y + titleHeight + index * entryHeight + 10 * s;
            
            const charName = CONFIG.AUDIO_CHARACTERS[snake.roleIndex] || 'Unknown';
            
            // Marker for current player
            if (snake === this.snake) {
                this.ctx.fillStyle = '#3498db';
                this.ctx.fillText(`> ${charName} (你)`, x + 15 * s, entryY);
            } else {
                const controller = this.aiControllers.find(c => c.snake === snake);
                this.ctx.fillStyle = controller ? controller.label.color : '#fff';
                this.ctx.fillText(`${index + 1}. ${charName}`, x + 15 * s, entryY);
            }
            
            this.ctx.textAlign = 'right';
            this.ctx.fillStyle = '#fff';
            this.ctx.fillText(snake.score, x + width - 15 * s, entryY);
            this.ctx.textAlign = 'left';
        });
    }

    drawVictory() {
        const dpr = window.devicePixelRatio || 1;
        const logicalWidth = this.canvas.width / dpr;
        const logicalHeight = this.canvas.height / dpr;

        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, logicalWidth, logicalHeight);
        
        const s = this.uiScale;
        const charName = CONFIG.AUDIO_CHARACTERS[this.winner.roleIndex];
        
        this.ctx.fillStyle = '#f1c40f';
        this.ctx.font = `bold ${CONFIG.END_SCREEN_TITLE_SIZE * s}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(`游戏胜利 (VICTORY)`, logicalWidth / 2, logicalHeight / 2 - 120 * s);
        
        this.ctx.font = `${CONFIG.END_SCREEN_SUBTITLE_SIZE * s}px Arial`;
        let winText = `${charName} 胡牌了！`;
        if (this.winner.winResult && this.winner.winResult.patterns) {
            let patterns = [...this.winner.winResult.patterns];
            if (patterns.length > 1) {
                patterns.shift();
            }
            winText += ` [${patterns.join(', ')}]`;
        }
        this.ctx.fillText(winText, logicalWidth / 2, logicalHeight / 2 - 50 * s);
        
        this.drawEndScores(logicalWidth, logicalHeight, s);
    }

    drawDefeat(winnerLabel) {
        const dpr = window.devicePixelRatio || 1;
        const logicalWidth = this.canvas.width / dpr;
        const logicalHeight = this.canvas.height / dpr;

        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, logicalWidth, logicalHeight);
        
        const s = this.uiScale;
        const charName = CONFIG.AUDIO_CHARACTERS[this.winner.roleIndex];

        this.ctx.fillStyle = '#e74c3c';
        this.ctx.font = `bold ${CONFIG.END_SCREEN_TITLE_SIZE * s}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('游戏失败 (DEFEAT)', logicalWidth / 2, logicalHeight / 2 - 120 * s);
        
        this.ctx.font = `${CONFIG.END_SCREEN_SUBTITLE_SIZE * s}px Arial`;
        this.ctx.fillStyle = '#fff';
        let winText = `${charName} 胡牌了！`;
        if (this.winner && this.winner.winResult && this.winner.winResult.patterns) {
            let patterns = [...this.winner.winResult.patterns];
            if (patterns.length > 1) {
                patterns.shift();
            }
            winText += ` [${patterns.join(', ')}]`;
        }
        this.ctx.fillText(winText, logicalWidth / 2, logicalHeight / 2 - 50 * s);

        this.drawEndScores(logicalWidth, logicalHeight, s);
    }

    drawEndScores(logicalWidth, logicalHeight, s) {
        const sortedSnakes = [...this.snakes].sort((a, b) => b.score - a.score);
        const startY = logicalHeight / 2 + 20 * s;
        const entryHeight = 40 * s;
        
        this.ctx.font = `bold ${CONFIG.END_SCREEN_SCORE_SIZE * s}px Arial`;
        this.ctx.textAlign = 'center';
        
        sortedSnakes.forEach((snake, index) => {
            const charName = CONFIG.AUDIO_CHARACTERS[snake.roleIndex];
            const isWinner = snake === this.winner;
            const isPlayer = snake === this.snake;
            
            this.ctx.fillStyle = isWinner ? '#f1c40f' : (isPlayer ? '#3498db' : '#fff');
            let nameText = `${index + 1}. ${charName}`;
            if (isPlayer) nameText += ' (你)';
            if (isWinner) nameText += ' ★';
            
            const text = `${nameText.padEnd(15)} 分数: ${snake.score}`;
            this.ctx.fillText(text, logicalWidth / 2, startY + index * entryHeight);
        });
    }

    drawGrid() {
        this.ctx.strokeStyle = CONFIG.GRID_LINE_COLOR;
        const dpr = window.devicePixelRatio || 1;
        this.ctx.lineWidth = CONFIG.GRID_LINE_WIDTH / (this.scale * dpr);
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

        // 绘制加粗边界线
        this.ctx.strokeStyle = CONFIG.GRID_BOUNDARY_COLOR;
        this.ctx.lineWidth = CONFIG.GRID_BOUNDARY_WIDTH / (this.scale * dpr);
        this.ctx.strokeRect(0, 0, CONFIG.SCENE_GRID_WIDTH * CONFIG.TILE_WIDTH, CONFIG.SCENE_GRID_HEIGHT * CONFIG.TILE_HEIGHT);
    }

    loop(time) {
        this.update(time);
        this.draw();
        requestAnimationFrame((t) => this.loop(t));
    }
}

new Game();
