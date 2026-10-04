"use client";

import { useMutation, usePaginatedQuery, useConvexAuth } from "convex/react";
import Link from "next/link";
import { Component, useState } from "react";
import type { ReactNode } from "react";

import { api } from "@/convex/_generated/api";
import {
  notificationTemplateCatalog,
  notificationTemplateVersions,
  type NotificationTemplateVersion,
} from "@/convex/_helpers/notificationTemplates";
import type { NotificationEventType } from "@/convex/_helpers/notificationTypes";

type SafeNotificationCopy = {
  title: string;
  body: string;
  href: string;
  linkLabel: string;
};

const safeCopyByTitleKey = {
  "g4.partner_linked.title": {
    bodyKey: "g4.partner_linked.body",
    title: "Connection update",
    body: "Review your connection settings.",
  },
  "g4.partner_message.title": {
    bodyKey: "g4.partner_message.body",
    title: "Message activity",
    body: "Open messages to view current chat activity.",
  },
  "g4.partner_nudge.title": {
    bodyKey: "g4.partner_nudge.body",
    title: "A nudge is ready",
    body: "Open messages to see the nudge.",
  },
  "g4.partner_chat_cleared.title": {
    bodyKey: "g4.partner_chat_cleared.body",
    title: "Chat updated",
    body: "Open messages to see the current chat state.",
  },
  "g4.connected_since_updated.title": {
    bodyKey: "g4.connected_since_updated.body",
    title: "Connection setting updated",
    body: "Review settings for the current details.",
  },
} satisfies Record<
  string,
  { bodyKey: string; title: string; body: string }
>;

function isTemplateVersion(value: string): value is NotificationTemplateVersion {
  return (notificationTemplateVersions as readonly string[]).includes(value);
}

function safeCopyForItem(
  eventType: NotificationEventType,
  templateVersion: string,
): SafeNotificationCopy | null {
  if (!isTemplateVersion(templateVersion)) return null;
  const template = notificationTemplateCatalog[templateVersion][eventType];
  if (!template || template.status !== "renderable") return null;

  const copy =
    safeCopyByTitleKey[
      template.titleKey as keyof typeof safeCopyByTitleKey
    ];
  if (!copy || template.bodyKey !== copy.bodyKey) return null;

  const destination =
    template.route === "settings"
      ? { href: "/dashboard/settings", linkLabel: "Open settings" }
      : template.route === "messages"
        ? { href: "/dashboard/partner", linkLabel: "Open messages" }
        : null;
  if (!destination) return null;
  return { ...copy, ...destination };
}

class InboxErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <p className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-glass)] p-5 text-sm text-foreground" role="status">
          Your inbox is unavailable right now.
        </p>
      );
    }

    return this.props.children;
  }
}

function InboxContent() {
  const { isLoading: isAuthLoading, isAuthenticated } = useConvexAuth();
  const { results, status, loadMore } = usePaginatedQuery(
    api.queries.notifications.getMyInbox,
    isAuthenticated ? {} : "skip",
    { initialNumItems: 20 },
  );
  const markItemRead = useMutation(
    api.mutations.notifications.markMyInboxItemRead,
  );
  const dismissItem = useMutation(
    api.mutations.notifications.dismissMyInboxItem,
  );
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [actionError, setActionError] = useState(false);

  if (isAuthLoading) {
    return (
      <p className="py-8 text-sm text-foreground/70" role="status" aria-live="polite">
        Loading your inbox…
      </p>
    );
  }

  if (!isAuthenticated) {
    return (
      <p className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-glass)] p-5 text-sm text-foreground" role="status">
        Sign in to view your inbox.
      </p>
    );
  }

  if (status === "LoadingFirstPage" && results === undefined) {
    return (
      <p className="py-8 text-sm text-foreground/70" role="status" aria-live="polite">
        Loading your inbox…
      </p>
    );
  }

  const items = (results ?? []).flatMap((item) => {
    const copy = safeCopyForItem(item.eventType, item.templateVersion);
    return copy ? [{ ...item, copy }] : [];
  });

  async function runItemAction(
    itemId: (typeof items)[number]["itemId"],
    action: () => Promise<null>,
  ) {
    setBusyItem(String(itemId));
    setActionError(false);
    try {
      await action();
    } catch {
      // Keep backend and source details out of the rendered UI and browser logs.
      setActionError(true);
    } finally {
      setBusyItem(null);
    }
  }

  return (
    <div className="space-y-5">
      {actionError && (
        <p className="text-sm text-foreground" role="alert">
          That inbox action could not be saved. Please try again.
        </p>
      )}

      {items.length === 0 ? (
        <p className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-glass)] p-5 text-sm text-foreground" role="status" aria-live="polite">
          You're all caught up.
        </p>
      ) : (
        <ul aria-label="Current notifications" className="space-y-3">
          {items.map((item) => {
            const isBusy = busyItem === String(item.itemId);
            const isRead = item.readAt !== undefined;

            return (
              <li key={item.itemId}>
                <article className="rounded-3xl border border-[var(--color-glass-border)] bg-[var(--color-glass)] p-4 text-foreground shadow-sm sm:p-5">
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${isRead ? "bg-foreground/25" : "bg-primary"}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <h2 className="text-base font-semibold leading-6 text-foreground">
                          {item.copy.title}
                        </h2>
                        <span className="text-xs font-medium text-foreground/70">
                          {isRead ? "Read" : "Unread"}
                        </span>
                      </div>
                      <p
                        className="mt-1 text-sm leading-6 text-foreground/80"
                        data-notification-body
                      >
                        {item.copy.body}
                      </p>

                      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                        <Link
                          href={item.copy.href}
                          className="inline-flex min-h-11 items-center justify-center rounded-full border border-foreground/15 px-4 text-sm font-semibold text-foreground outline-none transition-colors hover:bg-[var(--color-glass-2)] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        >
                          {item.copy.linkLabel}
                        </Link>
                        {!isRead && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              void runItemAction(item.itemId, () =>
                                markItemRead({ itemId: item.itemId }),
                              )
                            }
                            className="min-h-11 rounded-full px-4 text-sm font-semibold text-foreground outline-none transition-colors hover:bg-[var(--color-glass-2)] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
                          >
                            Mark as read
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            void runItemAction(item.itemId, () =>
                              dismissItem({ itemId: item.itemId }),
                            )
                          }
                          className="min-h-11 rounded-full px-4 text-sm font-semibold text-foreground/75 outline-none transition-colors hover:bg-[var(--color-glass-2)] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      {status === "CanLoadMore" && (
        <button
          type="button"
          onClick={() => loadMore(20)}
          className="min-h-11 w-full rounded-full border border-foreground/15 bg-[var(--color-glass)] px-4 text-sm font-semibold text-foreground outline-none transition-colors hover:bg-[var(--color-glass-2)] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          Load more notifications
        </button>
      )}
      {status === "LoadingMore" && (
        <p className="py-2 text-center text-sm text-foreground/70" role="status" aria-live="polite">
          Loading more notifications…
        </p>
      )}
    </div>
  );
}

export default function NotificationInbox() {
  return (
    <section aria-labelledby="notification-inbox-title" className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Your space
        </p>
        <h1
          id="notification-inbox-title"
          className="mt-2 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
        >
          Notification inbox
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/70">
          Updates addressed to your account appear here.
        </p>
      </div>

      <InboxErrorBoundary>
        <InboxContent />
      </InboxErrorBoundary>
    </section>
  );
}
