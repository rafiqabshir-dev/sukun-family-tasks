import { Star, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WelcomeProps {
  onNext: () => void;
}

export function Welcome({ onNext }: WelcomeProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-8 bg-background">
      <div className="flex-1 flex flex-col items-center justify-center max-w-sm text-center">
        <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-8">
          <Star className="w-12 h-12 text-primary" strokeWidth={1.5} />
        </div>
        
        <h1 className="text-3xl font-bold text-foreground mb-4">
          Welcome to Barakah Kids Race
        </h1>
        
        <p className="text-base text-muted-foreground mb-8 leading-relaxed">
          A fun way for your family to grow together! Complete helpful tasks, 
          earn points, and celebrate kindness every day.
        </p>
        
        <div className="w-full space-y-3">
          <Button 
            onClick={onNext}
            className="w-full h-12 rounded-xl text-base font-semibold gap-2"
            data-testid="button-get-started"
          >
            Let's Get Started
            <ArrowRight className="w-5 h-5" />
          </Button>
        </div>
      </div>
      
      <p className="text-xs text-muted-foreground mt-8 opacity-70">
        Built with love for families
      </p>
    </div>
  );
}
