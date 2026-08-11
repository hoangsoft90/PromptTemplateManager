// components/VariableField.tsx — single variable input (text or textarea).
// Textarea fields get an Expand toggle (spec C2); error state = red border.

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '../lib/theme';
import type { Variable } from '../lib/variableEngine';

interface Props {
  variable: Variable;
  value: string;
  error?: boolean;
  onChangeText: (value: string) => void;
}

export function VariableField({ variable, value, error, onChangeText }: Props) {
  const [expanded, setExpanded] = useState(false);
  const isTextarea = variable.inputType === 'textarea';

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{variable.label}</Text>
        {variable.placeholder ? (
          <Text style={styles.hint} numberOfLines={1}>
            {variable.placeholder}
          </Text>
        ) : null}
      </View>

      {isTextarea ? (
        <>
          <TextInput
            style={[
              styles.textarea,
              expanded && styles.textareaExpanded,
              error && styles.inputError,
            ]}
            value={value}
            onChangeText={onChangeText}
            multiline
            placeholder={`Enter ${variable.label.toLowerCase()}…`}
            placeholderTextColor={colors.textMuted}
            textAlignVertical="top"
            accessibilityLabel={variable.label}
          />
          <Pressable onPress={() => setExpanded((e) => !e)} hitSlop={6}>
            <Text style={styles.expandText}>{expanded ? '▲ Collapse' : '▼ Expand'}</Text>
          </Pressable>
        </>
      ) : (
        <TextInput
          style={[styles.input, error && styles.inputError]}
          value={value}
          onChangeText={onChangeText}
          placeholder={`Enter ${variable.label.toLowerCase()}…`}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={variable.label}
        />
      )}

      {error && <Text style={styles.errorText}>This field is required</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.lg },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  label: { ...typography.subtitle, fontSize: 15 },
  hint: { ...typography.caption, flexShrink: 1, textAlign: 'right' },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.textPrimary,
  },
  textarea: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.textPrimary,
    minHeight: 96,
    maxHeight: 140,
  },
  textareaExpanded: { minHeight: 200, maxHeight: 280 },
  inputError: { borderColor: colors.danger, borderWidth: 1.5, backgroundColor: colors.dangerSoft },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  expandText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: spacing.xs,
    alignSelf: 'flex-end',
  },
});
