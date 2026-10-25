"use client";

import jsQR from "jsqr";
import { useCallback, useEffect, useRef, useState } from "react";

type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };

/**
 * Lee códigos QR de la cámara. Usa el BarcodeDetector del navegador si existe (Chrome, Android) y, si no, jsQR
 * (Safari de iOS). Un código se envía una sola vez mientras siga a la vista: solo vuelve a leerse cuando sale de
 * cuadro (más de {@code CLEAR_AFTER_MS} sin verse) o cuando aparece un código distinto. Así, una persona que sigue
 * mostrando su boleto después del verde no recibe un rojo de "ya ingresó".
 */
const CLEAR_AFTER_MS = 1200;

export function useQrScanner(onCode: (value: string) => void, options: { paused: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const last = useRef<{ value: string; at: number } | null>(null);
  const onCodeRef = useRef(onCode);
  const pausedRef = useRef(options.paused);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onCodeRef.current = onCode;
    pausedRef.current = options.paused;
  });

  const stop = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Este navegador no permite usar la cámara. Usa el campo de texto o un lector.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setActive(true);

      // El detector nativo solo se usa si de verdad lee códigos QR; si no (o si falla), se usa jsQR.
      const BarcodeDetectorCtor = (window as unknown as {
        BarcodeDetector?: (new (o: { formats: string[] }) => Detector) & { getSupportedFormats?: () => Promise<string[]> };
      }).BarcodeDetector;
      let detector: Detector | null = null;
      try {
        if (BarcodeDetectorCtor && (await BarcodeDetectorCtor.getSupportedFormats?.())?.includes("qr_code")) {
          detector = new BarcodeDetectorCtor({ formats: ["qr_code"] });
        }
      } catch {
        detector = null;
      }
      const canvas = (canvasRef.current ??= document.createElement("canvas"));
      let busy = false;

      const tick = async () => {
        frameRef.current = requestAnimationFrame(tick);
        if (busy || pausedRef.current || video.readyState < 2) return;
        busy = true;
        try {
          let value: string | undefined;
          if (detector) {
            try {
              value = (await detector.detect(video))[0]?.rawValue;
            } catch {
              detector = null; // el detector nativo falló: desde este fotograma se usa jsQR
            }
          }
          if (!detector) {
            const w = video.videoWidth;
            const h = video.videoHeight;
            if (w && h) {
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext("2d", { willReadFrequently: true });
              ctx?.drawImage(video, 0, 0, w, h);
              const image = ctx?.getImageData(0, 0, w, h);
              if (image) value = jsQR(image.data, w, h, { inversionAttempts: "dontInvert" })?.data;
            }
          }
          const now = Date.now();
          const seen = last.current;
          if (value) {
            if (seen && seen.value === value) {
              seen.at = now; // sigue a la vista: no se vuelve a enviar
            } else {
              last.current = { value, at: now };
              onCodeRef.current(value);
            }
          } else if (seen && now - seen.at > CLEAR_AFTER_MS) {
            last.current = null; // salió de cuadro: se podrá leer de nuevo
          }
        } catch {
          // un fotograma que no se pudo leer no debe detener el escáner
        } finally {
          busy = false;
        }
      };
      frameRef.current = requestAnimationFrame(tick);
    } catch (e) {
      const name = (e as { name?: string }).name;
      setError(
        name === "NotAllowedError"
          ? "No diste permiso para usar la cámara. Actívalo en la configuración del navegador."
          : name === "NotFoundError"
            ? "No se encontró ninguna cámara."
            : "No se pudo iniciar la cámara.",
      );
      stop();
    }
  }, [stop]);

  useEffect(() => stop, [stop]);

  // El elemento <video> va aparte de los controles: así los controles no se confunden con una referencia al renderizar.
  return [videoRef, { active, error, start, stop }] as const;
}
