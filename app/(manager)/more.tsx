import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { ScreenScroll, Card } from '../../src/components/ui';
import { ListRow, Button } from '../../src/components/form';
import { Icon, type IconName } from '../../src/components/Icon';
import { useTheme, radius, avatarCol } from '../../src/theme';
import { initials } from '../../src/core/format';

const LINKS: { icon: IconName; label: string; href: string }[] = [
  { icon: 'monthlyLog', label: 'Monthly Log', href: '/monthly-log' },
  { icon: 'calendar', label: 'Absence Calendar', href: '/manager/absence-calendar' },
  { icon: 'analytics', label: 'Analytics', href: '/manager/rate-chart' },
  { icon: 'fund', label: 'Mess Fund', href: '/manager/mess-fund' },
  { icon: 'lock', label: 'Month Close', href: '/manager/month-lock' },
  { icon: 'audit', label: 'Audit Log', href: '/manager/audit-log' },
  { icon: 'broadcast', label: 'Broadcasts', href: '/manager/messages' },
  { icon: 'rules', label: 'Mess Rules & Info', href: '/manager/mess-rules' },
  { icon: 'changePassword', label: 'Change Password', href: '/change-password' },
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
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 23,
              backgroundColor: col.bg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: col.fg, fontWeight: '800', fontSize: 15 }}>
              {initials(user?.name ?? '?')}
            </Text>
          </View>
          <View>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{user?.name}</Text>
            <Text style={{ color: colors.text3, fontSize: 12 }}>
              {user?.role === 'manager' ? 'Manager' : 'Sub-manager'} · @{user?.username}
            </Text>
          </View>
        </View>
      </Card>

      <Pressable
        onPress={() => {
          setViewMode('member');
          router.replace('/(member)');
        }}
        style={{
          backgroundColor: colors.accentBg,
          borderRadius: radius,
          paddingVertical: 14,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <Icon name="viewAsMember" size={18} color={colors.accent} />
        <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 15 }}>View as member</Text>
      </Pressable>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {LINKS.map((l, i) => (
          <ListRow
            key={l.href}
            icon={l.icon}
            label={l.label}
            first={i === 0}
            onPress={() => router.push(l.href as any)}
          />
        ))}
      </Card>

      <Button label="Sign out" variant="danger" onPress={signOut} />
    </ScreenScroll>
  );
}
