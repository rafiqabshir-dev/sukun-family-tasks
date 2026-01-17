import { Settings, User, ListChecks, Volume2, VolumeX, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useStore } from "@/lib/store";

export function SetupTab() {
  const members = useStore((s) => s.members);
  const taskTemplates = useStore((s) => s.taskTemplates);
  const soundEnabled = useStore((s) => s.soundEnabled);
  const toggleSound = useStore((s) => s.toggleSound);
  const reset = useStore((s) => s.reset);

  const enabledTasks = taskTemplates.filter(t => t.enabled).length;

  const handleReset = () => {
    if (confirm("This will reset all data and start fresh. Are you sure?")) {
      reset();
      window.location.reload();
    }
  };

  const getAvatarColor = (index: number) => {
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
    <div className="px-4 py-6 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
          <Settings className="w-6 h-6 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Setup</h1>
          <p className="text-sm text-muted-foreground">Manage your family</p>
        </div>
      </div>

      <section className="mb-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Family Members
        </h2>
        <div className="space-y-3">
          {members.length === 0 ? (
            <Card className="p-6 flex flex-col items-center text-center" data-testid="members-placeholder">
              <User className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No members added yet</p>
            </Card>
          ) : (
            members.map((member, index) => (
              <Card key={member.id} className="p-3" data-testid={`member-${member.id}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${getAvatarColor(index)}`}>
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{member.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {member.role === "kid" ? `${member.age} years old` : "Guardian"}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-lg ${
                    member.role === "kid" 
                      ? "bg-primary/10 text-primary" 
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {member.role}
                  </span>
                </div>
              </Card>
            ))
          )}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Task Templates
        </h2>
        <Card className="p-4" data-testid="tasks-summary">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <ListChecks className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">{enabledTasks} Active Tasks</h3>
              <p className="text-sm text-muted-foreground">
                {taskTemplates.length} total templates
              </p>
            </div>
          </div>
        </Card>
      </section>

      <section className="mb-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Preferences
        </h2>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {soundEnabled ? (
                <Volume2 className="w-5 h-5 text-primary" />
              ) : (
                <VolumeX className="w-5 h-5 text-muted-foreground" />
              )}
              <div>
                <h3 className="font-medium text-foreground">Sound Effects</h3>
                <p className="text-sm text-muted-foreground">Play sounds for actions</p>
              </div>
            </div>
            <Switch
              checked={soundEnabled}
              onCheckedChange={toggleSound}
              data-testid="switch-sound"
            />
          </div>
        </Card>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Danger Zone
        </h2>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RotateCcw className="w-5 h-5 text-destructive" />
              <div>
                <h3 className="font-medium text-foreground">Reset App</h3>
                <p className="text-sm text-muted-foreground">Start fresh from the beginning</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleReset}
              className="text-destructive border-destructive/30"
              data-testid="button-reset"
            >
              Reset
            </Button>
          </div>
        </Card>
      </section>
    </div>
  );
}
