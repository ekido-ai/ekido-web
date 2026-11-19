import { Download } from "lucide-react";
import { buttonStyles } from "@/components/ui/button-styles";
import { config } from "@/lib/config";

/**
 * After a live job passes and settles: the trained model as a zip (weights, manifest, workload and a script to try it),
 * served by the coordinator's GET /jobs/{id}/model. Shown on the local demo chain only; hidden in replay.
 */
export function DownloadModel({ jobId, jobState, live }: { jobId: string | null; jobState: string | null; live: boolean }) {
  // Local demo only: the hosted coordinator answers this route only from its own machine, so a public viewer would get an error.
  if (!config.localChain || config.hostedDemo || !live || !jobId || jobState !== "SETTLED") return null;
  return (
    <a href={`${config.coordinatorUrl}/jobs/${jobId}/model`} className={buttonStyles("secondary", "md")} download>
      <Download className="size-5" aria-hidden /> Download model
    </a>
  );
}
