import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Modal, TextInput, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { useState, useCallback } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, fontSize } from "@/lib/theme";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/authContext";
import { useResponsive } from "@/lib/useResponsive";
import { Reward, Member } from "@/lib/types";

export default function LeaderboardScreen() {
  const router = useRouter();
  const { profile, refreshProfile } = useAuth();
  const responsive = useResponsive();
  const members = useStore((s) => s.members);
  const rewards = useStore((s) => s.rewards);
  const addReward = useStore((s) => s.addReward);
  const deleteReward = useStore((s) => s.deleteReward);
  const redeemReward = useStore((s) => s.redeemReward);

  const kids = members
    .filter((m) => m.role === "kid")
    .sort((a, b) => b.starsTotal - a.starsTotal);
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [selectedKid, setSelectedKid] = useState<string>("");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newStarsCost, setNewStarsCost] = useState("10");

  const currentMember = profile ? members.find((m) => m.id === profile.id || m.profileId === profile.id) : null;
  const isGuardian = currentMember?.role === "guardian";
  const activeRewards = rewards.filter((r) => r.status === "active");
  const redeemedRewards = rewards.filter((r) => r.status === "redeemed");

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshProfile();
    } catch (err) {
      console.error('[Leaderboard] Refresh error:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshProfile]);

  const getRankDisplay = (index: number) => {
    if (index === 0) return { icon: "trophy" as const, color: "#FFD700" };
    if (index === 1) return { icon: "trophy" as const, color: "#C0C0C0" };
    if (index === 2) return { icon: "trophy" as const, color: "#CD7F32" };
    return null;
  };

  const handleAddReward = () => {
    if (!newTitle.trim()) return;
    
    addReward({
      title: newTitle.trim(),
      description: newDescription.trim() || undefined,
      starsCost: parseInt(newStarsCost) || 10,
    });
    
    setShowAddModal(false);
    setNewTitle("");
    setNewDescription("");
    setNewStarsCost("10");
  };

  const openRedeemModal = (reward: Reward) => {
    setSelectedReward(reward);
    if (kids.length === 1) {
      setSelectedKid(kids[0].id);
    }
    setShowRedeemModal(true);
  };

  const handleRedeem = () => {
    if (!selectedReward || !selectedKid) return;
    
    const kid = members.find((m) => m.id === selectedKid);
    if (!kid || kid.starsTotal < selectedReward.starsCost) {
      Alert.alert(
        "Not Enough Stars",
        `${kid?.name || "This participant"} needs ${selectedReward.starsCost} stars but only has ${kid?.starsTotal || 0}.`
      );
      return;
    }
    
    const success = redeemReward(selectedReward.id, selectedKid);
    if (success) {
      Alert.alert(
        "Reward Claimed!",
        `${kid.name} has claimed "${selectedReward.title}"!`
      );
      setShowRedeemModal(false);
      setSelectedReward(null);
      setSelectedKid("");
    }
  };

  const handleDelete = (reward: Reward) => {
    Alert.alert(
      "Delete Reward",
      `Are you sure you want to delete "${reward.title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteReward(reward.id) },
      ]
    );
  };

  const getMember = (memberId: string) =>
    members.find((m) => m.id === memberId);

  const renderRewardCard = (reward: Reward, isRedeemed = false) => {
    const redeemer = reward.redeemedBy ? getMember(reward.redeemedBy) : null;
    
    return (
      <View 
        key={reward.id} 
        style={[styles.rewardCard, isRedeemed && styles.rewardCardRedeemed]}
        data-testid={`reward-card-${reward.id}`}
      >
        <View style={styles.rewardIcon}>
          <Ionicons 
            name={isRedeemed ? "checkmark-circle" : "gift"} 
            size={28} 
            color={isRedeemed ? colors.success : colors.primary} 
          />
        </View>
        <View style={styles.rewardContent}>
          <Text style={[styles.rewardTitle, isRedeemed && styles.rewardTitleRedeemed]}>
            {reward.title}
          </Text>
          {reward.description && (
            <Text style={styles.rewardDescription}>{reward.description}</Text>
          )}
          <View style={styles.starsCostRow}>
            <Ionicons name="star" size={14} color={colors.secondary} />
            <Text style={styles.starsCostText}>{reward.starsCost} stars</Text>
          </View>
          {isRedeemed && redeemer && (
            <Text style={styles.redeemedBy}>
              Claimed by {redeemer.name}
            </Text>
          )}
        </View>
        {!isRedeemed && isGuardian && (
          <View style={styles.rewardActions}>
            <TouchableOpacity
              style={styles.redeemButton}
              onPress={() => openRedeemModal(reward)}
              data-testid={`button-redeem-${reward.id}`}
            >
              <Ionicons name="gift" size={18} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDelete(reward)}
              data-testid={`button-delete-reward-${reward.id}`}
            >
              <Ionicons name="trash-outline" size={16} color={colors.error} />
            </TouchableOpacity>
          </View>
        )}
        {!isRedeemed && !isGuardian && currentMember && (
          <View style={styles.progressContainer}>
            {currentMember.starsTotal >= reward.starsCost ? (
              <View style={styles.canClaimBadge}>
                <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                <Text style={styles.canClaimText}>Ready!</Text>
              </View>
            ) : (
              <Text style={styles.progressText}>
                {currentMember.starsTotal}/{reward.starsCost}
              </Text>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={[
          styles.content,
          responsive.isTablet && {
            paddingHorizontal: responsive.horizontalPadding,
            alignSelf: 'center',
            width: '100%',
            maxWidth: responsive.contentMaxWidth,
          }
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Leaderboard Section */}
        <View style={styles.section}>
          {kids.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="trophy-outline" size={48} color={colors.primary} />
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
        </View>

        {/* Rewards Section */}
        <View style={styles.section}>
          {isGuardian && (
            <View style={styles.addButtonRow}>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setShowAddModal(true)}
                data-testid="button-add-reward"
              >
                <Ionicons name="add-circle" size={18} color="#FFFFFF" />
                <Text style={styles.addButtonText}>Add Reward</Text>
              </TouchableOpacity>
            </View>
          )}
          
          {activeRewards.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="gift-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No Rewards Yet</Text>
              <Text style={styles.emptyText}>
                {isGuardian 
                  ? "Add rewards for participants to work towards!"
                  : "Ask your parents to add some rewards!"}
              </Text>
            </View>
          ) : (
            activeRewards.map((reward) => renderRewardCard(reward))
          )}
        </View>

        {redeemedRewards.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Claimed Rewards</Text>
            {redeemedRewards.map((reward) => renderRewardCard(reward, true))}
          </View>
        )}
      </ScrollView>

      {/* Add Reward Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Reward</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Reward Name</Text>
              <TextInput
                style={styles.input}
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder="e.g., Ice cream trip"
                placeholderTextColor={colors.textMuted}
                data-testid="input-reward-title"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Description (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={newDescription}
                onChangeText={setNewDescription}
                placeholder="What's the reward?"
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={2}
                data-testid="input-reward-description"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Stars Required</Text>
              <View style={styles.starsInputRow}>
                {[5, 10, 20, 50].map((value) => (
                  <TouchableOpacity
                    key={value}
                    style={[
                      styles.starOption,
                      parseInt(newStarsCost) === value && styles.starOptionSelected,
                    ]}
                    onPress={() => setNewStarsCost(value.toString())}
                    data-testid={`button-stars-${value}`}
                  >
                    <Ionicons name="star" size={14} color={parseInt(newStarsCost) === value ? "#FFFFFF" : colors.secondary} />
                    <Text style={[
                      styles.starOptionText,
                      parseInt(newStarsCost) === value && styles.starOptionTextSelected,
                    ]}>{value}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.input}
                value={newStarsCost}
                onChangeText={setNewStarsCost}
                placeholder="Or enter custom amount"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                data-testid="input-stars-cost"
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, !newTitle.trim() && styles.submitButtonDisabled]}
              onPress={handleAddReward}
              disabled={!newTitle.trim()}
              data-testid="button-save-reward"
            >
              <Text style={styles.submitButtonText}>Add Reward</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Redeem Reward Modal */}
      <Modal visible={showRedeemModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Claim Reward</Text>
              <TouchableOpacity onPress={() => setShowRedeemModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {selectedReward && (
              <View style={styles.redeemPreview}>
                <Ionicons name="gift" size={48} color={colors.primary} />
                <Text style={styles.redeemRewardTitle}>{selectedReward.title}</Text>
                <View style={styles.redeemCost}>
                  <Ionicons name="star" size={20} color={colors.secondary} />
                  <Text style={styles.redeemCostText}>{selectedReward.starsCost} stars</Text>
                </View>
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.label}>Who's claiming?</Text>
              <View style={styles.kidSelectRow}>
                {kids.map((kid) => {
                  const canAfford = selectedReward && kid.starsTotal >= selectedReward.starsCost;
                  return (
                    <TouchableOpacity
                      key={kid.id}
                      style={[
                        styles.kidSelectItem,
                        selectedKid === kid.id && styles.kidSelectItemSelected,
                        !canAfford && styles.kidSelectItemDisabled,
                      ]}
                      onPress={() => canAfford && setSelectedKid(kid.id)}
                      disabled={!canAfford}
                      data-testid={`button-select-kid-${kid.id}`}
                    >
                      <View style={[styles.kidSelectAvatar, selectedKid === kid.id && styles.kidSelectAvatarSelected]}>
                        <Text style={styles.kidSelectInitial}>{kid.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <Text style={[styles.kidSelectName, !canAfford && styles.kidSelectNameDisabled]}>
                        {kid.name}
                      </Text>
                      <Text style={[styles.kidSelectStars, !canAfford && styles.kidSelectStarsInsufficient]}>
                        {kid.starsTotal} stars
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.submitButton, !selectedKid && styles.submitButtonDisabled]}
              onPress={handleRedeem}
              disabled={!selectedKid}
              data-testid="button-confirm-redeem"
            >
              <Text style={styles.submitButtonText}>Claim Reward</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  addButtonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: spacing.md,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: 4,
  },
  addButtonText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
    marginTop: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: "center",
    maxWidth: 250,
    marginTop: spacing.xs,
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
  rewardCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  rewardCardRedeemed: {
    opacity: 0.7,
  },
  rewardIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  rewardContent: {
    flex: 1,
  },
  rewardTitle: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
  },
  rewardTitleRedeemed: {
    textDecorationLine: "line-through",
    color: colors.textMuted,
  },
  rewardDescription: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  starsCostRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: spacing.xs,
  },
  starsCostText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.secondary,
  },
  redeemedBy: {
    fontSize: fontSize.xs,
    color: colors.success,
    marginTop: spacing.xs,
  },
  rewardActions: {
    flexDirection: "column",
    gap: spacing.xs,
  },
  redeemButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.success,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  progressContainer: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 60,
  },
  canClaimBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.success,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: 2,
  },
  canClaimText: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  progressText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.text,
  },
  formGroup: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: "top",
  },
  starsInputRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  starOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.md,
    gap: 4,
  },
  starOptionSelected: {
    backgroundColor: colors.primary,
  },
  starOptionText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text,
  },
  starOptionTextSelected: {
    color: "#FFFFFF",
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: "center",
    marginTop: spacing.md,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  redeemPreview: {
    alignItems: "center",
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.lg,
  },
  redeemRewardTitle: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.text,
    marginTop: spacing.sm,
  },
  redeemCost: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: spacing.xs,
  },
  redeemCostText: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.secondary,
  },
  kidSelectRow: {
    gap: spacing.sm,
  },
  kidSelectItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: "transparent",
  },
  kidSelectItemSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceSecondary,
  },
  kidSelectItemDisabled: {
    opacity: 0.5,
  },
  kidSelectAvatar: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  kidSelectAvatarSelected: {
    backgroundColor: colors.primary,
  },
  kidSelectInitial: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  kidSelectName: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: "500",
    color: colors.text,
  },
  kidSelectNameDisabled: {
    color: colors.textMuted,
  },
  kidSelectStars: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.secondary,
  },
  kidSelectStarsInsufficient: {
    color: colors.error,
  },
});
