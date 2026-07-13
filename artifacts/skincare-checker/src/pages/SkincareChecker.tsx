import { useState, useRef, useEffect } from "react";
import { matchToxicIngredients, type AnalysisResult } from "../lib/ingredients";

// ─── Provider Abstraction Layer ───────────────────────────────────────────────
const OpenBeautyFactsAdapter = {
  name: "Open Beauty Facts",
  async search(query: string) {
    const url = `https://world.openbeautyfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=5`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Open Beauty Facts request failed");
    const data = await res.json() as { products?: Array<{ product_name?: string; ingredients_text?: string; ingredients_text_en?: string; image_url?: string }> };
    const product = data.products?.[0];
    if (!product) return null;
    const raw = product.ingredients_text || product.ingredients_text_en || "";
    return {
      productName: product.product_name || query,
      ingredients: raw,
      image: product.image_url || null,
    };
  },
};

const ACTIVE_PROVIDER = OpenBeautyFactsAdapter;

// ─── localStorage Cache ───────────────────────────────────────────────────────
const CACHE_PREFIX = "skincare_v1_";

function cacheGet(key: string) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key.toLowerCase().trim());
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function cacheSet(key: string, value: unknown) {
  try {
    localStorage.setItem(CACHE_PREFIX + key.toLowerCase().trim(), JSON.stringify(value));
  } catch {
    // localStorage full or unavailable — fail silently
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500&display=swap');

  .app * { box-sizing: border-box; }

  .app {
    min-height: 100vh;
    font-family: 'DM Sans', sans-serif;
    color: #2C2C2C;
    background:
      radial-gradient(ellipse at 10% 20%, rgba(242,196,196,0.35) 0%, transparent 50%),
      radial-gradient(ellipse at 90% 80%, rgba(181,201,181,0.3) 0%, transparent 50%),
      radial-gradient(ellipse at 60% 10%, rgba(212,115,122,0.12) 0%, transparent 40%),
      #FAF6F1;
  }

  .app .hero { text-align: center; padding: 64px 24px 40px; }
  .app .hero-eyebrow { font-weight: 300; font-size: 11px; letter-spacing: 0.25em; text-transform: uppercase; color: #D4737A; margin-bottom: 16px; }
  .app .hero-title { font-family: 'Playfair Display', serif; font-size: clamp(2.4rem, 6vw, 4rem); font-weight: 600; line-height: 1.1; color: #2C2C2C; }
  .app .hero-title em { font-style: italic; color: #D4737A; }
  .app .hero-sub { font-size: 15px; color: #7A7A7A; font-weight: 300; margin-top: 12px; max-width: 400px; margin-left: auto; margin-right: auto; line-height: 1.6; }
  .app .hero-sub a { color: #D4737A; text-decoration: none; }
  .app .hero-sub a:hover { text-decoration: underline; }

  .app .search-card { max-width: 560px; margin: 0 auto 16px; padding: 0 20px; }

  .app .input-group {
    background: rgba(255,255,255,0.82);
    border: 1px solid rgba(212,115,122,0.2);
    border-radius: 20px;
    padding: 8px 8px 8px 24px;
    display: flex; align-items: center; gap: 12px;
    box-shadow: 0 4px 24px rgba(212,115,122,0.08), 0 1px 3px rgba(0,0,0,0.04);
    backdrop-filter: blur(8px);
    transition: box-shadow 0.2s, border-color 0.2s;
  }
  .app .input-group:focus-within { box-shadow: 0 4px 32px rgba(212,115,122,0.18); border-color: rgba(212,115,122,0.45); }

  .app .search-input { flex: 1; border: none; outline: none; background: transparent; font-family: 'DM Sans', sans-serif; font-size: 15px; color: #2C2C2C; }
  .app .search-input::placeholder { color: #BBADA5; }

  .app .search-btn {
    background: linear-gradient(135deg, #D4737A, #C45E65);
    color: white; border: none; border-radius: 14px; padding: 12px 24px;
    font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500;
    cursor: pointer; transition: opacity 0.2s, transform 0.15s; white-space: nowrap;
  }
  .app .search-btn:hover { opacity: 0.9; transform: translateY(-1px); }
  .app .search-btn:disabled { opacity: 0.5; cursor: default; transform: none; }

  .app .fallback-pills { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 14px; }

  .app .pill-btn {
    background: rgba(255,255,255,0.7); border: 1px solid rgba(212,115,122,0.25);
    border-radius: 100px; padding: 8px 16px;
    font-family: 'DM Sans', sans-serif; font-size: 12px; color: #D4737A;
    cursor: pointer; transition: all 0.2s; backdrop-filter: blur(4px);
  }
  .app .pill-btn:hover { background: rgba(242,196,196,0.4); border-color: #D4737A; }

  .app .disclaimer {
    max-width: 480px; margin: 20px auto 0; padding: 0 20px;
    text-align: center; font-size: 11.5px; color: #7A7A7A;
    line-height: 1.6; font-weight: 300;
  }

  .app .cache-badge {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 10px; color: #5A9E6F; background: rgba(90,158,111,0.08);
    border: 1px solid rgba(90,158,111,0.2); border-radius: 100px; padding: 3px 9px;
    margin-left: 8px; vertical-align: middle;
  }

  .app .fallback-area { max-width: 560px; margin: 0 auto 20px; padding: 0 20px; }

  .app .fallback-card {
    background: rgba(255,255,255,0.82); border: 1.5px dashed rgba(212,115,122,0.3);
    border-radius: 16px; padding: 20px; backdrop-filter: blur(8px);
  }
  .app .fallback-label { font-size: 11px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: #D4737A; margin-bottom: 10px; }

  .app .drop-zone {
    border: 2px dashed rgba(212,115,122,0.35); border-radius: 12px; padding: 32px;
    text-align: center; cursor: pointer; transition: all 0.2s; color: #7A7A7A; font-size: 14px;
  }
  .app .drop-zone:hover { background: rgba(242,196,196,0.15); border-color: #D4737A; }
  .app .drop-icon { font-size: 28px; margin-bottom: 8px; }

  .app .textarea-input {
    width: 100%; border: 1px solid rgba(212,115,122,0.2); border-radius: 12px;
    padding: 14px 16px; font-family: 'DM Sans', sans-serif; font-size: 13px;
    color: #2C2C2C; background: rgba(255,255,255,0.7); resize: vertical;
    min-height: 100px; outline: none; line-height: 1.6; transition: border-color 0.2s;
  }
  .app .textarea-input:focus { border-color: rgba(212,115,122,0.5); }

  .app .analyze-btn {
    margin-top: 10px; width: 100%;
    background: linear-gradient(135deg, #D4737A, #C45E65);
    color: white; border: none; border-radius: 12px; padding: 13px;
    font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500;
    cursor: pointer; transition: opacity 0.2s;
  }
  .app .analyze-btn:hover { opacity: 0.9; }
  .app .analyze-btn:disabled { opacity: 0.5; cursor: default; }

  .app .results-area { max-width: 700px; margin: 0 auto 48px; padding: 0 20px; animation: skc-fadeUp 0.4s ease; }
  @keyframes skc-fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }

  .app .product-header {
    display: flex; align-items: center; gap: 16px;
    background: rgba(255,255,255,0.82); border-radius: 20px; padding: 20px 24px;
    margin-bottom: 16px; box-shadow: 0 2px 16px rgba(0,0,0,0.05);
    backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.8);
  }
  .app .product-image { width: 64px; height: 64px; border-radius: 12px; object-fit: cover; flex-shrink: 0; }
  .app .product-image-placeholder {
    width: 64px; height: 64px; border-radius: 12px; flex-shrink: 0;
    background: linear-gradient(135deg, #F2C4C4, rgba(181,201,181,0.5));
    display: flex; align-items: center; justify-content: center; font-size: 24px;
  }
  .app .product-info h2 { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 600; margin-bottom: 4px; }
  .app .product-info p { font-size: 13px; color: #7A7A7A; }
  .app .source-badge {
    display: inline-flex; align-items: center; gap: 5px; font-size: 11px;
    color: #7A7A7A; background: rgba(0,0,0,0.04); border-radius: 100px; padding: 4px 10px; margin-top: 6px;
  }

  .app .score-bar { display: flex; gap: 12px; margin-bottom: 16px; }
  .app .score-chip { flex: 1; border-radius: 16px; padding: 16px 20px; text-align: center; backdrop-filter: blur(8px); }
  .app .score-chip.flagged { background: rgba(192,71,78,0.08); border: 1px solid rgba(192,71,78,0.2); }
  .app .score-chip.safe { background: rgba(90,158,111,0.08); border: 1px solid rgba(90,158,111,0.2); }
  .app .score-chip .num { font-family: 'Playfair Display', serif; font-size: 2rem; font-weight: 600; display: block; line-height: 1; margin-bottom: 4px; }
  .app .score-chip.flagged .num { color: #C0474E; }
  .app .score-chip.safe .num { color: #5A9E6F; }
  .app .score-chip .label { font-size: 11px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: #7A7A7A; }

  .app .flagged-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
  .app .section-title { font-family: 'Playfair Display', serif; font-size: 16px; margin-bottom: 10px; color: #2C2C2C; }

  .app .flagged-item {
    background: rgba(255,255,255,0.82); border: 1px solid rgba(192,71,78,0.15);
    border-left: 3px solid #C0474E; border-radius: 12px; padding: 14px 16px;
    backdrop-filter: blur(8px); box-shadow: 0 1px 8px rgba(192,71,78,0.06);
  }
  .app .flagged-item .ing-name { font-weight: 500; font-size: 14px; margin-bottom: 3px; }
  .app .flagged-item .matched { font-size: 11px; font-weight: 500; color: #C0474E; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 3px; }
  .app .flagged-item .concern-text { font-size: 12px; color: #7A7A7A; }

  .app .all-ingredients {
    background: rgba(255,255,255,0.82); border-radius: 16px; padding: 18px 20px;
    border: 1px solid rgba(255,255,255,0.8); box-shadow: 0 2px 12px rgba(0,0,0,0.04); backdrop-filter: blur(8px);
  }
  .app .ing-pills { display: flex; flex-wrap: wrap; gap: 7px; }
  .app .ing-pill { font-size: 12px; padding: 5px 11px; border-radius: 100px; }
  .app .ing-pill.toxic { background: rgba(192,71,78,0.1); color: #C0474E; border: 1px solid rgba(192,71,78,0.25); }
  .app .ing-pill.ok { background: rgba(255,255,255,0.7); color: #666; border: 1px solid rgba(0,0,0,0.08); }

  .app .all-clear {
    background: rgba(90,158,111,0.08); border: 1px solid rgba(90,158,111,0.2);
    border-radius: 14px; padding: 18px 20px; text-align: center; margin-bottom: 20px;
    color: #5A9E6F; font-weight: 500; font-size: 15px;
  }

  .app .error-msg {
    background: rgba(192,71,78,0.06); border: 1px solid rgba(192,71,78,0.2);
    border-radius: 12px; padding: 14px 18px; color: #C0474E; font-size: 14px; margin-bottom: 16px;
  }

  .app .loading { text-align: center; padding: 48px 20px; color: #7A7A7A; }
  .app .spinner { width: 36px; height: 36px; border: 3px solid rgba(212,115,122,0.2); border-top-color: #D4737A; border-radius: 50%; animation: skc-spin 0.8s linear infinite; margin: 0 auto 14px; }
  @keyframes skc-spin { to { transform: rotate(360deg); } }
  .app .loading-text { font-family: 'Playfair Display', serif; font-style: italic; font-size: 15px; }

  .app .reset-btn {
    display: block; margin: 0 auto 20px; background: none;
    border: 1px solid rgba(212,115,122,0.3); border-radius: 100px; padding: 9px 20px;
    font-family: 'DM Sans', sans-serif; font-size: 13px; color: #D4737A;
    cursor: pointer; transition: all 0.2s;
  }
  .app .reset-btn:hover { background: rgba(242,196,196,0.2); }

  .app .divider { text-align: center; font-size: 11px; color: #CCC; letter-spacing: 0.1em; text-transform: uppercase; margin: 12px 0; }

  .app .empty-state { text-align: center; padding: 40px 20px; color: #7A7A7A; font-size: 14px; background: rgba(255,255,255,0.82); border-radius: 16px; border: 1px solid rgba(255,255,255,0.8); }
  .app .empty-state .icon { font-size: 32px; margin-bottom: 10px; }

  .app .settings-bar {
    max-width: 560px; margin: 0 auto 6px; padding: 0 20px;
    display: flex; justify-content: flex-end;
  }
  .app .settings-toggle {
    background: none; border: none; padding: 4px 8px;
    font-family: 'DM Sans', sans-serif; font-size: 12px; color: #BBADA5;
    cursor: pointer; display: flex; align-items: center; gap: 5px;
    transition: color 0.2s; border-radius: 8px;
  }
  .app .settings-toggle:hover { color: #D4737A; }
  .app .settings-toggle.active { color: #5A9E6F; }

  .app .settings-card {
    max-width: 560px; margin: 0 auto 16px; padding: 0 20px;
  }
  .app .settings-inner {
    background: rgba(255,255,255,0.82); border: 1px solid rgba(212,115,122,0.18);
    border-radius: 16px; padding: 18px 20px; backdrop-filter: blur(8px);
  }
  .app .settings-label {
    font-size: 11px; font-weight: 500; letter-spacing: 0.1em;
    text-transform: uppercase; color: #D4737A; margin-bottom: 6px;
  }
  .app .settings-desc {
    font-size: 12px; color: #7A7A7A; line-height: 1.5; margin-bottom: 12px;
  }
  .app .settings-desc a { color: #D4737A; text-decoration: none; }
  .app .settings-desc a:hover { text-decoration: underline; }
  .app .settings-row { display: flex; gap: 8px; align-items: center; }
  .app .settings-input {
    flex: 1; border: 1px solid rgba(212,115,122,0.2); border-radius: 10px;
    padding: 9px 13px; font-family: 'DM Sans', sans-serif; font-size: 13px;
    color: #2C2C2C; background: rgba(255,255,255,0.7); outline: none;
    transition: border-color 0.2s;
  }
  .app .settings-input:focus { border-color: rgba(212,115,122,0.5); }
  .app .settings-save {
    background: linear-gradient(135deg, #D4737A, #C45E65); color: white;
    border: none; border-radius: 10px; padding: 9px 16px;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500;
    cursor: pointer; transition: opacity 0.2s; white-space: nowrap;
  }
  .app .settings-save:hover { opacity: 0.9; }
  .app .settings-clear {
    background: none; border: 1px solid rgba(212,115,122,0.25); border-radius: 10px;
    padding: 9px 12px; font-family: 'DM Sans', sans-serif; font-size: 12px;
    color: #D4737A; cursor: pointer; transition: all 0.2s; white-space: nowrap;
  }
  .app .settings-clear:hover { background: rgba(242,196,196,0.2); }
  .app .settings-status {
    margin-top: 10px; font-size: 12px; display: flex; align-items: center; gap: 6px;
  }
  .app .settings-status.ok { color: #5A9E6F; }
  .app .settings-status.none { color: #BBADA5; }
`;

interface ProductMeta {
  productName: string;
  image: string | null;
}

interface AnalysisResultWithSource extends AnalysisResult {
  source: string;
}

const GOOGLE_KEY_STORAGE = "zerotox_google_api_key";

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function SkincareChecker() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [results, setResults] = useState<AnalysisResultWithSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showImageFallback, setShowImageFallback] = useState(false);
  const [showTextFallback, setShowTextFallback] = useState(false);
  const [manualText, setManualText] = useState("");
  const [productMeta, setProductMeta] = useState<ProductMeta | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Google API key (persisted in localStorage) ─────────────────────────────
  const [googleApiKey, setGoogleApiKey] = useState<string>("");
  const [googleApiKeyDraft, setGoogleApiKeyDraft] = useState<string>("");
  const [showSettings, setShowSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(GOOGLE_KEY_STORAGE) || "";
    setGoogleApiKey(stored);
    setGoogleApiKeyDraft(stored);
  }, []);

  const saveGoogleKey = () => {
    const trimmed = googleApiKeyDraft.trim();
    localStorage.setItem(GOOGLE_KEY_STORAGE, trimmed);
    setGoogleApiKey(trimmed);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  };

  const clearGoogleKey = () => {
    localStorage.removeItem(GOOGLE_KEY_STORAGE);
    setGoogleApiKey("");
    setGoogleApiKeyDraft("");
  };

  const reset = () => {
    setResults(null); setError(null);
    setShowImageFallback(false); setShowTextFallback(false);
    setManualText(""); setProductMeta(null);
    setFromCache(false); setQuery("");
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true); setError(null); setResults(null); setProductMeta(null); setFromCache(false);

    try {
      const cacheKey = query.trim();

      // ── 1. Check localStorage cache first ──
      const cached = cacheGet(cacheKey);
      if (cached) {
        setProductMeta(cached.productMeta);
        setResults(cached.results);
        setFromCache(true);
        setLoading(false);
        return;
      }

      // ── 2. Fetch from provider ──
      setLoadingMsg(`Searching ${ACTIVE_PROVIDER.name}…`);
      const product = await ACTIVE_PROVIDER.search(cacheKey);

      if (!product || !product.ingredients) {
        setError("Product not found. Try uploading a photo of the label or paste the ingredients manually.");
        setShowImageFallback(true);
        setLoading(false);
        return;
      }

      // ── 3. JS matching — no API call ──
      const analysis = matchToxicIngredients(product.ingredients);
      const finalResults: AnalysisResultWithSource = { ...analysis, source: ACTIVE_PROVIDER.name };

      setProductMeta(product);
      setResults(finalResults);

      // ── 4. Persist to cache ──
      cacheSet(cacheKey, { productMeta: product, results: finalResults });

    } catch (e) {
      setError("Something went wrong: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!file) return;
    setLoading(true); setError(null); setResults(null); setFromCache(false);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      const [header, base64] = dataUrl.split(",");
      const mediaType = header.match(/data:([^;]+);/)?.[1] ?? "image/jpeg";
      try {
        const useGemini = !!googleApiKey;
        if (useGemini) {
          setLoadingMsg("Reading label with Google Gemini Vision…");
          const res = await fetch("/api/gemini", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageBase64: base64, mediaType, googleApiKey }),
          });
          const data = await res.json() as { ingredientsText?: string; error?: string };
          if (!res.ok) throw new Error(data.error || "Gemini OCR failed");
          if (!data.ingredientsText) throw new Error("Couldn't extract ingredients. Try a clearer photo.");
          const analysis = matchToxicIngredients(data.ingredientsText);
          setProductMeta({ productName: query || "Scanned Product", image: null });
          setResults({ ...analysis, source: "Google Gemini Vision (OCR)" });
        } else {
          setLoadingMsg("Reading label with Claude Vision…");
          const res = await fetch("/api/claude", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageBase64: base64, mediaType }),
          });
          const data = await res.json() as { ingredientsText?: string; error?: string };
          if (!res.ok) throw new Error(data.error || "OCR failed");
          if (!data.ingredientsText) throw new Error("Couldn't extract ingredients. Try a clearer photo.");
          const analysis = matchToxicIngredients(data.ingredientsText);
          setProductMeta({ productName: query || "Scanned Product", image: null });
          setResults({ ...analysis, source: "Claude Vision (OCR)" });
        }
      } catch (err) {
        setError("Couldn't analyze image: " + (err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleManualAnalyze = () => {
    if (!manualText.trim()) return;
    const analysis = matchToxicIngredients(manualText);
    setProductMeta({ productName: query || "Manual Entry", image: null });
    setResults({ ...analysis, source: "Manual entry" });
    setFromCache(false);
  };

  const toxicIngNames = results?.flagged?.map(f => f.ingredient_found?.toLowerCase()) || [];

  return (
    <>
      <style>{styles}</style>
      <div className="app">

        {/* ── Hero ── */}
        <div className="hero">
          <div className="hero-eyebrow">Skincare Safety Scanner</div>
          <h1 className="hero-title">Know what's <em>really</em><br />in the skincare products you use</h1>
          <p className="hero-sub">This app searches for your product in the <a href="https://www.openbeautyfacts.org/" target="_blank" rel="noopener noreferrer">Open Beauty Facts</a> database and scans its ingredients against 25 high-concern chemicals cited by toxicologists and health researchers.</p>
        </div>

        {/* ── Search + Fallbacks ── */}
        {!results && !loading && (
          <>
            {/* ── Google API Key Settings ── */}
            <div className="settings-bar">
              <button
                className={`settings-toggle ${googleApiKey ? "active" : ""}`}
                onClick={() => setShowSettings(s => !s)}
              >
                {googleApiKey ? "🔑 Google AI connected" : "⚙️ Add Google API key"}
              </button>
            </div>

            {showSettings && (
              <div className="settings-card">
                <div className="settings-inner">
                  <div className="settings-label">🔑 Google AI API Key</div>
                  <p className="settings-desc">
                    Provide your own{" "}
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">
                      Google AI Studio API key
                    </a>{" "}
                    to use Google Gemini Vision for photo analysis. Your key is stored only in your browser and never sent to our servers — it is forwarded directly to Google when you upload a photo.
                  </p>
                  <div className="settings-row">
                    <input
                      className="settings-input"
                      type="password"
                      placeholder="AIza…"
                      value={googleApiKeyDraft}
                      onChange={e => setGoogleApiKeyDraft(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && saveGoogleKey()}
                    />
                    <button className="settings-save" onClick={saveGoogleKey}>
                      {settingsSaved ? "✓ Saved" : "Save"}
                    </button>
                    {googleApiKey && (
                      <button className="settings-clear" onClick={clearGoogleKey}>Remove</button>
                    )}
                  </div>
                  <div className={`settings-status ${googleApiKey ? "ok" : "none"}`}>
                    {googleApiKey
                      ? "✓ Google Gemini Vision will be used when you upload a photo"
                      : "No key set — photo analysis will use the server's Claude Vision"}
                  </div>
                </div>
              </div>
            )}

            <div className="search-card">
              <div className="input-group">
                <input
                  className="search-input"
                  placeholder="Search a product, e.g. CeraVe Moisturizing Cream…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSearch()}
                />
                <button className="search-btn" onClick={handleSearch} disabled={!query.trim()}>
                  Analyze
                </button>
              </div>

              <div className="fallback-pills">
                <button className="pill-btn" onClick={() => { setShowImageFallback(true); setShowTextFallback(false); }}>
                  📷 Upload photo instead
                </button>
                <button className="pill-btn" onClick={() => { setShowTextFallback(true); setShowImageFallback(false); }}>
                  ✏️ Paste ingredients
                </button>
              </div>
            </div>

            <p className="disclaimer">
              ⓘ This tool is for <strong>informational purposes only</strong> and does not constitute medical or dermatological advice.
              Ingredient safety is nuanced — concentrations, formulations, and individual sensitivities all matter.
              Always consult a dermatologist or healthcare professional with specific concerns.
            </p>

            {error && (
              <div className="fallback-area" style={{ marginTop: 20 }}>
                <div className="error-msg">{error}</div>
              </div>
            )}

            {showImageFallback && (
              <div className="fallback-area" style={{ marginTop: 16 }}>
                <div className="fallback-card">
                  <div className="fallback-label">📷 Upload product label</div>
                  <div
                    className="drop-zone"
                    onClick={() => fileRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleImageUpload(f); }}
                  >
                    <div className="drop-icon">🌿</div>
                    <div>Drop an image here or <strong>click to browse</strong></div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>JPG, PNG, WEBP</div>
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }} />
                  <div className="divider">or</div>
                  <button className="pill-btn" style={{ width: "100%", textAlign: "center" }} onClick={() => { setShowTextFallback(true); setShowImageFallback(false); }}>
                    ✏️ Paste ingredients manually instead
                  </button>
                </div>
              </div>
            )}

            {showTextFallback && (
              <div className="fallback-area" style={{ marginTop: 16 }}>
                <div className="fallback-card">
                  <div className="fallback-label">✏️ Paste ingredients list</div>
                  <textarea
                    className="textarea-input"
                    placeholder="Paste the full ingredients list here, e.g. Aqua, Glycerin, Cetearyl Alcohol, Dimethicone…"
                    value={manualText}
                    onChange={e => setManualText(e.target.value)}
                  />
                  <button className="analyze-btn" onClick={handleManualAnalyze} disabled={!manualText.trim()}>
                    Analyze Ingredients
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="loading">
            <div className="spinner" />
            <div className="loading-text">{loadingMsg}</div>
          </div>
        )}

        {/* ── Results ── */}
        {results && !loading && (
          <div className="results-area">
            <button className="reset-btn" onClick={reset}>← New search</button>

            {productMeta && (
              <div className="product-header">
                {productMeta.image
                  ? <img className="product-image" src={productMeta.image} alt={productMeta.productName} />
                  : <div className="product-image-placeholder">🌸</div>
                }
                <div className="product-info">
                  <h2>{productMeta.productName}</h2>
                  <p>{results.total_count} ingredients analyzed</p>
                  <span className="source-badge">
                    via {results.source}
                    {fromCache && <span className="cache-badge">⚡ cached</span>}
                  </span>
                </div>
              </div>
            )}

            <div className="score-bar">
              <div className="score-chip flagged">
                <span className="num">{results.flagged?.length || 0}</span>
                <span className="label">Flagged</span>
              </div>
              <div className="score-chip safe">
                <span className="num">{Math.max(0, (results.total_count || 0) - (results.flagged?.length || 0))}</span>
                <span className="label">Clear</span>
              </div>
            </div>

            {results.flagged?.length === 0 && (
              <div className="all-clear">✓ No high-concern ingredients detected</div>
            )}

            {results.flagged?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h3 className="section-title">⚠️ High-Concern Ingredients Found</h3>
                <div className="flagged-list">
                  {results.flagged.map((f, i) => (
                    <div className="flagged-item" key={i}>
                      <div className="ing-name">{f.ingredient_found}</div>
                      <div className="matched">{f.matched_concern}</div>
                      <div className="concern-text">{f.concern}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {results.extracted_ingredients?.length > 0 && (
              <div className="all-ingredients">
                <h3 className="section-title" style={{ marginBottom: 12 }}>All Ingredients</h3>
                <div className="ing-pills">
                  {results.extracted_ingredients.map((ing, i) => {
                    const isToxic = toxicIngNames.some(t => ing.toLowerCase().includes(t) || t.includes(ing.toLowerCase()));
                    return <span key={i} className={`ing-pill ${isToxic ? "toxic" : "ok"}`}>{ing}</span>;
                  })}
                </div>
              </div>
            )}

            {!results.extracted_ingredients?.length && (
              <div className="empty-state">
                <div className="icon">🌿</div>
                <div>No ingredients could be extracted. Try uploading a clearer image or pasting manually.</div>
              </div>
            )}
          </div>
        )}

      </div>
    </>
  );
}
