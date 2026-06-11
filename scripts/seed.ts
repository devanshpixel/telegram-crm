import { nowIso } from "../lib/db/index";
import { createRawBetterSqlite3 } from "../lib/db/adapters";
import path from "path";

const DB_PATH =
  process.env.NODE_ENV === "production"
    ? "/tmp/crm.db"
    : path.join(process.cwd(), "data", "crm.db");

const db = createRawBetterSqlite3(DB_PATH);

const existing = (
  db.prepare("SELECT COUNT(*) AS count FROM contacts").get() as { count: number }
).count;

if (existing > 0) {
  console.log(`Database already has ${existing} contacts. Skipping seed.`);
  console.log("To re-seed, delete data/crm.db and run npm run db:seed again.");
  process.exit(0);
}

type SeedContact = {
  name: string;
  username: string;
  avatar: string;
  avatarColor: string;
  phone: string;
  email: string;
  company: string;
  location: string;
  joinedAt: string;
  revenue: number;
  revenueTrend: string;
  leadScore: number;
  leadStatus: string;
  isOnline: boolean;
  ppvCount: number;
  isPinned: boolean;
  unreadCount: number;
  tags: string[];
  notes: string;
  messages: { text: string; direction: "incoming" | "outgoing"; read?: boolean; hoursAgo: number }[];
};

const seeds: SeedContact[] = [
  {
    name: "Elena Vasquez",
    username: "@elena_v",
    avatar: "EV",
    avatarColor: "from-violet-500 to-purple-600",
    phone: "+1 (415) 555-0142",
    email: "elena@northwind.io",
    company: "Northwind Analytics",
    location: "San Francisco, CA",
    joinedAt: "Jan 12, 2025",
    revenue: 2480,
    revenueTrend: "up",
    leadScore: 92,
    leadStatus: "hot",
    isOnline: true,
    ppvCount: 14,
    isPinned: true,
    unreadCount: 3,
    tags: ["Whale", "VIP"],
    notes:
      "Top spender. Interested in custom bundle. Prefers evening replies. Demo scheduled Thursday.",
    messages: [
      { text: "Hey! Just saw your latest drop 🔥", direction: "incoming", hoursAgo: 4 },
      {
        text: "Thanks Elena! Glad you're enjoying it.",
        direction: "outgoing",
        read: true,
        hoursAgo: 3.5,
      },
      {
        text: "The behind-the-scenes bundle was amazing.",
        direction: "incoming",
        hoursAgo: 3,
      },
      {
        text: "Perfect — I have a VIP set dropping Friday.",
        direction: "outgoing",
        read: true,
        hoursAgo: 2.5,
      },
      { text: "Yes please! Send the link when it's live.", direction: "incoming", hoursAgo: 2 },
      {
        text: "Will do — you'll get it 2 hours before everyone else 💜",
        direction: "outgoing",
        read: true,
        hoursAgo: 1.5,
      },
      { text: "Can we schedule a demo for Thursday?", direction: "incoming", hoursAgo: 0.05 },
    ],
  },
  {
    name: "Marcus Chen",
    username: "@mchen_pro",
    avatar: "MC",
    avatarColor: "from-emerald-500 to-teal-600",
    phone: "+1 (206) 555-0198",
    email: "marcus@brightpath.co",
    company: "Brightpath Co.",
    location: "Seattle, WA",
    joinedAt: "Nov 3, 2024",
    revenue: 1260,
    revenueTrend: "flat",
    leadScore: 78,
    leadStatus: "warm",
    isOnline: true,
    ppvCount: 8,
    isPinned: false,
    unreadCount: 0,
    tags: ["Subscriber"],
    notes: "Reliable monthly subscriber. Upsell custom content in Q2.",
    messages: [
      {
        text: "Your renewal bundle is ready whenever you are.",
        direction: "outgoing",
        read: true,
        hoursAgo: 5,
      },
      { text: "Thanks — invoice received.", direction: "incoming", hoursAgo: 0.47 },
    ],
  },
  {
    name: "Sofia Andersson",
    username: "@sofia_a",
    avatar: "SA",
    avatarColor: "from-amber-500 to-orange-600",
    phone: "+46 70 555 12 34",
    email: "sofia@lumina.se",
    company: "Lumina Digital",
    location: "Stockholm, Sweden",
    joinedAt: "Feb 28, 2025",
    revenue: 840,
    revenueTrend: "up",
    leadScore: 85,
    leadStatus: "hot",
    isOnline: false,
    ppvCount: 5,
    isPinned: false,
    unreadCount: 1,
    tags: ["PPV Buyer"],
    notes: "Bought 3 PPVs this week. Send EU-friendly payment options.",
    messages: [
      { text: "Sending the contract draft now.", direction: "incoming", hoursAgo: 2 },
    ],
  },
  {
    name: "James Okonkwo",
    username: "@jokonkwo",
    avatar: "JO",
    avatarColor: "from-rose-500 to-pink-600",
    phone: "+1 (555) 000-0001",
    email: "james@example.com",
    company: "—",
    location: "Lagos, Nigeria",
    joinedAt: "Mar 1, 2025",
    revenue: 0,
    revenueTrend: "flat",
    leadScore: 34,
    leadStatus: "cold",
    isOnline: false,
    ppvCount: 0,
    isPinned: false,
    unreadCount: 0,
    tags: ["New Lead"],
    notes: "Cold outreach reply. Asked about pricing.",
    messages: [
      { text: "What's your enterprise pricing?", direction: "incoming", hoursAgo: 5 },
    ],
  },
  {
    name: "Priya Nair",
    username: "@priya_n",
    avatar: "PN",
    avatarColor: "from-cyan-500 to-blue-600",
    phone: "+1 (555) 000-0002",
    email: "priya@example.com",
    company: "—",
    location: "Mumbai, India",
    joinedAt: "Feb 10, 2025",
    revenue: 420,
    revenueTrend: "up",
    leadScore: 61,
    leadStatus: "warm",
    isOnline: true,
    ppvCount: 2,
    isPinned: false,
    unreadCount: 0,
    tags: ["Active"],
    notes: "Engaged but low spend. Try limited-time offer.",
    messages: [
      { text: "Loved the onboarding flow!", direction: "incoming", hoursAgo: 24 },
    ],
  },
  {
    name: "Alex Rivera",
    username: "@arivera",
    avatar: "AR",
    avatarColor: "from-indigo-500 to-violet-600",
    phone: "+1 (555) 000-0003",
    email: "alex@example.com",
    company: "—",
    location: "Austin, TX",
    joinedAt: "Jan 20, 2025",
    revenue: 1890,
    revenueTrend: "up",
    leadScore: 88,
    leadStatus: "hot",
    isOnline: false,
    ppvCount: 22,
    isPinned: false,
    unreadCount: 5,
    tags: ["Whale", "Returning"],
    notes: "High LTV. Returning after 2-week pause.",
    messages: [
      { text: "Following up on our call.", direction: "incoming", hoursAgo: 48 },
    ],
  },
  {
    name: "Nina Kowalski",
    username: "@ninak",
    avatar: "NK",
    avatarColor: "from-fuchsia-500 to-purple-600",
    phone: "+48 555 000 000",
    email: "nina@example.com",
    company: "—",
    location: "Warsaw, Poland",
    joinedAt: "Feb 15, 2025",
    revenue: 310,
    revenueTrend: "flat",
    leadScore: 55,
    leadStatus: "warm",
    isOnline: false,
    ppvCount: 1,
    isPinned: false,
    unreadCount: 0,
    tags: ["Trial"],
    notes: "Trial user — convert before expiry Friday.",
    messages: [
      { text: "Team approved the pilot.", direction: "incoming", hoursAgo: 72 },
    ],
  },
];

const insertContact = db.prepare(
  `INSERT INTO contacts (
    name, username, avatar, avatar_color, phone, email, company, location,
    joined_at, revenue, revenue_trend, lead_score, lead_status, is_online,
    ppv_count, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);

const insertConversation = db.prepare(
  `INSERT INTO conversations (
    contact_id, last_message, last_message_time, unread_count, is_pinned,
    created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
);

const insertMessage = db.prepare(
  `INSERT INTO messages (conversation_id, text, direction, is_read, created_at)
   VALUES (?, ?, ?, ?, ?)`,
);

const insertTag = db.prepare(
  `INSERT INTO tags (contact_id, name, created_at) VALUES (?, ?, ?)`,
);

const insertNote = db.prepare(
  `INSERT INTO notes (contact_id, content, created_at, updated_at) VALUES (?, ?, ?, ?)`,
);

const seedAll = db.transaction(() => {
  for (const seed of seeds) {
    const ts = nowIso();
    const contactResult = insertContact.run(
      seed.name,
      seed.username,
      seed.avatar,
      seed.avatarColor,
      seed.phone,
      seed.email,
      seed.company,
      seed.location,
      seed.joinedAt,
      seed.revenue,
      seed.revenueTrend,
      seed.leadScore,
      seed.leadStatus,
      seed.isOnline ? 1 : 0,
      seed.ppvCount,
      ts,
      ts,
    );

    const contactId = Number(contactResult.lastInsertRowid);
    const lastMsg = seed.messages[seed.messages.length - 1];
    const lastTime = new Date(
      Date.now() - lastMsg.hoursAgo * 60 * 60 * 1000,
    ).toISOString();

    const convResult = insertConversation.run(
      contactId,
      lastMsg.text,
      lastTime,
      seed.unreadCount,
      seed.isPinned ? 1 : 0,
      ts,
      ts,
    );

    const conversationId = Number(convResult.lastInsertRowid);

    for (const msg of seed.messages) {
      const msgTime = new Date(
        Date.now() - msg.hoursAgo * 60 * 60 * 1000,
      ).toISOString();
      insertMessage.run(
        conversationId,
        msg.text,
        msg.direction,
        msg.direction === "outgoing" && msg.read ? 1 : 0,
        msgTime,
      );
    }

    for (const tag of seed.tags) {
      insertTag.run(contactId, tag, ts);
    }

    if (seed.notes.trim()) {
      insertNote.run(contactId, seed.notes, ts, ts);
    }
  }
});

seedAll();
console.log(`Seeded ${seeds.length} contacts with conversations, messages, tags, and notes.`);
