import { getTranslations } from "next-intl/server";
import { ProductScene } from "@/components/brand/scenes";

/** A product scene with its labels read from the messages. For server components; client pages pass labels to ProductScene directly. */
export async function SceneArt({ name, title }: { name: string; title: string }) {
  const labels = (await getTranslations("scenes")).raw(name) as string[];
  return <ProductScene name={name} labels={labels} title={title} />;
}
