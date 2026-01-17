import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, borderRadius, fontSize } from "@/lib/theme";
import { useStore } from "@/lib/store";
import { PowerKey, POWER_INFO } from "@/lib/types";

const POWERS: PowerKey[] = [
  "organizer",
  "fastCleaner",
  "kitchenHelper",
  "studyCoach",
  "calmPeacemaker",
  "discipline",
];

export default function PowersScreen() {
  const router = useRouter();
  const members = useStore((s) => s.members);
  const setMemberPowers = useStore((s) => s.setMemberPowers);

  const kids = members.filter((m) => m.role === "kid");
  const [currentKidIndex, setCurrentKidIndex] = useState(0);
  const [selectedPowers, setSelectedPowers] = useState<Record<string, PowerKey[]>>(() => {
    const initial: Record<string, PowerKey[]> = {};
    kids.forEach((kid) => {
      initial[kid.id] = kid.powers.map((p) => p.powerKey);
    });
    return initial;
  });

  const currentKid = kids[currentKidIndex];
  const currentPowers = currentKid ? selectedPowers[currentKid.id] || [] : [];

  const togglePower = (power: PowerKey) => {
    if (!currentKid) return;

    const kidPowers = selectedPowers[currentKid.id] || [];
    if (kidPowers.includes(power)) {
      setSelectedPowers({
        ...selectedPowers,
        [currentKid.id]: kidPowers.filter((p) => p !== power),
      });
    } else if (kidPowers.length < 2) {
      setSelectedPowers({
        ...selectedPowers,
        [currentKid.id]: [...kidPowers, power],
      });
    }
  };

  const handleNext = () => {
    if (currentKid) {
      setMemberPowers(currentKid.id, currentPowers);
    }

    if (currentKidIndex < kids.length - 1) {
      setCurrentKidIndex(currentKidIndex + 1);
    } else {
      router.push("/onboarding/tasks");
    }
  };

  const canContinue = currentPowers.length >= 1;

  if (!currentKid) {
    router.push("/onboarding/tasks");
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (currentKidIndex > 0) {
              setCurrentKidIndex(currentKidIndex - 1);
            } else {
              router.back();
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Choose Powers</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.kidInfo}>
          <View style={styles.kidAvatar}>
            <Text style={styles.kidInitial}>
              {currentKid.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.kidName}>{currentKid.name}</Text>
          <Text style={styles.progress}>
            {currentKidIndex + 1} of {kids.length}
          </Text>
        </View>

        <Text style={styles.subtitle}>
          Select 1-2 powers that describe {currentKid.name}'s strengths
        </Text>

        <View style={styles.powersGrid}>
          {POWERS.map((power) => {
            const info = POWER_INFO[power];
            const isSelected = currentPowers.includes(power);
            const isDisabled = !isSelected && currentPowers.length >= 2;

            return (
              <TouchableOpacity
                key={power}
                style={[
                  styles.powerCard,
                  isSelected && styles.powerCardSelected,
                  isDisabled && styles.powerCardDisabled,
                ]}
                onPress={() => togglePower(power)}
                activeOpacity={0.7}
                disabled={isDisabled}
              >
                <Text style={styles.powerEmoji}>{info.emoji}</Text>
                <Text
                  style={[
                    styles.powerName,
                    isSelected && styles.powerNameSelected,
                  ]}
                >
                  {info.name}
                </Text>
                <Text
                  style={[
                    styles.powerDesc,
                    isSelected && styles.powerDescSelected,
                  ]}
                  numberOfLines={2}
                >
                  {info.description}
                </Text>
                {isSelected && (
                  <View style={styles.checkmark}>
                    <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueButton, !canContinue && styles.buttonDisabled]}
          onPress={handleNext}
          disabled={!canContinue}
          activeOpacity={0.8}
        >
          <Text style={styles.continueButtonText}>
            {currentKidIndex < kids.length - 1 ? "Next Kid" : "Continue"}
          </Text>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: "600",
    color: colors.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  kidInfo: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  kidAvatar: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  kidInitial: {
    fontSize: fontSize.xxxl,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  kidName: {
    fontSize: fontSize.xl,
    fontWeight: "600",
    color: colors.text,
  },
  progress: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  powersGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  powerCard: {
    width: "47%",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    position: "relative",
  },
  powerCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  powerCardDisabled: {
    opacity: 0.5,
  },
  powerEmoji: {
    fontSize: 36,
    marginBottom: spacing.sm,
  },
  powerName: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: "center",
  },
  powerNameSelected: {
    color: "#FFFFFF",
  },
  powerDesc: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 16,
  },
  powerDescSelected: {
    color: "rgba(255,255,255,0.8)",
  },
  checkmark: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  buttonDisabled: {
    backgroundColor: colors.textMuted,
  },
  continueButtonText: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
