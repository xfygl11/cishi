# GitLab 在线云打包 APK 说明

这个项目已经加入 `.gitlab-ci.yml`，上传到 GitLab 后可以用 GitLab CI/CD 自动打包 APK。

## 第一步：上传项目

1. 登录 GitLab。
2. 新建一个项目。
3. 上传本项目文件夹里的所有文件。
4. 确认项目根目录里有 `.gitlab-ci.yml`。

## 第二步：等待自动构建

上传完成后，GitLab 通常会自动启动 Pipeline。

如果没有自动启动：

1. 打开项目页面。
2. 进入 `Build > Pipelines` 或 `CI/CD > Pipelines`。
3. 点击 `Run pipeline`。
4. 选择默认分支后运行。

## 第三步：下载 APK

1. 等 Pipeline 显示成功。
2. 打开成功的任务 `build_debug_apk`。
3. 找到 `Job artifacts`。
4. 下载 `dlt-predictor-debug-apk`。
5. 解压后得到：

```text
app-debug.apk
```

## 手机安装

1. 把 `app-debug.apk` 发送到安卓手机。
2. 点击安装。
3. 如果提示未知来源，允许当前浏览器或文件管理器安装未知应用。

## 常见问题

- 如果构建失败，优先看日志中是否是网络下载 Android SDK 失败。
- 如果提示没有 Runner，说明你的 GitLab 项目没有可用 CI Runner，需要开启 GitLab.com shared runner，或配置自己的 Runner。
- 生成的是 Debug APK，可以直接安装测试；正式发布应用商店需要另做签名版 APK。
