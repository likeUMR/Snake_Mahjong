import { CONFIG } from '../core/config.js';

export class KeyboardHintUI {
    constructor() {
        this.basePos = { x: 120, y: 0 }; // Will be updated relative to height
        this.keySize = 50;
        this.spacing = 10;
        this.activeKeys = new Set();
    }

    updateActiveKeys(key, isDown) {
        const k = key.toLowerCase();
        if (['w', 'a', 's', 'd'].includes(k)) {
            if (isDown) this.activeKeys.add(k);
            else this.activeKeys.delete(k);
        }
    }

    draw(ctx, uiScale = 1) {
        const s = uiScale;
        const size = this.keySize * s;
        const gap = this.spacing * s;
        
        const dpr = window.devicePixelRatio || 1;
        const canvasH = ctx.canvas.height / dpr;
        
        // Position similar to joystick, but lowered
        const startX = 118 * s;
        const startY = canvasH - 55 * s;

        const keys = [
            { id: 'w', relX: 0, relY: -size - gap, label: 'W' },
            { id: 'a', relX: -size - gap, relY: 0, label: 'A' },
            { id: 's', relX: 0, relY: 0, label: 'S' },
            { id: 'd', relX: size + gap, relY: 0, label: 'D' }
        ];

        ctx.save();
        
        keys.forEach(key => {
            const isActive = this.activeKeys.has(key.id);
            const x = startX + key.relX;
            const y = startY + key.relY;

            // Draw key box
            ctx.globalAlpha = isActive ? 0.4 : 0.1;
            ctx.fillStyle = isActive ? '#f1c40f' : '#fff';
            
            ctx.beginPath();
            ctx.roundRect(x - size/2, y - size/2, size, size, 5 * s);
            ctx.fill();
            
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1 * s;
            ctx.stroke();

            // Draw letter
            ctx.globalAlpha = isActive ? 0.8 : 0.2;
            ctx.fillStyle = '#000';
            const fontSize = 24 * s;
            ctx.font = `bold ${fontSize}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            // 增加竖直位移微调，使字母视觉上更居中
            const textY = y + (fontSize * 0.05);
            ctx.fillText(key.label, x, textY);
        });

        ctx.restore();
    }
}

