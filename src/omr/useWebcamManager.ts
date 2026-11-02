/**
 * src/omr/useWebcamManager.ts
 * React Hook useWebcamManager() quản lý Web Camera cho ứng dụng chấm thi OMR
 * Tác giả: Thầy Hồ Tấn Khải - Trường THPT Mang Thít, Tỉnh Vĩnh Long
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { WebcamManager } from './WebcamManager';

export interface UseWebcamManagerOptions {
  autoStart?: boolean;
}

export function useWebcamManager(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  options: UseWebcamManagerOptions = {}
) {
  const { autoStart = false } = options;
  const managerRef = useRef<WebcamManager | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);

  const start = useCallback(async () => {
    if (!videoRef.current) return null;
    setError(null);

    if (!managerRef.current || managerRef.current.video !== videoRef.current) {
      managerRef.current = new WebcamManager(videoRef.current);
    }

    try {
      const dims = await managerRef.current.startCamera();
      setIsReady(true);
      setDimensions(dims);
      setTorchSupported(managerRef.current.torchSupported);
      setTorchEnabled(false);
      return dims;
    } catch (err) {
      setIsReady(false);
      const friendlyMsg = managerRef.current.handleCameraError(err);
      setError(friendlyMsg);
      throw err;
    }
  }, [videoRef]);

  const stop = useCallback(() => {
    if (managerRef.current) {
      managerRef.current.stopCamera();
    }
    setIsReady(false);
    setTorchEnabled(false);
  }, []);

  const toggleTorch = useCallback(async () => {
    if (!managerRef.current || !torchSupported) return false;
    const nextState = !torchEnabled;
    const applied = await managerRef.current.setTorch(nextState);
    setTorchEnabled(applied);
    return applied;
  }, [torchEnabled, torchSupported]);

  const captureFrame = useCallback(() => {
    if (!managerRef.current) return null;
    return managerRef.current.captureFrame();
  }, []);

  const getImageData = useCallback(() => {
    if (!managerRef.current) return null;
    return managerRef.current.getImageData();
  }, []);

  const capturePhotoDataUrl = useCallback((quality = 0.92) => {
    if (!managerRef.current) return null;
    return managerRef.current.capturePhotoDataUrl(quality);
  }, []);

  useEffect(() => {
    if (autoStart) {
      start().catch(() => {});
    }
    return () => {
      stop();
    };
  }, [autoStart, start, stop]);

  return {
    manager: managerRef.current,
    isReady,
    error,
    dimensions,
    torchSupported,
    torchEnabled,
    start,
    stop,
    toggleTorch,
    captureFrame,
    getImageData,
    capturePhotoDataUrl,
  };
}
