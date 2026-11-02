/**
 * src/omr/camera.ts
 * Module Xử Lý Camera Đa Nền Tảng (iOS Safari & Android Chrome/Samsung Internet)
 * Tác giả: Hồ Tấn Khải - Trường THPT Mang Thít, Tỉnh Vĩnh Long
 */

import { WebcamManager } from './WebcamManager';
export { WebcamManager };

export interface CameraSessionResult {
  stream: MediaStream;
  videoTrack: MediaStreamTrack | null;
  torchSupported: boolean;
  manager?: WebcamManager;
}

/**
 * Nhận diện nền tảng thiết bị (iOS Safari / Android Chrome / Desktop)
 */
export function detectMobilePlatform(): { isIOS: boolean; isAndroid: boolean } {
  if (typeof navigator === 'undefined') {
    return { isIOS: false, isAndroid: false };
  }
  const ua = navigator.userAgent || navigator.vendor || (window as unknown as { opera?: string }).opera || '';
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /android/i.test(ua);
  return { isIOS, isAndroid };
}

/**
 * Khởi tạo Camera sau chuẩn đa nền tảng sử dụng WebcamManager
 */
export async function startCrossPlatformCamera(
  videoElement: HTMLVideoElement
): Promise<CameraSessionResult> {
  const manager = new WebcamManager(videoElement);
  await manager.startCamera();

  return {
    stream: manager.stream!,
    videoTrack: manager.getVideoTrack(),
    torchSupported: manager.torchSupported,
    manager,
  };
}

/**
 * Kiểm tra tính năng Đèn Flash (torch) thông qua MediaTrackCapabilities hoặc ImageCapture API
 */
export async function checkTrackTorchSupport(
  track: MediaStreamTrack | null
): Promise<boolean> {
  if (!track) return false;

  try {
    if (typeof track.getCapabilities === 'function') {
      const caps = track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
      if (caps && Boolean(caps.torch)) {
        return true;
      }
    }

    const WinWithImageCapture = window as unknown as {
      ImageCapture?: new (t: MediaStreamTrack) => {
        getPhotoCapabilities?: () => Promise<{ fillLightMode?: string[] }>;
      };
    };

    if (WinWithImageCapture.ImageCapture) {
      const imageCapture = new WinWithImageCapture.ImageCapture(track);
      if (typeof imageCapture.getPhotoCapabilities === 'function') {
        const photoCaps = await imageCapture.getPhotoCapabilities();
        if (
          photoCaps?.fillLightMode &&
          (photoCaps.fillLightMode.includes('flash') ||
            photoCaps.fillLightMode.includes('torch'))
        ) {
          return true;
        }
      }
    }
  } catch {
    // Thiết bị không hỗ trợ truy vấn Torch
  }

  return false;
}

/**
 * Bật / Tắt đèn Flash (Torch) trên thiết bị hỗ trợ
 */
export async function setCameraTorch(
  track: MediaStreamTrack | null,
  enabled: boolean
): Promise<boolean> {
  if (!track) return false;
  try {
    await track.applyConstraints({
      advanced: [{ torch: enabled } as unknown as MediaTrackConstraintSet]
    });
    return enabled;
  } catch {
    return false;
  }
}

/**
 * Hàm capturePhoto(video):
 * Chụp khung hình hiện tại từ <video> sang <canvas> ẩn và xuất ra định dạng ảnh Base64 (image/jpeg)
 * sẵn sàng để gửi đi chấm điểm hoặc lưu trữ minh chứng.
 */
export function capturePhoto(
  videoElement: HTMLVideoElement,
  quality = 0.92
): string {
  if (!videoElement || !videoElement.videoWidth || !videoElement.videoHeight) {
    throw new Error('Camera chưa sẵn sàng để chụp ảnh.');
  }

  const hiddenCanvas = document.createElement('canvas');
  hiddenCanvas.width = videoElement.videoWidth;
  hiddenCanvas.height = videoElement.videoHeight;

  const ctx = hiddenCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('Không thể khởi tạo Canvas ẩn.');
  }

  ctx.drawImage(videoElement, 0, 0, hiddenCanvas.width, hiddenCanvas.height);
  return hiddenCanvas.toDataURL('image/jpeg', quality);
}

/**
 * Hàm chụp và chuẩn hóa ảnh trước khi đưa vào bộ chấm
 * @param {HTMLVideoElement} videoEl - Thẻ video camera
 * @param {number} standardWidth - Chiều rộng chuẩn của bộ chấm (ví dụ: 1240)
 * @param {number} standardHeight - Chiều cao chuẩn của bộ chấm (ví dụ: 1754)
 */
export function captureStandardFrameForOMR(
  videoEl: HTMLVideoElement | null,
  standardWidth = 1240,
  standardHeight = 1754
): HTMLCanvasElement | null {
  // 1. Kiểm tra video đã sẵn sàng hay chưa để tránh gửi ảnh rỗng (0x0)
  if (!videoEl || videoEl.videoWidth === 0 || videoEl.readyState < 2) {
    console.warn("Video camera chưa sẵn sàng.");
    return null;
  }

  // 2. Tạo canvas trung gian chuẩn hóa
  const normalizedCanvas = document.createElement('canvas');
  normalizedCanvas.width = standardWidth;
  normalizedCanvas.height = standardHeight;
  const ctx = normalizedCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  // 3. Vẽ đè và ép tỉ lệ ảnh về đúng chuẩn của bộ OMR
  ctx.drawImage(videoEl, 0, 0, standardWidth, standardHeight);

  return normalizedCanvas;
}

/**
 * Hiển thị thông báo lỗi thân thiện hướng dẫn giáo viên mở lại quyền Camera trong Cài đặt của từng hệ điều hành
 */
export function getFriendlyCameraPermissionError(error: unknown): string {
  const { isIOS, isAndroid } = detectMobilePlatform();
  const errObj = error as { name?: string; message?: string } | undefined;
  const errName = errObj?.name || '';

  if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
    if (isIOS) {
      return 'Quyền truy cập Camera bị từ chối trên iPhone/iPad. Vui lòng mở: Cài đặt (Settings) ➔ Safari ➔ Camera ➔ Chọn "Cho phép" (Allow), sau đó mở lại ứng dụng.';
    }
    if (isAndroid) {
      return 'Quyền truy cập Camera bị từ chối trên Android. Vui lòng nhấn biểu tượng Ổ khóa trên thanh địa chỉ Chrome (hoặc Cài đặt ➔ Ứng dụng ➔ Chrome ➔ Quyền ➔ Máy ảnh) ➔ Chọn "Cho phép".';
    }
    return 'Quyền truy cập Camera bị từ chối. Vui lòng vào Cài đặt trình duyệt ➔ Quyền riêng tư & Bảo mật ➔ Cho phép quyền Máy ảnh (Camera) rồi thử lại.';
  }

  if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
    return 'Không tìm thấy Camera trên thiết bị của bạn. Bạn vẫn có thể chọn ảnh phiếu trả lời từ Thư viện ảnh.';
  }

  if (errName === 'NotReadableError' || errName === 'TrackStartError') {
    return 'Camera đang bận hoặc đang được mở bởi một ứng dụng khác. Hãy đóng các ứng dụng dùng Camera khác và thử lại.';
  }

  return (
    errObj?.message ||
    'Không thể kết nối Camera. Vui lòng kiểm tra quyền truy cập Máy ảnh trong phần Cài đặt của điện thoại.'
  );
}
