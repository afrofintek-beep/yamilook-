import { uiText } from '@/i18n/ui-copy';
/**
 * YAMILOOK AFRICAN REACTION SYSTEM
 * ============================================================================
 *
 * DESIGN PRINCIPLES:
 * - Emotions have meaning, not color.
 * - Culture over generic emoji behavior.
 * - Calm, dignified, non-aggressive visual language.
 * - No popularity or like-based scoring.
 * - Reactions communicate intent, not engagement pressure.
 *
 * VISUAL HIERARCHY (Priority Order):
 * 1. Sankofa Love (highest)
 * 2. Ubuntu
 * 3. Djembe
 * 4. Shango
 * 5. Eish (lowest)
 *
 * UI RULES:
 * - No gradients.
 * - No flashing or looping animations.
 * - Hover/Active: +10% brightness only.
 * - Reaction name shown on long-press or hover.
 *
 * ACCESSIBILITY:
 * - Reactions must not rely solely on color.
 * - Meaning always visible via label.
 * ============================================================================
 */

export type AfricanReactionType = 'sankofa' | 'ubuntu' | 'djembe' | 'shango' | 'eish';

export interface AfricanReaction {
  type: AfricanReactionType;
  icon: string;
  label: string;
  meaning: string;
  emotionType: string;
  priority: number;
  usage: string;
}

/**
 * OFFICIAL YAMILOOK AFRICAN REACTION SET
 *
 * FINAL ICONS (Cultural symbols - DO NOT REPLACE):
 * - 💛 Sankofa Love
 * - 🤝🏾 Ubuntu (skin tone intentional)
 * - 🪘 Djembe
 * - 💢 Shango
 * - 😒 Eish
 */
export const AFRICAN_REACTIONS: AfricanReaction[] = [
  {
    type: 'sankofa',
    icon: '💛',
    get label() { return uiText("Sankofa Love"); },
    meaning: 'Love with memory and respect for what came before',
    emotionType: 'Positive / Foundational',
    priority: 1,
    usage: 'Default positive reaction. Highest visual priority. Used for appreciation, respect, shared memory.',
  },
  {
    type: 'ubuntu',
    icon: '🤝🏾',
    get label() { return uiText("Ubuntu"); },
    meaning: 'Solidarity and shared humanity ("I am because we are")',
    emotionType: 'Support / Empathy',
    priority: 2,
    usage: 'Supportive response. Agreement without excitement. Community validation.',
  },
  {
    type: 'djembe',
    icon: '🪘',
    get label() { return uiText("Djembe"); },
    meaning: 'Rhythm, celebration, collective energy',
    emotionType: 'Celebration / Movement',
    priority: 3,
    usage: 'Celebration, joy, events. Positive momentum and movement.',
  },
  {
    type: 'shango',
    icon: '💢',
    get label() { return uiText("Shango"); },
    meaning: 'Justified anger and moral indignation',
    emotionType: 'Alert / Justice',
    priority: 4,
    usage: 'Expresses injustice or serious concern. Must not be gamified or promoted. Not for hate or harassment.',
  },
  {
    type: 'eish',
    icon: '😒',
    get label() { return uiText("Eish"); },
    meaning: 'Honest exhaustion or dissatisfaction',
    emotionType: 'Discomfort / Fatigue',
    priority: 5,
    usage: 'Soft negative signal. Non-aggressive. Expresses weariness or disapproval.',
  },
];

/**
 * Get reaction by type
 */
export function getReaction(type: string): AfricanReaction | undefined {
  return AFRICAN_REACTIONS.find(r => r.type === type);
}

/**
 * Get reaction icon by type
 */
export function getReactionIcon(type: string | null): string {
  if (!type) return '💛'; // Default to Sankofa
  return getReaction(type)?.icon || '💛';
}

/**
 * Normalize stored reaction types into the official African set.
 * Supports both legacy types (like/love/wow/haha/sad/angry) and the new African types.
 */
export function normalizeReactionType(type: string | null): AfricanReactionType | null {
  if (!type) return null;

  // Direct African types
  if (['sankofa', 'ubuntu', 'djembe', 'shango', 'eish'].includes(type)) {
    return type as AfricanReactionType;
  }

  // Legacy -> African mapping
  const legacyMap: Record<string, AfricanReactionType> = {
    like: 'sankofa',
    love: 'sankofa',
    wow: 'djembe',
    haha: 'djembe',
    sad: 'eish',
    angry: 'shango',
  };

  return legacyMap[type] || null;
}

/**
 * Reaction counts interface
 */
export interface ReactionCounts {
  sankofa: number;
  ubuntu: number;
  djembe: number;
  shango: number;
  eish: number;
}

/**
 * Calculate total reactions from counts
 */
export function getTotalReactions(counts: Partial<ReactionCounts>): number {
  return Object.values(counts).reduce((sum, count) => sum + (count || 0), 0);
}

/**
 * Get top reactions sorted by visual hierarchy
 */
export function getTopReactions(
  counts: Partial<ReactionCounts>,
  limit = 3
): Array<{ type: AfricanReactionType; count: number; reaction: AfricanReaction }> {
  return Object.entries(counts)
    .filter(([_, count]) => (count || 0) > 0)
    .map(([type, count]) => {
      const reaction = getReaction(type);
      return { type: type as AfricanReactionType, count: count || 0, reaction: reaction! };
    })
    .filter(r => r.reaction)
    .sort((a, b) => a.reaction.priority - b.reaction.priority)
    .slice(0, limit);
}

/**
 * Create empty reaction counts
 */
export function createEmptyReactionCounts(): ReactionCounts {
  return {
    sankofa: 0,
    ubuntu: 0,
    djembe: 0,
    shango: 0,
    eish: 0,
  };
}
