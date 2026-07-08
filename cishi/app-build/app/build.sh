#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC_DIR="$PROJECT_DIR/src/main"
BUILD_DIR="$PROJECT_DIR/build"
ANDROID_JAR="${ANDROID_JAR:-$ANDROID_HOME/platforms/android-33/android.jar}"
BUILD_TOOLS="${BUILD_TOOLS:-$ANDROID_HOME/build-tools/33.0.0}"
AAPT2="${AAPT2:-$BUILD_TOOLS/aapt2}"
D8="${D8:-$BUILD_TOOLS/d8}"
DX="${DX:-$ANDROID_HOME/build-tools/30.0.3/dx}"
ZIPALIGN="${ZIPALIGN:-$BUILD_TOOLS/zipalign}"
APKSIGNER="${APKSIGNER:-$BUILD_TOOLS/apksigner}"
JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-17-openjdk-amd64}"
KEYSTORE="${KEYSTORE:-$PROJECT_DIR/debug.keystore}"
KEY_ALIAS="${KEY_ALIAS:-androiddebugkey}"
KEY_PASS="${KEY_PASS:-android}"
STORE_PASS="${STORE_PASS:-android}"

VERSION_CODE=75
VERSION_NAME="10.0"
PACKAGE_NAME="webapp.newcloud.lottery.movie"
APP_NAME="饭太硬TV"
FINAL="$BUILD_DIR/cishi_v10.0_build75.apk"

echo "=== 饭太硬TV v10.0 build75 构建 ==="

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/gen" "$BUILD_DIR/obj" "$BUILD_DIR/apk"

echo "[1/6] 编译资源..."
"$AAPT2" compile \
  -o "$BUILD_DIR/compiled_res.zip" \
  --dir "$SRC_DIR/res"

echo "[2/6] 链接资源..."
"$AAPT2" link \
  -o "$BUILD_DIR/unsigned.apk" \
  -I "$ANDROID_JAR" \
  --manifest "$SRC_DIR/AndroidManifest.xml" \
  --java "$BUILD_DIR/gen" \
  --auto-add-overlay \
  --version-code "$VERSION_CODE" \
  --version-name "$VERSION_NAME" \
  "$BUILD_DIR/compiled_res.zip"

echo "[3/6] 编译 Java 代码..."
JAVA_FILES=$(find "$SRC_DIR/java" -name "*.java")
GEN_FILES=$(find "$BUILD_DIR/gen" -name "*.java" 2>/dev/null || true)

mkdir -p "$BUILD_DIR/obj"
"$JAVA_HOME/bin/javac" \
  --release 8 \
  -g:none \
  -classpath "$ANDROID_JAR" \
  -d "$BUILD_DIR/obj" \
  $JAVA_FILES $GEN_FILES

echo "[4/6] 转换 DEX..."
cd "$BUILD_DIR/obj"
jar cvf "$BUILD_DIR/classes.jar" .
cd "$PROJECT_DIR"
"$DX" \
  --dex \
  --output "$BUILD_DIR/apk/classes.dex" \
  "$BUILD_DIR/classes.jar"

echo "[5/6] 打包 APK..."
cp "$BUILD_DIR/unsigned.apk" "$BUILD_DIR/apk/base.apk"
cd "$BUILD_DIR/apk"

# 将 classes.dex 添加到 APK
zip -uj "$BUILD_DIR/apk/base.apk" classes.dex 2>/dev/null || true

# 添加 assets
cd "$PROJECT_DIR"
if [ -d "$SRC_DIR/assets" ]; then
  cd "$SRC_DIR/assets"
  zip -ur "$BUILD_DIR/apk/base.apk" .
  cd "$PROJECT_DIR"
fi

echo "[6/6] 对齐和签名..."
if [ ! -f "$KEYSTORE" ]; then
  echo "生成调试密钥库..."
  "$JAVA_HOME/bin/keytool" -genkeypair \
    -v -keystore "$KEYSTORE" \
    -alias "$KEY_ALIAS" \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$STORE_PASS" -keypass "$KEY_PASS" \
    -dname "CN=Debug, OU=Debug, O=Debug, L=Debug, ST=Debug, C=CN"
fi

"$ZIPALIGN" -f 4 "$BUILD_DIR/apk/base.apk" "$BUILD_DIR/aligned.apk"

"$APKSIGNER" sign \
  --ks "$KEYSTORE" \
  --ks-key-alias "$KEY_ALIAS" \
  --ks-pass "pass:$STORE_PASS" \
  --key-pass "pass:$KEY_PASS" \
  --min-sdk-version 26 \
  --out "$FINAL" \
  "$BUILD_DIR/aligned.apk"

SIZE=$(du -h "$FINAL" | cut -f1)
echo ""
echo "✅ 构建成功!"
echo "APK: $FINAL"
echo "大小: $SIZE"
echo "版本: v$VERSION_NAME build$VERSION_CODE"
