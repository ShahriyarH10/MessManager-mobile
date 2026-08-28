import React from 'react';
import { View, Text, Pressable, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useMessData } from '../../src/hooks/useMessData';
import { ScreenScroll, Card, CardTitle, Loading, Centered } from '../../src/components/ui';
import { Badge } from '../../src/components/form';
import { useTheme, radiusSm, avatarCol } from '../../src/theme';
import { initials, fmtTk } from '../../src/core/format';

export default function People() {
  const { colors } = useTheme();
  const router = useRouter();
  const { data, loading, error, refresh } = useMessData();

  if (loading && !data) return <Loading label="Loading members…" />;
  if (error && !data)
    return (
      <Centered>
        <Text style={{ color: colors.red }}>{error}</Text>
        <Pressable onPress={refresh}>
          <Text style={{ color: colors.accent }}>Retry</Text>
        </Pressable>
      </Centered>
    );
  if (!data) return null;

  return (
    <ScreenScroll
      title="Members"
      subtitle={`${data.members.length} in this mess`}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />}
    >
      <Card>
        <Text style={{ color: colors.text3, fontSize: 12, lineHeight: 18 }}>
          Adding, editing and removing members, password resets and role changes are being ported
          next. For now this is a read-only roster.
        </Text>
      </Card>

      {data.members.map((m, i) => {
        const col = avatarCol(i);
        return (
          <Card key={m.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: col.bg, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: col.fg, fontWeight: '800' }}>{initials(m.name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>{m.name}</Text>
                <Text style={{ color: colors.text3, fontSize: 12 }}>
                  @{m.username} · Room {m.room || '—'}
                  {m.phone ? ` · ${m.phone}` : ''}
                </Text>
              </View>
              {m.role !== 'member' ? (
                <Badge text={m.role === 'manager' ? 'Manager' : 'Sub-manager'} tone="amber" />
              ) : null}
            </View>
            {Number(m.rent || 0) > 0 ? (
              <Text style={{ color: colors.text3, fontSize: 11, marginTop: 8 }}>
                Default rent {fmtTk(Number(m.rent))}
              </Text>
            ) : null}
          </Card>
        );
      })}
    </ScreenScroll>
  );
}
