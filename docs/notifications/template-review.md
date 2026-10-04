# G4 in-app template review

## Contract and exposure boundary

`renderFrozen` returns only the frozen identity (`templateVersion`, `locale`, `variableSchemaVersion`, and a SHA-256 hash) and the allowlisted `{ titleKey, bodyKey, route }` payload. It accepts no variables. The hash is over the canonical static payload only; locale, source data, recipients, health values, and caller input are not hashed or copied into it.

The renderer has no delivery side effects. Gate 4 remains in-app-only and default-off. This review does not enable any feature flag or add an external preview/provider path.

## Neutral relationship/account copy

These fixed English strings were reviewed in this task for neutral, role-safe wording and the absence of interpolation. Product/content approval is still pending before user exposure; this document does not claim that approval.

| Event | Title key / fixed preview | Body key / fixed preview | Route | Data kept out of copy |
|---|---|---|---|---|
| `partner_linked.v1` | `g4.partner_linked.title` — “Connection update” | `g4.partner_linked.body` — “Review your connection settings.” | `settings` | Names, identity, health state, or link details |
| `partner_message.v1` | `g4.partner_message.title` — “Message activity” | `g4.partner_message.body` — “Open messages to view current chat activity.” | `messages` | Sender, message text, preview, or timestamps |
| `partner_nudge.v1` | `g4.partner_nudge.title` — “A nudge is ready” | `g4.partner_nudge.body` — “Open messages to see the nudge.” | `messages` | Emoji, sender, or message text |
| `partner_chat_cleared.v1` | `g4.partner_chat_cleared.title` — “Chat updated” | `g4.partner_chat_cleared.body` — “Open messages to see the current chat state.” | `messages` | Cleared content, sender, or recipient identity |
| `connected_since_updated.v1` | `g4.connected_since_updated.title` — “Connection setting updated” | `g4.connected_since_updated.body` — “Review settings for the current details.” | `settings` | Dates, names, or relationship history |

The copy is static in-app text. No event payload, caller string, health fact, user text, or external destination is substituted into it.

## Health-adjacent templates

All primary-private health and inferred-health catalog entries, including Late, are marked `blocked_d011` in both immutable template versions. They have no renderable title key, body key, or route, and `renderFrozen` rejects them. No health/Late copy or approval is included here. D-011 content review is required before that status can change.

## Versioning and retry behavior

`g4-static-v1` and `g4-static-v2` are separate immutable render identities with the same current safe key mapping. A retry supplied the original version, locale, and variable-schema version reproduces the same keys, route, and payload hash after a newer version is available. Locale and variable-schema changes alter render identity; the payload hash changes only when the canonical static keys or route change.
