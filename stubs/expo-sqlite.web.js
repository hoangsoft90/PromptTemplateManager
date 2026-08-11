// stubs/expo-sqlite.web.js
// Web stub for the native-only SQLite module. The web platform uses the
// localStorage backend (db/promptRepository.web.ts), so expo-sqlite is never
// invoked on web — this stub only exists so Metro can drop the real module
// (+ wa-sqlite .wasm, ~621KB) from the web bundle.
// See metro.config.js resolveRequest.

const openDatabaseAsync = async () => {
  throw new Error(
    'expo-sqlite is not available on web — the app uses the localStorage backend.'
  );
};

export default { openDatabaseAsync };
export { openDatabaseAsync };
