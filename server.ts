import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Papa from "papaparse";

const SHEET_ID = "1Iu2-VyE2aQqG1NbKNm35auQm7K_v7W3D";
const TABLE_NAMES = [
  "almufid",
  "arab_indo",
  "arab_indo2",
  "arabic_arabic2",
  "ghoribulquran",
  "mujamul_ghoni",
  "mujamul_muashiroh",
  "quran"
];

interface KamusEntry {
  source: string;
  arab?: string;
  indonesia?: string;
  word?: string;
  meaning?: string;
  arabic_word?: string;
  arabic_meanings?: string;
  [key: string]: any;
}

let kamusData: KamusEntry[] = [];
let isLoaded = false;
let isLoading = false;

async function loadKamusData() {
  if (isLoaded || isLoading) return;
  isLoading = true;
  console.log("Starting to load all kamus data...");
  const tempKamus: KamusEntry[] = [];
  
  for (const tableName of TABLE_NAMES) {
    try {
      console.log(`Fetching sheet: ${tableName}`);
      const response = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${tableName}`);
      if (!response.ok) throw new Error(`Failed to fetch ${tableName}`);
      
      const csvText = await response.text();
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
      
      const entries = parsed.data.map((row: any) => ({
        ...row,
        source: tableName
      }));
      
      tempKamus.push(...entries);
      console.log(`Loaded ${entries.length} entries from ${tableName}`);
    } catch (error) {
      console.error(`Error loading sheet ${tableName}:`, error);
    }
  }
  
  kamusData = tempKamus;
  isLoaded = true;
  isLoading = false;
  console.log(`Kamus data fully loaded. Total entries: ${kamusData.length}`);
}

// Prefetch data
loadKamusData().catch(console.error);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // Search API
  app.get("/api/search", (req, res) => {
    const { q, mode } = req.query;
    if (!q) return res.status(400).json({ error: "Query parameter 'q' is required" });
    
    if (!isLoaded && !isLoading) loadKamusData();

    const query = String(q).toLowerCase();
    const limit = 30; // Increased limit for better results
    
    let filtered = kamusData;
    if (mode && mode !== "all") {
      const sourceMap: Record<string, string[]> = {
        "arab-indo": ["arab_indo", "arab_indo2", "almufid"],
        "indo-arab": ["arab_indo", "arab_indo2", "almufid"],
        "munawwir": ["arab_indo", "arab_indo2"],
        "arab-arab": ["arabic_arabic2", "mujamul_ghoni"],
        "lisanul-arab": ["mujamul_ghoni", "mujamul_muashiroh"],
        "quran": ["quran", "ghoribulquran"],
        "almufid": ["almufid"]
      };
      
      const allowedSources = sourceMap[mode as string] || [];
      if (allowedSources.length > 0) {
        filtered = kamusData.filter(item => allowedSources.includes(item.source));
      }
    }

    const results = filtered.filter(item => {
      const searchFields = [
        item.arab, item.indonesia, item.word, item.meaning, 
        item.arabic_word, item.arabic_meanings, item.arabic_root,
        item.noharokah, item.dasar
      ];
      return searchFields.some(field => 
        field && String(field).toLowerCase().includes(query)
      );
    }).slice(0, limit);

    res.json({ results, isLoaded, total: filtered.length });
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", entries: kamusData.length, isLoaded });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
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
