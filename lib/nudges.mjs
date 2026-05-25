export const NUDGE_EMOJIS = ["💗", "🤗", "☕", "🌙", "✨", "🫶"];

const NUDGE_MESSAGES = {
  "💗": "Thinking of you",
  "🤗": "Sending a soft hug",
  "☕": "A small comfort check-in",
  "🌙": "Let us keep tonight gentle",
  "✨": "You have my attention",
  "🫶": "I am here with you",
};

export function isNudgeEmoji(emoji) {
  return NUDGE_EMOJIS.includes(emoji);
}

export function getNudgeMessage(emoji) {
  return NUDGE_MESSAGES[emoji] ?? "A gentle nudge";
}
