"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { LinkedInMessage, LinkedInThreadSummary } from "@/lib/types";

export function LinkedInMessages() {
  const router = useRouter();
  const [threads, setThreads] = useState<LinkedInThreadSummary[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LinkedInMessage[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadThreads() {
    setLoadingThreads(true);
    setError(null);
    try {
      const res = await fetch("/api/linkedin/messages");
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (!res.ok) throw new Error("Failed to load LinkedIn threads");
      const data = await res.json();
      setThreads(data.threads);
      if (data.threads.length > 0 && !selectedChatId) {
        setSelectedChatId(data.threads[0].chat_id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load LinkedIn threads");
    } finally {
      setLoadingThreads(false);
    }
  }

  useEffect(() => {
    if (!selectedChatId) return;
    void loadMessages(selectedChatId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChatId]);

  async function loadMessages(chatId: string) {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/linkedin/messages/${encodeURIComponent(chatId)}`);
      if (!res.ok) throw new Error("Failed to load messages");
      const data = await res.json();
      setMessages(data.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load messages");
    } finally {
      setLoadingMessages(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-stone-950">LinkedIn Messages</h1>
        <Link
          href="/admin"
          className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-800 transition hover:bg-stone-100"
        >
          Back to Applications
        </Link>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="flex overflow-hidden rounded-lg border border-stone-200 bg-white" style={{ height: "70vh" }}>
        <div className="w-80 shrink-0 overflow-y-auto border-r border-stone-200">
          {loadingThreads && <p className="p-4 text-sm text-stone-500">Loading...</p>}
          {!loadingThreads && threads.length === 0 && (
            <p className="p-4 text-sm text-stone-400">No LinkedIn conversations synced yet.</p>
          )}
          {threads.map((thread) => (
            <button
              key={thread.chat_id}
              onClick={() => setSelectedChatId(thread.chat_id)}
              className={`block w-full border-b border-stone-100 px-4 py-3 text-left text-sm transition hover:bg-stone-50 ${
                selectedChatId === thread.chat_id ? "bg-sky-50" : ""
              }`}
            >
              <div className="font-medium text-stone-900">{thread.contact_name}</div>
              <div className="mt-0.5 truncate text-xs text-stone-500">
                {thread.last_message_text ?? "(no text)"}
              </div>
              <div className="mt-1 text-[11px] text-stone-400">
                {thread.message_count} message{thread.message_count === 1 ? "" : "s"}
                {thread.last_message_at
                  ? ` · ${new Date(thread.last_message_at).toLocaleString()}`
                  : ""}
              </div>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loadingMessages && <p className="text-sm text-stone-500">Loading messages...</p>}
          {!loadingMessages && !selectedChatId && (
            <p className="text-sm text-stone-400">Select a conversation to view messages.</p>
          )}
          {!loadingMessages &&
            selectedChatId &&
            messages.map((message) => (
              <div
                key={message.id}
                className={`mb-3 flex ${message.is_sender ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                    message.is_sender ? "bg-sky-100 text-sky-950" : "bg-stone-100 text-stone-900"
                  }`}
                >
                  {!message.is_sender && (
                    <div className="mb-0.5 text-xs font-medium text-stone-500">
                      {message.sender_profile_url ? (
                        <a
                          href={message.sender_profile_url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline"
                        >
                          {message.sender_name}
                        </a>
                      ) : (
                        message.sender_name
                      )}
                    </div>
                  )}
                  <div className="whitespace-pre-wrap">{message.text || "(no text)"}</div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-stone-400">
                    {message.message_timestamp && (
                      <span>{new Date(message.message_timestamp).toLocaleString()}</span>
                    )}
                    {message.has_cv_attachment && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">CV attached</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
