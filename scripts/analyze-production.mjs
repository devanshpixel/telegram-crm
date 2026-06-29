#!/usr/bin/env node
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '../data/crm.db');

const db = new Database(dbPath, { readonly: true });

// Get last 100 outgoing messages
const messages = db.prepare(`
  SELECT m.text, m.created_at, c.name
  FROM messages m
  JOIN conversations conv ON conv.id = m.conversation_id
  JOIN contacts c ON c.id = conv.contact_id
  WHERE m.direction = 'outgoing'
  ORDER BY m.created_at DESC
  LIMIT 100
`).all();

console.log(`Analyzing ${messages.length} production messages...\n`);

// Extract patterns
const openings = [];
const emojis = [];
const phrases = [];
const endings = [];

messages.forEach(msg => {
  const text = msg.text.trim();
  if (!text) return;

  // Opening word (first 1-3 words)
  const words = text.split(/\s+/);
  const opening = words.slice(0, Math.min(3, words.length)).join(' ').toLowerCase();
  openings.push(opening);

  // Emojis
  const emojiMatches = text.match(/[\p{Emoji}]/gu);
  if (emojiMatches) {
    emojiMatches.forEach(e => emojis.push(e));
  }

  // Common phrases (3+ words)
  const lowerText = text.toLowerCase();
  const triGrams = [];
  for (let i = 0; i < words.length - 2; i++) {
    const phrase = words.slice(i, i + 3).join(' ').toLowerCase();
    if (phrase.length > 8) triGrams.push(phrase);
  }
  phrases.push(...triGrams);

  // Ending (last 1-3 words)
  const ending = words.slice(-Math.min(3, words.length)).join(' ').toLowerCase();
  endings.push(ending);
});

function findRepeats(arr, threshold = 3) {
  const counts = {};
  arr.forEach(item => {
    counts[item] = (counts[item] || 0) + 1;
  });
  return Object.entries(counts)
    .filter(([_, count]) => count >= threshold)
    .sort((a, b) => b[1] - a[1])
    .map(([item, count]) => ({ item, count, pct: ((count / arr.length) * 100).toFixed(1) }));
}

console.log('=== REPEATED OPENINGS (3+ times) ===');
const repeatOpenings = findRepeats(openings);
repeatOpenings.forEach(r => console.log(`${r.count}x (${r.pct}%) — "${r.item}"`));

console.log('\n=== REPEATED EMOJIS (5+ times) ===');
const repeatEmojis = findRepeats(emojis, 5);
repeatEmojis.forEach(r => console.log(`${r.count}x (${r.pct}%) — ${r.item}`));

console.log('\n=== REPEATED PHRASES (3+ times) ===');
const repeatPhrases = findRepeats(phrases);
repeatPhrases.slice(0, 30).forEach(r => console.log(`${r.count}x (${r.pct}%) — "${r.item}"`));

console.log('\n=== REPEATED ENDINGS (3+ times) ===');
const repeatEndings = findRepeats(endings);
repeatEndings.forEach(r => console.log(`${r.count}x (${r.pct}%) — "${r.item}"`));

db.close();
