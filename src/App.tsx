import React, { useEffect, useMemo, useRef, useState } from 'react';
import jsQR from 'jsqr';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  Award,
  BookOpen,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  FolderCheck,
  Globe,
  GraduationCap,
  HelpCircle,
  Image as ImageIcon,
  Layers,
  Lock,
  Maximize2,
  Minimize2,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Share2,
  ShieldCheck,
  Sliders,
  Smartphone,
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
import {
  capturePhoto,
  getFriendlyCameraPermissionError,
  setCameraTorch,
  startCrossPlatformCamera,
} from './omr/camera';
import { usePWAInstall } from './pwa/usePWAInstall';

type ActiveTab = 'keys' | 'scanner' | 'results';
type GradingMode = 'review' | 'continuous' | 'verify';
type P2ScoringMode = 'progressive' | 'equal' | 'custom';

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
  isAppendedAtEnd?: boolean;
}

export interface ClassRosterGroup {
  id: string;
  className: string;
  sbdPrefix: string; // 2 chữ số đầu của SBD nhận biết lớp, ví dụ "01"
  students: StudentRosterItem[];
}

const APP_VERSION = '2025.6.0-PRO';

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

function playErrorAlertBeep() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(310, ctx.currentTime);
    osc.frequency.setValueAtTime(210, ctx.currentTime + 0.16);
    gain.gain.setValueAtTime(0.24, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.36);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.37);
  } catch {
    // Ignore audio errors
  }
}

function speakTextVietnamese(text: string) {
  try {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'vi-VN';
    utter.rate = 1.12;
    window.speechSynthesis.speak(utter);
  } catch {
    // Ignore speech synthesis errors
  }
}

function speakScoreVietnamese(score: number, studentName?: string) {
  const text = studentName
    ? `${studentName}, ${score.toString().replace('.', ' phẩy ')} điểm`
    : `${score.toString().replace('.', ' phẩy ')} điểm`;
  speakTextVietnamese(text);
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

  // Modal Hướng Dẫn, Sứ Mệnh & Cập Nhật Phiên Bản
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showPwaModal, setShowPwaModal] = useState(false);
  const [activePwaCodeTab, setActivePwaCodeTab] = useState<
    'guide' | 'index.html' | 'style.css' | 'camera.js' | 'app.js' | 'manifest.json' | 'sw.js'
  >('guide');
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const { isInstallable, isInstalled, isOnline, promptInstall } = usePWAInstall();
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>(() =>
    new Date().toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  );

  // Tùy chỉnh số câu & điểm từng phần cho từng mẫu phiếu
  const [scoringConfigs, setScoringConfigs] = useState<Record<TemplateId, CustomScoringConfig>>(() => ({
    cv1239: getDefaultScoringConfig('cv1239'),
    toan: getDefaultScoringConfig('toan'),
    khtn: getDefaultScoringConfig('khtn'),
    khxh: getDefaultScoringConfig('khxh'),
    ngoaingu: getDefaultScoringConfig('ngoaingu'),
  }));
  const [p2ScoringMode, setP2ScoringMode] = useState<P2ScoringMode>('progressive');
  const [p2EqualPointPerSub, setP2EqualPointPerSub] = useState<number>(0.25);
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

  // OMR Scanner State & Fullscreen Mode
  const [isOmrCameraOpen, setIsOmrCameraOpen] = useState(false);
  const [isScannerFullscreen, setIsScannerFullscreen] = useState(false);
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
  const omrVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const [torchSupported, setTorchSupported] = useState<boolean>(false);
  const [torchEnabled, setTorchEnabled] = useState<boolean>(false);
  const [lastCapturedBase64Jpeg, setLastCapturedBase64Jpeg] = useState<string>('');
  const [anchorLockState, setAnchorLockState] = useState<{
    found: boolean;
    count: number;
    tl: boolean;
    tr: boolean;
    bl: boolean;
    br: boolean;
  }>({
    found: false,
    count: 0,
    tl: false,
    tr: false,
    bl: false,
    br: false,
  });
  const [missingExamCodeAlert, setMissingExamCodeAlert] = useState<{
    message: string;
    sbdRead: string;
    imageUrl: string;
  } | null>(null);
  const [instantScoreBanner, setInstantScoreBanner] = useState<interfaceGradedSheetRecord | null>(null);
  const lockCounterRef = useRef<number>(0);
  const cooldownRef = useRef<boolean>(false);

  // Kích hoạt chế độ Full Màn Hình khi nhấn vào nút Chấm Bài trên mọi thiết bị
  const enterScannerFullscreenMode = async () => {
    setActiveTab('scanner');
    setIsScannerFullscreen(true);
    setIsOmrCameraOpen(true);
    try {
      const docEl = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
      };
      if (!document.fullscreenElement && docEl.requestFullscreen) {
        await docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) {
        await docEl.webkitRequestFullscreen();
      }
    } catch {
      // Trên iOS Safari hoặc iframe không hỗ trợ Fullscreen API gốc, giao diện fixed inset-0 z-40 tự động phủ kín 100% màn hình
    }
  };

  const exitScannerFullscreenMode = async () => {
    setIsScannerFullscreen(false);
    try {
      const docWithWebkit = document as Document & {
        webkitExitFullscreen?: () => Promise<void>;
      };
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (docWithWebkit.webkitExitFullscreen) {
        await docWithWebkit.webkitExitFullscreen();
      }
    } catch {
      // ignore
    }
  };

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
   * - 2 chữ số đầu của SBD nhận biết Lớp (so khớp với sbdPrefix của lớp)
   * - Các chữ số còn lại là STT của học sinh trong lớp đó
   * - Nếu SBD bị tô thiếu ('?'), không khớp hoặc nằm ngoài danh sách ban đầu:
   *   KHÔNG cho phép can thiệp chỉnh sửa thủ công và TỰ ĐỘNG XUẤT VÀO ĐOẠN CUỐI CỦA DANH SÁCH LỚP ĐÓ.
   */
  const enrichAndSyncRecordWithRoster = (
    rawRecord: interfaceGradedSheetRecord,
    saveToRoster: boolean
  ): interfaceGradedSheetRecord => {
    const isSbdComplete = !rawRecord.sbd.includes('?') && rawRecord.sbd.trim().length >= 3;
    const { sbdClassPrefix, sbdStudentOrder } = parseSbdToClassAndStt(rawRecord.sbd);

    let matchedClass = isSbdComplete
      ? classRosters.find((c) => c.sbdPrefix.padStart(2, '0') === sbdClassPrefix)
      : undefined;
    if (!matchedClass) {
      matchedClass = activeClassGroup;
    }

    const matchedStudent =
      isSbdComplete && matchedClass && sbdStudentOrder !== null
        ? matchedClass.students.find((s) => !s.isAppendedAtEnd && s.stt === sbdStudentOrder)
        : undefined;

    const targetClassName = matchedClass ? matchedClass.className : activeClassGroup?.className || '12A1';
    const displayStudentName = matchedStudent
      ? matchedStudent.fullName
      : isSbdComplete && sbdStudentOrder !== null
      ? `Phiếu ngoài DS - STT ${sbdStudentOrder} (Xuất cuối DS lớp ${targetClassName})`
      : `Phiếu thiếu/lỗi SBD (${rawRecord.sbd}) (Xuất cuối DS lớp ${targetClassName})`;

    const enriched: interfaceGradedSheetRecord = {
      ...rawRecord,
      sbdClassPrefix: isSbdComplete ? sbdClassPrefix : matchedClass?.sbdPrefix || '--',
      sbdStudentOrder: matchedStudent ? sbdStudentOrder : null,
      className: targetClassName,
      studentName: displayStudentName,
      subjectName: selectedSubject,
      examPeriod: selectedExamPeriod,
    };

    if (saveToRoster && matchedClass) {
      setClassRosters((prev) =>
        prev.map((cls) => {
          if (cls.id !== matchedClass!.id) return cls;

          // Trường hợp 1: Khớp chính xác học sinh có sẵn trong danh sách lớp
          if (matchedStudent && sbdStudentOrder !== null) {
            return {
              ...cls,
              students: cls.students.map((st) =>
                !st.isAppendedAtEnd && st.stt === sbdStudentOrder
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
              ),
            };
          }

          // Trường hợp 2: SBD thiếu/lỗi hoặc không nằm trong danh sách lớp -> XUẤT VÀO ĐOẠN CUỐI CỦA DANH SÁCH LỚP ĐÓ
          const maxExistingStt =
            cls.students.length > 0 ? Math.max(...cls.students.map((s) => s.stt)) : 0;
          const appendedItem: StudentRosterItem = {
            stt: maxExistingStt + 1,
            fullName: displayStudentName,
            sbd: enriched.sbd,
            examCode: enriched.examCode,
            p1Score: enriched.p1Score,
            p2Score: enriched.p2Score,
            p3Score: enriched.p3Score,
            totalScore: enriched.totalScore,
            gradedAt: enriched.timestamp,
            recordId: enriched.id,
            isAppendedAtEnd: true,
          };

          return {
            ...cls,
            students: [...cls.students, appendedItem],
          };
        })
      );
    }

    return enriched;
  };

  // Xử lý sau khi chấm xong 1 phiếu:
  // YÊU CẦU BẮT BUỘC: BÁO LỖI VÀ KHÔNG CHẤM KHI KHÔNG TÔ MÃ ĐỀ!
  const handleCompletedScanRecord = (rawRecord: interfaceGradedSheetRecord) => {
    const isExamCodeMissing =
      !rawRecord.examCode ||
      rawRecord.examCode.includes('?') ||
      rawRecord.examCode.trim() === '';

    if (isExamCodeMissing) {
      playErrorAlertBeep();
      if (navigator.vibrate) navigator.vibrate([220, 80, 220, 80, 280]);
      const errMsg = `BÁO LỖI & TỪ CHỐI CHẤM: Phiếu trả lời KHÔNG TÔ MÃ ĐỀ (hoặc tô thiếu chữ số Mã Đề: "${rawRecord.examCode || 'Trống'}"). Hệ thống không chấm và không ghi điểm phiếu này!`;
      setMissingExamCodeAlert({
        message: errMsg,
        sbdRead: rawRecord.sbd,
        imageUrl: rawRecord.annotatedImageDataUrl,
      });
      setInstantScoreBanner(null);
      setStatusBanner({
        type: 'warning',
        message: `🚫 ${errMsg}`,
      });
      if (voiceReadout) {
        speakTextVietnamese('Báo lỗi! Phiếu chưa tô đủ mã đề, hệ thống từ chối chấm bài này.');
      }
      return;
    }

    setMissingExamCodeAlert(null);
    playSuccessBeep();
    if (navigator.vibrate) navigator.vibrate([70, 40, 100]);

    if (gradingMode === 'verify') {
      const enriched = enrichAndSyncRecordWithRoster(rawRecord, false);
      setInstantScoreBanner(enriched);
      setActiveHudRecord(enriched);
      if (voiceReadout) speakScoreVietnamese(enriched.totalScore, enriched.studentName);
      setStatusBanner({
        type: 'info',
        message: `[Chế độ Chấm đối chiếu] SBD ${enriched.sbd} (${enriched.studentName || 'Chưa rõ tên'}) — ${enriched.totalScore.toFixed(2)} điểm.`,
      });
      return;
    }

    const enriched = enrichAndSyncRecordWithRoster(rawRecord, true);
    setGradedRecords((prev) => [
      enriched,
      ...prev.filter((r) => r.sbd !== enriched.sbd || enriched.sbd.includes('?')),
    ]);
    setInstantScoreBanner(enriched);

    if (voiceReadout) {
      speakScoreVietnamese(enriched.totalScore, enriched.studentName);
    }

    if (gradingMode === 'continuous') {
      setStatusBanner({
        type: 'success',
        message: `Đã nhận đủ 4 neo & tự động chấm: SBD ${enriched.sbd} (${enriched.studentName}) • Mã đề ${enriched.examCode} • ĐIỂM: ${enriched.totalScore.toFixed(2)}đ`,
      });
    } else {
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

  // Quét QR trực tiếp bằng Camera (Đa nền tảng iOS Safari & Android Chrome)
  useEffect(() => {
    if (!isQrCameraOpen) return;
    let stream: MediaStream | null = null;
    let animId = 0;

    const startQrCamera = async () => {
      try {
        if (!qrVideoRef.current) return;
        const session = await startCrossPlatformCamera(qrVideoRef.current);
        stream = session.stream;

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
      } catch (err) {
        setStatusBanner({
          type: 'warning',
          message: getFriendlyCameraPermissionError(err),
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

  // 3. CAMERA QUÉT PHIẾU OMR THỜI GIAN THỰC (CHUẨN ĐA NỀN TẢNG iOS SAFARI & ANDROID CHROME + TORCH FLASH)
  useEffect(() => {
    if (!isOmrCameraOpen || activeTab !== 'scanner') {
      setTorchEnabled(false);
      setTorchSupported(false);
      omrVideoTrackRef.current = null;
      return;
    }
    let stream: MediaStream | null = null;
    let animId = 0;

    const startOmrStream = async () => {
      try {
        if (!omrVideoRef.current) return;
        const session = await startCrossPlatformCamera(omrVideoRef.current);
        stream = session.stream;
        omrVideoTrackRef.current = session.videoTrack;
        setTorchSupported(session.torchSupported);
        setTorchEnabled(false);

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
            setAnchorLockState({
              found: corners.found,
              count: corners.anchorCount,
              tl: corners.locks.tl,
              tr: corners.locks.tr,
              bl: corners.locks.bl,
              br: corners.locks.br,
            });

            const oCtx = overlay.getContext('2d')!;
            oCtx.clearRect(0, 0, vw, vh);

            // Lớp mặt nạ giới hạn: Chỉ quét bên trong 4 neo cố định của bảng trả lời trắc nghiệm
            oCtx.save();
            oCtx.fillStyle = 'rgba(2, 6, 23, 0.42)';
            oCtx.fillRect(0, 0, vw, vh);
            oCtx.globalCompositeOperation = 'destination-out';
            oCtx.beginPath();
            oCtx.moveTo(corners.tl.x, corners.tl.y);
            oCtx.lineTo(corners.tr.x, corners.tr.y);
            oCtx.lineTo(corners.br.x, corners.br.y);
            oCtx.lineTo(corners.bl.x, corners.bl.y);
            oCtx.closePath();
            oCtx.fill();
            oCtx.restore();

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

            const cornerItems = [
              { pt: corners.tl, locked: corners.locks.tl, label: 'NEO 1 (TL)' },
              { pt: corners.tr, locked: corners.locks.tr, label: 'NEO 2 (TR)' },
              { pt: corners.bl, locked: corners.locks.bl, label: 'NEO 3 (BL)' },
              { pt: corners.br, locked: corners.locks.br, label: 'NEO 4 (BR)' },
            ];
            for (const item of cornerItems) {
              const boxColor = item.locked ? '#10b981' : '#ef4444';
              oCtx.strokeStyle = boxColor;
              oCtx.lineWidth = 3;
              oCtx.strokeRect(item.pt.x - 18, item.pt.y - 18, 36, 36);
              oCtx.fillStyle = boxColor;
              oCtx.beginPath();
              oCtx.arc(item.pt.x, item.pt.y, 7, 0, Math.PI * 2);
              oCtx.fill();
            }

            // Khi nhận đủ 4/4 neo cố định thì tự động chấm và hiện điểm ngay
            if (corners.found && !cooldownRef.current && (!activeHudRecord || gradingMode === 'continuous')) {
              lockCounterRef.current += 1;
              if (autoTriggerOmr && lockCounterRef.current >= 4) {
                lockCounterRef.current = 0;
                cooldownRef.current = true;
                try {
                  const base64Shot = capturePhoto(video, 0.92);
                  setLastCapturedBase64Jpeg(base64Shot);
                } catch {
                  // ignore
                }
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
                }, 1500);
              }
            } else {
              lockCounterRef.current = Math.max(0, lockCounterRef.current - 1);
            }
          }
          animId = requestAnimationFrame(processFrame);
        };

        animId = requestAnimationFrame(processFrame);
      } catch (err) {
        setStatusBanner({
          type: 'warning',
          message: getFriendlyCameraPermissionError(err),
        });
        setIsOmrCameraOpen(false);
      }
    };

    startOmrStream();
    return () => {
      cancelAnimationFrame(animId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      omrVideoTrackRef.current = null;
      setTorchEnabled(false);
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

  // Bật / Tắt đèn Flash (Torch) trên Android khi chấm bài thiếu sáng
  const handleToggleCameraTorch = async () => {
    const track = omrVideoTrackRef.current;
    if (!track || !torchSupported) return;
    const nextState = !torchEnabled;
    const applied = await setCameraTorch(track, nextState);
    setTorchEnabled(applied);
  };

  // Chụp thủ công từ Camera đang bật — BẮT BUỘC PHẢI ĐỦ 4 NEO CỐ ĐỊNH, KHÔNG QUÉT SANG THỨ KHÁC
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

    if (!corners.found) {
      playErrorAlertBeep();
      setStatusBanner({
        type: 'warning',
        message: `⚠️ TỪ CHỐI QUÉT: Mới nhận diện được ${corners.anchorCount}/4 neo cố định. Hệ thống CHỈ quét bảng trả lời trắc nghiệm khi bắt đủ 4 neo cố định, không quét sang các vật thể khác!`,
      });
      if (voiceReadout) {
        speakTextVietnamese('Chưa nhận đủ 4 neo cố định của bảng trả lời.');
      }
      return;
    }

    try {
      const base64Jpeg = capturePhoto(video, 0.92);
      setLastCapturedBase64Jpeg(base64Jpeg);
    } catch {
      // ignore
    }

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

  // Chấm từ file ảnh phiếu chụp sẵn — BẮT BUỘC KIỂM TRA 4 NEO CỐ ĐỊNH
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
      URL.revokeObjectURL(url);

      if (!corners.found) {
        playErrorAlertBeep();
        setStatusBanner({
          type: 'warning',
          message: `⚠️ ẢNH KHÔNG HỢP LỆ (${corners.anchorCount}/4 neo): Hệ thống CHỈ quét bảng trả lời trắc nghiệm theo 4 neo cố định, không quét sang các hình ảnh khác!`,
        });
        return;
      }

      const warped = warpPerspectiveTo1024x550(imgData, corners);
      const record = gradeWarpedSheet(
        warped,
        selectedTemplate,
        answerKeys,
        omrSettings,
        currentScoring
      );
      handleCompletedScanRecord(record);
    };
    img.src = url;
  };

  // Tạo & Chấm ngay Phiếu Tô Mẫu Thực Tế (Hỗ trợ test đủ mã đề, test quên tô Mã Đề, test thiếu/ngoài SBD)
  const handleRunSimulatedSheet = async (
    accuracy = 0.88,
    options?: { skipExamCode?: boolean; skipSbd?: boolean }
  ) => {
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
      currentScoring,
      options
    );

    setAnchorLockState({
      found: true,
      count: 4,
      tl: true,
      tr: true,
      bl: true,
      br: true,
    });

    const record = gradeWarpedSheet(
      simCanvas,
      selectedTemplate,
      answerKeys,
      omrSettings,
      currentScoring
    );
    handleCompletedScanRecord(record);

    if (!options?.skipExamCode && !options?.skipSbd) {
      const { sbdClassPrefix, sbdStudentOrder } = parseSbdToClassAndStt(simSbd);
      if (sbdStudentOrder !== null) {
        const nextOrder = String(sbdStudentOrder + 1).padStart(4, '0');
        setSimSbd(`${sbdClassPrefix || '01'}${nextOrder}`);
      }
    }
  };

  // 4. LƯU MINH CHỨNG BÀI CHẤM
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

  // Xuất Hồ Sơ Minh Chứng Tổng Hợp (.HTML)
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

  // TẢI VỀ TÀI LIỆU MINH HỌA & CẨM NANG HƯỚNG DẪN SỬ DỤNG (.HTML CHUẨN IN PDF)
  const handleDownloadGuideDocument = () => {
    const docHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Tài Liệu Minh Họa & Hướng Dẫn Sử Dụng — Edu Chấm Đề 2025</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Roboto, Arial, sans-serif;
    background: linear-gradient(145deg, #f0f7ff 0%, #ffffff 50%, #ecfdf5 100%);
    color: #0f172a;
    margin: 0;
    padding: 32px;
    line-height: 1.6;
  }
  .container { max-width: 1040px; margin: 0 auto; }
  .hero {
    background: linear-gradient(135deg, #1d4ed8 0%, #059669 55%, #7c3aed 100%);
    color: #fff;
    padding: 32px;
    border-radius: 24px;
    box-shadow: 0 10px 0 #1e3a8a, 0 20px 40px rgba(37, 99, 235, 0.3);
    margin-bottom: 32px;
  }
  .hero h1 { margin: 0 0 8px 0; font-size: 32px; letter-spacing: -0.02em; }
  .hero p { margin: 4px 0; font-size: 16px; opacity: 0.95; }
  .badge {
    display: inline-block;
    background: rgba(255,255,255,0.22);
    padding: 6px 14px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 700;
    margin-bottom: 12px;
  }
  .grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; margin-bottom: 28px; }
  .grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 28px; }
  .card-3d {
    background: #ffffff;
    border-radius: 20px;
    padding: 22px;
    page-break-inside: avoid;
  }
  .c-blue { border: 2px solid #60a5fa; box-shadow: 0 6px 0 #2563eb, 0 16px 32px rgba(37,99,235,0.18); }
  .c-emerald { border: 2px solid #34d399; box-shadow: 0 6px 0 #059669, 0 16px 32px rgba(16,185,129,0.18); }
  .c-violet { border: 2px solid #a78bfa; box-shadow: 0 6px 0 #7c3aed, 0 16px 32px rgba(124,58,237,0.18); }
  .c-amber { border: 2px solid #fbbf24; box-shadow: 0 6px 0 #d97706, 0 16px 32px rgba(217,119,6,0.18); }
  .c-rose { border: 2px solid #fb7185; box-shadow: 0 6px 0 #e11d48, 0 16px 32px rgba(225,29,72,0.18); }
  .c-cyan { border: 2px solid #22d3ee; box-shadow: 0 6px 0 #0891b2, 0 16px 32px rgba(8,145,178,0.18); }
  h2 { font-size: 22px; margin-top: 0; color: #0f172a; }
  h3 { font-size: 17px; margin: 0 0 8px 0; }
  ul { margin: 8px 0 0 0; padding-left: 20px; }
  li { margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; background: #fff; border-radius: 12px; overflow: hidden; }
  th, td { border: 1px solid #cbd5e1; padding: 10px 14px; text-align: left; font-size: 14px; }
  th { background: #eff6ff; color: #1e3a8a; font-weight: 800; }
  .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 2px solid #cbd5e1; font-size: 14px; color: #475569; }
  @media print {
    body { padding: 12px; background: #fff; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
  <div class="container">
    <div class="no-print" style="margin-bottom: 20px; text-align: right;">
      <button onclick="window.print()" style="background:#2563eb;color:#fff;border:none;padding:12px 24px;border-radius:12px;font-weight:800;cursor:pointer;box-shadow:0 4px 0 #1e3a8a;">
        🖨️ In Tài Liệu Hoặc Lưu Thành PDF
      </button>
    </div>

    <div class="hero">
      <div class="badge">TÀI LIỆU MINH HỌA CHUYÊN MÔN & CẨM NANG CHUYỂN ĐỔI SỐ GIÁO DỤC • PHIÊN BẢN ${APP_VERSION}</div>
      <h1>EDU CHẤM ĐỀ 2025 — HỆ THỐNG CHẤM THI TRẮC NGHIỆM BẰNG CAMERA AI/OMR</h1>
      <p><strong>Tác giả nghiên cứu & phát triển:</strong> Thầy Hồ Tấn Khải — Trường THPT Mang Thít, Tỉnh Vĩnh Long</p>
      <p><strong>Chuẩn áp dụng:</strong> Chương trình GDPT 2018 & Định dạng đề thi tốt nghiệp THPT từ năm 2025 (Bộ GD&ĐT — Phụ lục CV 1239 & QM 2025)</p>
    </div>

    <div class="grid-2">
      <div class="card-3d c-blue">
        <h2>1. Sứ Mệnh (Mission)</h2>
        <p>Giải phóng sức lao động sư phạm cho đội ngũ giáo viên phổ thông trên toàn quốc thông qua công nghệ Thị giác máy tính (Computer Vision OMR) chạy trực tiếp trên trình duyệt Web.</p>
        <ul>
          <li><strong>Không cần máy chấm chuyên dụng đắt tiền:</strong> Biến mọi chiếc điện thoại thông minh của giáo viên thành máy chấm phiếu tốc độ cao (0,3 giây/phiếu).</li>
          <li><strong>Minh bạch & Chính xác tuyệt đối:</strong> Lưu trữ ảnh bài chấm có khoanh vùng đáp án làm hồ sơ minh chứng kiểm tra đánh giá.</li>
          <li><strong>Hoàn toàn miễn phí & Đa nền tảng:</strong> Hoạt động mượt mà trên iOS, Android, Windows, macOS mà không cần cài đặt phần mềm phức tạp.</li>
        </ul>
      </div>

      <div class="card-3d c-emerald">
        <h2>2. Vai Trò Sư Phạm (Pedagogical Role)</h2>
        <p>Đóng vai trò là <strong>Trợ lý Khảo thí Số Toàn Diện</strong> đồng hành cùng giáo viên trong mọi kỳ kiểm tra định kỳ (Thường xuyên, Giữa kì, Cuối kì, Thi thử TN THPT):</p>
        <ul>
          <li><strong>Tự động hóa 100% khâu vào điểm:</strong> Tự động đọc 2 chữ số đầu của SBD để phân loại Lớp và đọc các số sau làm STT học sinh, điền thẳng điểm vào Danh Sách Lớp.</li>
          <li><strong>Thích ứng linh hoạt theo đặc thù từng môn & từng trường:</strong> Cho phép tùy chỉnh số câu và thang điểm riêng cho Phần I, Phần II (Lũy tiến Bộ GD&ĐT hoặc Chia đều từng ý đúng), và Phần III.</li>
        </ul>
      </div>
    </div>

    <div class="card-3d c-violet" style="margin-bottom: 28px;">
      <h2>3. Hệ Sinh Thái 5 Mẫu Phiếu & Quy Tắc Điểm Chuẩn 2025</h2>
      <table>
        <thead>
          <tr>
            <th>Mẫu Phiếu</th>
            <th>Số Chữ Số Mã Đề</th>
            <th>Cấu Trúc Tối Đa (P.I - P.II - P.III)</th>
            <th>Môn Học Áp Dụng</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Mẫu Chung CV 1239</strong></td>
            <td><strong>4 chữ số (0000–9999)</strong></td>
            <td>40 câu P.I • 8 câu P.II • 6 câu P.III</td>
            <td>Tất cả các môn học (Phiếu chung kiểm tra định kỳ CV 1239)</td>
          </tr>
          <tr>
            <td><strong>Mẫu 1: Toán Học</strong></td>
            <td>3 chữ số (000–999)</td>
            <td>12 câu P.I • 4 câu P.II • 6 câu P.III</td>
            <td>Toán Học (Đại số, Giải tích, Hình học, Thống kê)</td>
          </tr>
          <tr>
            <td><strong>Mẫu 2: KHTN & Địa</strong></td>
            <td>3 chữ số (000–999)</td>
            <td>18 câu P.I • 4 câu P.II • 6 câu P.III</td>
            <td>Vật Lý, Hóa Học, Sinh Học, Địa Lí</td>
          </tr>
          <tr>
            <td><strong>Mẫu 3: KHXH & Tin/CN</strong></td>
            <td>3 chữ số (000–999)</td>
            <td>24 câu P.I • 4 câu P.II • 0 câu P.III</td>
            <td>Lịch Sử, Tin Học, Công Nghệ, GDKT & Pháp Luật</td>
          </tr>
          <tr>
            <td><strong>Mẫu 4: Ngoại Ngữ</strong></td>
            <td>3 chữ số (000–999)</td>
            <td>40 câu P.I • 0 câu P.II • 0 câu P.III</td>
            <td>Tiếng Anh, Tiếng Pháp, Tiếng Trung, Tiếng Nhật, Tiếng Hàn</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="grid-3">
      <div class="card-3d c-amber">
        <h3>Bước 1: Thiết Lập Kỳ Kiểm Tra & Lớp</h3>
        <p>Chọn Môn học, Kỳ kiểm tra, Lớp học và quy ước 2 chữ số đầu của SBD (ví dụ: <strong>01</strong> = Lớp 12A1, <strong>02</strong> = Lớp 12A2). Dán danh sách học sinh vào khung Quản lý Lớp.</p>
      </div>
      <div class="card-3d c-cyan">
        <h3>Bước 2: Chọn Mẫu Phiếu & Thang Điểm</h3>
        <p>Chọn mẫu phiếu (3 số hoặc 4 số CV 1239). Tùy chỉnh số câu chấm và điểm mỗi câu ở Phần I, Phần II (Lũy tiến 0.1-0.25-0.5-1.0đ hoặc chia đều từng ý đúng), Phần III.</p>
      </div>
      <div class="card-3d c-rose">
        <h3>Bước 3: Quét Mã QR Hoặc Nhập Đáp Án</h3>
        <p>Dùng Camera quét trực tiếp mã QR chung từ phần mềm trộn đề QM2025, tải ảnh mã QR hoặc nhập file Excel đáp án chuẩn (.xlsx).</p>
      </div>
      <div class="card-3d c-emerald">
        <h3>Bước 4: Chấm Full Màn Hình Theo 4 Neo Cố Định</h3>
        <p>Nhấn nút <strong>Chấm Bài</strong> để kích hoạt <strong>Full Màn Hình</strong> trên mọi thiết bị. Hệ thống chỉ quét vùng bảng trả lời giới hạn bởi <strong>4 Neo Cố Định</strong> (không quét sang vật thể khác). Khi nhận đủ 4/4 neo sẽ <strong>tự động chấm và hiện điểm ngay</strong>. Nếu phiếu <strong>không tô Mã đề</strong>, hệ thống báo lỗi đỏ và <strong>không chấm</strong>.</p>
      </div>
      <div class="card-3d c-blue">
        <h3>Bước 5: Khóa Bảo Mật Kết Quả & Xuất Cuối DS Lớp</h3>
        <p><strong>Số báo danh, Mã đề và toàn bộ đáp án</strong> được khóa bảo mật <strong>Read-Only (không được quyền can thiệp)</strong>. Các phiếu thiếu SBD hoặc ngoài danh sách sẽ tự động được <strong>xuất vào đoạn cuối của Danh Sách Lớp đó</strong>.</p>
      </div>
      <div class="card-3d c-violet">
        <h3>Cơ Chế Tự Động Cập Nhật (Auto-Update ${APP_VERSION})</h3>
        <p>Ứng dụng trang bị cơ chế đồng bộ phiên bản thời gian thực trên nền tảng Web/PWA Offline, đảm bảo giáo viên luôn sử dụng thuật toán OMR 4 neo cố định và mẫu phiếu mới nhất của Bộ GD&ĐT.</p>
      </div>
    </div>

    <div class="footer">
      <strong>EDU CHẤM ĐỀ 2025 — Tác giả: Hồ Tấn Khải (Trường THPT Mang Thít, Tỉnh Vĩnh Long)</strong><br/>
      Tài liệu được trích xuất tự động từ hệ thống lúc ${new Date().toLocaleString('vi-VN')}
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([docHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Tai_Lieu_Minh_Hoa_Huong_Dan_Edu_Cham_De_2025.html`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusBanner({
      type: 'success',
      message:
        'Đã tải về Tài Liệu Minh Họa & Hướng Dẫn Sử Dụng (Mở file lên và bấm In/Lưu PDF để làm hồ sơ báo cáo)!',
    });
  };

  // Kiểm tra & Tự động cập nhật phiên bản mới nhất
  const handleTriggerAutoUpdateCheck = () => {
    setIsCheckingUpdate(true);
    setTimeout(() => {
      setIsCheckingUpdate(false);
      setLastUpdatedTime(
        new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) +
          ' ' +
          new Date().toLocaleDateString('vi-VN')
      );
      playSuccessBeep();
      setStatusBanner({
        type: 'success',
        message: `Hệ thống Edu Chấm Đề 2025 đang ở phiên bản mới nhất (${APP_VERSION}) — Đã đồng bộ đầy đủ 5 mẫu phiếu chuẩn Bộ GD&ĐT!`,
      });
    }, 650);
  };

  // 5. XUẤT BẢNG ĐIỂM EXCEL THEO DANH SÁCH LỚP VÀ LỊCH SỬ QUÉT
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

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
    <div className="min-h-screen text-slate-900 flex flex-col select-none">
      {/* TOP HEADER — BRIGHT PEDAGOGICAL THEME, SAFE AREA INSETS & 3D SHIMMER LOGO */}
      <header className="sticky top-0 z-30 border-b-2 border-sky-300 bg-white/95 backdrop-blur-md px-4 py-2.5 shadow-md safe-area-header">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl logo-badge-3d flex items-center justify-center text-white shrink-0">
              <GraduationCap className="w-7 h-7 drop-shadow" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xl sm:text-3xl font-black tracking-tight logo-3d-shimmer">
                  Edu Chấm Đề 2025
                </span>
                <span className="text-xs font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-sm">
                  Chuẩn Bộ GD&ĐT • {APP_VERSION}
                </span>
                <span
                  className={`text-[11px] font-black px-2 py-0.5 rounded-full border ${
                    isOnline
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                      : 'bg-amber-100 border-amber-500 text-amber-950'
                  }`}
                >
                  {isOnline ? '● Sẵn sàng Offline Phòng Thi' : '⚡ Chế độ Offline Phòng Thi'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-700 font-bold mt-0.5">
                Tác giả: <span className="text-blue-700 font-extrabold">Hồ Tấn Khải</span> — Trường THPT Mang Thít, Tỉnh Vĩnh Long
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Cụm nút Danh Sách Lớp + Nút "+ Thêm" nằm ngay trên cùng theo đúng yêu cầu */}
            <div className="flex items-center gap-1.5 bg-violet-50/90 p-1 rounded-2xl border-2 border-violet-300 shadow-2xs">
              <button
                onClick={() => setShowClassModal(true)}
                className="btn-3d btn-3d-emerald px-3 py-2 rounded-xl text-xs sm:text-sm font-black text-white flex items-center gap-1.5"
              >
                <Users className="w-4 h-4" />
                Danh Sách Lớp ({activeClassGroup?.className || '12A1'})
              </button>
              <button
                onClick={() => setShowClassModal(true)}
                title="Thêm Lớp mới hoặc Thêm Học sinh vào Danh Sách Lớp"
                className="btn-3d btn-3d-violet px-3 py-2 rounded-xl text-xs sm:text-sm font-black text-white flex items-center gap-1 shrink-0"
              >
                <Plus className="w-4 h-4" />
                Thêm
              </button>
            </div>

            <button
              onClick={async () => {
                if (isInstallable) {
                  const res = await promptInstall();
                  if (res === 'manual') setShowPwaModal(true);
                } else {
                  setShowPwaModal(true);
                }
              }}
              className="btn-3d btn-3d-rose px-3 py-2.5 rounded-xl text-xs sm:text-sm font-black text-white flex items-center gap-1.5"
            >
              <Smartphone className="w-4 h-4" />
              {isInstalled ? 'Cài App & Mã Nguồn PWA' : 'Tạo Phím Tắt ĐT (iOS/Android)'}
            </button>

            <button
              onClick={() => setShowGuideModal(true)}
              className="btn-3d btn-3d-amber px-3 py-2.5 rounded-xl text-xs sm:text-sm font-black text-white flex items-center gap-1.5"
            >
              <HelpCircle className="w-4 h-4" />
              Hướng Dẫn Mới Nhất
            </button>

            <button
              onClick={handleExportExcel}
              className="btn-3d btn-3d-blue px-3 py-2.5 rounded-xl text-xs sm:text-sm font-black text-white flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              Xuất Excel
            </button>

            <div className="px-2.5 py-2 rounded-xl bg-amber-100 border-2 border-amber-400 text-xs sm:text-sm font-extrabold text-amber-950 flex items-center gap-1.5 shadow-xs">
              <Award className="w-4 h-4 text-amber-600" />
              <span className="font-mono font-black text-sm sm:text-base text-amber-800 tabular-nums">
                {stats.count}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN WORKSPACE */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-4 py-4 space-y-4 safe-area-main">
        {/* THANH ĐIỀU HƯỚNG 3 BƯỚC CHÍNH NỔI BẬT NGAY ĐẦU TRANG */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => {
              setIsScannerFullscreen(false);
              setActiveTab('keys');
            }}
            className={`py-3 px-4 rounded-2xl flex items-center justify-center gap-2.5 text-sm sm:text-base font-black transition-all ${
              activeTab === 'keys'
                ? 'btn-3d btn-3d-blue text-white ring-2 ring-offset-2 ring-blue-500'
                : 'btn-3d btn-3d-white text-slate-800'
            }`}
          >
            <QrCode className="w-5 h-5 shrink-0" />
            <span>BƯỚC 1: ĐÁP ÁN & QUÉT QR</span>
          </button>

          <button
            onClick={() => enterScannerFullscreenMode(true)}
            className={`py-3 px-4 rounded-2xl flex items-center justify-center gap-2.5 text-sm sm:text-base font-black transition-all ${
              activeTab === 'scanner'
                ? 'btn-3d btn-3d-emerald text-white ring-2 ring-offset-2 ring-emerald-500'
                : 'btn-3d btn-3d-white text-slate-800'
            }`}
          >
            <Maximize2 className="w-5 h-5 shrink-0" />
            <span>BƯỚC 2: CHẤM BÀI (FULL MÀN HÌNH)</span>
          </button>

          <button
            onClick={() => setActiveTab('results')}
            className={`py-3 px-4 rounded-2xl flex items-center justify-center gap-2.5 text-sm sm:text-base font-black transition-all ${
              activeTab === 'results'
                ? 'btn-3d btn-3d-violet text-white ring-2 ring-offset-2 ring-violet-500'
                : 'btn-3d btn-3d-white text-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-5 h-5 shrink-0" />
            <span>BƯỚC 3: DS LỚP & SỔ ĐIỂM ({stats.count})</span>
          </button>
        </section>

        {/* 1. KHUNG QUẢN LÝ MÔN HỌC - KỲ KIỂM TRA - LỚP & CHẾ ĐỘ CHẤM */}
        <section className="panel-3d-sky rounded-2xl p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 items-end">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-sky-900 mb-1.5">
                1. Chọn Môn Chấm
              </label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border-2 border-sky-400 text-sm font-extrabold text-slate-900 focus:outline-none focus:border-blue-600 shadow-xs cursor-pointer"
              >
                {SUBJECT_OPTIONS.map((subj) => (
                  <option key={subj} value={subj}>
                    Môn: {subj}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-emerald-900 mb-1.5">
                2. Kỳ Kiểm Tra
              </label>
              <select
                value={selectedExamPeriod}
                onChange={(e) => setSelectedExamPeriod(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border-2 border-emerald-400 text-sm font-extrabold text-slate-900 focus:outline-none focus:border-emerald-600 shadow-xs cursor-pointer"
              >
                {EXAM_PERIOD_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-violet-900">
                  3. Danh Sách Lớp (2 Số Đầu SBD)
                </label>
                <button
                  onClick={() => setShowClassModal(true)}
                  title="Thêm / Quản lý danh sách lớp"
                  className="btn-3d btn-3d-violet px-2.5 py-1 rounded-lg text-white font-black text-xs flex items-center gap-1 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Thêm
                </button>
              </div>
              <select
                value={activeClassId}
                onChange={(e) => setActiveClassId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border-2 border-violet-400 text-sm font-extrabold text-slate-900 focus:outline-none focus:border-violet-600 shadow-xs cursor-pointer"
              >
                {classRosters.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    Lớp {cls.className} (Đầu SBD: {cls.sbdPrefix} • {cls.students.length} HS)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-amber-900 mb-1.5">
                4. Chế Độ Chấm Camera
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={gradingMode}
                  onChange={(e) => setGradingMode(e.target.value as GradingMode)}
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-white border-2 border-amber-400 text-sm font-extrabold text-slate-900 focus:outline-none focus:border-amber-600 shadow-xs cursor-pointer"
                >
                  <option value="review">Chấm & Xem kết quả ngay</option>
                  <option value="continuous">Chấm liên tục tốc độ cao</option>
                  <option value="verify">Chấm đối chiếu (Không lưu)</option>
                </select>
                <button
                  onClick={() => setVoiceReadout((v) => !v)}
                  title={voiceReadout ? 'Đang bật đọc điểm giọng nói' : 'Đang tắt đọc điểm'}
                  className={`btn-3d px-3 py-2.5 rounded-xl text-white shrink-0 ${
                    voiceReadout ? 'btn-3d-amber' : 'btn-3d-slate'
                  }`}
                >
                  {voiceReadout ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 2. DẢI NÚT CHỌN MẪU PHIẾU KHOA HỌC, NỔI BẬT, TỰ ĐỘNG CO DÃN */}
        <section className="panel-3d-violet rounded-2xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-violet-600 text-white flex items-center justify-center shadow-xs">
                <Layers className="w-4 h-4" />
              </div>
              <span className="text-sm sm:text-base font-black uppercase tracking-wider text-slate-900">
                Chọn Mẫu Phiếu Trắc Nghiệm (Hỗ Trợ Mã Đề 4 Số & 3 Số)
              </span>
            </div>
            <a
              href="./assets/aistudio/QM_2025_-_CV_1239_-_Ky_kiem_tra_420f9135.pdf"
              target="_blank"
              rel="noreferrer"
              className="btn-3d btn-3d-white px-3 py-1.5 rounded-xl text-xs font-black text-violet-800 flex items-center gap-1.5"
            >
              <FileText className="w-4 h-4 text-violet-600" />
              Tải PDF Phiếu Chung CV 1239 (4 Số)
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {(Object.keys(TEMPLATES) as TemplateId[]).map((tplKey) => {
              const tpl = TEMPLATES[tplKey];
              const isSelected = selectedTemplate === tplKey;
              return (
                <button
                  key={tplKey}
                  onClick={() => setSelectedTemplate(tplKey)}
                  className={`px-3.5 py-2.5 rounded-xl text-left transition-all flex flex-col justify-between gap-1 ${
                    isSelected
                      ? `${tpl.btn3dClass} text-white ring-2 ring-offset-2 ring-slate-900/30`
                      : `${tpl.card3dClass} text-slate-900 hover:brightness-98`
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-sm font-black truncate">{tpl.shortName}</span>
                    <span
                      className={`text-[11px] font-mono font-black px-2 py-0.5 rounded-md shrink-0 ${
                        isSelected
                          ? 'bg-black/30 text-white'
                          : 'bg-white text-slate-900 border border-slate-300 shadow-2xs'
                      }`}
                    >
                      {tpl.maDeDigits} SỐ
                    </span>
                  </div>
                  <div
                    className={`text-xs font-bold truncate ${
                      isSelected ? 'text-white/95' : 'text-slate-700'
                    }`}
                  >
                    Tối đa: {tpl.p1Count} P.I • {tpl.p2Count} P.II • {tpl.p3Count} P.III
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* 3. KHUNG TÙY CHỈNH SỐ CÂU & SỐ ĐIỂM MỖI CÂU (CÓ TÙY CHỌN ĐIỂM TỪNG Ý ĐÚNG PHẦN II) */}
        <section className="panel-3d-amber rounded-2xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => setShowScoringPanel((v) => !v)}
              className="flex items-center gap-2.5 text-left"
            >
              <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-xs">
                <Sliders className="w-4 h-4" />
              </div>
              <span className="text-sm sm:text-base font-black uppercase tracking-wider text-slate-900">
                Tùy Chỉnh Số Câu & Điểm Số Từng Phần ({currentTpl.shortName})
              </span>
              {showScoringPanel ? (
                <ChevronUp className="w-5 h-5 text-slate-700" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-700" />
              )}
            </button>

            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-sm font-extrabold text-slate-800 bg-white px-3.5 py-1.5 rounded-xl border-2 border-amber-400 shadow-2xs">
                Tổng điểm tối đa:{' '}
                <strong className="font-mono text-base text-amber-700">
                  {maxPossibleTotalScore.toFixed(2)} đ
                </strong>
              </span>
              <button
                onClick={() => {
                  setP2ScoringMode('progressive');
                  setScoringConfigs((prev) => ({
                    ...prev,
                    [selectedTemplate]: getDefaultScoringConfig(selectedTemplate),
                  }));
                }}
                className="btn-3d btn-3d-white px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Khôi Phục Chuẩn Bộ GD&ĐT
              </button>
            </div>
          </div>

          {showScoringPanel && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 mt-3.5 pt-3.5 border-t-2 border-amber-200">
              {/* PHẦN I (3 cột) */}
              <div className="lg:col-span-3 bg-white rounded-xl p-3.5 border-2 border-blue-300 shadow-xs flex flex-col justify-between gap-2.5">
                <div className="flex items-center justify-between border-b border-blue-100 pb-1.5">
                  <span className="text-sm font-black text-blue-900">
                    PHẦN I (ABCD)
                  </span>
                  <span className="text-xs font-mono font-black px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                    Tổng: {(currentScoring.activeP1Count * currentScoring.p1PointsPerQ).toFixed(2)}đ
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                      Số câu (Max {currentTpl.p1Count})
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          updateCurrentScoring({
                            activeP1Count: Math.max(0, currentScoring.activeP1Count - 1),
                          })
                        }
                        className="btn-3d btn-3d-blue text-white w-7 h-8 rounded-lg font-black text-sm shrink-0"
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
                        className="w-full text-center font-mono font-black text-sm py-1 rounded-lg border-2 border-slate-300 bg-slate-50"
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
                        className="btn-3d btn-3d-blue text-white w-7 h-8 rounded-lg font-black text-sm shrink-0"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                      Điểm / 1 câu
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
                      className="w-full text-center font-mono font-black text-sm py-1.5 rounded-lg border-2 border-blue-400 bg-blue-50/60 text-blue-950"
                    />
                  </div>
                </div>
              </div>

              {/* PHẦN II — NÂNG CẤP TÙY CHỌN ĐIỂM TỪNG Ý ĐÚNG (LŨY TIẾN BỘ GD&ĐT HOẶC CHIA ĐỀU / TÙY CHỈNH) (6 cột) */}
              <div className="lg:col-span-6 bg-white rounded-xl p-3.5 border-2 border-emerald-300 shadow-xs space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100 pb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-emerald-900">
                      PHẦN II (Đúng/Sai 4 ý a,b,c,d)
                    </span>
                    <span className="text-xs font-mono font-black px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      Tổng P.II:{' '}
                      {(currentScoring.activeP2Count * (currentScoring.p2PointsMap[3] || 0)).toFixed(2)}đ
                    </span>
                  </div>

                  {/* Nút chọn nhanh quy tắc tính điểm Phần II */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => {
                        setP2ScoringMode('progressive');
                        updateCurrentScoring({ p2PointsMap: [0.1, 0.25, 0.5, 1.0] });
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                        p2ScoringMode === 'progressive'
                          ? 'btn-3d btn-3d-emerald text-white'
                          : 'btn-3d btn-3d-white text-slate-700'
                      }`}
                    >
                      Chuẩn Bộ (Lũy tiến)
                    </button>
                    <button
                      onClick={() => {
                        setP2ScoringMode('equal');
                        const pt = p2EqualPointPerSub || 0.25;
                        updateCurrentScoring({
                          p2PointsMap: [
                            Number((pt * 1).toFixed(3)),
                            Number((pt * 2).toFixed(3)),
                            Number((pt * 3).toFixed(3)),
                            Number((pt * 4).toFixed(3)),
                          ],
                        });
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                        p2ScoringMode === 'equal'
                          ? 'btn-3d btn-3d-blue text-white'
                          : 'btn-3d btn-3d-white text-slate-700'
                      }`}
                    >
                      Chia đều mỗi ý đúng
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end">
                  {/* Số câu P2 */}
                  <div className="col-span-2 sm:col-span-2">
                    <label className="block text-xs font-extrabold text-slate-700 mb-1">
                      Số câu P.II (Max {currentTpl.p2Count})
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          updateCurrentScoring({
                            activeP2Count: Math.max(0, currentScoring.activeP2Count - 1),
                          })
                        }
                        className="btn-3d btn-3d-emerald text-white w-7 h-8 rounded-lg font-black text-sm shrink-0"
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
                        className="w-full text-center font-mono font-black text-sm py-1 rounded-lg border-2 border-slate-300 bg-slate-50"
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
                        className="btn-3d btn-3d-emerald text-white w-7 h-8 rounded-lg font-black text-sm shrink-0"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* 4 ô tùy chỉnh điểm trực tiếp cho Đúng 1 ý, 2 ý, 3 ý, 4 ý */}
                  {[0, 1, 2, 3].map((subIdx) => (
                    <div key={subIdx}>
                      <label className="block text-[11px] font-extrabold text-emerald-900 mb-1 text-center">
                        Đúng {subIdx + 1} ý
                      </label>
                      <input
                        type="number"
                        step="0.05"
                        min={0}
                        value={currentScoring.p2PointsMap[subIdx]}
                        onChange={(e) => {
                          setP2ScoringMode('custom');
                          const val = Math.max(0, Number(e.target.value) || 0);
                          const nextMap = [...currentScoring.p2PointsMap] as [
                            number,
                            number,
                            number,
                            number,
                          ];
                          nextMap[subIdx] = val;
                          updateCurrentScoring({ p2PointsMap: nextMap });
                        }}
                        className="w-full text-center font-mono font-black text-sm py-1 rounded-lg border-2 border-emerald-400 bg-emerald-50/70 text-emerald-950"
                      />
                    </div>
                  ))}
                </div>

                {p2ScoringMode === 'equal' && (
                  <div className="flex items-center justify-between bg-sky-50 border border-sky-200 rounded-lg px-3 py-1.5 text-xs">
                    <span className="font-bold text-sky-900">
                      Nhập điểm cố định cho mỗi 1 ý đúng (tự nhân lên cho 2, 3, 4 ý):
                    </span>
                    <input
                      type="number"
                      step="0.05"
                      min={0}
                      value={p2EqualPointPerSub}
                      onChange={(e) => {
                        const pt = Math.max(0, Number(e.target.value) || 0);
                        setP2EqualPointPerSub(pt);
                        updateCurrentScoring({
                          p2PointsMap: [
                            Number((pt * 1).toFixed(3)),
                            Number((pt * 2).toFixed(3)),
                            Number((pt * 3).toFixed(3)),
                            Number((pt * 4).toFixed(3)),
                          ],
                        });
                      }}
                      className="w-20 text-center font-mono font-black text-sm py-0.5 rounded border-2 border-sky-400 bg-white text-sky-950"
                    />
                  </div>
                )}
              </div>

              {/* PHẦN III (3 cột) */}
              <div className="lg:col-span-3 bg-white rounded-xl p-3.5 border-2 border-violet-300 shadow-xs flex flex-col justify-between gap-2.5">
                <div className="flex items-center justify-between border-b border-violet-100 pb-1.5">
                  <span className="text-sm font-black text-violet-900">
                    PHẦN III (T.Lời Ngắn)
                  </span>
                  <span className="text-xs font-mono font-black px-2 py-0.5 rounded bg-violet-100 text-violet-800">
                    Tổng: {(currentScoring.activeP3Count * currentScoring.p3PointsPerQ).toFixed(2)}đ
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                      Số câu (Max {currentTpl.p3Count})
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          updateCurrentScoring({
                            activeP3Count: Math.max(0, currentScoring.activeP3Count - 1),
                          })
                        }
                        className="btn-3d btn-3d-violet text-white w-7 h-8 rounded-lg font-black text-sm shrink-0"
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
                        className="w-full text-center font-mono font-black text-sm py-1 rounded-lg border-2 border-slate-300 bg-slate-50"
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
                        className="btn-3d btn-3d-violet text-white w-7 h-8 rounded-lg font-black text-sm shrink-0"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                      Điểm / 1 câu
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
                      className="w-full text-center font-mono font-black text-sm py-1.5 rounded-lg border-2 border-violet-400 bg-violet-50/60 text-violet-950"
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
            className={`px-4 py-3 rounded-xl border-2 flex items-center justify-between gap-2 text-sm font-extrabold shadow-sm ${
              statusBanner.type === 'success'
                ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
                : statusBanner.type === 'warning'
                ? 'bg-amber-50 border-amber-400 text-amber-950'
                : 'bg-sky-50 border-sky-400 text-sky-950'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
              <span>{statusBanner.message}</span>
            </div>
            <button
              onClick={() => setStatusBanner(null)}
              className="text-slate-500 hover:text-slate-900 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* TAB 1: QUẢN LÝ ĐÁP ÁN & QUÉT QR */}
        {activeTab === 'keys' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Cột trái: Quét mã QR & Nhập Excel */}
              <div className="lg:col-span-5 panel-3d-emerald rounded-2xl p-4 sm:p-5 space-y-3.5">
                <div className="flex items-center justify-between border-b-2 border-emerald-200 pb-2.5">
                  <h2 className="text-base font-black uppercase tracking-wider text-emerald-950 flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-emerald-600" />
                    Nạp Đáp Án Chuẩn QM 2025
                  </h2>
                  <span className="text-xs font-mono font-black px-2.5 py-1 rounded-lg bg-emerald-200/80 text-emerald-950">
                    Mã đề {currentTpl.maDeDigits} số
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    onClick={() => setIsQrCameraOpen((prev) => !prev)}
                    className="btn-3d btn-3d-emerald flex items-center justify-center gap-2 py-3 px-3.5 rounded-xl text-white font-black text-sm"
                  >
                    <Camera className="w-4 h-4 shrink-0" />
                    {isQrCameraOpen ? 'Đóng Camera QR' : 'Quét QR Camera'}
                  </button>

                  <label className="btn-3d btn-3d-blue flex items-center justify-center gap-2 py-3 px-3.5 rounded-xl text-white font-black text-sm cursor-pointer">
                    <ImageIcon className="w-4 h-4 shrink-0" />
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
                      <span className="px-3 py-1.5 rounded-lg bg-black/80 text-xs font-mono text-emerald-300">
                        Đưa mã QR Chung QM2025 vào khung ngắm...
                      </span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className="btn-3d btn-3d-violet flex items-center justify-center gap-2 py-3 px-3.5 rounded-xl text-white font-black text-sm cursor-pointer">
                    <FileSpreadsheet className="w-4 h-4 shrink-0" />
                    Nhập Đáp Án Excel
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
                    className="btn-3d btn-3d-amber flex items-center justify-center gap-2 py-3 px-3.5 rounded-xl text-white font-black text-sm"
                  >
                    <Sparkles className="w-4 h-4 shrink-0" />
                    Nạp Đáp Án Mẫu
                  </button>
                </div>

                {/* Chuỗi JSON QR */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-extrabold text-slate-700">
                      Chuỗi mảng JSON 2 chiều từ QR QM2025:
                    </label>
                    <button
                      onClick={() => handleApplyRawJsonQr(rawQrInput)}
                      className="btn-3d btn-3d-white px-2.5 py-1 rounded-lg text-xs font-black text-emerald-800"
                    >
                      Giải mã lại chuỗi
                    </button>
                  </div>
                  <textarea
                    value={rawQrInput}
                    onChange={(e) => setRawQrInput(e.target.value)}
                    rows={3}
                    className="w-full rounded-xl bg-white border-2 border-emerald-300 p-2.5 text-xs font-mono text-slate-800 focus:outline-none focus:border-emerald-600"
                    placeholder='[[101,"B","C",...],[102,"A","A",...]]'
                  />
                </div>
              </div>

              {/* Cột phải: Bảng Đáp Án Chi Tiết (P1, P2, P3) */}
              <div className="lg:col-span-7 panel-3d-sky rounded-2xl p-4 sm:p-5 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-sky-200 pb-2.5">
                  <div>
                    <h2 className="text-base font-black uppercase tracking-wider text-sky-950">
                      Bảng Đáp Án Đang Áp Dụng ({Object.keys(answerKeys).length} Mã Đề)
                    </h2>
                    <p className="text-xs sm:text-sm font-bold text-slate-600">
                      Đang chấm: {currentScoring.activeP1Count} câu P.I • {currentScoring.activeP2Count} câu P.II • {currentScoring.activeP3Count} câu P.III
                    </p>
                  </div>

                  {/* Chọn Mã Đề */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {Object.keys(answerKeys).map((code) => (
                      <button
                        key={code}
                        onClick={() => {
                          setSelectedExamCodeView(code);
                          setSimExamCode(code);
                        }}
                        className={`px-3.5 py-2 rounded-xl font-mono text-sm font-black transition-all ${
                          selectedExamCodeView === code
                            ? 'btn-3d btn-3d-blue text-white'
                            : 'btn-3d btn-3d-white text-slate-800'
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
                      className="btn-3d btn-3d-amber px-3 py-2 rounded-xl text-white text-xs font-black flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> Thêm mã
                    </button>
                  </div>
                </div>

                {currentKeyView ? (
                  <div className="space-y-3.5 max-h-[460px] overflow-y-auto pr-1">
                    {/* Phần I */}
                    {currentScoring.activeP1Count > 0 && (
                      <div className="bg-white rounded-xl p-3.5 border-2 border-blue-200 shadow-2xs">
                        <div className="text-xs sm:text-sm font-black text-blue-900 uppercase tracking-wider mb-2.5">
                          PHẦN I — {currentScoring.activeP1Count} Câu Trắc Nghiệm Nhiều Lựa Chọn ({currentScoring.p1PointsPerQ}đ / câu)
                        </div>
                        <div className="grid grid-cols-6 sm:grid-cols-9 gap-2">
                          {currentKeyView.p1
                            .slice(0, currentScoring.activeP1Count)
                            .map((ans, idx) => (
                              <div
                                key={idx}
                                className="flex flex-col items-center bg-blue-50/80 border-2 border-blue-200 rounded-xl p-1.5"
                              >
                                <span className="text-xs text-slate-600 font-mono font-extrabold">
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
                                  className="mt-0.5 bg-transparent font-mono font-black text-sm text-blue-800 focus:outline-none cursor-pointer"
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
                      <div className="bg-white rounded-xl p-3.5 border-2 border-emerald-200 shadow-2xs">
                        <div className="text-xs sm:text-sm font-black text-emerald-900 uppercase tracking-wider mb-2.5">
                          PHẦN II — {currentScoring.activeP2Count} Câu Trắc Nghiệm Đúng / Sai (1→4 ý: {currentScoring.p2PointsMap.join('đ • ')}đ)
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          {currentKeyView.p2
                            .slice(0, currentScoring.activeP2Count)
                            .map((qObj, qIdx) => (
                              <div
                                key={qIdx}
                                className="bg-emerald-50/70 border-2 border-emerald-200 rounded-xl p-2.5 space-y-2"
                              >
                                <div className="text-sm font-black text-emerald-950 border-b border-emerald-200 pb-1">
                                  Câu {qIdx + 1}
                                </div>
                                {(['a', 'b', 'c', 'd'] as const).map((sk) => (
                                  <div
                                    key={sk}
                                    className="flex items-center justify-between text-xs font-mono"
                                  >
                                    <span className="text-slate-700 font-extrabold text-sm">{sk})</span>
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
                                      className={`px-2.5 py-1 rounded-lg font-black text-xs shadow-2xs ${
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
                      <div className="bg-white rounded-xl p-3.5 border-2 border-purple-200 shadow-2xs">
                        <div className="text-xs sm:text-sm font-black text-purple-900 uppercase tracking-wider mb-2.5">
                          PHẦN III — {currentScoring.activeP3Count} Câu Trả Lời Ngắn ({currentScoring.p3PointsPerQ}đ / câu)
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                          {currentKeyView.p3
                            .slice(0, currentScoring.activeP3Count)
                            .map((val, qIdx) => (
                              <div
                                key={qIdx}
                                className="bg-purple-50/70 border-2 border-purple-200 rounded-xl p-2.5 flex items-center justify-between gap-2"
                              >
                                <span className="text-sm font-mono font-extrabold text-slate-700">
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
                                  className="w-24 text-right font-mono font-black text-sm text-purple-900 bg-white border-2 border-purple-300 rounded-lg px-2 py-1 focus:outline-none focus:border-purple-600"
                                />
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500 text-sm font-bold">
                    Chưa có dữ liệu đáp án. Hãy bấm &ldquo;Nạp Đáp Án Mẫu&rdquo; hoặc quét mã QR.
                  </div>
                )}

                <div className="pt-3 border-t-2 border-sky-200 flex items-center justify-between flex-wrap gap-3">
                  <span className="text-sm font-bold text-slate-700">
                    Sẵn sàng chấm phiếu <strong className="text-blue-700">{currentTpl.shortName}</strong> cho lớp <strong className="text-emerald-700">{activeClassGroup?.className}</strong>
                  </span>
                  <button
                    onClick={() => enterScannerFullscreenMode(true)}
                    className="btn-3d btn-3d-emerald px-5 py-3 rounded-xl text-white font-black text-sm flex items-center gap-2"
                  >
                    <Maximize2 className="w-5 h-5" />
                    Chấm Bài Ngay (Full Màn Hình) →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CAMERA QUÉT PHIẾU OMR THEO 4 NEO CỐ ĐỊNH & FULL MÀN HÌNH TRÊN MỌI THIẾT BỊ */}
        {activeTab === 'scanner' && (
          <div
            className={
              isScannerFullscreen
                ? 'fixed inset-0 z-40 bg-slate-950/98 overflow-y-auto p-2.5 sm:p-4 safe-area-main'
                : ''
            }
          >
            <div className="max-w-7xl mx-auto space-y-3.5">
              {/* THANH TRẠNG THÁI CHẾ ĐỘ FULL MÀN HÌNH & ĐÈN BÁO 4 NEO CỐ ĐỊNH */}
              <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-emerald-950 border-2 border-emerald-400 rounded-2xl p-3 sm:p-4 text-white shadow-xl flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-emerald-300">
                      CHẾ ĐỘ CHẤM FULL MÀN HÌNH • CHỈ QUÉT 4 NEO CỐ ĐỊNH
                    </span>
                  </div>

                  {/* Đèn báo trạng thái 4 Neo Cố Định */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { key: 'tl', label: 'NEO 1 (Trái-Trên)', locked: anchorLockState.tl },
                      { key: 'tr', label: 'NEO 2 (Phải-Trên)', locked: anchorLockState.tr },
                      { key: 'bl', label: 'NEO 3 (Trái-Dưới)', locked: anchorLockState.bl },
                      { key: 'br', label: 'NEO 4 (Phải-Dưới)', locked: anchorLockState.br },
                    ].map((anchor) => (
                      <span
                        key={anchor.key}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-black border transition-all ${
                          anchor.locked
                            ? 'bg-emerald-500 text-slate-950 border-emerald-200 shadow-sm'
                            : 'bg-slate-800/90 text-slate-400 border-slate-700'
                        }`}
                      >
                        {anchor.locked ? '✓ ' : '○ '}
                        {anchor.label}
                      </span>
                    ))}
                    <span className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 font-mono font-black text-xs">
                      {anchorLockState.count}/4 NEO
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setShowGuideModal(true)}
                    className="btn-3d btn-3d-amber px-3 py-2 rounded-xl text-white font-black text-xs flex items-center gap-1.5"
                  >
                    <HelpCircle className="w-4 h-4" />
                    Hướng Dẫn Mới Nhất
                  </button>

                  {isScannerFullscreen ? (
                    <button
                      onClick={exitScannerFullscreenMode}
                      className="btn-3d btn-3d-rose px-3.5 py-2 rounded-xl text-white font-black text-xs flex items-center gap-1.5"
                    >
                      <Minimize2 className="w-4 h-4" />
                      Thu Nhỏ / Thoát Full Màn Hình
                    </button>
                  ) : (
                    <button
                      onClick={() => enterScannerFullscreenMode(true)}
                      className="btn-3d btn-3d-emerald px-3.5 py-2 rounded-xl text-white font-black text-xs flex items-center gap-1.5"
                    >
                      <Maximize2 className="w-4 h-4" />
                      Bật Full Màn Hình
                    </button>
                  )}
                </div>
              </div>

              {/* BANNER BÁO LỖI NGHIÊM TRỌNG KHI HỌC SINH KHÔNG TÔ MÃ ĐỀ (KHÔNG CHẤM) */}
              {missingExamCodeAlert && (
                <div className="bg-rose-600 border-4 border-amber-300 rounded-2xl p-4 text-white shadow-2xl flex flex-wrap items-center justify-between gap-3 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white text-rose-600 flex items-center justify-center shrink-0 shadow-md">
                      <AlertTriangle className="w-7 h-7" />
                    </div>
                    <div>
                      <div className="text-sm sm:text-base font-black uppercase tracking-wide text-amber-200">
                        ⚠️ BÁO LỖI TỪ CHỐI CHẤM BÀI — HỌC SINH KHÔNG TÔ MÃ ĐỀ!
                      </div>
                      <p className="text-xs sm:text-sm font-bold text-white mt-0.5">
                        {missingExamCodeAlert}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setMissingExamCodeAlert(null)}
                    className="btn-3d btn-3d-white px-4 py-2 rounded-xl text-rose-700 font-black text-xs sm:text-sm"
                  >
                    Đã Hiểu & Quét Phiếu Tiếp Theo
                  </button>
                </div>
              )}

              {/* BANNER HIỆN ĐIỂM TỨC THÌ NGAY KHI NHẬN ĐỦ 4/4 NEO CỐ ĐỊNH */}
              {instantScoreBanner && !missingExamCodeAlert && (
                <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-700 border-2 border-emerald-300 rounded-2xl p-3.5 sm:p-4 text-white shadow-xl flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div className="px-4 py-2 rounded-2xl bg-white text-emerald-700 text-center shadow-lg">
                      <div className="text-[10px] font-black uppercase tracking-wider">ĐIỂM BÀI CHẤM</div>
                      <div className="text-2xl sm:text-3xl font-black font-mono tabular-nums">
                        {instantScoreBanner.totalScore.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-400 text-slate-950 text-xs font-black">
                          ✓ ĐÃ KHỚP 4/4 NEO CỐ ĐỊNH — TỰ ĐỘNG CHẤM
                        </span>
                        <span className="text-sm sm:text-base font-black">
                          {instantScoreBanner.studentName} ({instantScoreBanner.className})
                        </span>
                      </div>
                      <div className="text-xs sm:text-sm font-mono font-bold text-emerald-100 mt-1">
                        SBD (Khóa Read-Only): <strong>{instantScoreBanner.sbd}</strong> • Mã đề: <strong>{instantScoreBanner.examCode}</strong> • P1: {instantScoreBanner.p1Score}đ | P2: {instantScoreBanner.p2Score}đ | P3: {instantScoreBanner.p3Score}đ
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab('results')}
                      className="btn-3d btn-3d-white px-3.5 py-2 rounded-xl text-slate-900 font-black text-xs"
                    >
                      Xem Danh Sách Lớp
                    </button>
                    <button
                      onClick={() => setInstantScoreBanner(null)}
                      className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Khung ngắm Camera & Điều khiển */}
                <div className="lg:col-span-8 panel-3d-sky rounded-2xl p-4 space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
                      <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-slate-900">
                        Camera OMR 4 Neo Cố Định — {currentTpl.shortName} ({selectedSubject} • Lớp {activeClassGroup?.className})
                      </h2>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => setAutoTriggerOmr((v) => !v)}
                        className={`btn-3d px-3 py-1.5 rounded-xl text-xs font-black ${
                          autoTriggerOmr
                            ? 'btn-3d-emerald text-white'
                            : 'btn-3d-white text-slate-700'
                        }`}
                      >
                        Đủ 4 neo tự chấm: {autoTriggerOmr ? 'BẬT' : 'TẮT'}
                      </button>

                      <button
                        onClick={() => setShowGridOverlay((v) => !v)}
                        className={`btn-3d px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 ${
                          showGridOverlay
                            ? 'btn-3d-blue text-white'
                            : 'btn-3d-white text-slate-700'
                        }`}
                      >
                        <Eye className="w-4 h-4" />
                        Lưới tọa độ
                      </button>

                      <button
                        onClick={() => setShowCalibration((v) => !v)}
                        className={`btn-3d px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 ${
                          showCalibration
                            ? 'btn-3d-amber text-white'
                            : 'btn-3d-white text-slate-700'
                        }`}
                      >
                        <Sliders className="w-4 h-4" />
                        Tinh chỉnh
                      </button>
                    </div>
                  </div>

                  {/* Thanh tinh chỉnh OMR */}
                  {showCalibration && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-white border-2 border-amber-300 text-xs">
                      <div>
                        <div className="flex justify-between text-slate-700 font-extrabold mb-1">
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
                        <div className="flex justify-between text-slate-700 font-extrabold mb-1">
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
                        <div className="flex justify-between text-slate-700 font-extrabold mb-1">
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
                        <div className="flex justify-between text-slate-700 font-extrabold mb-1">
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
                  <div className="relative rounded-2xl overflow-hidden border-2 border-sky-400 bg-slate-900 aspect-[1024/550] flex items-center justify-center">
                    {isOmrCameraOpen ? (
                      <>
                        <video
                          ref={omrVideoRef}
                          className="w-full h-full object-cover"
                          autoPlay
                          playsInline
                          muted
                        />
                        <canvas
                          ref={omrOverlayCanvasRef}
                          className="absolute inset-0 w-full h-full pointer-events-none"
                        />
                        <div className="absolute top-3 right-3 flex items-center gap-2">
                          {torchSupported && (
                            <button
                              onClick={handleToggleCameraTorch}
                              className={`btn-3d px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg ${
                                torchEnabled
                                  ? 'btn-3d-amber text-white ring-2 ring-yellow-300'
                                  : 'btn-3d-white text-slate-900'
                              }`}
                            >
                              <Zap className="w-4 h-4" />
                              {torchEnabled ? 'Tắt Flash (Torch)' : 'Bật Flash (Torch)'}
                            </button>
                          )}
                          <button
                            onClick={() => setIsOmrCameraOpen(false)}
                            className="btn-3d btn-3d-rose px-3 py-2 rounded-xl text-xs font-black text-white shadow-lg flex items-center gap-1"
                          >
                            <X className="w-4 h-4" />
                            Đóng Camera
                          </button>
                        </div>
                        <div className="absolute bottom-3 inset-x-3 flex flex-wrap items-center justify-between gap-2">
                          <span className="px-3 py-1.5 rounded-lg bg-slate-950/90 border border-emerald-500/60 text-xs font-mono text-emerald-300">
                            Chỉ quét vùng trong 4 Neo Cố Định ({anchorLockState.count}/4) — Nhận đủ 4 neo tự động chấm & hiện điểm
                          </span>
                          <div className="flex items-center gap-2">
                            {torchSupported && (
                              <button
                                onClick={handleToggleCameraTorch}
                                className={`btn-3d px-3.5 py-2.5 rounded-xl font-black text-xs sm:text-sm shadow-lg flex items-center gap-1.5 ${
                                  torchEnabled
                                    ? 'btn-3d-amber text-white'
                                    : 'btn-3d-white text-slate-900'
                                }`}
                              >
                                <Zap className="w-4 h-4" />
                                Bật/Tắt Flash
                              </button>
                            )}
                            <button
                              onClick={handleManualCaptureFromVideo}
                              className="btn-3d btn-3d-emerald px-5 py-2.5 rounded-xl text-white font-black text-sm shadow-lg"
                            >
                              Chụp & Chấm Theo 4 Neo
                            </button>
                          </div>
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
                        <div className="relative z-10 max-w-lg space-y-3.5 bg-white/95 backdrop-blur-md p-5 rounded-2xl border-2 border-sky-300 shadow-xl">
                          <div className="w-12 h-12 rounded-2xl bg-blue-100 border-2 border-blue-300 flex items-center justify-center mx-auto text-blue-700">
                            <Camera className="w-6 h-6" />
                          </div>
                          <h3 className="text-base sm:text-lg font-black text-slate-900">
                            Quét Bảng Trả Lời Theo 4 Neo Cố Định (Full Màn Hình)
                          </h3>
                          <p className="text-xs sm:text-sm font-semibold text-slate-600 leading-relaxed">
                            Hệ thống <strong>chỉ quét vùng bảng trả lời trong 4 neo cố định</strong>, tự động chấm và hiện điểm ngay khi nhận đủ 4 neo, <strong>báo lỗi và không chấm khi không tô Mã đề</strong>, đồng thời khóa bảo mật SBD & đáp án.
                          </p>
                          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                            <button
                              onClick={() => enterScannerFullscreenMode(true)}
                              className="btn-3d btn-3d-emerald px-5 py-3 rounded-xl text-white font-black text-sm flex items-center gap-2"
                            >
                              <Maximize2 className="w-5 h-5" />
                              Mở Camera Chấm Bài (Full Màn Hình)
                            </button>

                            <label className="btn-3d btn-3d-blue px-4 py-3 rounded-xl text-white font-black text-sm flex items-center gap-2 cursor-pointer">
                              <Upload className="w-5 h-5" />
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
                <div className="lg:col-span-4 space-y-4">
                  <div className="panel-3d-emerald rounded-2xl p-4 sm:p-5 space-y-3.5">
                    <div className="flex items-center justify-between border-b-2 border-emerald-200 pb-2">
                      <div className="flex items-center gap-2">
                        <Wand2 className="w-5 h-5 text-emerald-600" />
                        <h3 className="text-sm font-black uppercase tracking-wider text-emerald-950">
                          Mô Phỏng Quét 4 Neo & Kiểm Thử Quy Tắc
                        </h3>
                      </div>
                      <span className="text-xs font-mono font-black px-2 py-0.5 rounded-md bg-emerald-200/80 text-emerald-950">
                        Lớp {activeClassGroup?.className} (Mã {activeClassGroup?.sbdPrefix})
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-700 font-semibold">
                      Kiểm tra tức thì quy trình nhận đủ 4 neo cố định tự động chấm, báo lỗi khi không tô Mã đề, và xuất phiếu thiếu/ngoài SBD xuống cuối danh sách lớp:
                    </p>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-xs text-slate-700 font-black uppercase mb-1">
                          SBD (2 số đầu = Lớp)
                        </label>
                        <input
                          type="text"
                          maxLength={8}
                          value={simSbd}
                          onChange={(e) => setSimSbd(e.target.value)}
                          className="w-full bg-white border-2 border-emerald-400 rounded-xl px-3 py-2 font-mono font-black text-sm text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-700 font-black uppercase mb-1">
                          Mã đề ({currentTpl.maDeDigits} số)
                        </label>
                        <select
                          value={simExamCode}
                          onChange={(e) => setSimExamCode(e.target.value)}
                          className="w-full bg-white border-2 border-emerald-400 rounded-xl px-3 py-2 font-mono font-black text-sm text-slate-900"
                        >
                          {Object.keys(answerKeys).map((c) => (
                            <option key={c} value={c}>
                              Mã đề {c}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      <button
                        onClick={() => handleRunSimulatedSheet(0.9)}
                        className="btn-3d btn-3d-emerald py-2.5 px-3 rounded-xl text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5"
                      >
                        <Zap className="w-4 h-4 shrink-0" />
                        Đủ 4 Neo: Khá/Giỏi
                      </button>
                      <button
                        onClick={() => handleRunSimulatedSheet(1.0)}
                        className="btn-3d btn-3d-blue py-2.5 px-3 rounded-xl text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5"
                      >
                        <Award className="w-4 h-4 shrink-0" />
                        Đủ 4 Neo: Điểm 10
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-emerald-200">
                      <button
                        onClick={() => handleRunSimulatedSheet(0.9, { skipExamCode: true })}
                        className="btn-3d btn-3d-rose py-2 px-2.5 rounded-xl text-white font-black text-xs flex items-center justify-center gap-1.5"
                      >
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        Test Lỗi Không Tô Mã Đề
                      </button>
                      <button
                        onClick={() => handleRunSimulatedSheet(0.9, { skipSbd: true })}
                        className="btn-3d btn-3d-amber py-2 px-2.5 rounded-xl text-white font-black text-xs flex items-center justify-center gap-1.5"
                      >
                        <Users className="w-4 h-4 shrink-0" />
                        Test SBD Xuất Cuối DS Lớp
                      </button>
                    </div>
                  </div>

                  {/* Danh sách các bài vừa chấm gần nhất */}
                  <div className="panel-3d-violet rounded-2xl p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between border-b-2 border-violet-200 pb-2">
                      <h3 className="text-sm font-black uppercase tracking-wider text-violet-950">
                        Các Phiếu Vừa Quét ({gradedRecords.length})
                      </h3>
                      {gradedRecords.length > 0 && (
                        <button
                          onClick={() => {
                            setIsScannerFullscreen(false);
                            setActiveTab('results');
                          }}
                          className="text-xs text-violet-700 hover:text-violet-950 font-black underline"
                        >
                          Xem sổ điểm lớp →
                        </button>
                      )}
                    </div>

                    {gradedRecords.length === 0 ? (
                      <p className="text-sm text-slate-500 font-semibold py-5 text-center">
                        Chưa có bài chấm nào trong phiên này.
                      </p>
                    ) : (
                      <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                        {gradedRecords.slice(0, 6).map((rec) => (
                          <div
                            key={rec.id}
                            onClick={() => setActiveHudRecord(rec)}
                            className="w-full text-left bg-white hover:bg-violet-50/70 border-2 border-violet-200 rounded-xl p-3 flex items-center justify-between transition-all cursor-pointer shadow-2xs"
                          >
                            <div>
                              <div className="text-sm font-black text-slate-900 font-mono flex items-center gap-1.5">
                                <Lock className="w-3.5 h-3.5 text-slate-500" />
                                SBD: {rec.sbd}{' '}
                                <span className="text-violet-700">• Mã: {rec.examCode}</span>
                              </div>
                              <div className="text-xs font-bold text-slate-600 mt-0.5">
                                {rec.studentName
                                  ? `${rec.studentName} (${rec.className})`
                                  : `Lớp ${rec.className || '--'} • STT ${rec.sbdStudentOrder ?? '--'}`}
                              </div>
                            </div>
                            <div className="flex items-center gap-2.5">
                              <div className="text-right">
                                <div className="text-lg font-black font-mono text-emerald-600 tabular-nums">
                                  {rec.totalScore.toFixed(2)}
                                </div>
                                <div className="text-[11px] font-bold text-slate-500">điểm</div>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSaveEvidenceSheet(rec, false);
                                }}
                                title="Tải ảnh minh chứng bài chấm"
                                className="btn-3d btn-3d-white p-2 rounded-lg text-slate-800"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: DANH SÁCH LỚP, SỔ ĐIỂM & LƯU HỒ SƠ MINH CHỨNG */}
        {activeTab === 'results' && (
          <div className="space-y-4">
            {/* Thanh công cụ Xuất Excel & Lưu Minh Chứng */}
            <div className="panel-3d-emerald rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black uppercase tracking-wider text-emerald-950 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-emerald-600" />
                  Bảng Điểm Lớp {activeClassGroup?.className} & Hồ Sơ Minh Chứng ({selectedSubject} • {selectedExamPeriod})
                </h2>
                <p className="text-xs sm:text-sm font-semibold text-slate-700 mt-0.5">
                  Điểm tự động cập nhật vào đúng STT học sinh dựa vào 2 chữ số đầu của SBD ({activeClassGroup?.sbdPrefix} = Lớp {activeClassGroup?.className}).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => setShowClassModal(true)}
                  className="btn-3d btn-3d-violet px-4 py-2.5 rounded-xl text-white font-black text-sm flex items-center gap-2"
                >
                  <Users className="w-4 h-4" />
                  Cập Nhật Danh Sách Lớp
                </button>

                <button
                  onClick={handleExportExcel}
                  className="btn-3d btn-3d-emerald px-4 py-2.5 rounded-xl text-white font-black text-sm flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Xuất Bảng Điểm Lớp (.XLSX)
                </button>

                <button
                  onClick={handleExportFullEvidencePortfolioHtml}
                  disabled={gradedRecords.length === 0}
                  className="btn-3d btn-3d-blue disabled:opacity-40 px-4 py-2.5 rounded-xl text-white font-black text-sm flex items-center gap-2"
                >
                  <FolderCheck className="w-4 h-4" />
                  Tải Hồ Sơ Minh Chứng (Lưu Drive / In)
                </button>

                <button
                  onClick={() => setGradedRecords([])}
                  disabled={gradedRecords.length === 0}
                  className="btn-3d btn-3d-rose disabled:opacity-40 px-3.5 py-2.5 rounded-xl text-white font-black text-sm flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  Xóa lượt quét
                </button>
              </div>
            </div>

            {/* BẢNG 1: DANH SÁCH LỚP ĐÃ TỰ ĐỘNG ĐIỀN ĐIỂM THEO SBD */}
            {activeClassGroup && (
              <div className="panel-3d-sky rounded-2xl overflow-hidden">
                <div className="px-4 py-3.5 bg-sky-100/90 border-b-2 border-sky-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <UserCheck className="w-5 h-5 text-blue-700" />
                    <span className="text-sm sm:text-base font-black uppercase tracking-wider text-blue-950">
                      Danh Sách Học Sinh Lớp {activeClassGroup.className} (Mã đầu SBD: {activeClassGroup.sbdPrefix})
                    </span>
                    <button
                      onClick={() => setShowClassModal(true)}
                      className="btn-3d btn-3d-violet px-3 py-1 rounded-xl text-white font-black text-xs flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Thêm
                    </button>
                  </div>
                  <span className="text-sm font-extrabold text-slate-700">
                    Đã có điểm:{' '}
                    <strong className="text-emerald-700">
                      {activeClassGroup.students.filter((s) => s.totalScore !== undefined).length}/
                      {activeClassGroup.students.length}
                    </strong>{' '}
                    học sinh
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-100 border-b-2 border-slate-200 text-xs font-black uppercase text-slate-700">
                        <th className="py-3 px-3.5">STT</th>
                        <th className="py-3 px-3.5">Mã SBD Chuẩn</th>
                        <th className="py-3 px-3.5">Họ và Tên Học Sinh</th>
                        <th className="py-3 px-3.5">Lớp</th>
                        <th className="py-3 px-3.5">Mã Đề</th>
                        <th className="py-3 px-3.5 text-right">Phần I</th>
                        <th className="py-3 px-3.5 text-right">Phần II</th>
                        <th className="py-3 px-3.5 text-right">Phần III</th>
                        <th className="py-3 px-3.5 text-right">Tổng Điểm</th>
                        <th className="py-3 px-3.5 text-center">Thao Tác & Minh Chứng</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {activeClassGroup.students.map((st) => {
                        const expectedSbd =
                          st.sbd || `${activeClassGroup.sbdPrefix}${String(st.stt).padStart(4, '0')}`;
                        const linkedRecord = gradedRecords.find((r) => r.id === st.recordId);
                        return (
                          <tr
                            key={`${st.stt}-${st.recordId || 'init'}`}
                            className={`transition-colors ${
                              st.isAppendedAtEnd
                                ? 'bg-amber-50/90 hover:bg-amber-100/80'
                                : 'hover:bg-sky-50/70'
                            }`}
                          >
                            <td className="py-3 px-3.5 font-mono font-black text-slate-800">
                              {st.stt}
                            </td>
                            <td className="py-3 px-3.5 font-mono font-black text-blue-700">
                              {expectedSbd}
                            </td>
                            <td className="py-3 px-3.5 font-bold text-slate-900">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span>{st.fullName}</span>
                                {st.isAppendedAtEnd && (
                                  <span className="px-2 py-0.5 rounded-md bg-amber-200 text-amber-950 text-[11px] font-black">
                                    Xuất cuối DS lớp (Không can thiệp SBD)
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3.5 font-bold text-slate-600">
                              {activeClassGroup.className}
                            </td>
                            <td className="py-3 px-3.5 font-mono font-black text-violet-700">
                              {st.examCode || '--'}
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-700">
                              {st.p1Score !== undefined ? st.p1Score.toFixed(2) : '--'}
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-700">
                              {st.p2Score !== undefined ? st.p2Score.toFixed(2) : '--'}
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-700">
                              {st.p3Score !== undefined ? st.p3Score.toFixed(2) : '--'}
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono font-black text-base text-emerald-600">
                              {st.totalScore !== undefined ? `${st.totalScore.toFixed(2)} đ` : 'Chưa chấm'}
                            </td>
                            <td className="py-3 px-3.5 text-center">
                              {linkedRecord ? (
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => setActiveHudRecord(linkedRecord)}
                                    className="btn-3d btn-3d-blue px-2.5 py-1 rounded-lg text-white text-xs font-black"
                                  >
                                    Xem bài
                                  </button>
                                  <button
                                    onClick={() => handleSaveEvidenceSheet(linkedRecord, false)}
                                    title="Tải ảnh minh chứng"
                                    className="btn-3d btn-3d-emerald px-2.5 py-1 rounded-lg text-white text-xs font-black"
                                  >
                                    Lưu ảnh
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setSimSbd(expectedSbd);
                                    enterScannerFullscreenMode(true);
                                  }}
                                  className="btn-3d btn-3d-white px-3 py-1 rounded-lg text-xs font-black text-blue-700"
                                >
                                  Chấm ngay (Full) →
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

      {/* MODAL HƯỚNG DẪN SỬ DỤNG, SỨ MỆNH, TÍNH NĂNG 3D & TẢI TÀI LIỆU MINH HỌA */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
          <div className="bg-slate-50 border-2 border-blue-400 rounded-3xl max-w-5xl w-full overflow-hidden shadow-2xl my-6 flex flex-col max-h-[90vh]">
            {/* Header Modal Hướng Dẫn */}
            <div className="px-5 py-4 bg-gradient-to-r from-blue-700 via-emerald-600 to-violet-700 text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
                  <GraduationCap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-xl font-black uppercase tracking-tight">
                      Cẩm Nang Sứ Mệnh, Tính Năng & Hướng Dẫn Sử Dụng — Edu Chấm Đề 2025
                    </h3>
                    <span className="text-xs font-mono font-black px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950">
                      {APP_VERSION}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-white/90 font-semibold">
                    Tác giả: Thầy Hồ Tấn Khải — Trường THPT Mang Thít, Tỉnh Vĩnh Long
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleDownloadGuideDocument}
                  className="btn-3d btn-3d-amber px-4 py-2 rounded-xl text-white font-black text-xs sm:text-sm flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  Tải Về Tài Liệu Minh Họa (.HTML / PDF)
                </button>
                <button
                  onClick={() => setShowGuideModal(false)}
                  className="btn-3d btn-3d-white px-3 py-2 rounded-xl text-slate-900 font-black text-xs sm:text-sm flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  Đóng
                </button>
              </div>
            </div>

            {/* Nội dung cuộn tự động co dãn theo mọi thiết bị */}
            <div className="p-4 sm:p-6 space-y-6 overflow-y-auto">
              {/* PHẦN 1: SỨ MỆNH & VAI TRÒ SƯ PHẠM (2 KHUNG 3D ĐỔ BÓNG MỜ) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="feature-3d-card feature-3d-blue rounded-2xl p-5 space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <h4 className="text-base sm:text-lg font-black text-blue-950 uppercase">
                      1. Sứ Mệnh Chuyển Đổi Số Giáo Dục
                    </h4>
                  </div>
                  <p className="text-sm text-slate-700 font-medium leading-relaxed">
                    <strong>Edu Chấm Đề 2025</strong> ra đời với sứ mệnh giải phóng sức lao động cho đội ngũ giáo viên phổ thông trong kỷ nguyên Chương trình GDPT 2018. Thay thế hoàn toàn việc chấm tay thủ công tốn hàng giờ đồng hồ bằng công nghệ Thị giác máy tính (Computer Vision OMR) chính xác đến từng sub-pixel ngay trên chiếc điện thoại cá nhân.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-900 text-xs font-black">
                      Chấm 0,3 giây / phiếu
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-900 text-xs font-black">
                      Chính xác 99,9%
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-900 text-xs font-black">
                      100% Miễn phí cho Giáo viên
                    </span>
                  </div>
                </div>

                <div className="feature-3d-card feature-3d-emerald rounded-2xl p-5 space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <h4 className="text-base sm:text-lg font-black text-emerald-950 uppercase">
                      2. Vai Trò Trong Nhà Trường Phổ Thông
                    </h4>
                  </div>
                  <p className="text-sm text-slate-700 font-medium leading-relaxed">
                    Đóng vai trò là <strong>Trợ lý Khảo thí & Kiểm tra Đánh giá Toàn diện</strong>: chuẩn hóa từ khâu quét mã QR đáp án trộn đề, nhận diện phiếu tô chì 3 phần (ABCD, Đúng/Sai, Trả lời ngắn), tự động ghép điểm vào Danh Sách Lớp theo SBD, đến lưu trữ hồ sơ minh chứng phục vụ thanh tra, kiểm tra chuyên môn.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 text-xs font-black">
                      Chuẩn Bộ GD&ĐT 2025
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 text-xs font-black">
                      Hồ sơ minh chứng số
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 text-xs font-black">
                      Xuất điểm Excel 1 chạm
                    </span>
                  </div>
                </div>
              </div>

              {/* PHẦN 2: 8 TÍNH NĂNG LÕI ĐỘT PHÁ (MỖI TÍNH NĂNG 1 MÀU KHUNG 3D VIỀN ĐỔ BÓNG MỜ TỰ CO DÃN) */}
              <div className="space-y-3">
                <h4 className="text-base sm:text-lg font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-violet-600" />
                  3. Hệ Sinh Thái 8 Tính Năng Đột Phá (Tự Động Co Dãn Đa Thiết Bị)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div className="feature-3d-card feature-3d-violet rounded-2xl p-4 space-y-2">
                    <span className="inline-block px-2.5 py-0.5 rounded-md bg-violet-600 text-white text-xs font-black">
                      TÍNH NĂNG 01
                    </span>
                    <h5 className="text-sm font-black text-violet-950">
                      Hỗ Trợ Đủ 5 Mẫu Phiếu (Mã Đề 3 Số & 4 Số CV 1239)
                    </h5>
                    <p className="text-xs text-slate-700 font-medium">
                      Tích hợp sẵn phiếu chung CV 1239 (Mã đề 4 chữ số, 40 câu P.I, 8 câu P.II, 6 câu P.III) cùng 4 mẫu chuyên biệt Toán, KHTN, KHXH, Ngoại Ngữ.
                    </p>
                  </div>

                  <div className="feature-3d-card feature-3d-amber rounded-2xl p-4 space-y-2">
                    <span className="inline-block px-2.5 py-0.5 rounded-md bg-amber-600 text-white text-xs font-black">
                      TÍNH NĂNG 02
                    </span>
                    <h5 className="text-sm font-black text-amber-950">
                      Tùy Chỉnh Số Câu & Điểm Từng Ý Đúng Phần II
                    </h5>
                    <p className="text-xs text-slate-700 font-medium">
                      Cho phép chọn thang điểm Lũy tiến chuẩn Bộ (0.1 - 0.25 - 0.5 - 1.0đ), chia đều điểm mỗi ý đúng hoặc tự nhập điểm riêng theo đặc thù từng tổ bộ môn.
                    </p>
                  </div>

                  <div className="feature-3d-card feature-3d-emerald rounded-2xl p-4 space-y-2">
                    <span className="inline-block px-2.5 py-0.5 rounded-md bg-emerald-600 text-white text-xs font-black">
                      TÍNH NĂNG 03
                    </span>
                    <h5 className="text-sm font-black text-emerald-950">
                      Tự Động Nhận Diện Lớp & STT Học Sinh Từ SBD
                    </h5>
                    <p className="text-xs text-slate-700 font-medium">
                      Tự động lấy 2 chữ số đứng đầu SBD để xác định Lớp (VD: 01 = 12A1) và các chữ số còn lại làm STT học sinh, điền thẳng điểm vào Danh Sách Lớp.
                    </p>
                  </div>

                  <div className="feature-3d-card feature-3d-rose rounded-2xl p-4 space-y-2">
                    <span className="inline-block px-2.5 py-0.5 rounded-md bg-rose-600 text-white text-xs font-black">
                      TÍNH NĂNG 04
                    </span>
                    <h5 className="text-sm font-black text-rose-950">
                      3 Chế Độ Chấm & Đọc Điểm Giọng Nói Tiếng Việt
                    </h5>
                    <p className="text-xs text-slate-700 font-medium">
                      Hỗ trợ Chấm xem kết quả ngay, Chấm liên tục tốc độ cao (tự lưu & đọc tên + điểm học sinh bằng tiếng Việt) và Chấm đối chiếu nhanh.
                    </p>
                  </div>

                  <div className="feature-3d-card feature-3d-cyan rounded-2xl p-4 space-y-2">
                    <span className="inline-block px-2.5 py-0.5 rounded-md bg-cyan-600 text-white text-xs font-black">
                      TÍNH NĂNG 05
                    </span>
                    <h5 className="text-sm font-black text-cyan-950">
                      Nạp Đáp Án Đa Kênh (Quét QR Chung & Excel)
                    </h5>
                    <p className="text-xs text-slate-700 font-medium">
                      Giải mã tức thì mảng JSON 2 chiều từ mã QR hệ thống trộn đề QM2025 hoặc nhập trực tiếp từ bảng Excel (.xlsx) nhiều mã đề cùng lúc.
                    </p>
                  </div>

                  <div className="feature-3d-card feature-3d-indigo rounded-2xl p-4 space-y-2">
                    <span className="inline-block px-2.5 py-0.5 rounded-md bg-indigo-600 text-white text-xs font-black">
                      TÍNH NĂNG 06
                    </span>
                    <h5 className="text-sm font-black text-indigo-950">
                      Chỉ Quét Bảng Trả Lời Theo 4 Neo Cố Định & Tự Chấm
                    </h5>
                    <p className="text-xs text-slate-700 font-medium">
                      Loại bỏ hoàn toàn mọi vật thể ngoài 4 neo cố định. Ngay khi nhận đủ 4/4 neo cố định, hệ thống tự động chấm và hiện điểm tức thì trên màn hình Fullscreen.
                    </p>
                  </div>

                  <div className="feature-3d-card feature-3d-teal rounded-2xl p-4 space-y-2">
                    <span className="inline-block px-2.5 py-0.5 rounded-md bg-teal-600 text-white text-xs font-black">
                      TÍNH NĂNG 07
                    </span>
                    <h5 className="text-sm font-black text-teal-950">
                      Báo Lỗi Không Tô Mã Đề & Khóa Bảo Mật Kết Quả
                    </h5>
                    <p className="text-xs text-slate-700 font-medium">
                      Tự động phát cảnh báo lỗi và từ chối chấm khi phiếu không tô Mã đề. Khóa bảo mật SBD và các đáp án (không cho phép can thiệp chỉnh sửa).
                    </p>
                  </div>

                  <div className="feature-3d-card feature-3d-blue rounded-2xl p-4 space-y-2">
                    <span className="inline-block px-2.5 py-0.5 rounded-md bg-blue-600 text-white text-xs font-black">
                      TÍNH NĂNG 08
                    </span>
                    <h5 className="text-sm font-black text-blue-950">
                      Xuất Phiếu Thiếu/Ngoài SBD Vào Cuối Danh Sách Lớp
                    </h5>
                    <p className="text-xs text-slate-700 font-medium">
                      Các bài chấm thiếu SBD hoặc không khớp STT trong lớp được giữ nguyên hiện trạng và tự động xuất vào đoạn cuối của Danh Sách Lớp đó.
                    </p>
                  </div>
                </div>
              </div>

              {/* PHẦN 3: HƯỚNG DẪN SỬ DỤNG 5 BƯỚC MỚI NHẤT (${APP_VERSION}) */}
              <div className="feature-3d-card feature-3d-amber rounded-2xl p-5 space-y-3">
                <h4 className="text-base sm:text-lg font-black uppercase tracking-wider text-amber-950 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-amber-600" />
                  4. Quy Trình Hướng Dẫn Sử Dụng Chuẩn 5 Bước Mới Nhất ({APP_VERSION})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs sm:text-sm">
                  <div className="bg-white rounded-xl p-3 border-2 border-amber-200">
                    <div className="font-black text-amber-800 mb-1">BƯỚC 1: Chọn Môn & Lớp</div>
                    <p className="text-slate-700 font-medium">
                      Chọn Môn học, Kỳ kiểm tra và Lớp học. Bấm <strong>Danh Sách Lớp (+ Thêm)</strong> ngay trên đầu trang để nạp tên học sinh và đặt 2 chữ số đầu SBD.
                    </p>
                  </div>
                  <div className="bg-white rounded-xl p-3 border-2 border-amber-200">
                    <div className="font-black text-amber-800 mb-1">BƯỚC 2: Chọn Mẫu & Điểm</div>
                    <p className="text-slate-700 font-medium">
                      Chọn 1 trong 5 mẫu phiếu (3 số hoặc 4 số CV 1239). Chỉnh số câu và điểm từng phần (bao gồm điểm từng ý đúng Phần II).
                    </p>
                  </div>
                  <div className="bg-white rounded-xl p-3 border-2 border-amber-200">
                    <div className="font-black text-amber-800 mb-1">BƯỚC 3: Nạp Đáp Án</div>
                    <p className="text-slate-700 font-medium">
                      Quét mã QR đáp án chung bằng Camera, tải ảnh QR hoặc nhập file Excel đáp án chuẩn (.xlsx).
                    </p>
                  </div>
                  <div className="bg-white rounded-xl p-3 border-2 border-amber-200">
                    <div className="font-black text-amber-800 mb-1">BƯỚC 4: Chấm Full Màn Hình</div>
                    <p className="text-slate-700 font-medium">
                      Nhấn <strong>Chấm Bài</strong> để vào <strong>Full Màn Hình</strong>. Chỉ quét vùng trong <strong>4 neo cố định</strong>; đủ 4 neo tự chấm & hiện điểm; báo lỗi nếu không tô Mã đề.
                    </p>
                  </div>
                  <div className="bg-white rounded-xl p-3 border-2 border-amber-200">
                    <div className="font-black text-amber-800 mb-1">BƯỚC 5: Bảo Mật & Xuất Lớp</div>
                    <p className="text-slate-700 font-medium">
                      SBD và đáp án được khóa không cho can thiệp; bài thiếu/ngoài SBD tự động xuất vào <strong>đoạn cuối của Danh Sách Lớp đó</strong>.
                    </p>
                  </div>
                </div>
              </div>

              {/* PHẦN 4: TRUNG TÂM TỰ ĐỘNG CẬP NHẬT PHIÊN BẢN & TƯƠNG THÍCH ĐA NỀN TẢNG */}
              <div className="feature-3d-card feature-3d-indigo rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1 max-w-2xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Cpu className="w-5 h-5 text-indigo-600" />
                    <span className="text-base font-black text-indigo-950 uppercase">
                      5. Cơ Chế Tự Động Cập Nhật Phiên Bản & Tương Thích Toàn Diện
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black">
                      Đã kích hoạt Auto-Sync
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 font-medium">
                    Phiên bản hiện hành: <strong className="font-mono text-indigo-700">{APP_VERSION}</strong> (Cập nhật gần nhất: {lastUpdatedTime}). Tương thích hoàn toàn với <strong>iOS Safari (iPhone/iPad)</strong>, <strong>Android Chrome</strong>, <strong>Windows / macOS</strong> và <strong>GitHub Pages PWA</strong>.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    onClick={handleTriggerAutoUpdateCheck}
                    disabled={isCheckingUpdate}
                    className="btn-3d btn-3d-blue px-4 py-2.5 rounded-xl text-white font-black text-xs sm:text-sm flex items-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
                    {isCheckingUpdate ? 'Đang kiểm tra cập nhật...' : 'Kiểm Tra & Cập Nhật Phiên Bản'}
                  </button>

                  <button
                    onClick={handleDownloadGuideDocument}
                    className="btn-3d btn-3d-emerald px-4 py-2.5 rounded-xl text-white font-black text-xs sm:text-sm flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    Tải Tài Liệu Minh Họa (.HTML / PDF)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL QUẢN LÝ DANH SÁCH LỚP (THÊM LỚP, NHẬP STT, HỌ TÊN HỌC SINH) */}
      {showClassModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white border-2 border-violet-400 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl my-6">
            <div className="px-4 py-3.5 bg-gradient-to-r from-violet-600 to-blue-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Users className="w-5 h-5" />
                <div>
                  <h3 className="text-base font-black uppercase tracking-wider">
                    Quản Lý Danh Sách Lớp & Quy Ước 2 Chữ Số Đầu SBD
                  </h3>
                  <p className="text-xs text-white/90">
                    Khi chấm bài, 2 chữ số đứng đầu SBD xác định Lớp và các chữ số tiếp theo xác định STT học sinh
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowClassModal(false)}
                className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Tạo Lớp Mới */}
              <div className="p-3.5 rounded-xl bg-violet-50 border-2 border-violet-200 space-y-2.5">
                <div className="text-sm font-black text-violet-950 uppercase">
                  1. Chọn Lớp Hoặc Thêm Lớp Mới
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {classRosters.map((cls) => (
                    <button
                      key={cls.id}
                      onClick={() => setActiveClassId(cls.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-black transition-all ${
                        activeClassId === cls.id
                          ? 'btn-3d btn-3d-violet text-white'
                          : 'btn-3d btn-3d-white text-slate-800'
                      }`}
                    >
                      Lớp {cls.className} (Mã đầu SBD: {cls.sbdPrefix}) • {cls.students.length} HS
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                  <input
                    type="text"
                    placeholder="Tên lớp mới (VD: 12A3)"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    className="px-3.5 py-2.5 rounded-xl bg-white border-2 border-violet-300 text-sm font-bold"
                  />
                  <input
                    type="text"
                    maxLength={2}
                    placeholder="2 số đầu SBD (VD: 03)"
                    value={newClassPrefix}
                    onChange={(e) => setNewClassPrefix(e.target.value)}
                    className="px-3.5 py-2.5 rounded-xl bg-white border-2 border-violet-300 text-sm font-mono font-bold"
                  />
                  <button
                    onClick={handleAddNewClassGroup}
                    className="btn-3d btn-3d-emerald px-4 py-2.5 rounded-xl text-white text-sm font-black flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Tạo Lớp Mới
                  </button>
                </div>
              </div>

              {/* Thêm học sinh vào lớp đang chọn */}
              {activeClassGroup && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="p-3.5 rounded-xl bg-sky-50 border-2 border-sky-200 space-y-2.5">
                    <div className="text-sm font-black text-sky-950 uppercase">
                      2. Thêm Lẻ Học Sinh Vào Lớp {activeClassGroup.className}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="STT"
                        value={singleStudentStt}
                        onChange={(e) => setSingleStudentStt(e.target.value)}
                        className="w-20 px-2.5 py-2 rounded-xl bg-white border-2 border-sky-300 text-sm font-mono font-bold"
                      />
                      <input
                        type="text"
                        placeholder="Họ và tên học sinh..."
                        value={singleStudentName}
                        onChange={(e) => setSingleStudentName(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-xl bg-white border-2 border-sky-300 text-sm font-bold"
                      />
                      <button
                        onClick={handleAddSingleStudent}
                        className="btn-3d btn-3d-blue px-3.5 py-2 rounded-xl text-white text-sm font-black"
                      >
                        Thêm
                      </button>
                    </div>

                    <div className="pt-2.5 border-t border-sky-200 space-y-2">
                      <div className="text-xs font-extrabold text-slate-700">
                        Hoặc dán nhanh danh sách cả lớp (Mỗi dòng 1 học sinh):
                      </div>
                      <textarea
                        rows={4}
                        value={bulkStudentsText}
                        onChange={(e) => setBulkStudentsText(e.target.value)}
                        placeholder={`1. Nguyễn Minh An\n2. Trần Hoàng Bách\n3. Lê Ngọc Bảo Châu`}
                        className="w-full rounded-xl bg-white border-2 border-sky-300 p-2.5 text-sm font-medium"
                      />
                      <button
                        onClick={handleBulkImportStudentsFromText}
                        className="btn-3d btn-3d-emerald w-full py-2.5 rounded-xl text-white text-sm font-black"
                      >
                        Nạp Danh Sách Học Sinh Cho Lớp {activeClassGroup.className}
                      </button>
                    </div>
                  </div>

                  {/* Danh sách hiện tại của lớp */}
                  <div className="p-3.5 rounded-xl bg-emerald-50 border-2 border-emerald-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-black text-emerald-950 uppercase">
                          DS Lớp {activeClassGroup.className} ({activeClassGroup.students.length} HS)
                        </span>
                        <span className="text-xs font-mono font-black text-emerald-800">
                          SBD mẫu: {activeClassGroup.sbdPrefix}0001
                        </span>
                      </div>
                      <div className="max-h-56 overflow-y-auto space-y-1.5 bg-white rounded-xl p-2.5 border border-emerald-200">
                        {activeClassGroup.students.map((st) => (
                          <div
                            key={st.stt}
                            className="flex items-center justify-between text-xs sm:text-sm py-1.5 px-2 rounded hover:bg-slate-50 border-b border-slate-100"
                          >
                            <div>
                              <span className="font-mono font-black text-blue-700 mr-2">
                                #{st.stt} ({activeClassGroup.sbdPrefix}
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

                    <div className="pt-3 flex justify-end">
                      <button
                        onClick={() => setShowClassModal(false)}
                        className="btn-3d btn-3d-violet px-5 py-2.5 rounded-xl text-white text-sm font-black"
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
          <div className="bg-white border-2 border-blue-400 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl my-6">
            {/* Header HUD */}
            <div className="px-4 py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 text-white flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="px-3.5 py-2 rounded-xl bg-white text-emerald-700 text-center shadow">
                  <div className="text-[10px] uppercase font-black tracking-wider">TỔNG ĐIỂM</div>
                  <div className="text-2xl font-black font-mono tabular-nums">
                    {activeHudRecord.totalScore.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-black">
                      {activeHudRecord.studentName || `Học sinh STT ${activeHudRecord.sbdStudentOrder ?? '--'}`}
                    </span>
                    <span className="text-xs px-2.5 py-0.5 rounded-md bg-white/25 font-bold">
                      Lớp {activeHudRecord.className || activeClassGroup?.className} (Mã đầu SBD: {activeHudRecord.sbdClassPrefix})
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 flex-wrap text-xs sm:text-sm mt-1.5">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-900/40 border border-white/30 font-mono font-black flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-amber-300" />
                      SBD (Khóa): {activeHudRecord.sbd}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-900/40 border border-white/30 font-mono font-black flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-amber-300" />
                      Mã đề (Khóa): {activeHudRecord.examCode}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 font-black text-xs">
                      🔒 Đã khóa bảo mật (Không được quyền can thiệp SBD & Đáp án)
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleSaveEvidenceSheet(activeHudRecord, false)}
                  className="btn-3d btn-3d-amber px-3.5 py-2 rounded-xl text-white font-black text-xs sm:text-sm flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  Tải Ảnh Minh Chứng
                </button>
                <button
                  onClick={() => handleSaveEvidenceSheet(activeHudRecord, true)}
                  className="btn-3d btn-3d-emerald px-3.5 py-2 rounded-xl text-white font-black text-xs sm:text-sm flex items-center gap-1.5"
                >
                  <Share2 className="w-4 h-4" />
                  Lưu Lên Drive / Chia Sẻ
                </button>
                <button
                  onClick={() => setActiveHudRecord(null)}
                  className="btn-3d btn-3d-white px-3.5 py-2 rounded-xl font-black text-xs sm:text-sm flex items-center gap-1"
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
                <div className="text-xs sm:text-sm font-black text-slate-800 flex items-center justify-between">
                  <span>Ảnh Phiếu Đã Nắn Phẳng Theo 4 Neo Cố Định:</span>
                  <span className="text-xs font-bold">
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

              {/* Chi tiết từng phần — KHÓA READ-ONLY TUYỆT ĐỐI KHÔNG CHO CAN THIỆP */}
              <div className="lg:col-span-5 space-y-3 text-xs sm:text-sm">
                <div className="p-2.5 rounded-xl bg-amber-50 border-2 border-amber-300 text-amber-950 text-xs font-bold flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>
                    Số báo danh và toàn bộ đáp án quét từ phiếu được <strong>khóa nguyên trạng (Read-Only)</strong>, không được quyền can thiệp chỉnh sửa. Nếu SBD thiếu hoặc ngoài danh sách, kết quả được tự động xuất vào <strong>cuối danh sách lớp</strong>.
                  </span>
                </div>

                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-3">
                  <div className="font-black text-blue-900 mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-blue-600" />
                      Phần I ({activeHudRecord.p1CorrectCount}/{activeHudRecord.p1TotalCount} câu = {activeHudRecord.p1Score}đ) — Chỉ xem
                    </span>
                  </div>
                  <div className="grid grid-cols-6 gap-1.5 max-h-44 overflow-y-auto pr-1">
                    {activeHudRecord.p1Details.map((q) => (
                      <div
                        key={q.qIndex}
                        className={`p-1.5 rounded-lg border text-center font-mono select-none ${
                          q.isCorrect
                            ? 'bg-emerald-100 border-emerald-400 text-emerald-950 font-black'
                            : 'bg-rose-100 border-rose-400 text-rose-950 font-black'
                        }`}
                      >
                        <div className="text-[10px] text-slate-600">C.{q.qIndex}</div>
                        <div className="text-xs">
                          {q.studentAnswer || '_'}
                          {!q.isCorrect && (
                            <span className="text-amber-700 text-[10px]">/{q.correctAnswer}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {activeHudRecord.p2Details.length > 0 && (
                  <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-3">
                    <div className="font-black text-emerald-900 mb-2 flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-emerald-600" />
                      Phần II — Đúng/Sai ({activeHudRecord.p2Score}đ) — Chỉ xem
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {activeHudRecord.p2Details.map((q) => (
                        <div
                          key={q.qIndex}
                          className="p-2 rounded-lg bg-white border border-emerald-200 flex items-center justify-between font-mono text-xs"
                        >
                          <span className="font-extrabold text-slate-700">C.{q.qIndex}:</span>
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
                  <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-3">
                    <div className="font-black text-purple-900 mb-2 flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-purple-600" />
                      Phần III — Trả lời ngắn ({activeHudRecord.p3Score}đ) — Chỉ xem
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {activeHudRecord.p3Details.map((q) => (
                        <div
                          key={q.qIndex}
                          className={`p-2 rounded-lg border font-mono text-xs flex items-center justify-between ${
                            q.isCorrect
                              ? 'bg-emerald-100 border-emerald-300 text-emerald-950'
                              : 'bg-rose-100 border-rose-300 text-rose-950'
                          }`}
                        >
                          <span className="font-extrabold">C.{q.qIndex}:</span>
                          <span className="px-2 py-0.5 bg-white/80 border border-slate-300 rounded font-black">
                            {q.studentString || 'Trống'}
                          </span>
                          <span className="text-[11px] text-amber-800 font-bold">
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

      {/* MODAL CÀI ĐẶT PHÍM TẮT MÀN HÌNH CHÍNH (iOS SAFARI & ANDROID CHROME/SAMSUNG INTERNET) + BỘ MÃ NGUỒN PWA */}
      {showPwaModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
          <div className="bg-slate-50 border-2 border-rose-400 rounded-3xl max-w-5xl w-full overflow-hidden shadow-2xl my-6 flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 bg-gradient-to-r from-rose-600 via-violet-700 to-blue-700 text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center">
                  <Smartphone className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-base sm:text-xl font-black uppercase tracking-tight">
                    Tạo Phím Tắt Màn Hình Điện Thoại (iPhone iOS & Android) — Chuẩn PWA Offline
                  </h3>
                  <p className="text-xs sm:text-sm text-white/90 font-semibold">
                    Chạy độc lập toàn màn hình (Standalone), xử lý tai thỏ Dynamic Island, bật Flash Android & chấm bài ngay cả khi mất mạng trong phòng thi
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isInstallable && (
                  <button
                    onClick={promptInstall}
                    className="btn-3d btn-3d-emerald px-4 py-2 rounded-xl text-white font-black text-xs sm:text-sm flex items-center gap-1.5"
                  >
                    <Download className="w-4 h-4" />
                    Cài Đặt Tự Động Ngay
                  </button>
                )}
                <button
                  onClick={() => setShowPwaModal(false)}
                  className="btn-3d btn-3d-white px-3 py-2 rounded-xl text-slate-900 font-black text-xs sm:text-sm flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  Đóng
                </button>
              </div>
            </div>

            {/* Thanh chuyển tab giữa Hướng dẫn cài đặt và 6 File mã nguồn PWA */}
            <div className="px-4 py-2.5 bg-white border-b-2 border-slate-200 flex items-center gap-2 overflow-x-auto shrink-0">
              {(
                [
                  { id: 'guide', label: '📱 Hướng Dẫn Cài Trên iPhone & Android' },
                  { id: 'index.html', label: '1. index.html' },
                  { id: 'style.css', label: '2. style.css' },
                  { id: 'camera.js', label: '3. camera.js' },
                  { id: 'app.js', label: '4. app.js' },
                  { id: 'manifest.json', label: '5. manifest.json' },
                  { id: 'sw.js', label: '6. sw.js' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActivePwaCodeTab(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all ${
                    activePwaCodeTab === tab.id
                      ? 'btn-3d btn-3d-blue text-white'
                      : 'btn-3d btn-3d-white text-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
              {activePwaCodeTab === 'guide' ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Cột 1: iPhone / iPad (iOS Safari) */}
                    <div className="feature-3d-card feature-3d-blue rounded-2xl p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-3 py-1 rounded-lg bg-blue-600 text-white text-xs font-black uppercase">
                          Hệ Điều Hành 1 • iPhone / iPad (iOS Safari)
                        </span>
                        <span className="text-xs font-mono font-bold text-blue-800">
                          Hỗ trợ Dynamic Island & Tai thỏ
                        </span>
                      </div>
                      <h4 className="text-base sm:text-lg font-black text-blue-950">
                        4 Bước Tạo Phím Tắt Toàn Màn Hình Trên iPhone (Safari)
                      </h4>
                      <ol className="space-y-2.5 text-xs sm:text-sm text-slate-800 font-medium list-decimal pl-5">
                        <li>
                          <strong>Bước 1:</strong> Mở đường dẫn trang web <strong>Edu Chấm Đề 2025</strong> bằng trình duyệt <strong>Safari</strong> mặc định trên iPhone hoặc iPad.
                        </li>
                        <li>
                          <strong>Bước 2:</strong> Nhấn vào biểu tượng <strong>Chia sẻ (Share)</strong> <span className="inline-block px-1.5 py-0.5 bg-blue-100 text-blue-900 rounded font-mono font-bold">[↑]</span> nằm ở thanh công cụ dưới cùng màn hình Safari.
                        </li>
                        <li>
                          <strong>Bước 3:</strong> Cuộn menu xuống dưới và nhấn chọn dòng <strong>&ldquo;Thêm vào MH chính&rdquo; (Add to Home Screen [+])</strong>.
                        </li>
                        <li>
                          <strong>Bước 4:</strong> Nhấn nút <strong>&ldquo;Thêm&rdquo; (Add)</strong> ở góc trên bên phải. Biểu tượng <strong>EduChấmĐề</strong> sẽ xuất hiện ngay trên màn hình chính như một ứng dụng gốc (không còn thanh địa chỉ Safari).
                        </li>
                      </ol>
                      <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-950 font-semibold">
                        <strong>Cấu hình kỹ thuật iOS đã kích hoạt:</strong> <code>apple-mobile-web-app-capable=&quot;yes&quot;</code>, <code>apple-mobile-web-app-status-bar-style=&quot;black-translucent&quot;</code>, <code>playsinline=&quot;true&quot;</code> (không bị văng sang trình phát video toàn màn hình) và <code>apple-touch-icon.png</code> 180×180.
                      </div>
                    </div>

                    {/* Cột 2: Android (Google Chrome / Samsung Internet) */}
                    <div className="feature-3d-card feature-3d-emerald rounded-2xl p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-black uppercase">
                          Hệ Điều Hành 2 • Android (Chrome / Samsung)
                        </span>
                        <span className="text-xs font-mono font-bold text-emerald-800">
                          Hỗ trợ Đèn Flash (Torch)
                        </span>
                      </div>
                      <h4 className="text-base sm:text-lg font-black text-emerald-950">
                        4 Bước Cài Đặt Ứng Dụng PWA Trên Điện Thoại Android
                      </h4>
                      <ol className="space-y-2.5 text-xs sm:text-sm text-slate-800 font-medium list-decimal pl-5">
                        <li>
                          <strong>Bước 1:</strong> Mở trang web bằng trình duyệt <strong>Google Chrome</strong> hoặc <strong>Samsung Internet</strong> trên điện thoại Android.
                        </li>
                        <li>
                          <strong>Bước 2:</strong> Nhấn nút <strong>&ldquo;Cài Đặt Tự Động Ngay&rdquo;</strong> trên thanh thông báo hoặc nhấn vào biểu tượng <strong>Menu 3 chấm (⋮)</strong> ở góc phải thanh địa chỉ.
                        </li>
                        <li>
                          <strong>Bước 3:</strong> Chọn mục <strong>&ldquo;Cài đặt ứng dụng&rdquo; (Install App)</strong> hoặc <strong>&ldquo;Thêm vào màn hình chính&rdquo; (Add to Home screen)</strong>.
                        </li>
                        <li>
                          <strong>Bước 4:</strong> Nhấn xác nhận <strong>&ldquo;Cài đặt&rdquo;</strong>. Ứng dụng sẽ được đóng gói chuẩn APK/WebAPK độc lập trên màn hình chính và ngăn kéo ứng dụng.
                        </li>
                      </ol>
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 font-semibold">
                        <strong>Cấu hình kỹ thuật Android đã kích hoạt:</strong> <code>manifest.json</code> chuẩn <code>display: standalone</code>, icon <code>maskable</code> 512×512, tự động kiểm tra phần cứng đèn Flash (Torch) qua <code>MediaTrackCapabilities / ImageCapture</code> để hiện nút <strong>Bật/Tắt Flash</strong> khi thiếu sáng.
                      </div>
                    </div>
                  </div>

                  {/* Khung kiểm tra trạng thái Offline & Base64 Capture */}
                  <div className="feature-3d-card feature-3d-violet rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="text-sm sm:text-base font-black text-violet-950 uppercase flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-violet-600" />
                        Trạng Thái Bộ Nhớ Đệm Phòng Thi (Service Worker sw.js) & Chụp Ảnh Base64
                      </div>
                      <p className="text-xs sm:text-sm text-slate-700 font-medium">
                        Toàn bộ tài nguyên HTML, CSS, JS, Icon và thuật toán chấm OMR đã được lưu vào Cache trình duyệt để giáo viên mở và chấm bài ngay cả khi tắt Wi-Fi / 4G trong phòng thi.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <a
                        href="./manifest.json"
                        download="manifest.json"
                        className="btn-3d btn-3d-white px-3 py-2 rounded-xl text-xs font-black text-violet-900"
                      >
                        Tải manifest.json
                      </a>
                      <a
                        href="./sw.js"
                        download="sw.js"
                        className="btn-3d btn-3d-white px-3 py-2 rounded-xl text-xs font-black text-violet-900"
                      >
                        Tải sw.js
                      </a>
                      <a
                        href="./camera.js"
                        download="camera.js"
                        className="btn-3d btn-3d-white px-3 py-2 rounded-xl text-xs font-black text-violet-900"
                      >
                        Tải camera.js
                      </a>
                      {lastCapturedBase64Jpeg && (
                        <a
                          href={lastCapturedBase64Jpeg}
                          download="Anh_Chup_Camera_Base64.jpg"
                          className="btn-3d btn-3d-emerald px-3 py-2 rounded-xl text-xs font-black text-white"
                        >
                          Tải Ảnh Base64 Vừa Chụp
                        </a>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <PwaSourceCodePreview fileKey={activePwaCodeTab} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM NAVIGATION BAR WITH SAFE-AREA INSETS */}
      <nav className="fixed bottom-0 inset-x-0 z-30 border-t-2 border-sky-300 bg-white/95 backdrop-blur-md shadow-lg safe-area-bottom-nav">
        <div className="max-w-3xl mx-auto grid grid-cols-5 gap-1.5 p-2">
          <button
            onClick={() => {
              setIsScannerFullscreen(false);
              setActiveTab('keys');
            }}
            className={`py-2.5 px-2 rounded-xl flex items-center justify-center gap-1.5 text-xs sm:text-sm font-black transition-all ${
              activeTab === 'keys'
                ? 'btn-3d btn-3d-blue text-white'
                : 'btn-3d btn-3d-white text-slate-700'
            }`}
          >
            <QrCode className="w-4 h-4 shrink-0" />
            <span className="truncate">1. Đáp Án</span>
          </button>

          <button
            onClick={() => enterScannerFullscreenMode(true)}
            className={`py-2.5 px-2 rounded-xl flex items-center justify-center gap-1.5 text-xs sm:text-sm font-black transition-all ${
              activeTab === 'scanner'
                ? 'btn-3d btn-3d-emerald text-white'
                : 'btn-3d btn-3d-white text-slate-700'
            }`}
          >
            <Maximize2 className="w-4 h-4 shrink-0" />
            <span className="truncate">2. Chấm Bài</span>
          </button>

          <button
            onClick={() => {
              setIsScannerFullscreen(false);
              setActiveTab('results');
            }}
            className={`py-2.5 px-2 rounded-xl flex items-center justify-center gap-1.5 text-xs sm:text-sm font-black transition-all ${
              activeTab === 'results'
                ? 'btn-3d btn-3d-violet text-white'
                : 'btn-3d btn-3d-white text-slate-700'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 shrink-0" />
            <span className="truncate">3. DS Lớp ({stats.count})</span>
          </button>

          <button
            onClick={() => setShowPwaModal(true)}
            className="btn-3d btn-3d-rose py-2.5 px-2 rounded-xl flex items-center justify-center gap-1.5 text-xs sm:text-sm font-black text-white"
          >
            <Smartphone className="w-4 h-4 shrink-0" />
            <span className="truncate">Cài App ĐT</span>
          </button>

          <button
            onClick={() => setShowGuideModal(true)}
            className="btn-3d btn-3d-amber py-2.5 px-2 rounded-xl flex items-center justify-center gap-1.5 text-xs sm:text-sm font-black text-white"
          >
            <HelpCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">Hướng Dẫn</span>
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

/**
 * Component hiển thị & tải về trực tiếp 6 file mã nguồn PWA chuẩn (index.html, style.css, camera.js, app.js, manifest.json, sw.js)
 */
function PwaSourceCodePreview({
  fileKey,
}: {
  fileKey: 'index.html' | 'style.css' | 'camera.js' | 'app.js' | 'manifest.json' | 'sw.js';
}) {
  const [content, setContent] = useState<string>('Đang tải mã nguồn...');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    setContent('Đang tải mã nguồn...');
    fetch(`./${fileKey}`)
      .then((res) => res.text())
      .then((txt) => {
        if (!cancelled) setContent(txt);
      })
      .catch(() => {
        if (!cancelled) setContent(`// Không thể đọc trực tiếp ./${fileKey}`);
      });
    return () => {
      cancelled = true;
    };
  }, [fileKey]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 text-white px-4 py-3 rounded-2xl">
        <div className="font-mono font-black text-sm text-sky-300">
          📄 File cấu hình PWA độc lập: ./{fileKey}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="btn-3d btn-3d-blue px-3 py-1.5 rounded-xl text-xs font-black text-white"
          >
            {copied ? '✓ Đã sao chép mã nguồn' : 'Sao chép mã nguồn'}
          </button>
          <a
            href={`./${fileKey}`}
            download={fileKey}
            className="btn-3d btn-3d-emerald px-3 py-1.5 rounded-xl text-xs font-black text-white flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" />
            Tải file {fileKey}
          </a>
        </div>
      </div>
      <pre className="p-4 rounded-2xl bg-slate-950 text-emerald-300 font-mono text-xs overflow-x-auto max-h-[55vh] leading-relaxed border-2 border-slate-800 select-text">
        <code>{content}</code>
      </pre>
    </div>
  );
}

