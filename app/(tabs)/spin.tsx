import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform, Alert, RefreshControl } from "react-native";
import { useState, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, fontSize } from "@/lib/theme";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/authContext";
import { TaskTemplate, Member } from "@/lib/types";
import { format, addMinutes, endOfDay } from "date-fns";
import { createCloudTaskInstance, createCloudTask, taskToTemplate } from "@/lib/cloudSync";
import { playSpinSound, playWinnerSound, playClickSound, stopAllSounds, playSuccessSound } from "@/lib/soundService";
import { FamilyWheel } from "@/components/FamilyWheel";
import { useResponsive } from "@/lib/useResponsive";
import { GameCard } from "@/components/GameCard";
import { CATEGORIES, getGamesByCategory, getGameById, GameCategory } from "@/lib/gamesRegistry";

/**
 * HOW TO ADD A NEW GAME:
 * 1. Add an entry to GAMES array in lib/gamesRegistry.ts
 * 2. Create the game screen in app/games/[your-game].tsx
 * 3. The Games Hub will automatically show the new game in its category
 */

type HubView = "hub" | "assign" | "game";
type WheelMode = "assign" | "game";
type GamePhase = "setup" | "playing" | "winner";

interface GameScore {
  memberId: string;
  memberName: string;
  score: number;
}

interface WheelSegment {
  id: string;
  label: string;
  color: string;
  value?: number;
  avatar?: string;
}

const PASTEL_COLORS = [
  "#FFB5BA",
  "#B5E8C3", 
  "#FFE5A0",
  "#B5D8FF",
  "#E5B5FF",
  "#FFD5B5",
  "#B5FFE5",
  "#FFB5E5",
];

const STAR_SEGMENTS: WheelSegment[] = [
  { id: "star-1", label: "1", color: "#FFB5BA", value: 1 },
  { id: "star-2", label: "2", color: "#B5E8C3", value: 2 },
  { id: "star-3", label: "3", color: "#FFE5A0", value: 3 },
  { id: "star-1b", label: "1", color: "#B5D8FF", value: 1 },
  { id: "star-2b", label: "2", color: "#E5B5FF", value: 2 },
  { id: "star-3b", label: "3", color: "#FFD5B5", value: 3 },
];

export default function SpinScreen() {
  const router = useRouter();
  const responsive = useResponsive();
  const { profile, refreshProfile } = useAuth();
  const isGuardian = profile?.role === 'guardian';
  
  const members = useStore((s) => s.members);
  const taskTemplates = useStore((s) => s.taskTemplates);
  const addTaskInstance = useStore((s) => s.addTaskInstance);
  const addTaskTemplate = useStore((s) => s.addTaskTemplate);

  const [hubView, setHubView] = useState<HubView>("hub");
  const [selectedCategory, setSelectedCategory] = useState<GameCategory>("spin");
  const [mode, setMode] = useState<WheelMode>("assign");
  const [spinning, setSpinning] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [taskSearch, setTaskSearch] = useState("");
  
  const [gamePhase, setGamePhase] = useState<GamePhase>("setup");
  const [targetScore, setTargetScore] = useState(10);
  const [gameScores, setGameScores] = useState<GameScore[]>([]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [lastSpinResult, setLastSpinResult] = useState<number | null>(null);
  const [winner, setWinner] = useState<GameScore | null>(null);
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set(members.map(m => m.id)));

  const allMembers = members;
  const gamePlayers = useMemo(() => 
    allMembers.filter(m => selectedPlayers.has(m.id)), 
    [allMembers, selectedPlayers]
  );
  const enabledTemplates = taskTemplates.filter((t) => t.enabled && !t.isArchived);

  // Sync selectedPlayers when members change (e.g., after refresh/sync)
  useEffect(() => {
    setSelectedPlayers(prev => {
      const memberIds = new Set(members.map(m => m.id));
      const newSelected = new Set<string>();
      // Keep existing selections that are still valid
      prev.forEach(id => {
        if (memberIds.has(id)) {
          newSelected.add(id);
        }
      });
      // Add any new members
      members.forEach(m => {
        if (!prev.has(m.id)) {
          newSelected.add(m.id);
        }
      });
      return newSelected;
    });
    
    // Reset game if playing and players changed
    if (gamePhase === "playing") {
      const currentPlayerIds = new Set(gameScores.map(s => s.memberId));
      const memberIds = new Set(members.map(m => m.id));
      const hasInvalidPlayer = gameScores.some(s => !memberIds.has(s.memberId));
      if (hasInvalidPlayer) {
        resetGame();
      }
    }
  }, [members]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshProfile();
    } catch (err) {
      console.error('[Spin] Refresh error:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshProfile]);

  const memberSegments: WheelSegment[] = useMemo(() => 
    allMembers.map((member, index) => ({
      id: member.id,
      label: member.name,
      color: PASTEL_COLORS[index % PASTEL_COLORS.length],
      avatar: member.avatar,
    })), [allMembers]
  );

  const handleModeChange = (newMode: WheelMode) => {
    if (spinning) return;
    setMode(newMode);
    setSelectedMember(null);
    setGamePhase("setup");
    setWinner(null);
    setSelectedPlayers(new Set(members.map(m => m.id)));
    playClickSound();
  };

  const handleGameSelect = (gameId: string) => {
    playClickSound();
    const game = getGameById(gameId);
    
    if (game?.isComingSoon) {
      router.push({
        pathname: '/games/coming-soon',
        params: {
          title: game.title,
          description: game.comingSoonNote || '',
          icon: game.icon,
          iconColor: game.iconColor,
        },
      });
      return;
    }
    
    if (gameId === 'assign-task') {
      setMode('assign');
      setHubView('assign');
    } else if (gameId === 'family-game') {
      setMode('game');
      setHubView('game');
      setGamePhase('setup');
      setSelectedPlayers(new Set(members.map(m => m.id)));
    } else if (gameId === 'charades-mini') {
      router.push('/games/charades-mini');
    }
  };

  const handleBackToHub = () => {
    if (spinning) return;
    playClickSound();
    setHubView('hub');
    setMode('assign');
    setSelectedMember(null);
    setGamePhase('setup');
    setWinner(null);
    stopAllSounds();
  };

  const togglePlayerSelection = (memberId: string) => {
    setSelectedPlayers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(memberId)) {
        newSet.delete(memberId);
      } else {
        newSet.add(memberId);
      }
      return newSet;
    });
    playClickSound();
  };

  const handleAssignSpin = () => {
    if (spinning || allMembers.length === 0) return;
    setSpinning(true);
    playSpinSound();
  };

  const handleAssignSpinComplete = (segment: WheelSegment) => {
    setSpinning(false);
    stopAllSounds();
    playWinnerSound();
    const member = allMembers.find(m => m.id === segment.id);
    if (member) {
      setSelectedMember(member);
    }
  };

  const handleAssignTask = () => {
    setShowTaskPicker(true);
  };

  const handleSelectTask = async (template: TaskTemplate) => {
    if (!selectedMember || !profile?.family_id) return;

    try {
      const now = new Date();
      const dueAt = endOfDay(now);
      
      const cloudInstance = await createCloudTaskInstance({
        task_id: template.id,
        member_id: selectedMember.id,
        family_id: profile.family_id,
        assigned_by: profile.id,
        status: 'open',
        due_at: dueAt.toISOString(),
        schedule_type: 'one_time',
        expires_at: null,
      });

      if (cloudInstance) {
        addTaskInstance({
          id: cloudInstance.id,
          taskId: template.id,
          memberId: selectedMember.id,
          status: "open",
          dueAt: dueAt.toISOString(),
          scheduleType: "one_time",
          expiresAt: null,
        });
        
        playSuccessSound();
        Alert.alert(
          "Task Assigned!",
          `"${template.title}" has been assigned to ${selectedMember.name}`,
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error('[Spin] Error assigning task:', error);
      Alert.alert("Error", "Failed to assign task. Please try again.");
    }

    setShowTaskPicker(false);
    setSelectedMember(null);
    setTaskSearch("");
  };

  const handleCreateQuickTask = async () => {
    if (!taskSearch.trim() || !selectedMember || !profile?.family_id) return;

    try {
      const newTemplate = await createCloudTask({
        title: taskSearch.trim(),
        category: "personal",
        icon_key: "star",
        default_stars: 1,
        family_id: profile.family_id,
        schedule_type: "one_time",
        enabled: false,
      });

      if (newTemplate) {
        const template = taskToTemplate(newTemplate);
        addTaskTemplate(template);
        await handleSelectTask(template);
      }
    } catch (error) {
      console.error('[Spin] Error creating quick task:', error);
      Alert.alert("Error", "Failed to create task. Please try again.");
    }
  };

  const startGame = () => {
    if (gamePlayers.length < 2) {
      Alert.alert("Need More Players", "You need at least 2 players selected to play the game!");
      return;
    }
    
    const initialScores: GameScore[] = gamePlayers.map(m => ({
      memberId: m.id,
      memberName: m.name,
      score: 0,
    }));
    
    setGameScores(initialScores);
    setCurrentPlayerIndex(0);
    setGamePhase("playing");
    setWinner(null);
    setLastSpinResult(null);
    playClickSound();
  };

  const handleGameSpin = () => {
    if (spinning || gamePhase !== "playing") return;
    setSpinning(true);
    setLastSpinResult(null);
    playSpinSound();
  };

  const handleGameSpinComplete = (segment: WheelSegment) => {
    setSpinning(false);
    stopAllSounds();
    playWinnerSound();
    
    const starsWon = segment.value || 1;
    setLastSpinResult(starsWon);
    
    // Guard against empty players (should not happen, but be safe)
    if (gamePlayers.length === 0) {
      resetGame();
      return;
    }
    
    setGameScores(prev => {
      const updated = [...prev];
      if (!updated[currentPlayerIndex]) {
        return prev; // Guard against invalid index
      }
      updated[currentPlayerIndex].score += starsWon;
      
      if (updated[currentPlayerIndex].score >= targetScore) {
        setTimeout(() => {
          setWinner(updated[currentPlayerIndex]);
          setGamePhase("winner");
          playSuccessSound();
        }, 1000);
      } else {
        setTimeout(() => {
          const nextIndex = gamePlayers.length > 0 
            ? (currentPlayerIndex + 1) % gamePlayers.length 
            : 0;
          setCurrentPlayerIndex(nextIndex);
          setLastSpinResult(null);
        }, 2000);
      }
      
      return updated;
    });
  };

  const resetGame = () => {
    setGamePhase("setup");
    setGameScores([]);
    setCurrentPlayerIndex(0);
    setWinner(null);
    setLastSpinResult(null);
    setSelectedPlayers(new Set(members.map(m => m.id)));
    playClickSound();
  };

  const filteredTemplates = enabledTemplates.filter(t =>
    t.title.toLowerCase().includes(taskSearch.toLowerCase())
  );

  const currentPlayer = gamePhase === "playing" ? gameScores[currentPlayerIndex] : null;

  if (hubView === "hub") {
    const categoryGames = getGamesByCategory(selectedCategory);
    
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
        <View style={styles.hubHeader}>
          <Ionicons name="game-controller" size={28} color={colors.primary} />
          <Text style={styles.hubTitle}>Games</Text>
        </View>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categorySelector}
        >
          {CATEGORIES.map(category => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryTab,
                selectedCategory === category.id && styles.categoryTabActive
              ]}
              onPress={() => {
                setSelectedCategory(category.id);
                playClickSound();
              }}
            >
              <Ionicons 
                name={category.icon as any} 
                size={16} 
                color={selectedCategory === category.id ? colors.primary : colors.textMuted} 
              />
              <Text style={[
                styles.categoryTabText,
                selectedCategory === category.id && styles.categoryTabTextActive
              ]}>
                {category.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.gamesList}>
          {categoryGames.map(game => (
            <GameCard
              key={game.id}
              title={game.title}
              subtitle={game.subtitle}
              icon={game.icon}
              iconColor={game.iconColor}
              isNew={game.isNew}
              isComingSoon={game.isComingSoon}
              onPress={() => handleGameSelect(game.id)}
              disabled={game.requiresGuardian && !isGuardian}
            />
          ))}
          
          {categoryGames.length === 0 && (
            <View style={styles.emptyCategory}>
              <Ionicons name="construct-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyCategoryText}>More games coming soon!</Text>
            </View>
          )}
        </View>

        {!isGuardian && selectedCategory === 'spin' && (
          <View style={styles.guardianNote}>
            <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
            <Text style={styles.guardianNoteText}>
              Spin games require a guardian to start
            </Text>
          </View>
        )}
      </ScrollView>
    );
  }

  // Guard: Non-guardians cannot access spin games directly
  if (!isGuardian && (hubView === "assign" || hubView === "game")) {
    // Redirect back to hub
    setHubView("hub");
    return null;
  }

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
      <View style={styles.gameHeader}>
        <TouchableOpacity 
          style={styles.backToHubButton} 
          onPress={handleBackToHub}
          disabled={spinning}
        >
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
          <Text style={styles.backToHubText}>Games</Text>
        </TouchableOpacity>
        <Text style={styles.gameHeaderTitle}>
          {mode === "assign" ? "Assign a Task" : "Family Game"}
        </Text>
        <View style={styles.gameHeaderSpacer} />
      </View>

      <View style={styles.wheelContainer}>
        <FamilyWheel
          segments={mode === "assign" ? memberSegments : STAR_SEGMENTS}
          spinning={spinning}
          onSpinComplete={mode === "assign" ? handleAssignSpinComplete : handleGameSpinComplete}
          size={responsive.isTablet ? 320 : 280}
        />
        
        {mode === "game" && gamePhase === "playing" && (
          <View style={styles.targetBadge}>
            <Text style={styles.targetText}>Target: {targetScore}</Text>
            <Ionicons name="star" size={16} color="#FFD700" style={{ marginLeft: 4 }} />
          </View>
        )}
      </View>

      {mode === "assign" && (
        <TouchableOpacity
          style={[styles.spinButton, (spinning || allMembers.length === 0) && styles.spinButtonDisabled]}
          onPress={handleAssignSpin}
          disabled={spinning || allMembers.length === 0}
        >
          <Ionicons name="star" size={20} color="#FFFFFF" />
          <Text style={styles.spinButtonText}>
            {spinning ? "Spinning..." : "Spin to Choose"}
          </Text>
        </TouchableOpacity>
      )}

      {mode === "game" && gamePhase === "setup" && (
        <View style={styles.gameSetup}>
          <Text style={styles.setupLabel}>Select Players:</Text>
          <View style={styles.playerSelector}>
            {allMembers.map((member) => {
              const isSelected = selectedPlayers.has(member.id);
              return (
                <TouchableOpacity
                  key={member.id}
                  style={[styles.playerOption, isSelected && styles.playerOptionActive]}
                  onPress={() => togglePlayerSelection(member.id)}
                >
                  {member.avatar ? (
                    <Text style={styles.playerAvatar}>{member.avatar}</Text>
                  ) : (
                    <Ionicons name="person-circle" size={24} color={isSelected ? "#FFFFFF" : colors.textMuted} />
                  )}
                  <Text style={[styles.playerName, isSelected && styles.playerNameActive]} numberOfLines={1}>
                    {member.name.split(' ')[0]}
                  </Text>
                  <Ionicons 
                    name={isSelected ? "checkmark-circle" : "add-circle-outline"} 
                    size={18} 
                    color={isSelected ? "#FFFFFF" : colors.textMuted} 
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.setupLabel}>Target Score:</Text>
          <View style={styles.targetSelector}>
            {[5, 10, 15, 20].map(score => (
              <TouchableOpacity
                key={score}
                style={[styles.targetOption, targetScore === score && styles.targetOptionActive]}
                onPress={() => setTargetScore(score)}
              >
                <View style={styles.targetOptionContent}>
                  <Text style={[styles.targetOptionText, targetScore === score && styles.targetOptionTextActive]}>
                    {score}
                  </Text>
                  <Ionicons name="star" size={14} color={targetScore === score ? "#FFD700" : colors.textMuted} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.spinButton, gamePlayers.length < 2 && styles.spinButtonDisabled]}
            onPress={startGame}
            disabled={gamePlayers.length < 2}
          >
            <Ionicons name="game-controller" size={20} color="#FFFFFF" />
            <Text style={styles.spinButtonText}>
              {gamePlayers.length < 2 ? `Select ${2 - gamePlayers.length} More Player${gamePlayers.length === 1 ? '' : 's'}` : 'Start Game'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {mode === "game" && gamePhase === "playing" && (
        <>
          <TouchableOpacity
            style={[styles.spinButton, spinning && styles.spinButtonDisabled]}
            onPress={handleGameSpin}
            disabled={spinning}
          >
            <Ionicons name="star" size={20} color="#FFFFFF" />
            <Text style={styles.spinButtonText}>
              {spinning ? "Spinning..." : `Spin for ${currentPlayer?.memberName || ""}`}
            </Text>
          </TouchableOpacity>

          <View style={styles.scoreboard}>
            <View style={styles.scoreboardHeader}>
              <Ionicons name="trophy" size={20} color="#FFD700" />
              <Text style={styles.scoreboardTitle}>Scoreboard</Text>
            </View>
            {gameScores.map((score, index) => {
              const member = gamePlayers.find(m => m.id === score.memberId);
              const isCurrentPlayer = index === currentPlayerIndex;
              return (
                <View 
                  key={score.memberId} 
                  style={[
                    styles.scoreRow, 
                    isCurrentPlayer && styles.scoreRowActive
                  ]}
                >
                  <View style={styles.scoreRowLeft}>
                    {member?.avatar ? (
                      <Text style={styles.scoreEmoji}>{member.avatar}</Text>
                    ) : (
                      <Ionicons name="person-circle" size={24} color="#8BC34A" />
                    )}
                    <Text style={styles.scoreName} numberOfLines={1}>{score.memberName}</Text>
                  </View>
                  {isCurrentPlayer && (
                    <View style={styles.turnBadge}>
                      <Text style={styles.turnBadgeText}>
                        {lastSpinResult ? `+${lastSpinResult}` : "Your Turn"}
                      </Text>
                    </View>
                  )}
                  <View style={styles.scoreRowRight}>
                    <Ionicons name="star" size={14} color="#FFD700" />
                    <Text style={styles.scoreValue}>{score.score}</Text>
                    <Ionicons name="star" size={14} color="#FFD700" />
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}

      {mode === "game" && gamePhase === "winner" && winner && (
        <View style={styles.winnerCard}>
          <Ionicons name="sparkles" size={24} color="#FFD700" style={styles.confettiIcon} />
          <Text style={styles.winnerTitle}>WE HAVE A WINNER!</Text>
          <Ionicons name="sparkles" size={24} color="#FFD700" style={styles.confettiIconRight} />
          <View style={styles.winnerAvatar}>
            <Ionicons name="ribbon" size={32} color="#FFD700" style={styles.crownIcon} />
            <View style={styles.avatarCircle}>
              <Ionicons name="happy" size={40} color="#8BC34A" />
            </View>
          </View>
          <Text style={styles.winnerName}>{winner.memberName}</Text>
          <View style={styles.winnerScoreRow}>
            <Ionicons name="star" size={16} color="#FFD700" />
            <Text style={styles.winnerScore}>Reached {winner.score} Stars!</Text>
            <Ionicons name="star" size={16} color="#FFD700" />
          </View>
          <TouchableOpacity style={styles.celebrateButton} onPress={resetGame}>
            <Ionicons name="sparkles" size={16} color="#FFFFFF" />
            <Text style={styles.celebrateButtonText}>Celebrate</Text>
            <Ionicons name="sparkles" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      {selectedMember && mode === "assign" && (
        <View style={styles.resultCard}>
          <Ionicons name="clipboard" size={24} color="#5D4037" />
          <Text style={styles.resultTitle}>It's Your Turn!</Text>
          <View style={styles.selectedMemberAvatar}>
            <Ionicons name="happy" size={40} color="#8BC34A" />
          </View>
          <Text style={styles.selectedMemberName}>{selectedMember.name}</Text>
          <TouchableOpacity style={styles.assignButton} onPress={handleAssignTask}>
            <Text style={styles.assignButtonText}>Assign Task</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={showTaskPicker} animationType="slide" transparent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose a Task</Text>
              <TouchableOpacity onPress={() => {
                setShowTaskPicker(false);
                setTaskSearch("");
              }}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder="Search or create a task..."
              value={taskSearch}
              onChangeText={setTaskSearch}
              placeholderTextColor={colors.textMuted}
            />

            <ScrollView style={styles.taskList}>
              {filteredTemplates.map(template => (
                <TouchableOpacity
                  key={template.id}
                  style={styles.taskItem}
                  onPress={() => handleSelectTask(template)}
                >
                  <View style={styles.taskItemLeft}>
                    <Ionicons name={(template.iconKey || "star") as any} size={20} color={colors.primary} />
                    <Text style={styles.taskItemTitle}>{template.title}</Text>
                  </View>
                  <View style={styles.taskItemRight}>
                    <Text style={styles.taskItemStars}>{template.defaultStars}</Text>
                    <Ionicons name="star" size={14} color="#FFD700" />
                  </View>
                </TouchableOpacity>
              ))}
              
              {taskSearch.trim() && filteredTemplates.length === 0 && (
                <TouchableOpacity style={styles.createTaskButton} onPress={handleCreateQuickTask}>
                  <Ionicons name="add-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.createTaskText}>Create "{taskSearch}"</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5FFF5",
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  restrictedContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  restrictedTitle: {
    fontSize: fontSize.xl,
    fontWeight: "bold",
    color: colors.text,
    marginTop: spacing.lg,
  },
  restrictedText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  backButtonText: {
    color: "#FFFFFF",
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  modeSelector: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: borderRadius.xl,
    padding: spacing.xs,
    marginBottom: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modeTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.xs,
  },
  modeTabActive: {
    backgroundColor: "#E8F5E9",
  },
  modeIcon: {
    fontSize: 16,
  },
  modeTabText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: "500",
  },
  modeTabTextActive: {
    color: colors.primary,
    fontWeight: "600",
  },
  hubHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  hubTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
  },
  categorySelector: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  categoryTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    backgroundColor: "#F5F5F5",
  },
  categoryTabActive: {
    backgroundColor: "#E8F5E9",
  },
  categoryTabText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: "500",
  },
  categoryTabTextActive: {
    color: colors.primary,
    fontWeight: "600",
  },
  gamesList: {
    gap: spacing.sm,
  },
  emptyCategory: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
  },
  emptyCategoryText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  guardianNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  guardianNoteText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  gameHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  backToHubButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: spacing.xs,
    paddingRight: spacing.sm,
  },
  backToHubText: {
    fontSize: fontSize.md,
    color: colors.primary,
    fontWeight: "500",
  },
  gameHeaderTitle: {
    fontSize: fontSize.xl,
    fontWeight: "bold",
    color: colors.text,
  },
  gameHeaderSpacer: {
    width: 70,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  modeEmoji: {
    fontSize: 20,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: "bold",
    color: "#5D4037",
  },
  starDecor: {
    fontSize: 20,
  },
  wheelContainer: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  targetBadge: {
    position: "absolute",
    bottom: 50,
    backgroundColor: "#FFF8E1",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    borderColor: "#FFD700",
  },
  targetText: {
    fontSize: fontSize.md,
    fontWeight: "bold",
    color: "#5D4037",
  },
  spinButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4CAF50",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 30,
    marginBottom: spacing.lg,
    gap: spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  spinButtonDisabled: {
    backgroundColor: "#A5D6A7",
  },
  spinButtonIcon: {
    fontSize: 20,
  },
  spinButtonText: {
    fontSize: fontSize.lg,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  gameSetup: {
    backgroundColor: "#FFFFFF",
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  setupLabel: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  targetSelector: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  targetOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: "#F5F5F5",
    borderWidth: 2,
    borderColor: "transparent",
  },
  targetOptionActive: {
    backgroundColor: "#FFF8E1",
    borderColor: "#FFD700",
  },
  targetOptionContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  targetOptionText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: "500",
  },
  targetOptionTextActive: {
    color: "#5D4037",
    fontWeight: "bold",
  },
  playerSelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  playerOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: "#F5F5F5",
    borderWidth: 2,
    borderColor: "transparent",
    minWidth: 100,
  },
  playerOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  playerAvatar: {
    fontSize: 20,
  },
  playerName: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: "500",
    flex: 1,
  },
  playerNameActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  scoreboard: {
    backgroundColor: "#FFFFFF",
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scoreboardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  scoreboardTitle: {
    fontSize: fontSize.md,
    fontWeight: "bold",
    color: colors.text,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.xs,
  },
  scoreRowActive: {
    backgroundColor: "#FFF8E1",
  },
  scoreRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  scoreEmoji: {
    fontSize: 22,
  },
  scoreName: {
    fontSize: fontSize.md,
    fontWeight: "500",
    color: colors.text,
    flexShrink: 1,
  },
  turnBadge: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    marginHorizontal: spacing.xs,
    flexShrink: 0,
  },
  turnBadgeText: {
    fontSize: fontSize.xs,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  scoreRowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  scoreStars: {
    fontSize: 14,
  },
  scoreValue: {
    fontSize: fontSize.lg,
    fontWeight: "bold",
    color: colors.text,
    minWidth: 24,
    textAlign: "center",
  },
  winnerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: "center",
    marginBottom: spacing.lg,
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 3,
    borderColor: "#FFD700",
  },
  confettiIcon: {
    position: "absolute",
    left: spacing.lg,
    top: spacing.lg,
  },
  confettiIconRight: {
    position: "absolute",
    right: spacing.lg,
    top: spacing.lg,
  },
  winnerTitle: {
    fontSize: fontSize.lg,
    fontWeight: "bold",
    color: "#5D4037",
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  winnerAvatar: {
    alignItems: "center",
    marginBottom: spacing.md,
  },
  crownIcon: {
    marginBottom: -10,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FFF8E1",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FFD700",
  },
  winnerName: {
    fontSize: fontSize.xl,
    fontWeight: "bold",
    color: "#5D4037",
    marginBottom: spacing.sm,
  },
  winnerScoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  winnerScore: {
    fontSize: fontSize.md,
    color: "#5D4037",
    fontWeight: "600",
  },
  celebrateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "#FFB74D",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  celebrateButtonText: {
    fontSize: fontSize.md,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  resultCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: "center",
    marginBottom: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultTitle: {
    fontSize: fontSize.lg,
    fontWeight: "bold",
    color: "#5D4037",
    marginBottom: spacing.md,
  },
  selectedMemberAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FFF8E1",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FFD700",
    marginBottom: spacing.md,
  },
  memberEmoji: {
    fontSize: 40,
  },
  selectedMemberName: {
    fontSize: fontSize.xl,
    fontWeight: "bold",
    color: "#5D4037",
    marginBottom: spacing.xs,
  },
  assignButton: {
    backgroundColor: "#FFB74D",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 30,
    marginTop: spacing.md,
  },
  assignButtonText: {
    fontSize: fontSize.md,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: "bold",
    color: colors.text,
  },
  searchInput: {
    backgroundColor: "#F5F5F5",
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    fontSize: fontSize.md,
    marginBottom: spacing.md,
  },
  taskList: {
    maxHeight: 300,
  },
  taskItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  taskItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  taskItemTitle: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  taskItemRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  taskItemStars: {
    fontSize: fontSize.md,
    fontWeight: "bold",
    color: colors.primary,
  },
  taskItemStarIcon: {
    fontSize: 14,
  },
  createTaskButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  createTaskText: {
    color: "#FFFFFF",
    fontSize: fontSize.md,
    fontWeight: "600",
  },
});
