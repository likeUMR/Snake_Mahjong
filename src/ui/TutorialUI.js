import { CONFIG } from '../core/config.js';

export class TutorialUI {
    constructor() {
        this.lines = [
            '教程：',
            'wasd控制移动',
            '通过碰撞达成吃、碰、杠、胡',
            '任意玩家胡牌则游戏结束'
        ];
    }

    draw(ctx, uiScale = 1) {
        const s = uiScale;
        const padding = CONFIG.TUTORIAL_UI_PADDING * s;
        const fontSize = CONFIG.TUTORIAL_UI_FONT_SIZE * s;
        const lineHeight = CONFIG.TUTORIAL_UI_LINE_HEIGHT * s;
        
        const x = padding;
        const y = padding;

        // 使用 Monospace 字体以获得更清晰、更有游戏感的像素效果
        ctx.font = `bold ${fontSize}px "Consolas", "Monaco", "Courier New", monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        
        this.lines.forEach((line, index) => {
            // 确保坐标为整数以获得最清晰的像素效果
            const lineX = Math.round(x);
            const lineY = Math.round(y + index * lineHeight);
            
            // 只有指定的“通过碰撞达成...”这一行才进行关键字高亮
            if (line === '通过碰撞达成吃、碰、杠、胡') {
                this.drawHighlightedLine(ctx, line, lineX, lineY);
            } else {
                ctx.fillStyle = CONFIG.TUTORIAL_UI_TEXT_COLOR;
                ctx.fillText(line, lineX, lineY);
            }
        });
    }

    /**
     * 绘制带有关键字高亮的单行文字
     */
    drawHighlightedLine(ctx, line, x, y) {
        const keywords = [
            { text: '吃', color: CONFIG.COLOR_CHOW },
            { text: '碰', color: CONFIG.COLOR_PUNG },
            { text: '杠', color: CONFIG.COLOR_KONG },
            { text: '胡', color: CONFIG.COLOR_HU }
        ];

        let currentX = x;
        let remaining = line;

        while (remaining.length > 0) {
            let firstMatch = null;
            let minIndex = Infinity;

            for (const kw of keywords) {
                let idx = remaining.indexOf(kw.text);
                
                // 排除“碰撞”中的“碰”字：如果匹配到“碰”且后面紧跟“撞”，则跳过该匹配，寻找下一个
                if (kw.text === '碰' && idx !== -1 && remaining[idx + 1] === '撞') {
                    idx = remaining.indexOf(kw.text, idx + 1);
                }

                if (idx !== -1 && idx < minIndex) {
                    minIndex = idx;
                    firstMatch = kw;
                }
            }

            if (firstMatch) {
                // 绘制匹配项之前的文字
                if (minIndex > 0) {
                    const textBefore = remaining.substring(0, minIndex);
                    ctx.fillStyle = CONFIG.TUTORIAL_UI_TEXT_COLOR;
                    ctx.fillText(textBefore, currentX, y);
                    currentX += ctx.measureText(textBefore).width;
                }

                // 绘制关键字
                ctx.fillStyle = firstMatch.color;
                ctx.fillText(firstMatch.text, currentX, y);
                currentX += ctx.measureText(firstMatch.text).width;

                // 截取剩余部分
                remaining = remaining.substring(minIndex + firstMatch.text.length);
            }
        }
    }
}

