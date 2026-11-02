/**
 * app.js - Khởi tạo PWA, Đăng ký Service Worker & Quản lý Luồng Chấm Bài
 * Tác giả: Hồ Tấn Khải - Trường THPT Mang Thít, Tỉnh Vĩnh Long
 */

import { CrossPlatformCamera, capturePhoto } from './camera.js';

export function registerEduPWA() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./sw.js')
        .then((registration) => {
          console.log('[EduChấmĐề PWA] Service Worker đã sẵn sàng cho phòng thi Offline:', registration.scope);
        })
        .catch((error) => {
          console.warn('[EduChấmĐề PWA] Lỗi đăng ký Service Worker:', error);
        });
    });
  }
}

/**
 * Khởi tạo nhanh bộ điều khiển Camera + Nút Flash + Nút Chụp Base64
 */
export async function setupStandaloneScanner({ videoEl, torchBtnEl, captureBtnEl, onPhotoCaptured, onError }) {
  const camera = new CrossPlatformCamera(videoEl, torchBtnEl);

  try {
    const { torchSupported } = await camera.startCamera();

    if (torchBtnEl) {
      torchBtnEl.style.display = torchSupported ? 'inline-flex' : 'none';
      torchBtnEl.onclick = async () => {
        const isOn = await camera.toggleTorch();
        torchBtnEl.setAttribute('data-torch-active', String(isOn));
        torchBtnEl.textContent = isOn ? 'Tắt Flash' : 'Bật Flash';
      };
    }

    if (captureBtnEl) {
      captureBtnEl.onclick = () => {
        const base64Jpeg = capturePhoto(videoEl, 0.92);
        if (typeof onPhotoCaptured === 'function') {
          onPhotoCaptured(base64Jpeg);
        }
      };
    }

    return camera;
  } catch (err) {
    if (typeof onError === 'function') {
      onError(err.message || String(err));
    }
    return null;
  }
}

registerEduPWA();
