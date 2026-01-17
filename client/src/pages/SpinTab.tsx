import { Dices } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function SpinTab() {
  return (
    <div className="px-4 py-6 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
          <Dices className="w-6 h-6 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Spin the Wheel</h1>
          <p className="text-sm text-muted-foreground">Win fun rewards</p>
        </div>
      </div>

      <Card className="p-8 flex flex-col items-center justify-center text-center" data-testid="spin-placeholder">
        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary/20 via-accent/20 to-secondary/30 flex items-center justify-center mb-6 animate-pulse">
          <div className="w-24 h-24 rounded-full bg-card flex items-center justify-center">
            <Dices className="w-10 h-10 text-muted-foreground" />
          </div>
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-2">
          Spin coming soon!
        </h2>
        <p className="text-sm text-muted-foreground max-w-xs mb-6">
          Complete tasks to earn spins and win exciting rewards 
          for the whole family.
        </p>
        <Button variant="outline" disabled className="rounded-xl">
          Spin the Wheel
        </Button>
      </Card>
    </div>
  );
}
