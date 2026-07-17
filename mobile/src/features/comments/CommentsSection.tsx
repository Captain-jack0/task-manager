import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppButton, formatDate } from '../../components/ui';
import { colors } from '../../theme';
import type { Comment, Member } from '../../types/api';
import { useComments, useCreateComment, useDeleteComment } from './useComments';

/** Render a comment body, highlighting @mention tokens. */
function CommentBody({ body }: { body: string }) {
  const parts = body.split(/(@[^\s]+)/g);
  return (
    <Text style={styles.body}>
      {parts.map((part, i) =>
        part.startsWith('@') ? (
          <Text key={i} style={styles.mention}>
            {part}
          </Text>
        ) : (
          <Text key={i}>{part}</Text>
        ),
      )}
    </Text>
  );
}

export function CommentsSection({
  taskId,
  members,
  currentUserId,
}: {
  taskId: string;
  members: Member[];
  currentUserId: string | undefined;
}) {
  const { data: comments, isLoading } = useComments(taskId);
  const create = useCreateComment(taskId);
  const remove = useDeleteComment(taskId);
  const [draft, setDraft] = useState('');

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    create.mutate(body, { onSuccess: () => setDraft('') });
  };

  const insertMention = (email: string) => {
    setDraft((d) => (d.endsWith(' ') || d === '' ? d : d + ' ') + `@${email} `);
  };

  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.heading}>Comments</Text>

      {isLoading ? (
        <Text style={styles.muted}>Loading…</Text>
      ) : comments && comments.length > 0 ? (
        comments.map((c: Comment) => (
          <View key={c.id} style={styles.comment}>
            <View style={styles.commentHead}>
              <Text style={styles.author}>{c.author_email}</Text>
              <Text style={styles.time}>{formatDate(c.created_at)}</Text>
            </View>
            <CommentBody body={c.body} />
            {c.author_id === currentUserId && (
              <Pressable onPress={() => remove.mutate(c.id)} hitSlop={6}>
                <Text style={styles.delete}>Delete</Text>
              </Pressable>
            )}
          </View>
        ))
      ) : (
        <Text style={styles.muted}>No comments yet.</Text>
      )}

      {members.length > 0 && (
        <View style={styles.mentionRow}>
          {members.map((m: Member) => (
            <Pressable key={m.user_id} onPress={() => insertMention(m.email)} style={styles.mentionChip}>
              <Text style={styles.mentionChipText}>@{m.email}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder="Add a comment…"
        placeholderTextColor={colors.faint}
        style={styles.input}
        multiline
      />
      <AppButton title="Comment" onPress={send} loading={create.isPending} disabled={!draft.trim()} />
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 15, fontWeight: '700', color: colors.text },
  muted: { fontSize: 14, color: colors.muted },
  comment: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 6,
  },
  commentHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  author: { fontSize: 13, fontWeight: '600', color: colors.text },
  time: { fontSize: 12, color: colors.faint },
  body: { fontSize: 14, color: colors.text, lineHeight: 20 },
  mention: { color: colors.primary, fontWeight: '600' },
  delete: { fontSize: 12, color: colors.danger, fontWeight: '500' },
  mentionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  mentionChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  mentionChipText: { fontSize: 12, color: colors.primary },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.card,
    minHeight: 44,
  },
});
