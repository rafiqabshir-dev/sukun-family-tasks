import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useState, useEffect, useMemo } from "react";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path, Circle, Rect, Ellipse } from "react-native-svg";
import { colors, spacing, borderRadius, fontSize } from "@/lib/theme";
import { router } from "expo-router";
import { WeatherData, getWeather, canPlayOutside } from "@/lib/weatherService";
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

interface OutfitConfig {
  hatColor: string;
  hasHat: boolean;
  hasScarf: boolean;
  scarfColor: string;
  shirtColor: string;
  shirtType: "tshirt" | "longsleeve" | "jacket" | "heavyjacket";
  pantsColor: string;
  pantsType: "shorts" | "pants" | "snowpants";
  shoesColor: string;
  shoesType: "sandals" | "sneakers" | "boots" | "snowboots";
  hasGloves: boolean;
  glovesColor: string;
  hasUmbrella: boolean;
  hasSunglasses: boolean;
  description: string;
}

function getOutfitForWeather(weather: WeatherData): OutfitConfig {
  const temp = weather.feelsLike;
  const isRaining = weather.isRaining || weather.precipitationProbability >= 50;
  const isSnowing = weather.isSnowing;
  const isSunny = weather.conditionCode <= 2 && weather.uvIndex >= 6;
  
  if (temp <= 20) {
    return {
      hasHat: true, hatColor: "#8B4513",
      hasScarf: true, scarfColor: "#DC143C",
      shirtColor: "#4A6572", shirtType: "heavyjacket",
      pantsColor: "#2C3E50", pantsType: "snowpants",
      shoesColor: "#5D4037", shoesType: "snowboots",
      hasGloves: true, glovesColor: "#8B4513",
      hasUmbrella: false, hasSunglasses: false,
      description: "Bundle up! Very cold outside"
    };
  } else if (temp <= 32) {
    return {
      hasHat: true, hatColor: "#6B4226",
      hasScarf: true, scarfColor: "#C0392B",
      shirtColor: "#34495E", shirtType: "heavyjacket",
      pantsColor: "#2C3E50", pantsType: "pants",
      shoesColor: "#5D4037", shoesType: "boots",
      hasGloves: true, glovesColor: "#8B4513",
      hasUmbrella: isRaining, hasSunglasses: false,
      description: "Winter gear needed"
    };
  } else if (temp <= 45) {
    return {
      hasHat: true, hatColor: "#795548",
      hasScarf: false, scarfColor: "",
      shirtColor: "#5C6BC0", shirtType: "jacket",
      pantsColor: "#455A64", pantsType: "pants",
      shoesColor: "#6D4C41", shoesType: isRaining || isSnowing ? "boots" : "sneakers",
      hasGloves: true, glovesColor: "#795548",
      hasUmbrella: isRaining, hasSunglasses: false,
      description: "Warm layers recommended"
    };
  } else if (temp <= 55) {
    return {
      hasHat: false, hatColor: "",
      hasScarf: false, scarfColor: "",
      shirtColor: "#7E57C2", shirtType: "jacket",
      pantsColor: "#546E7A", pantsType: "pants",
      shoesColor: "#5D4037", shoesType: isRaining ? "boots" : "sneakers",
      hasGloves: false, glovesColor: "",
      hasUmbrella: isRaining, hasSunglasses: false,
      description: "Light jacket weather"
    };
  } else if (temp <= 65) {
    return {
      hasHat: false, hatColor: "",
      hasScarf: false, scarfColor: "",
      shirtColor: "#42A5F5", shirtType: "longsleeve",
      pantsColor: "#5D6D7E", pantsType: "pants",
      shoesColor: "#6D4C41", shoesType: isRaining ? "boots" : "sneakers",
      hasGloves: false, glovesColor: "",
      hasUmbrella: isRaining, hasSunglasses: isSunny,
      description: "Comfortable long sleeves"
    };
  } else if (temp <= 75) {
    return {
      hasHat: isSunny, hatColor: "#FDD835",
      hasScarf: false, scarfColor: "",
      shirtColor: "#66BB6A", shirtType: "tshirt",
      pantsColor: "#78909C", pantsType: "pants",
      shoesColor: "#8D6E63", shoesType: isRaining ? "boots" : "sneakers",
      hasGloves: false, glovesColor: "",
      hasUmbrella: isRaining, hasSunglasses: isSunny,
      description: "T-shirt and pants"
    };
  } else if (temp <= 85) {
    return {
      hasHat: isSunny, hatColor: "#FFEB3B",
      hasScarf: false, scarfColor: "",
      shirtColor: "#4DB6AC", shirtType: "tshirt",
      pantsColor: "#90A4AE", pantsType: "shorts",
      shoesColor: "#A1887F", shoesType: isRaining ? "sneakers" : "sandals",
      hasGloves: false, glovesColor: "",
      hasUmbrella: isRaining, hasSunglasses: isSunny,
      description: "Light and breezy"
    };
  } else {
    return {
      hasHat: true, hatColor: "#FFF59D",
      hasScarf: false, scarfColor: "",
      shirtColor: "#4DD0E1", shirtType: "tshirt",
      pantsColor: "#B0BEC5", pantsType: "shorts",
      shoesColor: "#BCAAA4", shoesType: "sandals",
      hasGloves: false, glovesColor: "",
      hasUmbrella: isRaining, hasSunglasses: true,
      description: "Stay cool! Hot day"
    };
  }
}

function DressedFigure({ outfit }: { outfit: OutfitConfig }) {
  const skinColor = "#FFDAB9";
  
  return (
    <Svg width={100} height={140} viewBox="0 0 100 140">
      {outfit.hasHat && (
        <>
          <Ellipse cx="50" cy="18" rx="22" ry="8" fill={outfit.hatColor} />
          <Rect x="35" y="10" width="30" height="12" fill={outfit.hatColor} rx="3" />
        </>
      )}
      
      <Circle cx="50" cy="28" r="14" fill={skinColor} />
      
      {outfit.hasSunglasses && (
        <>
          <Rect x="38" y="24" width="10" height="6" fill="#333" rx="2" />
          <Rect x="52" y="24" width="10" height="6" fill="#333" rx="2" />
          <Path d="M48 27 L52 27" stroke="#333" strokeWidth="2" />
        </>
      )}
      
      {outfit.hasScarf && (
        <Path 
          d={`M36 40 Q50 48 64 40 L62 52 Q50 46 38 52 Z`} 
          fill={outfit.scarfColor} 
        />
      )}
      
      {outfit.shirtType === "tshirt" && (
        <>
          <Path d="M35 42 L25 50 L28 58 L38 52 L38 85 L62 85 L62 52 L72 58 L75 50 L65 42 Q55 38 50 42 Q45 38 35 42" fill={outfit.shirtColor} />
        </>
      )}
      {outfit.shirtType === "longsleeve" && (
        <>
          <Path d="M35 42 L20 55 L23 62 L35 52 L35 85 L65 85 L65 52 L77 62 L80 55 L65 42 Q55 38 50 42 Q45 38 35 42" fill={outfit.shirtColor} />
          <Rect x="18" y="55" width="8" height="20" fill={outfit.shirtColor} rx="3" />
          <Rect x="74" y="55" width="8" height="20" fill={outfit.shirtColor} rx="3" />
        </>
      )}
      {(outfit.shirtType === "jacket" || outfit.shirtType === "heavyjacket") && (
        <>
          <Path d="M32 42 L18 55 L21 65 L32 55 L32 88 L68 88 L68 55 L79 65 L82 55 L68 42 Q55 36 50 42 Q45 36 32 42" fill={outfit.shirtColor} />
          <Rect x="16" y="55" width="10" height="25" fill={outfit.shirtColor} rx="4" />
          <Rect x="74" y="55" width="10" height="25" fill={outfit.shirtColor} rx="4" />
          <Path d="M48 42 L48 88" stroke={outfit.shirtType === "heavyjacket" ? "#FFF" : outfit.shirtColor} strokeWidth="2" opacity="0.3" />
        </>
      )}
      
      {!outfit.hasGloves && (
        <>
          <Circle cx="22" cy="78" r="5" fill={skinColor} />
          <Circle cx="78" cy="78" r="5" fill={skinColor} />
        </>
      )}
      {outfit.hasGloves && (
        <>
          <Ellipse cx="22" cy="78" rx="6" ry="7" fill={outfit.glovesColor} />
          <Ellipse cx="78" cy="78" rx="6" ry="7" fill={outfit.glovesColor} />
        </>
      )}
      
      {outfit.pantsType === "shorts" && (
        <>
          <Rect x="38" y="85" width="24" height="18" fill={outfit.pantsColor} />
          <Rect x="38" y="85" width="11" height="18" fill={outfit.pantsColor} />
          <Rect x="51" y="85" width="11" height="18" fill={outfit.pantsColor} />
        </>
      )}
      {(outfit.pantsType === "pants" || outfit.pantsType === "snowpants") && (
        <>
          <Path d="M36 85 L36 118 L48 118 L48 85 L52 85 L52 118 L64 118 L64 85 Z" fill={outfit.pantsColor} />
        </>
      )}
      
      {outfit.shoesType === "sandals" && (
        <>
          <Ellipse cx="42" cy="122" rx="8" ry="4" fill={outfit.shoesColor} />
          <Ellipse cx="58" cy="122" rx="8" ry="4" fill={outfit.shoesColor} />
        </>
      )}
      {outfit.shoesType === "sneakers" && (
        <>
          <Ellipse cx="42" cy="122" rx="9" ry="5" fill={outfit.shoesColor} />
          <Ellipse cx="58" cy="122" rx="9" ry="5" fill={outfit.shoesColor} />
          <Path d="M36 120 L48 120" stroke="#FFF" strokeWidth="1" />
          <Path d="M52 120 L64 120" stroke="#FFF" strokeWidth="1" />
        </>
      )}
      {(outfit.shoesType === "boots" || outfit.shoesType === "snowboots") && (
        <>
          <Rect x="34" y="115" width="14" height="12" fill={outfit.shoesColor} rx="3" />
          <Rect x="52" y="115" width="14" height="12" fill={outfit.shoesColor} rx="3" />
          {outfit.shoesType === "snowboots" && (
            <>
              <Rect x="34" y="108" width="14" height="10" fill={outfit.shoesColor} rx="2" />
              <Rect x="52" y="108" width="14" height="10" fill={outfit.shoesColor} rx="2" />
            </>
          )}
        </>
      )}
      
      {outfit.hasUmbrella && (
        <>
          <Path d="M85 20 Q95 25 85 35 Q75 25 85 20" fill="#4169E1" />
          <Rect x="84" y="25" width="2" height="35" fill="#666" />
        </>
      )}
    </Svg>
  );
}

export function WhatToWearCard({ weather }: { weather: WeatherData | null }) {
  const outfit = useMemo(() => {
    if (!weather) return null;
    return getOutfitForWeather(weather);
  }, [weather]);

  if (!weather || !outfit) return null;

  const accessories: string[] = [];
  if (outfit.hasHat) accessories.push("Hat");
  if (outfit.hasScarf) accessories.push("Scarf");
  if (outfit.hasGloves) accessories.push("Gloves");
  if (outfit.hasUmbrella) accessories.push("Umbrella");
  if (outfit.hasSunglasses) accessories.push("Sunglasses");

  return (
    <View style={styles.card} data-testid="what-to-wear-card">
      <View style={styles.cardHeader}>
        <View style={styles.cardIconContainer}>
          <Ionicons name="shirt" size={24} color={colors.primary} />
        </View>
        <Text style={styles.cardTitle}>What to Wear</Text>
        <View style={[styles.togglePill, styles.togglePillActive]}>
          <Ionicons name="person" size={14} color="#FFFFFF" />
          <Text style={[styles.togglePillText, styles.togglePillTextActive]}>Kids</Text>
        </View>
      </View>
      <View style={styles.outfitContainer}>
        <View style={styles.figureContainer}>
          <DressedFigure outfit={outfit} />
        </View>
        <View style={styles.outfitDetails}>
          <Text style={styles.outfitDescription}>{outfit.description}</Text>
          <Text style={styles.feelsLikeText}>Feels like {weather.feelsLike}°F</Text>
          {accessories.length > 0 && (
            <View style={styles.accessoriesList}>
              {accessories.map((acc, i) => (
                <View key={i} style={styles.accessoryTag}>
                  <Text style={styles.accessoryText}>{acc}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
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
  outfitContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  figureContainer: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
  },
  outfitDetails: {
    flex: 1,
    gap: spacing.xs,
  },
  outfitDescription: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
  },
  feelsLikeText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  accessoriesList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  accessoryTag: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  accessoryText: {
    fontSize: fontSize.xs,
    color: colors.primary,
    fontWeight: "500",
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
