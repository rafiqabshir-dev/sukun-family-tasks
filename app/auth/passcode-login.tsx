import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/authContext';
import { theme } from '../../lib/theme';
import { resolveRoute, AuthState } from '../../lib/navigation';
import { useStore } from '../../lib/store';

const sukunLogo = require('../../assets/sukun-logo.png');

export default function PasscodeLoginScreen() {
  const { signInWithPasscode, session, profile, family, pendingJoinRequest, authReady } = useAuth();
  const isReady = useStore((s) => s.isReady);
  const [passcode, setPasscode] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginComplete, setLoginComplete] = useState(false);
  
  const inputRefs = [
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
  ];

  // Navigate after login when auth state is ready
  useEffect(() => {
    if (!loginComplete) return;
    if (!authReady || !isReady) return;
    
    const authState: AuthState = {
      session: !!session,
      profile: profile ? {
        id: profile.id,
        role: profile.role,
        passcode: profile.passcode,
        family_id: profile.family_id,
      } : null,
      family: family ? { id: family.id } : null,
      pendingJoinRequest: !!pendingJoinRequest,
      authReady: true,
      storeReady: true,
    };
    
    const result = resolveRoute(authState);
    if (result) {
      setLoading(false);
      router.replace(result.path as any);
    }
  }, [loginComplete, authReady, isReady, session, profile, family, pendingJoinRequest]);

  function handleDigitChange(index: number, value: string) {
    if (value.length > 1) {
      value = value.slice(-1);
    }

    if (!/^\d*$/.test(value)) {
      return;
    }

    const newPasscode = [...passcode];
    newPasscode[index] = value;
    setPasscode(newPasscode);
    setError(null);

    if (value && index < 3) {
      inputRefs[index + 1].current?.focus();
    }

    if (value && index === 3 && newPasscode.every(d => d)) {
      handleLogin(newPasscode.join(''));
    }
  }

  function handleKeyPress(index: number, key: string) {
    if (key === 'Backspace' && !passcode[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  }

  async function handleLogin(code?: string) {
    const fullPasscode = code || passcode.join('');
    
    if (fullPasscode.length !== 4) {
      setError('Please enter your 4-digit code');
      return;
    }

    setLoading(true);
    setError(null);

    const { error: loginError } = await signInWithPasscode(fullPasscode);

    if (loginError) {
      setError(loginError.message);
      setLoading(false);
      setPasscode(['', '', '', '']);
      inputRefs[0].current?.focus();
    } else {
      // Mark login complete to trigger navigation via useEffect
      setLoginComplete(true);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Image source={sukunLogo} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>Welcome Back!</Text>
          <Text style={styles.subtitle}>Enter your 4-digit code to log in</Text>
        </View>

        <View style={styles.form}>
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={20} color={theme.colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.passcodeContainer}>
            {passcode.map((digit, index) => (
              <TextInput
                key={index}
                ref={inputRefs[index]}
                style={[
                  styles.passcodeInput,
                  digit && styles.passcodeInputFilled,
                  error && styles.passcodeInputError,
                ]}
                value={digit}
                onChangeText={(value) => handleDigitChange(index, value)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                testID={`input-passcode-${index}`}
              />
            ))}
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={() => handleLogin()}
            disabled={loading || passcode.some(d => !d)}
            testID="button-login"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Log In</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have a code? </Text>
            <Link href="/auth/participant-join" asChild>
              <TouchableOpacity testID="link-join">
                <Text style={styles.linkText}>Join Family</Text>
              </TouchableOpacity>
            </Link>
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <Link href="/auth/sign-in" asChild>
            <TouchableOpacity style={styles.secondaryButton} testID="link-sign-in">
              <Text style={styles.secondaryButtonText}>Sign in with Email</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: theme.spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  form: {
    width: '100%',
    maxWidth: 400,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.dangerLight,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 14,
    flex: 1,
  },
  passcodeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  passcodeInput: {
    width: 60,
    height: 70,
    borderRadius: theme.radius.md,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    color: theme.colors.text,
  },
  passcodeInputFilled: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  passcodeInputError: {
    borderColor: theme.colors.danger,
  },
  button: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: theme.spacing.lg,
  },
  footerText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  linkText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  dividerText: {
    color: theme.colors.textMuted,
    paddingHorizontal: theme.spacing.md,
    fontSize: 14,
  },
  secondaryButton: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  secondaryButtonText: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
});
