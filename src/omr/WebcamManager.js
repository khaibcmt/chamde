/**
 * WebcamManager.js
 * Module JavaScript ES6 quản lý Web Camera chuyên dụng cho ứng dụng Web chấm thi OMR
 * Tương thích 100% trên thiết bị di động (iOS Safari, Android Chrome) và máy tính (Desktop)
 * Đảm bảo ZERO RUNTIME ERROR, chống treo luồng và tối ưu hóa bộ nhớ (không tràn RAM).
 * Tác giả: Thầy Hồ Tấn Khải - Trường THPT Mang Thít, Tỉnh Vĩnh Long
 */

export class WebcamManager {
  /**
   * @param {HTMLVideoElement} videoElement - Phần tử <video> hiển thị khung hình camera
   */
  constructor(videoElement) {
    if (!videoElement) {
      throw new Error('WebcamManager yêu cầu một phần tử HTMLVideoElement hợp lệ.');
    }
    this.video = videoElement;
    this.stream = null;
    this.offscreenCanvas = document.createElement('canvas');
    this.ctx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });
    this.isReady = false;
    this.currentTrack = null;
    this.torchSupported = false;
    this.torchEnabled = false;
  }

  /**
   * Khởi chạy camera an toàn đa nền tảng
   * @returns {Promise<{width: number, height: number}>} Kích thước thực tế của camera
   */
  async startCamera() {
    this.stopCamera(); // Dọn dẹp stream cũ nếu có

    // Cấu hình bắt buộc cho Safari iOS để tránh tự bung fullscreen
    this.video.setAttribute('playsinline', 'true');
    this.video.setAttribute('webkit-playsinline', 'true');
    this.video.setAttribute('autoplay', '');
    this.video.setAttribute('muted', '');
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.autoplay = true;

    // Ưu tiên camera sau (environment), độ phân giải cao cho OMR
    const constraints = {
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 }
      }
    };

    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (hdErr) {
        // Fallback linh hoạt nếu thiết bị không hỗ trợ Full HD
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' } }
        });
      }

      this.stream = stream;
      this.video.srcObject = this.stream;

      const track = stream.getVideoTracks()[0] || null;
      this.currentTrack = track;
      this.torchSupported = await this.checkTorchSupport(track);
      this.torchEnabled = false;

      return new Promise((resolve, reject) => {
        let isResolved = false;

        const onReady = async () => {
          if (isResolved) return;
          isResolved = true;
          try {
            await this.video.play();
            // Thiết lập kích thước canvas ẩn khớp với kích thước thực của camera
            const vw = this.video.videoWidth || 1280;
            const vh = this.video.videoHeight || 720;
            this.offscreenCanvas.width = vw;
            this.offscreenCanvas.height = vh;
            this.isReady = true;
            resolve({
              width: vw,
              height: vh
            });
          } catch (playErr) {
            reject(playErr);
          }
        };

        // Lắng nghe sự kiện loadedmetadata trước khi gọi play() chống Race Condition
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
   * Tái sử dụng canvas ẩn thay vì khởi tạo document.createElement('canvas') liên tục gây tràn RAM
   * @returns {HTMLCanvasElement|null} Canvas chứa khung hình thực tế
   */
  captureFrame() {
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
   * Lấy trực tiếp ImageData của khung hình phục vụ quét mốc định vị OMR
   * @returns {ImageData|null}
   */
  getImageData() {
    const canvas = this.captureFrame();
    if (!canvas || !this.ctx) return null;
    return this.ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  /**
   * Chụp ảnh chất lượng cao dạng DataURL (image/jpeg) để lưu minh chứng bài thi
   * @param {number} [quality=0.92]
   * @returns {string|null}
   */
  capturePhotoDataUrl(quality = 0.92) {
    const canvas = this.captureFrame();
    if (!canvas) return null;
    return canvas.toDataURL('image/jpeg', quality);
  }

  /**
   * Dừng toàn bộ camera và giải phóng tài nguyên
   */
  stopCamera() {
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
   * Bật / Tắt đèn Flash (Torch)
   * @param {boolean} enabled
   * @returns {Promise<boolean>}
   */
  async setTorch(enabled) {
    if (!this.currentTrack || !this.torchSupported) return false;
    try {
      await this.currentTrack.applyConstraints({
        advanced: [{ torch: enabled }]
      });
      this.torchEnabled = enabled;
      return enabled;
    } catch {
      return false;
    }
  }

  /**
   * Kiểm tra thiết bị có hỗ trợ đèn flash hay không
   * @private
   */
  async checkTorchSupport(track) {
    if (!track) return false;
    try {
      if (typeof track.getCapabilities === 'function') {
        const caps = track.getCapabilities();
        if (caps && Boolean(caps.torch)) {
          return true;
        }
      }
      if (window.ImageCapture) {
        const imageCapture = new window.ImageCapture(track);
        if (typeof imageCapture.getPhotoCapabilities === 'function') {
          const photoCaps = await imageCapture.getPhotoCapabilities();
          if (
            photoCaps &&
            photoCaps.fillLightMode &&
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

  /**
   * Phân loại lỗi trả về thông báo thân thiện cho giao diện
   * @param {Error|unknown} err
   * @returns {string} Thông báo lỗi thân thiện cho người dùng
   */
  handleCameraError(err) {
    const errObj = err || {};
    const name = errObj.name || '';

    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      const msg = 'Lỗi: Người dùng từ chối cấp quyền truy cập camera.';
      console.error(msg);
      return 'Quyền truy cập Camera bị từ chối. Vui lòng vào Cài đặt trình duyệt để cấp quyền Máy ảnh.';
    } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      const msg = 'Lỗi: Thiết bị không có camera.';
      console.error(msg);
      return 'Không tìm thấy Camera trên thiết bị. Bạn vẫn có thể tải ảnh bài thi từ thư viện để chấm.';
    } else if (name === 'NotReadableError' || name === 'TrackStartError') {
      const msg = 'Lỗi: Camera đang bị một ứng dụng hoặc tab khác chiếm dụng.';
      console.error(msg);
      return 'Camera đang bị ứng dụng khác chiếm dụng. Vui lòng đóng các ứng dụng đang dùng máy ảnh và thử lại.';
    } else {
      console.error('Lỗi khởi động camera:', err);
      return errObj.message || 'Không thể khởi động camera. Vui lòng kiểm tra lại thiết bị.';
    }
  }
}
