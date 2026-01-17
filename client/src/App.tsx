import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useStore } from "@/lib/store";
import { generateStarterTasks } from "@/lib/starterTasks";
import { PowerType } from "@/lib/types";

import { BottomNav } from "@/components/BottomNav";
import { Welcome } from "@/components/onboarding/Welcome";
import { AddMembers } from "@/components/onboarding/AddMembers";
import { PowerSelection } from "@/components/onboarding/PowerSelection";
import { TaskReview } from "@/components/onboarding/TaskReview";

import { TodayTab } from "@/pages/TodayTab";
import { SpinTab } from "@/pages/SpinTab";
import { LeaderboardTab } from "@/pages/LeaderboardTab";
import { SetupTab } from "@/pages/SetupTab";

type OnboardingStep = "welcome" | "members" | "powers" | "tasks";

function App() {
  const onboardingComplete = useStore((s) => s.onboardingComplete);
  const members = useStore((s) => s.members);
  const taskTemplates = useStore((s) => s.taskTemplates);
  const addMember = useStore((s) => s.addMember);
  const updateMember = useStore((s) => s.updateMember);
  const setTaskTemplates = useStore((s) => s.setTaskTemplates);
  const toggleTaskTemplate = useStore((s) => s.toggleTaskTemplate);
  const completeOnboarding = useStore((s) => s.completeOnboarding);

  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>("welcome");
  const [activeTab, setActiveTab] = useState("today");

  useEffect(() => {
    if (!onboardingComplete && taskTemplates.length === 0) {
      const starterTasks = generateStarterTasks();
      setTaskTemplates(starterTasks);
    }
  }, [onboardingComplete, taskTemplates.length, setTaskTemplates]);

  if (!onboardingComplete) {
    const kids = members.filter(m => m.role === "kid");

    switch (onboardingStep) {
      case "welcome":
        return (
          <TooltipProvider>
            <Welcome onNext={() => setOnboardingStep("members")} />
            <Toaster />
          </TooltipProvider>
        );

      case "members":
        return (
          <TooltipProvider>
            <AddMembers
              existingMembers={members}
              onBack={() => setOnboardingStep("welcome")}
              onNext={(submittedMembers) => {
                const existingIds = new Set(members.map(m => m.id));
                const submittedIds = new Set(submittedMembers.filter(m => m.id).map(m => m.id));
                
                members.forEach(m => {
                  if (!submittedIds.has(m.id)) {
                    useStore.getState().removeMember(m.id);
                  }
                });
                
                submittedMembers.forEach((m) => {
                  if (m.id && existingIds.has(m.id)) {
                    updateMember(m.id, { name: m.name, age: m.age, role: m.role });
                  } else {
                    addMember({
                      name: m.name,
                      age: m.age,
                      role: m.role,
                      powers: []
                    });
                  }
                });
                
                const hasKids = submittedMembers.some(m => m.role === "kid");
                if (hasKids) {
                  setOnboardingStep("powers");
                } else {
                  setOnboardingStep("tasks");
                }
              }}
            />
            <Toaster />
          </TooltipProvider>
        );

      case "powers":
        return (
          <TooltipProvider>
            <PowerSelection
              kids={kids}
              onBack={() => {
                setOnboardingStep("members");
              }}
              onNext={(selections) => {
                Object.entries(selections).forEach(([kidId, powers]) => {
                  updateMember(kidId, { powers: powers as PowerType[] });
                });
                setOnboardingStep("tasks");
              }}
            />
            <Toaster />
          </TooltipProvider>
        );

      case "tasks":
        return (
          <TooltipProvider>
            <TaskReview
              tasks={taskTemplates}
              onToggle={toggleTaskTemplate}
              onBack={() => setOnboardingStep("powers")}
              onComplete={() => {
                completeOnboarding();
              }}
            />
            <Toaster />
          </TooltipProvider>
        );
    }
  }

  const renderTab = () => {
    switch (activeTab) {
      case "today":
        return <TodayTab />;
      case "spin":
        return <SpinTab />;
      case "leaderboard":
        return <LeaderboardTab />;
      case "setup":
        return <SetupTab />;
      default:
        return <TodayTab />;
    }
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        <main className="pb-20">
          {renderTab()}
        </main>
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
