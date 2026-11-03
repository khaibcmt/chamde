/**
 * src/omr/WebcamManager.ts
 * Module Quản Lý Web Camera Chuyên Dụng Cho Web Chấm Thi OMR Đa Nền Tảng
 * Ghi nhớ quyền truy cập Camera & deviceId vào localStorage, giữ ấm luồng MediaStream
 * để không bao giờ hỏi lại quyền truy cập Camera trong các lần chấm tiếp theo.
 */

export interface CameraDimensions {
  width: number;
  height: number;
}

const CAMERA_DEVICE_STORAGE_KEY = 'omr_remembered_camera_device_id_v1';
const CAMERA_GRANTED_STORAGE_KEY = 'omr_camera_permission_granted_v1';

// Giữ ấm luồng Camera (Singleton Stream) trong suốt phiên làm việc để chuyển màn hình không phải xin quyền lại
let persistentMediaStream: MediaStream | null = null;
let persistentVideoTrack: MediaStreamTrack | null = null;

export function isCameraPermissionRemembered(): boolean {
  try {
    return localStorage.getItem(CAMERA_GRANTED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export class WebcamManager {
  public video: HTMLVideoElement;
  public stream: MediaStream | null = null;
  public offscreenCanvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D | null;
  public isReady: boolean = false;
  private currentTrack: MediaStreamTrack | null = null;
  public torchSupported: boolean = false;
  public torchEnabled: boolean = false;

  constructor(videoElement: HTMLVideoElement) {
    this.video = videoElement;
    this.stream = null;
    this.offscreenCanvas = document.createElement('canvas');
    this.ctx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });
    this.isReady = false;
  }

  /**
   * Khởi chạy camera an toàn đa nền tảng (iOS Safari, Android, Desktop)
   * Tái sử dụng luồng đã cấp quyền và deviceId đã lưu để không hỏi lại quyền
   */
  async startCamera(): Promise<CameraDimensions> {
    // Cấu hình bắt buộc cho Safari iOS để không bị bung video toàn màn hình
    this.video.setAttribute('playsinline', 'true');
    this.video.setAttribute('webkit-playsinline', 'true');
    this.video.setAttribute('autoplay', '');
    this.video.setAttribute('muted', '');
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.autoplay = true;

    try {
      let stream: MediaStream | null = null;

      // 1. Nếu đã có luồng Camera đang sống (warm stream), tái sử dụng ngay lập tức (0ms, không hỏi quyền)
      if (
        persistentMediaStream &&
        persistentMediaStream.active &&
        persistentVideoTrack &&
        persistentVideoTrack.readyState === 'live'
      ) {
        stream = persistentMediaStream;
      } else {
        // 2. Đọc deviceId của Camera sau đã được ghi nhớ từ lần trước
        let rememberedDeviceId: string | null = null;
        try {
          rememberedDeviceId = localStorage.getItem(CAMERA_DEVICE_STORAGE_KEY);
        } catch {
          rememberedDeviceId = null;
        }

        const videoConstraints: MediaTrackConstraints = rememberedDeviceId
          ? {
              deviceId: { ideal: rememberedDeviceId },
              facingMode: { ideal: 'environment' },
              width: { ideal: 1920, min: 1280 },
              height: { ideal: 1080, min: 720 },
            }
          : {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1920, min: 1280 },
              height: { ideal: 1080, min: 720 },
            };

        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: videoConstraints,
          });
        } catch {
          // Fallback linh hoạt nếu camera không hỗ trợ độ phân giải Full HD hoặc deviceId cũ thay đổi
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: { ideal: 'environment' },
            },
          });
        }

        persistentMediaStream = stream;
        persistentVideoTrack = stream.getVideoTracks()[0] || null;

        // 3. Lưu lại deviceId và trạng thái đã cấp quyền vào localStorage để lần sau mở trang không hỏi lại
        try {
          localStorage.setItem(CAMERA_GRANTED_STORAGE_KEY, '1');
          const settings = persistentVideoTrack?.getSettings?.();
          if (settings?.deviceId) {
            localStorage.setItem(CAMERA_DEVICE_STORAGE_KEY, settings.deviceId);
          }
        } catch {
          // ignore storage errors
        }
      }

      this.stream = stream;
      if (this.video.srcObject !== this.stream) {
        this.video.srcObject = this.stream;
      }

      const track = stream.getVideoTracks()[0] || null;
      this.currentTrack = track;
      this.torchSupported = await this.checkTorchSupport(track);
      this.torchEnabled = false;

      return new Promise<CameraDimensions>((resolve, reject) => {
        let isResolved = false;

        const onReady = async () => {
          if (isResolved) return;
          isResolved = true;
          try {
            await this.video.play();
            const vw = this.video.videoWidth || 1280;
            const vh = this.video.videoHeight || 720;
            this.offscreenCanvas.width = vw;
            this.offscreenCanvas.height = vh;
            this.isReady = true;
            resolve({
              width: vw,
              height: vh,
            });
          } catch (playErr) {
            reject(playErr);
          }
        };

        if (this.video.readyState >= 1) {
          onReady();
        } else {
          this.video.onloadedmetadata = onReady;
        }

        this.video.onerror = (e) => {
          if (!isResolved) {
            isResolved = true;
            reject(e);
          }
        };
      });
    } catch (err) {
      this.handleCameraError(err);
      throw err;
    }
  }

  /**
   * Chụp khung hình độ nét cao nhất gửi sang OMR / OpenCV
   */
  captureFrame(): HTMLCanvasElement | null {
    if (!this.isReady || !this.video || this.video.readyState < 2 || !this.ctx) {
      return null;
    }

    const vw = this.video.videoWidth;
    const vh = this.video.videoHeight;
    if (vw === 0 || vh === 0) return null;

    if (
      this.offscreenCanvas.width !== vw ||
      this.offscreenCanvas.height !== vh
    ) {
      this.offscreenCanvas.width = vw;
      this.offscreenCanvas.height = vh;
    }

    this.ctx.drawImage(this.video, 0, 0, vw, vh);
    return this.offscreenCanvas;
  }

  getImageData(): ImageData | null {
    const canvas = this.captureFrame();
    if (!canvas || !this.ctx) return null;
    return this.ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  capturePhotoDataUrl(quality = 0.92): string | null {
    const canvas = this.captureFrame();
    if (!canvas) return null;
    return canvas.toDataURL('image/jpeg', quality);
  }

  /**
   * Ngắt kết nối khỏi thẻ video hiện tại nhưng giữ luồng (persistentMediaStream)
   * hoặc giải phóng hoàn toàn nếu forceStopHardware = true
   */
  stopCamera(forceStopHardware = false): void {
    if (forceStopHardware && this.stream) {
      this.stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      if (persistentMediaStream === this.stream) {
        persistentMediaStream = null;
        persistentVideoTrack = null;
      }
    }
    this.stream = null;
    if (this.video) {
      this.video.srcObject = null;
    }
    this.currentTrack = null;
    this.isReady = false;
    this.torchEnabled = false;
  }

  async setTorch(enabled: boolean): Promise<boolean> {
    if (!this.currentTrack || !this.torchSupported) return false;
    try {
      await this.currentTrack.applyConstraints({
        advanced: [{ torch: enabled } as unknown as MediaTrackConstraintSet],
      });
      this.torchEnabled = enabled;
      return enabled;
    } catch {
      return false;
    }
  }

  getVideoTrack(): MediaStreamTrack | null {
    return this.currentTrack;
  }

  private async checkTorchSupport(track: MediaStreamTrack | null): Promise<boolean> {
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
            (photoCaps.fillLightMode.includes('flash') || photoCaps.fillLightMode.includes('torch'))
          ) {
            return true;
          }
        }
      }
    } catch {
      // ignore
    }
    return false;
  }

  handleCameraError(err: unknown): string {
    const errObj = err as { name?: string; message?: string } | undefined;
    const name = errObj?.name || '';

    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return 'Quyền truy cập Camera bị từ chối. Vui lòng cho phép quyền Camera trong Cài đặt trình duyệt để chấm thi.';
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return 'Không tìm thấy Camera trên thiết bị. Bạn vẫn có thể tải ảnh bài thi từ thư viện để chấm.';
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return 'Camera đang bị ứng dụng khác chiếm dụng. Vui lòng đóng các ứng dụng đang dùng máy ảnh và thử lại.';
    }
    return errObj?.message || 'Không thể khởi động camera. Vui lòng kiểm tra lại thiết bị.';
  }
}
