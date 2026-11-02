# HelaCart release shrinking rules (R8). Flutter, Firebase and the Flutter
# plugins ship their own consumer rules; these only cover gaps.

# Readable Crashlytics stack traces (https://firebase.google.com/docs/crashlytics/get-deobfuscated-reports).
-keepattributes SourceFile,LineNumberTable
-keep public class * extends java.lang.Exception

# Flutter embedding references Play Core deferred-component classes that this
# app does not ship.
-dontwarn com.google.android.play.core.**

# Flutter engine entry points.
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.util.** { *; }
-keep class io.flutter.view.** { *; }
-keep class io.flutter.embedding.** { *; }
-keep class io.flutter.plugins.** { *; }

# Firebase Messaging background isolate service and receivers.
-keep class io.flutter.plugins.firebase.messaging.** { *; }
-keep class com.google.firebase.messaging.** { *; }
