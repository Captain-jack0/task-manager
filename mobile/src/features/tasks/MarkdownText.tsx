import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme';
import { inlineSegments } from './markdown';

interface Props {
  text: string;
  /** When given, checklist rows become tappable; `n` is the box's document-order index. */
  onToggleCheckbox?: (n: number, checked: boolean) => void;
}

function Inline({ line, style }: { line: string; style?: object }) {
  return (
    <Text style={[styles.body, style]}>
      {inlineSegments(line).map((seg, i) => (
        <Text key={i} style={seg.bold ? styles.bold : undefined}>
          {seg.text}
        </Text>
      ))}
    </Text>
  );
}

/** Small line-based Markdown renderer: headings, lists, tappable checklists,
 * code fences (monospace), tables (flattened). Enough for task descriptions. */
export function MarkdownText({ text, onToggleCheckbox }: Props) {
  const lines = text.split('\n');
  let inFence = false;
  let box = -1;

  return (
    <View style={styles.wrap}>
      {lines.map((line, i) => {
        if (/^[ \t]*(`{3,}|~{3,})/.test(line)) {
          inFence = !inFence;
          return null;
        }
        if (inFence) {
          return (
            <Text key={i} style={styles.code}>
              {line}
            </Text>
          );
        }
        const cb = /^([ \t]*)(?:[-*+]|\d+[.)])[ \t]+\[( |x|X)\][ \t]*(.*)$/.exec(line);
        if (cb) {
          const n = ++box;
          const checked = cb[2] !== ' ';
          return (
            <Pressable
              key={i}
              onPress={onToggleCheckbox ? () => onToggleCheckbox(n, !checked) : undefined}
              style={[styles.row, { paddingLeft: cb[1].length * 6 }]}
            >
              <Text style={styles.box}>{checked ? '☑' : '☐'}</Text>
              <Inline line={cb[3]} style={checked ? styles.done : undefined} />
            </Pressable>
          );
        }
        const heading = /^[ ]{0,3}#{1,6}[ \t]+(.*)$/.exec(line);
        if (heading) return <Inline key={i} line={heading[1]} style={styles.heading} />;
        const bullet = /^([ \t]*)(?:[-*+]|\d+[.)])[ \t]+(.*)$/.exec(line);
        if (bullet) {
          return (
            <View key={i} style={[styles.row, { paddingLeft: bullet[1].length * 6 }]}>
              <Text style={styles.bulletDot}>•</Text>
              <Inline line={bullet[2]} />
            </View>
          );
        }
        if (/^[ \t]*\|/.test(line)) {
          if (/^[ \t]*\|?[ \t]*:?-{3,}/.test(line)) return null;
          const cells = line.replace(/^[ \t]*\|[ \t]*/, '').replace(/[ \t]*\|[ \t]*$/, '').split(/[ \t]*\|[ \t]*/);
          return (
            <Text key={i} style={styles.mono}>
              {cells.join('   ·   ')}
            </Text>
          );
        }
        if (/^[ \t]*>/.test(line)) return <Inline key={i} line={line.replace(/^[ \t]*>[ \t]?/, '')} style={styles.quote} />;
        if (!line.trim()) return <View key={i} style={styles.gap} />;
        return <Inline key={i} line={line} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 3 },
  body: { fontSize: 15, color: colors.text, lineHeight: 22, flexShrink: 1 },
  bold: { fontWeight: '700' },
  heading: { fontSize: 16, fontWeight: '700', marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  box: { fontSize: 18, lineHeight: 22, color: colors.primary },
  done: { textDecorationLine: 'line-through', color: colors.faint },
  bulletDot: { fontSize: 15, lineHeight: 22, color: colors.muted },
  code: { fontFamily: 'monospace', fontSize: 13, color: colors.text, backgroundColor: colors.bg, paddingHorizontal: 8, lineHeight: 20 },
  mono: { fontFamily: 'monospace', fontSize: 13, color: colors.text, lineHeight: 20 },
  quote: { color: colors.muted, fontStyle: 'italic', borderLeftWidth: 2, borderLeftColor: colors.border, paddingLeft: 8 },
  gap: { height: 6 },
});
