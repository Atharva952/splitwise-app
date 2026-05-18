import { GoogleGenAI } from "@google/genai";

const stripCodeFence = (text) =>
  text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

const getClient = () => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required");
  }
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
};

const parseModelJson = (response) => {
  const raw = response?.text || "";
  const cleaned = stripCodeFence(raw);
  if (!cleaned) {
    throw new Error("Gemini returned empty output");
  }
  return JSON.parse(cleaned);
};

const callModel = async ({ ai, model, contents, config }) =>
  ai.models.generateContent({
    model,
    contents,
    config
  });

export const generateStructured = async ({ prompt, schema }) => {
  const ai = getClient();
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  try {
    const response = await callModel({
      ai,
      model,
      contents: prompt,
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });
    return parseModelJson(response);
  } catch (structuredError) {
    const fallbackPrompt = [
      prompt,
      "",
      "Return only strict JSON. Do not use markdown or code fences."
    ].join("\n");
    const fallbackResponse = await callModel({
      ai,
      model,
      contents: fallbackPrompt,
      config: {
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    });
    try {
      return parseModelJson(fallbackResponse);
    } catch (fallbackParseError) {
      throw new Error(
        `Structured output failed: ${structuredError.message}. Fallback parse failed: ${fallbackParseError.message}`
      );
    }
  }
};

export const generateStructuredFromImage = async ({ prompt, schema, imageBase64, mimeType }) => {
  const ai = getClient();
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const imageAndPromptContents = [
    {
      role: "user",
      parts: [
        {
          inlineData: {
            mimeType,
            data: imageBase64
          }
        },
        { text: prompt }
      ]
    }
  ];

  try {
    const response = await callModel({
      ai,
      model,
      contents: imageAndPromptContents,
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });
    return parseModelJson(response);
  } catch (structuredError) {
    const fallbackResponse = await callModel({
      ai,
      model,
      contents: imageAndPromptContents,
      config: {
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    });
    try {
      return parseModelJson(fallbackResponse);
    } catch (fallbackParseError) {
      throw new Error(
        `Structured image output failed: ${structuredError.message}. Fallback parse failed: ${fallbackParseError.message}`
      );
    }
  }
};
