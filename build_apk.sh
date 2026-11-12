#!/usr/bin/env bash
set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="/home/smani24/.android-build-env"
mkdir -p "$BASE_DIR"
cd "$BASE_DIR"

echo "=== 1. Checking JDK 21 / JDK 17 ==="
if [ -d "$BASE_DIR/jdk21/bin" ]; then
  export JAVA_HOME="$BASE_DIR/jdk21"
elif [ -d "$BASE_DIR/jdk17/bin" ]; then
  export JAVA_HOME="$BASE_DIR/jdk17"
fi
export PATH="$JAVA_HOME/bin:$PATH"
java -version

echo "=== 2. Checking / Installing Android SDK Command Line Tools ==="
export ANDROID_HOME="$BASE_DIR/android-sdk"
mkdir -p "$ANDROID_HOME/cmdline-tools"

if [ ! -d "$ANDROID_HOME/cmdline-tools/latest/bin" ]; then
  echo "Downloading Android Commandline Tools..."
  curl -fsSL -o cmdline-tools.zip "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
  unzip -q cmdline-tools.zip -d "$BASE_DIR/tmp_cmdline"
  mkdir -p "$ANDROID_HOME/cmdline-tools/latest"
  mv "$BASE_DIR/tmp_cmdline/cmdline-tools/"* "$ANDROID_HOME/cmdline-tools/latest/"
  rm -rf "$BASE_DIR/tmp_cmdline" cmdline-tools.zip
fi

export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

echo "=== 3. Checking Platforms & Build-Tools ==="
if [ ! -d "$ANDROID_HOME/platforms/android-34" ]; then
  echo "Accepting licenses & installing platform 34..."
  yes | sdkmanager --licenses > /dev/null 2>&1 || true
  sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
fi

echo "=== 4. Configuring local.properties & Building Web Assets ==="
echo "sdk.dir=$ANDROID_HOME" > "$PROJECT_DIR/android/local.properties"

# Build production web client
echo "Building web client with latest changes..."
cd "$PROJECT_DIR/client"
npm run build

# Sync assets to server public and android assets
echo "Syncing assets to Android assets & server public..."
mkdir -p "$PROJECT_DIR/server/public" "$PROJECT_DIR/android/app/src/main/assets/public"
cp -rf "$PROJECT_DIR/client/dist/"* "$PROJECT_DIR/server/public/"
rm -rf "$PROJECT_DIR/android/app/src/main/assets/public/"*
cp -rf "$PROJECT_DIR/client/dist/"* "$PROJECT_DIR/android/app/src/main/assets/public/"
rm -rf "$PROJECT_DIR/android/app/src/main/assets/public/download"

echo "=== 5. Building APK with Gradle ==="
cd "$PROJECT_DIR/android"
./gradlew assembleDebug --offline || ./gradlew assembleDebug

echo "=== 6. Deploying generated APK across all download paths ==="
APK_SOURCE="$PROJECT_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
APK_DEST="$PROJECT_DIR/SyncToDo.apk"
cp -f "$APK_SOURCE" "$APK_DEST"

mkdir -p "$PROJECT_DIR/server/public/download" "/home/smani24/apks"
cp -f "$APK_SOURCE" "$PROJECT_DIR/server/public/SyncToDo.apk"
cp -f "$APK_SOURCE" "$PROJECT_DIR/server/public/download/SyncToDo.apk"
cp -f "$APK_SOURCE" "/home/smani24/apks/SyncToDo.apk"

echo "=========================================================="
echo "SUCCESS! APK built successfully at:"
echo "$APK_DEST"
echo "/home/smani24/apks/SyncToDo.apk"
echo "=========================================================="
