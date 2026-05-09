import { BookOpen, Loader2, Send, AlertCircle } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

type Message = {
  role: "user" | "model" | "system";
  text: string;
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [searchMode, setSearchMode] = useState<"all" | "arab-indo" | "indo-arab" | "munawwir" | "arab-arab" | "lisanul-arab" | "quran">("all");
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
        text: "Assalamu'alaikum. Selamat datang di Kamus Asy-Syifaa.\n\nSaya adalah asisten AI yang siap membantu Anda mencari makna istilah dalam pangkalan data Pesantren Asy-Syifaa Wal Mahmuudiyyah. Apa yang ingin Anda cari hari ini?",
      },
    ]);
  }, []);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isTyping) return;

    const userText = input.trim();
    setInput("");
    
    let displayMessage = userText;
    let promptMessage = userText;
    
    switch (searchMode) {
      case "all":
        promptMessage = `Cari: "${userText}". Tolong tampilkan hasil dari SEMUA kamus berikut jika ada:
1. Arab-Indo
2. Indo-Arab
3. Kamus Munawwir
4. Mu'jam Arab
5. Lisanul Arab
6. Al-Qur'an

Sajikan secara terstruktur dan ringkas.`;
        displayMessage = `[Semua] ${userText}`;
        break;
      case "arab-indo":
        promptMessage = `Terjemahkan ke Indonesia: "${userText}"`;
        displayMessage = `[Arab - Indo] ${userText}`;
        break;
      case "indo-arab":
        promptMessage = `Terjemahkan ke Arab: "${userText}"`;
        displayMessage = `[Indo - Arab] ${userText}`;
        break;
      case "munawwir":
        promptMessage = `Cari di Kamus Munawwir: "${userText}"`;
        displayMessage = `[Kamus Munawwir] ${userText}`;
        break;
      case "arab-arab":
        promptMessage = `Cari di Mu'jam Arab: "${userText}"`;
        displayMessage = `[Mu'jam Arab] ${userText}`;
        break;
      case "lisanul-arab":
        promptMessage = `Cari di Kamus Lisanul Arab: "${userText}"`;
        displayMessage = `[Lisanul Arab] ${userText}`;
        break;
      case "quran":
        promptMessage = `Cari ayat Al-Qur'an terkait: "${userText}"`;
        displayMessage = `[Al-Qur'an] ${userText}`;
        break;
    }

    setMessages((prev) => [...prev, { role: "user", text: displayMessage }]);
    setIsTyping(true);

    try {
      console.log("Sending request to /api/chat...");
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: messages.filter(m => m.role !== "system"),
          promptMessage,
          userText
        })
      });

      const textResponse = await response.text();
      console.log("Received response text (first 100 chars):", textResponse.substring(0, 100));

      let data;
      try {
        data = JSON.parse(textResponse);
      } catch (err) {
        console.error("JSON Parse Error:", err, "Raw response:", textResponse);
        if (textResponse.includes("<!DOCTYPE html>")) {
          throw new Error("Server mengembalikan halaman HTML. Ini biasanya berarti rute API tidak ditemukan atau server sedang memulai ulang.");
        }
        throw new Error("Respon server bukan format JSON yang valid.");
      }
      
      if (!response.ok) {
        throw new Error(data.error || `Server error (${response.status})`);
      }
      
      setMessages((prev) => [...prev, { role: "model", text: data.text || "" }]);
    } catch (err: any) {
      console.error("Chat Error:", err);
      setMessages((prev) => [
        ...prev,
        { role: "system", text: `Maaf, terjadi kesalahan: ${err.message || "Gagal menghubungi server."}` },
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
