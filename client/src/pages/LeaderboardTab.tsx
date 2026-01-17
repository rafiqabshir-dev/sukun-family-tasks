import { Trophy, Medal, Award } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useStore } from "@/lib/store";

export function LeaderboardTab() {
  const members = useStore((s) => s.members);
  const kids = members.filter(m => m.role === "kid");

  return (
    <div className="px-4 py-6 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-secondary/30 flex items-center justify-center">
          <Trophy className="w-6 h-6 text-secondary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leaderboard</h1>
          <p className="text-sm text-muted-foreground">See who's leading the race</p>
        </div>
      </div>

      {kids.length === 0 ? (
        <Card className="p-8 flex flex-col items-center justify-center text-center" data-testid="leaderboard-placeholder">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Trophy className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">
            No scores yet
          </h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            Complete tasks to earn points and climb the leaderboard. 
            Every helpful deed counts!
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {kids
            .sort((a, b) => b.points - a.points)
            .map((kid, index) => {
              const getRankIcon = () => {
                if (index === 0) return <Medal className="w-5 h-5 text-yellow-500" />;
                if (index === 1) return <Medal className="w-5 h-5 text-gray-400" />;
                if (index === 2) return <Award className="w-5 h-5 text-amber-600" />;
                return <span className="text-sm font-bold text-muted-foreground w-5 text-center">{index + 1}</span>;
              };

              const getAvatarColor = () => {
                const colors = [
                  "bg-primary/20 text-primary",
                  "bg-secondary/30 text-secondary-foreground",
                  "bg-accent/30 text-accent-foreground",
                  "bg-chart-4/20 text-chart-4",
                  "bg-chart-5/20 text-chart-5"
                ];
                return colors[index % colors.length];
              };

              return (
                <Card 
                  key={kid.id} 
                  className="p-4"
                  data-testid={`leaderboard-row-${kid.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 flex items-center justify-center">
                      {getRankIcon()}
                    </div>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${getAvatarColor()}`}>
                      {kid.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{kid.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {kid.powers.length > 0 
                          ? kid.powers.map(p => p.replace(/_/g, ' ')).join(', ')
                          : 'No powers yet'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-bold text-primary">{kid.points}</span>
                      <p className="text-xs text-muted-foreground">points</p>
                    </div>
                  </div>
                </Card>
              );
            })}
        </div>
      )}
    </div>
  );
}
