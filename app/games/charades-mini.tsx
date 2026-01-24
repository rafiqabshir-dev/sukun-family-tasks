import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, fontSize } from "@/lib/theme";
import { useReducer, useEffect, useRef, useCallback, useState } from "react";
import { useStore } from "@/lib/store";
import { gameReducer, createInitialState } from "@/lib/games/charades/reducer";
import { selectNextWord } from "@/lib/games/charades/wordSelection";
import { Player, Settings, GameState } from "@/lib/games/charades/types";
import { playClickSound, playSuccessSound } from "@/lib/soundService";

const GAME_COLOR = "#9C27B0";
const GAME_COLOR_LIGHT = "#9C27B020";

export default function CharadesMiniScreen() {
  const router = useRouter();
  const members = useStore((s) => s.members);

  const initialPlayers: Player[] = members.length > 0
    ? members.map(m => ({ id: m.id, name: m.name }))
    : [
        { id: '1', name: 'Player 1' },
        { id: '2', name: 'Player 2' },
        { id: '3', name: 'Player 3' },
      ];

  const [state, dispatch] = useReducer(gameReducer, createInitialState(initialPlayers));

  useEffect(() => {
    if (members.length > 0) {
      dispatch({ type: 'SET_PLAYERS', players: members.map(m => ({ id: m.id, name: m.name })) });
    }
  }, [members]);

  const handleBack = () => {
    playClickSound();
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Charades Mini</Text>
        <View style={styles.placeholder} />
      </View>

      {state.status === 'SETUP' && (
        <SetupView state={state} dispatch={dispatch} />
      )}
      {state.status === 'PASS' && (
        <PassView state={state} dispatch={dispatch} />
      )}
      {state.status === 'REVEAL' && (
        <RevealView state={state} dispatch={dispatch} />
      )}
      {state.status === 'ACT' && (
        <ActView state={state} dispatch={dispatch} />
      )}
      {state.status === 'RESULT' && (
        <ResultView state={state} dispatch={dispatch} />
      )}
      {state.status === 'SUMMARY' && (
        <SummaryView state={state} dispatch={dispatch} />
      )}
    </SafeAreaView>
  );
}

interface ViewProps {
  state: GameState;
  dispatch: React.Dispatch<any>;
}

function SetupView({ state, dispatch }: ViewProps) {
  const [localPlayers, setLocalPlayers] = useState<Player[]>(state.players);
  const [localSettings, setLocalSettings] = useState<Settings>(state.settings);

  const updatePlayerName = (id: string, name: string) => {
    setLocalPlayers(prev => prev.map(p => p.id === id ? { ...p, name } : p));
  };

  const addPlayer = () => {
    const newId = `local-${Date.now()}`;
    setLocalPlayers(prev => [...prev, { id: newId, name: `Player ${prev.length + 1}` }]);
    playClickSound();
  };

  const removePlayer = (id: string) => {
    if (localPlayers.length > 1) {
      setLocalPlayers(prev => prev.filter(p => p.id !== id));
      playClickSound();
    }
  };

  const handleStart = () => {
    const validPlayers = localPlayers.filter(p => p.name.trim().length > 0);
    if (validPlayers.length < 1) {
      return;
    }
    dispatch({ type: 'SET_PLAYERS', players: validPlayers });
    dispatch({ type: 'UPDATE_SETTINGS', settings: localSettings });
    dispatch({ type: 'START_GAME' });
    playClickSound();
  };

  const timeOptions: (20 | 30 | 45)[] = [20, 30, 45];
  const categoryOptions: Settings['category'][] = ['all', 'animals', 'food', 'actions', 'objects'];

  return (
    <ScrollView style={styles.setupContainer} contentContainerStyle={styles.setupContent}>
      <View style={styles.iconContainer}>
        <Ionicons name="body-outline" size={48} color={GAME_COLOR} />
      </View>
      <Text style={styles.setupTitle}>Charades Mini</Text>
      <Text style={styles.setupSubtitle}>Act it out. No talking!</Text>

      <View style={styles.howToPlay}>
        <Ionicons name="help-circle-outline" size={20} color={colors.textSecondary} />
        <Text style={styles.howToPlayText}>
          One player acts, others guess. Pass the device between turns.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Players</Text>
        {localPlayers.map((player, index) => (
          <View key={player.id} style={styles.playerRow}>
            <TextInput
              style={styles.playerInput}
              value={player.name}
              onChangeText={(text) => updatePlayerName(player.id, text)}
              placeholder={`Player ${index + 1}`}
              placeholderTextColor={colors.textMuted}
            />
            {localPlayers.length > 1 && (
              <TouchableOpacity onPress={() => removePlayer(player.id)} style={styles.removeButton}>
                <Ionicons name="close-circle" size={24} color={colors.error} />
              </TouchableOpacity>
            )}
          </View>
        ))}
        <TouchableOpacity onPress={addPlayer} style={styles.addPlayerButton}>
          <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.addPlayerText}>Add player</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Round Time</Text>
        <View style={styles.segmentedControl}>
          {timeOptions.map((time) => (
            <TouchableOpacity
              key={time}
              style={[
                styles.segmentButton,
                localSettings.roundTimeSec === time && styles.segmentButtonActive,
              ]}
              onPress={() => {
                setLocalSettings(prev => ({ ...prev, roundTimeSec: time }));
                playClickSound();
              }}
            >
              <Text style={[
                styles.segmentText,
                localSettings.roundTimeSec === time && styles.segmentTextActive,
              ]}>
                {time}s
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Rounds per Player</Text>
        <View style={styles.stepper}>
          <TouchableOpacity
            onPress={() => {
              if (localSettings.roundsPerPlayer > 1) {
                setLocalSettings(prev => ({ ...prev, roundsPerPlayer: prev.roundsPerPlayer - 1 }));
                playClickSound();
              }
            }}
            style={styles.stepperButton}
          >
            <Ionicons name="remove" size={24} color={localSettings.roundsPerPlayer > 1 ? colors.text : colors.textMuted} />
          </TouchableOpacity>
          <Text style={styles.stepperValue}>{localSettings.roundsPerPlayer}</Text>
          <TouchableOpacity
            onPress={() => {
              if (localSettings.roundsPerPlayer < 5) {
                setLocalSettings(prev => ({ ...prev, roundsPerPlayer: prev.roundsPerPlayer + 1 }));
                playClickSound();
              }
            }}
            style={styles.stepperButton}
          >
            <Ionicons name="add" size={24} color={localSettings.roundsPerPlayer < 5 ? colors.text : colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Category</Text>
        <View style={styles.categoryPills}>
          {categoryOptions.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryPill,
                localSettings.category === cat && styles.categoryPillActive,
              ]}
              onPress={() => {
                setLocalSettings(prev => ({ ...prev, category: cat }));
                playClickSound();
              }}
            >
              <Text style={[
                styles.categoryPillText,
                localSettings.category === cat && styles.categoryPillTextActive,
              ]}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity onPress={handleStart} style={styles.startButton}>
        <Ionicons name="play" size={24} color="#FFFFFF" />
        <Text style={styles.startButtonText}>Start Game</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function PassView({ state, dispatch }: ViewProps) {
  const currentPlayerIndex = state.currentTurnIndex % state.players.length;
  const currentPlayer = state.players[currentPlayerIndex];
  const currentRound = Math.floor(state.currentTurnIndex / state.players.length) + 1;
  const totalRounds = state.settings.roundsPerPlayer;

  const handleReady = () => {
    const word = selectNextWord({
      category: state.settings.category,
      usedWordIds: state.usedWordIds,
    });
    dispatch({
      type: 'PLAYER_READY',
      wordId: word.id,
      wordText: word.text,
      wordCategory: word.category,
    });
    playClickSound();
  };

  return (
    <View style={styles.centeredView}>
      <View style={styles.passContainer}>
        <Text style={styles.roundIndicator}>Round {currentRound} of {totalRounds}</Text>
        <Ionicons name="hand-left-outline" size={64} color={GAME_COLOR} style={styles.passIcon} />
        <Text style={styles.passLabel}>Pass to:</Text>
        <Text style={styles.passPlayerName}>{currentPlayer.name}</Text>
        <Text style={styles.passInstruction}>Only the actor should see the word!</Text>
        
        <TouchableOpacity onPress={handleReady} style={styles.readyButton}>
          <Ionicons name="eye" size={24} color="#FFFFFF" />
          <Text style={styles.readyButtonText}>I'm Ready</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function RevealView({ state, dispatch }: ViewProps) {
  const currentTurn = state.turns[state.turns.length - 1];
  const [countdown, setCountdown] = useState(2);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          dispatch({ type: 'REVEAL_COMPLETE' });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [dispatch]);

  return (
    <View style={styles.centeredView}>
      <View style={styles.revealContainer}>
        <Text style={styles.revealWord}>{currentTurn?.wordText}</Text>
        <View style={styles.revealWarning}>
          <Ionicons name="volume-mute" size={28} color={colors.error} />
          <Text style={styles.revealWarningText}>No talking!</Text>
        </View>
        <Text style={styles.revealCountdown}>Starting in {countdown}...</Text>
      </View>
    </View>
  );
}

function ActView({ state, dispatch }: ViewProps) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!state.timerPaused) {
      timerRef.current = setInterval(() => {
        dispatch({ type: 'TICK' });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [state.timerPaused, dispatch]);

  useEffect(() => {
    if (state.timeRemaining <= 5 && state.timeRemaining > 0) {
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 100, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]).start();
    }
  }, [state.timeRemaining, pulseAnim]);

  const togglePause = () => {
    dispatch({ type: 'TOGGLE_PAUSE' });
    playClickSound();
  };

  const endEarly = () => {
    dispatch({ type: 'END_EARLY' });
    playClickSound();
  };

  const timerColor = state.timeRemaining <= 5 ? colors.error : GAME_COLOR;

  return (
    <View style={styles.centeredView}>
      <View style={styles.actContainer}>
        <Text style={styles.actTitle}>ACT NOW!</Text>
        
        <Animated.View style={[styles.timerCircle, { transform: [{ scale: pulseAnim }], borderColor: timerColor }]}>
          <Text style={[styles.timerText, { color: timerColor }]}>{state.timeRemaining}</Text>
        </Animated.View>

        <View style={styles.actButtons}>
          <TouchableOpacity onPress={togglePause} style={styles.actButton}>
            <Ionicons name={state.timerPaused ? "play" : "pause"} size={28} color={colors.text} />
            <Text style={styles.actButtonText}>{state.timerPaused ? "Resume" : "Pause"}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={endEarly} style={[styles.actButton, styles.endEarlyButton]}>
            <Ionicons name="stop" size={28} color="#FFFFFF" />
            <Text style={[styles.actButtonText, styles.endEarlyText]}>End Turn</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function ResultView({ state, dispatch }: ViewProps) {
  const currentTurn = state.turns[state.turns.length - 1];
  const currentPlayerIndex = (state.currentTurnIndex - 1) % state.players.length;
  const currentPlayer = state.players[currentPlayerIndex >= 0 ? currentPlayerIndex : 0];

  const handleResult = (result: 'guessed' | 'skipped') => {
    if (result === 'guessed') {
      playSuccessSound();
    } else {
      playClickSound();
    }
    
    dispatch({ type: 'RECORD_RESULT', result });
    
    const totalRoundsNeeded = state.players.length * state.settings.roundsPerPlayer;
    if (state.currentTurnIndex < totalRoundsNeeded) {
      setTimeout(() => {
        const word = selectNextWord({
          category: state.settings.category,
          usedWordIds: state.usedWordIds,
        });
        dispatch({
          type: 'NEXT_TURN',
          wordId: word.id,
          wordText: word.text,
          wordCategory: word.category,
        });
      }, 100);
    }
  };

  return (
    <View style={styles.centeredView}>
      <View style={styles.resultContainer}>
        <Text style={styles.resultLabel}>The word was:</Text>
        <Text style={styles.resultWord}>{currentTurn?.wordText}</Text>
        <Text style={styles.resultPlayerLabel}>{currentPlayer?.name}'s turn</Text>

        <View style={styles.resultButtons}>
          <TouchableOpacity
            onPress={() => handleResult('guessed')}
            style={[styles.resultButton, styles.guessedButton]}
          >
            <Ionicons name="checkmark-circle" size={32} color="#FFFFFF" />
            <Text style={styles.resultButtonText}>Guessed!</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => handleResult('skipped')}
            style={[styles.resultButton, styles.skippedButton]}
          >
            <Ionicons name="close-circle" size={32} color="#FFFFFF" />
            <Text style={styles.resultButtonText}>Skipped</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function SummaryView({ state, dispatch }: ViewProps) {
  const scores = state.players.map(player => {
    const playerTurns = state.turns.filter(t => t.playerId === player.id);
    const points = playerTurns.filter(t => t.result === 'guessed').length;
    return { player, points };
  });

  scores.sort((a, b) => b.points - a.points);

  const winner = scores[0];
  const hasWinner = winner && winner.points > 0;

  useEffect(() => {
    if (hasWinner) {
      playSuccessSound();
    }
  }, [hasWinner]);

  const handlePlayAgain = () => {
    dispatch({ type: 'PLAY_AGAIN' });
    playClickSound();
  };

  const handleChangeSettings = () => {
    dispatch({ type: 'CHANGE_SETTINGS' });
    playClickSound();
  };

  return (
    <ScrollView style={styles.summaryContainer} contentContainerStyle={styles.summaryContent}>
      {hasWinner && (
        <View style={styles.winnerSection}>
          <Ionicons name="trophy" size={64} color={colors.secondary} />
          <Text style={styles.winnerLabel}>Winner!</Text>
          <Text style={styles.winnerName}>{winner.player.name}</Text>
          <Text style={styles.winnerPoints}>{winner.points} point{winner.points !== 1 ? 's' : ''}</Text>
        </View>
      )}

      <View style={styles.scoreboardSection}>
        <Text style={styles.scoreboardTitle}>Scoreboard</Text>
        {scores.map((score, index) => (
          <View key={score.player.id} style={styles.scoreRow}>
            <View style={styles.scoreRank}>
              <Text style={styles.scoreRankText}>{index + 1}</Text>
            </View>
            <Text style={styles.scorePlayerName}>{score.player.name}</Text>
            <View style={styles.scorePoints}>
              <Ionicons name="star" size={16} color={colors.secondary} />
              <Text style={styles.scorePointsText}>{score.points}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.summaryButtons}>
        <TouchableOpacity onPress={handlePlayAgain} style={styles.playAgainButton}>
          <Ionicons name="refresh" size={24} color="#FFFFFF" />
          <Text style={styles.playAgainButtonText}>Play Again</Text>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={handleChangeSettings} style={styles.changeSettingsButton}>
          <Ionicons name="settings-outline" size={20} color={colors.text} />
          <Text style={styles.changeSettingsButtonText}>Change Settings</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.text,
  },
  placeholder: {
    width: 32,
  },

  // Setup View
  setupContainer: {
    flex: 1,
  },
  setupContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: GAME_COLOR_LIGHT,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  setupTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  setupSubtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  howToPlay: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  howToPlayText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  playerInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    color: colors.text,
  },
  removeButton: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
  addPlayerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  addPlayerText: {
    fontSize: fontSize.md,
    color: colors.primary,
    fontWeight: "500",
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.xs,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderRadius: borderRadius.sm,
  },
  segmentButtonActive: {
    backgroundColor: GAME_COLOR,
  },
  segmentText: {
    fontSize: fontSize.md,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: "#FFFFFF",
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    alignSelf: "flex-start",
  },
  stepperButton: {
    padding: spacing.sm,
  },
  stepperValue: {
    fontSize: fontSize.xl,
    fontWeight: "600",
    color: colors.text,
    minWidth: 48,
    textAlign: "center",
  },
  categoryPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  categoryPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
  },
  categoryPillActive: {
    backgroundColor: GAME_COLOR,
  },
  categoryPillText: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  categoryPillTextActive: {
    color: "#FFFFFF",
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: GAME_COLOR,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    marginTop: spacing.lg,
  },
  startButtonText: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  // Centered View (Pass, Reveal, Act, Result)
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },

  // Pass View
  passContainer: {
    alignItems: "center",
    width: "100%",
  },
  roundIndicator: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  passIcon: {
    marginBottom: spacing.md,
  },
  passLabel: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  passPlayerName: {
    fontSize: 36,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  passInstruction: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.xl,
  },
  readyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: GAME_COLOR,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: borderRadius.full,
  },
  readyButtonText: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  // Reveal View
  revealContainer: {
    alignItems: "center",
    width: "100%",
  },
  revealWord: {
    fontSize: 48,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  revealWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  revealWarningText: {
    fontSize: fontSize.xl,
    fontWeight: "600",
    color: colors.error,
  },
  revealCountdown: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },

  // Act View
  actContainer: {
    alignItems: "center",
    width: "100%",
  },
  actTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: GAME_COLOR,
    marginBottom: spacing.xl,
  },
  timerCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  timerText: {
    fontSize: 64,
    fontWeight: "700",
  },
  actButtons: {
    flexDirection: "row",
    gap: spacing.md,
  },
  actButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
  },
  actButtonText: {
    fontSize: fontSize.md,
    fontWeight: "500",
    color: colors.text,
  },
  endEarlyButton: {
    backgroundColor: GAME_COLOR,
  },
  endEarlyText: {
    color: "#FFFFFF",
  },

  // Result View
  resultContainer: {
    alignItems: "center",
    width: "100%",
  },
  resultLabel: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  resultWord: {
    fontSize: 40,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  resultPlayerLabel: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    marginBottom: spacing.xl,
  },
  resultButtons: {
    flexDirection: "row",
    gap: spacing.md,
    width: "100%",
  },
  resultButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  guessedButton: {
    backgroundColor: colors.success,
  },
  skippedButton: {
    backgroundColor: colors.textMuted,
  },
  resultButtonText: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  // Summary View
  summaryContainer: {
    flex: 1,
  },
  summaryContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  winnerSection: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  winnerLabel: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  winnerName: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.text,
  },
  winnerPoints: {
    fontSize: fontSize.lg,
    color: colors.secondary,
    fontWeight: "600",
  },
  scoreboardSection: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  scoreboardTitle: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.md,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  scoreRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.sm,
  },
  scoreRankText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  scorePlayerName: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
  },
  scorePoints: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  scorePointsText: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
  },
  summaryButtons: {
    gap: spacing.md,
  },
  playAgainButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: GAME_COLOR,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
  },
  playAgainButtonText: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  changeSettingsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
  },
  changeSettingsButtonText: {
    fontSize: fontSize.md,
    fontWeight: "500",
    color: colors.text,
  },
});
