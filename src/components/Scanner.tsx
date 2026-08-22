"use client";

// 全螢幕相機掃碼層。
//
// ★ 為什麼一律用 jsQR，不用瀏覽器內建的 BarcodeDetector ★
// iOS Safari 不支援 BarcodeDetector，而學生一半以上是 iPhone。做兩條路徑
// 等於多一個「只在部分裝置上會壞」的分支，活動現場沒有 debug 時間。單一路徑。
import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { X } from "lucide-react";
import { Button } from "@/components/ui/primitives";

const FRAME_MS = 200;

export function Scanner({
  onCode,
  onClose,
  notice,
}: {
  // 回傳 false 代表這個碼不對，繼續掃。
  onCode: (code: string) => Promise<boolean>;
  onClose: () => void;
  notice: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    // 沒關掉的話相機指示燈不會滅，使用者會以為被偷錄。
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        canvasRef.current ??= document.createElement("canvas");
        timer = setInterval(scan, FRAME_MS);
      } catch {
        // 權限被拒 / 沒有相機 / 不是安全來源都走這裡。不留死路：叫他用手打的。
        setError("開不了相機。改用下面的「輸入配對碼」也可以相認。");
      }
    }

    async function scan() {
      if (busyRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const found = jsQR(image.data, image.width, image.height);
      if (!found) return;

      const code = found.data.trim();
      if (!/^\d{6}$/.test(code)) return;

      // 送出期間別再掃，否則同一個碼會連打好幾次、直接撞到 rate limit。
      busyRef.current = true;
      const ok = await onCode(code);
      if (ok) {
        stop();
        return;
      }
      // 掃錯人就繼續掃，但緩一下免得同一張 QR 一直重試。
      setTimeout(() => {
        busyRef.current = false;
      }, 1500);
    }

    start();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      stop();
    };
  }, [onCode, stop]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-foreground/90 p-4">
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border-2 border-background bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          className="aspect-square w-full object-cover"
        />
        {/* 取景框，讓人知道要把 QR 對到哪 */}
        <span className="pointer-events-none absolute left-1/2 top-1/2 size-48 -translate-x-1/2 -translate-y-1/2 rounded-xl border-4 border-background/80" />
      </div>

      <p className="max-w-sm text-center font-bold text-background">
        {error ?? notice ?? "把對方螢幕上的 QR 對進框裡"}
      </p>

      <Button variant="default" onClick={onClose} className="gap-2">
        <X className="size-4" />
        關閉
      </Button>
    </div>
  );
}
