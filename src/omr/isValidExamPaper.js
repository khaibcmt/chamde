/**
 * src/omr/isValidExamPaper.js
 * BỘ LỌC KIỂM DUYỆT TÍNH HỢP LỆ CỦA PHIẾU THI TRƯỚC KHI CHẤM (VALIDATION GATE - ES6 JS)
 * 
 * Tác giả: Thầy Hồ Tấn Khải - Trường THPT Mang Thít, Tỉnh Vĩnh Long
 */

export function calculateQuadArea(p0, p1, p2, p3) {
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

export function calculateCornerAngle(A, B, C) {
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

function getPixelLuminance(imageData, x, y) {
  const { width, height, data } = imageData;
  const px = Math.max(0, Math.min(width - 1, Math.round(x)));
  const py = Math.max(0, Math.min(height - 1, Math.round(y)));
  const idx = (py * width + px) * 4;
  return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
}

export function isValidExamPaper(corners, frameData, templateConfig = null) {
  const { width: fw, height: fh } = frameData;
  const frameArea = fw * fh;
  const pts = [corners.tl, corners.tr, corners.br, corners.bl];

  // 1. Tỷ lệ diện tích
  const quadArea = calculateQuadArea(pts[0], pts[1], pts[2], pts[3]);
  const areaRatio = quadArea / frameArea;
  if (areaRatio < 0.16 || areaRatio > 0.95) {
    return {
      isValid: false,
      areaRatio,
      failedCheck: 'area_ratio',
      reason: areaRatio < 0.16 ? 'Phiếu thi quá xa' : 'Phiếu thi quá gần',
    };
  }

  // 2. Góc vuông vức
  const cornerSpecs = [
    { name: 'TL', A: pts[3], B: pts[0], C: pts[1] },
    { name: 'TR', A: pts[0], B: pts[1], C: pts[2] },
    { name: 'BR', A: pts[1], B: pts[2], C: pts[3] },
    { name: 'BL', A: pts[2], B: pts[3], C: pts[0] },
  ];

  const angles = [];
  const cosines = [];
  let isAngleValid = true;

  for (const cs of cornerSpecs) {
    const { angleDeg, cosTheta } = calculateCornerAngle(cs.A, cs.B, cs.C);
    angles.push(angleDeg);
    cosines.push(cosTheta);
    if (Math.abs(cosTheta) > 0.28 || angleDeg < 74 || angleDeg > 106) {
      isAngleValid = false;
    }
  }

  if (!isAngleValid) {
    return {
      isValid: false,
      angles,
      cosines,
      areaRatio,
      failedCheck: 'corner_angle',
      reason: '4 góc chưa vuông vức 74°-106°',
    };
  }

  // 3. Tỷ lệ khung hình
  const topEdge = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
  const rightEdge = Math.hypot(pts[2].x - pts[1].x, pts[2].y - pts[1].y);
  const bottomEdge = Math.hypot(pts[2].x - pts[3].x, pts[2].y - pts[3].y);
  const leftEdge = Math.hypot(pts[0].x - pts[3].x, pts[0].y - pts[3].y);

  const avgW = (topEdge + bottomEdge) / 2;
  const avgH = (rightEdge + leftEdge) / 2;
  const aspectRatio = Math.max(avgW, avgH) / Math.max(1, Math.min(avgW, avgH));

  let minRatio = 1.20;
  let maxRatio = 2.25;
  if (templateConfig?.group === 'Khổ dọc A4 Chuẩn') {
    minRatio = 1.20;
    maxRatio = 1.68;
  } else if (templateConfig?.group === 'Khổ ngang (2 bài/A4)') {
    minRatio = 1.50;
    maxRatio = 2.25;
  }

  if (aspectRatio < minRatio || aspectRatio > maxRatio) {
    return {
      isValid: false,
      aspectRatio,
      areaRatio,
      failedCheck: 'aspect_ratio',
      reason: `Tỷ lệ cạnh không khớp phiếu thi (${aspectRatio.toFixed(2)})`,
    };
  }

  // 4. Độ sáng nền giấy trắng
  const gx = (pts[0].x + pts[1].x + pts[2].x + pts[3].x) / 4;
  const gy = (pts[0].y + pts[1].y + pts[2].y + pts[3].y) / 4;
  let paperLumaSum = 0;
  let paperSampleCount = 0;
  const sampleFactors = [0, 0.35, 0.60];
  for (const factor of sampleFactors) {
    if (factor === 0) {
      paperLumaSum += getPixelLuminance(frameData, gx, gy);
      paperSampleCount++;
    } else {
      for (const p of pts) {
        paperLumaSum += getPixelLuminance(frameData, gx + (p.x - gx) * factor, gy + (p.y - gy) * factor);
        paperSampleCount++;
      }
    }
  }

  const paperBrightness = paperLumaSum / Math.max(1, paperSampleCount);
  if (paperBrightness < 95) {
    return {
      isValid: false,
      aspectRatio,
      paperBrightness,
      areaRatio,
      failedCheck: 'paper_brightness',
      reason: 'Độ sáng bề mặt quá thấp, không phải giấy trắng',
    };
  }

  // 5. Kiểm tra 4 ô vuông đen định vị
  const markerRadius = Math.max(6, Math.min(22, Math.round(Math.min(avgW, avgH) * 0.032)));
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
        if (luma < 125) darkPixelCount++;
      }
    }

    const avgMarkerDarkness = markerLumaSum / Math.max(1, totalSampled);
    const fillRatio = darkPixelCount / Math.max(1, totalSampled);
    const contrast = paperBrightness - avgMarkerDarkness;
    if ((avgMarkerDarkness < 135 || fillRatio >= 0.32) && contrast >= 15) {
      validMarkersCount++;
    }
  }

  if (validMarkersCount < 3) {
    return {
      isValid: false,
      aspectRatio,
      areaRatio,
      failedCheck: 'fiducial_markers',
      reason: `Chưa có đủ mốc đen định vị góc (${validMarkersCount}/4)`,
    };
  }

  return {
    isValid: true,
    aspectRatio,
    paperBrightness,
    areaRatio,
  };
}
