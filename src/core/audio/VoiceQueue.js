import { CONFIG } from '../config.js';

/**
 * 将分贝 (dB) 转换为线性增益
 * @param {number} db 
 * @returns {number}
 */
function dbToLinear(db) {
    return Math.pow(10, db / 20);
}

export class VoiceQueue {
    constructor(ctx, audioLoader) {
        this.ctx = ctx;
        this.audioLoader = audioLoader;
        this.queue = [];
        this.isPlaying = false;
    }

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
            const buffer = this.audioLoader.bufferCache.get(item.path);
            if (!buffer) {
                console.warn(`Audio buffer not found for: ${item.path}, skipping.`);
                this.playNext();
                return;
            }

            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            
            const gainDb = item.spatialParams?.gainType === 'SFX' ? CONFIG.AUDIO_GAIN_SFX : CONFIG.AUDIO_GAIN_VOICE;
            let volume = dbToLinear(gainDb);
            
            if (item.spatialParams && item.spatialParams.isSpatial) {
                const { listenerPos, sourcePos } = item.spatialParams;
                if (listenerPos && sourcePos) {
                    const dx = listenerPos.x - sourcePos.x;
                    const dy = listenerPos.y - sourcePos.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    let attenuation = 1;
                    if (dist > CONFIG.AUDIO_DISTANCE_MAX) {
                        attenuation = 0;
                    } else if (dist > CONFIG.AUDIO_DISTANCE_MIN) {
                        attenuation = 1 - (dist - CONFIG.AUDIO_DISTANCE_MIN) / (CONFIG.AUDIO_DISTANCE_MAX - CONFIG.AUDIO_DISTANCE_MIN);
                    }
                    volume *= attenuation;
                }
            }

            const gainNode = this.ctx.createGain();
            gainNode.gain.value = Math.max(0, Math.min(1, volume));
            
            source.connect(gainNode);
            gainNode.connect(this.ctx.destination);
            
            source.onended = () => this.playNext();
            source.start(0);
        } catch (e) {
            console.warn(`Failed to play voice via Web Audio: ${item.path}`, e);
            this.playNext();
        }
    }
}


