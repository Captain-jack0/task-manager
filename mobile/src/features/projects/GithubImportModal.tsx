import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { extractErrorMessage } from '../../api/client';
import { AppButton } from '../../components/ui';
import { AppModal } from '../../components/AppModal';
import { colors } from '../../theme';
import type { GithubRepo } from '../../types/api';
import { useGithubRepos } from '../integrations/useGithub';
import { useCreateProject } from './useProjects';

export function GithubImportModal({
  visible,
  onClose,
  existingNames,
}: {
  visible: boolean;
  onClose: () => void;
  existingNames: Set<string>;
}) {
  const { data: repos, isLoading } = useGithubRepos(visible);
  const createProject = useCreateProject();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const doImport = async () => {
    const names = [...selected];
    if (names.length === 0) return;
    setBusy(true);
    try {
      for (const name of names) await createProject.mutateAsync({ name });
      setSelected(new Set());
      onClose();
    } catch (e) {
      Alert.alert('Import failed', extractErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppModal visible={visible} onClose={onClose} title="Import projects from GitHub">
      <Text style={styles.hint}>
        Pick repositories to add as projects — they become normal projects you can assign and
        filter by.
      </Text>

      {isLoading ? (
        <Text style={styles.muted}>Loading repositories…</Text>
      ) : repos && repos.length > 0 ? (
        <ScrollView style={styles.list}>
          {repos.map((r: GithubRepo) => {
            const already = existingNames.has(r.name.toLowerCase());
            const checked = already || selected.has(r.name);
            return (
              <Pressable
                key={r.full_name}
                disabled={already}
                onPress={() => toggle(r.name)}
                style={[styles.row, already && styles.rowDisabled]}
              >
                <View style={[styles.check, checked && styles.checkOn]}>
                  {checked && <Text style={styles.checkMark}>✓</Text>}
                </View>
                <Text style={styles.repo} numberOfLines={1}>
                  {r.full_name}
                </Text>
                {already && <Text style={styles.added}>added</Text>}
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <Text style={styles.muted}>
          No repositories found for this token. A fine-grained token only lists granted repos; a
          classic token needs the “repo” scope.
        </Text>
      )}

      <AppButton
        title={`Import${selected.size > 0 ? ` ${selected.size}` : ''}`}
        onPress={doImport}
        loading={busy}
        disabled={selected.size === 0}
      />
    </AppModal>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  muted: { fontSize: 14, color: colors.muted },
  list: { maxHeight: 320 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  rowDisabled: { opacity: 0.5 },
  check: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkMark: { color: colors.primaryText, fontSize: 12, fontWeight: '700' },
  repo: { flex: 1, fontSize: 14, color: colors.text },
  added: { fontSize: 12, color: colors.faint },
});
