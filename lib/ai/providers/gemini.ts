import 'server-only';
import { GoogleGenAI } from '@google/genai';
import type { AIProvider, PlanTurnInput, StreamPageInput } from '../types';
import { turnPlanSchema, type TurnPlan } from '../schema';
import { planTurnSystemPrompt, streamPageSystemPrompt } from '../prompts';

/**
 * Gemini adapter. All Gemini-specific request shaping lives here so the rest of
 * the app depends only on the `AIProvider` interface. The API key and model id
 * are read from the environment and never leave the server.
 */

type Turn = { role: 'user' | 'assistant'; content: string };

/** Map our chat turns to Gemini's `contents` (assistant -> "model"). */
function toContents(messages: Turn[]) {
  return messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
}

export function createGeminiProvider(model: string): AIProvider {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set. Add it to .env.local.');
  }
  const ai = new GoogleGenAI({ apiKey });

  return {
    async planTurn(input: PlanTurnInput): Promise<TurnPlan> {
      const response = await ai.models.generateContent({
        model,
        contents: toContents(input.messages),
        config: {
          systemInstruction: planTurnSystemPrompt(input.existingPages, input.activePageId),
          temperature: 0.7,
          responseMimeType: 'application/json',
          abortSignal: input.abortSignal,
        },
      });

      const text = response.text ?? '';
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        // Model didn't return clean JSON — degrade gracefully to a chat reply.
        return { reply: text.trim() || 'Sorry, could you rephrase that?', action: 'chat', plannedPages: [] };
      }

      const result = turnPlanSchema.safeParse(parsed);
      if (!result.success) {
        return { reply: 'Sorry, I had trouble planning that. Could you rephrase?', action: 'chat', plannedPages: [] };
      }
      return result.data;
    },

    async *streamPage(input: StreamPageInput): AsyncIterable<string> {
      const stream = await ai.models.generateContentStream({
        model,
        contents: toContents(input.messages),
        config: {
          systemInstruction: streamPageSystemPrompt(input.page),
          temperature: 0.8,
          maxOutputTokens: 32768,
          abortSignal: input.abortSignal,
        },
      });

      for await (const chunk of stream) {
        const text = chunk.text;
        if (text) yield text;
      }
    },
  };
}
