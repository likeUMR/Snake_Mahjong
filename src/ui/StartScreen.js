import { CONFIG } from '../core/config.js';
import { storageManager } from '../core/utils.js';
import { audioManager } from '../core/audio.js';

export class StartScreen {
    constructor() {
        this.buttons = [];
        this.actionButtons = []; // 为辅助功能按钮准备
        this.isLoaded = false;
        this.progress = 0;
        this.showTutorial = true;
        this.isSoundEnabled = true;
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
                // 修正文字纵向居中：增加一个微小的偏移量
                const btnTextY = rect.y + rect.height / 2 + (CONFIG.START_SCREEN_BTN_FONT_SIZE * s * 0.05);
                ctx.fillText(diff.label, rect.x + rect.width / 2, btnTextY);

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

            // 5. Action Buttons (Bottom Right)
            this.drawActionButtons(ctx, width, height, s);
        }
    }

    drawActionButtons(ctx, width, height, s) {
        const btnRadius = 25 * s;
        const spacing = 15 * s;
        const rightPadding = 15 * s; // 按钮整体再靠边缘一些
        const bottomPadding = 15 * s;

        // 增加“音”按钮
        this.actionButtons = [
            { id: 'sound', x: width - rightPadding - btnRadius * 5 - spacing * 2, y: height - bottomPadding - btnRadius, label: '♫', color: '#9b59b6', active: this.isSoundEnabled },
            { id: 'tutorial', x: width - rightPadding - btnRadius * 3 - spacing, y: height - bottomPadding - btnRadius, label: '教', color: '#3498db', active: this.showTutorial },
            { id: 'clear', x: width - rightPadding - btnRadius, y: height - bottomPadding - btnRadius, label: '删', color: '#e74c3c', active: true }
        ];

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${20 * s}px Arial`;

        this.actionButtons.forEach(btn => {
            // Draw circle
            ctx.fillStyle = btn.color;
            ctx.globalAlpha = 0.8;
            ctx.beginPath();
            ctx.arc(btn.x, btn.y, btnRadius, 0, Math.PI * 2);
            ctx.fill();

            // Draw label
            ctx.fillStyle = '#fff';
            ctx.globalAlpha = 1;
            
            // 音符符号通常比汉字视觉上偏小，单独调大
            const fontSize = (btn.id === 'sound' ? 26.5 : 20) * s;
            ctx.font = `bold ${fontSize}px Arial`;

            // 竖直居中优化：增加微调偏移
            const textY = btn.y + (fontSize * 0.05);
            ctx.fillText(btn.label, btn.x, textY);

            // 如果关闭，绘制贯穿的单斜线
            if (btn.active === false) {
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 3 * s;
                ctx.beginPath();
                // 长度调整为直径，方向调整为从左上到右下
                const offset = btnRadius * Math.cos(Math.PI / 4);
                ctx.moveTo(btn.x - offset, btn.y - offset);
                ctx.lineTo(btn.x + offset, btn.y + offset);
                ctx.stroke();
            }
        });
        ctx.restore();
    }

    handleMouseDown(e, canvas, callback) {
        if (!this.isLoaded) return false;

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const s = canvas.height / 1080;

        // Check action buttons first
        for (const btn of this.actionButtons) {
            const dist = Math.sqrt((mouseX - btn.x) ** 2 + (mouseY - btn.y) ** 2);
            if (dist <= 30 * s) { // Adjusted hit area
                // 1. 先处理逻辑逻辑
                if (btn.id === 'tutorial') {
                    this.showTutorial = !this.showTutorial;
                } else if (btn.id === 'sound') {
                    this.isSoundEnabled = !this.isSoundEnabled;
                    audioManager.setMuted(!this.isSoundEnabled);
                } else if (btn.id === 'clear') {
                    audioManager.playVoice(0, 'click');
                    if (confirm('确定要删除所有的最高得分记录吗？此操作不可撤销。')) {
                        localStorage.removeItem('SNAKE_MAHJONG_RECORDS');
                        window.location.reload();
                    }
                    return true;
                }

                // 2. 逻辑处理完后试图播放音效 (如果静音了，playVoice 会自动忽略)
                audioManager.playVoice(0, 'click');
                return true;
            }
        }

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

