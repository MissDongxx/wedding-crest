import { AIMediaType, AIProvider, AITaskStatus } from './types';

export const OPENAI_IMAGE_MODEL = 'gpt-image-2.5-flare';
export const OPENAI_IMAGE_QUALITIES = [
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
] as const;

export class OpenAIImageQuotaError extends Error {
  constructor() {
    super('OpenAI image credits exhausted');
  }
}

export class OpenAIImageProvider implements AIProvider {
  readonly name = 'openai';

  constructor(
    public configs: { apiKey: string; model: string; quality?: string },
    private storeImage: (image: Buffer, taskId: string) => Promise<string>,
    private request: typeof fetch = fetch
  ) {}

  async generate({ params }: Parameters<AIProvider['generate']>[0]) {
    if (params.mediaType !== AIMediaType.IMAGE) {
      throw new Error('OpenAI image provider only supports images');
    }
    const references: string[] = params.options?.referenceImages ?? [];
    const quality =
      OPENAI_IMAGE_QUALITIES.find((value) => value === this.configs.quality) ??
      'medium';
    const response = await this.request(
      `https://api.openai.com/v1/images/${references.length ? 'edits' : 'generations'}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.configs.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: params.model || this.configs.model,
          prompt: params.prompt,
          quality,
          size: `${params.options?.width ?? 1024}x${params.options?.height ?? 1024}`,
          output_format: 'png',
          ...(references.length
            ? { images: references.map((image_url) => ({ image_url })) }
            : {}),
        }),
        signal: AbortSignal.timeout(150_000),
      }
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const code = payload?.error?.code;
      if (
        (response.status === 429 ||
          response.status === 402 ||
          response.status === 400) &&
        (code === 'insufficient_quota' ||
          code === 'credit_balance_exhausted' ||
          code === 'billing_hard_limit_reached')
      ) {
        throw new OpenAIImageQuotaError();
      }
      // Keep upstream response text (which may contain input details) out of the client.
      throw new Error(`OpenAI image request failed (HTTP ${response.status})`);
    }
    const image = payload?.data?.[0]?.b64_json;
    if (typeof image !== 'string' || !image) {
      throw new Error('OpenAI image response did not include an image');
    }
    const taskId = response.headers.get('x-request-id') || crypto.randomUUID();
    const imageUrl = await this.storeImage(
      Buffer.from(image, 'base64'),
      taskId
    );
    return {
      taskId,
      taskStatus: AITaskStatus.SUCCESS,
      taskInfo: { images: [{ imageUrl }] },
    };
  }
}

type ImageAttempt = {
  provider: AIProvider;
  params: Parameters<AIProvider['generate']>[0]['params'];
};

export async function generateWeddingImage(
  primary: ImageAttempt,
  fallback?: ImageAttempt
) {
  try {
    return {
      ...primary,
      result: await primary.provider.generate({ params: primary.params }),
    };
  } catch (error) {
    if (!(error instanceof OpenAIImageQuotaError) || !fallback) throw error;
    return {
      ...fallback,
      result: await fallback.provider.generate({ params: fallback.params }),
    };
  }
}
