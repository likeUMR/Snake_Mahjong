/**
 * Victory Effect Manager using canvas-confetti
 */
export class VictoryEffect {
    constructor() {
        this.isActive = false;
        this.duration = 1500; // 侧边持续时间砍半 (ms)
        this.burstCount = 5; // 总爆发次数（包含第一次正中心）
        this.burstInterval = 200; // 爆发之间的间隔 (ms)
    }

    /**
     * 触发胜利庆祝效果
     */
    trigger() {
        if (typeof confetti === 'undefined') {
            console.warn('confetti library not loaded');
            return;
        }

        const colors = ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'];

        const fireBurst = (particleCount, x, y) => {
            confetti({
                particleCount: particleCount,
                spread: 70,
                origin: { x: x, y: y },
                colors: colors,
                zIndex: 2000
            });
        };

        // 1. 瞬间的大型喷发系列
        for (let i = 0; i < this.burstCount; i++) {
            setTimeout(() => {
                if (i === 0) {
                    // 第一次：正中心
                    fireBurst(150, 0.5, 0.6);
                } else {
                    // 后续：随机偏移
                    const rx = 0.3 + Math.random() * 0.4; // 0.3 ~ 0.7
                    const ry = 0.4 + Math.random() * 0.3; // 0.4 ~ 0.7
                    fireBurst(100, rx, ry);
                }
            }, i * this.burstInterval);
        }

        // 2. 持续的小型侧边喷发
        const end = Date.now() + this.duration;

        const frame = () => {
            confetti({
                particleCount: 2,
                angle: 60,
                spread: 55,
                origin: { x: 0, y: 0.8 },
                colors: ['#f1c40f', '#3498db']
            });
            confetti({
                particleCount: 2,
                angle: 120,
                spread: 55,
                origin: { x: 1, y: 0.8 },
                colors: ['#e74c3c', '#2ecc71']
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        };
        
        frame();
    }
}

export const victoryEffect = new VictoryEffect();

