import Link from "next/link";
import { buttonStyles } from "@/components/ui/button-styles";
import { ChipScene } from "@/components/gpu/chip-art";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 py-12 text-center sm:flex-row sm:text-left">
      <ChipScene phase="off" size={170} fieldWidth={320} fieldHeight={300} perSide={6} label="404" className="shrink-0" />
      <div>
        <p className="font-mono text-sm text-critical">RuntimeError: CUDA error: page not found (404)</p>
        <h1 className="mt-2 font-serif text-4xl text-ink">This address ran out of memory</h1>
        <p className="mt-3 text-ink-2">
          There&apos;s no screen here. Unlike a training run, it can&apos;t resume from a checkpoint, so pick somewhere else.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3 sm:justify-start">
          <Link href="/dashboard" className={buttonStyles("primary")}>
            Go to Mission control
          </Link>
          <Link href="/help" className={buttonStyles("secondary")}>
            Get help
          </Link>
        </div>
      </div>
    </div>
  );
}
