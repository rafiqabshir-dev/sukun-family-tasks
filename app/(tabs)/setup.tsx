import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Modal, TextInput, KeyboardAvoidingView, Platform, Share, Linking, Alert, RefreshControl } from "react-native";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { colors, spacing, borderRadius, fontSize } from "@/lib/theme";
import { useStore } from "@/lib/store";
import { POWER_INFO } from "@/lib/types";
import { fetchFamilyData, profileToMember, computeStarsForProfile } from "@/lib/cloudSync";
import { useAuth, JoinRequestWithProfile } from "@/lib/authContext";
import { useResponsive } from "@/lib/useResponsive";

const STORAGE_KEY = "barakah-kids-race:v1";

export default function SetupScreen() {
  const router = useRouter();
  const responsive = useResponsive();
  const { profile, family, signOut, isConfigured, getPendingJoinRequests, approveJoinRequest, rejectJoinRequest, updateProfileName, updateMemberProfile, refreshPendingRequestsCount, refreshProfile } = useAuth();
  const members = useStore((s) => s.members);
  const taskTemplates = useStore((s) => s.taskTemplates);
  const taskInstances = useStore((s) => s.taskInstances);
  const settings = useStore((s) => s.settings);
  const schemaVersion = useStore((s) => s.schemaVersion);
  const toggleSound = useStore((s) => s.toggleSound);
  const addMember = useStore((s) => s.addMember);
  const updateMember = useStore((s) => s.updateMember);
  const setMembersFromCloud = useStore((s) => s.setMembersFromCloud);
  const removeMember = useStore((s) => s.removeMember);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  
  const [storageKeyExists, setStorageKeyExists] = useState<boolean | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showInviteDrawer, setShowInviteDrawer] = useState(false);
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [editingName, setEditingName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAge, setNewAge] = useState("");
  const [newRole, setNewRole] = useState<"kid" | "guardian">("kid");
  const [copiedCode, setCopiedCode] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [ownershipChecked, setOwnershipChecked] = useState(false);
  const [joinRequests, setJoinRequests] = useState<JoinRequestWithProfile[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  
  // Participant removal modal state
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{memberId: string, memberName: string, profileId?: string, passcode?: string} | null>(null);
  const [removePasscodeInput, setRemovePasscodeInput] = useState("");
  const [removeError, setRemoveError] = useState("");
  
  // Member edit modal state (for avatar and age)
  const [showEditMemberModal, setShowEditMemberModal] = useState(false);
  const [editingMember, setEditingMember] = useState<{id: string, name: string, avatar?: string, age: number} | null>(null);
  const [editMemberAvatar, setEditMemberAvatar] = useState("");
  const [editMemberAge, setEditMemberAge] = useState("");
  const [savingMember, setSavingMember] = useState(false);
  const [copiedPasscode, setCopiedPasscode] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Collapsible section state
  const [expandedSection, setExpandedSection] = useState<'participants' | 'guardians' | null>(null);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshProfile();
      if (isOwner && isConfigured) {
        const requests = await getPendingJoinRequests();
        setJoinRequests(requests);
        refreshPendingRequestsCount();
      }
    } catch (err) {
      console.error('[Setup] Refresh error:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshProfile, isOwner, isConfigured, getPendingJoinRequests, refreshPendingRequestsCount]);
  
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

  // Fetch pending join requests when owner status is confirmed
  useEffect(() => {
    const fetchJoinRequests = async () => {
      if (!isOwner || !ownershipChecked || !isConfigured) {
        setJoinRequests([]);
        return;
      }
      
      setLoadingRequests(true);
      try {
        const requests = await getPendingJoinRequests();
        setJoinRequests(requests);
        // Also update the badge count in AuthContext
        refreshPendingRequestsCount();
      } catch (error) {
        console.error("Error fetching join requests:", error);
        setJoinRequests([]);
      }
      setLoadingRequests(false);
    };
    
    fetchJoinRequests();
    
    // Poll every 30 seconds for new requests
    const interval = setInterval(fetchJoinRequests, 30000);
    return () => clearInterval(interval);
  }, [isOwner, ownershipChecked, isConfigured, getPendingJoinRequests, refreshPendingRequestsCount]);

  const handleApproveRequest = async (requestId: string) => {
    console.log('[Setup] Approving request:', requestId);
    setProcessingRequest(requestId);
    const { error } = await approveJoinRequest(requestId);
    console.log('[Setup] Approve result - error:', error?.message);
    if (error) {
      console.error('[Setup] Approve error:', error);
      if (Platform.OS === 'web') {
        window.alert("Error: " + error.message);
      } else {
        Alert.alert("Error", error.message);
      }
    } else {
      console.log('[Setup] Approval successful');
      if (Platform.OS === 'web') {
        window.alert("Request approved successfully!");
      }
      // Remove from list and refresh badge count
      setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));
      refreshPendingRequestsCount();
      
      // Load members from Supabase to include the newly approved member
      if (family?.id) {
        try {
          const cloudData = await fetchFamilyData(family.id);
          if (cloudData?.profiles) {
            const cloudMembers = cloudData.profiles.map((p) => 
              profileToMember(p, computeStarsForProfile(p.id, cloudData.starsLedger || []))
            );
            setMembersFromCloud(cloudMembers);
          }
        } catch (syncError) {
          console.error("Error loading members after approval:", syncError);
        }
      }
    }
    setProcessingRequest(null);
  };

  const handleRejectRequest = async (requestId: string) => {
    const doReject = async () => {
      setProcessingRequest(requestId);
      const { error } = await rejectJoinRequest(requestId);
      if (error) {
        if (Platform.OS === 'web') {
          window.alert("Error: " + error.message);
        } else {
          Alert.alert("Error", error.message);
        }
      } else {
        setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));
        refreshPendingRequestsCount();
      }
      setProcessingRequest(null);
    };
    
    if (Platform.OS === 'web') {
      const confirmed = window.confirm("Are you sure you want to reject this join request?");
      if (confirmed) {
        await doReject();
      }
    } else {
      Alert.alert(
        "Reject Request",
        "Are you sure you want to reject this join request?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Reject",
            style: "destructive",
            onPress: doReject,
          },
        ]
      );
    }
  };
  
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
    if (Platform.OS === 'web') {
      const confirmed = window.confirm("Are you sure you want to sign out?");
      if (confirmed) {
        await signOut();
        router.replace("/auth/sign-in");
      }
    } else {
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
    }
  };

  const handleRemoveParticipant = (memberId: string, memberName: string, profileId?: string, passcode?: string) => {
    // Open the removal modal with passcode confirmation
    setRemoveTarget({ memberId, memberName, profileId, passcode });
    setRemovePasscodeInput("");
    setRemoveError("");
    setShowRemoveModal(true);
  };
  
  const confirmRemoveParticipant = async () => {
    if (!removeTarget) return;
    
    // Defensive check: verify passcode if participant has one
    if (removeTarget.passcode && removePasscodeInput !== removeTarget.passcode) {
      setRemoveError("Incorrect passcode. Please try again.");
      return;
    }
    
    setRemovingMember(removeTarget.memberId);
    setRemoveError("");
    
    // Remove from Supabase if configured
    if (isConfigured && removeTarget.profileId) {
      try {
        const supabaseModule = await import("@/lib/supabase");
        const client = supabaseModule.getSupabaseClient();
        if (!client) {
          throw new Error("Supabase not configured");
        }
        
        // Call the RPC function that runs with elevated privileges
        const { data, error: rpcError } = await client
          .rpc("remove_family_member", { target_profile_id: removeTarget.profileId });
        
        if (rpcError) {
          console.error("[Setup] Error calling remove_family_member:", rpcError);
          setRemoveError("Failed to remove participant: " + rpcError.message);
          setRemovingMember(null);
          return;
        }
        
        console.log("[Setup] Successfully removed participant from family:", removeTarget.profileId, "result:", data);
        
      } catch (err: any) {
        console.error("Error removing participant:", err);
        setRemoveError("Failed to remove participant: " + (err?.message || "Unknown error"));
        setRemovingMember(null);
        return;
      }
    }
    
    // Remove from local store
    removeMember(removeTarget.memberId);
    setRemovingMember(null);
    setShowRemoveModal(false);
    setRemoveTarget(null);
    
    // Show success message
    if (Platform.OS === 'web') {
      window.alert(`${removeTarget.memberName} has been removed from the family.`);
    } else {
      Alert.alert("Success", `${removeTarget.memberName} has been removed from the family.`);
    }
  };
  
  // Compute if Remove button should be disabled
  const isRemoveDisabled = () => {
    if (removingMember) return true;
    if (!removeTarget) return true;
    // If participant has a passcode, require it to match
    if (removeTarget.passcode) {
      return removePasscodeInput !== removeTarget.passcode;
    }
    // No passcode - allow deletion (owner-only action anyway)
    return false;
  };
  
  const handleCopyPasscode = async (passcode: string) => {
    try {
      await Clipboard.setStringAsync(passcode);
      setCopiedPasscode(passcode);
      setTimeout(() => setCopiedPasscode(null), 2000);
    } catch (error) {
      console.error("Failed to copy passcode:", error);
    }
  };

  // Find current user member using profileId (reliable link between local member and Supabase profile)
  const findCurrentUserMember = () => {
    // When Supabase is configured and we have a profile ID
    if (profile?.id) {
      // Primary: Match by profileId field (most reliable)
      let member = members.find((m) => m.profileId === profile.id);
      
      // Fallback 1: Match by id === profile.id (for members added directly with UUID)
      if (!member) {
        member = members.find((m) => m.id === profile.id);
      }
      
      // Fallback 2: Match by display_name + role (for legacy members without profileId)
      if (!member && profile.display_name) {
        member = members.find(
          (m) => m.name === profile.display_name && m.role === profile.role
        );
      }
      
      if (member) return member;
    }
    
    // Final fallback: First guardian in the list (for offline mode)
    return members.find((m) => m.role === 'guardian');
  };

  const handleOpenEditName = () => {
    const currentMember = findCurrentUserMember();
    setEditingName(currentMember?.name || profile?.display_name || "");
    setShowEditNameModal(true);
  };

  const handleSaveEditedName = async () => {
    if (!editingName.trim()) {
      Alert.alert("Error", "Name cannot be empty");
      return;
    }

    setSavingName(true);
    const newName = editingName.trim();
    
    // Update in Supabase if configured
    if (isConfigured) {
      const { error } = await updateProfileName(newName);
      if (error) {
        Alert.alert("Error", error.message);
        setSavingName(false);
        return;
      }
    }

    // Update in local store - find the member using flexible matching
    const currentMember = findCurrentUserMember();
    if (currentMember) {
      // Update name and set profileId if available for future reliable matching
      const updates: { name: string; profileId?: string } = { name: newName };
      if (profile?.id) {
        updates.profileId = profile.id;
      }
      updateMember(currentMember.id, updates);
    }

    setSavingName(false);
    setShowEditNameModal(false);
    setEditingName("");
  };

  // Common emoji options for avatars
  const emojiOptions = [
    "👦", "👧", "👨", "👩", "👴", "👵", "🧒", "🧑", "👶", "🧔",
    "🦸", "🦹", "🧙", "🧚", "🦊", "🐱", "🐶", "🐰", "🦁", "🐻",
    "🌟", "⭐", "🌈", "🎨", "🎮", "⚽", "🏀", "🎸", "📚", "🎯"
  ];

  const handleOpenEditMember = (member: { id: string; name: string; avatar?: string; age: number }) => {
    setEditingMember(member);
    setEditMemberAvatar(member.avatar || "");
    setEditMemberAge(member.age.toString());
    setShowEditMemberModal(true);
  };

  const handleSaveEditedMember = async () => {
    if (!editingMember) return;
    
    const age = editMemberAge.trim() ? parseInt(editMemberAge) : 0;
    if (isNaN(age) || age < 0) {
      Alert.alert("Error", "Please enter a valid age");
      return;
    }

    setSavingMember(true);
    
    const { error } = await updateMemberProfile(editingMember.id, {
      avatar: editMemberAvatar,
      age: age || undefined,
    });

    if (error) {
      Alert.alert("Error", error.message);
      setSavingMember(false);
      return;
    }

    setSavingMember(false);
    setShowEditMemberModal(false);
    setEditingMember(null);
    setEditMemberAvatar("");
    setEditMemberAge("");
  };

  // Find current user member for edit button - use the flexible matching function
  const currentUserMember = findCurrentUserMember();

  return (
    <ScrollView 
      style={styles.container} 
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
        {/* Participants Section - Collapsible */}
        <TouchableOpacity 
          style={[styles.collapsibleCard, expandedSection === 'participants' && styles.collapsibleCardExpanded]}
          onPress={() => setExpandedSection(expandedSection === 'participants' ? null : 'participants')}
          activeOpacity={0.7}
          data-testid="button-toggle-participants"
        >
          <View style={styles.collapsibleHeader}>
            <Ionicons name="people" size={24} color={colors.primary} />
            <Text style={styles.collapsibleTitle}>Participants</Text>
            <View style={styles.collapsibleBadge}>
              <Text style={styles.collapsibleBadgeText}>{kids.length}</Text>
            </View>
            <Ionicons 
              name={expandedSection === 'participants' ? "chevron-up" : "chevron-down"} 
              size={20} 
              color={colors.textSecondary} 
            />
          </View>
        </TouchableOpacity>

        {expandedSection === 'participants' && (
          <View style={styles.expandedSection}>
            {kids.length === 0 ? (
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
            ) : (
              <View style={styles.expandedMembersList}>
                {kids.map((kid) => (
                  <View key={kid.id} style={styles.expandedMemberCard}>
                    <TouchableOpacity 
                      style={styles.expandedMemberContent}
                      onPress={() => router.push(`/member/${kid.id}`)}
                      data-testid={`button-member-${kid.id}`}
                    >
                      <View style={styles.expandedMemberHeader}>
                        <View style={styles.expandedMemberAvatar}>
                          {kid.avatar ? (
                            <Text style={styles.expandedMemberAvatarEmoji}>{kid.avatar}</Text>
                          ) : (
                            <Text style={styles.expandedMemberInitial}>
                              {kid.name.charAt(0).toUpperCase()}
                            </Text>
                          )}
                        </View>
                        <View style={styles.expandedMemberInfo}>
                          <Text style={styles.expandedMemberName}>{kid.name}</Text>
                          <Text style={styles.expandedMemberSubtitle}>
                            {kid.age ? `Age ${kid.age}` : "Participant"}
                          </Text>
                        </View>
                        <View style={styles.expandedMemberStars}>
                          <Ionicons name="star" size={18} color={colors.secondary} />
                          <Text style={styles.expandedMemberStarsText}>{kid.starsTotal}</Text>
                        </View>
                      </View>
                      
                      {/* Passcode row for owners */}
                      {isOwner && kid.passcode && (
                        <TouchableOpacity 
                          style={styles.expandedPasscodeRow}
                          onPress={() => handleCopyPasscode(kid.passcode!)}
                          data-testid={`button-copy-passcode-${kid.id}`}
                        >
                          <Ionicons name="key-outline" size={14} color={colors.textSecondary} />
                          <Text style={styles.expandedPasscodeText}>Login Code: {kid.passcode}</Text>
                          <Ionicons 
                            name={copiedPasscode === kid.passcode ? "checkmark-circle" : "copy-outline"} 
                            size={16} 
                            color={copiedPasscode === kid.passcode ? colors.success : colors.primary} 
                          />
                        </TouchableOpacity>
                      )}
                      
                      {/* Powers */}
                      {kid.powers.length > 0 && (
                        <View style={styles.expandedPowerTags}>
                          {kid.powers.map((p) => (
                            <View key={p.powerKey} style={styles.expandedPowerTag}>
                              <Text style={styles.expandedPowerTagText}>
                                {POWER_INFO[p.powerKey].name}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </TouchableOpacity>
                    
                    {/* Actions for owners */}
                    {isOwner && (
                      <View style={styles.expandedMemberActions}>
                        <TouchableOpacity
                          style={styles.expandedEditButton}
                          onPress={() => handleOpenEditMember({ id: kid.id, name: kid.name, avatar: kid.avatar, age: kid.age })}
                          data-testid={`button-edit-${kid.id}`}
                        >
                          <Ionicons name="pencil" size={18} color={colors.primary} />
                          <Text style={styles.expandedEditButtonText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.expandedRemoveButton}
                          onPress={() => handleRemoveParticipant(kid.id, kid.name, kid.profileId, kid.passcode)}
                          data-testid={`button-remove-${kid.id}`}
                        >
                          <Ionicons name="trash-outline" size={18} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Guardians Section - Collapsible */}
        <TouchableOpacity 
          style={[styles.collapsibleCard, expandedSection === 'guardians' && styles.collapsibleCardExpanded]}
          onPress={() => setExpandedSection(expandedSection === 'guardians' ? null : 'guardians')}
          activeOpacity={0.7}
          data-testid="button-toggle-guardians"
        >
          <View style={styles.collapsibleHeader}>
            <Ionicons name="shield-checkmark" size={24} color={colors.primaryLight} />
            <Text style={styles.collapsibleTitle}>Guardians</Text>
            <View style={styles.collapsibleBadge}>
              <Text style={styles.collapsibleBadgeText}>{guardians.length}</Text>
            </View>
            <Ionicons 
              name={expandedSection === 'guardians' ? "chevron-up" : "chevron-down"} 
              size={20} 
              color={colors.textSecondary} 
            />
          </View>
        </TouchableOpacity>

        {expandedSection === 'guardians' && (
          <View style={styles.expandedSection}>
            {guardians.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No guardians yet</Text>
              </View>
            ) : (
              <View style={styles.expandedMembersList}>
                {guardians.map((guardian) => {
                  const isCurrentUser = guardian.id === profile?.id || 
                    (profile?.display_name && guardian.name === profile.display_name && guardian.role === 'guardian');
                  return (
                    <View key={guardian.id} style={styles.expandedMemberCard}>
                      <TouchableOpacity 
                        style={styles.expandedMemberContent}
                        onPress={() => router.push(`/member/${guardian.id}`)}
                        data-testid={`button-member-${guardian.id}`}
                      >
                        <View style={styles.expandedMemberHeader}>
                          <View style={[styles.expandedMemberAvatar, styles.expandedGuardianAvatar]}>
                            {guardian.avatar ? (
                              <Text style={styles.expandedMemberAvatarEmoji}>{guardian.avatar}</Text>
                            ) : (
                              <Text style={styles.expandedMemberInitial}>
                                {guardian.name.charAt(0).toUpperCase()}
                              </Text>
                            )}
                          </View>
                          <View style={styles.expandedMemberInfo}>
                            <View style={styles.expandedNameRow}>
                              <Text style={styles.expandedMemberName}>{guardian.name}</Text>
                              {isCurrentUser && (
                                <View style={styles.youBadge}>
                                  <Text style={styles.youBadgeText}>You</Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.expandedMemberSubtitle}>
                              Guardian{guardian.age ? ` • Age ${guardian.age}` : ""}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                      
                      {/* Actions */}
                      {(isOwner || (isCurrentUser && !isOwner)) && (
                        <View style={styles.expandedMemberActions}>
                          <TouchableOpacity
                            style={styles.expandedEditButton}
                            onPress={isOwner 
                              ? () => handleOpenEditMember({ id: guardian.id, name: guardian.name, avatar: guardian.avatar, age: guardian.age })
                              : handleOpenEditName
                            }
                            data-testid={isOwner ? `button-edit-${guardian.id}` : "button-edit-name"}
                          >
                            <Ionicons name="pencil" size={18} color={colors.primary} />
                            <Text style={styles.expandedEditButtonText}>Edit</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </View>

      {isOwner && isConfigured && joinRequests.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Join Requests</Text>
            <View style={styles.requestBadge}>
              <Text style={styles.requestBadgeText}>{joinRequests.length}</Text>
            </View>
          </View>
          <View style={styles.membersList}>
            {joinRequests.map((request) => {
              const displayName = request.requester_profile?.display_name?.trim();
              const roleLabel = request.requester_profile?.role === "guardian" ? "Guardian" : "Participant";
              const requesterName = displayName && displayName.length > 0 
                ? displayName 
                : `New ${roleLabel}`;
              const requesterInitial = displayName && displayName.length > 0 
                ? displayName.charAt(0).toUpperCase() 
                : roleLabel.charAt(0).toUpperCase();
              return (
              <View key={request.id} style={styles.requestItem} data-testid={`join-request-${request.id}`}>
                <View style={styles.requestInfo}>
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberInitial}>
                      {requesterInitial}
                    </Text>
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, !displayName && styles.missingName]}>
                      {requesterName}
                    </Text>
                    <Text style={styles.memberAge}>
                      {request.requester_profile?.role === "guardian" ? "Guardian" : "Participant"}
                    </Text>
                  </View>
                </View>
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={styles.rejectButton}
                    onPress={() => handleRejectRequest(request.id)}
                    disabled={processingRequest === request.id}
                    data-testid={`button-reject-${request.id}`}
                  >
                    <Ionicons 
                      name="close" 
                      size={18} 
                      color={processingRequest === request.id ? colors.textMuted : colors.error} 
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.approveButton}
                    onPress={() => handleApproveRequest(request.id)}
                    disabled={processingRequest === request.id}
                    data-testid={`button-approve-${request.id}`}
                  >
                    <Ionicons 
                      name="checkmark" 
                      size={18} 
                      color={processingRequest === request.id ? colors.textMuted : "#FFFFFF"} 
                    />
                  </TouchableOpacity>
                </View>
              </View>
              );
            })}
          </View>
        </View>
      )}

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
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.settingRow}
            onPress={async () => {
              if (Platform.OS === 'web') {
                const confirmed = window.confirm("This will clear all cached data on this device. You'll need to sign in again. Use this to test with a fresh state.");
                if (confirmed) {
                  await AsyncStorage.removeItem(STORAGE_KEY);
                  await signOut();
                  router.replace("/auth/sign-in");
                }
              } else {
                Alert.alert(
                  "Clear Local Data",
                  "This will clear all cached data on this device. You'll need to sign in again. Use this to test with a fresh state.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Clear & Sign Out",
                      style: "destructive",
                      onPress: async () => {
                        await AsyncStorage.removeItem(STORAGE_KEY);
                        await signOut();
                        router.replace("/auth/sign-in");
                      }
                    }
                  ]
                );
              }
            }}
            data-testid="button-clear-local-data"
          >
            <Ionicons name="trash-outline" size={24} color={colors.error} />
            <Text style={[styles.settingLabel, { color: colors.error }]}>Clear Local Data</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
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

            {isConfigured ? (
              <View style={styles.cloudModeInfo}>
                <Ionicons name="information-circle" size={48} color={colors.primary} />
                <Text style={styles.cloudModeTitle}>Invite Family Members</Text>
                <Text style={styles.cloudModeText}>
                  In cloud mode, family members join using the invite code. Each person creates their own account and selects their role (guardian or participant).
                </Text>
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={() => {
                    setShowAddModal(false);
                    setShowInviteDrawer(true);
                  }}
                  data-testid="button-show-invite-code"
                >
                  <Ionicons name="share-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.confirmButtonText}>Share Invite Code</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
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
              </>
            )}
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

      <Modal visible={showEditNameModal} animationType="slide" transparent>
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Your Name</Text>
              <TouchableOpacity onPress={() => setShowEditNameModal(false)}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.editNameDescription}>
              Update your display name. This is how you appear to other family members.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Your Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter your name"
                placeholderTextColor={colors.textMuted}
                value={editingName}
                onChangeText={setEditingName}
                autoFocus
                data-testid="input-edit-name"
              />
            </View>

            <TouchableOpacity
              style={[
                styles.confirmButton,
                (!editingName.trim() || savingName) && styles.confirmButtonDisabled,
              ]}
              onPress={handleSaveEditedName}
              disabled={!editingName.trim() || savingName}
              data-testid="button-save-name"
            >
              <Text style={styles.confirmButtonText}>
                {savingName ? "Saving..." : "Save Name"}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showEditMemberModal} animationType="slide" transparent>
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit {editingMember?.name}</Text>
              <TouchableOpacity onPress={() => {
                setShowEditMemberModal(false);
                setEditingMember(null);
              }}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Avatar Emoji</Text>
              <View style={styles.currentAvatarRow}>
                <View style={styles.avatarPreview}>
                  {editMemberAvatar ? (
                    <Text style={styles.avatarPreviewEmoji}>{editMemberAvatar}</Text>
                  ) : (
                    <Text style={styles.avatarPreviewInitial}>
                      {editingMember?.name.charAt(0).toUpperCase() || "?"}
                    </Text>
                  )}
                </View>
                {editMemberAvatar && (
                  <TouchableOpacity 
                    style={styles.clearAvatarButton}
                    onPress={() => setEditMemberAvatar("")}
                  >
                    <Ionicons name="close-circle" size={20} color={colors.error} />
                    <Text style={styles.clearAvatarText}>Clear</Text>
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiScroll}>
                <View style={styles.emojiGrid}>
                  {emojiOptions.map((emoji) => (
                    <TouchableOpacity
                      key={emoji}
                      style={[
                        styles.emojiOption,
                        editMemberAvatar === emoji && styles.emojiOptionSelected
                      ]}
                      onPress={() => setEditMemberAvatar(emoji)}
                    >
                      <Text style={styles.emojiOptionText}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Age</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter age"
                placeholderTextColor={colors.textMuted}
                value={editMemberAge}
                onChangeText={setEditMemberAge}
                keyboardType="number-pad"
                data-testid="input-edit-age"
              />
            </View>

            <TouchableOpacity
              style={[
                styles.confirmButton,
                savingMember && styles.confirmButtonDisabled,
              ]}
              onPress={handleSaveEditedMember}
              disabled={savingMember}
              data-testid="button-save-member"
            >
              <Text style={styles.confirmButtonText}>
                {savingMember ? "Saving..." : "Save Changes"}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showRemoveModal} animationType="slide" transparent>
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Remove Participant</Text>
              <TouchableOpacity onPress={() => {
                setShowRemoveModal(false);
                setRemoveTarget(null);
                setRemovePasscodeInput("");
                setRemoveError("");
              }}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.removeWarningBox}>
              <Ionicons name="warning" size={24} color={colors.error} />
              <Text style={styles.removeWarningText}>
                This action cannot be undone. {removeTarget?.memberName}'s profile and all their data will be permanently deleted.
              </Text>
            </View>

            {removeTarget?.passcode ? (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Enter {removeTarget?.memberName}'s passcode to confirm
                </Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter 4-digit passcode"
                  placeholderTextColor={colors.textMuted}
                  value={removePasscodeInput}
                  onChangeText={setRemovePasscodeInput}
                  keyboardType="numeric"
                  maxLength={4}
                  autoFocus
                  data-testid="input-remove-passcode"
                />
                {removeError ? (
                  <Text style={styles.errorText}>{removeError}</Text>
                ) : null}
              </View>
            ) : (
              <Text style={styles.editNameDescription}>
                Are you sure you want to remove {removeTarget?.memberName} from the family?
              </Text>
            )}

            {removeError && !removeTarget?.passcode ? (
              <Text style={styles.errorText}>{removeError}</Text>
            ) : null}

            <View style={styles.removeButtonRow}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowRemoveModal(false);
                  setRemoveTarget(null);
                  setRemovePasscodeInput("");
                  setRemoveError("");
                  setCopiedPasscode(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.removeConfirmButton,
                  isRemoveDisabled() && styles.confirmButtonDisabled,
                ]}
                onPress={confirmRemoveParticipant}
                disabled={isRemoveDisabled()}
                data-testid="button-confirm-remove"
              >
                <Text style={styles.removeConfirmButtonText}>
                  {removingMember ? "Removing..." : "Remove"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
  memberAvatarEmoji: {
    fontSize: 28,
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
  missingName: {
    fontStyle: "italic",
    color: colors.textMuted,
  },
  memberItemContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },
  editNameButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: spacing.sm,
  },
  memberActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  editMemberButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  currentAvatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  avatarPreview: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: colors.primaryLight,
  },
  avatarPreviewEmoji: {
    fontSize: 32,
  },
  avatarPreviewInitial: {
    fontSize: 28,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  clearAvatarButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  clearAvatarText: {
    fontSize: fontSize.sm,
    color: colors.error,
  },
  emojiScroll: {
    maxHeight: 120,
  },
  emojiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  emojiOption: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  emojiOptionSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  emojiOptionText: {
    fontSize: 24,
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
  requestBadge: {
    backgroundColor: colors.error,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    minWidth: 24,
    alignItems: "center",
  },
  requestBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  requestItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  requestInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },
  requestActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  approveButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.success,
    justifyContent: "center",
    alignItems: "center",
  },
  rejectButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
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
  // Collapsible section styles
  collapsibleCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  collapsibleCardExpanded: {
    backgroundColor: colors.primaryLight,
    marginBottom: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  collapsibleHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  collapsibleTitle: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
  },
  collapsibleBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    minWidth: 28,
    alignItems: "center",
  },
  collapsibleBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  expandedSection: {
    backgroundColor: colors.surfaceSecondary,
    borderBottomLeftRadius: borderRadius.md,
    borderBottomRightRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  expandedMembersList: {
    gap: spacing.md,
  },
  expandedMemberCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  expandedMemberContent: {
    gap: spacing.sm,
  },
  expandedMemberHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  expandedMemberAvatar: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  expandedGuardianAvatar: {
    backgroundColor: colors.primaryLight,
  },
  expandedMemberAvatarEmoji: {
    fontSize: 32,
  },
  expandedMemberInitial: {
    fontSize: fontSize.xl,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  expandedMemberInfo: {
    flex: 1,
  },
  expandedNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  expandedMemberName: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.text,
  },
  expandedMemberSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  expandedMemberStars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  expandedMemberStarsText: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.secondary,
  },
  expandedPasscodeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
  },
  expandedPasscodeText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontFamily: "monospace",
  },
  expandedPowerTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  expandedPowerTag: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  expandedPowerTagText: {
    fontSize: fontSize.xs,
    fontWeight: "500",
    color: colors.primary,
  },
  expandedMemberActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  expandedEditButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  expandedEditButtonText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: "500",
  },
  expandedRemoveButton: {
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  youBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  youBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: "#FFFFFF",
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
  cloudModeInfo: {
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  cloudModeTitle: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  cloudModeText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
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
  editNameDescription: {
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
  memberMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  passcodeTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  passcodeTagText: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  removeButton: {
    padding: spacing.sm,
    marginLeft: spacing.sm,
  },
  removeWarningBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.errorBackground || "#FEE2E2",
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  removeWarningText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.error,
    lineHeight: 20,
  },
  removeButtonRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
  },
  removeConfirmButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.error,
    alignItems: "center",
  },
  removeConfirmButtonText: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  errorText: {
    color: colors.error,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
});
