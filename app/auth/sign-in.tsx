import React, { useState, useEffect } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../lib/authContext';
import { theme } from '../../lib/theme';
import { resolveRoute, AuthState } from '../../lib/navigation';
import { useStore } from '../../lib/store';

const REMEMBERED_EMAIL_KEY = 'sukun_remembered_email';

const sukunLogo = require('../../assets/sukun-logo.png');

export default function SignInScreen() {
  const { signIn, session, profile, family, pendingJoinRequest, authReady } = useAuth();
  const isReady = useStore((s) => s.isReady);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [signInComplete, setSignInComplete] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Load remembered email on mount
  useEffect(() => {
    async function loadRememberedEmail() {
      try {
        const savedEmail = await AsyncStorage.getItem(REMEMBERED_EMAIL_KEY);
        if (savedEmail) {
          setEmail(savedEmail);
          setRememberMe(true);
        }
      } catch (e) {
        console.log('[SignIn] Error loading remembered email:', e);
      }
    }
    loadRememberedEmail();
  }, []);

  // Navigate after sign-in when auth state is ready
  useEffect(() => {
    if (!signInComplete) return;
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
  }, [signInComplete, authReady, isReady, session, profile, family, pendingJoinRequest]);

  async function handleSignIn() {
    if (!email.trim() || !password) {
      setError('Please enter your email and password');
      return;
    }

    setLoading(true);
    setError(null);

    const { error: signInError } = await signIn(email.trim(), password);

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
    } else {
      // Save or clear remembered email
      try {
        if (rememberMe) {
          await AsyncStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim());
        } else {
          await AsyncStorage.removeItem(REMEMBERED_EMAIL_KEY);
        }
      } catch (e) {
        console.log('[SignIn] Error saving remembered email:', e);
      }
      // Mark sign-in complete to trigger navigation via useEffect
      setSignInComplete(true);
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
          <Text style={styles.subtitle}>Sign in to your Sukun account</Text>
        </View>

        <View style={styles.form}>
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={20} color={theme.colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                testID="input-email"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor={theme.colors.textMuted}
                secureTextEntry={!showPassword}
                autoComplete="password"
                testID="input-password"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
                testID="button-toggle-password"
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.rememberMeContainer}
            onPress={() => setRememberMe(!rememberMe)}
            testID="checkbox-remember-me"
          >
            <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
              {rememberMe && (
                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
              )}
            </View>
            <Text style={styles.rememberMeText}>Remember my email</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignIn}
            disabled={loading}
            testID="button-sign-in"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Link href="/auth/sign-up" asChild>
              <TouchableOpacity testID="link-sign-up">
                <Text style={styles.linkText}>Sign Up</Text>
              </TouchableOpacity>
            </Link>
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>for kids</Text>
            <View style={styles.dividerLine} />
          </View>

          <Link href="/auth/passcode-login" asChild>
            <TouchableOpacity style={styles.participantButton} testID="link-participant-login">
              <Ionicons name="keypad-outline" size={20} color="#FFFFFF" />
              <Text style={styles.participantButtonText}>Login with Code</Text>
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
  inputGroup: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  inputIcon: {
    paddingLeft: theme.spacing.sm,
  },
  input: {
    flex: 1,
    padding: theme.spacing.sm,
    fontSize: 16,
    color: theme.colors.text,
  },
  eyeButton: {
    padding: theme.spacing.sm,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  rememberMeText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  button: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
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
  participantButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  participantButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
