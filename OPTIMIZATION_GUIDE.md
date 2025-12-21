# Snake Mahjong 部署与加载优化指南

本项目在服务端部署时，如果遇到加载时间长（20s+）、资源丢失或音效断续的问题，通常是由于网络传输效率低和缺乏资源预加载机制导致的。以下是针对 Nginx 部署和项目配置的优化方案。

---

## 模块 1：Nginx 配置优化 (推荐方案)

这是最有效的优化手段，特别是开启 HTTP/2 后，大量碎片文件的加载速度将提升数倍。

### 1. 开启 HTTP/2 协议
默认的 HTTP/1.1 协议下，浏览器对同一域名的并发连接限制在 6 个左右，导致几十个麻将牌文件需要排队下载。HTTP/2 允许在单个连接中并行传输所有资源。

**配置方法：**
在 `server` 块的 `listen` 指令后增加 `http2`（前提是已配置 SSL/HTTPS）。
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    # ... SSL 配置 ...
}
```

### 2. 开启 Gzip 压缩
SVG 图片和 JS 代码经过 Gzip 压缩后体积可缩小 60% 以上。

**配置方法：**
```nginx
http {
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;
}
```

### 3. 设置静态资源强缓存
为音频和图片设置较长的缓存时间，这样用户只有在第一次访问时需要下载，后续访问将秒开。

**配置方法：**
```nginx
server {
    # ...
    location ~* \.(svg|mp3|ico|png|jpg|jpeg)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
```

---

## 模块 2：项目代码优化 (已实施)

我们已经在代码中增加了以下优化：

1.  **资源预加载 (Preloading)**：
    *   `AssetManager` 会在游戏启动前一次性请求所有 30+ 张麻将牌 SVG。
    *   `AudioManager` 会预加载核心音效和角色语音。
2.  **加载状态监控**：
    *   增加了 Loading 界面。在所有图片和音频资源未 100% 下载完成前，游戏逻辑不会启动，避免了运行中图标缺失的问题。
3.  **变量声明规范化**：
    *   修复了 `snake.js` 中可能导致 `ReferenceError` 的变量作用域问题，确保跨浏览器兼容性。

---

## 模块 3：进阶建议 (如果加载依然慢)

如果您的服务器带宽非常有限（如 1Mbps），可以考虑以下方案：

1.  **使用 CDN**：将 `SVG_Background/` 和 `Music_and_Sound_Effect/` 目录托管到阿里云 OSS 或腾讯云 COS，并开启 CDN 加速。
2.  **SVG Sprite (图标合并)**：虽然 HTTP/2 解决了并发问题，但合并小图标依然能减少少量的 TCP 开销。
3.  **音频转码**：目前使用的是 MP3，如果文件体积依然过大，可以考虑转换为更高压缩率的 `.ogg` 或 `.webm` 格式。

---

**配置修改后，请记得执行 `nginx -s reload` 使配置生效。**



