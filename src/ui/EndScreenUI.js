import { CONFIG } from '../core/config.js';

export class EndScreenUI {
    constructor() {
        this.buttons = [];
    }

    draw(ctx, width, height, uiScale) {
        const s = uiScale;
        const btnWidth = CONFIG.END_SCREEN_BTN_WIDTH * s;
        const btnHeight = CONFIG.END_SCREEN_BTN_HEIGHT * s;
        const margin = CONFIG.END_SCREEN_BTN_MARGIN * s;

        this.buttons = [
            {
                id: 'menu',
                label: '返回菜单',
                x: margin,
                y: height - btnHeight - margin,
                width: btnWidth,
                height: btnHeight,
                color: '#7f8c8d'
            },
            {
                id: 'restart',
                label: '重新开始',
                x: width - btnWidth - margin,
                y: height - btnHeight - margin,
                width: btnWidth,
                height: btnHeight,
                color: '#2ecc71'
            }
        ];

        this.buttons.forEach(btn => {
            ctx.fillStyle = btn.color;
            ctx.beginPath();
            ctx.roundRect(btn.x, btn.y, btn.width, btn.height, 10 * s);
            ctx.fill();

            ctx.fillStyle = '#fff';
            ctx.font = `bold ${CONFIG.END_SCREEN_BTN_FONT_SIZE * s}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // 修正文字纵向居中：Canvas 的 middle 基准线对某些字体/中文字符可能略微偏上
            // 增加一个微小的偏移量以达到更好的视觉居中
            const textY = btn.y + btn.height / 2 + (CONFIG.END_SCREEN_BTN_FONT_SIZE * s * 0.05);
            ctx.fillText(btn.label, btn.x + btn.width / 2, textY);
        });
    }

    handleEndMouseDown(e, canvas, callback) {
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

