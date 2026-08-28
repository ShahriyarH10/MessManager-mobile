import React from 'react';
import { Text } from 'react-native';
import { ScreenScroll, Card } from './ui';
import { useTheme } from '../theme';

export function ComingSoon({ title, note }: { title: string; note: string }) {
  const { colors } = useTheme();
  return (
    <ScreenScroll title={title} subtitle="Not built yet">
      <Card>
        <Text style={{ color: colors.text2, fontSize: 14, lineHeight: 21 }}>{note}</Text>
      </Card>
    </ScreenScroll>
  );
}
