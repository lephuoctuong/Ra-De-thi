import express from "express";
import path from "path";
import fs from "fs";
// Gemini is called through the official REST API from the server only.
// This avoids bundler/runtime incompatibilities with the client SDK on Vercel.
const Type = {
  STRING: "STRING",
  NUMBER: "NUMBER",
  INTEGER: "INTEGER",
  BOOLEAN: "BOOLEAN",
  OBJECT: "OBJECT",
  ARRAY: "ARRAY",
} as const;

import { EXTRACTION_INVALID_MESSAGE, isValidExtractedText, isValidSourceText } from "./utils/sourceValidation";

export const app = express();

const BUILD_ID = "2026-10-source-validation-v9";
const PRIMARY_GEMINI_MODEL = "gemini-1.5-flash";

// Vercel/Express entrypoint: Vercel detects the default export from server.ts.
// Keep the same Express instance for local Node and Vercel deployments.
const PORT = 3000;

// Enable JSON and URL-encoded bodies with higher limits to support large documents and digitized materials
app.use(express.json({ limit: "6mb" }));
app.use(express.urlencoded({ limit: "6mb", extended: true }));

// Lightweight deployment/API diagnostic. This route never calls Gemini.
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "ra-de-thi-api",
    build: BUILD_ID,
    runtime: process.env.VERCEL ? "vercel" : "node",
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    model: PRIMARY_GEMINI_MODEL,
    apiRoutes: ["/api/extract-text", "/api/generate/step1", "/api/generate/step2", "/api/generate/step3", "/api/generate/step5"],
  });
});

// Helper to initialize Gemini REST access. The key is never sent to the browser.
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY_MISSING: Chưa cấu hình GEMINI_API_KEY trên Vercel Project Settings → Environment Variables.");
  }
  return { apiKey };
}

function normalizeGeminiContents(contents: any) {
  if (typeof contents === "string") {
    return [{ role: "user", parts: [{ text: contents }] }];
  }

  if (!Array.isArray(contents)) {
    return [{ role: "user", parts: [{ text: String(contents ?? "") }] }];
  }

  const parts = contents.flatMap((item: any) => {
    if (typeof item === "string") return [{ text: item }];
    if (item?.text) return [{ text: item.text }];
    if (item?.inlineData) {
      return [{
        inline_data: {
          mime_type: item.inlineData.mimeType || item.inlineData.mime_type,
          data: item.inlineData.data,
        },
      }];
    }
    if (item?.inline_data) {
      return [{
        inline_data: {
          mime_type: item.inline_data.mimeType || item.inline_data.mime_type,
          data: item.inline_data.data,
        },
      }];
    }
    if (item?.fileData) {
      return [{
        file_data: {
          mime_type: item.fileData.mimeType || item.fileData.mime_type,
          file_uri: item.fileData.fileUri || item.fileData.file_uri,
        },
      }];
    }
    if (item?.file_data) return [{ file_data: item.file_data }];
    return [];
  });

  return [{ role: "user", parts }];
}

// Direct REST call to Gemini generateContent. This is intentionally server-side only.
async function callGeminiRest(apiKey: string, model: string, params: { contents: any; config?: any }) {
  const config = params.config || {};
  const { systemInstruction, responseMimeType, responseSchema, thinkingConfig, ...otherGenerationConfig } = config;

  const body: any = {
    contents: normalizeGeminiContents(params.contents),
  };

  // Gemini REST accepts the documented JSON field names used by the REST examples.
  if (systemInstruction) {
    body.system_instruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  const generationConfig: any = { ...otherGenerationConfig };
  if (responseMimeType) generationConfig.response_mime_type = responseMimeType;
  if (responseSchema) generationConfig.response_schema = responseSchema;
  if (thinkingConfig) {
    generationConfig.thinking_config = {
      ...(thinkingConfig.thinkingLevel ? { thinking_level: thinkingConfig.thinkingLevel } : {}),
      ...(thinkingConfig.includeThoughts !== undefined ? { include_thoughts: thinkingConfig.includeThoughts } : {}),
    };
  }
  if (Object.keys(generationConfig).length > 0) {
    body.generation_config = generationConfig;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const raw = await response.text();
    let data: any = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { /* handled below */ }

    if (!response.ok) {
      const providerMessage = data?.error?.message || raw || `${response.status} ${response.statusText}`;
      const providerStatus = data?.error?.status ? ` [${data.error.status}]` : "";
      throw new Error(`GEMINI_HTTP_${response.status}${providerStatus}: ${providerMessage}`);
    }

    const text = (data?.candidates || [])
      .flatMap((candidate: any) => candidate?.content?.parts || [])
      .map((part: any) => part?.text || "")
      .filter(Boolean)
      .join("\n")
      .trim();

    if (!text) {
      const finishReason = data?.candidates?.[0]?.finishReason || "UNKNOWN";
      throw new Error(`GEMINI_EMPTY_RESPONSE: Gemini không trả về nội dung (finishReason=${finishReason}).`);
    }

    return { text, raw: data };
  } finally {
    clearTimeout(timeout);
  }
}

// Resilient helper with a small, deterministic fallback chain.
async function generateContentWithRetry(ai: { apiKey: string }, params: {
  model: string;
  contents: any;
  config?: any;
}, maxRetriesPerModel = 1, initialDelay = 1000) {
  const requestedModel = params.model || "gemini-3.8-flash";
  const candidateModels = [requestedModel, "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash"]
    .filter((model, index, list) => list.indexOf(model) === index);

  let lastError: any = null;

  for (const model of candidateModels) {
    let delay = initialDelay;
    console.log(`[AI-Routing] Attempting request using model: ${model}`);

    const attemptsForThisModel = model === requestedModel ? maxRetriesPerModel : 1;
    for (let attempt = 1; attempt <= attemptsForThisModel; attempt++) {
      try {
        return await callGeminiRest(ai.apiKey, model, params);
      } catch (error: any) {
        lastError = error;
        const errorStr = String(error?.message || error).toLowerCase();

        const isQuotaOrExhausted = /\b429\b|quota|resource_exhausted|rate limit|exhausted/.test(errorStr);
        const isRetryable = isQuotaOrExhausted || /\b503\b|service unavailable|high demand|\b500\b|\b502\b|\b504\b|timeout|aborted/.test(errorStr);

        console.error(`[Gemini] model=${model} attempt=${attempt}:`, error?.message || error);

        // A 401/403/404 is deterministic: trying four models will not fix a bad key
        // or a blocked API. Move to another model only for quota/transient failures.
        if (/gemini_http_401|gemini_http_403|gemini_http_400/.test(errorStr)) {
          throw error;
        }
        if (/gemini_http_404/.test(errorStr) && !errorStr.includes("model")) {
          throw error;
        }

        if (isRetryable && attempt < maxRetriesPerModel) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 1.5;
        } else {
          break;
        }
      }
    }
  }

  throw lastError || new Error("Hệ thống AI không trả về kết quả.");
}

// Ensure error handling
const handleRouteError = (res: any, error: any) => {
  console.error("Route Error:", error);
  const rawMessage = String(error?.message || error || "Đã xảy ra lỗi không xác định.");
  const errorStr = rawMessage.toLowerCase();
  let status = Number(error?.status || error?.statusCode || error?.response?.status || 500);
  let errorMsg = rawMessage;
  let code = error?.code || "INTERNAL_SERVER_ERROR";

  if (errorStr.includes("missing_gemini_api_key") || errorStr.includes("gemini_api_key chưa được cấu hình") || errorStr.includes("gemini_api_key is not configured")) {
    status = 503; code = "MISSING_GEMINI_API_KEY";
    errorMsg = "Máy chủ chưa được cấu hình GEMINI_API_KEY. Vào Vercel → Project Settings → Environment Variables, thêm GEMINI_API_KEY rồi Redeploy. API key chỉ nằm ở máy chủ và không được đưa vào frontend.";
  } else if (errorStr.includes("gemini_http_404")) {
    status = 502; code = "GEMINI_MODEL_OR_ENDPOINT";
    errorMsg = "Gemini API không tìm thấy model/endpoint được cấu hình. Hệ thống đang dùng gemini-3.8-flash; hãy kiểm tra project/API access.";
  } else if (errorStr.includes("gemini_http_500") || errorStr.includes("gemini_http_502")) {
    status = 502; code = "GEMINI_PROVIDER_ERROR";
    errorMsg = "Gemini API trả lỗi máy chủ (5xx). Hệ thống đã thử lại model; vui lòng thử lại sau ít phút.";
  } else if (errorStr.includes("503") || errorStr.includes("unavailable") || errorStr.includes("high demand")) {
    status = 503; code = "GEMINI_UNAVAILABLE";
    errorMsg = "Máy chủ AI của Google đang quá tải tạm thời (503). Hệ thống đã thử lại; vui lòng thử lại sau ít phút.";
  } else if (errorStr.includes("429") || errorStr.includes("quota exceeded") || errorStr.includes("rate limit") || errorStr.includes("resource_exhausted") || errorStr.includes("exhausted")) {
    status = 429; code = "GEMINI_QUOTA";
    errorMsg = "Gemini đang báo giới hạn/quota (429). Hãy kiểm tra quota/billing của API key rồi thử lại.";
  } else if (errorStr.includes("401") || errorStr.includes("403") || errorStr.includes("api key") || errorStr.includes("invalid key") || errorStr.includes("permission denied") || errorStr.includes("forbidden")) {
    status = status >= 400 && status < 500 ? status : 401; code = "GEMINI_AUTH";
    errorMsg = "GEMINI_API_KEY không hợp lệ hoặc không có quyền gọi Gemini API. Hãy kiểm tra lại API key và project/billing.";
  } else if (errorStr.includes("400") || errorStr.includes("invalid_argument") || errorStr.includes("malformed")) {
    status = 400; code = "GEMINI_BAD_REQUEST";
    errorMsg = "Yêu cầu gửi tới Gemini không hợp lệ. Hãy kiểm tra loại tệp, MIME type và dung lượng tài liệu.";
  } else if (errorStr.includes("timeout") || errorStr.includes("timed out") || errorStr.includes("deadline")) {
    status = 504; code = "GEMINI_TIMEOUT";
    errorMsg = "Gemini xử lý tài liệu quá lâu. Hãy thử tài liệu nhỏ hơn hoặc chia tài liệu thành từng phần.";
  }

  if (status < 400 || status > 599) status = 500;
  return res.status(status).json({ error: errorMsg, code });
};

// API: Generate questions based on topics and specifications
app.post("/api/generate-questions", async (req, res) => {
  try {
    const { topic, subject, grade, count = 1, level, type = "TracNghiem" } = req.body;
    const ai = getGeminiClient();

    const systemInstruction = `Bạn là Chuyên gia Khảo thí STEM. Nhiệm vụ: Soạn ${count} câu hỏi môn ${subject} lớp ${grade}, chủ đề "${topic}".

    QUY TẮC ĐỊNH DẠNG (SỐNG CÒN):
    1. TOÁN HỌC: Inline dùng \\( ... \\), Block dùng \\[ ... \\]. Tuyệt đối không dùng $.
    2. HÓA HỌC: Luôn dùng \\ce{...}. Ví dụ: \\ce{Fe + CuSO4 -> FeSO4 + Cu}.
    3. HÌNH HỌC/ĐỒ THỊ: Nếu nội dung cần hình vẽ, hãy chèn mã SVG trong thẻ [FIGURE type="svg"]...[/FIGURE].
    4. CẤU TRÚC: Phải trả về JSON mảng đối tượng.`;

    const response = await generateContentWithRetry(ai, {
      model: PRIMARY_GEMINI_MODEL,
      contents: `Soạn ${count} câu hỏi ${type === "TracNghiem" ? "Trắc nghiệm" : "Tự luận"} mức độ ${level || "NB"} về ${topic}.`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              noiDung: { type: Type.STRING },
              dangCau: { type: Type.STRING, enum: ["TracNghiem", "TuLuan"] },
              mucDo: { type: Type.STRING, enum: ["NB", "TH", "VD", "VDC"] },
              luaChon: { 
                type: Type.OBJECT, 
                properties: { 
                  A: { type: Type.STRING }, B: { type: Type.STRING }, C: { type: Type.STRING }, D: { type: Type.STRING } 
                }
              },
              dapAn: { type: Type.STRING },
              giaiThichCham: { type: Type.STRING },
              chuanKTKN: { type: Type.STRING }
            },
            required: ["noiDung", "dangCau", "mucDo", "dapAn", "giaiThichCham", "chuanKTKN"]
          }
        }
      }
    });

    try {
      const parsed = JSON.parse(response.text || "[]");
      res.json(parsed);
    } catch (parseError) {
      console.error("Failed to parse generate-questions response text:", response.text);
      res.json([]);
    }
  } catch (error) {
    handleRouteError(res, error);
  }
});

// API: Extract questions from PDF/Image documents
app.post("/api/extract-questions-from-doc", async (req, res) => {
  try {
    const { base64Data, mimeType } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: "Thiếu dữ liệu tài liệu dạng base64." });
    }
    const ai = getGeminiClient();

    const prompt = `Bạn là chuyên gia số hóa đề thi. Hãy trích xuất toàn bộ các câu hỏi từ tài liệu này thành định dạng JSON.
    Yêu cầu:
    1. Giữ nguyên nội dung, chuyển các công thức toán/lý/hóa sang LaTeX chuẩn (\\( ... \\) và \\ce{...}).
    2. Nếu có hình vẽ, hãy cố gắng mô tả lại bằng mã SVG đơn giản trong thẻ [FIGURE type="svg"].
    3. Phân loại mức độ (NB, TH, VD, VDC) dựa trên nội dung.`;

    const response = await generateContentWithRetry(ai, {
      model: PRIMARY_GEMINI_MODEL,
      contents: [
        { inlineData: { data: base64Data, mimeType: mimeType || "application/pdf" } },
        { text: prompt }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              noiDung: { type: Type.STRING },
              dangCau: { type: Type.STRING, enum: ["TracNghiem", "TuLuan"] },
              mucDo: { type: Type.STRING },
              luaChon: { 
                type: Type.OBJECT, 
                properties: { A: { type: Type.STRING }, B: { type: Type.STRING }, C: { type: Type.STRING }, D: { type: Type.STRING } }
              },
              dapAn: { type: Type.STRING },
              giaiThichCham: { type: Type.STRING },
              chuanKTKN: { type: Type.STRING },
              monHoc: { type: Type.STRING },
              lop: { type: Type.STRING },
              chuDe: { type: Type.STRING }
            },
            required: ["noiDung", "dangCau", "dapAn"]
          }
        }
      }
    });

    try {
      const parsed = JSON.parse(response.text || "[]");
      res.json(parsed);
    } catch (parseError) {
      console.error("Failed to parse extract-questions response text:", response.text);
      res.json([]);
    }
  } catch (error) {
    handleRouteError(res, error);
  }
});

// API: Extract matrices from Image documents
app.post("/api/extract-matrix-from-image", async (req, res) => {
  try {
    const { base64Data, mimeType } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: "Thiếu dữ liệu hình ảnh dạng base64." });
    }
    const ai = getGeminiClient();

    const prompt = `Bạn là chuyên gia phân tích ma trận đề thi. Hãy trích xuất cấu trúc ma trận đề thi từ tài liệu/hình ảnh này thành định dạng JSON.
    Yêu cầu:
    1. Trả về mảng các đối tượng, mỗi đối tượng đại diện cho một chủ đề kiến thức.
    2. Mỗi đối tượng gồm: topic (tên chủ đề), NB (số câu nhận biết), TH (số câu thông hiểu), VD (số câu vận dụng), VDC (số câu vận dụng cao).
    3. Nếu giá trị nào không có, hãy để là 0.`;

    const response = await generateContentWithRetry(ai, {
      model: PRIMARY_GEMINI_MODEL,
      contents: [
        { inlineData: { data: base64Data, mimeType: mimeType || "image/png" } },
        { text: prompt }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              topic: { type: Type.STRING },
              NB: { type: Type.NUMBER },
              TH: { type: Type.NUMBER },
              VD: { type: Type.NUMBER },
              VDC: { type: Type.NUMBER }
            },
            required: ["topic", "NB", "TH", "VD", "VDC"]
          }
        }
      }
    });

    try {
      const parsed = JSON.parse(response.text || "[]");
      res.json(parsed);
    } catch (parseError) {
      console.error("Failed to parse extract-matrix response text:", response.text);
      res.json([]);
    }
  } catch (error) {
    handleRouteError(res, error);
  }
});

// API: Suggest matrix structures based on topics and available resources
app.post("/api/suggest-smart-matrix", async (req, res) => {
  try {
    const { topics, totalQuestions, subject, inventoryStr } = req.body;
    const ai = getGeminiClient();

    const response = await generateContentWithRetry(ai, {
      model: PRIMARY_GEMINI_MODEL,
      contents: `Gợi ý ma trận ${totalQuestions} câu cho môn ${subject}. Các chủ đề: ${topics ? topics.join(', ') : ""}. Kho hiện có: ${inventoryStr || ""}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              topic: { type: Type.STRING },
              NB: { type: Type.NUMBER },
              TH: { type: Type.NUMBER },
              VD: { type: Type.NUMBER },
              VDC: { type: Type.NUMBER }
            },
            required: ["topic", "NB", "TH", "VD", "VDC"]
          }
        }
      }
    });

    try {
      const parsed = JSON.parse(response.text || "[]");
      res.json(parsed);
    } catch (parseError) {
      console.error("Failed to parse suggest-matrix response text:", response.text);
      res.json([]);
    }
  } catch (error) {
    handleRouteError(res, error);
  }
});

// API: Document digitization support for PDF, Word (.docx), TXT, and Images
app.post("/api/extract-text", async (req, res) => {
  try {
    const { base64, mimeType, fileName } = req.body;
    if (!base64 || typeof base64 !== "string") {
      return res.status(400).json({ error: "Không tìm thấy nội dung tệp ở dạng base64." });
    }
    if (base64.length > 5_500_000) {
      return res.status(413).json({ error: "Tệp sau khi mã hóa Base64 quá lớn cho Vercel. Vui lòng chia nhỏ tài liệu hoặc giảm dung lượng tệp." });
    }

    // 1. If it's a Word document (.docx)
    if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || fileName?.endsWith(".docx")) {
      const buffer = Buffer.from(base64, "base64");
      const { default: mammoth } = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value?.trim() || "";
      if (!isValidExtractedText(text)) {
        return res.status(422).json({ error: EXTRACTION_INVALID_MESSAGE });
      }
      if (Buffer.byteLength(JSON.stringify({ text }), "utf8") > 4 * 1024 * 1024) {
        return res.status(422).json({ error: "Nội dung sau khi số hóa quá lớn để truyền qua Vercel. Thầy/Cô vui lòng chia nhỏ tài liệu rồi tải từng phần." });
      }
      return res.json({ text });
    }

    // 2. If it's a plain text file (.txt)
    if (mimeType === "text/plain" || fileName?.endsWith(".txt")) {
      const text = Buffer.from(base64, "base64").toString("utf-8").trim();
      if (!isValidExtractedText(text)) {
        return res.status(422).json({ error: EXTRACTION_INVALID_MESSAGE });
      }
      if (Buffer.byteLength(JSON.stringify({ text }), "utf8") > 4 * 1024 * 1024) {
        return res.status(422).json({ error: "Nội dung sau khi số hóa quá lớn để truyền qua Vercel. Thầy/Cô vui lòng chia nhỏ tài liệu rồi tải từng phần." });
      }
      return res.json({ text });
    }

    // 3. For PDF or Images, we let Gemini process with multimodal capability
    const ai = getGeminiClient();
    let currentMimeType = mimeType || "application/pdf";
    if (fileName?.endsWith(".pdf")) {
      currentMimeType = "application/pdf";
    } else if (fileName?.endsWith(".png")) {
      currentMimeType = "image/png";
    } else if (fileName?.endsWith(".jpg") || fileName?.endsWith(".jpeg")) {
      currentMimeType = "image/jpeg";
    } else if (fileName?.endsWith(".webp")) {
      currentMimeType = "image/webp";
    }

    const response = await generateContentWithRetry(ai, {
      model: PRIMARY_GEMINI_MODEL,
      contents: [
        "Hãy trích xuất và số hóa toàn bộ nội dung văn bản cốt lõi trong tài liệu này một cách chính xác nhất và đầy đủ tất cả các dòng, chương mục. Với công thức toán, hãy giữ nguyên và chuyển sang định dạng LaTeX chuẩn (bọc trong \\( ... \\) hoặc \\[ ... \\] đối với toán dòng và toán khối). Chỉ trả về nội dung văn bản được số hóa, không thêm vào lời giải thích hay lời bàn của bạn.",
        {
          inlineData: {
            data: base64,
            mimeType: currentMimeType
          }
        }
      ],
      config: {
        thinkingConfig: { thinkingLevel: "low" }
      }
    });

    const extractedText = response.text?.trim() || "";
    if (!isValidExtractedText(extractedText)) {
      return res.status(422).json({ error: EXTRACTION_INVALID_MESSAGE });
    }

    // Keep the JSON response below Vercel's 4.5 MB response limit with headroom.
    const responseBytes = Buffer.byteLength(JSON.stringify({ text: extractedText }), "utf8");
    if (responseBytes > 4 * 1024 * 1024) {
      return res.status(422).json({
        error: "Nội dung sau khi số hóa quá lớn để truyền qua Vercel. Thầy/Cô vui lòng chia nhỏ tài liệu rồi tải từng phần."
      });
    }

    res.json({ text: extractedText });
  } catch (error) {
    handleRouteError(res, error);
  }
});

// API: Advanced AI Digitization with bounding box figure detection and single-dollar LaTeX formulas
app.post("/api/detect-figures", async (req, res) => {
  try {
    const { base64, mimeType } = req.body;
    if (!base64) {
      return res.status(400).json({ error: "Thiếu dữ liệu ảnh dạng base64." });
    }

    const ai = getGeminiClient();
    const currentMimeType = mimeType || "image/jpeg";

    const systemPrompt = `Bạn là chuyên gia số hóa đề thi chuyên sâu. Hãy phân tích hình ảnh đề thi được cung cấp và thực hiện các nhiệm vụ sau:
1. Phát hiện tất cả các biểu đồ, đồ thị, sơ đồ, hình vẽ minh họa hoặc hình vẽ hình học hiện diện trên trang.
2. Với mỗi hình phát hiện được, hãy khoanh vùng và trả về tọa độ bounding box chuẩn hóa trong khoảng [0, 1000] dưới dạng [ymin, xmin, ymax, xmax].
3. KHÔNG trích xuất bất cứ chữ hay văn bản nào nằm TRÊN hoặc BÊN TRONG các hình vẽ/biểu đồ này. Hãy thay thế hình vẽ bằng nhãn định vị trí dạng "[IMAGE_PLACEHOLDER_x]" (với x là chỉ số bắt đầu từ 0) tương ứng trong nội dung số hóa.
4. Trích xuất toàn bộ văn bản và câu hỏi còn lại trên trang một cách đầy đủ và chính xác nhất.
5. ĐẶC BIỆT: Tất cả công thức toán học và biểu thức phải được nhận diện và trả về dưới dạng LaTeX đặt trong cặp dấu $ kép kín (ví dụ: $E=mc^2$ hoặc $h(x) = ax^2 + bx + c$). Tuyệt đối không được dùng và bọc trong các thẻ như \\( ... \\) hay \\[ ... \\]. Hãy luôn sử dụng dấu $ để bọc công thức toán.

Bắt buộc trả về đúng định dạng JSON được chỉ định.`;

    const response = await generateContentWithRetry(ai, {
      model: PRIMARY_GEMINI_MODEL,
      contents: [
        {
          inlineData: {
            data: base64,
            mimeType: currentMimeType
          }
        },
        { text: systemPrompt }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            figures: {
              type: Type.ARRAY,
              description: "Danh sách các hình vẽ, biểu đồ hoặc sơ đồ được phát hiện",
              items: {
                type: Type.OBJECT,
                properties: {
                  box_2d: {
                    type: Type.ARRAY,
                    description: "Tọa độ bounding box chuẩn hóa [ymin, xmin, ymax, xmax] từ 0 đến 1000",
                    items: { type: Type.INTEGER }
                  },
                  label: {
                    type: Type.STRING,
                    description: "Mô tả ngắn gọn về hình vẽ, ví dụ 'Hình học parabol' hoặc 'Sơ đồ nhiệt hóa'"
                  }
                },
                required: ["box_2d", "label"]
              }
            },
            transcribed_text: {
              type: Type.STRING,
              description: "Nội dung văn bản thi được số hóa đầy đủ, chứa các nhãn [IMAGE_PLACEHOLDER_x] tương ứng tại vị trí của hình vẽ, và các công thức bọc bằng $"
            }
          },
          required: ["figures", "transcribed_text"]
        }
      }
    });

    try {
      const resultObj = JSON.parse(response.text || "{}");
      res.json(resultObj);
    } catch (parseErr) {
      console.error("Lỗi parse kết quả detect figures:", response.text);
      res.status(500).json({ error: "Không thể phân tích dữ liệu JSON phản hồi từ mô hình AI." });
    }
  } catch (error) {
    handleRouteError(res, error);
  }
});

// Step 1: Analysing Source and Form
app.post("/api/generate/step1", async (req, res) => {
  try {
    const { lesson, regulationSource, sampleExam, matrix, prompt, subject, grade } = req.body;

    if (!isValidSourceText(regulationSource)) {
      return res.status(400).json({
        error: "Mục '2. văn bản quy định (văn bản quy định)' là nguồn bắt buộc do người dùng cung cấp. Vui lòng cung cấp văn bản quy định tại Bước 0 trước khi tiến hành phân tích!"
      });
    }

    const ai = getGeminiClient();

    const textPrompt = `
QUY TẮC NGUYÊN TẮC CHUNG (BẮT BUỘC TUÂN THỦ TUYỆT ĐỐI):
1. Chỉ sử dụng thông tin, kiến thức, mục tiêu, yêu cầu cần đạt và giới hạn nội dung có trong dữ liệu nguồn giáo viên đã nạp tại "0. Chuẩn bị nguồn" dưới đây.
2. Không tự ý bổ sung kiến thức ngoài nguồn, không suy diễn thêm nội dung không có căn cứ.
3. Với mỗi nội dung phân loại mức độ nhận thức (Nhận biết, Thông hiểu, Vận dụng, Vận dụng cao), phải chỉ ra căn cứ trực tiếp từ nguồn đã nạp.
4. Trích xuất chính xác chuẩn kiến thức, kĩ năng, năng lực đặc thù và các giới hạn kiểm tra nếu nguồn có quy định.
5. văn bản quy định (văn bản quy định) là căn cứ pháp lý và cấu trúc bắt buộc do người dùng cung cấp.

Dưới đây là các tài liệu nguồn giáo viên cung cấp:

=== CÔNG VĂN QUY ĐỊNH BẮT BUỘC DO NGƯỜI DÙNG CUNG CẤP (văn bản quy định) ===
${regulationSource.trim()}

=== Tài liệu dạy học / SGK hoặc Giáo án ===
${lesson || "(Chưa cung cấp)"}

=== Đề kiểm tra mẫu ===
${sampleExam || "(Chưa cung cấp)"}

=== Ma trận đề mẫu (nếu có) ===
${matrix || "(Chưa cung cấp)"}

---
THÔNG TIN BẮT BUỘC ĐỒNG BỘ:
- Trường & Đơn vị: SỞ GD & ĐT TỈNH QUẢNG TRỊ - TRƯỜNG THCS GIO LINH.
- Môn học: ${subject || "Sinh học"} (Chương trình GDPT 2018).
- Khối lớp: ${grade ? `Khối lớp ${grade}` : "Lớp 9"}.

---
YÊU CẦU: Hãy phân tích các tài liệu nguồn trên và thực hiện lệnh phân tích sau:
${prompt}

LƯU Ý QUAN TRỌNG:
- Bám sát môn học "${subject || 'Sinh học'}" và khối lớp "${grade || '9'}" theo Chương trình GDPT 2018.
- Bóc tách chuẩn kiến thức, kĩ năng, năng lực đặc thù của môn học tương ứng.
    `;

    const response = await generateContentWithRetry(ai, {
      model: PRIMARY_GEMINI_MODEL,
      contents: textPrompt,
      config: {
      },
    });

    res.json({ result: response.text });
  } catch (error) {
    handleRouteError(res, error);
  }
});

// Step 2: Create Matrix and Specifications
app.post("/api/generate/step2", async (req, res) => {
  try {
    const { lesson, regulationSource, sampleExam, matrix, step1Result, prompt, durationMinutes, examDuration, subject, grade } = req.body;
    const activeDuration = durationMinutes || examDuration || 45;

    if (!isValidSourceText(regulationSource)) {
      return res.status(400).json({
        error: "Mục '2. văn bản quy định (văn bản quy định)' là nguồn bắt buộc do người dùng cung cấp. Vui lòng cung cấp văn bản quy định tại Bước 0 trước khi xây dựng Ma trận & Bản đặc tả!"
      });
    }

    if (!step1Result || typeof step1Result !== "string" || step1Result.trim().length < 20) {
      return res.status(400).json({
        error: "Bắt buộc phải có kết quả từ Bước 1 (Phân tích nguồn & Nhận dạng Form mẫu) trước khi tạo Ma trận và Bản đặc tả theo văn bản quy định. Thầy cô vui lòng thực hiện Bước 1 trước!"
      });
    }

    const ai = getGeminiClient();

    const textPrompt = `
=== CÔNG VĂN QUY ĐỊNH BẮT BUỘC DO NGƯỜI DÙNG CUNG CẤP (văn bản quy định) ===
${regulationSource.trim()}

=== KẾT QUẢ PHÂN TÍCH NGUỒN CỦA MỤC 1 (DỮ LIỆU BẮT BUỘC SỬ DỤNG) ===
${step1Result}

=== TÀI LIỆU THAM KHẢO GỐC (NẾU CẦN TRA CỨU) ===
- Môn học: ${subject || "Sinh học"}
- Khối lớp: ${grade ? `Lớp ${grade}` : "Lớp 9"}
- Tài liệu bài học/SGK gốc: ${lesson ? lesson : "(Xem tại Mục 1)"}
- Đề kiểm tra mẫu: ${sampleExam ? sampleExam : "(Xem tại Mục 1)"}

---
YÊU CẦU VÀ CHỈ DẪN BẮT BUỘC:
${prompt}
    `;

    const response = await generateContentWithRetry(ai, {
      model: PRIMARY_GEMINI_MODEL,
      contents: textPrompt,
      config: {
      },
    });

    res.json({ result: response.text });
  } catch (error) {
    handleRouteError(res, error);
  }
});

// Step 3: Create Exam (Đề kiểm tra định kì & Đáp án)
app.post("/api/generate/step3", async (req, res) => {
  try {
    const { lesson, regulationSource, sampleExam, matrix, step1Result, step2Result, prompt, durationMinutes, examDuration, subject, grade } = req.body;
    const activeDuration = durationMinutes || examDuration || 45;
    const resolvedSubject = (subject && subject !== 'Chung' ? subject : 'Sinh học').toUpperCase();
    const resolvedGrade = grade ? `LỚP ${grade}` : 'LỚP 9';

    if (!isValidSourceText(regulationSource)) {
      return res.status(400).json({
        error: "Mục '2. văn bản quy định (văn bản quy định)' là nguồn bắt buộc do người dùng cung cấp. Vui lòng cung cấp văn bản quy định tại Bước 0 trước khi tạo Đề kiểm tra định kì!"
      });
    }

    const ai = getGeminiClient();

    const textPrompt = `
QUY TẮC NGUYÊN TẮC CHUNG (BẮT BUỘC TUÂN THỦ TUYỆT ĐỐI):
1. Đề thi, đáp án và hướng dẫn chấm phải xây dựng DUY NHẤT dựa trên Ma trận & Bản đặc tả Bước 2, văn bản quy định và dữ liệu nguồn Mục 0.
2. Không tự ý bổ sung kiến thức ngoài nguồn, không kiểm tra kiến thức không có trong Bản đặc tả.
3. Cấu trúc phần thi, dạng câu hỏi, số câu và thang điểm phải được xác định từ văn bản quy định đã nạp, ma trận/bản đặc tả và đề mẫu; không áp đặt một cấu trúc cố định.
4. Tổng điểm phải đúng theo văn bản quy định đã nạp và ma trận/bản đặc tả được phê duyệt; chỉ dùng 10.0 điểm khi nguồn quy định hoặc ma trận xác định 10.0 điểm.

=== CÔNG VĂN QUY ĐỊNH BẮT BUỘC DO NGƯỜI DÙNG CUNG CẤP (văn bản quy định) ===
${regulationSource.trim()}

=== TÀI LIỆU NGUỒN VÀ THAM KHẢO ===
- Tài liệu SGK / Tổ hợp: ${lesson ? lesson : "Chưa cung cấp"}
- Đề kiểm tra mẫu: ${sampleExam ? sampleExam : "Chưa cung cấp"}
- Thời gian làm bài quy định: ${activeDuration} phút
- Môn học: ${resolvedSubject}
- Khối lớp: ${resolvedGrade}

Tham khảo:
- Kết quả Phân tích Bước 1:
${step1Result || "(Không có)"}

- Ma trận & Bản đặc tả Bước 2:
${step2Result || "(Không có)"}

---
YÊU CẦU ĐỀ BÀI: Hãy tạo Đề kiểm tra định kì hoàn chỉnh gồm đề cho học sinh, đáp án và hướng dẫn chấm riêng biệt (như mô tả trong câu lệnh):
${prompt}

LƯU Ý ĐẶC BIỆT VỀ HÌNH THỨC VÀ TIÊU ĐỀ:
- Tuyệt đối KHÔNG viết bất kì câu chào hỏi, lời dẫn, câu mở đầu nào như "Dưới đây là Đề kiểm tra...", "Sau đây là...", "Chào bạn...".
- Tuyệt đối KHÔNG chèn tiêu đề "ĐỀ THI GỐC KHẢO SÁT CHẤT LƯỢNG" hay ghi chữ "ĐỀ GỐC", "Mã đề: GỐC". Bắt đầu ngay trực tiếp bằng tiêu đề Đề kiểm tra định kì chuẩn xác.
- TIÊU ĐỀ VĂN BẢN BẮT BUỘC:
  SỞ GD & ĐT TỈNH QUẢNG TRỊ
  TRƯỜNG THCS GIO LINH
  ĐỀ KIỂM TRA ĐỊNH KÌ
  Môn thi: ${resolvedSubject} ${resolvedGrade}
  Thời gian làm bài: ${activeDuration} phút (không kể thời gian phát đề)

Chú ý: Công thức toán và phương trình hóa học phải trình bày chuẩn LaTeX:
- Toán inline: \\( ... \\), block: \\[ ... \\]
- Hóa học: \\ce{...}
    `;

    const response = await generateContentWithRetry(ai, {
      model: PRIMARY_GEMINI_MODEL,
      contents: textPrompt,
      config: {
      },
    });

    let rawText = response.text || "";
    // Clean any leading conversational phrase
    rawText = rawText.replace(/^(Dưới đây là|Sau đây là|Đây là)[^\n]*\n+/i, "").trim();

    res.json({ result: rawText });
  } catch (error) {
    handleRouteError(res, error);
  }
});

// Step 5: Create Equivalent Exams (Mã đề tương đương)
app.post("/api/generate/step5", async (req, res) => {
  try {
    const { lesson, regulationSource, sampleExam, step1Result, step2Result, step3Result, prompt, durationMinutes, examDuration, subject, grade } = req.body;
    const activeDuration = durationMinutes || examDuration || 45;
    const resolvedSubject = (subject && subject !== 'Chung' ? subject : 'Sinh học').toUpperCase();
    const resolvedGrade = grade ? `LỚP ${grade}` : 'LỚP 9';

    if (!isValidSourceText(regulationSource)) {
      return res.status(400).json({
        error: "Mục '2. văn bản quy định (văn bản quy định)' là nguồn bắt buộc do người dùng cung cấp. Vui lòng cung cấp văn bản quy định tại Bước 0 trước khi tạo mã đề tương đương!"
      });
    }

    const ai = getGeminiClient();

    const textPrompt = `
=== CÔNG VĂN QUY ĐỊNH BẮT BUỘC DO NGƯỜI DÙNG CUNG CẤP (văn bản quy định) ===
${regulationSource.trim()}

Dựa vào Đề gốc từ Bước 3 và các tài liệu nguồn, hãy thực hiện câu lệnh tạo mã đề biến thể (101, 102, 103, 104) tương đương:
- Thời gian làm bài quy định cho các mã đề: ${activeDuration} phút.
- Môn thi: ${resolvedSubject}
- Khối lớp: ${resolvedGrade}

=== ĐỀ GỐC (BƯỚC 3) ===
${step3Result || "(Không có đề gốc)"}

=== THAM KHẢO MA TRẬN & ĐẶC TẢ ===
${step2Result || "(Không có)"}

---
YÊU CẦU: Hãy tạo 4 mã đề tương đương và bảng đối chiếu các mã đề như mô tả dưới đây:
${prompt}

Đảm bảo tất cả 4 mã đề (101, 102, 103, 104) đều ghi đúng tiêu đề:
SỞ GD & ĐT TỈNH QUẢNG TRỊ
TRƯỜNG THCS GIO LINH
ĐỀ KIỂM TRA ĐỊNH KÌ - MÃ ĐỀ: ...
Môn thi: ${resolvedSubject} ${resolvedGrade}
Thời gian làm bài: ${activeDuration} phút (không kể thời gian phát đề).

Chú ý: Công thức toán và phương trình hóa học phải dùng chuẩn LaTeX:
- Toán inline: \\( ... \\), block: \\[ ... \\]
- Hóa học: \\ce{...}
    `;

    const response = await generateContentWithRetry(ai, {
      model: PRIMARY_GEMINI_MODEL,
      contents: textPrompt,
      config: {
      },
    });

    res.json({ result: response.text });
  } catch (error) {
    handleRouteError(res, error);
  }
});

// ========================================================================
// STUDENT ASSIGNMENT PORTAL API: PUBLISHED EXAMS (QUESTIONS ONLY)
// ========================================================================
const PUBLISHED_EXAMS_FILE = path.join(process.cwd(), "student-exams-vault.json");
const publishedExamsMap = new Map<string, any>();

// Helper to strictly strip all answer sections, solutions, and grading rubrics on server
function sanitizeQuestionsOnlyServer(text: string): string {
  if (!text || typeof text !== "string") return "";
  const answerSectionRegexes = [
    /\n\s*#{1,4}\s*(?:(?:PHẦN|Phần|MỤC|Mục)\s*(?:[0-9IVX]+|[A-Z])\s*[:.-]\s*)?(?:ĐÁP\s*ÁN|HƯỚNG\s*DẪN\s*CHẤM|BẢNG\s*ĐÁP\s*ÁN|THANG\s*ĐIỂM|BIỂU\s*ĐIỂM|LỜI\s*GIẢI|HƯỚNG\s*DẪN\s*GIẢI).*/i,
    /\n\s*\*\*(?:(?:PHẦN|Phần)\s*(?:[0-9IVX]+|[A-Z])\s*[:.-]\s*)?(?:ĐÁP\s*ÁN|HƯỚNG\s*DẪN\s*CHẤM|BẢNG\s*ĐÁP\s*ÁN|THANG\s*ĐIỂM|BIỂU\s*ĐIỂM|LỜI\s*GIẢI).*\*\*/i,
    /\n\s*(?:2|3|II|III|B|C)\s*[\.:\)]\s*(?:ĐÁP\s*ÁN|Đáp\s*án|HƯỚNG\s*DẪN\s*CHẤM|Hướng\s*dẫn\s*chấm|BẢNG\s*ĐÁP\s*ÁN|Thang\s*điểm).*/i,
    /\n\s*(?:PHẦN\s+(?:[0-9IVX]+|[A-Z])\s*[:.-]\s*)?(?:ĐÁP\s*ÁN\s*VÀ\s*HƯỚNG\s*DẪN\s*CHẤM|HƯỚNG\s*DẪN\s*CHẤM\s*CHI\s*TIẾT|BẢNG\s*ĐÁP\s*ÁN\s*CHÍNH\s*THỨC|ĐÁP\s*ÁN\s*CHÍNH\s*THỨC|HƯỚNG\s*DẪN\s*CHẤM\s*VÀ\s*THANG\s*ĐIỂM)\s*(?:\r?\n|$)/i,
    /\n\s*---\s*\n\s*(?:ĐÁP\s*ÁN|HƯỚNG\s*DẪN\s*CHẤM|BẢNG\s*ĐÁP\s*ÁN).*/i
  ];
  let cutoffIndex = -1;
  for (const rx of answerSectionRegexes) {
    const match = text.match(rx);
    if (match && match.index !== undefined) {
      const matchedLine = match[0].toLowerCase();
      const isInstructionPhrase = 
        matchedLine.includes("chọn") || 
        matchedLine.includes("khoanh") || 
        matchedLine.includes("nào sau đây") || 
        matchedLine.includes("mỗi câu");
      if (!isInstructionPhrase) {
        if (cutoffIndex === -1 || match.index < cutoffIndex) {
          cutoffIndex = match.index;
        }
      }
    }
  }
  if (cutoffIndex !== -1) {
    return text.substring(0, cutoffIndex).trim();
  }
  return text.trim();
}

// Load existing published exams from disk on startup
try {
  if (fs.existsSync(PUBLISHED_EXAMS_FILE)) {
    const raw = fs.readFileSync(PUBLISHED_EXAMS_FILE, "utf-8");
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      arr.forEach((item: any) => {
        if (item && item.id) {
          publishedExamsMap.set(item.id, item);
        }
      });
      console.log(`[ExamVault] Loaded ${publishedExamsMap.size} published exams from disk.`);
    }
  }
} catch (e) {
  console.warn("[ExamVault] Could not load published exams file:", e);
}

function persistPublishedExams() {
  try {
    const arr = Array.from(publishedExamsMap.values());
    fs.writeFileSync(PUBLISHED_EXAMS_FILE, JSON.stringify(arr, null, 2), "utf-8");
  } catch (e) {
    console.error("[ExamVault] Failed to persist published exams:", e);
  }
}

// POST: Publish an exam for students (Strictly questions only)
app.post("/api/student/publish-exam", (req, res) => {
  try {
    const {
      id,
      examId,
      title,
      subject,
      grade,
      durationMinutes,
      className,
      deadline,
      teacherNote,
      variant,
      questionsOnlyContent
    } = req.body;

    const key = id || examId;
    if (!key) {
      return res.status(400).json({ error: "Missing exam ID" });
    }

    // Strict server sanitization: guarantee 100% answers/rubrics are removed
    const sanitizedQuestions = sanitizeQuestionsOnlyServer(questionsOnlyContent || "");

    const record = {
      id: key,
      examId: examId || key,
      title: title || "Đề kiểm tra định kì",
      subject: subject || "Chung",
      grade: grade || "",
      durationMinutes: Number(durationMinutes) || 45,
      className: className || "Lớp học",
      deadline: deadline || null,
      teacherNote: teacherNote || "",
      variant: variant || "step3",
      questionsOnlyContent: sanitizedQuestions,
      serverAnswerKey: req.body.serverAnswerKey && typeof req.body.serverAnswerKey === 'object' ? req.body.serverAnswerKey : undefined,
      updatedAt: new Date().toISOString()
    };

    publishedExamsMap.set(key, record);
    persistPublishedExams();

    console.log(`[ExamVault] Published exam ${key} (${record.title}) - ${sanitizedQuestions.length} chars of questions.`);
    res.json({ success: true, exam: record });
  } catch (err: any) {
    console.error("Error publishing exam for students:", err);
    res.status(500).json({ error: err.message || "Không thể phát hành đề thi cho học sinh." });
  }
});

// GET: Retrieve published exam by ID for students (Only contains questions)
app.get("/api/student/exam/:id", (req, res) => {
  try {
    const { id } = req.params;
    let exam = publishedExamsMap.get(id);

    // Fallback reload from disk if missing in memory
    if (!exam && fs.existsSync(PUBLISHED_EXAMS_FILE)) {
      try {
        const raw = fs.readFileSync(PUBLISHED_EXAMS_FILE, "utf-8");
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          const found = arr.find((item: any) => item && (item.id === id || item.examId === id));
          if (found) {
            exam = found;
            publishedExamsMap.set(id, found);
          }
        }
      } catch (e) {
        // ignore
      }
    }

    if (!exam) {
      return res.status(404).json({ error: "Không tìm thấy đề thi trên hệ thống hoặc liên kết đã hết hạn." });
    }

    // Guarantee answers and serverAnswerKey are strictly NOT present before sending response to students
    const { serverAnswerKey, ...safeExamData } = exam;
    const safeExam = {
      ...safeExamData,
      questionsOnlyContent: sanitizeQuestionsOnlyServer(exam.questionsOnlyContent || "")
    };

    res.json(safeExam);
  } catch (err: any) {
    console.error("Error fetching student exam:", err);
    res.status(500).json({ error: "Lỗi khi tải dữ liệu bài thi." });
  }
});

// ========================================================================
// STUDENT SUBMISSIONS API (MỤC 7: SẢN PHẨM CỦA HỌC SINH)
// ========================================================================
const SUBMISSIONS_FILE = path.join(process.cwd(), "student-submissions.json");
const submissionsMap = new Map<string, any>();

try {
  if (fs.existsSync(SUBMISSIONS_FILE)) {
    const raw = fs.readFileSync(SUBMISSIONS_FILE, "utf-8");
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      arr.forEach((sub: any) => {
        if (sub && sub.id) {
          submissionsMap.set(sub.id, sub);
        }
      });
      console.log(`[ExamVault] Loaded ${submissionsMap.size} student submissions from disk.`);
    }
  }
} catch (e) {
  console.warn("[ExamVault] Could not load student submissions file:", e);
}

function persistSubmissions() {
  try {
    const arr = Array.from(submissionsMap.values());
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(arr, null, 2), "utf-8");
  } catch (e) {
    console.error("[ExamVault] Failed to persist submissions:", e);
  }
}

function reloadSubmissionsFromDisk() {
  try {
    if (fs.existsSync(SUBMISSIONS_FILE)) {
      const raw = fs.readFileSync(SUBMISSIONS_FILE, "utf-8");
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        submissionsMap.clear();
        arr.forEach((sub: any) => {
          if (sub && sub.id) {
            submissionsMap.set(sub.id, sub);
          }
        });
      }
    }
  } catch (e) {
    console.warn("[ExamVault] Error reloading submissions from disk:", e);
  }
}

// Helper to generate unique Submission ID in format: SUB-YYYYMMDD-XXXX
function generateStandardSubmissionId(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const seq = Math.floor(1000 + Math.random() * 9000);
  return `SUB-${yyyy}${mm}${dd}-${seq}`;
}

// POST: Student submits exam
app.post("/api/student/submit", (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.examId) {
      return res.status(400).json({ error: "Thiếu thông tin bài kiểm tra hoặc mã đề." });
    }

    const subId = (data.id && data.id.startsWith("SUB-")) ? data.id : generateStandardSubmissionId();
    let calculatedScore = data.score;
    let calculatedCorrect = data.correctCount;
    let calculatedTotal = data.totalQuestions;

    // Check duplicate submission for same student and same exam
    reloadSubmissionsFromDisk();
    const studentNameTrim = (data.studentName || "").trim().toLowerCase();
    const studentClassTrim = (data.studentClass || "").trim().toLowerCase();
    let isDuplicate = false;
    let duplicateInfo = "";

    for (const [, existing] of submissionsMap.entries()) {
      if (
        existing &&
        existing.id !== subId &&
        existing.examId === data.examId &&
        (existing.studentName || "").trim().toLowerCase() === studentNameTrim &&
        (existing.studentClass || "").trim().toLowerCase() === studentClassTrim
      ) {
        isDuplicate = true;
        duplicateInfo = `Học sinh ${data.studentName} (${data.studentClass}) đã có bài nộp trước đó lúc ${existing.submittedAt || "trước đây"}.`;
        break;
      }
    }

    // Rule: Không chấm bài nếu chưa xác định chính xác mã đề
    const hasValidVariant = !!(data.variant && data.variant.trim() !== "" && data.variant !== "unknown");
    if (!hasValidVariant) {
      calculatedScore = undefined;
    }

    // If client did not have answerKey, check if server has serverAnswerKey in publishedExamsMap
    const publishedExam = publishedExamsMap.get(data.examId);
    if (hasValidVariant && publishedExam && publishedExam.serverAnswerKey && typeof publishedExam.serverAnswerKey === 'object') {
      const sKey = publishedExam.serverAnswerKey;
      const totalKeyCount = Object.keys(sKey).length;
      if (totalKeyCount > 0 && (calculatedScore === undefined || calculatedScore === null)) {
        let correctCount = 0;
        let totalScore = 0;
        const answers = data.answers || {};

        // 1. Part I: Proportional weighting according to GDPT 2018
        const p1Keys = Object.keys(sKey).filter(k => k.startsWith('q_'));
        const p1Total = p1Keys.length;
        const p1TargetPoints = p1Total <= 8 ? 4.0 : p1Total <= 12 ? 3.0 : 4.5;
        const p1Weight = p1Total > 0 ? (p1TargetPoints / p1Total) : 0.25;

        let p1Correct = 0;
        for (const k of p1Keys) {
          const studentAns = (answers[k] || '').trim().toUpperCase();
          const expected = (sKey[k] || '').trim().toUpperCase();
          if (studentAns && studentAns === expected) {
            correctCount++;
            p1Correct++;
          }
        }
        totalScore += p1Correct * p1Weight;

        // 2. Part II (GDPT 2018 progressive)
        const p2Questions = new Set<string>();
        Object.keys(sKey).filter(k => k.startsWith('tf_')).forEach(k => {
          const parts = k.split('_');
          if (parts.length >= 3) p2Questions.add(parts[1]);
        });

        const p2Count = p2Questions.size;
        const p2TargetTotal = 4.0;
        const p2PerQMax = p2Count > 0 ? (p2TargetTotal / p2Count) : 1.0;

        for (const qNum of p2Questions) {
          let subCorrectCount = 0;
          for (const sub of ['a', 'b', 'c', 'd']) {
            const k = `tf_${qNum}_${sub}`;
            const studentAns = (answers[k] || '').trim().toUpperCase();
            const expected = (sKey[k] || '').trim().toUpperCase();
            if (studentAns && expected && (
              studentAns === expected ||
              (studentAns.startsWith('Đ') && expected.startsWith('Đ')) ||
              (studentAns.startsWith('S') && expected.startsWith('S')) ||
              (studentAns === 'T' && expected.startsWith('Đ')) ||
              (studentAns === 'F' && expected.startsWith('S'))
            )) {
              subCorrectCount++;
              correctCount++;
            }
          }
          if (subCorrectCount === 1) totalScore += 0.1 * p2PerQMax;
          else if (subCorrectCount === 2) totalScore += 0.25 * p2PerQMax;
          else if (subCorrectCount === 3) totalScore += 0.5 * p2PerQMax;
          else if (subCorrectCount === 4) totalScore += 1.0 * p2PerQMax;
        }

        // 3. Part III: Proportional weighting according to GDPT 2018
        const p3Keys = Object.keys(sKey).filter(k => k.startsWith('sa_'));
        const p3Total = p3Keys.length;
        const p3TargetPoints = Math.max(1.0, 10.0 - p1TargetPoints - p2TargetTotal);
        const p3Weight = p3Total > 0 ? (p3TargetPoints / p3Total) : 0.5;

        let p3Correct = 0;
        for (const k of p3Keys) {
          const studentAns = (answers[k] || '').trim();
          const rawExpected = (sKey[k] || '').trim();
          if (studentAns && rawExpected) {
            const sClean = studentAns.toLowerCase().replace(/[*_~`]/g, '').replace(/\s+/g, '').replace(',', '.');
            let eClean = rawExpected.toLowerCase().replace(/[*_~`]/g, '').replace(/^(?:đáp\s*số|đáp\s*án|kết\s*quả|kết\s*luận)\s*[:\.\-]?\s*/i, '');
            eClean = eClean.replace(/\s*\([^)]*\)\s*$/g, '').replace(/\s*\[[^\]]*\]\s*$/g, '');
            eClean = eClean.replace(/\s*(?:nucleotide|nu|gam|g|kg|m|cm|mm|nm|s|giây|phút|h|giờ|cây|con|hoa|quả|tế\s*bào|tb|%|độ|lần)\.?$/i, '');
            eClean = eClean.replace(/\s+/g, '').replace(',', '.');

            const sDigits = sClean.replace(/[^0-9\.\-]/g, '');
            const eDigits = eClean.replace(/[^0-9\.\-]/g, '');
            const sNum = parseFloat(sClean);
            const eNum = parseFloat(eClean);

            const parseFrac = (v: string): number | null => {
              if (v.includes('/')) {
                const p = v.split('/');
                if (p.length === 2) {
                  const n = parseFloat(p[0]);
                  const d = parseFloat(p[1]);
                  if (!isNaN(n) && !isNaN(d) && d !== 0) return n / d;
                }
              }
              const num = parseFloat(v);
              return isNaN(num) ? null : num;
            };

            let isMatch = (sClean === eClean || (sDigits && eDigits && sDigits === eDigits) || (!isNaN(sNum) && !isNaN(eNum) && Math.abs(sNum - eNum) < 0.0001));

            if (!isMatch) {
              const sVal = parseFrac(sClean.replace('%', ''));
              const eVal = parseFrac(eClean.replace('%', ''));
              if (sVal !== null && eVal !== null) {
                if (Math.abs(sVal - eVal) < 0.0001) isMatch = true;
                else if (rawExpected.includes('%') && !studentAns.includes('%') && Math.abs(sVal * 100 - eVal) < 0.001) isMatch = true;
                else if (studentAns.includes('%') && !rawExpected.includes('%') && Math.abs(sVal - eVal * 100) < 0.001) isMatch = true;
              }
            }

            if (isMatch) {
              correctCount++;
              p3Correct++;
            }
          }
        }
        totalScore += p3Correct * p3Weight;

        calculatedScore = Math.min(10.0, Math.round(totalScore * 10) / 10);
        calculatedCorrect = correctCount;
        calculatedTotal = totalKeyCount;
      }
    }

    let initialStatus = (calculatedScore !== undefined && calculatedScore !== null) ? "graded" : (data.status || "submitted");
    if (isDuplicate) {
      initialStatus = "NGHI TRÙNG BÀI NỘP";
    } else if (!hasValidVariant) {
      initialStatus = "CẦN GIÁO VIÊN KIỂM TRA";
    }

    const submission = {
      ...data,
      id: subId,
      submittedAt: data.submittedAt || new Date().toISOString(),
      studentName: data.studentName || "Học sinh",
      studentClass: data.studentClass || "Lớp học",
      timeSpentSeconds: Number(data.timeSpentSeconds) || 0,
      answers: data.answers || {},
      essayAnswer: data.essayAnswer || "",
      score: calculatedScore !== undefined ? calculatedScore : data.score,
      correctCount: calculatedCorrect !== undefined ? calculatedCorrect : data.correctCount,
      totalQuestions: calculatedTotal || data.totalQuestions,
      status: initialStatus,
      isSuspectedDuplicate: isDuplicate,
      duplicateNote: duplicateInfo,
      hasValidVariant,
      variantWarning: !hasValidVariant ? "Không xác định được mã đề hợp lệ. Đã tạm dừng chấm bài tự động theo quy định." : undefined
    };

    submissionsMap.set(subId, submission);
    persistSubmissions();

    console.log(`[ExamVault] New submission: ${submission.studentName} (${submission.studentClass}) for exam ${submission.examTitle || submission.examId} - Score: ${submission.score}`);
    res.json({ success: true, submission });
  } catch (err: any) {
    console.error("Error saving student submission:", err);
    res.status(500).json({ error: err.message || "Không thể lưu bài nộp của học sinh." });
  }
});

// GET: Retrieve all submissions or filter by examId
app.get("/api/student/submissions", (req, res) => {
  try {
    reloadSubmissionsFromDisk();
    const { examId, className } = req.query;
    let list = Array.from(submissionsMap.values());

    if (examId && typeof examId === "string") {
      list = list.filter((item) => item.examId === examId);
    }
    if (className && typeof className === "string" && className !== "all") {
      list = list.filter((item) => item.studentClass === className);
    }

    // Sort newest first
    list.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    res.json({ success: true, submissions: list });
  } catch (err: any) {
    console.error("Error fetching submissions:", err);
    res.status(500).json({ error: "Lỗi khi tải danh sách bài làm của học sinh." });
  }
});

// PUT: Update a submission (Grading / feedback / score)
app.put("/api/student/submission/:id", (req, res) => {
  try {
    const { id } = req.params;
    const existing = submissionsMap.get(id);
    if (!existing) {
      return res.status(404).json({ error: "Không tìm thấy bài làm này." });
    }

    const updated = {
      ...existing,
      ...req.body,
      id // preserve ID
    };

    submissionsMap.set(id, updated);
    persistSubmissions();
    res.json({ success: true, submission: updated });
  } catch (err: any) {
    console.error("Error updating submission:", err);
    res.status(500).json({ error: "Lỗi khi cập nhật bài làm." });
  }
});

// POST: AI Pedagogical Examiner Grading & Constructive Detailed Feedback (Mục 7)
app.post("/api/student/ai-grade", async (req, res) => {
  try {
    const { submission, examContext } = req.body;
    if (!submission) {
      return res.status(400).json({ error: "Thiếu dữ liệu bài làm của học sinh." });
    }

    let ai: any = null;
    try {
      ai = getGeminiClient();
    } catch (keyErr) {
      console.warn("GEMINI_API_KEY not configured, indicating fallback requested:", keyErr);
      return res.status(200).json({
        useFallback: true,
        message: "Không tìm thấy GEMINI_API_KEY, chuyển sang bộ chấm sư phạm tích hợp."
      });
    }

    const systemInstruction = `# VAI TRÒ
Bạn là HỆ THỐNG CHẤM BÀI KIỂM TRA TỰ ĐỘNG chuyên nghiệp dành cho giáo viên THCS.

Bạn có nhiệm vụ:
1. Đọc và nhận diện chính xác đề kiểm tra.
2. Xác định đúng mã đề.
3. Đối chiếu đề với ma trận và đặc tả.
4. Đối chiếu từng câu hỏi với hướng dẫn chấm tương ứng.
5. Đọc bài làm của học sinh.
6. Chấm từng câu theo ĐÚNG hướng dẫn chấm của đúng mã đề.
7. Tính điểm chính xác.
8. Phát hiện các trường hợp không đủ căn cứ để chấm tự động.
9. Không tự ý thay đổi đáp án, thang điểm hoặc tiêu chí chấm.

==================================================
NHIỆM VỤ TIÊN QUYẾT: ĐỐI CHIẾU MA TRẬN VÀ BẢN ĐẶC TẢ
==================================================
Sau khi xác định mã đề, phải xác định vị trí của từng câu hỏi trong ma trận.

Với mỗi câu, xác định:
- Số câu.
- Chủ đề/nội dung kiến thức.
- Yêu cầu cần đạt.
- Mức độ nhận thức:
  + Nhận biết
  + Thông hiểu
  + Vận dụng
  + Vận dụng cao (nếu có)
- Dạng câu hỏi.
- Số điểm.
- Số ý thành phần nếu có.

Mục đích của bước này là KIỂM TRA TÍNH ĐỒNG BỘ giữa 5 tầng:
MA TRẬN
↓
BẢN ĐẶC TẢ
↓
ĐỀ
↓
HƯỚNG DẪN CHẤM
↓
BÀI LÀM HỌC SINH

Nếu phát hiện câu hỏi trong đề không khớp với ma trận/đặc tả:
KHÔNG tự sửa.
Gắn trạng thái:
"CẢNH BÁO KHÔNG ĐỒNG BỘ MA TRẬN".

Nếu phát hiện sai lệch giữa ma trận và hướng dẫn chấm:
Ưu tiên báo lỗi để giáo viên xác nhận trước khi chấm hàng loạt.

==================================================
NHIỆM VỤ: CHẤM BÀI THEO HƯỚNG DẪN CHẤM CHÍNH THỨC
==================================================
Chỉ sử dụng HƯỚNG DẪN CHẤM/ĐÁP ÁN CHÍNH THỨC tương ứng với đúng mã đề của học sinh.

Với mỗi câu, thực hiện đủ 6 bước:
1. Xác định đáp án học sinh.
2. Xác định đáp án chính thức.
3. So sánh hai dữ liệu.
4. Xác định đúng/sai hoặc mức độ đạt được.
5. Áp dụng chính xác điểm của hướng dẫn chấm.
6. Ghi lại căn cứ chấm.

KHÔNG ĐƯỢC:
- tự suy luận đáp án khác với đáp án chính thức;
- tự cộng thêm điểm;
- tự trừ điểm ngoài hướng dẫn;
- thay đổi điểm thành phần;
- lấy đáp án của mã đề khác;
- dùng kiến thức bên ngoài để thay đổi hướng dẫn chấm.

QUY TẮC XỬ LÝ ĐẶC THÙ:
- Nếu học sinh trả lời khác cách diễn đạt nhưng bản chất hoàn toàn tương đương với đáp án/hướng dẫn chấm và hướng dẫn chấm cho phép chấp nhận cách diễn đạt tương đương:
  → Được tính điểm.
- Nếu hướng dẫn chấm không quy định rõ:
  → Không tự quyết định trong trường hợp có thể ảnh hưởng điểm.
  → Gắn cờ "CẦN GIÁO VIÊN DUYỆT".
- Nếu bài làm không đọc được hoặc dữ liệu hình ảnh không đủ rõ:
  → Không đoán.
  → Gắn "KHÔNG ĐỌC RÕ".

==================================================
YÊU CẦU TIÊN QUYẾT: KIỂM TRA TÍNH ĐỒNG BỘ TRƯỚC KHI CHO PHÉP CHẤM BÀI
==================================================
Khi nhận bài làm của học sinh, AI KHOAN CHẤM NGAY. Hãy thực hiện KIỂM TRA TÍNH ĐỒNG BỘ trước khi cho phép chấm bài.

Đối chiếu 4 nguồn:
[1] MA TRẬN
[2] ĐỀ KIỂM TRA
[3] HƯỚNG DẪN CHẤM
[4] MÃ ĐỀ

Kiểm tra:
- Số lượng câu;
- Số điểm;
- Mã câu;
- Nội dung câu hỏi;
- Đáp án;
- Dạng câu hỏi;
- Mức độ nhận thức;
- Điểm từng câu;
- Tổng điểm;
- Sự tương ứng giữa từng câu trong đề và hướng dẫn chấm.

Tạo bảng:
| Câu | Đề | Hướng dẫn chấm | Điểm | Ma trận | Trạng thái |

Trạng thái gồm:
KHỚP | CẢNH BÁO KHÔNG ĐỒNG BỘ MA TRẬN | MÂU THUẪN | THIẾU DỮ LIỆU | CẦN KIỂM TRA

Nếu có bất kỳ câu nào MÂU THUẪN:
→ KHÔNG cho phép chấm tự động.
Chỉ cho phép chuyển sang bước CHẤM khi toàn bộ dữ liệu cần thiết đã KHỚP.

==================================================
I. NGUYÊN TẮC BẮT BUỘC
==================================================

NGUYÊN TẮC 1 — HƯỚNG DẪN CHẤM LÀ CHUẨN CUỐI CÙNG
Khi chấm bài, thứ tự ưu tiên là:
HƯỚNG DẪN CHẤM CỦA ĐÚNG MÃ ĐỀ → CÂU HỎI TRONG ĐỀ → ĐÁP ÁN → THANG ĐIỂM → MA TRẬN/ĐẶC TẢ.
- Không được tự tạo đáp án mới nếu hướng dẫn chấm đã có.
- Nếu nội dung bài làm khác cách diễn đạt nhưng có cùng ý nghĩa khoa học với đáp án và hướng dẫn chấm cho phép chấp nhận, có thể cho điểm tương ứng.
- Nếu không đủ căn cứ để xác định có đạt yêu cầu hay không:
  → KHÔNG TỰ Ý CHO ĐIỂM.
  → Đánh dấu "CẦN GIÁO VIÊN KIỂM TRA".

NGUYÊN TẮC 2 — ĐÚNG MÃ ĐỀ
- Mỗi bài làm phải được xác định đúng mã đề trước khi chấm (ví dụ: Mã đề 101, 102, 103, 104, hoặc đề gốc).
- Tuyệt đối không sử dụng đáp án của mã đề khác.
- Nếu không xác định được mã đề:
  → DỪNG CHẤM.
  → Thông báo: "Không xác định được mã đề. Không thể chấm chính xác."

NGUYÊN TẮC 3 — KHÔNG ĐƯỢC SUY DIỄN ĐÁP ÁN
Không được:
- tự sửa đáp án;
- tự bổ sung ý mà hướng dẫn chấm không quy định;
- tự thay đổi điểm;
- tự làm tròn điểm nếu chưa được cấu hình;
- tự cho điểm vì "có vẻ đúng";
- lấy kiến thức bên ngoài để thay thế hướng dẫn chấm;
- sử dụng đáp án của câu tương tự để chấm câu khác.

NGUYÊN TẮC 4 — CHẤM ĐÚNG TỪNG CÂU
- Mỗi câu phải được xử lý độc lập.
- Không được vì học sinh làm đúng nhiều câu mà suy đoán câu còn lại đúng.
- Không được vì học sinh trả lời gần đúng mà tự động cho toàn bộ điểm.

NGUYÊN TẮC 5 — BẢO TOÀN THANG ĐIỂM
- Tổng điểm của bài phải bằng tổng điểm các câu được chấm.
- Không được vượt quá điểm tối đa của từng câu.
- Nếu câu có nhiều ý:
  → Chấm từng ý.
  → Cộng điểm từng ý.
  → Không vượt quá điểm tối đa của câu.

==================================================
II. QUY TRÌNH CHẤM 8 BƯỚC
==================================================

BƯỚC 1 — NHẬN DIỆN BÀI LÀM:
Đọc bài làm học sinh. Xác định: Họ và tên; Lớp; Mã đề; Số báo danh nếu có; Các câu học sinh đã trả lời.
Nếu ảnh bị mờ, mất nội dung hoặc không đọc được:
→ Không tự đoán.
→ Đánh dấu phần đó là "KHÔNG ĐỌC ĐƯỢC".

BƯỚC 2 — XÁC ĐỊNH MÃ ĐỀ:
Đối chiếu mã đề học sinh với danh sách mã đề được cung cấp.
Nếu mã đề hợp lệ: Chỉ sử dụng đề + đáp án + hướng dẫn chấm của mã đề đó.
Nếu mã đề không tồn tại: DỪNG CHẤM.

BƯỚC 3 — XÂY DỰNG BẢNG ÁNH XẠ:
Tạo bảng nội bộ:
Câu hỏi → Mã đề → Đáp án → Hướng dẫn chấm → Điểm tối đa → Dạng câu hỏi → Mức độ nhận thức → Yêu cầu cần đạt.
(Lấy đúng điểm tối đa từ Ma trận đề thi và Bản đặc tả theo chuẩn GDPT 2018 / văn bản quy định).

BƯỚC 4 — TRÍCH XUẤT CÂU TRẢ LỜI:
Đọc chính xác câu trả lời của học sinh. Không tự sửa câu trả lời trước khi chấm.
Nếu chữ viết tay không chắc chắn: ghi nhận nguyên trạng ở mức có thể đọc được; đánh dấu độ tin cậy; không tự suy đoán từ ngữ quan trọng.

BƯỚC 5 — ĐỐI CHIẾU:
Đối chiếu từng câu:
BÀI LÀM HỌC SINH ↓ CÂU HỎI TƯƠNG ỨNG ↓ ĐÁP ÁN ↓ HƯỚNG DẪN CHẤM ↓ ĐIỂM.

BƯỚC 6 — CHẤM ĐIỂM:
- Trắc nghiệm một lựa chọn:
  + Xác định đáp án học sinh chọn.
  + Xác định đáp án chuẩn của đúng mã đề.
  + So sánh chính xác:
    * HS = Đáp án → ĐÚNG → Đủ điểm.
    * HS ≠ Đáp án → SAI → 0 điểm.
    * Không trả lời / Bỏ trống → 0 điểm.
  + Tuyệt đối KHÔNG giải thích thay đổi đáp án.
- Câu hỏi nhiều lựa chọn:
  + Xác định:
    - Tập đáp án chuẩn (của đúng mã đề);
    - Tập đáp án học sinh chọn.
  + So sánh hai tập.
  + Chỉ áp dụng cách tính điểm được quy định trong hướng dẫn chấm.
  + Tuyệt đối KHÔNG tự đặt quy tắc:
    - đúng 1 ý = ...
    - đúng 2 ý = ...
    - sai 1 ý = ...
    nếu hướng dẫn chấm không quy định.
  + Nếu hướng dẫn chấm không quy định cách tính điểm từng phần:
    → Không tự đặt quy tắc; học sinh chỉ đạt điểm khi chọn đúng chính xác toàn bộ tập đáp án, hoặc nếu chưa rõ quy định phải đánh dấu "CẦN GIÁO VIÊN KIỂM TRA".
- Đúng/sai:
  + Đối chiếu từng mệnh đề độc lập (ý a, b, c, d).
  + Không được chỉ dựa vào số lượng mệnh đề đúng.
  + Áp dụng đúng công thức tính điểm được cung cấp trong HƯỚNG DẪN CHẤM của đúng mã đề (Ví dụ: barem lũy tiến Bộ GD&ĐT: đúng 1 ý = 0.1đ, đúng 2 ý = 0.25đ, đúng 3 ý = 0.5đ, đúng 4 ý = 1.0đ hoặc theo quy định cụ thể).
  + Nếu hướng dẫn chấm không quy định rõ cách tính:
    → Đánh dấu và thông báo "CẦN GIÁO VIÊN KIỂM TRA".
- Ghép đôi: Chấm từng cặp theo hướng dẫn chấm.
- Điền khuyết: Đối chiếu nội dung với đáp án và quy định chấp nhận.
- Tự luận: Phân tích từng ý (Ý 1, Ý 2...). Điểm câu = tổng điểm các ý. Không vượt quá điểm tối đa.

BƯỚC 7 — KIỂM TRA CHÉO:
Sau khi chấm xong phải kiểm tra 10 câu hỏi:
1. Đúng mã đề chưa?
2. Đúng số câu chưa?
3. Có câu nào bị bỏ sót không?
4. Có câu nào chấm hai lần không?
5. Có sử dụng nhầm đáp án mã đề khác không?
6. Điểm từng câu có vượt điểm tối đa không?
7. Tổng điểm có bằng tổng điểm thành phần không?
8. Điểm có đúng thang điểm của đề không?
9. Có câu nào AI không chắc chắn không?
10. Có câu nào cần giáo viên kiểm tra không?
Nếu phát hiện sai: quay lại bước chấm tương ứng và sửa.

BƯỚC 8 — XUẤT KẾT QUẢ:
A. THÔNG TIN BÀI: Họ tên, Lớp, Mã đề, Thời gian, Trạng thái bài ("ĐÃ CHẤM" hoặc "CẦN GIÁO VIÊN KIỂM TRA").
B. BẢNG CHẤM (Bắt buộc theo mẫu):
| Câu | Câu trả lời HS | Đáp án/Hướng dẫn chấm | Điểm tối đa | Điểm đạt | Trạng thái |
Trạng thái gồm: ĐÚNG | SAI | ĐÚNG MỘT PHẦN | KHÔNG TRẢ LỜI | KHÔNG ĐỌC ĐƯỢC | CẦN GIÁO VIÊN KIỂM TRA.
C. TỔNG ĐIỂM: Điểm đạt: X/Y (ví dụ X/10.0).
D. NHẬN XÉT: Chỉ nhận xét dựa trên bằng chứng từ bài làm.

==================================================
III. QUY TẮC ĐẶC BIỆT CHO BÀI TỰ LUẬN
==================================================
- KHÔNG được chấm dựa trên việc câu trả lời "có vẻ đúng" hoặc theo cảm tính.
- Phải phân rã câu hỏi thành các tiêu chí điểm được quy định trong HƯỚNG DẪN CHẤM.

Với mỗi tiêu chí:
1. Xác định yêu cầu của tiêu chí.
2. Tìm bằng chứng tương ứng trong bài làm.
3. Xác định học sinh đạt hay chưa đạt (ĐẠT / KHÔNG ĐẠT / ĐẠT MỘT PHẦN).
4. Xác định mức điểm tương ứng.
5. Giải thích ngắn gọn căn cứ cho điểm.

Mẫu phân tích từng ý tự luận:
Ý 1:
Yêu cầu: [Yêu cầu của tiêu chí trong hướng dẫn chấm]
Bài làm học sinh: [Trích dẫn bằng chứng cụ thể từ bài làm]
Đánh giá: ĐẠT / KHÔNG ĐẠT / ĐẠT MỘT PHẦN
Điểm: [Điểm đạt] / [Điểm tối đa]
Căn cứ: [Giải thích ngắn gọn căn cứ cho điểm]

Ý 2:
...
Tổng điểm câu: [Tổng điểm các ý] / [Điểm tối đa của câu]

QUY TẮC BẮT BUỘC:
- Không có bằng chứng → không cho điểm.
- Có một phần ý → chỉ cho điểm phần tương ứng nếu hướng dẫn chấm cho phép.
- Diễn đạt khác nhưng đúng bản chất → chấp nhận nếu không trái hướng dẫn chấm.
- Trả lời mâu thuẫn với kiến thức khoa học → không đạt tiêu chí.
- Không rõ nghĩa → CẦN GIÁO VIÊN KIỂM TRA.

==================================================
IV. QUY TẮC XỬ LÝ ẢNH BÀI LÀM
==================================================
1. Đọc toàn bộ ảnh trước.
2. Xác định số câu.
3. Nhận diện câu trả lời.
4. Kiểm tra chữ viết tay.
5. Không suy đoán chữ không rõ.
6. Nếu có thể hiểu chắc chắn → chấm.
7. Nếu không chắc chắn → yêu cầu giáo viên kiểm tra.
Không được tự động biến chữ viết tay không rõ thành một đáp án cụ thể.

==================================================
V. QUY TẮC XỬ LÝ SAI SÓT CỦA DỮ LIỆU
==================================================
Nếu phát hiện:
- Đề và hướng dẫn chấm không khớp;
- Mã đề không khớp;
- Số câu không khớp;
- Điểm trong đề không khớp hướng dẫn chấm;
- Đáp án trùng hoặc mâu thuẫn;
- Ma trận không phù hợp với đề;
- Hướng dẫn chấm thiếu tiêu chí;
→ KHÔNG tiếp tục chấm một cách mù quáng.
Phải báo: "PHÁT HIỆN MÂU THUẪN DỮ LIỆU — CẦN GIÁO VIÊN KIỂM TRA"
và chỉ rõ: Vị trí; Nội dung mâu thuẫn; Hai nguồn dữ liệu liên quan; Đề xuất cách xử lý.

==================================================
VI. QUY TẮC TÍNH ĐIỂM
==================================================
Tổng điểm bài làm phải được tính từ điểm của từng câu/ý đã chấm.

Công thức:
TỔNG ĐIỂM = Σ ĐIỂM CÂU 1 + ĐIỂM CÂU 2 + ... + ĐIỂM CÂU n

- Tuyệt đối không tính điểm bằng cách ước lượng.
- Không làm tròn giữa các câu (giữ nguyên điểm thành phần chính xác).
- Chỉ làm tròn ở bước cuối nếu quy định của đề kiểm tra yêu cầu (làm tròn đến 1 hoặc 2 chữ số thập phân).
- KIỂM TRA BẮT BUỘC: Tổng điểm thực tế ≤ Tổng điểm tối đa (10.0đ).
- NẾU VI PHẠM:
  → Báo lỗi hệ thống, KHÔNG xuất kết quả cuối cùng ("LỖI HỆ THỐNG — VƯỢT ĐIỂM TỐI ĐA").

==================================================
VII. KIỂM TRA CHÉO MÃ ĐỀ TRƯỚC KHI CHỐT ĐIỂM (KIỂM TRA LẦN 2)
==================================================
Trước khi hoàn thành bài chấm, hệ thống phải thực hiện kiểm tra chéo lần 2:

CHECK 1: Mã đề học sinh đang được chấm.
CHECK 2: Bộ đáp án đang sử dụng.
CHECK 3: Thứ tự câu hỏi.
CHECK 4: Đáp án của từng câu.
CHECK 5: Thang điểm.
CHECK 6: Tổng điểm tối đa.

QUY TẮC BẮT BUỘC:
- Mã đề học sinh ≠ mã đề đáp án → DỪNG CHẤM.
- Tổng điểm thành phần > điểm tối đa → DỪNG CHẤM.
- Tổng điểm bài > tổng điểm quy định → DỪNG CHẤM.
- Có câu trong bài nhưng không có trong hướng dẫn chấm → CẢNH BÁO.
- Có câu trong hướng dẫn chấm nhưng không tìm thấy bài làm → xác định là "KHÔNG TRẢ LỜI", không tự suy đoán.
- Có nhiều đáp án mâu thuẫn giữa các tài liệu → DỪNG và yêu cầu giáo viên xác nhận.

==================================================
VIII. KIỂM TRA CUỐI (10 BƯỚC XÁC NHẬN TRƯỚC KHI CÔNG BỐ ĐIỂM)
==================================================
Trước khi công bố điểm học sinh, hệ thống PHẢI thực hiện 10 bước kiểm tra cuối:
[1] Đúng học sinh? (Họ tên, lớp, thông tin bài làm khớp và hợp lệ)
[2] Đúng mã đề? (Mã đề bài làm khớp chính xác với mã đề đáp án đang dùng)
[3] Đúng đề? (Nội dung đề thi và các câu hỏi khớp với đề chính thức)
[4] Đúng ma trận? (Cấu trúc ma trận, tỷ lệ và mức độ nhận thức khớp với đề)
[5] Đúng bản đặc tả? (Yêu cầu cần đạt bám sát bản đặc tả và văn bản quy định)
[6] Đúng hướng dẫn chấm? (Thang điểm barem chuẩn xác của đúng mã đề)
[7] Đúng đáp án? (Bộ đáp án sử dụng là đáp án chính thức)
[8] Đúng điểm từng câu? (Điểm mỗi câu ≤ điểm tối đa của câu đó)
[9] Đúng tổng điểm? (Tổng điểm thực tế = Σ Điểm các câu ≤ 10.0đ, công thức chính xác)
[10] Có câu nào cần giáo viên duyệt? (Không còn câu nào bị gắn cờ 'CẦN GIÁO VIÊN DUYỆT' hoặc 'KHÔNG ĐỌC RÕ')

QUY TẮC CÔNG BỐ:
- Chỉ được xác nhận: "ĐÃ CHẤM – ĐỦ CĂN CỨ" khi CẢ 10 BƯỚC ĐỀU HỢP LỆ (10/10).
- Nếu có BẤT KỲ LỖI NÀO hoặc câu cần duyệt: KHÔNG được tự động xác nhận kết quả cuối cùng, chuyển trạng thái "CẦN GIÁO VIÊN KIỂM TRA" hoặc "CẦN GIÁO VIÊN DUYỆT".

==================================================
IX. PHÁT HIỆN BẤT THƯỜNG (ANOMALY DETECTION)
==================================================
Hệ thống PHẢI cảnh báo và chuyển ngay trạng thái bài sang "CẦN GIÁO VIÊN KIỂM TRA" kèm theo nguyên nhân cụ thể nếu phát hiện bất kỳ trường hợp nào sau đây:
1. Không xác định được mã đề.
2. Bài làm không đọc rõ (chữ mờ, nhòe, không phân biệt được).
3. Học sinh nộp nhầm tệp (tệp không đúng định dạng bài làm/ảnh không hợp lệ).
4. Bài làm thiếu trang / thiếu phần thi.
5. Một câu trắc nghiệm có nhiều phương án được chọn bất thường (khoanh từ 2 đáp án trở lên ở câu hỏi một lựa chọn).
6. Có dấu hiệu câu trả lời bị cắt mất (trang bị cụt, thiếu nội dung).
7. Không tìm thấy đáp án tương ứng cho mã đề.
8. Không tìm thấy tiêu chí chấm / hướng dẫn chấm.
9. Tổng điểm bất hợp lệ (vượt trần 10.0đ hoặc sai lệch công thức tổng Σ điểm các câu).
10. Có sự khác nhau giữa hướng dẫn chấm và đáp án chính thức.
11. Ma trận không khớp với đề thi (số lượng câu, mức độ, cấu trúc không tương thích).
12. Mã đề trên bài làm khác mã đề được hệ thống giao.
13. Một học sinh có nhiều bài nộp trùng lặp (tranh chấp bài làm).

QUY TẮC TUYỆT ĐỐI: KHÔNG ĐƯỢC ĐOÁN. Khi gặp bất kỳ bất thường nào trên, bắt buộc chuyển trạng thái thành "CẦN GIÁO VIÊN KIỂM TRA" và ghi rõ nguyên nhân.

==================================================
XI. QUY TẮC BẤT BIẾN (IMMUTABLE RULES)
==================================================
Hướng dẫn chấm của giáo viên là nguồn chuẩn duy nhất để chấm điểm.

AI có thể:
- đọc;
- nhận diện;
- chuẩn hóa;
- đối chiếu;
- tính điểm;
- phát hiện mâu thuẫn;
- cảnh báo lỗi.

AI KHÔNG ĐƯỢC:
- tự sửa đáp án;
- tự sửa ma trận;
- tự sửa bản đặc tả;
- tự sửa thang điểm;
- tự thay đổi điểm;
- tự quyết định một trường hợp tranh chấp;
- tự bỏ qua lỗi dữ liệu.

NẾU AI PHÁT HIỆN NGUỒN DỮ LIỆU CÓ KHẢ NĂNG SAI:
→ KHÔNG sửa.
→ BÁO CẢNH BÁO.
→ CHỜ GIÁO VIÊN XÁC NHẬN (chuyển trạng thái: "CẦN GIÁO VIÊN KIỂM TRA" hoặc "CẦN GIÁO VIÊN DUYỆT").

==================================================
XII. NGUYÊN TẮC CHỐNG CHẤM SAI (10 CHECKS)
Trước khi trả kết quả cuối cùng, hệ thống phải tự kiểm tra:
CHECK 01: Mã đề đúng?
CHECK 02: Đề đúng?
CHECK 03: Hướng dẫn chấm đúng?
CHECK 04: Đáp án đúng?
CHECK 05: Câu hỏi đúng?
CHECK 06: Bài làm đúng?
CHECK 07: Điểm từng câu đúng?
CHECK 08: Tổng điểm đúng?
CHECK 09: Có câu không chắc chắn?
CHECK 10: Có mâu thuẫn dữ liệu?
Chỉ khi CHECK 01–08 đạt yêu cầu và 10 bước Kiểm Tra Cuối hợp lệ mới được xác nhận: "ĐÃ CHẤM – ĐỦ CĂN CỨ".
Nếu CHECK 09 hoặc CHECK 10 phát hiện vấn đề: chuyển trạng thái: "CẦN GIÁO VIÊN KIỂM TRA".

==================================================
X. CẤM TUYỆT ĐỐI (15 ĐIỀU)
==================================================
1. Dùng đáp án của mã đề khác.
2. Tự tạo đáp án.
3. Tự thay đổi hướng dẫn chấm.
4. Tự thay đổi thang điểm.
5. Cho điểm vượt mức quy định.
6. Chấm theo cảm tính.
7. Đoán chữ viết tay không rõ.
8. Bỏ qua câu hỏi.
9. Bỏ qua ý trong câu tự luận.
10. Làm tròn điểm nếu chưa được quy định.
11. Sửa bài làm của học sinh rồi mới chấm.
12. Sử dụng kiến thức bên ngoài để ghi đè hướng dẫn chấm.
13. Xác nhận "đúng" khi chưa có đủ căn cứ.
14. Xác nhận "đã chấm chính xác" nếu còn dữ liệu mâu thuẫn.
15. Tự đặt quy tắc tính điểm cho câu hỏi nhiều lựa chọn (đúng 1 ý = ..., đúng 2 ý = ..., sai 1 ý = ...) khi hướng dẫn chấm không quy định.

==================================================
VIII. ĐỊNH DẠNG ĐẦU RA (CHUẨN KẾT QUẢ CHẤM BÀI CHÍNH THỨC)
==================================================
Trong trường formattedFeedback, BẮT BUỘC tuân thủ cấu trúc chuẩn mực sau:

KẾT QUẢ CHẤM BÀI

Họ và tên học sinh: [HỌ TÊN]
Lớp: [LỚP]
Mã đề: [MÃ ĐỀ]
Thời gian nộp: [THỜI GIAN]

TRẠNG THÁI:
[ĐÃ CHẤM / CẦN GIÁO VIÊN DUYỆT / LỖI DỮ LIỆU]

CHI TIẾT:

| Câu | Đáp án học sinh | Đáp án chuẩn | Kết quả | Điểm | Căn cứ |
| --- | --------------- | ------------ | ------- | ----: | ------ |
[Liệt kê đầy đủ mọi câu và ý]

ĐIỂM THEO PHẦN:
- Phần I: [Điểm]/[Tổng điểm phần I] điểm
- Phần II: [Điểm]/[Tổng điểm phần II] điểm
- Phần III: [Điểm]/[Tổng điểm phần III] điểm
- Phần IV: [Điểm]/[Tổng điểm phần IV] điểm (nếu có)

TỔNG ĐIỂM: [Tổng điểm]/10.0 điểm

KIỂM TRA ĐỒNG BỘ:
✓ Mã đề
✓ Đáp án
✓ Hướng dẫn chấm
✓ Ma trận
✓ Thang điểm

CÂU CẦN GIÁO VIÊN XEM LẠI:
[Liệt kê các câu/ý cần xem xét hoặc ghi 'Không có']

NHẬN XÉT NGẮN:
- Nội dung học sinh làm đúng: [Tóm tắt nội dung làm đúng]
- Nội dung còn sai: [Tóm tắt nội dung làm sai/nhầm lẫn]
- Nội dung cần củng cố: [Kiến thức/kĩ năng trọng tâm cần ôn tập]

🌟 LỜI NHẬN XÉT CỦA THẦY/CÔ:
- [1-2 câu nhận xét sư phạm chuẩn mực, khích lệ nỗ lực học tập của học sinh]`;

    const evalSummary = examContext?.evaluationSummary;

    const userPrompt = `Dưới đây là hồ sơ kiểm tra đánh giá và bài làm thực tế của học sinh:

1. THÔNG TIN HỌC SINH:
- Họ và tên: ${submission.studentName || 'Học sinh'}
- Lớp: ${submission.studentClass || 'Lớp học'}
- Mã đề thi làm bài: ${submission.variant || 'Đề gốc (step3)'}
- Thời gian làm bài: ${Math.round(((submission.timeSpentSeconds || 0) / 60) * 10) / 10} phút
- Phiếu câu trả lời của học sinh:
${JSON.stringify(submission.answers || {}, null, 2)}
- Bài làm tự luận / Ghi chú (nếu có):
${submission.essayAnswer ? submission.essayAnswer : '(Không có phần tự luận viết riêng)'}

2. ĐỀ BÀI VÀ THANG ĐIỂM (RUBRIC TỪ MỤC 0 ĐẾN MỤC 6):
- Tên bài kiểm tra: ${examContext?.examTitle || submission.examTitle || 'Kiểm tra định kì'}
- Môn: ${examContext?.subject || submission.subject || 'Chung'}, Lớp: ${examContext?.grade || submission.grade || ''}
- Bảng đáp án chuẩn trích xuất:
${JSON.stringify(examContext?.serverAnswerKey || {}, null, 2)}
- Đề kiểm tra & Hướng dẫn chấm chi tiết:
${(examContext?.resultStep3 || examContext?.rawExamContent || '').slice(0, 18000)}
${examContext?.resultStep2 ? `\n- Ma trận và Bản đặc tả đề thi (Mục 2 - Chuẩn văn bản quy định):\n${examContext.resultStep2.slice(0, 10000)}` : (examContext?.matrix ? `\n- Ma trận đề thi (Mục 2):\n${examContext.matrix.slice(0, 5000)}` : '')}

${evalSummary ? `3. KẾT QUẢ ĐỐI CHIẾU CHUẨN XÁC GIỮA BÀI LÀM CỦA HỌC SINH VÀ ĐÁP ÁN:
- Tổng số lệnh hỏi đúng: ${evalSummary.correctCount} / ${evalSummary.totalQuestions}
- Phần I (Trắc nghiệm): Đúng ${evalSummary.details?.p1Correct ?? 0}/${evalSummary.details?.p1Total ?? 0} câu. (Các câu đúng: ${evalSummary.details?.p1CorrectList?.join(', ') || 'không có'}. Các câu sai: ${evalSummary.details?.p1WrongList?.join(', ') || 'không có'}).
- Phần II (Đúng - Sai): Đúng ${evalSummary.details?.p2UnitsCorrect ?? 0}/${evalSummary.details?.p2UnitsTotal ?? 0} ý hỏi.
- Phần III (Trả lời ngắn): Đúng ${evalSummary.details?.p3Correct ?? 0}/${evalSummary.details?.p3Total ?? 0} câu. (Đúng: ${evalSummary.details?.p3CorrectList?.join(', ') || 'không có'}. Sai: ${evalSummary.details?.p3WrongList?.join(', ') || 'không có'}).
- Điểm số chuẩn xác theo barem rubric: ${evalSummary.score} / 10.0.

- ĐIỂM TỐI ĐA BẮT BUỘC KHÓA BÁM SÁT MA TRẬN & BẢN ĐẶC TẢ:
  + Phần I: Tổng ${evalSummary.details?.p1MaxScore ?? 3.0}đ (Mỗi câu tối đa ${evalSummary.details?.p1Total > 0 ? (evalSummary.details.p1MaxScore / evalSummary.details.p1Total).toFixed(2) : '0.25'}đ).
  + Phần II: Tổng ${evalSummary.details?.p2MaxScore ?? 4.0}đ (Mỗi câu lớn tối đa ${evalSummary.details?.p2QuestionsTotal > 0 ? (evalSummary.details.p2MaxScore / evalSummary.details.p2QuestionsTotal).toFixed(2) : '1.00'}đ; mỗi ý nhỏ tối đa 0.25đ).
  + Phần III: Tổng ${evalSummary.details?.p3MaxScore ?? 3.0}đ (Mỗi câu tối đa ${evalSummary.details?.p3Total > 0 ? (evalSummary.details.p3MaxScore / evalSummary.details.p3Total).toFixed(2) : '0.50'}đ).

LƯU Ý QUAN TRỌNG:
- Bạn là HỆ THỐNG CHẤM BÀI KIỂM TRA TỰ ĐỘNG chuyên nghiệp dành cho giáo viên THCS.
- Bảng kết quả từng câu và nhận xét phải CHÍNH XÁC TUYỆT ĐỐI với các câu đúng, câu sai đã được đối chiếu ở trên.
- Điểm tối đa (maxScore) của từng câu trong questionResultsTable BẮT BUỘC PHẢI KHỚP TUYỆT ĐỐI với quy định của Ma trận và Bản đặc tả nêu trên.
- Điểm số tổng kết trong nhận xét bắt buộc là ${evalSummary.score} / 10.0 (trừ khi phát hiện lỗi nghiêm trọng trong đề/đáp án).
- Đối với câu hỏi nhiều lựa chọn: Bắt buộc xác định tập đáp án chuẩn và tập đáp án học sinh chọn, so sánh hai tập. Chỉ áp dụng cách tính điểm được quy định trong hướng dẫn chấm. Tuyệt đối không tự đặt quy tắc: đúng 1 ý = ..., đúng 2 ý = ..., sai 1 ý = ... nếu hướng dẫn chấm không quy định.
- Trạng thái từng câu (verdict) phải dùng một trong các giá trị chuẩn: "ĐÚNG", "SAI", "ĐÚNG MỘT PHẦN", "KHÔNG TRẢ LỜI", "KHÔNG ĐỌC RÕ", "KHÔNG ĐỌC ĐƯỢC", "CẦN GIÁO VIÊN DUYỆT", "CẦN GIÁO VIÊN KIỂM TRA".
- Trạng thái chung (submissionStatus) là "ĐÃ CHẤM – ĐỦ CĂN CỨ" nếu cả 10 bước Kiểm Tra Cuối và CHECK 01–08 đều đạt yêu cầu; hoặc "CẦN GIÁO VIÊN KIỂM TRA" / "CẦN GIÁO VIÊN DUYỆT" nếu phát hiện mâu thuẫn dữ liệu hoặc câu chưa đủ điều kiện công bố.` : ''}

Hãy thực hiện đầy đủ 8 bước của Quy trình chấm tự động, kiểm tra 10 CHECKS chống chấm sai, đối chiếu 5 quan hệ đồng bộ, thực hiện 10 bước Kiểm Tra Cuối, xuất bảng kết quả từng câu có minh chứng truy vết và xuất JSON theo đúng cấu trúc.`;

    const response = await generateContentWithRetry(ai, {
      model: PRIMARY_GEMINI_MODEL,
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER, description: "Tổng điểm đạt được trên thang điểm 10 (ví dụ: 8.5)" },
            maxScore: { type: Type.NUMBER, description: "Thang điểm tối đa (mặc định 10.0)" },
            submissionStatus: { type: Type.STRING, description: "Trạng thái bài: 'ĐÃ CHẤM – ĐỦ CĂN CỨ', 'ĐÃ CHẤM', 'CẦN GIÁO VIÊN DUYỆT' hoặc 'CẦN GIÁO VIÊN KIỂM TRA'" },
            isAllowedToGrade: { type: Type.BOOLEAN, description: "False nếu phát hiện bất kỳ mâu thuẫn nào giữa 4 nguồn dữ liệu" },
            warning: { type: Type.STRING, description: "Cảnh báo nếu có sai lệch giữa ma trận/đề/đáp án hoặc bài làm không rõ" },
            isOfficialScoreWithheld: { type: Type.BOOLEAN, description: "True nếu phát hiện lỗi nghiêm trọng không thể xuất điểm chính thức" },
            preGradingSyncTable: {
              type: Type.ARRAY,
              description: "Bảng kiểm tra tính đồng bộ trước khi chấm: | Câu | Đề | Hướng dẫn chấm | Điểm | Ma trận | Trạng thái |",
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  exam: { type: Type.STRING },
                  rubric: { type: Type.STRING },
                  points: { type: Type.NUMBER },
                  matrix: { type: Type.STRING },
                  status: { type: Type.STRING, description: "KHỚP | CẢNH BÁO KHÔNG ĐỒNG BỘ MA TRẬN | MÂU THUẪN | THIẾU DỮ LIỆU | CẦN KIỂM TRA" },
                  note: { type: Type.STRING }
                },
                required: ["question", "exam", "rubric", "points", "matrix", "status"]
              }
            },
            matrixSpecMappings: {
              type: Type.ARRAY,
              description: "Bảng đối chiếu 5 tầng: Ma trận -> Đặc tả -> Đề -> Hướng dẫn chấm -> Bài làm",
              items: {
                type: Type.OBJECT,
                properties: {
                  questionNumber: { type: Type.STRING, description: "Số câu (ví dụ: Câu 1, Câu 2.a)" },
                  topic: { type: Type.STRING, description: "Chủ đề / nội dung kiến thức" },
                  learningObjective: { type: Type.STRING, description: "Yêu cầu cần đạt" },
                  cognitiveLevel: { type: Type.STRING, description: "Nhận biết | Thông hiểu | Vận dụng | Vận dụng cao" },
                  questionType: { type: Type.STRING, description: "Dạng câu hỏi (TN nhiều lựa chọn, Đúng-Sai, Trả lời ngắn, Tự luận)" },
                  points: { type: Type.NUMBER, description: "Số điểm" },
                  subItemsCount: { type: Type.NUMBER, description: "Số ý thành phần" },
                  status: { type: Type.STRING, description: "KHỚP | CẢNH BÁO KHÔNG ĐỒNG BỘ MA TRẬN | MÂU THUẪN | THIẾU DỮ LIỆU | CẦN KIỂM TRA" },
                  warning: { type: Type.STRING, description: "Chi tiết cảnh báo không đồng bộ nếu có" }
                },
                required: ["questionNumber", "topic", "learningObjective", "cognitiveLevel", "questionType", "points", "status"]
              }
            },
            antiMistakeChecks: {
              type: Type.OBJECT,
              properties: {
                check01_code: { type: Type.BOOLEAN, description: "Mã đề đúng?" },
                check02_exam: { type: Type.BOOLEAN, description: "Đề đúng?" },
                check03_rubric: { type: Type.BOOLEAN, description: "Hướng dẫn chấm đúng?" },
                check04_answer: { type: Type.BOOLEAN, description: "Đáp án đúng?" },
                check05_question: { type: Type.BOOLEAN, description: "Câu hỏi đúng?" },
                check06_submission: { type: Type.BOOLEAN, description: "Bài làm đúng?" },
                check07_itemScores: { type: Type.BOOLEAN, description: "Điểm từng câu đúng?" },
                check08_totalScore: { type: Type.BOOLEAN, description: "Tổng điểm đúng?" },
                check09_uncertainty: { type: Type.BOOLEAN, description: "Có câu không chắc chắn không?" },
                check10_dataConflict: { type: Type.BOOLEAN, description: "Có mâu thuẫn dữ liệu không?" }
              },
              required: ["check01_code", "check02_exam", "check03_rubric", "check04_answer", "check05_question", "check06_submission", "check07_itemScores", "check08_totalScore"]
            },
            synchronizationChecks: {
              type: Type.OBJECT,
              properties: {
                matrixVsExam: { type: Type.STRING },
                examVsAnswers: { type: Type.STRING },
                answersVsRubric: { type: Type.STRING },
                rubricVsSubmission: { type: Type.STRING },
                matrixVsResults: { type: Type.STRING },
                isSynchronized: { type: Type.BOOLEAN },
                warningDetails: { type: Type.STRING }
              },
              required: ["matrixVsExam", "examVsAnswers", "answersVsRubric", "rubricVsSubmission", "matrixVsResults", "isSynchronized"]
            },
            questionResultsTable: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING, description: "Ví dụ: Câu 1, Câu 2.a, Câu 1 (TLN)" },
                  maxScore: { type: Type.NUMBER, description: "Điểm tối đa của câu/ý" },
                  score: { type: Type.NUMBER, description: "Điểm đạt được" },
                  verdict: { type: Type.STRING, description: "Trạng thái: ĐÚNG | SAI | ĐÚNG MỘT PHẦN | KHÔNG TRẢ LỜI | KHÔNG ĐỌC RÕ | KHÔNG ĐỌC ĐƯỢC | CẦN GIÁO VIÊN DUYỆT | CẦN GIÁO VIÊN KIỂM TRA" },
                  studentAnswer: { type: Type.STRING, description: "Bài làm thực tế của học sinh" },
                  expectedAnswer: { type: Type.STRING, description: "Đáp án/tiêu chí chính thức" },
                  analysis: { type: Type.STRING, description: "Đối chiếu và minh chứng" },
                  basisForScore: { type: Type.STRING, description: "Ghi lại căn cứ chấm theo Hướng dẫn chấm chính thức" }
                },
                required: ["question", "maxScore", "score", "verdict"]
              }
            },
            learningFeedback: {
              type: Type.OBJECT,
              properties: {
                achievedKnowledge: { type: Type.STRING },
                unachievedKnowledge: { type: Type.STRING },
                errorsToFix: { type: Type.STRING },
                recommendedReview: { type: Type.STRING }
              },
              required: ["achievedKnowledge", "unachievedKnowledge", "errorsToFix", "recommendedReview"]
            },
            formattedFeedback: { type: Type.STRING, description: "Toàn bộ nội dung đánh giá có bảng Markdown từng câu và 4 phần emoji chuẩn" },
            strengths: { type: Type.STRING, description: "Ý/Câu đã làm tốt & Kiến thức đã đạt" },
            weaknesses: { type: Type.STRING, description: "Lỗi sai & Điểm còn thiếu & Kiến thức chưa đạt" },
            improvements: { type: Type.STRING, description: "Hướng dẫn cải thiện & Nội dung nên ôn tập" },
            teacherComment: { type: Type.STRING, description: "Lời nhận xét của Thầy/Cô (1-2 câu sư phạm)" }
          },
          required: ["score", "maxScore", "formattedFeedback", "strengths", "weaknesses", "improvements", "teacherComment"]
        }
      }
    });

    const responseText = response.text || "{}";
    try {
      const parsed = JSON.parse(responseText);
      return res.json({
        success: true,
        evaluation: {
          ...parsed,
          score: typeof evalSummary?.score === 'number' ? evalSummary.score : parsed.score,
          correctCount: evalSummary?.correctCount,
          totalQuestions: evalSummary?.totalQuestions,
          gradedBy: 'ai',
          gradedAt: new Date().toISOString()
        }
      });
    } catch (parseErr) {
      console.warn("JSON parse error for AI grade, returning raw text inside structure:", parseErr);
      return res.json({
        success: true,
        evaluation: {
          score: evalSummary?.score !== undefined ? evalSummary.score : (submission.score !== undefined ? submission.score : 8.0),
          maxScore: 10.0,
          correctCount: evalSummary?.correctCount,
          totalQuestions: evalSummary?.totalQuestions,
          formattedFeedback: responseText,
          strengths: "Đã hoàn thành các câu hỏi theo yêu cầu.",
          weaknesses: "Cần rà soát lại một số câu trả lời chưa chính xác.",
          improvements: "Ôn tập lại các trọng tâm kiến thức và rèn luyện kỹ năng giải nhanh.",
          teacherComment: "Em có nhiều cố gắng trong bài làm, hãy tiếp tục phát huy ở các bài kiểm tra tiếp theo!",
          gradedBy: 'ai',
          gradedAt: new Date().toISOString()
        }
      });
    }
  } catch (err: any) {
    console.error("Error in /api/student/ai-grade:", err);
    return res.status(200).json({
      useFallback: true,
      error: err?.message || "Lỗi khi gọi AI chấm bài",
      message: "Chuyển sang bộ chấm sư phạm tích hợp trên hệ thống."
    });
  }
});

// DELETE: Delete single submission
app.delete("/api/student/submission/:id", (req, res) => {
  try {
    const { id } = req.params;
    if (submissionsMap.has(id)) {
      submissionsMap.delete(id);
      persistSubmissions();
    }
    res.json({ success: true, message: "Đã xóa bài làm thành công." });
  } catch (err: any) {
    console.error("Error deleting submission:", err);
    res.status(500).json({ error: "Lỗi khi xóa bài làm." });
  }
});

// DELETE: Bulk clear submissions for exam
app.delete("/api/student/submissions", (req, res) => {
  try {
    const { examId } = req.query;
    if (examId && typeof examId === "string" && examId !== "all" && examId !== "undefined") {
      for (const [id, sub] of submissionsMap.entries()) {
        if (sub.examId === examId) {
          submissionsMap.delete(id);
        }
      }
    } else {
      submissionsMap.clear();
    }
    persistSubmissions();
    res.json({ success: true, message: "Đã dọn dẹp danh sách bài làm." });
  } catch (err: any) {
    console.error("Error clearing submissions:", err);
    res.status(500).json({ error: "Lỗi khi dọn dẹp bài làm." });
  }
});

// Custom error handling middleware for handling payload too large gracefully and returning JSON
app.use((err: any, req: any, res: any, next: any) => {
  if (err) {
    console.error("Express Uncaught Payload/Server Error:", err);
    if (err.status === 413 || err.statusCode === 413 || err.type === "entity.too.large") {
      return res.status(413).json({
        error: "Dung lượng tài liệu quá lớn so với giới hạn xử lý. Hãy chia nhỏ tài liệu hoặc tối ưu hóa kích thước tệp trước khi tải lên!"
      });
    }
    return res.status(err.status || err.statusCode || 500).json({
      error: err.message || "Đã xảy ra lỗi hệ thống khi xử lý dữ liệu."
    });
  }
  next();
});

// Express application exported for the explicit Vercel API function in api/[...path].ts.
export default app;
