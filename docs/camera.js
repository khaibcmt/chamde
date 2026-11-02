/**
 * camera.js - Module Xử Lý Camera Đa Nền Tảng (iOS Safari & Android Chrome/Samsung Internet)
 * Tác giả: Hồ Tấn Khải - Trường THPT Mang Thít, Tỉnh Vĩnh Long
 */

export class CrossPlatformCamera {
  constructor(videoElement, torchButtonElement = null) {
    this.videoElement = videoElement;
    this.torchButtonElement = torchButtonElement;
    this.stream = null;
    this.videoTrack = null;
    this.torchSupported = false;
    this.torchEnabled = false;
  }

  /**
   * Nhận diện hệ điều hành để hiển thị hướng dẫn cấp quyền Camera chính xác
   */
  static detectPlatform() {
    const ua = navigator.userAgent || navigator.vendor || window.opera || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /android/i.test(ua);
    return { isIOS, isAndroid };
  }

  /**
   * Khởi tạo Camera sau với cấu hình chuẩn cho iOS Safari & Android Chrome
   */
  async startCamera() {
    if (!this.videoElement) {
      throw new Error('Không tìm thấy thẻ <video> để khởi tạo Camera.');
    }

    // BẮT BUỘC cho iOS Safari để không bị văng sang trình phát video toàn màn hình
    this.videoElement.setAttribute('autoplay', '');
    this.videoElement.setAttribute('muted', '');
    this.videoElement.setAttribute('playsinline', 'true');
    this.videoElement.setAttribute('webkit-playsinline', 'true');
    this.videoElement.muted = true;
    this.videoElement.playsInline = true;

    const constraints = {
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      }
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoElement.srcObject = this.stream;
      await this.videoElement.play();

      this.videoTrack = this.stream.getVideoTracks()[0] || null;
      await this.checkTorchCapability();

      return {
        stream: this.stream,
        torchSupported: this.torchSupported
      };
    } catch (error) {
      throw new Error(CrossPlatformCamera.getFriendlyPermissionError(error));
    }
  }

  /**
   * Kiểm tra tính năng Đèn Flash (Torch) trên Android thông qua MediaTrackCapabilities / ImageCapture
   */
  async checkTorchCapability() {
    this.torchSupported = false;
    if (!this.videoTrack) return false;

    try {
      // Cách 1: Kiểm tra trực tiếp qua MediaTrackCapabilities
      if (typeof this.videoTrack.getCapabilities === 'function') {
        const capabilities = this.videoTrack.getCapabilities();
        if (capabilities && 'torch' in capabilities && capabilities.torch) {
          this.torchSupported = true;
        }
      }

      // Cách 2: Kiểm tra qua ImageCapture API (trên Android Chrome)
      if (!this.torchSupported && 'ImageCapture' in window) {
        const imageCapture = new window.ImageCapture(this.videoTrack);
        if (typeof imageCapture.getPhotoCapabilities === 'function') {
          const photoCaps = await imageCapture.getPhotoCapabilities();
          if (
            photoCaps &&
            Array.isArray(photoCaps.fillLightMode) &&
            (photoCaps.fillLightMode.includes('flash') || photoCaps.fillLightMode.includes('torch'))
          ) {
            this.torchSupported = true;
          }
        }
      }
    } catch (e) {
      console.warn('[Camera] Thiết bị không hỗ trợ kiểm tra Torch:', e);
    }

    if (this.torchButtonElement) {
      this.torchButtonElement.style.display = this.torchSupported ? 'inline-flex' : 'none';
    }

    return this.torchSupported;
  }

  /**
   * Bật / Tắt đèn Flash (Torch) hỗ trợ chấm bài trong điều kiện thiếu sáng (Android)
   */
  async toggleTorch(forceState) {
    if (!this.videoTrack || !this.torchSupported) {
      return false;
    }

    const nextState = typeof forceState === 'boolean' ? forceState : !this.torchEnabled;
    try {
      await this.videoTrack.applyConstraints({
        advanced: [{ torch: nextState }]
      });
      this.torchEnabled = nextState;
      return this.torchEnabled;
    } catch (err) {
      console.warn('[Camera] Không thể bật/tắt đèn Flash:', err);
      return this.torchEnabled;
    }
  }

  /**
   * Chụp ảnh bài làm từ thẻ <video> sang <canvas> ẩn và xuất định dạng Base64 (image/jpeg)
   * Sẵn sàng gửi đi chấm điểm hoặc lưu minh chứng
   */
  capturePhoto(quality = 0.92) {
    return capturePhoto(this.videoElement, quality);
  }

  /**
   * Dừng Camera và giải phóng tài nguyên phần cứng
   */
  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.videoTrack = null;
    this.torchEnabled = false;
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
  }

  /**
   * Thông báo lỗi thân thiện hướng dẫn người dùng mở lại quyền Camera trong Cài đặt
   */
  static getFriendlyPermissionError(error) {
    const { isIOS, isAndroid } = CrossPlatformCamera.detectPlatform();
    const errName = error && error.name ? error.name : '';

    if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
      if (isIOS) {
        return 'Quyền truy cập Camera bị từ chối trên iPhone/iPad. Vui lòng vào: Cài đặt (Settings) ➔ Safari ➔ Camera ➔ Chọn "Cho phép" (Allow), sau đó tải lại ứng dụng.';
      }
      if (isAndroid) {
        return 'Quyền truy cập Camera bị từ chối trên Android. Vui lòng nhấn vào biểu tượng Ổ khóa trên thanh địa chỉ Chrome (hoặc Cài đặt ➔ Ứng dụng ➔ Chrome ➔ Quyền ➔ Máy ảnh) ➔ Chọn "Cho phép".';
      }
      return 'Quyền truy cập Camera bị từ chối. Vui lòng mở Cài đặt trình duyệt, cho phép quyền Máy ảnh (Camera) và thử lại.';
    }

    if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
      return 'Không tìm thấy thiết bị Camera sau trên máy của bạn.';
    }

    if (errName === 'NotReadableError' || errName === 'TrackStartError') {
      return 'Camera đang được sử dụng bởi một ứng dụng khác. Vui lòng đóng các ứng dụng dùng Camera khác và thử lại.';
    }

    return (error && error.message) || 'Không thể khởi động Camera. Vui lòng kiểm tra quyền truy cập máy ảnh trong Cài đặt.';
  }
}

/**
 * Hàm độc lập: Chụp khung hình hiện tại từ <video> sang <canvas> ẩn và trả về chuỗi Base64 (image/jpeg)
 * @param {HTMLVideoElement} videoElement
 * @param {number} quality Chất lượng JPEG (0.1 -> 1.0)
 * @returns {string} Chuỗi ảnh Base64 định dạng data:image/jpeg;base64,...
 */
export function capturePhoto(videoElement, quality = 0.92) {
  if (!videoElement || !videoElement.videoWidth || !videoElement.videoHeight) {
    throw new Error('Video Camera chưa sẵn sàng để chụp ảnh.');
  }

  const hiddenCanvas = document.createElement('canvas');
  hiddenCanvas.width = videoElement.videoWidth;
  hiddenCanvas.height = videoElement.videoHeight;

  const ctx = hiddenCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('Không thể khởi tạo bộ đệm Canvas 2D.');
  }

  ctx.drawImage(videoElement, 0, 0, hiddenCanvas.width, hiddenCanvas.height);
  return hiddenCanvas.toDataURL('image/jpeg', quality);
}

// Gắn vào window để hỗ trợ gọi trực tiếp từ script truyền thống nếu cần
if (typeof window !== 'undefined') {
  window.CrossPlatformCamera = CrossPlatformCamera;
  window.capturePhoto = capturePhoto;
}
