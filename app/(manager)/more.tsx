import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { ScreenScroll, Card } from '../../src/components/ui';
import { useTheme, radius, radiusSm, avatarCol } from '../../src/theme';
import { initials } from '../../src/core/format';

const LINKS: { icon: string; label: string; href: string }[] = [
  { icon: '📋', label: 'Monthly Log', href: '/monthly-log' },
  { icon: '🧾', label: 'Audit Log', href: '/manager/audit-log' },
  { icon: '📢', label: 'Messages', href: '/messages' },
  { icon: '📌', label: 'Mess Info', href: '/mess-info' },
  { icon: '🔑', label: 'Change Password', href: '/change-password' },
];

export default function ManagerMore() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, mess, signOut, setViewMode } = useAuth();
  const col = avatarCol(user?.memberId ?? 'x');

  return (
    <ScreenScroll title="More" subtitle={mess?.name ?? undefined}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: col.bg, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: col.fg, fontWeight: '800' }}>{initials(user?.name ?? '?')}</Text>
          </View>
          <View>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{user?.name}</Text>
            <Text style={{ color: colors.text3, fontSize: 12 }}>
              {user?.role === 'manager' ? '👑 Manager' : '⚡ Sub-manager'} · @{user?.username}
            </Text>
          </View>
        </View>
      </Card>

      <Pressable
        onPress={() => {
          setViewMode('member');
          router.replace('/(member)');
        }}
        style={{ backgroundColor: colors.accentBg, borderRadius: radiusSm, paddingVertical: 13, alignItems: 'center' }}
      >
        <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 15 }}>👤 View as member</Text>
      </Pressable>

      <View style={{ backgroundColor: colors.bg2, borderRadius: radius, overflow: 'hidden' }}>
        {LINKS.map((l, i) => (
          <Pressable
            key={l.href}
            onPress={() => router.push(l.href as any)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              paddingHorizontal: 16,
              paddingVertical: 15,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: colors.border,
            }}
          >
            <Text style={{ fontSize: 18 }}>{l.icon}</Text>
            <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>{l.label}</Text>
            <Text style={{ color: colors.text3, fontSize: 18 }}>›</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={signOut}
        style={{ backgroundColor: colors.redBg, borderRadius: radiusSm, paddingVertical: 13, alignItems: 'center' }}
      >
        <Text style={{ color: colors.red, fontWeight: '700', fontSize: 15 }}>Sign out</Text>
      </Pressable>
    </ScreenScroll>
  );
}
