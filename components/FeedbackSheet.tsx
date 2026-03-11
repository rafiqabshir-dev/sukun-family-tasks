import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Linking,
  ActivityIndicator,
  Pressable,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { colors, spacing, borderRadius, fontSize } from "@/lib/theme";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/authContext";

const FEEDBACK_TYPES = ["Bug Report", "Feature Request", "General Feedback"] as const;
type FeedbackType = (typeof FEEDBACK_TYPES)[number];

const SUPPORT_EMAIL = "support@sukunapp.com";

interface FeedbackSheetProps {
  visible: boolean;
  onClose: () => void;
}

export default function FeedbackSheet({ visible, onClose }: FeedbackSheetProps) {
  const { profile } = useAuth();
  const [selectedType, setSelectedType] = useState<FeedbackType>("General Feedback");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const appVersion = Constants.expoConfig?.version ?? "unknown";

  const handleClose = () => {
    setSelectedType("General Feedback");
    setMessage("");
    setSubmitted(false);
    setError("");
    onClose();
  };

  const handleSubmit = async () => {
    if (!message.trim()) {
      setError("Please enter a message.");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      const client = getSupabaseClient();
      if (!client || !isSupabaseConfigured()) {
        // Fallback to email
        const subject = encodeURIComponent(`[${selectedType}] Feedback from Sukun App`);
        const body = encodeURIComponent(
          `Type: ${selectedType}\nApp Version: ${appVersion}\nPlatform: ${Platform.OS}\n\n${message}`
        );
        await Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
        handleClose();
        return;
      }

      const { error: insertError } = await client.from("feedback").insert({
        type: selectedType,
        message: message.trim(),
        user_id: profile?.id ?? null,
        app_version: appVersion,
        platform: Platform.OS,
      });

      if (insertError) throw insertError;

      setSubmitted(true);
    } catch (err: any) {
      console.error("[FeedbackSheet] Submit error:", err);
      setError("Something went wrong. You can email us instead.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailFallback = () => {
    const subject = encodeURIComponent(`[${selectedType}] Feedback from Sukun App`);
    const body = encodeURIComponent(
      `Type: ${selectedType}\nApp Version: ${appVersion}\nPlatform: ${Platform.OS}\n\n${message}`
    );
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Send Feedback</Text>
              <TouchableOpacity onPress={handleClose} hitSlop={8}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {submitted ? (
              /* Success state */
              <View style={styles.successContainer}>
                <View style={styles.successIcon}>
                  <Ionicons name="checkmark-circle" size={56} color={colors.success} />
                </View>
                <Text style={styles.successTitle}>Thank you!</Text>
                <Text style={styles.successMessage}>
                  We'll review your feedback and use it to improve the app for families like yours.
                </Text>
                <TouchableOpacity style={styles.doneButton} onPress={handleClose}>
                  <Text style={styles.doneButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* Form */
              <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
                {/* Type selector */}
                <Text style={styles.label}>What kind of feedback?</Text>
                <View style={styles.chipRow}>
                  {FEEDBACK_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.chip, selectedType === type && styles.chipSelected]}
                      onPress={() => setSelectedType(type)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selectedType === type && styles.chipTextSelected,
                        ]}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Message input */}
                <Text style={styles.label}>Your message</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Tell us what's on your mind..."
                  placeholderTextColor={colors.textMuted}
                  value={message}
                  onChangeText={(text) => {
                    setMessage(text);
                    if (error) setError("");
                  }}
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                />

                {/* Error */}
                {error ? (
                  <View style={styles.errorRow}>
                    <Ionicons name="alert-circle" size={16} color={colors.error} />
                    <Text style={styles.errorText}>{error}</Text>
                    {error.includes("email") && (
                      <TouchableOpacity onPress={handleEmailFallback}>
                        <Text style={styles.emailLink}>Email us</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : null}

                {/* Submit */}
                <TouchableOpacity
                  style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                  onPress={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.submitButtonText}>Submit Feedback</Text>
                  )}
                </TouchableOpacity>

                {/* Fallback email note */}
                {!isSupabaseConfigured() && (
                  <Text style={styles.fallbackNote}>
                    This will open your email app to send feedback to {SUPPORT_EMAIL}.
                  </Text>
                )}
              </ScrollView>
            )}
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  keyboardView: {
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingBottom: spacing.xxl,
    maxHeight: "85%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: "600",
    color: colors.text,
  },
  form: {
    padding: spacing.lg,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.text,
  },
  chipTextSelected: {
    color: "#FFFFFF",
  },
  textInput: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.error,
    flex: 1,
  },
  emailLink: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  fallbackNote: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.md,
  },
  successContainer: {
    padding: spacing.xl,
    alignItems: "center",
  },
  successIcon: {
    marginBottom: spacing.md,
  },
  successTitle: {
    fontSize: fontSize.xxl,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  successMessage: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  doneButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
  },
  doneButtonText: {
    color: "#FFFFFF",
    fontSize: fontSize.md,
    fontWeight: "600",
  },
});
