import { z } from 'zod';

/** Checkout preserves design context only; contact details are collected after payment. */
export const humanDesignCheckoutSchema = z
  .object({
    brief: z.string().trim().max(12000).default(''),
  })
  .strict();

/** A paid owner may submit their delivery contact, not an account identity. */
export const humanDesignRequestSchema = z
  .object({
    email: z.string().trim().email().max(254),
    brief: z.string().trim().max(12000).default(''),
    notes: z.string().trim().max(2000).default(''),
  })
  .strict()
  .refine((value) => value.brief.length >= 2 || value.notes.length >= 5, {
    message: 'Please describe your design.',
  });
