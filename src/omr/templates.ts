import jsQR from 'jsqr';

export type TemplateId =
  | 'qm_toan'
  | 'qm_khtn_dia'
  | 'qm_khxh_tin_cn'
  | 'qm_ngoai_ngu'
  | 'qm_on_tap_tl_ngan'
  | 'qm_2025_a4'
  | 'qm_cv1239'
  | 'bogd_2025_a4'
  | 'bogd_cv1239'
  | 'cv1239_mo_rong'
  | 'tnmaker_2025_a4'
  | 'tnmaker_cv1239'
  | 'azota_2025_a4'
  | 'azota_cv1239'
  // Legacy aliases for 100% backward compatibility
  | 'toan'
  | 'khtn'
  | 'khxh'
  | 'ngoaingu'
  | 'cv1239';

export type SheetGroupType =
  | 'Khổ ngang (2 bài/A4)'
  | 'Khổ dọc A4 Chuẩn'
  | 'Azota / TNmaker Tương thích';

export interface SheetDatabaseItem {
  id: TemplateId;
  name: string;
  group: SheetGroupType;
  codeLength: 3 | 4;
  hasSBD: boolean;
  p1: number;
  p2: number;
  p3: number;
  pdfUrl: string;
  imageUrl: string;
  note: string;
  defaultP1Point: number;
  defaultP3Point: number;
}

/**
 * CƠ SỞ DỮ LIỆU ĐẦY ĐỦ 14 MẪU PHIẾU CHUẨN GDPT 2018 (NHÚNG SẴN VÀO MÃ NGUỒN)
 */
export const SHEET_DATABASE: SheetDatabaseItem[] = [
  // --- NHÓM 1: PHIẾU KHỔ NGANG TIẾT KIỆM GIẤY (IN 2 BÀI / TỜ A4) ---
  {
    id: 'qm_toan',
    name: 'Edu 2025 - Toán',
    group: 'Khổ ngang (2 bài/A4)',
    codeLength: 3,
    hasSBD: true,
    p1: 12, // 12 câu trắc nghiệm 4 lựa chọn (0.25đ/câu)
    p2: 4, // 4 câu Đúng/Sai (thang bậc thang: 0.1 - 0.25 - 0.5 - 1.0)
    p3: 6, // 6 câu điền số trả lời ngắn (0.5đ/câu)
    pdfUrl: './assets/aistudio/QM_2025_-_CV_1239_-_Ky_kiem_tra_420f9135.pdf',
    imageUrl: './assets/sheets/phieu_goc_qm_toan.jpg',
    note: 'Đề chuẩn môn Toán: 12 câu P1, 4 câu P2, 6 câu P3 (Mã đề 3 số)',
    defaultP1Point: 0.25,
    defaultP3Point: 0.5,
  },
  {
    id: 'qm_khtn_dia',
    name: 'Edu 2025 - Lý, Hoá, Sinh, Địa',
    group: 'Khổ ngang (2 bài/A4)',
    codeLength: 3,
    hasSBD: true,
    p1: 18, // 18 câu trắc nghiệm P1
    p2: 4, // 4 câu Đúng/Sai P2
    p3: 6, // 6 câu điền số P3
    pdfUrl: './assets/aistudio/QM_2025_-_CV_1239_-_Ky_kiem_tra_420f9135.pdf',
    imageUrl: './assets/sheets/phieu_goc_qm_khtn_dia.jpg',
    note: 'Dành cho Vật lí, Hoá học, Sinh học, Địa lí (Mã đề 3 số)',
    defaultP1Point: 0.25,
    defaultP3Point: 0.5,
  },
  {
    id: 'qm_khxh_tin_cn',
    name: 'Edu 2025 - Sử, Tin, CN, GDPL',
    group: 'Khổ ngang (2 bài/A4)',
    codeLength: 3,
    hasSBD: true,
    p1: 24, // 24 câu trắc nghiệm P1
    p2: 6, // 6 câu Đúng/Sai P2
    p3: 0, // Không có phần điền số
    pdfUrl: './assets/aistudio/QM_2025_-_CV_1239_-_Ky_kiem_tra_420f9135.pdf',
    imageUrl: './assets/sheets/phieu_goc_qm_khxh_tin_cn.jpg',
    note: 'Lịch sử, Tin học, Công nghệ, GD Kinh tế & Pháp luật (Mã đề 3 số)',
    defaultP1Point: 0.25,
    defaultP3Point: 0.5,
  },
  {
    id: 'qm_ngoai_ngu',
    name: 'Edu 2025 - Ngoại ngữ',
    group: 'Khổ ngang (2 bài/A4)',
    codeLength: 3,
    hasSBD: true,
    p1: 40, // 40 câu trắc nghiệm 4 lựa chọn
    p2: 0,
    p3: 0,
    pdfUrl: './assets/aistudio/QM_2025_-_CV_1239_-_Ky_kiem_tra_420f9135.pdf',
    imageUrl: './assets/sheets/phieu_goc_qm_ngoai_ngu.jpg',
    note: 'Tiếng Anh và các môn Ngoại ngữ (40 câu P1, Mã đề 3 số)',
    defaultP1Point: 0.25,
    defaultP3Point: 0.5,
  },
  {
    id: 'qm_on_tap_tl_ngan',
    name: 'Edu 2025 - Ôn tập - TL Ngắn',
    group: 'Khổ ngang (2 bài/A4)',
    codeLength: 3,
    hasSBD: false,
    p1: 0,
    p2: 0,
    p3: 10, // 10 câu điền số trả lời ngắn
    pdfUrl: './assets/aistudio/QM_2025_-_CV_1239_-_Ky_kiem_tra_420f9135.pdf',
    imageUrl: './assets/sheets/phieu_goc_qm_on_tap_tl_ngan.jpg',
    note: 'Chuyên dụng ôn tập điền số (10 câu P3, Mã đề 3 số)',
    defaultP1Point: 0.25,
    defaultP3Point: 1.0,
  },

  // --- NHÓM 2: PHIẾU KHỔ DỌC A4 CHUẨN BỘ GD & CV 1239 ---
  {
    id: 'qm_2025_a4',
    name: 'Edu 2025 - A4',
    group: 'Khổ dọc A4 Chuẩn',
    codeLength: 3,
    hasSBD: true,
    p1: 40,
    p2: 8,
    p3: 6,
    pdfUrl: './assets/aistudio/QM_2025_-_CV_1239_-_Ky_kiem_tra_420f9135.pdf',
    imageUrl: './assets/sheets/phieu_goc_qm_2025_a4.jpg',
    note: 'Phiếu tổng hợp A4 chuẩn mã đề 3 số (40 P1, 8 P2, 6 P3)',
    defaultP1Point: 0.25,
    defaultP3Point: 0.5,
  },
  {
    id: 'qm_cv1239',
    name: 'Edu 2025 - CV 1239',
    group: 'Khổ dọc A4 Chuẩn',
    codeLength: 4, // Mã đề 4 chữ số
    hasSBD: true,
    p1: 40,
    p2: 8,
    p3: 6,
    pdfUrl: './assets/aistudio/QM_2025_-_CV_1239_-_Ky_kiem_tra_420f9135.pdf',
    imageUrl: './assets/sheets/phieu_goc_qm_cv1239.jpg',
    note: 'Chuẩn Công văn 1239 Bộ GD&ĐT (Mã đề 4 chữ số, 40 P1, 8 P2, 6 P3)',
    defaultP1Point: 0.25,
    defaultP3Point: 0.5,
  },
  {
    id: 'bogd_2025_a4',
    name: 'Bộ GD 2025 - A4',
    group: 'Khổ dọc A4 Chuẩn',
    codeLength: 3,
    hasSBD: true,
    p1: 40,
    p2: 8,
    p3: 6,
    pdfUrl: './assets/aistudio/QM_2025_-_CV_1239_-_Ky_kiem_tra_420f9135.pdf',
    imageUrl: './assets/sheets/phieu_goc_bogd_2025_a4.jpg',
    note: 'Phiếu Bộ GD viền hồng định vị sườn chuẩn (Mã đề 3 số)',
    defaultP1Point: 0.25,
    defaultP3Point: 0.5,
  },
  {
    id: 'bogd_cv1239',
    name: 'Bộ GD 2025 - CV 1239',
    group: 'Khổ dọc A4 Chuẩn',
    codeLength: 4,
    hasSBD: true,
    p1: 40,
    p2: 8,
    p3: 6,
    pdfUrl: './assets/aistudio/QM_2025_-_CV_1239_-_Ky_kiem_tra_420f9135.pdf',
    imageUrl: './assets/sheets/phieu_goc_bogd_cv1239.jpg',
    note: 'Phiếu Bộ GD theo CV 1239 viền hồng (Mã đề 4 số)',
    defaultP1Point: 0.25,
    defaultP3Point: 0.5,
  },
  {
    id: 'cv1239_mo_rong',
    name: 'CV 1239 - 40.16.12',
    group: 'Khổ dọc A4 Chuẩn',
    codeLength: 4,
    hasSBD: true,
    p1: 40,
    p2: 16,
    p3: 12,
    pdfUrl: './assets/aistudio/QM_2025_-_CV_1239_-_Ky_kiem_tra_420f9135.pdf',
    imageUrl: './assets/sheets/phieu_goc_cv1239_mo_rong.jpg',
    note: 'Bản mở rộng dung lượng lớn (40 P1, 16 P2, 12 P3, Mã đề 4 số)',
    defaultP1Point: 0.25,
    defaultP3Point: 0.5,
  },

  // --- NHÓM 3: PHIẾU HỆ SINH THÁI TƯƠNG THÍCH NGOÀI ---
  {
    id: 'tnmaker_2025_a4',
    name: 'TNmaker 2025 - A4',
    group: 'Azota / TNmaker Tương thích',
    codeLength: 3,
    hasSBD: true,
    p1: 40,
    p2: 8,
    p3: 6,
    pdfUrl: './assets/aistudio/QM_2025_-_CV_1239_-_Ky_kiem_tra_420f9135.pdf',
    imageUrl: './assets/sheets/phieu_goc_tnmaker_2025_a4.jpg',
    note: 'Tương thích phiếu TNmaker mã đề 3 số (40 P1, 8 P2, 6 P3)',
    defaultP1Point: 0.25,
    defaultP3Point: 0.5,
  },
  {
    id: 'tnmaker_cv1239',
    name: 'TNmaker 2025 - CV 1239',
    group: 'Azota / TNmaker Tương thích',
    codeLength: 4,
    hasSBD: true,
    p1: 40,
    p2: 8,
    p3: 6,
    pdfUrl: './assets/aistudio/QM_2025_-_CV_1239_-_Ky_kiem_tra_420f9135.pdf',
    imageUrl: './assets/sheets/phieu_goc_tnmaker_cv1239.jpg',
    note: 'Tương thích TNmaker chuẩn CV 1239 (Mã đề 4 số, 40 P1, 8 P2, 6 P3)',
    defaultP1Point: 0.25,
    defaultP3Point: 0.5,
  },
  {
    id: 'azota_2025_a4',
    name: 'Azota 2025 - A4 (v15.0)',
    group: 'Azota / TNmaker Tương thích',
    codeLength: 3,
    hasSBD: true,
    p1: 40,
    p2: 8,
    p3: 6,
    pdfUrl: './assets/aistudio/QM_2025_-_CV_1239_-_Ky_kiem_tra_420f9135.pdf',
    imageUrl: './assets/sheets/phieu_goc_azota_2025_a4.jpg',
    note: 'Tương thích Azota v15.0 có vạch mã chân trang (Mã đề 3 số)',
    defaultP1Point: 0.25,
    defaultP3Point: 0.5,
  },
  {
    id: 'azota_cv1239',
    name: 'Azota 2025 - CV 1239 (v31.0)',
    group: 'Azota / TNmaker Tương thích',
    codeLength: 4,
    hasSBD: true,
    p1: 40,
    p2: 8,
    p3: 6,
    pdfUrl: './assets/aistudio/QM_2025_-_CV_1239_-_Ky_kiem_tra_420f9135.pdf',
    imageUrl: './assets/sheets/phieu_goc_azota_cv1239.jpg',
    note: 'Tương thích Azota v31.0 chuẩn CV 1239 (Mã đề 4 số)',
    defaultP1Point: 0.25,
    defaultP3Point: 0.5,
  },
];

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
  }[]; // up to 16 questions
  p3: (number | string)[]; // up to 12 short answers
  detectedCounts?: {
    p1Count: number;
    p2Count: number;
    p3Count: number;
  };
}

export interface CustomScoringConfig {
  activeP1Count: number;
  p1PointsPerQ: number;
  activeP2Count: number;
  p2PointsMap: [number, number, number, number]; // [1 ý đúng, 2 ý đúng, 3 ý đúng, 4 ý đúng]
  activeP3Count: number;
  p3PointsPerQ: number;
}

export type SheetOrientation = 'landscape' | 'portrait';

export interface TemplateConfig {
  id: TemplateId;
  name: string;
  shortName: string;
  group: SheetGroupType;
  orientation: SheetOrientation;
  orientationLabel: string;
  headerPositionHint: string;
  scanGuideNote: string;
  badgeCode: string;
  subjects: string;
  imageUrl: string;
  pdfUrl: string;
  maDeDigits: 3 | 4;
  sbdDigits: 6 | 8;
  hasSBD: boolean;
  p1Count: number;
  defaultActiveP1: number;
  p1TotalPoints: number;
  p2Count: number;
  defaultActiveP2: number;
  p2TotalPoints: number;
  p3Count: number;
  defaultActiveP3: number;
  p3TotalPoints: number;
  defaultRadius: number;
  btn3dClass: string;
  card3dClass: string;
  accentText: string;
  accentBorder: string;
  accentGlow: string;
  hexPrimary: string;
}

function buildTemplateConfigFromDb(item: SheetDatabaseItem): TemplateConfig {
  const defaultActiveP1 = item.p1 > 24 && item.p2 > 0 ? 18 : item.p1;
  const defaultActiveP2 = item.p2 > 4 ? 4 : item.p2;
  const defaultActiveP3 = item.p3 > 6 ? 6 : item.p3;

  const p1Total = Number((defaultActiveP1 * item.defaultP1Point).toFixed(2));
  const p2Total = Number((defaultActiveP2 * 1.0).toFixed(2));
  const p3Total = Number((defaultActiveP3 * item.defaultP3Point).toFixed(2));

  const isLandscape = item.group === 'Khổ ngang (2 bài/A4)';
  const orientation: SheetOrientation = isLandscape ? 'landscape' : 'portrait';
  const orientationLabel = isLandscape
    ? 'Phiếu Khổ Ngang (2 bài/A4)'
    : 'Phiếu Khổ Dọc A4 Chuẩn';
  const headerPositionHint = isLandscape
    ? item.hasSBD
      ? 'Họ tên ở TRÊN · Cột Mã đề & SBD nằm bên TRÁI · Câu hỏi bên PHẢI'
      : 'Họ tên ở TRÊN · 10 câu điền số nằm ngang bên DƯỚI'
    : 'Tiêu đề ở TRÊN · Khung SBD & Mã đề nằm ở GÓC TRÊN PHẢI · Phần I, II, III xếp dọc bên DƯỚI';
  const scanGuideNote = isLandscape
    ? 'Đặt phiếu NẰM NGANG đúng chiều đọc (Họ tên ở trên, Mã đề & SBD bên trái)'
    : 'Đặt phiếu ĐỨNG DỌC A4 đúng chiều đọc (Tiêu đề ở trên, SBD & Mã đề ở góc trên phải)';

  return {
    id: item.id,
    name: item.name,
    shortName: item.name,
    group: item.group,
    orientation,
    orientationLabel,
    headerPositionHint,
    scanGuideNote,
    badgeCode: `MÃ ĐỀ ${item.codeLength} SỐ · ${item.p1}-${item.p2}-${item.p3}`,
    subjects: item.note,
    imageUrl: item.imageUrl,
    pdfUrl: item.pdfUrl,
    maDeDigits: item.codeLength,
    sbdDigits: item.codeLength === 4 ? 8 : 6,
    hasSBD: item.hasSBD,
    p1Count: item.p1,
    defaultActiveP1,
    p1TotalPoints: p1Total,
    p2Count: item.p2,
    defaultActiveP2,
    p2TotalPoints: p2Total,
    p3Count: item.p3,
    defaultActiveP3,
    p3TotalPoints: p3Total,
    defaultRadius: isLandscape ? 7.5 : 5.2,
    btn3dClass: 'btn-3d btn-3d-blue',
    card3dClass: 'card-3d-toan',
    accentText: 'text-blue-700',
    accentBorder: 'border-blue-400',
    accentGlow: 'from-blue-100 via-sky-50 to-white',
    hexPrimary: '#2563eb',
  };
}

const dbMap: Record<string, TemplateConfig> = {};
for (const item of SHEET_DATABASE) {
  dbMap[item.id] = buildTemplateConfigFromDb(item);
}
// Map legacy IDs to exact corresponding items
dbMap['toan'] = { ...dbMap['qm_toan'], id: 'toan' };
dbMap['khtn'] = { ...dbMap['qm_khtn_dia'], id: 'khtn' };
dbMap['khxh'] = { ...dbMap['qm_khxh_tin_cn'], id: 'khxh' };
dbMap['ngoaingu'] = { ...dbMap['qm_ngoai_ngu'], id: 'ngoaingu' };
dbMap['cv1239'] = { ...dbMap['qm_cv1239'], id: 'cv1239' };

export const TEMPLATES: Record<TemplateId, TemplateConfig> = dbMap as Record<
  TemplateId,
  TemplateConfig
>;

export function normalizeTemplateId(id: string): TemplateId {
  if (id === 'toan') return 'qm_toan';
  if (id === 'khtn') return 'qm_khtn_dia';
  if (id === 'khxh') return 'qm_khxh_tin_cn';
  if (id === 'ngoaingu') return 'qm_ngoai_ngu';
  if (id === 'cv1239') return 'qm_cv1239';
  if (id in TEMPLATES) return id as TemplateId;
  return 'qm_khtn_dia';
}

export function getDefaultScoringConfig(templateId: TemplateId): CustomScoringConfig {
  const tpl = TEMPLATES[templateId] || TEMPLATES.qm_khtn_dia;
  const activeP1 = tpl.defaultActiveP1;
  const activeP2 = tpl.defaultActiveP2;
  const activeP3 = tpl.defaultActiveP3;

  return {
    activeP1Count: activeP1,
    p1PointsPerQ:
      activeP1 > 0 ? Number((tpl.p1TotalPoints / activeP1).toFixed(3)) : 0.25,
    activeP2Count: activeP2,
    p2PointsMap: [0.1, 0.25, 0.5, 1.0],
    activeP3Count: activeP3,
    p3PointsPerQ: 0.5,
  };
}

export const SAMPLE_QR_IMAGE_URL =
  './assets/aistudio/M_n_SINH_H_C_-_L_p_12_-_K__ki_m_tra_KI_M_TRA_CU_I_K__I_-_02-11-26_-_QR_Chung__M__101-104__-_1_-_App_QM_2025_ee25841d.png';

/**
 * Chuỗi JSON thực tế đã giải mã từ mã QR Môn Sinh Học 12 - Kiểm tra cuối kì I (Mã 101-104 & hỗ trợ mã 4 số 0101-0104)
 */
export const DEFAULT_QR_JSON_RAW = JSON.stringify([
  [
    101,
    'C', 'C', 'B', 'A', 'D', 'A', 'A', 'A', 'C', 'A', 'B', 'B', 'D', 'A', 'C', 'D', 'B', 'D',
    'D', 'D', 'D', 'S', 'D', 'D', 'S', 'D', 'D', 'D', 'S', 'D', 'S', 'D', 'D', 'D',
    2700, 88.9, 299, 16, 28.1, 20,
  ],
  [
    102,
    'C', 'B', 'B', 'D', 'D', 'B', 'B', 'D', 'C', 'A', 'C', 'B', 'A', 'D', 'C', 'A', 'B', 'B',
    'S', 'D', 'D', 'D', 'D', 'S', 'D', 'D', 'D', 'D', 'S', 'D', 'D', 'S', 'D', 'D',
    299, 16, 28.1, 20, 2700, 88.9,
  ],
  [
    103,
    'D', 'B', 'A', 'D', 'D', 'A', 'B', 'D', 'D', 'B', 'A', 'C', 'A', 'A', 'D', 'B', 'A', 'D',
    'S', 'D', 'D', 'D', 'D', 'D', 'D', 'S', 'D', 'S', 'D', 'D', 'D', 'S', 'D', 'D',
    88.9, 20, 16, 2700, 299, 28.1,
  ],
  [
    104,
    'B', 'D', 'D', 'B', 'D', 'D', 'B', 'B', 'D', 'A', 'B', 'A', 'B', 'B', 'D', 'C', 'B', 'C',
    'D', 'S', 'D', 'D', 'D', 'D', 'S', 'D', 'D', 'D', 'D', 'S', 'D', 'S', 'D', 'D',
    28.1, 88.9, 299, 2700, 16, 20,
  ],
]);

/**
 * Bộ giải mã QR đa tầng (Multi-Pass QR Decoder):
 * Khắc phục triệt để các ảnh QR có dòng chữ tiêu đề bên dưới (QM2025, TNMaker, Azota)
 * hoặc mã QR mật độ cao (Version 15-25) bị lệch lề / thiếu viền trắng quiet-zone.
 */
export function decodeQrFromImageData(imageData: ImageData): string | null {
  const { data, width, height } = imageData;

  // Pass 1: Quét trực tiếp bằng jsQR
  const direct = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' });
  if (direct && direct.data) {
    return direct.data;
  }

  // Pass 2: Cắt bỏ phần chữ chú thích dưới đáy (ví dụ "Chấm thi QM2025 (4 Mã đề)") và thêm viền trắng Quiet-Zone
  for (const cropRatio of [1.0, 0.90, 0.86, 0.82]) {
    const cropH = Math.floor(height * cropRatio);
    const pad = 36;
    const nw = width + pad * 2;
    const nh = cropH + pad * 2;
    const padded = new Uint8ClampedArray(nw * nh * 4);
    padded.fill(255);

    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < width; x++) {
        const si = (y * width + x) * 4;
        const di = ((y + pad) * nw + (x + pad)) * 4;
        const lum = 0.299 * data[si] + 0.587 * data[si + 1] + 0.114 * data[si + 2];
        const v = lum < 150 ? 0 : 255;
        padded[di] = v;
        padded[di + 1] = v;
        padded[di + 2] = v;
        padded[di + 3] = 255;
      }
    }

    const res = jsQR(padded, nw, nh, { inversionAttempts: 'dontInvert' });
    if (res && res.data) {
      return res.data;
    }
  }

  // Pass 3: Tìm khung bao (Bounding Box) của lưới QR và lấy mẫu chuẩn hóa theo tâm từng module (Version 5 -> 25)
  const maxScanY = Math.min(height, Math.floor(width * 0.94));
  let minX = width;
  let maxX = 0;
  let minY = maxScanY;
  let maxY = 0;

  for (let y = 0; y < maxScanY; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (lum < 128) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const qrW = maxX - minX + 1;
  const qrHMeasured = maxY - minY + 1;
  if (qrW > 40 && qrHMeasured > 40) {
    const candidateHeights = Array.from(new Set([qrHMeasured, qrW]));
    for (const qrH of candidateHeights) {
      for (let v = 5; v <= 25; v++) {
        const modules = 17 + v * 4;
        const scale = 4;
        const quiet = 4;
        const totalM = modules + quiet * 2;
        const outSize = totalM * scale;
        const out = new Uint8ClampedArray(outSize * outSize * 4);
        out.fill(255);

        for (let my = 0; my < modules; my++) {
          for (let mx = 0; mx < modules; mx++) {
            const sx = Math.min(width - 1, Math.max(0, Math.round(minX + ((mx + 0.5) * qrW) / modules)));
            const sy = Math.min(height - 1, Math.max(0, Math.round(minY + ((my + 0.5) * qrH) / modules)));
            const si = (sy * width + sx) * 4;
            const lum = 0.299 * data[si] + 0.587 * data[si + 1] + 0.114 * data[si + 2];
            const val = lum < 128 ? 0 : 255;

            for (let dy = 0; dy < scale; dy++) {
              for (let dx = 0; dx < scale; dx++) {
                const ox = (mx + quiet) * scale + dx;
                const oy = (my + quiet) * scale + dy;
                const oi = (oy * outSize + ox) * 4;
                out[oi] = val;
                out[oi + 1] = val;
                out[oi + 2] = val;
                out[oi + 3] = 255;
              }
            }
          }
        }

        const code = jsQR(out, outSize, outSize, { inversionAttempts: 'dontInvert' });
        if (code && code.data) {
          return code.data;
        }
      }
    }
  }

  return null;
}

/**
 * Chuẩn hóa ký tự Đúng / Sai ('Đ', 'D', 'TRUE', '1' -> 'D'; còn lại -> 'S')
 */
function normalizeDSChar(val: unknown): 'D' | 'S' {
  const s = String(val ?? 'D').toUpperCase().trim();
  return s === 'Đ' || s === 'D' || s === 'TRUE' || s === '1' ? 'D' : 'S';
}

/**
 * Giải mã dữ liệu QR từ cả 3 phần mềm trộn đề phổ biến (QM2025, TNMaker, Azota) sang AnswerKeyData
 * Hỗ trợ tự động tương thích với toàn bộ 14 mẫu phiếu (cả mã đề 3 chữ số và 4 chữ số)
 * và tự động nhận diện số câu thực tế của Phần I, Phần II, Phần III trong mã QR.
 */
export function parseQM2025QrPayload(
  rawText: string,
  templateId: TemplateId = 'qm_khtn_dia'
): AnswerKeyData[] {
  const cleaned = rawText.trim();
  const tpl = TEMPLATES[templateId] || TEMPLATES.qm_khtn_dia;
  let parsed: any = null;

  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Hỗ trợ thêm định dạng QR dạng chuỗi thuần (Plain-text) từ các phần mềm trộn đề khác
    // Ví dụ: "101:CCBAD...#ĐĐĐS_ĐĐSĐ#2700_88.9;102:..." hoặc mỗi dòng 1 mã đề
    const textEntries: Record<string, string> = {};
    const lines = cleaned
      .split(/[\r\n;|]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    for (const line of lines) {
      const m = line.match(/^(\d{3,4})\s*[:=\-\s]\s*(.+)$/);
      if (m) {
        textEntries[m[1]] = m[2].trim();
      }
    }

    if (Object.keys(textEntries).length > 0) {
      parsed = textEntries;
    } else if (/^[A-Da-d,\s]+$/.test(cleaned)) {
      // Nếu chỉ dán chuỗi đáp án Phần I (VD: "ABCDABCD...") -> gán cho mã đề 101
      const p1Only = cleaned.toUpperCase().replace(/[^A-D]/g, '');
      if (p1Only.length > 0) {
        parsed = { [tpl.maDeDigits === 4 ? '0101' : '101']: p1Only };
      }
    }

    if (!parsed) {
      throw new Error('Dữ liệu QR không đúng định dạng đáp án hợp lệ.');
    }
  }

  // Nếu JSON bọc trong thuộc tính data / keys / answers
  if (
    parsed &&
    typeof parsed === 'object' &&
    !Array.isArray(parsed) &&
    (parsed.data || parsed.keys || parsed.answers)
  ) {
    parsed = parsed.data || parsed.keys || parsed.answers;
  }

  const result: AnswerKeyData[] = [];

  // 1. Trường hợp QR dạng Object dictionary (TNMaker / Azota {"101": "CCBAD...#ĐĐĐS_ĐĐSĐ_ĐĐSĐ_SĐĐĐ#2700_88.9...", ...})
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    for (const [codeKey, valRaw] of Object.entries(parsed)) {
      if (
        codeKey === 'success' ||
        codeKey === 'type' ||
        codeKey === 'examId' ||
        codeKey === 'title'
      ) {
        continue;
      }

      let examCode = String(codeKey).trim();
      if (tpl.maDeDigits === 4 && examCode.length === 3) {
        examCode = examCode.padStart(4, '0');
      } else if (tpl.maDeDigits === 3 && examCode.length === 4 && examCode.startsWith('0')) {
        examCode = examCode.slice(1);
      }

      if (Array.isArray(valRaw)) {
        // Trường hợp {"101": ["A","B",...]} -> Chuyển xuống bộ giải mã mảng
        parsed = Object.entries(parsed).map(([k, v]) =>
          Array.isArray(v) ? [k, ...v] : [k, String(v)]
        );
        break;
      }

      if (typeof valRaw !== 'string') continue;

      const strVal = String(valRaw);
      const parts = strVal.split('#');

      // Phần I (Trắc nghiệm A, B, C, D)
      const p1Raw = (parts[0] || '')
        .toUpperCase()
        .replace(/[^A-D]/g, '');
      const detectedP1Count = p1Raw.length;
      const choices = ['A', 'B', 'C', 'D'];
      const p1: string[] = [];
      const p1MaxLen = Math.max(tpl.p1Count, detectedP1Count, 40);
      for (let i = 0; i < p1MaxLen; i++) {
        const char = p1Raw[i];
        p1.push(choices.includes(char) ? char : choices[i % 4]);
      }

      // Phần II (Đúng / Sai: ví dụ "ĐĐĐS_ĐĐSĐ_ĐĐSĐ_SĐĐĐ")
      const p2Raw = (parts[1] || '').toUpperCase().trim();
      let p2Tokens = p2Raw
        ? p2Raw.includes('_')
          ? p2Raw.split('_').filter(Boolean)
          : p2Raw.includes(',')
          ? p2Raw.split(',').filter(Boolean)
          : []
        : [];
      if (p2Tokens.length === 0 && p2Raw.length >= 4) {
        for (let i = 0; i < p2Raw.length; i += 4) {
          p2Tokens.push(p2Raw.slice(i, i + 4));
        }
      }
      const detectedP2Count = p2Tokens.length;
      const p2: AnswerKeyData['p2'] = [];
      const p2MaxLen = Math.max(tpl.p2Count, detectedP2Count, 16);
      for (let q = 0; q < p2MaxLen; q++) {
        const token = p2Tokens[q] || p2Tokens[q % Math.max(1, detectedP2Count)] || 'DDDD';
        p2.push({
          a: normalizeDSChar(token[0] || 'D'),
          b: normalizeDSChar(token[1] || 'D'),
          c: normalizeDSChar(token[2] || 'D'),
          d: normalizeDSChar(token[3] || 'D'),
        });
      }

      // Phần III (Trả lời ngắn: ví dụ "2700_88.9_299_16_28.1_20")
      const p3Raw = (parts[2] || '').trim();
      const p3Tokens = p3Raw ? p3Raw.split(/[_;\s]+/).filter(Boolean) : [];
      const detectedP3Count = p3Tokens.length;
      const p3: (number | string)[] = [];
      const p3MaxLen = Math.max(tpl.p3Count, detectedP3Count, 12);
      for (let i = 0; i < p3MaxLen; i++) {
        const token =
          p3Tokens[i] ??
          (detectedP3Count > 0 ? p3Tokens[i % detectedP3Count] : '');
        p3.push(String(token).replace('.', ','));
      }

      result.push({
        examCode,
        p1,
        p2,
        p3,
        detectedCounts: {
          p1Count: detectedP1Count > 0 ? detectedP1Count : tpl.defaultActiveP1,
          p2Count: detectedP2Count > 0 ? detectedP2Count : tpl.defaultActiveP2,
          p3Count: detectedP3Count > 0 ? detectedP3Count : tpl.defaultActiveP3,
        },
      });
    }
    if (result.length > 0) return result;
  }

  // 2. Trường hợp QR dạng Mảng 2 chiều (QM2025 & Azota: [[101, "C", ...], [102, ...]])
  const rows = Array.isArray(parsed[0]) ? parsed : [parsed];

  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 2) continue;
    let examCode = String(row[0]).trim();
    if (tpl.maDeDigits === 4 && examCode.length === 3) {
      examCode = examCode.padStart(4, '0');
    } else if (tpl.maDeDigits === 3 && examCode.length === 4 && examCode.startsWith('0')) {
      examCode = examCode.slice(1);
    }

    const items = row.slice(1);

    // Tách tự động từ cuối mảng lên:
    // - Phần III (Trả lời ngắn): Các phần tử ở cuối mảng là số hoặc chuỗi số (VD: 2700, 88.9, "88,9", "-1,5")
    const isNumericP3Item = (v: unknown): boolean => {
      if (typeof v === 'number') return true;
      const s = String(v ?? '').trim();
      if (!s) return false;
      return /^-?\d+([.,]\d+)?$/.test(s);
    };

    let p3StartIdx = items.length;
    while (p3StartIdx > 0 && isNumericP3Item(items[p3StartIdx - 1])) {
      p3StartIdx--;
    }

    const p3ItemsRaw = items.slice(p3StartIdx);
    const p1AndP2Items = items.slice(0, p3StartIdx);

    // - Phần II (Đúng / Sai): Các phần tử ngay trước Phần III chỉ chứa 'D', 'Đ', 'S' (theo nhóm 4 ý a,b,c,d)
    const isDSItem = (v: unknown): boolean => {
      const s = String(v ?? '').toUpperCase().trim();
      return s === 'D' || s === 'Đ' || s === 'S';
    };

    let dsTrailingCount = 0;
    for (let i = p1AndP2Items.length - 1; i >= 0; i--) {
      if (isDSItem(p1AndP2Items[i])) {
        dsTrailingCount++;
      } else {
        break;
      }
    }

    // Nếu row.length === 41 chuẩn (18 P1 + 16 P2 + 6 P3), cố định 18 câu P1 và 4 câu P2 (16 ý)
    let p1ItemsRaw: unknown[];
    let p2ItemsRaw: unknown[];

    if (items.length === 40 && p3ItemsRaw.length === 6) {
      p1ItemsRaw = items.slice(0, 18);
      p2ItemsRaw = items.slice(18, 34);
    } else if (items.length === 34 && p3ItemsRaw.length === 6) {
      // Đề Toán: 12 P1 + 16 P2 + 6 P3 = 34 items
      p1ItemsRaw = items.slice(0, 12);
      p2ItemsRaw = items.slice(12, 28);
    } else {
      // Tự động suy luận số ý Phần II (bội số của 4, tối đa 32 ý = 8 câu, thường là 16 ý = 4 câu)
      let p2SubCount = Math.min(dsTrailingCount - (dsTrailingCount % 4), 32);
      // Đảm bảo giữ lại số câu Phần I hợp lý (ví dụ 12, 18, 24, 28, 36, 40)
      const remainingP1 = p1AndP2Items.length - p2SubCount;
      if (remainingP1 < 10 && p2SubCount > 16) {
        p2SubCount = 16;
      }
      const p2StartIdx = p1AndP2Items.length - p2SubCount;
      p1ItemsRaw = p1AndP2Items.slice(0, p2StartIdx);
      p2ItemsRaw = p1AndP2Items.slice(p2StartIdx);
    }

    const detectedP1Count = p1ItemsRaw.length;
    const detectedP2Count = Math.floor(p2ItemsRaw.length / 4);
    const detectedP3Count = p3ItemsRaw.length;

    const choices = ['A', 'B', 'C', 'D'];
    const p1: string[] = [];
    const p1MaxLen = Math.max(tpl.p1Count, detectedP1Count, 40);
    for (let i = 0; i < p1MaxLen; i++) {
      const val = p1ItemsRaw[i];
      const s = val !== undefined ? String(val).toUpperCase().trim() : '';
      p1.push(choices.includes(s) ? s : choices[i % 4]);
    }

    const p2: AnswerKeyData['p2'] = [];
    const p2MaxLen = Math.max(tpl.p2Count, detectedP2Count, 16);
    for (let q = 0; q < p2MaxLen; q++) {
      const base =
        detectedP2Count > 0 ? (q < detectedP2Count ? q * 4 : (q % detectedP2Count) * 4) : 0;
      p2.push({
        a: normalizeDSChar(p2ItemsRaw[base]),
        b: normalizeDSChar(p2ItemsRaw[base + 1]),
        c: normalizeDSChar(p2ItemsRaw[base + 2]),
        d: normalizeDSChar(p2ItemsRaw[base + 3]),
      });
    }

    const p3: (number | string)[] = [];
    const p3MaxLen = Math.max(tpl.p3Count, detectedP3Count, 12);
    for (let i = 0; i < p3MaxLen; i++) {
      const rawVal =
        p3ItemsRaw[i] ??
        (detectedP3Count > 0 ? p3ItemsRaw[i % detectedP3Count] : '');
      p3.push(String(rawVal).replace('.', ','));
    }

    result.push({
      examCode,
      p1,
      p2,
      p3,
      detectedCounts: {
        p1Count: detectedP1Count > 0 ? detectedP1Count : tpl.defaultActiveP1,
        p2Count: detectedP2Count > 0 ? detectedP2Count : tpl.defaultActiveP2,
        p3Count: detectedP3Count > 0 ? detectedP3Count : tpl.defaultActiveP3,
      },
    });
  }

  return result;
}

/**
 * Tọa độ chuẩn của 4 tâm ô vuông định vị góc trên khung ảnh nắn phẳng W=1024, H=550
 * BẢO TOÀN 100% HỆ QUY CHIẾU GỐC
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
 * Bảng Ma trận Tọa độ Ô Tô Tròn đã đo đạc chính xác sub-pixel từ các mẫu phiếu chuẩn QM 2025, Bộ GD, CV 1239, Azota & TNmaker
 * trên hệ quy chiếu ảnh sau khi nắn phẳng (W = 1024px, H = 550px).
 * BẢO TOÀN 100% MA TRẬN TỌA ĐỘ GỐC!
 */
export function getTemplateBubbleMap(
  templateId: TemplateId,
  offsetX = 0,
  offsetY = 0,
  radiusScale = 1.0
): SheetBubbleMap {
  const normId = normalizeTemplateId(templateId);
  const tpl = TEMPLATES[normId] || TEMPLATES.qm_khtn_dia;

  const pt = (x: number, y: number, r: number): BubblePoint => ({
    x: x + offsetX,
    y: y + offsetY,
    r: r * radiusScale,
  });

  // 1. Nhóm Toán & KHTN-Địa (Khổ ngang 2 bài/A4 - 12 hoặc 18 P1, 4 P2, 6 P3)
  if (normId === 'qm_toan' || normId === 'qm_khtn_dia') {
    const r = 7.4;
    const maDeCols = [46.3, 65.3, 84.5];
    const sbdCols = [138.4, 157.6, 176.6, 195.8, 214.8, 233.9];
    const leftRows = [282.4, 301.6, 320.8, 340.0, 359.5, 378.7, 397.9, 417.1, 436.4, 455.8];

    const maDe = maDeCols.map((cx) => leftRows.map((cy) => pt(cx, cy, r)));
    const sbd = sbdCols.map((cx) => leftRows.map((cy) => pt(cx, cy, r)));

    const p1Cols = [298.5, 317.6, 336.6, 355.8];
    const p1Rows =
      normId === 'qm_toan'
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

  // 2. Nhóm Sử, Tin, CN, GDPL (Khổ ngang 2 bài/A4 - 24 P1, 6 P2, 0 P3)
  if (normId === 'qm_khxh_tin_cn') {
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

    const p2ColPairsTop = [
      [679.2, 701.8],
      [758.7, 781.3],
      [861.1, 883.4],
      [940.8, 963.4],
    ];
    const p2RowsTop = [250.3, 273.0, 295.8, 318.5];
    const p2RowsBot = [403.5, 426.2, 449.0, 471.7];
    const p2 = [
      ...p2ColPairsTop.map(([xD, xS]) => ({
        a: [pt(xD, p2RowsTop[0], r), pt(xS, p2RowsTop[0], r)] as [BubblePoint, BubblePoint],
        b: [pt(xD, p2RowsTop[1], r), pt(xS, p2RowsTop[1], r)] as [BubblePoint, BubblePoint],
        c: [pt(xD, p2RowsTop[2], r), pt(xS, p2RowsTop[2], r)] as [BubblePoint, BubblePoint],
        d: [pt(xD, p2RowsTop[3], r), pt(xS, p2RowsTop[3], r)] as [BubblePoint, BubblePoint],
      })),
      // Câu 5 & Câu 6 ở hàng dưới
      ...[p2ColPairsTop[0], p2ColPairsTop[1]].map(([xD, xS]) => ({
        a: [pt(xD, p2RowsBot[0], r), pt(xS, p2RowsBot[0], r)] as [BubblePoint, BubblePoint],
        b: [pt(xD, p2RowsBot[1], r), pt(xS, p2RowsBot[1], r)] as [BubblePoint, BubblePoint],
        c: [pt(xD, p2RowsBot[2], r), pt(xS, p2RowsBot[2], r)] as [BubblePoint, BubblePoint],
        d: [pt(xD, p2RowsBot[3], r), pt(xS, p2RowsBot[3], r)] as [BubblePoint, BubblePoint],
      })),
    ];

    return { maDe, sbd, p1, p2, p3: [] };
  }

  // 3. Nhóm Ngoại Ngữ (Khổ ngang 2 bài/A4 - 40 câu Phần I)
  if (normId === 'qm_ngoai_ngu') {
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

  // 4. Nhóm Ôn tập Trả lời ngắn (10 câu P3)
  if (normId === 'qm_on_tap_tl_ngan') {
    const r = 6.8;
    const p3GroupCols = Array.from({ length: 10 }, (_, idx) => {
      const base = 62.0 + idx * 92.0;
      return [base, base + 17.5, base + 35.0, base + 52.5];
    });
    const p3MinusY = 175.0;
    const p3CommaY = 198.0;
    const p3DigitRows = [222.0, 245.0, 268.0, 291.0, 314.0, 337.0, 360.0, 383.0, 406.0, 429.0];
    const p3 = p3GroupCols.map((cols) => ({
      minus: pt(cols[0], p3MinusY, r),
      comma1: pt(cols[1], p3CommaY, r),
      comma2: pt(cols[2], p3CommaY, r),
      digits: cols.map((cx) => p3DigitRows.map((cy) => pt(cx, cy, r))),
    }));
    return { maDe: [], sbd: [], p1: [], p2: [], p3 };
  }

  // 5. Các mẫu Khổ dọc A4 Chuẩn & Hệ sinh thái Azota / TNmaker (Mã đề 3 số hoặc 4 số)
  const r = 5.2;
  const sbdCols =
    tpl.maDeDigits === 4
      ? [722.0, 741.0, 760.5, 780.0, 799.5, 819.0, 838.5, 858.0]
      : [722.0, 741.0, 760.5, 780.0, 799.5, 819.0];
  const maDeCols =
    tpl.maDeDigits === 4
      ? [923.6, 943.1, 962.6, 982.1]
      : [923.6, 943.1, 962.6];
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
  const p2Base8 = p2ColPairs.map(([xD, xS]) => ({
    a: [pt(xD, p2Rows[0], r), pt(xS, p2Rows[0], r)] as [BubblePoint, BubblePoint],
    b: [pt(xD, p2Rows[1], r), pt(xS, p2Rows[1], r)] as [BubblePoint, BubblePoint],
    c: [pt(xD, p2Rows[2], r), pt(xS, p2Rows[2], r)] as [BubblePoint, BubblePoint],
    d: [pt(xD, p2Rows[3], r), pt(xS, p2Rows[3], r)] as [BubblePoint, BubblePoint],
  }));

  // Hỗ trợ bản mở rộng 16 câu P2 (cv1239_mo_rong)
  const p2 =
    normId === 'cv1239_mo_rong'
      ? [
          ...p2Base8,
          ...p2ColPairs.map(([xD, xS]) => ({
            a: [pt(xD, p2Rows[0] + 35, r), pt(xS, p2Rows[0] + 35, r)] as [BubblePoint, BubblePoint],
            b: [pt(xD, p2Rows[1] + 35, r), pt(xS, p2Rows[1] + 35, r)] as [BubblePoint, BubblePoint],
            c: [pt(xD, p2Rows[2] + 35, r), pt(xS, p2Rows[2] + 35, r)] as [BubblePoint, BubblePoint],
            d: [pt(xD, p2Rows[3] + 35, r), pt(xS, p2Rows[3] + 35, r)] as [BubblePoint, BubblePoint],
          })),
        ]
      : p2Base8;

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

  const p3Base6 = p3GroupCols.map((cols) => ({
    minus: pt(cols[0], p3MinusY, r),
    comma1: pt(cols[1], p3CommaY, r),
    comma2: pt(cols[2], p3CommaY, r),
    digits: cols.map((cx) => p3DigitRows.map((cy) => pt(cx, cy, r))),
  }));

  const p3 = normId === 'cv1239_mo_rong' ? [...p3Base6, ...p3Base6] : p3Base6;

  return { maDe, sbd, p1, p2, p3 };
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
