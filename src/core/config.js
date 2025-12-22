export const CONFIG = {
    // --- 调试设置 ---
    DEBUG_MODE: false, // 是否开启调试模式（显示 AI 状态等）

    // Grid settings
    TILE_WIDTH: 30,
    TILE_HEIGHT: 40,
    SCENE_GRID_WIDTH: 50,  // Number of horizontal grids
    SCENE_GRID_HEIGHT: 50, // Number of vertical grids
    GRID_OUTSIDE_COLOR: '#1a252f', // 地图以外的颜色
    GRID_INSIDE_COLOR: '#2c3e50',  // 地图内部背景颜色
    GRID_LINE_COLOR: '#34495e',    // 普通格子线条颜色
    GRID_LINE_WIDTH: 2,            // 普通格子线条宽度
    GRID_BOUNDARY_WIDTH: 5,      // 边界线条宽度
    GRID_BOUNDARY_COLOR: '#34495e', // 边界线条颜色
    
    // Snake settings
    INITIAL_SNAKE_SPEED: 200, // ms per move
    INITIAL_SNAKE_LENGTH: 3,
    MAX_SNAKE_TILES: 14, // Maximum number of mahjong tiles
    SNAKE_FULL_COLOR: '#e74c3c', // Red color when full
    
    // AI settings
    AI_MOVE_INTERVAL_MIN: 1000, // ms
    AI_MOVE_INTERVAL_MAX: 3000, // ms
    
    // --- 难度设置 ---
    AI_DIFFICULTY: 'NORMAL', // 可选值: 'EASY', 'NORMAL', 'HARD', 'IMPOSSIBLE'
    AI_DIFFICULTY_SETTINGS: {
        EASY:       { wander: 3000, chase: 1000, escape: 1000, forage: 3000 },
        NORMAL:     { wander: 1500, chase: 1500, escape: 2000, forage: 2000 },
        HARD:       { wander: 800,  chase: 2000, escape: 2500, forage: 1000 },
        IMPOSSIBLE: { wander: 200,  chase: 3000, escape: 3000, forage: 200 }
    },

    // 动态获取当前难度的参数 (这样 AIController.js 不需要改动任何代码)
    get AI_STATE_WANDER_TIME() { return this.AI_DIFFICULTY_SETTINGS[this.AI_DIFFICULTY].wander; },
    get AI_STATE_CHASE_TIME() { return this.AI_DIFFICULTY_SETTINGS[this.AI_DIFFICULTY].chase; },
    get AI_STATE_ESCAPE_TIME() { return this.AI_DIFFICULTY_SETTINGS[this.AI_DIFFICULTY].escape; },
    get AI_STATE_FORAGE_TIME() { return this.AI_DIFFICULTY_SETTINGS[this.AI_DIFFICULTY].forage; },

    AI_LABELS: {
        XIA_JIA: { text: '下家', color: '#e74c3c' }, // Red
        DUI_JIA: { text: '对家', color: '#bdc3c7' }, // Light Gray (was #ffffff)
        SHANG_JIA: { text: '上家', color: '#2ecc71' } // Green
    },

    // Discard UI settings
    DISCARD_UI_WIDTH: 60,       // 单张牌宽度
    DISCARD_UI_HEIGHT: 80,      // 单张牌高度
    DISCARD_UI_SPACING: 16,     // 牌间距
    
    // Action Tip Colors
    COLOR_HU: '#e74c3c',        // 胡 - 红色
    COLOR_CHOW: '#3498db',      // 吃 - 蓝色
    COLOR_PUNG: '#f1c40f',      // 碰 - 黄色
    COLOR_KONG: '#e67e22',      // 杠 - 橙色

    EFFECT_TEXT_SIZE: 80,       // 吃碰杠特效文字大小 (px)

    // Leaderboard settings
    LEADERBOARD_WIDTH: 300,
    LEADERBOARD_PADDING: 20,
    LEADERBOARD_ENTRY_HEIGHT: 35,
    LEADERBOARD_TITLE_HEIGHT: 50,
    LEADERBOARD_TITLE_FONT_SIZE: 24,
    LEADERBOARD_ENTRY_FONT_SIZE: 18,

    // Score settings
    SCORE_FOOD: 10,
    SCORE_CHOW: 50,
    SCORE_PUNG: 100,
    SCORE_KONG: 200,
    SCORE_CONCEALED_KONG: 300,
    SCORE_HU: 1000,

    STUN_DURATION: 3000, // ms
    GHOST_DURATION: 3000, // ms (for Phase 6, but good to have now)
    LABEL_FLOAT_HEIGHT: 0.1, // 以格子高度为单位，向上浮动的高度
    SNAKE_TILE_OVERLAY_ALPHA: 0.03, // 蛇身体麻将牌叠角色颜色的透明度 (0-1)

    // --- 教程 UI 设置 ---
    TUTORIAL_UI_PADDING: 15,
    TUTORIAL_UI_FONT_SIZE: 16,
    TUTORIAL_UI_LINE_HEIGHT: 25,
    TUTORIAL_UI_TEXT_COLOR: '#ffffff',

    // --- 游戏结束 UI 设置 ---
    END_SCREEN_TITLE_SIZE: 100, // 基础标题大小 (px)
    END_SCREEN_SUBTITLE_SIZE: 40, // 基础副标题大小 (px)
    END_SCREEN_SCORE_SIZE: 30, // 基础分数列表大小 (px)
    END_SCREEN_BTN_WIDTH: 150,
    END_SCREEN_BTN_HEIGHT: 50,
    END_SCREEN_BTN_FONT_SIZE: 20,
    END_SCREEN_BTN_MARGIN: 40, // 距离边缘的距离

    // --- 开始界面 UI 设置 ---
    START_SCREEN_TITLE: '麻将贪吃蛇',
    START_SCREEN_TITLE_SIZE: 200,
    START_SCREEN_TITLE_LETTER_SPACING: 30, // 每个字之间的额外像素间距 (可调)
    START_SCREEN_BTN_WIDTH: 140,
    START_SCREEN_BTN_HEIGHT: 60,
    START_SCREEN_BTN_SPACING: 20,
    START_SCREEN_PROGRESS_WIDTH: 600,
    START_SCREEN_PROGRESS_HEIGHT: 30,
    START_SCREEN_BTN_FONT_SIZE: 24,
    START_SCREEN_VERTICAL_FOV: 20, // 开始界面垂直方向显示的格数 (越小格子越大)
    START_SCREEN_CAM_SPEED: 1.5, // 移动速度 (格/秒)

    // Status display settings
    START_SCREEN_STATUS_FONT_SIZE: 16,
    START_SCREEN_STATUS_COLOR_NOT_CLEARED: '#95a5a6', // Gray
    START_SCREEN_STATUS_COLOR_CLEARED: '#f1c40f',     // Yellow/Gold
    START_SCREEN_STATUS_OFFSET_Y: 25,                 // Offset from button bottom

    // Camera settings
    CAMERA_FOLLOW_SPEED: 0.1, // Smooth follow interpolation factor
    CAMERA_VERTICAL_FOV: 13, // Number of vertical grids to show
    
    // Food settings
    MAX_FOOD_COUNT: 18,
    
    // Mahjong types
    MAHJONG_TYPES: {
        WAN: 'wan',
        TIAO: 'tiao',
        BING: 'bing',
        FENG: 'feng', // 东 南 西 北
        YUAN: 'yuan'  // 中 发 白
    },
    // --- 音频设置 ---
    AUDIO_BGM_PATH: 'Music_and_Sound_Effect/Background_Music/',
    AUDIO_VOICE_PATH: 'Music_and_Sound_Effect/Voice/', // 弃用，改用角色文件夹直接路径
    AUDIO_BASE_PATH: 'Music_and_Sound_Effect/',
    BGM_FADE_DURATION: 1000, // 缩短淡入淡出，增加响应感
    
    // --- 声音空间感与音量设置 ---
    AUDIO_GAIN_BGM: -10,   // 背景音乐增益 (dB)
    AUDIO_GAIN_VOICE: 0, // 角色语音增益 (dB)
    AUDIO_GAIN_SFX: 0,   // 通用音效增益 (dB) (吃掉食物, 眩晕等)
    
    AUDIO_DISTANCE_MAX: 15, // 声音完全衰减的最大距离 (以格子为单位)
    AUDIO_DISTANCE_MIN: 2,  // 保持最大音量的最小距离 (以格子为单位)
    
    // 角色文件夹映射 (0: 玩家, 1-3: AI)
    AUDIO_CHARACTERS: [
        '一姬',
        '二阶堂美树',
        '三上千织',
        '藤田加奈'
    ],
    
    // 动作与文件名映射
    AUDIO_VOICE_MAP: {
        'chow': 'act_chi',
        'pung': 'act_pon',
        'kong': 'act_kan',
        'kakan': 'act_kan',
        'hu_ron': 'act_ron',
        'hu_tsumo': 'act_tumo',
        'game_top': 'game_top', // 增加 game_top 映射
        'eat_food': 'eat_food',
        'discard_tile': 'discard_tile',
        'click': 'mouseclick',
        'fulu': 'fulu',
        'xuanyun': 'xuanyun'
    },
};

