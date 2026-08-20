import {
  AIManager,
  FalProvider,
  GeminiProvider,
  KieProvider,
  ReplicateProvider,
  RunwareProvider,
} from '@/extensions/ai';
import { Configs, getAllConfigs } from '@/shared/models/config';

/**
 * get ai manager with configs
 */
export function getAIManagerWithConfigs(configs: Configs) {
  const aiManager = new AIManager();

  if (configs.kie_api_key) {
    aiManager.addProvider(
      new KieProvider({
        apiKey: configs.kie_api_key,
        customStorage: configs.kie_custom_storage === 'true',
      })
    );
  }

  if (configs.replicate_api_token) {
    aiManager.addProvider(
      new ReplicateProvider({
        apiToken: configs.replicate_api_token,
        customStorage: configs.replicate_custom_storage === 'true',
      })
    );
  }

  if (configs.fal_api_key) {
    aiManager.addProvider(
      new FalProvider({
        apiKey: configs.fal_api_key,
        customStorage: configs.fal_custom_storage === 'true',
      })
    );
  }

  if (configs.gemini_api_key) {
    aiManager.addProvider(
      new GeminiProvider({
        apiKey: configs.gemini_api_key,
      })
    );
  }

  if (configs.runware_api_key) {
    aiManager.addProvider(
      new RunwareProvider({
        apiKey: configs.runware_api_key,
        model: configs.runware_model,
        customStorage: configs.runware_custom_storage === 'true',
      })
    );
  }

  return aiManager;
}

/**
 * global ai service
 */
let aiService: AIManager | null = null;

/**
 * get ai service manager
 */
export async function getAIService(configs?: Configs): Promise<AIManager> {
  if (!configs) {
    configs = await getAllConfigs();
  }
  aiService = getAIManagerWithConfigs(configs);

  return aiService;
}

/**
 * Force the next getAIService() call to re-read configs and rebuild the
 * provider list. Call this from any code path that mutates the underlying
 * configs (admin settings save, env reload, etc.) so a freshly-saved
 * Runware API key is picked up on the very next request.
 */
export function invalidateAIService() {
  aiService = null;
}
