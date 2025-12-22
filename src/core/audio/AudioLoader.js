import { CONFIG } from '../config.js';

export class AudioLoader {
    constructor(ctx) {
        this.ctx = ctx;
        this.bufferCache = new Map();
        this.loadedCount = 0;
        this.totalCount = 0;
    }

    getFetchOptions(path) {
        const isRemote = path.startsWith('http');
        if (!isRemote) return {};

        return {
            headers: {
                'sec-ch-ua': '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'upgrade-insecure-requests': '1',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'
            }
        };
    }

    async loadBuffer(path) {
        if (this.bufferCache.has(path)) return this.bufferCache.get(path);

        try {
            const response = await fetch(path, this.getFetchOptions(path));
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
            this.bufferCache.set(path, audioBuffer);
            return audioBuffer;
        } catch (e) {
            console.warn(`Failed to load audio: ${path}`, e);
            return null;
        }
    }

    async initBgm() {
        // 1. 获取本地 mp3 文件
        const localMp3Files = import.meta.glob('../../../public/Music_and_Sound_Effect/Background_Music/*.mp3');
        let localBgms = Object.keys(localMp3Files).map(path => {
            const fileName = path.split('/').pop();
            return CONFIG.AUDIO_BGM_PATH + fileName;
        });

        // 兼容性修复：如果 glob 失败，手动添加默认 BGM
        if (localBgms.length === 0) {
            localBgms = [CONFIG.AUDIO_BGM_PATH + 'game.mp3'];
        }

        // 2. 获取并解析 txt 列表文件中的网络资源
        const txtFiles = import.meta.glob('../../../public/Music_and_Sound_Effect/Background_Music/*.txt', { 
            query: '?raw', 
            import: 'default', 
            eager: true 
        });
        const remoteBgms = [];
        for (const path in txtFiles) {
            const content = txtFiles[path];
            const lines = content.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
            remoteBgms.push(...lines);
        }

        const bgmQueue = [...localBgms, ...remoteBgms];
        this.totalCount += bgmQueue.length;

        const bgmPromises = bgmQueue.map(async (path) => {
            await this.loadBuffer(path);
            this.loadedCount++;
        });

        await Promise.all(bgmPromises);
        return bgmQueue;
    }

    async preloadEssential() {
        const essentialFiles = [
            'eat_food.mp3',
            'discard_tile.mp3',
            'mouseclick.mp3',
            'fulu.mp3',
            'xuanyun.mp3',
            'ron_music.mp3',
            'ron_ko.mp3'
        ];
        
        CONFIG.AUDIO_CHARACTERS.forEach(char => {
            ['act_chi', 'act_pon', 'act_kan', 'act_ron', 'act_tumo', 'game_top'].forEach(act => {
                essentialFiles.push(`${char}/${act}.mp3`);
            });
        });

        this.totalCount += essentialFiles.length;

        const loadPromises = essentialFiles.map(async (file) => {
            const path = CONFIG.AUDIO_BASE_PATH + file;
            await this.loadBuffer(path);
            this.loadedCount++;
        });

        const timeout = new Promise(resolve => setTimeout(resolve, 18000));
        await Promise.race([Promise.all(loadPromises), timeout]);
    }

    getProgress() {
        return this.totalCount === 0 ? 1 : this.loadedCount / this.totalCount;
    }
}

