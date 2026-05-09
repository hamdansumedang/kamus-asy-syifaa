import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenerativeAI } from "@google/generative-ai";
import path from "path";
import Papa from "papaparse";

const SHEET_ID = "1Iu2-VyE2aQqG1NbKNm35auQm7K_v7W3D";

let kamusData: any[] = [];
let isDataLoading = false;

async function loadKamusData() {
  if (kamusData.length > 0 || isDataLoading) return;
  isDataLoading = true;
  
  console.log("Memulai pengunduhan data kamus...");
  
  try {
    const targetSheet = "arab_indo";
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${targetSheet}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Gagal ambil sheet ${targetSheet}`);
    
    const csvText = await response.text();
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
    kamusData = parsed.data;
    console.log(`Data ${targetSheet} berhasil dimuat. Total: ${kamusData.length} entri.`);
    
  } catch (error) {
    console.error("Kesalahan saat memuat data kamus:", error);
  } finally {
    isDataLoading = false;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      dataCount: kamusData.length,
      loading: isDataLoading 
    });
  });

  // Search API for RAG
  app.post("/api/search", async (req, res) => {
    try {
      const { keyword } = req.body;
      
      if (!kamusData.length && !isDataLoading) {
        loadKamusData().catch(console.error);
      }

      let matches: any[] = [];
      const cleanKeyword = (keyword || "").replace(/["']/g, "").toLowerCase().trim();
      
      if (cleanKeyword.length > 1) {
        for (const row of kamusData) {
          const rowStr = JSON.stringify(row).toLowerCase();
          if (rowStr.includes(cleanKeyword)) {
             matches.push(row);
             if (matches.length >= 30) break;
          }
        }
      }
      
      res.json({ matches });
    } catch (error: any) {
      console.error("Search Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // AI Chat Endpoint (Server-side)
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, promptMessage, userText } = req.body;

      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not set in the server environment.");
      }

      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      if (!kamusData.length && !isDataLoading) {
        loadKamusData().catch(console.error);
      }

      // RAG
      let matches: any[] = [];
      const cleanKeyword = (userText || "").replace(/["']/g, "").toLowerCase().trim();
      
      if (cleanKeyword.length > 1) {
        for (const row of kamusData) {
          const rowStr = JSON.stringify(row).toLowerCase();
          if (rowStr.includes(cleanKeyword)) {
             matches.push(row);
             if (matches.length >= 25) break;
          }
        }
      }

      const systemInstruction = `Anda adalah AI Kamus Asy-Syifaa untuk Pondok Pesantren Asy-Syifaa Wal Mahmuudiyyah.
Tugas Anda adalah membantu pengguna menerjemahkan atau mencari makna kata Arab-Indonesia.

Pangkalan Data Terkait (Kata Kunci: ${cleanKeyword}):
${JSON.stringify(matches)}

Arahan:
1. JAWABLAH DENGAN SANGAT SINGKAT. Langsung ke inti terjemahan atau makna.
2. Gunakan data pangkalan di atas jika tersedia. Jika tidak ada data yang cocok, gunakan pengetahuan luas Anda tentang bahasa Arab.
3. Selalu ramah dan sampaikan pesan dalam bahasa Indonesia yang natural.`;

      const chat = model.startChat({
        history: messages.map((m: any) => ({
          role: m.role === "model" ? "model" : "user",
          parts: [{ text: m.role === "user" ? m.text : m.text }],
        })).slice(-10),
      });

      const result = await chat.sendMessage([
        { text: `Sistem Instruksi: ${systemInstruction}` },
        { text: promptMessage }
      ]);
      
      const response = await result.response;
      res.json({ text: response.text() });
      
    } catch (error: any) {
      console.error("AI Chat Error:", error);
      res.status(500).json({ error: error.message || "Terjadi kesalahan pada AI." });
    }
  });

  // Serve static files in production or proxy in dev
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server started on port ${PORT}`);
    loadKamusData().catch(console.error);
  });
}

startServer().catch(console.error);
