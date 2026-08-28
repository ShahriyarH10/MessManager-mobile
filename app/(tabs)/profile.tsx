import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { ScreenScroll, Card, CardTitle } from '../../src/components/ui';
import { useTheme, radiusSm } from '../../src/theme';

export default function Profile() {
  const { colors } = useTheme();
  const { user, mess, signOut } = useAuth();

  return (
    <ScreenScroll title="My Profile" subtitle={mess?.name ?? undefined}>
      <Card>
        <CardTitle>Account</CardTitle>
        <Field label="Name" value={user?.name ?? '—'} />
        <Field label="Username" value={user?.username ?? '—'} />
        <Field label="Role" value={user?.role ?? '—'} />
        <Field label="Mess" value={mess?.name ?? '—'} />
        {mess?.location ? <Field label="Location" value={mess.location} /> : null}
      </Card>

      <Card>
        <CardTitle>Coming next</CardTitle>
        <Text style={{ color: colors.text3, fontSize: 13, lineHeight: 20 }}>
          Personal stats, settlement breakdown by period, and recent-months history — ported from
          loadMyProfile() in js/member/dashboard.js.
        </Text>
      </Card>

      <Pressable
        onPress={signOut}
        style={{
          backgroundColor: colors.redBg,
          borderRadius: radiusSm,
          paddingVertical: 13,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: colors.red, fontWeight: '700', fontSize: 15 }}>Sign out</Text>
      </Pressable>
    </ScreenScroll>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 9,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <Text style={{ color: colors.text3, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}
