import { CONFIG } from '../core/config.js';
import { storageManager } from '../core/utils.js';

export class StartScreen {
    constructor() {
        this.buttons = [];
        this.isLoaded = false;
        this.progress = 0;
    }

    update(progress, isLoaded) {
        this.progress = progress;
        this.isLoaded = isLoaded;
    }

    draw(ctx, width, height, uiScale) {
        const s = uiScale;
        
        // 1. Background (Semi-transparent to show game background)
        ctx.fillStyle = 'rgba(44, 62, 80, 0.85)';
        ctx.fillRect(0, 0, width, height);

        // 2. Title (逐字绘制以实现字间距控制)
        ctx.fillStyle = '#f1c40f';
        ctx.font = `bold ${CONFIG.START_SCREEN_TITLE_SIZE * s}px Arial`;
        ctx.textBaseline = 'middle';
        
        const title = CONFIG.START_SCREEN_TITLE;
        const letterSpacing = CONFIG.START_SCREEN_TITLE_LETTER_SPACING * s;
        
        // 分解为单个字符
        const chars = title.split('');
        // 计算每个字的宽度
        const charWidths = chars.map(c => ctx.measureText(c).width);
        // 计算总宽度 (所有字宽 + 所有间距)
        const totalTitleWidth = charWidths.reduce((a, b) => a + b, 0) + (chars.length - 1) * letterSpacing;
        
        // 起始 X 坐标 (居中)
        let titleCurrentX = (width - totalTitleWidth) / 2;
        const titleY = height * 0.3;
        
        ctx.textAlign = 'left';
        chars.forEach((char, i) => {
            ctx.fillText(char, titleCurrentX, titleY);
            titleCurrentX += charWidths[i] + letterSpacing;
        });

        // 重置对齐方式，以免影响后续绘制
        ctx.textAlign = 'center';

        if (!this.isLoaded) {
            // 3. Loading Progress Bar
            const pWidth = CONFIG.START_SCREEN_PROGRESS_WIDTH * s;
            const pHeight = CONFIG.START_SCREEN_PROGRESS_HEIGHT * s;
            const px = (width - pWidth) / 2;
            const py = height * 0.6;

            // Background
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.fillRect(px, py, pWidth, pHeight);

            // Fill
            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(px, py, pWidth * this.progress, pHeight);

            // Text
            ctx.fillStyle = '#fff';
            ctx.font = `${20 * s}px Arial`;
            ctx.fillText(`资源加载中... ${Math.round(this.progress * 100)}%`, width / 2, py + pHeight + 30 * s);
        } else {
            // 4. Difficulty Buttons
            const btnWidth = CONFIG.START_SCREEN_BTN_WIDTH * s;
            const btnHeight = CONFIG.START_SCREEN_BTN_HEIGHT * s;
            const spacing = CONFIG.START_SCREEN_BTN_SPACING * s;
            const difficulties = [
                { id: 'EASY', label: '简单', color: '#2ecc71' },
                { id: 'NORMAL', label: '普通', color: '#3498db' },
                { id: 'HARD', label: '困难', color: '#e67e22' },
                { id: 'IMPOSSIBLE', label: '不可能', color: '#e74c3c' }
            ];

            const totalWidth = difficulties.length * btnWidth + (difficulties.length - 1) * spacing;
            let currentX = (width - totalWidth) / 2;
            const btnY = height * 0.6;

            this.buttons = [];
            difficulties.forEach(diff => {
                const rect = { x: currentX, y: btnY, width: btnWidth, height: btnHeight, id: diff.id };
                this.buttons.push(rect);

                // Draw button
                ctx.fillStyle = diff.color;
                ctx.beginPath();
                ctx.roundRect(rect.x, rect.y, rect.width, rect.height, 10 * s);
                ctx.fill();

                // Text
                ctx.fillStyle = '#fff';
                ctx.font = `bold ${CONFIG.START_SCREEN_BTN_FONT_SIZE * s}px Arial`;
                ctx.fillText(diff.label, rect.x + rect.width / 2, rect.y + rect.height / 2);

                // Status text below button
                const record = storageManager.getRecord(diff.id);
                ctx.font = `${CONFIG.START_SCREEN_STATUS_FONT_SIZE * s}px Arial`;
                if (record.cleared) {
                    ctx.fillStyle = CONFIG.START_SCREEN_STATUS_COLOR_CLEARED;
                    ctx.fillText(`最高得分: ${record.highScore}`, rect.x + rect.width / 2, rect.y + rect.height + CONFIG.START_SCREEN_STATUS_OFFSET_Y * s);
                } else {
                    ctx.fillStyle = CONFIG.START_SCREEN_STATUS_COLOR_NOT_CLEARED;
                    ctx.fillText('未通关', rect.x + rect.width / 2, rect.y + rect.height + CONFIG.START_SCREEN_STATUS_OFFSET_Y * s);
                }

                currentX += btnWidth + spacing;
            });

            // "Click to start" tip
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.font = `${20 * s}px Arial`;
            ctx.fillText('请选择难度以开始游戏', width / 2, btnY - 50 * s);
        }
    }

    handleMouseDown(e, canvas, callback) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        for (const btn of this.buttons) {
            if (mouseX >= btn.x && mouseX <= btn.x + btn.width &&
                mouseY >= btn.y && mouseY <= btn.y + btn.height) {
                callback(btn.id);
                return true;
            }
        }
        return false;
    }
}

