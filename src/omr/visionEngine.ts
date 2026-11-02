import {
  AnswerKeyData,
  BubblePoint,
  CustomScoringConfig,
  getDefaultScoringConfig,
  getTemplateBubbleMap,
  renderVectorFallbackSheet1024x550,
  TARGET_CORNERS_1024x550,
  TemplateId,
  TEMPLATES,
} from './templates';

export interface Point2D {
  x: number;
  y: number;
}

export interface DetectedCorners {
  found: boolean;
  anchorCount: number;
  locks: {
    tl: boolean;
    tr: boolean;
    bl: boolean;
    br: boolean;
  };
  tl: Point2D;
  tr: Point2D;
  bl: Point2D;
  br: Point2D;
}

export interface OMRSettings {
  fillThreshold: number; // default 0.36
  offsetX: number;
  offsetY: number;
  radiusScale: number;
}

export interface P1QuestionResult {
  qIndex: number; // 1..N
  studentAnswer: string; // 'A' | 'B' | 'C' | 'D' | '' | 'DOUBLE'
  correctAnswer: string;
  isCorrect: boolean;
  status: 'correct' | 'wrong' | 'blank' | 'double';
  fillRatios: number[];
}

export interface P2QuestionResult {
  qIndex: number; // 1..8
  subResults: {
    subKey: 'a' | 'b' | 'c' | 'd';
    studentAnswer: 'D' | 'S' | '' | 'DOUBLE';
    correctAnswer: 'D' | 'S';
    isCorrect: boolean;
  }[];
  correctSubCount: number;
  pointsEarned: number;
}

export interface P3QuestionResult {
  qIndex: number; // 1..6
  studentString: string; // e.g. "28,1"
  correctValue: number | string;
  isCorrect: boolean;
  pointsEarned: number;
}

export interface interfaceGradedSheetRecord {
  id: string;
  timestamp: string;
  templateId: TemplateId;
  sbd: string;
  sbdClassPrefix: string; // 2 chữ số đầu của SBD nhận diện lớp
  sbdStudentOrder: number | null; // Số thứ tự học sinh trích xuất từ SBD
  studentName?: string;
  className?: string;
  subjectName?: string;
  examPeriod?: string;
  examCode: string;
  matchedKeyFound: boolean;
  p1Score: number;
  p1CorrectCount: number;
  p1TotalCount: number;
  p2Score: number;
  p3Score: number;
  p3CorrectCount: number;
  p3TotalCount: number;
  totalScore: number;
  p1Details: P1QuestionResult[];
  p2Details: P2QuestionResult[];
  p3Details: P3QuestionResult[];
  warnings: string[];
  annotatedImageDataUrl: string;
}

/**
 * Tách Mã Lớp (2 chữ số đầu) và Số Thứ Tự (STT) từ chuỗi Số Báo Danh (SBD)
 * Ví dụ: SBD "010015" -> prefix = "01", stt = 15
 * Ví dụ: SBD "0218" hoặc "02000018" -> prefix = "02", stt = 18
 */
export function parseSbdToClassAndStt(rawSbd: string): {
  sbdClassPrefix: string;
  sbdStudentOrder: number | null;
} {
  const digitsOnly = rawSbd.replace(/[^0-9]/g, '');
  if (digitsOnly.length < 3) {
    return {
      sbdClassPrefix: digitsOnly.slice(0, 2),
      sbdStudentOrder: null,
    };
  }
  const sbdClassPrefix = digitsOnly.slice(0, 2);
  const restDigits = digitsOnly.slice(2);
  const parsedOrder = parseInt(restDigits, 10);
  return {
    sbdClassPrefix,
    sbdStudentOrder: Number.isNaN(parsedOrder) ? null : parsedOrder,
  };
}

/**
 * Tìm AnswerKey khớp với mã đề (hỗ trợ đối sánh linh hoạt 3 số và 4 số: "0101" <-> "101")
 */
export function findMatchingAnswerKey(
  examCode: string,
  answerKeys: Record<string, AnswerKeyData>
): AnswerKeyData | undefined {
  if (answerKeys[examCode]) return answerKeys[examCode];
  const trimmed = examCode.replace(/\?/g, '').trim();
  if (answerKeys[trimmed]) return answerKeys[trimmed];
  if (trimmed.length === 4 && trimmed.startsWith('0')) {
    const code3 = trimmed.slice(1);
    if (answerKeys[code3]) return answerKeys[code3];
  }
  if (trimmed.length === 3) {
    const code4 = trimmed.padStart(4, '0');
    if (answerKeys[code4]) return answerKeys[code4];
  }
  return undefined;
}

/**
 * 1. BẮT 4 GÓC ĐỊNH VỊ VUÔNG ĐEN BẰNG INTEGRAL IMAGE ADAPTIVE THRESHOLD
 */
export function detectFourCornerMarkers(imageData: ImageData): DetectedCorners {
  const { width, height, data } = imageData;
  const size = width * height;
  const gray = new Uint8Array(size);
  const integral = new Float64Array(size);

  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    const rowOffset = y * width;
    const prevRowOffset = (y - 1) * width;
    for (let x = 0; x < width; x++) {
      const idx = rowOffset + x;
      const p = idx * 4;
      const lum = Math.round(0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]);
      gray[idx] = lum;
      rowSum += lum;
      integral[idx] = rowSum + (y > 0 ? integral[prevRowOffset + x] : 0);
    }
  }

  const bin = new Uint8Array(size);
  const win = Math.max(12, Math.round(Math.min(width, height) / 28));
  const tFactor = 0.72;

  for (let y = 0; y < height; y++) {
    const y1 = Math.max(0, y - win);
    const y2 = Math.min(height - 1, y + win);
    for (let x = 0; x < width; x++) {
      const x1 = Math.max(0, x - win);
      const x2 = Math.min(width - 1, x + win);
      const count = (x2 - x1) * (y2 - y1);
      const sum =
        integral[y2 * width + x2] -
        integral[y1 * width + x2] -
        integral[y2 * width + x1] +
        integral[y1 * width + x1];
      const idx = y * width + x;
      if (gray[idx] * count < sum * tFactor && gray[idx] < 145) {
        bin[idx] = 1;
      }
    }
  }

  const visited = new Uint8Array(size);
  // Cho phép nhận diện ô vuông neo từ nhỏ (1.0% khung hình) đến vừa (18% khung hình)
  const minSide = Math.max(5, Math.round(Math.min(width, height) * 0.009));
  const maxSide = Math.round(Math.min(width, height) * 0.18);

  interface CandidateSquare {
    cx: number;
    cy: number;
    bw: number;
    bh: number;
    area: number;
    fill: number;
    count: number;
    score: number;
  }

  const candidates: CandidateSquare[] = [];
  const stack = new Int32Array(size);

  for (let y = 2; y < height - 2; y += 2) {
    for (let x = 2; x < width - 2; x += 2) {
      const startIdx = y * width + x;
      if (bin[startIdx] && !visited[startIdx]) {
        let minX = x,
          maxX = x,
          minY = y,
          maxY = y,
          count = 0;
        let sp = 0;
        stack[sp++] = startIdx;
        visited[startIdx] = 1;

        while (sp > 0) {
          const cur = stack[--sp];
          const cy = Math.floor(cur / width);
          const cx = cur % width;
          count++;
          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;

          if (cx > 0 && bin[cur - 1] && !visited[cur - 1]) {
            visited[cur - 1] = 1;
            stack[sp++] = cur - 1;
          }
          if (cx < width - 1 && bin[cur + 1] && !visited[cur + 1]) {
            visited[cur + 1] = 1;
            stack[sp++] = cur + 1;
          }
          if (cy > 0 && bin[cur - width] && !visited[cur - width]) {
            visited[cur - width] = 1;
            stack[sp++] = cur - width;
          }
          if (cy < height - 1 && bin[cur + width] && !visited[cur + width]) {
            visited[cur + width] = 1;
            stack[sp++] = cur + width;
          }
        }

        const bw = maxX - minX + 1;
        const bh = maxY - minY + 1;
        const aspect = bw / bh;
        const bboxArea = bw * bh;
        const fill = count / bboxArea;

        // Ô vuông mốc neo đen trên phiếu in chuẩn: hình vuông hoặc gần vuông, độ đặc cao (fill >= 0.52)
        if (
          bw >= minSide &&
          bw <= maxSide &&
          bh >= minSide &&
          bh <= maxSide &&
          aspect >= 0.55 &&
          aspect <= 1.80 &&
          fill >= 0.52
        ) {
          const aspectDist = Math.abs(1 - aspect);
          const qualityScore = bboxArea * fill * (1 - aspectDist * 0.4);
          candidates.push({
            cx: (minX + maxX) / 2,
            cy: (minY + maxY) / 2,
            bw,
            bh,
            area: bboxArea,
            fill,
            count,
            score: qualityScore,
          });
        }
      }
    }
  }

  const defaultFallback: DetectedCorners = {
    found: false,
    anchorCount: 0,
    locks: { tl: false, tr: false, bl: false, br: false },
    tl: { x: width * 0.08, y: height * 0.08 },
    tr: { x: width * 0.92, y: height * 0.08 },
    bl: { x: width * 0.08, y: height * 0.92 },
    br: { x: width * 0.92, y: height * 0.92 },
  };

  if (candidates.length < 3) {
    return defaultFallback;
  }

  // Sắp xếp các ứng viên theo điểm chất lượng giảm dần
  candidates.sort((a, b) => b.score - a.score);

  // Lọc tập ứng viên sáng giá nhất (top 16)
  const topPool = candidates.slice(0, 16);

  // Helper tính diện tích tứ giác lồi bằng Shoelace Formula
  const computeQuadArea = (p0: Point2D, p1: Point2D, p2: Point2D, p3: Point2D) => {
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
  };

  // Helper kiểm tra tính lồi (Convexity)
  const isConvexQuad = (p0: Point2D, p1: Point2D, p2: Point2D, p3: Point2D) => {
    const pts = [p0, p1, p2, p3];
    let sign = 0;
    for (let i = 0; i < 4; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % 4];
      const c = pts[(i + 2) % 4];
      const cp = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
      if (Math.abs(cp) > 1e-4) {
        if (sign === 0) sign = cp > 0 ? 1 : -1;
        else if ((cp > 0 ? 1 : -1) !== sign) return false;
      }
    }
    return true;
  };

  let bestQuad: {
    p0: Point2D;
    p1: Point2D;
    p2: Point2D;
    p3: Point2D;
    score: number;
    area: number;
  } | null = null;

  // 1. Thử tất cả các bộ 4 đỉnh trong topPool
  const N = topPool.length;
  for (let i = 0; i < N - 3; i++) {
    for (let j = i + 1; j < N - 2; j++) {
      for (let k = j + 1; k < N - 1; k++) {
        for (let l = k + 1; l < N; l++) {
          const rawPts = [topPool[i], topPool[j], topPool[k], topPool[l]];
          const midX = (rawPts[0].cx + rawPts[1].cx + rawPts[2].cx + rawPts[3].cx) / 4;
          const midY = (rawPts[0].cy + rawPts[1].cy + rawPts[2].cy + rawPts[3].cy) / 4;

          // Sắp xếp 4 điểm theo thứ tự chiều kim đồng hồ quanh tâm
          rawPts.sort(
            (a, b) =>
              Math.atan2(a.cy - midY, a.cx - midX) - Math.atan2(b.cy - midY, b.cx - midX)
          );

          const p0 = { x: rawPts[0].cx, y: rawPts[0].cy };
          const p1 = { x: rawPts[1].cx, y: rawPts[1].cy };
          const p2 = { x: rawPts[2].cx, y: rawPts[2].cy };
          const p3 = { x: rawPts[3].cx, y: rawPts[3].cy };

          if (!isConvexQuad(p0, p1, p2, p3)) continue;

          const quadArea = computeQuadArea(p0, p1, p2, p3);
          const frameArea = width * height;
          // Tờ phiếu phải chiếm tối thiểu 10% khung hình camera
          if (quadArea < frameArea * 0.10) continue;

          const edge01 = Math.hypot(p1.x - p0.x, p1.y - p0.y);
          const edge12 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          const edge23 = Math.hypot(p3.x - p2.x, p3.y - p2.y);
          const edge30 = Math.hypot(p0.x - p3.x, p0.y - p3.y);

          const wRatio = edge01 / Math.max(1, edge23);
          const hRatio = edge12 / Math.max(1, edge30);
          if (wRatio < 0.55 || wRatio > 1.85 || hRatio < 0.55 || hRatio > 1.85) continue;

          // Độ đồng đều diện tích của 4 ô vuông đen (phải tương đồng trên cùng 1 phiếu)
          const cAreas = [rawPts[0].area, rawPts[1].area, rawPts[2].area, rawPts[3].area];
          const minA = Math.min(...cAreas);
          const maxA = Math.max(...cAreas);
          if (minA / Math.max(1, maxA) < 0.20) continue;

          const combinedScore =
            rawPts.reduce((acc, p) => acc + p.score, 0) + (quadArea / frameArea) * 600;

          if (!bestQuad || combinedScore > bestQuad.score) {
            bestQuad = { p0, p1, p2, p3, score: combinedScore, area: quadArea };
          }
        }
      }
    }
  }

  // 2. Cơ chế suy luận hình bình hành khi chỉ thấy 3 mốc (3-out-of-4 Fallback Recovery)
  if (!bestQuad && topPool.length >= 3) {
    const pA = topPool[0];
    const pB = topPool[1];
    const pC = topPool[2];

    // Điểm thứ 4 dự đoán bằng tính chất vector hình bình hành
    const pD_pred1 = { x: pA.cx + pC.cx - pB.cx, y: pA.cy + pC.cy - pB.cy };
    const pD_pred2 = { x: pB.cx + pC.cx - pA.cx, y: pB.cy + pC.cy - pA.cy };
    const pD_pred3 = { x: pA.cx + pB.cx - pC.cx, y: pA.cy + pB.cy - pC.cy };

    const validPredictions = [pD_pred1, pD_pred2, pD_pred3].filter(
      (pt) => pt.x >= 0 && pt.x < width && pt.y >= 0 && pt.y < height
    );

    for (const pred of validPredictions) {
      const pts = [
        { x: pA.cx, y: pA.cy },
        { x: pB.cx, y: pB.cy },
        { x: pC.cx, y: pC.cy },
        pred,
      ];
      const midX = (pts[0].x + pts[1].x + pts[2].x + pts[3].x) / 4;
      const midY = (pts[0].y + pts[1].y + pts[2].y + pts[3].y) / 4;
      pts.sort(
        (a, b) => Math.atan2(a.y - midY, a.x - midX) - Math.atan2(b.y - midY, b.x - midX)
      );

      const p0 = pts[0],
        p1 = pts[1],
        p2 = pts[2],
        p3 = pts[3];
      if (isConvexQuad(p0, p1, p2, p3)) {
        const quadArea = computeQuadArea(p0, p1, p2, p3);
        if (quadArea >= width * height * 0.10) {
          bestQuad = { p0, p1, p2, p3, score: 300, area: quadArea };
          break;
        }
      }
    }
  }

  if (!bestQuad) {
    // Trả về số lượng mốc neo thực tế tìm thấy để thông báo giao diện
    const count = Math.min(candidates.length, 3);
    return {
      found: false,
      anchorCount: count,
      locks: {
        tl: count >= 1,
        tr: count >= 2,
        bl: count >= 3,
        br: false,
      },
      tl: candidates[0] ? { x: candidates[0].cx, y: candidates[0].cy } : defaultFallback.tl,
      tr: candidates[1] ? { x: candidates[1].cx, y: candidates[1].cy } : defaultFallback.tr,
      bl: candidates[2] ? { x: candidates[2].cx, y: candidates[2].cy } : defaultFallback.bl,
      br: defaultFallback.br,
    };
  }

  // 3. Tự động xác định góc xoay (Orientation) & Ánh xạ đúng 4 góc TL, TR, BR, BL của tờ phiếu
  const { p0, p1, p2, p3 } = bestQuad;
  const orderedPts = [p0, p1, p2, p3];

  // Tính chiều dài cạnh ngang (P0->P1 và P3->P2) so với cạnh dọc (P1->P2 và P0->P3)
  const wSide =
    0.5 *
    (Math.hypot(orderedPts[1].x - orderedPts[0].x, orderedPts[1].y - orderedPts[0].y) +
      Math.hypot(orderedPts[2].x - orderedPts[3].x, orderedPts[2].y - orderedPts[3].y));
  const hSide =
    0.5 *
    (Math.hypot(orderedPts[3].x - orderedPts[0].x, orderedPts[3].y - orderedPts[0].y) +
      Math.hypot(orderedPts[2].x - orderedPts[1].x, orderedPts[2].y - orderedPts[1].y));

  // Tờ phiếu Khổ ngang (1024x550) khi cầm điện thoại dọc sẽ có hSide > wSide (xoay 90 độ)
  const isHeldVertically = hSide > wSide * 1.08;

  // Mẫu mật độ mực đen ở 2 đầu cạnh ngắn để phát hiện đầu nào là Mã Đề / Tiêu đề (Left header)
  const sampleDensity = (ptA: Point2D, ptB: Point2D) => {
    let dark = 0;
    const steps = 14;
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const qx = Math.round(ptA.x + (ptB.x - ptA.x) * t);
      const qy = Math.round(ptA.y + (ptB.y - ptA.y) * t);
      for (let dy = -8; dy <= 8; dy += 2) {
        for (let dx = -8; dx <= 8; dx += 2) {
          const sx = Math.max(0, Math.min(width - 1, qx + dx));
          const sy = Math.max(0, Math.min(height - 1, qy + dy));
          if (gray[sy * width + sx] < 135) dark++;
        }
      }
    }
    return dark;
  };

  let mappedTL: Point2D;
  let mappedTR: Point2D;
  let mappedBR: Point2D;
  let mappedBL: Point2D;

  if (isHeldVertically) {
    // Phiếu nằm dọc theo màn hình điện thoại (xoay 90 độ):
    // Cạnh P0->P1 (ở trên) so với cạnh P3->P2 (ở dưới)
    const darkTop = sampleDensity(orderedPts[0], orderedPts[1]);
    const darkBottom = sampleDensity(orderedPts[3], orderedPts[2]);

    if (darkTop >= darkBottom) {
      // Đầu Mã Đề & SBD nằm ở phía trên camera:
      // TL tờ phiếu = P1, TR tờ phiếu = P2, BR tờ phiếu = P3, BL tờ phiếu = P0
      mappedTL = orderedPts[1];
      mappedTR = orderedPts[2];
      mappedBR = orderedPts[3];
      mappedBL = orderedPts[0];
    } else {
      // Đầu Mã Đề & SBD nằm ở phía dưới camera:
      // TL tờ phiếu = P3, TR tờ phiếu = P0, BR tờ phiếu = P1, BL tờ phiếu = P2
      mappedTL = orderedPts[3];
      mappedTR = orderedPts[0];
      mappedBR = orderedPts[1];
      mappedBL = orderedPts[2];
    }
  } else {
    // Phiếu nằm ngang chuẩn theo màn hình:
    const darkLeft = sampleDensity(orderedPts[0], orderedPts[3]);
    const darkRight = sampleDensity(orderedPts[1], orderedPts[2]);

    if (darkLeft >= darkRight) {
      // Chiều chuẩn 0 độ:
      mappedTL = orderedPts[0];
      mappedTR = orderedPts[1];
      mappedBR = orderedPts[2];
      mappedBL = orderedPts[3];
    } else {
      // Xoay ngược 180 độ:
      mappedTL = orderedPts[2];
      mappedTR = orderedPts[3];
      mappedBR = orderedPts[0];
      mappedBL = orderedPts[1];
    }
  }

  return {
    found: true,
    anchorCount: 4,
    locks: { tl: true, tr: true, bl: true, br: true },
    tl: mappedTL,
    tr: mappedTR,
    br: mappedBR,
    bl: mappedBL,
  };
}

/**
 * 2. GIẢI MA TRẬN HOMOGRAPHY 8-DOF & NẮN PHẲNG PERSPECTIVE TRANSFORM VỀ 1024 x 550
 */
function solveHomography8x8(srcPts: Point2D[], dstPts: Point2D[]): number[] {
  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const x = dstPts[i].x;
    const y = dstPts[i].y;
    const u = srcPts[i].x;
    const v = srcPts[i].y;

    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }

  const n = 8;
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) {
        maxRow = k;
      }
    }
    [A[i], A[maxRow]] = [A[maxRow], A[i]];
    [b[i], b[maxRow]] = [b[maxRow], b[i]];

    const pivot = A[i][i] || 1e-12;
    for (let k = i + 1; k < n; k++) {
      const factor = A[k][i] / pivot;
      b[k] -= factor * b[i];
      for (let j = i; j < n; j++) {
        A[k][j] -= factor * A[i][j];
      }
    }
  }

  const h = new Array(8).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = b[i];
    for (let j = i + 1; j < n; j++) {
      sum -= A[i][j] * h[j];
    }
    h[i] = sum / (A[i][i] || 1e-12);
  }

  return [...h, 1];
}

export function warpPerspectiveTo1024x550(
  srcImageData: ImageData,
  corners: DetectedCorners
): HTMLCanvasElement {
  const dstW = TARGET_CORNERS_1024x550.width;
  const dstH = TARGET_CORNERS_1024x550.height;

  const canvas = document.createElement('canvas');
  canvas.width = dstW;
  canvas.height = dstH;
  const ctx = canvas.getContext('2d')!;
  const dstImgData = ctx.createImageData(dstW, dstH);
  const dstData = dstImgData.data;

  const srcW = srcImageData.width;
  const srcH = srcImageData.height;
  const srcData = srcImageData.data;

  const srcPts = [corners.tl, corners.tr, corners.bl, corners.br];
  const dstPts = [
    TARGET_CORNERS_1024x550.tl,
    TARGET_CORNERS_1024x550.tr,
    TARGET_CORNERS_1024x550.bl,
    TARGET_CORNERS_1024x550.br,
  ];

  const H = solveHomography8x8(srcPts, dstPts);
  const [h0, h1, h2, h3, h4, h5, h6, h7] = H;

  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const denom = h6 * x + h7 * y + 1.0;
      const sx = (h0 * x + h1 * y + h2) / denom;
      const sy = (h3 * x + h4 * y + h5) / denom;

      const dstIdx = (y * dstW + x) * 4;
      const ix = Math.floor(sx);
      const iy = Math.floor(sy);

      if (ix >= 0 && ix < srcW - 1 && iy >= 0 && iy < srcH - 1) {
        const fx = sx - ix;
        const fy = sy - iy;
        const w00 = (1 - fx) * (1 - fy);
        const w10 = fx * (1 - fy);
        const w01 = (1 - fx) * fy;
        const w11 = fx * fy;

        const idx00 = (iy * srcW + ix) * 4;
        const idx10 = idx00 + 4;
        const idx01 = idx00 + srcW * 4;
        const idx11 = idx01 + 4;

        dstData[dstIdx] =
          srcData[idx00] * w00 + srcData[idx10] * w10 + srcData[idx01] * w01 + srcData[idx11] * w11;
        dstData[dstIdx + 1] =
          srcData[idx00 + 1] * w00 +
          srcData[idx10 + 1] * w10 +
          srcData[idx01 + 1] * w01 +
          srcData[idx11 + 1] * w11;
        dstData[dstIdx + 2] =
          srcData[idx00 + 2] * w00 +
          srcData[idx10 + 2] * w10 +
          srcData[idx01 + 2] * w01 +
          srcData[idx11 + 2] * w11;
        dstData[dstIdx + 3] = 255;
      } else {
        dstData[dstIdx] = 255;
        dstData[dstIdx + 1] = 255;
        dstData[dstIdx + 2] = 255;
        dstData[dstIdx + 3] = 255;
      }
    }
  }

  ctx.putImageData(dstImgData, 0, 0);
  return canvas;
}

/**
 * 3. ĐO MẬT ĐỘ ĐIỂM ĐEN TRONG Ô TRÒN (BUBBLE FILL RATIO)
 */
function measureBubbleFill(
  gray: Uint8Array,
  width: number,
  height: number,
  bubble: BubblePoint
): number {
  const cx = Math.round(bubble.x);
  const cy = Math.round(bubble.y);
  const innerR = Math.max(2.6, bubble.r * 0.72);
  const innerR2 = innerR * innerR;
  const bgR1 = bubble.r * 1.25;
  const bgR2 = bubble.r * 1.75;
  const bgR1Sq = bgR1 * bgR1;
  const bgR2Sq = bgR2 * bgR2;

  let innerSum = 0;
  let innerCount = 0;
  let darkPixels = 0;

  let bgSum = 0;
  let bgCount = 0;

  const maxRad = Math.ceil(bgR2);
  for (let dy = -maxRad; dy <= maxRad; dy++) {
    const py = cy + dy;
    if (py < 0 || py >= height) continue;
    for (let dx = -maxRad; dx <= maxRad; dx++) {
      const px = cx + dx;
      if (px < 0 || px >= width) continue;
      const d2 = dx * dx + dy * dy;
      const lum = gray[py * width + px];
      if (d2 <= innerR2) {
        innerSum += lum;
        innerCount++;
        if (lum < 155) darkPixels++;
      } else if (d2 >= bgR1Sq && d2 <= bgR2Sq) {
        bgSum += lum;
        bgCount++;
      }
    }
  }

  if (innerCount === 0) return 0;
  const avgInner = innerSum / innerCount;
  const avgBg = bgCount > 0 ? Math.max(180, bgSum / bgCount) : 235;

  const relativeDrop = Math.max(0, (avgBg - avgInner) / avgBg);
  const darkRatio = darkPixels / innerCount;
  return Math.min(1, relativeDrop * 0.65 + darkRatio * 0.55);
}

/**
 * Chuẩn hóa chuỗi đáp án Phần III để so sánh chính xác
 */
export function isP3AnswerMatch(studentStr: string, correctVal: number | string): boolean {
  if (!studentStr || studentStr.includes('?')) return false;
  const cleanStudent = studentStr.trim().replace(',', '.');
  const cleanKey = String(correctVal).trim().replace(',', '.');

  if (cleanStudent === cleanKey) return true;

  const keyTrunc4 = cleanKey.slice(0, 4);
  if (cleanStudent === keyTrunc4) return true;

  const numStudent = Number(cleanStudent);
  const numKey = Number(cleanKey);
  if (!Number.isNaN(numStudent) && !Number.isNaN(numKey)) {
    if (Math.abs(numStudent - numKey) <= 0.001) return true;
    if (cleanKey.length > 4) {
      const decimalsIn4 = Math.max(0, 4 - cleanKey.indexOf('.') - 1);
      const roundedKey = Number(numKey.toFixed(decimalsIn4));
      if (Math.abs(numStudent - roundedKey) <= 1e-6) return true;
    }
  }
  return false;
}

/**
 * 4. CHẤM ĐIỂM TOÀN BỘ TỜ PHIẾU ĐÃ NẮN PHẲNG (1024 x 550) & VẼ OVERLAY TRỰC QUAN
 */
export function gradeWarpedSheet(
  warpedCanvas: HTMLCanvasElement,
  templateId: TemplateId,
  answerKeys: Record<string, AnswerKeyData>,
  settings: OMRSettings,
  scoringConfig?: CustomScoringConfig
): interfaceGradedSheetRecord {
  const width = warpedCanvas.width;
  const height = warpedCanvas.height;
  const ctx = warpedCanvas.getContext('2d')!;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const gray = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    gray[i] = Math.round(0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]);
  }

  const tpl = TEMPLATES[templateId];
  const cfg = scoringConfig || getDefaultScoringConfig(templateId);
  const activeP1Count = Math.min(tpl.p1Count, Math.max(0, cfg.activeP1Count));
  const activeP2Count = Math.min(tpl.p2Count, Math.max(0, cfg.activeP2Count));
  const activeP3Count = Math.min(tpl.p3Count, Math.max(0, cfg.activeP3Count));

  const map = getTemplateBubbleMap(
    templateId,
    settings.offsetX,
    settings.offsetY,
    settings.radiusScale
  );
  const thresh = settings.fillThreshold;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = width;
  outCanvas.height = height;
  const outCtx = outCanvas.getContext('2d')!;
  outCtx.drawImage(warpedCanvas, 0, 0);

  const cornerList = [
    TARGET_CORNERS_1024x550.tl,
    TARGET_CORNERS_1024x550.tr,
    TARGET_CORNERS_1024x550.bl,
    TARGET_CORNERS_1024x550.br,
  ];
  for (const c of cornerList) {
    outCtx.strokeStyle = '#10b981';
    outCtx.lineWidth = 2.5;
    outCtx.strokeRect(c.x - 13, c.y - 13, 26, 26);
  }

  const warnings: string[] = [];

  // A. Đọc Mã Đề (3 hoặc 4 cột tùy mẫu phiếu)
  const maDeColCount = map.maDe.length;
  let examCode = '';
  if (maDeColCount === 0) {
    examCode = Object.keys(answerKeys)[0] || '101';
  } else {
    for (let col = 0; col < maDeColCount; col++) {
      const fills = map.maDe[col].map((b) => measureBubbleFill(gray, width, height, b));
      const maxFill = Math.max(...fills);
      const maxIdx = fills.indexOf(maxFill);
      if (maxFill >= thresh * 0.85) {
        examCode += String(maxIdx);
        const b = map.maDe[col][maxIdx];
        outCtx.strokeStyle = '#10b981';
        outCtx.lineWidth = 2.2;
        outCtx.beginPath();
        outCtx.arc(b.x, b.y, b.r + 1.5, 0, Math.PI * 2);
        outCtx.stroke();
      } else {
        examCode += '?';
      }
    }
  }

  // B. Đọc Số Báo Danh (6 hoặc 8 cột tùy mẫu phiếu)
  const sbdColCount = map.sbd.length;
  let rawSbd = '';
  if (sbdColCount === 0) {
    rawSbd = '010001';
  } else {
    for (let col = 0; col < sbdColCount; col++) {
      const fills = map.sbd[col].map((b) => measureBubbleFill(gray, width, height, b));
      const maxFill = Math.max(...fills);
      const maxIdx = fills.indexOf(maxFill);
      if (maxFill >= thresh * 0.85) {
        rawSbd += String(maxIdx);
        const b = map.sbd[col][maxIdx];
        outCtx.strokeStyle = '#10b981';
        outCtx.lineWidth = 2.2;
        outCtx.beginPath();
        outCtx.arc(b.x, b.y, b.r + 1.5, 0, Math.PI * 2);
        outCtx.stroke();
      } else {
        rawSbd += '?';
      }
    }
  }

  // Nếu trên phiếu 8 cột mà học sinh chỉ tô 6 cột đầu (2 cột cuối để trống), tự động cắt gọn
  const sbd =
    sbdColCount === 8 && rawSbd.endsWith('??') && !rawSbd.slice(0, 6).includes('?')
      ? rawSbd.slice(0, 6)
      : rawSbd;

  if (maDeColCount > 0 && examCode.includes('?')) {
    warnings.push(`Mã đề chưa tô đủ ${maDeColCount} chữ số (${examCode})`);
  }
  if (sbdColCount > 0 && sbd.includes('?')) {
    warnings.push(`SBD có cột chưa tô (${sbd})`);
  }

  const { sbdClassPrefix, sbdStudentOrder } = parseSbdToClassAndStt(sbd);

  const matchedKey = findMatchingAnswerKey(examCode, answerKeys);
  const activeKey: AnswerKeyData | undefined =
    matchedKey || Object.values(answerKeys)[0];
  const matchedKeyFound = Boolean(matchedKey);
  if (!matchedKeyFound && activeKey) {
    warnings.push(`Không tìm thấy mã đề ${examCode}, đang đối chiếu tạm với mã đề ${activeKey.examCode}`);
  }

  // C. Chấm Phần I (theo số câu tùy chỉnh activeP1Count)
  const choices = ['A', 'B', 'C', 'D'];
  const p1Details: P1QuestionResult[] = [];
  let p1CorrectCount = 0;

  for (let q = 0; q < activeP1Count; q++) {
    const rowBubbles = map.p1[q];
    if (!rowBubbles) continue;
    const fills = rowBubbles.map((b) => measureBubbleFill(gray, width, height, b));
    const markedIndices = fills
      .map((f, idx) => (f >= thresh ? idx : -1))
      .filter((idx) => idx !== -1);

    const correctAns = activeKey?.p1[q] || 'A';
    const correctIdx = choices.indexOf(correctAns);

    let studentAnswer = '';
    let status: P1QuestionResult['status'] = 'blank';
    let isCorrect = false;

    if (markedIndices.length === 1) {
      studentAnswer = choices[markedIndices[0]];
      isCorrect = studentAnswer === correctAns;
      status = isCorrect ? 'correct' : 'wrong';
    } else if (markedIndices.length > 1) {
      studentAnswer = 'DOUBLE';
      status = 'double';
      warnings.push(`Phần I - Câu ${q + 1}: Tô đúp nhiều đáp án`);
    } else {
      const maxF = Math.max(...fills);
      const minF = Math.min(...fills);
      if (maxF >= thresh * 0.78 && maxF - minF > 0.16) {
        const idx = fills.indexOf(maxF);
        studentAnswer = choices[idx];
        isCorrect = studentAnswer === correctAns;
        status = isCorrect ? 'correct' : 'wrong';
      }
    }

    if (isCorrect) p1CorrectCount++;

    if (status === 'correct') {
      const b = rowBubbles[choices.indexOf(studentAnswer)];
      outCtx.fillStyle = 'rgba(16, 185, 129, 0.38)';
      outCtx.strokeStyle = '#10b981';
      outCtx.lineWidth = 2.2;
      outCtx.beginPath();
      outCtx.arc(b.x, b.y, b.r + 1.5, 0, Math.PI * 2);
      outCtx.fill();
      outCtx.stroke();
    } else {
      for (const mIdx of markedIndices) {
        const bWrong = rowBubbles[mIdx];
        outCtx.fillStyle = 'rgba(244, 63, 94, 0.38)';
        outCtx.strokeStyle = '#f43f5e';
        outCtx.lineWidth = 2.2;
        outCtx.beginPath();
        outCtx.arc(bWrong.x, bWrong.y, bWrong.r + 1.5, 0, Math.PI * 2);
        outCtx.fill();
        outCtx.stroke();
      }
      if (correctIdx >= 0 && rowBubbles[correctIdx]) {
        const bRight = rowBubbles[correctIdx];
        outCtx.strokeStyle = '#f59e0b';
        outCtx.lineWidth = 2;
        outCtx.beginPath();
        outCtx.arc(bRight.x, bRight.y, bRight.r + 1.5, 0, Math.PI * 2);
        outCtx.stroke();
      }
    }

    p1Details.push({
      qIndex: q + 1,
      studentAnswer,
      correctAnswer: correctAns,
      isCorrect,
      status,
      fillRatios: fills.map((f) => Math.round(f * 100)),
    });
  }

  const p1Score = p1CorrectCount * cfg.p1PointsPerQ;

  // D. Chấm Phần II (theo số câu activeP2Count và thang điểm p2PointsMap)
  const p2Details: P2QuestionResult[] = [];
  let p2Score = 0;
  const subKeys: ('a' | 'b' | 'c' | 'd')[] = ['a', 'b', 'c', 'd'];

  for (let q = 0; q < activeP2Count; q++) {
    const qMap = map.p2[q];
    if (!qMap) continue;
    let correctSubCount = 0;
    const subResults: P2QuestionResult['subResults'] = [];

    for (const sk of subKeys) {
      const [bD, bS] = qMap[sk];
      const fD = measureBubbleFill(gray, width, height, bD);
      const fS = measureBubbleFill(gray, width, height, bS);

      const markD = fD >= thresh;
      const markS = fS >= thresh;
      let studentAns: 'D' | 'S' | '' | 'DOUBLE' = '';

      if (markD && !markS) studentAns = 'D';
      else if (markS && !markD) studentAns = 'S';
      else if (markD && markS) {
        studentAns = 'DOUBLE';
        warnings.push(`Phần II - Câu ${q + 1}${sk}: Tô cả Đúng và Sai`);
      } else if (Math.max(fD, fS) >= thresh * 0.78 && Math.abs(fD - fS) > 0.15) {
        studentAns = fD > fS ? 'D' : 'S';
      }

      const correctAns: 'D' | 'S' = activeKey?.p2[q]?.[sk] || 'D';
      const isCorrect = studentAns === correctAns;
      if (isCorrect) correctSubCount++;

      const chosenBubble = studentAns === 'D' ? bD : studentAns === 'S' ? bS : null;
      const rightBubble = correctAns === 'D' ? bD : bS;

      if (isCorrect && chosenBubble) {
        outCtx.fillStyle = 'rgba(16, 185, 129, 0.38)';
        outCtx.strokeStyle = '#10b981';
        outCtx.lineWidth = 2;
        outCtx.beginPath();
        outCtx.arc(chosenBubble.x, chosenBubble.y, chosenBubble.r + 1.5, 0, Math.PI * 2);
        outCtx.fill();
        outCtx.stroke();
      } else {
        if (chosenBubble) {
          outCtx.fillStyle = 'rgba(244, 63, 94, 0.38)';
          outCtx.strokeStyle = '#f43f5e';
          outCtx.lineWidth = 2;
          outCtx.beginPath();
          outCtx.arc(chosenBubble.x, chosenBubble.y, chosenBubble.r + 1.5, 0, Math.PI * 2);
          outCtx.fill();
          outCtx.stroke();
        }
        outCtx.strokeStyle = '#f59e0b';
        outCtx.lineWidth = 2;
        outCtx.beginPath();
        outCtx.arc(rightBubble.x, rightBubble.y, rightBubble.r + 1.5, 0, Math.PI * 2);
        outCtx.stroke();
      }

      subResults.push({
        subKey: sk,
        studentAnswer: studentAns,
        correctAnswer: correctAns,
        isCorrect,
      });
    }

    const progressivePoints =
      correctSubCount >= 1 && correctSubCount <= 4
        ? cfg.p2PointsMap[correctSubCount - 1]
        : 0;

    p2Score += progressivePoints;
    p2Details.push({
      qIndex: q + 1,
      subResults,
      correctSubCount,
      pointsEarned: progressivePoints,
    });
  }

  // E. Chấm Phần III (theo số câu activeP3Count và điểm p3PointsPerQ)
  const p3Details: P3QuestionResult[] = [];
  let p3CorrectCount = 0;

  for (let q = 0; q < activeP3Count; q++) {
    const qMap = map.p3[q];
    if (!qMap) continue;
    let studentChars = '';
    const chosenBubbles: BubblePoint[] = [];

    for (let col = 0; col < 4; col++) {
      const candidatesForCol: { char: string; bubble: BubblePoint; fill: number }[] = [];
      if (col === 0) {
        candidatesForCol.push({
          char: '-',
          bubble: qMap.minus,
          fill: measureBubbleFill(gray, width, height, qMap.minus),
        });
      }
      if (col === 1) {
        candidatesForCol.push({
          char: ',',
          bubble: qMap.comma1,
          fill: measureBubbleFill(gray, width, height, qMap.comma1),
        });
      }
      if (col === 2) {
        candidatesForCol.push({
          char: ',',
          bubble: qMap.comma2,
          fill: measureBubbleFill(gray, width, height, qMap.comma2),
        });
      }
      for (let d = 0; d < 10; d++) {
        const b = qMap.digits[col][d];
        candidatesForCol.push({
          char: String(d),
          bubble: b,
          fill: measureBubbleFill(gray, width, height, b),
        });
      }

      candidatesForCol.sort((a, b) => b.fill - a.fill);
      if (candidatesForCol[0].fill >= thresh * 0.85) {
        studentChars += candidatesForCol[0].char;
        chosenBubbles.push(candidatesForCol[0].bubble);
      }
    }

    const correctVal = activeKey?.p3[q] ?? '';
    const isCorrect = isP3AnswerMatch(studentChars, correctVal);
    if (isCorrect) p3CorrectCount++;

    for (const b of chosenBubbles) {
      outCtx.fillStyle = isCorrect ? 'rgba(16, 185, 129, 0.38)' : 'rgba(244, 63, 94, 0.38)';
      outCtx.strokeStyle = isCorrect ? '#10b981' : '#f43f5e';
      outCtx.lineWidth = 2;
      outCtx.beginPath();
      outCtx.arc(b.x, b.y, b.r + 1.5, 0, Math.PI * 2);
      outCtx.fill();
      outCtx.stroke();
    }

    p3Details.push({
      qIndex: q + 1,
      studentString: studentChars,
      correctValue: correctVal,
      isCorrect,
      pointsEarned: isCorrect ? cfg.p3PointsPerQ : 0,
    });
  }

  const p3Score = p3CorrectCount * cfg.p3PointsPerQ;
  const totalScore = Math.round((p1Score + p2Score + p3Score) * 100) / 100;

  return {
    id: `OMR-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    templateId,
    sbd,
    sbdClassPrefix,
    sbdStudentOrder,
    examCode,
    matchedKeyFound,
    p1Score: Math.round(p1Score * 100) / 100,
    p1CorrectCount,
    p1TotalCount: activeP1Count,
    p2Score: Math.round(p2Score * 100) / 100,
    p3Score: Math.round(p3Score * 100) / 100,
    p3CorrectCount,
    p3TotalCount: activeP3Count,
    totalScore,
    p1Details,
    p2Details,
    p3Details,
    warnings,
    annotatedImageDataUrl: outCanvas.toDataURL('image/jpeg', 0.88),
  };
}

/**
 * 5. TÍNH LẠI ĐIỂM KHI GIÁO VIÊN SỬA NHANH BÀI LÀM TRÊN POPUP HUD
 */
export function recalculateRecordScore(
  record: interfaceGradedSheetRecord,
  answerKeys: Record<string, AnswerKeyData>,
  scoringConfig?: CustomScoringConfig
): interfaceGradedSheetRecord {
  const cfg = scoringConfig || getDefaultScoringConfig(record.templateId);
  const matchedKey = findMatchingAnswerKey(record.examCode, answerKeys);
  const key = matchedKey || Object.values(answerKeys)[0];

  let p1CorrectCount = 0;
  const p1Details = record.p1Details.map((item, idx) => {
    const correctAns = key?.p1[idx] || item.correctAnswer;
    const isCorrect = item.studentAnswer === correctAns;
    if (isCorrect) p1CorrectCount++;
    return {
      ...item,
      correctAnswer: correctAns,
      isCorrect,
      status: (item.studentAnswer === ''
        ? 'blank'
        : isCorrect
        ? 'correct'
        : 'wrong') as P1QuestionResult['status'],
    };
  });

  const p1Score = p1CorrectCount * cfg.p1PointsPerQ;

  let p2Score = 0;
  const p2Details = record.p2Details.map((item, idx) => {
    let correctSubCount = 0;
    const subResults = item.subResults.map((sub) => {
      const correctAns = key?.p2[idx]?.[sub.subKey] || sub.correctAnswer;
      const isCorrect = sub.studentAnswer === correctAns;
      if (isCorrect) correctSubCount++;
      return { ...sub, correctAnswer: correctAns, isCorrect };
    });
    const pointsEarned =
      correctSubCount >= 1 && correctSubCount <= 4
        ? cfg.p2PointsMap[correctSubCount - 1]
        : 0;
    p2Score += pointsEarned;
    return { ...item, subResults, correctSubCount, pointsEarned };
  });

  let p3CorrectCount = 0;
  const p3Details = record.p3Details.map((item, idx) => {
    const correctValue = key?.p3[idx] ?? item.correctValue;
    const isCorrect = isP3AnswerMatch(item.studentString, correctValue);
    if (isCorrect) p3CorrectCount++;
    return {
      ...item,
      correctValue,
      isCorrect,
      pointsEarned: isCorrect ? cfg.p3PointsPerQ : 0,
    };
  });

  const p3Score = p3CorrectCount * cfg.p3PointsPerQ;
  const totalScore = Math.round((p1Score + p2Score + p3Score) * 100) / 100;
  const { sbdClassPrefix, sbdStudentOrder } = parseSbdToClassAndStt(record.sbd);

  return {
    ...record,
    sbdClassPrefix,
    sbdStudentOrder,
    matchedKeyFound: Boolean(matchedKey),
    p1Score: Math.round(p1Score * 100) / 100,
    p1CorrectCount,
    p2Score: Math.round(p2Score * 100) / 100,
    p3Score: Math.round(p3Score * 100) / 100,
    p3CorrectCount,
    totalScore,
    p1Details,
    p2Details,
    p3Details,
  };
}

/**
 * 6. BỘ TẠO PHIẾU TÔ MẪU THỰC TẾ (SIMULATOR) TRÊN ẢNH PHIẾU GỐC QM 2025 & CV 1239
 */
export async function generateSimulatedSheetCanvas(
  templateId: TemplateId,
  sbd: string,
  examCode: string,
  answerKey: AnswerKeyData,
  accuracyRate = 0.85,
  scoringConfig?: CustomScoringConfig,
  options?: { skipExamCode?: boolean; skipSbd?: boolean }
): Promise<HTMLCanvasElement> {
  const tpl = TEMPLATES[templateId];
  const cfg = scoringConfig || getDefaultScoringConfig(templateId);
  let sheetCanvas: HTMLCanvasElement;

  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (e) => reject(e);
      img.src = tpl.imageUrl;
    });

    const rawCanvas = document.createElement('canvas');
    rawCanvas.width = img.width;
    rawCanvas.height = img.height;
    const rawCtx = rawCanvas.getContext('2d')!;
    rawCtx.drawImage(img, 0, 0);
    const rawData = rawCtx.getImageData(0, 0, img.width, img.height);
    const detected = detectFourCornerMarkers(rawData);
    sheetCanvas = warpPerspectiveTo1024x550(rawData, detected);
  } catch {
    sheetCanvas = renderVectorFallbackSheet1024x550(templateId);
  }

  const ctx = sheetCanvas.getContext('2d')!;
  const map = getTemplateBubbleMap(templateId);

  const fillPencilBubble = (b: BubblePoint) => {
    ctx.save();
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 0.84, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // Tô Mã Đề (3 hoặc 4 chữ số) — Bỏ qua nếu đang test lỗi không tô Mã đề
  if (!options?.skipExamCode && examCode.trim() !== '') {
    const maDeColsCount = map.maDe.length;
    const cleanCode = examCode.padStart(maDeColsCount, '0').slice(-maDeColsCount);
    for (let c = 0; c < maDeColsCount; c++) {
      const d = Number(cleanCode[c]);
      if (!Number.isNaN(d) && map.maDe[c]?.[d]) {
        fillPencilBubble(map.maDe[c][d]);
      }
    }
  }

  // Tô Số Báo Danh (6 hoặc 8 chữ số) — Bỏ qua nếu đang test học sinh quên tô SBD
  if (!options?.skipSbd && sbd.trim() !== '') {
    const cleanSbd = sbd.padStart(6, '0').slice(0, map.sbd.length);
    for (let c = 0; c < cleanSbd.length; c++) {
      const d = Number(cleanSbd[c]);
      if (!Number.isNaN(d) && map.sbd[c]?.[d]) {
        fillPencilBubble(map.sbd[c][d]);
      }
    }
  }

  // Tô Phần I (theo số câu activeP1Count)
  const choices = ['A', 'B', 'C', 'D'];
  const activeP1 = Math.min(tpl.p1Count, cfg.activeP1Count);
  for (let q = 0; q < activeP1; q++) {
    const rightAns = answerKey.p1[q] || 'A';
    const isRight = Math.random() < accuracyRate;
    const chosenAns = isRight
      ? rightAns
      : choices[(choices.indexOf(rightAns) + 1 + Math.floor(Math.random() * 3)) % 4];
    const cIdx = choices.indexOf(chosenAns);
    if (cIdx >= 0 && map.p1[q]?.[cIdx]) {
      fillPencilBubble(map.p1[q][cIdx]);
    }
  }

  // Tô Phần II (theo số câu activeP2Count)
  const subKeys: ('a' | 'b' | 'c' | 'd')[] = ['a', 'b', 'c', 'd'];
  const activeP2 = Math.min(tpl.p2Count, cfg.activeP2Count);
  for (let q = 0; q < activeP2; q++) {
    for (const sk of subKeys) {
      const rightAns = answerKey.p2[q]?.[sk] || 'D';
      const isRight = Math.random() < accuracyRate;
      const chosenAns = isRight ? rightAns : rightAns === 'D' ? 'S' : 'D';
      const b = chosenAns === 'D' ? map.p2[q][sk][0] : map.p2[q][sk][1];
      fillPencilBubble(b);
    }
  }

  // Tô Phần III (theo số câu activeP3Count)
  const activeP3 = Math.min(tpl.p3Count, cfg.activeP3Count);
  for (let q = 0; q < activeP3; q++) {
    const rawVal = String(answerKey.p3[q] ?? '16').replace('.', ',');
    const isRight = Math.random() < accuracyRate;
    const strToFill = isRight ? rawVal.slice(0, 4) : '12';
    const qMap = map.p3[q];

    for (let col = 0; col < Math.min(4, strToFill.length); col++) {
      const ch = strToFill[col];
      if (ch === '-' && col === 0) {
        fillPencilBubble(qMap.minus);
      } else if (ch === ',' && col === 1) {
        fillPencilBubble(qMap.comma1);
      } else if (ch === ',' && col === 2) {
        fillPencilBubble(qMap.comma2);
      } else {
        const d = Number(ch);
        if (!Number.isNaN(d) && qMap.digits[col]?.[d]) {
          fillPencilBubble(qMap.digits[col][d]);
        }
      }
    }
  }

  return sheetCanvas;
}
