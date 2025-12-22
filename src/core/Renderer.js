import { CONFIG } from './config.js';
import { assetManager, isMobile } from './utils.js';
import { audioManager } from './audio.js';

export class Renderer {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
    }

    draw(world, camera, state, ui, GAME_STATE) {
        const dpr = window.devicePixelRatio || 1;
        const width = this.canvas.width / dpr;
        const height = this.canvas.height / dpr;

        // 0. Check orientation for mobile
        if (isMobile() && height > width) {
            this.drawOrientationPrompt(width, height);
            return;
        }

        // 1. 绘制底层背景
        if (state === GAME_STATE.LOADING || state === GAME_STATE.START_SCREEN) {
            this.ctx.fillStyle = CONFIG.GRID_OUTSIDE_COLOR;
            this.ctx.fillRect(0, 0, width, height);
            this.drawInfiniteBackground(camera, width, height);
        } else {
            this.ctx.fillStyle = CONFIG.GRID_OUTSIDE_COLOR;
            this.ctx.fillRect(0, 0, width, height);

            this.ctx.save();
            this.ctx.translate(width / 2, height / 2);
            this.ctx.scale(camera.scale, camera.scale);
            this.ctx.translate(-camera.x, -camera.y);
            
            this.ctx.fillStyle = CONFIG.GRID_INSIDE_COLOR;
            this.ctx.fillRect(0, 0, CONFIG.SCENE_GRID_WIDTH * CONFIG.TILE_WIDTH, CONFIG.SCENE_GRID_HEIGHT * CONFIG.TILE_HEIGHT);

            this.drawGrid(camera.scale);
            world.foods.forEach(food => food.draw(this.ctx, 0, 0));

            if (state === GAME_STATE.PLAYING || state === GAME_STATE.GAME_OVER) {
                world.snakes.forEach(snake => snake.draw(this.ctx, 0, 0));
                
                world.effects.forEach(e => {
                    this.ctx.fillStyle = e.color || '#f1c40f';
                    this.ctx.font = `bold ${CONFIG.EFFECT_TEXT_SIZE}px Arial`;
                    this.ctx.textAlign = 'center';
                    this.ctx.globalAlpha = e.life / 1000;
                    this.ctx.fillText(e.text, e.x, e.y);
                    this.ctx.globalAlpha = 1.0;
                });

                world.aiControllers.forEach(controller => controller.drawLabel(this.ctx));
                world.snakes.forEach(snake => snake.drawStunLabel(this.ctx, 0, 0));
            }

            this.ctx.restore();
        }

        // 2. 绘制 UI 层
        if (state === GAME_STATE.LOADING || state === GAME_STATE.START_SCREEN) {
            const assetProgress = assetManager.getProgress();
            const audioProgress = audioManager.getProgress();
            const totalProgress = (assetProgress + audioProgress) / 2;
            
            ui.startScreen.update(totalProgress, state !== GAME_STATE.LOADING);
            ui.startScreen.draw(this.ctx, width, height, camera.uiScale);
            return;
        }

        const isTutorialEnabled = ui.startScreen.showTutorial;

        if (isTutorialEnabled) {
            ui.discardUI.draw(this.ctx, this.canvas, world.playerSnake.tiles, camera.uiScale);
            ui.tutorialUI.draw(this.ctx, camera.uiScale);
            
            if (ui.joystick) {
                ui.joystick.draw(this.ctx, camera.uiScale);
            }

            if (ui.keyboardHint) {
                ui.keyboardHint.draw(this.ctx, camera.uiScale);
            }
        }
        
        this.drawLeaderboard(world, camera.uiScale);
        
        if (world.isGameOver) {
            if (world.winner === world.playerSnake) {
                this.drawVictory(world, camera.uiScale, width, height);
            } else {
                const winnerController = world.aiControllers.find(c => c.snake === world.winner);
                this.drawDefeat(world, winnerController ? winnerController.label : null, camera.uiScale, width, height);
            }
            ui.endScreenUI.draw(this.ctx, width, height, camera.uiScale);
        }
    }

    drawOrientationPrompt(width, height) {
        this.ctx.fillStyle = '#2c3e50';
        this.ctx.fillRect(0, 0, width, height);
        
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('请旋转设备以横屏游玩', width / 2, height / 2 - 20);
        this.ctx.font = '16px Arial';
        this.ctx.fillText('Please rotate your device to landscape mode', width / 2, height / 2 + 20);
    }

    drawInfiniteBackground(camera, width, height) {
        if (!camera.startScreenCam) return;
        const cam = camera.startScreenCam;
        const tw = CONFIG.TILE_WIDTH;
        const th = CONFIG.TILE_HEIGHT;

        const startScreenScale = height / (CONFIG.START_SCREEN_VERTICAL_FOV * th);
        
        this.ctx.save();
        this.ctx.scale(startScreenScale, startScreenScale);

        const logicalW = width / startScreenScale;
        const logicalH = height / startScreenScale;

        this.ctx.strokeStyle = CONFIG.GRID_LINE_COLOR;
        this.ctx.lineWidth = 1;

        const offsetX = cam.x % tw;
        const offsetY = cam.y % th;

        for (let x = -offsetX; x < logicalW + tw; x += tw) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, logicalH);
            this.ctx.stroke();
        }

        for (let y = -offsetY; y < logicalH + th; y += th) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(logicalW, y);
            this.ctx.stroke();
        }

        const wrapWidth = 50 * tw;
        const wrapHeight = 50 * th;

        this.ctx.fillStyle = '#1e5a1e';
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;

        camera.decorationTiles = camera.decorationTiles || []; // Fallback
        camera.decorationTiles.forEach(tile => {
            let drawX = (tile.x - cam.x);
            let drawY = (tile.y - cam.y);

            for (let ox = -wrapWidth; ox <= wrapWidth; ox += wrapWidth) {
                for (let oy = -wrapHeight; oy <= wrapHeight; oy += wrapHeight) {
                    const finalX = drawX + ox;
                    const finalY = drawY + oy;

                    if (finalX > -tw && finalX < logicalW && finalY > -th && finalY < logicalH) {
                        this.ctx.fillRect(finalX, finalY, tw, th);
                        this.ctx.strokeRect(finalX, finalY, tw, th);
                    }
                }
            }
        });

        this.ctx.restore();
    }

    drawGrid(scale) {
        this.ctx.strokeStyle = CONFIG.GRID_LINE_COLOR;
        const dpr = window.devicePixelRatio || 1;
        this.ctx.lineWidth = CONFIG.GRID_LINE_WIDTH / (scale * dpr);
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

        this.ctx.strokeStyle = CONFIG.GRID_BOUNDARY_COLOR;
        this.ctx.lineWidth = CONFIG.GRID_BOUNDARY_WIDTH / (scale * dpr);
        this.ctx.strokeRect(0, 0, CONFIG.SCENE_GRID_WIDTH * CONFIG.TILE_WIDTH, CONFIG.SCENE_GRID_HEIGHT * CONFIG.TILE_HEIGHT);
    }

    drawLeaderboard(world, s) {
        const dpr = window.devicePixelRatio || 1;
        const logicalWidth = this.canvas.width / dpr;

        const padding = CONFIG.LEADERBOARD_PADDING * s;
        const width = CONFIG.LEADERBOARD_WIDTH * s;
        const entryHeight = CONFIG.LEADERBOARD_ENTRY_HEIGHT * s;
        const titleHeight = CONFIG.LEADERBOARD_TITLE_HEIGHT * s;
        
        const sortedSnakes = [...world.snakes].sort((a, b) => b.score - a.score);
        
        const height = titleHeight + sortedSnakes.length * entryHeight + padding;
        const x = logicalWidth - width - padding;
        const y = padding;

        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, width, height, 10 * s);
        this.ctx.fill();

        this.ctx.fillStyle = '#f1c40f';
        this.ctx.font = `bold ${CONFIG.LEADERBOARD_TITLE_FONT_SIZE * s}px Arial`;
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText('排行榜 (Leaderboard)', x + 15 * s, y + 15 * s);

        this.ctx.font = `${CONFIG.LEADERBOARD_ENTRY_FONT_SIZE * s}px Arial`;
        sortedSnakes.forEach((snake, index) => {
            const entryY = y + titleHeight + index * entryHeight + 10 * s;
            const charName = CONFIG.AUDIO_CHARACTERS[snake.roleIndex] || 'Unknown';
            
            if (snake === world.playerSnake) {
                this.ctx.fillStyle = '#3498db';
                this.ctx.fillText(`> ${charName} (你)`, x + 15 * s, entryY);
            } else {
                const controller = world.aiControllers.find(c => c.snake === snake);
                this.ctx.fillStyle = controller ? controller.label.color : '#fff';
                this.ctx.fillText(`${index + 1}. ${charName}`, x + 15 * s, entryY);
            }
            
            this.ctx.textAlign = 'right';
            this.ctx.fillStyle = '#fff';
            this.ctx.fillText(snake.score, x + width - 15 * s, entryY);
            this.ctx.textAlign = 'left';
        });
    }

    drawVictory(world, s, width, height) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, width, height);
        
        const charName = CONFIG.AUDIO_CHARACTERS[world.winner.roleIndex];
        
        this.ctx.fillStyle = '#f1c40f';
        this.ctx.font = `bold ${CONFIG.END_SCREEN_TITLE_SIZE * s}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(`游戏胜利 (VICTORY)`, width / 2, height / 2 - 120 * s);
        
        this.ctx.font = `${CONFIG.END_SCREEN_SUBTITLE_SIZE * s}px Arial`;
        let winText = `${charName} 胡牌了！`;
        if (world.winner.winResult && world.winner.winResult.patterns) {
            let patterns = [...world.winner.winResult.patterns];
            if (patterns.length > 1) patterns.shift();
            winText += ` [${patterns.join(', ')}]`;
        }
        this.ctx.fillText(winText, width / 2, height / 2 - 50 * s);
        
        this.drawEndScores(world, width, height, s);
    }

    drawDefeat(world, winnerLabel, s, width, height) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, width, height);
        
        const charName = CONFIG.AUDIO_CHARACTERS[world.winner.roleIndex];

        this.ctx.fillStyle = '#e74c3c';
        this.ctx.font = `bold ${CONFIG.END_SCREEN_TITLE_SIZE * s}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('游戏失败 (DEFEAT)', width / 2, height / 2 - 120 * s);
        
        this.ctx.font = `${CONFIG.END_SCREEN_SUBTITLE_SIZE * s}px Arial`;
        this.ctx.fillStyle = '#fff';
        let winText = `${charName} 胡牌了！`;
        if (world.winner && world.winner.winResult && world.winner.winResult.patterns) {
            let patterns = [...world.winner.winResult.patterns];
            if (patterns.length > 1) patterns.shift();
            winText += ` [${patterns.join(', ')}]`;
        }
        this.ctx.fillText(winText, width / 2, height / 2 - 50 * s);

        this.drawEndScores(world, width, height, s);
    }

    drawEndScores(world, width, height, s) {
        const sortedSnakes = [...world.snakes].sort((a, b) => b.score - a.score);
        const startY = height / 2 + 20 * s;
        const entryHeight = 40 * s;
        
        this.ctx.font = `bold ${CONFIG.END_SCREEN_SCORE_SIZE * s}px Arial`;
        this.ctx.textAlign = 'center';
        
        sortedSnakes.forEach((snake, index) => {
            const charName = CONFIG.AUDIO_CHARACTERS[snake.roleIndex];
            const isWinner = snake === world.winner;
            const isPlayer = snake === world.playerSnake;
            
            this.ctx.fillStyle = isWinner ? '#f1c40f' : (isPlayer ? '#3498db' : '#fff');
            let nameText = `${index + 1}. ${charName}`;
            if (isPlayer) nameText += ' (你)';
            if (isWinner) nameText += ' ★';
            
            let scoreText = `${snake.score}`;
            if (isPlayer && world.isNewRecord) {
                scoreText += '（新纪录）';
            }
            
            const text = `${nameText.padEnd(15)} 分数: ${scoreText}`;
            this.ctx.fillText(text, width / 2, startY + index * entryHeight);
        });
    }
}

