/**
 * Minimal Markdown renderer — same subset the web app's renderMarkdown()
 * supports: # / ## / ### headings, **bold**, *italic*, - list items, blank-line
 * paragraphs.
 */
import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../theme';

type Segment = { text: string; bold?: boolean; italic?: boolean };

function parseInline(line: string): Segment[] {
  const segs: Segment[] = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m.index > last) segs.push({ text: line.slice(last, m.index) });
    if (m[2] != null) segs.push({ text: m[2], bold: true });
    else if (m[3] != null) segs.push({ text: m[3], italic: true });
    last = m.index + m[0].length;
  }
  if (last < line.length) segs.push({ text: line.slice(last) });
  return segs.length ? segs : [{ text: line }];
}

export function Markdown({ text }: { text: string }) {
  const { colors } = useTheme();
  if (!text?.trim()) return null;
  const lines = text.replace(/\r\n/g, '\n').split('\n');

  const blocks: React.ReactNode[] = [];
  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    if (!line.trim()) {
      blocks.push(<View key={`sp${i}`} style={{ height: 8 }} />);
      return;
    }
    const seg = (content: string, style: any, key: string) => (
      <Text key={key} style={style}>
        {parseInline(content).map((s, j) => (
          <Text
            key={j}
            style={{
              fontWeight: s.bold ? '800' : '400',
              fontStyle: s.italic ? 'italic' : 'normal',
            }}
          >
            {s.text}
          </Text>
        ))}
      </Text>
    );
    if (line.startsWith('### ')) blocks.push(seg(line.slice(4), { color: colors.text, fontSize: 14, fontWeight: '800', marginTop: 6 }, `h${i}`));
    else if (line.startsWith('## ')) blocks.push(seg(line.slice(3), { color: colors.text, fontSize: 15, fontWeight: '800', marginTop: 8 }, `h${i}`));
    else if (line.startsWith('# ')) blocks.push(seg(line.slice(2), { color: colors.text, fontSize: 17, fontWeight: '800', marginTop: 8 }, `h${i}`));
    else if (line.startsWith('- '))
      blocks.push(
        <View key={`li${i}`} style={{ flexDirection: 'row', gap: 8 }}>
          <Text style={{ color: colors.text3 }}>•</Text>
          {seg(line.slice(2), { color: colors.text2, fontSize: 13, lineHeight: 20, flex: 1 }, `lit${i}`)}
        </View>,
      );
    else blocks.push(seg(line, { color: colors.text2, fontSize: 13, lineHeight: 21 }, `p${i}`));
  });

  return <View style={{ gap: 3 }}>{blocks}</View>;
}
