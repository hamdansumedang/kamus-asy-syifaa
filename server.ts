import express from "express";
import { createServer as createViteServer } from "vite";
import OpenAI from "openai";
import path from "path";
import fs from "fs";
import Papa from "papaparse";

const SHEET_ID = "1Iu2-VyE2aQqG1NbKNm35auQm7K_v7W3D";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

let kamusData: any[] = [];
let lastCacheTime = 0;

async function loadKamusData() {
  const now = Date.now();
  if (kamusData.length > 0 && (now - lastCacheTime < 1000 * 60 * 60 * 12)) {
    return kamusData;
  }

  console.log("Fetching kamus data from Google Sheets...");
  try {
    const response = await fetch(CSV_URL);
    if (!response.ok) {
      throw new Error("Gagal mengambil data dari Google Sheets.");
    }
    const csvText = await response.text();
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
    kamusData = parsed.data;
    lastCacheTime = now;
    console.log("Kamus data successfully fetched and cached. Count: " + kamusData.length);
  } catch (error) {
    console.error("Error fetching kamus data:", error);
  }
}

// Prefetch data on startup
loadKamusData().catch(console.error);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // AI Endpoint
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, promptMessage } = req.body;

      const openrouterApiKey = process.env.OPENROUTER_API_KEY || "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";
      
      const openai = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: openrouterApiKey,
        defaultHeaders: {
          'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
          'X-OpenRouter-Title': 'Kamus Asy-Syifaa',
        },
      });
      
      const chatHistory = messages.map((m: any) => ({
        role: m.role === "model" ? "assistant" : m.role === "system" ? "system" : "user",
        content: m.text
      })).filter((m: any) => m.role !== "system");

      // Pastikan data dimuat
      await loadKamusData();

      // Cari kata kunci di prompt
      let keyword = "";
      const quoteMatch = promptMessage.match(/"([^"]+)"/);
      if (quoteMatch) {
          keyword = quoteMatch[1].toLowerCase();
      } else {
          // Jika tidak ada quote, coba ambil kata terakhir atau seluruh pesan tanpa kata peringatan
          keyword = promptMessage.replace(/Tolong berikan|Terjemahkan ke Indonesia|Terjemahkan ke Arab|Cari di|Tolong tampilkan|secara ringkas/ig, "").replace(/":"|"/g, "").trim().toLowerCase();
      }

      // Filter pangkalan data (RAG sederhana)
      let relevantData: any[] = [];
      if (keyword) {
          relevantData = kamusData.filter(row => {
             const rowStr = JSON.stringify(row).toLowerCase();
             return rowStr.includes(keyword);
          }).slice(0, 30); // Batasi 30 entri agar tidak melebihi token limit
      }

      const systemInstruction = `Anda adalah AI Agent "Kamus Asy-Syifaa" untuk Pondok Pesantren Asy-Syifaa Wal Mahmuudiyyah.
Aplikasi ini adalah himpunan pangkalan data bahasa Arab yang meliputi:
1. Kamus Arab Indonesia
2. Kamus Indonesia Arab
3. Kamus Munawwir
4. Kamus Arab (Mu'jamul Arab)
5. Kamus Lisanul Arab
6. Kamus Al-Qur'an (pencarian ayat)

Berdasarkan pencarian kata: "${keyword}"

Data Terkait dari Pangkalan (jika tersedia):
${JSON.stringify(relevantData)}

Arahan Utama:
1. JAWABLAH DENGAN SANGAT SINGKAT DAN SPESIFIK. Jangan bertele-tele.
2. Jika pengguna memilih "[Semua]" atau meminta dari semua kamus, WAJIB menampilkan rincian makna dari KEENAM kamus tersebut. Gunakan struktur bullet/nomor untuk tiap kamusnya (misal: "• Kamus Munawwir: ..."). Jika di salah satu kamus tidak ditemukan atau Anda tidak tahu, tulis "Tidak ditemukan" pada kamus tersebut.
3. Penerjemahan hanya dilakukan per kata (kecuali Kamus Al-Qur'an yang bisa potongan kalimat).
4. Jika istilah tidak ada di pangkalan data di atas, silakan gunakan pangkalan pengetahuan bahasa Arab Anda sendiri untuk menjelaskannya ke dalam format kamus-kamus tersebut.
5. Rekomendasi keyboard Arab: Gboard (Google Keyboard), pilih 'Bahasa Arab' di pengaturan.`;

      const response = await openai.chat.completions.create({
        model: "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: systemInstruction },
          ...chatHistory,
          { role: "user", content: promptMessage }
        ],
      });
      
      res.json({ text: response.choices[0]?.message?.content || "" });
      
    } catch (error: any) {
      console.error("AI Error:", error);
      res.status(500).json({ error: error.message || "Terjadi kesalahan saat memproses pesan." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static file serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
