import { useEffect, useRef, useState } from "react";
import type { UniverseSummary } from "../sim";

export function useShareController(universe: UniverseSummary) {
  const [copyState, setCopyState] = useState("复制分享");
  const copyResetTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => () => {
    if (copyResetTimerRef.current !== undefined && typeof window !== "undefined") {
      window.clearTimeout(copyResetTimerRef.current);
    }
  }, []);

  async function copyShare() {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      setCopyState("复制失败");
      scheduleCopyStateReset();
      return;
    }
    const shareLink = `${window.location.origin}${window.location.pathname}${universe.shareUrl}`;
    const text = `${universe.shareText}\n${shareLink}`;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("剪贴板接口不可用。");
      await navigator.clipboard.writeText(text);
      setCopyState("已复制");
    } catch {
      if (typeof window.prompt === "function") {
        window.prompt("复制分享内容", text);
        setCopyState("已打开复制框");
      } else {
        setCopyState("复制失败");
      }
    }
    scheduleCopyStateReset();
  }

  function scheduleCopyStateReset() {
    if (typeof window === "undefined") return;
    if (copyResetTimerRef.current !== undefined) window.clearTimeout(copyResetTimerRef.current);
    copyResetTimerRef.current = window.setTimeout(() => {
      setCopyState("复制分享");
      copyResetTimerRef.current = undefined;
    }, 1400);
  }

  return { copyShare, copyState };
}
