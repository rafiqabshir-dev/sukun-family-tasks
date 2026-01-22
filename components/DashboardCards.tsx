import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useState, useEffect, useMemo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, fontSize } from "@/lib/theme";
import { router } from "expo-router";
import { WeatherData, getWeather, canPlayOutside, getClothingSuggestions, ClothingItem } from "@/lib/weatherService";
import { PrayerTimes, CurrentPrayer, getPrayerTimes, getCurrentPrayer, formatMinutesRemaining } from "@/lib/prayerService";
import { getCurrentLocation, UserLocation } from "@/lib/locationService";
import { TaskInstance, TaskTemplate, Member } from "@/lib/types";
import { isToday, isBefore, startOfDay } from "date-fns";

interface DashboardCardsProps {
  taskInstances: TaskInstance[];
  taskTemplates: TaskTemplate[];
  members: Member[];
  currentTime: Date;
}

export function SevereWeatherBanner({ weather }: { weather: WeatherData | null }) {
  if (!weather) return null;
  
  const hasAlerts = weather.alerts && weather.alerts.length > 0;
  const showBanner = hasAlerts || weather.isSevere || weather.severeType;
  if (!showBanner) return null;
  
  const topAlert = hasAlerts ? weather.alerts[0] : null;
  const severity = topAlert?.severity || (weather.isSevere ? "severe" : "moderate");
  const isSevereOrExtreme = severity === "severe" || severity === "extreme";
  
  const bannerStyle = isSevereOrExtreme ? styles.severeBanner : styles.advisoryBanner;
  const iconName = isSevereOrExtreme ? "warning" : "information-circle";
  
  const title = topAlert?.event || weather.severeType || "Weather Advisory";
  const message = topAlert?.headline || weather.severeMessage || "Check conditions before outdoor activities";
  const description = topAlert?.description;

  return (
    <View style={bannerStyle} data-testid="severe-weather-banner">
      <View style={styles.severeHeader}>
        <Ionicons name={iconName} size={22} color="#FFFFFF" />
        <Text style={styles.severeTitle}>{title}</Text>
      </View>
      <Text style={styles.severeMessage}>{message}</Text>
      {description && (
        <Text style={styles.severeDescription}>{description}</Text>
      )}
    </View>
  );
}

export function PrayerCountdownCard({ currentTime, location }: { currentTime: Date; location: UserLocation | null }) {
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
  const [currentPrayer, setCurrentPrayer] = useState<CurrentPrayer | null>(null);

  useEffect(() => {
    if (!location) return;
    const loadPrayerTimes = async () => {
      const times = await getPrayerTimes(location.latitude, location.longitude);
      if (times) {
        setPrayerTimes(times);
      }
    };
    loadPrayerTimes();
  }, [location]);

  useEffect(() => {
    if (prayerTimes) {
      const prayer = getCurrentPrayer(prayerTimes);
      setCurrentPrayer(prayer);
    }
  }, [prayerTimes, currentTime]);

  if (!currentPrayer) return null;

  return (
    <View style={[styles.card, currentPrayer.isUrgent && styles.cardUrgent]} data-testid="prayer-countdown-card">
      <View style={styles.cardHeader}>
        <View style={styles.cardIconContainer}>
          <Ionicons name={currentPrayer.icon as any} size={24} color={currentPrayer.isUrgent ? colors.error : colors.primary} />
        </View>
        <Text style={styles.cardTitle}>{currentPrayer.displayName}</Text>
      </View>
      <View style={styles.prayerContent}>
        <View style={[styles.prayerBadge, currentPrayer.isUrgent && styles.prayerBadgeUrgent]}>
          <Ionicons 
            name="time-outline" 
            size={18} 
            color="#FFFFFF"
          />
          <Text style={[styles.prayerTimeText, currentPrayer.isUrgent && styles.prayerTimeTextUrgent]}>
            {formatMinutesRemaining(currentPrayer.minutesRemaining)}
          </Text>
        </View>
        {currentPrayer.isUrgent && (
          <View style={styles.stayInsideBadge}>
            <Ionicons name="home" size={14} color={colors.error} />
            <Text style={styles.stayInsideText}>Stay inside</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export function WeatherCard({ weather }: { weather: WeatherData | null }) {
  const outdoorStatus = useMemo(() => {
    if (!weather) return null;
    return canPlayOutside(weather);
  }, [weather]);

  if (!weather) return null;

  return (
    <View style={styles.card} data-testid="weather-card">
      <View style={styles.cardHeader}>
        <View style={styles.cardIconContainer}>
          <Ionicons name={weather.conditionIcon as any} size={24} color={colors.primary} />
        </View>
        <Text style={styles.cardTitle}>Today's Weather</Text>
      </View>
      <View style={styles.weatherContent}>
        <Text style={styles.weatherTemp}>{weather.temperature}°{weather.temperatureUnit}</Text>
        <Text style={styles.weatherCondition}>{weather.condition}</Text>
        {weather.windSpeed > 10 && (
          <Text style={styles.weatherWind}>Wind: {weather.windSpeed} mph</Text>
        )}
      </View>
      {outdoorStatus && (
        <View style={[styles.outdoorBadge, !outdoorStatus.canPlay && styles.outdoorBadgeNo]}>
          <Ionicons 
            name={outdoorStatus.canPlay ? "checkmark-circle" : "close-circle"} 
            size={16} 
            color={outdoorStatus.canPlay ? colors.success : colors.error} 
          />
          <Text style={[styles.outdoorText, !outdoorStatus.canPlay && styles.outdoorTextNo]}>
            {outdoorStatus.canPlay ? "Safe for outdoor play" : outdoorStatus.reason}
          </Text>
        </View>
      )}
    </View>
  );
}

const CLOTHING_ICONS: Record<string, { icon: string; color: string }> = {
  "body": { icon: "body", color: "#5C9EAD" },
  "footsteps": { icon: "footsteps", color: "#8B4513" },
  "umbrella": { icon: "umbrella", color: "#4169E1" },
  "water": { icon: "water", color: "#4169E1" },
  "snow": { icon: "snow", color: "#87CEEB" },
  "hand-left": { icon: "hand-left", color: "#D2691E" },
  "help-circle": { icon: "radio-button-on", color: "#9370DB" },
  "ribbon": { icon: "ribbon", color: "#DC143C" },
  "sunny": { icon: "sunny", color: "#FFD700" },
  "glasses": { icon: "glasses", color: "#2F4F4F" },
  "navigate": { icon: "navigate", color: "#708090" },
  "game-controller": { icon: "game-controller", color: "#FF69B4" },
};

export function WhatToWearCard({ weather }: { weather: WeatherData | null }) {
  const suggestions = useMemo(() => {
    if (!weather) return [];
    return getClothingSuggestions(weather);
  }, [weather]);

  if (!weather || suggestions.length === 0) return null;

  const getIconInfo = (iconKey: string) => {
    return CLOTHING_ICONS[iconKey] || { icon: "checkmark-circle", color: colors.success };
  };

  return (
    <View style={styles.card} data-testid="what-to-wear-card">
      <View style={styles.cardHeader}>
        <View style={styles.cardIconContainer}>
          <Ionicons name="shirt" size={24} color={colors.primary} />
        </View>
        <Text style={styles.cardTitle}>What to Wear Today</Text>
        <View style={[styles.togglePill, styles.togglePillActive]}>
          <Ionicons name="person" size={14} color="#FFFFFF" />
          <Text style={[styles.togglePillText, styles.togglePillTextActive]}>Kids</Text>
        </View>
      </View>
      <Text style={styles.wearSubtitle}>
        Based on {weather.feelsLike}°F feels-like temperature
      </Text>
      <View style={styles.clothingGrid}>
        {suggestions.map((item, index) => {
          const iconInfo = getIconInfo(item.icon);
          return (
            <View key={index} style={styles.clothingItem}>
              <View style={[styles.clothingIconCircle, { backgroundColor: iconInfo.color + "20" }]}>
                <Ionicons name={iconInfo.icon as any} size={22} color={iconInfo.color} />
              </View>
              <Text style={styles.clothingItemText} numberOfLines={2}>{item.name}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

type NextUpTask = { title: string; memberName: string } | null;

export function TodayTasksSummary({ taskInstances, taskTemplates, members }: Omit<DashboardCardsProps, 'currentTime'>) {
  const taskStats = useMemo(() => {
    const today = startOfDay(new Date());
    let dueToday = 0;
    let overdue = 0;
    let nextUp: NextUpTask = null;

    for (const instance of taskInstances) {
      if (instance.status === "done" || instance.status === "expired") continue;
      
      const dueDate = new Date(instance.dueAt);
      const isOverdueTask = isBefore(dueDate, today);
      const isDueTodayTask = isToday(dueDate);

      if (isOverdueTask) {
        overdue++;
        if (nextUp === null) {
          const template = taskTemplates.find(t => t.id === instance.templateId);
          const member = members.find(m => m.id === instance.assignedToMemberId);
          if (template && member) {
            nextUp = { title: template.title, memberName: member.name };
          }
        }
      } else if (isDueTodayTask) {
        dueToday++;
        if (nextUp === null && overdue === 0) {
          const template = taskTemplates.find(t => t.id === instance.templateId);
          const member = members.find(m => m.id === instance.assignedToMemberId);
          if (template && member) {
            nextUp = { title: template.title, memberName: member.name };
          }
        }
      }
    }

    return { dueToday, overdue, nextUp };
  }, [taskInstances, taskTemplates, members]);

  const handleViewTasks = () => {
    router.push({ pathname: "/(tabs)/tasks", params: { view: "assigned", filter: "today" } });
  };

  const isEmpty = taskStats.dueToday === 0 && taskStats.overdue === 0;

  // Generate smart, context-aware tip based on time and task status
  const getSmartTip = (): string | null => {
    const hour = new Date().getHours();
    const hasOverdue = taskStats.overdue > 0;
    const hasDueTasks = taskStats.dueToday > 0;
    
    // Priority: Address overdue tasks first
    if (hasOverdue) {
      if (hour < 12) {
        return "Start the day by tackling overdue tasks first";
      } else if (hour < 17) {
        return "Clear overdue tasks before the day winds down";
      } else {
        return "Try to complete overdue tasks before bedtime";
      }
    }
    
    // Time-based tips when tasks are due
    if (hasDueTasks) {
      if (hour >= 5 && hour < 9) {
        // Early morning
        return "Great time for morning chores before school";
      } else if (hour >= 9 && hour < 12) {
        // Morning
        return "Complete tasks before lunch for a productive day";
      } else if (hour >= 12 && hour < 14) {
        // Midday
        return "Finish up any tasks before afternoon activities";
      } else if (hour >= 14 && hour < 17) {
        // Afternoon
        return "Wrap up tasks before dinner time";
      } else if (hour >= 17 && hour < 20) {
        // Evening
        return "Evening is a good time for quick household tasks";
      } else {
        // Night
        return "Remember to check off completed tasks";
      }
    }
    
    return null;
  };

  const smartTip = getSmartTip();

  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={handleViewTasks}
      activeOpacity={0.7}
      data-testid="today-tasks-summary"
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardIconContainer}>
          <Ionicons name="list" size={24} color={colors.primary} />
        </View>
        <Text style={styles.cardTitle}>Today's Tasks</Text>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </View>

      {isEmpty ? (
        <View style={styles.emptyTasksContent}>
          <Ionicons name="checkmark-done-circle" size={32} color={colors.success} />
          <Text style={styles.emptyTasksText}>All clear today</Text>
          <Text style={styles.browseTasksLink}>Browse tasks</Text>
        </View>
      ) : (
        <View style={styles.tasksSummaryContent}>
          <View style={styles.taskStatRow}>
            <Ionicons name="checkbox-outline" size={16} color={colors.primary} />
            <Text style={styles.taskStatText}>{taskStats.dueToday} tasks due today</Text>
          </View>
          
          {taskStats.nextUp && (
            <View style={styles.taskStatRow}>
              <Ionicons name="arrow-forward" size={16} color={colors.textSecondary} />
              <Text style={styles.taskStatText}>
                Next up: <Text style={styles.taskStatHighlight}>{taskStats.nextUp.memberName}</Text> - {taskStats.nextUp.title}
              </Text>
            </View>
          )}
          
          {taskStats.overdue > 0 && (
            <View style={styles.taskStatRow}>
              <Ionicons name="alert-circle" size={16} color={colors.error} />
              <Text style={[styles.taskStatText, styles.taskStatOverdue]}>
                Overdue: {taskStats.overdue} task{taskStats.overdue > 1 ? 's' : ''}
              </Text>
            </View>
          )}

          {smartTip && (
            <Text style={styles.taskTip}>
              Tip: {smartTip}
            </Text>
          )}
        </View>
      )}

      <TouchableOpacity style={styles.viewTasksButton} onPress={handleViewTasks}>
        <Text style={styles.viewTasksButtonText}>View Tasks</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// Hook to get location - can be used by parent components
export function useLocation() {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);

  useEffect(() => {
    const loadLocation = async () => {
      try {
        const userLocation = await getCurrentLocation();
        setLocation(userLocation);
      } catch (error) {
        console.log('[Dashboard] Failed to get location:', error);
      } finally {
        setLocationLoading(false);
      }
    };
    loadLocation();
  }, []);

  return { location, locationLoading };
}

// Standalone location badge component for use in headers
export function LocationBadge({ location }: { location: UserLocation | null }) {
  if (!location?.city) return null;
  
  return (
    <View style={styles.locationBadge}>
      <Ionicons name="location" size={14} color="#FFFFFF" />
      <Text style={styles.locationText}>{location.city}</Text>
    </View>
  );
}

export function DashboardCards({ taskInstances, taskTemplates, members, currentTime }: DashboardCardsProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const { location } = useLocation();

  useEffect(() => {
    if (!location) return;
    const loadWeather = async () => {
      const data = await getWeather(location.latitude, location.longitude);
      setWeather(data);
    };
    loadWeather();
  }, [location]);

  return (
    <View style={styles.dashboardContainer}>
      <SevereWeatherBanner weather={weather} />
      <PrayerCountdownCard currentTime={currentTime} location={location} />
      <WeatherCard weather={weather} />
      <WhatToWearCard weather={weather} />
      <TodayTasksSummary 
        taskInstances={taskInstances}
        taskTemplates={taskTemplates}
        members={members}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  dashboardContainer: {
    gap: spacing.md,
  },
  locationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
  },
  locationText: {
    fontSize: fontSize.md,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  severeBanner: {
    backgroundColor: colors.error,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  advisoryBanner: {
    backgroundColor: colors.warning,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  severeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  severeTitle: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  severeMessage: {
    fontSize: fontSize.sm,
    color: "#FFFFFF",
    fontWeight: "500",
    opacity: 0.95,
  },
  severeDescription: {
    fontSize: fontSize.xs,
    color: "#FFFFFF",
    opacity: 0.85,
    marginTop: spacing.xs,
    lineHeight: 18,
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
  cardUrgent: {
    borderWidth: 2,
    borderColor: colors.error,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  cardIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
  },
  prayerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  prayerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  prayerBadgeUrgent: {
    backgroundColor: colors.error,
  },
  prayerTimeText: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  prayerTimeTextUrgent: {
    color: "#FFFFFF",
  },
  stayInsideBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: "#FFE5E5",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  stayInsideText: {
    fontSize: fontSize.sm,
    color: colors.error,
    fontWeight: "500",
  },
  weatherContent: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  weatherTemp: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
  },
  weatherCondition: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  weatherWind: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  outdoorBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: "#E8F5E9",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    alignSelf: "flex-start",
  },
  outdoorBadgeNo: {
    backgroundColor: "#FFE5E5",
  },
  outdoorText: {
    fontSize: fontSize.sm,
    color: colors.success,
    fontWeight: "500",
  },
  outdoorTextNo: {
    color: colors.error,
  },
  togglePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.lg,
  },
  togglePillActive: {
    backgroundColor: colors.primary,
  },
  togglePillText: {
    fontSize: fontSize.xs,
    fontWeight: "500",
    color: colors.text,
  },
  togglePillTextActive: {
    color: "#FFFFFF",
  },
  wearSubtitle: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  clothingGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  clothingItem: {
    alignItems: "center",
    width: 80,
    paddingVertical: spacing.xs,
  },
  clothingIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  clothingItemText: {
    fontSize: fontSize.xs,
    color: colors.text,
    textAlign: "center",
  },
  wearList: {
    gap: spacing.xs,
  },
  wearItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  wearItemText: {
    fontSize: fontSize.sm,
    color: colors.text,
  },
  emptyTasksContent: {
    alignItems: "center",
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  emptyTasksText: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.success,
  },
  browseTasksLink: {
    fontSize: fontSize.sm,
    color: colors.primary,
  },
  tasksSummaryContent: {
    gap: spacing.sm,
  },
  taskStatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  taskStatText: {
    fontSize: fontSize.sm,
    color: colors.text,
    flex: 1,
  },
  taskStatHighlight: {
    fontWeight: "600",
    color: colors.primary,
  },
  taskStatOverdue: {
    color: colors.error,
  },
  taskTip: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontStyle: "italic",
    marginTop: spacing.xs,
  },
  viewTasksButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: "center",
    marginTop: spacing.md,
  },
  viewTasksButtonText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
