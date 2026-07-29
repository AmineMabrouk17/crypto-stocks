"use client";

import { useMemo } from "react";

export function useVoterId(): string {
  return useMemo(() => {
    if (typeof window === "undefined") return "";
    const key = "prediction_voter_id";
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(key, id);
    return id;
  }, []);
}
