// plugins/withReleaseSigning.js
//
// Expo config plugin: injects a `release` signingConfig into the generated
// android/app/build.gradle so the CI (or a local machine) can produce a
// Play-Store-ready AAB signed with the project keystore.
//
// Why a config plugin: prebuild regenerates android/ on every build, so any
// hand edit to build.gradle is lost. This plugin applies the signing block
// from environment variables, which the GitHub Actions workflow sets from
// repository secrets (see .github/workflows/build-aab.yml).
//
// NO-OP when the env vars are absent: debug/test builds and the existing APK
// workflow never set them, so they keep using the default debug keystore and
// this plugin changes nothing.
//
// Env vars read at prebuild time:
//   ANDROID_KEYSTORE_FILE      — path to the keystore (relative to repo root)
//   ANDROID_KEYSTORE_PASSWORD  — keystore store password
//   ANDROID_KEY_ALIAS          — key alias
//   ANDROID_KEY_PASSWORD       — key password

const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withReleaseSigning(config) {
  const file = process.env.ANDROID_KEYSTORE_FILE;
  const storePassword = process.env.ANDROID_KEYSTORE_PASSWORD;
  const keyAlias = process.env.ANDROID_KEY_ALIAS;
  const keyPassword = process.env.ANDROID_KEY_PASSWORD;

  if (!file || !storePassword || !keyAlias || !keyPassword) {
    // No signing env → leave the generated project untouched (debug signing).
    return config;
  }

  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') return config;
    if (config.modResults.contents.includes('withReleaseSigning')) return config;

    const contents = config.modResults.contents;

    // --- 1. Add a `release` signingConfig inside the `signingConfigs {}` block ---
    let next = contents;
    if (!next.includes('signingConfigs.release')) {
      const marker = 'signingConfigs {';
      const signingStart = next.indexOf(marker);
      if (signingStart === -1) return config;
      // The block is `signingConfigs { ... }` indented 4 spaces; its closing
      // brace is the first line that starts with 4 spaces + `}` after the
      // opening marker. (The generated template has no nested blocks that
      // end with a 4-space `}`, so this is unambiguous.)
      const closeIdx = next.indexOf('\n    }', signingStart);
      if (closeIdx === -1) return config;

      const releaseConfig = [
        '',
        '        release {',
        `            storeFile file('${file}')`,
        `            storePassword '${storePassword}'`,
        `            keyAlias '${keyAlias}'`,
        `            keyPassword '${keyPassword}'`,
        '        }',
      ].join('\n');

      next = next.slice(0, closeIdx + 1) + releaseConfig + next.slice(closeIdx + 1);
    }

    // --- 2. Point the `release` buildType at the new signingConfig ---
    // The RN template ships `signingConfig signingConfigs.debug` inside the
    // release buildType too. IMPORTANT: search for `release {` only INSIDE the
    // `buildTypes {` block — the first `release {` in the file is the
    // signingConfigs.release we just added in step 1, not the buildType.
    const TARGET = 'signingConfig signingConfigs.debug';
    const buildTypesMarker = 'buildTypes {';
    const buildTypesIdx = next.indexOf(buildTypesMarker);
    const releaseIdx = buildTypesIdx === -1 ? -1 : next.indexOf('release {', buildTypesIdx);
    if (!next.includes('signingConfig signingConfigs.release') && releaseIdx !== -1) {
      const hit = next.indexOf(TARGET, releaseIdx);
      if (hit !== -1) {
        next = next.slice(0, hit) + 'signingConfig signingConfigs.release' + next.slice(hit + TARGET.length);
      }
    }

    next += '\n// --- release signing injected by withReleaseSigning ---\n';
    config.modResults.contents = next;
    return config;
  });
};
