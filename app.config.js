export default {
  expo: {
    name: "Sukun",
    slug: "sukun-app",
    version: "1.0.0",
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
      buildNumber: "1",
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
    plugins: ["expo-router", "expo-secure-store"],
    extra: {
      SUPABASE_URL: process.env.SUPABASE_URL || "",
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || ""
    }
  }
};
