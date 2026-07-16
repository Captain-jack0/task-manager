import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { authApi, type AuthCredentials } from '../api/auth';
import { extractErrorMessage } from '../api/client';
import { AppButton, Field } from '../components/ui';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme';

export function LoginScreen() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const creds: AuthCredentials = { email: email.trim(), password };
      const res = mode === 'login' ? await authApi.login(creds) : await authApi.register(creds);
      setAuth(res.access_token, res.user);
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not sign in'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <Text style={styles.title}>Momentum</Text>
          <Text style={styles.subtitle}>
            {mode === 'login' ? 'Sign in to your tasks' : 'Create your account'}
          </Text>
        </View>

        <View style={{ gap: 14 }}>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder="you@example.com"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <AppButton
            title={mode === 'login' ? 'Sign in' : 'Create account'}
            onPress={submit}
            loading={loading}
          />
          <AppButton
            title={mode === 'login' ? 'New here? Create an account' : 'Have an account? Sign in'}
            variant="secondary"
            onPress={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError(null);
            }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, flexGrow: 1, justifyContent: 'center', gap: 32 },
  brand: { alignItems: 'center', gap: 6 },
  title: { fontSize: 32, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 15, color: colors.muted },
  error: { color: colors.danger, fontSize: 13 },
});
