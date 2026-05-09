import { BookOpen, Loader2, Send, AlertCircle } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { GoogleGenAI, Type } from "@google/genai";

type Message = {
  role: "user" | "model" | "system";
  text: string;
};

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [searchMode, setSearchMode] = useState<"all" | "arab-indo" | "indo-arab" | "munawwir" | "arab-arab" | "lisanul-arab" | "quran" | "almufid">("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    setMessages([
      {
        role: "model",
        text: "Assalamu'alaikum. Selamat datang di Kamus Asy-Syifaa.\n\nSaya adalah asisten AI yang mencari di pangkalan data lengkap:\n1. **Kamus Arab - Indonesia** (154.644 kata)\n2. **Mu'jamul Arab** (29.803 mufrodat)\n3. **Kamus Almufid** (8.860 kata)\n4. **Kamus Al-Qur'an & Ghoribul Qur'an**\n5. **Kamus Munawwir & Lisanul Arab**\n\nPilih tab kategori atau gunakan **'Semua'** untuk mencari di seluruh pangkalan data. Apa yang ingin Anda cari hari ini?",
      },
    ]);

    // Check if database is ready
    const checkHealth = async () => {
      try {
        const res = await fetch("/api/health");
        const data = await res.json();
        if (!data.isLoaded) {
          setIsLoading(true);
          setTimeout(checkHealth, 2000);
        } else {
          setIsLoading(false);
        }
      } catch (e) {
        console.error("Health check failed:", e);
        setTimeout(checkHealth, 5000);
      }
    };
    checkHealth();
  }, []);

  const searchDictionary = async (q: string, mode: string) => {
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&mode=${mode}`);
    if (!res.ok) throw new Error("Gagal mencari di pangkalan data.");
    return await res.json();
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isTyping) return;

    const userText = input.trim();
    setInput("");
    
    let displayMessage = userText;
    switch (searchMode) {
      case "all": displayMessage = `[Semua] ${userText}`; break;
      case "arab-indo": displayMessage = `[Arab - Indo] ${userText}`; break;
      case "indo-arab": displayMessage = `[Indo - Arab] ${userText}`; break;
      case "munawwir": displayMessage = `[Kamus Munawwir] ${userText}`; break;
      case "arab-arab": displayMessage = `[Mu'jam Arab] ${userText}`; break;
      case "lisanul-arab": displayMessage = `[Lisanul Arab] ${userText}`; break;
      case "quran": displayMessage = `[Al-Qur'an] ${userText}`; break;
      case "almufid": displayMessage = `[Kamus Almufid] ${userText}`; break;
    }

    setMessages((prev) => [...prev, { role: "user", text: displayMessage }]);
    setIsTyping(true);

    try {
      const toolSearchDictionary = {
        name: "search_dictionary",
        parameters: {
          type: Type.OBJECT,
          description: "Mencari kata atau istilah di pangkalan data kamus.",
          properties: {
            query: { type: Type.STRING, description: "Kata atau istilah yang dicari." },
            mode: { type: Type.STRING, description: "Mode pencarian (all, arab-indo, indo-arab, munawwir, arab-arab, lisanul-arab, quran, almufid)." }
          },
          required: ["query", "mode"]
        }
      };

      const systemInstruction = `Anda adalah AI Agent "Kamus Asy-Syifaa" untuk Pondok Pesantren Asy-Syifaa Wal Mahmuudiyyah.
Aplikasi ini menyediakan akses ke berbagai pangkalan data kamus.

Arahan Utama:
1. GUNAKAN TOOL search_dictionary untuk mencari data di kamus. SELALU panggil tool ini untuk setiap pencarian kata.
2. JAWABLAH DENGAN SPESIFIK DAN INFORMATIF. Berikan hasil dari SEMUA sumber yang relevan yang ditemukan oleh tool.
3. Tuliskan nama kamus sumber di awal atau akhir jawaban.
4. Gunakan Bahasa Indonesia yang baik dan benar.
5. Jika istilah tidak ditemukan di tool, beri tahu dengan sopan bahwa kata tersebut belum ada di database kamus kami.
6. Rekomendasi Gboard: Jika pengguna kesulitan input Arab, sarankan Gboard (Google Keyboard) dengan mengaktifkan bahasa Arab.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          ...messages.map(m => ({
            role: m.role === "model" ? "assistant" : m.role as any,
            parts: [{ text: m.text }]
          })),
          { role: "user", parts: [{ text: `Search mode: ${searchMode}. User query: ${userText}` }] }
        ],
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: [toolSearchDictionary] }]
        }
      });

      const functionCalls = response.functionCalls;
      if (functionCalls) {
        const call = functionCalls[0];
        if (call.name === "search_dictionary") {
          const { query, mode } = call.args as any;
          const searchResult = await searchDictionary(query || userText, mode || searchMode);
          
          const finalResponse = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [
              ...messages.map(m => ({
                role: m.role === "model" ? "assistant" : m.role as any,
                parts: [{ text: m.text }]
              })),
              { role: "user", parts: [{ text: `Search mode: ${searchMode}. User query: ${userText}` }] },
              response.candidates[0].content, // The tool call content
              {
                role: "user",
                parts: [{ text: `HASIL PENCARIAN DI KAMUS: ${JSON.stringify(searchResult.results)}` }]
              }
            ],
            config: { systemInstruction }
          });
          
          setMessages((prev) => [...prev, { role: "model", text: finalResponse.text || "" }]);
        }
      } else {
        setMessages((prev) => [...prev, { role: "model", text: response.text || "" }]);
      }
    } catch (err: any) {
      console.error("Chat Error:", err);
      setMessages((prev) => [
        ...prev,
        { role: "system", text: `Maaf, terjadi kesalahan: ${err.message || "Gagal menghubungi server AI."}` },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="min-h-screen h-screen bg-slate-50 flex flex-col selection:bg-primary-200">
      <div className="w-full h-full bg-white flex flex-col overflow-hidden">
        
        {/* Header */}
        <header className="px-5 py-6 md:px-8 bg-primary-900 text-white flex justify-center items-center shrink-0 shadow-sm relative z-10">
          <div className="w-full max-w-4xl flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center shrink-0 border border-white/20">
                <BookOpen className="w-6 h-6 text-primary-50" strokeWidth={1.5} />
              </div>
              <div>
                <h1 className="font-arabic text-2xl md:text-3xl font-bold tracking-wide">Kamus Asy-Syifaa</h1>
                <p className="font-sans text-sm text-primary-200 tracking-wide opacity-90 mt-0.5">
                  Pondok Pesantren Asy-Syifaa Wal Mahmuudiyyah
                </p>
                <p className="font-sans text-xs text-primary-300 tracking-wide opacity-75 mt-0.5">
                  Dikembangkan oleh PT Rojo Bronto Lano
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-4 py-8 md:px-8 relative bg-slate-50/30 flex justify-center">
          <div className="w-full max-w-4xl space-y-6">
            {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-primary-600 space-y-4">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="font-sans font-medium tracking-wide animate-pulse">Mengunduh data pangkalan kamus...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 max-w-sm mx-auto">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-2">
                <AlertCircle className="w-8 h-8" />
              </div>
              <p className="font-sans text-red-600 font-medium">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="mt-4 px-6 py-2.5 bg-primary-800 text-white rounded-full font-medium shadow-sm hover:-translate-y-0.5 transition-transform"
              >
                Muat Ulang
              </button>
            </div>
          ) : (
            <>
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] md:max-w-[75%] rounded-3xl px-6 py-4 ${
                      message.role === "user"
                        ? "bg-primary-800 text-white rounded-tr-sm"
                        : message.role === "system"
                        ? "bg-red-50 text-red-800 border border-red-100 italic"
                        : "bg-white text-slate-800 border border-slate-200 shadow-sm rounded-tl-sm"
                    }`}
                  >
                    <div className={`prose prose-sm md:prose-base prose-p:leading-relaxed prose-ol:pl-4 prose-ul:pl-4 prose-li:my-1 prose-strong:font-semibold max-w-none ${message.role === "user" ? "prose-invert prose-p:text-white prose-strong:text-white text-white" : ""}`}>
                      <ReactMarkdown>{message.text}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 shadow-sm rounded-3xl rounded-tl-sm px-6 py-5 flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <span className="w-2 h-2 bg-primary-300 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="w-2 h-2 bg-primary-300 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="w-2 h-2 bg-primary-300 rounded-full animate-bounce"></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
          </div>
        </div>

        {/* Input Area */}
        <div className="p-4 md:p-6 bg-white border-t border-slate-200 shrink-0">
          <form
            onSubmit={handleSend}
            className="flex flex-col gap-3 max-w-4xl mx-auto"
          >
            <div className="flex justify-between items-center overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden w-full gap-4">
              <div className="flex gap-2 shrink-0">
                {[
                  { id: "all", label: "Semua" },
                  { id: "arab-indo", label: "Arab - Indo" },
                  { id: "indo-arab", label: "Indo - Arab" },
                  { id: "munawwir", label: "Kamus Munawwir" },
                  { id: "arab-arab", label: "Mu'jam Arab" },
                  { id: "lisanul-arab", label: "Lisanul Arab" },
                  { id: "almufid", label: "Kamus Almufid" },
                  { id: "quran", label: "Al-Qur'an" }
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setSearchMode(mode.id as any)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border whitespace-nowrap ${
                      searchMode === mode.id 
                        ? "bg-primary-800 border-primary-800 text-white shadow-sm" 
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="relative flex items-end gap-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isLoading || error ? "Harap tunggu..." : "Tanyakan kata atau istilah..."}
                disabled={isLoading || !!error}
                rows={1}
                className="flex-1 max-h-32 min-h-[56px] resize-none rounded-3xl bg-slate-50 border border-slate-200 px-6 py-4 outline-none focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-sans disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading || isTyping || !!error}
                className="w-14 h-14 shrink-0 bg-primary-800 text-white rounded-full flex items-center justify-center hover:bg-primary-700 disabled:opacity-50 disabled:hover:bg-primary-800 transition-colors shadow-sm"
              >
                <Send className="w-5 h-5 -ml-0.5" />
              </button>
            </div>
          </form>
          <div className="text-center mt-3">
            <p className="text-xs text-slate-400 font-sans tracking-wide">
              Data bersumber dari Kamus Asy-Syifaa. AI dapat membuat kesalahan.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
