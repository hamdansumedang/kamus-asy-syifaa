import express from "express";
import { createServer as createViteServer } from "vite";
import OpenAI from "openai";
import path from "path";
import fs from "fs";
import Papa from "papaparse";

const SHEET_ID = "1Iu2-VyE2aQqG1NbKNm35auQm7K_v7W3D";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

let cachedSystemInstruction: string | null = null;
let lastCacheTime = 0;

async function getSystemInstruction() {
  const now = Date.now();
  if (cachedSystemInstruction && (now - lastCacheTime < 1000 * 60 * 60 * 12)) {
    return cachedSystemInstruction;
  }

  console.log("Fetching kamus data from Google Sheets...");
  const response = await fetch(CSV_URL);
  if (!response.ok) {
    throw new Error("Gagal mengambil data dari Google Sheets.");
  }
  const csvText = await response.text();
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  const kamusString = JSON.stringify(parsed.data);

  cachedSystemInstruction = `Anda adalah AI Agent "Kamus Asy-Syifaa" untuk Pondok Pesantren Asy-Syifaa Wal Mahmuudiyyah PT Rojo Bronto Lano.
Aplikasi ini menyediakan akses ke berbagai pangkalan data kamus:
1. Kamus Arab - Indonesia & Indonesia - Arab (Database Utama): 154.644 kosa kata.
2. Mu'jamul Arab (Kamus Arab - Arab): 29.803 mufrodat.
3. Kamus Almufid: Contoh kalimat, jama taksir, uslub (8.860 kosa kata).
4. Kamus Al-Qur'an & Ghoribul Qur'an: Pencarian ayat dan maknanya (6.236 & 6.111 entri).
5. Kamus Munawwir & Kamus Lisanul Arab.
6. Mu'jamul Ghoni & Mu'jamul Mu'ashiroh.

Data CSV Pangkalan Data (Informasi Struktur):
${kamusString}

Arahan Utama:
1. JAWABLAH DENGAN SPESIFIK DAN INFORMATIF. Jika pengguna mencari di tab "Semua", berikan hasil dari SEMUA sumber yang relevan (misal sebutkan arti di Kamus Arab-Indo DAN berikan ayat relevan dari Al-Qur'an jika ada).
2. Tuliskan nama kamus sumber di awal atau akhir jawaban jika hasil tersebut spesifik diambil dari pangkalan data tertentu.
3. Gunakan Bahasa Indonesia yang baik dan benar.
4. Jika istilah yang dicari ada di dalam pangkalan data, berikan maknanya secara lengkap namun tetap ringkas.
5. Jika istilah tidak ditemukan, beri tahu dengan sopan bahwa kata tersebut belum ada di database kamus kami.
6. Rekomendasi Gboard: Jika pengguna kesulitan input Arab, sarankan Gboard (Google Keyboard) dengan mengaktifkan bahasa Arab.`;

  lastCacheTime = now;
  console.log("Kamus data successfully fetched and cached.");
  return cachedSystemInstruction;
}

// Prefetch data on startup
getSystemInstruction().catch(console.error);

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

      const systemInstruction = await getSystemInstruction();

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
