import { useState } from "react";
import { ArrowRight, ArrowLeft, Check, FolderOpen, Sparkles, ChefHat, BookOpen, Heart, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PowerType, POWERS_INFO, Member } from "@/lib/types";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  FolderOpen,
  Sparkles,
  ChefHat,
  BookOpen,
  Heart,
  Target
};

interface PowerSelectionProps {
  kids: Member[];
  onNext: (selections: Record<string, PowerType[]>) => void;
  onBack: () => void;
}

export function PowerSelection({ kids, onNext, onBack }: PowerSelectionProps) {
  const [currentKidIndex, setCurrentKidIndex] = useState(0);
  const [selections, setSelections] = useState<Record<string, PowerType[]>>(() => {
    const initial: Record<string, PowerType[]> = {};
    kids.forEach(kid => {
      initial[kid.id] = [];
    });
    return initial;
  });

  const currentKid = kids[currentKidIndex];
  const currentPowers = selections[currentKid?.id] || [];
  const isLastKid = currentKidIndex === kids.length - 1;

  const togglePower = (power: PowerType) => {
    const kidPowers = selections[currentKid.id] || [];
    if (kidPowers.includes(power)) {
      setSelections({
        ...selections,
        [currentKid.id]: kidPowers.filter(p => p !== power)
      });
    } else if (kidPowers.length < 2) {
      setSelections({
        ...selections,
        [currentKid.id]: [...kidPowers, power]
      });
    }
  };

  const handleNext = () => {
    if (isLastKid) {
      onNext(selections);
    } else {
      setCurrentKidIndex(currentKidIndex + 1);
    }
  };

  const handleBack = () => {
    if (currentKidIndex > 0) {
      setCurrentKidIndex(currentKidIndex - 1);
    } else {
      onBack();
    }
  };

  const canContinue = currentPowers.length >= 1;

  if (!currentKid) return null;

  return (
    <div className="flex flex-col min-h-screen px-4 py-6 bg-background">
      <div className="flex items-center gap-3 mb-4">
        <button 
          onClick={handleBack}
          className="p-2 rounded-lg hover-elevate"
          data-testid="button-back"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">Choose Powers</h1>
          <p className="text-sm text-muted-foreground">
            {currentKid.name}'s special abilities (pick 1-2)
          </p>
        </div>
        {kids.length > 1 && (
          <span className="text-sm font-medium text-muted-foreground bg-muted px-2 py-1 rounded-lg">
            {currentKidIndex + 1} / {kids.length}
          </span>
        )}
      </div>

      <div className="flex-1 pb-24">
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(POWERS_INFO) as PowerType[]).map((power) => {
            const info = POWERS_INFO[power];
            const Icon = iconMap[info.icon];
            const isSelected = currentPowers.includes(power);
            const isDisabled = !isSelected && currentPowers.length >= 2;

            return (
              <Card
                key={power}
                onClick={() => !isDisabled && togglePower(power)}
                className={`p-4 cursor-pointer transition-all duration-150 relative ${
                  isSelected 
                    ? "ring-2 ring-primary bg-primary/5" 
                    : isDisabled 
                      ? "opacity-50 cursor-not-allowed" 
                      : "hover-elevate"
                }`}
                data-testid={`power-${power}`}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
                  isSelected ? "bg-primary/20" : "bg-muted"
                }`}>
                  {Icon && <Icon className={`w-5 h-5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />}
                </div>
                <h3 className="font-semibold text-base mb-1">{info.name}</h3>
                <p className="text-sm text-muted-foreground leading-snug">
                  {info.description}
                </p>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
        <Button
          onClick={handleNext}
          disabled={!canContinue}
          className="w-full h-12 rounded-xl text-base font-semibold gap-2"
          data-testid="button-continue"
        >
          {isLastKid ? "Review Tasks" : `Next: ${kids[currentKidIndex + 1]?.name}`}
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
