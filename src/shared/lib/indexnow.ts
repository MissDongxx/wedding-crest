import indexNowConfig from '@/config/indexnow.json';

// Public ownership-verification value, intentionally served on this domain.
// This is not an API credential or a private secret.
export const INDEXNOW_KEY = indexNowConfig.key;
export const INDEXNOW_KEY_PATH = `/${INDEXNOW_KEY}.txt`;
