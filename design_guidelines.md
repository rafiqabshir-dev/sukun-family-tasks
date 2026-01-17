# Barakah Kids Race - Mobile App Design Guidelines

## Design Approach
**Reference-Based: Duolingo Kids + Calm App + Islamic Aesthetics**

Drawing from Duolingo's playful progression system, Calm's gentle visual language, and traditional Islamic geometric subtlety. Create a warm, encouraging environment that celebrates achievement without overwhelming stimulation.

**Core Principles:**
- Gentle encouragement over aggressive gamification
- Clear visual hierarchy for young readers (ages 5-12)
- Respectful Islamic aesthetic integration through patterns and typography
- Celebration without chaos

---

## Typography

**Primary Font:** Nunito (Google Fonts) - rounded, friendly, highly legible for children
**Accent Font:** Amiri (Google Fonts) - for Arabic text/Islamic touches

**Scale:**
- Headings: 28px (bold) - section titles
- Subheadings: 20px (semibold) - card headers
- Body: 16px (regular) - task descriptions
- Small: 14px (medium) - metadata, labels
- Tiny: 12px (regular) - timestamps, helper text

**Line Height:** 1.5 for all body text, 1.2 for headings

---

## Layout System

**Spacing Units:** Consistent 4px base grid
- **Primary spacing:** 4, 8, 12, 16, 24, 32
- **Screen padding:** 16px horizontal, 12px top safe area
- **Card spacing:** 12px between cards
- **Section spacing:** 24px between major sections

**Safe Areas:** Account for iOS notch/Android status bar (top) and navigation bar (bottom)

---

## Component Library

### Bottom Navigation (Fixed)
- Height: 80px (includes safe area)
- 4 tabs: Today | Spin | Leaderboard | Setup
- Active state: Icon + label in teal, inactive in muted gray
- Icons: Heroicons outline style
- Subtle elevation shadow above content

### Cards (Primary Container)
- Rounded corners: 16px
- Padding: 16px
- Shadow: Soft elevation (0 2px 8px rgba(0,0,0,0.08))
- Cream background with subtle texture
- Teal or coral accent borders (2px) for emphasis

### Task Cards
- Checkbox: Large (32px), rounded (8px), teal when checked with star icon inside
- Task title: 18px semibold
- Stars earned: Gold star icons, 24px, displayed inline with count
- Expandable for task details (tap to reveal)
- Swipe actions: Complete (teal) / Skip (gray)

### Star Counter Display
- Large circular badge: 64px diameter
- Current stars count centered, bold 24px
- Animated sparkle effect on increment
- Appears in header of Today and Leaderboard screens

### Progress Indicators
- Circular progress rings for daily/weekly goals
- Teal fill with coral accent at completion
- Percentage text centered inside

### Spin Wheel (Spin Screen)
- Center-screen wheel: 280px diameter
- 6-8 segments with prizes (extra stars, badges, encouragement)
- Wooden texture feel with Islamic geometric patterns on segments
- Large "SPIN" button below: Rounded, coral, 120px width
- Disabled state when no spins available (grayed out)

### Leaderboard List
- Ranked list items: 72px height
- Medal icons for top 3 (gold, silver, bronze)
- Avatar circles: 48px (can use initials or simple icons)
- Name + star count displayed prominently
- Current user row highlighted with subtle teal background glow

### Setup Screen (Parent View)
- Cleaner, more business-like layout
- List of children with add/edit controls
- Task templates library
- Settings toggles: Large, easy to tap (48px height)
- Islamic prayer time integration option

### Headers
- Screen titles: 24px bold, left-aligned
- Subtitle/date: 14px regular, muted
- Right-side action buttons: Icon-only, 40px tap target

### Buttons
- Primary (CTAs): Full-width or centered, 48px height, 16px rounded, coral background
- Secondary: Outlined teal, same dimensions
- Icon buttons: 40px tap target minimum

### Empty States
- Illustration-based (hand-drawn style)
- Encouraging message: "No tasks yet! Check back soon ✨"
- 200px illustration height centered

### Modals/Overlays
- Full-screen or bottom sheet (slide up from bottom)
- Dimmed background: 60% opacity black
- Close button: Top-right, 44px tap target

---

## Images

### Today Screen Hero
- Top banner image (full-width, 180px height): Warm illustration of children helping at home
- Gradient overlay (bottom): Cream to transparent for text legibility
- Daily motivation text overlaid: "Keep up the great work!"

### Spin Screen Background
- Subtle Islamic geometric pattern: Very low opacity (8%), tiled across background
- Does not distract from wheel interaction

### Leaderboard Header
- Celebratory illustration (160px height): Kids celebrating with stars
- Above the ranked list

### Empty State Illustrations
- Hand-drawn style, warm colors
- Maximum 200px height, centered
- Used on Today (no tasks), Spin (no spins), Leaderboard (no data yet)

### Achievement Badges
- Small earned badges: 48px icons
- Displayed in profile/stats areas
- Designed with Islamic star/geometric motifs

**No large hero images** - App focuses on immediate functionality with illustrative accents

---

## Animations

**Minimal and Purposeful:**
- Star increment: Quick sparkle fade (200ms)
- Task completion: Gentle checkmark draw + card fade
- Spin wheel: Smooth rotation with bounce at stop
- Screen transitions: Standard iOS/Android native slide
- Pull-to-refresh: Custom loader with spinning star icon