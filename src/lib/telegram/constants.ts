// Timing constants (milliseconds)
export const TIMING = {
  REPLY_DELAY_MIN_FAST: 2000,
  REPLY_DELAY_MAX_FAST: 8000,
  REPLY_DELAY_MIN_MEDIUM: 20000,
  REPLY_DELAY_MAX_MEDIUM: 90000,
  REPLY_DELAY_MIN_SLOW: 180000,
  REPLY_DELAY_MAX_SLOW: 600000,
  REPLY_DELAY_MIN_VERY_SLOW: 1800000,
  REPLY_DELAY_MAX_VERY_SLOW: 3600000,
  REPLY_DELAY_MIN_EXTREMELY_SLOW: 3600000,
  REPLY_DELAY_MAX_EXTREMELY_SLOW: 10800000,
  REPLY_DELAY_MIN_HOURS: 3600000,
  REPLY_DELAY_MAX_HOURS: 18000000,
  MULTI_MESSAGE_GAP_MIN: 500,
  MULTI_MESSAGE_GAP_MAX: 3000,
} as const;

// Intent score thresholds
export const INTENT_THRESHOLD = {
  VERY_LOW: 20,
  LOW: 30,
  MEDIUM: 40,
  HIGH: 60,
  VERY_HIGH: 70,
} as const;

// Emotional temperature thresholds
export const EMOTIONAL_TEMP = {
  COLD: 30,
  WARM: 40,
  HOT: 60,
  VERY_HOT: 70,
} as const;

// Offer settings
export const OFFER = {
  DEFAULT_PRICE: 49,
  COOLDOWN_DAYS: 7,
  EXPIRY_DAYS: 7,
  MAX_LOCKED_RESPONSES: 6,
} as const;

// Segment locked response intervals (hours)
export const SEGMENT_INTERVALS = {
  prospect: 12,
  buyer: 18,
  premium: 24,
  high_value: 36,
  vip: 48,
  whale: 72,
  default: 24,
} as const;

// Message processing
export const MESSAGE = {
  RECENT_COUNT: 20,
  TOPIC_MAX_LENGTH: 60,
  SHORT_MESSAGE_LENGTH: 30,
  SPLIT_CHANCE: 0.10,
} as const;

// Pacing
export const PACING = {
  MIN_REPLY_INTERVAL_MINUTES: 5,
} as const;
