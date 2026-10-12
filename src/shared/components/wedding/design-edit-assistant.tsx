'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@/shared/components/ui/button';
import { readJsonResponse } from '@/shared/lib/read-json-response';
import {
  assistantReplySchema,
  type AssistantReply,
  type EditPlan,
} from '@/shared/wedding/edit-plan';

export function DesignEditAssistant({
  projectId,
  sourceGenerationId,
  guestId,
  disabled,
  allowed,
  onConfirm,
}: {
  projectId: string;
  sourceGenerationId: string;
  guestId?: string | null;
  disabled: boolean;
  allowed: boolean;
  onConfirm: (plan: EditPlan) => Promise<boolean>;
}) {
  const t = useTranslations('pages.design.assistant');
  const locale = useLocale();
  const [request, setRequest] = useState('');
  const [clarification, setClarification] = useState('');
  const [reply, setReply] = useState<AssistantReply | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const epoch = useRef(0);
  const lock = useRef(false);
  const preferences = useRef<string[]>([]);
  useEffect(() => {
    epoch.current += 1;
    setReply(null);
    setClarification('');
    setError('');
    setRequest('');
    return () => {
      epoch.current += 1;
    };
  }, [projectId, sourceGenerationId]);

  async function understand(answer = clarification) {
    if (lock.current || disabled || !allowed || request.trim().length < 3)
      return;
    lock.current = true;
    setLoading(true);
    setError('');
    const current = epoch.current;
    try {
      const response = await fetch(
        `/api/projects/${projectId}/edit-assistant`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(guestId ? { 'x-wedding-guest-id': guestId } : {}),
          },
          body: JSON.stringify({
            sourceGenerationId,
            request,
            clarification: answer,
            locale,
            preservePreferences: preferences.current,
          }),
        }
      );
      const body = await readJsonResponse<{
        code?: number;
        message?: string;
        data?: unknown;
      }>(response);
      if (!response.ok || body.code !== 0)
        throw new Error(body.message || t('error'));
      const parsed = assistantReplySchema.parse(body.data);
      if (current === epoch.current) setReply(parsed);
    } catch (e) {
      if (current === epoch.current)
        setError(e instanceof Error ? e.message : t('error'));
    } finally {
      lock.current = false;
      setLoading(false);
    }
  }

  async function confirm() {
    if (reply?.status !== 'ready' || lock.current || disabled || !allowed)
      return;
    lock.current = true;
    setLoading(true);
    setError('');
    try {
      if (await onConfirm(reply.plan)) {
        preferences.current = reply.plan.preserve;
        setReply(null);
        setRequest('');
        setClarification('');
      }
    } catch {
      setError(t('error'));
    } finally {
      lock.current = false;
      setLoading(false);
    }
  }

  return (
    <section
      className="rounded-2xl border p-6"
      aria-labelledby="design-assistant-title"
    >
      <p className="text-muted-foreground mb-2 text-xs tracking-widest uppercase">
        {t('eyebrow')}
      </p>
      <h2 id="design-assistant-title" className="font-serif text-xl">
        {t('title')}
      </h2>
      <p className="text-muted-foreground mt-2 text-sm">{t('hint')}</p>
      <label htmlFor="design-edit-request" className="mt-4 block text-sm">
        {t('request')}
      </label>
      <textarea
        id="design-edit-request"
        value={request}
        maxLength={1500}
        rows={3}
        disabled={disabled || loading}
        placeholder={t('placeholder')}
        onChange={(e) => {
          setRequest(e.target.value);
          setReply(null);
          setClarification('');
          setError('');
        }}
        className="bg-background mt-2 w-full rounded-lg border p-3 text-sm"
      />
      {!reply && (
        <Button
          className="mt-3"
          variant="outline"
          disabled={
            disabled || loading || !allowed || request.trim().length < 3
          }
          onClick={() => understand('')}
        >
          {loading ? t('thinking') : t('understand')}
        </Button>
      )}
      {reply?.status === 'clarify' && (
        <div className="mt-4 space-y-3" aria-live="polite">
          <p className="text-sm">{reply.question}</p>
          <div className="flex flex-wrap gap-2">
            {reply.options.map((option) => (
              <Button
                key={option}
                variant="outline"
                disabled={loading || disabled || !allowed}
                onClick={() => {
                  setClarification(option);
                  void understand(option);
                }}
              >
                {option}
              </Button>
            ))}
          </div>
          <label htmlFor="design-edit-answer" className="block text-sm">
            {t('answer')}
          </label>
          <input
            id="design-edit-answer"
            maxLength={500}
            value={clarification}
            disabled={loading || disabled}
            onChange={(e) => setClarification(e.target.value)}
            className="bg-background w-full rounded-lg border p-3 text-sm"
          />
          <Button
            disabled={loading || disabled || !allowed || !clarification.trim()}
            onClick={() => understand()}
          >
            {loading ? t('thinking') : t('continue_label')}
          </Button>
        </div>
      )}
      {reply?.status === 'ready' && (
        <div
          className="bg-muted/30 mt-4 space-y-3 rounded-xl p-4"
          aria-live="polite"
        >
          <p className="font-medium">{reply.plan.summary}</p>
          <h3 className="text-sm font-medium">{t('changes')}</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {reply.plan.changes.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
          <h3 className="text-sm font-medium">{t('preserve')}</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {reply.plan.preserve.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
          <p className="text-muted-foreground text-xs">{t('warning')}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={loading || disabled || !allowed}
              onClick={confirm}
            >
              {loading ? t('working') : t('confirm')}
            </Button>
            <Button
              variant="ghost"
              disabled={loading || disabled}
              onClick={() => {
                setReply(null);
                setClarification('');
              }}
            >
              {t('revise')}
            </Button>
          </div>
        </div>
      )}
      {!allowed && <p className="mt-3 text-sm">{t('quota')}</p>}
      {error && (
        <p role="alert" className="text-destructive mt-3 text-sm">
          {error}
        </p>
      )}
    </section>
  );
}
