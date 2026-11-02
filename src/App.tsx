import React, { useEffect, useMemo, useRef, useState } from 'react';
import jsQR from 'jsqr';
import * as XLSX from 'xlsx';
import {
  Award,
  BookOpen,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Edit3,
  Eye,
  FileSpreadsheet,
  FileText,
  FolderCheck,
  GraduationCap,
  Image as ImageIcon,
  Layers,
  Plus,
  QrCode,
  RefreshCw,
  Share2,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  Users,
  Volume2,
  VolumeX,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import {
  AnswerKeyData,
  CustomScoringConfig,
  DEFAULT_QR_JSON_RAW,
  getDefaultScoringConfig,
  getTemplateBubbleMap,
  parseQM2025QrPayload,
  SAMPLE_QR_IMAGE_URL,
  TARGET_CORNERS_1024x550,
  TemplateId,
  TEMPLATES,
} from './omr/templates';
import {
  detectFourCornerMarkers,
  findMatchingAnswerKey,
  generateSimulatedSheetCanvas,
  gradeWarpedSheet,
  interfaceGradedSheetRecord,
  OMRSettings,
  parseSbdToClassAndStt,
  recalculateRecordScore,
  warpPerspectiveTo1024x550,
} from './omr/visionEngine';

type ActiveTab = 'keys' | 'scanner' | 'results';
type GradingMode = 'review' | 'continuous' | 'verify';

export interface StudentRosterItem {
  stt: number;
  fullName: string;
  sbd?: string;
  examCode?: string;
  p1Score?: number;
  p2Score?: number;
  p3Score?: number;
  totalScore?: number;
  gradedAt?: string;
  recordId?: string;
}

export interface ClassRosterGroup {
  id: string;
  className: string; // e.g., "12A1"
  sbdPrefix: string; // 2 chữ số đầu của SBD nhận biết lớp, ví dụ "01"
  students: StudentRosterItem[];
}

const DEFAULT_CLASS_ROSTERS: ClassRosterGroup[] = [
  {
    id: 'cls-12a1',
    className: '12A1',
    sbdPrefix: '01',
    students: [
      { stt: 1, fullName: 'Nguyễn Minh An' },
      { stt: 2, fullName: 'Trần Hoàng Bách' },
      { stt: 3, fullName: 'Lê Ngọc Bảo Châu' },
      { stt: 4, fullName: 'Phạm Quốc Đạt' },
      { stt: 5, fullName: 'Võ Thị Hương Giang' },
      { stt: 6, fullName: 'Đặng Gia Huy' },
      { stt: 7, fullName: 'Bùi Khánh Linh' },
      { stt: 8, fullName: 'Hồ Tấn Minh' },
      { stt: 9, fullName: 'Ngô Phương Nam' },
      { stt: 10, fullName: 'Lý Thanh Thảo' },
    ],
  },
  {
    id: 'cls-12a2',
    className: '12A2',
    sbdPrefix: '02',
    students: [
      { stt: 1, fullName: 'Trương Quốc Anh' },
      { stt: 2, fullName: 'Phan Thanh Bình' },
      { stt: 3, fullName: 'Đỗ Ngọc Diệp' },
      { stt: 4, fullName: 'Huỳnh Tấn Phát' },
      { stt: 5, fullName: 'Nguyễn Thảo Vy' },
    ],
  },
];

const SUBJECT_OPTIONS = [
  'Sinh Học',
  'Toán Học',
  'Vật Lý',
  'Hóa Học',
  'Lịch Sử',
  'Địa Lí',
  'Tiếng Anh',
  'Tin Học',
  'Công Nghệ',
  'GDKT & Pháp Luật',
];

const EXAM_PERIOD_OPTIONS = [
  'Kiểm tra Cuối kì I',
  'Kiểm tra Giữa kì I',
  'Kiểm tra Thường xuyên',
  'Kiểm tra Giữa kì II',
  'Kiểm tra Cuối kì II',
  'Thi Thử TN THPT 2025',
];

function playSuccessBeep() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.14);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.19);
  } catch {
    // Ignore audio errors
  }
}

function speakScoreVietnamese(score: number, studentName?: string) {
  try {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const text = studentName
      ? `${studentName}, ${score.toString().replace('.', ' phẩy ')} điểm`
      : `${score.toString().replace('.', ' phẩy ')} điểm`;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'vi-VN';
    utter.rate = 1.15;
    window.speechSynthesis.speak(utter);
  } catch {
    // Ignore speech synthesis errors
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('keys');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>('cv1239');

  // Khung quản lý Môn, Kỳ kiểm tra, Lớp
  const [selectedSubject, setSelectedSubject] = useState<string>('Sinh Học');
  const [selectedExamPeriod, setSelectedExamPeriod] = useState<string>('Kiểm tra Cuối kì I');
  const [classRosters, setClassRosters] = useState<ClassRosterGroup[]>(() => {
    try {
      const saved = localStorage.getItem('edu_cham_de_2025_rosters');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return DEFAULT_CLASS_ROSTERS;
  });
  const [activeClassId, setActiveClassId] = useState<string>('cls-12a1');
  const [showClassModal, setShowClassModal] = useState(false);

  // Tùy chỉnh số câu & điểm từng phần cho từng mẫu phiếu
  const [scoringConfigs, setScoringConfigs] = useState<Record<TemplateId, CustomScoringConfig>>(() => ({
    cv1239: getDefaultScoringConfig('cv1239'),
    toan: getDefaultScoringConfig('toan'),
    khtn: getDefaultScoringConfig('khtn'),
    khxh: getDefaultScoringConfig('khxh'),
    ngoaingu: getDefaultScoringConfig('ngoaingu'),
  }));
  const [showScoringPanel, setShowScoringPanel] = useState<boolean>(true);

  const currentScoring = scoringConfigs[selectedTemplate];

  const updateCurrentScoring = (patch: Partial<CustomScoringConfig>) => {
    setScoringConfigs((prev) => ({
      ...prev,
      [selectedTemplate]: {
        ...prev[selectedTemplate],
        ...patch,
      },
    }));
  };

  // Chế độ chấm
  const [gradingMode, setGradingMode] = useState<GradingMode>('review');
  const [voiceReadout, setVoiceReadout] = useState<boolean>(true);

  // Kho đáp án theo mã đề
  const [answerKeys, setAnswerKeys] = useState<Record<string, AnswerKeyData>>({});
  const [selectedExamCodeView, setSelectedExamCodeView] = useState<string>('');
  const [rawQrInput, setRawQrInput] = useState<string>(DEFAULT_QR_JSON_RAW);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'warning' | 'info';
    message: string;
  } | null>(null);

  // QR Camera State
  const [isQrCameraOpen, setIsQrCameraOpen] = useState(false);
  const qrVideoRef = useRef<HTMLVideoElement | null>(null);

  // OMR Scanner State
  const [isOmrCameraOpen, setIsOmrCameraOpen] = useState(false);
  const [autoTriggerOmr, setAutoTriggerOmr] = useState(true);
  const [showGridOverlay, setShowGridOverlay] = useState(false);
  const [showCalibration, setShowCalibration] = useState(false);
  const [omrSettings, setOmrSettings] = useState<OMRSettings>({
    fillThreshold: 0.35,
    offsetX: 0,
    offsetY: 0,
    radiusScale: 1.0,
  });

  const omrVideoRef = useRef<HTMLVideoElement | null>(null);
  const omrOverlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lockCounterRef = useRef<number>(0);
  const cooldownRef = useRef<boolean>(false);

  // Kết quả chấm
  const [gradedRecords, setGradedRecords] = useState<interfaceGradedSheetRecord[]>(() => {
    try {
      const saved = localStorage.getItem('edu_cham_de_2025_records');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [];
  });
  const [activeHudRecord, setActiveHudRecord] = useState<interfaceGradedSheetRecord | null>(null);
  const [simExamCode, setSimExamCode] = useState<string>('0101');
  const [simSbd, setSimSbd] = useState<string>('010001');

  // Form thêm lớp & học sinh trong Modal Danh Sách Lớp
  const [newClassName, setNewClassName] = useState<string>('');
  const [newClassPrefix, setNewClassPrefix] = useState<string>('');
  const [bulkStudentsText, setBulkStudentsText] = useState<string>('');
  const [singleStudentStt, setSingleStudentStt] = useState<string>('');
  const [singleStudentName, setSingleStudentName] = useState<string>('');

  // Lưu LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('edu_cham_de_2025_records', JSON.stringify(gradedRecords));
    } catch {
      // ignore
    }
  }, [gradedRecords]);

  useEffect(() => {
    try {
      localStorage.setItem('edu_cham_de_2025_rosters', JSON.stringify(classRosters));
    } catch {
      // ignore
    }
  }, [classRosters]);

  // Nạp sẵn mã QR mẫu khi khởi chạy hoặc đổi mẫu phiếu
  useEffect(() => {
    try {
      const parsedList = parseQM2025QrPayload(rawQrInput, selectedTemplate);
      const mapObj: Record<string, AnswerKeyData> = {};
      parsedList.forEach((k) => {
        mapObj[k.examCode] = k;
      });
      setAnswerKeys(mapObj);
      const firstCode = parsedList[0]?.examCode || '';
      setSelectedExamCodeView(firstCode);
      setSimExamCode(firstCode || (TEMPLATES[selectedTemplate].maDeDigits === 4 ? '0101' : '101'));
    } catch {
      // ignore
    }
  }, [selectedTemplate]);

  // Đồng bộ SBD mô phỏng với lớp đang chọn
  const activeClassGroup = useMemo(
    () => classRosters.find((c) => c.id === activeClassId) || classRosters[0],
    [classRosters, activeClassId]
  );

  useEffect(() => {
    if (activeClassGroup) {
      const nextStt = String(1).padStart(4, '0');
      setSimSbd(`${activeClassGroup.sbdPrefix}${nextStt}`);
    }
  }, [activeClassId]);

  /**
   * Tự động đối chiếu SBD của phiếu chấm với Danh Sách Lớp:
   * - 2 chữ số đầu của SBD nhận biết Lớp (so khớp với sbdPrefix của lớp hoặc tên lớp)
   * - Các chữ số còn lại là STT của học sinh trong lớp đó
   */
  const enrichAndSyncRecordWithRoster = (
    rawRecord: interfaceGradedSheetRecord,
    saveToRoster: boolean
  ): interfaceGradedSheetRecord => {
    const { sbdClassPrefix, sbdStudentOrder } = parseSbdToClassAndStt(rawRecord.sbd);

    // Tìm lớp có sbdPrefix trùng với 2 chữ số đầu của SBD (hoặc lớp đang chọn nếu prefix khớp)
    let matchedClass = classRosters.find(
      (c) => c.sbdPrefix.padStart(2, '0') === sbdClassPrefix
    );
    if (!matchedClass && activeClassGroup?.sbdPrefix === sbdClassPrefix) {
      matchedClass = activeClassGroup;
    }

    const matchedStudent =
      matchedClass && sbdStudentOrder !== null
        ? matchedClass.students.find((s) => s.stt === sbdStudentOrder)
        : undefined;

    const enriched: interfaceGradedSheetRecord = {
      ...rawRecord,
      sbdClassPrefix,
      sbdStudentOrder,
      className: matchedClass ? matchedClass.className : activeClassGroup?.className || 'Chưa phân lớp',
      studentName: matchedStudent ? matchedStudent.fullName : undefined,
      subjectName: selectedSubject,
      examPeriod: selectedExamPeriod,
    };

    if (saveToRoster && matchedClass && sbdStudentOrder !== null) {
      setClassRosters((prev) =>
        prev.map((cls) => {
          if (cls.id !== matchedClass!.id) return cls;
          const exists = cls.students.some((st) => st.stt === sbdStudentOrder);
          const updatedStudents = exists
            ? cls.students.map((st) =>
                st.stt === sbdStudentOrder
                  ? {
                      ...st,
                      sbd: enriched.sbd,
                      examCode: enriched.examCode,
                      p1Score: enriched.p1Score,
                      p2Score: enriched.p2Score,
                      p3Score: enriched.p3Score,
                      totalScore: enriched.totalScore,
                      gradedAt: enriched.timestamp,
                      recordId: enriched.id,
                    }
                  : st
              )
            : [
                ...cls.students,
                {
                  stt: sbdStudentOrder,
                  fullName: `Học sinh STT ${sbdStudentOrder}`,
                  sbd: enriched.sbd,
                  examCode: enriched.examCode,
                  p1Score: enriched.p1Score,
                  p2Score: enriched.p2Score,
                  p3Score: enriched.p3Score,
                  totalScore: enriched.totalScore,
                  gradedAt: enriched.timestamp,
                  recordId: enriched.id,
                },
              ].sort((a, b) => a.stt - b.stt);

          return {
            ...cls,
            students: updatedStudents,
          };
        })
      );
    }

    return enriched;
  };

  // Xử lý sau khi chấm xong 1 phiếu theo Chế Độ Chấm (review / continuous / verify)
  const handleCompletedScanRecord = (rawRecord: interfaceGradedSheetRecord) => {
    playSuccessBeep();
    if (navigator.vibrate) navigator.vibrate([70, 40, 100]);

    if (gradingMode === 'verify') {
      const enriched = enrichAndSyncRecordWithRoster(rawRecord, false);
      setActiveHudRecord(enriched);
      if (voiceReadout) speakScoreVietnamese(enriched.totalScore, enriched.studentName);
      setStatusBanner({
        type: 'info',
        message: `[Chế độ Chấm đối chiếu] SBD ${enriched.sbd} (${enriched.studentName || 'Chưa rõ tên'}) — ${enriched.totalScore.toFixed(2)} điểm.`,
      });
      return;
    }

    const enriched = enrichAndSyncRecordWithRoster(rawRecord, true);
    setGradedRecords((prev) => [enriched, ...prev.filter((r) => r.sbd !== enriched.sbd || enriched.sbd.includes('?'))]);

    if (voiceReadout) {
      speakScoreVietnamese(enriched.totalScore, enriched.studentName);
    }

    if (gradingMode === 'continuous') {
      // Chấm liên tục: lưu thẳng vào danh sách lớp & hiện thông báo nổi, không khóa màn hình bằng popup
      setStatusBanner({
        type: 'success',
        message: `Đã chấm & lưu tự động: SBD ${enriched.sbd} ${
          enriched.studentName ? `(${enriched.studentName} - Lớp ${enriched.className})` : ''
        } • Mã đề ${enriched.examCode} • Tổng: ${enriched.totalScore.toFixed(2)}đ`,
      });
    } else {
      // Chế độ xem kết quả ngay (review)
      setActiveHudRecord(enriched);
    }
  };

  // 1. NẠP ĐÁP ÁN TỪ CHUỖI JSON QR HOẶC ẢNH QR
  const handleApplyRawJsonQr = (jsonStr: string) => {
    try {
      const list = parseQM2025QrPayload(jsonStr, selectedTemplate);
      if (list.length === 0) {
        setStatusBanner({ type: 'warning', message: 'Không tìm thấy mã đề nào trong dữ liệu QR.' });
        return;
      }
      const nextMap: Record<string, AnswerKeyData> = {};
      list.forEach((item) => {
        nextMap[item.examCode] = item;
      });
      setAnswerKeys(nextMap);
      setSelectedExamCodeView(list[0].examCode);
      setSimExamCode(list[0].examCode);
      setStatusBanner({
        type: 'success',
        message: `Đã giải mã thành công ${list.length} mã đề (${list.map((x) => x.examCode).join(', ')}) cho ${TEMPLATES[selectedTemplate].shortName}!`,
      });
    } catch (err) {
      setStatusBanner({
        type: 'warning',
        message: `Lỗi giải mã JSON QR: ${err instanceof Error ? err.message : 'Định dạng không hợp lệ'}`,
      });
    }
  };

  const handleScanUploadedQrImage = async (file: File) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      URL.revokeObjectURL(url);
      if (code && code.data) {
        setRawQrInput(code.data);
        handleApplyRawJsonQr(code.data);
      } else {
        setStatusBanner({
          type: 'warning',
          message: 'Không tìm thấy mã QR hợp lệ trong bức ảnh tải lên. Hãy thử ảnh rõ nét hơn.',
        });
      }
    };
    img.src = url;
  };

  const handleLoadBuiltInSampleQrImage = async () => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = (e) => reject(e);
        img.src = SAMPLE_QR_IMAGE_URL;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code && code.data) {
        setRawQrInput(code.data);
        handleApplyRawJsonQr(code.data);
      } else {
        setRawQrInput(DEFAULT_QR_JSON_RAW);
        handleApplyRawJsonQr(DEFAULT_QR_JSON_RAW);
      }
    } catch {
      setRawQrInput(DEFAULT_QR_JSON_RAW);
      handleApplyRawJsonQr(DEFAULT_QR_JSON_RAW);
    }
  };

  // Quét QR trực tiếp bằng Camera
  useEffect(() => {
    if (!isQrCameraOpen) return;
    let stream: MediaStream | null = null;
    let animId = 0;

    const startQrCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (qrVideoRef.current) {
          qrVideoRef.current.srcObject = stream;
          await qrVideoRef.current.play();
        }

        const scanCanvas = document.createElement('canvas');
        const scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true })!;

        const tick = () => {
          const video = qrVideoRef.current;
          if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
            scanCanvas.width = video.videoWidth;
            scanCanvas.height = video.videoHeight;
            scanCtx.drawImage(video, 0, 0);
            const imgData = scanCtx.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
            const qr = jsQR(imgData.data, imgData.width, imgData.height);
            if (qr && qr.data) {
              playSuccessBeep();
              setRawQrInput(qr.data);
              handleApplyRawJsonQr(qr.data);
              setIsQrCameraOpen(false);
              return;
            }
          }
          animId = requestAnimationFrame(tick);
        };
        animId = requestAnimationFrame(tick);
      } catch {
        setStatusBanner({
          type: 'warning',
          message: 'Không thể truy cập Camera quét QR. Vui lòng cấp quyền Camera hoặc tải ảnh QR lên.',
        });
        setIsQrCameraOpen(false);
      }
    };

    startQrCamera();
    return () => {
      cancelAnimationFrame(animId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [isQrCameraOpen, selectedTemplate]);

  // 2. ĐỌC ĐÁP ÁN TỪ FILE EXCEL CHUẨN QM 2025 (.XLSX)
  const handleImportExcelAnswerKey = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1 });

      const tpl = TEMPLATES[selectedTemplate];
      const codeCols: { colIdx: number; code: string }[] = [];
      let headerRowIdx = -1;

      for (let r = 0; r < Math.min(10, rows.length); r++) {
        const row = rows[r];
        if (!Array.isArray(row)) continue;
        const foundCols: { colIdx: number; code: string }[] = [];
        for (let c = 1; c < row.length; c++) {
          const cellVal = String(row[c] ?? '').trim();
          if (/^\d{3,4}$/.test(cellVal)) {
            const normCode =
              tpl.maDeDigits === 4 && cellVal.length === 3
                ? cellVal.padStart(4, '0')
                : cellVal;
            foundCols.push({ colIdx: c, code: normCode });
          }
        }
        if (foundCols.length >= 1) {
          headerRowIdx = r;
          codeCols.push(...foundCols);
          break;
        }
      }

      if (codeCols.length === 0) {
        setStatusBanner({
          type: 'warning',
          message: 'Không tìm thấy các cột Mã Đề (ví dụ 101, 102 hoặc 0101) trong sheet Excel.',
        });
        return;
      }

      const keyMap: Record<string, AnswerKeyData> = {};
      for (const { code } of codeCols) {
        keyMap[code] = {
          examCode: code,
          p1: new Array(tpl.p1Count).fill('A'),
          p2: Array.from({ length: tpl.p2Count }, () => ({ a: 'D', b: 'D', c: 'D', d: 'D' })),
          p3: new Array(tpl.p3Count).fill(''),
        };
      }

      let currentSection: 1 | 2 | 3 = 1;
      for (let r = headerRowIdx + 1; r < rows.length; r++) {
        const row = rows[r];
        if (!Array.isArray(row) || row.length === 0) continue;
        const label = String(row[0] ?? '').trim();
        if (!label) continue;

        const upperLabel = label.toUpperCase();
        if (upperLabel.includes('PHẦN I') && !upperLabel.includes('PHẦN II') && !upperLabel.includes('PHẦN III')) {
          currentSection = 1;
          continue;
        }
        if (upperLabel.includes('PHẦN II') && !upperLabel.includes('PHẦN III')) {
          currentSection = 2;
          continue;
        }
        if (upperLabel.includes('PHẦN III')) {
          currentSection = 3;
          continue;
        }

        const p2Match = label.match(/^(\d+)\s*([a-dA-D])$/);
        if (p2Match) {
          const qIdx = Number(p2Match[1]) - 1;
          const subK = p2Match[2].toLowerCase() as 'a' | 'b' | 'c' | 'd';
          if (qIdx >= 0 && qIdx < tpl.p2Count) {
            for (const { colIdx, code } of codeCols) {
              const rawAns = String(row[colIdx] ?? 'D').toUpperCase().trim();
              keyMap[code].p2[qIdx][subK] =
                rawAns === 'Đ' || rawAns === 'D' || rawAns === 'TRUE' ? 'D' : 'S';
            }
          }
          continue;
        }

        if (/^\d+$/.test(label)) {
          const qNum = Number(label);
          for (const { colIdx, code } of codeCols) {
            const cellVal = row[colIdx];
            if (cellVal === undefined || cellVal === null || cellVal === '') continue;
            const strVal = String(cellVal).trim();

            if (currentSection === 1 && /^[A-Da-d]$/.test(strVal) && qNum <= tpl.p1Count) {
              keyMap[code].p1[qNum - 1] = strVal.toUpperCase();
            } else if (currentSection === 3 || !/^[A-Da-d]$/.test(strVal)) {
              if (qNum >= 1 && qNum <= tpl.p3Count) {
                keyMap[code].p3[qNum - 1] = cellVal;
              }
            }
          }
        }
      }

      setAnswerKeys(keyMap);
      const firstCode = codeCols[0].code;
      setSelectedExamCodeView(firstCode);
      setSimExamCode(firstCode);
      setStatusBanner({
        type: 'success',
        message: `Đã nạp thành công bảng đáp án Excel gồm ${codeCols.length} mã đề (${codeCols.map((c) => c.code).join(', ')})!`,
      });
    } catch (err) {
      setStatusBanner({
        type: 'warning',
        message: `Không thể đọc file Excel: ${err instanceof Error ? err.message : 'Lỗi định dạng'}`,
      });
    }
  };

  // 3. CAMERA QUÉT PHIẾU OMR THỜI GIAN THỰC
  useEffect(() => {
    if (!isOmrCameraOpen || activeTab !== 'scanner') return;
    let stream: MediaStream | null = null;
    let animId = 0;

    const startOmrStream = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (omrVideoRef.current) {
          omrVideoRef.current.srcObject = stream;
          await omrVideoRef.current.play();
        }

        const procCanvas = document.createElement('canvas');
        const procCtx = procCanvas.getContext('2d', { willReadFrequently: true })!;

        const processFrame = () => {
          const video = omrVideoRef.current;
          const overlay = omrOverlayCanvasRef.current;

          if (video && overlay && video.readyState === video.HAVE_ENOUGH_DATA) {
            const vw = video.videoWidth;
            const vh = video.videoHeight;
            if (overlay.width !== vw || overlay.height !== vh) {
              overlay.width = vw;
              overlay.height = vh;
            }
            procCanvas.width = vw;
            procCanvas.height = vh;
            procCtx.drawImage(video, 0, 0, vw, vh);

            const frameData = procCtx.getImageData(0, 0, vw, vh);
            const corners = detectFourCornerMarkers(frameData);

            const oCtx = overlay.getContext('2d')!;
            oCtx.clearRect(0, 0, vw, vh);

            const polyColor = corners.found ? '#10b981' : '#f59e0b';
            oCtx.strokeStyle = polyColor;
            oCtx.lineWidth = 4;
            oCtx.beginPath();
            oCtx.moveTo(corners.tl.x, corners.tl.y);
            oCtx.lineTo(corners.tr.x, corners.tr.y);
            oCtx.lineTo(corners.br.x, corners.br.y);
            oCtx.lineTo(corners.bl.x, corners.bl.y);
            oCtx.closePath();
            oCtx.stroke();

            for (const pt of [corners.tl, corners.tr, corners.bl, corners.br]) {
              oCtx.fillStyle = polyColor;
              oCtx.beginPath();
              oCtx.arc(pt.x, pt.y, 10, 0, Math.PI * 2);
              oCtx.fill();
            }

            if (corners.found && !cooldownRef.current && (!activeHudRecord || gradingMode === 'continuous')) {
              lockCounterRef.current += 1;
              if (autoTriggerOmr && lockCounterRef.current >= 9) {
                lockCounterRef.current = 0;
                cooldownRef.current = true;
                const warped = warpPerspectiveTo1024x550(frameData, corners);
                const record = gradeWarpedSheet(
                  warped,
                  selectedTemplate,
                  answerKeys,
                  omrSettings,
                  currentScoring
                );
                handleCompletedScanRecord(record);
                setTimeout(() => {
                  cooldownRef.current = false;
                }, 1800);
              }
            } else {
              lockCounterRef.current = Math.max(0, lockCounterRef.current - 1);
            }
          }
          animId = requestAnimationFrame(processFrame);
        };

        animId = requestAnimationFrame(processFrame);
      } catch {
        setStatusBanner({
          type: 'warning',
          message:
            'Trình duyệt chưa cấp quyền Camera hoặc thiết bị không có Camera. Bạn có thể tải ảnh phiếu hoặc dùng nút Mô Phỏng Phiếu Tô Mẫu.',
        });
        setIsOmrCameraOpen(false);
      }
    };

    startOmrStream();
    return () => {
      cancelAnimationFrame(animId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [
    isOmrCameraOpen,
    activeTab,
    autoTriggerOmr,
    selectedTemplate,
    answerKeys,
    omrSettings,
    currentScoring,
    activeHudRecord,
    gradingMode,
  ]);

  // Chụp thủ công từ Camera đang bật
  const handleManualCaptureFromVideo = () => {
    const video = omrVideoRef.current;
    if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0);
    const frameData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const corners = detectFourCornerMarkers(frameData);
    const warped = warpPerspectiveTo1024x550(frameData, corners);
    const record = gradeWarpedSheet(
      warped,
      selectedTemplate,
      answerKeys,
      omrSettings,
      currentScoring
    );
    handleCompletedScanRecord(record);
  };

  // Chấm từ file ảnh phiếu chụp sẵn
  const handleGradeUploadedSheetImage = (file: File) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, img.width, img.height);
      const corners = detectFourCornerMarkers(imgData);
      const warped = warpPerspectiveTo1024x550(imgData, corners);
      const record = gradeWarpedSheet(
        warped,
        selectedTemplate,
        answerKeys,
        omrSettings,
        currentScoring
      );
      URL.revokeObjectURL(url);
      handleCompletedScanRecord(record);
    };
    img.src = url;
  };

  // Tạo & Chấm ngay Phiếu Tô Mẫu Thực Tế (Simulator)
  const handleRunSimulatedSheet = async (accuracy = 0.88) => {
    const targetKey =
      findMatchingAnswerKey(simExamCode, answerKeys) ||
      Object.values(answerKeys)[0] || {
        examCode: simExamCode || '0101',
        p1: new Array(40).fill('A'),
        p2: Array.from({ length: 8 }, () => ({ a: 'D', b: 'S', c: 'D', d: 'D' })),
        p3: [16, 20, 28.1, 299, 88.9, 2700],
      };

    const simCanvas = await generateSimulatedSheetCanvas(
      selectedTemplate,
      simSbd,
      targetKey.examCode,
      targetKey,
      accuracy,
      currentScoring
    );

    const record = gradeWarpedSheet(
      simCanvas,
      selectedTemplate,
      answerKeys,
      omrSettings,
      currentScoring
    );
    handleCompletedScanRecord(record);

    // Tự động tăng SBD lên 1 học sinh tiếp theo trong lớp để giáo viên bấm chấm liên tiếp dễ dàng
    const { sbdClassPrefix, sbdStudentOrder } = parseSbdToClassAndStt(simSbd);
    if (sbdStudentOrder !== null) {
      const nextOrder = String(sbdStudentOrder + 1).padStart(4, '0');
      setSimSbd(`${sbdClassPrefix || '01'}${nextOrder}`);
    }
  };

  // 4. LƯU MINH CHỨNG BÀI CHẤM (TẢI ẢNH CÓ ĐÓNG DẤU ĐIỂM HOẶC CHIA SẺ LÊN GOOGLE DRIVE TRÊN ĐT)
  const buildStampedEvidenceBlob = async (
    record: interfaceGradedSheetRecord
  ): Promise<{ blob: Blob; dataUrl: string; filename: string }> => {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (e) => reject(e);
      img.src = record.annotatedImageDataUrl;
    });

    const bannerH = 92;
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height + bannerH;
    const ctx = canvas.getContext('2d')!;

    // Vẽ header minh chứng bài chấm
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, bannerH);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(
      `MINH CHỨNG CHẤM THI — EDU CHẤM ĐỀ 2025 | ${record.subjectName || selectedSubject} (${
        record.examPeriod || selectedExamPeriod
      })`,
      20,
      32
    );

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(
      `Lớp: ${record.className || activeClassGroup?.className || ''} | SBD: ${record.sbd} (STT: ${
        record.sbdStudentOrder ?? '--'
      }) | Học sinh: ${record.studentName || '---'} | Mã đề: ${record.examCode}`,
      20,
      62
    );

    // Khung điểm nổi bật bên phải
    ctx.fillStyle = '#10b981';
    ctx.fillRect(canvas.width - 250, 12, 232, 68);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px monospace';
    ctx.fillText(`ĐIỂM: ${record.totalScore.toFixed(2)}`, canvas.width - 232, 48);
    ctx.font = 'bold 12px monospace';
    ctx.fillText(
      `P1:${record.p1Score} | P2:${record.p2Score} | P3:${record.p3Score}`,
      canvas.width - 232,
      70
    );

    ctx.drawImage(img, 0, bannerH);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const safeName = (record.studentName || `SBD_${record.sbd}`).replace(/\s+/g, '_');
    const filename = `MinhChung_${record.className || 'Lop'}_${safeName}_MaDe_${record.examCode}_${record.totalScore}d.jpg`;
    return { blob, dataUrl, filename };
  };

  const handleSaveEvidenceSheet = async (
    record: interfaceGradedSheetRecord,
    useNativeShare = false
  ) => {
    try {
      const { blob, dataUrl, filename } = await buildStampedEvidenceBlob(record);
      const file = new File([blob], filename, { type: 'image/jpeg' });

      if (useNativeShare && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Minh chứng chấm bài - SBD ${record.sbd}`,
          text: `Bài chấm môn ${record.subjectName || selectedSubject} - HS: ${
            record.studentName || record.sbd
          } - Điểm: ${record.totalScore}`,
          files: [file],
        });
        return;
      }

      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      a.click();
      setStatusBanner({
        type: 'success',
        message: `Đã lưu ảnh minh chứng bài chấm (${filename}) về thiết bị!`,
      });
    } catch {
      setStatusBanner({
        type: 'warning',
        message: 'Không thể tạo tệp minh chứng. Vui lòng thử lại.',
      });
    }
  };

  // Xuất Hồ Sơ Minh Chứng Tổng Hợp (.HTML có nhúng toàn bộ ảnh bài chấm để lưu Drive / In PDF)
  const handleExportFullEvidencePortfolioHtml = () => {
    if (gradedRecords.length === 0) return;
    const htmlContent = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8" />
<title>Hồ Sơ Minh Chứng Chấm Thi - ${selectedSubject} - ${selectedExamPeriod}</title>
<style>
  body { font-family: Arial, sans-serif; background: #f8fafc; color: #0f172a; margin: 24px; }
  h1 { color: #1d4ed8; margin-bottom: 4px; }
  .meta { color: #475569; margin-bottom: 20px; font-size: 14px; }
  .card { background: #fff; border: 2px solid #cbd5e1; border-radius: 12px; padding: 16px; margin-bottom: 24px; page-break-inside: avoid; }
  .card-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 12px; }
  .score { font-size: 22px; font-weight: bold; color: #059669; }
  img { max-width: 100%; border-radius: 8px; border: 1px solid #cbd5e1; }
</style>
</head>
<body>
  <h1>HỒ SƠ MINH CHỨNG BÀI CHẤM TRẮC NGHIỆM — EDU CHẤM ĐỀ 2025</h1>
  <div class="meta">
    <strong>Môn học:</strong> ${selectedSubject} &nbsp;|&nbsp;
    <strong>Kỳ kiểm tra:</strong> ${selectedExamPeriod} &nbsp;|&nbsp;
    <strong>Lớp:</strong> ${activeClassGroup?.className || ''} &nbsp;|&nbsp;
    <strong>Tổng số bài:</strong> ${gradedRecords.length} bài &nbsp;|&nbsp;
    <strong>Tác giả hệ thống:</strong> Hồ Tấn Khải - THPT Mang Thít, Vĩnh Long
  </div>
  ${gradedRecords
    .map(
      (r, idx) => `
    <div class="card">
      <div class="card-header">
        <div>
          <strong>#${idx + 1} — SBD: ${r.sbd} (STT: ${r.sbdStudentOrder ?? '--'})</strong> |
          Học sinh: <strong>${r.studentName || '---'}</strong> |
          Lớp: <strong>${r.className || '---'}</strong> |
          Mã đề: <strong>${r.examCode}</strong>
        </div>
        <div class="score">Tổng điểm: ${r.totalScore.toFixed(2)} đ (P1: ${r.p1Score} | P2: ${r.p2Score} | P3: ${r.p3Score})</div>
      </div>
      <img src="${r.annotatedImageDataUrl}" alt="Minh chung SBD ${r.sbd}" />
    </div>`
    )
    .join('\n')}
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Ho_So_Minh_Chung_${selectedSubject}_${activeClassGroup?.className || 'Lop'}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 5. XUẤT BẢNG ĐIỂM EXCEL THEO DANH SÁCH LỚP VÀ LỊCH SỬ QUÉT
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Danh sách lớp kèm điểm tự động khớp theo SBD
    if (activeClassGroup) {
      const rosterRows = activeClassGroup.students.map((st) => ({
        'STT': st.stt,
        'Mã Lớp (2 số đầu SBD)': activeClassGroup.sbdPrefix,
        'Số Báo Danh': st.sbd || `${activeClassGroup.sbdPrefix}${String(st.stt).padStart(4, '0')}`,
        'Họ và Tên Học Sinh': st.fullName,
        'Lớp': activeClassGroup.className,
        'Môn Học': selectedSubject,
        'Kỳ Kiểm Tra': selectedExamPeriod,
        'Mã Đề': st.examCode || '',
        'Điểm Phần I': st.p1Score ?? '',
        'Điểm Phần II': st.p2Score ?? '',
        'Điểm Phần III': st.p3Score ?? '',
        'TỔNG ĐIỂM': st.totalScore ?? '',
        'Giờ Chấm': st.gradedAt || '',
      }));
      const wsRoster = XLSX.utils.json_to_sheet(rosterRows);
      XLSX.utils.book_append_sheet(wb, wsRoster, `DS_Lop_${activeClassGroup.className}`);
    }

    // Sheet 2: Toàn bộ lượt quét chi tiết
    if (gradedRecords.length > 0) {
      const rows = gradedRecords.map((r, index) => ({
        'STT Quét': index + 1,
        'Thời gian': r.timestamp,
        'Môn Học': r.subjectName || selectedSubject,
        'Kỳ Kiểm Tra': r.examPeriod || selectedExamPeriod,
        'Lớp (Từ 2 số đầu SBD)': r.className || '',
        'STT Học Sinh': r.sbdStudentOrder ?? '',
        'Họ và Tên Học Sinh': r.studentName || '',
        'Số Báo Danh': r.sbd,
        'Mã Đề': r.examCode,
        'Mẫu Phiếu': TEMPLATES[r.templateId].shortName,
        'Số câu đúng P1': `${r.p1CorrectCount}/${r.p1TotalCount}`,
        'Điểm Phần I': r.p1Score,
        'Điểm Phần II (Đ/S)': r.p2Score,
        'Số câu đúng P3': `${r.p3CorrectCount}/${r.p3TotalCount}`,
        'Điểm Phần III': r.p3Score,
        'TỔNG ĐIỂM': r.totalScore,
        'Ghi chú / Cảnh báo': r.warnings.join('; '),
      }));
      const wsAll = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, wsAll, 'Lich_Su_Cham_Chi_Tiet');
    }

    XLSX.writeFile(
      wb,
      `Bang_Diem_${selectedSubject}_${activeClassGroup?.className || 'QM2025'}_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`
    );
  };

  // Quản lý thêm Lớp mới & thêm Học sinh vào Danh Sách Lớp
  const handleAddNewClassGroup = () => {
    const cleanName = newClassName.trim().toUpperCase();
    const cleanPrefix = newClassPrefix.replace(/[^0-9]/g, '').padStart(2, '0').slice(0, 2);
    if (!cleanName || !cleanPrefix) return;

    const newGroup: ClassRosterGroup = {
      id: `cls-${Date.now()}`,
      className: cleanName,
      sbdPrefix: cleanPrefix,
      students: [],
    };
    setClassRosters((prev) => [...prev, newGroup]);
    setActiveClassId(newGroup.id);
    setNewClassName('');
    setNewClassPrefix('');
  };

  const handleAddSingleStudent = () => {
    if (!activeClassGroup || !singleStudentName.trim()) return;
    const sttNum =
      parseInt(singleStudentStt, 10) ||
      (activeClassGroup.students.length > 0
        ? Math.max(...activeClassGroup.students.map((s) => s.stt)) + 1
        : 1);

    setClassRosters((prev) =>
      prev.map((cls) => {
        if (cls.id !== activeClassGroup.id) return cls;
        const filtered = cls.students.filter((s) => s.stt !== sttNum);
        return {
          ...cls,
          students: [...filtered, { stt: sttNum, fullName: singleStudentName.trim() }].sort(
            (a, b) => a.stt - b.stt
          ),
        };
      })
    );
    setSingleStudentStt(String(sttNum + 1));
    setSingleStudentName('');
  };

  const handleBulkImportStudentsFromText = () => {
    if (!activeClassGroup || !bulkStudentsText.trim()) return;
    const lines = bulkStudentsText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const parsedStudents: StudentRosterItem[] = lines.map((line, idx) => {
      // Hỗ trợ định dạng "1. Nguyễn Văn A" hoặc "01\tNguyễn Văn A" hoặc "Nguyễn Văn A"
      const match = line.match(/^(\d+)[\s.,\-\t]+(.+)$/);
      if (match) {
        return { stt: parseInt(match[1], 10), fullName: match[2].trim() };
      }
      return { stt: idx + 1, fullName: line };
    });

    setClassRosters((prev) =>
      prev.map((cls) =>
        cls.id === activeClassGroup.id
          ? { ...cls, students: parsedStudents.sort((a, b) => a.stt - b.stt) }
          : cls
      )
    );
    setBulkStudentsText('');
    setStatusBanner({
      type: 'success',
      message: `Đã cập nhật danh sách ${parsedStudents.length} học sinh cho lớp ${activeClassGroup.className}!`,
    });
  };

  // Thống kê nhanh
  const stats = useMemo(() => {
    if (gradedRecords.length === 0) {
      return { count: 0, avg: 0, max: 0, min: 0 };
    }
    const scores = gradedRecords.map((r) => r.totalScore);
    const sum = scores.reduce((a, b) => a + b, 0);
    return {
      count: gradedRecords.length,
      avg: Math.round((sum / gradedRecords.length) * 100) / 100,
      max: Math.max(...scores),
      min: Math.min(...scores),
    };
  }, [gradedRecords]);

  const currentTpl = TEMPLATES[selectedTemplate];
  const currentKeyView = answerKeys[selectedExamCodeView];
  const maxPossibleTotalScore = useMemo(() => {
    const p1Max = currentScoring.activeP1Count * currentScoring.p1PointsPerQ;
    const p2Max = currentScoring.activeP2Count * (currentScoring.p2PointsMap[3] || 1.0);
    const p3Max = currentScoring.activeP3Count * currentScoring.p3PointsPerQ;
    return Math.round((p1Max + p2Max + p3Max) * 100) / 100;
  }, [currentScoring]);

  return (
    <div className="min-h-screen text-slate-900 flex flex-col select-none pb-24">
      {/* TOP HEADER — BRIGHT PEDAGOGICAL THEME & 3D SHIMMER LOGO */}
      <header className="sticky top-0 z-30 border-b-2 border-sky-200 bg-white/95 backdrop-blur-md px-3 py-2.5 shadow-sm">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl logo-badge-3d flex items-center justify-center text-white shrink-0">
              <GraduationCap className="w-6 h-6 drop-shadow" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg sm:text-2xl font-black tracking-tight logo-3d-shimmer">
                  Edu Chấm Đề 2025
                </span>
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-sm">
                  Chuẩn Bộ GD&ĐT • CV 1239
                </span>
              </div>
              <p className="text-xs text-slate-600 font-semibold">
                Tác giả: <span className="text-blue-700 font-bold">Hồ Tấn Khải</span> — Trường THPT Mang Thít, Tỉnh Vĩnh Long
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowClassModal(true)}
              className="btn-3d btn-3d-emerald px-3 py-1.5 rounded-xl text-xs font-extrabold text-white flex items-center gap-1.5"
            >
              <Users className="w-4 h-4" />
              Danh Sách Lớp ({activeClassGroup?.className || '12A1'})
            </button>
            <div className="px-2.5 py-1.5 rounded-xl bg-amber-50 border-2 border-amber-300 text-xs font-bold text-amber-900 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-600" />
              <span>Đã chấm:</span>
              <span className="font-mono font-black text-amber-700 tabular-nums">{stats.count}</span>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN WORKSPACE */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 py-3 space-y-3">
        {/* 1. KHUNG QUẢN LÝ MÔN HỌC - KỲ KIỂM TRA - LỚP & CHẾ ĐỘ CHẤM */}
        <section className="panel-3d-sky rounded-2xl p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 items-end">
            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-sky-800 mb-1">
                1. Chọn Môn Chấm
              </label>
              <div className="relative">
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border-2 border-sky-300 text-xs font-extrabold text-slate-800 focus:outline-none focus:border-blue-600 shadow-xs"
                >
                  {SUBJECT_OPTIONS.map((subj) => (
                    <option key={subj} value={subj}>
                      Môn: {subj}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-emerald-800 mb-1">
                2. Kỳ Kiểm Tra
              </label>
              <select
                value={selectedExamPeriod}
                onChange={(e) => setSelectedExamPeriod(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white border-2 border-emerald-300 text-xs font-extrabold text-slate-800 focus:outline-none focus:border-emerald-600 shadow-xs"
              >
                {EXAM_PERIOD_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-violet-800 mb-1">
                3. Lớp Học (2 Số Đầu SBD)
              </label>
              <div className="flex items-center gap-1.5">
                <select
                  value={activeClassId}
                  onChange={(e) => setActiveClassId(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-white border-2 border-violet-300 text-xs font-extrabold text-slate-800 focus:outline-none focus:border-violet-600 shadow-xs"
                >
                  {classRosters.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      Lớp {cls.className} (Mã đầu SBD: {cls.sbdPrefix} • {cls.students.length} HS)
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setShowClassModal(true)}
                  title="Thêm / Quản lý danh sách lớp"
                  className="btn-3d btn-3d-violet p-2 rounded-xl text-white shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-amber-800 mb-1">
                4. Chế Độ Chấm Camera
              </label>
              <div className="flex items-center gap-1.5">
                <select
                  value={gradingMode}
                  onChange={(e) => setGradingMode(e.target.value as GradingMode)}
                  className="flex-1 px-3 py-2 rounded-xl bg-white border-2 border-amber-300 text-xs font-extrabold text-slate-800 focus:outline-none focus:border-amber-600 shadow-xs"
                >
                  <option value="review">Chấm & Xem kết quả ngay</option>
                  <option value="continuous">Chấm liên tục tốc độ cao</option>
                  <option value="verify">Chấm đối chiếu (Không lưu)</option>
                </select>
                <button
                  onClick={() => setVoiceReadout((v) => !v)}
                  title={voiceReadout ? 'Đang bật đọc điểm giọng nói' : 'Đang tắt đọc điểm'}
                  className={`btn-3d p-2 rounded-xl text-white shrink-0 ${
                    voiceReadout ? 'btn-3d-amber' : 'btn-3d-slate'
                  }`}
                >
                  {voiceReadout ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 2. DẢI NÚT CHỌN MẪU PHIẾU NHỎ GỌN, TỰ ĐỘNG CO DÃN (COMPACT AUTO-FLEX 3D) */}
        <section className="panel-3d-violet rounded-2xl p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-violet-600" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                Chọn Mẫu Phiếu Trắc Nghiệm (Tự Động Co Dãn • Hỗ Trợ Mã Đề 3 Số & 4 Số)
              </span>
            </div>
            <a
              href="./assets/aistudio/QM_2025_-_CV_1239_-_Ky_kiem_tra_420f9135.pdf"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] font-extrabold text-violet-700 hover:text-violet-900 underline flex items-center gap-1"
            >
              <FileText className="w-3.5 h-3.5" />
              Tải mẫu PDF Phiếu Chung CV 1239 (4 số)
            </a>
          </div>

          <div className="flex flex-wrap gap-2">
            {(Object.keys(TEMPLATES) as TemplateId[]).map((tplKey) => {
              const tpl = TEMPLATES[tplKey];
              const isSelected = selectedTemplate === tplKey;
              return (
                <button
                  key={tplKey}
                  onClick={() => setSelectedTemplate(tplKey)}
                  className={`flex-1 min-w-[148px] sm:min-w-[170px] px-3 py-2 rounded-xl text-left transition-all ${
                    isSelected
                      ? `${tpl.btn3dClass} text-white ring-2 ring-offset-1 ring-slate-900/20`
                      : `${tpl.card3dClass} text-slate-800 hover:brightness-98`
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-black truncate">{tpl.shortName}</span>
                    <span
                      className={`text-[9px] font-mono font-extrabold px-1.5 py-0.5 rounded ${
                        isSelected
                          ? 'bg-black/25 text-white'
                          : 'bg-white/85 text-slate-700 border border-slate-300'
                      }`}
                    >
                      {tpl.maDeDigits} SỐ
                    </span>
                  </div>
                  <div
                    className={`text-[10px] font-semibold truncate mt-0.5 ${
                      isSelected ? 'text-white/90' : 'text-slate-600'
                    }`}
                  >
                    Tối đa: {tpl.p1Count} P.I • {tpl.p2Count} P.II • {tpl.p3Count} P.III
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* 3. KHUNG TÙY CHỈNH SỐ CÂU & SỐ ĐIỂM MỖI CÂU Ở TỪNG PHẦN */}
        <section className="panel-3d-amber rounded-2xl p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              onClick={() => setShowScoringPanel((v) => !v)}
              className="flex items-center gap-2 text-left"
            >
              <Sliders className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                Tùy Chỉnh Số Câu Chấm & Điểm Số Mỗi Câu ({currentTpl.shortName})
              </span>
              {showScoringPanel ? (
                <ChevronUp className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              )}
            </button>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-amber-300">
                Tổng điểm tối đa:{' '}
                <strong className="font-mono text-amber-700">{maxPossibleTotalScore.toFixed(2)} đ</strong>
              </span>
              <button
                onClick={() =>
                  setScoringConfigs((prev) => ({
                    ...prev,
                    [selectedTemplate]: getDefaultScoringConfig(selectedTemplate),
                  }))
                }
                className="btn-3d btn-3d-white px-2.5 py-1 rounded-lg text-[11px] font-extrabold flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Mặc định chuẩn
              </button>
            </div>
          </div>

          {showScoringPanel && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 mt-2.5 pt-2.5 border-t border-amber-200">
              {/* PHẦN I */}
              <div className="bg-white/90 rounded-xl p-2.5 border-2 border-blue-200 flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-blue-800">
                    PHẦN I (Trắc nghiệm ABCD)
                  </span>
                  <span className="text-[11px] font-mono font-bold text-blue-600">
                    Tổng P.I: {(currentScoring.activeP1Count * currentScoring.p1PointsPerQ).toFixed(2)}đ
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      Số câu chấm (Tối đa {currentTpl.p1Count})
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          updateCurrentScoring({
                            activeP1Count: Math.max(0, currentScoring.activeP1Count - 1),
                          })
                        }
                        className="btn-3d btn-3d-white w-7 h-7 rounded-lg font-black text-xs"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={currentTpl.p1Count}
                        value={currentScoring.activeP1Count}
                        onChange={(e) =>
                          updateCurrentScoring({
                            activeP1Count: Math.min(
                              currentTpl.p1Count,
                              Math.max(0, Number(e.target.value) || 0)
                            ),
                          })
                        }
                        className="w-full text-center font-mono font-bold text-xs py-1 rounded-lg border border-slate-300 bg-slate-50"
                      />
                      <button
                        onClick={() =>
                          updateCurrentScoring({
                            activeP1Count: Math.min(
                              currentTpl.p1Count,
                              currentScoring.activeP1Count + 1
                            ),
                          })
                        }
                        className="btn-3d btn-3d-white w-7 h-7 rounded-lg font-black text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      Điểm mỗi câu P.I
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      min={0}
                      value={currentScoring.p1PointsPerQ}
                      onChange={(e) =>
                        updateCurrentScoring({
                          p1PointsPerQ: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className="w-full text-center font-mono font-bold text-xs py-1 rounded-lg border border-blue-300 bg-blue-50/50 text-blue-900"
                    />
                  </div>
                </div>
              </div>

              {/* PHẦN II */}
              <div className="bg-white/90 rounded-xl p-2.5 border-2 border-emerald-200 flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-800">
                    PHẦN II (Đúng / Sai a,b,c,d)
                  </span>
                  <span className="text-[11px] font-mono font-bold text-emerald-600">
                    Tổng P.II:{' '}
                    {(currentScoring.activeP2Count * (currentScoring.p2PointsMap[3] || 0)).toFixed(2)}đ
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 items-center">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      Số câu chấm (Tối đa {currentTpl.p2Count})
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          updateCurrentScoring({
                            activeP2Count: Math.max(0, currentScoring.activeP2Count - 1),
                          })
                        }
                        className="btn-3d btn-3d-white w-7 h-7 rounded-lg font-black text-xs"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={currentTpl.p2Count}
                        value={currentScoring.activeP2Count}
                        onChange={(e) =>
                          updateCurrentScoring({
                            activeP2Count: Math.min(
                              currentTpl.p2Count,
                              Math.max(0, Number(e.target.value) || 0)
                            ),
                          })
                        }
                        className="w-full text-center font-mono font-bold text-xs py-1 rounded-lg border border-slate-300 bg-slate-50"
                      />
                      <button
                        onClick={() =>
                          updateCurrentScoring({
                            activeP2Count: Math.min(
                              currentTpl.p2Count,
                              currentScoring.activeP2Count + 1
                            ),
                          })
                        }
                        className="btn-3d btn-3d-white w-7 h-7 rounded-lg font-black text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      Điểm trọn 1 câu (4 ý)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      value={currentScoring.p2PointsMap[3]}
                      onChange={(e) => {
                        const maxPt = Math.max(0, Number(e.target.value) || 0);
                        updateCurrentScoring({
                          p2PointsMap: [
                            Number((maxPt * 0.1).toFixed(3)),
                            Number((maxPt * 0.25).toFixed(3)),
                            Number((maxPt * 0.5).toFixed(3)),
                            maxPt,
                          ],
                        });
                      }}
                      className="w-full text-center font-mono font-bold text-xs py-1 rounded-lg border border-emerald-300 bg-emerald-50/50 text-emerald-900"
                    />
                  </div>
                </div>
              </div>

              {/* PHẦN III */}
              <div className="bg-white/90 rounded-xl p-2.5 border-2 border-purple-200 flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-purple-800">
                    PHẦN III (Trả lời ngắn)
                  </span>
                  <span className="text-[11px] font-mono font-bold text-purple-600">
                    Tổng P.III: {(currentScoring.activeP3Count * currentScoring.p3PointsPerQ).toFixed(2)}đ
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      Số câu chấm (Tối đa {currentTpl.p3Count})
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          updateCurrentScoring({
                            activeP3Count: Math.max(0, currentScoring.activeP3Count - 1),
                          })
                        }
                        className="btn-3d btn-3d-white w-7 h-7 rounded-lg font-black text-xs"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={currentTpl.p3Count}
                        value={currentScoring.activeP3Count}
                        onChange={(e) =>
                          updateCurrentScoring({
                            activeP3Count: Math.min(
                              currentTpl.p3Count,
                              Math.max(0, Number(e.target.value) || 0)
                            ),
                          })
                        }
                        className="w-full text-center font-mono font-bold text-xs py-1 rounded-lg border border-slate-300 bg-slate-50"
                      />
                      <button
                        onClick={() =>
                          updateCurrentScoring({
                            activeP3Count: Math.min(
                              currentTpl.p3Count,
                              currentScoring.activeP3Count + 1
                            ),
                          })
                        }
                        className="btn-3d btn-3d-white w-7 h-7 rounded-lg font-black text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      Điểm mỗi câu P.III
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      min={0}
                      value={currentScoring.p3PointsPerQ}
                      onChange={(e) =>
                        updateCurrentScoring({
                          p3PointsPerQ: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className="w-full text-center font-mono font-bold text-xs py-1 rounded-lg border border-purple-300 bg-purple-50/50 text-purple-900"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* STATUS BANNER */}
        {statusBanner && (
          <div
            className={`px-3.5 py-2.5 rounded-xl border-2 flex items-center justify-between gap-2 text-xs font-bold shadow-xs ${
              statusBanner.type === 'success'
                ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                : statusBanner.type === 'warning'
                ? 'bg-amber-50 border-amber-400 text-amber-900'
                : 'bg-sky-50 border-sky-400 text-sky-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{statusBanner.message}</span>
            </div>
            <button
              onClick={() => setStatusBanner(null)}
              className="text-slate-500 hover:text-slate-900 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* TAB 1: QUẢN LÝ ĐÁP ÁN & QUÉT QR */}
        {activeTab === 'keys' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              {/* Cột trái: Quét mã QR & Nhập Excel */}
              <div className="lg:col-span-5 panel-3d-emerald rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-black uppercase tracking-wider text-emerald-900 flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-emerald-600" />
                    Nạp Đáp Án Chuẩn QM 2025
                  </h2>
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    Mã đề {currentTpl.maDeDigits} số
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setIsQrCameraOpen((prev) => !prev)}
                    className="btn-3d btn-3d-emerald flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-white font-extrabold text-xs"
                  >
                    <Camera className="w-4 h-4" />
                    {isQrCameraOpen ? 'Đóng Camera QR' : 'Quét QR Camera'}
                  </button>

                  <label className="btn-3d btn-3d-blue flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-white font-extrabold text-xs cursor-pointer">
                    <ImageIcon className="w-4 h-4" />
                    Tải Ảnh Mã QR
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleScanUploadedQrImage(f);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>

                {isQrCameraOpen && (
                  <div className="relative rounded-xl overflow-hidden border-2 border-emerald-500 bg-black aspect-video">
                    <video ref={qrVideoRef} className="w-full h-full object-cover" playsInline muted />
                    <div className="absolute inset-6 border-2 border-dashed border-emerald-400 rounded-xl pointer-events-none flex items-center justify-center">
                      <span className="px-2.5 py-1 rounded bg-black/75 text-[11px] font-mono text-emerald-300">
                        Đưa mã QR Chung QM2025 vào khung ngắm...
                      </span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <label className="btn-3d btn-3d-white flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl font-extrabold text-xs cursor-pointer">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    Nhập File Excel (.xlsx)
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleImportExcelAnswerKey(f);
                        e.target.value = '';
                      }}
                    />
                  </label>

                  <button
                    onClick={handleLoadBuiltInSampleQrImage}
                    className="btn-3d btn-3d-amber flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-white font-extrabold text-xs"
                  >
                    <Sparkles className="w-4 h-4" />
                    Nạp Đáp Án Mẫu Sinh 12
                  </button>
                </div>

                {/* Chuỗi JSON QR */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-extrabold text-slate-700">
                      Chuỗi mảng JSON 2 chiều từ QR QM2025:
                    </label>
                    <button
                      onClick={() => handleApplyRawJsonQr(rawQrInput)}
                      className="text-[11px] font-extrabold text-emerald-700 hover:text-emerald-900 underline"
                    >
                      Giải mã lại chuỗi
                    </button>
                  </div>
                  <textarea
                    value={rawQrInput}
                    onChange={(e) => setRawQrInput(e.target.value)}
                    rows={3}
                    className="w-full rounded-xl bg-white border-2 border-emerald-200 p-2 text-[11px] font-mono text-slate-800 focus:outline-none focus:border-emerald-500"
                    placeholder='[[101,"B","C",...],[102,"A","A",...]]'
                  />
                </div>
              </div>

              {/* Cột phải: Bảng Đáp Án Chi Tiết (P1, P2, P3) */}
              <div className="lg:col-span-7 panel-3d-sky rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-wider text-sky-900">
                      Bảng Đáp Án Đang Áp Dụng ({Object.keys(answerKeys).length} Mã Đề)
                    </h2>
                    <p className="text-xs font-semibold text-slate-600">
                      Đang chấm: {currentScoring.activeP1Count} câu P.I • {currentScoring.activeP2Count} câu P.II • {currentScoring.activeP3Count} câu P.III
                    </p>
                  </div>

                  {/* Chọn Mã Đề */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {Object.keys(answerKeys).map((code) => (
                      <button
                        key={code}
                        onClick={() => {
                          setSelectedExamCodeView(code);
                          setSimExamCode(code);
                        }}
                        className={`px-3 py-1.5 rounded-lg font-mono text-xs font-black transition-all ${
                          selectedExamCodeView === code
                            ? 'btn-3d btn-3d-blue text-white'
                            : 'btn-3d btn-3d-white text-slate-700'
                        }`}
                      >
                        Mã {code}
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        const defaultLen = currentTpl.maDeDigits;
                        const nextNum = 101 + Object.keys(answerKeys).length;
                        const newCode =
                          defaultLen === 4
                            ? String(nextNum).padStart(4, '0')
                            : String(nextNum);
                        const tpl = TEMPLATES[selectedTemplate];
                        setAnswerKeys((prev) => ({
                          ...prev,
                          [newCode]: {
                            examCode: newCode,
                            p1: new Array(tpl.p1Count).fill('A'),
                            p2: Array.from({ length: tpl.p2Count }, () => ({
                              a: 'D',
                              b: 'D',
                              c: 'D',
                              d: 'D',
                            })),
                            p3: new Array(tpl.p3Count).fill(16),
                          },
                        }));
                        setSelectedExamCodeView(newCode);
                      }}
                      className="btn-3d btn-3d-white px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Thêm mã
                    </button>
                  </div>
                </div>

                {currentKeyView ? (
                  <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
                    {/* Phần I */}
                    {currentScoring.activeP1Count > 0 && (
                      <div className="bg-white rounded-xl p-3 border-2 border-blue-200">
                        <div className="text-xs font-black text-blue-800 uppercase tracking-wider mb-2">
                          PHẦN I — {currentScoring.activeP1Count} Câu Trắc Nghiệm Nhiều Lựa Chọn ({currentScoring.p1PointsPerQ}đ / câu)
                        </div>
                        <div className="grid grid-cols-6 sm:grid-cols-9 gap-1.5">
                          {currentKeyView.p1
                            .slice(0, currentScoring.activeP1Count)
                            .map((ans, idx) => (
                              <div
                                key={idx}
                                className="flex flex-col items-center bg-blue-50/70 border border-blue-200 rounded-lg p-1.5"
                              >
                                <span className="text-[10px] text-slate-500 font-mono font-bold">
                                  C.{idx + 1}
                                </span>
                                <select
                                  value={ans}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setAnswerKeys((prev) => {
                                      const target = { ...prev[selectedExamCodeView] };
                                      const nextP1 = [...target.p1];
                                      nextP1[idx] = val;
                                      return {
                                        ...prev,
                                        [selectedExamCodeView]: { ...target, p1: nextP1 },
                                      };
                                    });
                                  }}
                                  className="mt-0.5 bg-transparent font-mono font-black text-xs text-blue-700 focus:outline-none cursor-pointer"
                                >
                                  <option value="A">A</option>
                                  <option value="B">B</option>
                                  <option value="C">C</option>
                                  <option value="D">D</option>
                                </select>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Phần II */}
                    {currentScoring.activeP2Count > 0 && (
                      <div className="bg-white rounded-xl p-3 border-2 border-emerald-200">
                        <div className="text-xs font-black text-emerald-800 uppercase tracking-wider mb-2">
                          PHẦN II — {currentScoring.activeP2Count} Câu Trắc Nghiệm Đúng / Sai ({currentScoring.p2PointsMap.join(' / ')}đ)
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {currentKeyView.p2
                            .slice(0, currentScoring.activeP2Count)
                            .map((qObj, qIdx) => (
                              <div
                                key={qIdx}
                                className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-2 space-y-1.5"
                              >
                                <div className="text-xs font-extrabold text-emerald-900 border-b border-emerald-200 pb-1">
                                  Câu {qIdx + 1}
                                </div>
                                {(['a', 'b', 'c', 'd'] as const).map((sk) => (
                                  <div
                                    key={sk}
                                    className="flex items-center justify-between text-xs font-mono"
                                  >
                                    <span className="text-slate-600 font-bold">{sk})</span>
                                    <button
                                      onClick={() => {
                                        setAnswerKeys((prev) => {
                                          const target = { ...prev[selectedExamCodeView] };
                                          const nextP2 = target.p2.map((item, i) =>
                                            i === qIdx
                                              ? {
                                                  ...item,
                                                  [sk]: item[sk] === 'D' ? 'S' : 'D',
                                                }
                                              : item
                                          );
                                          return {
                                            ...prev,
                                            [selectedExamCodeView]: { ...target, p2: nextP2 },
                                          };
                                        });
                                      }}
                                      className={`px-2 py-0.5 rounded font-black ${
                                        qObj[sk] === 'D'
                                          ? 'bg-emerald-600 text-white'
                                          : 'bg-rose-600 text-white'
                                      }`}
                                    >
                                      {qObj[sk] === 'D' ? 'ĐÚNG' : 'SAI'}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Phần III */}
                    {currentScoring.activeP3Count > 0 && (
                      <div className="bg-white rounded-xl p-3 border-2 border-purple-200">
                        <div className="text-xs font-black text-purple-800 uppercase tracking-wider mb-2">
                          PHẦN III — {currentScoring.activeP3Count} Câu Trả Lời Ngắn ({currentScoring.p3PointsPerQ}đ / câu)
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {currentKeyView.p3
                            .slice(0, currentScoring.activeP3Count)
                            .map((val, qIdx) => (
                              <div
                                key={qIdx}
                                className="bg-purple-50/60 border border-purple-200 rounded-lg p-2 flex items-center justify-between gap-2"
                              >
                                <span className="text-xs font-mono font-bold text-slate-600">
                                  Câu {qIdx + 1}:
                                </span>
                                <input
                                  type="text"
                                  value={String(val)}
                                  onChange={(e) => {
                                    const nextVal = e.target.value;
                                    setAnswerKeys((prev) => {
                                      const target = { ...prev[selectedExamCodeView] };
                                      const nextP3 = [...target.p3];
                                      nextP3[qIdx] = nextVal;
                                      return {
                                        ...prev,
                                        [selectedExamCodeView]: { ...target, p3: nextP3 },
                                      };
                                    });
                                  }}
                                  className="w-24 text-right font-mono font-black text-xs text-purple-800 bg-white border border-purple-300 rounded px-2 py-1 focus:outline-none focus:border-purple-600"
                                />
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500 text-sm font-semibold">
                    Chưa có dữ liệu đáp án. Hãy bấm &ldquo;Nạp Đáp Án Mẫu&rdquo; hoặc quét mã QR.
                  </div>
                )}

                <div className="pt-2 border-t border-sky-200 flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold text-slate-600">
                    Sẵn sàng chấm phiếu <strong className="text-blue-700">{currentTpl.shortName}</strong> cho lớp <strong className="text-emerald-700">{activeClassGroup?.className}</strong>
                  </span>
                  <button
                    onClick={() => setActiveTab('scanner')}
                    className="btn-3d btn-3d-emerald px-4 py-2 rounded-xl text-white font-black text-xs flex items-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    Chuyển Sang Quét Chấm Bài Ngay
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CAMERA QUÉT PHIẾU OMR & CHẤM TỰ ĐỘNG */}
        {activeTab === 'scanner' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* Khung ngắm Camera & Điều khiển */}
            <div className="lg:col-span-8 panel-3d-sky rounded-2xl p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Camera OMR — {currentTpl.shortName} ({selectedSubject} • Lớp {activeClassGroup?.className})
                  </h2>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => setAutoTriggerOmr((v) => !v)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border transition-all ${
                      autoTriggerOmr
                        ? 'bg-emerald-100 border-emerald-400 text-emerald-800'
                        : 'bg-white border-slate-300 text-slate-600'
                    }`}
                  >
                    Tự động chụp: {autoTriggerOmr ? 'BẬT' : 'TẮT'}
                  </button>

                  <button
                    onClick={() => setShowGridOverlay((v) => !v)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border transition-all flex items-center gap-1 ${
                      showGridOverlay
                        ? 'bg-blue-100 border-blue-400 text-blue-800'
                        : 'bg-white border-slate-300 text-slate-600'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Lưới tọa độ
                  </button>

                  <button
                    onClick={() => setShowCalibration((v) => !v)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border transition-all flex items-center gap-1 ${
                      showCalibration
                        ? 'bg-amber-100 border-amber-400 text-amber-900'
                        : 'bg-white border-slate-300 text-slate-600'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    Tinh chỉnh
                  </button>
                </div>
              </div>

              {/* Thanh tinh chỉnh OMR */}
              {showCalibration && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-2.5 rounded-xl bg-white border-2 border-amber-200 text-xs">
                  <div>
                    <div className="flex justify-between text-slate-600 font-bold mb-1">
                      <span>Ngưỡng đậm chì:</span>
                      <span className="font-mono text-amber-700">
                        {Math.round(omrSettings.fillThreshold * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.2}
                      max={0.55}
                      step={0.01}
                      value={omrSettings.fillThreshold}
                      onChange={(e) =>
                        setOmrSettings((s) => ({ ...s, fillThreshold: Number(e.target.value) }))
                      }
                      className="w-full accent-amber-500"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-slate-600 font-bold mb-1">
                      <span>Dịch ngang (X):</span>
                      <span className="font-mono text-amber-700">{omrSettings.offsetX}px</span>
                    </div>
                    <input
                      type="range"
                      min={-15}
                      max={15}
                      step={0.5}
                      value={omrSettings.offsetX}
                      onChange={(e) =>
                        setOmrSettings((s) => ({ ...s, offsetX: Number(e.target.value) }))
                      }
                      className="w-full accent-amber-500"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-slate-600 font-bold mb-1">
                      <span>Dịch dọc (Y):</span>
                      <span className="font-mono text-amber-700">{omrSettings.offsetY}px</span>
                    </div>
                    <input
                      type="range"
                      min={-15}
                      max={15}
                      step={0.5}
                      value={omrSettings.offsetY}
                      onChange={(e) =>
                        setOmrSettings((s) => ({ ...s, offsetY: Number(e.target.value) }))
                      }
                      className="w-full accent-amber-500"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-slate-600 font-bold mb-1">
                      <span>Bán kính ô (R):</span>
                      <span className="font-mono text-amber-700">
                        {Math.round(omrSettings.radiusScale * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.75}
                      max={1.25}
                      step={0.02}
                      value={omrSettings.radiusScale}
                      onChange={(e) =>
                        setOmrSettings((s) => ({ ...s, radiusScale: Number(e.target.value) }))
                      }
                      className="w-full accent-amber-500"
                    />
                  </div>
                </div>
              )}

              {/* Vùng hiển thị Camera hoặc Preview mẫu phiếu */}
              <div className="relative rounded-2xl overflow-hidden border-2 border-sky-300 bg-slate-900 aspect-[1024/550] flex items-center justify-center">
                {isOmrCameraOpen ? (
                  <>
                    <video
                      ref={omrVideoRef}
                      className="w-full h-full object-cover"
                      playsInline
                      muted
                    />
                    <canvas
                      ref={omrOverlayCanvasRef}
                      className="absolute inset-0 w-full h-full pointer-events-none"
                    />
                    <div className="absolute bottom-3 inset-x-3 flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-950/80 border border-slate-700 text-[11px] font-mono text-emerald-400">
                        Canh 4 ô vuông đen ở 4 góc tờ phiếu vào khung xanh
                      </span>
                      <button
                        onClick={handleManualCaptureFromVideo}
                        className="btn-3d btn-3d-emerald px-4 py-2 rounded-xl text-white font-black text-xs shadow-lg"
                      >
                        Chụp & Chấm Ngay
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="relative w-full h-full flex flex-col items-center justify-center p-4 text-center">
                    <img
                      src={currentTpl.imageUrl}
                      alt={currentTpl.name}
                      className="absolute inset-0 w-full h-full object-contain opacity-25 pointer-events-none"
                    />
                    {showGridOverlay && (
                      <TemplateCoordinatePreviewOverlay
                        templateId={selectedTemplate}
                        settings={omrSettings}
                      />
                    )}
                    <div className="relative z-10 max-w-md space-y-3 bg-white/95 backdrop-blur-md p-4 rounded-2xl border-2 border-sky-300 shadow-xl">
                      <div className="w-11 h-11 rounded-2xl bg-blue-100 border border-blue-300 flex items-center justify-center mx-auto text-blue-700">
                        <Camera className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-black text-slate-900">
                        Bật Camera Quét Phiếu Hoặc Chấm Mô Phỏng 1 Chạm
                      </h3>
                      <p className="text-xs font-medium text-slate-600">
                        Hệ thống tự động nhận diện 2 chữ số đầu của SBD (ví dụ{' '}
                        <strong className="text-blue-700">{activeClassGroup?.sbdPrefix || '01'}</strong> = Lớp{' '}
                        <strong className="text-blue-700">{activeClassGroup?.className || '12A1'}</strong>) và số thứ tự học sinh để xuất thẳng điểm vào Danh Sách Lớp.
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                        <button
                          onClick={() => setIsOmrCameraOpen(true)}
                          className="btn-3d btn-3d-emerald px-4 py-2.5 rounded-xl text-white font-black text-xs flex items-center gap-1.5"
                        >
                          <Camera className="w-4 h-4" />
                          Mở Camera Chấm Bài
                        </button>

                        <label className="btn-3d btn-3d-blue px-3.5 py-2.5 rounded-xl text-white font-black text-xs flex items-center gap-1.5 cursor-pointer">
                          <Upload className="w-4 h-4" />
                          Tải Ảnh Phiếu Đã Chụp
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleGradeUploadedSheetImage(f);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Cột phải: Bộ tạo Phiếu Tô Mẫu Thực Tế (Simulator) & Lịch sử quét nhanh */}
            <div className="lg:col-span-4 space-y-3">
              <div className="panel-3d-emerald rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wand2 className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-emerald-950">
                      Mô Phỏng Chấm Thử & Tự Khớp Lớp
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    Lớp {activeClassGroup?.className} (Mã {activeClassGroup?.sbdPrefix})
                  </span>
                </div>
                <p className="text-xs text-slate-600 font-medium">
                  Tạo tờ phiếu{' '}
                  <span className="text-slate-900 font-bold">{currentTpl.shortName}</span> đã tô chì thực tế với SBD thuộc lớp đang chọn để kiểm tra tốc độ chấm & tự động điền điểm vào Danh Sách Lớp:
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-600 font-extrabold uppercase mb-1">
                      SBD (2 số đầu = Lớp)
                    </label>
                    <input
                      type="text"
                      maxLength={8}
                      value={simSbd}
                      onChange={(e) => setSimSbd(e.target.value)}
                      className="w-full bg-white border-2 border-emerald-300 rounded-lg px-2.5 py-1.5 font-mono font-black text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600 font-extrabold uppercase mb-1">
                      Mã đề ({currentTpl.maDeDigits} chữ số)
                    </label>
                    <select
                      value={simExamCode}
                      onChange={(e) => setSimExamCode(e.target.value)}
                      className="w-full bg-white border-2 border-emerald-300 rounded-lg px-2.5 py-1.5 font-mono font-black text-xs text-slate-900"
                    >
                      {Object.keys(answerKeys).map((c) => (
                        <option key={c} value={c}>
                          Mã đề {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleRunSimulatedSheet(0.9)}
                    className="btn-3d btn-3d-emerald py-2.5 px-3 rounded-xl text-white font-extrabold text-xs flex items-center justify-center gap-1.5"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Chấm Thử Bài Khá/Giỏi
                  </button>
                  <button
                    onClick={() => handleRunSimulatedSheet(1.0)}
                    className="btn-3d btn-3d-blue py-2.5 px-3 rounded-xl text-white font-extrabold text-xs flex items-center justify-center gap-1.5"
                  >
                    <Award className="w-3.5 h-3.5" />
                    Chấm Thử Điểm 10
                  </button>
                </div>
              </div>

              {/* Danh sách 5 bài vừa chấm gần nhất */}
              <div className="panel-3d-violet rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-violet-950">
                    Các Phiếu Vừa Quét ({gradedRecords.length})
                  </h3>
                  {gradedRecords.length > 0 && (
                    <button
                      onClick={() => setActiveTab('results')}
                      className="text-xs text-violet-700 hover:text-violet-900 font-extrabold underline"
                    >
                      Xem sổ điểm lớp →
                    </button>
                  )}
                </div>

                {gradedRecords.length === 0 ? (
                  <p className="text-xs text-slate-500 font-medium py-4 text-center">
                    Chưa có bài chấm nào trong phiên này.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {gradedRecords.slice(0, 6).map((rec) => (
                      <div
                        key={rec.id}
                        onClick={() => setActiveHudRecord(rec)}
                        className="w-full text-left bg-white hover:bg-violet-50/70 border-2 border-violet-200 rounded-xl p-2.5 flex items-center justify-between transition-all cursor-pointer"
                      >
                        <div>
                          <div className="text-xs font-extrabold text-slate-900 font-mono">
                            SBD: {rec.sbd}{' '}
                            <span className="text-violet-700">• Mã: {rec.examCode}</span>
                          </div>
                          <div className="text-[11px] font-semibold text-slate-600">
                            {rec.studentName
                              ? `${rec.studentName} (${rec.className})`
                              : `Lớp ${rec.className || '--'} • STT ${rec.sbdStudentOrder ?? '--'}`}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <div className="text-base font-black font-mono text-emerald-600 tabular-nums">
                              {rec.totalScore.toFixed(2)}
                            </div>
                            <div className="text-[10px] font-bold text-slate-400">điểm</div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSaveEvidenceSheet(rec, false);
                            }}
                            title="Tải ảnh minh chứng bài chấm"
                            className="btn-3d btn-3d-white p-1.5 rounded-lg text-slate-700"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: DANH SÁCH LỚP, SỔ ĐIỂM & LƯU HỒ SƠ MINH CHỨNG */}
        {activeTab === 'results' && (
          <div className="space-y-3">
            {/* Thanh công cụ Xuất Excel & Lưu Minh Chứng */}
            <div className="panel-3d-emerald rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-emerald-950 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-emerald-600" />
                  Bảng Điểm Lớp {activeClassGroup?.className} & Hồ Sơ Minh Chứng ({selectedSubject} • {selectedExamPeriod})
                </h2>
                <p className="text-xs font-semibold text-slate-600 mt-0.5">
                  Điểm tự động cập nhật vào đúng STT học sinh dựa vào 2 chữ số đầu của SBD ({activeClassGroup?.sbdPrefix} = Lớp {activeClassGroup?.className}).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowClassModal(true)}
                  className="btn-3d btn-3d-violet px-3.5 py-2 rounded-xl text-white font-extrabold text-xs flex items-center gap-1.5"
                >
                  <Users className="w-4 h-4" />
                  Cập Nhật Danh Sách Lớp
                </button>

                <button
                  onClick={handleExportExcel}
                  className="btn-3d btn-3d-emerald px-4 py-2 rounded-xl text-white font-black text-xs flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  Xuất Bảng Điểm Lớp (.XLSX)
                </button>

                <button
                  onClick={handleExportFullEvidencePortfolioHtml}
                  disabled={gradedRecords.length === 0}
                  className="btn-3d btn-3d-blue disabled:opacity-40 px-3.5 py-2 rounded-xl text-white font-extrabold text-xs flex items-center gap-1.5"
                >
                  <FolderCheck className="w-4 h-4" />
                  Tải Hồ Sơ Minh Chứng (Lưu Drive / In)
                </button>

                <button
                  onClick={() => setGradedRecords([])}
                  disabled={gradedRecords.length === 0}
                  className="btn-3d btn-3d-rose disabled:opacity-40 px-3 py-2 rounded-xl text-white font-bold text-xs flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Xóa lượt quét
                </button>
              </div>
            </div>

            {/* BẢNG 1: DANH SÁCH LỚP ĐÃ TỰ ĐỘNG ĐIỀN ĐIỂM THEO SBD */}
            {activeClassGroup && (
              <div className="panel-3d-sky rounded-2xl overflow-hidden">
                <div className="px-4 py-3 bg-sky-100/80 border-b border-sky-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-blue-700" />
                    <span className="text-xs font-black uppercase tracking-wider text-blue-950">
                      Danh Sách Học Sinh Lớp {activeClassGroup.className} (Mã đầu SBD: {activeClassGroup.sbdPrefix})
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-600">
                    Đã có điểm:{' '}
                    <strong className="text-emerald-700">
                      {activeClassGroup.students.filter((s) => s.totalScore !== undefined).length}/
                      {activeClassGroup.students.length}
                    </strong>{' '}
                    học sinh
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-black uppercase text-slate-600">
                        <th className="py-2.5 px-3">STT</th>
                        <th className="py-2.5 px-3">Mã SBD Chuẩn</th>
                        <th className="py-2.5 px-3">Họ và Tên Học Sinh</th>
                        <th className="py-2.5 px-3">Lớp</th>
                        <th className="py-2.5 px-3">Mã Đề</th>
                        <th className="py-2.5 px-3 text-right">Phần I</th>
                        <th className="py-2.5 px-3 text-right">Phần II</th>
                        <th className="py-2.5 px-3 text-right">Phần III</th>
                        <th className="py-2.5 px-3 text-right">Tổng Điểm</th>
                        <th className="py-2.5 px-3 text-center">Minh Chứng</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {activeClassGroup.students.map((st) => {
                        const expectedSbd =
                          st.sbd || `${activeClassGroup.sbdPrefix}${String(st.stt).padStart(4, '0')}`;
                        const linkedRecord = gradedRecords.find((r) => r.id === st.recordId);
                        return (
                          <tr key={st.stt} className="hover:bg-sky-50/60 transition-colors">
                            <td className="py-2.5 px-3 font-mono font-black text-slate-700">
                              {st.stt}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-blue-700">
                              {expectedSbd}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-slate-900">{st.fullName}</td>
                            <td className="py-2.5 px-3 font-semibold text-slate-600">
                              {activeClassGroup.className}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-violet-700">
                              {st.examCode || '--'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700">
                              {st.p1Score !== undefined ? st.p1Score.toFixed(2) : '--'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700">
                              {st.p2Score !== undefined ? st.p2Score.toFixed(2) : '--'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700">
                              {st.p3Score !== undefined ? st.p3Score.toFixed(2) : '--'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-black text-sm text-emerald-600">
                              {st.totalScore !== undefined ? `${st.totalScore.toFixed(2)} đ` : 'Chưa chấm'}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {linkedRecord ? (
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => setActiveHudRecord(linkedRecord)}
                                    className="px-2 py-1 rounded bg-blue-100 hover:bg-blue-200 text-blue-800 text-[11px] font-bold"
                                  >
                                    Xem bài
                                  </button>
                                  <button
                                    onClick={() => handleSaveEvidenceSheet(linkedRecord, false)}
                                    title="Tải ảnh minh chứng"
                                    className="px-2 py-1 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[11px] font-bold"
                                  >
                                    Lưu ảnh
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setSimSbd(expectedSbd);
                                    setActiveTab('scanner');
                                  }}
                                  className="text-[11px] font-bold text-blue-600 hover:underline"
                                >
                                  Chấm ngay →
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL QUẢN LÝ DANH SÁCH LỚP (THÊM LỚP, NHẬP STT, HỌ TÊN HỌC SINH) */}
      {showClassModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white border-2 border-violet-300 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl my-6">
            <div className="px-4 py-3 bg-gradient-to-r from-violet-600 to-blue-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider">
                    Quản Lý Danh Sách Lớp & Quy Ước 2 Chữ Số Đầu SBD
                  </h3>
                  <p className="text-[11px] text-white/90">
                    Khi chấm bài, 2 chữ số đứng đầu SBD xác định Lớp và các chữ số tiếp theo xác định STT học sinh
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowClassModal(false)}
                className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Tạo Lớp Mới */}
              <div className="p-3 rounded-xl bg-violet-50 border-2 border-violet-200 space-y-2">
                <div className="text-xs font-black text-violet-900 uppercase">
                  1. Chọn Lớp Hoặc Thêm Lớp Mới
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {classRosters.map((cls) => (
                    <button
                      key={cls.id}
                      onClick={() => setActiveClassId(cls.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                        activeClassId === cls.id
                          ? 'btn-3d btn-3d-violet text-white'
                          : 'btn-3d btn-3d-white text-slate-700'
                      }`}
                    >
                      Lớp {cls.className} (Mã đầu SBD: {cls.sbdPrefix}) • {cls.students.length} HS
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                  <input
                    type="text"
                    placeholder="Tên lớp mới (VD: 12A3)"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-white border border-violet-300 text-xs font-bold"
                  />
                  <input
                    type="text"
                    maxLength={2}
                    placeholder="2 số đầu SBD (VD: 03)"
                    value={newClassPrefix}
                    onChange={(e) => setNewClassPrefix(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-white border border-violet-300 text-xs font-mono font-bold"
                  />
                  <button
                    onClick={handleAddNewClassGroup}
                    className="btn-3d btn-3d-emerald px-3 py-2 rounded-xl text-white text-xs font-black flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Tạo Lớp Mới
                  </button>
                </div>
              </div>

              {/* Thêm học sinh vào lớp đang chọn */}
              {activeClassGroup && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-sky-50 border-2 border-sky-200 space-y-2">
                    <div className="text-xs font-black text-sky-900 uppercase">
                      2. Thêm Lẻ Học Sinh Vào Lớp {activeClassGroup.className}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="STT"
                        value={singleStudentStt}
                        onChange={(e) => setSingleStudentStt(e.target.value)}
                        className="w-20 px-2.5 py-2 rounded-xl bg-white border border-sky-300 text-xs font-mono font-bold"
                      />
                      <input
                        type="text"
                        placeholder="Họ và tên học sinh..."
                        value={singleStudentName}
                        onChange={(e) => setSingleStudentName(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-xl bg-white border border-sky-300 text-xs font-bold"
                      />
                      <button
                        onClick={handleAddSingleStudent}
                        className="btn-3d btn-3d-blue px-3 py-2 rounded-xl text-white text-xs font-black"
                      >
                        Thêm
                      </button>
                    </div>

                    <div className="pt-2 border-t border-sky-200 space-y-1.5">
                      <div className="text-[11px] font-extrabold text-slate-700">
                        Hoặc dán nhanh danh sách cả lớp (Mỗi dòng 1 học sinh):
                      </div>
                      <textarea
                        rows={4}
                        value={bulkStudentsText}
                        onChange={(e) => setBulkStudentsText(e.target.value)}
                        placeholder={`1. Nguyễn Minh An\n2. Trần Hoàng Bách\n3. Lê Ngọc Bảo Châu`}
                        className="w-full rounded-xl bg-white border border-sky-300 p-2 text-xs font-medium"
                      />
                      <button
                        onClick={handleBulkImportStudentsFromText}
                        className="btn-3d btn-3d-emerald w-full py-2 rounded-xl text-white text-xs font-black"
                      >
                        Nạp Danh Sách Học Sinh Cho Lớp {activeClassGroup.className}
                      </button>
                    </div>
                  </div>

                  {/* Danh sách hiện tại của lớp */}
                  <div className="p-3 rounded-xl bg-emerald-50 border-2 border-emerald-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black text-emerald-950 uppercase">
                          DS Lớp {activeClassGroup.className} ({activeClassGroup.students.length} HS)
                        </span>
                        <span className="text-[11px] font-mono font-bold text-emerald-800">
                          SBD mẫu: {activeClassGroup.sbdPrefix}0001
                        </span>
                      </div>
                      <div className="max-h-52 overflow-y-auto space-y-1 bg-white rounded-xl p-2 border border-emerald-200">
                        {activeClassGroup.students.map((st) => (
                          <div
                            key={st.stt}
                            className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-slate-50 border-b border-slate-100"
                          >
                            <div>
                              <span className="font-mono font-black text-blue-700 mr-2">
                                #{st.stt} (SBD: {activeClassGroup.sbdPrefix}
                                {String(st.stt).padStart(4, '0')})
                              </span>
                              <span className="font-bold text-slate-800">{st.fullName}</span>
                            </div>
                            <span className="font-mono font-black text-emerald-600">
                              {st.totalScore !== undefined ? `${st.totalScore}đ` : '--'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={() => setShowClassModal(false)}
                        className="btn-3d btn-3d-violet px-4 py-2 rounded-xl text-white text-xs font-black"
                      >
                        Hoàn Tất & Đóng
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* POPUP HUD CHI TIẾT BÀI CHẤM & LƯU MINH CHỨNG */}
      {activeHudRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white border-2 border-blue-300 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl my-6">
            {/* Header HUD */}
            <div className="px-4 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 text-white flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="px-3 py-1.5 rounded-xl bg-white text-emerald-700 text-center shadow">
                  <div className="text-[9px] uppercase font-black tracking-wider">TỔNG ĐIỂM</div>
                  <div className="text-2xl font-black font-mono tabular-nums">
                    {activeHudRecord.totalScore.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black">
                      {activeHudRecord.studentName || `Học sinh STT ${activeHudRecord.sbdStudentOrder ?? '--'}`}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-white/20 font-bold">
                      Lớp {activeHudRecord.className || activeClassGroup?.className} (Mã đầu SBD: {activeHudRecord.sbdClassPrefix})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-xs mt-1">
                    <label className="font-bold flex items-center gap-1">
                      SBD:
                      <input
                        type="text"
                        value={activeHudRecord.sbd}
                        onChange={(e) => {
                          const nextSbd = e.target.value;
                          const recalc = recalculateRecordScore(
                            { ...activeHudRecord, sbd: nextSbd },
                            answerKeys,
                            currentScoring
                          );
                          const synced = enrichAndSyncRecordWithRoster(recalc, gradingMode !== 'verify');
                          setActiveHudRecord(synced);
                          setGradedRecords((prev) =>
                            prev.map((r) => (r.id === synced.id ? synced : r))
                          );
                        }}
                        className="w-24 bg-white text-slate-900 rounded px-2 py-0.5 font-mono font-black text-xs"
                      />
                    </label>
                    <label className="font-bold flex items-center gap-1">
                      Mã đề:
                      <input
                        type="text"
                        value={activeHudRecord.examCode}
                        onChange={(e) => {
                          const nextCode = e.target.value;
                          const recalc = recalculateRecordScore(
                            { ...activeHudRecord, examCode: nextCode },
                            answerKeys,
                            currentScoring
                          );
                          const synced = enrichAndSyncRecordWithRoster(recalc, gradingMode !== 'verify');
                          setActiveHudRecord(synced);
                          setGradedRecords((prev) =>
                            prev.map((r) => (r.id === synced.id ? synced : r))
                          );
                        }}
                        className="w-16 bg-white text-slate-900 rounded px-2 py-0.5 font-mono font-black text-xs"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleSaveEvidenceSheet(activeHudRecord, false)}
                  className="btn-3d btn-3d-amber px-3 py-2 rounded-xl text-white font-black text-xs flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  Tải Ảnh Minh Chứng
                </button>
                <button
                  onClick={() => handleSaveEvidenceSheet(activeHudRecord, true)}
                  className="btn-3d btn-3d-emerald px-3 py-2 rounded-xl text-white font-black text-xs flex items-center gap-1.5"
                >
                  <Share2 className="w-4 h-4" />
                  Lưu Lên Drive / Chia Sẻ
                </button>
                <button
                  onClick={() => setActiveHudRecord(null)}
                  className="btn-3d btn-3d-white px-3 py-2 rounded-xl font-black text-xs flex items-center gap-1"
                >
                  <Check className="w-4 h-4 text-emerald-600" />
                  Đóng & Quét Tiếp
                </button>
              </div>
            </div>

            {/* Body HUD */}
            <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 max-h-[75vh] overflow-y-auto">
              {/* Ảnh phiếu đã khoanh kết quả */}
              <div className="lg:col-span-7 space-y-2">
                <div className="text-xs font-black text-slate-700 flex items-center justify-between">
                  <span>Ảnh Phiếu Đã Nắn Phẳng & Khoanh Vùng Đáp Án:</span>
                  <span className="text-[11px] font-bold">
                    <span className="text-emerald-600">● Đúng</span> &nbsp;
                    <span className="text-rose-600">● Sai</span> &nbsp;
                    <span className="text-amber-600">○ Đáp án chuẩn</span>
                  </span>
                </div>
                <div className="rounded-xl overflow-hidden border-2 border-slate-300 bg-slate-950">
                  <img
                    src={activeHudRecord.annotatedImageDataUrl}
                    alt="Annotated OMR Sheet"
                    className="w-full h-auto object-contain"
                  />
                </div>
              </div>

              {/* Chi tiết từng phần & Sửa nhanh */}
              <div className="lg:col-span-5 space-y-3 text-xs">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5">
                  <div className="font-black text-blue-900 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                      Phần I ({activeHudRecord.p1CorrectCount}/{activeHudRecord.p1TotalCount} câu = {activeHudRecord.p1Score}đ)
                    </span>
                  </div>
                  <div className="grid grid-cols-6 gap-1 max-h-40 overflow-y-auto pr-1">
                    {activeHudRecord.p1Details.map((q, idx) => (
                      <button
                        key={q.qIndex}
                        onClick={() => {
                          const order = ['A', 'B', 'C', 'D', ''];
                          const nextAns =
                            order[(order.indexOf(q.studentAnswer) + 1) % order.length];
                          const nextP1 = activeHudRecord.p1Details.map((item, i) =>
                            i === idx ? { ...item, studentAnswer: nextAns } : item
                          );
                          const recalc = recalculateRecordScore(
                            { ...activeHudRecord, p1Details: nextP1 },
                            answerKeys,
                            currentScoring
                          );
                          const synced = enrichAndSyncRecordWithRoster(
                            recalc,
                            gradingMode !== 'verify'
                          );
                          setActiveHudRecord(synced);
                          setGradedRecords((prev) =>
                            prev.map((r) => (r.id === synced.id ? synced : r))
                          );
                        }}
                        className={`p-1 rounded border text-center font-mono transition-all ${
                          q.isCorrect
                            ? 'bg-emerald-100 border-emerald-400 text-emerald-900 font-bold'
                            : 'bg-rose-100 border-rose-400 text-rose-900 font-bold'
                        }`}
                      >
                        <div className="text-[9px] text-slate-500">C.{q.qIndex}</div>
                        <div className="text-[11px]">
                          {q.studentAnswer || '_'}
                          {!q.isCorrect && (
                            <span className="text-amber-700 text-[9px]">/{q.correctAnswer}</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {activeHudRecord.p2Details.length > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5">
                    <div className="font-black text-emerald-900 mb-1.5">
                      Phần II — Đúng/Sai ({activeHudRecord.p2Score}đ)
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {activeHudRecord.p2Details.map((q) => (
                        <div
                          key={q.qIndex}
                          className="p-1.5 rounded bg-white border border-emerald-200 flex items-center justify-between font-mono text-[11px]"
                        >
                          <span className="font-bold text-slate-700">C.{q.qIndex}:</span>
                          <span>
                            {q.subResults.map((s) => (
                              <span
                                key={s.subKey}
                                className={
                                  s.isCorrect
                                    ? 'text-emerald-600 font-black mx-0.5'
                                    : 'text-rose-600 font-black mx-0.5'
                                }
                              >
                                {s.studentAnswer || '_'}
                              </span>
                            ))}
                          </span>
                          <span className="text-emerald-700 font-black">+{q.pointsEarned}đ</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeHudRecord.p3Details.length > 0 && (
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-2.5">
                    <div className="font-black text-purple-900 mb-1.5">
                      Phần III — Trả lời ngắn ({activeHudRecord.p3Score}đ)
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {activeHudRecord.p3Details.map((q, idx) => (
                        <div
                          key={q.qIndex}
                          className={`p-1.5 rounded border font-mono text-[11px] flex items-center justify-between ${
                            q.isCorrect
                              ? 'bg-emerald-100 border-emerald-300 text-emerald-900'
                              : 'bg-rose-100 border-rose-300 text-rose-900'
                          }`}
                        >
                          <span className="font-bold">C.{q.qIndex}:</span>
                          <input
                            type="text"
                            value={q.studentString}
                            onChange={(e) => {
                              const nextStr = e.target.value;
                              const nextP3 = activeHudRecord.p3Details.map((item, i) =>
                                i === idx ? { ...item, studentString: nextStr } : item
                              );
                              const recalc = recalculateRecordScore(
                                { ...activeHudRecord, p3Details: nextP3 },
                                answerKeys,
                                currentScoring
                              );
                              const synced = enrichAndSyncRecordWithRoster(
                                recalc,
                                gradingMode !== 'verify'
                              );
                              setActiveHudRecord(synced);
                              setGradedRecords((prev) =>
                                prev.map((r) => (r.id === synced.id ? synced : r))
                              );
                            }}
                            className="w-14 bg-white border border-slate-300 rounded px-1 text-right font-bold"
                          />
                          <span className="text-[10px] text-amber-800 font-bold">
                            ({String(q.correctValue)})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM NAVIGATION BAR */}
      <nav className="fixed bottom-0 inset-x-0 z-30 border-t-2 border-sky-200 bg-white/95 backdrop-blur-md">
        <div className="max-w-lg mx-auto grid grid-cols-3 gap-2 p-2">
          <button
            onClick={() => setActiveTab('keys')}
            className={`py-2 px-3 rounded-xl flex flex-col items-center gap-0.5 text-xs font-black transition-all ${
              activeTab === 'keys'
                ? 'btn-3d btn-3d-blue text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>1. Đáp Án & QR</span>
          </button>

          <button
            onClick={() => setActiveTab('scanner')}
            className={`py-2 px-3 rounded-xl flex flex-col items-center gap-0.5 text-xs font-black transition-all ${
              activeTab === 'scanner'
                ? 'btn-3d btn-3d-emerald text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>2. Quét Chấm Bài</span>
          </button>

          <button
            onClick={() => setActiveTab('results')}
            className={`py-2 px-3 rounded-xl flex flex-col items-center gap-0.5 text-xs font-black transition-all ${
              activeTab === 'results'
                ? 'btn-3d btn-3d-violet text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>3. DS Lớp & Điểm ({stats.count})</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

/**
 * Component hiển thị lưới tọa độ sub-pixel để kiểm tra khớp ô tròn
 */
function TemplateCoordinatePreviewOverlay({
  templateId,
  settings,
}: {
  templateId: TemplateId;
  settings: OMRSettings;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = TARGET_CORNERS_1024x550.width;
    canvas.height = TARGET_CORNERS_1024x550.height;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const map = getTemplateBubbleMap(
      templateId,
      settings.offsetX,
      settings.offsetY,
      settings.radiusScale
    );

    const drawGroup = (pts: { x: number; y: number; r: number }[], color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      for (const b of pts) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.stroke();
      }
    };

    drawGroup(map.maDe.flat(), '#06b6d4');
    drawGroup(map.sbd.flat(), '#3b82f6');
    drawGroup(map.p1.flat(), '#10b981');
    map.p2.forEach((q) => drawGroup([...q.a, ...q.b, ...q.c, ...q.d], '#f59e0b'));
    map.p3.forEach((q) =>
      drawGroup([q.minus, q.comma1, q.comma2, ...q.digits.flat()], '#ec4899')
    );
  }, [templateId, settings]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full object-contain pointer-events-none z-0"
    />
  );
}
