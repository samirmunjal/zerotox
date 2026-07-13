// ─── Toxic Ingredients List ───────────────────────────────────────────────────
// Single source of truth — used by both the API route and client-side matching.

export const TOXIC_INGREDIENTS = [
  { name: "Parabens", aliases: ["methylparaben", "propylparaben", "butylparaben", "ethylparaben", "isobutylparaben"], concern: "Endocrine disruptor" },
  { name: "Formaldehyde", aliases: ["formaldehyde", "formalin", "methanal", "quaternium-15", "dmdm hydantoin", "imidazolidinyl urea", "diazolidinyl urea", "bronopol"], concern: "Carcinogen, allergen" },
  { name: "Phthalates", aliases: ["phthalate", "dehp", "dbp", "dep", "dibutyl phthalate", "diethyl phthalate"], concern: "Endocrine disruptor" },
  { name: "Sodium Lauryl Sulfate (SLS)", aliases: ["sodium lauryl sulfate", "sls", "sodium laureth sulfate", "sles"], concern: "Skin irritant, strips natural oils" },
  { name: "Oxybenzone", aliases: ["oxybenzone", "benzophenone-3"], concern: "Endocrine disruptor, coral reef damage" },
  { name: "Fragrance / Parfum", aliases: ["fragrance", "parfum", "perfume"], concern: "Undisclosed chemicals, allergens" },
  { name: "Triclosan", aliases: ["triclosan", "triclocarban"], concern: "Endocrine disruptor, antibiotic resistance" },
  { name: "BHA / BHT", aliases: ["bha", "bht", "butylated hydroxyanisole", "butylated hydroxytoluene"], concern: "Potential carcinogen, endocrine disruptor" },
  { name: "Coal Tar", aliases: ["coal tar", "coal tar dye", "p-phenylenediamine", "ci 77266"], concern: "Known carcinogen" },
  { name: "Hydroquinone", aliases: ["hydroquinone"], concern: "Linked to organ toxicity" },
  { name: "Petroleum / Petrolatum", aliases: ["petroleum", "petrolatum", "mineral oil", "paraffinum liquidum", "paraffin"], concern: "May be contaminated with carcinogens" },
  { name: "Siloxanes / Silicones", aliases: ["cyclotetrasiloxane", "cyclopentasiloxane", "cyclohexasiloxane", "d4", "d5", "d6"], concern: "Endocrine disruptor, environmental toxin" },
  { name: "Polyethylene Glycol (PEG)", aliases: ["peg-", "polyethylene glycol"], concern: "May contain carcinogenic contaminants" },
  { name: "Retinyl Palmitate", aliases: ["retinyl palmitate", "vitamin a palmitate"], concern: "May speed tumor development in sunlight" },
  { name: "Lead", aliases: ["lead acetate"], concern: "Neurotoxin" },
  { name: "Mercury", aliases: ["mercury", "thimerosal", "thiomersal", "mercuric chloride"], concern: "Neurotoxin, organ damage" },
  { name: "Aluminum compounds", aliases: ["aluminum chlorohydrate", "aluminum zirconium", "alum"], concern: "Possible links to breast cancer, Alzheimer's" },
  { name: "Styrene", aliases: ["styrene"], concern: "Possible carcinogen" },
  { name: "Toluene", aliases: ["toluene", "methylbenzene"], concern: "Neurotoxin, immune disruptor" },
  { name: "Ethanolamines (MEA/DEA/TEA)", aliases: ["diethanolamine", "dea", "triethanolamine", "monoethanolamine", "cocamide dea"], concern: "Carcinogen, hormone disruptor" },
  { name: "Talc", aliases: ["talc", "talcum"], concern: "Potential asbestos contamination" },
  { name: "Carbon Black", aliases: ["carbon black", "d&c black no. 2"], concern: "Possible carcinogen" },
  { name: "Resorcinol", aliases: ["resorcinol"], concern: "Endocrine disruptor, skin sensitizer" },
  { name: "Homosalate", aliases: ["homosalate", "4-aminophenol"], concern: "Endocrine disruptor" },
  { name: "Octinoxate", aliases: ["ethylhexyl methoxycinnamate", "octinoxate", "octyl methoxycinnamate"], concern: "Endocrine disruptor" },
];

// ─── Normalize ────────────────────────────────────────────────────────────────
function normalize(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9\-\s]/g, " ").replace(/\s+/g, " ").trim();
}

// ─── Parse raw ingredient string into individual tokens ───────────────────────
export function parseIngredients(raw: string): string[] {
  return raw
    .split(/[,\/•;\n]+/)
    .map(s => s.replace(/\(.*?\)/g, "").trim())
    .filter(s => s.length > 1);
}

export interface FlaggedIngredient {
  ingredient_found: string;
  matched_concern: string;
  concern: string;
}

export interface AnalysisResult {
  extracted_ingredients: string[];
  flagged: FlaggedIngredient[];
  total_count: number;
}

// ─── Cross-reference parsed ingredients against toxic list ────────────────────
export function matchToxicIngredients(ingredientsText: string): AnalysisResult {
  const parsed = parseIngredients(ingredientsText);
  const flagged: FlaggedIngredient[] = [];
  const seen = new Set<string>();

  for (const ingredient of parsed) {
    const normIng = normalize(ingredient);
    for (const toxic of TOXIC_INGREDIENTS) {
      if (seen.has(toxic.name)) continue;
      for (const alias of toxic.aliases) {
        const normAlias = normalize(alias);
        const pattern = new RegExp(`\\b${normAlias.replace(/[-]/g, "[-]?")}\\b`);
        if (pattern.test(normIng)) {
          flagged.push({
            ingredient_found: ingredient.trim(),
            matched_concern: toxic.name,
            concern: toxic.concern,
          });
          seen.add(toxic.name);
          break;
        }
      }
    }
  }

  return {
    extracted_ingredients: parsed,
    flagged,
    total_count: parsed.length,
  };
}
