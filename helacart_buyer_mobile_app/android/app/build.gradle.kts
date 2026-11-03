import java.io.FileInputStream
import java.util.Base64
import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Native Firebase configuration (google-services.json from `flutterfire configure`
// or the Firebase console) is optional for development builds. When present, the
// Google Services and Crashlytics Gradle plugins are applied together.
val hasNativeFirebaseConfig = file("google-services.json").exists()
if (hasNativeFirebaseConfig) {
    apply(plugin = "com.google.gms.google-services")
    apply(plugin = "com.google.firebase.crashlytics")
}

// Release signing. android/key.properties is never committed; see
// android/key.properties.example and the README "Release signing" section.
val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
val hasReleaseKeystore = keystorePropertiesFile.exists()
if (hasReleaseKeystore) {
    FileInputStream(keystorePropertiesFile).use { keystoreProperties.load(it) }
}
val buildsRelease = gradle.startParameter.taskNames.any { it.contains("Release", ignoreCase = true) }
if (buildsRelease && !hasReleaseKeystore) {
    logger.warn(
        "WARNING: android/key.properties was not found. This release build is signed with the " +
            "DEBUG key and cannot be uploaded to Google Play. Copy android/key.properties.example " +
            "to android/key.properties and point it at the upload keystore.",
    )
}

// Flutter passes --dart-define / --dart-define-from-file values to Gradle as a
// comma-separated list of base64 "KEY=value" entries. APP_LINK_HOST feeds the
// verified App Links intent filter so it always matches the Dart deep-link parser.
val dartDefines: Map<String, String> =
    (project.findProperty("dart-defines") as String?)
        ?.split(",")
        ?.mapNotNull { entry ->
            runCatching { String(Base64.getDecoder().decode(entry), Charsets.UTF_8) }.getOrNull()
        }
        ?.mapNotNull { pair ->
            val index = pair.indexOf('=')
            if (index <= 0) null else pair.substring(0, index) to pair.substring(index + 1)
        }
        ?.toMap()
        ?: emptyMap()
val appLinkHost = dartDefines["APP_LINK_HOST"]?.trim()?.takeIf { it.isNotEmpty() } ?: "helacart.lk"

android {
    namespace = "com.helacart.buyer"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "com.helacart.buyer"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = 24
        targetSdk = flutter.targetSdkVersion
        // versionCode/versionName come from pubspec.yaml (`version: 1.1.0+2`) or
        // --build-number/--build-name. When using split APKs, 1000 * ABI_VERSION
        // is added automatically by Flutter. (https://developer.android.com/studio/build/configure-apk-splits#configure-APK-versions)
        // You can force using the value of versionCode by specifying the `-P force-version-code-ignoring-abi=true`
        // flag during build.
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        manifestPlaceholders["appLinkHost"] = appLinkHost
    }

    sourceSets {
        if (!hasNativeFirebaseConfig) {
            // Without the Crashlytics Gradle plugin there is no Crashlytics build ID.
            // This resource stops the native SDK from aborting start-up in
            // development builds that initialise Firebase from dart-defines only.
            getByName("main").res.srcDir("src/firebaseFallback/res")
        }
    }

    signingConfigs {
        if (hasReleaseKeystore) {
            create("release") {
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
                storeFile = keystoreProperties.getProperty("storeFile")?.let { file(it) }
                storePassword = keystoreProperties.getProperty("storePassword")
            }
        }
    }

    buildTypes {
        release {
            signingConfig =
                if (hasReleaseKeystore) {
                    signingConfigs.getByName("release")
                } else {
                    // Local smoke tests only; never distributed (see warning above).
                    signingConfigs.getByName("debug")
                }
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
