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
- **Auth**: Login + 6-step onboarding (photo, personal data with masks, company values, documents, image term accept/refuse, summary)
- **Feed**: Facebook-style main feed with 7 horizontal scrollable sub-tabs: Feed (Todos) | Destaques | Comunicação | Fotos | Vídeos | Salvos | Aniversários; search bar toggle, sort by Recentes/Populares, "Publicar" FAB
- **PostCard**: Multi-media gallery (grid/swipe), save/bookmark toggle, share/repost button with embed, pinned/official/highlighted ribbon badges, admin pin+highlight actions, report post
- **Composer (Enhanced)**: Multi-image picker (up to 6 images), video picker, category selector (8 categories), "Oficial" toggle for admins, mention autocomplete
- **Profile Pages**: Banner with user-colored header, avatar overlapping banner, stats row (posts/curtidas/comentários), sub-tabs Linha do Tempo | Fotos | Vídeos
- **Gamification**: Points engine (likes 5pts, comments 10pts, doc_read 15pts, doc_sign 20pts), leaderboards, anti-spam (daily limits, cooldown, min chars, blocked terms, max comments per post)
- **Ranking Tab**: Active leaderboard with top-3 podium, full ranking, personal stats, action history
- **Channels**: Tag-filtered channel feeds (marketing, adm, socio, posto, churrascaria, gerente)
- **Internal Communication**: Restricted posting channel (Comunicação tab)
- **Birthdays**: Upcoming birthday list with Hoje/Próximos sub-tabs
- **Tickets**: Support ticket system with chat
- **Admin Panel**: User management, invite management with status/resend/cancel, channel CRUD, ticket handlers, reports, gamification panel, signatures & terms panel (admin/signatures.tsx)
- **Signatures Panel**: 3 tabs — document signatures (with CSV export), image term choices (accept/refuse), company values confirmations
- **DB extras**: postMediaTable, savedPostsTable, postSharesTable, postReportsTable; posts now have isPinned, isHighlighted, isOfficial, category, shareCount, saveCount, sharedFromId; users now have cpf, phone, sector, unit, position, imageTermAccepted; onboardingStepsTable, documentSignaturesTable, companyValuesConfirmationsTable, imageTermChoicesTable

### Roles
- `user` – regular employee
- `moderator` – can delete any comment
- `admin` – full admin access (cannot edit master_admin)
- `master_admin` – super admin, cannot be edited by regular admins

### Tags
`marketing`, `adm`, `socio`, `posto`, `churrascaria`, `gerente`

### App Screens
- `app/login.tsx` – login screen
- `app/onboarding.tsx` – 6-step onboarding (photo, personal data, company values, documents, image term, summary)
- `app/(tabs)/index.tsx` – feed with DM icon, channel unread dots, notification bell
- `app/(tabs)/channels.tsx` – channel list
- `app/(tabs)/birthdays.tsx` – birthday list
- `app/(tabs)/tickets.tsx` – ticket list (badge shows unread count)
- `app/(tabs)/profile.tsx` – own profile
- `app/channel/[id].tsx` – channel detail + post
- `app/channel/create-post.tsx` – new post modal
- `app/post/[id].tsx` – post detail + comments
- `app/ticket/[id].tsx` – ticket chat (marks read on open)
- `app/new-ticket.tsx` – new ticket modal
- `app/profile/[id].tsx` – personal timeline + DM button + posts list
- `app/messages.tsx` – DM conversations list
- `app/messages/[convId].tsx` – DM chat screen
- `app/messages/with/[userId].tsx` – open/create DM with a user (redirect to convId)
- `app/admin/index.tsx` – admin panel home
- `app/admin/users.tsx` – user management + invite management (status, resend, cancel)
- `app/admin/signatures.tsx` – signatures panel (document sigs, image terms, values confirmations + CSV export)
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
- `GET /channels/unread-ids` – channels with unread posts for current user
- `POST /channels/:id/read` – mark channel as read
- `GET /posts` – list posts (with channelId filter)
- `POST /posts` – create post (accepts optional targetUserId for wall posts)
- `GET /posts/timeline/:userId` – posts authored by or about a user
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
- `GET /tickets/unread-count` – unread ticket count for current user
- `POST /tickets/:id/read` – mark ticket as read
- `GET /tickets/admin/handlers` – list ticket handlers
- `POST /tickets/admin/handlers` – add handler
- `DELETE /tickets/admin/handlers/:userId` – remove handler
- `GET /dms` – list DM conversations
- `GET /dms/unread-count` – unread DM message count
- `GET /dms/with/:userId` – get or create conversation with user
- `GET /dms/:convId/messages` – messages in a conversation
- `POST /dms/:convId/messages` – send a DM
- `POST /dms/:convId/read` – mark DMs as read
- `GET /birthdays` – upcoming birthdays

## Database (PostgreSQL + Drizzle)

Tables: `users`, `allowed_emails`, `channels`, `channel_allowed_posters`, `posts` (with `target_user_id` for wall posts), `post_likes`, `comments`, `comment_reports`, `tickets`, `ticket_messages`, `ticket_handlers`, `ticket_reads`, `channel_reads`, `dm_conversations`, `dm_messages`

Seeded channels: Geral, Comunicação Interna, Marketing, Administrativo, Posto, Churrascaria, Gerência
