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
        // BGM 使用 Web Audio API
        this.bgmSource = null;
        this.bgmGainNode = null;
        this.bgmQueue = [];
        this.currentBgmIndex = -1;
        this.voiceQueues = CONFIG.AUDIO_CHARACTERS.map(() => new VoiceQueue());
        this.isFading = false;
        this.fadeInterval = null;
        this.isInitialized = false;
        this.listenerSnake = null;
        this.isGameOverSoundPlaying = false;
        // BGM 暂停/恢复相关
        this.bgmStartTime = 0;
        this.bgmPauseTime = 0;
        this.isBgmPaused = false;
        // 优化：记录用户是否已交互，避免频繁 resume
        this.hasUserInteracted = false;
    }

    setListener(snake) {
        this.listenerSnake = snake;
    }

    async initBgm() {
        this.isGameOverSoundPlaying = false; // 重置游戏结束标志，允许 BGM 循环
        
        // 1. 获取本地 mp3 文件
        const localMp3Files = import.meta.glob('../../public/Music_and_Sound_Effect/Background_Music/*.mp3');
        const localBgms = Object.keys(localMp3Files).map(path => {
            const fileName = path.split('/').pop();
            return CONFIG.AUDIO_BGM_PATH + fileName;
        });

        // 2. 获取并解析 txt 列表文件中的网络资源
        const txtFiles = import.meta.glob('../../public/Music_and_Sound_Effect/Background_Music/*.txt', { as: 'raw', eager: true });
        const remoteBgms = [];
        for (const path in txtFiles) {
            const content = txtFiles[path];
            const lines = content.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
            remoteBgms.push(...lines);
        }

        this.bgmQueue = [...localBgms, ...remoteBgms];
        
        if (this.bgmQueue.length === 0) {
            console.warn("No BGM files found in Background_Music folder or txt links.");
            return;
        }

        // 预加载所有 BGM 文件
        const loadPromises = this.bgmQueue.map(async (path) => {
            if (this.bufferCache.has(path)) return;
            try {
                const response = await fetch(path);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
                this.bufferCache.set(path, audioBuffer);
            } catch (e) {
                console.warn(`Failed to preload BGM: ${path}`, e);
            }
        });
        await Promise.all(loadPromises);
        
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
        // 优化：只在首次交互或 Context 被暂停时才执行
        if (!this.hasUserInteracted || (this.ctx && this.ctx.state === 'suspended')) {
            this.hasUserInteracted = true;
            
            // 激活 Web Audio Context
            if (this.ctx && this.ctx.state === 'suspended') {
                await this.ctx.resume();
            }

            // 如果 BGM 被暂停了，恢复播放
            if (this.isBgmPaused && this.bgmSource && this.bgmGainNode) {
                await this.resumeBgm();
            } else if (this.bgmSource && !this.isInitialized) {
                // 首次播放 BGM
                this.isInitialized = true;
                await this.fadeIn();
            }
        }
    }

    async playBgm(path) {
        // 先淡出当前 BGM
        if (this.bgmSource) {
            await this.fadeOut();
            this.stopBgmSource();
        }

        // 确保 Context 已激活
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

        // 加载 BGM buffer（应该已经预加载了）
        let buffer = this.bufferCache.get(path);
        if (!buffer) {
            try {
                const response = await fetch(path);
                const arrayBuffer = await response.arrayBuffer();
                buffer = await this.ctx.decodeAudioData(arrayBuffer);
                this.bufferCache.set(path, buffer);
            } catch (e) {
                console.warn(`Failed to load BGM: ${path}`, e);
                return;
            }
        }

        // 创建 Web Audio API 的 source 和 gain node
        this.bgmSource = this.ctx.createBufferSource();
        this.bgmSource.buffer = buffer;
        this.bgmSource.loop = false; // 不循环，通过 ended 事件切换
        
        this.bgmGainNode = this.ctx.createGain();
        this.bgmGainNode.gain.value = 0; // 初始音量为 0，等待淡入
        
        this.bgmSource.connect(this.bgmGainNode);
        this.bgmGainNode.connect(this.ctx.destination);
        
        // 监听结束事件，切换到下一首
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
            this.isInitialized = true;
            await this.fadeIn();
        } catch (e) {
            console.warn("BGM play failed.", e);
        }
    }

    async resumeBgm() {
        if (!this.bgmSource || !this.bgmGainNode || !this.isBgmPaused) {
            return;
        }

        // 确保 Context 已激活
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

        // 计算需要从哪个位置继续播放
        const buffer = this.bgmSource.buffer;
        const pauseOffset = this.bgmPauseTime;
        
        // 创建新的 source（旧的 source 不能重新 start）
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
            // 计算当前播放位置
            this.bgmPauseTime = this.ctx.currentTime - this.bgmStartTime;
            try {
                this.bgmSource.stop();
            } catch (e) {
                // 可能已经停止
            }
            this.isBgmPaused = true;
        }
    }

    stopBgmSource() {
        if (this.bgmSource) {
            try {
                this.bgmSource.stop();
            } catch (e) {
                // 可能已经停止
            }
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

    async stopBgm() {
        if (this.bgmSource) {
            await this.fadeOut();
            this.stopBgmSource();
        }
    }

    async playEndSound(isWin) {
        this.isGameOverSoundPlaying = true;
        
        // 暂停 BGM（使用 Web Audio API）
        this.pauseBgm();
        
        const file = isWin ? 'ron_music.mp3' : 'ron_ko.mp3';
        const path = CONFIG.AUDIO_BASE_PATH + file;
        
        // 统一使用 Web Audio API 播放
        let buffer = this.bufferCache.get(path);
        if (!buffer) {
            // 如果没缓存，尝试加载
            try {
                const response = await fetch(path);
                const arrayBuffer = await response.arrayBuffer();
                buffer = await this.ctx.decodeAudioData(arrayBuffer);
                this.bufferCache.set(path, buffer);
            } catch (e) {
                console.error("End sound load failed.", e);
                return;
            }
        }
        
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        const gainNode = this.ctx.createGain();
        gainNode.gain.value = Math.max(0, Math.min(1, dbToLinear(CONFIG.AUDIO_GAIN_SFX)));
        source.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        source.start(0);
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
