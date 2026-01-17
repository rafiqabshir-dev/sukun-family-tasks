# Barakah Kids Race

## Overview

Barakah Kids Race is a family-oriented task management application designed for children ages 5-12. It gamifies household responsibilities and good behavior through a points-based system with Islamic values. The app features an onboarding flow for setting up family members, assigning "powers" (character traits) to kids, and selecting tasks. The main interface includes tabs for daily tasks, a reward spinner, leaderboard, and family setup.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, using Vite as the build tool
- **State Management**: Zustand for global state with localStorage persistence
- **Styling**: Tailwind CSS with a custom kid-friendly theme (warm teal/emerald colors)
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Typography**: Nunito font (rounded, child-friendly) via Google Fonts
- **Layout**: Mobile-first design targeting 320px-428px viewports with bottom tab navigation

### Backend Architecture
- **Runtime**: Node.js with Express
- **API Pattern**: RESTful endpoints prefixed with `/api`
- **Development**: tsx for TypeScript execution, Vite dev server for hot module replacement
- **Build**: esbuild for server bundling, Vite for client bundling

### Data Storage
- **Current Implementation**: In-memory storage (`MemStorage` class) with interface abstraction
- **Schema Definition**: Drizzle ORM with PostgreSQL dialect configured
- **Client Persistence**: Zustand store with localStorage for offline-first experience
- **Database Ready**: Schema exists in `shared/schema.ts` with user table defined; PostgreSQL can be provisioned when needed

### Design Patterns
- **Shared Types**: Common types and schemas in `shared/` directory accessible by both client and server
- **Path Aliases**: `@/` for client source, `@shared/` for shared code
- **Component Organization**: UI primitives in `components/ui/`, feature components alongside pages
- **Onboarding Flow**: Multi-step wizard pattern (Welcome → Add Members → Power Selection → Task Review)

## External Dependencies

### UI & Styling
- Radix UI primitives (dialog, tabs, accordion, etc.)
- Tailwind CSS with CSS variables for theming
- class-variance-authority for component variants
- Lucide React for icons

### Data & State
- Zustand for client state management
- TanStack React Query for server state (configured but minimal use currently)
- Drizzle ORM + drizzle-zod for database schema and validation
- Zod for runtime type validation

### Build & Development
- Vite with React plugin
- esbuild for production server bundling
- Replit-specific plugins for development (error overlay, cartographer, dev banner)

### Database (Configured)
- PostgreSQL via `DATABASE_URL` environment variable
- connect-pg-simple for session storage capability
- Drizzle Kit for migrations (`db:push` script available)