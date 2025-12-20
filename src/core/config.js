export const CONFIG = {
    // Grid settings
    TILE_WIDTH: 30,
    TILE_HEIGHT: 40,
    SCENE_GRID_WIDTH: 50,  // Number of horizontal grids
    SCENE_GRID_HEIGHT: 50, // Number of vertical grids
    
    // Snake settings
    INITIAL_SNAKE_SPEED: 200, // ms per move
    INITIAL_SNAKE_LENGTH: 3,
    MAX_SNAKE_TILES: 14, // Maximum number of mahjong tiles
    SNAKE_FULL_COLOR: '#e74c3c', // Red color when full
    
    // AI settings
    AI_MOVE_INTERVAL_MIN: 1000, // ms
    AI_MOVE_INTERVAL_MAX: 3000, // ms
    AI_LABELS: {
        XIA_JIA: { text: '下家', color: '#e74c3c' }, // Red
        DUI_JIA: { text: '对家', color: '#ffffff' }, // White
        SHANG_JIA: { text: '上家', color: '#2ecc71' } // Green
    },
    AI_STATE_WANDER_TIME: 1000, // 游走状态持续时间 (ms)
    AI_STATE_CHASE_TIME: 3000,  // 追逐状态最长时间 (ms)
    AI_STATE_ESCAPE_TIME: 3000, // 逃跑状态最长时间 (ms)
    AI_FOV_RADIUS: 8,           // AI 视野半径（格子数）
    
    // Discard UI settings
    DISCARD_UI_WIDTH: 90,       // 单张牌宽度
    DISCARD_UI_HEIGHT: 120,      // 单张牌高度
    DISCARD_UI_SPACING: 24,     // 牌间距
    
    // Action Tip Colors
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
    SCORE_HU: 500,

    STUN_DURATION: 3000, // ms
    GHOST_DURATION: 3000, // ms (for Phase 6, but good to have now)
    LABEL_FLOAT_HEIGHT: 0.1, // 以格子高度为单位，向上浮动的高度

    // Camera settings
    CAMERA_FOLLOW_SPEED: 0.1, // Smooth follow interpolation factor
    CAMERA_VERTICAL_FOV: 15, // Number of vertical grids to show
    
    // Food settings
    MAX_FOOD_COUNT: 18,
    
    // Mahjong types
    MAHJONG_TYPES: {
        WAN: 'wan',
        TIAO: 'tiao',
        BING: 'bing',
        FENG: 'feng', // 东 南 西 北
        YUAN: 'yuan'  // 中 发 白
    }
};

