import { CONFIG } from '../core/config.js';

export class JoystickUI {
    constructor() {
        this.active = false;
        this.basePos = { x: 0, y: 0 };
        this.stickPos = { x: 0, y: 0 };
        this.radius = 60;
        this.stickRadius = 30;
        this.touchId = null;
        this.direction = { x: 0, y: 0 }; // Normalised direction
        this.inputDirection = null; // 'w', 'a', 's', 'd' or null
    }

    handleTouchStart(e, canvas) {
        if (this.active) return false;

        const rect = canvas.getBoundingClientRect();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;

            // 全屏幕范围均可触发摇杆 (优先级低于 UI 判定)
            this.active = true;
            this.touchId = touch.identifier;
            this.basePos = { x, y };
            this.stickPos = { x, y };
            return true;
        }
        return false;
    }

    handleTouchMove(e, canvas) {
        if (!this.active) return false;

        const rect = canvas.getBoundingClientRect();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.identifier === this.touchId) {
                const x = touch.clientX - rect.left;
                const y = touch.clientY - rect.top;

                const dx = x - this.basePos.x;
                const dy = y - this.basePos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist > this.radius) {
                    const angle = Math.atan2(dy, dx);
                    this.stickPos.x = this.basePos.x + Math.cos(angle) * this.radius;
                    this.stickPos.y = this.basePos.y + Math.sin(angle) * this.radius;
                } else {
                    this.stickPos.x = x;
                    this.stickPos.y = y;
                }

                this.updateDirection();
                return true;
            }
        }
        return false;
    }

    handleTouchEnd(e) {
        if (!this.active) return false;

        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.identifier === this.touchId) {
                this.active = false;
                this.touchId = null;
                this.direction = { x: 0, y: 0 };
                this.inputDirection = null;
                return true;
            }
        }
        return false;
    }

    updateDirection() {
        const dx = this.stickPos.x - this.basePos.x;
        const dy = this.stickPos.y - this.basePos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 10) {
            this.direction = { x: 0, y: 0 };
            this.inputDirection = null;
            return;
        }

        this.direction = { x: dx / dist, y: dy / dist };

        // Convert to wasd
        if (Math.abs(dx) > Math.abs(dy)) {
            this.inputDirection = dx > 0 ? 'd' : 'a';
        } else {
            this.inputDirection = dy > 0 ? 's' : 'w';
        }
    }

    draw(ctx, uiScale = 1) {
        const s = uiScale;
        const baseR = this.radius * s;
        const stickR = this.stickRadius * s;

        let drawX, drawY, stickX, stickY, baseAlpha, stickAlpha;

        if (this.active) {
            // 激活状态：在触摸起始点绘制
            drawX = this.basePos.x;
            drawY = this.basePos.y;
            stickX = this.stickPos.x;
            stickY = this.stickPos.y;
            baseAlpha = 0.3;
            stickAlpha = 0.5;
        } else {
            // 未激活状态：在左下角显示提示虚影
            const dpr = window.devicePixelRatio || 1;
            const canvasH = ctx.canvas.height / dpr;
            
            // 固定位置：距离边缘一定距离
            drawX = 120 * s;
            drawY = canvasH - 120 * s;
            stickX = drawX;
            stickY = drawY;
            baseAlpha = 0.1; // 极低透明度
            stickAlpha = 0.15;
        }

        ctx.save();
        
        // 绘制分划和高亮
        this.drawSectors(ctx, drawX, drawY, baseR, baseAlpha, s);

        // 绘制底座轮廓
        ctx.globalAlpha = baseAlpha;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2 * s;
        ctx.beginPath();
        ctx.arc(drawX, drawY, baseR, 0, Math.PI * 2);
        ctx.stroke();

        // 绘制箭头
        this.drawArrows(ctx, drawX, drawY, baseR, baseAlpha, s);

        // 绘制摇杆头
        ctx.globalAlpha = stickAlpha;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(stickX, stickY, stickR, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }

    drawSectors(ctx, x, y, r, baseAlpha, s) {
        const directions = [
            { id: 'w', startAngle: -3 * Math.PI / 4, endAngle: -Math.PI / 4 },
            { id: 'd', startAngle: -Math.PI / 4, endAngle: Math.PI / 4 },
            { id: 's', startAngle: Math.PI / 4, endAngle: 3 * Math.PI / 4 },
            { id: 'a', startAngle: 3 * Math.PI / 4, endAngle: 5 * Math.PI / 4 }
        ];

        ctx.save();
        
        // 1. 绘制底座背景
        ctx.globalAlpha = baseAlpha;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        // 2. 绘制高亮区域 (仅当激活且有方向时)
        if (this.active && this.inputDirection) {
            const dir = directions.find(d => d.id === this.inputDirection);
            if (dir) {
                ctx.globalAlpha = 0.4;
                ctx.fillStyle = '#f1c40f'; // 金色高亮
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.arc(x, y, r, dir.startAngle, dir.endAngle);
                ctx.closePath();
                ctx.fill();
            }
        }

        ctx.restore();
    }

    drawArrows(ctx, x, y, r, baseAlpha, s) {
        ctx.save();
        // 设置箭头透明度和颜色
        ctx.globalAlpha = baseAlpha * 5; // 稍微调高透明度让黑色更清晰
        ctx.fillStyle = '#000'; // 黑色箭头
        ctx.font = `bold ${22 * s}px Arial`; // 稍微加大一点
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // 偏移量增加，使其贴近外环 (r 是底座半径)
        const offset = r * 0.82; 
        
        // 上
        ctx.fillText('↑', x, y - offset);
        // 下
        ctx.fillText('↓', x, y + offset);
        // 左
        ctx.fillText('←', x - offset, y);
        // 右
        ctx.fillText('→', x + offset, y);

        ctx.restore();
    }
}

