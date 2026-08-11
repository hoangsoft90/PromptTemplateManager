// plugins/withAdsPlayServicesFix.js
//
// Expo config plugin: pins an older `com.google.android.gms:play-services-ads`
// in the generated android project.
//
// Why: react-native-google-mobile-ads@16.4.0 resolves `play-services-ads` 25.4.0,
// a library compiled with Kotlin 2.3 metadata. The RN 0.86 default Kotlin 2.1
// compiler cannot read that metadata, so `:react-native-google-mobile-ads:
// compileReleaseKotlin` fails with:
//
//   Module was compiled with an incompatible version of Kotlin.
//   The binary version of its metadata is 2.3.0, expected version is 2.1.0.
//
// Bumping Kotlin to 2.3.x is not a safe fix either — it breaks
// react-native-safe-area-context (Kotlin 2.3 type-checker crash). Pinning the
// ads SDK to a version compiled with Kotlin ≤ 2.1 keeps the whole tree on the
// default Kotlin 2.1 toolchain.
//
// This appends a Gradle resolution rule to android/build.gradle; prebuild
// regenerates android/ on every build, so the rule must be applied via this
// config plugin (registered in app.json) to persist.

const { withProjectBuildGradle } = require('@expo/config-plugins');

// play-services-ads 24.x (2024) is compiled with Kotlin 1.9/2.0 metadata and is
// API-compatible with what react-native-google-mobile-ads uses.
const PLAY_SERVICES_ADS_VERSION = '24.2.0';

const GRADLE_BLOCK = `

// --- Pin play-services-ads (added by withAdsPlayServicesFix) ---
// react-native-google-mobile-ads resolves play-services-ads 25.4.0 (Kotlin 2.3
// metadata), which the RN 0.86 default Kotlin 2.1 compiler cannot read. Pin an
// older compatible version so the module compiles.
subprojects {
  configurations.configureEach {
    resolutionStrategy.force 'com.google.android.gms:play-services-ads:${PLAY_SERVICES_ADS_VERSION}'
  }
}
`;

module.exports = function withAdsPlayServicesFix(config) {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') return config;
    if (config.modResults.contents.includes('withAdsPlayServicesFix')) return config;
    config.modResults.contents += GRADLE_BLOCK;
    return config;
  });
};
