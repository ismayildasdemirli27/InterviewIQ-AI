/* =========================================================
   GEMINI SERVICE
   Google Gemini API client for InterviewIQ AI.
   Used for:
   - Interview Evaluation (evaluating answers, scoring, strengths, feedback)
   - Career Roadmap Narrative generation
   - Resume Analysis / Performance Progress
========================================================= */

import dns from "node:dns";

// Ensure IPv4 first on Windows to avoid connect timeouts
try {
  dns.setDefaultResultOrder("ipv4first");
} catch {
  // Ignore in environments without setDefaultResultOrder
}

export interface IGeminiGenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface IGeminiResult<T = string> {
  success: boolean;
  data?: T;
  rawText?: string;
  error?: string;
}

const CANDIDATE_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-flash-latest",
  "gemma-4-26b-a4b-it",
  "gemini-3.8-flash",
];

export const generateGeminiText = async (
  prompt: string,
  systemPrompt?: string,
  options?: IGeminiGenerateOptions
): Promise<IGeminiResult<string>> => {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return { success: false, error: "GEMINI_API_KEY is not configured." };
  }

  const primaryModel = options?.model || process.env.GEMINI_MODEL || "gemini-flash-latest";
  const modelsToTry = [primaryModel, ...CANDIDATE_MODELS.filter((m) => m !== primaryModel)];

  const contents: any[] = [];
  if (systemPrompt) {
    contents.push({
      role: "user",
      parts: [{ text: `[SYSTEM INSTRUCTIONS]: ${systemPrompt}` }],
    });
    contents.push({
      role: "model",
      parts: [{ text: "Understood. I will follow these instructions." }],
    });
  }

  contents.push({
    role: "user",
    parts: [{ text: prompt }],
  });

  let lastError = "Failed to call Gemini API";

  for (const model of modelsToTry) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(12000),
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: options?.temperature ?? 0.7,
            maxOutputTokens: options?.maxTokens ?? 2048,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        lastError = data?.error?.message || `HTTP ${response.status} from ${model}`;
        // If high demand (503) or not found (404), try next model in candidate list
        if (response.status === 503 || response.status === 404) {
          continue;
        }
        return { success: false, error: lastError };
      }

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (text) {
        return { success: true, data: text, rawText: text };
      }
    } catch (error: any) {
      lastError = error?.message || `Network error with ${model}`;
    }
  }

  return { success: false, error: lastError };
};

export const generateGeminiJSON = async <T>(
  prompt: string,
  systemPrompt?: string,
  options?: IGeminiGenerateOptions
): Promise<IGeminiResult<T>> => {
  const fullPrompt = `${prompt}\n\nIMPORTANT: Respond ONLY with valid JSON. Do not wrap in markdown code blocks or add any conversational text.`;
  const res = await generateGeminiText(fullPrompt, systemPrompt, options);

  if (!res.success || !res.data) {
    return { success: false, error: res.error, rawText: res.rawText };
  }

  try {
    let cleanJson = res.data.trim();
    if (cleanJson.startsWith("```json")) {
      cleanJson = cleanJson.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
    } else if (cleanJson.startsWith("```")) {
      cleanJson = cleanJson.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }
    const parsed = JSON.parse(cleanJson) as T;
    return { success: true, data: parsed, rawText: res.data };
  } catch (err: any) {
    return { success: false, error: `Invalid JSON response: ${err.message}`, rawText: res.data };
  }
};

