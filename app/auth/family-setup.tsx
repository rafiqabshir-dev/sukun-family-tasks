import React, { useState } from 'react';
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
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/authContext';
import { theme } from '../../lib/theme';

export default function FamilySetupScreen() {
  const { createFamily, joinFamily, profile, family } = useAuth();
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [familyName, setFamilyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');

  if (family) {
    router.replace('/(tabs)/today');
    return null;
  }

  async function handleCreateFamily() {
    if (!familyName.trim()) {
      setError('Please enter a family name');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setDebugInfo('Starting...');
      const { error: createError } = await createFamily(familyName.trim(), (step) => {
        setDebugInfo(step);
      });
      setDebugInfo('Done: ' + (createError ? createError.message : 'success'));

      if (createError) {
        setError(createError.message);
        setLoading(false);
      } else {
        router.replace('/(tabs)/today');
      }
    } catch (err: any) {
      setDebugInfo('Exception: ' + (err?.message || 'unknown'));
      setError(err?.message || 'Unknown error occurred');
      setLoading(false);
    }
  }

  async function handleJoinFamily() {
    if (!inviteCode.trim()) {
      setError('Please enter an invite code');
      return;
    }

    setLoading(true);
    setError(null);

    const { error: joinError } = await joinFamily(inviteCode.trim());

    if (joinError) {
      setError(joinError.message);
      setLoading(false);
    } else {
      router.replace('/(tabs)/today');
    }
  }

  if (mode === 'choose') {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="home" size={48} color={theme.colors.primary} />
            </View>
            <Text style={styles.title}>Welcome, {profile?.display_name}!</Text>
            <Text style={styles.subtitle}>Let's set up your family</Text>
          </View>

          <View style={styles.optionsContainer}>
            <TouchableOpacity
              style={styles.optionCard}
              onPress={() => setMode('create')}
              testID="button-create-family"
            >
              <View style={styles.optionIcon}>
                <Ionicons name="add-circle" size={32} color={theme.colors.primary} />
              </View>
              <Text style={styles.optionTitle}>Create a Family</Text>
              <Text style={styles.optionDescription}>
                Start a new family and invite others to join
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionCard}
              onPress={() => setMode('join')}
              testID="button-join-family"
            >
              <View style={styles.optionIcon}>
                <Ionicons name="people-circle" size={32} color={theme.colors.primary} />
              </View>
              <Text style={styles.optionTitle}>Join a Family</Text>
              <Text style={styles.optionDescription}>
                Use an invite code to join an existing family
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            setMode('choose');
            setError(null);
          }}
          testID="button-back"
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons
              name={mode === 'create' ? 'add-circle' : 'people-circle'}
              size={48}
              color={theme.colors.primary}
            />
          </View>
          <Text style={styles.title}>
            {mode === 'create' ? 'Create a Family' : 'Join a Family'}
          </Text>
          <Text style={styles.subtitle}>
            {mode === 'create'
              ? 'Choose a name for your family'
              : 'Enter the invite code shared with you'}
          </Text>
          <Text style={styles.versionText}>v2.4</Text>
          {debugInfo ? <Text style={styles.debugText}>{debugInfo}</Text> : null}
        </View>

        <View style={styles.form}>
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={20} color={theme.colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {mode === 'create' ? (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Family Name</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="home-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={familyName}
                  onChangeText={setFamilyName}
                  placeholder="e.g., The Smiths"
                  placeholderTextColor={theme.colors.textMuted}
                  autoFocus
                  testID="input-family-name"
                />
              </View>
            </View>
          ) : (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Invite Code</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="key-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={inviteCode}
                  onChangeText={setInviteCode}
                  placeholder="Enter 8-character code"
                  placeholderTextColor={theme.colors.textMuted}
                  autoCapitalize="none"
                  autoFocus
                  testID="input-invite-code"
                />
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={mode === 'create' ? handleCreateFamily : handleJoinFamily}
            disabled={loading}
            testID={mode === 'create' ? 'button-create-submit' : 'button-join-submit'}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {mode === 'create' ? 'Create Family' : 'Join Family'}
              </Text>
            )}
          </TouchableOpacity>
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
  content: {
    flex: 1,
    padding: theme.spacing.lg,
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    padding: theme.spacing.lg,
  },
  backButton: {
    marginBottom: theme.spacing.md,
    alignSelf: 'flex-start',
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  versionText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  debugText: {
    fontSize: 11,
    color: theme.colors.primary,
    marginTop: theme.spacing.xs,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  optionsContainer: {
    gap: theme.spacing.md,
  },
  optionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  optionIcon: {
    marginBottom: theme.spacing.sm,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  optionDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  form: {
    width: '100%',
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
});
