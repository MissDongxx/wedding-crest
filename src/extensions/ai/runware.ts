import { getUuid } from '@/shared/lib/hash';

import { saveFiles } from '.';
import {
  AIConfigs,
  AIFile,
  AIGenerateParams,
  AIImage,
  AIMediaType,
  AIProvider,
  AITaskResult,
  AITaskStatus,
} from './types';

/**
 * Runware configs
 * @docs https://runware.ai/docs/platform/introduction
 */
export interface RunwareConfigs extends AIConfigs {
  apiKey: string;
  model?: string;
  customStorage?: boolean; // use custom storage to save files
}

/**
 * Runware provider
 * @docs https://runware.ai/
 *
 * Single endpoint API: every task is posted to https://api.runware.ai/v1 as an
 * array of task objects. Image inference runs with `deliveryMethod: "async"`
 * so generation never blocks the HTTP request; results are polled through a
 * `getResponse` task.
 */
export class RunwareProvider implements AIProvider {
  // provider name
  readonly name = 'runware';
  // provider configs
  configs: RunwareConfigs;

  // api base url
  private baseUrl = 'https://api.runware.ai/v1';

  // init provider
  constructor(configs: RunwareConfigs) {
    this.configs = configs;
  }

  // generate task
  async generate({
    params,
  }: {
    params: AIGenerateParams;
  }): Promise<AITaskResult> {
    const { mediaType, model, prompt, options, callbackUrl } = params;

    if (!mediaType) {
      throw new Error('mediaType is required');
    }

    if (mediaType !== AIMediaType.IMAGE) {
      throw new Error('only image generation is supported');
    }

    if (!prompt) {
      throw new Error('prompt is required');
    }

    const selectedModel = model || this.configs.model;
    if (!selectedModel) {
      throw new Error('model is required');
    }

    const taskUUID = getUuid();
    const width = options?.width ?? 1024;
    const height = options?.height ?? 1024;
    // Reference images switch the request into image-conditioned mode
    // (used by multimodal models like google:nano-banana@2-lite). Runware's
    // spec for these models: nest the URLs under `inputs.referenceImages`
    // and OMIT width/height — "either provide referenceImages or specify
    // width/height", not both.
    const referenceImages = Array.isArray(options?.referenceImages)
      ? (options.referenceImages as unknown[]).filter(
          (url): url is string => typeof url === 'string' && url.length > 0
        )
      : [];

    const task: Record<string, any> = {
      taskType: 'imageInference',
      taskUUID,
      model: selectedModel,
      positivePrompt: prompt,
      outputFormat: 'png',
      includeCost: true,
      // async delivery: results are fetched through getResponse polling
      deliveryMethod: 'async',
    };
    if (referenceImages.length > 0) {
      task.inputs = { referenceImages };
    } else {
      task.width = width;
      task.height = height;
    }
    // Only include negativePrompt when the caller explicitly passes one —
    // some models (e.g. Kling via Runware) reject this as an
    // unsupportedParameter with status 400. Also: multimodal models like
    // google:nano-banana do not expose negativePrompt at all.
    if (options?.negativePrompt) {
      task.negativePrompt = options.negativePrompt;
    }
    const payload: Record<string, any>[] = [task];

    const resp = await fetch(this.baseUrl, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '');
      throw new Error(
        `request failed with status: ${resp.status} body: ${errBody.slice(0, 400)}`
      );
    }

    const data = await resp.json();
    const first = Array.isArray(data) ? data[0] : data;
    const taskInfo = first?.data?.[0] ?? first?.data ?? first;

    // The provider may already answer synchronously with the image.
    const earlyImage = taskInfo?.imageURL || taskInfo?.imageURLSmall;
    if (earlyImage) {
      return {
        taskStatus: AITaskStatus.SUCCESS,
        taskId: taskUUID,
        taskInfo: {
          images: [{ id: taskInfo.imageUUID ?? '', imageUrl: earlyImage }],
          status: 'success',
        },
        taskResult: data,
      };
    }

    return {
      taskStatus: AITaskStatus.PENDING,
      taskId: taskUUID,
      taskInfo: {},
      taskResult: data,
    };
  }

  // query task
  async query({
    taskId,
    mediaType,
    model,
  }: {
    taskId: string;
    mediaType?: string;
    model?: string;
  }): Promise<AITaskResult> {
    const resp = await fetch(this.baseUrl, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify([
        {
          taskType: 'getResponse',
          taskUUID: taskId,
        },
      ]),
    });

    if (!resp.ok) {
      throw new Error(`request failed with status: ${resp.status}`);
    }

    const data = await resp.json();
    const payload = Array.isArray(data) ? data[0] : data;
    const task = payload?.data?.[0] ?? payload;
    const error = payload?.errors?.[0] ?? task?.error;

    if (error) {
      return {
        taskId,
        taskStatus: AITaskStatus.FAILED,
        taskInfo: {
          status: 'error',
          errorCode: error.code ?? 'error',
          errorMessage: error.message ?? 'runware task failed',
        },
        taskResult: data,
      };
    }

    const status = task?.status ?? (task?.imageURL ? 'success' : 'processing');
    if (status !== 'success' && !task?.imageURL) {
      return {
        taskId,
        taskStatus:
          status === 'error' ? AITaskStatus.FAILED : AITaskStatus.PROCESSING,
        taskInfo: {
          status,
        },
        taskResult: data,
      };
    }

    const imageUrl =
      task?.imageURL || task?.imageURLSmall || task?.taskInfo?.imageURL;
    if (!imageUrl) {
      return {
        taskId,
        taskStatus: AITaskStatus.PROCESSING,
        taskInfo: { status: 'processing' },
        taskResult: data,
      };
    }

    let images: AIImage[] = [
      {
        id: task?.imageUUID ?? '',
        createTime: new Date(),
        imageUrl,
      },
    ];

    // save files to custom storage
    if (this.configs.customStorage) {
      const filesToSave: AIFile[] = images
        .filter((image) => image.imageUrl)
        .map((image, index) => ({
          url: image.imageUrl!,
          contentType: 'image/png',
          key: `runware/image/${getUuid()}.png`,
          index,
          type: 'image',
        }));
      const uploadedFiles = await saveFiles(filesToSave);
      if (uploadedFiles) {
        images = images.map((image, index) => {
          const uploaded = uploadedFiles.find((file) => file.index === index);
          return uploaded?.url ? { ...image, imageUrl: uploaded.url } : image;
        });
      }
    }

    return {
      taskId,
      taskStatus: AITaskStatus.SUCCESS,
      taskInfo: {
        images,
        status: 'success',
        createTime: new Date(),
      },
      taskResult: data,
    };
  }

  // build request headers
  private buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.configs.apiKey}`,
    };
  }
}
