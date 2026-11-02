export type TemplateId = 'toan' | 'khtn' | 'khxh' | 'ngoaingu' | 'cv1239';

export interface BubblePoint {
  x: number;
  y: number;
  r: number;
}

export interface AnswerKeyData {
  examCode: string;
  p1: string[]; // 'A' | 'B' | 'C' | 'D'
  p2: {
    a: 'D' | 'S';
    b: 'D' | 'S';
    c: 'D' | 'S';
    d: 'D' | 'S';
  }[]; // up to 8 questions
  p3: (number | string)[]; // up to 6 short answers
}

export interface CustomScoringConfig {
  activeP1Count: number;
  p1PointsPerQ: number;
  activeP2Count: number;
  p2PointsMap: [number, number, number, number]; // [1 ý đúng, 2 ý đúng, 3 ý đúng, 4 ý đúng]
  activeP3Count: number;
  p3PointsPerQ: number;
}

export interface TemplateConfig {
  id: TemplateId;
  name: string;
  shortName: string;
  badgeCode: string;
  subjects: string;
  imageUrl: string;
  maDeDigits: 3 | 4;
  sbdDigits: 6 | 8;
  p1Count: number; // Max capacity on physical sheet
  defaultActiveP1: number;
  p1TotalPoints: number;
  p2Count: number; // Max capacity on physical sheet (0, 4, or 8)
  defaultActiveP2: number;
  p2TotalPoints: number;
  p3Count: number; // Max capacity on physical sheet (0 or 6)
  defaultActiveP3: number;
  p3TotalPoints: number;
  defaultRadius: number;
  // 3D Theme & Color System per subject group
  btn3dClass: string;
  card3dClass: string;
  accentText: string;
  accentBorder: string;
  accentGlow: string;
  hexPrimary: string;
}

export const TEMPLATES: Record<TemplateId, TemplateConfig> = {
  cv1239: {
    id: 'cv1239',
    name: 'Mẫu Chung CV 1239 (Mã Đề 4 Số)',
    shortName: 'Phiếu Chung 4 Số (CV 1239)',
    badgeCode: 'MÃ ĐỀ 4 SỐ · 40-8-6',
    subjects: 'Tất cả các môn học — Chuẩn CV 1239 (40 câu P.I · 8 câu P.II · 6 câu P.III)',
    imageUrl: './assets/aistudio/QM_2025_CV_1239.jpg',
    maDeDigits: 4,
    sbdDigits: 8,
    p1Count: 40,
    defaultActiveP1: 18,
    p1TotalPoints: 4.5,
    p2Count: 8,
    defaultActiveP2: 4,
    p2TotalPoints: 4.0,
    p3Count: 6,
    defaultActiveP3: 6,
    p3TotalPoints: 1.5,
    defaultRadius: 5.2,
    btn3dClass: 'btn-3d btn-3d-violet',
    card3dClass: 'card-3d-cv1239',
    accentText: 'text-violet-700',
    accentBorder: 'border-violet-400',
    accentGlow: 'from-violet-100 via-purple-50 to-white',
    hexPrimary: '#8b5cf6',
  },
  toan: {
    id: 'toan',
    name: 'Mẫu 1: Toán Học',
    shortName: 'Toán (12-4-6)',
    badgeCode: 'MÃ ĐỀ 3 SỐ · 12-4-6',
    subjects: 'Đại Số, Giải Tích, Hình Học Không Gian & Thống Kê',
    imageUrl: './assets/aistudio/QM_202_To_n_2e669509.jpg',
    maDeDigits: 3,
    sbdDigits: 6,
    p1Count: 12,
    defaultActiveP1: 12,
    p1TotalPoints: 3.0,
    p2Count: 4,
    defaultActiveP2: 4,
    p2TotalPoints: 4.0,
    p3Count: 6,
    defaultActiveP3: 6,
    p3TotalPoints: 3.0,
    defaultRadius: 7.5,
    btn3dClass: 'btn-3d btn-3d-blue',
    card3dClass: 'card-3d-toan',
    accentText: 'text-blue-700',
    accentBorder: 'border-blue-400',
    accentGlow: 'from-blue-100 via-sky-50 to-white',
    hexPrimary: '#3b82f6',
  },
  khtn: {
    id: 'khtn',
    name: 'Mẫu 2: Lý · Hóa · Sinh · Địa',
    shortName: 'KHTN & Địa (18-4-6)',
    badgeCode: 'MÃ ĐỀ 3 SỐ · 18-4-6',
    subjects: 'Vật Lý, Hóa Học, Sinh Học, Địa Lí',
    imageUrl: './assets/aistudio/QM_2025_-_Ly__Hoa__Sinh__Dia_6a77a214.jpg',
    maDeDigits: 3,
    sbdDigits: 6,
    p1Count: 18,
    defaultActiveP1: 18,
    p1TotalPoints: 4.5,
    p2Count: 4,
    defaultActiveP2: 4,
    p2TotalPoints: 4.0,
    p3Count: 6,
    defaultActiveP3: 6,
    p3TotalPoints: 1.5,
    defaultRadius: 7.5,
    btn3dClass: 'btn-3d btn-3d-emerald',
    card3dClass: 'card-3d-khtn',
    accentText: 'text-emerald-700',
    accentBorder: 'border-emerald-400',
    accentGlow: 'from-emerald-100 via-teal-50 to-white',
    hexPrimary: '#10b981',
  },
  khxh: {
    id: 'khxh',
    name: 'Mẫu 3: Sử · Tin · CN · GDKT&PL',
    shortName: 'KHXH & Tin (24-4-0)',
    badgeCode: 'MÃ ĐỀ 3 SỐ · 24-4-0',
    subjects: 'Lịch Sử, Tin Học, Công Nghệ, GDKT & Pháp Luật',
    imageUrl: './assets/aistudio/QM_2025_-_Su__Tin__CN__GDPL_cdd333ca.jpg',
    maDeDigits: 3,
    sbdDigits: 6,
    p1Count: 24,
    defaultActiveP1: 24,
    p1TotalPoints: 6.0,
    p2Count: 4,
    defaultActiveP2: 4,
    p2TotalPoints: 4.0,
    p3Count: 0,
    defaultActiveP3: 0,
    p3TotalPoints: 0,
    defaultRadius: 8.6,
    btn3dClass: 'btn-3d btn-3d-amber',
    card3dClass: 'card-3d-khxh',
    accentText: 'text-amber-700',
    accentBorder: 'border-amber-400',
    accentGlow: 'from-amber-100 via-orange-50 to-white',
    hexPrimary: '#f59e0b',
  },
  ngoaingu: {
    id: 'ngoaingu',
    name: 'Mẫu 4: Ngoại Ngữ',
    shortName: 'Ngoại Ngữ (40 câu)',
    badgeCode: 'MÃ ĐỀ 3 SỐ · 40-0-0',
    subjects: 'Tiếng Anh, Tiếng Pháp, Tiếng Trung, Tiếng Nhật, Tiếng Hàn',
    imageUrl: './assets/aistudio/QM_2025_-_NGOAI_NGU_5d10a158.jpg',
    maDeDigits: 3,
    sbdDigits: 6,
    p1Count: 40,
    defaultActiveP1: 40,
    p1TotalPoints: 10.0,
    p2Count: 0,
    defaultActiveP2: 0,
    p2TotalPoints: 0,
    p3Count: 0,
    defaultActiveP3: 0,
    p3TotalPoints: 0,
    defaultRadius: 9.2,
    btn3dClass: 'btn-3d btn-3d-rose',
    card3dClass: 'card-3d-ngoaingu',
    accentText: 'text-rose-700',
    accentBorder: 'border-rose-400',
    accentGlow: 'from-rose-100 via-pink-50 to-white',
    hexPrimary: '#f43f5e',
  },
};

export function getDefaultScoringConfig(templateId: TemplateId): CustomScoringConfig {
  const tpl = TEMPLATES[templateId];
  const activeP1 = tpl.defaultActiveP1;
  const activeP2 = tpl.defaultActiveP2;
  const activeP3 = tpl.defaultActiveP3;

  return {
    activeP1Count: activeP1,
    p1PointsPerQ: activeP1 > 0 ? Number((tpl.p1TotalPoints / activeP1).toFixed(3)) : 0.25,
    activeP2Count: activeP2,
    p2PointsMap: [0.1, 0.25, 0.5, 1.0],
    activeP3Count: activeP3,
    p3PointsPerQ: activeP3 > 0 ? Number((tpl.p3TotalPoints / activeP3).toFixed(3)) : 0.25,
  };
}

export const SAMPLE_QR_IMAGE_URL =
  './assets/aistudio/M_n_SINH_H_C_-_L_p_12_-_K__ki_m_tra_KI_M_TRA_CU_I_K__I_-_01-11-26_-_QR_Chung__M__101-104__-_1_-_App_QM_2025_e413d348.png';

/**
 * Chuỗi JSON thực tế đã giải mã từ mã QR Môn Sinh Học 12 - Kiểm tra cuối kì I (Mã 101-104 & hỗ trợ mã 4 số 0101-0104 / 1001-1004)
 */
export const DEFAULT_QR_JSON_RAW = JSON.stringify([
  [101,"B","C","D","C","D","A","D","B","A","D","D","A","B","C","B","A","B","D","D","D","S","D","D","D","D","S","S","D","D","D","D","D","D","S",16,20,28.125,299,88.9,2700],
  [102,"A","A","C","C","D","A","C","D","D","C","C","A","C","A","C","C","C","A","D","S","D","D","D","D","S","D","S","D","D","D","S","D","D","D",20,88.9,2700,16,28.125,299],
  [103,"C","C","A","B","C","C","B","A","A","C","B","B","C","B","C","B","A","C","D","D","D","S","D","D","D","S","D","D","S","D","D","S","D","D",2700,16,28.125,299,20,88.9],
  [104,"B","A","B","D","D","A","D","B","C","D","A","B","D","A","D","C","A","C","D","D","S","D","D","D","S","D","D","D","S","D","D","S","D","D",20,16,299,88.9,28.125,2700]
]);

/**
 * Giải mã mảng JSON 2 chiều từ hệ thống trộn đề QM2025 sang cấu trúc AnswerKeyData
 * Hỗ trợ tự động tương thích với cả 5 mẫu phiếu (bao gồm cả mã đề 3 chữ số và 4 chữ số)
 */
export function parseQM2025QrPayload(rawText: string, templateId: TemplateId = 'khtn'): AnswerKeyData[] {
  const cleaned = rawText.trim();
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) {
    throw new Error('Dữ liệu QR không phải mảng JSON hợp lệ.');
  }

  const rows = Array.isArray(parsed[0]) ? parsed : [parsed];
  const tpl = TEMPLATES[templateId];
  const result: AnswerKeyData[] = [];

  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 2) continue;
    let examCode = String(row[0]).trim();
    if (tpl.maDeDigits === 4 && examCode.length === 3) {
      examCode = examCode.padStart(4, '0');
    } else if (tpl.maDeDigits === 3 && examCode.length === 4 && examCode.startsWith('0')) {
      examCode = examCode.slice(1);
    }

    if (row.length === 41 && (templateId === 'khtn' || templateId === 'toan' || templateId === 'cv1239')) {
      const p1Full = row.slice(1, 19).map((v: unknown) => String(v).toUpperCase().trim());
      const choices = ['A', 'B', 'C', 'D'];
      const p1: string[] = [];
      for (let i = 0; i < tpl.p1Count; i++) {
        p1.push(p1Full[i] || choices[i % 4]);
      }

      const p2Raw = row.slice(19, 35).map((v: unknown) => {
        const s = String(v).toUpperCase().trim();
        return s === 'Đ' || s === 'D' || s === 'TRUE' || s === '1' ? 'D' : 'S';
      });
      const p2: AnswerKeyData['p2'] = [];
      for (let q = 0; q < tpl.p2Count; q++) {
        p2.push({
          a: (p2Raw[(q % 4) * 4] || 'D') as 'D' | 'S',
          b: (p2Raw[(q % 4) * 4 + 1] || 'D') as 'D' | 'S',
          c: (p2Raw[(q % 4) * 4 + 2] || 'D') as 'D' | 'S',
          d: (p2Raw[(q % 4) * 4 + 3] || 'D') as 'D' | 'S',
        });
      }
      const p3 = row.slice(35, 41).map((v: unknown) => v as number | string);
      result.push({ examCode, p1, p2, p3 });
    } else {
      const p1Count = tpl.p1Count;
      const p2ItemsCount = tpl.p2Count * 4;
      const p3Count = tpl.p3Count;
      const choices = ['A', 'B', 'C', 'D'];

      const p1: string[] = [];
      for (let i = 0; i < p1Count; i++) {
        const val = row[1 + i];
        const s = val !== undefined ? String(val).toUpperCase().trim() : '';
        p1.push(choices.includes(s) ? s : choices[i % 4]);
      }

      const p2: AnswerKeyData['p2'] = [];
      for (let q = 0; q < tpl.p2Count; q++) {
        const base = 1 + Math.min(row.length - 1, 18) + q * 4;
        const normDS = (v: unknown): 'D' | 'S' => {
          const s = String(v ?? 'D').toUpperCase().trim();
          return s === 'Đ' || s === 'D' || s === 'TRUE' || s === '1' ? 'D' : 'S';
        };
        p2.push({
          a: normDS(row[base]),
          b: normDS(row[base + 1]),
          c: normDS(row[base + 2]),
          d: normDS(row[base + 3]),
        });
      }

      const p3: (number | string)[] = [];
      for (let i = 0; i < p3Count; i++) {
        const val = row[1 + p1Count + p2ItemsCount + i];
        p3.push(val !== undefined ? (val as number | string) : '');
      }

      result.push({ examCode, p1, p2, p3 });
    }
  }

  return result;
}

/**
 * Tọa độ chuẩn của 4 tâm ô vuông định vị góc trên khung ảnh nắn phẳng W=1024, H=550
 */
export const TARGET_CORNERS_1024x550 = {
  width: 1024,
  height: 550,
  tl: { x: 26, y: 38 },
  tr: { x: 998, y: 38 },
  bl: { x: 26, y: 512 },
  br: { x: 998, y: 512 },
};

export interface SheetBubbleMap {
  maDe: BubblePoint[][]; // [3 or 4 cols][10 rows (0..9)]
  sbd: BubblePoint[][]; // [6 or 8 cols][10 rows (0..9)]
  p1: BubblePoint[][]; // [N questions][4 choices (A,B,C,D)]
  p2: {
    a: [BubblePoint, BubblePoint];
    b: [BubblePoint, BubblePoint];
    c: [BubblePoint, BubblePoint];
    d: [BubblePoint, BubblePoint];
  }[];
  p3: {
    minus: BubblePoint;
    comma1: BubblePoint;
    comma2: BubblePoint;
    digits: BubblePoint[][]; // [4 cols][10 rows (0..9)]
  }[];
}

/**
 * Bảng Ma trận Tọa độ Ô Tô Tròn đã đo đạc chính xác sub-pixel từ 5 mẫu phiếu chuẩn QM 2025 & CV 1239
 * trên hệ quy chiếu ảnh sau khi nắn phẳng (W = 1024px, H = 550px).
 */
export function getTemplateBubbleMap(
  templateId: TemplateId,
  offsetX = 0,
  offsetY = 0,
  radiusScale = 1.0
): SheetBubbleMap {
  const pt = (x: number, y: number, r: number): BubblePoint => ({
    x: x + offsetX,
    y: y + offsetY,
    r: r * radiusScale,
  });

  // Mẫu 5: Phiếu Trắc Nghiệm Chung CV 1239 (Mã Đề 4 chữ số, SBD 8 cột, 40 P.I, 8 P.II, 6 P.III)
  if (templateId === 'cv1239') {
    const r = 5.2;
    const sbdCols = [722.0, 741.0, 760.5, 780.0, 799.5, 819.0, 838.5, 858.0];
    const maDeCols = [923.6, 943.1, 962.6, 982.1];
    const topRows = [80.3, 89.8, 99.3, 108.8, 118.3, 127.8, 137.3, 146.8, 156.3, 165.8];

    const maDe = maDeCols.map((cx) => topRows.map((cy) => pt(cx, cy, r)));
    const sbd = sbdCols.map((cx) => topRows.map((cy) => pt(cx, cy, r)));

    const p1ColBlocks = [
      [83.2, 134.1, 185.0, 235.6],
      [326.4, 377.3, 427.8, 478.3],
      [569.6, 620.1, 670.6, 721.1],
      [812.4, 862.9, 913.4, 964.3],
    ];
    const p1Rows10 = [209.2, 217.5, 225.6, 233.7, 242.0, 250.1, 258.2, 266.5, 274.8, 282.9];
    const p1: BubblePoint[][] = [];
    for (const cols of p1ColBlocks) {
      for (let i = 0; i < 10; i++) {
        p1.push(cols.map((cx) => pt(cx, p1Rows10[i], r)));
      }
    }

    const p2ColPairs = [
      [83.2, 134.1],
      [185.0, 235.6],
      [326.4, 377.3],
      [427.8, 478.3],
      [569.6, 620.1],
      [670.6, 721.1],
      [812.4, 862.9],
      [913.4, 964.3],
    ];
    const p2Rows = [331.5, 339.7, 348.0, 356.1];
    const p2 = p2ColPairs.map(([xD, xS]) => ({
      a: [pt(xD, p2Rows[0], r), pt(xS, p2Rows[0], r)] as [BubblePoint, BubblePoint],
      b: [pt(xD, p2Rows[1], r), pt(xS, p2Rows[1], r)] as [BubblePoint, BubblePoint],
      c: [pt(xD, p2Rows[2], r), pt(xS, p2Rows[2], r)] as [BubblePoint, BubblePoint],
      d: [pt(xD, p2Rows[3], r), pt(xS, p2Rows[3], r)] as [BubblePoint, BubblePoint],
    }));

    const p3GroupCols = [
      [83.2, 107.1, 131.0, 154.5],
      [245.3, 269.2, 292.7, 316.2],
      [407.4, 431.4, 454.4, 478.3],
      [569.6, 593.1, 616.6, 640.5],
      [731.3, 754.8, 778.7, 802.2],
      [893.0, 916.9, 940.8, 964.3],
    ];
    const p3MinusY = 405.8;
    const p3CommaY = 413.9;
    const p3DigitRows = [422.2, 430.3, 438.4, 446.7, 455.0, 463.1, 471.2, 479.5, 487.6, 495.8];

    const p3 = p3GroupCols.map((cols) => ({
      minus: pt(cols[0], p3MinusY, r),
      comma1: pt(cols[1], p3CommaY, r),
      comma2: pt(cols[2], p3CommaY, r),
      digits: cols.map((cx) => p3DigitRows.map((cy) => pt(cx, cy, r))),
    }));

    return { maDe, sbd, p1, p2, p3 };
  }

  if (templateId === 'toan' || templateId === 'khtn') {
    const r = 7.4;
    const maDeCols = [46.3, 65.3, 84.5];
    const sbdCols = [138.4, 157.6, 176.6, 195.8, 214.8, 233.9];
    const leftRows = [282.4, 301.6, 320.8, 340.0, 359.5, 378.7, 397.9, 417.1, 436.4, 455.8];

    const maDe = maDeCols.map((cx) => leftRows.map((cy) => pt(cx, cy, r)));
    const sbd = sbdCols.map((cx) => leftRows.map((cy) => pt(cx, cy, r)));

    const p1Cols = [298.5, 317.6, 336.6, 355.8];
    const p1Rows =
      templateId === 'toan'
        ? [263.2, 282.4, 301.6, 320.7, 339.9, 359.5, 378.7, 397.9, 417.0, 436.6, 455.8, 475.0]
        : [
            128.4, 147.5, 166.7, 186.3, 205.4, 224.6, 243.8, 262.9, 282.5,
            320.8, 340.0, 359.6, 378.7, 397.9, 417.1, 436.2, 455.8, 475.0,
          ];
    const p1 = p1Rows.map((cy) => p1Cols.map((cx) => pt(cx, cy, r)));

    const p2ColPairs = [
      [612.3, 631.3],
      [712.0, 730.9],
      [811.4, 830.6],
      [911.1, 930.3],
    ];
    const p2Rows = [103.0, 122.2, 141.3, 161.0];
    const p2 = p2ColPairs.map(([xD, xS]) => ({
      a: [pt(xD, p2Rows[0], r), pt(xS, p2Rows[0], r)] as [BubblePoint, BubblePoint],
      b: [pt(xD, p2Rows[1], r), pt(xS, p2Rows[1], r)] as [BubblePoint, BubblePoint],
      c: [pt(xD, p2Rows[2], r), pt(xS, p2Rows[2], r)] as [BubblePoint, BubblePoint],
      d: [pt(xD, p2Rows[3], r), pt(xS, p2Rows[3], r)] as [BubblePoint, BubblePoint],
    }));

    const p3GroupCols = [
      [413.0, 432.0, 451.2, 470.1],
      [512.6, 531.6, 550.8, 569.8],
      [612.3, 631.3, 650.5, 669.5],
      [712.0, 730.9, 749.9, 769.1],
      [811.4, 830.6, 849.6, 868.8],
      [911.1, 930.3, 949.2, 968.4],
    ];
    const p3MinusY = 263.3;
    const p3CommaY = 282.5;
    const p3DigitRows = [301.7, 320.8, 340.0, 359.6, 378.7, 397.9, 417.1, 436.6, 455.8, 475.0];

    const p3 = p3GroupCols.map((cols) => ({
      minus: pt(cols[0], p3MinusY, r),
      comma1: pt(cols[1], p3CommaY, r),
      comma2: pt(cols[2], p3CommaY, r),
      digits: cols.map((cx) => p3DigitRows.map((cy) => pt(cx, cy, r))),
    }));

    return { maDe, sbd, p1, p2, p3 };
  }

  if (templateId === 'khxh') {
    const r = 8.4;
    const maDeCols = [85.9, 108.4, 130.9];
    const sbdCols = [205.7, 228.2, 250.7, 273.2, 295.2, 317.7];
    const leftRows = [267.8, 290.5, 313.2, 335.9, 358.7, 381.4, 404.1, 426.4, 449.1, 471.8];

    const maDe = maDeCols.map((cx) => leftRows.map((cy) => pt(cx, cy, r)));
    const sbd = sbdCols.map((cx) => leftRows.map((cy) => pt(cx, cy, r)));

    const p1ColGroup1 = [399.9, 422.4, 444.9, 467.3];
    const p1ColGroup2 = [527.0, 549.5, 572.0, 594.5];
    const p1Rows12 = [222.8, 245.1, 267.8, 290.5, 313.2, 335.9, 358.7, 381.4, 404.1, 426.4, 449.1, 471.8];

    const p1: BubblePoint[][] = [];
    for (let i = 0; i < 12; i++) {
      p1.push(p1ColGroup1.map((cx) => pt(cx, p1Rows12[i], r)));
    }
    for (let i = 0; i < 12; i++) {
      p1.push(p1ColGroup2.map((cx) => pt(cx, p1Rows12[i], r)));
    }

    const p2ColPairs = [
      [679.2, 701.8],
      [758.7, 781.3],
      [861.1, 883.4],
      [940.8, 963.4],
    ];
    const p2RowsTop = [250.3, 273.0, 295.8, 318.5];
    const p2 = p2ColPairs.map(([xD, xS]) => ({
      a: [pt(xD, p2RowsTop[0], r), pt(xS, p2RowsTop[0], r)] as [BubblePoint, BubblePoint],
      b: [pt(xD, p2RowsTop[1], r), pt(xS, p2RowsTop[1], r)] as [BubblePoint, BubblePoint],
      c: [pt(xD, p2RowsTop[2], r), pt(xS, p2RowsTop[2], r)] as [BubblePoint, BubblePoint],
      d: [pt(xD, p2RowsTop[3], r), pt(xS, p2RowsTop[3], r)] as [BubblePoint, BubblePoint],
    }));

    return { maDe, sbd, p1, p2, p3: [] };
  }

  // Mẫu 4: Ngoại Ngữ (40 câu Phần I)
  const r = 9.0;
  const maDeCols = [93.6, 118.8, 144.4];
  const sbdCols = [228.3, 253.9, 279.1, 304.3, 329.5, 354.7];
  const rows10 = [229.8, 255.7, 281.1, 306.6, 332.0, 357.4, 382.9, 408.3, 434.2, 459.6];

  const maDe = maDeCols.map((cx) => rows10.map((cy) => pt(cx, cy, r)));
  const sbd = sbdCols.map((cx) => rows10.map((cy) => pt(cx, cy, r)));

  const p1ColBlocks = [
    [447.3, 472.9, 498.1, 523.3],
    [590.6, 615.8, 641.0, 666.3],
    [733.6, 759.2, 784.4, 809.6],
    [877.0, 902.2, 927.4, 952.6],
  ];

  const p1: BubblePoint[][] = [];
  for (const cols of p1ColBlocks) {
    for (let i = 0; i < 10; i++) {
      p1.push(cols.map((cx) => pt(cx, rows10[i], r)));
    }
  }

  return { maDe, sbd, p1, p2: [], p3: [] };
}

/**
 * Vẽ tờ phiếu Vector chuẩn 1024x550 nếu chạy ở môi trường offline hoặc thiếu file ảnh tĩnh
 */
export function renderVectorFallbackSheet1024x550(templateId: TemplateId): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 550;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 1024, 550);

  ctx.fillStyle = '#000000';
  for (const c of [
    TARGET_CORNERS_1024x550.tl,
    TARGET_CORNERS_1024x550.tr,
    TARGET_CORNERS_1024x550.bl,
    TARGET_CORNERS_1024x550.br,
  ]) {
    ctx.fillRect(c.x - 11, c.y - 11, 22, 22);
  }

  const map = getTemplateBubbleMap(templateId);
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1.4;

  const drawEmptyCircles = (list: BubblePoint[]) => {
    for (const b of list) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.stroke();
    }
  };

  drawEmptyCircles(map.maDe.flat());
  drawEmptyCircles(map.sbd.flat());
  drawEmptyCircles(map.p1.flat());
  map.p2.forEach((q) => drawEmptyCircles([...q.a, ...q.b, ...q.c, ...q.d]));
  map.p3.forEach((q) => drawEmptyCircles([q.minus, q.comma1, q.comma2, ...q.digits.flat()]));

  return canvas;
}
