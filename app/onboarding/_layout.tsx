import { Stack } from "expo-router";
import { colors } from "@/lib/theme";

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="add-members" />
      <Stack.Screen name="powers" />
      <Stack.Screen name="tasks" />
    </Stack>
  );
}
