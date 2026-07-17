import * as Clipboard from 'expo-clipboard';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../components/ui';
import { colors } from '../../theme';
import { useCalendarSubscription, useRotateCalendar } from './useCalendar';

export function CalendarCard() {
  const { data, isLoading } = useCalendarSubscription(true);
  const rotate = useRotateCalendar();
  const url = data?.url ?? '';

  const copy = async () => {
    if (!url) return;
    await Clipboard.setStringAsync(url);
    Alert.alert('Copied', 'Feed URL copied to clipboard.');
  };

  const onRotate = () => {
    Alert.alert(
      'Regenerate link',
      'Your current calendar subscription will stop updating.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Regenerate', style: 'destructive', onPress: () => rotate.mutate() },
      ],
    );
  };

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Calendar subscription</Text>
      <Text style={styles.muted}>
        Add this feed to Google/Apple/Outlook Calendar to see tasks with a due date. It updates
        automatically.
      </Text>

      <Text selectable style={styles.url} numberOfLines={2}>
        {isLoading ? 'Loading…' : url}
      </Text>

      <View style={styles.actions}>
        <View style={{ flex: 1 }}>
          <AppButton title="Copy URL" variant="secondary" onPress={copy} disabled={!url} />
        </View>
        <View style={{ flex: 1 }}>
          <AppButton
            title="Regenerate"
            variant="danger"
            onPress={onRotate}
            loading={rotate.isPending}
          />
        </View>
      </View>

      <Text style={styles.faint}>
        Anyone with this link can see your task titles and due dates. Keep it private.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  heading: { fontSize: 15, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  url: {
    fontSize: 12,
    color: colors.text,
    backgroundColor: colors.bg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
  },
  actions: { flexDirection: 'row', gap: 8 },
  faint: { fontSize: 12, color: colors.faint },
});
