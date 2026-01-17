import { ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { TaskTemplate } from "@/lib/types";
import { TaskIcon } from "@/components/TaskIcon";

interface TaskReviewProps {
  tasks: TaskTemplate[];
  onToggle: (id: string) => void;
  onComplete: () => void;
  onBack: () => void;
}

export function TaskReview({ tasks, onToggle, onComplete, onBack }: TaskReviewProps) {
  const enabledCount = tasks.filter(t => t.enabled).length;

  return (
    <div className="flex flex-col min-h-screen px-4 py-6 bg-background">
      <div className="flex items-center gap-3 mb-4">
        <button 
          onClick={onBack}
          className="p-2 rounded-lg hover-elevate"
          data-testid="button-back"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">Review Tasks</h1>
          <p className="text-sm text-muted-foreground">
            {enabledCount} tasks selected
          </p>
        </div>
      </div>

      <p className="text-base text-muted-foreground mb-4 leading-relaxed">
        These are starter tasks for your family. You can always add more or 
        change them later in Setup.
      </p>

      <div className="flex-1 pb-24 space-y-3">
        {tasks.map((task) => (
          <Card 
            key={task.id} 
            className={`p-3 transition-all duration-150 ${
              task.enabled ? "" : "opacity-50"
            }`}
            data-testid={`task-${task.id}`}
          >
            <div className="flex items-center gap-3">
              <Switch
                checked={task.enabled}
                onCheckedChange={() => onToggle(task.id)}
                data-testid={`switch-${task.id}`}
              />
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                task.enabled ? "bg-primary/10" : "bg-muted"
              }`}>
                <TaskIcon 
                  name={task.icon} 
                  className={`w-4 h-4 ${task.enabled ? "text-primary" : "text-muted-foreground"}`} 
                />
              </div>
              <span className={`flex-1 text-base ${task.enabled ? "font-medium" : ""}`}>
                {task.name}
              </span>
              <span className={`text-sm font-medium ${
                task.enabled ? "text-primary" : "text-muted-foreground"
              }`}>
                +{task.points}
              </span>
            </div>
          </Card>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
        <Button
          onClick={onComplete}
          disabled={enabledCount === 0}
          className="w-full h-12 rounded-xl text-base font-semibold gap-2"
          data-testid="button-start"
        >
          <Check className="w-5 h-5" />
          Start Your Journey
        </Button>
      </div>
    </div>
  );
}
