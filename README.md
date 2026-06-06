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
| GET | `/api/contacts/[id]/timeline` | Fan activity timeline |
| POST | `/api/messages` | Create message |
| POST | `/api/notes` | Add note |
| POST / DELETE | `/api/tags` | Add / remove tag |
| GET | `/api/stats` | Dashboard stats |
| GET | `/api/revenue` | Monthly revenue + top spenders |
| GET | `/api/analytics` | Fan analytics overview |
| GET | `/api/followups` | Follow-up smart lists |
| GET | `/api/purchases/ppv` | PPV stats |
| GET | `/api/broadcasts` | Broadcast history |
| POST | `/api/broadcasts` | Send manual broadcast |
| POST | `/api/broadcasts/audience` | Preview broadcast audience |
| GET | `/api/reengagement/audiences` | Re-engagement audience counts per segment |
| POST | `/api/reengagement/send` | Send re-engagement campaign |

## Scripts

```bash
npm run dev      # Development server
npm run build    # Production build
npm run start    # Production server
npm run db:seed  # Seed database
npm run lint     # ESLint
```
