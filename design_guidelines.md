# Barakah Kids Race - Design Guidelines

## Design Approach

**Selected Approach**: Reference-Based with Kid-Focused Enhancement

**Primary References**: 
- **Duolingo** (gamification, friendly progression)
- **Khan Academy Kids** (calm, educational tone)
- **ClassDojo** (positive reinforcement for children)

**Core Principle**: Create a welcoming, age-appropriate experience that feels rewarding without overstimulation. Balance playfulness with the calm Islamic-values tone through gentle curves, spacious layouts, and encouraging language.

---

## Typography System

**Font Family**: 
- Primary: 'Fredoka' or 'Nunito' (rounded, friendly) via Google Fonts
- Fallback: system-ui

**Hierarchy**:
- **Hero/Onboarding Titles**: text-3xl font-bold (welcoming, not intimidating)
- **Section Headers**: text-xl font-semibold
- **Card Titles**: text-lg font-medium
- **Body/Task Text**: text-base font-normal
- **Labels/Metadata**: text-sm font-medium
- **Captions**: text-xs

**Character**: Rounded, approachable letterforms suitable for children ages 5-12.

---

## Layout System

**Mobile-First Structure** (320px–428px primary viewport):

**Spacing Scale**: Tailwind units of **3, 4, 6, 8, 12**
- Micro spacing: p-3, gap-3
- Standard spacing: p-4, gap-4, m-6
- Section spacing: py-8, py-12
- Container padding: px-4

**Safe Zones**:
- Bottom navigation: h-16 with pb-safe-area
- Top breathing room: pt-4 to pt-6
- Content area: Account for 64px bottom tab bar

---

## Component Library

### Navigation
**Bottom Tab Bar** (4 tabs):
- Fixed bottom position with rounded-t-2xl container
- Each tab: Icon (24px) + Label stacked vertically
- Active state: Slightly larger icon, bold label
- Tap targets: min 44px height
- Icons: lucide-react (Home, Trophy, Users, Settings equivalents)

### Onboarding Flow

**Welcome Screen**:
- Large friendly icon/illustration (96px)
- Greeting headline (text-2xl)
- Subtitle explaining purpose (text-base)
- Primary CTA button (full-width, rounded-xl, h-12)

**Add Kids Screen**:
- Avatar placeholder circles (64px diameter)
- Name input with playful labels
- Age selector (simple number input or picker)
- Role toggle (Kid/Guardian) with minimal styling
- Add another member button (secondary style)

**Powers Selection**:
- Grid layout: 2 columns on mobile (grid-cols-2, gap-3)
- Each power card:
  - Icon at top (40px)
  - Power name (text-base font-semibold)
  - Brief description (text-sm, 1-2 lines)
  - Border highlight when selected (rounded-xl, p-4)
  - Checkmark indicator in corner

**Starter Tasks Review**:
- Scrollable list with generous spacing (gap-4)
- Each task row:
  - Toggle switch (left)
  - Icon (24px)
  - Task name (text-base)
  - Simple card style (rounded-lg, p-3)
- Sticky bottom: Accept button (rounded-xl, h-12)

### Content Cards

**Task Cards** (for Today tab):
- Rounded-xl containers with p-4
- Icon + Title + Points display
- Completion checkbox (large tap target, 32px)
- Shadow-sm for depth

**Leaderboard Cards**:
- Horizontal layout with avatar + name + score
- Medal/trophy icons for top 3
- Ordinal numbers for rankings
- Gentle separators (not harsh lines)

**Member Cards** (Setup tab):
- Avatar (48px) + Name + Role badge
- Edit button (icon only, subtle)
- Rounded-lg, p-3

### Interactive Elements

**Buttons**:
- Primary: rounded-xl, h-12, font-semibold, w-full on mobile
- Secondary: rounded-xl, h-12, border style
- Icon buttons: rounded-full, w-10, h-10
- All buttons: Active state with subtle scale-95 or opacity change

**Form Inputs**:
- Rounded-lg borders
- p-3 internal spacing
- Clear labels above (text-sm font-medium)
- Placeholder text in lighter tone

**Toggles/Switches**:
- Large, kid-friendly size (w-12 h-6)
- Clear on/off states with smooth transitions

### Empty States & Placeholders

**Placeholder Pattern**:
- Centered icon (48px, muted)
- Heading (text-lg font-medium)
- Short description (text-sm, max-w-xs)
- Optional CTA button

---

## Special Considerations

**Kid-Friendly Touches**:
- Generous tap targets (minimum 44px)
- Clear visual feedback on interactions
- Rounded corners everywhere (rounded-lg minimum)
- Encouraging empty states ("Ready to start your adventure!")

**Islamic Values Integration**:
- Subtle crescent/star motifs in decorative elements
- Positive, growth-focused language
- Emphasis on family and helping others
- No harsh red colors for errors (use gentle orange/amber)

**Performance**:
- Simple, flat designs (minimal shadows)
- Icons from lucide-react library only
- No heavy animations (use subtle fades/slides)
- Fast, responsive interactions

---

## Animations

**Minimal Usage**:
- Page transitions: Simple slide or fade (150ms)
- Button presses: Scale feedback (100ms)
- Toggle switches: Smooth slide (200ms)
- Task completion: Gentle checkmark animation (300ms)
- **No**: Confetti, bouncing, spinning unless explicitly for "Spin" feature

---

## Images

**No hero images required** for this app. Focus on:
- Icon-based navigation and features
- Simple avatar placeholders (geometric shapes or initials)
- Illustrative icons for powers and tasks from lucide-react
- Decorative patterns (optional): Subtle Islamic geometric patterns in backgrounds

---

## Accessibility

- High contrast text (WCAG AA minimum)
- Clear focus states for keyboard navigation
- Screen reader labels for icons
- Simple language for all ages
- Consistent interaction patterns throughout