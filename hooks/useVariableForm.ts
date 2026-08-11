// hooks/useVariableForm.ts — fill-form state for the Fill & Copy screen.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { extractVariables, renderPrompt, type Variable } from '../lib/variableEngine';

export function useVariableForm(content: string) {
  const variables: Variable[] = useMemo(() => extractVariables(content), [content]);

  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  // Reset whenever the content (prompt) changes.
  useEffect(() => {
    setValues({});
    setErrors({});
  }, [content]);

  const setValue = useCallback((name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: false }));
  }, []);

  const validate = useCallback((): boolean => {
    const next: Record<string, boolean> = {};
    let valid = true;
    for (const v of variables) {
      const value = (values[v.name] ?? '').trim();
      if (!value) {
        next[v.name] = true;
        valid = false;
      }
    }
    setErrors(next);
    return valid;
  }, [variables, values]);

  const rendered = useMemo(() => renderPrompt(content, values), [content, values]);

  const firstInvalidName = useMemo(
    () => variables.find((v) => errors[v.name])?.name ?? null,
    [variables, errors]
  );

  return {
    variables,
    values,
    errors,
    rendered,
    setValue,
    validate,
    firstInvalidName,
  };
}
