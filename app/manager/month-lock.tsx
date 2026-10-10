import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, RefreshControl, Alert } from 'react-native';
import { dbGetMonthLockList, dbSetMonthLocked, logAudit } from '../../src/lib/db';
import { ScreenScroll, Card, Loading, Centered, EmptyState } from '../../src/components/ui';
import { Button } from '../../src/components/form';
import { Icon } from '../../src/components/Icon';
import { monthLabelFromKey } from '../../src/core/format';
import { useTheme, radius } from '../../src/theme';
import { useRouteProgress } from '../../src/components/motion';

type Row = { key: string; locked: boolean; mealDays: number; bazarDays: number };

export default function MonthLock() {
  const { colors } = useTheme();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  useRouteProgress(loading);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await dbGetMonthLockList());
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && rows.length === 0) return <Loading label="Loading…" />;
  if (error && rows.length === 0)
    return (
      <Centered>
        <Text style={{ color: colors.red }}>{error}</Text>
        <Pressable onPress={load}>
          <Text style={{ color: colors.accent }}>Retry</Text>
        </Pressable>
      </Centered>
    );

  const toggle = (row: Row) => {
    const label = monthLabelFromKey(row.key);
    Alert.alert(
      row.locked ? `Unlock ${label}?` : `Lock ${label}?`,
      row.locked
        ? 'Edits to meals, bazar, utility and rent will be allowed again.'
        : 'No further saves to meals, bazar, utility or rent will be allowed for this month.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: row.locked ? 'Unlock' : 'Lock',
          onPress: async () => {
            setBusyKey(row.key);
            try {
              await dbSetMonthLocked(row.key, !row.locked);
              await logAudit('update', 'month_lock', row.key, `${!row.locked ? 'Locked' : 'Unlocked'} ${label}`);
              await load();
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Failed.');
            } finally {
              setBusyKey(null);
            }
          },
        },
      ],
    );
  };

  return (
    <ScreenScroll
      title="Month Close"
      subtitle="Lock a month to freeze its data"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}
    >
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon="lock" text="No months with data yet." />
        </Card>
      ) : (
        rows.map((row) => (
          <View
            key={row.key}
            style={{
              backgroundColor: colors.bg2,
              borderColor: row.locked ? colors.green : colors.border,
              borderWidth: 1.5,
              borderRadius: radius,
              padding: 16,
              gap: 12,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
                  {monthLabelFromKey(row.key)}
                </Text>
                <Text style={{ color: colors.text3, fontSize: 11, marginTop: 2 }}>
                  {row.mealDays} meal days · {row.bazarDays} bazar days
                </Text>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  backgroundColor: row.locked ? colors.greenBg : colors.bg3,
                  borderRadius: 99,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                }}
              >
                <Icon name={row.locked ? 'lock' : 'unlock'} size={12} color={row.locked ? colors.green : colors.text3} />
                <Text style={{ color: row.locked ? colors.green : colors.text3, fontSize: 11, fontWeight: '700' }}>
                  {row.locked ? 'Locked' : 'Open'}
                </Text>
              </View>
            </View>
            <Button
              label={row.locked ? 'Unlock month' : 'Close & lock month'}
              variant={row.locked ? 'ghost' : 'primary'}
              busy={busyKey === row.key}
              onPress={() => toggle(row)}
            />
          </View>
        ))
      )}
    </ScreenScroll>
  );
}
