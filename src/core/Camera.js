import { CONFIG } from './config.js';
import { isMobile } from './utils.js';

export class Camera {
    constructor() {
        this.x = (CONFIG.SCENE_GRID_WIDTH * CONFIG.TILE_WIDTH) / 2;
        this.y = (CONFIG.SCENE_GRID_HEIGHT * CONFIG.TILE_HEIGHT) / 2;
        this.scale = 1;
        this.uiScale = 1;
        this.startScreenCam = null;
    }

    initStartScreenCam() {
        const angle = Math.random() * Math.PI * 2;
        this.startScreenCam = {
            x: Math.random() * 1000,
            y: Math.random() * 1000,
            vx: Math.cos(angle),
            vy: Math.sin(angle)
        };
        this.decorationTiles = this.generateDecorationTiles();
    }

    generateDecorationTiles() {
        const tiles = [];
        const count = 40; 
        const range = 50; 
        for (let i = 0; i < count; i++) {
            tiles.push({
                x: Math.floor(Math.random() * range) * CONFIG.TILE_WIDTH,
                y: Math.floor(Math.random() * range) * CONFIG.TILE_HEIGHT
            });
        }
        return tiles;
    }

    update(targetSnake, deltaTime) {
        if (!targetSnake) return;
        const head = targetSnake.body[0];
        const targetX = head.x * CONFIG.TILE_WIDTH + CONFIG.TILE_WIDTH / 2;
        const targetY = head.y * CONFIG.TILE_HEIGHT + CONFIG.TILE_HEIGHT / 2;
        this.x += (targetX - this.x) * CONFIG.CAMERA_FOLLOW_SPEED;
        this.y += (targetY - this.y) * CONFIG.CAMERA_FOLLOW_SPEED;
    }

    updateStartScreenAnim(deltaTime) {
        if (!this.startScreenCam) return;
        
        const speedX = this.startScreenCam.vx * CONFIG.START_SCREEN_CAM_SPEED * (deltaTime / 1000) * CONFIG.TILE_WIDTH;
        const speedY = this.startScreenCam.vy * CONFIG.START_SCREEN_CAM_SPEED * (deltaTime / 1000) * CONFIG.TILE_HEIGHT;
        
        const wrapWidth = 50 * CONFIG.TILE_WIDTH;
        const wrapHeight = 50 * CONFIG.TILE_HEIGHT;

        this.startScreenCam.x = (this.startScreenCam.x + speedX + wrapWidth) % wrapWidth;
        this.startScreenCam.y = (this.startScreenCam.y + speedY + wrapHeight) % wrapHeight;
    }

    handleResize(windowInnerHeight) {
        let fov = CONFIG.CAMERA_VERTICAL_FOV;
        if (isMobile()) {
            fov = 10; // Mobile landscape needs a tighter FOV to keep tiles readable
        }
        this.scale = windowInnerHeight / (fov * CONFIG.TILE_HEIGHT);
        this.uiScale = windowInnerHeight / 1080;
        if (isMobile()) this.uiScale *= 1.5; // Scale up UI for mobile
    }
}

