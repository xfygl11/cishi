# Android Studio 打包 APK 说明

这个文件夹是完整 Android Studio 项目，可以直接用 Android Studio 打开并生成 APK。

## 打开项目

1. 解压项目压缩包。
2. 打开 Android Studio。
3. 点击 `Open`。
4. 选择 `dlt_android_app` 文件夹。
5. 等待 Gradle Sync 完成。

## 连接手机运行

1. 安卓手机打开开发者选项。
2. 打开 USB 调试。
3. 用数据线连接电脑。
4. Android Studio 顶部选择手机设备。
5. 点击运行按钮。

## 生成 APK

1. 在 Android Studio 顶部菜单点击 `Build`。
2. 选择 `Build Bundle(s) / APK(s)`。
3. 点击 `Build APK(s)`。
4. 构建完成后点击右下角提示中的 `locate`。
5. 找到 APK 文件：

```text
app/build/outputs/apk/debug/app-debug.apk
```

## 手机安装

1. 把 `app-debug.apk` 发到安卓手机。
2. 点击安装。
3. 如果提示“未知来源”，允许当前文件管理器或浏览器安装应用。

## 当前功能

- 大乐透预测
- 双色球预测
- 三角洲游戏币计算器
- APP 内同步开奖数据
- 同一期预测号码本地缓存，刷新不会变

## 说明

这个项目生成的是 Debug APK，适合自己安装使用。如果要发布到应用商店，需要生成签名版 APK 或 AAB。
