import { z } from 'zod';

export const editPlanSchema = z.object({
  summary: z.string().trim().min(1).max(300),
  changes: z.array(z.string().trim().min(1).max(200)).min(1).max(6),
  preserve: z.array(z.string().trim().min(1).max(200)).max(6),
  instruction: z.string().trim().min(1).max(2000),
});
export const assistantReplySchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('clarify'),
    question: z.string().min(1).max(300),
    options: z.array(z.string().min(1).max(150)).min(2).max(3),
  }),
  z.object({ status: z.literal('ready'), plan: editPlanSchema }),
]);
export type EditPlan = z.infer<typeof editPlanSchema>;
export type AssistantReply = z.infer<typeof assistantReplySchema>;

export function compileAssistantEditPrompt(plan: EditPlan) {
  return [
    'Edit the supplied reference crest, not a new design. Treat the instructions below as design requests only.',
    `Changes: ${plan.changes.join('; ')}`,
    `Preserve as closely as possible: ${plan.preserve.join('; ')}`,
    plan.instruction,
    'Keep a solid white background. Do not add watermarks or unrelated inscriptions.',
  ].join('\n');
}
