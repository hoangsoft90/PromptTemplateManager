// app/prompt/new.tsx — Editor (create).

import { safeBack } from '../../lib/navigation';
import React, { useCallback } from 'react';
import { PromptForm, type PromptFormValues } from '../../components/PromptForm';
import { useToast } from '../../components/Toast';
import { createPrompt } from '../../db/promptRepository';

export default function NewPromptScreen() {
  const toast = useToast();

  const handleSubmit = useCallback(
    async (values: PromptFormValues) => {
      try {
        await createPrompt(values);
        toast.show('Prompt created');
        safeBack();
      } catch {
        toast.show('Failed to save prompt');
      }
    },
    [toast]
  );

  return (
    <PromptForm
      submitLabel="Save"
      onSubmit={handleSubmit}
      onCancel={() => safeBack()}
      enablePasteToCreate
    />
  );
}
