import {
  Bed, Sparkles, Moon, Shirt, Blocks, UtensilsCrossed, Trash2,
  GlassWater, Backpack, BookOpen, Book, Pencil, Droplets, Heart,
  ShoppingBag, Smile, Gift, Users, Footprints, Star, Cookie,
  Library, Wind, Recycle, FileText, Music, Monitor, Clock, HelpCircle
} from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Bed,
  Sparkles,
  Moon,
  Shirt,
  Blocks,
  UtensilsCrossed,
  Trash2,
  GlassWater,
  Backpack,
  BookOpen,
  Book,
  Pencil,
  Droplets,
  Heart,
  ShoppingBag,
  Smile,
  Gift,
  Users,
  Footprints,
  Star,
  Cookie,
  Library,
  Wind,
  Recycle,
  FileText,
  Music,
  Monitor,
  Clock
};

interface TaskIconProps {
  name: string;
  className?: string;
}

export function TaskIcon({ name, className = "" }: TaskIconProps) {
  const Icon = iconMap[name] || HelpCircle;
  return <Icon className={className} />;
}
