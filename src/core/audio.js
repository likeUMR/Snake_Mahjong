import { CONFIG } from './config.js';

class VoiceQueue {
    constructor() {
        this.queue = [];
        this.isPlaying = false;
        this.currentAudio = null;
    }

    push(audioPath) {
        this.queue.push(audioPath);
        if (!this.isPlaying) {
            this.playNext();
        }
    }

    async playNext() {
        if (this.queue.length === 0) {
            this.isPlaying = false;
            this.currentAudio = null;
            return;
        }

        this.isPlaying = true;
        const path = this.queue.shift();
        
        try {
            this.currentAudio = new Audio(path);
            this.currentAudio.addEventListener('ended', () => this.playNext());
            await this.currentAudio.play();
        } catch (e) {
            console.warn(`Failed to play voice: ${path}`, e);
            this.playNext();
        }
    }
}

class AudioManager {
    constructor() {
        this.bgmPlayer = null;
        this.bgmQueue = [];
        this.currentBgmIndex = -1;
        this.voiceQueues = CONFIG.AUDIO_CHARACTERS.map(() => new VoiceQueue());
        this.isFading = false;
    }

    async initBgm(bgmFiles) {
        this.bgmQueue = bgmFiles.map(file => CONFIG.AUDIO_BGM_PATH + file);
        if (this.bgmQueue.length > 0) {
            this.currentBgmIndex = 0;
            await this.playBgm(this.bgmQueue[this.currentBgmIndex]);
        }
    }

    async playBgm(path) {
        if (this.bgmPlayer) {
            await this.fadeOut();
        }

        this.bgmPlayer = new Audio(path);
        this.bgmPlayer.loop = false;
        this.bgmPlayer.volume = 0;
        this.bgmPlayer.addEventListener('ended', () => {
            if (!this.isGameOverSoundPlaying) {
                this.playNextBgm();
            }
        });
        
        try {
            await this.bgmPlayer.play();
            await this.fadeIn();
        } catch (e) {
            console.error("BGM play failed.", e);
        }
    }

    async playNextBgm() {
        if (this.bgmQueue.length === 0) return;
        this.currentBgmIndex = (this.currentBgmIndex + 1) % this.bgmQueue.length;
        await this.playBgm(this.bgmQueue[this.currentBgmIndex]);
    }

    async stopBgm() {
        if (this.bgmPlayer) {
            await this.fadeOut();
            this.bgmPlayer = null;
        }
    }

    async playEndSound(isWin) {
        this.isGameOverSoundPlaying = true;
        await this.stopBgm();
        
        const file = isWin ? 'ron_music.mp3' : 'ron_ko.mp3';
        const path = CONFIG.AUDIO_BASE_PATH + file;
        
        this.bgmPlayer = new Audio(path);
        this.bgmPlayer.volume = 1.0;
        try {
            await this.bgmPlayer.play();
        } catch (e) {
            console.error("End sound play failed.", e);
        }
    }

    fadeIn() {
        return new Promise(resolve => {
            if (!this.bgmPlayer) return resolve();
            this.isFading = true;
            const step = 0.05;
            const interval = CONFIG.BGM_FADE_DURATION / (1 / step);
            const fade = setInterval(() => {
                if (this.bgmPlayer && this.bgmPlayer.volume < 0.95) {
                    this.bgmPlayer.volume += step;
                } else {
                    if (this.bgmPlayer) this.bgmPlayer.volume = 1;
                    this.isFading = false;
                    clearInterval(fade);
                    resolve();
                }
            }, interval);
        });
    }

    fadeOut() {
        return new Promise(resolve => {
            if (!this.bgmPlayer) return resolve();
            this.isFading = true;
            const step = 0.05;
            const interval = CONFIG.BGM_FADE_DURATION / (1 / step);
            const fade = setInterval(() => {
                if (this.bgmPlayer && this.bgmPlayer.volume > 0.05) {
                    this.bgmPlayer.volume -= step;
                } else {
                    if (this.bgmPlayer) {
                        this.bgmPlayer.volume = 0;
                        this.bgmPlayer.pause();
                    }
                    this.isFading = false;
                    clearInterval(fade);
                    resolve();
                }
            }, interval);
        });
    }

    /**
     * @param {number} roleIndex - 0-3
     * @param {string} actionKey - 'chow', 'pung', 'kong', 'hu_ron', 'hu_tsumo', 'eat_food', 'fulu', 'xuanyun'
     */
    playVoice(roleIndex, actionKey) {
        if (roleIndex < 0 || roleIndex >= this.voiceQueues.length) return;
        
        const characterFolder = CONFIG.AUDIO_CHARACTERS[roleIndex];
        const fileName = CONFIG.AUDIO_VOICE_MAP[actionKey];
        if (!fileName) return;

        // 通用音效直接从根目录读取，避免重复复制到每个角色文件夹
        const commonSounds = ['eat_food', 'fulu', 'xuanyun'];
        let path;
        if (commonSounds.includes(actionKey)) {
            path = `${CONFIG.AUDIO_BASE_PATH}${fileName}.mp3`;
        } else {
            path = `${CONFIG.AUDIO_BASE_PATH}${characterFolder}/${fileName}.mp3`;
        }

        this.voiceQueues[roleIndex].push(path);
    }
}

export const audioManager = new AudioManager();









