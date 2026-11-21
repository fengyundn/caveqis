# CAVEQIS for Android

The Android app bundles the shared web interface, Python, and SymPy. The installer supports arm64 and x86-64. Use a current Android System WebView on Android 7 or newer.

## Build

Use JDK 17, Gradle 8.11.1, Android SDK Platform 35, Build Tools 35, and Python 3.14. Point `ANDROID_HOME` at the SDK and `CAVEQIS_BUILD_PYTHON` at the Python executable.

```sh
gradle -p android :app:assembleDebug
```

For a signed release, set `CAVEQIS_ANDROID_KEYSTORE` and `CAVEQIS_ANDROID_KEYSTORE_PASSWORD`. The keystore must use the alias `caveqis` and the same password for the store and key.

```sh
gradle -p android :app:assembleRelease
```

The APK is written to `android/app/build/outputs/apk/`.
