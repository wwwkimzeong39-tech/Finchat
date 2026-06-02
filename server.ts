import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// API Key setup & validator
let ai: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY 환경변수가 설정되지 않았습니다.");
    }
    ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return ai;
}

// System instruction generator
function getSystemPrompt(userType: string): string {
  const typeLabel: Record<string, string> = {
    A: "안정형 투자자 🛡️ — 원금 보존 최우선, 예금·적금 선호",
    B: "균형형 투자자 ⚖️ — 안정과 성장 균형, 분산 투자 선호",
    C: "성장형 투자자 🚀 — 수익 추구, 리스크 감수 가능"
  };
  
  const selectedLabel = typeLabel[userType] || "미정 (일반적인 사회초년생)";
  
  return `당신은 사회초년생을 위한 친절하고 전문적인 금융 상담 AI 비서 'FinChat (핀챗)'입니다.

## 역할과 원칙
- 사회초년생의 눈높이에 맞추어 친절하고 정중하면서도 신뢰감 있게 설명합니다. (기본 존댓말 사용)
- 특정 금융기관의 사적인 이윤을 추구하는 특정 명칭 및 금융상품을 직접 추천하거나 권유하지 마십시오. 오직 세제 혜택이나 구조 등 공공 데이터나 공인된 제도 기준의 유용한 정보만을 객관적으로 전달합니다.
- 전문 용어(예: ISA, IRP, ETF, 주택청약 등)가 대화 중에 처음으로 언급되거나 주요하게 등장할 때는 사용자 친화적으로 괄호 안에 구체적인 한글 뜻풀이를 병기하여 도움을 주어야 합니다.
  예시: "IRP(개인형 퇴직연금 — 세금 절약 혜택을 누리며 은퇴 및 노후 자금을 적립할 수 있는 국가 지정 계좌)"
- 답변이 과도하게 길어지지 않도록 주의하고, 핵심 가이드를 3~5줄 내외의 컴팩트한 단락들로 구성하십시오.
- 특정 이율이나 이자 한도, 소득 요건 등 고정 수치성 정보를 서술할 경우엔 법적인 변동 소지가 있음을 알리기 위해 반드시 "참고용 수치" 혹은 "변동 가능"임을 사전에 안내하십시오.

## 현재 대화 중인 사용자 금융 가치관 유형
- 유형: ${selectedLabel}
${userType === "A" ? "- [가이드라인] 원금 보존과 자본 안정성을 최우선시합니다. 위험이 수반되는 직접 투자보단 적금, 예금, 주택청약, 나라 보증 원금보장형 세제 혜택 ISA(개인종합자산관리계좌) 등의 초안정성 금융 습관을 추천하고 응원하세요." : ""}
${userType === "B" ? "- [가이드라인] 저축과 보편적인 장기 분산 투자를 병행하여 합리적인 복리 성장을 추구합니다. 저축(예적금)을 기본 안전망으로 쌓으면서 코스피/S&P500 등 안정형 지수 추종 인덱스 ETF 혼합 배치, 분산 ISA 활용 등 유연한 비율 균형 포트폴리오를 제안하십시오." : ""}
${userType === "C" ? "- [가이드라인] 장기 자산 성장을 적극 도모하며 원금 손실 리스크 역시 합리적 한도라면 마다하지 않습니다. 일반형 ISA, 성장지향형 상장지수펀드(ETF), IRP 투자 한도 연계 세액공제 활용 등 전략적인 자산 집중 배분을 제안해 성장을 가속하도록 돕되, 불의의 비상 상황에 대처하기 위한 비상금(3-6개월치 기본비용) 저축을 꼭 먼저 구축한 후에 진입할 것을 덧붙여 상기시키십시오." : ""}

## 답변 필수 꼬리말 (면책 고지)
답변 본문 작성이 끝난 후, 줄바꿈을 2번 한 다음 꼬리글에 반드시 아래의 면책 조항을 토시 하나 틀리지 않게 추가하십시오:
⚠ 이 내용은 금융 상품 권유가 아닌 정보 제공 목적입니다. 실제 가입 전 해당 금융기관에 확인하세요.

## 금지 사항:
- "A은행 상품만 추천합니다", "가장 유리하니 이 상품을 구입하세요" 등의 편향된 추천은 금융소비자보호법 저촉 우려가 크므로 절대 언급 마십시오.
- 단정적인 어조로 높은 연이율 보장이나 절대적인 원금 보호 및 비정상적 수익률을 장담하여 기만감을 주지 마십시오.
- 주민등록번호, 구체적인 자산 잔고, 비밀번호 등의 민감한 개인정보를 요구하지 마십시오.`;
}

// API endpoint for Chat
app.post("/api/chat", async (req, res) => {
  try {
    const { message, userType, history } = req.body;

    if (!message || typeof message !== "string" || message.trim() === "") {
      return res.status(400).json({ error: "질문 메시지가 입력되지 않았습니다." });
    }

    const aiClient = getGenAI();
    const chatSystemPrompt = getSystemPrompt(userType || "unknown");

    // Mapping history to Gemini formats safely
    const formattedContents = [];

    if (Array.isArray(history) && history.length > 0) {
      // Keep only up to last 10 messages for token context efficiency
      const recentHistory = history.slice(-10);
      for (const turn of recentHistory) {
        formattedContents.push({
          role: turn.role === "user" ? "user" : "model",
          parts: [{ text: turn.text }],
        });
      }
    }

    // Gemini API strictly requires that conversational history starts with a 'user' message.
    // Clean history from any leading greeting or instructions injected as 'model' message.
    while (formattedContents.length > 0 && formattedContents[0].role !== "user") {
      formattedContents.shift();
    }

    // Append the last user message
    formattedContents.push({
      role: "user",
      parts: [{ text: message }],
    });

    // Try calling Gemini 2.0 Flash as primary, fallback to Gemini 1.5 Flash if rate-limited or failed
    let reply = "";
    let modelUsed = "gemini-2.0-flash";

    try {
      const geminiRes = await aiClient.models.generateContent({
        model: "gemini-2.0-flash",
        contents: formattedContents,
        config: {
          systemInstruction: chatSystemPrompt,
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      });
      const finishReason = geminiRes.candidates?.[0]?.finishReason;
      if (typeof finishReason === "string" && finishReason.toUpperCase() === "MAX_TOKENS") {
        reply = "응답이 완료되지 않았습니다. 다시 시도해 주세요.";
      } else {
        reply = geminiRes.text || "";
      }
    } catch (firstErr: any) {
      console.warn("Primary model gemini-2.0-flash failed, trying fallback model gemini-1.5-flash...", firstErr.message || firstErr);
      
      try {
        modelUsed = "gemini-1.5-flash";
        const fallbackRes = await aiClient.models.generateContent({
          model: "gemini-1.5-flash",
          contents: formattedContents,
          config: {
            systemInstruction: chatSystemPrompt,
            temperature: 0.7,
            maxOutputTokens: 1024,
          },
        });
        const finishReason = fallbackRes.candidates?.[0]?.finishReason;
        if (typeof finishReason === "string" && finishReason.toUpperCase() === "MAX_TOKENS") {
          reply = "응답이 완료되지 않았습니다. 다시 시도해 주세요.";
        } else {
          reply = fallbackRes.text || "";
        }
      } catch (secondErr: any) {
        console.error("All Gemini API models exhausted or hit quota limit. Returning standard error message.", secondErr.message || secondErr);
        reply = "현재 응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요. 😊";
        modelUsed = "error-fallback";
      }
    }

    if (!reply) {
      reply = "현재 응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요. 😊";
    }

    res.json({ reply, modelUsed });
  } catch (err: any) {
    console.error("Gemini API Error in Proxy Route:", err);
    res.json({ reply: "현재 응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요. 😊", modelUsed: "error-recovery" });
  }
});


// Configure Vite integration or Static delivery
async function startServer() {
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
    console.log(`Express Server boot success standard: http://localhost:${PORT}`);
  });
}

startServer();
