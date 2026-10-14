'use client';

let pending: Promise<boolean | undefined> = Promise.resolve(true);

export function trackWeddingFunnel(
  eventName: string,
  projectId?: string,
  generationId?: string,
  flowId?: string
) {
  // Purchase redirects must not wait behind an unrelated analytics retry.
  if (eventName !== 'create_clicked' && eventName !== 'project_created') {
    return sendWeddingFunnel(eventName, projectId, generationId, flowId);
  }
  pending = pending
    .catch(() => false)
    .then(() => sendWeddingFunnel(eventName, projectId, generationId, flowId));
  return pending;
}

async function sendWeddingFunnel(
  eventName: string,
  projectId?: string,
  generationId?: string,
  flowId?: string
) {
  try {
    let anonymousId = localStorage.getItem('wedding_analytics_id');
    if (!anonymousId) {
      anonymousId = crypto.randomUUID();
      localStorage.setItem('wedding_analytics_id', anonymousId);
    }
    const guestId = localStorage.getItem('wedding_guest_id');
    const body = JSON.stringify({
      id: crypto.randomUUID(),
      anonymousId,
      eventName,
      projectId,
      generationId,
      flowId: flowId || projectId || crypto.randomUUID(),
      entryPosition: projectId ? 'result' : 'wizard',
    });
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch('/api/wedding/funnel', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(guestId ? { 'x-wedding-guest-id': guestId } : {}),
          },
          body,
          keepalive: true,
        });
        if (response.ok) return true;
        if (response.status < 500) return false;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
    return false;
  } catch {
    /* Analytics never blocks the user flow (including storage denied). */
  }
}

export function observeWeddingExposure(
  element: HTMLElement,
  eventName: string,
  projectId: string,
  generationId?: string
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let visible = false;
  let sent = false;
  const check = () => {
    clearTimeout(timer);
    const image = element instanceof HTMLImageElement ? element : null;
    if (
      sent ||
      !visible ||
      document.visibilityState !== 'visible' ||
      (image && (!image.complete || image.naturalWidth === 0))
    )
      return;
    timer = setTimeout(() => {
      if (document.visibilityState !== 'visible') return;
      const key = `wedding_exposure:${eventName}:${projectId}:${generationId || ''}`;
      try {
        if (sessionStorage.getItem(key)) return;
      } catch {}
      sent = true;
      void trackWeddingFunnel(eventName, projectId, generationId).then((ok) => {
        if (ok) {
          try {
            sessionStorage.setItem(key, '1');
          } catch {}
        } else sent = false;
      });
    }, 1000);
  };
  const observer = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= 0.5;
      check();
    },
    { threshold: [0.5] }
  );
  observer.observe(element);
  element.addEventListener('load', check);
  document.addEventListener('visibilitychange', check);
  return () => {
    clearTimeout(timer);
    observer.disconnect();
    element.removeEventListener('load', check);
    document.removeEventListener('visibilitychange', check);
  };
}
