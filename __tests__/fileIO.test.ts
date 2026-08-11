// __tests__/fileIO.test.ts — unit tests for the web-safe file helpers.
//
// Mocking strategy:
//   - Platform.OS: babel-preset-expo only inlines `Platform.OS` in production
//     builds, so under Jest we can flip it at runtime with jest.replaceProperty.
//   - expo-file-system / expo-sharing: replaced with jest.fn() factories so we
//     can assert the native path without touching real native modules.
//   - fetch / document / URL: jest-expo runs in a Node environment (no DOM),
//     so the web-path globals are faked per test and restored afterwards.

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { exportJsonFile, readTextFile } from '../lib/fileIO';

jest.mock('expo-file-system', () => ({
  File: jest.fn(),
  Paths: { cache: '/mock/cache' },
}));

jest.mock('expo-sharing', () => ({
  shareAsync: jest.fn(),
}));

const MockFile = File as unknown as jest.Mock;
const mockShareAsync = Sharing.shareAsync as jest.Mock;

// Save the Node globals we fake out so tests can restore them.
const originalDocument = (globalThis as any).document;
const originalURL = (globalThis as any).URL;
const originalFetch = (globalThis as any).fetch;

function mockPlatform(os: 'ios' | 'android' | 'web'): void {
  jest.restoreAllMocks(); // undo any previous replaceProperty
  jest.clearAllMocks(); // reset call history of the module-factory mocks (File, shareAsync)
  jest.replaceProperty(Platform, 'OS', os);
}

describe('readTextFile', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    (globalThis as any).fetch = originalFetch;
  });

  describe('on web', () => {
    beforeEach(() => mockPlatform('web'));

    it('reads the file body via fetch', async () => {
      (globalThis as any).fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => '{"hello":"web"}',
      });
      await expect(readTextFile('https://example.com/backup.json')).resolves.toBe(
        '{"hello":"web"}'
      );
      expect((globalThis as any).fetch).toHaveBeenCalledWith('https://example.com/backup.json');
    });

    it('supports blob: URLs (document-picker assets on web)', async () => {
      (globalThis as any).fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => '{"from":"blob"}',
      });
      await expect(readTextFile('blob:fake-uuid')).resolves.toBe('{"from":"blob"}');
      expect((globalThis as any).fetch).toHaveBeenCalledWith('blob:fake-uuid');
    });

    it('throws a friendly error on a non-ok response', async () => {
      (globalThis as any).fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });
      await expect(readTextFile('http://example.com/backup.json')).rejects.toThrow('HTTP 404');
    });

    it('never constructs expo-file-system File on web', async () => {
      (globalThis as any).fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'x',
      });
      await readTextFile('http://example.com/x.json');
      expect(MockFile).not.toHaveBeenCalled();
    });
  });

  describe('on native', () => {
    beforeEach(() => mockPlatform('ios'));

    it('reads the file via expo-file-system File.text()', async () => {
      const instance = { text: jest.fn().mockResolvedValue('native text') };
      MockFile.mockReturnValue(instance);
      await expect(readTextFile('/data/backup.json')).resolves.toBe('native text');
      expect(MockFile).toHaveBeenCalledWith('/data/backup.json');
      expect(instance.text).toHaveBeenCalledTimes(1);
    });

    it('does not call fetch on native', async () => {
      (globalThis as any).fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'should not be used',
      });
      MockFile.mockReturnValue({ text: jest.fn().mockResolvedValue('native') });
      await readTextFile('/data/x.json');
      expect((globalThis as any).fetch).not.toHaveBeenCalled();
    });
  });
});

describe('exportJsonFile', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    (globalThis as any).document = originalDocument;
    (globalThis as any).URL = originalURL;
  });

  describe('on web', () => {
    let anchor: { href: string; download: string; click: jest.Mock };
    let createObjectURL: jest.Mock;
    let revokeObjectURL: jest.Mock;

    beforeEach(() => {
      mockPlatform('web');
      jest.useFakeTimers();
      anchor = { href: '', download: '', click: jest.fn() };
      (globalThis as any).document = {
        createElement: jest.fn(() => anchor),
        body: { appendChild: jest.fn(), removeChild: jest.fn() },
      };
      createObjectURL = jest.fn(() => 'blob:mock-export');
      revokeObjectURL = jest.fn();
      (globalThis as any).URL = { createObjectURL, revokeObjectURL };
    });

    it('downloads the JSON via a blob URL anchor, then revokes late', async () => {
      await exportJsonFile('backup.json', '{"a":1}');

      const blob = createObjectURL.mock.calls[0][0] as Blob;
      expect(await blob.text()).toBe('{"a":1}');
      expect((globalThis as any).document.createElement).toHaveBeenCalledWith('a');
      expect(anchor.download).toBe('backup.json');
      expect(anchor.href).toBe('blob:mock-export');
      expect(anchor.click).toHaveBeenCalledTimes(1);
      expect((globalThis as any).document.body.appendChild).toHaveBeenCalledWith(anchor);
      expect((globalThis as any).document.body.removeChild).toHaveBeenCalledWith(anchor);

      // The URL is only revoked after the 60s grace period.
      expect(revokeObjectURL).not.toHaveBeenCalled();
      jest.advanceTimersByTime(60_000);
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-export');
    });

    it('never touches expo-file-system or sharing on web', async () => {
      await exportJsonFile('backup.json', '{}');
      expect(MockFile).not.toHaveBeenCalled();
      expect(mockShareAsync).not.toHaveBeenCalled();
    });
  });

  describe('on native', () => {
    beforeEach(() => mockPlatform('android'));

    it('writes to the cache directory and opens the share sheet', async () => {
      const target = {
        uri: 'file:///mock/cache/backup.json',
        create: jest.fn(),
        write: jest.fn(),
      };
      MockFile.mockReturnValue(target);
      mockShareAsync.mockResolvedValue(undefined);

      await exportJsonFile('backup.json', '{"a":1}');

      expect(MockFile).toHaveBeenCalledWith('/mock/cache', 'backup.json');
      expect(target.create).toHaveBeenCalledWith({ overwrite: true, intermediates: true });
      expect(target.write).toHaveBeenCalledWith('{"a":1}');
      expect(mockShareAsync).toHaveBeenCalledWith('file:///mock/cache/backup.json', {
        mimeType: 'application/json',
        dialogTitle: 'Export prompts',
        UTI: 'public.json',
      });
    });
  });
});
