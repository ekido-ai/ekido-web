import { getTranslations } from "next-intl/server";
import { buildProducts, buildSolutions } from "./products";

/** The product family with its text in the visitor's language, for server components. */
export async function getProducts() {
  const t = await getTranslations("products");
  return buildProducts((key) => t.raw(key));
}

export async function getSolutions() {
  const t = await getTranslations();
  return buildSolutions(t.raw("solutions"));
}
