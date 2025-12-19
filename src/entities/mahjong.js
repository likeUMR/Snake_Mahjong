import { CONFIG } from '../core/config.js';

export class MahjongTile {
    constructor(type, value) {
        this.type = type;
        this.value = value; // 1-9 for wan/tiao/bing, names for feng/yuan
        this.isIron = false; // Phase 8: marked as iron after Chow/Pung/Kong
        this.groupId = null; // Phase 8: unique id for the iron group
    }

    toString() {
        return `${this.value}${this.type}`;
    }

    getSortWeight() {
        const typeOrder = [
            CONFIG.MAHJONG_TYPES.WAN,
            CONFIG.MAHJONG_TYPES.TIAO,
            CONFIG.MAHJONG_TYPES.BING,
            CONFIG.MAHJONG_TYPES.YUAN,
            CONFIG.MAHJONG_TYPES.FENG
        ];
        
        const typeWeight = typeOrder.indexOf(this.type) * 100;
        
        let valueWeight = 0;
        if (typeof this.value === 'number') {
            valueWeight = this.value;
        } else {
            // 中-发-白-东-南-西-北
            const specialOrder = ['中', '发', '白', '东', '南', '西', '北'];
            valueWeight = specialOrder.indexOf(this.value);
        }
        
        return typeWeight + valueWeight;
    }
}

export const ALL_TILES = [];

// Initialize all 136 tiles
const types = [CONFIG.MAHJONG_TYPES.WAN, CONFIG.MAHJONG_TYPES.TIAO, CONFIG.MAHJONG_TYPES.BING];
for (const type of types) {
    for (let i = 1; i <= 9; i++) {
        for (let j = 0; j < 4; j++) {
            ALL_TILES.push(new MahjongTile(type, i));
        }
    }
}

const fengs = ['东', '南', '西', '北'];
for (const feng of fengs) {
    for (let j = 0; j < 4; j++) {
        ALL_TILES.push(new MahjongTile(CONFIG.MAHJONG_TYPES.FENG, feng));
    }
}

const yuans = ['中', '发', '白'];
for (const yuan of yuans) {
    for (let j = 0; j < 4; j++) {
        ALL_TILES.push(new MahjongTile(CONFIG.MAHJONG_TYPES.YUAN, yuan));
    }
}

export function getRandomTile() {
    const index = Math.floor(Math.random() * ALL_TILES.length);
    return ALL_TILES[index];
}
