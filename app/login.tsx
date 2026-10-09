import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../src/context/AuthContext';
import { LoginError } from '../src/lib/auth';
import { WEBSITE_URL } from '../src/lib/config';
import { useTheme, radiusSm } from '../src/theme';
import { Loading } from '../src/components/ui';

export default function Login() {
  const { ready, user, area, signIn } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!ready) return <Loading />;
  if (user) return <Redirect href={area === 'manager' ? '/(manager)' : '/(member)'} />;

  const submit = async () => {
    setErr(null);
    setBusy(true);
    try {
      await signIn(username, password);
    } catch (e) {
      setErr(e instanceof LoginError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          paddingHorizontal: 24,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          gap: 18,
        }}
      >
        <View style={{ gap: 6, marginBottom: 8 }}>
          <Text style={{ color: colors.accent, fontSize: 32, fontWeight: '900' }}>MessManager</Text>
          <Text style={{ color: colors.text3, fontSize: 14 }}>Sign in to your mess account</Text>
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.text2, fontSize: 12, fontWeight: '600' }}>Username</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="username"
            placeholderTextColor={colors.text3}
            style={{
              backgroundColor: colors.bg2,
              borderColor: colors.border2,
              borderWidth: 1,
              borderRadius: radiusSm,
              color: colors.text,
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 16,
            }}
          />
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.text2, fontSize: 12, fontWeight: '600' }}>Password</Text>
          <View style={{ position: 'relative', justifyContent: 'center' }}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPw}
              placeholder="••••••••"
              placeholderTextColor={colors.text3}
              onSubmitEditing={submit}
              style={{
                backgroundColor: colors.bg2,
                borderColor: colors.border2,
                borderWidth: 1,
                borderRadius: radiusSm,
                color: colors.text,
                paddingHorizontal: 14,
                paddingVertical: 12,
                paddingRight: 64,
                fontSize: 16,
              }}
            />
            <Pressable
              onPress={() => setShowPw((s) => !s)}
              style={{ position: 'absolute', right: 12, padding: 6 }}
              hitSlop={8}
            >
              <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>
                {showPw ? 'HIDE' : 'SHOW'}
              </Text>
            </Pressable>
          </View>
        </View>

        {err ? (
          <View
            style={{
              backgroundColor: colors.redBg,
              borderRadius: radiusSm,
              padding: 10,
            }}
          >
            <Text style={{ color: colors.red, fontSize: 13 }}>{err}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={submit}
          disabled={busy}
          style={{
            backgroundColor: colors.accent,
            borderRadius: radiusSm,
            paddingVertical: 14,
            alignItems: 'center',
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? (
            <ActivityIndicator color="#1a1816" />
          ) : (
            <Text style={{ color: '#1a1816', fontSize: 16, fontWeight: '800' }}>Sign in</Text>
          )}
        </Pressable>

        <Text style={{ color: colors.text3, fontSize: 11, textAlign: 'center' }}>
          Manager and member accounts are created in the web app.
        </Text>

        <Pressable
          onPress={() => Linking.openURL(WEBSITE_URL).catch(() => {})}
          hitSlop={8}
          accessibilityRole="link"
          style={{ alignSelf: 'center', paddingVertical: 4 }}
        >
          <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700' }}>
            Visit our website ↗
          </Text>
          <Text style={{ color: colors.text3, fontSize: 11, textAlign: 'center', marginTop: 2 }}>
            {WEBSITE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '')}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
