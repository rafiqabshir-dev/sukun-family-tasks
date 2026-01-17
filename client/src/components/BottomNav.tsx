import { CalendarDays, Dices, Trophy, Settings } from "lucide-react";

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: "today", label: "Today", icon: CalendarDays },
  { id: "spin", label: "Spin", icon: Dices },
  { id: "leaderboard", label: "Leaderboard", icon: Trophy },
  { id: "setup", label: "Setup", icon: Settings }
];

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 bg-card border-t border-card-border rounded-t-2xl z-50"
      data-testid="bottom-nav"
    >
      <div className="flex items-center justify-around h-16 max-w-md mx-auto px-2 pb-safe">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center flex-1 py-2 min-h-[44px] transition-all duration-150 ${
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground"
              }`}
              data-testid={`tab-${tab.id}`}
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon 
                className={`transition-transform duration-150 ${
                  isActive ? "w-6 h-6 scale-110" : "w-5 h-5"
                }`}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span 
                className={`text-xs mt-1 transition-all duration-150 ${
                  isActive ? "font-bold" : "font-medium"
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
