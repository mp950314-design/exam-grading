import type { GradingResult } from "../types";

export const SUBJECT_SUGGESTIONS = [
  "犯罪偵查學",
  "偵查法學",
  "刑案現場處理與刑事鑑識",
];

const DIMENSION_LABELS = [
  "破題與爭點掌握",
  "法條引用正確性",
  "論證結構完整度",
  "涵蓋考點程度",
  "結論呼應與用語規範",
];

const SYSTEM_PROMPT = `你是台灣三等刑事警察人員特考的資深申論題閱卷委員。你會收到「科目」「題目」「考生擬答」，有時候還會有「參考資料」。請依以下五個維度批改，每個維度給 0-10 分並附一句話評語（15-40字）：
${DIMENSION_LABELS.map((d, i) => `${i + 1}. ${d}`).join("\n")}

若科目屬於偏實務／鑑識類（例如刑案現場處理與刑事鑑識），「法條引用正確性」可改為評估「作業程序／鑑識標準流程掌握正確性」。

關於準確性，非常重要：
- 如果使用者提供了「參考資料」，你評論法條號碼、流程細節時必須以參考資料內容為準，不可以引用參考資料中沒有出現的法條號碼或流程步驟；如果擬答引用的內容跟參考資料衝突或找不到依據，要明確指出。
- 如果使用者沒有提供「參考資料」，你對法條號碼、具體流程步驟的判斷只能基於你自身的知識，可能不準確（尤其是冷門條文或台灣在地化的實務流程）。這種情況下，「法條引用正確性」這個維度的評語最後要附註一句「（未提供參考資料，法條/流程細節僅供參考，建議自行核對）」。

另外請：
- 從擬答中挑出 2-4 個值得評註的段落片段（每段摘錄不超過25字），各給一句具體評語與一句改寫建議
- 給一個總分估計區間（例如 "62-68"，滿分100）
- 給一段總結建議（60字以內），聚焦這份擬答最需要優先加強的一件事

只回傳 JSON，不要有任何前言、markdown 或程式碼框線，格式如下：
{
  "overall_score": "62-68",
  "dimensions": [{"name":"...", "score": 7, "comment":"..."}],
  "paragraph_notes": [{"excerpt":"...", "comment":"...", "suggestion":"..."}],
  "summary": "..."
}`;

const GEMINI_MODEL = "gemini-3.6-flash";

function extractRetryDelaySeconds(data: any, fallback: number): number {
  const details = data?.error?.details as Array<Record<string, unknown>> | undefined;
  const retryInfo = details?.find((d) =>
    String(d["@type"] || "").includes("RetryInfo")
  );
  const retryDelayStr = retryInfo?.retryDelay as string | undefined;
  if (retryDelayStr) {
    const match = retryDelayStr.match(/(\d+(\.\d+)?)/);
    if (match) return Math.max(1, Math.ceil(parseFloat(match[1])));
  }
  const message = String(data?.error?.message || "");
  // 訊息可能用秒（"58.7s"）或毫秒（"643.03106ms"）表示，兩種都要能解析
  const msMatch = message.match(/retry in (\d+(\.\d+)?)ms/i);
  if (msMatch) return Math.max(1, Math.ceil(parseFloat(msMatch[1]) / 1000));
  const secMatch = message.match(/retry in (\d+(\.\d+)?)s/i);
  if (secMatch) return Math.max(1, Math.ceil(parseFloat(secMatch[1])));
  return fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function gradeEssay(
  subject: string,
  question: string,
  answer: string,
  referenceMaterial?: string,
  onStatus?: (message: string) => void
): Promise<GradingResult> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string;
  if (!apiKey) {
    throw new Error("缺少 VITE_GEMINI_API_KEY，請檢查 .env 檔案。");
  }

  const referenceBlock = referenceMaterial?.trim()
    ? `\n\n參考資料：\n${referenceMaterial.trim()}`
    : "\n\n參考資料：（使用者未提供）";

  const userPrompt = `科目：${subject}\n\n題目：\n${question}\n\n考生擬答：\n${answer}${referenceBlock}`;

  const maxRetries = 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: {
            maxOutputTokens: 12000,
            responseMimeType: "application/json",
            thinkingConfig: { thinkingLevel: "high" },
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const isRetryable = response.status === 429 || response.status === 503;
      if (isRetryable && attempt < maxRetries) {
        const fallbackWait = response.status === 429 ? 60 : 5;
        const waitSeconds = extractRetryDelaySeconds(data, fallbackWait);
        onStatus?.(
          `額度限制（${response.status}），${waitSeconds} 秒後自動重試（第 ${attempt + 1}/${maxRetries} 次）…`
        );
        await sleep(waitSeconds * 1000);
        continue;
      }
      throw new Error(
        `API 回傳錯誤 (${response.status})：${data?.error?.message || JSON.stringify(data)}`
      );
    }

    const text = data?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text || "")
      .join("\n");

    if (!text) {
      const finishReason = data?.candidates?.[0]?.finishReason;
      throw new Error(
        `回應中沒有文字內容${finishReason ? `（finishReason: ${finishReason}）` : ""}：${JSON.stringify(data).slice(0, 300)}`
      );
    }

    const clean = text.replace(/```json|```/g, "").trim();
    try {
      return JSON.parse(clean) as GradingResult;
    } catch {
      const finishReason = data?.candidates?.[0]?.finishReason;
      const hint =
        finishReason === "MAX_TOKENS"
          ? "（原因：輸出被截斷，maxOutputTokens 額度不夠，可以再調高）"
          : "";
      throw new Error(`JSON 解析失敗${hint}，模型原始回應：${clean.slice(0, 400)}`);
    }
  }

  throw lastError ?? new Error("批改失敗，請再試一次。");
}