import { envConfigs } from '@/config';

import * as postgresSchema from './schema.postgres';
import * as sqliteSchema from './schema.sqlite';

// Drizzle Kit receives an explicit dialect schema through DB_SCHEMA_FILE.
// Runtime models use this shared module, so select the matching table objects
// here as well. PostgreSQL remains isolated to the fixed wedding-crest schema.
const activeSchema = (
  envConfigs.database_provider === 'postgresql' ? postgresSchema : sqliteSchema
) as typeof postgresSchema;

export const user = activeSchema.user;
export const session = activeSchema.session;
export const account = activeSchema.account;
export const verification = activeSchema.verification;
export const apikey = activeSchema.apikey;
export const config = activeSchema.config;
export const post = activeSchema.post;
export const taxonomy = activeSchema.taxonomy;
export const order = activeSchema.order;
export const subscription = activeSchema.subscription;
export const credit = activeSchema.credit;
export const permission = activeSchema.permission;
export const role = activeSchema.role;
export const rolePermission = activeSchema.rolePermission;
export const userRole = activeSchema.userRole;
export const aiTask = activeSchema.aiTask;
export const chat = activeSchema.chat;
export const chatMessage = activeSchema.chatMessage;
export const weddingProject = activeSchema.weddingProject;
export const weddingProjectElement = activeSchema.weddingProjectElement;
export const weddingGeneration = activeSchema.weddingGeneration;
export const weddingGenerationReview = activeSchema.weddingGenerationReview;
export const weddingAsset = activeSchema.weddingAsset;
export const weddingPromptTemplate = activeSchema.weddingPromptTemplate;
export const weddingFrame = activeSchema.weddingFrame;
export const weddingExample = activeSchema.weddingExample;
