import React, { useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { dbGetMessRules, dbSaveMessRules, logAudit } from '../../src/lib/db';
import { ScreenScroll, Card, CardTitle, Loading } from '../../src/components/ui';
import { Button, Field, TextField } from '../../src/components/form';
import { Markdown } from '../../src/components/Markdown';
import { useTheme } from '../../src/theme';

export default function MessRulesEditor() {
  const { colors } = useTheme();
  const [loaded, setLoaded] = useState(false);
  const [wifi, setWifi] = useState('');
  const [bank, setBank] = useState('');
  const [rules, setRules] = useState('');
  const [contacts, setContacts] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    dbGetMessRules().then((r) => {
      setWifi(r?.wifi_pass ?? '');
      setBank(r?.bank_info ?? '');
      setRules(r?.rules_text ?? '');
      setContacts(r?.contacts ?? '');
      setLoaded(true);
    });
  }, []);

  if (!loaded) return <Loading />;

  const save = async () => {
    setBusy(true);
    try {
      await dbSaveMessRules({ wifi_pass: wifi, bank_info: bank, rules_text: rules, contacts });
      await logAudit('update', 'mess_rules', '', 'Updated mess rules & info');
      Alert.alert('Saved', 'Mess info updated.');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenScroll title="Mess Rules & Info" subtitle="Shown to every member">
      <Card>
        <View style={{ gap: 14 }}>
          <Field label="WiFi password">
            <TextField value={wifi} onChangeText={setWifi} placeholder="e.g. MyWiFi@123" autoCapitalize="none" />
          </Field>
          <Field label="Bank / payment info">
            <TextField value={bank} onChangeText={setBank} placeholder="e.g. bKash: 01712345678 (Personal)" multiline />
          </Field>
          <Field label="Emergency contacts">
            <TextField value={contacts} onChangeText={setContacts} placeholder="Landlord: 017xxx, Gas: 016xxx" multiline />
          </Field>
          <Field label="Mess rules (supports # headings, **bold**, - lists)">
            <TextField
              value={rules}
              onChangeText={setRules}
              placeholder={'# House rules\n- No guests after 11pm\n- **Pay rent by the 5th**'}
              multiline
            />
          </Field>
          <Button label="Save" onPress={save} busy={busy} />
        </View>
      </Card>

      {rules.trim() ? (
        <Card>
          <CardTitle>Rules preview</CardTitle>
          <Markdown text={rules} />
        </Card>
      ) : null}
    </ScreenScroll>
  );
}
