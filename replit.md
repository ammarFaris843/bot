# Star Rail Wordle

## Overview
A Honkai: Star Rail themed Wordle game with a Discord bot integration and a web-based admin dashboard. The admin panel allows managing daily words, viewing leaderboards, and monitoring game stats.

## Project Architecture
- **Frontend**: React 18 with TypeScript, Vite, Tailwind CSS, shadcn/ui components
- **Backend**: Express 5 (TypeScript) serving both API and frontend
- **Database**: PostgreSQL with Drizzle ORM
- **Bot**: Discord.js bot for gameplay via Discord slash commands
- **Monorepo structure**: `client/`, `server/`, `shared/`

## Key Files
- `server/index.ts` - Express server entry point (serves on port 5000)
- `server/routes.ts` - API routes for daily words and stats
- `server/bot.ts` - Discord bot logic
- `server/storage.ts` - Database storage layer
- `shared/schema.ts` - Drizzle schema (dailyWords, userStats tables)
- `shared/routes.ts` - Shared API route definitions with Zod schemas
- `client/src/pages/dashboard.tsx` - Main admin dashboard page
- `vite.config.ts` - Vite configuration
- `drizzle.config.ts` - Drizzle Kit configuration

## Scripts
- `npm run dev` - Development server with hot reload
- `npm run build` - Production build (client + server)
- `npm run start` - Production server
- `npm run db:push` - Push schema changes to database

## Environment
- `DATABASE_URL` - PostgreSQL connection string (auto-provisioned)
- `DISCORD_TOKEN` - Optional Discord bot token

## Recent Changes
- 2026-02-18: Initial Replit setup, fixed shared schema to include userStats table, added missing hooks (useTodayWord, useDeleteDailyWord), installed animejs dependency, configured allowedHosts for Replit proxy
