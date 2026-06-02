/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, FormEvent } from "react";
import { 
  ArrowLeft, 
  Send, 
  Check, 
  AlertCircle, 
  ArrowRight, 
  Download, 
  ThumbsUp, 
  ThumbsDown, 
  Sparkles, 
  RefreshCw, 
  HelpCircle, 
  X, 
  FileText, 
  MessageSquare,
  ShieldAlert,
  Wallet,
  Coins,
  TrendingUp,
  Info
} from "lucide-react";
import { 
  QUESTIONS, 
  TYPE_DATA, 
  GREETING_MESSAGES, 
  TERM_DICTIONARY,
  type Question,
  type Choice,
  type ChatMessage
} from "./types";

// System instruction generator (client-side)
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

// Client-side Gemini API Caller targeting gemini-2.0-flash with v1 API
async function callGeminiClient(
  message: string,
  userType: string,
  history: Array<{ role: "user" | "model"; text: string }>
): Promise<{ reply: string; modelUsed: string }> {
  // Use VITE_GEMINI_API_KEY environment variable requested by the user
  const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("대화 기능 작동을 위한 VITE_GEMINI_API_KEY 환경변수가 정의되지 않았습니다. AI Studio Settings -> Secrets에서 VITE_GEMINI_API_KEY 값을 입력해 주세요.");
  }

  const formattedContents = [];
  if (Array.isArray(history) && history.length > 0) {
    // Keep up to 10 context loops
    const recentHistory = history.slice(-10);
    for (const turn of recentHistory) {
      formattedContents.push({
        role: turn.role === "user" ? "user" : "model",
        parts: [{ text: turn.text }],
      });
    }
  }

  while (formattedContents.length > 0 && formattedContents[0].role !== "user") {
    formattedContents.shift();
  }

  // Current turn user prompt
  formattedContents.push({
    role: "user",
    parts: [{ text: message }],
  });

  const chatSystemPrompt = getSystemPrompt(userType);

  const payload = {
    contents: formattedContents,
    systemInstruction: {
      parts: [{ text: chatSystemPrompt }]
    },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024
    }
  };

  try {
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      let messageDetail = `상태 코드 ${response.status}`;
      try {
        const errJson = JSON.parse(errorText);
        if (errJson?.error?.message) {
          messageDetail = errJson.error.message;
        }
      } catch (e) {}
      throw new Error(`Gemini API 호출에 실패했습니다: ${messageDetail}`);
    }

    const resData = await response.json();
    const candidate = resData.candidates?.[0];
    const finishReason = candidate?.finishReason;

    if (typeof finishReason === "string" && finishReason.toUpperCase() === "MAX_TOKENS") {
      return { reply: "응답이 완료되지 않았습니다. 다시 시도해 주세요.", modelUsed: "gemini-2.0-flash" };
    }

    const replyText = candidate?.content?.parts?.[0]?.text || "";
    if (!replyText) {
      throw new Error("Gemini로부터 빈 응답 결과가 수신되었습니다.");
    }
    return { reply: replyText, modelUsed: "gemini-2.0-flash" };
  } catch (err: any) {
    console.error("Gemini model call error:", err.message || err);
    throw new Error(err.message || "금융 상담 AI를 호출하는 도중 오류가 발생했습니다. 잠시 후 상단 새로고침 후 다시 시도해 주세요.");
  }
}

export default function App() {
  // Helper to read from sessionStorage safely
  const getSessionValue = <T,>(key: string, defaultValue: T): T => {
    try {
      const stored = sessionStorage.getItem(key);
      if (stored !== null) {
        return JSON.parse(stored) as T;
      }
    } catch (e) {
      console.error("Error reading sessionStorage key:", key, e);
    }
    return defaultValue;
  };

  // Navigation State
  // 'main' (Hero & Info) | 'diagnosis' (Diagnostic flow) | 'chat' (AI Consulting)
  const [currentPage, setCurrentPage] = useState<"main" | "diagnosis" | "chat">(() => 
    getSessionValue<"main" | "diagnosis" | "chat">("finchat_currentPage", "main")
  );
  
  // Diagnosis sub-states: 'intro' | 'question' | 'loading' | 'result'
  const [diagnosisStep, setDiagnosisStep] = useState<"intro" | "question" | "loading" | "result">(() => 
    getSessionValue<"intro" | "question" | "loading" | "result">("finchat_diagnosisStep", "intro")
  );
  const [currentQ, setCurrentQ] = useState<number>(() => 
    getSessionValue<number>("finchat_currentQ", 0)
  );
  const [userAnswers, setUserAnswers] = useState<number[]>(() => 
    getSessionValue<number[]>("finchat_userAnswers", [])
  );
  const [userType, setUserType] = useState<"A" | "B" | "C" | null>(() => 
    getSessionValue<"A" | "B" | "C" | null>("finchat_userType", null)
  );

  // Chat states
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => 
    getSessionValue<ChatMessage[]>("finchat_chatMessages", [])
  );
  const [inputText, setInputText] = useState("");
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Interactive Terms Modal/Tooltip states
  const [activeTerm, setActiveTerm] = useState<{ term: string; definition: string } | null>(null);
  const [showHistoryMenu, setShowHistoryMenu] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);

  // Auto-typing animation state for Main Page Preview Section
  const [previewStep, setPreviewStep] = useState<number>(0);
  
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Synchronize state changes to sessionStorage
  useEffect(() => {
    sessionStorage.setItem("finchat_currentPage", JSON.stringify(currentPage));
  }, [currentPage]);

  useEffect(() => {
    sessionStorage.setItem("finchat_diagnosisStep", JSON.stringify(diagnosisStep));
  }, [diagnosisStep]);

  useEffect(() => {
    sessionStorage.setItem("finchat_currentQ", JSON.stringify(currentQ));
  }, [currentQ]);

  useEffect(() => {
    sessionStorage.setItem("finchat_userAnswers", JSON.stringify(userAnswers));
  }, [userAnswers]);

  useEffect(() => {
    sessionStorage.setItem("finchat_userType", JSON.stringify(userType));
  }, [userType]);

  useEffect(() => {
    sessionStorage.setItem("finchat_chatMessages", JSON.stringify(chatMessages));
  }, [chatMessages]);

  // Navigation Logic with History PopState
  const navigateTo = (page: "main" | "diagnosis" | "chat") => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.page) {
        setCurrentPage(event.state.page);
      } else {
        setCurrentPage("main");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Sync state changes with pushState to ensure normal web-app feel
  useEffect(() => {
    const state = { page: currentPage };
    if (window.history.state?.page !== currentPage) {
      window.history.pushState(state, "", currentPage === "main" ? "/" : `#${currentPage}`);
    }
  }, [currentPage]);

  // Main Page Pre-rendered chat simulation typing sequencer
  useEffect(() => {
    if (currentPage !== "main") return;
    
    // Reset sequence timer
    setPreviewStep(0);
    
    const t1 = setTimeout(() => setPreviewStep(1), 1000); // User starts typing/thinking reflection
    const t2 = setTimeout(() => setPreviewStep(2), 2500); // User message appears
    const t3 = setTimeout(() => setPreviewStep(3), 3500); // AI begins typing indicator
    const t4 = setTimeout(() => setPreviewStep(4), 5000); // AI response completes

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [currentPage]);

  // Autoscroll at chatbot activity
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, isAiTyping]);

  // Diagnosis logic
  const handleStartDiagnosis = () => {
    setDiagnosisStep("intro");
    navigateTo("diagnosis");
  };

  const startQuestionFlow = () => {
    setCurrentQ(0);
    setUserAnswers([]);
    setDiagnosisStep("question");
  };

  const handleSelectChoice = (choiceIndex: number) => {
    const updatedAnswers = [...userAnswers];
    updatedAnswers[currentQ] = choiceIndex;
    setUserAnswers(updatedAnswers);

    // Dynamic timeout to allow user to visually see the radio highlight
    setTimeout(() => {
      if (currentQ < QUESTIONS.length - 1) {
        setCurrentQ(prev => prev + 1);
      } else {
        // Final Question Done: Run Loading analysis transition
        setDiagnosisStep("loading");
        
        // Compute outcome
        const scoreTracker = { A: 0, B: 0, C: 0 };
        updatedAnswers.forEach((ansIndex, qIdx) => {
          const choice = QUESTIONS[qIdx].choices[ansIndex];
          if (choice.scores.A) scoreTracker.A += choice.scores.A;
          if (choice.scores.B) scoreTracker.B += choice.scores.B;
          if (choice.scores.C) scoreTracker.C += choice.scores.C;
        });

        // Resolve tie breaking: A > B > C priority for defensive financial habits
        let computedType: "A" | "B" | "C" = "A";
        const maxScore = Math.max(scoreTracker.A, scoreTracker.B, scoreTracker.C);
        
        if (scoreTracker.A === maxScore) {
          computedType = "A";
        } else if (scoreTracker.B === maxScore) {
          computedType = "B";
        } else {
          computedType = "C";
        }

        setTimeout(() => {
          setUserType(computedType);
          setDiagnosisStep("result");
        }, 1800); // Cinematic 1.8s delay simulated radar spinner
      }
    }, 280);
  };

  const handleBackQuestion = () => {
    if (currentQ > 0) {
      setCurrentQ(prev => prev - 1);
    } else {
      setDiagnosisStep("intro");
    }
  };

  // Convert diagnosis results into an elegant textual document download
  const handleDownloadDiagnosisResult = () => {
    if (!userType) return;
    const detail = TYPE_DATA[userType];
    const textOutput = `=====================================================
FinChat (핀챗) — 나의 금융 가치관 진단 인증서
=====================================================
발급일시: ${new Date().toLocaleString("ko-KR")}
유형 분석 결과: ${detail.name} ${detail.icon}
슬로건: "${detail.tagline}"

[상세 성향 보고]
${detail.desc}

[추천 핵심 금융 키워드]
${detail.keywords.map(kw => `• ${kw} (${TERM_DICTIONARY[kw] || "금융 기본 지표"})`).join("\n")}

-----------------------------------------------------
* 본 진단결과는 FinChat의 자체 설문 가중치를 기준으로 설계되었습니다.
인프라에 저장되지 않는 일회성 로컬 메모리 세션 결과입니다. No: AI-FC-${Math.floor(100000 + Math.random() * 900000)}
=====================================================`;

    const blob = new Blob([textOutput], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement("a");
    downloadAnchor.href = url;
    downloadAnchor.download = `finchat_diagnosis_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.txt`;
    downloadAnchor.click();
    URL.revokeObjectURL(url);
  };

  // Init conversational interface centered around the analysis of user's core financial behaviors
  const handleStartConsulting = () => {
    if (!userType) return;
    
    // Feed initial message reflecting diagnosis archetype
    const initGreet: ChatMessage = {
      id: "initial-greet",
      role: "model",
      text: GREETING_MESSAGES[userType],
      timestamp: new Date()
    };

    setChatMessages([initGreet]);
    navigateTo("chat");
  };

  // Direct client-side Gemini API Caller
  const handleSendMessage = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isAiTyping || !userType) return;

    const userMsgText = inputText.trim();
    setInputText("");
    setErrorMessage(null);

    const newUserMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: userMsgText,
      timestamp: new Date()
    };

    // Append to messages UI instantly
    const updatedMessages = [...chatMessages, newUserMsg];
    setChatMessages(updatedMessages);
    setIsAiTyping(true);

    try {
      // Map React ChatMessage history structure to light text histories payload
      const chatHistoryForBackend = updatedMessages.slice(0, -1).map(m => ({
        role: m.role,
        text: m.text
      }));

      // Call Gemini API directly (client-side)
      const result = await callGeminiClient(userMsgText, userType, chatHistoryForBackend);
      
      const newModelMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: "model",
        text: result.reply || "죄송합니다, 답변을 작성하는 도중 오류가 생겼습니다.",
        timestamp: new Date()
      };

      setChatMessages(prev => [...prev, newModelMsg]);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "연결 상태가 지연되고 있거나 일시적 오류입니다. 다시 전송 버튼을 눌러주세요.");
    } finally {
      setIsAiTyping(false);
    }
  };

  // Save transaction conversation transcripts safely
  const handleExportChatHistory = () => {
    if (chatMessages.length === 0) return;
    
    const formattedTranscript = chatMessages.map(m => {
      const formattedTime = new Date(m.timestamp).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
      const sender = m.role === "user" ? "나 (사용자)" : "FinChat AI 금융상담원";
      return `[${formattedTime}] ${sender}:\n${m.text}\n`;
    }).join("\n-----------------------------------------------------\n\n");

    const header = `======================================================
FinChat (핀챗) — AI 개별 맞춤 금융상담 기록록
======================================================
대화 유형: ${userType ? TYPE_DATA[userType].name : "분석 기록 없음"}
내역 저장시점: ${new Date().toLocaleString("ko-KR")}
대화 요약 내역:
\n`;

    const blob = new Blob([header + formattedTranscript], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `finchat_chat_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    setShowHistoryMenu(false);
  };

  // Provide interactive terms feedback tooltips dynamically parsed from the rich paragraphs
  const renderMessageContentWithTooltips = (text: string) => {
    // We parse paragraph text matching keys in our TERM_DICTIONARY and wrap them with elegant interactive indicators
    const words = Object.keys(TERM_DICTIONARY);
    if (words.length === 0) return text;

    // Build matching regex
    const sortedWords = [...words].sort((a,b) => b.length - a.length);
    const regex = new RegExp(`(${sortedWords.join("|")})`, "g");
    
    // Split block
    const parts = text.split(regex);
    return (
      <span className="whitespace-pre-wrap leading-relaxed">
        {parts.map((part, index) => {
          if (TERM_DICTIONARY[part]) {
            return (
              <button
                key={index}
                id={`term-btn-${part}`}
                onClick={() => setActiveTerm({ term: part, definition: TERM_DICTIONARY[part] })}
                className="mx-0.5 inline-flex items-center px-1.5 py-0.5 rounded bg-[#7C6FF0]/15 hover:bg-[#7C6FF0]/35 text-[#AFA9EC] text-xs font-semibold border-b border-[#7C6FF0] transition-colors cursor-pointer"
                title="정의 보기"
              >
                {part}
                <Info size={10} className="ml-1 opacity-70" />
              </button>
            );
          }
          return part;
        })}
      </span>
    );
  };

  // Double trigger control for up/down helpfulness votes
  const handleVoteFeedback = (msgId: string, feedback: "positive" | "negative") => {
    setChatMessages(prev => prev.map(m => {
      if (m.id === msgId) {
        return { ...m, feedback };
      }
      return m;
    }));
  };

  return (
    <div id="finchat-root" className="min-h-screen bg-[#0F0C2A] text-[#F0EEF8] font-sans flex flex-col relative overflow-x-hidden selection:bg-[#7C6FF0]/40 selection:text-[#FFFFFF]">
      
      {/* Dynamic Header */}
      <header className="sticky top-0 z-40 bg-[#0F0C2A]/85 backdrop-blur-md border-b border-[#2D2A5E] px-4 py-3.5 transition-all">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigateTo("main")}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#7C6FF0] to-[#4ECFA8] flex items-center justify-center shadow-lg shadow-[#7C6FF0]/20">
              <span className="text-white font-extrabold text-sm tracking-tighter">핀</span>
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-wide bg-gradient-to-r from-white to-[#AFA9EC] bg-clip-text text-transparent">FinChat</span>
              <span className="ml-1.5 text-[10px] font-semibold text-[#4ECFA8] border border-[#4ECFA8]/30 px-1.5 py-0.3 rounded-full bg-[#4ECFA8]/10 tracking-widest uppercase">BETA</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {currentPage === "chat" && (
              <div className="relative">
                <button 
                  id="menu-btn"
                  onClick={() => setShowHistoryMenu(!showHistoryMenu)}
                  className="px-3 py-1.5 rounded-lg bg-[#1A1740] hover:bg-[#231F50] border border-[#2D2A5E] text-xs font-semibold text-[#AFA9EC] flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <FileText size={14} />
                  기능 메뉴
                </button>
                {showHistoryMenu && (
                  <div className="absolute right-0 mt-2 w-48 rounded-xl bg-[#1A1740] border border-[#2D2A5E] shadow-2xl p-2.5 z-50 text-left animate-fadeUp">
                    <button
                      id="save-chat-btn"
                      onClick={handleExportChatHistory}
                      className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-[#231F50] text-[#F0EEF8] flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Download size={13} className="text-[#4ECFA8]" />
                      대화 내용 내려받기
                    </button>
                    <button
                      id="view-diagnosis-btn"
                      onClick={() => setShowResultModal(true)}
                      className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-[#231F50] text-[#F0EEF8] flex items-center gap-2 transition-colors mt-1 cursor-pointer"
                    >
                      <Sparkles size={13} className="text-[#7C6FF0]" />
                      나의 금융 성향 보기
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {currentPage !== "main" && (
              <button 
                id="header-home-btn"
                onClick={() => navigateTo("main")} 
                className="px-3 py-1.5 rounded-lg bg-[#2D2A5E]/30 hover:bg-[#2D2A5E]/70 text-xs font-medium text-[#text-secondary] transition-colors cursor-pointer"
              >
                처음으로
              </button>
            )}
            
            {currentPage === "main" && (
              <button 
                id="header-diagnostic-btn"
                onClick={handleStartDiagnosis}
                className="hidden sm:inline-flex px-4 py-1.5 rounded-lg bg-gradient-to-r from-[#7C6FF0] to-[#5A4ED4] hover:brightness-110 text-xs font-semibold text-white tracking-wide shadow-md shadow-[#7C6FF0]/20 transition-all cursor-pointer"
              >
                무료 가치관 진단
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Pages Frame */}
      <main className="flex-1 w-full mx-auto px-4 flex flex-col justify-center max-w-6xl">
        
        {/* ============================================== */}
        {/* 1. MAIN PAGE HERO SECTION                      */}
        {/* ============================================== */}
        {currentPage === "main" && (
          <div id="page-main" className="py-8 sm:py-16 space-y-16 animate-fadeUp">
            
            {/* Dynamic Ambient Background Spark */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] sm:w-[500px] h-[350px] sm:h-[500px] rounded-full bg-[#7C6FF0]/8 blur-[80px] pointer-events-none z-0"></div>
            
            <div className="relative text-center max-w-3xl mx-auto space-y-6 z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#4ECFA8]/30 bg-[#4ECFA8]/5 text-xs text-[#4ECFA8] font-bold tracking-wide">
                <span className="w-2 h-2 rounded-full bg-[#4ECFA8] animate-pulse"></span>
                회원가입 없이 즉시 이용 가능
              </div>

              <h1 className="text-2xl sm:text-5xl font-black leading-tight sm:leading-snug tracking-tight">
                내 금융 가치관부터
                <span className="bg-gradient-to-r from-[#7C6FF0] via-[#AFA9EC] to-[#4ECFA8] bg-clip-text text-transparent">딱 맞게</span> 알아보기
              </h1>

              <p className="text-[#9CA3AF] text-sm sm:text-lg max-w-lg mx-auto leading-relaxed">
                첫 월급 받고 뭐부터 해야 할지 모르겠다면,<br />
                핀챗이 먼저 당신의 금융 스타일을 파악해 드릴게요.
              </p>

              <div className="pt-4 flex flex-col items-center gap-3">
                <button
                  id="main-start-btn"
                  onClick={handleStartDiagnosis}
                  className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-[#7C6FF0] to-[#5A4ED4] hover:translate-y-[-2px] hover:shadow-xl hover:shadow-[#7C6FF0]/30 text-white font-bold tracking-wide text-base transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  지금 바로 진단 시작하기
                  <ArrowRight size={18} />
                </button>
                <p className="text-xs text-[#4B4870] font-medium flex items-center gap-2">
                  <span>✓ 가입 없음</span>
                  <span className="w-1 h-1 rounded-full bg-[#4E4B75]"></span>
                  <span>✓ 100% 무료</span>
                  <span className="w-1 h-1 rounded-full bg-[#4E4B75]"></span>
                  <span>✓ 공공 금융 데이터 기반</span>
                </p>
              </div>
            </div>

            {/* REALISTIC CHAT LOG SIMULATION VISUAL CARD */}
            <div className="relative max-w-2xl mx-auto rounded-2xl bg-[#1A1740]/60 border border-[#2D2A5E] shadow-2xl p-4 sm:p-5 z-10 backdrop-blur-sm">
              <div className="absolute -top-3 left-6 px-3 py-1 rounded-md bg-[#231F50] border border-[#2D2A5E] text-[10px] font-bold tracking-widest uppercase text-[#AFA9EC]">
                이런 대화가 실시간으로 가능해요
              </div>

              {/* Chat Simulator Shell Header */}
              <div className="flex items-center justify-between pb-3.5 border-b border-[#2D2A5E]/60 mb-4 text-xs text-[#9CA3AF]">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#4ECFA8]"></div>
                  <span className="font-bold text-[#F0EEF8]">핀챗 AI 전담 상담원</span>
                </div>
                <span className="text-[10px] bg-[#231F50] px-2 py-0.5 rounded text-[#7C6FF0]">실시간 시뮬레이션</span>
              </div>

              <div className="space-y-4 text-xs sm:text-sm min-h-[190px] flex flex-col justify-end">
                {/* AI Question 1 (Always Visible) */}
                <div className="flex items-start gap-2.5 transition-all">
                  <div className="w-7 h-7 rounded-lg bg-[#7C6FF0]/20 border border-[#7C6FF0]/50 flex items-center justify-center text-xs font-bold text-[#AFA9EC] shrink-0 mt-0.5">
                    핀
                  </div>
                  <div className="max-w-[85%] rounded-2xl rounded-tl-none bg-[#7C6FF0]/15 border border-[#7C6FF0]/10 p-3 text-[#D4CFFF] leading-relaxed">
                    안녕하세요! 저는 핀챗이에요 😊 가치관 진단에 참여한 첫 사회초년생이시군요! 만약 예상치도 못한 <b>여유 종잣돈 50만 원</b>이 계좌로 송금됐다면, 가장 먼저 어떤 저축이나 투사를 감행해보고 싶으신가요?
                  </div>
                </div>

                {/* User Answer (Reveals with step >= 2) */}
                {previewStep >= 1 && (
                  <div className={`flex justify-end transition-all duration-300 ${previewStep === 1 ? 'opacity-40 translate-y-1' : 'opacity-100 translate-y-0'}`}>
                    <div className="max-w-[85%] rounded-2xl rounded-tr-none bg-[#4ECFA8]/12 border border-[#4ECFA8]/10 p-3 text-[#A8EDD8] leading-relaxed text-right">
                      {previewStep === 1 ? "타이핑 중..." : "일단 적금을 더 고정식으로 넣어야 안전할 것 같기는 한데, 혹시 다른 투자나 분산 기술이 맞는지 잘은 몰라 머뭇거려져요 😅"}
                    </div>
                  </div>
                )}

                {/* AI Processing Typing Indicator (Reveals at step === 3) */}
                {previewStep === 3 && (
                  <div className="flex items-center gap-2 py-1 select-none animate-pulse">
                    <span className="text-[10px] text-[#AFA9EC] bg-[#231F50] px-2 py-0.5 rounded">상담 분석기 계산중</span>
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#7C6FF0] animate-bounce"></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-[#7C6FF0] animate-bounce [animation-delay:0.2s]"></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-[#7C6FF0] animate-bounce [animation-delay:0.4s]"></span>
                    </div>
                  </div>
                )}

                {/* AI Answer Response (Reveals with step >= 4) */}
                {previewStep >= 4 && (
                  <div className="flex items-start gap-2.5 transition-all duration-500 animate-fadeUp">
                    <div className="w-7 h-7 rounded-lg bg-[#7C6FF0]/20 border border-[#7C6FF0]/50 flex items-center justify-center text-xs font-bold text-[#AFA9EC] shrink-0 mt-0.5">
                      핀
                    </div>
                    <div className="max-w-[85%] rounded-2xl rounded-tl-none bg-[#7C6FF0]/15 border border-[#7C6FF0]/10 p-3 text-[#D4CFFF] leading-relaxed">
                      그렇군요! 머뭇거리는 일은 아주 현명한 시작입니다. 당신처럼 원금 하락에 엄격하게 대처하는 성향은 안전 금융 기지로 <b>비상 생활 안정 자금</b> 먼저 3개월치를 확실히 축적해 둔 후에 <b>원금 보전 매칭형 ISA(개인종합자산관리계좌)</b>에 가입하시는 것이 유리할 수 있어요 🛡️
                    </div>
                  </div>
                )}
              </div>

              {/* Inactive Dummy Chat Entry Form */}
              <div className="mt-4 pt-3.5 border-t border-[#2D2A5E]/60 flex gap-2">
                <input
                  type="text"
                  placeholder="가치관 진단을 수료하시면 더 다양한 질문을 하실 수 있어요!"
                  disabled
                  className="flex-1 bg-[#0F0C2A] border border-[#2D2A5E] rounded-xl px-3.5 py-2.5 text-xs text-[#4B4870] outline-none cursor-not-allowed"
                />
                <button disabled className="px-4 rounded-xl bg-[#2D2A5E] text-[#4B4870] cursor-not-allowed">
                  <Send size={15} />
                </button>
              </div>
            </div>

            {/* VALUE PROPOSITIONS BENTO BOX SECTION */}
            <div className="space-y-8 max-w-4xl mx-auto">
              <div className="text-center space-y-2">
                <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">FinChat만의 차별화된 3가지 가치</h2>
                <p className="text-xs sm:text-sm text-[#9CA3AF]">어설픈 광고 마케팅식 금융 추천 메신저에 지치셨나요?</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="p-5 rounded-xl bg-[#1A1740]/40 border border-[#2D2A5E] hover:border-[#7C6FF0]/40 transition-colors space-y-3">
                  <div className="w-10 h-10 rounded-lg bg-[#7C6FF0]/10 flex items-center justify-center text-[#7C6FF0]">
                    <ShieldAlert size={20} />
                  </div>
                  <h3 className="text-base font-bold">100% 중립 금융 원칙</h3>
                  <p className="text-xs text-[#9CA3AF] leading-relaxed">
                    특정 증권사, 은행의 영리성 상품을 팔기 위한 유혹은 없습니다. 검증된 금융공동 기관 정보 및 세제 규정만을 엄수하여 진실된 금융 로드맵을 알려 줍니다.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-[#1A1740]/40 border border-[#2D2A5E] hover:border-[#4ECFA8]/40 transition-colors space-y-3">
                  <div className="w-10 h-10 rounded-lg bg-[#4ECFA8]/10 flex items-center justify-center text-[#4ECFA8]">
                    <Wallet size={20} />
                  </div>
                  <h3 className="text-base font-bold">진짜 내 금융성향 분석</h3>
                  <p className="text-xs text-[#9CA3AF] leading-relaxed">
                    불확실한 투자 종목을 무작정 제안하기 전에, 7가지 질문으로 당신 안에 내제된 보수성/도전성 등의 가치 패러다임을 짚어내는 진단 우선 시스템입니다.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-[#1A1740]/40 border border-[#2D2A5E] hover:border-[#7C6FF0]/40 transition-colors space-y-3">
                  <div className="w-10 h-10 rounded-lg bg-[#7C6FF0]/10 flex items-center justify-center text-[#7C6FF0]">
                    <Coins size={20} />
                  </div>
                  <h3 className="text-base font-bold">용어 즉시 번해 번역</h3>
                  <p className="text-xs text-[#9CA3AF] leading-relaxed">
                    IRP, ISA, ETF 등 낯부끄런 외계어 단지들로 기죽지 마세요! 대화 도중 핵심 어려운 은사가 출현 시, 딸깍 클릭 시 쉬운 뜻풀이가 내장됩니다.
                  </p>
                </div>
              </div>
            </div>

            {/* THREE SIMPLE STEPS GUIDE */}
            <div className="max-w-xl mx-auto space-y-6 pt-4 border-t border-[#2D2A5E]/40">
              <div className="text-center">
                <h2 className="text-sm tracking-wider font-extrabold uppercase text-[#4ECFA8]">3단계 완전 가이드</h2>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-4 bg-[#1A1740]/30 p-3.5 rounded-xl border border-[#2D2A5E]/60 text-xs text-[#F0EEF8]">
                  <div className="w-6 h-6 rounded-full bg-[#7C6FF0] font-bold flex items-center justify-center text-white shrink-0">1</div>
                  <span className="flex-1">간편 7문항 가치관 체크로 주식/저축 감성 분류하기</span>
                </div>
                <div className="flex items-center gap-4 bg-[#1A1740]/30 p-3.5 rounded-xl border border-[#2D2A5E]/60 text-xs text-[#F0EEF8]">
                  <div className="w-6 h-6 rounded-full bg-[#7C6FF0] font-bold flex items-center justify-center text-white shrink-0">2</div>
                  <span className="flex-1">안정형/균형형/성장형 가치관 결과 증명서 획득 (텍스트 보관 가능)</span>
                </div>
                <div className="flex items-center gap-4 bg-[#1A1740]/30 p-3.5 rounded-xl border border-[#2D2A5E]/60 text-xs text-[#F0EEF8]">
                  <div className="w-6 h-6 rounded-full bg-[#7C6FF0] font-bold flex items-center justify-center text-white shrink-0">3</div>
                  <span className="flex-1">그 결과를 머리에 장착한 AI 상담원과 무한 채팅 해소</span>
                </div>
              </div>

              <div className="text-center pt-2">
                <button
                  id="main-bottom-btn"
                  onClick={handleStartDiagnosis}
                  className="px-6 py-3 rounded-lg bg-[#231F50] hover:bg-[#2D2A5E] border border-[#7C6FF0]/40 text-xs font-bold text-[#AFA9EC] transition-all cursor-pointer"
                >
                  지금 무료 시작하기
                </button>
              </div>
            </div>

          </div>
        )}

        {/* ============================================== */}
        {/* 2. DIAGNOSTIC SURVEY FLOW                       */}
        {/* ============================================== */}
        {currentPage === "diagnosis" && (
          <div id="page-diagnosis" className="py-8 space-y-8 animate-fadeUp">
            
            {/* 2.1 INTRO SUB-STAGE */}
            {diagnosisStep === "intro" && (
              <div id="diagnosis-intro" className="max-w-md mx-auto text-center space-y-6 bg-[#1A1740] border border-[#2D2A5E] p-6 sm:p-8 rounded-2xl shadow-xl">
                <div className="w-14 h-14 rounded-full bg-[#7C6FF0]/10 flex items-center justify-center mx-auto text-[#7C6FF0]">
                  <MessageSquare size={28} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl sm:text-2xl font-extrabold text-[#F0EEF8]">금융 가치관 진단에 오신 것을 환영합니다!</h2>
                  <p className="text-xs text-[#9CA3AF] leading-relaxed">
                    적금을 안전하게 채우는 것이 나에게 맞을지, 과감하게 ETF 주방에 뛰어들어야 안전할지 아직 방향이 혼미하다면? 당신의 잠재 금융 성향을 7문항으로 세밀하게 수집합니다.
                  </p>
                </div>

                <div className="bg-[#0F0C2A] p-4 rounded-xl text-left border border-[#2D2A5E]/75 space-y-2 text-xs text-[#AFA9EC]">
                  <p className="flex items-center gap-1.5 font-bold"><Check size={14} className="text-[#4ECFA8]" /> 소요 예상 시간: 약 3분 내외</p>
                  <p className="flex items-center gap-1.5 font-bold"><Check size={14} className="text-[#4ECFA8]" /> 총 설문 문항: 7문항 단답형</p>
                  <p className="flex items-center gap-1.5 font-bold"><Check size={14} className="text-[#4ECFA8]" /> 개인 정보 노출 무관 (회원가입 일절 불필요)</p>
                </div>

                <button
                  id="diag-start-flow-btn"
                  onClick={startQuestionFlow}
                  className="w-full py-3.5 rounded-xl bg-[#7C6FF0] hover:bg-[#5A4ED4] text-white font-bold tracking-wide text-xs sm:text-sm shadow-md transition-all cursor-pointer"
                >
                  진단 시작하기
                </button>
              </div>
            )}

            {/* 2.2 QUESTION IN-PROGRESS FLOW SUB-STAGE */}
            {diagnosisStep === "question" && (
              <div id="diagnosis-question" className="max-w-lg mx-auto bg-[#1A1740] border border-[#2D2A5E] p-5 sm:p-7 rounded-2xl shadow-xl space-y-6">
                
                {/* Back & Indicator Navigation */}
                <div className="flex items-center justify-between text-xs">
                  <button
                    id="diag-back-btn"
                    onClick={handleBackQuestion}
                    className="text-[#9CA3AF] hover:text-[#F0EEF8] flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <ArrowLeft size={14} />
                    이전으로
                  </button>
                  <span className="font-bold text-[#AFA9EC] bg-[#231F50] px-2.5 py-1 rounded-full">
                    {currentQ + 1} / 7
                  </span>
                </div>

                {/* Smooth Progress Bar */}
                <div className="w-full h-1.5 rounded-full bg-[#0F0C2A] overflow-hidden">
                  <div 
                    id="diag-progress"
                    className="h-full bg-gradient-to-r from-[#7C6FF0] to-[#4ECFA8] transition-all duration-300"
                    style={{ width: `${((currentQ + 1) / 7) * 100}%` }}
                  ></div>
                </div>

                {/* Target Question Block */}
                <div className="space-y-4">
                  <h3 className="text-base sm:text-lg font-black text-[#F0EEF8] leading-snug">
                    {QUESTIONS[currentQ].q}
                  </h3>
                  
                  <div className="space-y-2.5 pt-2">
                    {QUESTIONS[currentQ].choices.map((choice, idx) => (
                      <button
                        key={idx}
                        id={`choice-btn-${idx}`}
                        onClick={() => handleSelectChoice(idx)}
                        className={`w-full text-left p-4 rounded-xl border text-xs sm:text-sm font-medium transition-all flex items-center justify-between cursor-pointer ${
                          userAnswers[currentQ] === idx 
                          ? "bg-[#7C6FF0]/15 border-[#7C6FF0] text-white font-semibold" 
                          : "bg-[#0F0C2A]/60 border-[#2D2A5E] hover:border-[#7C6FF0]/40 text-[#D4CFFF]"
                        }`}
                      >
                        <span>{choice.text}</span>
                        {userAnswers[currentQ] === idx && (
                          <span className="w-5 h-5 rounded-full bg-[#7C6FF0] flex items-center justify-center">
                            <Check size={12} className="text-white" />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 2.3 RADAR CINEMATIC LOADING PREPARATION */}
            {diagnosisStep === "loading" && (
              <div id="diagnosis-loading" className="max-w-md mx-auto text-center py-12 p-8 space-y-6">
                <div className="relative w-20 h-20 mx-auto">
                  {/* CSS Radar Rings Indicator */}
                  <div className="absolute inset-0 rounded-full border border-[#7C6FF0]/20 animate-ping"></div>
                  <div className="absolute inset-2 rounded-full border border-[#4ECFA8]/40 animate-pulse"></div>
                  <div className="absolute inset-4 rounded-full bg-gradient-to-tr from-[#7C6FF0] to-[#4ECFA8] flex items-center justify-center">
                    <RefreshCw size={24} className="text-white animate-spin" />
                  </div>
                </div>

                <div className="space-y-2">
                  <p id="loading-txt" className="text-base font-bold text-[#F0EEF8] tracking-widest animate-pulse">금융 가치관 패턴 해독 분석 중...</p>
                  <p className="text-xs text-[#9CA3AF]">7개의 대답 가중치를 기반으로 당신의 안전 선호도를 파악하고 있습니다.</p>
                </div>
              </div>
            )}

            {/* 2.4 REPORT CARD SUB-STAGE */}
            {diagnosisStep === "result" && userType && (
              <div id="diagnosis-result" className="max-w-lg mx-auto bg-[#1A1740] border border-[#2D2A5E] p-6 sm:p-8 rounded-2xl shadow-xl space-y-6 animate-fadeUp">
                
                {/* Visual Identity Logo Emblem */}
                <div className="text-center space-y-3">
                  <span className="text-5xl inline-block animate-bounce">{TYPE_DATA[userType].icon}</span>
                  <div className="space-y-1">
                    <span className="text-[10px] text-[#4ECFA8] tracking-widest font-extrabold bg-[#4ECFA8]/10 px-2.5 py-0.5 rounded-full border border-[#4ECFA8]/25 uppercase">내 자산 성향</span>
                    <h2 className="text-2xl font-black text-[#F0EEF8]">{TYPE_DATA[userType].name}</h2>
                    <p className="text-sm font-semibold text-[#AFA9EC]">"{TYPE_DATA[userType].tagline}"</p>
                  </div>
                </div>

                {/* Analysis detail paragraphs */}
                <div className="p-4 rounded-xl bg-[#0F0C2A] border border-[#2D2A5E]/80 text-xs sm:text-sm text-[#D4CFFF] leading-relaxed whitespace-pre-line">
                  {TYPE_DATA[userType].desc}
                </div>

                {/* Key Suggestion Recommendation Tags */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-extrabold text-[#9CA3AF] uppercase tracking-wider">추천 관심 금융 키워드</h4>
                  <div className="flex flex-wrap gap-2">
                    {TYPE_DATA[userType].keywords.map((kw, i) => (
                      <span 
                        key={i} 
                        className="text-xs font-bold text-[#4ECFA8] px-3 py-1.5 rounded-lg bg-[#4ECFA8]/10 border border-[#4ECFA8]/20 focus:outline-none"
                      >
                        #{kw}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Download and Chat triggers */}
                <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    id="diag-download-btn"
                    onClick={handleDownloadDiagnosisResult}
                    className="py-3 px-4 rounded-xl border border-[#2D2A5E] bg-[#231F50]/40 hover:bg-[#231F50] text-[#AFA9EC] font-bold text-xs tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Download size={14} />
                    진단서 (.txt) 내려받기
                  </button>
                  <button
                    id="diag-consult-start-btn"
                    onClick={handleStartConsulting}
                    className="py-3 px-4 rounded-xl bg-gradient-to-r from-[#7C6FF0] to-[#5A4ED4] hover:brightness-110 text-white font-bold text-xs tracking-wide shadow-md shadow-[#7C6FF0]/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    이 가치관으로 AI 상담 가동하기
                    <Sparkles size={14} />
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ============================================== */}
        {/* 3. DUAL-WINDOW LIVE AI CONSULTING CHAT LOG       */}
        {/* ============================================== */}
        {currentPage === "chat" && (
          <div id="page-chat" className="py-4 flex-1 flex flex-col min-h-[calc(100vh-120px)] animate-fadeUp">
            
            {/* Quick Summary Sticky Banner */}
            {userType && (
              <div className="mb-4 p-3.5 rounded-xl bg-[#231F50] border border-[#2D2A5E] flex items-center justify-between text-xs shadow-md">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">{TYPE_DATA[userType].icon}</span>
                  <div>
                    <span className="text-[#9CA3AF] text-[10px]">나의 금융 성향</span>
                    <p className="font-bold text-[#F0EEF8]">{TYPE_DATA[userType].name}</p>
                  </div>
                </div>
                <button
                  id="banner-view-diag-btn"
                  onClick={() => setShowResultModal(true)}
                  className="px-3 py-1 rounded-lg bg-[#7C6FF0]/15 hover:bg-[#7C6FF0]/35 text-[#AFA9EC] font-semibold text-[10px] border border-[#7C6FF0]/20 transition-all cursor-pointer"
                >
                  성향 분석 카드
                </button>
              </div>
            )}

            {/* Absolute Interactive Term Explainer Trigger Modal Bubble */}
            {activeTerm && (
              <div className="p-3.5 rounded-xl bg-[#7C6FF0]/15 border border-[#7C6FF0]/40 text-xs text-[#F0EEF8] mb-4 relative animate-fadeUp">
                <button 
                  id="close-term-btn"
                  onClick={() => setActiveTerm(null)} 
                  className="absolute top-2.5 right-2 text-[#AFA9EC] hover:text-white cursor-pointer"
                >
                  <X size={15} />
                </button>
                <p className="font-bold text-[#4ECFA8] mb-1 flex items-center gap-1">
                  💡 용어 사전: <span className="font-extrabold text-white text-sm">{activeTerm.term}</span>
                </p>
                <p className="text-[#D4CFFF] leading-relaxed pr-6">{activeTerm.definition}</p>
              </div>
            )}

            {/* Scrollable messages canvas */}
            <div className="flex-1 bg-[#1A1740]/30 rounded-2xl border border-[#2D2A5E] overflow-y-auto p-4 space-y-4 min-h-[350px]">
              
              {chatMessages.map((msg, index) => {
                const isModel = msg.role === "model";
                return (
                  <div key={msg.id || index} className={`flex ${isModel ? "justify-start" : "justify-end"} animate-fadeUp`}>
                    <div className={`flex items-start gap-2.5 max-w-[85%] ${!isModel && "flex-row-reverse"}`}>
                      {/* Avatar for AI */}
                      {isModel && (
                        <div className="w-8 h-8 rounded-lg bg-[#7C6FF0]/20 border border-[#7C6FF0]/50 flex items-center justify-center font-black text-xs text-[#AFA9EC] shrink-0 mt-0.5">
                          핀
                        </div>
                      )}

                      <div className="space-y-1.5 text-xs sm:text-sm">
                        <div className={`p-3.5 rounded-2xl ${
                          isModel 
                          ? "bg-[#7C6FF0]/15 border border-[#7C6FF0]/10 text-[#D4CFFF] rounded-tl-none whitespace-pre-wrap" 
                          : "bg-[#4ECFA8]/12 border border-[#4ECFA8]/10 text-[#A8EDD8] rounded-tr-none"
                        }`}>
                          {/* Use tooltips for matching AI replies */}
                          {isModel ? renderMessageContentWithTooltips(msg.text) : msg.text}
                        </div>

                        {/* Auxiliary metadata for AI answers only */}
                        {isModel && (
                          <div className="flex items-center justify-between gap-4 px-1 text-[10px] text-[#4B4870]">
                            <span className="font-semibold flex items-center gap-1 text-[#9CA3AF]">
                              📋 금융감독원 공공 데이터 기준
                            </span>
                            
                            <div className="flex items-center gap-2">
                              <button
                                id={`vote-up-btn-${msg.id}`}
                                onClick={() => handleVoteFeedback(msg.id, "positive")}
                                disabled={msg.feedback !== undefined}
                                className={`p-1 rounded hover:bg-[#2D2A5E]/40 transition-colors cursor-pointer ${msg.feedback === "positive" ? "text-[#4ECFA8]" : "text-[#4B4870]"}`}
                              >
                                <ThumbsUp size={12} />
                              </button>
                              <button
                                id={`vote-down-btn-${msg.id}`}
                                onClick={() => handleVoteFeedback(msg.id, "negative")}
                                disabled={msg.feedback !== undefined}
                                className={`p-1 rounded hover:bg-[#2D2A5E]/40 transition-colors cursor-pointer ${msg.feedback === "negative" ? "text-red-400" : "text-[#4B4870]"}`}
                              >
                                <ThumbsDown size={12} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Server Processing indicators */}
              {isAiTyping && (
                <div className="flex items-center gap-3 bg-[#1A1740]/45 p-3.5 rounded-xl border border-[#2D2A5E]/60 max-w-[200px] select-none animate-pulse">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#7C6FF0] animate-bounce"></span>
                    <span className="w-2 h-2 rounded-full bg-[#7C6FF0] animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-2 h-2 rounded-full bg-[#7C6FF0] animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                  <span className="text-xs font-bold text-[#AFA9EC]">핀챗 AI가 맞춤 답변을 분석 중입니다...</span>
                </div>
              )}

              {errorMessage && (
                <div className="p-4 rounded-xl bg-red-950/25 border border-red-900/50 flex items-start gap-2.5 text-xs text-red-300">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">{errorMessage}</p>
                    <button
                      id="retry-api-btn"
                      onClick={() => handleSendMessage()}
                      className="px-2 py-0.5 rounded bg-red-900/30 hover:bg-red-900/50 text-red-200 border border-red-800 transition-colors font-bold cursor-pointer"
                    >
                      재전송하기
                    </button>
                  </div>
                </div>
              )}

              <div ref={chatEndRef}></div>
            </div>

            {/* Input message form tray */}
            <form onSubmit={handleSendMessage} className="mt-4 flex flex-col gap-2 relative">
              <div className="relative flex items-center">
                <input
                  type="text"
                  maxLength={200}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={isAiTyping}
                  placeholder={isAiTyping ? "답변을 대기하고 있습니다." : "금융 용어, 청약 준비 법, 예적금 조절 등 질문해 보세요! (200자)"}
                  className="w-full bg-[#1A1740] border border-[#2D2A5E] hover:border-[#7C6FF0]/35 focus:border-[#7C6FF0] rounded-xl pl-4 pr-16 py-3.5 text-xs sm:text-sm text-[#F0EEF8] outline-none transition-all placeholder:text-[#4B4870] disabled:opacity-50"
                />
                
                <button
                  type="submit"
                  id="chat-send-btn"
                  disabled={isAiTyping || !inputText.trim()}
                  className="absolute right-2 px-3.5 py-2 bg-gradient-to-r from-[#7C6FF0] to-[#5A4ED4] hover:brightness-110 disabled:opacity-30 disabled:pointer-events-none rounded-lg text-white font-bold transition-all cursor-pointer"
                >
                  <Send size={15} />
                </button>
              </div>

              {/* Auxiliary letter constraint tracker */}
              <div className="flex items-center justify-between px-1 text-[10px] text-[#4B4870] font-sans">
                <span>⚠ 모든 핀챗 AI 답변은 금융 상품 권유가 아닌 정보 제공 목적입니다.</span>
                <span>{inputText.length} / 200자</span>
              </div>
            </form>

          </div>
        )}

      </main>

      {/* ============================================== */}
      {/* 4. MODAL DETAILED SCORECARD POPUP               */}
      {/* ============================================== */}
      {showResultModal && userType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F0C2A]/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-[#1A1740] border border-[#2D2A5E] p-6 shadow-2xl relative space-y-4">
            <button
              id="modal-close-btn"
              onClick={() => setShowResultModal(false)}
              className="absolute top-4 right-4 text-[#AFA9EC] hover:text-white transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="text-center space-y-2">
              <span className="text-5xl inline-block">{TYPE_DATA[userType].icon}</span>
              <h3 className="text-lg font-black text-[#F0EEF8]">{TYPE_DATA[userType].name}</h3>
              <p className="text-xs text-[#4ECFA8] font-bold">"{TYPE_DATA[userType].tagline}"</p>
            </div>

            <div className="p-3.5 bg-[#0F0C2A] rounded-xl text-xs text-[#D4CFFF] leading-relaxed whitespace-pre-line">
              {TYPE_DATA[userType].desc}
            </div>

            <div className="space-y-1.5 text-xs text-[#9CA3AF]">
              <span className="font-extrabold text-[10px] tracking-wider uppercase">핵심 권장 금융</span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {TYPE_DATA[userType].keywords.map((kw, i) => (
                  <span key={i} className="px-2 py-1 rounded bg-[#2D2A5E] text-white">#{kw}</span>
                ))}
              </div>
            </div>

            <div className="pt-2 text-center">
              <button
                id="modal-download-result-btn"
                onClick={handleDownloadDiagnosisResult}
                className="w-full py-2.5 text-xs font-bold text-[#AFA9EC] border border-[#2D2A5E] bg-[#231F50]/60 rounded-xl hover:bg-[#231F50] transition-all cursor-pointer"
              >
                진단 성향 인증서 내려받기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Legal Safety Disclaimer Footer */}
      <footer className="py-4 mt-8 border-t border-[#2D2A5E] text-center text-[10px] text-[#4B4870]">
        <div className="max-w-6xl mx-auto px-4 space-y-1">
          <p>FinChat은 금융소비자보호법 제 17조 및 제 19조를 엄격하게 준수하며 어떠한 특정 자금 상품도 거래·계약 대행하지 않습니다.</p>
          <p>© 2026 FinChat & AI Studio. All rights reserved. 브라우저 세션 기반 임시 저장 (정보 폐기형 세션 구축)</p>
        </div>
      </footer>

    </div>
  );
}
