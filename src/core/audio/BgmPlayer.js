import { CONFIG } from '../config.js';

/**
 * 将分贝 (dB) 转换为线性增益
 * @param {number} db 
 * @returns {number}
 */
function dbToLinear(db) {
    return Math.pow(10, db / 20);
}

export class BgmPlayer {
    constructor(ctx, audioLoader) {
        this.ctx = ctx;
        this.audioLoader = audioLoader;
        this.bgmSource = null;
        this.bgmGainNode = null;
        this.bgmQueue = [];
        this.currentBgmIndex = -1;
        this.isFading = false;
        this.fadeInterval = null;
        this.bgmStartTime = 0;
        this.bgmPauseTime = 0;
        this.isBgmPaused = false;
        this.isGameOverSoundPlaying = false;
    }

    setBgmQueue(queue) {
        this.bgmQueue = queue;
        if (this.bgmQueue.length > 0) {
            this.currentBgmIndex = 0;
        }
    }

    async playBgm(path) {
        if (this.bgmSource) {
            await this.fadeOut();
            this.stopBgmSource();
        }

        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

        let buffer = await this.audioLoader.loadBuffer(path);
        if (!buffer) return;

        this.bgmSource = this.ctx.createBufferSource();
        this.bgmSource.buffer = buffer;
        this.bgmSource.loop = false;
        
        this.bgmGainNode = this.ctx.createGain();
        this.bgmGainNode.gain.value = 0;
        
        this.bgmSource.connect(this.bgmGainNode);
        this.bgmGainNode.connect(this.ctx.destination);
        
        this.bgmSource.onended = () => {
            if (!this.isGameOverSoundPlaying) {
                this.playNextBgm();
            }
        };
        
        try {
            this.bgmStartTime = this.ctx.currentTime;
            this.bgmPauseTime = 0;
            this.isBgmPaused = false;
            this.bgmSource.start(0);
            await this.fadeIn();
        } catch (e) {
            console.warn("BGM play failed.", e);
        }
    }

    async resumeBgm() {
        if (!this.bgmSource || !this.bgmGainNode || !this.isBgmPaused) {
            return;
        }

        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

        const buffer = this.bgmSource.buffer;
        const pauseOffset = this.bgmPauseTime;
        
        const newSource = this.ctx.createBufferSource();
        newSource.buffer = buffer;
        newSource.loop = false;
        newSource.onended = this.bgmSource.onended;
        
        newSource.connect(this.bgmGainNode);
        newSource.start(0, pauseOffset);
        
        this.bgmSource = newSource;
        this.bgmStartTime = this.ctx.currentTime - pauseOffset;
        this.isBgmPaused = false;
    }

    pauseBgm() {
        if (this.bgmSource && !this.isBgmPaused) {
            this.bgmPauseTime = this.ctx.currentTime - this.bgmStartTime;
            try {
                this.bgmSource.stop();
            } catch (e) {}
            this.isBgmPaused = true;
        }
    }

    stopBgmSource() {
        if (this.bgmSource) {
            try {
                this.bgmSource.stop();
            } catch (e) {}
            this.bgmSource = null;
            this.bgmGainNode = null;
            this.isBgmPaused = false;
        }
    }

    async playNextBgm() {
        if (this.bgmQueue.length === 0) return;
        this.currentBgmIndex = (this.currentBgmIndex + 1) % this.bgmQueue.length;
        await this.playBgm(this.bgmQueue[this.currentBgmIndex]);
    }

    startBgm() {
        if (this.bgmQueue.length > 0 && !this.bgmSource) {
            const index = this.currentBgmIndex >= 0 ? this.currentBgmIndex : 0;
            this.playBgm(this.bgmQueue[index]);
        }
    }

    async stopBgm() {
        if (this.bgmSource) {
            await this.fadeOut();
            this.stopBgmSource();
        }
    }

    fadeIn() {
        return new Promise(resolve => {
            if (!this.bgmGainNode) return resolve();
            if (this.fadeInterval) clearInterval(this.fadeInterval);
            
            this.isFading = true;
            const step = 0.05;
            const interval = Math.max(10, CONFIG.BGM_FADE_DURATION * step);
            const targetVolume = Math.max(0, Math.min(1, dbToLinear(CONFIG.AUDIO_GAIN_BGM)));
            
            this.fadeInterval = setInterval(() => {
                if (this.bgmGainNode && this.bgmGainNode.gain.value < targetVolume - 0.01) {
                    this.bgmGainNode.gain.value = Math.min(targetVolume, this.bgmGainNode.gain.value + step);
                } else {
                    if (this.bgmGainNode) this.bgmGainNode.gain.value = targetVolume;
                    this.isFading = false;
                    clearInterval(this.fadeInterval);
                    this.fadeInterval = null;
                    resolve();
                }
            }, interval);
        });
    }

    fadeOut() {
        return new Promise(resolve => {
            if (!this.bgmGainNode) return resolve();
            if (this.fadeInterval) clearInterval(this.fadeInterval);

            this.isFading = true;
            const step = 0.05;
            const interval = Math.max(10, CONFIG.BGM_FADE_DURATION * step);

            this.fadeInterval = setInterval(() => {
                if (this.bgmGainNode && this.bgmGainNode.gain.value > 0.05) {
                    this.bgmGainNode.gain.value = Math.max(0, this.bgmGainNode.gain.value - step);
                } else {
                    if (this.bgmGainNode) {
                        this.bgmGainNode.gain.value = 0;
                    }
                    this.isFading = false;
                    clearInterval(this.fadeInterval);
                    this.fadeInterval = null;
                    resolve();
                }
            }, interval);
        });
    }

    async playEndSound(isWin) {
        this.isGameOverSoundPlaying = true;
        this.pauseBgm();
        
        const file = isWin ? 'ron_music.mp3' : 'ron_ko.mp3';
        const path = CONFIG.AUDIO_BASE_PATH + file;
        
        let buffer = await this.audioLoader.loadBuffer(path);
        if (!buffer) return;
        
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        const gainNode = this.ctx.createGain();
        gainNode.gain.value = Math.max(0, Math.min(1, dbToLinear(CONFIG.AUDIO_GAIN_SFX)));
        source.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        source.start(0);
    }
}

