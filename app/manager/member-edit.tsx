import React, { useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { dbGetMembers } from '../../src/lib/db';
import { addMember, updateMember } from '../../src/lib/memberAdmin';
import { ScreenScroll, Card, Loading } from '../../src/components/ui';
import { Button, Field, TextField, NumberField, DateField } from '../../src/components/form';
import { useTheme } from '../../src/theme';
import type { Member } from '../../src/core/types';

export default function MemberEdit() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;

  const [all, setAll] = useState<Member[] | null>(null);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [room, setRoom] = useState('');
  const [phone, setPhone] = useState('');
  const [joined, setJoined] = useState('');
  const [mealDay, setMealDay] = useState('1');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    dbGetMembers().then((ms) => {
      setAll(ms);
      if (id) {
        const m = ms.find((x) => x.id === id);
        if (m) {
          setName(m.name);
          setUsername(m.username);
          setRoom(m.room ?? '');
          setPhone(m.phone ?? '');
          setJoined(m.joined ?? '');
          setMealDay(String(m.meal_default_day ?? 1));
        }
      }
    });
  }, [id]);

  if (!all) return <Loading />;

  const submit = async () => {
    setErr(null);
    setBusy(true);
    try {
      const payload = {
        id: id || undefined,
        name,
        username,
        password: password || undefined,
        room,
        phone,
        joined: joined || null,
        meal_default_day: parseFloat(mealDay || '1'),
      };
      if (editing) await updateMember(payload, all);
      else await addMember(payload, all);
      Alert.alert('Saved', editing ? 'Member updated.' : `${name} added.`);
      router.back();
    } catch (e: any) {
      setErr(e?.message ?? 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenScroll title={editing ? 'Edit member' : 'Add member'} subtitle={editing ? name : 'New roommate account'}>
      <Card>
        <View style={{ gap: 14 }}>
          <Field label="Full name">
            <TextField value={name} onChangeText={setName} placeholder="e.g. Rakib Hasan" autoCapitalize="sentences" />
          </Field>
          <Field label="Username">
            <TextField value={username} onChangeText={setUsername} placeholder="e.g. rakib" autoCapitalize="none" />
          </Field>
          <Field label={editing ? 'Password (leave blank to keep)' : 'Password'}>
            <TextField value={password} onChangeText={setPassword} placeholder="min 6 characters" secureTextEntry autoCapitalize="none" />
          </Field>
          <Field label="Room">
            <TextField value={room} onChangeText={setRoom} placeholder="Room 3A" />
          </Field>
          <Field label="Phone">
            <TextField value={phone} onChangeText={setPhone} placeholder="017xxxxxxxx" keyboardType="numeric" />
          </Field>
          <Field label="Joined date">
            <DateField value={joined} onChange={setJoined} />
          </Field>
          <Field label="Default day meals">
            <NumberField value={mealDay} onChangeText={setMealDay} placeholder="1" />
          </Field>
          {err ? <Text style={{ color: colors.red, fontSize: 13 }}>{err}</Text> : null}
          <Button label={editing ? 'Save changes' : 'Add member'} onPress={submit} busy={busy} />
        </View>
      </Card>
    </ScreenScroll>
  );
}
