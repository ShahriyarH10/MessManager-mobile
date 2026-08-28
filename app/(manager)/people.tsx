import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { dbGetMembers } from '../../src/lib/db';
import { useAuth } from '../../src/context/AuthContext';
import { setSubManager, removeMember, transferManagerRole } from '../../src/lib/memberAdmin';
import { ScreenScroll, Card, CardTitle, Loading, Centered } from '../../src/components/ui';
import { SegmentedControl, Badge, Button } from '../../src/components/form';
import { useTheme, radiusSm, avatarCol } from '../../src/theme';
import { initials } from '../../src/core/format';
import type { Member } from '../../src/core/types';

type Tab = 'members' | 'roles' | 'transfer';

export default function People() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user: me } = useAuth();
  const isFullManager = me?.role === 'manager';

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('members');
  const [transferTarget, setTransferTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setMembers(await dbGetMembers());
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && members.length === 0) return <Loading label="Loading members…" />;
  if (error && members.length === 0)
    return (
      <Centered>
        <Text style={{ color: colors.red }}>{error}</Text>
        <Pressable onPress={load}>
          <Text style={{ color: colors.accent }}>Retry</Text>
        </Pressable>
      </Centered>
    );

  const others = members.filter((m) => m.id !== me?.memberId);

  const confirmRemove = (m: Member) => {
    Alert.alert('Remove member?', `${m.name} will no longer be able to sign in. Their meal/bazar history stays.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeMember(m);
            await load();
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Failed.');
          }
        },
      },
    ]);
  };

  const doRole = (m: Member, promote: boolean) => {
    Alert.alert(
      promote ? `Promote ${m.name}?` : `Demote ${m.name}?`,
      promote
        ? `${m.name} will be able to enter meals, bazar, utility and collect payments.`
        : `${m.name} becomes a regular member.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: promote ? 'Promote' : 'Demote',
          onPress: async () => {
            try {
              await setSubManager(m, promote);
              await load();
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Failed.');
            }
          },
        },
      ],
    );
  };

  const doTransfer = () => {
    const target = members.find((m) => m.id === transferTarget);
    if (!target) {
      Alert.alert('Pick a member first');
      return;
    }
    Alert.alert('Transfer manager role?', `${target.name} becomes the manager. You lose manager access immediately.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Transfer',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await transferManagerRole(target);
            router.replace('/(member)');
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Failed.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const tabs: { label: string; value: Tab }[] = [
    { label: 'Members', value: 'members' },
    { label: 'Roles', value: 'roles' },
  ];
  if (isFullManager) tabs.push({ label: 'Transfer', value: 'transfer' });

  return (
    <ScreenScroll
      title="Members"
      subtitle={`${members.length} in this mess`}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}
    >
      <SegmentedControl options={tabs} value={tab} onChange={setTab} />

      {tab === 'members' && (
        <>
          {isFullManager ? (
            <Button label="+ Add member" onPress={() => router.push('/manager/member-edit')} />
          ) : null}
          {members.map((m, i) => {
            const col = avatarCol(i);
            return (
              <Card key={m.id}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: col.bg, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: col.fg, fontWeight: '800' }}>{initials(m.name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>{m.name}</Text>
                    <Text style={{ color: colors.text3, fontSize: 12 }}>
                      @{m.username} · Room {m.room || '—'}
                    </Text>
                  </View>
                  {m.role !== 'member' ? (
                    <Badge text={m.role === 'manager' ? '👑' : '⚡'} tone="amber" />
                  ) : null}
                </View>
                {isFullManager ? (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    <MiniAction label="Edit / password" onPress={() => router.push({ pathname: '/manager/member-edit', params: { id: m.id } })} />
                    {m.role !== 'manager' ? (
                      <MiniAction label="Remove" danger onPress={() => confirmRemove(m)} />
                    ) : null}
                  </View>
                ) : null}
              </Card>
            );
          })}
        </>
      )}

      {tab === 'roles' && (
        <>
          <Card>
            <CardTitle>What each role can do</CardTitle>
            {[
              ['Enter meals / bazar / bills', 'Manager + Sub'],
              ['Collect payments', 'Manager + Sub'],
              ['Add / remove members', 'Manager only'],
              ['Reset passwords', 'Manager only'],
              ['Transfer / promote roles', 'Manager only'],
            ].map(([perm, who]) => (
              <View key={perm} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                <Text style={{ color: colors.text2, fontSize: 13 }}>{perm}</Text>
                <Text style={{ color: colors.text3, fontSize: 12 }}>{who}</Text>
              </View>
            ))}
          </Card>
          {others.length === 0 ? (
            <Card>
              <Text style={{ color: colors.text3 }}>No other members yet.</Text>
            </Card>
          ) : (
            others.map((m) => (
              <Card key={m.id}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View>
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>{m.name}</Text>
                    <Text style={{ color: colors.text3, fontSize: 12 }}>@{m.username}</Text>
                  </View>
                  {m.role === 'manager' ? (
                    <Badge text="👑 Manager" tone="amber" />
                  ) : !isFullManager ? (
                    <Badge text={m.role === 'sub_manager' ? '⚡ Sub' : 'Member'} tone="muted" />
                  ) : m.role === 'sub_manager' ? (
                    <MiniAction label="Demote" onPress={() => doRole(m, false)} />
                  ) : (
                    <MiniAction label="Promote to sub" onPress={() => doRole(m, true)} />
                  )}
                </View>
              </Card>
            ))
          )}
        </>
      )}

      {tab === 'transfer' && (
        <>
          <Card style={{ backgroundColor: colors.redBg, borderColor: 'transparent' }}>
            <Text style={{ color: colors.red, fontSize: 13 }}>
              ⚠️ After transferring, you lose manager access immediately.
            </Text>
          </Card>
          {others.map((m) => {
            const selected = transferTarget === m.id;
            return (
              <Pressable
                key={m.id}
                onPress={() => setTransferTarget(m.id)}
                style={{
                  backgroundColor: colors.bg2,
                  borderColor: selected ? colors.accent : colors.border,
                  borderWidth: 2,
                  borderRadius: radiusSm,
                  padding: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    borderWidth: 2,
                    borderColor: selected ? colors.accent : colors.text3,
                    backgroundColor: selected ? colors.accent : 'transparent',
                  }}
                />
                <View>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{m.name}</Text>
                  <Text style={{ color: colors.text3, fontSize: 12 }}>@{m.username}</Text>
                </View>
              </Pressable>
            );
          })}
          <Button label="Transfer manager role" variant="danger" onPress={doTransfer} busy={busy} />
        </>
      )}
    </ScreenScroll>
  );
}

function MiniAction({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: danger ? colors.redBg : colors.bg3,
        borderRadius: radiusSm,
        paddingHorizontal: 12,
        paddingVertical: 7,
      }}
    >
      <Text style={{ color: danger ? colors.red : colors.accent, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

