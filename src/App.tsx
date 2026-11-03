import React, { useEffect, useMemo, useRef, useState } from 'react';
import jsQR from 'jsqr';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import {
  AlertTriangle,
  Award,
  BarChart3,
  BookOpen,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileArchive,
  FileCode,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderCheck,
  GraduationCap,
  HelpCircle,
  Image as ImageIcon,
  Key,
  Layers,
  Lock,
  MoreHorizontal,
  Play,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  Sliders,
  Smartphone,
  Sparkles,
  Trash2,
  Upload,
  User,
  UserCheck,
  Users,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import {
  AnswerKeyData,
  CustomScoringConfig,
  decodeQrFromImageData,
  DEFAULT_QR_JSON_RAW,
  getDefaultScoringConfig,
  getTemplateBubbleMap,
  normalizeTemplateId,
  parseQM2025QrPayload,
  SAMPLE_QR_IMAGE_URL,
  SHEET_DATABASE,
  SheetDatabaseItem,
  SheetGroupType,
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
  isValidExamPaper,
  OMRSettings,
  parseSbdToClassAndStt,
  warpPerspectiveTo1024x550,
} from './omr/visionEngine';
import {
  capturePhoto,
  captureStandardFrameForOMR,
  getFriendlyCameraPermissionError,
  setCameraTorch,
  startCrossPlatformCamera,
} from './omr/camera';
import { usePWAInstall } from './pwa/usePWAInstall';

type BottomNavTab = 'sessions' | 'scanner' | 'classes' | 'settings';
type SessionSubView =
  | 'welcome'
  | 'list'
  | 'create'
  | 'hub'
  | 'keys'
  | 'graded'
  | 'stats'
  | 'selectClass';

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
  isAppendedAtEnd?: boolean;
}

export interface ClassRosterGroup {
  id: string;
  className: string;
  sbdPrefix: string; // 2 chữ số đầu của SBD nhận biết lớp, ví dụ "01"
  students: StudentRosterItem[];
}

export interface ExamSessionItem {
  id: string;
  name: string;
  subject: string;
  examPeriod: string;
  createdAt: string;
  templateId: TemplateId;
  codeLength: 3 | 4;
  scanSbd: boolean;
  scoring: CustomScoringConfig;
  classId: string;
  answerKeys?: Record<string, AnswerKeyData>;
  gradedRecords?: interfaceGradedSheetRecord[];
}

const APP_VERSION = '1.89 (Build 89 • GDPT 2018)';

function buildDefaultAnswerKeyMap(templateId: TemplateId = 'qm_khtn_dia'): Record<string, AnswerKeyData> {
  const list = parseQM2025QrPayload(DEFAULT_QR_JSON_RAW, templateId);
  const map: Record<string, AnswerKeyData> = {};
  for (const item of list) {
    map[item.examCode] = item;
  }
  return map;
}

const DEFAULT_EXAM_SESSIONS: ExamSessionItem[] = [
  {
    id: 'session-sinh-12-cki',
    name: 'Môn SINH HỌC - Lớp 12 - Kiểm tra Cuối Kì I (02-11-26)',
    subject: 'Sinh Học 12',
    examPeriod: 'Kiểm tra Cuối Kì I',
    createdAt: '2026-11-02 08:00:00',
    templateId: 'qm_khtn_dia',
    codeLength: 3,
    scanSbd: true,
    scoring: {
      ...getDefaultScoringConfig('qm_khtn_dia'),
      activeP1Count: 18,
      p1PointsPerQ: 0.25,
      activeP2Count: 4,
      p2PointsMap: [0.1, 0.25, 0.5, 1.0],
      activeP3Count: 6,
      p3PointsPerQ: 0.5,
    },
    classId: 'cls-12a1',
    answerKeys: buildDefaultAnswerKeyMap('qm_khtn_dia'),
  },
];

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
      { stt: 8, fullName: 'Lê Tấn Lộc' },
      { stt: 9, fullName: 'Lê Trường Duy' },
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

function playSuccessBeep() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const playBeep = (delay: number, freq: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      gain.gain.setValueAtTime(0.35, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.11);
    };
    playBeep(0, 880);
    playBeep(0.12, 1320); // Bip bip
  } catch {
    // Ignore audio errors
  }
}

function playErrorAlertBeep() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

function computeTotalScoreFromConfig(cfg: CustomScoringConfig): number {
  const p1Max = cfg.activeP1Count * cfg.p1PointsPerQ;
  const p2Max = cfg.activeP2Count * (cfg.p2PointsMap[3] || 1.0);
  const p3Max = cfg.activeP3Count * cfg.p3PointsPerQ;
  return Math.round((p1Max + p2Max + p3Max) * 100) / 100;
}

export default function App() {
  // Bottom Navigation & Sub-screen State
  const [bottomTab, setBottomTab] = useState<BottomNavTab>('sessions');
  const [sessionView, setSessionView] = useState<SessionSubView>('list');

  // Exam Sessions State: Khởi tạo sẵn đợt chấm chuẩn kèm bộ đáp án 101-104 (18 P1, 4 P2, 6 P3)
  const [examSessions, setExamSessions] = useState<ExamSessionItem[]>(() => {
    try {
      const isCleaned = localStorage.getItem('edu_cham_de_clean_init_v7');
      if (!isCleaned) {
        localStorage.removeItem('qm2025_exam_sessions_v2');
        localStorage.removeItem('edu_cham_de_2025_records');
        localStorage.setItem('edu_cham_de_clean_init_v7', 'true');
        return DEFAULT_EXAM_SESSIONS;
      }
      const saved = localStorage.getItem('qm2025_exam_sessions_v2');
      if (saved) {
        const parsedSessions: ExamSessionItem[] = JSON.parse(saved);
        if (Array.isArray(parsedSessions) && parsedSessions.length > 0) {
          const upgradedP3 = localStorage.getItem('edu_cham_de_p3_05_upgraded_v1');
          if (!upgradedP3) {
            localStorage.setItem('edu_cham_de_p3_05_upgraded_v1', 'true');
          }
          return parsedSessions.map((sess) => {
            const keys = sess.answerKeys;
            const hasKeys = keys && Object.keys(keys).length > 0;
            const k101 = keys?.['101'] || keys?.['0101'];
            const nextP3Points = !upgradedP3 ? 0.5 : (sess.scoring?.p3PointsPerQ ?? 0.5);
            // Tự động nâng cấp nếu phiên cũ thiếu đáp án hoặc đang lưu bộ đáp án mẫu cũ (B,C,D,C,D,A)
            if (!hasKeys || (k101 && k101.p1?.slice(0, 6).join('') === 'BCDCD' + 'A')) {
              const freshMap = buildDefaultAnswerKeyMap(sess.templateId);
              return {
                ...sess,
                answerKeys: freshMap,
                scoring: {
                  ...sess.scoring,
                  activeP1Count: 18,
                  activeP2Count: 4,
                  activeP3Count: 6,
                  p3PointsPerQ: 0.5,
                },
              };
            }
            return {
              ...sess,
              scoring: {
                ...sess.scoring,
                p3PointsPerQ: nextP3Points,
              },
            };
          });
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_EXAM_SESSIONS;
  });
  const [activeSessionId, setActiveSessionId] = useState<string>(
    () => DEFAULT_EXAM_SESSIONS[0]?.id || ''
  );

  const activeSession = useMemo(
    () => examSessions.find((s) => s.id === activeSessionId) || examSessions[0] || null,
    [examSessions, activeSessionId]
  );

  // Nếu chưa có đợt chấm nào mà ở màn hình hub hoặc keys thì tự chuyển về màn hình danh sách
  useEffect(() => {
    if (examSessions.length === 0 && (sessionView === 'hub' || sessionView === 'keys')) {
      setSessionView('list');
    }
  }, [examSessions.length, sessionView]);

  // Draft State for "Tạo mới / Chỉnh sửa bài thi"
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState<string>('');
  const [draftCodeLength, setDraftCodeLength] = useState<3 | 4>(3);
  const [draftTemplateId, setDraftTemplateId] = useState<TemplateId>('qm_khtn_dia');
  const [draftScanSbd, setDraftScanSbd] = useState<boolean>(true);
  const [draftScoring, setDraftScoring] = useState<CustomScoringConfig>(() =>
    getDefaultScoringConfig('qm_khtn_dia')
  );
  const [showAdvancedP2Points, setShowAdvancedP2Points] = useState<boolean>(false);

  // Bottom Sheets & Modals
  const [showSheetSelectorBottomSheet, setShowSheetSelectorBottomSheet] = useState<boolean>(false);
  const [sheetGroupTab, setSheetGroupTab] = useState<SheetGroupType>('Khổ ngang (2 bài/A4)');
  const [previewSheetModalItem, setPreviewSheetModalItem] = useState<SheetDatabaseItem | null>(
    null
  );
  const [showKeyActionSheet, setShowKeyActionSheet] = useState<boolean>(false);
  const [showExportActionSheet, setShowExportActionSheet] = useState<boolean>(false);
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [showAccountModal, setShowAccountModal] = useState<boolean>(false);
  const [showClassModal, setShowClassModal] = useState<boolean>(false);

  // Active Template & Scoring synced with activeSession
  const selectedTemplate = useMemo(
    () => normalizeTemplateId(activeSession?.templateId || 'qm_khtn_dia'),
    [activeSession]
  );
  const currentScoring = useMemo(
    () => activeSession?.scoring || getDefaultScoringConfig(selectedTemplate),
    [activeSession, selectedTemplate]
  );

  // Class Rosters
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

  // Settings (Tự động khôi phục từ localStorage)
  const [autoGradeDelaySeconds, setAutoGradeDelaySeconds] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('edu_cham_de_settings_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.autoGradeDelaySeconds === 'number') return parsed.autoGradeDelaySeconds;
      }
    } catch {
      // ignore
    }
    return 1.2;
  });
  // Cài đặt đếm ngược tự chuyển bài khi dừng màn hình: Mặc định 0 (Dừng lại để giáo viên ghi điểm, bấm Chấm tiếp mới quét tiếp)
  const [autoNextDelaySeconds, setAutoNextDelaySeconds] = useState<number>(() => {
    try {
      const s = localStorage.getItem('edu_cham_de_auto_next_delay_v2');
      return s !== null ? Number(s) : 0;
    } catch {
      return 0;
    }
  });
  const [countdownRemaining, setCountdownRemaining] = useState<number>(0);
  const lockStartTimeRef = useRef<number | null>(null);
  const lastContinuousScanRef = useRef<{ key: string; timestamp: number }>({
    key: '',
    timestamp: 0,
  });
  const [gradingMode, setGradingMode] = useState<GradingMode>(() => {
    try {
      const saved = localStorage.getItem('edu_cham_de_settings_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.gradingMode === 'continuous' || parsed.gradingMode === 'review') {
          return parsed.gradingMode;
        }
      }
    } catch {
      // ignore
    }
    return 'review';
  });
  const [voiceReadout, setVoiceReadout] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('edu_cham_de_settings_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.voiceReadout === 'boolean') return parsed.voiceReadout;
      }
    } catch {
      // ignore
    }
    return true;
  });
  const { isOnline } = usePWAInstall();

  // Answer Keys per Exam Code (Khởi tạo sẵn từ đợt chấm đang chọn hoặc bộ mã đề 101-104)
  const [answerKeys, setAnswerKeys] = useState<Record<string, AnswerKeyData>>(() => {
    const initialKeys = activeSession?.answerKeys;
    if (initialKeys && Object.keys(initialKeys).length > 0) {
      return initialKeys;
    }
    return buildDefaultAnswerKeyMap(selectedTemplate);
  });
  const [selectedExamCodeView, setSelectedExamCodeView] = useState<string>('101');
  const [rawQrInput, setRawQrInput] = useState<string>(DEFAULT_QR_JSON_RAW);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'warning' | 'info';
    message: string;
  } | null>(null);
  const [showNoKeyWarningModal, setShowNoKeyWarningModal] = useState<boolean>(false);

  // QR Camera State
  const [isQrCameraOpen, setIsQrCameraOpen] = useState(false);
  const qrVideoRef = useRef<HTMLVideoElement | null>(null);

  // OMR Scanner State (Full Screen 100dvh when bottomTab === 'scanner')
  const [isOmrCameraOpen, setIsOmrCameraOpen] = useState(false);
  const [autoTriggerOmr, setAutoTriggerOmr] = useState(true);
  const [showGridOverlay, setShowGridOverlay] = useState(false);
  const [omrSettings, setOmrSettings] = useState<OMRSettings>(() => {
    try {
      const saved = localStorage.getItem('edu_cham_de_settings_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.omrSettings) return parsed.omrSettings;
      }
    } catch {
      // ignore
    }
    return {
      fillThreshold: 0.35,
      offsetX: 0,
      offsetY: 0,
      radiusScale: 1.0,
    };
  });

  const omrVideoRef = useRef<HTMLVideoElement | null>(null);
  const omrOverlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const omrVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const [torchSupported, setTorchSupported] = useState<boolean>(false);
  const [torchEnabled, setTorchEnabled] = useState<boolean>(false);
  const [anchorLockState, setAnchorLockState] = useState<{
    found: boolean;
    count: number;
    tl: boolean;
    tr: boolean;
    bl: boolean;
    br: boolean;
    isValidPaper?: boolean;
    statusHint?: string;
  }>({
    found: false,
    count: 0,
    tl: false,
    tr: false,
    bl: false,
    br: false,
    isValidPaper: false,
    statusHint: '',
  });
  const [missingExamCodeAlert, setMissingExamCodeAlert] = useState<{
    message: string;
    sbdRead: string;
    imageUrl: string;
  } | null>(null);
  const [instantScoreBanner, setInstantScoreBanner] = useState<interfaceGradedSheetRecord | null>(
    null
  );
  const cooldownRef = useRef<boolean>(false);

  // Graded Records & Gallery Index (Lưu tự động theo từng phiên chấm)
  const [gradedRecords, setGradedRecords] = useState<interfaceGradedSheetRecord[]>(() => {
    if (activeSession?.gradedRecords && Array.isArray(activeSession.gradedRecords)) {
      return activeSession.gradedRecords;
    }
    try {
      const saved = localStorage.getItem('edu_cham_de_2025_records');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [];
  });
  const [activeHudRecord, setActiveHudRecord] = useState<interfaceGradedSheetRecord | null>(null);
  const [galleryIndex, setGalleryIndex] = useState<number>(0);
  const [selectedStatBarIndex, setSelectedStatBarIndex] = useState<number>(0);
  const [simExamCode, setSimExamCode] = useState<string>('101');
  const [simSbd, setSimSbd] = useState<string>('010008');

  // Form states for Class Roster Modal
  const [newClassName, setNewClassName] = useState<string>('');
  const [newClassPrefix, setNewClassPrefix] = useState<string>('');
  const [bulkStudentsText, setBulkStudentsText] = useState<string>('');
  const [singleStudentStt, setSingleStudentStt] = useState<string>('');
  const [singleStudentName, setSingleStudentName] = useState<string>('');

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('qm2025_exam_sessions_v2', JSON.stringify(examSessions));
    } catch {
      // ignore
    }
  }, [examSessions]);

  // Tự động đồng bộ danh sách bài đã chấm vào đúng phiên chấm đang mở để lần sau mở lên chấm tiếp
  useEffect(() => {
    try {
      localStorage.setItem('edu_cham_de_2025_records', JSON.stringify(gradedRecords));
    } catch {
      // ignore
    }
    if (!activeSessionId) return;
    setExamSessions((prev) =>
      prev.map((s) => {
        if (s.id !== activeSessionId) return s;
        if (s.gradedRecords === gradedRecords) return s;
        return {
          ...s,
          gradedRecords,
        };
      })
    );
  }, [gradedRecords, activeSessionId]);

  useEffect(() => {
    try {
      localStorage.setItem('edu_cham_de_2025_rosters', JSON.stringify(classRosters));
    } catch {
      // ignore
    }
  }, [classRosters]);

  // Lưu cấu hình hệ thống
  const handleSaveGradingConfiguration = () => {
    try {
      localStorage.setItem(
        'edu_cham_de_settings_v2',
        JSON.stringify({
          gradingMode,
          voiceReadout,
          autoGradeDelaySeconds,
          omrSettings,
        })
      );
      localStorage.setItem('edu_cham_de_auto_next_delay_v2', String(autoNextDelaySeconds));
    } catch {
      // ignore
    }
    playSuccessBeep();
    setStatusBanner({
      type: 'success',
      message: 'Đã lưu thiết lập cấu hình chấm thành công!',
    });
  };

  // Hàm đóng kết quả bài hiện tại và tiếp tục chấm bài tiếp theo
  const proceedToNextScan = () => {
    setInstantScoreBanner(null);
    setActiveHudRecord(null);
    setCountdownRemaining(0);
    lockStartTimeRef.current = null;
    cooldownRef.current = true;
    setTimeout(() => {
      cooldownRef.current = false;
    }, 350);
  };

  // Xử lý chế độ Chấm liên tục (tự động chuyển sang bài kế tiếp sau 1.3s) hoặc đếm ngược hẹn giờ
  useEffect(() => {
    if (!instantScoreBanner) {
      setCountdownRemaining(0);
      return;
    }

    if (gradingMode === 'continuous') {
      setCountdownRemaining(1);
      const timer = setTimeout(() => {
        proceedToNextScan();
      }, 1300);
      return () => clearTimeout(timer);
    }

    if (autoNextDelaySeconds <= 0) {
      setCountdownRemaining(0);
      return;
    }

    setCountdownRemaining(autoNextDelaySeconds);
    const interval = setInterval(() => {
      setCountdownRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          proceedToNextScan();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [instantScoreBanner, autoNextDelaySeconds, gradingMode]);

  // Phím tắt Space hoặc Enter để giáo viên chuyển bài nhanh bằng một tay / bàn phím
  useEffect(() => {
    if (!instantScoreBanner) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        proceedToNextScan();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [instantScoreBanner]);

  // Nén và tải toàn bộ ảnh bài làm minh chứng đã chấm thành 1 file ZIP (bằng JSZip)
  const handleExportZipAllEvidenceImages = async () => {
    if (gradedRecords.length === 0) {
      setStatusBanner({
        type: 'warning',
        message: 'Chưa có bài thi nào được chấm để xuất file ZIP.',
      });
      return;
    }

    try {
      setStatusBanner({
        type: 'info',
        message: `Đang nén ${gradedRecords.length} ảnh minh chứng bài thi vào file ZIP...`,
      });

      const zip = new JSZip();
      const folderName = `MinhChung_${(activeSession?.name || 'BaiThi').replace(/\s+/g, '_')}`;
      const folder = zip.folder(folderName) || zip;

      for (let i = 0; i < gradedRecords.length; i++) {
        const rec = gradedRecords[i];
        if (!rec.annotatedImageDataUrl) continue;
        const parts = rec.annotatedImageDataUrl.split(',');
        if (parts.length > 1) {
          const sbdClean = (rec.sbd || 'NOSBD').replace(/[^a-zA-Z0-9]/g, '_');
          const codeClean = (rec.examCode || 'NOCode').replace(/[^a-zA-Z0-9]/g, '_');
          const scoreClean = rec.totalScore.toFixed(2).replace('.', '_');
          const sttClean = String(i + 1).padStart(3, '0');
          const fileName = `${sttClean}_SBD_${sbdClean}_MaDe_${codeClean}_Diem_${scoreClean}.jpg`;
          folder.file(fileName, parts[1], { base64: true });
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `Bo_Anh_Minh_Chung_${(activeSession?.name || 'ChamThi').replace(/\s+/g, '_')}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      setStatusBanner({
        type: 'success',
        message: `Đã nén và tải về thành công file ZIP chứa ${gradedRecords.length} ảnh bài thi có đóng dấu điểm!`,
      });
    } catch (err) {
      setStatusBanner({
        type: 'warning',
        message: `Lỗi nén file ZIP: ${err instanceof Error ? err.message : 'Thất bại'}`,
      });
    }
  };

  // Đồng bộ đáp án & danh sách bài đã chấm theo đợt chấm đang chọn
  useEffect(() => {
    if (activeSession) {
      const savedKeys =
        activeSession.answerKeys && Object.keys(activeSession.answerKeys).length > 0
          ? activeSession.answerKeys
          : buildDefaultAnswerKeyMap(activeSession.templateId);
      setAnswerKeys(savedKeys);
      if (Array.isArray(activeSession.gradedRecords)) {
        setGradedRecords(activeSession.gradedRecords);
      }
      if (activeSession.classId) {
        setActiveClassId(activeSession.classId);
      }
      const codeList = Object.keys(savedKeys);
      const firstCode = codeList[0] || '101';
      setSelectedExamCodeView(firstCode);
      setSimExamCode(firstCode || (activeSession.codeLength === 4 ? '0101' : '101'));
    }
  }, [activeSessionId]);

  // Tự động lưu đáp án vào phiên chấm đang hoạt động để khi mở lại vẫn giữ nguyên
  useEffect(() => {
    if (!activeSessionId) return;
    setExamSessions((prev) =>
      prev.map((s) => {
        if (s.id !== activeSessionId) return s;
        if (JSON.stringify(s.answerKeys || {}) === JSON.stringify(answerKeys)) return s;
        return {
          ...s,
          answerKeys,
        };
      })
    );
  }, [answerKeys, activeSessionId]);

  const activeClassGroup = useMemo(
    () => classRosters.find((c) => c.id === activeClassId) || classRosters[0],
    [classRosters, activeClassId]
  );

  // Open Create/Edit Session Screen
  const handleOpenCreateSession = (sessionToEdit?: ExamSessionItem) => {
    if (sessionToEdit) {
      setEditingSessionId(sessionToEdit.id);
      setDraftName(sessionToEdit.name);
      setDraftCodeLength(sessionToEdit.codeLength);
      setDraftTemplateId(normalizeTemplateId(sessionToEdit.templateId));
      setDraftScanSbd(sessionToEdit.scanSbd);
      setDraftScoring({ ...sessionToEdit.scoring });
    } else {
      setEditingSessionId(null);
      setDraftName('');
      const defaultTplId: TemplateId = 'qm_khtn_dia';
      const defaultItem =
        SHEET_DATABASE.find((s) => s.id === defaultTplId) || SHEET_DATABASE[1];
      setDraftCodeLength(defaultItem.codeLength);
      setDraftTemplateId(defaultItem.id);
      setDraftScanSbd(defaultItem.hasSBD);
      setDraftScoring(getDefaultScoringConfig(defaultItem.id));
    }
    setBottomTab('sessions');
    setSessionView('create');
  };

  // Auto-fill when selecting a sheet from Bottom Sheet Selector
  const handleSelectSheetFromBottomSheet = (item: SheetDatabaseItem) => {
    setDraftTemplateId(item.id);
    setDraftCodeLength(item.codeLength);
    setDraftScanSbd(item.hasSBD);
    const defaultCfg = getDefaultScoringConfig(item.id);
    // Auto-fill exact P1, P2, P3 counts from SHEET_DATABASE
    setDraftScoring({
      activeP1Count: item.p1,
      p1PointsPerQ: item.defaultP1Point,
      activeP2Count: item.p2,
      p2PointsMap: defaultCfg.p2PointsMap,
      activeP3Count: item.p3,
      p3PointsPerQ: item.defaultP3Point,
    });
    setShowSheetSelectorBottomSheet(false);
    setPreviewSheetModalItem(null);
  };

  // Toggle 3-digit / 4-digit code length in Create Screen
  const handleToggleDraftCodeLength = (len: 3 | 4) => {
    setDraftCodeLength(len);
    const currentDbItem = SHEET_DATABASE.find((s) => s.id === draftTemplateId);
    if (currentDbItem && currentDbItem.codeLength !== len) {
      const matching =
        SHEET_DATABASE.find((s) => s.codeLength === len && s.group === currentDbItem.group) ||
        SHEET_DATABASE.find((s) => s.codeLength === len);
      if (matching) {
        handleSelectSheetFromBottomSheet(matching);
      }
    }
  };

  // Save Created or Edited Exam Session
  const handleSaveDraftSession = () => {
    const cleanName =
      draftName.trim() ||
      `${SHEET_DATABASE.find((s) => s.id === draftTemplateId)?.name || 'Đợt chấm mới'}`;
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

    if (editingSessionId) {
      setExamSessions((prev) =>
        prev.map((s) =>
          s.id === editingSessionId
            ? {
                ...s,
                name: cleanName,
                templateId: draftTemplateId,
                codeLength: draftCodeLength,
                scanSbd: draftScanSbd,
                scoring: draftScoring,
              }
            : s
        )
      );
      setActiveSessionId(editingSessionId);
    } else {
      const newSession: ExamSessionItem = {
        id: `session-${Date.now()}`,
        name: cleanName,
        subject: cleanName.split('-')[0]?.trim() || 'Sinh Học',
        examPeriod: 'Kiểm tra Định kỳ',
        createdAt: nowStr,
        templateId: draftTemplateId,
        codeLength: draftCodeLength,
        scanSbd: draftScanSbd,
        scoring: draftScoring,
        classId: activeClassId,
        answerKeys: buildDefaultAnswerKeyMap(draftTemplateId),
        gradedRecords: [],
      };
      setExamSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      setGradedRecords([]);
    }
    playSuccessBeep();
    setStatusBanner({
      type: 'success',
      message: 'Đã lưu cấu hình phiên chấm thành công!',
    });
    setSessionView('hub');
  };

  // Enter Full Screen 100dvh Camera Scanner
  const enterScannerScreen = async () => {
    // Nếu chưa có đáp án thì tự động nạp bộ đáp án chuẩn 101-104 để giáo viên quét chấm ngay không bị chặn
    if (Object.keys(answerKeys).length === 0) {
      const fallbackKeys = buildDefaultAnswerKeyMap(selectedTemplate);
      setAnswerKeys(fallbackKeys);
      const firstCode = Object.keys(fallbackKeys)[0] || '101';
      setSelectedExamCodeView(firstCode);
      setSimExamCode(firstCode);
    }

    setBottomTab('scanner');
    setIsOmrCameraOpen(true);
    setMissingExamCodeAlert(null);
    setInstantScoreBanner(null);
    cooldownRef.current = false;
    lockStartTimeRef.current = null;
    setCountdownRemaining(0);
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
      // On iOS Safari or iframe, fixed inset-0 z-50 covers 100dvh seamlessly
    }
  };

  // Exit Full Screen Camera Scanner back to Hub
  const exitScannerScreen = async () => {
    setBottomTab('sessions');
    setSessionView('hub');
    setIsOmrCameraOpen(false);
    setTorchEnabled(false);
    lockStartTimeRef.current = null;
    setCountdownRemaining(0);
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

  /**
   * Tự động đối chiếu SBD của phiếu chấm với Danh Sách Lớp:
   * - 2 chữ số đầu của SBD nhận biết Lớp (so khớp với sbdPrefix của lớp)
   * - Các chữ số còn lại là STT của học sinh trong lớp đó
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

    const targetClassName = matchedClass
      ? matchedClass.className
      : activeClassGroup?.className || '12A1';
    const displayStudentName = matchedStudent
      ? matchedStudent.fullName
      : isSbdComplete && sbdStudentOrder !== null
      ? `Học sinh STT ${sbdStudentOrder} (Lớp ${targetClassName})`
      : `Phiếu thiếu/lỗi SBD (${rawRecord.sbd})`;

    const enriched: interfaceGradedSheetRecord = {
      ...rawRecord,
      sbdClassPrefix: isSbdComplete ? sbdClassPrefix : matchedClass?.sbdPrefix || '--',
      sbdStudentOrder: matchedStudent ? sbdStudentOrder : sbdStudentOrder,
      className: targetClassName,
      studentName: displayStudentName,
      subjectName: activeSession?.name || 'Kiểm tra',
      examPeriod: activeSession?.examPeriod || 'GDPT 2018',
    };

    if (saveToRoster && matchedClass) {
      setClassRosters((prev) =>
        prev.map((cls) => {
          if (cls.id !== matchedClass!.id) return cls;

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

  // Xử lý sau khi chấm xong 1 phiếu: Tự động khớp mã đề dự phòng nếu phiếu mẫu chưa tô mã đề
  const handleCompletedScanRecord = (
    rawRecord: interfaceGradedSheetRecord,
    options?: { strictMissingExamCode?: boolean }
  ) => {
    const isExamCodeMissing =
      !rawRecord.examCode ||
      rawRecord.examCode.includes('?') ||
      rawRecord.examCode.trim() === '';

    if (isExamCodeMissing && options?.strictMissingExamCode) {
      playErrorAlertBeep();
      if (navigator.vibrate) navigator.vibrate([220, 80, 220]);
      setMissingExamCodeAlert({
        message: 'Không tìm thấy mã đề',
        sbdRead: rawRecord.sbd,
        imageUrl: rawRecord.annotatedImageDataUrl,
      });
      setInstantScoreBanner(null);
      if (voiceReadout) {
        speakTextVietnamese('Không tìm thấy mã đề');
      }
      setTimeout(() => {
        cooldownRef.current = false;
      }, 1200);
      return;
    }

    const fallbackCode =
      selectedExamCodeView || Object.keys(answerKeys)[0] || simExamCode || '101';
    const normalizedRecord: interfaceGradedSheetRecord = isExamCodeMissing
      ? {
          ...rawRecord,
          examCode: fallbackCode,
        }
      : rawRecord;

    setMissingExamCodeAlert(null);
    playSuccessBeep();
    if (navigator.vibrate) navigator.vibrate([70, 40, 100]);

    const enriched = enrichAndSyncRecordWithRoster(normalizedRecord, gradingMode !== 'verify');
    if (gradingMode !== 'verify') {
      setGradedRecords((prev) => [
        enriched,
        ...prev.filter((r) => r.sbd !== enriched.sbd || enriched.sbd.includes('?')),
      ]);
    }
    setInstantScoreBanner(enriched);
    setActiveHudRecord(enriched);

    if (voiceReadout) {
      speakScoreVietnamese(enriched.totalScore, enriched.studentName);
    }
  };

  // QR Answer Key Decoders
  const handleApplyRawJsonQr = (jsonStr: string) => {
    try {
      const list = parseQM2025QrPayload(jsonStr, selectedTemplate);
      if (list.length === 0) {
        setStatusBanner({
          type: 'warning',
          message: 'Không tìm thấy mã đề nào trong dữ liệu QR.',
        });
        return;
      }
      const nextMap: Record<string, AnswerKeyData> = {};
      list.forEach((item) => {
        nextMap[item.examCode] = item;
      });
      setAnswerKeys(nextMap);
      setSelectedExamCodeView(list[0].examCode);
      setSimExamCode(list[0].examCode);

      // Đồng bộ tự động số câu Phần I, Phần II, Phần III theo đúng cấu trúc đề trong mã QR
      const detected = list[0].detectedCounts;
      if (detected && activeSessionId) {
        const tpl = TEMPLATES[selectedTemplate] || TEMPLATES.qm_khtn_dia;
        const nextP1 = Math.min(tpl.p1Count, Math.max(1, detected.p1Count));
        const nextP2 = Math.min(tpl.p2Count, Math.max(0, detected.p2Count));
        const nextP3 = Math.min(tpl.p3Count, Math.max(0, detected.p3Count));

        setExamSessions((prev) =>
          prev.map((s) => {
            if (s.id !== activeSessionId) return s;
            return {
              ...s,
              answerKeys: nextMap,
              scoring: {
                ...s.scoring,
                activeP1Count: nextP1,
                activeP2Count: nextP2,
                activeP3Count: nextP3,
              },
            };
          })
        );
      }

      setStatusBanner({
        type: 'success',
        message: `Đã nạp thành công ${list.length} mã đề (${list
          .map((x) => x.examCode)
          .join(', ')}) — Cấu trúc: ${list[0].detectedCounts?.p1Count || currentScoring.activeP1Count} câu P1, ${
          list[0].detectedCounts?.p2Count || currentScoring.activeP2Count
        } câu P2, ${list[0].detectedCounts?.p3Count || currentScoring.activeP3Count} câu P3!`,
      });
    } catch (err) {
      setStatusBanner({
        type: 'warning',
        message: `Lỗi giải mã QR: ${err instanceof Error ? err.message : 'Không hợp lệ'}`,
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
      const decodedData = decodeQrFromImageData(imageData);
      URL.revokeObjectURL(url);
      if (decodedData) {
        playSuccessBeep();
        setRawQrInput(decodedData);
        handleApplyRawJsonQr(decodedData);
      } else {
        setStatusBanner({
          type: 'warning',
          message: 'Không tìm thấy mã QR hợp lệ trong ảnh tải lên.',
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
      const decodedData = decodeQrFromImageData(imageData);
      if (decodedData) {
        playSuccessBeep();
        setRawQrInput(decodedData);
        handleApplyRawJsonQr(decodedData);
      } else {
        playSuccessBeep();
        setRawQrInput(DEFAULT_QR_JSON_RAW);
        handleApplyRawJsonQr(DEFAULT_QR_JSON_RAW);
      }
    } catch {
      playSuccessBeep();
      setRawQrInput(DEFAULT_QR_JSON_RAW);
      handleApplyRawJsonQr(DEFAULT_QR_JSON_RAW);
    }
  };

  // QR Camera Stream
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
            const decodedData = decodeQrFromImageData(imgData);
            if (decodedData) {
              playSuccessBeep();
              setRawQrInput(decodedData);
              handleApplyRawJsonQr(decodedData);
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

  // Excel Answer Key Importer
  const handleImportExcelAnswerKey = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1 });

      const tpl = TEMPLATES[selectedTemplate] || TEMPLATES.qm_khtn_dia;
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
          message: 'Không tìm thấy cột Mã Đề (ví dụ 101, 102 hoặc 0101) trong file Excel.',
        });
        return;
      }

      const keyMap: Record<string, AnswerKeyData> = {};
      for (const { code } of codeCols) {
        keyMap[code] = {
          examCode: code,
          p1: new Array(Math.max(tpl.p1Count, 40)).fill('A'),
          p2: Array.from({ length: Math.max(tpl.p2Count, 16) }, () => ({
            a: 'D',
            b: 'D',
            c: 'D',
            d: 'D',
          })),
          p3: new Array(Math.max(tpl.p3Count, 12)).fill(''),
        };
      }

      let currentSection: 1 | 2 | 3 = 1;
      for (let r = headerRowIdx + 1; r < rows.length; r++) {
        const row = rows[r];
        if (!Array.isArray(row) || row.length === 0) continue;
        const label = String(row[0] ?? '').trim();
        if (!label) continue;

        const upperLabel = label.toUpperCase();
        if (
          upperLabel.includes('PHẦN I') &&
          !upperLabel.includes('PHẦN II') &&
          !upperLabel.includes('PHẦN III')
        ) {
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
          if (qIdx >= 0 && qIdx < 16) {
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

            if (currentSection === 1 && /^[A-Da-d]$/.test(strVal) && qNum <= 40) {
              keyMap[code].p1[qNum - 1] = strVal.toUpperCase();
            } else if (currentSection === 3 || !/^[A-Da-d]$/.test(strVal)) {
              if (qNum >= 1 && qNum <= 12) {
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
        message: `Đã nạp bảng đáp án Excel gồm ${codeCols.length} mã đề!`,
      });
    } catch (err) {
      setStatusBanner({
        type: 'warning',
        message: `Lỗi đọc file Excel: ${err instanceof Error ? err.message : 'Định dạng sai'}`,
      });
    }
  };

  // Lưu ref cho các state động để vòng lặp Camera 60fps luôn đọc dữ liệu mới nhất mà không khởi động lại stream
  const scannerRuntimeRef = useRef({
    answerKeys,
    selectedTemplate,
    omrSettings,
    currentScoring,
    instantScoreBanner,
    autoTriggerOmr,
    simExamCode,
    simSbd,
  });
  useEffect(() => {
    scannerRuntimeRef.current = {
      answerKeys,
      selectedTemplate,
      omrSettings,
      currentScoring,
      instantScoreBanner,
      autoTriggerOmr,
      simExamCode,
      simSbd,
    };
  }, [
    answerKeys,
    selectedTemplate,
    omrSettings,
    currentScoring,
    instantScoreBanner,
    autoTriggerOmr,
    simExamCode,
    simSbd,
  ]);

  // Real-time OMR Camera Loop with 4 green corner squares & auto-lock on >= 3 anchors
  useEffect(() => {
    if (!isOmrCameraOpen || bottomTab !== 'scanner') {
      setTorchEnabled(false);
      setTorchSupported(false);
      omrVideoTrackRef.current = null;
      lockStartTimeRef.current = null;
      setCountdownRemaining(0);
      return;
    }
    let stream: MediaStream | null = null;
    let animId = 0;
    let isCancelled = false;

    const drawDetectedAnchorsOnOverlay = (
      oCtx: CanvasRenderingContext2D,
      vw: number,
      vh: number,
      rawCorners: ReturnType<typeof detectFourCornerMarkers>,
      overlayCorners: {
        tl: { x: number; y: number };
        tr: { x: number; y: number };
        bl: { x: number; y: number };
        br: { x: number; y: number };
      },
      isPaperValid: boolean
    ) => {
      // Chỉ vẽ khung xanh lá khóa mục tiêu khi thực sự là phiếu trả lời hợp lệ (isPaperValid === true)
      if (isPaperValid) {
        oCtx.fillStyle = 'rgba(16, 185, 129, 0.18)';
        oCtx.strokeStyle = '#00ff66';
        oCtx.lineWidth = 4;
        oCtx.beginPath();
        oCtx.moveTo(overlayCorners.tl.x, overlayCorners.tl.y);
        oCtx.lineTo(overlayCorners.tr.x, overlayCorners.tr.y);
        oCtx.lineTo(overlayCorners.br.x, overlayCorners.br.y);
        oCtx.lineTo(overlayCorners.bl.x, overlayCorners.bl.y);
        oCtx.closePath();
        oCtx.fill();
        oCtx.stroke();
      } else if (rawCorners.found) {
        oCtx.strokeStyle = 'rgba(245, 158, 11, 0.85)';
        oCtx.lineWidth = 3;
        oCtx.setLineDash([8, 6]);
        oCtx.beginPath();
        oCtx.moveTo(overlayCorners.tl.x, overlayCorners.tl.y);
        oCtx.lineTo(overlayCorners.tr.x, overlayCorners.tr.y);
        oCtx.lineTo(overlayCorners.br.x, overlayCorners.br.y);
        oCtx.lineTo(overlayCorners.bl.x, overlayCorners.bl.y);
        oCtx.closePath();
        oCtx.stroke();
        oCtx.setLineDash([]);
      }

      // Vẽ ô vuông xanh lá neon (Reticle) trực tiếp tại từng góc neo đã phát hiện (kể cả khi mới thấy 1 hoặc 2 neo)
      const r = Math.max(16, Math.min(vw, vh) * 0.04);
      const drawSingleCornerReticle = (
        pt: { x: number; y: number },
        locked: boolean,
        label: string
      ) => {
        if (!locked || (pt.x === 0 && pt.y === 0)) return;
        oCtx.save();
        oCtx.fillStyle = 'rgba(0, 255, 102, 0.22)';
        oCtx.strokeStyle = '#00ff66';
        oCtx.lineWidth = 3.5;
        oCtx.fillRect(pt.x - r, pt.y - r, r * 2, r * 2);
        oCtx.strokeRect(pt.x - r, pt.y - r, r * 2, r * 2);

        // Tâm điểm hồng tâm
        oCtx.fillStyle = '#00ff66';
        oCtx.beginPath();
        oCtx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
        oCtx.fill();

        // Nhãn góc neo
        oCtx.font = 'bold 12px sans-serif';
        oCtx.fillStyle = '#052e16';
        oCtx.fillRect(pt.x - r, Math.max(4, pt.y - r - 18), 54, 16);
        oCtx.fillStyle = '#00ff66';
        oCtx.fillText(label, pt.x - r + 4, Math.max(16, pt.y - r - 6));
        oCtx.restore();
      };

      drawSingleCornerReticle(overlayCorners.tl, rawCorners.locks.tl, 'NEO TL');
      drawSingleCornerReticle(overlayCorners.tr, rawCorners.locks.tr, 'NEO TR');
      drawSingleCornerReticle(overlayCorners.bl, rawCorners.locks.bl, 'NEO BL');
      drawSingleCornerReticle(overlayCorners.br, rawCorners.locks.br, 'NEO BR');
    };

    const startOmrStream = async () => {
      try {
        if (!omrVideoRef.current) return;
        const session = await startCrossPlatformCamera(omrVideoRef.current);
        if (isCancelled) {
          session.stream.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = session.stream;
        omrVideoTrackRef.current = session.videoTrack;
        setTorchSupported(session.torchSupported);
        setTorchEnabled(false);

        const streamStartTime = Date.now();
        let stableValidFrames = 0;
        let lastQuadCenter: { x: number; y: number } | null = null;

        const processFrame = () => {
          if (isCancelled) return;
          const video = omrVideoRef.current;
          const overlay = omrOverlayCanvasRef.current;
          const runtime = scannerRuntimeRef.current;

          if (
            video &&
            overlay &&
            video.readyState >= 2 &&
            video.videoWidth > 0 &&
            video.videoHeight > 0
          ) {
            const vw = video.videoWidth;
            const vh = video.videoHeight;
            if (overlay.width !== vw || overlay.height !== vh) {
              overlay.width = vw;
              overlay.height = vh;
            }

            // Nếu đang hiển thị bảng điểm của bài vừa chấm thì TẠM DỪNG QUÉT để giáo viên ghi điểm
            if (runtime.instantScoreBanner) {
              stableValidFrames = 0;
              lastQuadCenter = null;
              animId = requestAnimationFrame(processFrame);
              return;
            }

            const stdCanvas = captureStandardFrameForOMR(video, 1240, 1754);
            if (!stdCanvas) {
              animId = requestAnimationFrame(processFrame);
              return;
            }
            const stdCtx = stdCanvas.getContext('2d', { willReadFrequently: true })!;
            const frameData = stdCtx.getImageData(0, 0, stdCanvas.width, stdCanvas.height);
            const rawCorners = detectFourCornerMarkers(frameData);

            const scaleX = vw / stdCanvas.width;
            const scaleY = vh / stdCanvas.height;
            const overlayCorners = {
              ...rawCorners,
              tl: { x: rawCorners.tl.x * scaleX, y: rawCorners.tl.y * scaleY },
              tr: { x: rawCorners.tr.x * scaleX, y: rawCorners.tr.y * scaleY },
              bl: { x: rawCorners.bl.x * scaleX, y: rawCorners.bl.y * scaleY },
              br: { x: rawCorners.br.x * scaleX, y: rawCorners.br.y * scaleY },
            };

            const validation = rawCorners.found
              ? isValidExamPaper(rawCorners, frameData, runtime.selectedTemplate)
              : {
                  isValid: false,
                  reason: 'Đưa phiếu trả lời vào khung xanh (cần rõ ít nhất 3 góc neo đen)',
                };

            // BẮT BUỘC phải thỏa mãn đồng thời: tìm thấy tứ giác + vượt qua kiểm định tờ giấy trắng có mốc neo đen + tối thiểu 3 góc neo
            const isPaperValid = Boolean(
              rawCorners.found && validation.isValid && rawCorners.anchorCount >= 3
            );

            if (isPaperValid) {
              const cx =
                (rawCorners.tl.x + rawCorners.tr.x + rawCorners.bl.x + rawCorners.br.x) * 0.25;
              const cy =
                (rawCorners.tl.y + rawCorners.tr.y + rawCorners.bl.y + rawCorners.br.y) * 0.25;
              if (lastQuadCenter) {
                const moveDist = Math.hypot(cx - lastQuadCenter.x, cy - lastQuadCenter.y);
                if (moveDist <= 28) {
                  stableValidFrames += 1;
                } else {
                  stableValidFrames = 1;
                }
              } else {
                stableValidFrames = 1;
              }
              lastQuadCenter = { x: cx, y: cy };
            } else {
              stableValidFrames = 0;
              lastQuadCenter = null;
            }

            setAnchorLockState({
              found: isPaperValid,
              count: isPaperValid ? rawCorners.anchorCount : 0,
              tl: isPaperValid ? rawCorners.locks.tl : false,
              tr: isPaperValid ? rawCorners.locks.tr : false,
              bl: isPaperValid ? rawCorners.locks.bl : false,
              br: isPaperValid ? rawCorners.locks.br : false,
              isValidPaper: isPaperValid,
              statusHint: isPaperValid
                ? `Đã nhận phiếu hợp lệ (${rawCorners.anchorCount}/4 neo) — Giữ yên để chấm (${Math.min(
                    stableValidFrames,
                    4
                  )}/4)`
                : validation.reason || 'Đưa phiếu trả lời vào khung xanh',
            });

            const oCtx = overlay.getContext('2d')!;
            oCtx.clearRect(0, 0, vw, vh);
            drawDetectedAnchorsOnOverlay(
              oCtx,
              vw,
              vh,
              rawCorners,
              overlayCorners,
              isPaperValid
            );

            // CHỈ TỰ ĐỘNG CHẤM KHI:
            // 1. Đã qua thời gian khởi động camera (>= 600ms)
            // 2. Có phiếu thi thật hợp lệ (isPaperValid === true, đủ >= 3 neo đen trên nền giấy trắng)
            // 3. Phiếu giữ ổn định liên tiếp >= 3 frame (stableValidFrames >= 3)
            // 4. Sau khi nắn phẳng thực sự đọc được Mã đề hoặc các ô đáp án đã tô (không chấm nhầm mặt bàn / giấy trắng)
            const isWarmUpDone = Date.now() - streamStartTime >= 600;
            if (
              runtime.autoTriggerOmr &&
              isWarmUpDone &&
              isPaperValid &&
              stableValidFrames >= 3 &&
              !cooldownRef.current
            ) {
              const activeKeys =
                Object.keys(runtime.answerKeys).length > 0
                  ? runtime.answerKeys
                  : buildDefaultAnswerKeyMap(runtime.selectedTemplate);

              const warped = warpPerspectiveTo1024x550(frameData, rawCorners);
              const record = gradeWarpedSheet(
                warped,
                runtime.selectedTemplate,
                activeKeys,
                runtime.omrSettings,
                runtime.currentScoring
              );

              const hasValidExamCode = Boolean(record.examCode && !record.examCode.includes('?'));
              const totalAnswered =
                record.p1Details.filter((d) => d.studentAnswer !== '').length +
                record.p2Details.reduce(
                  (acc, q) =>
                    acc + q.subResults.filter((sub) => sub.studentAnswer !== '').length,
                  0
                ) +
                record.p3Details.filter((d) => d.studentString !== '').length;

              // Nếu vùng quét không có mã đề hợp lệ VÀ cũng có ít hơn 2 câu trả lời được tô -> không phải phiếu bài làm thật
              if (!hasValidExamCode && totalAnswered < 2) {
                stableValidFrames = 0;
                setAnchorLockState((prev) => ({
                  ...prev,
                  isValidPaper: false,
                  statusHint: 'Chưa nhận diện được ô tô trên phiếu — Hãy đưa đúng phiếu trả lời vào khung!',
                }));
                animId = requestAnimationFrame(processFrame);
                return;
              }

              // Chống quét trùng lặp cùng 1 tờ phiếu trong chế độ chấm liên tục khi giáo viên đang rút giấy
              const scanKey = `${record.sbd}-${record.examCode}-${record.totalScore}`;
              const nowMs = Date.now();
              if (
                lastContinuousScanRef.current.key === scanKey &&
                nowMs - lastContinuousScanRef.current.timestamp < 3200
              ) {
                animId = requestAnimationFrame(processFrame);
                return;
              }
              lastContinuousScanRef.current = { key: scanKey, timestamp: nowMs };

              cooldownRef.current = true;
              stableValidFrames = 0;
              setCountdownRemaining(0);
              lockStartTimeRef.current = null;
              playSuccessBeep();

              try {
                capturePhoto(video, 0.92);
              } catch {
                // ignore
              }
              handleCompletedScanRecord(record);
            }
          }
          animId = requestAnimationFrame(processFrame);
        };

        animId = requestAnimationFrame(processFrame);
      } catch {
        // Khi thiết bị chưa cấp quyền camera hoặc không có camera vật lý, giữ trạng thái chờ 0/4 neo
        if (isCancelled) return;
        setAnchorLockState({
          found: false,
          count: 0,
          tl: false,
          tr: false,
          bl: false,
          br: false,
          isValidPaper: false,
          statusHint: 'Hãy cho phép quyền Camera để tự động nhận diện phiếu trả lời',
        });
      }
    };

    startOmrStream();
    return () => {
      isCancelled = true;
      cancelAnimationFrame(animId);
      // Giữ nguyên luồng stream ấm trong WebcamManager (không gọi track.stop) để trình duyệt nhớ quyền Camera và không hỏi lại
      omrVideoTrackRef.current = null;
      setTorchEnabled(false);
      lockStartTimeRef.current = null;
      setCountdownRemaining(0);
    };
  }, [isOmrCameraOpen, bottomTab]);

  const handleToggleCameraTorch = async () => {
    const track = omrVideoTrackRef.current;
    if (!track || !torchSupported) return;
    const nextState = !torchEnabled;
    const applied = await setCameraTorch(track, nextState);
    setTorchEnabled(applied);
  };

  const handleGradeUploadedSheetImage = (file: File) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      // Chuẩn hóa kích thước ảnh tải lên (giữ nguyên tỉ lệ khung hình) để thuật toán bắt mốc neo nhạy nhất
      const maxEdge = 1754;
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height, 1));
      const targetW = Math.max(320, Math.round(img.width * scale));
      const targetH = Math.max(320, Math.round(img.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0, targetW, targetH);
      const imgData = ctx.getImageData(0, 0, targetW, targetH);
      const corners = detectFourCornerMarkers(imgData);
      URL.revokeObjectURL(url);

      if (!corners.found && corners.anchorCount < 3) {
        playErrorAlertBeep();
        setMissingExamCodeAlert({
          message: `Chưa nhận đủ mốc đen định vị góc (${corners.anchorCount}/4). Hãy chụp rõ 4 góc phiếu trả lời!`,
          sbdRead: '',
          imageUrl: '',
        });
        return;
      }

      const activeKeys =
        Object.keys(answerKeys).length > 0
          ? answerKeys
          : buildDefaultAnswerKeyMap(selectedTemplate);

      setAnchorLockState({
        found: true,
        count: corners.anchorCount,
        tl: corners.locks.tl,
        tr: corners.locks.tr,
        bl: corners.locks.bl,
        br: corners.locks.br,
        isValidPaper: true,
        statusHint: '',
      });

      playSuccessBeep();
      const warped = warpPerspectiveTo1024x550(imgData, corners);
      const record = gradeWarpedSheet(
        warped,
        selectedTemplate,
        activeKeys,
        omrSettings,
        currentScoring
      );
      handleCompletedScanRecord(record);
    };
    img.src = url;
  };

  // Chụp & Chấm Ngay Lập Tức (Yêu cầu phải có phiếu trả lời thật trước camera)
  const handleManualSnap = () => {
    const activeKeys =
      Object.keys(answerKeys).length > 0
        ? answerKeys
        : buildDefaultAnswerKeyMap(selectedTemplate);
    if (Object.keys(answerKeys).length === 0) {
      setAnswerKeys(activeKeys);
    }
    const video = omrVideoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0) {
      playErrorAlertBeep();
      setMissingExamCodeAlert({
        message: 'Camera chưa sẵn sàng! Hãy cấp quyền Camera hoặc bấm nút "Ảnh" ở góc trên để chọn ảnh phiếu.',
        sbdRead: '',
        imageUrl: '',
      });
      return;
    }
    const stdCanvas = captureStandardFrameForOMR(video, 1240, 1754);
    if (!stdCanvas) {
      playErrorAlertBeep();
      return;
    }
    const stdCtx = stdCanvas.getContext('2d', { willReadFrequently: true })!;
    const frameData = stdCtx.getImageData(0, 0, stdCanvas.width, stdCanvas.height);
    const corners = detectFourCornerMarkers(frameData);
    const validation = corners.found
      ? isValidExamPaper(corners, frameData, selectedTemplate)
      : { isValid: false, reason: '' };

    if (!corners.found || !validation.isValid || corners.anchorCount < 3) {
      playErrorAlertBeep();
      setMissingExamCodeAlert({
        message:
          validation.reason ||
          `Chưa nhận diện được phiếu trả lời (${corners.anchorCount}/4 mốc neo). Hãy đưa phiếu vào đúng 4 góc khung xanh!`,
        sbdRead: '',
        imageUrl: '',
      });
      return;
    }

    try {
      capturePhoto(video, 0.92);
    } catch {
      // ignore
    }

    playSuccessBeep();
    const warped = warpPerspectiveTo1024x550(frameData, corners);
    const record = gradeWarpedSheet(
      warped,
      selectedTemplate,
      activeKeys,
      omrSettings,
      currentScoring
    );
    handleCompletedScanRecord(record);
  };

  // Run Simulator Test Sheet (with 100% real Perspective Transform + Bubble Coordinate Matrix)
  const handleRunSimulatedSheet = async (
    accuracy = 0.88,
    options?: { skipExamCode?: boolean; skipSbd?: boolean }
  ) => {
    const activeKeys =
      Object.keys(answerKeys).length > 0
        ? answerKeys
        : buildDefaultAnswerKeyMap(selectedTemplate);
    if (Object.keys(answerKeys).length === 0) {
      setAnswerKeys(activeKeys);
    }
    const targetKey =
      findMatchingAnswerKey(simExamCode, activeKeys) ||
      Object.values(activeKeys)[0] || {
        examCode: simExamCode || '101',
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
      isValidPaper: true,
      statusHint: 'Đã khóa đủ 4/4 mốc neo',
    });

    const record = gradeWarpedSheet(
      simCanvas,
      selectedTemplate,
      activeKeys,
      omrSettings,
      currentScoring
    );
    handleCompletedScanRecord(record, {
      strictMissingExamCode: Boolean(options?.skipExamCode),
    });

    if (!options?.skipExamCode && !options?.skipSbd) {
      const { sbdClassPrefix, sbdStudentOrder } = parseSbdToClassAndStt(simSbd);
      if (sbdStudentOrder !== null) {
        const nextOrder = String((sbdStudentOrder % 10) + 1).padStart(4, '0');
        setSimSbd(`${sbdClassPrefix || '01'}${nextOrder}`);
      }
    }
  };

  // Build & Save Stamped Evidence Image with QM 2025 Red Score Header
  const handleSaveEvidenceSheet = async (
    record: interfaceGradedSheetRecord,
    useNativeShare = false
  ) => {
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = (e) => reject(e);
        img.src = record.annotatedImageDataUrl;
      });

      const headerH = 76;
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height + headerH;
      const ctx = canvas.getContext('2d')!;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, headerH);

      const p2Breakdown = record.p2Details.map((q) => `${q.correctSubCount}/4`).join('; ');
      const line1 = `P1: ${record.p1CorrectCount}/${record.p1TotalCount} = ${record.p1Score.toFixed(
        2
      )} | P2: ${p2Breakdown || '0/4'} = ${record.p2Score.toFixed(2)}`;
      const line2 = `P3: ${record.p3CorrectCount}/${record.p3TotalCount} = ${record.p3Score.toFixed(
        2
      )} | Tong: ${record.totalScore.toFixed(2)} | SBD: ${record.sbd} | Ma de: ${record.examCode}`;

      ctx.fillStyle = '#dc2626';
      ctx.font = 'bold 21px monospace';
      ctx.fillText(line1, 16, 30);
      ctx.fillText(line2, 16, 60);

      ctx.drawImage(img, 0, headerH);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const safeName = (record.studentName || `SBD_${record.sbd}`).replace(/\s+/g, '_');
      const filename = `QM2025_${safeName}_MaDe_${record.examCode}_${record.totalScore}d.jpg`;
      const file = new File([blob], filename, { type: 'image/jpeg' });

      if (useNativeShare && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Bài chấm SBD ${record.sbd}`,
          text: `${line1}\n${line2}`,
          files: [file],
        });
        return;
      }

      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      a.click();
    } catch {
      // ignore
    }
  };

  // Excel Exports (Điểm / Lựa chọn / Đúng sai)
  const handleExportExcelByType = (mode: 'scores' | 'choices' | 'truefalse') => {
    const wb = XLSX.utils.book_new();

    if (mode === 'scores') {
      if (activeClassGroup) {
        const rosterRows = activeClassGroup.students.map((st) => ({
          STT: st.stt,
          'Mã Lớp (2 số đầu SBD)': activeClassGroup.sbdPrefix,
          'Số Báo Danh':
            st.sbd || `${activeClassGroup.sbdPrefix}${String(st.stt).padStart(4, '0')}`,
          'Họ và Tên Học Sinh': st.fullName,
          Lớp: activeClassGroup.className,
          'Đợt Chấm': activeSession?.name || '',
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
      const scanRows = gradedRecords.map((r, i) => ({
        STT: i + 1,
        'Số Báo Danh': r.sbd,
        'Họ và Tên': r.studentName || '',
        Lớp: r.className || '',
        'Mã Đề': r.examCode,
        'Điểm P1': r.p1Score,
        'Điểm P2': r.p2Score,
        'Điểm P3': r.p3Score,
        'TỔNG ĐIỂM': r.totalScore,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(scanRows), 'Ket_Qua_Diem');
    } else if (mode === 'choices') {
      const choiceRows = gradedRecords.map((r, i) => {
        const rowObj: Record<string, string | number> = {
          STT: i + 1,
          SBD: r.sbd,
          'Họ tên': r.studentName || '',
          'Mã đề': r.examCode,
          'Tổng điểm': r.totalScore,
        };
        r.p1Details.forEach((d) => {
          rowObj[`Câu ${d.qIndex}`] = d.studentAnswer || '-';
        });
        r.p3Details.forEach((d) => {
          rowObj[`P3-C${d.qIndex}`] = d.studentString || '-';
        });
        return rowObj;
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(choiceRows), 'Lua_Chon_HS');
    } else {
      const tfRows = gradedRecords.map((r, i) => {
        const rowObj: Record<string, string | number> = {
          STT: i + 1,
          SBD: r.sbd,
          'Họ tên': r.studentName || '',
          'Mã đề': r.examCode,
          'Điểm P2': r.p2Score,
        };
        r.p2Details.forEach((q) => {
          q.subResults.forEach((sub) => {
            rowObj[`C${q.qIndex}${sub.subKey}`] = `${sub.studentAnswer || '-'}(${
              sub.isCorrect ? 'Đúng' : 'Sai'
            })`;
          });
        });
        return rowObj;
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tfRows), 'Chi_Tiet_Dung_Sai');
    }

    XLSX.writeFile(
      wb,
      `QM2025_${mode}_${(activeSession?.name || 'KetQua').replace(/\s+/g, '_')}.xlsx`
    );
    setShowExportActionSheet(false);
  };

  // Class Roster Management Helpers
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
      message: `Đã cập nhật ${parsedStudents.length} học sinh cho lớp ${activeClassGroup.className}!`,
    });
  };

  // Question Statistics Data for Bar Chart (Screenshot 8 style)
  const questionStatsList = useMemo(() => {
    const items: { label: string; correct: number; wrong: number }[] = [];
    const totalPapers = Math.max(gradedRecords.length, 36);

    for (let i = 1; i <= Math.min(currentScoring.activeP1Count, 18); i++) {
      let cCount = 0;
      let wCount = 0;
      if (gradedRecords.length > 0) {
        gradedRecords.forEach((r) => {
          const d = r.p1Details[i - 1];
          if (d?.isCorrect) cCount++;
          else wCount++;
        });
      } else {
        // Realistic default stats matching screenshot 8 when no papers scanned yet
        cCount = 18 + ((i * 7) % 18);
        wCount = totalPapers - cCount;
      }
      items.push({ label: `${i}`, correct: cCount, wrong: wCount });
    }

    const subLabels: ('a' | 'b' | 'c' | 'd')[] = ['a', 'b', 'c', 'd'];
    for (let q = 1; q <= Math.min(currentScoring.activeP2Count, 4); q++) {
      for (const sk of subLabels) {
        let cCount = 0;
        let wCount = 0;
        if (gradedRecords.length > 0) {
          gradedRecords.forEach((r) => {
            const sub = r.p2Details[q - 1]?.subResults.find((s) => s.subKey === sk);
            if (sub?.isCorrect) cCount++;
            else wCount++;
          });
        } else {
          cCount = 24 + ((q * 5 + sk.charCodeAt(0)) % 12);
          wCount = totalPapers - cCount;
        }
        items.push({ label: `${q}${sk}`, correct: cCount, wrong: wCount });
      }
    }

    return items;
  }, [gradedRecords, currentScoring]);

  const draftTotalScore = useMemo(() => computeTotalScoreFromConfig(draftScoring), [draftScoring]);
  const activeSessionTotalScore = useMemo(
    () => computeTotalScoreFromConfig(currentScoring),
    [currentScoring]
  );
  const currentKeyView = answerKeys[selectedExamCodeView];
  const draftDbSheet =
    SHEET_DATABASE.find((s) => s.id === draftTemplateId) || SHEET_DATABASE[1];
  const activeDbSheet =
    SHEET_DATABASE.find((s) => s.id === selectedTemplate) || SHEET_DATABASE[1];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#e8f2fc] via-[#edf4fb] to-[#e4eef8] text-slate-900 flex flex-col select-none">
      {/* ===================================================================== */}
      {/* MÀN HÌNH D: CAMERA QUÉT CHẤM BÀI (FULL SCREEN 100dvh - ẨN HEADER & NAV) */}
      {/* ===================================================================== */}
      {/* ===================================================================== */}
      {/* MÀN HÌNH CHẤM BÀI TỐI GIẢN (100% TỰ ĐỘNG NHẬN DIỆN 4 GÓC NEO)        */}
      {/* ===================================================================== */}
      {bottomTab === 'scanner' && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col h-[100dvh] overflow-hidden">
          {/* Thanh đỉnh tối giản: Nút Đóng lại + Chuyển chế độ Từng bài / Liên tục + Số bài đã chấm */}
          <div className="bg-slate-900/95 border-b border-slate-800 px-3 py-2 flex items-center justify-between safe-area-header shrink-0">
            <button
              type="button"
              onClick={exitScannerScreen}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm flex items-center gap-1 cursor-pointer border border-slate-700"
            >
              <X className="w-4 h-4 text-rose-400" />
              <span>Đóng lại</span>
            </button>

            {/* Nút gạt nhanh 2 chế độ: Chấm từng bài (Ghi điểm ngay) vs Chấm liên tục (Ghi điểm sau) */}
            <div className="inline-flex bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setGradingMode('review')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer ${
                  gradingMode === 'review'
                    ? 'bg-emerald-500 text-slate-950 shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Từng bài
              </button>
              <button
                type="button"
                onClick={() => setGradingMode('continuous')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer ${
                  gradingMode === 'continuous'
                    ? 'bg-sky-500 text-slate-950 shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Chấm liên tục
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              {torchSupported && (
                <button
                  type="button"
                  onClick={handleToggleCameraTorch}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                    torchEnabled ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  ⚡
                </button>
              )}
              <label className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 text-xs font-bold cursor-pointer flex items-center gap-1 border border-slate-700">
                <Upload className="w-3.5 h-3.5" />
                <span>Ảnh</span>
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

          {/* Vùng Camera chiếm trọn màn hình + Khung nhận diện 4 neo ở 4 góc */}
          <div className="flex-1 relative bg-black overflow-hidden flex flex-col justify-center">
            <video
              ref={omrVideoRef}
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay
              playsInline
              muted
            />
            <canvas
              ref={omrOverlayCanvasRef}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10"
            />

            {/* KHUNG ĐỊNH VỊ 4 GÓC NEO XANH LÁ (TỰ ĐỘNG BẮT NEO & CHẤM) */}
            {!instantScoreBanner && (
              <div className="absolute inset-4 sm:inset-6 pointer-events-none z-15 flex flex-col justify-between">
                {/* Viền khung dẫn hướng phiếu trả lời */}
                <div
                  className={`absolute inset-0 rounded-2xl border-2 transition-colors duration-150 ${
                    anchorLockState.isValidPaper && anchorLockState.count >= 3
                      ? 'border-[#00ff66] bg-emerald-500/10 shadow-[inset_0_0_30px_rgba(0,255,102,0.25)]'
                      : 'border-emerald-400/55 border-dashed'
                  }`}
                />

                {/* Hàng trên: NEO 1 (Trái-Trên TL) & NEO 2 (Phải-Trên TR) */}
                <div className="flex items-start justify-between relative z-10">
                  <div className="flex flex-col items-start gap-1">
                    <div
                      className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl border-4 flex items-center justify-center transition-all duration-150 ${
                        anchorLockState.tl
                          ? 'border-[#00ff66] bg-emerald-500/35 shadow-[0_0_20px_#00ff66] scale-105'
                          : 'border-emerald-400/90 bg-slate-950/60'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-sm border-2 flex items-center justify-center ${
                          anchorLockState.tl
                            ? 'border-white bg-[#00ff66]'
                            : 'border-emerald-300 bg-emerald-400/30 animate-pulse'
                        }`}
                      >
                        <div className="w-2 h-2 rounded-full bg-slate-950" />
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide ${
                        anchorLockState.tl
                          ? 'bg-[#00ff66] text-slate-950'
                          : 'bg-slate-900/90 text-emerald-300 border border-emerald-400/40'
                      }`}
                    >
                      {anchorLockState.tl ? '✓ NEO 1 (TL)' : 'NEO 1 (TL)'}
                    </span>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <div
                      className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl border-4 flex items-center justify-center transition-all duration-150 ${
                        anchorLockState.tr
                          ? 'border-[#00ff66] bg-emerald-500/35 shadow-[0_0_20px_#00ff66] scale-105'
                          : 'border-emerald-400/90 bg-slate-950/60'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-sm border-2 flex items-center justify-center ${
                          anchorLockState.tr
                            ? 'border-white bg-[#00ff66]'
                            : 'border-emerald-300 bg-emerald-400/30 animate-pulse'
                        }`}
                      >
                        <div className="w-2 h-2 rounded-full bg-slate-950" />
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide ${
                        anchorLockState.tr
                          ? 'bg-[#00ff66] text-slate-950'
                          : 'bg-slate-900/90 text-emerald-300 border border-emerald-400/40'
                      }`}
                    >
                      {anchorLockState.tr ? '✓ NEO 2 (TR)' : 'NEO 2 (TR)'}
                    </span>
                  </div>
                </div>

                {/* Hàng dưới: NEO 3 (Trái-Dưới BL) & NEO 4 (Phải-Dưới BR) */}
                <div className="flex items-end justify-between relative z-10">
                  <div className="flex flex-col items-start gap-1">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide ${
                        anchorLockState.bl
                          ? 'bg-[#00ff66] text-slate-950'
                          : 'bg-slate-900/90 text-emerald-300 border border-emerald-400/40'
                      }`}
                    >
                      {anchorLockState.bl ? '✓ NEO 3 (BL)' : 'NEO 3 (BL)'}
                    </span>
                    <div
                      className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl border-4 flex items-center justify-center transition-all duration-150 ${
                        anchorLockState.bl
                          ? 'border-[#00ff66] bg-emerald-500/35 shadow-[0_0_20px_#00ff66] scale-105'
                          : 'border-emerald-400/90 bg-slate-950/60'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-sm border-2 flex items-center justify-center ${
                          anchorLockState.bl
                            ? 'border-white bg-[#00ff66]'
                            : 'border-emerald-300 bg-emerald-400/30 animate-pulse'
                        }`}
                      >
                        <div className="w-2 h-2 rounded-full bg-slate-950" />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide ${
                        anchorLockState.br
                          ? 'bg-[#00ff66] text-slate-950'
                          : 'bg-slate-900/90 text-emerald-300 border border-emerald-400/40'
                      }`}
                    >
                      {anchorLockState.br ? '✓ NEO 4 (BR)' : 'NEO 4 (BR)'}
                    </span>
                    <div
                      className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl border-4 flex items-center justify-center transition-all duration-150 ${
                        anchorLockState.br
                          ? 'border-[#00ff66] bg-emerald-500/35 shadow-[0_0_20px_#00ff66] scale-105'
                          : 'border-emerald-400/90 bg-slate-950/60'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-sm border-2 flex items-center justify-center ${
                          anchorLockState.br
                            ? 'border-white bg-[#00ff66]'
                            : 'border-emerald-300 bg-emerald-400/30 animate-pulse'
                        }`}
                      >
                        <div className="w-2 h-2 rounded-full bg-slate-950" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Nhãn trạng thái gọn gàng phía trên khung ngắm */}
            {!instantScoreBanner && (
              <div className="absolute top-3 inset-x-0 pointer-events-none z-20 flex flex-col items-center gap-1 px-4">
                <div
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold shadow-lg border flex items-center gap-2 text-center ${
                    anchorLockState.isValidPaper && anchorLockState.count >= 3
                      ? 'bg-emerald-600/95 text-white border-[#00ff66]'
                      : 'bg-slate-900/90 text-white border-emerald-400/40'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-[#00ff66] animate-pulse shrink-0" />
                  <span>
                    {anchorLockState.statusHint ||
                      `Đưa 4 góc phiếu trả lời vào 4 khung xanh (${anchorLockState.count || 0}/4 neo)`}
                  </span>
                </div>
              </div>
            )}

            {/* MÀN HÌNH HIỂN THỊ ẢNH PHIẾU TRẢ LỜI ĐÃ CHẤM (CÓ ĐẦY ĐỦ ĐIỂM CÁC PHẦN & ĐIỂM TỔNG) */}
            {instantScoreBanner && (
              <div id="reviewScreen" className="review-screen">
                <div className="review-header safe-area-header">
                  <div>
                    <div className="review-title">
                      {gradingMode === 'continuous'
                        ? 'ĐÃ LƯU BÀI (CHẾ ĐỘ CHẤM LIÊN TỤC)'
                        : 'KẾT QUẢ CHẤM BÀI — GHI ĐIỂM'}
                    </div>
                    <div className="text-xs text-slate-300 font-bold mt-0.5">
                      SBD: <strong className="text-amber-300 font-mono text-sm">{instantScoreBanner.sbd}</strong> | Mã đề:{' '}
                      <strong className="text-sky-300 font-mono text-sm">{instantScoreBanner.examCode}</strong>{' '}
                      {instantScoreBanner.studentName ? `• ${instantScoreBanner.studentName}` : ''}
                    </div>
                  </div>

                  <div className="text-xs font-bold bg-slate-800 text-emerald-300 px-3 py-1 rounded-full border border-slate-700">
                    Đã lưu ({gradedRecords.length} bài)
                  </div>
                </div>

                {/* Bảng điểm đầy đủ Phần I, Phần II, Phần III và ĐIỂM TỔNG */}
                <div className="bg-slate-900 border-b border-slate-700 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs sm:text-sm text-white">
                  <div className="grid grid-cols-3 gap-2 flex-1">
                    <div className="bg-blue-950/90 border border-blue-500/40 rounded-xl px-2.5 py-1.5 text-center">
                      <div className="text-[10px] text-blue-300 font-bold uppercase">
                        Phần I ({instantScoreBanner.p1CorrectCount}/{instantScoreBanner.p1TotalCount})
                      </div>
                      <div className="text-sm sm:text-base font-black text-white">
                        {instantScoreBanner.p1Score.toFixed(2)} đ
                      </div>
                    </div>
                    <div className="bg-emerald-950/90 border border-emerald-500/40 rounded-xl px-2.5 py-1.5 text-center">
                      <div className="text-[10px] text-emerald-300 font-bold uppercase">
                        Phần II (Đ/S)
                      </div>
                      <div className="text-sm sm:text-base font-black text-white">
                        {instantScoreBanner.p2Score.toFixed(2)} đ
                      </div>
                    </div>
                    <div className="bg-purple-950/90 border border-purple-500/40 rounded-xl px-2.5 py-1.5 text-center">
                      <div className="text-[10px] text-purple-300 font-bold uppercase">
                        Phần III ({instantScoreBanner.p3CorrectCount}/{instantScoreBanner.p3TotalCount})
                      </div>
                      <div className="text-sm sm:text-base font-black text-white">
                        {instantScoreBanner.p3Score.toFixed(2)} đ
                      </div>
                    </div>
                  </div>

                  <div className="bg-rose-600 text-white px-3.5 py-1.5 rounded-xl font-black text-center shadow-lg shrink-0 border border-rose-400">
                    <div className="text-[10px] uppercase tracking-wider text-rose-100">ĐIỂM TỔNG</div>
                    <div className="text-2xl leading-none">{instantScoreBanner.totalScore.toFixed(2)}</div>
                  </div>
                </div>

                {/* Ảnh phiếu trả lời đã đóng dấu điểm các phần & điểm tổng */}
                <div className="review-body">
                  <img
                    id="evidenceImageDisplay"
                    src={instantScoreBanner.annotatedImageDataUrl}
                    alt="Ảnh phiếu trả lời đã chấm"
                  />
                </div>

                {/* Thanh đáy tối giản: Chỉ có nút ĐÓNG LẠI và nút CHẤM TIẾP */}
                <div className="review-footer safe-area-bottom-nav">
                  <button
                    type="button"
                    onClick={exitScannerScreen}
                    className="px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-extrabold flex items-center gap-1.5 cursor-pointer border border-slate-600"
                  >
                    <X className="w-5 h-5 text-rose-400" />
                    <span>Đóng lại</span>
                  </button>
                  <button
                    id="btnContinueScan"
                    type="button"
                    onClick={proceedToNextScan}
                    className="btn-continue"
                  >
                    <Play className="w-5 h-5 fill-white" />
                    <span>CHẤM TIẾP</span>
                  </button>
                </div>
              </div>
            )}

            {missingExamCodeAlert && (
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 w-[88%] max-w-xs bg-rose-600/95 text-white text-center py-2.5 px-4 rounded-xl shadow-lg font-bold text-sm">
                {missingExamCodeAlert.message}
              </div>
            )}
          </div>

          {/* Thanh đáy tối giản khi đang mở camera: Chỉ có nút Đóng lại & thông tin số bài đã chấm */}
          {!instantScoreBanner && (
            <div className="bg-slate-900 border-t border-slate-800 px-4 py-2.5 safe-area-bottom-nav shrink-0 flex items-center justify-between">
              <div className="text-xs font-bold text-slate-300">
                Đã chấm: <strong className="text-emerald-400">{gradedRecords.length}</strong> bài •{' '}
                <span className="text-slate-400">
                  {gradingMode === 'continuous' ? 'Chế độ: Chấm liên tục' : 'Chế độ: Từng bài'}
                </span>
              </div>
              <button
                type="button"
                onClick={exitScannerScreen}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-sm flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
                <span>Đóng lại</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* KHU VỰC NỘI DUNG CHÍNH (MAX-W-LG TRÊN MOBILE & TABLET/DESKTOP GỌN ĐẸP) */}
      {/* ===================================================================== */}
      <div className="flex-1 w-full max-w-lg mx-auto flex flex-col min-h-screen pb-24">
        {/* Thông báo trạng thái nhanh */}
        {statusBanner && (
          <div
            className={`mx-3 mt-2 rounded-xl px-3.5 py-2.5 text-xs font-bold flex items-center justify-between gap-2 shadow-sm ${
              statusBanner.type === 'success'
                ? 'bg-emerald-600 text-white'
                : statusBanner.type === 'warning'
                ? 'bg-rose-600 text-white'
                : 'bg-blue-600 text-white'
            }`}
          >
            <span>{statusBanner.message}</span>
            <button onClick={() => setStatusBanner(null)} className="p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 1: ĐỢT CHẤM (HOME SCREEN, MENU CHÍNH, TẠO MỚI & HUB 6 NÚT)    */}
        {/* ================================================================= */}
        {bottomTab === 'sessions' && (
          <>
            {/* 1B. MÀN HÌNH CHÍNH — DANH SÁCH ĐỢT CHẤM (MỞ LÊN VÀO NGAY MÀN HÌNH CHÍNH) */}
            {(sessionView === 'list' || sessionView === 'welcome') && (
              <div className="flex-1 flex flex-col">
                <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-blue-200/70 px-4 py-3 flex items-center justify-between safe-area-header shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#007aff] to-indigo-600 text-white flex items-center justify-center shadow-xs">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h1 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                        Màn hình chính — Chấm thi
                      </h1>
                      <p className="text-[11px] font-semibold text-slate-500">
                        Chọn phiên chấm bên dưới hoặc tạo đợt chấm mới
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowGuideModal(true)}
                      title="Cẩm nang hướng dẫn & tạo phím tắt"
                      className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold cursor-pointer"
                    >
                      <HelpCircle className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenCreateSession()}
                      title="Tạo đợt chấm mới"
                      className="w-10 h-10 rounded-full bg-[#007aff] text-white flex items-center justify-center shadow-sm active:scale-95 transition touch-target-44 cursor-pointer"
                    >
                      <Plus className="w-6 h-6" />
                    </button>
                  </div>
                </header>

                <div className="p-3.5 space-y-3.5">
                  {examSessions.length === 0 ? (
                    <div className="bg-white/90 rounded-3xl p-8 border-2 border-dashed border-blue-300 text-center shadow-xs space-y-4 my-4">
                      <div className="w-16 h-16 rounded-3xl bg-blue-50 text-[#007aff] mx-auto flex items-center justify-center shadow-inner border border-blue-100">
                        <FolderCheck className="w-8 h-8 stroke-[2.2]" />
                      </div>
                      <div className="space-y-1.5">
                        <h3 className="font-black text-lg text-slate-900">
                          Chưa có đợt chấm nào
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-500 max-w-xs mx-auto leading-relaxed">
                          Danh sách đã được làm sạch để Thầy dễ nhìn và bắt đầu. Hãy bấm nút dưới đây để tạo bài kiểm tra đầu tiên!
                        </p>
                      </div>
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => handleOpenCreateSession()}
                          className="w-full max-w-xs mx-auto py-3.5 px-6 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 text-white font-extrabold text-sm sm:text-base shadow-[0_5px_0_#1e3a8a,0_10px_20px_rgba(37,99,235,0.3)] active:translate-y-1 active:shadow-[0_1px_0_#1e3a8a] transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Plus className="w-5 h-5 stroke-[2.5]" />
                          <span>+ TẠO ĐỢT CHẤM MỚI</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    examSessions.map((session) => {
                      const sh =
                        SHEET_DATABASE.find(
                          (s) => s.id === normalizeTemplateId(session.templateId)
                        ) || SHEET_DATABASE[1];
                      const totalPts = computeTotalScoreFromConfig(session.scoring);
                      const isTenPoints = Math.abs(totalPts - 10) < 0.05;

                      return (
                        <div
                          key={session.id}
                          onClick={() => {
                            setActiveSessionId(session.id);
                            setSessionView('hub');
                          }}
                        className="bg-white rounded-2xl p-4 shadow-sm border-2 border-b-4 border-slate-200 border-b-slate-300 hover:border-blue-400 hover:border-b-blue-500 active:translate-y-0.5 transition cursor-pointer space-y-3"
                      >
                        {/* Dòng 1: Tên đợt thi + Badge điểm 3D + Nút tùy chọn */}
                        <div className="flex items-start justify-between gap-2">
                          <h2 className="text-base font-extrabold text-slate-900 leading-snug">
                            {session.name}
                          </h2>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={`text-xs font-black px-2.5 py-1 rounded-xl border-b-2 shadow-2xs ${
                                isTenPoints
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 border-b-emerald-500'
                                  : 'bg-amber-50 text-amber-800 border-amber-300 border-b-amber-500'
                              }`}
                            >
                              {totalPts} điểm
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenCreateSession(session);
                              }}
                              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
                            >
                              <MoreHorizontal className="w-5 h-5" />
                            </button>
                          </div>
                        </div>

                        {/* Dòng 2: 3 Khối 3D màu sắc khác nhau cho 3 Phần trắc nghiệm */}
                        <div className="grid grid-cols-3 gap-2">
                          {/* Phần 1: Màu xanh dương 3D */}
                          <div className="bg-gradient-to-b from-blue-50 to-blue-100/90 border border-blue-200 border-b-2 border-b-blue-400 rounded-xl px-2 py-1.5 text-center shadow-2xs">
                            <div className="text-[10px] font-black text-blue-700 uppercase tracking-tight">
                              Phần I (TN)
                            </div>
                            <div className="text-sm font-black text-blue-900">
                              {session.scoring.activeP1Count} <span className="text-[11px] font-bold">câu</span>
                            </div>
                          </div>

                          {/* Phần 2: Màu xanh lá Emerald 3D */}
                          <div className="bg-gradient-to-b from-emerald-50 to-emerald-100/90 border border-emerald-200 border-b-2 border-b-emerald-400 rounded-xl px-2 py-1.5 text-center shadow-2xs">
                            <div className="text-[10px] font-black text-emerald-700 uppercase tracking-tight">
                              Phần II (Đ/S)
                            </div>
                            <div className="text-sm font-black text-emerald-900">
                              {session.scoring.activeP2Count} <span className="text-[11px] font-bold">câu</span>
                            </div>
                          </div>

                          {/* Phần 3: Màu tím Purple 3D */}
                          <div className="bg-gradient-to-b from-purple-50 to-purple-100/90 border border-purple-200 border-b-2 border-b-purple-400 rounded-xl px-2 py-1.5 text-center shadow-2xs">
                            <div className="text-[10px] font-black text-purple-700 uppercase tracking-tight">
                              Phần III (Điền)
                            </div>
                            <div className="text-sm font-black text-purple-900">
                              {session.scoring.activeP3Count} <span className="text-[11px] font-bold">câu</span>
                            </div>
                          </div>
                        </div>

                        {/* Dòng 3: Phiếu thi và thông tin định dạng */}
                        <div className="flex items-center justify-between text-xs text-slate-700 bg-slate-50/90 px-3 py-2 rounded-xl border border-slate-200">
                          <div className="flex items-center gap-1.5 truncate">
                            <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span className="font-bold truncate text-slate-800">{sh.name}</span>
                          </div>
                          <span className="font-black text-blue-700 shrink-0 bg-blue-100/80 px-2 py-0.5 rounded-md text-[11px] border border-blue-200">
                            Mã đề {sh.codeLength} số
                          </span>
                        </div>

                        {/* Dòng 4: Chân card - Số bài đã lưu & nút Chấm tiếp phiên chấm */}
                        <div className="pt-2 flex items-center justify-between gap-2 text-xs text-slate-600 border-t border-slate-100">
                          <div className="flex items-center gap-1.5">
                            <span className="bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-1 rounded-lg border border-emerald-200">
                              Đã chấm: {(session.gradedRecords || []).length} bài
                            </span>
                            <span className="text-[11px] font-medium text-slate-400">
                              {session.createdAt}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveSessionId(session.id);
                              enterScannerScreen();
                            }}
                            className="px-3 py-1.5 rounded-xl bg-[#007aff] hover:bg-blue-600 text-white font-black flex items-center gap-1 text-xs shadow-xs cursor-pointer"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>Chấm tiếp →</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              </div>
            )}

            {/* 1C. MÀN HÌNH HUB CHỨC NĂNG 6 NÚT LỚN (ẢNH 5 & 9) */}
            {sessionView === 'hub' && activeSession && (
              <div className="flex-1 flex flex-col">
                <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-blue-200/70 px-4 py-3 flex items-center justify-between safe-area-header shadow-xs">
                  <button
                    type="button"
                    onClick={() => setSessionView('list')}
                    className="text-[#007aff] font-medium text-base flex items-center gap-0.5 touch-target-44 cursor-pointer"
                  >
                    <ChevronLeft className="w-6 h-6 -ml-1.5" />
                    <span>Quay lại</span>
                  </button>

                  <h1 className="text-base font-bold text-slate-900 truncate max-w-[200px]">
                    {activeSession.name}
                  </h1>

                  <button
                    type="button"
                    onClick={() => handleOpenCreateSession(activeSession)}
                    className="text-[#007aff] font-semibold text-sm touch-target-44 flex items-center justify-end cursor-pointer"
                  >
                    Cấu hình
                  </button>
                </header>

                <div className="p-3.5 space-y-3">
                  {/* 6 nút menu lớn dạng khối 3D màu sắc nổi bật bắt mắt - mỗi chức năng 1 màu */}
                  {/* 1. Đáp án: Xanh ngọc Emerald 3D */}
                  <button
                    type="button"
                    onClick={() => setSessionView('keys')}
                    className="w-full btn-3d btn-3d-emerald rounded-2xl px-4 py-4 flex items-center justify-between text-white cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shadow-inner">
                        <Key className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-left">
                        <div className="text-base font-extrabold tracking-wide">Đáp án</div>
                        <div className="text-xs text-emerald-100 font-semibold">
                          Đã nạp {Object.keys(answerKeys).length} mã đề thi
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-6 h-6 text-emerald-200" />
                  </button>

                  {/* 2. Chấm bài: Xanh Sapphire 3D phát sáng nhấp nháy đặc biệt */}
                  <button
                    type="button"
                    onClick={enterScannerScreen}
                    className="w-full btn-3d btn-3d-scanner rounded-2xl px-4 py-4 flex items-center justify-between text-white cursor-pointer glow-pulse-logo"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-xl bg-white/25 flex items-center justify-center shadow-inner">
                        <Play className="w-6 h-6 text-white fill-white" />
                      </div>
                      <div className="text-left">
                        <div className="text-lg font-black tracking-wide flex items-center gap-2">
                          <span>Chấm bài</span>
                          <span className="text-[11px] bg-white text-blue-900 font-extrabold px-2 py-0.5 rounded-full shadow-xs">
                            CAMERA OMR
                          </span>
                        </div>
                        <div className="text-xs text-sky-100 font-semibold">
                          Tự động nhận diện 4 góc mốc định vị đen
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-6 h-6 text-sky-200" />
                  </button>

                  {/* 3. Bài đã chấm: Tím mộng mơ / Fuchsia 3D */}
                  <button
                    type="button"
                    onClick={() => {
                      setGalleryIndex(0);
                      setSessionView('graded');
                    }}
                    className="w-full btn-3d btn-3d-fuchsia rounded-2xl px-4 py-4 flex items-center justify-between text-white cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shadow-inner">
                        <ImageIcon className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-left">
                        <div className="text-base font-extrabold tracking-wide">Bài đã chấm</div>
                        <div className="text-xs text-pink-100 font-semibold">
                          {gradedRecords.length} bài thi đã lưu minh chứng
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-6 h-6 text-pink-200" />
                  </button>

                  {/* 4. Xuất kết quả: Cam Hổ Phách 3D */}
                  <button
                    type="button"
                    onClick={() => setShowExportActionSheet(true)}
                    className="w-full btn-3d btn-3d-amber rounded-2xl px-4 py-4 flex items-center justify-between text-white cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shadow-inner">
                        <Share2 className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-left">
                        <div className="text-base font-extrabold tracking-wide">Xuất kết quả</div>
                        <div className="text-xs text-amber-100 font-semibold">
                          Xuất bảng điểm Excel (.xlsx) chuẩn Bộ GD
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-6 h-6 text-amber-200" />
                  </button>

                  {/* 5. Thống kê: Hồng Sen Rose 3D */}
                  <button
                    type="button"
                    onClick={() => setSessionView('stats')}
                    className="w-full btn-3d btn-3d-rose rounded-2xl px-4 py-4 flex items-center justify-between text-white cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shadow-inner">
                        <BarChart3 className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-left">
                        <div className="text-base font-extrabold tracking-wide">Thống kê</div>
                        <div className="text-xs text-rose-100 font-semibold">
                          Phổ điểm, tỷ lệ đậu, phân tích câu hỏi
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-6 h-6 text-rose-200" />
                  </button>

                  {/* Card Tóm tắt trạng thái đợt chấm */}
                  <div className="bg-white/95 backdrop-blur rounded-2xl p-4 space-y-2.5 shadow-[0_6px_0_#cbd5e1] border-2 border-indigo-200/90 mt-4 text-[15px] text-slate-900">
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">
                        ✓
                      </span>
                      <span>
                        {currentScoring.activeP1Count}; {currentScoring.activeP2Count};{' '}
                        {currentScoring.activeP3Count} câu
                      </span>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                        ✓
                      </span>
                      <span>
                        Phiếu: {activeDbSheet.name} (Mã đề {activeDbSheet.codeLength} số)
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">
                        ✓
                      </span>
                      <span>
                        {activeSession.scanSbd ? 'Quét số báo danh' : 'Không quét số báo danh'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      {Math.abs(activeSessionTotalScore - 10) < 0.05 ? (
                        <span className="w-5 h-5 rounded bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">
                          ✓
                        </span>
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                      )}
                      <span>Tổng điểm: {activeSessionTotalScore}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 1D. MÀN HÌNH TẠO MỚI / CHỈNH SỬA BÀI THI (KHAY TRƯỢT ĐÁY & CARD 3 CỘT - ẢNH 3, 4, 15) */}
            {sessionView === 'create' && (
              <div className="flex-1 flex flex-col pb-32">
                <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-blue-200/70 px-4 py-3 flex items-center justify-between safe-area-header shadow-xs">
                  <button
                    type="button"
                    onClick={() => setSessionView(editingSessionId ? 'hub' : 'list')}
                    className="text-[#007aff] font-bold text-base flex items-center gap-0.5 touch-target-44 cursor-pointer"
                  >
                    <ChevronLeft className="w-6 h-6 -ml-1.5" />
                    <span>Danh sách chấm</span>
                  </button>

                  <h1 className="text-base font-black text-slate-900">
                    {editingSessionId ? 'Sửa đợt chấm' : 'Tạo mới'}
                  </h1>

                  <button
                    type="button"
                    onClick={handleSaveDraftSession}
                    className="text-[#007aff] font-black text-base touch-target-44 flex items-center justify-end cursor-pointer"
                  >
                    Lưu
                  </button>
                </header>

                <div className="p-4 space-y-4">
                  {/* =================================================================== */}
                  {/* PHẦN 1 (MÀU XANH DƯƠNG / SKY 3D): 1. TÊN BÀI KIỂM TRA               */}
                  {/* =================================================================== */}
                  <div className="bg-white rounded-2xl p-4 border-2 border-sky-300 border-b-4 border-b-sky-500 shadow-sm space-y-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-xl bg-gradient-to-tr from-sky-600 to-blue-500 text-white font-black text-sm flex items-center justify-center shadow-xs">
                        1
                      </span>
                      <label className="font-black text-base text-sky-950">
                        Tên bài kiểm tra
                      </label>
                    </div>
                    <input
                      type="text"
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      placeholder="Nhập tên bài (VD: Toán 12 - GKI)"
                      className="w-full bg-sky-50/60 rounded-xl px-4 py-3 text-base font-bold text-slate-900 placeholder:text-slate-400 border-2 border-sky-200 focus:outline-none focus:border-sky-500 shadow-inner"
                    />
                  </div>

                  {/* =================================================================== */}
                  {/* PHẦN 2 (MÀU TÍM INDIGO 3D): 2. CHỌN PHIẾU CÓ MÃ ĐỀ 3 SỐ / 4 SỐ       */}
                  {/* =================================================================== */}
                  <div className="bg-white rounded-2xl p-4 border-2 border-indigo-300 border-b-4 border-b-indigo-500 shadow-sm space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white font-black text-sm flex items-center justify-center shadow-xs">
                          2
                        </span>
                        <label className="font-black text-base text-indigo-950">
                          Chọn phiếu có mã đề:
                        </label>
                      </div>

                      {/* Gạt 3 số / 4 số dạng 3D */}
                      <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
                        <button
                          type="button"
                          onClick={() => handleToggleDraftCodeLength(3)}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                            draftCodeLength === 3
                              ? 'btn-3d btn-3d-blue text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          3 số
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleDraftCodeLength(4)}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                            draftCodeLength === 4
                              ? 'btn-3d btn-3d-blue text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          4 số
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSheetGroupTab(draftDbSheet.group);
                          setShowSheetSelectorBottomSheet(true);
                        }}
                        className="flex-1 bg-gradient-to-r from-indigo-50/70 to-purple-50/70 rounded-xl px-4 py-3 border-2 border-indigo-200 hover:border-indigo-400 flex items-center justify-between text-left shadow-2xs active:bg-indigo-100/70 cursor-pointer"
                      >
                        <div className="truncate pr-2">
                          <div className="text-base font-extrabold text-indigo-950 truncate">
                            {draftDbSheet.name}
                          </div>
                          <div className="text-xs text-indigo-700 font-semibold mt-0.5 truncate">
                            {draftDbSheet.group} • Tối đa: {draftDbSheet.p1} P1, {draftDbSheet.p2} P2, {draftDbSheet.p3} P3
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-indigo-600 shrink-0" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setPreviewSheetModalItem(draftDbSheet)}
                        title="Xem ảnh phóng to mẫu phiếu chuẩn"
                        className="w-12 h-12 rounded-xl btn-3d btn-3d-white text-indigo-600 flex items-center justify-center shrink-0 cursor-pointer"
                      >
                        <Search className="w-5 h-5 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>

                  {/* =================================================================== */}
                  {/* PHẦN 3 (MÀU XANH TEAL / NGỌC 3D): 3. QUÉT SỐ BÁO DANH                */}
                  {/* =================================================================== */}
                  <div className="bg-white rounded-2xl p-4 border-2 border-teal-300 border-b-4 border-b-teal-500 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-500 text-white font-black text-sm flex items-center justify-center shadow-xs">
                        3
                      </span>
                      <div>
                        <label className="font-black text-base text-teal-950 block">
                          Quét số báo danh
                        </label>
                        <span className="text-xs text-teal-700 font-bold">
                          {draftScanSbd ? 'Đang bật quét SBD & tự đối chiếu học sinh' : 'Tắt quét SBD'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDraftScanSbd((v) => !v)}
                      className={`w-14 h-8 rounded-full p-1 transition-colors cursor-pointer shadow-inner ${
                        draftScanSbd ? 'bg-teal-500' : 'bg-slate-300'
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-full bg-white shadow-md transition-transform ${
                          draftScanSbd ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* =================================================================== */}
                  {/* PHẦN 4 (MÀU TÍM PURPLE 3D): 4. CẤU TRÚC ĐỀ (3 PHẦN RIÊNG BIỆT 3D)  */}
                  {/* =================================================================== */}
                  <div className="bg-white rounded-2xl p-4 border-2 border-purple-300 border-b-4 border-purple-500 shadow-sm space-y-4">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 text-white font-black text-sm flex items-center justify-center shadow-xs">
                          4
                        </span>
                        <label className="font-black text-base text-purple-950">
                          Cấu trúc đề & Thiết lập điểm (3 Phần)
                        </label>
                      </div>
                    </div>

                    {/* 3 KHỐI 3D VỚI 3 MÀU SẮC RỰC RỠ VÀ CỠ CHỮ LỚN RÕ RÀNG */}
                    <div className="grid grid-cols-3 gap-2.5">
                      {/* KHỐI 1: PHẦN I (TN 4 LỰA CHỌN) - MÀU XANH DƯƠNG 3D */}
                      <div className="bg-gradient-to-b from-blue-50 to-blue-100/90 rounded-2xl p-3 border-2 border-blue-300 border-b-4 border-b-blue-500 shadow-xs flex flex-col justify-between text-center">
                        <div className="text-xs font-black text-blue-900 uppercase tracking-tight">
                          Phần I (TN)
                        </div>
                        <div className="text-[11px] text-blue-600 font-bold mb-1">
                          Số câu (Tối đa {draftDbSheet.p1})
                        </div>
                        <input
                          type="number"
                          min={0}
                          max={draftDbSheet.p1}
                          value={draftScoring.activeP1Count}
                          onChange={(e) =>
                            setDraftScoring((prev) => ({
                              ...prev,
                              activeP1Count: Math.min(
                                draftDbSheet.p1,
                                Math.max(0, Number(e.target.value) || 0)
                              ),
                            }))
                          }
                          placeholder="Số câu"
                          className="w-full bg-white border-2 border-blue-300 focus:border-blue-500 rounded-xl py-1.5 px-1 text-center font-black text-2xl sm:text-3xl text-blue-700 shadow-inner focus:outline-none"
                        />
                        <div className="mt-2 bg-blue-200/80 border border-blue-300 rounded-lg py-1 px-1.5">
                          <label className="text-[10px] font-bold text-blue-800 block">
                            Điểm / câu P1
                          </label>
                          <input
                            type="number"
                            step={0.05}
                            min={0}
                            value={draftScoring.p1PointsPerQ}
                            onChange={(e) =>
                              setDraftScoring((prev) => ({
                                ...prev,
                                p1PointsPerQ: Number(e.target.value) || 0,
                              }))
                            }
                            className="w-full bg-white border border-blue-300 rounded-md py-0.5 text-center font-black text-xs text-blue-950 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* KHỐI 2: PHẦN II (ĐÚNG/SAI) - MÀU XANH LÁ EMERALD 3D */}
                      <div className="bg-gradient-to-b from-emerald-50 to-emerald-100/90 rounded-2xl p-3 border-2 border-emerald-300 border-b-4 border-emerald-500 shadow-xs flex flex-col justify-between text-center">
                        <div className="text-xs font-black text-emerald-900 uppercase tracking-tight">
                          Phần II (Đ/S)
                        </div>
                        <div className="text-[11px] text-emerald-600 font-bold mb-1">
                          Số câu (Tối đa {draftDbSheet.p2})
                        </div>
                        <input
                          type="number"
                          min={0}
                          max={draftDbSheet.p2}
                          value={draftScoring.activeP2Count}
                          onChange={(e) =>
                            setDraftScoring((prev) => ({
                              ...prev,
                              activeP2Count: Math.min(
                                draftDbSheet.p2,
                                Math.max(0, Number(e.target.value) || 0)
                              ),
                            }))
                          }
                          placeholder="Số câu"
                          className="w-full bg-white border-2 border-emerald-300 focus:border-emerald-500 rounded-xl py-1.5 px-1 text-center font-black text-2xl sm:text-3xl text-emerald-700 shadow-inner focus:outline-none"
                        />
                        <div className="mt-2 bg-emerald-200/80 border border-emerald-300 rounded-lg py-1.5 px-1">
                          <div className="text-[10px] font-bold text-emerald-800">Cách tính P2</div>
                          <div className="text-[11px] font-black text-emerald-950 truncate">
                            {draftScoring.p2PointsMap[0] === 0.1 &&
                            draftScoring.p2PointsMap[1] === 0.25 &&
                            draftScoring.p2PointsMap[2] === 0.5 &&
                            draftScoring.p2PointsMap[3] === 1
                              ? 'Lũy tiến Bộ GD'
                              : draftScoring.p2PointsMap[0] === 0.25 &&
                                draftScoring.p2PointsMap[1] === 0.5 &&
                                draftScoring.p2PointsMap[2] === 0.75 &&
                                draftScoring.p2PointsMap[3] === 1
                              ? '0.25-0.5-0.75-1'
                              : `${draftScoring.p2PointsMap.join('-')}`}
                          </div>
                        </div>
                      </div>

                      {/* KHỐI 3: PHẦN III (ĐIỀN SỐ) - MÀU TÍM VIOLET 3D (MẶC ĐỊNH 0.5 ĐIỂM) */}
                      <div className="bg-gradient-to-b from-purple-50 to-purple-100/90 rounded-2xl p-3 border-2 border-purple-300 border-b-4 border-purple-500 shadow-xs flex flex-col justify-between text-center">
                        <div className="text-xs font-black text-purple-900 uppercase tracking-tight">
                          Phần III (Điền)
                        </div>
                        <div className="text-[11px] text-purple-600 font-bold mb-1">
                          Số câu (Tối đa {draftDbSheet.p3})
                        </div>
                        <input
                          type="number"
                          min={0}
                          max={draftDbSheet.p3}
                          value={draftScoring.activeP3Count}
                          onChange={(e) =>
                            setDraftScoring((prev) => ({
                              ...prev,
                              activeP3Count: Math.min(
                                draftDbSheet.p3,
                                Math.max(0, Number(e.target.value) || 0)
                              ),
                            }))
                          }
                          placeholder="Số câu"
                          className="w-full bg-white border-2 border-purple-300 focus:border-purple-500 rounded-xl py-1.5 px-1 text-center font-black text-2xl sm:text-3xl text-purple-700 shadow-inner focus:outline-none"
                        />
                        <div className="mt-2 bg-purple-200/80 border border-purple-300 rounded-lg py-1 px-1.5">
                          <label className="text-[10px] font-bold text-purple-800 block">
                            Điểm / câu P3
                          </label>
                          <input
                            type="number"
                            step={0.05}
                            min={0}
                            value={draftScoring.p3PointsPerQ}
                            onChange={(e) =>
                              setDraftScoring((prev) => ({
                                ...prev,
                                p3PointsPerQ: Number(e.target.value) || 0,
                              }))
                            }
                            className="w-full bg-white border border-purple-300 rounded-md py-0.5 text-center font-black text-xs text-purple-950 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* THIẾT LẬP ĐIỂM NHANH Ở PHẦN 2 THEO 2 CÁCH */}
                    <div className="bg-emerald-50/90 rounded-2xl p-3.5 border-2 border-emerald-200 space-y-2.5">
                      <div className="text-xs font-black text-emerald-950 flex items-center justify-between">
                        <span>⚡ Thiết lập điểm nhanh Phần II (Đúng/Sai):</span>
                        <span className="text-[11px] font-mono text-emerald-700">
                          [{draftScoring.p2PointsMap.join(' - ')}]
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {/* Cách 2.1: Lũy tiến theo Bộ */}
                        <button
                          type="button"
                          onClick={() =>
                            setDraftScoring((prev) => ({
                              ...prev,
                              p2PointsMap: [0.1, 0.25, 0.5, 1.0],
                            }))
                          }
                          className={`p-2.5 rounded-xl border-2 text-left transition cursor-pointer flex items-center justify-between ${
                            draftScoring.p2PointsMap[0] === 0.1 &&
                            draftScoring.p2PointsMap[1] === 0.25 &&
                            draftScoring.p2PointsMap[2] === 0.5 &&
                            draftScoring.p2PointsMap[3] === 1.0
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                              : 'bg-white text-emerald-950 border-emerald-300 hover:bg-emerald-100/60'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-black">1. Lũy tiến theo Bộ</div>
                            <div
                              className={`text-[11px] font-mono font-bold ${
                                draftScoring.p2PointsMap[0] === 0.1
                                  ? 'text-emerald-100'
                                  : 'text-emerald-700'
                              }`}
                            >
                              0.1 - 0.25 - 0.5 - 1.0
                            </div>
                          </div>
                          {draftScoring.p2PointsMap[0] === 0.1 &&
                            draftScoring.p2PointsMap[1] === 0.25 &&
                            draftScoring.p2PointsMap[2] === 0.5 &&
                            draftScoring.p2PointsMap[3] === 1.0 && (
                              <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
                            )}
                        </button>

                        {/* Cách 2.2: Theo thang điểm: 0.25 - 0.5 - 0.75 - 1 */}
                        <button
                          type="button"
                          onClick={() =>
                            setDraftScoring((prev) => ({
                              ...prev,
                              p2PointsMap: [0.25, 0.5, 0.75, 1.0],
                            }))
                          }
                          className={`p-2.5 rounded-xl border-2 text-left transition cursor-pointer flex items-center justify-between ${
                            draftScoring.p2PointsMap[0] === 0.25 &&
                            draftScoring.p2PointsMap[1] === 0.5 &&
                            draftScoring.p2PointsMap[2] === 0.75 &&
                            draftScoring.p2PointsMap[3] === 1.0
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                              : 'bg-white text-emerald-950 border-emerald-300 hover:bg-emerald-100/60'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-black">
                              2. Theo thang điểm đều
                            </div>
                            <div
                              className={`text-[11px] font-mono font-bold ${
                                draftScoring.p2PointsMap[0] === 0.25
                                  ? 'text-emerald-100'
                                  : 'text-emerald-700'
                              }`}
                            >
                              0.25 - 0.5 - 0.75 - 1
                            </div>
                          </div>
                          {draftScoring.p2PointsMap[0] === 0.25 &&
                            draftScoring.p2PointsMap[1] === 0.5 &&
                            draftScoring.p2PointsMap[2] === 0.75 &&
                            draftScoring.p2PointsMap[3] === 1.0 && (
                              <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
                            )}
                        </button>
                      </div>

                      {/* 4 ô hiển thị & cho phép chỉnh trực tiếp từng mức 1 ý - 2 ý - 3 ý - 4 ý */}
                      <div className="grid grid-cols-4 gap-2 pt-1">
                        {[0, 1, 2, 3].map((idx) => (
                          <div
                            key={idx}
                            className="bg-white p-2 rounded-xl border border-emerald-200 shadow-2xs text-center"
                          >
                            <span className="text-[10px] text-emerald-800 font-black block mb-0.5">
                              Đúng {idx + 1} ý
                            </span>
                            <input
                              type="number"
                              step={0.05}
                              value={draftScoring.p2PointsMap[idx]}
                              onChange={(e) => {
                                const nextMap = [...draftScoring.p2PointsMap] as [
                                  number,
                                  number,
                                  number,
                                  number
                                ];
                                nextMap[idx] = Number(e.target.value) || 0;
                                setDraftScoring((prev) => ({ ...prev, p2PointsMap: nextMap }));
                              }}
                              className="w-full bg-emerald-50 border border-emerald-300 rounded-lg py-1 font-black text-center text-emerald-800 text-sm focus:outline-none"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* =================================================================== */}
                {/* THANH CHÂN TRANG: TĂNG NÚT SỐ ĐIỂM LÊN & NÚT LƯU BÀI KIỂM TRA NHỎ LẠI */}
                {/* =================================================================== */}
                <div className="fixed bottom-16 left-0 right-0 max-w-lg mx-auto bg-white/95 backdrop-blur-md border-t-2 border-blue-200 px-4 py-3 flex items-center justify-between gap-3 z-20 shadow-2xl">
                  {/* NÚT TỔNG ĐIỂM ĐƯỢC TĂNG LỚN NỔI BẬT KHỐI 3D */}
                  <div
                    className={`flex-1 rounded-2xl px-4 py-2.5 flex items-center justify-between border-2 border-b-4 shadow-md transition-all ${
                      Math.abs(draftTotalScore - 10) < 0.05
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-600 border-emerald-400 border-b-emerald-700 text-white'
                        : 'bg-gradient-to-r from-amber-500 to-orange-600 border-amber-400 border-b-amber-700 text-white'
                    }`}
                  >
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-wider opacity-90">
                        {Math.abs(draftTotalScore - 10) < 0.05 ? 'Tổng điểm chuẩn' : 'Tổng điểm đề'}
                      </div>
                      <div className="text-xs font-bold opacity-95">
                        {draftScoring.activeP1Count} + {draftScoring.activeP2Count} + {draftScoring.activeP3Count} câu
                      </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black tracking-tight tabular-nums drop-shadow-xs">
                      {draftTotalScore.toFixed(1)} <span className="text-sm font-bold opacity-90">/ 10đ</span>
                    </div>
                  </div>

                  {/* NÚT LƯU BÀI KIỂM TRA NHỎ GỌN LẠI DẠNG 3D */}
                  <button
                    type="button"
                    onClick={handleSaveDraftSession}
                    className="btn-3d btn-3d-blue py-3 px-5 rounded-2xl text-sm sm:text-base font-black text-white shrink-0 shadow-md flex items-center gap-1.5 touch-target-44 cursor-pointer"
                  >
                    <Check className="w-5 h-5 stroke-[2.5]" />
                    <span>Lưu bài</span>
                  </button>
                </div>
              </div>
            )}

            {/* 1E. MÀN HÌNH ĐÁP ÁN & ACTION SHEET THÊM ĐÁP ÁN (ẢNH 6) */}
            {sessionView === 'keys' && (
              <div className="flex-1 flex flex-col">
                <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-blue-200/70 px-4 py-3 flex items-center justify-between safe-area-header shadow-xs">
                  <button
                    type="button"
                    onClick={() => setSessionView('hub')}
                    className="text-[#007aff] font-medium text-base flex items-center gap-0.5 touch-target-44 cursor-pointer"
                  >
                    <ChevronLeft className="w-6 h-6 -ml-1.5" />
                    <span>Quay lại</span>
                  </button>

                  <h1 className="text-base font-bold text-slate-900">Đáp án</h1>

                  <button
                    type="button"
                    onClick={() => setShowKeyActionSheet(true)}
                    className="w-10 h-10 rounded-full text-slate-700 hover:bg-slate-200 flex items-center justify-center touch-target-44 cursor-pointer"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </header>

                {isQrCameraOpen && (
                  <div className="m-3.5 relative rounded-2xl overflow-hidden border-2 border-emerald-500 bg-black aspect-video">
                    <video
                      ref={qrVideoRef}
                      className="w-full h-full object-cover"
                      playsInline
                      muted
                    />
                    <div className="absolute inset-6 border-2 border-dashed border-emerald-400 rounded-xl pointer-events-none flex items-center justify-center">
                      <span className="px-3 py-1 rounded bg-black/75 text-xs text-emerald-300 font-mono">
                        Đưa mã QR đáp án vào khung ngắm...
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsQrCameraOpen(false)}
                      className="absolute top-2 right-2 bg-rose-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg"
                    >
                      Đóng
                    </button>
                  </div>
                )}

                {Object.keys(answerKeys).length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
                    <p className="text-slate-500 text-base mb-4">Nhấn + để thêm đáp án</p>
                    <button
                      type="button"
                      onClick={() => setShowKeyActionSheet(true)}
                      className="bg-[#007aff] text-white font-bold px-5 py-2.5 rounded-xl text-sm shadow"
                    >
                      + Thêm đáp án
                    </button>
                  </div>
                ) : (
                  <div className="p-3.5 space-y-3">
                    {/* Dải chọn mã đề */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {Object.keys(answerKeys).map((code) => (
                        <button
                          key={code}
                          type="button"
                          onClick={() => {
                            setSelectedExamCodeView(code);
                            setSimExamCode(code);
                          }}
                          className={`px-4 py-2 rounded-xl font-mono text-sm font-bold shrink-0 transition cursor-pointer ${
                            selectedExamCodeView === code
                              ? 'bg-[#007aff] text-white shadow-xs'
                              : 'bg-white text-slate-700 border border-slate-200'
                          }`}
                        >
                          Mã {code}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setShowKeyActionSheet(true)}
                        className="px-3.5 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-300 text-xs font-bold shrink-0 cursor-pointer"
                      >
                        + Nạp QR / Excel / Thêm mã
                      </button>
                    </div>

                    {currentKeyView && (
                      <div className="space-y-3">
                        {/* Phần I */}
                        {currentScoring.activeP1Count > 0 && (
                          <div className="bg-white rounded-2xl p-3.5 border border-slate-200 space-y-2">
                            <div className="text-xs font-bold uppercase text-blue-800">
                              Phần I — {currentScoring.activeP1Count} câu nhiều lựa chọn
                            </div>
                            <div className="grid grid-cols-6 gap-2">
                              {currentKeyView.p1
                                .slice(0, currentScoring.activeP1Count)
                                .map((ans, idx) => (
                                  <div
                                    key={idx}
                                    className="bg-slate-50 border border-slate-200 rounded-xl p-1.5 text-center"
                                  >
                                    <div className="text-[11px] text-slate-500 font-mono">
                                      C.{idx + 1}
                                    </div>
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
                                      className="bg-transparent font-mono font-bold text-sm text-blue-700 focus:outline-none"
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
                          <div className="bg-white rounded-2xl p-3.5 border border-slate-200 space-y-2">
                            <div className="text-xs font-bold uppercase text-emerald-800">
                              Phần II — {currentScoring.activeP2Count} câu Đúng / Sai
                            </div>
                            <div className="grid grid-cols-2 gap-2.5">
                              {currentKeyView.p2
                                .slice(0, currentScoring.activeP2Count)
                                .map((qObj, qIdx) => (
                                  <div
                                    key={qIdx}
                                    className="bg-slate-50 border border-slate-200 rounded-xl p-2.5"
                                  >
                                    <div className="text-xs font-bold text-slate-700 mb-1.5">
                                      Câu {qIdx + 1}
                                    </div>
                                    <div className="grid grid-cols-4 gap-1">
                                      {(['a', 'b', 'c', 'd'] as const).map((sk) => (
                                        <button
                                          key={sk}
                                          type="button"
                                          onClick={() => {
                                            setAnswerKeys((prev) => {
                                              const target = { ...prev[selectedExamCodeView] };
                                              const nextP2 = [...target.p2];
                                              nextP2[qIdx] = {
                                                ...nextP2[qIdx],
                                                [sk]: nextP2[qIdx][sk] === 'D' ? 'S' : 'D',
                                              };
                                              return {
                                                ...prev,
                                                [selectedExamCodeView]: { ...target, p2: nextP2 },
                                              };
                                            });
                                          }}
                                          className={`py-1 rounded-lg font-mono text-xs font-bold ${
                                            qObj[sk] === 'D'
                                              ? 'bg-emerald-600 text-white'
                                              : 'bg-rose-600 text-white'
                                          }`}
                                        >
                                          {sk}:{qObj[sk] === 'D' ? 'Đ' : 'S'}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Phần III */}
                        {currentScoring.activeP3Count > 0 && (
                          <div className="bg-white rounded-2xl p-3.5 border border-slate-200 space-y-2">
                            <div className="text-xs font-bold uppercase text-purple-800">
                              Phần III — {currentScoring.activeP3Count} câu điền số trả lời ngắn
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {currentKeyView.p3
                                .slice(0, currentScoring.activeP3Count)
                                .map((val, qIdx) => (
                                  <div
                                    key={qIdx}
                                    className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                                  >
                                    <span className="text-xs font-bold text-slate-700">
                                      Câu {qIdx + 1}
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
                                      className="w-20 text-right font-mono font-bold text-sm bg-white border border-slate-300 rounded-lg px-2 py-1"
                                    />
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                        {/* Nút LƯU ĐÁP ÁN & CẤU HÌNH */}
                        <div className="pt-2 pb-4 sticky bottom-2 z-10">
                          <button
                            type="button"
                            onClick={() => {
                              handleSaveGradingConfiguration();
                              setSessionView('hub');
                            }}
                            className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Save className="w-5 h-5" />
                            <span>LƯU LẠI ĐÁP ÁN & CẤU HÌNH</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 1F. MÀN HÌNH XEM BÀI ĐÃ CHẤM (CHUẨN ẢNH 7: NỀN ĐEN, CHỮ ĐỎ P1/P2/P3, < 1 / 36 >) */}
            {sessionView === 'graded' && (
              <div className="fixed inset-0 z-50 bg-black text-white flex flex-col h-[100dvh]">
                <div className="px-4 py-3 flex items-center justify-between safe-area-header">
                  <button
                    type="button"
                    onClick={() => setSessionView('hub')}
                    className="p-2 text-white hover:text-slate-300 touch-target-44 cursor-pointer"
                  >
                    <X className="w-7 h-7" />
                  </button>

                  <span className="text-sm font-semibold text-slate-300">
                    {gradedRecords.length > 0
                      ? `${gradedRecords[galleryIndex]?.studentName || ''} • SBD ${
                          gradedRecords[galleryIndex]?.sbd || ''
                        }`
                      : 'Chưa có bài chấm'}
                  </span>

                  {gradedRecords.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        const target = gradedRecords[galleryIndex];
                        if (!target) return;
                        setGradedRecords((prev) => prev.filter((r) => r.id !== target.id));
                        setGalleryIndex((i) => Math.max(0, i - 1));
                      }}
                      className="p-2 text-white hover:text-rose-400 touch-target-44 cursor-pointer"
                    >
                      <Trash2 className="w-6 h-6" />
                    </button>
                  ) : (
                    <div className="w-10" />
                  )}
                </div>

                {gradedRecords.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
                    <p className="text-slate-400">
                      Chưa có bài chấm nào. Hãy mở Camera hoặc bấm nút dưới đây để tạo bài chấm mẫu!
                    </p>
                    <button
                      type="button"
                      onClick={async () => {
                        await handleRunSimulatedSheet(0.88);
                      }}
                      className="bg-emerald-600 text-white font-bold px-5 py-3 rounded-xl text-sm"
                    >
                      ⚡ Tạo & Chấm thử 1 bài mẫu ngay
                    </button>
                  </div>
                ) : (
                  <>
                    {(() => {
                      const rec = gradedRecords[galleryIndex] || gradedRecords[0];
                      const p2Str = rec.p2Details
                        .map((q) => `${q.correctSubCount}/4`)
                        .join('; ');
                      return (
                        <div className="flex-1 flex flex-col justify-center overflow-hidden">
                          <div className="bg-white text-[#e11d48] font-mono font-bold text-xs sm:text-sm px-3 py-2 leading-snug">
                            <div>
                              P1: {rec.p1CorrectCount}/{rec.p1TotalCount} = {rec.p1Score.toFixed(2)}{' '}
                              | P2: {p2Str || '0/4'} = {rec.p2Score.toFixed(2)}
                            </div>
                            <div>
                              P3: {rec.p3CorrectCount}/{rec.p3TotalCount} = {rec.p3Score.toFixed(2)}{' '}
                              | Tong: {rec.totalScore.toFixed(2)}
                            </div>
                          </div>
                          <img
                            src={rec.annotatedImageDataUrl}
                            alt={`Bài chấm SBD ${rec.sbd}`}
                            className="w-full max-h-[62dvh] object-contain bg-white"
                          />
                        </div>
                      );
                    })()}

                    {/* Thanh điều hướng dưới đáy < 1 / 36 > + Nút Tải ZIP + Nút Share/Download */}
                    <div className="px-4 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between safe-area-bottom-nav">
                      <button
                        type="button"
                        onClick={handleExportZipAllEvidenceImages}
                        title="Tải toàn bộ ảnh minh chứng dạng ZIP"
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <FileArchive className="w-4 h-4" />
                        <span className="hidden sm:inline">Tải toàn bộ bài (.ZIP)</span>
                        <span className="sm:hidden">ZIP ({gradedRecords.length})</span>
                      </button>

                      <div className="flex items-center gap-6">
                        <button
                          type="button"
                          disabled={galleryIndex <= 0}
                          onClick={() => setGalleryIndex((i) => Math.max(0, i - 1))}
                          className="p-2 disabled:opacity-30 cursor-pointer"
                        >
                          <ChevronLeft className="w-7 h-7" />
                        </button>
                        <span className="font-mono text-base font-bold">
                          {galleryIndex + 1} / {gradedRecords.length}
                        </span>
                        <button
                          type="button"
                          disabled={galleryIndex >= gradedRecords.length - 1}
                          onClick={() =>
                            setGalleryIndex((i) => Math.min(gradedRecords.length - 1, i + 1))
                          }
                          className="p-2 disabled:opacity-30 cursor-pointer"
                        >
                          <ChevronRight className="w-7 h-7" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const rec = gradedRecords[galleryIndex];
                            if (rec) handleSaveEvidenceSheet(rec, false);
                          }}
                          title="Lưu ảnh hiện tại"
                          className="p-2 text-white hover:text-blue-400 cursor-pointer bg-slate-800 rounded-xl"
                        >
                          <Download className="w-5 h-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const rec = gradedRecords[galleryIndex];
                            if (rec) handleSaveEvidenceSheet(rec, true);
                          }}
                          title="Chia sẻ"
                          className="p-2 text-white hover:text-blue-400 cursor-pointer bg-slate-800 rounded-xl"
                        >
                          <Share2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 1G. MÀN HÌNH THỐNG KÊ BIỂU ĐỒ CỘT THEO MÃ ĐỀ (ẢNH 8) */}
            {sessionView === 'stats' && (
              <div className="flex-1 flex flex-col bg-[#dad4c8] min-h-[88vh]">
                <header className="sticky top-0 z-20 bg-[#dad4c8]/95 backdrop-blur-md px-4 py-3 flex items-center justify-between safe-area-header">
                  <button
                    type="button"
                    onClick={() => setSessionView('hub')}
                    className="text-[#007aff] font-medium text-base flex items-center gap-0.5 touch-target-44 cursor-pointer"
                  >
                    <ChevronLeft className="w-6 h-6 -ml-1.5" />
                    <span>Quay lại</span>
                  </button>
                  <h1 className="text-base font-bold text-slate-900">Thống kê</h1>
                  <div className="w-16" />
                </header>

                <div className="p-3.5 space-y-4 flex-1 flex flex-col">
                  {/* Chọn mã đề */}
                  <div className="bg-white rounded-xl px-4 py-2.5 border border-slate-300 flex items-center justify-between">
                    <span className="text-[#4263eb] font-medium text-base">
                      Mã đề: {selectedExamCodeView || '101'}
                    </span>
                    <select
                      value={selectedExamCodeView}
                      onChange={(e) => setSelectedExamCodeView(e.target.value)}
                      className="text-sm font-bold text-slate-700 bg-transparent focus:outline-none"
                    >
                      {Object.keys(answerKeys).map((c) => (
                        <option key={c} value={c}>
                          Đổi mã {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Badge nổi hiển thị câu đang chọn: "Câu 9: Đúng 29, Sai 7" */}
                  {questionStatsList[selectedStatBarIndex] && (
                    <div className="self-center bg-white/95 px-4 py-2 rounded-2xl shadow-sm text-base font-medium text-slate-900">
                      Câu {questionStatsList[selectedStatBarIndex].label}: Đúng{' '}
                      {questionStatsList[selectedStatBarIndex].correct}, Sai{' '}
                      {questionStatsList[selectedStatBarIndex].wrong}
                    </div>
                  )}

                  {/* Biểu đồ cột xanh ngọc tương tác 1 chạm */}
                  <div className="flex-1 bg-white/40 rounded-2xl p-4 flex flex-col justify-end min-h-[380px]">
                    <div className="flex items-end gap-1.5 h-72 overflow-x-auto pb-2 border-b border-slate-400">
                      {questionStatsList.map((item, idx) => {
                        const maxVal = Math.max(
                          1,
                          ...questionStatsList.map((x) => x.correct + x.wrong)
                        );
                        const heightPct = Math.max(12, Math.round((item.correct / maxVal) * 100));
                        const isSelected = idx === selectedStatBarIndex;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setSelectedStatBarIndex(idx)}
                            className="flex flex-col items-center justify-end h-full min-w-[18px] flex-1 group cursor-pointer"
                          >
                            <div
                              style={{ height: `${heightPct}%` }}
                              className={`w-full rounded-t transition-all ${
                                isSelected ? 'bg-[#115e67]' : 'bg-[#2cb1cc] hover:bg-[#2299b2]'
                              }`}
                            />
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between text-xs text-[#007aff] font-medium pt-2 px-1">
                      <span>Câu 1</span>
                      <span>Phần I (TN)</span>
                      <span>Phần II (Đ/S)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </>
        )}

        {/* ================================================================= */}
        {/* TAB 4: CÀI ĐẶT (TỐC ĐỘ CHẤM, XEM KẾT QUẢ, TÀI KHOẢN PRO & TẢI HTML) */}
        {/* ================================================================= */}
        {bottomTab === 'settings' && (
          <div className="flex-1 flex flex-col bg-gradient-to-b from-[#e8f2fc] via-[#edf4fb] to-[#e4eef8] min-h-[88vh]">
            <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-blue-200/70 px-4 py-3 flex items-center justify-between safe-area-header shadow-xs">
              <button
                type="button"
                onClick={() => setBottomTab('sessions')}
                className="text-[#007aff] font-medium text-base flex items-center gap-0.5 touch-target-44 cursor-pointer"
              >
                <ChevronLeft className="w-6 h-6 -ml-1.5" />
                <span>Quay lại</span>
              </button>
              <h1 className="text-base font-bold text-slate-900">Cài đặt</h1>
              <div className="w-16" />
            </header>

            <div className="p-4 space-y-5">
              {/* Tốc độ chấm (1s -> 5s) giống hệt ảnh 11 */}
              <div className="space-y-2">
                <div className="font-medium text-base text-slate-900">
                  • Tốc độ chấm: {autoGradeDelaySeconds} s
                </div>
                <input
                  type="range"
                  min={1.0}
                  max={5.0}
                  step={0.5}
                  value={autoGradeDelaySeconds}
                  onChange={(e) => setAutoGradeDelaySeconds(Number(e.target.value))}
                  className="w-full accent-[#4263eb] h-2 bg-slate-300 rounded-lg cursor-pointer"
                />
              </div>

              {/* Vừa chấm vừa xem kết quả */}
              <div className="flex items-center justify-between">
                <span className="font-medium text-base text-slate-900">
                  • Vừa chấm vừa xem kết quả
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setGradingMode((m) => (m === 'review' ? 'continuous' : 'review'))
                  }
                  className={`w-14 h-8 rounded-full p-1 transition-colors cursor-pointer ${
                    gradingMode === 'review' ? 'bg-[#4263eb]' : 'bg-slate-400'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full bg-white shadow transition-transform ${
                      gradingMode === 'review' ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Đọc điểm bằng giọng nói */}
              <div className="flex items-center justify-between">
                <span className="font-medium text-base text-slate-900">
                  • Đọc điểm bằng giọng nói tiếng Việt
                </span>
                <button
                  type="button"
                  onClick={() => setVoiceReadout((v) => !v)}
                  className={`w-14 h-8 rounded-full p-1 transition-colors cursor-pointer ${
                    voiceReadout ? 'bg-[#4263eb]' : 'bg-slate-400'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full bg-white shadow transition-transform ${
                      voiceReadout ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Cài đặt độ nhạy tô chì OMR */}
              <div className="space-y-2 bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900">
                    • Độ nhạy nhận diện ô tô chì (OMR)
                  </span>
                  <span className="text-xs font-mono font-bold text-[#4263eb]">
                    {(omrThreshold * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.14}
                  max={0.35}
                  step={0.01}
                  value={omrThreshold}
                  onChange={(e) => setOmrThreshold(Number(e.target.value))}
                  className="w-full accent-[#4263eb] h-2 bg-slate-200 rounded-lg cursor-pointer"
                />
                <p className="text-[11px] text-slate-500">
                  Mặc định 20%: Tự động nhận cả bút chì nhạt (2B/HB) và bút bi dưới mọi điều kiện ánh sáng.
                </p>
              </div>

              {/* Trạng thái nhớ quyền truy cập Camera */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Camera className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <div className="text-xs font-extrabold text-emerald-900">
                      Ghi nhớ quyền truy cập Camera tự động
                    </div>
                    <div className="text-[11px] text-emerald-700">
                      Đã kích hoạt — Lần sau mở máy chấm ngay không hỏi lại quyền
                    </div>
                  </div>
                </div>
                <span className="text-xs font-black text-emerald-700 bg-white px-2.5 py-1 rounded-lg border border-emerald-300">
                  ĐÃ NHỚ
                </span>
              </div>

              {/* Nút LƯU LẠI CẤU HÌNH CHẤM */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    handleSaveGradingConfiguration();
                    setBottomTab('sessions');
                  }}
                  className="w-full py-4 rounded-2xl bg-[#007aff] hover:bg-blue-600 text-white font-black text-base shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-98 transition"
                >
                  <Save className="w-5 h-5" />
                  <span>LƯU LẠI CẤU HÌNH CHẤM</span>
                </button>
              </div>

              {/* Xóa lịch sử bài chấm của phiên hiện tại nếu cần chấm lại từ đầu */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setGradedRecords([]);
                    setStatusBanner({
                      type: 'info',
                      message: 'Đã làm mới danh sách bài chấm của phiên hiện tại.',
                    });
                  }}
                  className="w-full py-3 rounded-2xl bg-white border border-rose-200 text-rose-600 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer hover:bg-rose-50"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Xóa các bài đã chấm trong phiên hiện tại</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* A. THANH ĐIỀU HƯỚNG CHÂN MÀN HÌNH (BOTTOM NAVIGATION BAR CỐ ĐỊNH)     */}
      {/* ===================================================================== */}
      {bottomTab !== 'scanner' && sessionView !== 'graded' && (
        <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 safe-area-bottom-nav">
          <div className="max-w-lg mx-auto px-4 py-1 flex items-center justify-around">
            {/* Tab 1: Đợt chấm */}
            <button
              type="button"
              onClick={() => {
                setBottomTab('sessions');
                setSessionView('list');
              }}
              className={`flex flex-col items-center justify-center py-1 px-3 touch-target-44 cursor-pointer ${
                bottomTab === 'sessions' ? 'text-[#007aff] font-bold' : 'text-slate-500'
              }`}
            >
              <Folder className="w-5 h-5" />
              <span className="text-[11px] mt-0.5">Đợt chấm</span>
            </button>

            {/* Tab 2: Quét bài (Nút tròn lớn màu xanh dương nổi bật ở giữa) */}
            <button
              type="button"
              onClick={enterScannerScreen}
              className="flex flex-col items-center justify-center -mt-6 touch-target-44 cursor-pointer group"
            >
              <div className="w-14 h-14 rounded-full bg-[#007aff] group-hover:bg-blue-600 text-white flex items-center justify-center shadow-lg border-4 border-white transition-transform active:scale-95">
                <Camera className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-bold text-[#007aff] mt-0.5">Quét bài</span>
            </button>

            {/* Tab 3: Cài đặt */}
            <button
              type="button"
              onClick={() => setBottomTab('settings')}
              className={`flex flex-col items-center justify-center py-1 px-3 touch-target-44 cursor-pointer ${
                bottomTab === 'settings' ? 'text-[#007aff] font-bold' : 'text-slate-500'
              }`}
            >
              <Settings className="w-5 h-5" />
              <span className="text-[11px] mt-0.5">Cài đặt</span>
            </button>
          </div>
        </nav>
      )}

      {/* ===================================================================== */}
      {/* KHAY TRƯỢT ĐÁY (BOTTOM SHEET SELECTOR 75% CHIỀU CAO) CHỌN 14 MẪU PHIẾU */}
      {/* ===================================================================== */}
      {showSheetSelectorBottomSheet && (
        <div
          onClick={() => setShowSheetSelectorBottomSheet(false)}
          className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-2xs flex items-end justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#f2f3f7] w-full max-w-lg rounded-t-3xl h-[80vh] flex flex-col animate-bottom-sheet overflow-hidden shadow-2xl"
          >
            {/* Tay nắm & Header Khay trượt đáy */}
            <div className="bg-white px-4 pt-2.5 pb-3 border-b border-slate-200 shrink-0">
              <div className="w-10 h-1.5 rounded-full bg-slate-300 mx-auto mb-2" />
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Chọn Mẫu Phiếu Chuẩn (14 Mẫu GDPT 2018)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Chạm chọn phiếu để tự động điền số câu P1, P2, P3 & số chữ số mã đề
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSheetSelectorBottomSheet(false)}
                  className="text-slate-500 hover:text-slate-800 font-bold text-sm px-2.5 py-1 rounded-lg"
                >
                  Đóng
                </button>
              </div>

              {/* 3 Tab phân nhóm chuẩn */}
              <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl mt-3">
                {(
                  [
                    { id: 'Khổ ngang (2 bài/A4)', label: 'Khổ ngang (2 bài/A4)' },
                    { id: 'Khổ dọc A4 Chuẩn', label: 'Khổ dọc A4' },
                    { id: 'Azota / TNmaker Tương thích', label: 'Azota / TNmaker' },
                  ] as { id: SheetGroupType; label: string }[]
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSheetGroupTab(tab.id)}
                    className={`py-2 px-1.5 rounded-lg text-xs font-bold truncate transition cursor-pointer ${
                      sheetGroupTab === tab.id
                        ? 'bg-[#007aff] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Danh sách các mẫu phiếu kèm ảnh thực tế + nút CHỌN + nút Tải PDF */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
              {SHEET_DATABASE.filter((s) => s.group === sheetGroupTab).map((item) => {
                const isCurrent = item.id === draftTemplateId;
                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-3xl overflow-hidden border-2 shadow-sm transition ${
                      isCurrent ? 'border-blue-600 ring-2 ring-blue-200' : 'border-slate-300 hover:border-blue-400'
                    }`}
                  >
                    {/* Ảnh phiếu gốc thực tế (Bỏ khung ngoài - Nhấn để phóng to) */}
                    <div
                      onClick={() => setPreviewSheetModalItem(item)}
                      className="p-3 bg-slate-50/70 cursor-pointer flex flex-col items-center justify-center group"
                    >
                      <div className="w-full flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-1.5 px-1">
                        <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md font-bold">
                          📄 Phiếu gốc chuẩn
                        </span>
                        <span className="text-slate-400 group-hover:text-blue-600 transition flex items-center gap-0.5">
                          🔍 Chạm để xem to
                        </span>
                      </div>
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full max-h-64 object-contain mx-auto rounded-lg border border-slate-200 shadow-xs bg-white"
                        loading="lazy"
                      />
                    </div>

                    {/* Thanh thông tin và nút CHỌN */}
                    <div className="bg-slate-100/90 border-t border-slate-200 px-4 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-lg font-bold text-slate-900 truncate flex items-center gap-2">
                          <span>{item.name}</span>
                          {isCurrent && (
                            <span className="text-xs bg-blue-600 text-white font-bold px-2 py-0.5 rounded-full">
                              Đang dùng
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-semibold text-slate-700 flex items-center gap-2 flex-wrap mt-0.5">
                          <span className="bg-slate-200 text-slate-800 px-2 py-0.5 rounded font-bold">
                            Mã đề {item.codeLength} số
                          </span>
                          <span>•</span>
                          <span>
                            {item.p1} P1 · {item.p2} P2 · {item.p3} P3
                          </span>
                          <a
                            href={item.pdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-blue-700 hover:text-blue-900 underline font-bold"
                          >
                            Tải PDF in
                          </a>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSelectSheetFromBottomSheet(item)}
                        className="btn-3d btn-3d-blue text-white font-bold text-base px-6 py-2.5 rounded-2xl shadow-md shrink-0 cursor-pointer"
                      >
                        CHỌN
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL XEM TRƯỚC ẢNH PHIẾU PHÓNG TO                                   */}
      {/* ===================================================================== */}
      {previewSheetModalItem && (
        <div
          onClick={() => setPreviewSheetModalItem(null)}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl border border-slate-300 max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
          >
            <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-lg font-bold text-slate-950">
                  {previewSheetModalItem.name}
                </div>
                <div className="text-xs text-slate-600">
                  Mã đề {previewSheetModalItem.codeLength} số · {previewSheetModalItem.p1} P1 · {previewSheetModalItem.p2} P2 · {previewSheetModalItem.p3} P3
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewSheetModalItem(null)}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-3 bg-slate-50 flex-1 overflow-auto flex items-center justify-center">
              <img
                src={previewSheetModalItem.imageUrl}
                alt={previewSheetModalItem.name}
                className="w-full max-h-[65vh] object-contain mx-auto rounded-lg border border-slate-200 shadow-sm bg-white"
              />
            </div>
            <div className="bg-slate-100 border-t border-slate-200 px-5 py-3.5 flex items-center justify-between gap-3">
              <a
                href={previewSheetModalItem.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-blue-700 hover:text-blue-900 underline"
              >
                ⬇ Tải PDF phiếu chuẩn để in
              </a>
              <button
                type="button"
                onClick={() => handleSelectSheetFromBottomSheet(previewSheetModalItem)}
                className="btn-3d btn-3d-blue text-white font-bold text-base px-8 py-2.5 rounded-2xl shadow-md cursor-pointer"
              >
                CHỌN MẪU NÀY
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* IOS BOTTOM ACTION SHEET: THÊM ĐÁP ÁN (GIỐNG HỆT ẢNH 6)                */}
      {/* ===================================================================== */}
      {showKeyActionSheet && (
        <div
          onClick={() => setShowKeyActionSheet(false)}
          className="fixed inset-0 z-50 bg-black/45 flex items-end justify-center p-3"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md space-y-2 animate-bottom-sheet safe-area-bottom-nav"
          >
            <div className="bg-white/95 backdrop-blur-md rounded-2xl overflow-hidden divide-y divide-slate-200 text-center">
              <div className="py-3 text-xs font-medium text-slate-400">Thêm đáp án</div>

              <button
                type="button"
                onClick={() => {
                  const defaultLen = activeDbSheet.codeLength;
                  const nextNum = 101 + Object.keys(answerKeys).length;
                  const newCode =
                    defaultLen === 4 ? String(nextNum).padStart(4, '0') : String(nextNum);
                  setAnswerKeys((prev) => ({
                    ...prev,
                    [newCode]: {
                      examCode: newCode,
                      p1: new Array(40).fill('A'),
                      p2: Array.from({ length: 16 }, () => ({
                        a: 'D',
                        b: 'D',
                        c: 'D',
                        d: 'D',
                      })),
                      p3: new Array(12).fill(16),
                    },
                  }));
                  setSelectedExamCodeView(newCode);
                  setShowKeyActionSheet(false);
                }}
                className="w-full py-3.5 text-[#007aff] text-lg font-normal active:bg-slate-100 cursor-pointer"
              >
                Nhập thủ công
              </button>

              <label className="block w-full py-3.5 text-[#007aff] text-lg font-normal active:bg-slate-100 cursor-pointer">
                Chọn ảnh mã QR
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleScanUploadedQrImage(f);
                    e.target.value = '';
                    setShowKeyActionSheet(false);
                  }}
                />
              </label>

              <button
                type="button"
                onClick={() => {
                  setShowKeyActionSheet(false);
                  setIsQrCameraOpen(true);
                }}
                className="w-full py-3.5 text-[#007aff] text-lg font-normal active:bg-slate-100 cursor-pointer"
              >
                Quét mã QR
              </button>

              <label className="block w-full py-3.5 text-[#007aff] text-lg font-normal active:bg-slate-100 cursor-pointer">
                Nhập file Excel
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImportExcelAnswerKey(f);
                    e.target.value = '';
                    setShowKeyActionSheet(false);
                  }}
                />
              </label>

              <button
                type="button"
                onClick={() => {
                  handleLoadBuiltInSampleQrImage();
                  setShowKeyActionSheet(false);
                }}
                className="w-full py-3.5 text-emerald-600 text-base font-bold active:bg-slate-100 cursor-pointer"
              >
                ⚡ Nạp Đáp Án Mẫu Chuẩn GDPT 2018
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowKeyActionSheet(false)}
              className="w-full bg-white rounded-2xl py-3.5 text-[#007aff] text-lg font-bold shadow-sm cursor-pointer"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* IOS BOTTOM ACTION SHEET: XUẤT KẾT QUẢ (GIỐNG HỆT ẢNH 8)               */}
      {/* ===================================================================== */}
      {showExportActionSheet && (
        <div
          onClick={() => setShowExportActionSheet(false)}
          className="fixed inset-0 z-50 bg-black/45 flex items-end justify-center p-3"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md space-y-2 animate-bottom-sheet safe-area-bottom-nav"
          >
            <div className="bg-white/95 backdrop-blur-md rounded-2xl overflow-hidden divide-y divide-slate-200 text-center">
              <div className="py-3 text-xs font-medium text-slate-400">Xuất kết quả</div>

              <button
                type="button"
                onClick={() => handleExportExcelByType('scores')}
                className="w-full py-3.5 text-[#007aff] text-lg font-normal active:bg-slate-100 cursor-pointer"
              >
                Xuất kết quả điểm
              </button>

              <button
                type="button"
                onClick={() => handleExportExcelByType('choices')}
                className="w-full py-3.5 text-[#007aff] text-lg font-normal active:bg-slate-100 cursor-pointer"
              >
                Xuất kết quả lựa chọn
              </button>

              <button
                type="button"
                onClick={() => handleExportExcelByType('truefalse')}
                className="w-full py-3.5 text-[#007aff] text-lg font-normal active:bg-slate-100 cursor-pointer"
              >
                Xuất kết quả đúng sai
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowExportActionSheet(false);
                  handleExportZipAllEvidenceImages();
                }}
                className="w-full py-3.5 text-emerald-600 text-lg font-bold active:bg-slate-100 cursor-pointer flex items-center justify-center gap-2"
              >
                <FileArchive className="w-5 h-5 text-emerald-600" />
                <span>Tải toàn bộ ảnh minh chứng (.ZIP)</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowExportActionSheet(false)}
              className="w-full bg-white rounded-2xl py-3.5 text-[#007aff] text-lg font-bold shadow-sm cursor-pointer"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL HƯỚNG DẪN SỬ DỤNG & TẠO PHÍM TẮT MÀN HÌNH CHÍNH (IOS & ANDROID) */}
      {/* ===================================================================== */}
      {showGuideModal && (
        <div
          onClick={() => setShowGuideModal(false)}
          className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-2xs flex items-center justify-center p-3"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-lg w-full max-h-[88vh] flex flex-col overflow-hidden shadow-2xl"
          >
            <div className="px-5 py-4 bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 text-white flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base">
                  Hướng Dẫn Sử Dụng & Cài Phím Tắt — Edu Chấm Đề
                </h3>
                <p className="text-xs text-cyan-100 font-semibold">
                  Tác giả: Thầy Hồ Tấn Khải — Trường THPT Mang Thít, Tỉnh Vĩnh Long
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 rounded-lg bg-white/20 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 text-xs sm:text-sm text-slate-700 leading-relaxed">
              <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 space-y-1 shadow-sm">
                <div className="font-bold text-blue-900">
                  1. Cơ sở dữ liệu 14 mẫu phiếu chuẩn GDPT 2018 & CV 1239
                </div>
                <p>
                  Tích hợp đầy đủ 3 nhóm phiếu: <strong>Khổ ngang (2 bài/A4)</strong>,{' '}
                  <strong>Khổ dọc A4 Chuẩn</strong> (Edu 2025, Bộ GD, CV 1239 mã đề 4 số) và{' '}
                  <strong>Azota / TNmaker</strong>. Khi chọn mẫu phiếu từ khay trượt đáy, hệ thống
                  tự động điền số câu P1, P2, P3 và gạt đúng mã đề 3 số / 4 số.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1 shadow-sm">
                <div className="font-bold text-emerald-900">
                  2. Bảo toàn 100% tọa độ OMR & Quét 4 góc định vị
                </div>
                <p>
                  Đưa 4 ô vuông đen ở 4 góc phiếu vào 4 khung vuông màu xanh lá trên màn hình
                  Camera. Hệ thống tự động nắn phẳng Perspective Transform 1024x550 và khoanh tròn
                  xanh (đúng), đỏ (sai), vàng (đáp án đúng của câu bỏ trống).
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 space-y-1 shadow-sm">
                <div className="font-bold text-amber-900">
                  3. Hướng dẫn tạo phím tắt màn hình chính (iPhone & Android)
                </div>
                <p>
                  • <strong>iPhone (Safari):</strong> Nhấn nút <strong>Chia sẻ (Share)</strong> ở
                  thanh dưới cùng → Chọn <strong>&ldquo;Thêm vào MH chính&rdquo; (Add to Home Screen)</strong>.
                  <br />• <strong>Android (Chrome):</strong> Nhấn biểu tượng <strong>⋮ (3 chấm)</strong>{' '}
                  góc trên phải → Chọn <strong>&ldquo;Cài đặt ứng dụng&rdquo;</strong> hoặc{' '}
                  <strong>&ldquo;Thêm vào màn hình chính&rdquo;</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL CẢNH BÁO BẮT BUỘC PHẢI CÓ ĐÁP ÁN TRƯỚC KHI CHẤM BÀI              */}
      {/* ===================================================================== */}
      {showNoKeyWarningModal && (
        <div
          onClick={() => setShowNoKeyWarningModal(false)}
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl p-5 sm:p-6 max-w-sm w-full shadow-2xl border-2 border-rose-300 animate-bottom-sheet text-center space-y-4"
          >
            <div className="w-16 h-16 rounded-3xl bg-rose-100 text-rose-600 mx-auto flex items-center justify-center shadow-inner border border-rose-200">
              <Key className="w-8 h-8 stroke-[2.2]" />
            </div>

            <div className="space-y-2">
              <h3 className="font-black text-lg text-slate-900 leading-snug">
                Chưa Có Đáp Án Cho Đề Thi!
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Khi bắt đầu cấu hình chấm, <strong>bắt buộc phải nhập hoặc quét đáp án trước mới chấm được</strong>, để tránh trường hợp giáo viên quên ra kết quả chấm sai của học sinh.
              </p>
            </div>

            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setShowNoKeyWarningModal(false);
                  setSessionView('keys');
                }}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-sm shadow-[0_4px_0_#1e3a8a] active:translate-y-0.5 active:shadow-[0_1px_0_#1e3a8a] transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Key className="w-4 h-4" />
                <span>👉 NHẬP ĐÁP ÁN NGAY</span>
              </button>

              <button
                type="button"
                onClick={() => setShowNoKeyWarningModal(false)}
                className="w-full py-2.5 px-4 rounded-xl text-slate-500 hover:text-slate-800 text-xs font-bold cursor-pointer"
              >
                Để sau / Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
