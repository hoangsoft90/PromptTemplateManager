// lib/PromptsContext.tsx — shared prompts state for the 3-tab layout.
// All tabs read from this single context so search, favorite toggles, and
// list refreshes stay in sync without redundant DB queries.

import React, { createContext, useContext, type ReactNode } from 'react';
import { usePrompts } from '../hooks/usePrompts';

type PromptsContextValue = ReturnType<typeof usePrompts>;

const PromptsContext = createContext<PromptsContextValue | null>(null);

export function PromptsProvider({ children }: { children: ReactNode }) {
  const value = usePrompts();
  return <PromptsContext.Provider value={value}>{children}</PromptsContext.Provider>;
}

export function usePromptsContext(): PromptsContextValue {
  const ctx = useContext(PromptsContext);
  if (!ctx) throw new Error('usePromptsContext must be used inside <PromptsProvider>');
  return ctx;
}