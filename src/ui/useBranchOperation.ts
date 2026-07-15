import { useRef, useState } from "preact/hooks";
import { errorMessage } from "./branchLaboratoryModel";
import type { RuntimeUniverseController } from "./useRuntimeUniverseModel";

export function useBranchOperation(runtime: RuntimeUniverseController) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const operationRef = useRef(false);

  async function exclusive(action: () => Promise<boolean>, fallback: string): Promise<boolean> {
    if (operationRef.current || runtime.busy) return false;
    operationRef.current = true;
    setBusy(true);
    setStatus(undefined);
    try { return await action(); }
    catch (cause) { setError(errorMessage(cause, fallback)); return false; }
    finally { operationRef.current = false; setBusy(false); }
  }

  return { busy, status, error, setStatus, setError, exclusive };
}
