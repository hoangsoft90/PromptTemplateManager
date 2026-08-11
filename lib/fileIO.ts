// lib/fileIO.ts — web-safe file helpers.
//
// WHY: expo-file-system's new File/Paths API (SDK 57) has NO web
// implementation. On web, `new File(...)` throws "this.validatePath is not a
// function" and every accessor warns "expo-file-system is not supported on
// web". These helpers keep import/export working on both native and web
// (web is a dev/preview target per design.md).
//
//   - readTextFile(uri): native → expo-file-system File.text();
//                        web     → fetch(uri) (handles http(s) and blob: URLs).
//   - exportJsonFile():  native → write to cache dir + expo-sharing;
//                        web     → browser download via Blob + <a download>.

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/** Read a file's text content from a URI (native file path, http(s), or blob:). */
export async function readTextFile(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    if (!res.ok) {
      throw new Error(`Could not read file (HTTP ${res.status}).`);
    }
    return res.text();
  }
  return new File(uri).text();
}

/**
 * Write a JSON export and hand it to the user:
 * native → share sheet; web → regular browser file download.
 */
export async function exportJsonFile(fileName: string, contents: string): Promise<void> {
  if (Platform.OS === 'web') {
    // Plain download — works on every browser with no HTTPS requirement
    // (navigator.share would need HTTPS and is mobile-only).
    const blob = new Blob([contents], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    // Revoke well after the click so the download has time to engage, even on
    // slow connections (a revoked URL would silently kill the download).
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  const target = new File(Paths.cache, fileName);
  target.create({ overwrite: true, intermediates: true });
  target.write(contents);
  await Sharing.shareAsync(target.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Export prompts',
    UTI: 'public.json',
  });
}
