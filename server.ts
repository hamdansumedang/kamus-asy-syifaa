import express from "express";
import { createServer as createViteServer } from "vite";
import OpenAI from "openai";
import path from "path";
import Papa from "papaparse";

const SHEET_ID = "1Iu2-VyE2aQqG1NbKNm35auQm7K_v7W3D";

// Pangkalan data terbagi menjadi beberapa sheet
const SHEETS = [
  "almufid",
  "arab_indo",
  "arab_indo2",
  "arabic_arabic2",
  "ghoribulquran",
  "mujamul_ghoni",
  "mujamul_muashiroh",
  "quran"
];

let kamusData: any[] = [];
let isDataLoading = false;

async function loadKamusData() {
  if (kamusData.length > 0 || isDataLoading) return;
  isDataLoading = true;
  
  console.log("Memulai pengunduhan data kamus...");
  
  try {
    // Kita coba ambil sheet utama (arab_indo) terlebih dahulu sebagai sampel utama agar tidak OOM
    // Jika memori cukup, kita bisa ambil yang lain. Untuk sekarang fokus ke yang paling relevan.
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

  // Ping & Health
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      dataCount: kamusData.length,
      loading: isDataLoading 
    });
  });

  app.all("/api/ping", (req, res) => res.send("pong"));

  // AI Chat Endpoint
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, promptMessage } = req.body;
      
      if (!kamusData.length && !isDataLoading) {
        loadKamusData().catch(console.error);
      }

      const openrouterApiKey = process.env.OPENROUTER_API_KEY || "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";
      const openai = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: openrouterApiKey,
      });

      // RAG sederhana
      let keyword = promptMessage.replace(/["']/g, "").toLowerCase().trim();
      let matches: any[] = [];
      
      if (keyword.length > 1) {
        for (const row of kamusData) {
          const rowStr = JSON.stringify(row).toLowerCase();
          if (rowStr.includes(keyword)) {
             matches.push(row);
             if (matches.length >= 20) break;
          }
        }
      }

      const systemInstruction = `Anda adalah AI Kamus Asy-Syifaa.
Bantu pengguna menerjemahkan atau mencari makna dari pangkalan data berikut (Khusus: ${keyword}):
${JSON.stringify(matches)}

Jawablah dengan SANGAT SINGKAT. Langsung ke inti makna.
Gunakan data di atas jika tersedia. Jika tidak, gunakan pengetahuan bahasa Arab Anda sendiri.`;

      const completion = await openai.chat.completions.create({
        model: "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: systemInstruction },
          ...messages.map((m: any) => ({
            role: m.role === "model" ? "assistant" : "user",
            content: m.text
          })).slice(-10), // Ambil 10 pesan terakhir saja
          { role: "user", content: promptMessage }
        ],
      });

      res.json({ text: completion.choices[0]?.message?.content || "" });
    } catch (error: any) {
      console.error("Endpoint Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite
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
