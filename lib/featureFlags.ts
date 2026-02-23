/**
 * Feature Flags
 *
 * Compile-time toggles to show/hide features.
 * Set a flag to `true` to enable, `false` to hide.
 * No runtime overhead — unused code paths are tree-shaken.
 */
export const FEATURE_FLAGS = {
  // Dashboard widgets
  weatherCard: false,
  nearbyParks: false,
  prayerTimes: false,
  locationBadge: false,

  // Games & Spin
  familyGame: false,
  charadesGame: false,
  comingSoonGames: false,
  assignTaskSpin: true,

  // Member features
  powersSystem: false,
} as const;
