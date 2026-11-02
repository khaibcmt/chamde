/**
 * src/omr/WebcamManager.ts
 * Module Quản Lý Web Camera Chuyên Dụng Cho Web Chấm Thi OMR Đa Nền Tảng
 * Tương thích 100% iOS Safari, Android Chrome, Samsung Internet & Máy tính
 * Tác giả: Thầy Hồ Tấn Khải - Trường THPT Mang Thít, Tỉnh Vĩnh Long
 */

export interface CameraDimensions {
  width: number;
  height: number;
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
   */
  async startCamera(): Promise<CameraDimensions> {
    this.stopCamera(); // Dọn dẹp stream cũ nếu có tránh lỗi camera bị khóa

    // Cấu hình bắt buộc cho Safari iOS để không bị bung video toàn màn hình
    this.video.setAttribute('playsinline', 'true');
    this.video.setAttribute('webkit-playsinline', 'true');
    this.video.setAttribute('autoplay', '');
    this.video.setAttribute('muted', '');
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.autoplay = true;

    // Ràng buộc linh hoạt: Ưu tiên camera sau, độ phân giải cao cho quét OMR
    // Sử dụng ideal thay vì exact để tránh crash trên máy tính hoặc camera trước
    const constraints: MediaStreamConstraints = {
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 },
      },
    };

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (hdErr) {
        // Fallback linh hoạt nếu camera không hỗ trợ Full HD
        console.warn('Fallback sang cấu hình camera linh hoạt:', hdErr);
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
          },
        });
      }

      this.stream = stream;
      this.video.srcObject = this.stream;

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
            // Thiết lập kích thước canvas ẩn khớp với kích thước thực của camera
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

        // Lắng nghe sự kiện loadedmetadata trước khi gọi play()
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
   * Tái sử dụng canvas ẩn thay vì khởi tạo liên tục gây tràn RAM (GC lag)
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

  /**
   * Lấy trực tiếp ImageData độ nét cao từ khung hình hiện tại cho OMR Scanner
   */
  getImageData(): ImageData | null {
    const canvas = this.captureFrame();
    if (!canvas || !this.ctx) return null;
    return this.ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  /**
   * Xuất ảnh chất lượng cao dạng DataURL (image/jpeg) để lưu trữ minh chứng bài thi
   */
  capturePhotoDataUrl(quality = 0.92): string | null {
    const canvas = this.captureFrame();
    if (!canvas) return null;
    return canvas.toDataURL('image/jpeg', quality);
  }

  /**
   * Dừng toàn bộ camera và giải phóng tài nguyên
   */
  stopCamera(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
    }
    this.currentTrack = null;
    this.isReady = false;
    this.torchEnabled = false;
  }

  /**
   * Bật / Tắt Flash (Torch) nếu thiết bị hỗ trợ
   */
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

  /**
   * Lấy video track hiện tại
   */
  getVideoTrack(): MediaStreamTrack | null {
    return this.currentTrack;
  }

  /**
   * Kiểm tra thiết bị có hỗ trợ đèn flash hay không
   */
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
      // Thiết bị không hỗ trợ truy vấn Torch
    }
    return false;
  }

  /**
   * Phân loại lỗi trả về thông báo thân thiện cho giao diện
   */
  handleCameraError(err: unknown): string {
    const errObj = err as { name?: string; message?: string } | undefined;
    const name = errObj?.name || '';

    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      const msg = 'Lỗi: Người dùng từ chối cấp quyền truy cập camera.';
      console.error(msg);
      return 'Quyền truy cập Camera bị từ chối. Vui lòng cho phép quyền Camera trong Cài đặt trình duyệt để chấm thi.';
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      const msg = 'Lỗi: Thiết bị không có camera.';
      console.error(msg);
      return 'Không tìm thấy Camera trên thiết bị. Bạn vẫn có thể tải ảnh bài thi từ thư viện để chấm.';
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      const msg = 'Lỗi: Camera đang bị một ứng dụng hoặc tab khác chiếm dụng.';
      console.error(msg);
      return 'Camera đang bị ứng dụng khác chiếm dụng. Vui lòng đóng các ứng dụng đang dùng máy ảnh và thử lại.';
    }
    console.error('Lỗi khởi động camera:', err);
    return errObj?.message || 'Không thể khởi động camera. Vui lòng kiểm tra lại thiết bị.';
  }
}
