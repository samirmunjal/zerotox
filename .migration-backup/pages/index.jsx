import { useState, useRef } from "react";
import { matchToxicIngredients } from "../lib/ingredients";

// ─── Provider Abstraction Layer ───────────────────────────────────────────────
// Each provider implements: search(query) => { productName, ingredients, image }
// Swap ACTIVE_PROVIDER to change data source — nothing else needs to change.

const OpenBeautyFactsAdapter = {
  name: "Open Beauty Facts",
  async search(query) {
    const url = `https://world.openbeautyfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=5`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Open Beauty Facts request failed");
    const data = await res.json();
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
// Keyed by lowercase product name. Persists until the user clears their browser.
const CACHE_PREFIX = "skincare_v1_";

function cacheGet(key) {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key.toLowerCase().trim());
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function cacheSet(key, value) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_PREFIX + key.toLowerCase().trim(), JSON.stringify(value));
  } catch {
    // localStorage full or unavailable — fail silently
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --blush: #F2C4C4;
    --rose: #D4737A;
    --sage: #B5C9B5;
    --cream: #FAF6F1;
    --charcoal: #2C2C2C;
    --mid: #7A7A7A;
    --safe-green: #5A9E6F;
    --warn-red: #C0474E;
    --card-bg: rgba(255,255,255,0.82);
  }

  body { font-family: 'DM Sans', sans-serif; background: var(--cream); min-height: 100vh; color: var(--charcoal); }

  .app {
    min-height: 100vh;
    background:
      radial-gradient(ellipse at 10% 20%, rgba(242,196,196,0.35) 0%, transparent 50%),
      radial-gradient(ellipse at 90% 80%, rgba(181,201,181,0.3) 0%, transparent 50%),
      radial-gradient(ellipse at 60% 10%, rgba(212,115,122,0.12) 0%, transparent 40%),
      var(--cream);
  }

  .hero { text-align: center; padding: 64px 24px 40px; }
  .hero-eyebrow { font-weight: 300; font-size: 11px; letter-spacing: 0.25em; text-transform: uppercase; color: var(--rose); margin-bottom: 16px; }
  .hero-title { font-family: 'Playfair Display', serif; font-size: clamp(2.4rem, 6vw, 4rem); font-weight: 600; line-height: 1.1; color: var(--charcoal); }
  .hero-title em { font-style: italic; color: var(--rose); }
  .hero-sub { font-size: 15px; color: var(--mid); font-weight: 300; margin-top: 12px; max-width: 400px; margin-left: auto; margin-right: auto; line-height: 1.6; }

  .search-card { max-width: 560px; margin: 0 auto 16px; padding: 0 20px; }

  .input-group {
    background: var(--card-bg);
    border: 1px solid rgba(212,115,122,0.2);
    border-radius: 20px;
    padding: 8px 8px 8px 24px;
    display: flex; align-items: center; gap: 12px;
    box-shadow: 0 4px 24px rgba(212,115,122,0.08), 0 1px 3px rgba(0,0,0,0.04);
    backdrop-filter: blur(8px);
    transition: box-shadow 0.2s, border-color 0.2s;
  }
  .input-group:focus-within { box-shadow: 0 4px 32px rgba(212,115,122,0.18); border-color: rgba(212,115,122,0.45); }

  .search-input { flex: 1; border: none; outline: none; background: transparent; font-family: 'DM Sans', sans-serif; font-size: 15px; color: var(--charcoal); }
  .search-input::placeholder { color: #BBADA5; }

  .search-btn {
    background: linear-gradient(135deg, var(--rose), #C45E65);
    color: white; border: none; border-radius: 14px; padding: 12px 24px;
    font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500;
    cursor: pointer; transition: opacity 0.2s, transform 0.15s; white-space: nowrap;
  }
  .search-btn:hover { opacity: 0.9; transform: translateY(-1px); }
  .search-btn:disabled { opacity: 0.5; cursor: default; transform: none; }

  .fallback-pills { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 14px; }

  .pill-btn {
    background: rgba(255,255,255,0.7); border: 1px solid rgba(212,115,122,0.25);
    border-radius: 100px; padding: 8px 16px;
    font-family: 'DM Sans', sans-serif; font-size: 12px; color: var(--rose);
    cursor: pointer; transition: all 0.2s; backdrop-filter: blur(4px);
  }
  .pill-btn:hover { background: rgba(242,196,196,0.4); border-color: var(--rose); }

  /* ── Disclaimer ── */
  .disclaimer {
    max-width: 480px; margin: 20px auto 0; padding: 0 20px;
    text-align: center; font-size: 11.5px; color: var(--mid);
    line-height: 1.6; font-weight: 300;
  }
  .disclaimer a { color: var(--rose); text-decoration: none; }
  .disclaimer a:hover { text-decoration: underline; }

  .cache-badge {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 10px; color: var(--safe-green); background: rgba(90,158,111,0.08);
    border: 1px solid rgba(90,158,111,0.2); border-radius: 100px; padding: 3px 9px;
    margin-left: 8px; vertical-align: middle;
  }

  .fallback-area { max-width: 560px; margin: 0 auto 20px; padding: 0 20px; }

  .fallback-card {
    background: var(--card-bg); border: 1.5px dashed rgba(212,115,122,0.3);
    border-radius: 16px; padding: 20px; backdrop-filter: blur(8px);
  }
  .fallback-label { font-size: 11px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: var(--rose); margin-bottom: 10px; }

  .drop-zone {
    border: 2px dashed rgba(212,115,122,0.35); border-radius: 12px; padding: 32px;
    text-align: center; cursor: pointer; transition: all 0.2s; color: var(--mid); font-size: 14px;
  }
  .drop-zone:hover { background: rgba(242,196,196,0.15); border-color: var(--rose); }
  .drop-icon { font-size: 28px; margin-bottom: 8px; }

  .textarea-input {
    width: 100%; border: 1px solid rgba(212,115,122,0.2); border-radius: 12px;
    padding: 14px 16px; font-family: 'DM Sans', sans-serif; font-size: 13px;
    color: var(--charcoal); background: rgba(255,255,255,0.7); resize: vertical;
    min-height: 100px; outline: none; line-height: 1.6; transition: border-color 0.2s;
  }
  .textarea-input:focus { border-color: rgba(212,115,122,0.5); }

  .analyze-btn {
    margin-top: 10px; width: 100%;
    background: linear-gradient(135deg, var(--rose), #C45E65);
    color: white; border: none; border-radius: 12px; padding: 13px;
    font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500;
    cursor: pointer; transition: opacity 0.2s;
  }
  .analyze-btn:hover { opacity: 0.9; }
  .analyze-btn:disabled { opacity: 0.5; cursor: default; }

  .results-area { max-width: 700px; margin: 0 auto 48px; padding: 0 20px; animation: fadeUp 0.4s ease; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }

  .product-header {
    display: flex; align-items: center; gap: 16px;
    background: var(--card-bg); border-radius: 20px; padding: 20px 24px;
    margin-bottom: 16px; box-shadow: 0 2px 16px rgba(0,0,0,0.05);
    backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.8);
  }
  .product-image { width: 64px; height: 64px; border-radius: 12px; object-fit: cover; flex-shrink: 0; }
  .product-image-placeholder {
    width: 64px; height: 64px; border-radius: 12px; flex-shrink: 0;
    background: linear-gradient(135deg, var(--blush), rgba(181,201,181,0.5));
    display: flex; align-items: center; justify-content: center; font-size: 24px;
  }
  .product-info h2 { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 600; margin-bottom: 4px; }
  .product-info p { font-size: 13px; color: var(--mid); }
  .source-badge {
    display: inline-flex; align-items: center; gap: 5px; font-size: 11px;
    color: var(--mid); background: rgba(0,0,0,0.04); border-radius: 100px; padding: 4px 10px; margin-top: 6px;
  }

  .score-bar { display: flex; gap: 12px; margin-bottom: 16px; }
  .score-chip { flex: 1; border-radius: 16px; padding: 16px 20px; text-align: center; backdrop-filter: blur(8px); }
  .score-chip.flagged { background: rgba(192,71,78,0.08); border: 1px solid rgba(192,71,78,0.2); }
  .score-chip.safe { background: rgba(90,158,111,0.08); border: 1px solid rgba(90,158,111,0.2); }
  .score-chip .num { font-family: 'Playfair Display', serif; font-size: 2rem; font-weight: 600; display: block; line-height: 1; margin-bottom: 4px; }
  .score-chip.flagged .num { color: var(--warn-red); }
  .score-chip.safe .num { color: var(--safe-green); }
  .score-chip .label { font-size: 11px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--mid); }

  .flagged-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
  .section-title { font-family: 'Playfair Display', serif; font-size: 16px; margin-bottom: 10px; color: var(--charcoal); }

  .flagged-item {
    background: var(--card-bg); border: 1px solid rgba(192,71,78,0.15);
    border-left: 3px solid var(--warn-red); border-radius: 12px; padding: 14px 16px;
    backdrop-filter: blur(8px); box-shadow: 0 1px 8px rgba(192,71,78,0.06);
  }
  .flagged-item .ing-name { font-weight: 500; font-size: 14px; margin-bottom: 3px; }
  .flagged-item .matched { font-size: 11px; font-weight: 500; color: var(--warn-red); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 3px; }
  .flagged-item .concern-text { font-size: 12px; color: var(--mid); }

  .all-ingredients {
    background: var(--card-bg); border-radius: 16px; padding: 18px 20px;
    border: 1px solid rgba(255,255,255,0.8); box-shadow: 0 2px 12px rgba(0,0,0,0.04); backdrop-filter: blur(8px);
  }
  .ing-pills { display: flex; flex-wrap: wrap; gap: 7px; }
  .ing-pill { font-size: 12px; padding: 5px 11px; border-radius: 100px; }
  .ing-pill.toxic { background: rgba(192,71,78,0.1); color: var(--warn-red); border: 1px solid rgba(192,71,78,0.25); }
  .ing-pill.ok { background: rgba(255,255,255,0.7); color: #666; border: 1px solid rgba(0,0,0,0.08); }

  .all-clear {
    background: rgba(90,158,111,0.08); border: 1px solid rgba(90,158,111,0.2);
    border-radius: 14px; padding: 18px 20px; text-align: center; margin-bottom: 20px;
    color: var(--safe-green); font-weight: 500; font-size: 15px;
  }

  .error-msg {
    background: rgba(192,71,78,0.06); border: 1px solid rgba(192,71,78,0.2);
    border-radius: 12px; padding: 14px 18px; color: var(--warn-red); font-size: 14px; margin-bottom: 16px;
  }

  .loading { text-align: center; padding: 48px 20px; color: var(--mid); }
  .spinner { width: 36px; height: 36px; border: 3px solid rgba(212,115,122,0.2); border-top-color: var(--rose); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 14px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loading-text { font-family: 'Playfair Display', serif; font-style: italic; font-size: 15px; }

  .reset-btn {
    display: block; margin: 0 auto 20px; background: none;
    border: 1px solid rgba(212,115,122,0.3); border-radius: 100px; padding: 9px 20px;
    font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--rose);
    cursor: pointer; transition: all 0.2s;
  }
  .reset-btn:hover { background: rgba(242,196,196,0.2); }

  .divider { text-align: center; font-size: 11px; color: #CCC; letter-spacing: 0.1em; text-transform: uppercase; margin: 12px 0; }

  .empty-state { text-align: center; padding: 40px 20px; color: var(--mid); font-size: 14px; background: var(--card-bg); border-radius: 16px; border: 1px solid rgba(255,255,255,0.8); }
  .empty-state .icon { font-size: 32px; margin-bottom: 10px; }
`;

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [showImageFallback, setShowImageFallback] = useState(false);
  const [showTextFallback, setShowTextFallback] = useState(false);
  const [manualText, setManualText] = useState("");
  const [productMeta, setProductMeta] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  const fileRef = useRef();

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
        setResults({ ...cached.results, source: cached.results.source });
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
      const finalResults = { ...analysis, source: ACTIVE_PROVIDER.name };

      setProductMeta(product);
      setResults(finalResults);

      // ── 4. Persist to cache ──
      cacheSet(cacheKey, { productMeta: product, results: finalResults });

    } catch (e) {
      setError("Something went wrong: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    setLoading(true); setError(null); setResults(null); setFromCache(false);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result.split(",")[1];
      try {
        // Claude used ONLY for OCR — call goes through our secure API route
        setLoadingMsg("Reading label with Claude Vision…");
        const res = await fetch("/api/claude", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64 }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "OCR failed");
        if (!data.ingredientsText) throw new Error("Couldn't extract ingredients. Try a clearer photo.");

        // JS matching takes over from here
        const analysis = matchToxicIngredients(data.ingredientsText);
        const meta = { productName: query || "Scanned Product", image: null };
        setProductMeta(meta);
        setResults({ ...analysis, source: "Claude Vision (OCR)" });
      } catch (err) {
        setError("Couldn't analyze image: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleManualAnalyze = () => {
    if (!manualText.trim()) return;
    // Pure JS — synchronous, zero API calls
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

            {/* ── Disclaimer ── */}
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
                    onDrop={e => { e.preventDefault(); handleImageUpload(e.dataTransfer.files[0]); }}
                  >
                    <div className="drop-icon">🌿</div>
                    <div>Drop an image here or <strong>click to browse</strong></div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>JPG, PNG, WEBP</div>
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleImageUpload(e.target.files[0])} />
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
