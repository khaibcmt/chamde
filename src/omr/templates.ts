export type TemplateId = 'toan' | 'khtn' | 'khxh' | 'ngoaingu';

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
  }[]; // 4 questions
  p3: (number | string)[]; // up to 6 short answers
}

export interface TemplateConfig {
  id: TemplateId;
  name: string;
  shortName: string;
  subjects: string;
  imageUrl: string;
  p1Count: number;
  p1TotalPoints: number;
  p2Count: number; // 4 or 0
  p2TotalPoints: number;
  p3Count: number; // 6 or 0
  p3TotalPoints: number;
  defaultRadius: number;
}

export const TEMPLATES: Record<TemplateId, TemplateConfig> = {
  khtn: {
    id: 'khtn',
    name: 'Mẫu 2: Lý - Hóa - Sinh - Địa',
    shortName: 'KHTN & Địa (18-4-6)',
    subjects: 'Vật Lý, Hóa Học, Sinh Học, Địa Lí',
    imageUrl: '/assets/aistudio/QM_2025_-_Ly__Hoa__Sinh__Dia_6a77a214.jpg',
    p1Count: 18,
    p1TotalPoints: 4.5,
    p2Count: 4,
    p2TotalPoints: 4.0,
    p3Count: 6,
    p3TotalPoints: 1.5,
    defaultRadius: 7.5,
  },
  toan: {
    id: 'toan',
    name: 'Mẫu 1: Toán Học',
    shortName: 'Toán (12-4-6)',
    subjects: 'Toán Học',
    imageUrl: '/assets/aistudio/QM_202_To_n_2e669509.jpg',
    p1Count: 12,
    p1TotalPoints: 3.0,
    p2Count: 4,
    p2TotalPoints: 4.0,
    p3Count: 6,
    p3TotalPoints: 3.0,
    defaultRadius: 7.5,
  },
  khxh: {
    id: 'khxh',
    name: 'Mẫu 3: Sử - Tin - CN - GDKT&PL',
    shortName: 'KHXH & Tin/CN (24-4-0)',
    subjects: 'Lịch Sử, Tin Học, Công Nghệ, GDKT&PL',
    imageUrl: '/assets/aistudio/QM_2025_-_Su__Tin__CN__GDPL_cdd333ca.jpg',
    p1Count: 24,
    p1TotalPoints: 6.0,
    p2Count: 4,
    p2TotalPoints: 4.0,
    p3Count: 0,
    p3TotalPoints: 0,
    defaultRadius: 8.6,
  },
  ngoaingu: {
    id: 'ngoaingu',
    name: 'Mẫu 4: Ngoại Ngữ',
    shortName: 'Ngoại Ngữ (40 câu)',
    subjects: 'Tiếng Anh, Tiếng Pháp, Tiếng Trung, Tiếng Nhật...',
    imageUrl: '/assets/aistudio/QM_2025_-_NGOAI_NGU_5d10a158.jpg',
    p1Count: 40,
    p1TotalPoints: 10.0,
    p2Count: 0,
    p2TotalPoints: 0,
    p3Count: 0,
    p3TotalPoints: 0,
    defaultRadius: 9.2,
  },
};

export const SAMPLE_QR_IMAGE_URL =
  '/assets/aistudio/M_n_SINH_H_C_-_L_p_12_-_K__ki_m_tra_KI_M_TRA_CU_I_K__I_-_01-11-26_-_QR_Chung__M__101-104__-_1_-_App_QM_2025_e413d348.png';

/**
 * Chuỗi JSON thực tế đã giải mã từ mã QR Môn Sinh Học 12 - Kiểm tra cuối kì I (Mã 101-104)
 */
export const DEFAULT_QR_JSON_RAW = JSON.stringify([
  [101,"B","C","D","C","D","A","D","B","A","D","D","A","B","C","B","A","B","D","D","D","S","D","D","D","D","S","S","D","D","D","D","D","D","S",16,20,28.125,299,88.9,2700],
  [102,"A","A","C","C","D","A","C","D","D","C","C","A","C","A","C","C","C","A","D","S","D","D","D","D","S","D","S","D","D","D","S","D","D","D",20,88.9,2700,16,28.125,299],
  [103,"C","C","A","B","C","C","B","A","A","C","B","B","C","B","C","B","A","C","D","D","D","S","D","D","D","S","D","D","S","D","D","S","D","D",2700,16,28.125,299,20,88.9],
  [104,"B","A","B","D","D","A","D","B","C","D","A","B","D","A","D","C","A","C","D","D","S","D","D","D","S","D","D","D","S","D","D","S","D","D",20,16,299,88.9,28.125,2700]
]);

/**
 * Giải mã mảng JSON 2 chiều từ hệ thống trộn đề QM2025 sang cấu trúc AnswerKeyData
 * Hỗ trợ tự động tương thích với cả 4 mẫu phiếu (Toán, KHTN, KHXH, Ngoại Ngữ)
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
    const examCode = String(row[0]).trim();

    // Chuẩn mảng 41 phần tử của hệ thống trộn đề QM2025:
    // [0]: Mã đề
    // [1..18]: 18 câu Phần I (A/B/C/D)
    // [19..34]: 16 ý Phần II (4 câu x 4 ý a,b,c,d: D/S)
    // [35..40]: 6 câu Phần III (số)
    if (row.length === 41 && (templateId === 'khtn' || templateId === 'toan')) {
      const p1Full = row.slice(1, 19).map((v: unknown) => String(v).toUpperCase().trim());
      const p1 = p1Full.slice(0, tpl.p1Count);
      const p2Raw = row.slice(19, 35).map((v: unknown) => {
        const s = String(v).toUpperCase().trim();
        return s === 'Đ' || s === 'D' || s === 'TRUE' || s === '1' ? 'D' : 'S';
      });
      const p2 = [];
      for (let q = 0; q < 4; q++) {
        p2.push({
          a: (p2Raw[q * 4] || 'D') as 'D' | 'S',
          b: (p2Raw[q * 4 + 1] || 'D') as 'D' | 'S',
          c: (p2Raw[q * 4 + 2] || 'D') as 'D' | 'S',
          d: (p2Raw[q * 4 + 3] || 'D') as 'D' | 'S',
        });
      }
      const p3 = row.slice(35, 41).map((v: unknown) => v as number | string);
      result.push({ examCode, p1, p2, p3 });
    } else {
      // Linh hoạt theo cấu hình từng mẫu phiếu
      const p1Count = tpl.p1Count;
      const p2ItemsCount = tpl.p2Count * 4;
      const p3Count = tpl.p3Count;

      const p1: string[] = [];
      for (let i = 0; i < p1Count; i++) {
        const val = row[1 + i];
        p1.push(val !== undefined ? String(val).toUpperCase().trim() : 'A');
      }

      const p2: AnswerKeyData['p2'] = [];
      for (let q = 0; q < tpl.p2Count; q++) {
        const base = 1 + p1Count + q * 4;
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
  maDe: BubblePoint[][]; // [3 cols][10 rows (0..9)]
  sbd: BubblePoint[][]; // [6 cols][10 rows (0..9)]
  p1: BubblePoint[][]; // [N questions][4 choices (A,B,C,D)]
  p2: {
    // [4 questions] -> each has a,b,c,d -> each has [D, S]
    a: [BubblePoint, BubblePoint];
    b: [BubblePoint, BubblePoint];
    c: [BubblePoint, BubblePoint];
    d: [BubblePoint, BubblePoint];
  }[];
  p3: {
    // [6 questions] -> 4 columns
    minus: BubblePoint; // col 0 row '-'
    comma1: BubblePoint; // col 1 row ','
    comma2: BubblePoint; // col 2 row ','
    digits: BubblePoint[][]; // [4 cols][10 rows (0..9)]
  }[];
}

/**
 * Bảng Ma trận Tọa độ Ô Tô Tròn đã đo đạc chính xác sub-pixel từ 4 mẫu phiếu chuẩn QM 2025
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

  if (templateId === 'toan' || templateId === 'khtn') {
    const r = 7.4;
    // Mã đề: 3 cột x 10 hàng (0..9)
    const maDeCols = [46.3, 65.3, 84.5];
    const sbdCols = [138.4, 157.6, 176.6, 195.8, 214.8, 233.9];
    const leftRows = [282.4, 301.6, 320.8, 340.0, 359.5, 378.7, 397.9, 417.1, 436.4, 455.8];

    const maDe = maDeCols.map((cx) => leftRows.map((cy) => pt(cx, cy, r)));
    const sbd = sbdCols.map((cx) => leftRows.map((cy) => pt(cx, cy, r)));

    // Phần I:
    const p1Cols = [298.5, 317.6, 336.6, 355.8];
    const p1Rows =
      templateId === 'toan'
        ? [263.2, 282.4, 301.6, 320.7, 339.9, 359.5, 378.7, 397.9, 417.0, 436.6, 455.8, 475.0]
        : [
            // KHTN: 18 câu (Câu 1..9 ở khung trên, Câu 10..18 ở khung dưới)
            128.4, 147.5, 166.7, 186.3, 205.4, 224.6, 243.8, 262.9, 282.5,
            320.8, 340.0, 359.6, 378.7, 397.9, 417.1, 436.2, 455.8, 475.0,
          ];
    const p1 = p1Rows.map((cy) => p1Cols.map((cx) => pt(cx, cy, r)));

    // Phần II: 4 câu ở góc trên bên phải
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

    // Phần III: 6 câu trả lời ngắn ở góc dưới bên phải
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

    // Phần I: 24 câu chia 2 cột (1..12 và 13..24)
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

    // Phần II: Câu 1..4 ở hàng trên
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
    [447.3, 472.9, 498.1, 523.3], // Câu 1..10
    [590.6, 615.8, 641.0, 666.3], // Câu 11..20
    [733.6, 759.2, 784.4, 809.6], // Câu 21..30
    [877.0, 902.2, 927.4, 952.6], // Câu 31..40
  ];

  const p1: BubblePoint[][] = [];
  for (const cols of p1ColBlocks) {
    for (let i = 0; i < 10; i++) {
      p1.push(cols.map((cx) => pt(cx, rows10[i], r)));
    }
  }

  return { maDe, sbd, p1, p2: [], p3: [] };
}
