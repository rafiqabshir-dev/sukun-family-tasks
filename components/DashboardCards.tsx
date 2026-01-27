import { View, Text, StyleSheet, TouchableOpacity, Linking, ActivityIndicator, Modal, ScrollView } from "react-native";
import { useState, useEffect, useMemo } from "react";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path, Circle, Rect, Ellipse } from "react-native-svg";
import { colors, spacing, borderRadius, fontSize } from "@/lib/theme";
import { router } from "expo-router";
import { WeatherData, getWeatherFresh, canPlayOutside } from "@/lib/weatherService";
import { PrayerTimes, CurrentPrayer, getPrayerTimesFresh, getCurrentPrayer, formatMinutesRemaining } from "@/lib/prayerService";
import { getCurrentLocation, UserLocation } from "@/lib/locationService";
import { Park, getNearbyParks, formatDistanceMiles, getOutdoorRecommendation, getParkIcon } from "@/lib/parkService";
import { TaskInstance, TaskTemplate, Member } from "@/lib/types";
import { isToday, isBefore, startOfDay } from "date-fns";

type LoadingState = 'loading' | 'success' | 'error';

interface DashboardCardsProps {
  taskInstances: TaskInstance[];
  taskTemplates: TaskTemplate[];
  members: Member[];
  currentTime: Date;
  onCompleteTask?: (taskId: string) => void;
  onApproveTask?: (taskId: string) => void;
  currentUserId?: string;
  isGuardian?: boolean;
  viewMode?: "family" | "mine"; // "family" shows all family tasks, "mine" shows only current user's tasks
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

  const openWeatherSource = () => {
    Linking.openURL('https://open-meteo.com/');
  };

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
      <TouchableOpacity onPress={openWeatherSource} style={styles.sourceLink}>
        <Ionicons name="open-outline" size={12} color="rgba(255,255,255,0.7)" />
        <Text style={styles.sourceLinkText}>Source: Open-Meteo</Text>
      </TouchableOpacity>
    </View>
  );
}

export function PrayerCountdownCard({ currentTime, location }: { currentTime: Date; location: UserLocation | null }) {
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
  const [currentPrayer, setCurrentPrayer] = useState<CurrentPrayer | null>(null);
  const [loadState, setLoadState] = useState<LoadingState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!location) {
      setLoadState('loading');
      return;
    }
    const loadPrayerTimes = async () => {
      setLoadState('loading');
      setErrorMessage(null);
      try {
        const times = await getPrayerTimesFresh(location.latitude, location.longitude);
        setPrayerTimes(times);
        setLoadState('success');
      } catch (error) {
        console.error('[Prayer] Load error:', error);
        setLoadState('error');
        setErrorMessage('Unable to load prayer times');
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

  if (loadState === 'loading') {
    return (
      <View style={styles.card} data-testid="prayer-countdown-card-loading">
        <View style={styles.cardHeader}>
          <View style={styles.cardIconContainer}>
            <Ionicons name="moon" size={24} color={colors.primary} />
          </View>
          <Text style={styles.cardTitle}>Prayer Times</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Loading prayer times...</Text>
        </View>
      </View>
    );
  }

  if (loadState === 'error') {
    return (
      <View style={styles.card} data-testid="prayer-countdown-card-error">
        <View style={styles.cardHeader}>
          <View style={styles.cardIconContainer}>
            <Ionicons name="moon" size={24} color={colors.error} />
          </View>
          <Text style={styles.cardTitle}>Prayer Times</Text>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={24} color={colors.error} />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      </View>
    );
  }

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

interface WeatherCardProps {
  weather: WeatherData | null;
  loadState: LoadingState;
  errorMessage?: string | null;
}

export function WeatherCard({ weather, loadState, errorMessage }: WeatherCardProps) {
  const outdoorStatus = useMemo(() => {
    if (!weather) return null;
    return canPlayOutside(weather);
  }, [weather]);

  if (loadState === 'loading') {
    return (
      <View style={styles.card} data-testid="weather-card-loading">
        <View style={styles.cardHeader}>
          <View style={styles.cardIconContainer}>
            <Ionicons name="cloudy" size={24} color={colors.primary} />
          </View>
          <Text style={styles.cardTitle}>Today's Weather</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Loading weather data...</Text>
        </View>
      </View>
    );
  }

  if (loadState === 'error') {
    return (
      <View style={styles.card} data-testid="weather-card-error">
        <View style={styles.cardHeader}>
          <View style={styles.cardIconContainer}>
            <Ionicons name="cloudy" size={24} color={colors.error} />
          </View>
          <Text style={styles.cardTitle}>Today's Weather</Text>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={24} color={colors.error} />
          <Text style={styles.errorText}>{errorMessage || 'Unable to load weather'}</Text>
        </View>
      </View>
    );
  }

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

interface WhatToWearCardProps {
  weather: WeatherData | null;
  loadState: LoadingState;
}

export function WhatToWearCard({ weather, loadState }: WhatToWearCardProps) {
  const outfit = useMemo(() => {
    if (!weather) return null;
    return getOutfitForWeather(weather);
  }, [weather]);

  if (loadState === 'loading') {
    return (
      <View style={styles.card} data-testid="what-to-wear-card-loading">
        <View style={styles.cardHeader}>
          <View style={styles.cardIconContainer}>
            <Ionicons name="shirt" size={24} color={colors.primary} />
          </View>
          <Text style={styles.cardTitle}>What to Wear</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Loading outfit suggestions...</Text>
        </View>
      </View>
    );
  }

  if (loadState === 'error' || !weather || !outfit) return null;

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

// Participant Task Card - Shows tasks for a single family member
interface ParticipantTaskCardProps {
  member: Member;
  tasks: Array<{
    instance: TaskInstance;
    template: TaskTemplate;
    isOverdue: boolean;
  }>;
  onCompleteTask?: (taskId: string) => void;
  onApproveTask?: (taskId: string) => void;
  currentUserId?: string;
  isGuardian?: boolean;
}

export function ParticipantTaskCard({
  member,
  tasks,
  onCompleteTask,
  onApproveTask,
  currentUserId,
  isGuardian,
}: ParticipantTaskCardProps) {
  const openTasks = tasks.filter(t => t.instance.status === 'open');
  const pendingTasks = tasks.filter(t => t.instance.status === 'pending_approval');
  const overdueTasks = tasks.filter(t => t.isOverdue);
  
  const isCurrentUser = currentUserId === member.id;
  const canComplete = isCurrentUser || isGuardian;

  if (tasks.length === 0) {
    return (
      <View style={styles.participantCard} data-testid={`participant-card-${member.id}`}>
        <View style={styles.participantHeader}>
          <View style={styles.participantAvatar}>
            <Text style={styles.participantAvatarText}>
              {member.avatar || member.name.slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={styles.participantInfo}>
            <Text style={styles.participantName}>{member.name}</Text>
            <View style={styles.participantStars}>
              <Ionicons name="star" size={14} color="#FFD700" />
              <Text style={styles.participantStarsText}>{member.starsTotal} stars</Text>
            </View>
          </View>
        </View>
        <View style={styles.participantEmpty}>
          <Ionicons name="checkmark-done-circle" size={28} color={colors.success} />
          <Text style={styles.participantEmptyText}>All done for today!</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.participantCard} data-testid={`participant-card-${member.id}`}>
      <View style={styles.participantHeader}>
        <View style={[
          styles.participantAvatar,
          overdueTasks.length > 0 && styles.participantAvatarOverdue
        ]}>
          <Text style={styles.participantAvatarText}>
            {member.avatar || member.name.slice(0, 2).toUpperCase()}
          </Text>
        </View>
        <View style={styles.participantInfo}>
          <Text style={styles.participantName}>{member.name}</Text>
          <View style={styles.participantStars}>
            <Ionicons name="star" size={14} color="#FFD700" />
            <Text style={styles.participantStarsText}>{member.starsTotal} stars</Text>
          </View>
        </View>
        <View style={styles.participantBadges}>
          {overdueTasks.length > 0 && (
            <View style={styles.participantBadgeOverdue}>
              <Text style={styles.participantBadgeText}>{overdueTasks.length} late</Text>
            </View>
          )}
          {openTasks.length > 0 && (
            <View style={styles.participantBadge}>
              <Text style={styles.participantBadgeText}>{openTasks.length} to do</Text>
            </View>
          )}
          {pendingTasks.length > 0 && (
            <View style={styles.participantBadgePending}>
              <Text style={styles.participantBadgeText}>{pendingTasks.length} pending</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.participantTasksList}>
        {tasks.slice(0, 3).map(({ instance, template, isOverdue }) => (
          <View 
            key={instance.id}
            style={[
              styles.participantTaskItem,
              isOverdue && styles.participantTaskItemOverdue,
              instance.status === 'pending_approval' && styles.participantTaskItemPending,
            ]}
          >
            <View style={styles.participantTaskInfo}>
              <View style={styles.participantTaskTitleRow}>
                {isOverdue && <Ionicons name="alert-circle" size={14} color={colors.error} />}
                {instance.status === 'pending_approval' && <Ionicons name="hourglass" size={14} color={colors.warning} />}
                <Text style={styles.participantTaskTitle} numberOfLines={1}>
                  {template.title}
                </Text>
              </View>
              <View style={styles.participantTaskMeta}>
                <Ionicons name="star" size={10} color="#FFD700" />
                <Text style={styles.participantTaskStars}>{template.defaultStars}</Text>
              </View>
            </View>
            
            {instance.status === 'pending_approval' && isGuardian ? (
              <TouchableOpacity 
                style={styles.participantApproveButton}
                onPress={() => onApproveTask?.(instance.id)}
                data-testid={`button-approve-participant-${instance.id}`}
              >
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            ) : instance.status === 'open' && canComplete ? (
              <TouchableOpacity 
                style={styles.participantCompleteButton}
                onPress={() => onCompleteTask?.(instance.id)}
                data-testid={`button-complete-participant-${instance.id}`}
              >
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            ) : null}
          </View>
        ))}
        
        {tasks.length > 3 && (
          <TouchableOpacity 
            style={styles.participantMoreButton}
            onPress={() => router.push({ pathname: "/(tabs)/tasks", params: { view: "assigned", member: member.id } })}
          >
            <Text style={styles.participantMoreText}>
              +{tasks.length - 3} more tasks
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// Grid of participant task cards
interface ParticipantTasksGridProps extends Omit<DashboardCardsProps, 'currentTime'> {}

export function ParticipantTasksGrid({
  taskInstances,
  taskTemplates,
  members,
  onCompleteTask,
  onApproveTask,
  currentUserId,
  isGuardian,
}: ParticipantTasksGridProps) {
  const today = startOfDay(new Date());
  
  // Get kids only - cloud-synced members with profileId (not local member-* IDs)
  const kids = useMemo(() => {
    return members.filter(m => 
      m.role === 'kid' && 
      m.profileId && 
      !m.id.startsWith('member-')
    );
  }, [members]);

  // Group tasks by member
  const tasksByMember = useMemo(() => {
    const map = new Map<string, Array<{ instance: TaskInstance; template: TaskTemplate; isOverdue: boolean }>>();
    
    for (const member of kids) {
      map.set(member.id, []);
    }
    
    for (const instance of taskInstances) {
      if (instance.status === 'approved' || instance.status === 'expired' || instance.status === 'rejected') continue;
      
      const dueDate = new Date(instance.dueAt);
      const isOverdue = isBefore(dueDate, today);
      const isDueToday = isToday(dueDate);
      
      // Include overdue, due today, or pending approval
      if (!isOverdue && !isDueToday && instance.status !== 'pending_approval') continue;
      
      const template = taskTemplates.find(t => t.id === instance.templateId);
      if (!template) continue;
      
      const memberTasks = map.get(instance.assignedToMemberId);
      if (memberTasks) {
        memberTasks.push({ instance, template, isOverdue });
      }
    }
    
    // Sort each member's tasks
    for (const [, tasks] of map) {
      tasks.sort((a, b) => {
        if (a.isOverdue && !b.isOverdue) return -1;
        if (!a.isOverdue && b.isOverdue) return 1;
        if (a.instance.status === 'pending_approval' && b.instance.status !== 'pending_approval') return -1;
        if (a.instance.status !== 'pending_approval' && b.instance.status === 'pending_approval') return 1;
        return 0;
      });
    }
    
    return map;
  }, [kids, taskInstances, taskTemplates, today]);

  if (kids.length === 0) {
    return null;
  }

  return (
    <View style={styles.participantGrid} data-testid="participant-tasks-grid">
      <View style={styles.participantGridHeader}>
        <Ionicons name="people" size={20} color={colors.primary} />
        <Text style={styles.participantGridTitle}>Family Tasks</Text>
      </View>
      <View style={styles.participantCards}>
        {kids.map(member => (
          <ParticipantTaskCard
            key={member.id}
            member={member}
            tasks={tasksByMember.get(member.id) || []}
            onCompleteTask={onCompleteTask}
            onApproveTask={onApproveTask}
            currentUserId={currentUserId}
            isGuardian={isGuardian}
          />
        ))}
      </View>
    </View>
  );
}

interface TodayTasksSummaryProps extends Omit<DashboardCardsProps, 'currentTime'> {}

export function TodayTasksSummary({ 
  taskInstances, 
  taskTemplates, 
  members, 
  onCompleteTask, 
  onApproveTask,
  currentUserId,
  isGuardian 
}: TodayTasksSummaryProps) {
  const today = startOfDay(new Date());
  
  // Get actionable tasks (overdue first, then due today, always include pending)
  const actionableTasks = useMemo(() => {
    return taskInstances
      .filter(instance => {
        // Exclude completed, expired, and rejected tasks
        if (instance.status === "approved" || instance.status === "expired" || instance.status === "rejected") return false;
        // Always show pending_approval tasks (even if future due date)
        if (instance.status === "pending_approval") return true;
        // For open tasks, only show overdue or due today
        const dueDate = new Date(instance.dueAt);
        return isBefore(dueDate, today) || isToday(dueDate);
      })
      .map(instance => {
        const template = taskTemplates.find(t => t.id === instance.templateId);
        const member = members.find(m => m.id === instance.assignedToMemberId);
        const dueDate = new Date(instance.dueAt);
        const isOverdue = isBefore(dueDate, today);
        return { instance, template, member, isOverdue };
      })
      .filter(t => t.template && t.member)
      .sort((a, b) => {
        // Overdue first
        if (a.isOverdue && !b.isOverdue) return -1;
        if (!a.isOverdue && b.isOverdue) return 1;
        // Then pending approval (guardians see these)
        if (a.instance.status === "pending_approval" && b.instance.status !== "pending_approval") return -1;
        if (a.instance.status !== "pending_approval" && b.instance.status === "pending_approval") return 1;
        return 0;
      })
      .slice(0, 5); // Show top 5 tasks
  }, [taskInstances, taskTemplates, members, today]);

  const taskStats = useMemo(() => {
    let dueToday = 0;
    let overdue = 0;
    let pendingApproval = 0;

    for (const instance of taskInstances) {
      // Exclude completed, expired, and rejected tasks
      if (instance.status === "approved" || instance.status === "expired" || instance.status === "rejected") continue;
      if (instance.status === "pending_approval") {
        pendingApproval++;
        continue;
      }
      
      const dueDate = new Date(instance.dueAt);
      if (isBefore(dueDate, today)) {
        overdue++;
      } else if (isToday(dueDate)) {
        dueToday++;
      }
    }

    return { dueToday, overdue, pendingApproval, total: dueToday + overdue + pendingApproval };
  }, [taskInstances, today]);

  const handleViewTasks = () => {
    router.push({ pathname: "/(tabs)/tasks", params: { view: "assigned", filter: "today" } });
  };

  const isEmpty = actionableTasks.length === 0;

  return (
    <View style={styles.tasksSection} data-testid="today-tasks-summary">
      {/* Header */}
      <View style={styles.tasksSectionHeader}>
        <View style={styles.tasksSectionTitleRow}>
          <Ionicons name="checkbox" size={24} color={colors.primary} />
          <Text style={styles.tasksSectionTitle}>Today's Tasks</Text>
        </View>
        {taskStats.total > 0 && (
          <View style={styles.tasksBadgeRow}>
            {taskStats.overdue > 0 && (
              <View style={[styles.taskCountBadge, styles.taskCountBadgeOverdue]}>
                <Text style={styles.taskCountBadgeText}>{taskStats.overdue} overdue</Text>
              </View>
            )}
            {taskStats.dueToday > 0 && (
              <View style={styles.taskCountBadge}>
                <Text style={styles.taskCountBadgeText}>{taskStats.dueToday} due</Text>
              </View>
            )}
            {isGuardian && taskStats.pendingApproval > 0 && (
              <View style={[styles.taskCountBadge, styles.taskCountBadgePending]}>
                <Text style={styles.taskCountBadgeText}>{taskStats.pendingApproval} pending</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {isEmpty ? (
        <TouchableOpacity style={styles.emptyTasksCard} onPress={handleViewTasks}>
          <Ionicons name="checkmark-done-circle" size={40} color={colors.success} />
          <Text style={styles.emptyTasksText}>All clear for today!</Text>
          <Text style={styles.browseTasksLink}>Browse task templates</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.taskCardsList}>
          {actionableTasks.map(({ instance, template, member, isOverdue }) => (
            <View 
              key={instance.id} 
              style={[
                styles.quickTaskCard,
                isOverdue && styles.quickTaskCardOverdue,
                instance.status === "pending_approval" && styles.quickTaskCardPending,
              ]}
            >
              <View style={styles.quickTaskInfo}>
                <View style={styles.quickTaskTitleRow}>
                  {isOverdue && <Ionicons name="alert-circle" size={16} color={colors.error} />}
                  {instance.status === "pending_approval" && <Ionicons name="hourglass" size={16} color={colors.warning} />}
                  <Text style={styles.quickTaskTitle} numberOfLines={1}>
                    {template!.title}
                  </Text>
                </View>
                <View style={styles.quickTaskMeta}>
                  <Text style={styles.quickTaskMember}>{member!.name}</Text>
                  <View style={styles.quickTaskStars}>
                    <Ionicons name="star" size={12} color="#FFD700" />
                    <Text style={styles.quickTaskStarsText}>{template!.defaultStars}</Text>
                  </View>
                </View>
              </View>
              
              {/* Quick Action Button */}
              {instance.status === "pending_approval" && isGuardian ? (
                <TouchableOpacity 
                  style={styles.quickApproveButton}
                  onPress={() => onApproveTask?.(instance.id)}
                  data-testid={`button-approve-${instance.id}`}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.quickActionText}>Approve</Text>
                </TouchableOpacity>
              ) : instance.status === "open" && (instance.assignedToMemberId === currentUserId || isGuardian) ? (
                <TouchableOpacity 
                  style={styles.quickCompleteButton}
                  onPress={() => onCompleteTask?.(instance.id)}
                  data-testid={`button-complete-${instance.id}`}
                >
                  <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                  <Text style={styles.quickActionText}>Done</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.quickTaskStatus}>
                  <Text style={styles.quickTaskStatusText}>
                    {instance.status === "pending_approval" ? "Pending" : "Open"}
                  </Text>
                </View>
              )}
            </View>
          ))}
          
          {taskStats.total > 5 && (
            <TouchableOpacity style={styles.viewAllTasksButton} onPress={handleViewTasks}>
              <Text style={styles.viewAllTasksText}>
                View all {taskStats.total} tasks
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// NearbyParksCard - Shows nearby parks with weather-based outdoor recommendations
export function NearbyParksCard({ 
  weather, 
  location 
}: { 
  weather: WeatherData | null; 
  location: UserLocation | null;
}) {
  const [parks, setParks] = useState<Park[]>([]);
  const [loadState, setLoadState] = useState<LoadingState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // Wait for location to be available (even default location is fine)
    if (!location) {
      setLoadState('loading');
      return;
    }
    
    const loadParks = async () => {
      setLoadState('loading');
      setErrorMessage(null);
      try {
        console.log('[NearbyParksCard] Loading parks for location:', location.city || 'Unknown', 
          'isDefault:', location.isDefault);
        const parkData = await getNearbyParks(5000); // 5km radius
        setParks(parkData.parks);
        setLoadState('success');
      } catch (error) {
        console.error('[Parks] Load error:', error);
        setLoadState('error');
        setErrorMessage('Unable to find nearby parks');
      }
    };
    loadParks();
  }, [location]);

  // Get outdoor recommendation based on weather
  const outdoorRec = useMemo(() => {
    if (!weather) return null;
    return getOutdoorRecommendation({
      temperature: weather.temperature,
      conditions: weather.condition,
      humidity: weather.humidity,
      windSpeed: weather.windSpeed,
      uvIndex: weather.uvIndex,
    });
  }, [weather]);

  const openMapsApp = (park: Park) => {
    const url = `https://www.openstreetmap.org/?mlat=${park.lat}&mlon=${park.lon}#map=17/${park.lat}/${park.lon}`;
    Linking.openURL(url);
  };

  const openSourceLink = () => {
    Linking.openURL('https://www.openstreetmap.org/');
  };

  // Limit shown parks based on expanded state
  const visibleParks = expanded ? parks : parks.slice(0, 3);

  // Get rating badge style
  const getRatingStyle = (rating: 'perfect' | 'good' | 'caution' | 'not_recommended') => {
    switch (rating) {
      case 'perfect':
        return { bg: '#E8F5E9', text: colors.success, icon: 'sunny' as const };
      case 'good':
        return { bg: '#E3F2FD', text: colors.primary, icon: 'partly-sunny' as const };
      case 'caution':
        return { bg: '#FFF3E0', text: colors.warning, icon: 'warning' as const };
      case 'not_recommended':
        return { bg: '#FFE5E5', text: colors.error, icon: 'close-circle' as const };
    }
  };

  if (loadState === 'loading') {
    return (
      <View style={styles.card} data-testid="nearby-parks-card-loading">
        <View style={styles.cardHeader}>
          <View style={styles.cardIconContainer}>
            <Ionicons name="leaf" size={24} color={colors.success} />
          </View>
          <Text style={styles.cardTitle}>Nearby Parks</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Finding nearby parks...</Text>
        </View>
      </View>
    );
  }

  if (loadState === 'error') {
    return (
      <View style={styles.card} data-testid="nearby-parks-card-error">
        <View style={styles.cardHeader}>
          <View style={styles.cardIconContainer}>
            <Ionicons name="leaf" size={24} color={colors.success} />
          </View>
          <Text style={styles.cardTitle}>Nearby Parks</Text>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={20} color={colors.error} />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      </View>
    );
  }

  if (parks.length === 0) {
    return (
      <View style={styles.card} data-testid="nearby-parks-card-empty">
        <View style={styles.cardHeader}>
          <View style={styles.cardIconContainer}>
            <Ionicons name="leaf" size={24} color={colors.success} />
          </View>
          <Text style={styles.cardTitle}>Nearby Parks</Text>
        </View>
        <View style={styles.emptyTasksContent}>
          <Ionicons name="map-outline" size={32} color={colors.textMuted} />
          <Text style={[styles.emptyTasksText, { color: colors.textSecondary }]}>
            No parks found nearby
          </Text>
        </View>
      </View>
    );
  }

  const ratingStyle = outdoorRec ? getRatingStyle(outdoorRec.rating) : null;

  return (
    <View style={styles.card} data-testid="nearby-parks-card">
      <View style={styles.cardHeader}>
        <View style={styles.cardIconContainer}>
          <Ionicons name="leaf" size={24} color={colors.success} />
        </View>
        <Text style={styles.cardTitle}>Nearby Parks</Text>
      </View>

      {/* Outdoor recommendation banner */}
      {outdoorRec && ratingStyle && (
        <View style={[styles.parkRecommendation, { backgroundColor: ratingStyle.bg }]}>
          <Ionicons name={ratingStyle.icon} size={18} color={ratingStyle.text} />
          <View style={styles.parkRecContent}>
            <Text style={[styles.parkRecMessage, { color: ratingStyle.text }]}>
              {outdoorRec.message}
            </Text>
            {outdoorRec.tips.length > 0 && (
              <Text style={[styles.parkRecTip, { color: ratingStyle.text }]}>
                {outdoorRec.tips[0]}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Parks list */}
      <View style={styles.parksList}>
        {visibleParks.map((park) => (
          <TouchableOpacity 
            key={park.id} 
            style={styles.parkItem}
            onPress={() => openMapsApp(park)}
            activeOpacity={0.7}
            data-testid={`park-item-${park.id}`}
          >
            <View style={styles.parkIconContainer}>
              <Ionicons 
                name={getParkIcon(park.type) as any} 
                size={20} 
                color={colors.success} 
              />
            </View>
            <View style={styles.parkInfo}>
              <Text style={styles.parkName} numberOfLines={1}>
                {park.name}
              </Text>
              <View style={styles.parkMeta}>
                <Text style={styles.parkDistance}>
                  {formatDistanceMiles(park.distance)}
                </Text>
                {park.amenities.length > 0 && (
                  <>
                    <Text style={styles.parkDot}>•</Text>
                    <Text style={styles.parkAmenity} numberOfLines={1}>
                      {park.amenities.slice(0, 2).join(', ')}
                    </Text>
                  </>
                )}
              </View>
            </View>
            <Ionicons name="navigate-outline" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Show more/less toggle */}
      {parks.length > 3 && (
        <TouchableOpacity 
          style={styles.showMoreButton}
          onPress={() => setExpanded(!expanded)}
        >
          <Text style={styles.showMoreText}>
            {expanded ? 'Show less' : `Show ${parks.length - 3} more`}
          </Text>
          <Ionicons 
            name={expanded ? 'chevron-up' : 'chevron-down'} 
            size={16} 
            color={colors.primary} 
          />
        </TouchableOpacity>
      )}

      {/* Source attribution */}
      <TouchableOpacity onPress={openSourceLink} style={styles.parkSource}>
        <Text style={styles.parkSourceText}>Data from OpenStreetMap</Text>
        <Ionicons name="open-outline" size={12} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
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

// Compact Prayer Widget for side-by-side display with modal
function CompactPrayerWidget({ currentTime, location }: { currentTime: Date; location: UserLocation | null }) {
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
  const [currentPrayer, setCurrentPrayer] = useState<CurrentPrayer | null>(null);
  const [loadState, setLoadState] = useState<LoadingState>('loading');
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!location) return;
    const loadPrayerTimes = async () => {
      try {
        const times = await getPrayerTimesFresh(location.latitude, location.longitude);
        setPrayerTimes(times);
        setLoadState('success');
      } catch {
        setLoadState('error');
      }
    };
    loadPrayerTimes();
  }, [location]);

  useEffect(() => {
    if (prayerTimes) {
      setCurrentPrayer(getCurrentPrayer(prayerTimes));
    }
  }, [prayerTimes, currentTime]);

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h = hours % 12 || 12;
    return `${h}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  const prayerList = prayerTimes ? [
    { name: 'Fajr', time: prayerTimes.fajr, icon: 'moon' },
    { name: 'Sunrise', time: prayerTimes.sunrise, icon: 'sunny' },
    { name: 'Dhuhr', time: prayerTimes.dhuhr, icon: 'sunny' },
    { name: 'Asr', time: prayerTimes.asr, icon: 'partly-sunny' },
    { name: 'Maghrib', time: prayerTimes.maghrib, icon: 'sunset-outline' },
    { name: 'Isha', time: prayerTimes.isha, icon: 'moon' },
  ] : [];

  if (loadState === 'loading' || !currentPrayer) {
    return (
      <View style={styles.compactWidget}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (loadState === 'error') {
    return (
      <View style={styles.compactWidget}>
        <Ionicons name="moon-outline" size={20} color={colors.textMuted} />
        <Text style={styles.compactWidgetLabel}>Prayer</Text>
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity 
        style={[styles.compactWidget, currentPrayer.isUrgent && styles.compactWidgetUrgent]} 
        onPress={() => setShowModal(true)}
        data-testid="compact-prayer-widget"
      >
        <Ionicons name="moon" size={20} color={currentPrayer.isUrgent ? colors.error : colors.primary} />
        <Text style={styles.compactWidgetLabel}>{currentPrayer.name}</Text>
        <Text style={[styles.compactWidgetValue, currentPrayer.isUrgent && { color: colors.error }]}>
          {formatMinutesRemaining(currentPrayer.minutesRemaining)}
        </Text>
      </TouchableOpacity>

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Ionicons name="moon" size={24} color={colors.primary} />
                <Text style={styles.modalTitle}>Prayer Times</Text>
              </View>
              <TouchableOpacity onPress={() => setShowModal(false)} data-testid="button-close-prayer-modal">
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {currentPrayer.isUrgent && (
              <View style={styles.urgentBanner}>
                <Ionicons name="alert-circle" size={18} color={colors.error} />
                <Text style={styles.urgentText}>
                  {currentPrayer.name} ends in {formatMinutesRemaining(currentPrayer.minutesRemaining)}
                </Text>
              </View>
            )}

            <View style={styles.prayerTimesList}>
              {prayerList.map((prayer, index) => (
                <View 
                  key={prayer.name}
                  style={[
                    styles.prayerTimeItem,
                    currentPrayer.name === prayer.name && styles.prayerTimeItemActive
                  ]}
                >
                  <View style={styles.prayerTimeLeft}>
                    <View style={[
                      styles.prayerTimeIcon,
                      currentPrayer.name === prayer.name && styles.prayerTimeIconActive
                    ]}>
                      <Ionicons 
                        name={prayer.icon as any} 
                        size={18} 
                        color={currentPrayer.name === prayer.name ? "#FFFFFF" : colors.textSecondary} 
                      />
                    </View>
                    <Text style={[
                      styles.prayerTimeName,
                      currentPrayer.name === prayer.name && styles.prayerTimeNameActive
                    ]}>
                      {prayer.name}
                    </Text>
                  </View>
                  <Text style={[
                    styles.prayerTimeValue,
                    currentPrayer.name === prayer.name && styles.prayerTimeValueActive
                  ]}>
                    {formatTime(prayer.time)}
                  </Text>
                </View>
              ))}
            </View>

            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowModal(false)}
            >
              <Text style={styles.modalCloseButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

// Compact Weather Widget for side-by-side display with modal
function CompactWeatherWidget({ weather, loadState }: { weather: WeatherData | null; loadState: LoadingState }) {
  const [showModal, setShowModal] = useState(false);

  const outdoorStatus = useMemo(() => {
    if (!weather) return null;
    return canPlayOutside(weather);
  }, [weather]);

  if (loadState === 'loading') {
    return (
      <View style={styles.compactWidget}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (loadState === 'error' || !weather) {
    return (
      <View style={styles.compactWidget}>
        <Ionicons name="partly-sunny-outline" size={20} color={colors.textMuted} />
        <Text style={styles.compactWidgetLabel}>Weather</Text>
      </View>
    );
  }

  const getWeatherIcon = (): keyof typeof Ionicons.glyphMap => {
    if ((weather as any).isDay === false) return "moon";
    if (weather.condition.includes("rain") || weather.condition.includes("Rain")) return "rainy";
    if (weather.condition.includes("cloud") || weather.condition.includes("Cloud")) return "cloudy";
    if (weather.condition.includes("sun") || weather.condition.includes("clear")) return "sunny";
    return "partly-sunny";
  };

  const hasAlerts = weather.isSevere || (weather.alerts && weather.alerts.length > 0);

  return (
    <>
      <TouchableOpacity 
        style={[styles.compactWidget, hasAlerts && styles.compactWidgetWarning]} 
        onPress={() => setShowModal(true)}
        data-testid="compact-weather-widget"
      >
        <Ionicons name={getWeatherIcon()} size={20} color={hasAlerts ? colors.warning : colors.secondary} />
        <Text style={styles.compactWidgetValue}>{Math.round(weather.temperature)}°</Text>
        <Text style={styles.compactWidgetLabel} numberOfLines={1}>{weather.condition}</Text>
        {hasAlerts && <Ionicons name="warning" size={14} color={colors.warning} />}
      </TouchableOpacity>

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Ionicons name={getWeatherIcon()} size={24} color={colors.secondary} />
                <Text style={styles.modalTitle}>Weather Details</Text>
              </View>
              <TouchableOpacity onPress={() => setShowModal(false)} data-testid="button-close-weather-modal">
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {hasAlerts && (
              <View style={styles.alertBanner}>
                <Ionicons name="warning" size={18} color="#FFFFFF" />
                <Text style={styles.alertText}>
                  {weather.severeType || 'Weather Advisory'}
                </Text>
              </View>
            )}

            <View style={styles.weatherDetailsGrid}>
              <View style={styles.weatherDetailMain}>
                <Text style={styles.weatherDetailTemp}>{Math.round(weather.temperature)}°F</Text>
                <Text style={styles.weatherDetailCondition}>{weather.condition}</Text>
                <Text style={styles.weatherDetailFeels}>Feels like {weather.feelsLike}°F</Text>
              </View>
              
              <View style={styles.weatherDetailsRow}>
                <View style={styles.weatherDetailItem}>
                  <Ionicons name="water-outline" size={18} color={colors.textSecondary} />
                  <Text style={styles.weatherDetailLabel}>Humidity</Text>
                  <Text style={styles.weatherDetailValue}>{weather.humidity}%</Text>
                </View>
                <View style={styles.weatherDetailItem}>
                  <Ionicons name="speedometer-outline" size={18} color={colors.textSecondary} />
                  <Text style={styles.weatherDetailLabel}>Wind</Text>
                  <Text style={styles.weatherDetailValue}>{weather.windSpeed} mph</Text>
                </View>
                <View style={styles.weatherDetailItem}>
                  <Ionicons name="sunny-outline" size={18} color={colors.textSecondary} />
                  <Text style={styles.weatherDetailLabel}>UV Index</Text>
                  <Text style={styles.weatherDetailValue}>{weather.uvIndex}</Text>
                </View>
              </View>

              {outdoorStatus && (
                <View style={[styles.outdoorStatusBanner, !outdoorStatus.canPlay && styles.outdoorStatusBannerNo]}>
                  <Ionicons 
                    name={outdoorStatus.canPlay ? "checkmark-circle" : "close-circle"} 
                    size={20} 
                    color={outdoorStatus.canPlay ? colors.success : colors.error} 
                  />
                  <View style={styles.outdoorStatusContent}>
                    <Text style={[styles.outdoorStatusTitle, !outdoorStatus.canPlay && { color: colors.error }]}>
                      {outdoorStatus.canPlay ? "Safe for outdoor play" : "Stay indoors"}
                    </Text>
                    {!outdoorStatus.canPlay && outdoorStatus.reason && (
                      <Text style={styles.outdoorStatusReason}>{outdoorStatus.reason}</Text>
                    )}
                  </View>
                </View>
              )}
            </View>

            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowModal(false)}
            >
              <Text style={styles.modalCloseButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

// Compact Parks Widget for side-by-side display with modal
function CompactParksWidget({ weather, location }: { weather: WeatherData | null; location: UserLocation | null }) {
  const [parks, setParks] = useState<Park[]>([]);
  const [loadState, setLoadState] = useState<LoadingState>('loading');
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!location) return;
    const loadParks = async () => {
      try {
        const parkData = await getNearbyParks(5000);
        setParks(parkData.parks);
        setLoadState('success');
      } catch {
        setLoadState('error');
      }
    };
    loadParks();
  }, [location]);

  const outdoorRec = useMemo(() => {
    if (!weather) return null;
    return getOutdoorRecommendation({
      temperature: weather.temperature,
      conditions: weather.condition,
      humidity: weather.humidity,
      windSpeed: weather.windSpeed,
      uvIndex: weather.uvIndex,
    });
  }, [weather]);

  const openMapsApp = (park: Park) => {
    const url = `https://www.openstreetmap.org/?mlat=${park.lat}&mlon=${park.lon}#map=17/${park.lat}/${park.lon}`;
    Linking.openURL(url);
  };

  const getRatingStyle = (rating: 'perfect' | 'good' | 'caution' | 'not_recommended') => {
    switch (rating) {
      case 'perfect': return { bg: '#E8F5E9', text: colors.success, icon: 'sunny' as const };
      case 'good': return { bg: '#E3F2FD', text: colors.primary, icon: 'partly-sunny' as const };
      case 'caution': return { bg: '#FFF3E0', text: colors.warning, icon: 'warning' as const };
      case 'not_recommended': return { bg: '#FFE5E5', text: colors.error, icon: 'close-circle' as const };
    }
  };

  if (loadState === 'loading') {
    return (
      <View style={styles.compactWidget}>
        <ActivityIndicator size="small" color={colors.success} />
      </View>
    );
  }

  if (loadState === 'error' || parks.length === 0) {
    return (
      <View style={styles.compactWidget}>
        <Ionicons name="leaf-outline" size={20} color={colors.textMuted} />
        <Text style={styles.compactWidgetLabel}>Parks</Text>
      </View>
    );
  }

  const ratingStyle = outdoorRec ? getRatingStyle(outdoorRec.rating) : null;
  const notRecommended = outdoorRec?.rating === 'not_recommended';

  return (
    <>
      <TouchableOpacity 
        style={[styles.compactWidget, notRecommended && styles.compactWidgetWarning]} 
        onPress={() => setShowModal(true)}
        data-testid="compact-parks-widget"
      >
        <Ionicons name="leaf" size={20} color={notRecommended ? colors.warning : colors.success} />
        <Text style={styles.compactWidgetValue}>{parks.length}</Text>
        <Text style={styles.compactWidgetLabel}>Parks</Text>
      </TouchableOpacity>

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Ionicons name="leaf" size={24} color={colors.success} />
                <Text style={styles.modalTitle}>Nearby Parks</Text>
              </View>
              <TouchableOpacity onPress={() => setShowModal(false)} data-testid="button-close-parks-modal">
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {outdoorRec && ratingStyle && (
              <View style={[styles.parkRecommendationBanner, { backgroundColor: ratingStyle.bg }]}>
                <Ionicons name={ratingStyle.icon} size={20} color={ratingStyle.text} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.parkRecTitle, { color: ratingStyle.text }]}>
                    {outdoorRec.message}
                  </Text>
                  {outdoorRec.tips.length > 0 && (
                    <Text style={[styles.parkRecTipText, { color: ratingStyle.text }]}>
                      {outdoorRec.tips[0]}
                    </Text>
                  )}
                </View>
              </View>
            )}

            <ScrollView style={styles.parksModalList} showsVerticalScrollIndicator={false}>
              {parks.map((park) => (
                <TouchableOpacity 
                  key={park.id} 
                  style={styles.parkModalItem}
                  onPress={() => openMapsApp(park)}
                  data-testid={`park-modal-item-${park.id}`}
                >
                  <View style={styles.parkModalIcon}>
                    <Ionicons name={getParkIcon(park.type) as any} size={20} color={colors.success} />
                  </View>
                  <View style={styles.parkModalInfo}>
                    <Text style={styles.parkModalName} numberOfLines={1}>{park.name}</Text>
                    <View style={styles.parkModalMeta}>
                      <Text style={styles.parkModalDistance}>{formatDistanceMiles(park.distance)}</Text>
                      {park.amenities.length > 0 && (
                        <Text style={styles.parkModalAmenities} numberOfLines={1}>
                          {park.amenities.slice(0, 3).join(', ')}
                        </Text>
                      )}
                    </View>
                  </View>
                  <Ionicons name="navigate-outline" size={18} color={colors.primary} />
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowModal(false)}
            >
              <Text style={styles.modalCloseButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

// MyTasksView - Shows only the current user's tasks
function MyTasksView({
  taskInstances,
  taskTemplates,
  members,
  onCompleteTask,
  currentUserId,
}: {
  taskInstances: TaskInstance[];
  taskTemplates: TaskTemplate[];
  members: Member[];
  onCompleteTask?: (taskId: string) => void;
  currentUserId?: string;
}) {
  const today = startOfDay(new Date());
  // Find current member - match by id or profileId since profile.id might be different from member.id
  const currentMember = members.find(m => m.id === currentUserId || m.profileId === currentUserId);
  const currentMemberId = currentMember?.id;
  
  // Get tasks assigned to the current user (using member.id which is what task assignments use)
  const myTasks = useMemo(() => {
    if (!currentMemberId) return [];
    
    return taskInstances
      .filter(instance => {
        if (instance.status === 'approved' || instance.status === 'expired' || instance.status === 'rejected') return false;
        // Match using member.id since that's what task assignments use
        if (instance.assignedToMemberId !== currentMemberId) return false;
        
        const dueDate = new Date(instance.dueAt);
        const isOverdue = isBefore(dueDate, today);
        const isDueToday = isToday(dueDate);
        
        // Include overdue, due today, or pending approval
        return isOverdue || isDueToday || instance.status === 'pending_approval';
      })
      .map(instance => {
        const template = taskTemplates.find(t => t.id === instance.templateId);
        const dueDate = new Date(instance.dueAt);
        const isOverdue = isBefore(dueDate, today);
        return { instance, template, isOverdue };
      })
      .filter(t => t.template)
      .sort((a, b) => {
        if (a.isOverdue && !b.isOverdue) return -1;
        if (!a.isOverdue && b.isOverdue) return 1;
        if (a.instance.status === 'pending_approval' && b.instance.status !== 'pending_approval') return -1;
        if (a.instance.status !== 'pending_approval' && b.instance.status === 'pending_approval') return 1;
        return 0;
      });
  }, [taskInstances, taskTemplates, currentMemberId, today]);

  const openTasks = myTasks.filter(t => t.instance.status === 'open');
  const pendingTasks = myTasks.filter(t => t.instance.status === 'pending_approval');
  const overdueTasks = myTasks.filter(t => t.isOverdue);

  if (myTasks.length === 0) {
    return (
      <View style={styles.myTasksContainer} data-testid="my-tasks-empty">
        <View style={styles.myTasksHeader}>
          <Ionicons name="person" size={20} color={colors.primary} />
          <Text style={styles.myTasksTitle}>My Tasks</Text>
        </View>
        <View style={styles.myTasksEmptyState}>
          <Ionicons name="checkmark-done-circle" size={48} color={colors.success} />
          <Text style={styles.myTasksEmptyTitle}>All done!</Text>
          <Text style={styles.myTasksEmptyText}>No tasks assigned to you today.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.myTasksContainer} data-testid="my-tasks-view">
      <View style={styles.myTasksHeader}>
        <Ionicons name="person" size={20} color={colors.primary} />
        <Text style={styles.myTasksTitle}>My Tasks</Text>
        <View style={styles.myTasksBadges}>
          {overdueTasks.length > 0 && (
            <View style={styles.myTasksBadgeOverdue}>
              <Text style={styles.myTasksBadgeText}>{overdueTasks.length} late</Text>
            </View>
          )}
          {openTasks.length > 0 && (
            <View style={styles.myTasksBadge}>
              <Text style={styles.myTasksBadgeText}>{openTasks.length} to do</Text>
            </View>
          )}
          {pendingTasks.length > 0 && (
            <View style={styles.myTasksBadgePending}>
              <Text style={styles.myTasksBadgeText}>{pendingTasks.length} pending</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.myTasksList}>
        {myTasks.map(({ instance, template, isOverdue }) => (
          <View 
            key={instance.id}
            style={[
              styles.myTaskItem,
              isOverdue && styles.myTaskItemOverdue,
              instance.status === 'pending_approval' && styles.myTaskItemPending,
            ]}
          >
            <View style={styles.myTaskInfo}>
              <View style={styles.myTaskTitleRow}>
                {isOverdue && <Ionicons name="alert-circle" size={16} color={colors.error} />}
                {instance.status === 'pending_approval' && <Ionicons name="hourglass" size={16} color={colors.warning} />}
                <Text style={styles.myTaskTitle} numberOfLines={1}>
                  {template!.title}
                </Text>
              </View>
              <View style={styles.myTaskMeta}>
                <Ionicons name="star" size={12} color="#FFD700" />
                <Text style={styles.myTaskStars}>{template!.defaultStars}</Text>
                {instance.status === 'pending_approval' && (
                  <Text style={styles.myTaskStatusText}>Awaiting approval</Text>
                )}
              </View>
            </View>
            
            {instance.status === 'open' && (
              <TouchableOpacity 
                style={styles.myTaskCompleteButton}
                onPress={() => onCompleteTask?.(instance.id)}
                data-testid={`button-complete-my-${instance.id}`}
              >
                <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                <Text style={styles.myTaskCompleteText}>Done</Text>
              </TouchableOpacity>
            )}
            
            {instance.status === 'pending_approval' && (
              <View style={styles.myTaskPendingIcon}>
                <Ionicons name="time" size={20} color={colors.warning} />
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

export function DashboardCards({ 
  taskInstances, 
  taskTemplates, 
  members, 
  currentTime,
  onCompleteTask,
  onApproveTask,
  currentUserId,
  isGuardian,
  viewMode = "family"
}: DashboardCardsProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoadState, setWeatherLoadState] = useState<LoadingState>('loading');
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const { location } = useLocation();

  useEffect(() => {
    if (!location) {
      setWeatherLoadState('loading');
      return;
    }
    const loadWeather = async () => {
      setWeatherLoadState('loading');
      setWeatherError(null);
      try {
        const data = await getWeatherFresh(location.latitude, location.longitude);
        setWeather(data);
        setWeatherLoadState('success');
      } catch (error) {
        console.error('[Weather] Load error:', error);
        setWeatherLoadState('error');
        setWeatherError('Unable to load weather data');
      }
    };
    loadWeather();
  }, [location]);

  return (
    <View style={styles.dashboardContainer}>
      {/* Secondary Info - Weather, Prayer & Parks in compact row at top */}
      <View style={styles.compactInfoRow}>
        <CompactPrayerWidget currentTime={currentTime} location={location} />
        <CompactWeatherWidget weather={weather} loadState={weatherLoadState} />
        <CompactParksWidget weather={weather} location={location} />
      </View>
      
      {/* TASKS - Show based on viewMode */}
      {viewMode === "family" ? (
        <ParticipantTasksGrid 
          taskInstances={taskInstances}
          taskTemplates={taskTemplates}
          members={members}
          onCompleteTask={onCompleteTask}
          onApproveTask={onApproveTask}
          currentUserId={currentUserId}
          isGuardian={isGuardian}
        />
      ) : (
        <MyTasksView
          taskInstances={taskInstances}
          taskTemplates={taskTemplates}
          members={members}
          onCompleteTask={onCompleteTask}
          currentUserId={currentUserId}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dashboardContainer: {
    gap: spacing.md,
  },
  compactInfoRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  compactWidget: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 72,
  },
  compactWidgetLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontWeight: "500",
    textAlign: "center",
  },
  compactWidgetValue: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  compactWidgetUrgent: {
    borderColor: colors.error,
    borderWidth: 1.5,
  },
  compactWidgetWarning: {
    borderColor: colors.warning,
    borderWidth: 1.5,
  },
  // Modal styles
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
    marginBottom: spacing.md,
  },
  modalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.text,
  },
  modalCloseButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  modalCloseButtonText: {
    color: "#FFFFFF",
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  // Prayer modal styles
  urgentBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "#FFE5E5",
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  urgentText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.error,
  },
  prayerTimesList: {
    gap: spacing.sm,
  },
  prayerTimeItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceSecondary,
  },
  prayerTimeItemActive: {
    backgroundColor: colors.primary,
  },
  prayerTimeLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  prayerTimeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  prayerTimeIconActive: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  prayerTimeName: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
  },
  prayerTimeNameActive: {
    color: "#FFFFFF",
  },
  prayerTimeValue: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  prayerTimeValueActive: {
    color: "#FFFFFF",
  },
  // Weather modal styles
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.warning,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  alertText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  weatherDetailsGrid: {
    gap: spacing.md,
  },
  weatherDetailMain: {
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  weatherDetailTemp: {
    fontSize: 48,
    fontWeight: "700",
    color: colors.text,
  },
  weatherDetailCondition: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  weatherDetailFeels: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  weatherDetailsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  weatherDetailItem: {
    alignItems: "center",
    gap: spacing.xs,
  },
  weatherDetailLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  weatherDetailValue: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.text,
  },
  outdoorStatusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "#E8F5E9",
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  outdoorStatusBannerNo: {
    backgroundColor: "#FFE5E5",
  },
  outdoorStatusContent: {
    flex: 1,
  },
  outdoorStatusTitle: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.success,
  },
  outdoorStatusReason: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  // Parks modal styles
  parkRecommendationBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  parkRecTitle: {
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  parkRecTipText: {
    fontSize: fontSize.xs,
    marginTop: 2,
    opacity: 0.85,
  },
  parksModalList: {
    maxHeight: 320,
  },
  parkModalItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  parkModalIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  parkModalInfo: {
    flex: 1,
  },
  parkModalName: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
  },
  parkModalMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: 2,
  },
  parkModalDistance: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: "600",
  },
  parkModalAmenities: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    flex: 1,
  },
  // Participant Task Card styles
  participantGrid: {
    gap: spacing.md,
  },
  participantGridHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  participantGridTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text,
  },
  participantCards: {
    gap: spacing.sm,
  },
  participantCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  participantHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  participantAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  participantAvatarOverdue: {
    borderWidth: 2,
    borderColor: colors.error,
  },
  participantAvatarText: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.primary,
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
  },
  participantStars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  participantStarsText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  participantBadges: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  participantBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  participantBadgeOverdue: {
    backgroundColor: colors.error,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  participantBadgePending: {
    backgroundColor: colors.warning,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  participantBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  participantEmpty: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  participantEmptyText: {
    fontSize: fontSize.sm,
    color: colors.success,
    fontWeight: "500",
  },
  participantTasksList: {
    gap: spacing.xs,
  },
  participantTaskItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  participantTaskItemOverdue: {
    backgroundColor: `${colors.error}15`,
    borderColor: colors.error,
  },
  participantTaskItemPending: {
    backgroundColor: `${colors.warning}15`,
    borderColor: colors.warning,
  },
  participantTaskInfo: {
    flex: 1,
    gap: 2,
  },
  participantTaskTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  participantTaskTitle: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.text,
    flex: 1,
  },
  participantTaskMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  participantTaskStars: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontWeight: "600",
  },
  participantCompleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
  },
  participantApproveButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  participantMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  participantMoreText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: "500",
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
  sourceLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: spacing.sm,
    alignSelf: "flex-end",
  },
  sourceLinkText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    textDecorationLine: "underline",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  loadingText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.error,
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
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accessoryText: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontWeight: "600",
  },
  // New Task-First Styles
  tasksSection: {
    gap: spacing.md,
  },
  tasksSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  tasksSectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  tasksSectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.text,
  },
  tasksBadgeRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  taskCountBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  taskCountBadgeOverdue: {
    backgroundColor: colors.error,
  },
  taskCountBadgePending: {
    backgroundColor: colors.warning,
  },
  taskCountBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  emptyTasksCard: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
  },
  emptyTasksText: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.success,
  },
  browseTasksLink: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: "500",
  },
  taskCardsList: {
    gap: spacing.sm,
  },
  quickTaskCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickTaskCardOverdue: {
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
    backgroundColor: "rgba(239, 68, 68, 0.05)",
  },
  quickTaskCardPending: {
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
    backgroundColor: "rgba(245, 158, 11, 0.05)",
  },
  quickTaskInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  quickTaskTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  quickTaskTitle: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
    flex: 1,
  },
  quickTaskMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  quickTaskMember: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  quickTaskStars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  quickTaskStarsText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text,
  },
  quickCompleteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.success,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  quickApproveButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  quickActionText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  quickTaskStatus: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.md,
  },
  quickTaskStatusText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontWeight: "500",
  },
  viewAllTasksButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  viewAllTasksText: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.primary,
  },
  // Legacy styles kept for compatibility
  emptyTasksContent: {
    alignItems: "center",
    paddingVertical: spacing.md,
    gap: spacing.xs,
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
  // NearbyParksCard styles
  parkRecommendation: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  parkRecContent: {
    flex: 1,
  },
  parkRecMessage: {
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  parkRecTip: {
    fontSize: fontSize.xs,
    marginTop: 2,
    opacity: 0.85,
  },
  parksList: {
    gap: spacing.xs,
  },
  parkItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.md,
  },
  parkIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  parkInfo: {
    flex: 1,
  },
  parkName: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text,
  },
  parkMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: 2,
  },
  parkDistance: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  parkDot: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  parkAmenity: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    flex: 1,
  },
  showMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  showMoreText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: "500",
  },
  parkSource: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  parkSourceText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  // MyTasksView styles
  myTasksContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  myTasksHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  myTasksTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text,
    flex: 1,
  },
  myTasksBadges: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  myTasksBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  myTasksBadgeOverdue: {
    backgroundColor: colors.error,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  myTasksBadgePending: {
    backgroundColor: colors.warning,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  myTasksBadgeText: {
    color: "#FFFFFF",
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
  myTasksEmptyState: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  myTasksEmptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.success,
  },
  myTasksEmptyText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  myTasksList: {
    gap: spacing.sm,
  },
  myTaskItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  myTaskItemOverdue: {
    borderLeftWidth: 3,
    borderLeftColor: colors.error,
  },
  myTaskItemPending: {
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
  myTaskInfo: {
    flex: 1,
    gap: 4,
  },
  myTaskTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  myTaskTitle: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
    flex: 1,
  },
  myTaskMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  myTaskStars: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  myTaskStatusText: {
    fontSize: fontSize.xs,
    color: colors.warning,
    marginLeft: spacing.sm,
  },
  myTaskCompleteButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.success,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  myTaskCompleteText: {
    color: "#FFFFFF",
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  myTaskPendingIcon: {
    padding: spacing.sm,
  },
});
