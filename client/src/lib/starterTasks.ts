import { TaskTemplate } from "./types";

export function generateStarterTasks(): TaskTemplate[] {
  const tasks: Omit<TaskTemplate, "id">[] = [
    { name: "Make your bed", icon: "Bed", points: 5, enabled: true },
    { name: "Brush teeth (morning)", icon: "Sparkles", points: 3, enabled: true },
    { name: "Brush teeth (night)", icon: "Moon", points: 3, enabled: true },
    { name: "Get dressed on your own", icon: "Shirt", points: 4, enabled: true },
    { name: "Tidy your toys", icon: "Blocks", points: 5, enabled: true },
    { name: "Put dirty clothes in hamper", icon: "Shirt", points: 3, enabled: true },
    { name: "Set the table", icon: "UtensilsCrossed", points: 5, enabled: true },
    { name: "Clear your plate after eating", icon: "Trash2", points: 3, enabled: true },
    { name: "Help wash dishes", icon: "GlassWater", points: 6, enabled: true },
    { name: "Wipe the table", icon: "Sparkles", points: 4, enabled: true },
    { name: "Pack your school bag", icon: "Backpack", points: 5, enabled: true },
    { name: "Do homework", icon: "BookOpen", points: 8, enabled: true },
    { name: "Read for 15 minutes", icon: "Book", points: 6, enabled: true },
    { name: "Practice handwriting", icon: "Pencil", points: 5, enabled: true },
    { name: "Water the plants", icon: "Droplets", points: 4, enabled: true },
    { name: "Feed the pet", icon: "Heart", points: 5, enabled: true },
    { name: "Help fold laundry", icon: "Shirt", points: 6, enabled: true },
    { name: "Put away groceries", icon: "ShoppingBag", points: 5, enabled: true },
    { name: "Be kind to siblings", icon: "Heart", points: 5, enabled: true },
    { name: "Say please and thank you", icon: "Smile", points: 3, enabled: true },
    { name: "Share with others", icon: "Gift", points: 5, enabled: true },
    { name: "Help a family member", icon: "Users", points: 6, enabled: true },
    { name: "Clean up after play", icon: "Sparkles", points: 4, enabled: true },
    { name: "Put shoes in the right place", icon: "Footprints", points: 3, enabled: true },
    { name: "Hang up your coat", icon: "Shirt", points: 3, enabled: true },
    { name: "Say morning dua", icon: "Star", points: 4, enabled: true },
    { name: "Say evening dua", icon: "Moon", points: 4, enabled: true },
    { name: "Help prepare snacks", icon: "Cookie", points: 5, enabled: true },
    { name: "Organize bookshelf", icon: "Library", points: 6, enabled: true },
    { name: "Vacuum your room", icon: "Wind", points: 7, enabled: true },
    { name: "Take out recycling", icon: "Recycle", points: 5, enabled: true },
    { name: "Write in gratitude journal", icon: "FileText", points: 5, enabled: true },
    { name: "Practice an instrument", icon: "Music", points: 7, enabled: true },
    { name: "Exercise for 10 minutes", icon: "Heart", points: 5, enabled: true },
    { name: "No screen time before homework", icon: "Monitor", points: 6, enabled: true },
    { name: "Go to bed on time", icon: "Clock", points: 5, enabled: true }
  ];
  
  return tasks.map((task, index) => ({
    ...task,
    id: `task-${index + 1}`
  }));
}
