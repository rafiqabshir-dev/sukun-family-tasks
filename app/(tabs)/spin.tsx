import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, fontSize } from "@/lib/theme";

export default function SpinScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.wheelContainer}>
        <View style={styles.wheel}>
          <Ionicons name="sync" size={80} color={colors.primary} />
        </View>
        <Text style={styles.wheelText}>Task Wheel</Text>
      </View>

      <TouchableOpacity style={styles.spinButton} activeOpacity={0.8}>
        <Text style={styles.spinButtonText}>Spin the Wheel!</Text>
      </TouchableOpacity>

      <Text style={styles.helpText}>
        Spin to assign a random task to a family member
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  wheelContainer: {
    alignItems: "center",
    marginBottom: spacing.xxl,
  },
  wheel: {
    width: 200,
    height: 200,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 8,
    borderColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  wheelText: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.text,
    marginTop: spacing.lg,
  },
  spinButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  spinButtonText: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  helpText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    textAlign: "center",
  },
});
