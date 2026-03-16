# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (port 8080)
│   └── beija-flor/         # Expo mobile app (Grupo Beija-flor)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
└── scripts/                # Utility scripts
```

## Beija-flor Mobile App

Internal social network for Grupo Beija-flor employees.

### Credentials
- Master admin: `admin@beijaflor.com` / `admin123`

### Features
- **Auth**: Login + 3-step onboarding (photo, manual reading, terms acceptance)
- **Feed**: Facebook-style main feed with likes and comments
- **Channels**: Tag-filtered channel feeds (marketing, adm, socio, posto, churrascaria, gerente)
- **Internal Communication**: Restricted posting channel
- **Birthdays**: Upcoming birthday list (60 days)
- **Tickets**: Support ticket system with chat
- **Profile**: User profiles with avatar upload
- **Admin Panel**: User management, email allowlist, channel CRUD, ticket handlers, reports

### Roles
- `user` – regular employee
- `moderator` – can delete any comment
- `admin` – full admin access (cannot edit master_admin)
- `master_admin` – super admin, cannot be edited by regular admins

### Tags
`marketing`, `adm`, `socio`, `posto`, `churrascaria`, `gerente`

### App Screens
- `app/login.tsx` – login screen
- `app/onboarding.tsx` – 3-step onboarding
- `app/(tabs)/index.tsx` – feed
- `app/(tabs)/channels.tsx` – channel list
- `app/(tabs)/birthdays.tsx` – birthday list
- `app/(tabs)/tickets.tsx` – ticket list
- `app/(tabs)/profile.tsx` – own profile
- `app/channel/[id].tsx` – channel detail + post
- `app/channel/create-post.tsx` – new post modal
- `app/post/[id].tsx` – post detail + comments
- `app/ticket/[id].tsx` – ticket chat
- `app/new-ticket.tsx` – new ticket modal
- `app/profile/[id].tsx` – view other user profile
- `app/admin/index.tsx` – admin panel home
- `app/admin/users.tsx` – user management
- `app/admin/emails.tsx` – email allowlist
- `app/admin/channels.tsx` – channel CRUD
- `app/admin/reports.tsx` – reported comments
- `app/admin/ticket-handlers.tsx` – ticket handler management

### Key Files
- `context/AuthContext.tsx` – auth state, login/logout
- `lib/api.ts` – HTTP client (token via AsyncStorage)
- `constants/colors.ts` – brand colors (green `#006B3F`, gold `#FFD700`)
- `components/PostCard.tsx` – feed post card with likes
- `components/ErrorBoundary.tsx` – error boundary

### Auth Implementation
- Token = user ID (integer) stored in AsyncStorage as `auth_token`
- Password hashing: `simpleHash` (XOR-based, not bcrypt)
- Auth check: `GET /api/auth/me` with `Authorization: Bearer <token>`

## API Server

Base URL: `/api` (proxied from Expo to port 8080)

### Routes
- `POST /auth/login` – login
- `GET /auth/me` – get current user
- `POST /auth/complete-onboarding` – complete onboarding
- `GET /users` – list users (admin only)
- `GET /users/:id` – get user
- `PATCH /users/:id` – update user (admin only)
- `POST /users/:id/avatar` – update avatar
- `GET /users/admin/allowed-emails` – list allowed emails
- `POST /users/admin/allowed-emails` – add allowed email
- `DELETE /users/admin/allowed-emails/:id` – remove allowed email
- `GET /channels` – list channels (filtered by user tag)
- `POST /channels` – create channel (admin)
- `GET /channels/:id` – channel detail
- `PATCH /channels/:id` – update channel (admin)
- `DELETE /channels/:id` – delete channel (admin)
- `GET /channels/:id/can-post` – check if user can post
- `GET /posts` – list posts (with channelId filter)
- `POST /posts` – create post
- `GET /posts/:id` – post detail
- `DELETE /posts/:id` – delete post
- `POST /posts/:id/like` – toggle like
- `GET /posts/:id/comments` – get comments
- `POST /posts/:id/comments` – add comment
- `DELETE /posts/comments/:id` – delete comment
- `POST /posts/comments/:id/report` – report comment
- `GET /posts/reports/all` – all reports (admin)
- `GET /tickets` – list tickets
- `POST /tickets` – create ticket
- `GET /tickets/:id` – ticket detail
- `PATCH /tickets/:id` – update ticket status
- `GET /tickets/:id/messages` – ticket messages
- `POST /tickets/:id/messages` – send message
- `GET /tickets/admin/handlers` – list ticket handlers
- `POST /tickets/admin/handlers` – add handler
- `DELETE /tickets/admin/handlers/:userId` – remove handler
- `GET /birthdays` – upcoming birthdays

## Database (PostgreSQL + Drizzle)

Tables: `users`, `allowed_emails`, `channels`, `channel_allowed_posters`, `posts`, `post_likes`, `comments`, `comment_reports`, `tickets`, `ticket_messages`, `ticket_handlers`

Seeded channels: Geral, Comunicação Interna, Marketing, Administrativo, Posto, Churrascaria, Gerência
