import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Modal, TextInput, KeyboardAvoidingView, Platform, Share, Linking, Alert } from "react-native";
import { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { colors, spacing, borderRadius, fontSize } from "@/lib/theme";
import { useStore } from "@/lib/store";
import { POWER_INFO } from "@/lib/types";
import { useAuth } from "@/lib/authContext";

const STORAGE_KEY = "barakah-kids-race:v1";

export default function SetupScreen() {
  const router = useRouter();
  const { profile, family, signOut, isConfigured } = useAuth();
  const members = useStore((s) => s.members);
  const taskTemplates = useStore((s) => s.taskTemplates);
  const taskInstances = useStore((s) => s.taskInstances);
  const settings = useStore((s) => s.settings);
  const schemaVersion = useStore((s) => s.schemaVersion);
  const actingMemberId = useStore((s) => s.actingMemberId);
  const toggleSound = useStore((s) => s.toggleSound);
  const setActingMember = useStore((s) => s.setActingMember);
  const addMember = useStore((s) => s.addMember);
  
  const [storageKeyExists, setStorageKeyExists] = useState<boolean | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showInviteDrawer, setShowInviteDrawer] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAge, setNewAge] = useState("");
  const [newRole, setNewRole] = useState<"kid" | "guardian">("kid");
  const [copiedCode, setCopiedCode] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [ownershipChecked, setOwnershipChecked] = useState(false);
  
  // Check if current user is the family owner (first guardian to join)
  useEffect(() => {
    const checkOwnership = async () => {
      setOwnershipChecked(false);
      
      if (!isConfigured) {
        // In offline mode (no Supabase), allow any guardian to manage members
        setIsOwner(profile?.role === "guardian");
        setOwnershipChecked(true);
        return;
      }
      
      if (!profile || !family) {
        setIsOwner(false);
        setOwnershipChecked(true);
        return;
      }
      
      try {
        const { supabase } = await import("@/lib/supabase");
        const { data: familyGuardians, error } = await supabase
          .from("profiles")
          .select("id, created_at")
          .eq("family_id", family.id)
          .eq("role", "guardian")
          .order("created_at", { ascending: true })
          .limit(1);
        
        if (error) {
          console.error("Error checking ownership:", error);
          // On error, deny access (strict security)
          setIsOwner(false);
        } else if (familyGuardians && familyGuardians.length > 0) {
          setIsOwner(familyGuardians[0].id === profile.id);
        } else {
          setIsOwner(false);
        }
      } catch (error) {
        console.error("Error checking ownership:", error);
        // On error, deny access (strict security)
        setIsOwner(false);
      }
      
      setOwnershipChecked(true);
    };
    
    checkOwnership();
  }, [profile, family, isConfigured]);
  
  useEffect(() => {
    const checkStorage = async () => {
      try {
        const value = await AsyncStorage.getItem(STORAGE_KEY);
        setStorageKeyExists(value !== null);
      } catch {
        setStorageKeyExists(false);
      }
    };
    checkStorage();
  }, [members, taskTemplates, taskInstances]);

  const kids = members.filter((m) => m.role === "kid");
  const guardians = members.filter((m) => m.role === "guardian");
  const enabledTasks = taskTemplates.filter((t) => t.enabled).length;
  const actingMember = members.find((m) => m.id === actingMemberId);

  const handleAddMember = () => {
    if (!newName.trim() || !newAge || parseInt(newAge) <= 0) return;
    
    addMember({
      name: newName.trim(),
      age: parseInt(newAge),
      role: newRole,
    });
    
    setShowAddModal(false);
    setNewName("");
    setNewAge("");
    setNewRole("kid");
  };

  const canAddMember = newName.trim() && newAge && parseInt(newAge) > 0;
  const inviteCode = family?.invite_code || "";

  const handleCopyInviteCode = async () => {
    if (!inviteCode) return;
    await Clipboard.setStringAsync(inviteCode.toUpperCase());
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleShareWhatsApp = async () => {
    if (!inviteCode) return;
    const message = `Join our family on Sukun! Use invite code: ${inviteCode.toUpperCase()}`;
    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
    
    try {
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
      } else {
        await Share.share({ message });
      }
    } catch {
      await Share.share({ message });
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Sign Out", 
          style: "destructive",
          onPress: async () => {
            await signOut();
            router.replace("/auth/sign-in");
          }
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Act As</Text>
        <Text style={styles.sectionSubtitle}>Select who is using the app right now</Text>
        <View style={styles.actAsGrid}>
          {members.map((member) => (
            <TouchableOpacity
              key={member.id}
              style={[
                styles.actAsCard,
                actingMemberId === member.id && styles.actAsCardSelected,
              ]}
              onPress={() => setActingMember(member.id)}
              data-testid={`button-act-as-${member.id}`}
            >
              <View style={[
                styles.actAsAvatar,
                actingMemberId === member.id && styles.actAsAvatarSelected,
              ]}>
                <Text style={styles.actAsInitial}>
                  {member.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={[
                styles.actAsName,
                actingMemberId === member.id && styles.actAsNameSelected,
              ]}>
                {member.name}
              </Text>
              <Text style={styles.actAsRole}>
                {member.role === "guardian" ? "Guardian" : `Age ${member.age}`}
              </Text>
              {actingMemberId === member.id && (
                <Ionicons name="checkmark-circle" size={20} color={colors.primary} style={styles.actAsCheck} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Family Members</Text>
          {isOwner && (
            <TouchableOpacity
              style={styles.addMemberButton}
              onPress={() => setShowAddModal(true)}
              data-testid="button-add-member"
            >
              <Ionicons name="add-circle" size={20} color="#FFFFFF" />
              <Text style={styles.addMemberButtonText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.card}>
          <View style={styles.statRow}>
            <Ionicons name="people" size={24} color={colors.primary} />
            <Text style={styles.statLabel}>Participants</Text>
            <Text style={styles.statValue}>{kids.length}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statRow}>
            <Ionicons name="shield-checkmark" size={24} color={colors.primaryLight} />
            <Text style={styles.statLabel}>Guardians</Text>
            <Text style={styles.statValue}>{guardians.length}</Text>
          </View>
        </View>

        {kids.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No participants yet</Text>
            {isOwner && inviteCode && (
              <TouchableOpacity
                style={styles.inviteButton}
                onPress={() => setShowInviteDrawer(true)}
                data-testid="button-invite-members"
              >
                <Ionicons name="person-add" size={20} color="#FFFFFF" />
                <Text style={styles.inviteButtonText}>Invite Members</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {kids.length > 0 && (
          <View style={styles.membersList}>
            {kids.map((kid) => (
              <TouchableOpacity 
                key={kid.id} 
                style={styles.memberItem}
                onPress={() => router.push(`/member/${kid.id}`)}
                data-testid={`button-member-${kid.id}`}
              >
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberInitial}>
                    {kid.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{kid.name}</Text>
                  <Text style={styles.memberAge}>Age {kid.age}</Text>
                  {kid.powers.length > 0 && (
                    <View style={styles.powerTags}>
                      {kid.powers.map((p) => (
                        <View key={p.powerKey} style={styles.powerTag}>
                          <Text style={styles.powerTagText}>
                            {POWER_INFO[p.powerKey].name}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
                <View style={styles.memberStars}>
                  <Ionicons name="star" size={14} color={colors.secondary} />
                  <Text style={styles.memberStarsText}>{kid.starsTotal}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {guardians.length > 0 && (
          <View style={styles.membersList}>
            {guardians.map((guardian) => (
              <TouchableOpacity 
                key={guardian.id} 
                style={styles.memberItem}
                onPress={() => router.push(`/member/${guardian.id}`)}
                data-testid={`button-member-${guardian.id}`}
              >
                <View style={[styles.memberAvatar, styles.guardianAvatar]}>
                  <Text style={styles.memberInitial}>
                    {guardian.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{guardian.name}</Text>
                  <Text style={styles.memberAge}>Guardian</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Task Templates</Text>
        <View style={styles.card}>
          <View style={styles.statRow}>
            <Ionicons name="list" size={24} color={colors.primary} />
            <Text style={styles.statLabel}>Active Tasks</Text>
            <Text style={styles.statValue}>{enabledTasks}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statRow}>
            <Ionicons name="albums" size={24} color={colors.textMuted} />
            <Text style={styles.statLabel}>Total Templates</Text>
            <Text style={styles.statValue}>{taskTemplates.length}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Settings</Text>
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <Ionicons name="volume-high" size={24} color={colors.primary} />
            <Text style={styles.settingLabel}>Sounds</Text>
            <Switch
              value={settings.soundsEnabled}
              onValueChange={toggleSound}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={settings.soundsEnabled ? colors.primary : colors.textMuted}
            />
          </View>
          {isConfigured && (
            <>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.settingRow}
                onPress={handleSignOut}
                data-testid="button-sign-out"
              >
                <Ionicons name="log-out-outline" size={24} color={colors.error} />
                <Text style={[styles.settingLabel, { color: colors.error }]}>Sign Out</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Diagnostics</Text>
        <View style={styles.card}>
          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>Schema Version</Text>
            <Text style={styles.diagValue} data-testid="text-schema-version">{schemaVersion}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>Members Count</Text>
            <Text style={styles.diagValue} data-testid="text-members-count">{members.length}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>Templates Count</Text>
            <Text style={styles.diagValue} data-testid="text-templates-count">{taskTemplates.length}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>Instances Count</Text>
            <Text style={styles.diagValue} data-testid="text-instances-count">{taskInstances.length}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>AsyncStorage Key</Text>
            <View style={styles.storageStatus}>
              <View style={[
                styles.statusDot,
                { backgroundColor: storageKeyExists === null 
                  ? colors.textMuted 
                  : storageKeyExists 
                    ? colors.success 
                    : colors.warning 
                }
              ]} />
              <Text style={styles.diagValue} data-testid="text-storage-status">
                {storageKeyExists === null 
                  ? "Checking..." 
                  : storageKeyExists 
                    ? "Present" 
                    : "Not Found"}
              </Text>
            </View>
          </View>
          <Text style={styles.storageKey} data-testid="text-storage-key">{STORAGE_KEY}</Text>
        </View>
      </View>

      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Family Member</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter name"
                placeholderTextColor={colors.textMuted}
                value={newName}
                onChangeText={setNewName}
                data-testid="input-member-name"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Age</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter age"
                placeholderTextColor={colors.textMuted}
                value={newAge}
                onChangeText={(text) => setNewAge(text.replace(/[^0-9]/g, ""))}
                keyboardType="numeric"
                maxLength={2}
                data-testid="input-member-age"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Role</Text>
              <View style={styles.roleToggle}>
                <TouchableOpacity
                  style={[
                    styles.roleOption,
                    newRole === "kid" && styles.roleOptionActive,
                  ]}
                  onPress={() => setNewRole("kid")}
                  data-testid="button-role-kid"
                >
                  <Ionicons
                    name="happy"
                    size={20}
                    color={newRole === "kid" ? "#FFFFFF" : colors.text}
                  />
                  <Text
                    style={[
                      styles.roleText,
                      newRole === "kid" && styles.roleTextActive,
                    ]}
                  >
                    Participant
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.roleOption,
                    newRole === "guardian" && styles.roleOptionActive,
                  ]}
                  onPress={() => setNewRole("guardian")}
                  data-testid="button-role-guardian"
                >
                  <Ionicons
                    name="shield-checkmark"
                    size={20}
                    color={newRole === "guardian" ? "#FFFFFF" : colors.text}
                  />
                  <Text
                    style={[
                      styles.roleText,
                      newRole === "guardian" && styles.roleTextActive,
                    ]}
                  >
                    Guardian
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.confirmButton,
                !canAddMember && styles.confirmButtonDisabled,
              ]}
              onPress={handleAddMember}
              disabled={!canAddMember}
              data-testid="button-confirm-add-member"
            >
              <Text style={styles.confirmButtonText}>Add Member</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showInviteDrawer} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invite Family Members</Text>
              <TouchableOpacity onPress={() => setShowInviteDrawer(false)}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inviteDescription}>
              Share this invite code with family members to let them join your family on Sukun.
            </Text>

            <View style={styles.inviteCodeBox}>
              <Text style={styles.inviteCodeLabel}>Invite Code</Text>
              <Text style={styles.inviteCodeValue} data-testid="text-invite-code">
                {inviteCode.toUpperCase()}
              </Text>
            </View>

            <View style={styles.inviteActions}>
              <TouchableOpacity
                style={styles.inviteActionButton}
                onPress={handleCopyInviteCode}
                data-testid="button-copy-invite-code"
              >
                <Ionicons 
                  name={copiedCode ? "checkmark-circle" : "copy-outline"} 
                  size={24} 
                  color="#FFFFFF" 
                />
                <Text style={styles.inviteActionText}>
                  {copiedCode ? "Copied!" : "Copy Code"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.inviteActionButton, styles.whatsappButton]}
                onPress={handleShareWhatsApp}
                data-testid="button-share-whatsapp"
              >
                <Ionicons name="logo-whatsapp" size={24} color="#FFFFFF" />
                <Text style={styles.inviteActionText}>Share on WhatsApp</Text>
              </TouchableOpacity>
            </View>

            {isOwner && (
              <TouchableOpacity
                style={styles.addLocalButton}
                onPress={() => {
                  setShowInviteDrawer(false);
                  setShowAddModal(true);
                }}
                data-testid="button-add-local-member"
              >
                <Ionicons name="person-add-outline" size={20} color={colors.primary} />
                <Text style={styles.addLocalButtonText}>Add Member Locally</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
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
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  sectionSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  addMemberButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  addMemberButtonText: {
    color: "#FFFFFF",
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  actAsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  actAsCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: "center",
    minWidth: 100,
    borderWidth: 2,
    borderColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    position: "relative",
  },
  actAsCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceSecondary,
  },
  actAsAvatar: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.textMuted,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  actAsAvatarSelected: {
    backgroundColor: colors.primary,
  },
  actAsInitial: {
    fontSize: fontSize.xl,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  actAsName: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.text,
  },
  actAsNameSelected: {
    fontWeight: "600",
    color: colors.primary,
  },
  actAsRole: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  actAsCheck: {
    position: "absolute",
    top: spacing.xs,
    right: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  statLabel: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
  },
  statValue: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  membersList: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  memberItem: {
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
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  guardianAvatar: {
    backgroundColor: colors.primaryLight,
  },
  memberInitial: {
    fontSize: fontSize.xl,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
  },
  memberAge: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  memberStars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  memberStarsText: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.secondary,
  },
  powerTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  powerTag: {
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  powerTagText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  settingLabel: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
  },
  diagRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  diagLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  diagValue: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text,
  },
  storageStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  storageKey: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.sm,
    fontFamily: "monospace",
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
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: "600",
    color: colors.text,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
    backgroundColor: colors.surfaceSecondary,
  },
  roleToggle: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  roleOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.surfaceSecondary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  roleOptionActive: {
    backgroundColor: colors.primary,
  },
  roleText: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.text,
  },
  roleTextActive: {
    color: "#FFFFFF",
  },
  confirmButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  confirmButtonDisabled: {
    backgroundColor: colors.textMuted,
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  emptyState: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: "center",
    marginTop: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  inviteButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  inviteButtonText: {
    color: "#FFFFFF",
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  inviteDescription: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  inviteCodeBox: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  inviteCodeLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  inviteCodeValue: {
    fontSize: fontSize.xxl,
    fontWeight: "700",
    color: colors.primary,
    letterSpacing: 4,
  },
  inviteActions: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  inviteActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  whatsappButton: {
    backgroundColor: "#25D366",
  },
  inviteActionText: {
    color: "#FFFFFF",
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  addLocalButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  addLocalButtonText: {
    color: colors.primary,
    fontSize: fontSize.md,
    fontWeight: "600",
  },
});
