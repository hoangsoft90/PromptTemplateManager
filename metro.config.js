// metro.config.js — register .sql/.wasm files as assets and stub the
// native-only AdMob module on web so the web dev build still bundles.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// .sql files are bundled as assets and read at runtime (db/migrate.ts).
// .wasm is required by expo-sqlite's web worker (wa-sqlite).
config.resolver.assetExts.push('sql', 'wasm');

const ADS_WEB_STUB = path.resolve(
  __dirname,
  'stubs/react-native-google-mobile-ads.web.js'
);

const EXPO_SQLITE_WEB_STUB = path.resolve(__dirname, 'stubs/expo-sqlite.web.js');

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-google-mobile-ads') {
    return { type: 'sourceFile', filePath: ADS_WEB_STUB };
  }
  if (platform === 'web' && moduleName === 'expo-sqlite') {
    return { type: 'sourceFile', filePath: EXPO_SQLITE_WEB_STUB };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
