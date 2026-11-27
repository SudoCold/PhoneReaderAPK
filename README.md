# Origin Reader

An Android reader that shows a few words at a time. Tap the **right half** of the reading screen for the next chunk or picture. Tap the **left half** to go back. No scrolling is needed in the reader.

Install [Origin Reader 2.0 APK](releases/Origin-Reader-2.0.0.apk) on your Android phone. This is a locally debug-signed APK for direct installation, not a Play Store release. Android 7.0+ with an updated Android System WebView is required. The new package ID is `com.origin.reader`, so it can be installed alongside the original APK without removing its data. Libraries are separate.

The default is **6 words per tap**, adjustable from 1 to 12. Text fits the available screen, using your chosen text size as its maximum. Only one chunk or one image is visible at a time. For example:

1. `the quick brown fox jumps over`
2. `the lazy dog`
3. The image

Images are separate steps and never count toward the word limit. Partial text chunks finish before an image; text after the image starts a new chunk. Images stay on screen until you tap. The image viewer provides zoom and scrolling for a closer look.

The app includes a local library, saved positions, search, reading filters, paper/evening themes, serif/sans fonts, and optional auto-read that pauses at every image. Documents, pictures, fonts, and PDF support are stored locally. There is no account or server.

Supported imports: PDF, TXT, Markdown, HTML, PNG, JPEG, WebP, GIF, AVIF, and BMP. Paste text and insert images at the cursor, or paste an image from your clipboard. For Markdown/HTML referencing local images, select the document and its image files together. HTTPS images are downloaded during import when their host permits it, then stored offline. Images are saved as still frames. Each source file must be under 100 MB.

PDF image placement uses visual coordinates for an approximate top-to-bottom, left-to-right sequence. Complex columns and overlapping text/figures can need a different reading order. Pages without selectable text are shown as whole-page images; OCR is not included.

## Development

The original repository contained the compiled APK and no application source. This recreation uses React, TypeScript, Vite, and Capacitor. The original APK is preserved at the repository root.

Use Node.js 24+, JDK 21, and Android SDK Platform 36 with Build Tools 35 or newer.

```powershell
npm ci
npm run dev
npm test
npm run build
npm run test:e2e
```

Browser tests use Chrome on Windows (override with `CHROME_PATH`), or Playwright Chromium on other platforms. They cover actual left/right taps, the exact six-word example, saved position, image attachments and zoom, PDF text/image order, automatic playback pausing on pictures, and phone/landscape layouts.

To build the Android APK with an existing SDK:

```powershell
$env:JAVA_HOME = 'C:\path\to\jdk-21'
$env:ANDROID_HOME = 'C:\path\to\Android\Sdk'
npm run android:build
```

The Windows build script copies the result to `releases/Origin-Reader-2.0.0.apk`. It keeps Gradle caches and Android user files in the ignored `.tools` directory. Keep the same signing keystore for future updates. For Play Store distribution, configure a private release signing key in Android Studio.

For a machine without a JDK or SDK, `node scripts/setup-android.mjs` downloads JDK 21 and Android command-line tools into `.tools` without changing system configuration. Install `platforms;android-36` and `build-tools;35.0.0` using the SDK Manager at `.tools/android-sdk/cmdline-tools/legacy/cmdline-tools/bin/sdkmanager.bat`, then run the Android build. The build script reads `.tools/android-env.json` automatically when present.

The UI uses the ui-ux-pro-max skill’s editorial/minimal direction, adapted to warm paper, forest green, locally bundled Source Serif 4 and Inter, 48 px tap controls, visible keyboard focus, device safe areas, and reduced motion.
