import { Chat, GoogleGenAI } from "@google/genai";
import { BookOpen, Loader2, Send, AlertCircle } from "lucide-react";
import Papa from "papaparse";
import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

type Message = {
  role: "user" | "model" | "system";
  text: string;
};

const SHEET_ID = "1Iu2-VyE2aQqG1NbKNm35auQm7K_v7W3D";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

const fetchWithCache = async (url: string) => {
  const CACHE_KEY = "kamus_csv_data";
  const CACHE_TIME = "kamus_csv_time";
  const now = Date.now();
  const cached = localStorage.getItem(CACHE_KEY);
  const time = localStorage.getItem(CACHE_TIME);

  if (cached && time && now - parseInt(time) < 1000 * 60 * 60 * 12) {
    // Fetch in background to keep data fresh on next reload
    fetch(url).then(res => res.text()).then(text => {
      localStorage.setItem(CACHE_KEY, text);
      localStorage.setItem(CACHE_TIME, Date.now().toString());
    }).catch(() => {});
    return cached;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Gagal mengambil data dari Google Sheets. Pastikan akses link terbuka untuk umum.");
  }
  const text = await response.text();
  localStorage.setItem(CACHE_KEY, text);
  localStorage.setItem(CACHE_TIME, Date.now().toString());
  return text;
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [searchMode, setSearchMode] = useState<"umum" | "terjemahan" | "definisi" | "makna">("umum");
  const [isLoading, setIsLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    async function initializeAgent() {
      try {
        setIsLoading(true);
        setError(null);
        
        const ai = new GoogleGenAI({ apiKey: "AIzaSyCTuirIbWaNe-gDTBwrYVVELjvCZGJ60aE" });

        const csvText = await fetchWithCache(CSV_URL);
        const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
        const kamusString = JSON.stringify(parsed.data);

        const systemInstruction = `Anda adalah AI Agent "Kamus Asy-Syifaa" untuk Pondok Pesantren Asy-Syifaa Wal Mahmuudiyyah PT Rojo Bronto Lano.
Tugas utama Anda adalah membantu pengguna mencari makna kata, menerjemahkan, dan memberikan penjelasan berdasarkan data referensi berikut:
${kamusString}

Arahan:
1. JAWABLAH DENGAN SINGKAT DAN PADAT. Fokus langsung pada inti data dari kamus.
2. Gunakan bahasa percakapan secukupnya saja hanya sebagai pemanis agar terdengar natural, jangan bertele-tele.
3. Jika istilah yang dicari ada di dalam data, berikan maknanya dengan jelas dan ringkas.
4. Jika istilah tidak ada di dalam data, beri tahu dengan sopan dan singkat bahwa istilah tersebut belum ada di pangkalan data saat ini.`;

        const chat = ai.chats.create({
          model: "gemini-3-flash-preview",
          config: {
            systemInstruction,
          },
        });

        chatRef.current = chat;
        setIsLoading(false);
        setMessages([
          {
            role: "model",
            text: "Assalamu'alaikum. Selamat datang di Kamus Asy-Syifaa.\n\nSaya adalah asisten AI yang siap membantu Anda mencari makna istilah dalam pangkalan data Pesantren Asy-Syifaa Wal Mahmuudiyyah. Apa yang ingin Anda cari hari ini?",
          },
        ]);
      } catch (err: any) {
        console.error("Initialization Error:", err);
        setError(err.message || "Terjadi kesalahan saat memuat data atau API Key tidak valid.");
        setIsLoading(false);
      }
    }

    initializeAgent();
  }, []);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || !chatRef.current || isTyping) return;

    const userText = input.trim();
    setInput("");
    
    let displayMessage = userText;
    let promptMessage = userText;
    
    if (searchMode !== "umum") {
      const modeText = searchMode.charAt(0).toUpperCase() + searchMode.slice(1);
      displayMessage = `[${modeText}] ${userText}`;
      promptMessage = `Tolong berikan ${searchMode} dari kata/istilah berikut: "${userText}"`;
    }

    setMessages((prev) => [...prev, { role: "user", text: displayMessage }]);
    setIsTyping(true);

    try {
      const result = await chatRef.current.sendMessage({ message: promptMessage });
      setMessages((prev) => [...prev, { role: "model", text: result.text || "" }]);
    } catch (err: any) {
      console.error("Chat Error:", err);
      setMessages((prev) => [
        ...prev,
        { role: "system", text: "Maaf, terjadi kesalahan saat mencoba menjawab pertanyaan Anda." },
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
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {[
                { id: "umum", label: "Umum" },
                { id: "terjemahan", label: "Terjemahan" },
                { id: "definisi", label: "Definisi" },
                { id: "makna", label: "Makna" }
              ].map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setSearchMode(mode.id as any)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors shrink-0 border ${
                    searchMode === mode.id 
                      ? "bg-primary-800 border-primary-800 text-white shadow-sm" 
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {mode.label}
                </button>
              ))}
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
