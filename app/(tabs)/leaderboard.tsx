import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, fontSize } from "@/lib/theme";
import { useStore } from "@/lib/store";

export default function LeaderboardScreen() {
  const router = useRouter();
  const members = useStore((s) => s.members);
  const kids = members
    .filter((m) => m.role === "kid")
    .sort((a, b) => b.starsTotal - a.starsTotal);

  const getRankDisplay = (index: number) => {
    if (index === 0) return { icon: "trophy" as const, color: "#FFD700" };
    if (index === 1) return { icon: "trophy" as const, color: "#C0C0C0" };
    if (index === 2) return { icon: "trophy" as const, color: "#CD7F32" };
    return null;
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
            Add participants to your family to start tracking their stars!
          </Text>
        </View>
      ) : (
        <View style={styles.tableContainer}>
          <View style={styles.tableHeader}>
            <Text style={[styles.headerCell, styles.rankCell]}>Rank</Text>
            <Text style={[styles.headerCell, styles.nameCell]}>Name</Text>
            <Text style={[styles.headerCell, styles.starsCell]}>Stars</Text>
          </View>
          
          {kids.map((kid, index) => {
            const rankInfo = getRankDisplay(index);
            return (
              <TouchableOpacity
                key={kid.id}
                style={[
                  styles.tableRow,
                  index === 0 && styles.firstPlace,
                  index % 2 === 1 && styles.alternateRow,
                ]}
                onPress={() => router.push(`/member/${kid.id}`)}
                data-testid={`row-leaderboard-${kid.id}`}
              >
                <View style={[styles.cell, styles.rankCell]}>
                  {rankInfo ? (
                    <Ionicons name={rankInfo.icon} size={20} color={rankInfo.color} />
                  ) : (
                    <Text style={styles.rankNumber}>{index + 1}</Text>
                  )}
                </View>
                <View style={[styles.cell, styles.nameCell]}>
                  <View style={styles.avatarSmall}>
                    <Text style={styles.avatarInitial}>
                      {kid.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.nameText}>{kid.name}</Text>
                </View>
                <View style={[styles.cell, styles.starsCell]}>
                  <Ionicons name="star" size={16} color={colors.secondary} />
                  <Text style={styles.starsText}>{kid.starsTotal}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
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
  tableContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  headerCell: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: "#FFFFFF",
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: "center",
  },
  firstPlace: {
    backgroundColor: "rgba(255, 215, 0, 0.1)",
  },
  alternateRow: {
    backgroundColor: colors.surfaceSecondary,
  },
  cell: {
    flexDirection: "row",
    alignItems: "center",
  },
  rankCell: {
    width: 50,
    justifyContent: "center",
  },
  nameCell: {
    flex: 1,
    gap: spacing.sm,
  },
  starsCell: {
    width: 70,
    justifyContent: "flex-end",
    gap: 4,
  },
  rankNumber: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.textMuted,
    textAlign: "center",
  },
  avatarSmall: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitial: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  nameText: {
    fontSize: fontSize.md,
    fontWeight: "500",
    color: colors.text,
  },
  starsText: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.secondary,
  },
});
