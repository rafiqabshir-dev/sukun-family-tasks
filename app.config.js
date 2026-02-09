import "dotenv/config";

export default {
  expo: {
    name: "Sukun",
    slug: "sukun-app",
    owner: "rafiq.abshir",
    version: "1.2.0",
    orientation: "portrait",
    icon: "./assets/sukun-logo.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    scheme: "sukun-app",
    splash: {
      image: "./assets/sukun-logo.png",
      resizeMode: "contain",
      backgroundColor: "#FFFFFF"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.sukun.familytasks",
      buildNumber: "2",
      config: {
        usesNonExemptEncryption: false
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#0D9488"
      },
      edgeToEdgeEnabled: true
    },
    web: {
      favicon: "./assets/favicon.png",
      bundler: "metro"
    },
    plugins: [
      "expo-router", 
      "expo-secure-store",
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#0D9488"
        }
      ]
    ],
    extra: {
      eas: {
        projectId: "90644534-b5b9-4c74-9742-08782c2c4ef4"
      },
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "",
      SUPABASE_URL: process.env.SUPABASE_URL || "",
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "",
    }
  }
};
