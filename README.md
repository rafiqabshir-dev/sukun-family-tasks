# Sukun - Family Tasks Made Simple

A React Native mobile app that gamifies household responsibilities for children aged 5-12, fostering family-oriented task management with a focus on Islamic values.

## Features

- **Task Management**: Create, assign, and track household tasks with a points-based reward system
- **Family Wheel**: Fun spin-the-wheel game for random task assignment or family games
- **Star Rewards**: Kids earn stars for completing tasks, visible on the family leaderboard
- **Powers System**: Assign special abilities to kids (e.g., "Organizer", "Fast Cleaner")
- **Multi-User Support**: Guardians manage tasks, kids complete them with approval workflows
- **Today Dashboard**: Weather, prayer times, nearby parks, and daily task summary
- **Push Notifications**: Stay updated on task assignments, approvals, and more

## Tech Stack

- **Framework**: React Native with Expo SDK 54
- **Navigation**: Expo Router (file-based routing)
- **State Management**: Zustand with AsyncStorage persistence
- **Backend**: Supabase (PostgreSQL + Authentication)
- **Styling**: React Native StyleSheet
- **Icons**: @expo/vector-icons (Ionicons)

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Mac) or Android Emulator, or Expo Go app on physical device

### Installation

1. Clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/sukun-family-tasks.git
cd sukun-family-tasks
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
# Create .env file with:
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SESSION_SECRET=your_session_secret
```

4. Start the development server:
```bash
npm run dev
```

5. Scan the QR code with Expo Go (mobile) or press 'w' for web.

## Project Structure

```
sukun/
├── app/                    # Expo Router pages
│   ├── (tabs)/             # Main tab navigation
│   ├── onboarding/         # New user flow
│   └── auth/               # Authentication screens
├── components/             # Reusable UI components
├── lib/                    # Core business logic
│   ├── store.ts            # Zustand state management
│   ├── cloudSync.ts        # Supabase sync operations
│   ├── types.ts            # TypeScript definitions
│   └── *Service.ts         # External API integrations
├── contexts/               # React contexts
├── assets/                 # Static assets
└── supabase/               # Database schema
```

## Documentation

- [Architecture Guide](./ARCHITECTURE.md) - Comprehensive technical documentation
- [Database Schema](./supabase/schema.sql) - Supabase table definitions

## Key Concepts

### User Roles

- **Guardians**: Parents/adults who manage tasks, approve completions, and control family settings
- **Participants**: Kids who complete assigned tasks and earn stars

### Task Flow

1. Guardian creates a task template
2. Guardian assigns task to a participant
3. Participant completes the task
4. Guardian approves/rejects the completion
5. Stars are awarded on approval

### Authentication

- Guardians: Full email/password authentication
- Participants: Simplified 4-digit passcode system

## External Services

| Service | Purpose | Cost |
|---------|---------|------|
| Supabase | Database & Auth | Free tier available |
| Open-Meteo | Weather data | Free |
| AlAdhan | Prayer times | Free |
| OpenStreetMap | Parks discovery | Free |

## Design Guidelines

- **No emojis in UI** - Use Ionicons exclusively
- Exception: Member avatars can use emojis (user content)
- Consistent, gentle tone reflecting Islamic values
- Cloud-first data architecture

## iOS App Store

Bundle Identifier: `com.sukun.familytasks`

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is proprietary software. All rights reserved.

## Support

For questions or issues, please open a GitHub issue.

---

Built with love for families everywhere.
