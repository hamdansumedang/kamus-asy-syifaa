import express from "express";
import { createServer as createViteServer } from "vite";
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
