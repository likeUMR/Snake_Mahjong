import { AudioLoader } from './audio/AudioLoader.js';
import { BgmPlayer } from './audio/BgmPlayer.js';
import { VoiceManager } from './audio/VoiceManager.js';

class AudioManager {
    constructor() {
        this._ctx = null;
        this.loader = null;
        this.bgmPlayer = null;
        this.voiceManager = null;
        this.hasUserInteracted = false;
        this.isInitialized = false;
        this.isMuted = false;
    }

    get ctx() {
        if (!this._ctx) {
            this._ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.loader = new AudioLoader(this._ctx);
            this.bgmPlayer = new BgmPlayer(this._ctx, this.loader);
            this.voiceManager = new VoiceManager(this._ctx, this.loader);
        }
        return this._ctx;
    }

    // Proxy properties for backward compatibility
    get bufferCache() { return this.ctx && this.loader.bufferCache; }

    setListener(snake) {
        this.ctx; // Ensure initialized
        this.voiceManager.setListener(snake);
    }

    setMuted(muted) {
        this.isMuted = muted;
        if (this.bgmPlayer) {
            if (muted) {
                this.bgmPlayer.pauseBgm();
            } else {
                const isPlaying = window.gameInstance && 
                                  window.gameInstance.state === window.gameInstance.GAME_STATE.PLAYING && 
                                  !window.gameInstance.world.isGameOver;
                if (isPlaying) {
                    this.bgmPlayer.resumeBgm();
                }
            }
        }
    }

    async initBgm() {
        if (!this.ctx) return;
        const bgmQueue = await this.loader.initBgm();
        this.bgmPlayer.setBgmQueue(bgmQueue);
    }

    async preloadEssential() {
        if (!this.ctx) return;
        await this.loader.preloadEssential();
    }

    getProgress() {
        return this.loader ? this.loader.getProgress() : 0;
    }

    async resumeAudio() {
        // Ensure ctx is created
        const context = this.ctx;
        
        if (context.state === 'suspended') {
            await context.resume();
        }

        // 移动端特殊处理：播放一个极短的静音片段来真正激活音频上下文
        if (!this.hasUserInteracted) {
            const buffer = context.createBuffer(1, 1, 22050);
            const source = context.createBufferSource();
            source.buffer = buffer;
            source.connect(context.destination);
            source.start(0);
            this.hasUserInteracted = true;
        }

        if (this.bgmPlayer && !this.isMuted) {
            const isPlaying = window.gameInstance && 
                              window.gameInstance.state === window.gameInstance.GAME_STATE.PLAYING && 
                              !window.gameInstance.world.isGameOver;

            if (this.bgmPlayer.isBgmPaused && isPlaying) {
                await this.bgmPlayer.resumeBgm();
            } else if (this.bgmPlayer.bgmSource && !this.isInitialized) {
                this.isInitialized = true;
                await this.bgmPlayer.fadeIn();
            }
        }
    }

    playBgm(path) {
        if (this.isMuted) return;
        this.bgmPlayer.playBgm(path);
    }

    startBgm() {
        if (this.isMuted) return;
        this.bgmPlayer.startBgm();
    }

    async stopBgm() {
        await this.bgmPlayer.stopBgm();
    }

    async playEndSound(isWin) {
        if (this.isMuted) return;
        await this.bgmPlayer.playEndSound(isWin);
    }

    playVoice(roleIndex, actionKey, sourcePos = null) {
        if (this.isMuted) return;
        this.voiceManager.playVoice(roleIndex, actionKey, sourcePos);
    }
}

export const audioManager = new AudioManager();
