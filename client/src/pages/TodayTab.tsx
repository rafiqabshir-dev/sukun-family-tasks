import { CalendarDays, Sunrise } from "lucide-react";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";

export function TodayTab() {
  const today = new Date();
  
  return (
    <div className="px-4 py-6 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Sunrise className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Today's Tasks</h1>
          <p className="text-sm text-muted-foreground">
            {format(today, "EEEE, MMMM d")}
          </p>
        </div>
      </div>

      <Card className="p-8 flex flex-col items-center justify-center text-center" data-testid="today-placeholder">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <CalendarDays className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-2">
          Ready to start your day!
        </h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          Tasks will appear here once they're assigned. 
          Check back soon for your daily challenges.
        </p>
      </Card>
    </div>
  );
}
