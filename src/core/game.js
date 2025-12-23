import { CONFIG } from './config.js';
import { DiscardUI, TutorialUI, StartScreen, EndScreenUI, JoystickUI, KeyboardHintUI } from '../ui/ui.js';
import { assetManager, isMobile } from './utils.js';
import { audioManager } from './audio.js';
import { Camera } from './Camera.js';
import { World } from './World.js';
import { Renderer } from './Renderer.js';
import { InputHandler } from './InputHandler.js';

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
        this.GAME_STATE = GAME_STATE;
        
        this.state = GAME_STATE.LOADING;
        this.lastTime = 0;

        // Modules
        this.camera = new Camera();
        this.world = new World();
        this.renderer = new Renderer(this.canvas, this.ctx);
        
        // UI Components
        this.ui = {
            discardUI: new DiscardUI(),
            tutorialUI: new TutorialUI(),
            startScreen: new StartScreen(),
            endScreenUI: new EndScreenUI(),
            joystick: isMobile() ? new JoystickUI() : null,
            keyboardHint: !isMobile() ? new KeyboardHintUI() : null
        };

        this.inputHandler = new InputHandler(this);

        this.camera.initStartScreenCam();
        this.resize();
        this.draw();

        this.init();
    }

    async init() {
        requestAnimationFrame((time) => this.loop(time));

        const bgmPromise = audioManager.initBgm();
        const assetPromise = assetManager.preloadAll();
        const essentialPromise = audioManager.preloadEssential();

        await Promise.all([
            bgmPromise,
            assetPromise,
            essentialPromise
        ]);

        console.log(
            "开发者：璃若尘（likehang）\nGithub链接：https://github.com/likeUMR/Snake_Mahjong\n使用testWin()直接胜利",
            // "color: #f1c40f; font-weight: bold; font-size: 16px;",
            // "color: #3498db; text-decoration: underline;"
        );

        this.state = GAME_STATE.START_SCREEN;
    }

    startGame() {
        this.world.setupGameObjects();
        this.state = GAME_STATE.PLAYING;
        audioManager.startBgm();
    }

    restartGame() {
        this.world.reset();
        this.world.setupGameObjects();
        audioManager.startBgm();
    }

    goToMenu() {
        this.state = GAME_STATE.START_SCREEN;
        this.world.reset();
        audioManager.stopBgm();
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = window.innerWidth * dpr;
        this.canvas.height = window.innerHeight * dpr;
        this.canvas.style.width = window.innerWidth + 'px';
        this.canvas.style.height = window.innerHeight + 'px';
        
        this.ctx.resetTransform();
        this.ctx.scale(dpr, dpr);
        
        this.camera.handleResize(window.innerHeight);
    }

    update(time) {
        const deltaTime = time - this.lastTime;
        this.lastTime = time;

        if (this.state === GAME_STATE.LOADING) return;

        if (this.state === GAME_STATE.START_SCREEN) {
            this.camera.updateStartScreenAnim(deltaTime);
            return;
        }

        if (this.state !== GAME_STATE.PLAYING || this.world.isGameOver) return;

        this.world.update(deltaTime);
        this.camera.update(this.world.playerSnake, deltaTime);
    }

    draw() {
        this.renderer.draw(this.world, this.camera, this.state, this.ui, GAME_STATE);
    }

    loop(time) {
        const isPortrait = isMobile() && window.innerHeight > window.innerWidth;
        if (!isPortrait) {
            this.update(time);
        }
        this.draw();
        requestAnimationFrame((t) => this.loop(t));
    }
}

window.gameInstance = new Game();

// 测试代码：直接获得胜利
window.testWin = () => {
    const game = window.gameInstance;
    if (game && game.state === 'playing' && !game.world.isGameOver) {
        game.world.playerSnake.isWin = true;
        game.world.playerSnake.winResult = { patterns: ['管理员测试胡牌'], score: 0 };
        console.log("测试：触发胜利逻辑");
    } else {
        console.warn("只有在游戏进行中才能触发测试胜利");
    }
};
