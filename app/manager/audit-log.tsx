import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, RefreshControl } from 'react-native';
import { dbGetAuditLog, type AuditRow } from '../../src/lib/db';
import { ScreenScroll, Card, Loading, Centered } from '../../src/components/ui';
import { SegmentedControl, TextField, Field } from '../../src/components/form';
import { useTheme, radiusSm } from '../../src/theme';
import { useRouteProgress } from '../../src/components/motion';

const CATS: { label: string; value: string }[] = [
  { label: 'All', value: '' },
  { label: 'Meals', value: 'meal' },
  { label: 'Bazar', value: 'bazar' },
  { label: 'Rent', value: 'rent' },
  { label: 'Utility', value: 'utility' },
  { label: 'Members', value: 'member' },
];

const PAGE = 40;

export default function AuditLog() {
  const { colors } = useTheme();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  useRouteProgress(loading);
  const [error, setError] = useState<string | null>(null);
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const [done, setDone] = useState(false);

  const load = useCallback(
    async (reset: boolean) => {
      setError(null);
      try {
        const off = reset ? 0 : offset;
        const batch = await dbGetAuditLog(PAGE, off, cat || null);
        setRows((prev) => (reset ? batch : [...prev, ...batch]));
        setOffset(off + batch.length);
        setDone(batch.length < PAGE);
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load.');
      } finally {
        setLoading(false);
      }
    },
    [cat, offset],
  );

  useEffect(() => {
    setLoading(true);
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) => r.summary.toLowerCase().includes(s) || r.actor_name.toLowerCase().includes(s),
    );
  }, [rows, q]);

  if (loading && rows.length === 0) return <Loading label="Loading audit log…" />;
  if (error && rows.length === 0)
    return (
      <Centered>
        <Text style={{ color: colors.red }}>{error}</Text>
        <Pressable onPress={() => load(true)}>
          <Text style={{ color: colors.accent }}>Retry</Text>
        </Pressable>
      </Centered>
    );

  return (
    <ScreenScroll
      title="Audit Log"
      subtitle="Every data change in your mess"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(true)} tintColor={colors.accent} />}
    >
      <SegmentedControl options={CATS} value={cat} onChange={setCat} />
      <Field label="Search">
        <TextField value={q} onChangeText={setQ} placeholder="summary or member name" autoCapitalize="none" />
      </Field>

      {filtered.length === 0 ? (
        <Centered>
          <Text style={{ color: colors.text3 }}>No matching entries.</Text>
        </Centered>
      ) : (
        <Card>
          {filtered.map((r, i) => (
            <View
              key={r.id}
              style={{
                paddingVertical: 10,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.border,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 13 }}>{r.summary}</Text>
              <Text style={{ color: colors.text3, fontSize: 11, marginTop: 3 }}>
                {r.actor_name} · {r.entity} · {new Date(r.created_at).toLocaleString()}
              </Text>
            </View>
          ))}
        </Card>
      )}

      {!done && !q ? (
        <Pressable
          onPress={() => load(false)}
          style={{ backgroundColor: colors.bg3, borderRadius: radiusSm, paddingVertical: 12, alignItems: 'center' }}
        >
          <Text style={{ color: colors.accent, fontWeight: '700' }}>Load more</Text>
        </Pressable>
      ) : null}
    </ScreenScroll>
  );
}
