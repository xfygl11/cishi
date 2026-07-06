# 饭太硬TV V10.0

基于 WebView + 原生增强的安卓影视TV应用。

## 功能特性

- **NativeHttp原生网络桥接** - 替代 proxy-server.py，直接原生 HTTP 请求
- **饭太硬仓库配置加载** - 支持 Base64 解码 + IDN 中文域名处理
- **原生播放器** - VideoView + MediaPlayer，支持全屏、倍速
- **直播功能** - 支持 m3u/txt/cms 多格式直播源
- **WebView混合架构** - 保留原有 Web 界面，原生增强性能

## 项目结构

```
cishi/app-build/
├── build.sh                      # 手工构建脚本
└── src/main/
    ├── AndroidManifest.xml       # 应用清单
    ├── java/                     # Java 源代码
    │   └── webapp/newcloud/lottery/movie/
    │       ├── MainActivity.java    # 主界面（WebView + NativeHttp/NativePlayer桥接）
    │       └── PlayerActivity.java  # 原生播放器
    ├── assets/                   # Web 资源
    │   └── assets/
    │       ├── index.html
    │       ├── css/app.css
    │       └── js/
    │           ├── nc-movie-engine.js  # 影视引擎
    │           ├── nc-repo.js          # 仓库管理
    │           ├── nc-live.js          # 直播功能
    │           └── app.js              # 应用入口
    └── res/                      # Android 资源
        ├── drawable/
        ├── values/
        └── xml/
```

## 构建方式

### 方式一：本地手工构建

```bash
cd cishi/app-build
# 配置环境变量
export ANDROID_HOME=/path/to/android-sdk
export ANDROID_JAR=$ANDROID_HOME/platforms/android-33/android.jar
export BUILD_TOOLS=$ANDROID_HOME/build-tools/33.0.0
# 执行构建
bash build.sh
# 输出：build/cishi_v10.0_build75.apk
```

### 方式二：GitHub Actions 自动构建

推送代码到 GitHub 后，GitHub Actions 会自动构建 APK 并发布 Release。

工作流文件：`.github/workflows/build-apk.yml`

## 版本信息

- 版本号：v10.0
- 构建号：75
- 包名：webapp.newcloud.lottery.movie
