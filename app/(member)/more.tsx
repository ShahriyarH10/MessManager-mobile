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
  { icon: 'profile', label: 'My Profile', href: '/profile' },
  { icon: 'monthlyLog', label: 'Monthly Log', href: '/monthly-log' },
  { icon: 'broadcast', label: 'Broadcasts', href: '/messages' },
  { icon: 'messInfo', label: 'Mess Info', href: '/mess-info' },
  { icon: 'changePassword', label: 'Change Password', href: '/change-password' },
];

export default function More() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, mess, signOut, isManager, setViewMode } = useAuth();
  const col = avatarCol(user?.memberId ?? user?.username ?? 'x');
  const roleLabel =
    user?.role === 'manager' ? 'Manager' : user?.role === 'sub_manager' ? 'Sub-manager' : 'Member';

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
              {roleLabel} · @{user?.username}
            </Text>
          </View>
        </View>
      </Card>

      {isManager ? (
        <Pressable
          onPress={() => {
            setViewMode('auto');
            router.replace('/(manager)');
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
          <Icon name="switchToManager" size={18} color={colors.accent} />
          <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 15 }}>Back to manager view</Text>
        </Pressable>
      ) : null}

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
