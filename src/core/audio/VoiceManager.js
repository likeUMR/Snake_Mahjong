import { CONFIG } from '../config.js';
import { VoiceQueue } from './VoiceQueue.js';

export class VoiceManager {
    constructor(ctx, audioLoader) {
        this.ctx = ctx;
        this.audioLoader = audioLoader;
        this.voiceQueues = CONFIG.AUDIO_CHARACTERS.map(() => new VoiceQueue(ctx, audioLoader));
        this.listenerSnake = null;
    }

    setListener(snake) {
        this.listenerSnake = snake;
    }

    playVoice(roleIndex, actionKey, sourcePos = null) {
        if (roleIndex < 0 || roleIndex >= this.voiceQueues.length) return;
        
        const characterFolder = CONFIG.AUDIO_CHARACTERS[roleIndex];
        const fileName = CONFIG.AUDIO_VOICE_MAP[actionKey];
        if (!fileName) return;

        const commonSounds = ['eat_food', 'discard_tile', 'click', 'fulu', 'xuanyun'];
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


