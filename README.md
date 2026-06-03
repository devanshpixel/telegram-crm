# Telegram CRM Dashboard

A local-first CRM inbox UI with SQLite storage. Built with **Next.js 15**, **TypeScript**, and **Tailwind CSS**.

## Setup

```bash
npm install
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database

- SQLite file: `data/crm.db`
- Tables: `contacts`, `conversations`, `messages`, `tags`, `notes`
- Seed: `npm run db:seed` (skips if data already exists; delete `data/crm.db` to re-seed)

## API routes

| Method | Route | Action |
|--------|-------|--------|
| GET | `/api/contacts` | List chats |
| POST | `/api/contacts` | Create contact |
| GET/PATCH/DELETE | `/api/contacts/[id]` | Read / update / delete contact |
| GET | `/api/contacts/[id]/messages` | List messages |
| POST | `/api/messages` | Create message |
| POST | `/api/notes` | Add note |
| POST | `/api/tags` | Add tag |
| GET | `/api/stats` | Dashboard stats |

## Scripts

```bash
npm run dev      # Development server
npm run build    # Production build
npm run start    # Production server
npm run db:seed  # Seed database
npm run lint     # ESLint
```
