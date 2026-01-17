import { useState, useEffect } from "react";
import { Plus, Trash2, User, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { MemberRole, Member } from "@/lib/types";

interface NewMember {
  id?: string;
  name: string;
  age: string;
  role: MemberRole;
}

interface AddMembersProps {
  existingMembers?: Member[];
  onNext: (members: Array<{ id?: string; name: string; age: number; role: MemberRole }>) => void;
  onBack: () => void;
}

export function AddMembers({ existingMembers = [], onNext, onBack }: AddMembersProps) {
  const [members, setMembers] = useState<NewMember[]>(() => {
    if (existingMembers.length > 0) {
      return existingMembers.map(m => ({
        id: m.id,
        name: m.name,
        age: m.age.toString(),
        role: m.role
      }));
    }
    return [{ name: "", age: "", role: "kid" as MemberRole }];
  });

  useEffect(() => {
    if (existingMembers.length > 0 && members.length === 1 && !members[0].name && !members[0].id) {
      setMembers(existingMembers.map(m => ({
        id: m.id,
        name: m.name,
        age: m.age.toString(),
        role: m.role
      })));
    }
  }, [existingMembers]);

  const addMember = () => {
    setMembers([...members, { name: "", age: "", role: "kid" }]);
  };

  const removeMember = (index: number) => {
    if (members.length > 1) {
      setMembers(members.filter((_, i) => i !== index));
    }
  };

  const updateMember = (index: number, field: keyof NewMember, value: string | MemberRole) => {
    const updated = [...members];
    updated[index] = { ...updated[index], [field]: value };
    setMembers(updated);
  };

  const toggleRole = (index: number) => {
    const updated = [...members];
    updated[index].role = updated[index].role === "kid" ? "guardian" : "kid";
    setMembers(updated);
  };

  const hasKid = members.some(m => m.role === "kid" && m.name.trim() && m.age);
  
  const handleNext = () => {
    const validMembers = members
      .filter(m => m.name.trim() && m.age)
      .map(m => ({
        id: m.id,
        name: m.name.trim(),
        age: parseInt(m.age, 10),
        role: m.role
      }));
    
    if (validMembers.some(m => m.role === "kid")) {
      onNext(validMembers);
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
    <div className="flex flex-col min-h-screen px-4 py-6 bg-background">
      <div className="flex items-center gap-3 mb-6">
        <button 
          onClick={onBack}
          className="p-2 rounded-lg hover-elevate"
          data-testid="button-back"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Add Your Family</h1>
          <p className="text-sm text-muted-foreground">Add at least one child to begin</p>
        </div>
      </div>

      <div className="flex-1 space-y-4 pb-24">
        {members.map((member, index) => (
          <Card key={member.id || index} className="p-4 relative" data-testid={`member-card-${index}`}>
            <div className="flex gap-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center shrink-0 ${getAvatarColor(index)}`}>
                {member.name ? (
                  <span className="text-xl font-bold">{member.name.charAt(0).toUpperCase()}</span>
                ) : (
                  <User className="w-8 h-8" />
                )}
              </div>
              
              <div className="flex-1 space-y-3">
                <div>
                  <Label htmlFor={`name-${index}`} className="text-sm font-medium">
                    Name
                  </Label>
                  <Input
                    id={`name-${index}`}
                    placeholder="Enter name"
                    value={member.name}
                    onChange={(e) => updateMember(index, "name", e.target.value)}
                    className="mt-1"
                    data-testid={`input-name-${index}`}
                  />
                </div>
                
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Label htmlFor={`age-${index}`} className="text-sm font-medium">
                      Age
                    </Label>
                    <Input
                      id={`age-${index}`}
                      type="number"
                      min="1"
                      max="99"
                      placeholder="Age"
                      value={member.age}
                      onChange={(e) => updateMember(index, "age", e.target.value)}
                      className="mt-1"
                      data-testid={`input-age-${index}`}
                    />
                  </div>
                  
                  <div className="flex-1">
                    <Label className="text-sm font-medium">Role</Label>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-sm ${member.role === "kid" ? "font-semibold" : "text-muted-foreground"}`}>
                        Kid
                      </span>
                      <Switch
                        checked={member.role === "guardian"}
                        onCheckedChange={() => toggleRole(index)}
                        data-testid={`switch-role-${index}`}
                      />
                      <span className={`text-sm ${member.role === "guardian" ? "font-semibold" : "text-muted-foreground"}`}>
                        Guardian
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {members.length > 1 && (
              <button
                onClick={() => removeMember(index)}
                className="absolute top-3 right-3 p-2 text-muted-foreground hover:text-destructive transition-colors"
                data-testid={`button-remove-${index}`}
                aria-label="Remove member"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </Card>
        ))}
        
        <Button
          variant="outline"
          onClick={addMember}
          className="w-full h-12 rounded-xl gap-2"
          data-testid="button-add-member"
        >
          <Plus className="w-5 h-5" />
          Add Another Member
        </Button>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
        <Button
          onClick={handleNext}
          disabled={!hasKid}
          className="w-full h-12 rounded-xl text-base font-semibold gap-2"
          data-testid="button-continue"
        >
          Continue
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
