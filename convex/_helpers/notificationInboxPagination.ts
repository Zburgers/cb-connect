export const MAX_INBOX_CURSOR_LENGTH = 16_384;
export const MAX_BUFFERED_INBOX_ITEMS = 250;
export const INBOX_CURSOR_PREFIX = "cb-connect-inbox-v1:";

export type InboxCursorState = {
  cursor: string | null;
  bufferedItemIds: string[];
  sourceDone: boolean;
};

export function decodeInboxCursor(cursor: string | null): InboxCursorState {
  if (cursor === null) {
    return { cursor: null, bufferedItemIds: [], sourceDone: false };
  }
  if (!cursor.startsWith(INBOX_CURSOR_PREFIX)) {
    return { cursor, bufferedItemIds: [], sourceDone: false };
  }
  try {
    const value: unknown = JSON.parse(cursor.slice(INBOX_CURSOR_PREFIX.length));
    if (
      typeof value !== "object" ||
      value === null ||
      !("cursor" in value) ||
      (value.cursor !== null && typeof value.cursor !== "string") ||
      !("bufferedItemIds" in value) ||
      !Array.isArray(value.bufferedItemIds) ||
      value.bufferedItemIds.length > MAX_BUFFERED_INBOX_ITEMS ||
      !value.bufferedItemIds.every((id) => typeof id === "string") ||
      new Set(value.bufferedItemIds).size !== value.bufferedItemIds.length ||
      !("sourceDone" in value) ||
      typeof value.sourceDone !== "boolean"
    ) {
      throw new Error("Invalid cursor shape");
    }
    return {
      cursor: value.cursor,
      bufferedItemIds: value.bufferedItemIds,
      sourceDone: value.sourceDone,
    };
  } catch {
    throw new Error("Notification inbox cursor is invalid");
  }
}

export function encodeInboxCursor(state: InboxCursorState): string {
  const cursor = `${INBOX_CURSOR_PREFIX}${JSON.stringify(state)}`;
  if (cursor.length > MAX_INBOX_CURSOR_LENGTH) {
    throw new Error("Notification inbox cursor exceeds its fixed bound");
  }
  return cursor;
}

export function makeInboxSplitCursors(
  splitCursor: string,
  continueCursor: string,
  sourceDone: boolean,
) {
  return {
    splitCursor: encodeInboxCursor({
      cursor: splitCursor,
      bufferedItemIds: [],
      sourceDone: false,
    }),
    continueCursor: encodeInboxCursor({
      cursor: continueCursor,
      bufferedItemIds: [],
      sourceDone,
    }),
  };
}
