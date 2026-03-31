"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/utils/supabase/client";
import { WORD_LISTS } from "../constants";
import type { PictionaryDifficulty } from "../constants";

interface WordRecord {
  id: string;
  word: string;
  used_count: number;
  last_used_at: string | null;
}

interface UsePictionaryWordsOptions {
  difficulty: PictionaryDifficulty;
}

export function usePictionaryWords({ difficulty }: UsePictionaryWordsOptions) {
  const [words, setWords] = useState<WordRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const usedInSessionRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function fetchWords() {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("game_words")
        .select("id, word, used_count, last_used_at")
        .eq("game_slug", "pictionary")
        .eq("difficulty", difficulty)
        .order("used_count", { ascending: true })
        .order("last_used_at", { ascending: true, nullsFirst: true });

      if (!cancelled) {
        if (error || !data || data.length === 0) {
          // Fallback to local constants if DB is unavailable
          const fallback = WORD_LISTS[difficulty].map((w, i) => ({
            id: String(i),
            word: w,
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
    return () => {
      cancelled = true;
    };
  }, [difficulty]);

  const pickWord = useCallback((): string => {
    if (words.length === 0) {
      // Emergency fallback
      const list = WORD_LISTS[difficulty];
      return list[Math.floor(Math.random() * list.length)];
    }

    // Prefer words not used in this session, then least-used globally
    const notUsedThisSession = words.filter(
      (w) => !usedInSessionRef.current.has(w.id),
    );
    const pool = notUsedThisSession.length > 0 ? notUsedThisSession : words;

    // Pick from the least-used quartile to add variety
    const quartileSize = Math.max(1, Math.ceil(pool.length / 4));
    const quartile = pool.slice(0, quartileSize);
    const picked = quartile[Math.floor(Math.random() * quartile.length)];

    return picked.word;
  }, [words, difficulty]);

  const markWordUsed = useCallback(
    async (word: string) => {
      const record = words.find((w) => w.word === word);
      if (!record) return;

      usedInSessionRef.current.add(record.id);

      // Optimistically update local state
      setWords((prev) =>
        prev.map((w) =>
          w.id === record.id
            ? {
                ...w,
                used_count: w.used_count + 1,
                last_used_at: new Date().toISOString(),
              }
            : w,
        ),
      );

      // Persist to DB (fire and forget — not critical path)
      await supabase
        .from("game_words")
        .update({
          used_count: record.used_count + 1,
          last_used_at: new Date().toISOString(),
        })
        .eq("id", record.id);
    },
    [words],
  );

  const resetSessionUsage = useCallback(() => {
    usedInSessionRef.current = new Set();
  }, []);

  return {
    isLoading,
    pickWord,
    markWordUsed,
    resetSessionUsage,
    totalWords: words.length,
  };
}
