"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { buildProducts, buildSolutions } from "./products";

/** The product family with its text in the visitor's language, for client components. */
export function useProducts() {
  const t = useTranslations("products");
  return useMemo(() => buildProducts((key) => t.raw(key)), [t]);
}

export function useSolutions() {
  const t = useTranslations();
  return useMemo(() => buildSolutions(t.raw("solutions")), [t]);
}
