import { audioManager } from './audio.js';
import { CONFIG } from './config.js';

export class InputHandler {
    constructor(game) {
        this.game = game;
        this.canvas = game.canvas;
        this.init();
    }

    init() {
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('keyup', (e) => this.handleKeyUp(e));
        window.addEventListener('resize', () => this.handleResize());
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));

        // Touch events
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
    }

    handleKeyDown(e) {
        if (this.game.ui.keyboardHint) {
            this.game.ui.keyboardHint.updateActiveKeys(e.key, true);
        }
        if (this.game.state !== this.game.GAME_STATE.PLAYING) return;
        audioManager.resumeAudio();
        if (this.game.world.playerSnake) {
            this.game.world.playerSnake.handleInput(e.key);
        }
    }

    handleKeyUp(e) {
        if (this.game.ui.keyboardHint) {
            this.game.ui.keyboardHint.updateActiveKeys(e.key, false);
        }
    }

    handleTouchStart(e) {
        e.preventDefault();
        audioManager.resumeAudio();

        // 转换为鼠标事件坐标进行 UI 判定
        const touch = e.changedTouches[0];
        const fakeEvent = {
            clientX: touch.clientX,
            clientY: touch.clientY,
            preventDefault: () => {}
        };

        // 1. 如果在游戏中且未结束，优先判定是否点击了底部的弃牌区
        if (this.game.state === this.game.GAME_STATE.PLAYING && !this.game.world.isGameOver) {
            let hitDiscard = false;
            this.game.ui.discardUI.handleMouseDown(fakeEvent, this.canvas, (index) => {
                if (this.game.world.playerSnake) {
                    this.game.world.playerSnake.discardTile(index);
                }
                hitDiscard = true;
            });
            if (hitDiscard) return;
        }

        // 2. 检查摇杆 (现在是全屏幕判定)
        if (this.game.ui.joystick && this.game.state === this.game.GAME_STATE.PLAYING && !this.game.world.isGameOver) {
            if (this.game.ui.joystick.handleTouchStart(e, this.canvas)) {
                return;
            }
        }

        // 3. 其他兜底逻辑（如点击开始按钮、返回菜单等）
        this.handleMouseDown(fakeEvent);
    }

    handleTouchMove(e) {
        e.preventDefault();
        if (this.game.ui.joystick && this.game.state === this.game.GAME_STATE.PLAYING && !this.game.world.isGameOver) {
            if (this.game.ui.joystick.handleTouchMove(e, this.canvas)) {
                if (this.game.world.playerSnake && this.game.ui.joystick.inputDirection) {
                    this.game.world.playerSnake.handleInput(this.game.ui.joystick.inputDirection);
                }
            }
        }
    }

    handleTouchEnd(e) {
        e.preventDefault();
        if (this.game.ui.joystick) {
            this.game.ui.joystick.handleTouchEnd(e);
        }
    }

    handleResize() {
        this.game.resize();
    }

    handleMouseDown(e) {
        audioManager.resumeAudio();
        const state = this.game.state;
        const GAME_STATE = this.game.GAME_STATE;

        if (state === GAME_STATE.START_SCREEN) {
            this.game.ui.startScreen.handleMouseDown(e, this.canvas, (diffId) => {
                audioManager.playVoice(0, 'click');
                CONFIG.AI_DIFFICULTY = diffId;
                this.game.startGame();
            });
            return;
        }

        if (this.game.world.isGameOver) {
            this.game.ui.endScreenUI.handleEndMouseDown(e, this.canvas, (action) => {
                audioManager.playVoice(0, 'click');
                if (action === 'menu') {
                    this.game.goToMenu();
                } else if (action === 'restart') {
                    this.game.restartGame();
                }
            });
            return;
        }

        if (state === GAME_STATE.PLAYING) {
            this.game.ui.discardUI.handleMouseDown(e, this.canvas, (index) => {
                if (this.game.world.playerSnake) {
                    this.game.world.playerSnake.discardTile(index);
                }
            });
        }
    }
}

