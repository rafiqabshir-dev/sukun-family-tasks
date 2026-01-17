import { Redirect } from "expo-router";
import { useStore } from "@/lib/store";

export default function Index() {
  const onboardingComplete = useStore((s) => s.onboardingComplete);

  if (!onboardingComplete) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)/today" />;
}
