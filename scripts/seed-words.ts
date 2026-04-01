#!/usr/bin/env tsx
/**
 * Seed Pictionary words from a JSON file into the game_words table.
 *
 * Usage:
 *   pnpm seed-words                          # seeds data/large-data.json
 *   pnpm seed-words data/pictionary-terms.json
 *   pnpm seed-words data/added-terms.json
 *
 * Accepted JSON formats:
 *
 *   Format A — categories with arrays of terms per difficulty (large-data.json):
 *   {
 *     "categories": [
 *       { "category": "Movies & TV", "items": { "easy": ["Shark", ...], "medium": [...], ... } }
 *     ]
 *   }
 *
 *   Format B — categories with a single term per difficulty (pictionary-terms.json):
 *   {
 *     "categories": [
 *       { "category": "Movies & TV", "items": { "easy": "Shark", "medium": "Drive-through..." } }
 *     ]
 *   }
 *
 * Both formats can be mixed in the same file.
 * Duplicate (game_slug, word) pairs are silently ignored (ON CONFLICT DO NOTHING).
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// ── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in environment.\n" +
      "Run: source .env.local && pnpm seed-words",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Difficulty → point value map ─────────────────────────────────────────────

const POINT_VALUES: Record<string, number> = {
  easy: 50,
  medium: 100,
  hard: 200,
  very_hard: 300,
  extra_challenge: 500,
};

const VALID_DIFFICULTIES = new Set(Object.keys(POINT_VALUES));

// ── Types ────────────────────────────────────────────────────────────────────

interface WordRow {
  game_slug: string;
  word: string;
  difficulty: string;
  category: string;
  point_value: number;
}

interface JsonCategory {
  category: string;
  items: Record<string, string | string[]>;
}

interface JsonFile {
  categories: JsonCategory[];
}

// ── Parse ────────────────────────────────────────────────────────────────────

function parseFile(filePath: string): WordRow[] {
  const raw = readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw) as JsonFile;

  if (!data.categories || !Array.isArray(data.categories)) {
    throw new Error('JSON must have a "categories" array at the top level.');
  }

  const rows: WordRow[] = [];
  const seen = new Set<string>(); // dedupe within the file itself

  for (const cat of data.categories) {
    const category = cat.category?.trim();
    if (!category) {
      console.warn("  Skipping category with no name:", cat);
      continue;
    }

    for (const [rawDiff, terms] of Object.entries(cat.items ?? {})) {
      const difficulty = rawDiff.trim().toLowerCase();

      if (!VALID_DIFFICULTIES.has(difficulty)) {
        console.warn(
          `  Unknown difficulty "${rawDiff}" in category "${category}" — skipping.`,
        );
        continue;
      }

      const wordList: string[] = Array.isArray(terms)
        ? terms
        : typeof terms === "string" && terms.trim()
          ? [terms.trim()]
          : [];

      for (const raw of wordList) {
        const word = raw.trim();
        if (!word) continue;

        const key = `${word.toLowerCase()}`;
        if (seen.has(key)) {
          console.warn(`  Duplicate within file, skipping: "${word}"`);
          continue;
        }
        seen.add(key);

        rows.push({
          game_slug: "pictionary",
          word,
          difficulty,
          category,
          point_value: POINT_VALUES[difficulty],
        });
      }
    }
  }

  return rows;
}

// ── Upsert ───────────────────────────────────────────────────────────────────

const BATCH_SIZE = 200;

async function upsertBatch(batch: WordRow[]): Promise<{ inserted: number; skipped: number }> {
  const { data, error } = await supabase
    .from("game_words")
    .upsert(batch, {
      onConflict: "game_slug,word",
      ignoreDuplicates: true,
    })
    .select("id");

  if (error) throw new Error(`Supabase error: ${error.message}`);

  const inserted = data?.length ?? 0;
  const skipped = batch.length - inserted;
  return { inserted, skipped };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const filePath = resolve(process.argv[2] ?? "data/large-data.json");
  console.log(`\nSeeding from: ${filePath}\n`);

  let rows: WordRow[];
  try {
    rows = parseFile(filePath);
  } catch (err) {
    console.error("Failed to parse file:", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  console.log(`Parsed ${rows.length} word rows across difficulties:`);
  const byDiff: Record<string, number> = {};
  const byCat = new Set<string>();
  for (const r of rows) {
    byDiff[r.difficulty] = (byDiff[r.difficulty] ?? 0) + 1;
    byCat.add(r.category);
  }
  for (const [diff, count] of Object.entries(byDiff)) {
    console.log(`  ${diff.padEnd(18)} ${count} words  (${POINT_VALUES[diff]} pts each)`);
  }
  console.log(`  ${byCat.size} unique categories\n`);

  let totalInserted = 0;
  let totalSkipped = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { inserted, skipped } = await upsertBatch(batch);
    totalInserted += inserted;
    totalSkipped += skipped;
    process.stdout.write(
      `  Batch ${Math.ceil((i + 1) / BATCH_SIZE)}/${Math.ceil(rows.length / BATCH_SIZE)}: +${inserted} inserted, ${skipped} already existed\r`,
    );
  }

  console.log(`\n\nDone!`);
  console.log(`  Inserted : ${totalInserted}`);
  console.log(`  Skipped  : ${totalSkipped} (already in DB)`);
  console.log(`  Total    : ${rows.length}\n`);
}

main().catch((err) => {
  console.error("\nUnexpected error:", err);
  process.exit(1);
});
