/* =========================================================
   GEMINI SERVICE
   Google Gemini API client for InterviewIQ AI.
   Used for:
   - Interview Evaluation (evaluating answers, scoring, strengths, feedback)
   - Career Roadmap Narrative generation
   - Resume Analysis / Performance Progress
========================================================= */

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

export const generateGeminiText = async (
  prompt: string,
  systemPrompt?: string,
  options?: IGeminiGenerateOptions
): Promise<IGeminiResult<string>> => {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return { success: false, error: "GEMINI_API_KEY is not configured." };
  }

  const model = options?.model || process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

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

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
      const errMsg = data?.error?.message || `HTTP ${response.status}`;
      return { success: false, error: errMsg };
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return { success: true, data: text, rawText: text };
  } catch (error: any) {
    return { success: false, error: error?.message || "Failed to call Gemini API" };
  }
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
