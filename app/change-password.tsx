import React, { useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { getSession } from '../src/lib/session';
import { changePassword, LoginError } from '../src/lib/auth';
import { ScreenScroll, Card } from '../src/components/ui';
import { Button, Field, TextField } from '../src/components/form';
import { useTheme } from '../src/theme';

export default function ChangePassword() {
  const { colors } = useTheme();
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (next !== confirm) {
      setErr('New passwords do not match.');
      return;
    }
    const memberId = getSession()?.user.memberId;
    if (!memberId) {
      setErr('Not signed in.');
      return;
    }
    setBusy(true);
    try {
      await changePassword(memberId, current, next);
      Alert.alert('Done', 'Your password has been updated.');
      router.back();
    } catch (e) {
      setErr(e instanceof LoginError ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenScroll title="Change Password" subtitle="Confirm your current password, then set a new one">
      <Card>
        <View style={{ gap: 14 }}>
          <Field label="Current password">
            <TextField value={current} onChangeText={setCurrent} secureTextEntry placeholder="Current password" autoCapitalize="none" />
          </Field>
          <Field label="New password">
            <TextField value={next} onChangeText={setNext} secureTextEntry placeholder="Min 6 characters" autoCapitalize="none" />
          </Field>
          <Field label="Confirm new password">
            <TextField value={confirm} onChangeText={setConfirm} secureTextEntry placeholder="Repeat new password" autoCapitalize="none" />
          </Field>
          {err ? <Text style={{ color: colors.red, fontSize: 13 }}>{err}</Text> : null}
          <Button label="Update password" onPress={submit} busy={busy} />
        </View>
      </Card>
    </ScreenScroll>
  );
}
