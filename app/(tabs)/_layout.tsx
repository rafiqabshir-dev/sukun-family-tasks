import { useState } from "react";
import { View, TouchableOpacity, Modal, Text, StyleSheet, ScrollView } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, fontSize } from "@/lib/theme";

type IconName = "today" | "today-outline" | "list" | "list-outline" | "sync" | "sync-outline" | "trophy" | "trophy-outline" | "gift" | "gift-outline" | "menu" | "menu-outline";

export default function TabLayout() {
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);

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
          headerRight: () => (
            <TouchableOpacity 
              style={{ marginRight: spacing.md }}
              onPress={() => setShowMenu(true)}
              data-testid="button-more-menu"
            >
              <Ionicons name="menu" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          ),
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            paddingBottom: 8,
            paddingTop: 8,
            height: 64,
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
            title: "Today",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "today" : "today-outline"}
                size={24}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="leaderboard"
          options={{
            title: "Leaderboard",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "trophy" : "trophy-outline"}
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
            tabBarItemStyle: { display: "none" },
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
            title: "Spin",
            tabBarItemStyle: { display: "none" },
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "sync" : "sync-outline"}
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
            tabBarItemStyle: { display: "none" },
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "settings" : "settings-outline"}
                size={24}
                color={color}
              />
            ),
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
                  <Text style={styles.menuItemText}>{item.title}</Text>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
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
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: "500",
  },
});
