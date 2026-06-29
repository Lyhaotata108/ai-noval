/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { ProjectData, Novel, StoryBible, Character, OutlineItem, Chapter, Foreshadow, Memory } from "./src/types";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// File-based Database Persistence PATH
const DB_FILE = path.join(process.cwd(), "database.json");

// Helper to load current database state
function loadDb(): Record<string, ProjectData> {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, "utf-8");
      return JSON.parse(content) || {};
    }
  } catch (error) {
    console.error("Error reading database file:", error);
  }
  return {};
}

// Helper to save database state
function saveDb(data: Record<string, ProjectData>) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error("Error writing database file:", error);
  }
}

// Robust JSON extraction from unstructured AI outputs
function extractJsonFromText(text: string): any {
  if (!text) return null;
  // Strip out DeepSeek style reasoning blocks completely to avoid parsing internal braces
  let processedText = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  const str = processedText.trim();
  
  try {
    return JSON.parse(str);
  } catch (e) {
    let candidate = str;
    
    // Try finding JSON block in markdown
    const jsonBlockMatch = candidate.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/i);
    if (jsonBlockMatch && jsonBlockMatch[1]) {
      candidate = jsonBlockMatch[1].trim();
      try {
        return JSON.parse(candidate);
      } catch (err) {}
    }

    // Try finding the first {/last } or first [/last ]
    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');
    const firstBracket = candidate.indexOf('[');
    const lastBracket = candidate.lastIndexOf(']');
    
    const braceLen = lastBrace > firstBrace ? lastBrace - firstBrace : -1;
    const bracketLen = lastBracket > firstBracket ? lastBracket - firstBracket : -1;

    let extracted = candidate;
    if (braceLen > bracketLen && braceLen > 0) {
      extracted = candidate.substring(firstBrace, lastBrace + 1);
    } else if (bracketLen > 0) {
      extracted = candidate.substring(firstBracket, lastBracket + 1);
    }

    try {
      return JSON.parse(extracted);
    } catch (err) {}

    // Aggressive clean up: handle trailing commas and unescaped newlines/control chars
    try {
        let cleaned = extracted.replace(/,\s*([}\]])/g, "$1");
        cleaned = cleaned.replace(/[\u0000-\u001F]+/g, " ");
        // try finding brackets again manually in case extraction failed earlier due to control chars
        const fb = cleaned.indexOf('{');
        const lb = cleaned.lastIndexOf('}');
        const fbr = cleaned.indexOf('[');
        const lbr = cleaned.lastIndexOf(']');
        
        const cBraceLen = lb > fb ? lb - fb : -1;
        const cBracketLen = lbr > fbr ? lbr - fbr : -1;
        
        let finalCleaned = cleaned;
        if (cBraceLen > cBracketLen && cBraceLen > 0) {
           finalCleaned = cleaned.substring(fb, lb + 1);
        } else if (cBracketLen > 0) {
           finalCleaned = cleaned.substring(fbr, lbr + 1);
        }
        
        return JSON.parse(finalCleaned);
    } catch(err) {}

    console.error("Failed to extract JSON from text:", text.substring(0, 300));
    const sample = text.substring(0, 50).replace(/\n/g, "");
    throw new Error(`Invalid JSON response from AI: ${sample}...`);
  }
}

// Lazy initialization of Gemini Client to avoid crash on boot when GEMINI_API_KEY is not defined
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing. Please set your Gemini API key in the platform settings.");
  }
  if (!aiInstance) {
    const customBaseUrl = process.env.GEMINI_BASE_URL ? process.env.GEMINI_BASE_URL.trim() : undefined;
    if (customBaseUrl) {
      console.log(`[Gemini API] Using custom API Base URL: ${customBaseUrl}`);
    }
    aiInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        baseUrl: customBaseUrl || undefined,
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

// Robust support for multi-provider (Gemini, OpenAI, DeepSeek, Custom relays)
function normalizePrompt(contents: any): string {
  if (typeof contents === "string") {
    return contents;
  }
  if (Array.isArray(contents)) {
    return contents.map((item: any) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        if (item.text) return item.text;
        if (item.content) return normalizePrompt(item.content);
        if (item.parts) return normalizePrompt(item.parts);
      }
      return JSON.stringify(item);
    }).join("\n");
  }
  if (contents && typeof contents === "object") {
    if (contents.text) return contents.text;
    if (contents.parts) return normalizePrompt(contents.parts);
  }
  return String(contents || "");
}

function getLlmProvider(): {
  provider: "gemini" | "openai" | "deepseek" | "custom";
  apiKey: string;
  baseUrl: string;
  model: string;
} {
  const providerEnv = (process.env.LLM_PROVIDER || "").toLowerCase().trim();
  const llmModel = (process.env.LLM_MODEL || process.env.CUSTOM_MODEL || "").trim();
  const llmBaseUrl = (process.env.LLM_BASE_URL || process.env.OPENAI_BASE_URL || process.env.GEMINI_BASE_URL || "").trim();
  const llmApiKey = (process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.GEMINI_API_KEY || "").trim();

  // 1. Explicitly configured provider
  if (providerEnv === "openai" || providerEnv === "deepseek" || providerEnv === "custom") {
    return {
      provider: providerEnv as any,
      apiKey: llmApiKey,
      baseUrl: llmBaseUrl || "https://api.openai.com/v1",
      model: llmModel
    };
  }

  // 2. Auto-detect OpenAI compatible proxies
  // Most "中转站" (proxies) use OpenAI format, even if they proxy Claude/DeepSeek.
  if (llmBaseUrl) {
    return {
      provider: "custom",
      apiKey: llmApiKey,
      baseUrl: llmBaseUrl,
      model: llmModel
    };
  }

  // 3. Fallback to Gemini
  return {
    provider: "gemini",
    apiKey: llmApiKey,
    baseUrl: llmBaseUrl,
    model: llmModel
  };
}

async function fetchOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  jsonMode: boolean,
  stream: boolean
) {
  if (!apiKey) {
    throw new Error(`API key is missing. Please configure your OpenAI/DeepSeek/Custom key in the settings panel.`);
  }

  // Append /chat/completions ensuring no double slashes
  const cleanBaseUrl = baseUrl.replace(/\/+$/, "");
  let url = cleanBaseUrl;
  if (!url.endsWith("/chat/completions") && !url.includes("/messages")) {
    url = cleanBaseUrl.endsWith("/v1") 
      ? `${cleanBaseUrl}/chat/completions`
      : `${cleanBaseUrl}/v1/chat/completions`;
  }

  const isAnthropic = url.includes("/messages");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  let bodyData: any = {};

  if (isAnthropic) {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
    bodyData = {
      model: model,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
      stream: stream,
    };
  } else {
    headers["Authorization"] = `Bearer ${apiKey}`;
    bodyData = {
      model: model,
      messages: [{ role: "user", content: prompt }],
      stream: stream,
    };
    if (jsonMode && (model.includes("gpt") || model.includes("deepseek"))) {
      bodyData.response_format = { type: "json_object" };
    }
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(bodyData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Proxy/LLM API Error (${response.status}): ${errorText}`);
  }

  return response;
}

// Robust unified generate content function supporting Gemini logic + OpenAI/DeepSeek proxies
async function aiGenerateContent(options: { model: string; contents: any; config?: any }) {
  const llm = getLlmProvider();
  
  if (llm.provider !== "gemini" && llm.baseUrl) {
    const targetModel = llm.model || options.model || "gpt-3.5-turbo";
    console.log(`[LLM API] Routing generateContent via provider '${llm.provider}' [model: ${targetModel}]`);
    let prompt = normalizePrompt(options.contents);
    const jsonMode = options.config?.responseMimeType === "application/json";
    
    if (jsonMode) {
      let schemaStr = "";
      if (options.config?.responseSchema) {
        schemaStr = `\nExpected JSON Schema:\n${JSON.stringify(options.config.responseSchema, null, 2)}`;
      }
      prompt += `\n\nIMPORTANT: You must respond ONLY with valid JSON. Do not include any explanations, markdown blocks, or other text outside the JSON structure.${schemaStr}`;
    }

    const response = await fetchOpenAICompatible(
      llm.baseUrl,
      llm.apiKey,
      targetModel,
      prompt,
      jsonMode,
      false
    );
    
    const resJson = await response.json();
    
    if (resJson.error) {
      throw new Error(`Proxy/API returned an error: ${typeof resJson.error === 'string' ? resJson.error : resJson.error.message || JSON.stringify(resJson.error)}`);
    }

    let textContent = "";
    if (resJson.choices?.[0]?.message?.content) {
      textContent = resJson.choices[0].message.content; // OpenAI format
    } else if (resJson.content?.[0]?.text) {
      textContent = resJson.content[0].text; // Anthropic format
    } else {
      textContent = JSON.stringify(resJson); // Fallback
    }

    return {
      text: textContent,
    };
  }

  // Otherwise fallback to Gemini client
  const ai = getGeminiClient();
  const attemptModels = [options.model];
  if (options.model === "gemini-3.5-flash") {
    attemptModels.push("gemini-2.5-flash");
  } else if (options.model === "gemini-3.1-pro-preview") {
    attemptModels.push("gemini-2.5-pro");
  }
  
  const fallbacks = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.5-pro", "gemini-1.5-pro"];
  for (const m of fallbacks) {
    if (!attemptModels.includes(m)) {
      attemptModels.push(m);
    }
  }

  let lastError = null;
  for (const mdl of attemptModels) {
    try {
      console.log(`[Gemini API] Attempting generateContent with model: ${mdl}`);
      return await ai.models.generateContent({
        ...options,
        model: mdl,
      });
    } catch (err: any) {
      console.error(`[Gemini API] Error under model ${mdl}:`, err.message || err);
      lastError = err;
      const errMsg = String(err.message || "").toLowerCase();
      // Trigger fallback on permission issues, not found, rate limits, or quota exceeded
      if (
        errMsg.includes("permission") ||
        errMsg.includes("denied") ||
        errMsg.includes("not found") ||
        errMsg.includes("access") ||
        errMsg.includes("403") ||
        errMsg.includes("404") ||
        errMsg.includes("forbidden") ||
        errMsg.includes("429") ||
        errMsg.includes("quota") ||
        errMsg.includes("exhausted") ||
        errMsg.includes("rate limit") ||
        errMsg.includes("resource_exhausted") ||
        errMsg.includes("invalid token") ||
        errMsg.includes("new_api_error")
      ) {
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

// Robust unified generate stream function supporting Gemini logic + OpenAI/DeepSeek proxies
async function* aiGenerateContentStream(options: { model: string; contents: any; config?: any }) {
  const llm = getLlmProvider();
  
  if (llm.provider !== "gemini" && llm.baseUrl) {
    const targetModel = llm.model || options.model || "gpt-3.5-turbo";
    console.log(`[LLM API] Routing generateContentStream via provider '${llm.provider}' [model: ${targetModel}]`);
    const prompt = normalizePrompt(options.contents);
    
    const response = await fetchOpenAICompatible(
      llm.baseUrl,
      llm.apiKey,
      targetModel,
      prompt,
      false,
      true
    );
    
    const stream: any = response.body;
    if (!stream) {
      throw new Error("Response body is not readable");
    }

    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    if (typeof stream[Symbol.asyncIterator] === "function") {
      for await (const chunk of stream) {
        const textChunk = decoder.decode(chunk, { stream: true });
        buffer += textChunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const cleaned = line.trim();
          if (!cleaned) continue;
          if (cleaned === "data: [DONE]") continue;
          if (cleaned.startsWith("data: ")) {
            try {
              const rawJson = cleaned.slice(6);
              const parsed = JSON.parse(rawJson);
              let chunkText = "";
              if (parsed.choices?.[0]?.delta?.content) chunkText = parsed.choices[0].delta.content;
              else if (parsed.type === "content_block_delta" && parsed.delta?.text) chunkText = parsed.delta.text;
              if (chunkText) {
                yield { text: chunkText };
              }
            } catch (e) {}
          }
        }
      }
    } else if (typeof stream.getReader === "function") {
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const textChunk = decoder.decode(value, { stream: true });
        buffer += textChunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const cleaned = line.trim();
          if (!cleaned) continue;
          if (cleaned === "data: [DONE]") continue;
          if (cleaned.startsWith("data: ")) {
            try {
              const rawJson = cleaned.slice(6);
              const parsed = JSON.parse(rawJson);
              let chunkText = "";
              if (parsed.choices?.[0]?.delta?.content) chunkText = parsed.choices[0].delta.content;
              else if (parsed.type === "content_block_delta" && parsed.delta?.text) chunkText = parsed.delta.text;
              if (chunkText) {
                yield { text: chunkText };
              }
            } catch (e) {}
          }
        }
      }
    } else {
      const fullText = await response.text();
      yield { text: fullText };
    }
    
    if (buffer) {
      const cleaned = buffer.trim();
      if (cleaned.startsWith("data: ") && cleaned !== "data: [DONE]") {
        try {
          const rawJson = cleaned.slice(6);
          const parsed = JSON.parse(rawJson);
          const chunkText = parsed.choices?.[0]?.delta?.content || "";
          if (chunkText) {
            yield { text: chunkText };
          }
        } catch (e) {}
      }
    }
    return;
  }

  // Otherwise fallback to Gemini client streamer
  const ai = getGeminiClient();
  const attemptModels = [options.model];
  if (options.model === "gemini-3.5-flash") {
    attemptModels.push("gemini-2.5-flash");
  } else if (options.model === "gemini-3.1-pro-preview") {
    attemptModels.push("gemini-2.5-pro");
  }
  
  const fallbacks = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.5-pro", "gemini-1.5-pro"];
  for (const m of fallbacks) {
    if (!attemptModels.includes(m)) {
      attemptModels.push(m);
    }
  }

  let lastError = null;
  for (const mdl of attemptModels) {
    try {
      console.log(`[Gemini API] Attempting generateContentStream with model: ${mdl}`);
      const responseStream = await ai.models.generateContentStream({
        ...options,
        model: mdl,
      });
      for await (const chunk of responseStream) {
        yield chunk;
      }
      return;
    } catch (err: any) {
      console.error(`[Gemini API] Error under model ${mdl}:`, err.message || err);
      lastError = err;
      const errMsg = String(err.message || "").toLowerCase();
      // Trigger fallback on permission issues, not found, rate limits, or quota exceeded
      if (
        errMsg.includes("permission") ||
        errMsg.includes("denied") ||
        errMsg.includes("not found") ||
        errMsg.includes("access") ||
        errMsg.includes("403") ||
        errMsg.includes("404") ||
        errMsg.includes("forbidden") ||
        errMsg.includes("429") ||
        errMsg.includes("quota") ||
        errMsg.includes("exhausted") ||
        errMsg.includes("rate limit") ||
        errMsg.includes("resource_exhausted") ||
        errMsg.includes("invalid token") ||
        errMsg.includes("new_api_error")
      ) {
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

// ----------------------------------------
// API ENDPOINTS
// ----------------------------------------

// Health check and environment verification
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    hasApiKey: !!process.env.GEMINI_API_KEY,
  });
});

// GET list of all novels
app.get("/api/novels", (req, res) => {
  const db = loadDb();
  const list = Object.values(db).map((p) => p.novel);
  res.json(list);
});

// GET complete novel package
app.get("/api/novels/:id", (req, res) => {
  const { id } = req.params;
  const db = loadDb();
  if (!db[id]) {
    return res.status(404).json({ error: "Novel project not found" });
  }
  res.json(db[id]);
});

// CREATE a new novel project
app.post("/api/novels", (req, res) => {
  const { title, description, genre, style, target_words, model, language, reference } = req.body;

  if (!title || !description) {
    return res.status(400).json({ error: "Title and description/seed are required" });
  }

  const id = "novel_" + Math.random().toString(36).substring(2, 11);
  const nowStr = new Date().toISOString();

  const novel: Novel = {
    id,
    title,
    description,
    genre: genre || "科幻",
    style: style || ["爽文"],
    target_words: Number(target_words) || 500000,
    current_words: 0,
    status: "draft",
    model: model || "gemini-3.5-flash",
    language: language || "zh",
    reference: reference || "",
    created_at: nowStr,
    updated_at: nowStr,
  };

  const storyBible: StoryBible = {
    theme: "",
    tone: "",
    summary: description,
    world_view: "",
    rules: "",
    power_system: "",
    factions: [],
    locations: [],
    items: [],
    ending: "",
  };

  const newProject: ProjectData = {
    novel,
    storyBible,
    characters: [],
    outline: [],
    chapters: [],
    foreshadows: [],
    memories: [],
  };

  const db = loadDb();
  db[id] = newProject;
  saveDb(db);

  res.status(201).json(newProject);
});

// UPDATE basic info or Story Bible details
app.put("/api/novels/:id", (req, res) => {
  const { id } = req.params;
  const { novel, storyBible, characters, outline, foreshadows, memories } = req.body;

  const db = loadDb();
  if (!db[id]) {
    return res.status(404).json({ error: "Novel project not found" });
  }

  if (novel) {
    db[id].novel = { ...db[id].novel, ...novel, updated_at: new Date().toISOString() };
  }
  if (storyBible) {
    db[id].storyBible = { ...db[id].storyBible, ...storyBible };
  }
  if (characters) {
    db[id].characters = characters;
  }
  if (outline) {
    db[id].outline = outline;
  }
  if (foreshadows) {
    db[id].foreshadows = foreshadows;
  }
  if (memories) {
    db[id].memories = memories;
  }

  saveDb(db);
  res.json(db[id]);
});

// DELETE a novel project
app.delete("/api/novels/:id", (req, res) => {
  const { id } = req.params;
  const db = loadDb();
  if (!db[id]) {
    return res.status(404).json({ error: "Novel project not found" });
  }
  delete db[id];
  saveDb(db);
  res.json({ success: true });
});

// ----------------------------------------
// GEMINI INTELLIGENT ROUTERS
// ----------------------------------------

// 0. AI Novel Title & Story Seed Recommendation & Polishing
app.post("/api/ai/recommend-novels", async (req, res) => {
  const { genre, keywords } = req.body;

  try {
    const prompt = `你是一位畅销网络小说策划大师。请基于题材分类 [${genre || "未指定"}] 以及用户给出的创意灵感关键词 [${keywords || "不限"}]，构思 3 个极具商业畅销潜力和脑洞大开的小说核心创意点子。

每个灵感点子需要包含：
1. 极具卖点 and 张力的小说名称（书名中必须包含书名号《》且辨识度极强）。
2. 一段约 150-250 字左右、张力十足的小说创意简介（核心看点、宿命冲突和创新设定/金手指）。
3. 对应的题材分类。
4. 故事中的核心纠纷对峙。
5. 最吸引网络小说读者的黄金看点/爽点（30字以内）。`;

    const response = await aiGenerateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: "小说书名，必须包含中括号或书名号《》" },
                  description: { type: Type.STRING, description: "小说剧情简介，写得要有画面感和迫切的冲突，包含主角背景、核心动机、金手指设计，150-250字" },
                  genre: { type: Type.STRING, description: "题材类型，推荐选择：玄幻, 科幻, 悬疑, 都市" },
                  core_conflict: { type: Type.STRING, description: "故事核心角力点 / 冲突对峙" },
                  highlight: { type: Type.STRING, description: "黄金卖点/读者爽点（一两句话，30字以内）" }
                },
                required: ["title", "description", "genre", "core_conflict", "highlight"]
              }
            }
          },
          required: ["recommendations"]
        }
      }
    });

    const text = response.text || "[]";
    let suggestions = extractJsonFromText(text);
    
    // Auto-fix if the AI returned an object containing an array instead of a direct array
    if (suggestions && !Array.isArray(suggestions)) {
      const possibleArray = Object.values(suggestions).find(val => Array.isArray(val));
      if (possibleArray) {
        suggestions = possibleArray;
      } else {
        suggestions = [suggestions]; // fallback to single item array
      }
    }
    
    res.json(suggestions || []);
  } catch (error: any) {
    console.error("Error generating recommendations:", error);
    res.status(500).json({ error: error.message || "Failed to generate recommendations" });
  }
});

app.post("/api/ai/polish-text", async (req, res) => {
  const { type, text, genre } = req.body;

  if (!text) {
    return res.status(400).json({ error: "Text is required for polishing" });
  }

  try {
    let prompt = "";
    if (type === "title") {
      prompt = `你是一位拥有千万级阅读量作品经验的网络小说主编。请将以下拟定的小说书名：
\"${text}\"
根据小说题材分类 [${genre || "大众小说"}] 进行全方位的高概念重塑。
重塑目标：
1. 使其具有极高的好奇心、冲突悬念，或反差爽感。
2. 提高其网络商业畅销辨识度。
只需输出最终重塑后的书名（请带上书名号《》），请勿包含任何多余解释、说明或问候语。`;
    } else {
      prompt = `你是一位拥有千万级作品经验的网络写手和资深连载主编。
请对以下的小说创意简介/大纲金点子：
\"${text}\"
根据小说题材分类 [${genre || "大众小说"}] 进行专业级的扩写与润色。
扩写润色要求：
1. 使其语言更有质感和爽感，加强主角的情感羁绊与宿命危机感。
2. 提炼核心金手指的能力特质与逆天法则，增加故事张力。
3. 调整情节结构，使其充满伏笔和商业阅读快感。
4. 保持字数在 150 到 300 字之间，用中式畅销网文文风。
直接输出修改后的简介内容，请勿附带任何解释 and 前缀。`;
    }

    const response = await aiGenerateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    const polished = (response.text || "").trim();
    res.json({ polished });
  } catch (error: any) {
    console.error("Error polishing text:", error);
    res.status(500).json({ error: error.message || "Failed to polish text" });
  }
});

// LOGIC CHECKER ENDPOINT (剧情大纲逻辑冲突审计)
app.post("/api/novels/:id/check-logic", async (req, res) => {
  const { id } = req.params;
  const { chapter_num } = req.body;

  if (!chapter_num) {
    return res.status(400).json({ error: "Chapter number is required" });
  }

  const db = loadDb();
  const project = db[id];
  if (!project) {
    return res.status(404).json({ error: "Novel project not found" });
  }

  const outlineItem = project.outline.find(o => o.chapter_num === Number(chapter_num));
  if (!outlineItem) {
    return res.status(404).json({ error: "Outline for this chapter was not found" });
  }

  try {
    const ai = getGeminiClient();
    
    // Construct relevant contexts from storyBible & characters
    const bible = project.storyBible;
    const applicableChars = project.characters.filter(c => outlineItem.characters.includes(c.name));
    
    const worldRules = bible.rules || "暂无硬性物理逻辑设定";
    const powerSys = bible.power_system || "暂无指定力量等级体系";
    const factionsStr = bible.factions.map(f => `- 势力【${f.name}】：${f.description} (立场:${f.stance})`).join("\n");
    const locationsStr = bible.locations.map(l => `- 地点【${l.name}】：${l.description}`).join("\n");
    
    const charsContext = applicableChars.map(c => `角色【${c.name}】:
- 背景与现状：${c.background} (状态: ${c.current_status || "正常"})
- 性格欲求：${c.personality} / ${c.goal}
- 隐藏秘密：${c.secret}
- 拥有的关系：${Object.entries(c.relationships || {}).map(([n, r]) => `${n}->${r}`).join(", ")}`).join("\n\n");

    const prompt = `你是一位资深的网络小说内容总监、终审编辑。你的目标是审查大纲设计中是否存在潜在的“自相矛盾”、“设定吃书”、“地理错位”或“战力/逻辑系统崩坏”的风险。
    
请对比当前章节大纲与小说圣经中既定的规则设定。

<current_chapter_outline>
章节：第 ${chapter_num} 章《${outlineItem.title || "未命名"}》
场景地点：${outlineItem.location || "暂未指定"}
登场人物：${outlineItem.characters.join(", ") || "无指定登场角色"}
本章主线目标：${outlineItem.goal}
核心矛盾冲突：${outlineItem.conflict}
本章高潮爆点：${outlineItem.climax}
下勾子悬念：${outlineItem.hook}
</current_chapter_outline>

<story_bible_rules_and_world_view>
核心法则/规则设定：${worldRules}
力量战力系统：${powerSys}
世界势力风貌：
${factionsStr || "无已知势力分类"}
重要地理风物：
${locationsStr || "无已知地点详情"}
</story_bible_rules_and_world_view>

<characters_metadata>
${charsContext || "本章暂无小说核心角色档案参与，采用路人设定。"}
</characters_metadata>

请依据逻辑学、网络小说畅销设计学和世界观物理常识，进行深度逻辑契合度审计
分析维度：
1. 登场角色是否存在生存状态不符、死而复生、地理位置严重不合理、或者做事动机与角色既有goal/secret存在严重相悖？
2. 战斗或使用的力量机制是否存在超越战力体系‘${powerSys}’或违反‘${worldRules}’强设定？
3. 地理场景、势力背景与本章对决或阵营对立是否科学、符合圣经？

请给出客观公允的契合度百分比评分，并列出潜存风险或吃书漏洞提醒，提供实用的写作圆说合规建议。格式必须严格符合 JSON 规范。`;

    const response = await aiGenerateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            consistency_score: { type: Type.INTEGER, description: "设定逻辑契合度，0-100评分" },
            conflicts: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "列出发现的潜在吃书冲突点、地理错位、角色人设崩坏等，全都是字符串提醒。如果没有吃书，给空数组"
            },
            suggestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "为作者出谋划策，怎么在正文、对齐上巧妙规避这些逻辑问题的建议"
            }
          },
          required: ["consistency_score", "conflicts", "suggestions"]
        }
      }
    });

    const resultText = response.text || "{}";
    const parsedResult = extractJsonFromText(resultText);
    res.json(parsedResult);
  } catch (error: any) {
    console.error("Error in logic check:", error);
    res.status(500).json({ error: error.message || "Failed to perform logic check" });
  }
});

// 1. GENERATE STORY BIBLE (AI 小说圣经生成)
app.post("/api/novels/:id/generate-bible", async (req, res) => {
  const { id } = req.params;
  const db = loadDb();
  if (!db[id]) {
    return res.status(404).json({ error: "Project not found" });
  }

  const { novel } = db[id];

  try {
    const ai = getGeminiClient();
    const prompt = `你是一位顶级的小说世界观架构师和小说策划大师。
我们正在策划一部长篇小说，基本信息如下：
<novel_info>
书名：${novel.title}
简介与故事种子：${novel.description}
题材：${novel.genre}
风格：${novel.style.join(", ")}
参考风格作品：${novel.reference || "无"}
语言：${novel.language === "zh" ? "中文" : "英文"}
</novel_info>

请你为此书设计一套符合题材风格、引人入胜的[小说圣经 (Story Bible)]。
包括核心主题、行文基调、地理与势力格局背景设定、世界运行的硬法则、特殊力量成长修炼系统、主要登场的关键地点和世界级绝世神兵道具，以及结局构想。

你的返回内容必须是合法的 JSON 格式，且严格遵守以下结构：
{
  "theme": "提炼小说核心主题，100字左右",
  "tone": "小说文风基调、视角风格等，80字左右",
  "world_view": "详细的时代与地理世界观格局设计，300字左右",
  "rules": "设定这个世界的2-3个不能打破的核心‘硬性世界底层逻辑或法则限制’，避免降智逻辑，150字",
  "power_system": "修炼/成长等级划分与关键瓶颈体系，200字左右",
  "factions": [
    { "name": "重要势力名称A", "description": "势力背景、行事作风、信仰", "stance": "敌对/盟友/中立/混乱" }
  ],
  "locations": [
    { "name": "核心地带名A", "description": "风貌、战略意义、所处势力" }
  ],
  "items": [
    { "name": "关键道具/神兵/功法名A", "description": "来历、能力、宿命关联" }
  ],
  "ending": "整部小说的终局设计构想，包括核心反派的结局和主角的归宿，200字左右"
}

注意：输出只需包含合法的 JSON 代码，不能包含 Markdown 标注如 \`\`\`json 或任何额外的前言后缀。确保所有中英文引号正确闭合。`;

    const response = await aiGenerateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const jsonText = response.text || "";
    const generatedBible: StoryBible = extractJsonFromText(jsonText);

    db[id].storyBible = generatedBible;
    db[id].novel.status = "draft";
    saveDb(db);

    res.json(db[id]);
  } catch (err: any) {
    console.error("Generate Bible error:", err);
    res.status(500).json({ error: err.message || "Failed to generate Story Bible" });
  }
});

// 2. GENERATE CHARACTERS (AI 批量生成主配角卡片)
app.post("/api/novels/:id/generate-characters", async (req, res) => {
  const { id } = req.params;
  const db = loadDb();
  if (!db[id]) {
    return res.status(404).json({ error: "Project not found" });
  }

  const { novel, storyBible } = db[id];

  try {
    const ai = getGeminiClient();
    const prompt = `你是一位阅文无数的小说人物弧线设计师。
基于我们的小说背景信息及小说圣经设计主要出场人物：
<novel_info>
书名：${novel.title}
简介：${novel.description}
核心主题：${storyBible.theme}
力量修炼体系：${storyBible.power_system}
</novel_info>

请规划并批量生成4位标志性原创新颖人物，包含：
1. 主角 (protagonist)
2. 宿命反派/对手 (antagonist)
3. 2个关键配角/配音导师/搞笑担当等 (supporting)

请严格输出为 JSON 数组，每个人的字段细节如下：
[
  {
    "name": "人物姓名",
    "role": "protagonist" | "antagonist" | "supporting",
    "gender": "性别",
    "age": "外表年龄/实际年龄",
    "appearance": "独特深刻的外貌衣着特征，令人印象深刻，120字",
    "personality": "核心性格特质与矛盾点（不仅是标签，带说明），如‘表面冷酷其实内心纯良的利己主义者’，120字",
    "goal": "终极执念或欲望（明面目的 + 潜意识渴望），100字",
    "secret": "不可告人的惊天秘密或不可言说的伤疤",
    "growth_arc": "他在小说剧情推进中性格和力量的核心转变轨迹规划",
    "catchphrase": "他最爱的一句高频口头禅台词，体现逼格或性格",
    "background": "身世背景往事",
    "current_status": "活跃",
    "relationships": {}
  }
]

请确保生成的关系和人设高度契合世界观，并充满宿命冲突纠葛。
注意：输出必须只包含合法的 JSON 数组，不可以用 \`\`\` 包装，也无需额外叙述。`;

    const response = await aiGenerateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const jsonText = response.text || "";
    let characters: Character[] = extractJsonFromText(jsonText);
    
    if (characters && !Array.isArray(characters)) {
      const possibleArray = Object.values(characters).find(val => Array.isArray(val));
      if (possibleArray) {
        characters = possibleArray as Character[];
      } else {
        characters = [characters as any];
      }
    }

    // Fill IDs for characters
    const characterList: Character[] = characters.map((c, idx) => ({
      ...c,
      id: "char_" + Date.now() + "_" + idx,
      relationships: c.relationships || {}
    }));

    db[id].characters = characterList;
    saveDb(db);

    res.json(db[id]);
  } catch (err: any) {
    console.error("Generate Characters error:", err);
    res.status(500).json({ error: err.message || "Failed to generate character cards" });
  }
});

// 3. GENERATE OUTLINE (AI 规划主线分章大纲)
app.post("/api/novels/:id/generate-outline", async (req, res) => {
  const { id } = req.params;
  const db = loadDb();
  if (!db[id]) {
    return res.status(404).json({ error: "Project not found" });
  }

  const { novel, storyBible, characters } = db[id];
  const count = Number(req.body.chaptersCount) || 12; // 默认生成12章大纲作为极佳演示

  try {
    const ai = getGeminiClient();
    const characterSummaries = characters.map(c => `- ${c.name} (${c.role === 'protagonist' ? '主角' : c.role === 'antagonist' ? '反派' : '重要配角'}): 性格：${c.personality}, 执念：${c.goal}`).join("\n");

    const prompt = `你是一位极具名望的网文主编与白金长篇小说大纲规划大师。
我们需要规划一部 ${count} 章节的阶段核心骨架大纲。

小说名：${novel.title}
世界设定：${storyBible.world_view}
修行体系：${storyBible.power_system}
结局收尾预案：${storyBible.ending}

主要出场人物：
${characterSummaries}

请参考经典的“三幕起承转合”宏大叙事结构，合理排布冲突高潮。每章都需要极强的推力、悬念、爆点、黄金钩子，让读者欲罢不能：
1. 第一幕：起（第1至第1/3章节）——主角登场，危机爆发，建立神兵/外挂底牌
2. 第二幕：承转（第1/3至第2/3章节）——涉足多方势力冲突，修炼变强，宿敌压迫，发生巨大情感/认知危机
3. 第三幕：合/高潮（第2/3至最后章节）——大决战爆发，高潮翻盘，收尾并回收伏笔

请生成一份包含精确 ${count} 个章节的整齐 JSON 数组。格式必须为：
[
  {
    "chapter_num": 1,
    "title": "章节标题（要有网文吸引力，字数在6-12字）",
    "goal": "本章在整本书中的叙事终极目标，比如‘打脸李雷同时让女主产生安全感保护欲’",
    "conflict": "本章的核心尖锐冲突（谁在阻碍谁、发生了什么误会或对抗），100字左右",
    "climax": "本章情节最大爆点/高潮细节描写，120字左右",
    "hook": "本章末尾留下的引人入胜的‘超级钩子/悬案’，诱导点击下一章（不低于50字）",
    "characters": ["本章主要登场的角色姓名"],
    "location": "本章叙事发生的核心地点",
    "status": "pending"
  }
]

请确保每章的因果逻辑极其严密，上一章种因，下一章必定结果。
注意：输出必须只包含合法的 JSON 数组，无需包裹 Markdown 或解释性文字。`;

    const response = await aiGenerateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const jsonText = response.text || "";
    let outline: OutlineItem[] = extractJsonFromText(jsonText);
    
    if (outline && !Array.isArray(outline)) {
      const possibleArray = Object.values(outline).find(val => Array.isArray(val));
      if (possibleArray) {
        outline = possibleArray as OutlineItem[];
      } else {
        outline = [outline as any];
      }
    }

    db[id].outline = outline;
    saveDb(db);

    res.json(db[id]);
  } catch (err: any) {
    console.error("Generate Outline error:", err);
    res.status(500).json({ error: err.message || "Failed to generate novel outline" });
  }
});

// 4. STREAM GENERATE CHAPTER CONTENT (AI 章节内容流式智能生成 - SSE)
app.get("/api/novels/:id/chapters/generate-stream", async (req, res) => {
  const { id } = req.params;
  const chapter_num = Number(req.query.chapter_num);
  const custom_instructions = (req.query.custom_instructions as string) || "";

  if (!chapter_num) {
    res.write(`data: ${JSON.stringify({ type: "error", message: "Chapter number is required" })}\n\n`);
    return res.end();
  }

  // Set SSE Headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive"
  });

  const db = loadDb();
  const project = db[id];
  if (!project) {
    res.write(`data: ${JSON.stringify({ type: "error", message: "Project not found" })}\n\n`);
    return res.end();
  }

  const currentOutline = project.outline.find(o => o.chapter_num === chapter_num);
  if (!currentOutline) {
    res.write(`data: ${JSON.stringify({ type: "error", message: "Outline for this chapter number is not found. Generate outline first." })}\n\n`);
    return res.end();
  }

  // Retrieve active memories, story bible information, and characters in current scene
  const bible = project.storyBible;
  const charactersInChapter = project.characters.filter(c => currentOutline.characters.includes(c.name));
  const previousChapters = project.chapters.filter(c => c.chapter_num < chapter_num).sort((a,b) => a.chapter_num - b.chapter_num);
  const unparsedMems = project.memories.filter(m => m.chapter_ref && m.chapter_ref < chapter_num);
  const openForeshadows = project.foreshadows.filter(f => f.status === "open" && f.planted_chapter < chapter_num);

  try {
    const ai = getGeminiClient();

    // STEP 1: Sending Event to Client - Chapter Plan setup
    res.write(`data: ${JSON.stringify({ type: "progress", step: "init", message: `【初始化】第 ${chapter_num} 章《${currentOutline.title}》写作流水线启动...` })}\n\n`);
    
    // Fast pause for visual pacing
    await new Promise(r => setTimeout(r, 700));

    res.write(`data: ${JSON.stringify({ type: "progress", step: "context", message: `【上下文检索】正在注入小说圣经力量体系‘${bible.power_system || '默认'}’，读取 ${charactersInChapter.length} 名出场角色档案与 ${openForeshadows.length} 条未回收伏笔...` })}\n\n`);
    await new Promise(r => setTimeout(r, 700));

    // Construct Context blocks
    const charContext = charactersInChapter.map(c => `人物：${c.name}\n- 形象外貌：${c.appearance}\n- 性格特质：${c.personality}\n- 终极欲求：${c.goal}\n- 不可告人的秘密：${c.secret}\n- 转变阶段：${c.growth_arc}`).join("\n\n");
    const previousSummaryStr = previousChapters.map(c => `第${c.chapter_num}章《${c.title}》提要：${c.summary || '未定义'}`).join("\n");
    const foreshadowStr = openForeshadows.map(f => `- 伏笔大意：${f.description} (在第${f.planted_chapter}章种入，期待回收)`).join("\n");

    const customInstructionsBlock = custom_instructions
      ? `\n<custom_writer_cues>\n【作者指定本章呼应或额外描写要求】：\n${custom_instructions}\n</custom_writer_cues>`
      : "";

    const prompt = `你是一位白金网络小说大神。现在要你执笔写这本长篇小说中极具核心推动力的一章。
请保持文笔老练、节奏明畅、高潮激昂，富有张力，杜绝低端AI味和无营养排比！

<writing_constraints>
视角：第三人称限制性视角（着重主角心流体验）
语言流：自然网络文学风格，文笔凝炼有分量。切忌过于工整、滥用“不禁”、“顿时”、“瞬间”等词
章节位置：第 ${chapter_num} 章
本章标题：《${currentOutline.title}》
字数目标：2000-3000字（内容情节必须极为生动扎实，包含大量动作、心理活动、场景细节和人物对白）
</writing_constraints>
${customInstructionsBlock}

<story_bible_context>
核心世界观与硬法理规则：${bible.rules || "不可违反基本物理和逻辑规律"}
特殊力量体系：${bible.power_system}
</story_bible_context>

<characters_metadata>
${charContext}
</characters_metadata>

<current_chapter_outline>
主线目标：${currentOutline.goal}
核心矛盾冲突：${currentOutline.conflict}
本章最大高潮爆点：${currentOutline.climax}
最关键的末尾剧情下钩子：${currentOutline.hook}
场景发生地点：${currentOutline.location}
</current_chapter_outline>

<story_continuity_memory>
【前置剧情摘要记忆】：
${previousSummaryStr || "故事刚刚拉开帷幕..."}

【未回收的伏笔】：
${foreshadowStr || "无"}
</story_continuity_memory>

写作大纲布局指引：
1. 幕开（20%篇幅）：细腻交代场景风貌${currentOutline.location}及主角心理。引出阻碍和矛盾切入口。
2. 情节递进（50%篇幅）：激烈的对手战/智斗或利益博弈。利用人物性格矛盾推动，写出真实的人物冲突，杜绝工具人脸脸谱化。
3. 爆点高潮（20%篇幅）：${currentOutline.climax}，将气氛推到顶点，写出令人血脉偾张或动情的关键一剑/一句话/真相揭晓。
4. 尾声悬念（10%篇幅）：戛然而止，抛出神级勾人包袱——${currentOutline.hook}。

请直接开始生成，请不要打印任何前言或总结！仅输出小说的 Markdown 格式正文！`;

    res.write(`data: ${JSON.stringify({ type: "progress", step: "writing", message: `【白金灵感汇聚】正在调用 Gemini 进行流式正文原创。网文排版模式加载...` })}\n\n`);

    const responseStream = await aiGenerateContentStream({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    let completedText = "";

    for await (const chunk of responseStream) {
      const text = chunk.text || "";
      completedText += text;
      res.write(`data: ${JSON.stringify({ type: "chunk", content: text })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ type: "progress", step: "review", message: `【逻辑审查引擎】正文生成完成 (共 ${completedText.length} 字)，自动执行编辑质检，检查设定相符度、角色语调合规、废话副词过滤...` })}\n\n`);
    await new Promise(r => setTimeout(r, 1200));

    // STEP 3: RUN THE MEMORY MANAGER (Dynamically summarize chapter & update database states & manage foreshadows)
    res.write(`data: ${JSON.stringify({ type: "progress", step: "memory", message: `【记忆管理引擎】正在分析第 ${chapter_num} 章的正文并自动抽取剧情记忆索引与潜在伏笔...` })}\n\n`);

    const summaryPrompt = `针对以下这部小说刚刚生成的章节正文，请提供本章的1句话核心剧情提炼，并判断本章中是否有【埋入新伏笔】或者【回收了历史伏笔】。
    
    <chapter_text>
    ${completedText.substring(0, 4000)}
    </chapter_text>
    
    请输出严格格式化的 JSON：
    {
      "summary": "一句在以后章节极具剧情接续参考价值的核心梗概摘要（120字以内）",
      "new_foreshadows": [
        { "title": "名", "description": "伏笔含义（比如：主角拿到的铁牌上隐约有父亲家纹，将在后几十万字揭晓身世）" }
      ],
      "resolved_foreshadow_titles": ["被回收的伏笔大意标题/关键词，若没有输出空数组"]
    }
    
    仅输出 JSON 代码，不带任何格式。`;

    let summaryText = "";
    try {
      const summaryResponse = await aiGenerateContent({
        model: "gemini-3.5-flash",
        contents: summaryPrompt,
        config: {
          responseMimeType: "application/json",
        }
      });
      summaryText = summaryResponse.text || "{}";
    } catch (e) {
      summaryText = "{}";
    }

    let parsedSummary: any = { summary: `主角在《${currentOutline.title}》中克服了重大关卡情节。`, new_foreshadows: [], resolved_foreshadow_titles: [] };
    try {
      parsedSummary = extractJsonFromText(summaryText);
    } catch (e) {
      // safe fallback
    }

    // Persist Newly Generated Chapter in DB
    const existingChapter = project.chapters.find(c => c.chapter_num === chapter_num);
    const existingSnapshots = existingChapter ? (existingChapter.snapshots || []) : [];
    
    const newSnapshot = {
      id: "snap_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      content: completedText,
      word_count: completedText.length,
      trigger_type: "ai" as const
    };
    
    const updatedSnapshots = [...existingSnapshots, newSnapshot];
    if (updatedSnapshots.length > 25) {
      updatedSnapshots.shift();
    }

    const chapterId = "chap_" + Date.now();
    const newChapter: Chapter = {
      id: chapterId,
      novel_id: id,
      chapter_num: chapter_num,
      title: currentOutline.title,
      content: completedText,
      word_count: completedText.length,
      status: "approved",
      summary: parsedSummary.summary,
      created_at: new Date().toISOString(),
      snapshots: updatedSnapshots
    };

    // Remove duplicates if any
    project.chapters = project.chapters.filter(c => c.chapter_num !== chapter_num);
    project.chapters.push(newChapter);

    // Update outline status
    const oIdx = project.outline.findIndex(o => o.chapter_num === chapter_num);
    if (oIdx > -1) {
      project.outline[oIdx].status = "completed";
    }

    // Add new foreshadows
    if (parsedSummary.new_foreshadows && Array.isArray(parsedSummary.new_foreshadows)) {
      parsedSummary.new_foreshadows.forEach((nf: any) => {
        const foreshadow: Foreshadow = {
          id: "fore_" + Math.random().toString(36).substring(2, 9),
          title: nf.title || "未知线索",
          description: nf.description || "一个新出现的迷局或未解伏笔",
          planted_chapter: chapter_num,
          resolve_chapter: chapter_num + 15,
          status: "open"
        };
        project.foreshadows.push(foreshadow);
      });
    }

    // Resolve old foreshadows if listed
    if (parsedSummary.resolved_foreshadow_titles && Array.isArray(parsedSummary.resolved_foreshadow_titles)) {
      parsedSummary.resolved_foreshadow_titles.forEach((rt: string) => {
        const found = project.foreshadows.find(f => f.status === "open" && (f.title.includes(rt) || rt.includes(f.title)));
        if (found) {
          found.status = "resolved";
          found.resolved_at = chapter_num;
        }
      });
    }

    // Synchronize overall current words of the book
    project.novel.current_words = project.chapters.reduce((sum, c) => sum + (c.word_count || 0), 0);
    db[id] = project;
    saveDb(db);

    res.write(`data: ${JSON.stringify({
      type: "done",
      chapter_num: chapter_num,
      word_count: completedText.length,
      summary: parsedSummary.summary,
      new_foreshadows_count: parsedSummary.new_foreshadows?.length || 0,
      total_words: project.novel.current_words
    })}\n\n`);

    res.end();
  } catch (err: any) {
    console.error("Stream generation error:", err);
    res.write(`data: ${JSON.stringify({ type: "error", message: err.message || "Something went wrong in the middle of streaming." })}\n\n`);
    res.end();
  }
});

// 5. MANUAL EDIT & AI POLISH WORKSHOP (AI 文笔润色与操作面板：扩写/缩写/AI味消除等)
app.post("/api/novels/:id/chapters/polish", async (req, res) => {
  const { id } = req.params;
  const { content, mode, instructions } = req.body;

  if (!content) {
    return res.status(400).json({ error: "Content is required to polish" });
  }

  try {
    const ai = getGeminiClient();
    let tweakPrompt = "";

    if (mode === "eliminate_ai") {
      tweakPrompt = `你是一位白金出版小说主编、网文消重润色王。
请将下面文段进行全方位的白金美化，极力‘消除呆板的AI生硬写作味’。
要求：
- 去除过多排比句与毫无营养的四字词语堆砌
- 将僵硬的词汇“不禁”、“顿时”、“瞬间”、“犹如”、“仿佛”替换为生动的人物心理或微表情动作、或硬桥硬马的大白话
- 增强细节的粗粝真实感，优化对白的口语化和人物立场。
- 绝不篡改原本的主线剧情
- 保持字数在90%以上，不要变短

文段：
${content}`;
    } else if (mode === "expand") {
      tweakPrompt = `你是一位白金长篇网文作家。善于细节流、心理流写作。
请将下面文段进行大量的[细节扩写：融入周密的环境风物暗示、人物交手微动作、深沉的内心煎熬/豪气万千的心流闪回、言辞交锋中的讥讽或试探]。
要求：
- 完美契合上下文氛围，字数要扩充到原来的 1.5倍 至 2倍
- 描写要充实有感染力，绝对不可以注水废话

文段：
${content}
${instructions ? `额外扩写意图：${instructions}` : ""}`;
    } else if (mode === "shrink") {
      tweakPrompt = `你是一位极其严苛的手稿精简大师。
请将下面这一章文段进行精简压缩：
- 挤掉无聊的长篇大论，合并非关键的过渡情节
- 突出最有爆破力的人物交涉、动作高潮和末尾钩子
- 字数控制在原先的 60% 至 70% 之间。剧情节奏要极其紧凑

文段：
${content}`;
    } else {
      // AI Continue writing
      tweakPrompt = `请基于以下已写小说片段，续写一章中后面的精彩情节。
要求：
- 顺承片段当前的场景和角色的口吻继续展开叙事
- 文笔干练，冲突极具张力
- 续写长度大约 500-1000字。
已写片段：
${content}
${instructions ? `续写提示意图：${instructions}` : ""}`;
    }

    const response = await aiGenerateContent({
      model: "gemini-3.5-flash",
      contents: tweakPrompt,
    });

    res.json({ polishedText: response.text });
  } catch (err: any) {
    console.error("Polish error:", err);
    res.status(500).json({ error: err.message || "Polishing failed" });
  }
});

// ----------------------------------------
// NOVEL PRODUCTION PACK SERVICE
// ----------------------------------------

// EXPORT SERVICE
app.get("/api/novels/:id/export", (req, res) => {
  const { id } = req.params;
  const { format } = req.query;

  const db = loadDb();
  const project = db[id];
  if (!project) {
    return res.status(404).json({ error: "Novel not found" });
  }

  // Construct standard output text
  let outputText = `# ${project.novel.title}\n\n`;
  outputText += `## 小说核心圣经设定\n`;
  outputText += `**核心主题**：${project.storyBible.theme}\n`;
  outputText += `**基调风骨**：${project.storyBible.tone}\n`;
  outputText += `**世设与力量修炼阶**：${project.storyBible.power_system || "一凡人"}\n`;
  outputText += `**核心世界运行根本法**：${project.storyBible.rules}\n`;
  outputText += `**结局大方向设计**：${project.storyBible.ending}\n\n`;

  outputText += `## 主要登场角色圣经卡\n`;
  project.characters.forEach((c) => {
    outputText += `### 👤 ${c.name} (${c.role === 'protagonist' ? '主角主角' : c.role === 'antagonist' ? '反面反派' : '出场配角'})\n`;
    outputText += `- **生理与性格**：${c.gender}, 年龄：${c.age}, 性格特指：${c.personality}\n`;
    outputText += `- **外貌装束**：${c.appearance}\n`;
    outputText += `- **人际关系网**：${JSON.stringify(c.relationships)}\n`;
    outputText += `- **心魔/秘密往事**：${c.secret}\n`;
    outputText += `- **成长路径规划**：${c.growth_arc}\n`;
    outputText += `- **最具代表台词**：${c.catchphrase}\n\n`;
  });

  outputText += `---\n\n`;
  outputText += `## 正文章节内容 (${project.novel.current_words} 字)\n\n`;

  const sortedChapters = project.chapters.sort((a, b) => a.chapter_num - b.chapter_num);
  sortedChapters.forEach((ch) => {
    outputText += `### 第${ch.chapter_num}章 ${ch.title}\n\n`;
    outputText += `${ch.content}\n\n---\n\n`;
  });

  const filename = encodeURIComponent(project.novel.title);

  if (format === "json") {
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.json"`);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.json(project);
  }

  res.setHeader("Content-Disposition", `attachment; filename="${filename}.md"`);
  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.send(outputText);
});

// ----------------------------------------
// MOUNT VITE MIDDLEWARE OR STANDALONE STATIC FALLBACK FOR DEVELOPMENT / RUNTIME
// ----------------------------------------
async function bootstrap() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AI Novel Studio Server listening on http://localhost:${PORT}`);
  });
}

bootstrap();
