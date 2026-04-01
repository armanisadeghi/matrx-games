"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/utils/supabase/client";
import { WORD_LISTS, DIFFICULTY_CONFIG } from "../constants";
import type { PictionaryDifficulty } from "../constants";
import type { PictionaryDifficultyLevel } from "../types";

interface WordRecord {
  id: string;
  word: string;
  difficulty: string;
  category: string;
  point_value: number;
  used_count: number;
  last_used_at: string | null;
}

export interface PickedWord {
  word: string;
  difficulty: PictionaryDifficultyLevel;
  category: string;
  pointValue: number;
}

interface UsePictionaryWordsOptions {
  difficulty: PictionaryDifficulty;
  categories?: string[];
}

export function usePictionaryWords({
  difficulty,
  categories = [],
}: UsePictionaryWordsOptions) {
  const [words, setWords] = useState<WordRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const usedInSessionRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function fetchWords() {
      setIsLoading(true);

      let query = supabase
        .from("game_words")
        .select("id, word, difficulty, category, point_value, used_count, last_used_at")
        .eq("game_slug", "pictionary")
        .order("used_count", { ascending: true })
        .order("last_used_at", { ascending: true, nullsFirst: true });

      if (difficulty !== "any") {
        query = query.eq("difficulty", difficulty);
      }

      if (categories.length > 0) {
        query = query.in("category", categories);
      }

      const { data, error } = await query;

      if (!cancelled) {
        if (error || !data || data.length === 0) {
          // Fallback to local word lists (no category or point_value data)
          const difficultyKey =
            difficulty === "any" || !(difficulty in WORD_LISTS)
              ? null
              : (difficulty as keyof typeof WORD_LISTS);
          const fallbackWords = difficultyKey
            ? WORD_LISTS[difficultyKey]
            : [...WORD_LISTS.easy, ...WORD_LISTS.medium, ...WORD_LISTS.hard];
          const fallback: WordRecord[] = fallbackWords.map((w, i) => ({
            id: String(i),
            word: w,
            difficulty: difficultyKey ?? "medium",
            category: "general",
            point_value: DIFFICULTY_CONFIG[difficultyKey ?? "medium"].points,
            used_count: 0,
            last_used_at: null,
          }));
          setWords(fallback);
        } else {
          setWords(data);
        }
        setIsLoading(false);
      }
    }

    fetchWords();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficulty, categories.join(",")]);

  // Pick from a specific difficulty tier (used when drawer chooses their difficulty)
  const pickWordByDifficulty = useCallback(
    (chosenDifficulty: PictionaryDifficultyLevel): PickedWord => {
      const usedIds = usedInSessionRef.current;

      // Filter to the requested difficulty
      const pool = words.filter(
        (w) => w.difficulty === chosenDifficulty && !usedIds.has(w.id),
      );
      // If all used this session, allow reuse from this difficulty
      const candidates =
        pool.length > 0
          ? pool
          : words.filter((w) => w.difficulty === chosenDifficulty);

      // If nothing in the DB for this difficulty, fall back to any word
      const finalPool =
        candidates.length > 0
          ? candidates
          : words.filter((w) => !usedIds.has(w.id));
      const finalCandidates = finalPool.length > 0 ? finalPool : words;

      // Sort by least-used then oldest
      finalCandidates.sort((a, b) => {
        if (a.used_count !== b.used_count) return a.used_count - b.used_count;
        if (!a.last_used_at && b.last_used_at) return -1;
        if (a.last_used_at && !b.last_used_at) return 1;
        if (a.last_used_at && b.last_used_at)
          return a.last_used_at < b.last_used_at ? -1 : 1;
        return 0;
      });

      const minCount = finalCandidates[0].used_count;
      const leastUsedTier = finalCandidates.filter(
        (w) => w.used_count === minCount,
      );
      const picked =
        leastUsedTier[Math.floor(Math.random() * leastUsedTier.length)];

      usedInSessionRef.current.add(picked.id);

      return {
        word: picked.word,
        difficulty: picked.difficulty as PictionaryDifficultyLevel,
        category: picked.category,
        pointValue: picked.point_value,
      };
    },
    [words],
  );

  // Pick any word (fallback when no difficulty selected)
  const pickWord = useCallback((): PickedWord => {
    const usedIds = usedInSessionRef.current;

    if (words.length === 0) {
      return {
        word: WORD_LISTS.medium[
          Math.floor(Math.random() * WORD_LISTS.medium.length)
        ],
        difficulty: "medium",
        category: "general",
        pointValue: DIFFICULTY_CONFIG.medium.points,
      };
    }

    const notUsedThisSession = words.filter((w) => !usedIds.has(w.id));
    const candidates = [...(notUsedThisSession.length > 0 ? notUsedThisSession : words)];

    candidates.sort((a, b) => {
      if (a.used_count !== b.used_count) return a.used_count - b.used_count;
      if (!a.last_used_at && b.last_used_at) return -1;
      if (a.last_used_at && !b.last_used_at) return 1;
      if (a.last_used_at && b.last_used_at)
        return a.last_used_at < b.last_used_at ? -1 : 1;
      return 0;
    });

    const minCount = candidates[0].used_count;
    const leastUsedTier = candidates.filter((w) => w.used_count === minCount);
    const picked =
      leastUsedTier[Math.floor(Math.random() * leastUsedTier.length)];

    usedInSessionRef.current.add(picked.id);

    return {
      word: picked.word,
      difficulty: picked.difficulty as PictionaryDifficultyLevel,
      category: picked.category,
      pointValue: picked.point_value,
    };
  }, [words]);

  const markWordUsed = useCallback(async (word: string) => {
    const now = new Date().toISOString();
    let recordId: string | null = null;

    setWords((prev) =>
      prev.map((w) => {
        if (w.word === word) {
          recordId = w.id;
          return { ...w, used_count: w.used_count + 1, last_used_at: now };
        }
        return w;
      }),
    );

    if (!recordId) return;

    await supabase.rpc("increment_word_used_count", {
      word_id: recordId,
      new_last_used_at: now,
    });
  }, []);

  const resetSessionUsage = useCallback(() => {
    usedInSessionRef.current = new Set();
  }, []);

  return {
    isLoading,
    pickWord,
    pickWordByDifficulty,
    markWordUsed,
    resetSessionUsage,
    totalWords: words.length,
  };
}
