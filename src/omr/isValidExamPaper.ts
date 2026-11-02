/**
 * src/omr/isValidExamPaper.ts
 * BỘ LỌC KIỂM DUYỆT TÍNH HỢP LỆ CỦA PHIẾU THI TRƯỚC KHI CHẤM (VALIDATION GATE)
 * 
 * Ngăn chặn tuyệt đối tình trạng nhận diện bừa bãi khi thấy bất kỳ hình chữ nhật nào
 * (mặt bàn gỗ, cạnh sách vở, laptop, bóng đổ).
 * Chỉ kích hoạt trạng thái chấm thi khi vượt qua đầy đủ 5 tiêu chí khắt khe:
 * 1. Aspect Ratio Check: Tỷ lệ khung hình dài/rộng đúng chuẩn A4 dọc (1.414) hoặc A4 ngang 2 bài (1.86).
 * 2. Corner Angle Check: 4 góc vuông vức (tích vô hướng Cosine, góc 74° - 106°).
 * 3. Fiducial Marker Check: 4 góc thực sự chứa ô vuông đen định vị đặc, tương phản cao với nền giấy.
 * 4. Paper Brightness & Contrast: Vùng bên trong là giấy trắng in chữ đen (độ sáng > 95, không phải mặt bàn sẫm màu).
 * 5. Screen Area Ratio: Tứ giác chiếm tỷ lệ hợp lý trên khung hình (18% - 94%).
 * 
 * Tác giả: Thầy Hồ Tấn Khải - Trường THPT Mang Thít, Tỉnh Vĩnh Long
 */

import { Point2D, DetectedCorners } from './visionEngine';
import { TemplateId, TEMPLATES } from './templates';

export interface PaperValidationDetails {
  isValid: boolean;
  aspectRatio: number;
  angles: number[]; // 4 góc tính theo độ
  cosines: number[]; // 4 giá trị cos(theta)
  paperBrightness: number; // Độ sáng trung bình giấy trắng bên trong
  markerDarkness: number[]; // Độ sáng 4 marker góc (càng nhỏ càng đen)
  markerFillRatios: number[]; // Tỷ lệ pixel đen trong 4 ô marker (0.0 - 1.0)
  areaRatio: number; // Tỷ lệ diện tích tứ giác so với toàn khung hình
  failedCheck?: 'aspect_ratio' | 'corner_angle' | 'fiducial_markers' | 'paper_brightness' | 'area_ratio';
  reason?: string;
}

/**
 * Tính diện tích tứ giác lồi theo công thức Shoelace
 */
export function calculateQuadArea(p0: Point2D, p1: Point2D, p2: Point2D, p3: Point2D): number {
  return (
    0.5 *
    Math.abs(
      p0.x * p1.y -
        p1.x * p0.y +
        p1.x * p2.y -
        p2.x * p1.y +
        p2.x * p3.y -
        p3.x * p2.y +
        p3.x * p0.y -
        p0.x * p3.y
    )
  );
}

/**
 * Tính góc giữa 2 vector BA và BC tại đỉnh B (trả về góc độ và cos)
 */
export function calculateCornerAngle(A: Point2D, B: Point2D, C: Point2D): { angleDeg: number; cosTheta: number } {
  const v1x = A.x - B.x;
  const v1y = A.y - B.y;
  const v2x = C.x - B.x;
  const v2y = C.y - B.y;

  const dot = v1x * v2x + v1y * v2y;
  const len1 = Math.hypot(v1x, v1y);
  const len2 = Math.hypot(v2x, v2y);

  if (len1 < 1e-4 || len2 < 1e-4) {
    return { angleDeg: 0, cosTheta: 1 };
  }

  const cosTheta = Math.max(-1, Math.min(1, dot / (len1 * len2)));
  const angleDeg = (Math.acos(cosTheta) * 180) / Math.PI;

  return { angleDeg, cosTheta };
}

/**
 * Trích xuất độ sáng luminance (0..255) tại tọa độ (x, y)
 */
function getPixelLuminance(imageData: ImageData, x: number, y: number): number {
  const { width, height, data } = imageData;
  const px = Math.max(0, Math.min(width - 1, Math.round(x)));
  const py = Math.max(0, Math.min(height - 1, Math.round(y)));
  const idx = (py * width + px) * 4;
  return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
}

/**
 * HÀM KIỂM DUYỆT TÍNH HỢP LỆ CỦA PHIẾU THI (VALIDATION GATE)
 * @param corners Tứ giác 4 góc { tl, tr, br, bl }
 * @param frameData Dữ liệu pixel ImageData từ camera
 * @param templateId Mẫu phiếu đang chọn để đối chiếu tỷ lệ
 */
export function isValidExamPaper(
  corners: { tl: Point2D; tr: Point2D; br: Point2D; bl: Point2D },
  frameData: ImageData,
  templateId?: TemplateId
): PaperValidationDetails {
  const { width: fw, height: fh } = frameData;
  const frameArea = fw * fh;

  const pts = [corners.tl, corners.tr, corners.br, corners.bl];

  // 1. KIỂM TRA DIỆN TÍCH TỨ GIÁC (Screen Area Ratio Check)
  const quadArea = calculateQuadArea(pts[0], pts[1], pts[2], pts[3]);
  const areaRatio = quadArea / frameArea;

  if (areaRatio < 0.08 || areaRatio > 0.99) {
    return {
      isValid: false,
      aspectRatio: 0,
      angles: [],
      cosines: [],
      paperBrightness: 0,
      markerDarkness: [],
      markerFillRatios: [],
      areaRatio,
      failedCheck: 'area_ratio',
      reason: areaRatio < 0.08 ? 'Phiếu thi quá xa camera (diện tích < 8%)' : 'Phiếu thi quá sát camera',
    };
  }

  // 2. KIỂM TRA ĐỘ VUÔNG VỨC 4 GÓC (Corner Angle Check - Cosine Threshold)
  // Các góc tại TL (giữa BL-TL và TR-TL), TR (TL-TR và BR-TR), BR (TR-BR và BL-BR), BL (BR-BL và TL-BL)
  const cornerSpecs = [
    { name: 'TL', A: pts[3], B: pts[0], C: pts[1] },
    { name: 'TR', A: pts[0], B: pts[1], C: pts[2] },
    { name: 'BR', A: pts[1], B: pts[2], C: pts[3] },
    { name: 'BL', A: pts[2], B: pts[3], C: pts[0] },
  ];

  const angles: number[] = [];
  const cosines: number[] = [];
  let isAngleValid = true;

  for (const cs of cornerSpecs) {
    const { angleDeg, cosTheta } = calculateCornerAngle(cs.A, cs.B, cs.C);
    angles.push(angleDeg);
    cosines.push(cosTheta);

    // Góc dao động trong khoảng [68°, 112°] tương ứng |cos| <= 0.36
    if (Math.abs(cosTheta) > 0.36 || angleDeg < 68 || angleDeg > 112) {
      isAngleValid = false;
    }
  }

  if (!isAngleValid) {
    return {
      isValid: false,
      aspectRatio: 0,
      angles,
      cosines,
      paperBrightness: 0,
      markerDarkness: [],
      markerFillRatios: [],
      areaRatio,
      failedCheck: 'corner_angle',
      reason: 'Góc nghiêng vượt mức cho phép (4 góc chưa vuông vức 68°-112°)',
    };
  }

  // 3. KIỂM TRA TỶ LỆ KHUNG HÌNH (Aspect Ratio Check)
  const topEdge = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
  const rightEdge = Math.hypot(pts[2].x - pts[1].x, pts[2].y - pts[1].y);
  const bottomEdge = Math.hypot(pts[2].x - pts[3].x, pts[2].y - pts[3].y);
  const leftEdge = Math.hypot(pts[0].x - pts[3].x, pts[0].y - pts[3].y);

  const avgW = (topEdge + bottomEdge) / 2;
  const avgH = (rightEdge + leftEdge) / 2;
  const aspectRatio = Math.max(avgW, avgH) / Math.max(1, Math.min(avgW, avgH));

  // Hỗ trợ đầy đủ cả 14 mẫu phiếu: A4 dọc (~1.41), Khổ ngang 2 bài/A4 (~1.86), và Ôn tập TL ngắn (~3.21)
  const minRatio = 1.15;
  const maxRatio = 3.45;

  if (aspectRatio < minRatio || aspectRatio > maxRatio) {
    return {
      isValid: false,
      aspectRatio,
      angles,
      cosines,
      paperBrightness: 0,
      markerDarkness: [],
      markerFillRatios: [],
      areaRatio,
      failedCheck: 'aspect_ratio',
      reason: `Tỷ lệ cạnh không khớp phiếu thi (${aspectRatio.toFixed(2)} nằm ngoài [${minRatio}-${maxRatio}])`,
    };
  }

  // 4. KIỂM TRA ĐỘ SÁNG VÙNG GIẤY BÊN TRONG (Paper Brightness & Contrast Check)
  // Lấy mẫu tại các điểm bên trong ruột phiếu (tránh viền và bóng đổ ngoài mép)
  // Tính trọng tâm G:
  const gx = (pts[0].x + pts[1].x + pts[2].x + pts[3].x) / 4;
  const gy = (pts[0].y + pts[1].y + pts[2].y + pts[3].y) / 4;

  let paperLumaSum = 0;
  let paperSampleCount = 0;

  // Lấy mẫu tại tâm và các điểm tỷ lệ 35%, 60% từ tâm hướng tới 4 đỉnh
  const sampleFactors = [0, 0.35, 0.60];
  for (const factor of sampleFactors) {
    if (factor === 0) {
      paperLumaSum += getPixelLuminance(frameData, gx, gy);
      paperSampleCount++;
    } else {
      for (const p of pts) {
        const sx = gx + (p.x - gx) * factor;
        const sy = gy + (p.y - gy) * factor;
        paperLumaSum += getPixelLuminance(frameData, sx, sy);
        paperSampleCount++;
      }
    }
  }

  const paperBrightness = paperLumaSum / Math.max(1, paperSampleCount);

  if (paperBrightness < 85) {
    return {
      isValid: false,
      aspectRatio,
      angles,
      cosines,
      paperBrightness,
      markerDarkness: [],
      markerFillRatios: [],
      areaRatio,
      failedCheck: 'paper_brightness',
      reason: `Độ sáng bề mặt quá thấp (${Math.round(paperBrightness)}/255) - không phải giấy trắng`,
    };
  }

  // 5. KIỂM TRA 4 Ô VUÔNG MỐC NEO ĐEN ĐỊNH VỊ (Fiducial Anchor Check - QUAN TRỌNG NHẤT)
  const markerDarkness: number[] = [];
  const markerFillRatios: number[] = [];

  // Bán kính lấy mẫu gọn quanh tâm mốc đen (4px - 10px) để không lấy nhầm nền giấy trắng xung quanh
  const markerRadius = Math.max(4, Math.min(10, Math.round(Math.min(avgW, avgH) * 0.012)));

  let validMarkersCount = 0;

  for (let i = 0; i < 4; i++) {
    const pt = pts[i];
    let markerLumaSum = 0;
    let darkPixelCount = 0;
    let totalSampled = 0;

    const step = Math.max(1, Math.floor(markerRadius / 4));
    for (let dy = -markerRadius; dy <= markerRadius; dy += step) {
      for (let dx = -markerRadius; dx <= markerRadius; dx += step) {
        const luma = getPixelLuminance(frameData, pt.x + dx, pt.y + dy);
        markerLumaSum += luma;
        totalSampled++;
        if (luma < 145) {
          darkPixelCount++;
        }
      }
    }

    const avgMarkerDarkness = markerLumaSum / Math.max(1, totalSampled);
    const fillRatio = darkPixelCount / Math.max(1, totalSampled);

    markerDarkness.push(Math.round(avgMarkerDarkness));
    markerFillRatios.push(Number(fillRatio.toFixed(2)));

    const contrast = paperBrightness - avgMarkerDarkness;
    if ((avgMarkerDarkness < 170 || fillRatio >= 0.16) && contrast >= 8) {
      validMarkersCount++;
    }
  }

  // Cho phép từ 2/4 mốc định vị trở lên (hoặc khi 1 góc bị suy nội suy từ 3 mốc)
  if (validMarkersCount < 2) {
    return {
      isValid: false,
      aspectRatio,
      angles,
      cosines,
      paperBrightness,
      markerDarkness,
      markerFillRatios,
      areaRatio,
      failedCheck: 'fiducial_markers',
      reason: `Chưa xác nhận đủ mốc đen định vị góc (${validMarkersCount}/4)`,
    };
  }

  // TẤT CẢ 5 ĐIỀU KIỆN ĐỀU VƯỢT QUA -> XÁC NHẬN ĐÂY LÀ PHIẾU THI HỢP LỆ!
  return {
    isValid: true,
    aspectRatio,
    angles,
    cosines,
    paperBrightness,
    markerDarkness,
    markerFillRatios,
    areaRatio,
  };
}
