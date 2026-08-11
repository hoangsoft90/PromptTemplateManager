// hooks/useBackupReminder.ts — backup reminder banner logic (spec B7).
// Show if: countAll() >= 5 AND hasEverExported() === false.
// Dismissible; re-shows after 20 more prompts created if still not exported.

import { useCallback, useEffect, useState } from 'react';
import { countAll, getAppMeta, hasEverExported, setAppMeta } from '../db/promptRepository';

const RE_SHOW_THRESHOLD = 20;

export function useBackupReminder() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [count, exported] = await Promise.all([countAll(), hasEverExported()]);
      if (exported || count < 5) {
        setVisible(false);
        return;
      }
      const raw = await getAppMeta('backup_banner_dismissed_at');
      if (!raw) {
        setVisible(true);
        return;
      }
      try {
        const parsed = JSON.parse(raw) as { count: number };
        setVisible(count >= (parsed.count ?? 0) + RE_SHOW_THRESHOLD);
      } catch {
        setVisible(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const dismiss = useCallback(async () => {
    const count = await countAll();
    await setAppMeta(
      'backup_banner_dismissed_at',
      JSON.stringify({ count, at: Date.now() })
    );
    setVisible(false);
  }, []);

  return { visible, loading, refresh, dismiss };
}
