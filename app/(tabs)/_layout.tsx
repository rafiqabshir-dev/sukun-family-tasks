import { useState, useCallback, useEffect } from "react";
import { View, TouchableOpacity, Modal, Text, StyleSheet, ScrollView, Pressable, Platform, Alert, Linking } from "react-native";
import { Tabs, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, fontSize } from "@/lib/theme";
import { useAuth } from "@/lib/authContext";
import { getCurrentLocation, requestLocationPermission, UserLocation } from "@/lib/locationService";
import { useStore } from "@/lib/store";

type IconName = "today" | "today-outline" | "list" | "list-outline" | "sync" | "sync-outline" | "trophy" | "trophy-outline" | "gift" | "gift-outline" | "menu" | "menu-outline";

// Location component for header LEFT side - always shows actionable state
function HeaderLocationLeft() {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLocation = useCallback(async () => {
    setIsLoading(true);
    try {
      const loc = await getCurrentLocation();
      setLocation(loc);
    } catch (error) {
      console.log('[Header] Location fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  const handleLocationPress = async () => {
    if (location?.permissionDenied) {
      if (Platform.OS === 'web') {
        alert('Please enable location access in your browser settings to get accurate weather and prayer times.');
      } else {
        Alert.alert(
          'Location Access',
          'Enable location access to get accurate weather and prayer times for your area.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Open Settings', 
              onPress: () => Linking.openSettings() 
            },
            {
              text: 'Try Again',
              onPress: async () => {
                const granted = await requestLocationPermission();
                if (granted) {
                  fetchLocation();
                }
              }
            }
          ]
        );
      }
    }
  };

  // Always show something - never return null
  if (isLoading) {
    return (
      <View style={styles.headerLocationLeft}>
        <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.7)" />
        <Text style={[styles.headerLocationText, { opacity: 0.7 }]}>Loading...</Text>
      </View>
    );
  }

  // Permission denied - show actionable state
  if (location?.permissionDenied) {
    return (
      <TouchableOpacity style={[styles.headerLocationLeft, styles.headerLocationWarning]} onPress={handleLocationPress}>
        <Ionicons name="location-outline" size={14} color="#FCD34D" />
        <Text style={[styles.headerLocationText, { color: '#FCD34D' }]}>Enable Location</Text>
      </TouchableOpacity>
    );
  }

  // Show city name (actual or default fallback)
  const cityName = location?.cityName || location?.city || 'Unknown';
  
  return (
    <TouchableOpacity style={styles.headerLocationLeft} onPress={handleLocationPress}>
      <Ionicons name="location" size={14} color="#FFFFFF" />
      <Text style={styles.headerLocationText}>{cityName}</Text>
    </TouchableOpacity>
  );
}

// Avatar dropdown component for header RIGHT side
function HeaderAvatarDropdown() {
  const [showDropdown, setShowDropdown] = useState(false);
  const { profile, signOut } = useAuth();
  const members = useStore((s) => s.members);
  
  // Find current member from store
  const currentMember = members.find((m) => m.id === profile?.id);
  const isGuardian = currentMember?.role === "guardian";
  const isParticipant = currentMember?.role === "kid";
  
  const handleSignOut = () => {
    setShowDropdown(false);
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to sign out?')) {
        signOut();
      }
    } else {
      Alert.alert(
        'Sign Out',
        'Are you sure you want to sign out?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign Out', style: 'destructive', onPress: () => signOut() }
        ]
      );
    }
  };
  
  if (!currentMember) return null;

  return (
    <>
      <TouchableOpacity 
        style={styles.headerAvatar}
        onPress={() => setShowDropdown(true)}
        data-testid="button-avatar-dropdown"
      >
        {currentMember.avatar ? (
          <Text style={styles.headerAvatarEmoji}>{currentMember.avatar}</Text>
        ) : (
          <Text style={styles.headerAvatarInitial}>
            {currentMember.name.charAt(0).toUpperCase()}
          </Text>
        )}
      </TouchableOpacity>

      <Modal
        visible={showDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDropdown(false)}
      >
        <Pressable 
          style={styles.dropdownOverlay}
          onPress={() => setShowDropdown(false)}
        >
          <Pressable style={styles.dropdownCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.dropdownUserInfo}>
              <View style={styles.dropdownAvatarLarge}>
                {currentMember.avatar ? (
                  <Text style={styles.dropdownAvatarEmoji}>{currentMember.avatar}</Text>
                ) : (
                  <Text style={styles.dropdownAvatarInitial}>
                    {currentMember.name.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={styles.dropdownUserDetails}>
                <Text style={styles.dropdownUserName}>{currentMember.name}</Text>
                <Text style={styles.dropdownUserRole}>
                  {isGuardian ? "Guardian" : "Participant"}
                </Text>
              </View>
            </View>
            
            <View style={styles.dropdownStarsRow}>
              <View style={styles.dropdownStarsDisplay}>
                <Ionicons name="star" size={20} color={colors.secondary} />
                <Text style={styles.dropdownStarsCount}>{currentMember.starsTotal}</Text>
                <Text style={styles.dropdownStarsLabel}>stars</Text>
              </View>
            </View>

            {isParticipant && (
              <TouchableOpacity 
                style={styles.dropdownSignOutButton}
                onPress={handleSignOut}
                data-testid="button-participant-sign-out"
              >
                <Ionicons name="log-out-outline" size={20} color={colors.error} />
                <Text style={styles.dropdownSignOutText}>Sign Out</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              style={styles.dropdownCloseButton}
              onPress={() => setShowDropdown(false)}
            >
              <Text style={styles.dropdownCloseText}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// Separate component that re-renders when pendingRequestsCount changes
function HeaderMenuButton({ onPress }: { onPress: () => void }) {
  const { pendingRequestsCount } = useAuth();
  
  return (
    <Pressable 
      style={{ marginRight: spacing.md }}
      onPress={onPress}
      data-testid="button-more-menu"
    >
      <View style={{ position: 'relative', width: 32, height: 32, justifyContent: 'center', alignItems: 'center' }}>
        <Ionicons name="menu" size={24} color="#FFFFFF" />
        {pendingRequestsCount > 0 && (
          <View style={{
            position: 'absolute',
            top: -2,
            right: -4,
            backgroundColor: '#EF4444',
            borderRadius: 9,
            minWidth: 18,
            height: 18,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 4,
          }}>
            <Text style={{
              color: '#FFFFFF',
              fontSize: 11,
              fontWeight: 'bold',
            }}>
              {pendingRequestsCount > 9 ? '9+' : pendingRequestsCount}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function TabLayout() {
  const router = useRouter();
  const { profile, pendingRequestsCount, refreshPendingRequestsCount, signOut } = useAuth();
  const members = useStore((s) => s.members);
  const [showMenu, setShowMenu] = useState(false);

  // Determine if user is a participant (not a guardian)
  const currentMember = members.find((m) => m.id === profile?.id);
  const isParticipant = currentMember?.role === "kid";

  const handleSignOut = () => {
    setShowMenu(false);
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to sign out?')) {
        signOut();
      }
    } else {
      Alert.alert(
        'Sign Out',
        'Are you sure you want to sign out?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign Out', style: 'destructive', onPress: () => signOut() }
        ]
      );
    }
  };

  // Refresh pending requests count when tabs get focus
  useFocusEffect(
    useCallback(() => {
      refreshPendingRequestsCount();
    }, [refreshPendingRequestsCount])
  );

  const menuItems = [
    { title: "Tasks", icon: "list-outline" as const, route: "/(tabs)/tasks" as const },
    { title: "Spin Game", icon: "sync-outline" as const, route: "/(tabs)/spin" as const },
    { title: "Setup", icon: "settings-outline" as const, route: "/(tabs)/setup" as const },
  ];

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: true,
          headerStyle: {
            backgroundColor: colors.primary,
          },
          headerTintColor: "#FFFFFF",
          headerTitleStyle: {
            fontWeight: "600",
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            paddingBottom: 24,
            paddingTop: 8,
            height: 80,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: "500",
          },
        }}
      >
        <Tabs.Screen
          name="today"
          options={{
            title: "Home",
            headerLeft: () => <HeaderLocationLeft />,
            headerRight: () => <HeaderAvatarDropdown />,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "home" : "home-outline"}
                size={24}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="leaderboard"
          options={{
            title: "Stars",
            headerRight: () => <HeaderAvatarDropdown />,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "star" : "star-outline"}
                size={24}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="rewards"
          options={{
            title: "Rewards",
            tabBarItemStyle: { display: "none" },
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "gift" : "gift-outline"}
                size={24}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="tasks"
          options={{
            title: "Tasks",
            headerRight: () => <HeaderAvatarDropdown />,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "list" : "list-outline"}
                size={24}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="spin"
          options={{
            title: "Games",
            tabBarItemStyle: isParticipant ? { display: "none" } : undefined,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "game-controller" : "game-controller-outline"}
                size={24}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="setup"
          options={{
            title: "Setup",
            tabBarItemStyle: isParticipant ? { display: "none" } : undefined,
            tabBarIcon: ({ color, focused }) => (
              <View style={{ position: 'relative' }}>
                <Ionicons
                  name={focused ? "settings" : "settings-outline"}
                  size={24}
                  color={color}
                />
                {pendingRequestsCount > 0 && (
                  <View style={{
                    position: 'absolute',
                    top: -4,
                    right: -8,
                    backgroundColor: '#EF4444',
                    borderRadius: 9,
                    minWidth: 16,
                    height: 16,
                    justifyContent: 'center',
                    alignItems: 'center',
                    paddingHorizontal: 3,
                  }}>
                    <Text style={{
                      color: '#FFFFFF',
                      fontSize: 10,
                      fontWeight: 'bold',
                    }}>
                      {pendingRequestsCount > 9 ? '9+' : pendingRequestsCount}
                    </Text>
                  </View>
                )}
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            tabBarItemStyle: { display: "none" },
          }}
        />
      </Tabs>

      <Modal visible={showMenu} animationType="slide" transparent>
        <View style={styles.menuOverlay}>
          <View style={styles.menuContent}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>More Options</Text>
              <TouchableOpacity onPress={() => setShowMenu(false)}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.menuList}>
              {menuItems.map((item) => (
                <TouchableOpacity
                  key={item.title}
                  style={styles.menuItem}
                  onPress={() => {
                    setShowMenu(false);
                    router.push(item.route);
                  }}
                  data-testid={`button-menu-${item.title.toLowerCase().replace(' ', '-')}`}
                >
                  <Ionicons name={item.icon} size={24} color={colors.primary} />
                  <View style={styles.menuItemTextContainer}>
                    <Text style={styles.menuItemText}>{item.title}</Text>
                    {item.title === "Setup" && pendingRequestsCount > 0 && (
                      <View style={styles.setupBadge}>
                        <Text style={styles.setupBadgeText}>
                          {pendingRequestsCount} pending
                        </Text>
                      </View>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
              
              <View style={styles.menuDivider} />
              
              <TouchableOpacity
                style={styles.signOutItem}
                onPress={handleSignOut}
                data-testid="button-menu-sign-out"
              >
                <Ionicons name="log-out-outline" size={24} color={colors.error} />
                <Text style={styles.signOutText}>Sign Out</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  menuContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingBottom: spacing.xxl,
    maxHeight: "60%",
  },
  menuHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuTitle: {
    fontSize: fontSize.xl,
    fontWeight: "600",
    color: colors.text,
  },
  menuList: {
    padding: spacing.md,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  menuItemText: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: "500",
  },
  menuItemTextContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  menuBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  menuBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  setupBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  setupBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  signOutItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    gap: spacing.md,
  },
  signOutText: {
    fontSize: fontSize.md,
    color: colors.error,
    fontWeight: "500",
  },
  headerLocationLeft: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    marginLeft: spacing.md,
    gap: 4,
  },
  headerLocationText: {
    color: "#FFFFFF",
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
  headerLocationWarning: {
    backgroundColor: "rgba(252, 211, 77, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(252, 211, 77, 0.4)",
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  headerAvatarEmoji: {
    fontSize: 22,
  },
  headerAvatarInitial: {
    color: "#FFFFFF",
    fontSize: fontSize.md,
    fontWeight: "700",
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 100,
    paddingRight: spacing.md,
  },
  dropdownCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    minWidth: 220,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  dropdownUserInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  dropdownAvatarLarge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  dropdownAvatarEmoji: {
    fontSize: 24,
  },
  dropdownAvatarInitial: {
    color: "#FFFFFF",
    fontSize: fontSize.xl,
    fontWeight: "700",
  },
  dropdownUserDetails: {
    flex: 1,
  },
  dropdownUserName: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.text,
  },
  dropdownUserRole: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  dropdownStarsRow: {
    backgroundColor: colors.secondaryLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  dropdownStarsDisplay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  dropdownStarsCount: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: "#92400E",
  },
  dropdownStarsLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  dropdownSignOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  dropdownSignOutText: {
    fontSize: fontSize.md,
    color: colors.error,
    fontWeight: "600",
  },
  dropdownCloseButton: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    alignItems: "center",
  },
  dropdownCloseText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    fontWeight: "500",
  },
});
