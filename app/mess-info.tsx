import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, RefreshControl } from 'react-native';
import { dbGetMessRules, type MessRules } from '../src/lib/db';
import { ScreenScroll, Card, CardTitle, Loading } from '../src/components/ui';
import { Markdown } from '../src/components/Markdown';
import { useTheme, radiusSm } from '../src/theme';

export default function MessInfo() {
  const { colors } = useTheme();
  const [rules, setRules] = useState<MessRules | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setRules(await dbGetMessRules());
    } catch {
      setRules(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && rules === undefined) return <Loading label="Loading mess info…" />;

  const hasAny = rules && (rules.wifi_pass || rules.bank_info || rules.rules_text || rules.contacts);

  return (
    <ScreenScroll
      title="Mess Info"
      subtitle="Rules, WiFi, payment info, contacts"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}
    >
      {!hasAny ? (
        <Card>
          <Text style={{ color: colors.text3, fontSize: 14 }}>
            Your manager hasn't set any mess info yet.
          </Text>
        </Card>
      ) : (
        <>
          {rules?.wifi_pass ? (
            <Card>
              <CardTitle>🔑 WiFi Password</CardTitle>
              <View style={{ backgroundColor: colors.bg4, borderRadius: radiusSm, padding: 12 }}>
                <Text selectable style={{ color: colors.accent, fontSize: 18, fontWeight: '800', fontFamily: 'monospace' }}>
                  {rules.wifi_pass}
                </Text>
              </View>
            </Card>
          ) : null}
          {rules?.bank_info ? (
            <Card>
              <CardTitle>💳 Payment Info</CardTitle>
              <Text selectable style={{ color: colors.text2, fontSize: 14, lineHeight: 21 }}>
                {rules.bank_info}
              </Text>
            </Card>
          ) : null}
          {rules?.rules_text ? (
            <Card>
              <CardTitle>📜 Mess Rules</CardTitle>
              <Markdown text={rules.rules_text} />
            </Card>
          ) : null}
          {rules?.contacts ? (
            <Card>
              <CardTitle>📞 Emergency Contacts</CardTitle>
              <Text selectable style={{ color: colors.text2, fontSize: 14, lineHeight: 21 }}>
                {rules.contacts}
              </Text>
            </Card>
          ) : null}
        </>
      )}
    </ScreenScroll>
  );
}
