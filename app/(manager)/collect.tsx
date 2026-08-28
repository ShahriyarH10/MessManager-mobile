import React from 'react';
import { Text } from 'react-native';
import { ScreenScroll, Card } from '../../src/components/ui';
import { useTheme } from '../../src/theme';

export default function Collect() {
  const { colors } = useTheme();
  return (
    <ScreenScroll title="Collect Payment" subtitle="Coming in the next update">
      <Card>
        <Text style={{ color: colors.text2, fontSize: 14, lineHeight: 21 }}>
          The payment-collection flow (auto-allocate a cash payment across meal / rent / utility,
          then generate a printable receipt) is being ported from the web app's collect.js. It's the
          largest single piece and lands next.
        </Text>
      </Card>
    </ScreenScroll>
  );
}
