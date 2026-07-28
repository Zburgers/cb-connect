"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, CheckCheck, Lock, MessageCircleHeart, MoreVertical, Send, SmilePlus, Trash2, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

const QUICK_EMOJIS = ["💗", "✨", "🫶", "😂", "🥺", "🌙"] as const;
const QUICK_LINES = [
  "Thinking of you.",
  "Want me to handle dinner?",
  "I am here. No pressure to explain.",
] as const;

interface PartnerChatProps {
  partnerName?: string | null;
  partnerImageUrl?: string | null;
  showLauncher?: boolean;
}

export default function PartnerChat({
  partnerName,
  partnerImageUrl,
  showLauncher = true,
}: PartnerChatProps) {
  const messages = useQuery(api.queries.messages.listForCouple, { limit: 80 });
  const unreadSummary = useQuery(api.queries.messages.unreadSummary, {});
  const sendMessage = useMutation(api.mutations.messages.send);
  const reactToMessage = useMutation(api.mutations.messages.react);
  const markDelivered = useMutation(api.mutations.messages.markDelivered);
  const markRead = useMutation(api.mutations.messages.markRead);
  const clearChat = useMutation(api.mutations.messages.clear);
  const [body, setBody] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [emojiTrayOpen, setEmojiTrayOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [messageMenuOpen, setMessageMenuOpen] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);
  const displayName = partnerName ?? "Partner";
  const acknowledgedRef = useRef(new Set<string>());

  useEffect(() => {
    if (isOpen) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages?.length, isOpen]);

  useEffect(() => {
    if (!messages) return;
    for (const message of messages) {
      if (!message.isMine && !acknowledgedRef.current.has(message._id)) {
        acknowledgedRef.current.add(message._id);
        void markDelivered({ messageId: message._id });
      }
    }
  }, [messages, markDelivered]);

  useEffect(() => {
    if (!isOpen || !messages) return;
    for (const message of messages) {
      if (!message.isMine && !message.readAt) void markRead({ messageId: message._id });
    }
  }, [isOpen, messages, markRead]);

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener("cbconnect:open-dm", handleOpen);
    return () => window.removeEventListener("cbconnect:open-dm", handleOpen);
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextBody = body.trim();
    if (!nextBody || isSending) return;

    setIsSending(true);
    setError("");
    try {
      await sendMessage({ body: nextBody });
      setBody("");
      setEmojiTrayOpen(false);
    } catch (err: any) {
      setError(err?.message ?? "Could not send message.");
    } finally {
      setIsSending(false);
    }
  };

  const handleClear = async () => {
    if (!confirm("Clear this couple chat for both partners?")) return;
    setError("");
    try {
      await clearChat();
      setMenuOpen(false);
    } catch (err: any) {
      setError(err?.message ?? "Could not clear chat.");
    }
  };

  const openThread = () => setIsOpen(true);

  return (
    <>
      {showLauncher && !isOpen && (
        <button
          type="button"
          onClick={openThread}
          className="fixed bottom-24 right-5 z-[60] grid h-16 w-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-2xl shadow-primary/30 press-feedback md:bottom-8 md:right-8"
          aria-label={`Open private message thread with ${displayName}`}
        >
          <MessageCircleHeart className="h-7 w-7" aria-hidden="true" />
          {unreadSummary && unreadSummary.unreadCount > 0 && (
            <span
              className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full bg-red-600 px-1.5 text-xs font-bold text-white shadow-lg shadow-red-950/25"
              aria-label={`${unreadSummary.unreadCount} unread messages`}
            >
              {unreadSummary.unreadCount > 99 ? "99+" : unreadSummary.unreadCount}
            </span>
          )}
        </button>
      )}

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close private message overlay"
              className="fixed inset-0 z-[70] bg-black/28 backdrop-blur-sm md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
            />
            <motion.aside
              className="fixed inset-x-3 bottom-3 z-[80] flex h-[min(86dvh,46rem)] flex-col overflow-hidden rounded-[2rem] border border-white/12 bg-[hsl(var(--background))] shadow-2xl shadow-black/30 md:inset-x-auto md:bottom-8 md:right-8 md:w-[27rem]"
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              role="dialog"
              aria-modal="false"
              aria-label={`Private message thread with ${displayName}`}
            >
              <header className="relative overflow-visible border-b border-white/10 px-4 py-4">
                <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-t-[2rem]" aria-hidden="true">
                  <div className="phase-aura-field absolute -right-16 -top-20 h-48 w-48 rounded-full opacity-50" />
                </div>
                <div className="relative flex items-center gap-3">
                  <div className="grid h-12 w-12 flex-shrink-0 place-items-center overflow-hidden rounded-full bg-foreground text-background">
                    {partnerImageUrl ? (
                      <img src={partnerImageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <img
                        src="/assets/partner/digital-locket.png"
                        alt=""
                        className="h-14 w-14 object-contain"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-foreground">{displayName}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-foreground/65">
                      <Lock className="h-3 w-3" aria-hidden="true" />
                      Private couple DM
                    </p>
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setMenuOpen((value) => !value)}
                      className="touch-target rounded-full text-foreground/75 hover:bg-foreground/8"
                      aria-label="Open chat options"
                    >
                      <MoreVertical className="mx-auto h-5 w-5" aria-hidden="true" />
                    </button>
                    {menuOpen && (
                      <div className="absolute right-0 top-12 z-[70] w-44 rounded-2xl border border-white/10 bg-[hsl(var(--background))] p-2 shadow-2xl">
                        <button
                          type="button"
                          onClick={handleClear}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                          Clear chat
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="touch-target rounded-full text-foreground/75 hover:bg-foreground/8"
                    aria-label="Close private message thread"
                  >
                    <X className="mx-auto h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto px-4 py-4">
                {messages === undefined ? (
                  <div className="contrast-glass rounded-[1.5rem] p-4 text-sm text-foreground">
                    Loading the shared thread...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex min-h-full items-center justify-center py-12 text-center">
                    <div>
                      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary text-primary-foreground">
                        <MessageCircleHeart className="h-7 w-7" aria-hidden="true" />
                      </div>
                      <p className="mt-4 font-display text-2xl italic text-foreground">Start the thread.</p>
                      <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-foreground/70">
                        Small, specific messages work best. Try one of the quick notes below.
                      </p>
                      <div className="mt-4 flex flex-wrap justify-center gap-2">
                        {QUICK_LINES.map((line) => (
                          <button
                            key={line}
                            type="button"
                            onClick={() => setBody(line)}
                            className="rounded-full bg-foreground/8 px-3 py-2 text-xs font-semibold text-foreground press-feedback hover:bg-foreground/12"
                          >
                            {line}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="mx-auto w-fit rounded-full bg-foreground/8 px-3 py-1 text-xs font-bold text-foreground/60">
                      Today
                    </div>
                    {messages.map((message, index) => {
                      const previous = messages[index - 1];
                      const isGrouped = Boolean(
                        previous && previous.senderName === message.senderName &&
                        previous.isMine === message.isMine && message.createdAt - previous.createdAt <= 5 * 60 * 1000
                      );
                      const next = messages[index + 1];
                      const isFinalInGroup = !next || next.senderName !== message.senderName || next.isMine !== message.isMine || next.createdAt - message.createdAt > 5 * 60 * 1000;
                      return <motion.div
                        key={message._id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn("flex", message.isMine ? "justify-end" : "justify-start", isGrouped ? "-mt-2" : "")}
                      >
                        <div className={cn("flex max-w-[86%] gap-2", message.isMine ? "flex-row-reverse items-end" : "items-end")}>
                          {!message.isMine && (
                            <div className={cn("grid h-8 w-8 flex-shrink-0 place-items-center overflow-hidden rounded-full bg-foreground/10 text-xs font-bold text-foreground", isGrouped ? "invisible" : "mb-5")} aria-hidden={isGrouped}>
                              {message.senderImageUrl ? (
                                <img src={message.senderImageUrl} alt="" className="h-full w-full object-cover" />
                              ) : (
                                message.senderName.slice(0, 1).toUpperCase()
                              )}
                            </div>
                          )}
                          <div className={cn(message.isMine ? "items-end" : "items-start")}>
                          {!message.isMine && !isGrouped && (
                            <p className="mb-1 ml-1 text-xs font-bold text-foreground/55">
                              {message.senderName}
                            </p>
                          )}
                          <div
                            className={cn(
                              "rounded-[1.35rem] px-4 py-2 text-sm shadow-lg",
                              message.isMine
                                ? "rounded-br-md bg-primary text-primary-foreground"
                                : "rounded-bl-md bg-foreground/8 text-foreground"
                            )}
                          >
                            <p className="whitespace-pre-wrap leading-6">{message.body}</p>
                          </div>
                          {isFinalInGroup && <div className={cn("mt-1 flex items-center gap-2", message.isMine ? "justify-end" : "justify-start")}>
                            <span className="text-[0.68rem] font-semibold text-foreground/50">
                              {formatMessageTime(message.createdAt)}
                            </span>
                            {message.isMine && <Receipt message={message} />}
                          </div>}
                          {message.reactions.length > 0 && (
                            <div className={cn("mt-1 flex flex-wrap gap-1", message.isMine ? "justify-end" : "justify-start")}>
                              {message.reactions.map((reaction) => (
                                <button key={reaction.emoji} type="button" onClick={() => reactToMessage({ messageId: message._id, emoji: reaction.emoji })} className={cn("rounded-full border px-2 py-0.5 text-xs shadow-sm", reaction.isMine ? "border-primary/50 bg-primary/15" : "border-foreground/10 bg-background/80")} aria-label={`${reaction.count} ${reaction.emoji} reactions`}>
                                  {reaction.emoji} {reaction.count}
                                </button>
                              ))}
                            </div>
                          )}
                          <div className={cn("relative mt-1", message.isMine ? "text-right" : "text-left")}>
                            <button type="button" onClick={() => setMessageMenuOpen((value) => value === message._id ? null : message._id)} className="touch-target rounded-full p-1 text-foreground/45 hover:bg-foreground/8" aria-label={`Actions for message from ${message.senderName}`} aria-expanded={messageMenuOpen === message._id}>
                              <MoreVertical className="h-4 w-4" aria-hidden="true" />
                            </button>
                            {messageMenuOpen === message._id && <div className={cn("absolute bottom-8 z-10 flex gap-1 rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-glass)] p-2 shadow-xl", message.isMine ? "right-0" : "left-0")}>
                              {QUICK_EMOJIS.map((emoji) => <button key={emoji} type="button" onClick={() => { void reactToMessage({ messageId: message._id, emoji }); setMessageMenuOpen(null); }} className={cn("grid h-9 w-9 place-items-center rounded-full text-base hover:bg-foreground/10", message.reactions.some((reaction) => reaction.emoji === emoji && reaction.isMine) && "bg-primary/20")} aria-label={`React with ${emoji}`}>{emoji}</button>)}
                            </div>}
                          </div>
                          </div>
                        </div>
                      </motion.div>
                    })}
                    <div ref={endRef} />
                  </div>
                )}
              </div>

              {error && (
                <div className="mx-4 mb-3 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="border-t border-white/10 p-3">
                {emojiTrayOpen && (
                  <div className="mb-2 flex flex-wrap gap-2 rounded-[1.4rem] bg-foreground/6 p-2">
                    {QUICK_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setBody((value) => `${value}${emoji}`.slice(0, 500))}
                        className="grid h-10 w-10 place-items-center rounded-full bg-background text-lg press-feedback hover:bg-foreground/10"
                        aria-label={`Add ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-end gap-2 rounded-[1.7rem] bg-foreground/8 p-2">
                  <button
                    type="button"
                    onClick={() => setEmojiTrayOpen((value) => !value)}
                    className="touch-target flex-shrink-0 rounded-full text-foreground/70 hover:bg-foreground/10"
                    aria-label="Open emoji tray"
                  >
                    <SmilePlus className="mx-auto h-5 w-5" aria-hidden="true" />
                  </button>
                  <label htmlFor="partner-message" className="sr-only">
                    Message your partner
                  </label>
                  <textarea
                    id="partner-message"
                    value={body}
                    onChange={(event) => setBody(event.target.value.slice(0, 500))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void handleSubmit(event as any);
                      }
                    }}
                    placeholder={`Message ${displayName}...`}
                    rows={1}
                    className="max-h-28 min-h-11 flex-1 resize-none bg-transparent px-1 py-3 text-sm text-foreground outline-none placeholder:text-foreground/50"
                  />
                  <button
                    type="submit"
                    disabled={isSending || !body.trim()}
                    className="touch-target flex-shrink-0 rounded-full bg-primary text-primary-foreground press-feedback disabled:cursor-not-allowed disabled:opacity-45"
                    aria-label="Send message"
                  >
                    <Send className="mx-auto h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              </form>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function formatMessageTime(createdAt: number) {
  return new Date(createdAt).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function Receipt({ message }: { message: { deliveredAt: number | null; readAt: number | null } }) {
  const label = message.readAt ? "Read" : message.deliveredAt ? "Delivered" : "Sent";
  return (
    <span className="inline-flex items-center gap-1 text-[0.68rem] font-semibold text-foreground/50" aria-label={label}>
      {message.readAt ? <CheckCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> : message.deliveredAt ? <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" /> : <Check className="h-3.5 w-3.5" aria-hidden="true" />}
      {label}
    </span>
  );
}
