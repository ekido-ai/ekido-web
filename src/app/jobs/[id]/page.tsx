import { Suspense } from "react";
import type { Metadata } from "next";
import { Panel } from "@/components/ui/panel";
import { SkeletonLines } from "@/components/ui/states";
import { JobView } from "@/components/train/job-view";

export const metadata: Metadata = { title: "Your model", robots: { index: false, follow: false } };

// A customer's own job, known only at request time: render it per request instead of prerendering a shell. The
// header reads the URL (usePathname), which a prerendered shell for an unknown id can't do (CLIENT_HOOK_DYNAMIC).
export const instant = false;

// The job id comes from the URL, which is request data: it has to be read inside a Suspense boundary (cacheComponents).
async function Job({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JobView jobId={id} />;
}

export default function JobPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-6">
      <Suspense fallback={<Panel><SkeletonLines lines={5} /></Panel>}>
        <Job params={params} />
      </Suspense>
    </div>
  );
}
