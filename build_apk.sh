#!/usr/bin/env bash
set -e

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

echo "=== 3. Accepting Licenses & Installing Platforms / Build-Tools ==="
yes | sdkmanager --licenses > /dev/null 2>&1 || true

if [ ! -d "$ANDROID_HOME/platforms/android-34" ]; then
  echo "Installing Android platform 34 and build-tools 34.0.0..."
  sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
fi

echo "=== 4. Configuring local.properties ==="
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${SCRIPT_DIR:-/home/smani24/Desktop/Repositories/SyncToDo}"
echo "sdk.dir=$ANDROID_HOME" > "$PROJECT_DIR/android/local.properties"

echo "=== 5. Building APK with Gradle ==="
cd "$PROJECT_DIR/android"
./gradlew assembleDebug

echo "=== 6. Copying generated APK ==="
APK_SOURCE="$PROJECT_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
APK_DEST="$PROJECT_DIR/SyncToDo.apk"
cp "$APK_SOURCE" "$APK_DEST"

# Also copy to client public/dist so it can be downloaded directly from browser
mkdir -p "$PROJECT_DIR/client/dist/download"
cp "$APK_SOURCE" "$PROJECT_DIR/client/dist/download/SyncToDo.apk"

echo "=========================================================="
echo "SUCCESS! APK built successfully at:"
echo "$APK_DEST"
echo "=========================================================="
