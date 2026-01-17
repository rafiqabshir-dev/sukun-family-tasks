import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, fontSize } from "@/lib/theme";
import { useStore } from "@/lib/store";

export default function LeaderboardScreen() {
  const members = useStore((s) => s.members);
  const kids = members
    .filter((m) => m.role === "kid")
    .sort((a, b) => b.starsTotal - a.starsTotal);

  const getMedalColor = (index: number) => {
    if (index === 0) return "#FFD700";
    if (index === 1) return "#C0C0C0";
    if (index === 2) return "#CD7F32";
    return colors.textMuted;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {kids.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="trophy-outline" size={64} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No Participants Yet</Text>
          <Text style={styles.emptyText}>
            Add family members to start tracking their progress!
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.podium}>
            {kids.slice(0, 3).map((kid, index) => (
              <View
                key={kid.id}
                style={[
                  styles.podiumItem,
                  index === 0 && styles.podiumFirst,
                  index === 1 && styles.podiumSecond,
                  index === 2 && styles.podiumThird,
                ]}
              >
                <View style={styles.podiumAvatar}>
                  <Text style={styles.podiumInitial}>
                    {kid.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Ionicons
                  name="trophy"
                  size={24}
                  color={getMedalColor(index)}
                  style={styles.trophy}
                />
                <Text style={styles.podiumName}>{kid.name}</Text>
                <View style={styles.starsRow}>
                  <Ionicons name="star" size={16} color={colors.secondary} />
                  <Text style={styles.starsText}>{kid.starsTotal}</Text>
                </View>
              </View>
            ))}
          </View>

          {kids.length > 3 && (
            <View style={styles.restList}>
              {kids.slice(3).map((kid, index) => (
                <View key={kid.id} style={styles.listItem}>
                  <Text style={styles.rankNumber}>{index + 4}</Text>
                  <View style={styles.listAvatar}>
                    <Text style={styles.listInitial}>
                      {kid.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.listName}>{kid.name}</Text>
                  <View style={styles.starsRow}>
                    <Ionicons name="star" size={14} color={colors.secondary} />
                    <Text style={styles.listStars}>{kid.starsTotal}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: "center",
    maxWidth: 280,
  },
  podium: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  podiumItem: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    width: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  podiumFirst: {
    marginBottom: spacing.lg,
  },
  podiumSecond: {
    marginBottom: spacing.sm,
  },
  podiumThird: {
    marginBottom: 0,
  },
  podiumAvatar: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  podiumInitial: {
    fontSize: fontSize.xxl,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  trophy: {
    marginTop: spacing.sm,
  },
  podiumName: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text,
    marginTop: spacing.xs,
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  starsText: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.secondary,
  },
  restList: {
    gap: spacing.sm,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  rankNumber: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.textMuted,
    width: 24,
    textAlign: "center",
  },
  listAvatar: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  listInitial: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  listName: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: "500",
    color: colors.text,
  },
  listStars: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.secondary,
  },
});
