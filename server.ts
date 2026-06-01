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

    // Append the last user message
    formattedContents.push({
      role: "user",
      parts: [{ text: message }],
    });

    // Try calling Gemini 2.0 Flash first, fallback to 1.5 Flash if rate-limited, and ultimately fallback to smart local assistant on total quota exhaustion
    let reply = "";
    let modelUsed = "gemini-2.0-flash";

    try {
      const geminiRes = await aiClient.models.generateContent({
        model: "gemini-2.0-flash",
        contents: formattedContents,
        config: {
          systemInstruction: chatSystemPrompt,
          temperature: 0.7,
          maxOutputTokens: 800,
        },
      });
      reply = geminiRes.text || "";
    } catch (firstErr: any) {
      console.warn("Gemini 2.0 Flash failed, checking fallback model gemini-1.5-flash...", firstErr.message || firstErr);
      
      try {
        modelUsed = "gemini-1.5-flash";
        const fallbackRes = await aiClient.models.generateContent({
          model: "gemini-1.5-flash",
          contents: formattedContents,
          config: {
            systemInstruction: chatSystemPrompt,
            temperature: 0.7,
            maxOutputTokens: 800,
          },
        });
        reply = fallbackRes.text || "";
      } catch (secondErr: any) {
        console.error("All Gemini API models exhausted or hit quota limit. Invoking Smart local backup advisor.", secondErr.message || secondErr);
        
        // Resolve a beautiful local context-rich simulation response mapped to the user archetype
        reply = generateSmartBackupReply(message, userType);
        modelUsed = "local-simulation-rules";
      }
    }

    if (!reply) {
      reply = generateSmartBackupReply(message, userType);
    }

    res.json({ reply, modelUsed });
  } catch (err: any) {
    console.error("Gemini API Error in Proxy Route:", err);
    // Secure fallback delivery instead of failing the express server
    const backupText = generateSmartBackupReply(req.body.message || "", req.body.userType || "A");
    res.json({ reply: backupText, modelUsed: "local-simulation-recovery" });
  }
});

// A highly professional localized financial matcher to act as an offline-fallback engine when quota limits block calls entirely
function generateSmartBackupReply(message: string, userType: string): string {
  const normMsg = message.toLowerCase();
  
  // Base warnings
  const cautionDisclaimer = "\n\n⚠ 이 내용은 금융 상품 권유가 아닌 정보 제공 목적입니다. 실제 가입 전 해당 금융기관에 확인하세요.";
  
  // Topic matching
  let answerText = "";
  
  if (userType === "A") { // 안정형
    if (normMsg.includes("청약") || normMsg.includes("주택")) {
      answerText = `주택청약은 매달 꾸준히 최소 10만 원씩 무주택 기간 동안 납입해 청약 가점을 쌓을 수 있는 강력한 무원금 손실 기틀입니다. 
당신처럼 손실을 끄려 하는 안정형 성향에는 국토부가 직접 관리하고 저축 원금이 전액 보장되면서 소득공제 세제 혜택까지 더해지는 '주택청약종합저축' 가입이 기본 0순위로 추천됩니다. 매년 최대 240만 원 납입 한도에 대해 40%(최대 96만 원)까지 소득 공제가 제공되니 안심하고 안정체력을 길러보세요!`;
    } else if (normMsg.includes("isa") || normMsg.includes("아이이에스")) {
      answerText = `ISA(개인종합자산관리계좌 — 세금 혜택을 주는 만능 계좌)는 안정형 투자자에게도 아주 유리하게 개조해 활용될 수 있습니다. 
예금이율이나 적금이율에 대해 만기 시 일반 계좌는 15.4%의 이자소득세를 떼어가지만, ISA 계좌 안에서 '정기예금/적금'으로 자금을 굴리면 비과세 혜택(서민형 기준 부대수익 400만 원 한도)을 받을 수 있어서 세금을 엄청나게 아끼며 정직하게 원금을 불릴 수 있습니다. 보수적인 원금 확보 전술을 희망한다면 은행에서 '신탁형' 혹은 '예적금 위주 ISA'를 꼭 문의해보시기 바랍니다.`;
    } else if (normMsg.includes("irp") || normMsg.includes("퇴직") || normMsg.includes("연금")) {
      answerText = `IRP(개인형 퇴직연금)는 노후 준비와 세액공제를 동시 보존할 수 있는 절세 주머니입니다.
연간 최대 900만 원 납입 금액까지 최대 16.5%의 강력한 현금 세액환급 공제를 제공합니다. 
다만 55세 이전에 중도 해지하면 환급받은 세금을 모두 토해내야 하는 단점이 존재하므로, 안정형 투자자라면 자금을 한 번에 묶지 마시고 매달 월급의 5~10% 수준만 가볍게 시작하되, 안전성이 철저한 '원리금보장형 예금 상품'이나 '국채형 채권 매칭'으로 내부 계좌를 지정하여 원금 방어를 탄탄히 가져가야 탈이 없습니다.`;
    } else if (normMsg.includes("비상금") || normMsg.includes("통장")) {
      answerText = `비상금(예상치 못한 비상 사출 지출용 저축)은 생활 소득이 일정치 않은 사회초년생 안정형 전사에게 필수 기초 체력입니다!
만일 실직이나 급작스런 입원 같은 돌발 리스크가 생겼을 때, 애써 붓던 고정 예적금을 해치지 않도록 3~6개월치의 필수 생계 비용을 따로 빼두셔야 합니다. 하루만 거치해도 확정 금리를 일복리로 지급하는 주차 통장(CMA 계좌나 1금융권 파킹통장)을 활용해 자금의 기동 성능을 확보하세요.`;
    } else {
      answerText = `안녕하세요! 현재 핀챗 서버가 점검 중이거나 일일 요청량이 많아, 안정형 전용 백업 금융 가이드를 활성화하여 답변드립니다 🛡️

안정형 투자자이신 당신에게는 다음 3대 수칙이 최우선 전략입니다:
1. 안전 마진 확보 : 파킹통장을 이용해 고정 생활비 3개월치에 상응하는 비상금을 먼저 주차해두세요.
2. 1금융권 세제 기틀 : 주가지수를 복잡하게 분석하지 마시고 청약 통장 개설 및 비과세 혜택이 탑재된 '원리금 보장형 ISA(개인종합자산관리계좌)'를 활용해 비과세 한도만큼 이자율을 전부 지켜내는 데 총력을 다하십시오.
3. 안전 적금 기조 : 무리한 주식 테마 매매보단 고정 소득의 50% 이상을 고정 안심 고율 적금에 납입해 돈을 모으는 손맛을 가치 있게 체감하는 것을 권해 드립니다.`;
    }
  } else if (userType === "B") { // 균형형
    if (normMsg.includes("etf") || normMsg.includes("주식")) {
      answerText = `균형형 투자자 ⚖️에게 대입하기 가장 좋은 주식 전술은 '인덱스 ETF(상장지수펀드)' 기반의 장기 분산 적립입니다.
모르거나 변동성이 높은 소수 개별 작전주를 매수하는 리스크를 전부 피하고, 미국 500대 기업 전체에 자동 투자해주는 S&P 500 추종 ETF나 국내 코스피 우량 배당 ETF 등을 조금씩 저축하듯 매수해 보세요. 장기적으로 국가의 경제 복리 성장 트랙을 그대로 내 자산으로 안착시킬 수 있는 든든하고 중도적인 주행법입니다.`;
    } else if (normMsg.includes("isa") || normMsg.includes("아이이에스")) {
      answerText = `균형형 투자자에게 ISA(개인종합자산관리계좌)는 그야말로 사막의 오아시스 같은 존재입니다!
계좌 한 곳에서 은행 스마트 예금도 일부 주차하고, 주식 시장의 안정형 배당 ETF나 리츠(부동산간접투자)도 한 번에 자유 포트폴리오 비율로 배분하며 담을 수 있습니다. 투자 후 손실이나 수익을 통산하여 순수익에 대해서만 절세를 해주기 때문에 매우 합리적이며, '중개형 ISA' 한도를 매년 2천만 원씩 채워 굴리는 것을 주력 기조로 고려해 보세요.`;
    } else if (normMsg.includes("irp") || normMsg.includes("퇴직") || normMsg.includes("연금")) {
      answerText = `IRP(개인형 퇴직연금)를 균형 자산 엔진으로 기용할 때는 70/30 배분율을 명확히 명심하세요.
국가 규정상 IRP 내에서는 위험 자산(주식형 ETF 등) 비중을 최대 70%까지만 채울 수 있고, 나머지 30%는 무조건 무난한 안전 자산(예적금이나 채권)으로 묶어야 합니다. 이러한 룰 자체가 균형형 투자자의 마음의 하락 부담을 억제하며 기교적인 강제 분배 시스템을 구가하게 도와주므로, 장기 납부 분납을 세액 환급 한도까지 추진해 보시기 바랍니다.`;
    } else {
      answerText = `안녕하세요! 현재 핀챗 서버 과부하 또는 점검 중으로, 균형형 전용 백업 금융 가이드를 활성화하여 안전하게 안내 드립니다 ⚖️

안정과 성장 기조의 중간에 계신 균형형 사회초년생의 최강 기본 세팅:
1. 5:5 배분 : 급여 분배 시 매달 저금하는 자금의 절반은 우량 예적금이나 청약에 할당하고, 나머지 절반은 안정성을 갖춘 지수형 분산 ETF에 자동 매해 분배 매입을 가동할 것을 조언 드립니다.
2. 만능 중개형 ISA : 세제 혜택 통장인 ISA 내에 채권 ETF와 지수 ETF, 그리고 원금보장형 예금을 반씩 주차하여 세금을 영구 절약하고 이자 방폭막 구축에 집중하세요.
3. 비상 주머니 관리 : 투자와 저축 기틀이 동시에 발현되므로 고정 생활 자금이 마르는 고통을 피하게 파킹통장에 일정 쿠션을 사전 배치해야 탄탄합니다.`;
    }
  } else { // 성장형 C
    if (normMsg.includes("etf") || normMsg.includes("주식")) {
      answerText = `성장 지향 🚀 자산 성장에 욕심이 있는 당신에겐 미국 나스닥 100 지수를 복리로 추종하거나 글로벌 반도체/AI 혁신 섹터를 겨냥한 '성장형 테마 ETF' 연계가 훌륭한 날개가 됩니다.
단 개별 잡주의 급락 변동에 원금이 통째로 갈려 나가는 참사를 예방하기 위하여, 검증된 탑클래스 분산 ETF를 적립식(예: 매주 월요일 일정한 액수만 쪼개 자동 분기 매입)으로 적립해 나가는 '코스트 에버리징' 기법을 필살기로 채용하세요. 자산 가격이 쌀 땐 더 많이 사고 비쌀 땐 덜 사서 평단가를 완만하게 마법처럼 조율해 줍니다.`;
    } else if (normMsg.includes("isa") || normMsg.includes("아이이에스")) {
      answerText = `성장형 투자 촉진 가속기에는 역시 '중개형 ISA(개인종합자산관리계좌)'가 찰떡궁합입니다.
배당수익이나 국내주식 양도 배당 차익에 부과되는 원천징수 15.4% 세금을 아끼고 전액 계좌로 무제한 재투자하여 스노우볼 복리 파워를 비약적으로 누릴 수 있도록 구성할 수 있습니다. 적극적인 주식 ETF 마켓 매매를 자처하신다면 ISA 계좌 개설이 세테크 자산 성장의 필수 지름길입니다.`;
    } else if (normMsg.includes("irp") || normMsg.includes("퇴직") || normMsg.includes("연금")) {
      answerText = `성장형 자산 기틀을 IRP(개인형 퇴직연금)와 합칠 때의 묘리:
위험 한도 방어 가이드라인에 따라 강제 배치된 30%의 안전 계좌 영역마저 '미국 장기 국채 ETF'나 '만기매칭형 고율 회사채 상품' 등으로 가동시켜 이자율 효율을 하이엔드로 끌어올리는 기술을 적용하세요. 나머지 70%는 성장 잠재가 탄탄한 S&P 500 배당 투자나 빅테크 성장 ETF를 포진해 세금 환급 혜택과 노후 스노볼 효과를 최대로 극대화할 수 있습니다.`;
    } else {
      answerText = `안녕하세요! 현재 핀챗 서버 점검 및 Quota 제한으로, 적극 성장형 전용 백업 금융 트랙 가이드를 활성화하여 전송해 드립니다 🚀

자산을 시원하게 증폭시키고자 하는 성장형 당신의 강력 체크리스트:
1. 선 비상금, 후 사냥 : 투자 공격 성능이 우수할수록 비상 방벽은 정교해야 다치지 않습니다. 3개월치의 기본 수비 비상금은 CMA 통장에 철통같이 봉인해 두십시오.
2. 중개형 ISA 절세 풀 가동 : 매달 저축 가능액의 70% 이상을 ISA 계좌를 통해 성장 테마/인덱스 분산 ETF 매칭에 적립식 투입하여 복리 스노볼을 고속으로 굴리세요.
3. 기법 분할화 : 시장 폭락 시 멘붕하여 공포 손절하는 우매함을 예방하기 위해, 한 번에 거액을 거치하지 마시고 날짜와 종목을 캘린더 분산하는 '월정액 마법 적립식 방식'을 원칙으로 삼으십시오.`;
    }
  }
  
  return answerText + cautionDisclaimer;
}


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
