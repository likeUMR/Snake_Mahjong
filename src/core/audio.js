import { CONFIG } from './config.js';

/**
 * 将分贝 (dB) 转换为线性增益
 * @param {number} db 
 * @returns {number}
 */
function dbToLinear(db) {
    return Math.pow(10, db / 20);
}

class VoiceQueue {
    constructor() {
        this.queue = [];
        this.isPlaying = false;
        this.currentAudio = null;
    }

    /**
     * @param {string} audioPath 
     * @param {Object} spatialParams - { listenerPos, sourcePos, isSpatial, gainType }
     */
    push(audioPath, spatialParams = null) {
        this.queue.push({ path: audioPath, spatialParams });
        if (!this.isPlaying) {
            this.playNext();
        }
    }

    async playNext() {
        if (this.queue.length === 0) {
            this.isPlaying = false;
            return;
        }

        this.isPlaying = true;
        const item = this.queue.shift();
        
        try {
            const buffer = audioManager.bufferCache.get(item.path);
            if (!buffer) {
                // 如果没有预加载，退回到传统的 Audio 对象播放（或者直接跳过）
                console.warn(`Audio buffer not found for: ${item.path}, skipping.`);
                this.playNext();
                return;
            }

            const source = audioManager.ctx.createBufferSource();
            source.buffer = buffer;
            
            // 根据音效类型选择增益
            const gainDb = item.spatialParams?.gainType === 'SFX' ? CONFIG.AUDIO_GAIN_SFX : CONFIG.AUDIO_GAIN_VOICE;
            let volume = dbToLinear(gainDb);
            
            if (item.spatialParams && item.spatialParams.isSpatial) {
                const { listenerPos, sourcePos } = item.spatialParams;
                if (listenerPos && sourcePos) {
                    const dx = listenerPos.x - sourcePos.x;
                    const dy = listenerPos.y - sourcePos.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    // 线性衰减逻辑
                    let attenuation = 1;
                    if (dist > CONFIG.AUDIO_DISTANCE_MAX) {
                        attenuation = 0;
                    } else if (dist > CONFIG.AUDIO_DISTANCE_MIN) {
                        attenuation = 1 - (dist - CONFIG.AUDIO_DISTANCE_MIN) / (CONFIG.AUDIO_DISTANCE_MAX - CONFIG.AUDIO_DISTANCE_MIN);
                    }
                    volume *= attenuation;
                }
            }

            const gainNode = audioManager.ctx.createGain();
            gainNode.gain.value = Math.max(0, Math.min(1, volume));
            
            source.connect(gainNode);
            gainNode.connect(audioManager.ctx.destination);
            
            source.onended = () => this.playNext();
            source.start(0);
        } catch (e) {
            console.warn(`Failed to play voice via Web Audio: ${item.path}`, e);
            this.playNext();
        }
    }
}

class AudioManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.bufferCache = new Map();
        this.bgmPlayer = null;
        this.bgmQueue = [];
        this.currentBgmIndex = -1;
        this.voiceQueues = CONFIG.AUDIO_CHARACTERS.map(() => new VoiceQueue());
        this.isFading = false;
        this.fadeInterval = null;
        this.isInitialized = false;
        this.listenerSnake = null;
    }

    setListener(snake) {
        this.listenerSnake = snake;
    }

    async initBgm(bgmFiles) {
        this.bgmQueue = bgmFiles.map(file => CONFIG.AUDIO_BGM_PATH + file);
        if (this.bgmQueue.length > 0) {
            this.currentBgmIndex = 0;
            await this.playBgm(this.bgmQueue[this.currentBgmIndex]);
        }
    }

    /**
     * 预加载核心音效到 Web Audio API 的 AudioBuffer 中
     */
    async preloadEssential() {
        const essentialFiles = [
            'eat_food.mp3',
            'fulu.mp3',
            'xuanyun.mp3',
            'ron_music.mp3',
            'ron_ko.mp3'
        ];
        
        // 每个角色最常用的语音
        CONFIG.AUDIO_CHARACTERS.forEach(char => {
            ['act_chi', 'act_pon', 'act_kan', 'act_ron', 'act_tumo', 'game_top'].forEach(act => {
                essentialFiles.push(`${char}/${act}.mp3`);
            });
        });

        const loadPromises = essentialFiles.map(async (file) => {
            const path = CONFIG.AUDIO_BASE_PATH + file;
            if (this.bufferCache.has(path)) return;

            try {
                const response = await fetch(path);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
                this.bufferCache.set(path, audioBuffer);
            } catch (e) {
                console.warn(`Failed to preload/decode audio: ${path}`, e);
            }
        });

        // 设定一个稍微长一点的超时，Web Audio 解码需要时间
        const timeout = new Promise(resolve => setTimeout(resolve, 8000));
        await Promise.race([Promise.all(loadPromises), timeout]);
    }

    async resumeAudio() {
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

        if (this.isInitialized) return;
        if (this.bgmPlayer && this.bgmPlayer.paused) {
            try {
                await this.bgmPlayer.play();
                this.isInitialized = true;
                await this.fadeIn();
            } catch (e) {}
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
            this.isInitialized = true;
            await this.fadeIn();
        } catch (e) {
            console.warn("BGM play deferred until user interaction.");
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
        
        // 稍微延迟一点播放胜利/失败音乐，给角色的“胡”语音一点时间
        setTimeout(async () => {
            await this.stopBgm();
            
            const file = isWin ? 'ron_music.mp3' : 'ron_ko.mp3';
            const path = CONFIG.AUDIO_BASE_PATH + file;
            
            // 检查是否有预加载的 buffer，如果有则使用 Web Audio 播放
            const buffer = this.bufferCache.get(path);
            if (buffer) {
                const source = this.ctx.createBufferSource();
                source.buffer = buffer;
                const gainNode = this.ctx.createGain();
                gainNode.gain.value = Math.max(0, Math.min(1, dbToLinear(CONFIG.AUDIO_GAIN_SFX)));
                source.connect(gainNode);
                gainNode.connect(this.ctx.destination);
                source.start(0);
                // 模拟 bgmPlayer 对象以维持现有逻辑
                this.bgmPlayer = { 
                    pause: () => source.stop(),
                    volume: gainNode.gain.value,
                    paused: false
                };
            } else {
                this.bgmPlayer = new Audio(path);
                this.bgmPlayer.volume = Math.max(0, Math.min(1, dbToLinear(CONFIG.AUDIO_GAIN_SFX)));
                try {
                    await this.bgmPlayer.play();
                } catch (e) {
                    console.error("End sound play failed.", e);
                }
            }
        }, 100); // 延迟从 0.5s 缩短到 0.1s
    }

    fadeIn() {
        return new Promise(resolve => {
            if (!this.bgmPlayer) return resolve();
            if (this.fadeInterval) clearInterval(this.fadeInterval);
            
            this.isFading = true;
            const step = 0.05;
            const interval = Math.max(10, CONFIG.BGM_FADE_DURATION * step);
            const targetVolume = Math.max(0, Math.min(1, dbToLinear(CONFIG.AUDIO_GAIN_BGM)));
            
            this.fadeInterval = setInterval(() => {
                if (this.bgmPlayer && this.bgmPlayer.volume < targetVolume - 0.01) {
                    this.bgmPlayer.volume = Math.min(targetVolume, this.bgmPlayer.volume + step);
                } else {
                    if (this.bgmPlayer) this.bgmPlayer.volume = targetVolume;
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
            if (!this.bgmPlayer) return resolve();
            if (this.fadeInterval) clearInterval(this.fadeInterval);

            this.isFading = true;
            const step = 0.05;
            const interval = Math.max(10, CONFIG.BGM_FADE_DURATION * step);

            this.fadeInterval = setInterval(() => {
                if (this.bgmPlayer && this.bgmPlayer.volume > 0.05) {
                    this.bgmPlayer.volume = Math.max(0, this.bgmPlayer.volume - step);
                } else {
                    if (this.bgmPlayer) {
                        this.bgmPlayer.volume = 0;
                        this.bgmPlayer.pause();
                    }
                    this.isFading = false;
                    clearInterval(this.fadeInterval);
                    this.fadeInterval = null;
                    resolve();
                }
            }, interval);
        });
    }

    /**
     * @param {number} roleIndex 
     * @param {string} actionKey 
     * @param {Object} sourcePos 
     */
    playVoice(roleIndex, actionKey, sourcePos = null) {
        if (roleIndex < 0 || roleIndex >= this.voiceQueues.length) return;
        
        const characterFolder = CONFIG.AUDIO_CHARACTERS[roleIndex];
        const fileName = CONFIG.AUDIO_VOICE_MAP[actionKey];
        if (!fileName) return;

        const commonSounds = ['eat_food', 'fulu', 'xuanyun'];
        const isCommon = commonSounds.includes(actionKey);
        
        let path;
        if (isCommon) {
            path = `${CONFIG.AUDIO_BASE_PATH}${fileName}.mp3`;
        } else {
            path = `${CONFIG.AUDIO_BASE_PATH}${characterFolder}/${fileName}.mp3`;
        }

        let spatialParams = {
            gainType: isCommon ? 'SFX' : 'VOICE',
            isSpatial: false
        };

        const nonSpatialActions = ['hu_ron', 'hu_tsumo', 'game_top'];
        if (!nonSpatialActions.includes(actionKey) && sourcePos && this.listenerSnake) {
            spatialParams.isSpatial = true;
            spatialParams.listenerPos = this.listenerSnake.body[0];
            spatialParams.sourcePos = sourcePos;
        }

        this.voiceQueues[roleIndex].push(path, spatialParams);

        if (actionKey === 'hu_ron' || actionKey === 'hu_tsumo') {
            const topPath = `${CONFIG.AUDIO_BASE_PATH}${characterFolder}/${CONFIG.AUDIO_VOICE_MAP['game_top']}.mp3`;
            this.voiceQueues[roleIndex].push(topPath, { gainType: 'VOICE', isSpatial: false });
        }
    }
}

export const audioManager = new AudioManager();
