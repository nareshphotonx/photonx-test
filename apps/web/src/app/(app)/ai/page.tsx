'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ArrowUp, BookOpen, Bot, MessageSquare, RefreshCcw, Sparkles, User as UserIcon, Wrench } from 'lucide-react';
import { Avatar, Badge, Button, Card } from '@/components/ui';
import { getApiErrorMessage, post } from '@/lib/api';
import { storage } from '@/lib/storage';
import { cn } from '@/lib/cn';

type ChatResponse = {
  reply?: string;
  message?: string;
  text?: string;
  conversationId?: string;
  toolsUsed?: Array<{ name: string }>;
  sources?: Array<{ title?: string; documentId?: string; chunkId?: string; score?: number }>;
  confidence?: number;
};

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: ChatResponse['toolsUsed'];
  sources?: ChatResponse['sources'];
  confidence?: number;
};

const STARTERS = [
  { icon: MessageSquare, text: 'What tasks are due this week?' },
  { icon: BookOpen, text: 'Summarize our leave policy.' },
  { icon: MessageSquare, text: 'Show me my leave balance.' },
  { icon: BookOpen, text: 'Explain the expense approval workflow.' },
];

export default function AIPage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [user, setUser] = useState<ReturnType<typeof storage.getUser>>(null);

  useEffect(() => setUser(storage.getUser()), []);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = useMutation({
    mutationFn: (prompt: string) =>
      post<ChatResponse>('/ai/chat', conversationId ? { prompt, conversationId } : { prompt }),
    onSuccess: (res) => {
      const reply = res.reply ?? res.message ?? res.text ?? 'No response.';
      if (res.conversationId) setConversationId(res.conversationId);
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: reply,
          toolsUsed: res.toolsUsed,
          sources: res.sources,
          confidence: res.confidence,
        },
      ]);
    },
    onError: (e) => {
      const errMsg = getApiErrorMessage(e);
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: 'assistant', content: `⚠️ ${errMsg}` },
      ]);
    },
  });

  const handleSubmit = (text?: string) => {
    const value = (text ?? input).trim();
    if (!value || send.isPending) return;
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'user', content: value }]);
    setInput('');
    send.mutate(value);
    inputRef.current?.focus();
  };

  const reset = () => {
    setMessages([]);
    setConversationId(null);
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-var(--topbar-height))]">
      <div className="border-b border-[color:var(--color-border)] bg-[color:var(--color-canvas)] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-[color:var(--color-brand-500)] to-[color:var(--color-brand-700)] text-white flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold leading-none truncate">AI Assistant</h1>
            <p className="text-xs text-[color:var(--color-fg-muted)] mt-1">Ask anything about your workspace</p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={reset}>
            <RefreshCcw className="h-3.5 w-3.5" /> New chat
          </Button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
          {messages.length === 0 ? (
            <Empty onPick={(t) => handleSubmit(t)} />
          ) : (
            <div className="space-y-6">
              {messages.map((m) => (
                <MessageBubble key={m.id} m={m} userName={user?.fullName ?? user?.email} />
              ))}
              {send.isPending && (
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[color:var(--color-brand-500)] to-[color:var(--color-brand-700)] text-white flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="flex items-center gap-1.5 pt-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-fg-subtle)] animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-fg-subtle)] animate-bounce" style={{ animationDelay: '120ms' }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-fg-subtle)] animate-bounce" style={{ animationDelay: '240ms' }} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-[color:var(--color-border)] bg-[color:var(--color-canvas)] px-4 sm:px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="relative bg-[color:var(--color-surface)] border border-[color:var(--color-border-strong)] rounded-2xl shadow-sm focus-within:border-[color:var(--color-primary)] focus-within:ring-2 focus-within:ring-[color:var(--color-ring)]">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Ask anything…"
              rows={1}
              className="block w-full bg-transparent border-0 resize-none px-4 py-3 pr-12 text-sm focus:outline-none max-h-40"
              style={{ minHeight: 44 }}
            />
            <button
              onClick={() => handleSubmit()}
              disabled={!input.trim() || send.isPending}
              className="absolute right-2 bottom-2 h-8 w-8 rounded-lg bg-[color:var(--color-primary)] text-white inline-flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[color:var(--color-primary-hover)] transition-colors"
              aria-label="Send"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
          <p className="text-[11px] text-[color:var(--color-fg-subtle)] text-center mt-2">
            AI may make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </div>
  );
}

function Empty({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="text-center py-12">
      <div className="inline-flex h-14 w-14 rounded-2xl bg-gradient-to-br from-[color:var(--color-brand-500)] to-[color:var(--color-brand-700)] text-white items-center justify-center mb-4">
        <Sparkles className="h-6 w-6" />
      </div>
      <h2 className="text-2xl font-semibold tracking-tight">How can I help today?</h2>
      <p className="text-sm text-[color:var(--color-fg-muted)] mt-2 max-w-md mx-auto">
        Ask about your tasks, attendance, leave, expenses, or company policies. I can also search your knowledge base.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl mx-auto mt-8">
        {STARTERS.map((s, i) => (
          <button
            key={i}
            onClick={() => onPick(s.text)}
            className="text-left p-4 bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-xl hover:border-[color:var(--color-border-strong)] hover:shadow-sm transition-all group"
          >
            <s.icon className="h-4 w-4 text-[color:var(--color-fg-muted)] mb-2 group-hover:text-[color:var(--color-primary)]" />
            <p className="text-sm font-medium">{s.text}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ m, userName }: { m: Message; userName?: string }) {
  return (
    <div className={cn('flex gap-3', m.role === 'user' && 'flex-row-reverse')}>
      {m.role === 'user' ? (
        <Avatar size="sm" name={userName} />
      ) : (
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[color:var(--color-brand-500)] to-[color:var(--color-brand-700)] text-white flex items-center justify-center flex-shrink-0">
          <Bot className="h-4 w-4" />
        </div>
      )}
      <div className={cn('flex-1 min-w-0 max-w-2xl', m.role === 'user' && 'flex flex-col items-end')}>
        <div
          className={cn(
            'px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed',
            m.role === 'user'
              ? 'bg-[color:var(--color-primary)] text-white rounded-tr-sm'
              : 'bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-tl-sm',
          )}
        >
          {m.content}
        </div>
        {(m.toolsUsed?.length || m.sources?.length || m.confidence != null) && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2 px-1">
            {m.confidence != null && (
              <Badge tone={m.confidence > 0.8 ? 'success' : m.confidence > 0.5 ? 'warning' : 'danger'}>
                {Math.round(m.confidence * 100)}% confidence
              </Badge>
            )}
            {m.toolsUsed?.map((t, i) => (
              <Badge key={i} tone="info">
                <Wrench className="h-2.5 w-2.5" /> {t.name}
              </Badge>
            ))}
            {m.sources?.slice(0, 3).map((s, i) => (
              <Badge key={i} tone="primary">
                <BookOpen className="h-2.5 w-2.5" /> {s.title ?? s.documentId?.slice(0, 6) ?? 'source'}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
