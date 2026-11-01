import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  BookOpen,
  Calculator,
  Camera,
  CheckCircle2,
  Compass,
  Download,
  Edit3,
  FileCode,
  FileSpreadsheet,
  Flashlight,
  Globe,
  Layers,
  Play,
  QrCode,
  Sliders,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  AnswerKeyData,
  DEFAULT_QR_JSON_RAW,
  getTemplateBubbleMap,
  parseQM2025QrPayload,
  renderVectorFallbackSheet1024x550,
  SAMPLE_QR_IMAGE_URL,
  TARGET_CORNERS_1024x550,
  TemplateId,
  TEMPLATES,
} from './omr/templates';
import {
  detectFourCornerMarkers,
  generateSimulatedSheetCanvas,
  gradeWarpedSheet,
  interfaceGradedSheetRecord,
  OMRSettings,
  recalculateRecordScore,
  warpPerspectiveTo1024x550,
} from './omr/visionEngine';

type ActiveTab = 'keys' | 'camera' | 'scores';

const STORAGE_KEYS = {
  TEMPLATE: 'educhamde2025_active_template_v2',
  ANSWER_KEYS: 'educhamde2025_answer_keys_v2',
  GRADED_RECORDS: 'educhamde2025_graded_records_v2',
  OMR_SETTINGS: 'educhamde2025_omr_settings_v2',
};

function playSuccessBeep() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046.5, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1318.5, ctx.currentTime + 0.09);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.14);
    if (navigator.vibrate) {
      navigator.vibrate([70, 40, 70]);
    }
  } catch {
    // Ignore audio context restrictions
  }
}

function SubjectIcon({ id, className }: { id: TemplateId; className?: string }) {
  if (id === 'toan') return <Calculator className={className} />;
  if (id === 'khtn') return <Compass className={className} />;
  if (id === 'khxh') return <BookOpen className={className} />;
  return <Globe className={className} />;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('keys');
  const [templateId, setTemplateId] = useState<TemplateId>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.TEMPLATE);
    return (saved as TemplateId) || 'khtn';
  });

  // Quản lý bộ đáp án theo mã đề
  const [answerKeys, setAnswerKeys] = useState<Record<string, AnswerKeyData>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ANSWER_KEYS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Object.keys(parsed).length > 0) return parsed;
      }
    } catch {
      // Fallback to default
    }
    const list = parseQM2025QrPayload(DEFAULT_QR_JSON_RAW, 'khtn');
    const map: Record<string, AnswerKeyData> = {};
    list.forEach((k) => {
      map[k.examCode] = k;
    });
    return map;
  });

  const [selectedExamCode, setSelectedExamCode] = useState<string>('101');
  const [qrRawInput, setQrRawInput] = useState<string>(DEFAULT_QR_JSON_RAW);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Cấu hình tinh chỉnh tọa độ OMR
  const [omrSettings, setOmrSettings] = useState<OMRSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.OMR_SETTINGS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return {
      fillThreshold: 0.36,
      offsetX: 0,
      offsetY: 0,
      radiusScale: 1.0,
    };
  });

  const [showMatrixPreview, setShowMatrixPreview] = useState<boolean>(true);
  const matrixCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Danh sách bài đã chấm
  const [gradedRecords, setGradedRecords] = useState<interfaceGradedSheetRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.GRADED_RECORDS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [];
  });

  // Trạng thái Camera Chấm Thi
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [torchActive, setTorchActive] = useState<boolean>(false);
  const [continuousScan, setContinuousScan] = useState<boolean>(true);
  const [cornersLocked, setCornersLocked] = useState<boolean>(false);
  const [activeRecordHud, setActiveRecordHud] = useState<interfaceGradedSheetRecord | null>(null);
  const [quickEditModalOpen, setQuickEditModalOpen] = useState<boolean>(false);

  // Trạng thái Giả lập phiếu tô để chấm thử nhanh
  const [simSbd, setSimSbd] = useState<string>('020158');
  const [simExamCode, setSimExamCode] = useState<string>('101');
  const [simAccuracy, setSimAccuracy] = useState<number>(0.88);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Trạng thái Modal Quét QR Đáp Án
  const [qrModalOpen, setQrModalOpen] = useState<boolean>(false);
  const qrVideoRef = useRef<HTMLVideoElement | null>(null);
  const qrStreamRef = useRef<MediaStream | null>(null);

  // Refs cho Camera Chấm Thi
  const gradingVideoRef = useRef<HTMLVideoElement | null>(null);
  const gradingOverlayRef = useRef<HTMLCanvasElement | null>(null);
  const gradingStreamRef = useRef<MediaStream | null>(null);
  const stableCornerFramesRef = useRef<number>(0);
  const lastAutoGradeTimestampRef = useRef<number>(0);

  // Lưu LocalStorage khi dữ liệu thay đổi
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TEMPLATE, templateId);
  }, [templateId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ANSWER_KEYS, JSON.stringify(answerKeys));
  }, [answerKeys]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.GRADED_RECORDS, JSON.stringify(gradedRecords));
  }, [gradedRecords]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.OMR_SETTINGS, JSON.stringify(omrSettings));
  }, [omrSettings]);

  useEffect(() => {
    const codes = Object.keys(answerKeys);
    if (codes.length > 0 && !answerKeys[selectedExamCode]) {
      setSelectedExamCode(codes[0]);
    }
  }, [answerKeys, selectedExamCode]);

  // Vẽ bản đồ Ma trận tọa độ OMR lên ảnh mẫu phiếu thực tế ở Tab 1 (có Vector Fallback chống lỗi ảnh)
  useEffect(() => {
    if (!showMatrixPreview || activeTab !== 'keys') return;
    const canvas = matrixCanvasRef.current;
    if (!canvas) return;

    const drawOverlayRings = (baseWarped: HTMLCanvasElement) => {
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(baseWarped, 0, 0);

      const cPts = [
        TARGET_CORNERS_1024x550.tl,
        TARGET_CORNERS_1024x550.tr,
        TARGET_CORNERS_1024x550.bl,
        TARGET_CORNERS_1024x550.br,
      ];
      for (const c of cPts) {
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 3;
        ctx.strokeRect(c.x - 14, c.y - 14, 28, 28);
      }

      const map = getTemplateBubbleMap(
        templateId,
        omrSettings.offsetX,
        omrSettings.offsetY,
        omrSettings.radiusScale
      );

      const drawGroup = (bubbles: { x: number; y: number; r: number }[], color: string) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        for (const b of bubbles) {
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          ctx.stroke();
        }
      };

      drawGroup(map.maDe.flat(), '#06b6d4');
      drawGroup(map.sbd.flat(), '#3b82f6');
      drawGroup(map.p1.flat(), '#10b981');
      map.p2.forEach((q) => {
        drawGroup([...q.a, ...q.b, ...q.c, ...q.d], '#f59e0b');
      });
      map.p3.forEach((q) => {
        drawGroup([q.minus, q.comma1, q.comma2, ...q.digits.flat()], '#ec4899');
      });
    };

    const tpl = TEMPLATES[templateId];
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const tmp = document.createElement('canvas');
      tmp.width = img.width;
      tmp.height = img.height;
      const tCtx = tmp.getContext('2d')!;
      tCtx.drawImage(img, 0, 0);
      const rawData = tCtx.getImageData(0, 0, img.width, img.height);
      const corners = detectFourCornerMarkers(rawData);
      const warped = warpPerspectiveTo1024x550(rawData, corners);
      drawOverlayRings(warped);
    };
    img.onerror = () => {
      const fallback = renderVectorFallbackSheet1024x550(templateId);
      drawOverlayRings(fallback);
    };
    img.src = tpl.imageUrl;
  }, [templateId, omrSettings, showMatrixPreview, activeTab]);

  // Chuyển mẫu phiếu và tự động cập nhật cấu trúc đáp án tương ứng
  const handleSelectTemplate = (newTplId: TemplateId) => {
    setTemplateId(newTplId);
    try {
      const parsedList = parseQM2025QrPayload(qrRawInput, newTplId);
      if (parsedList.length > 0) {
        const nextMap: Record<string, AnswerKeyData> = {};
        parsedList.forEach((item) => {
          nextMap[item.examCode] = item;
        });
        setAnswerKeys(nextMap);
      }
    } catch {
      // Keep current keys
    }
  };

  // Giải mã chuỗi JSON QR từ ô nhập hoặc máy quét QR
  const applyQrPayloadString = (rawStr: string, customTplId?: TemplateId) => {
    const targetTpl = customTplId || templateId;
    try {
      const list = parseQM2025QrPayload(rawStr, targetTpl);
      if (list.length === 0) {
        setStatusBanner({
          type: 'error',
          text: 'Không tìm thấy mã đề nào trong chuỗi dữ liệu QR.',
        });
        return false;
      }
      const map: Record<string, AnswerKeyData> = {};
      list.forEach((item) => {
        map[item.examCode] = item;
      });
      setAnswerKeys(map);
      setSelectedExamCode(list[0].examCode);
      setQrRawInput(rawStr.trim());
      playSuccessBeep();
      setStatusBanner({
        type: 'success',
        text: `Đã nạp thành công ${list.length} mã đề (${list.map((x) => x.examCode).join(', ')}) cho ${TEMPLATES[targetTpl].name}!`,
      });
      return true;
    } catch (err) {
      setStatusBanner({
        type: 'error',
        text: `Lỗi định dạng chuỗi QR JSON: ${(err as Error).message}`,
      });
      return false;
    }
  };

  // Quét trực tiếp từ ảnh QR mẫu đính kèm của người dùng (Sinh học 12 - Mã 101..104)
  const handleScanAttachedSampleQrImage = () => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, c.width, c.height);
      const decoded = jsQR(imgData.data, imgData.width, imgData.height);
      if (decoded && decoded.data) {
        applyQrPayloadString(decoded.data);
      } else {
        applyQrPayloadString(DEFAULT_QR_JSON_RAW);
      }
    };
    img.onerror = () => {
      applyQrPayloadString(DEFAULT_QR_JSON_RAW);
    };
    img.src = SAMPLE_QR_IMAGE_URL;
  };

  // Quét mã QR từ file ảnh do giáo viên chọn
  const handleQrImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, c.width, c.height);
      const code = jsQR(imgData.data, imgData.width, imgData.height);
      if (code && code.data) {
        applyQrPayloadString(code.data);
        closeQrModal();
      } else {
        setStatusBanner({
          type: 'error',
          text: 'Không nhận diện được mã QR trong bức ảnh này. Hãy chọn ảnh rõ nét hơn.',
        });
      }
    };
    img.src = URL.createObjectURL(file);
  };

  // Nhập file Excel đáp án chuẩn QM2025 (.xlsx)
  const handleExcelAnswerKeyUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1 });
        const dataRows = rows.filter(
          (r) =>
            Array.isArray(r) &&
            r.length >= 10 &&
            !Number.isNaN(Number(r[0])) &&
            String(r[0]).trim() !== ''
        );
        if (dataRows.length === 0) {
          setStatusBanner({
            type: 'error',
            text: 'Không tìm thấy dòng mã đề hợp lệ trong file Excel.',
          });
          return;
        }
        const jsonStr = JSON.stringify(dataRows);
        applyQrPayloadString(jsonStr);
      } catch (err) {
        setStatusBanner({
          type: 'error',
          text: `Không thể đọc file Excel: ${(err as Error).message}`,
        });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Mở / Đóng Camera Quét QR Đáp Án
  const openQrModal = async () => {
    setQrModalOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      qrStreamRef.current = stream;
      if (qrVideoRef.current) {
        qrVideoRef.current.srcObject = stream;
        await qrVideoRef.current.play();
      }
    } catch {
      setStatusBanner({
        type: 'info',
        text: 'Không mở được Camera trực tiếp. Thầy/cô có thể tải ảnh mã QR từ máy lên để giải mã.',
      });
    }
  };

  const closeQrModal = () => {
    setQrModalOpen(false);
    if (qrStreamRef.current) {
      qrStreamRef.current.getTracks().forEach((t) => t.stop());
      qrStreamRef.current = null;
    }
  };

  useEffect(() => {
    if (!qrModalOpen) return;
    let animId = 0;
    const scanFrame = () => {
      const video = qrVideoRef.current;
      if (video && video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
        const c = document.createElement('canvas');
        c.width = video.videoWidth;
        c.height = video.videoHeight;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(video, 0, 0, c.width, c.height);
        const imgData = ctx.getImageData(0, 0, c.width, c.height);
        const code = jsQR(imgData.data, imgData.width, imgData.height);
        if (code && code.data) {
          if (applyQrPayloadString(code.data)) {
            closeQrModal();
            return;
          }
        }
      }
      animId = requestAnimationFrame(scanFrame);
    };
    animId = requestAnimationFrame(scanFrame);
    return () => cancelAnimationFrame(animId);
  }, [qrModalOpen]);

  // Bật / Tắt Camera Chấm Thi ở Tab 2
  const startGradingCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      gradingStreamRef.current = stream;
      setCameraActive(true);
      if (gradingVideoRef.current) {
        gradingVideoRef.current.srcObject = stream;
        await gradingVideoRef.current.play();
      }
    } catch {
      setStatusBanner({
        type: 'info',
        text: 'Trình duyệt chưa cấp quyền Camera. Thầy/cô có thể dùng "Tô & Chấm Thử" hoặc "Chấm Từ Ảnh Phiếu" bên dưới!',
      });
    }
  };

  const stopGradingCamera = () => {
    if (gradingStreamRef.current) {
      gradingStreamRef.current.getTracks().forEach((t) => t.stop());
      gradingStreamRef.current = null;
    }
    setCameraActive(false);
    setTorchActive(false);
    setCornersLocked(false);
  };

  useEffect(() => {
    if (activeTab !== 'camera') {
      stopGradingCamera();
    }
  }, [activeTab]);

  // Bật/Tắt đèn Flash (Torch) trên điện thoại
  const handleToggleTorch = async () => {
    if (!gradingStreamRef.current) return;
    const track = gradingStreamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextState = !torchActive;
      await track.applyConstraints({
        advanced: [{ torch: nextState } as MediaTrackConstraintSet],
      });
      setTorchActive(nextState);
    } catch {
      setStatusBanner({
        type: 'info',
        text: 'Thiết bị hoặc trình duyệt hiện tại không hỗ trợ điều khiển đèn Flash trực tiếp.',
      });
    }
  };

  // Vòng lặp thời gian thực phát hiện 4 góc vuông đen trên Camera
  useEffect(() => {
    if (!cameraActive) return;
    let rafId = 0;

    const processFrame = () => {
      const video = gradingVideoRef.current;
      const overlay = gradingOverlayRef.current;
      if (
        video &&
        overlay &&
        video.readyState === video.HAVE_ENOUGH_DATA &&
        video.videoWidth > 0
      ) {
        const procW = 640;
        const procH = Math.round((640 * video.videoHeight) / video.videoWidth);
        const tmp = document.createElement('canvas');
        tmp.width = procW;
        tmp.height = procH;
        const tCtx = tmp.getContext('2d')!;
        tCtx.drawImage(video, 0, 0, procW, procH);
        const imgData = tCtx.getImageData(0, 0, procW, procH);
        const det = detectFourCornerMarkers(imgData);

        overlay.width = procW;
        overlay.height = procH;
        const oCtx = overlay.getContext('2d')!;
        oCtx.clearRect(0, 0, procW, procH);

        if (det.found) {
          stableCornerFramesRef.current += 1;
          const isLocked = stableCornerFramesRef.current >= 4;
          setCornersLocked(isLocked);

          oCtx.strokeStyle = isLocked ? '#10b981' : '#f59e0b';
          oCtx.lineWidth = 3;
          oCtx.beginPath();
          oCtx.moveTo(det.tl.x, det.tl.y);
          oCtx.lineTo(det.tr.x, det.tr.y);
          oCtx.lineTo(det.br.x, det.br.y);
          oCtx.lineTo(det.bl.x, det.bl.y);
          oCtx.closePath();
          oCtx.stroke();

          for (const pt of [det.tl, det.tr, det.bl, det.br]) {
            oCtx.fillStyle = isLocked ? '#10b981' : '#f59e0b';
            oCtx.fillRect(pt.x - 7, pt.y - 7, 14, 14);
          }

          if (
            isLocked &&
            continuousScan &&
            Date.now() - lastAutoGradeTimestampRef.current > 3200
          ) {
            lastAutoGradeTimestampRef.current = Date.now();
            stableCornerFramesRef.current = 0;
            captureCurrentVideoFrameAndGrade();
          }
        } else {
          stableCornerFramesRef.current = 0;
          setCornersLocked(false);

          const padX = procW * 0.06;
          const padY = procH * 0.09;
          const len = 28;
          oCtx.strokeStyle = '#f59e0b';
          oCtx.lineWidth = 3;

          oCtx.beginPath();
          oCtx.moveTo(padX, padY + len);
          oCtx.lineTo(padX, padY);
          oCtx.lineTo(padX + len, padY);
          oCtx.stroke();

          oCtx.beginPath();
          oCtx.moveTo(procW - padX - len, padY);
          oCtx.lineTo(procW - padX, padY);
          oCtx.lineTo(procW - padX, padY + len);
          oCtx.stroke();

          oCtx.beginPath();
          oCtx.moveTo(padX, procH - padY - len);
          oCtx.lineTo(padX, procH - padY);
          oCtx.lineTo(padX + len, procH - padY);
          oCtx.stroke();

          oCtx.beginPath();
          oCtx.moveTo(procW - padX - len, procH - padY);
          oCtx.lineTo(procW - padX, procH - padY);
          oCtx.lineTo(procW - padX, procH - padY - len);
          oCtx.stroke();
        }
      }
      rafId = requestAnimationFrame(processFrame);
    };

    rafId = requestAnimationFrame(processFrame);
    return () => cancelAnimationFrame(rafId);
  }, [cameraActive, continuousScan, templateId, answerKeys, omrSettings]);

  // Chụp khung hình video hiện tại và chấm điểm
  const captureCurrentVideoFrameAndGrade = () => {
    const video = gradingVideoRef.current;
    if (!video || video.videoWidth === 0) return;

    const fullCanvas = document.createElement('canvas');
    fullCanvas.width = video.videoWidth;
    fullCanvas.height = video.videoHeight;
    const ctx = fullCanvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0);
    const imgData = ctx.getImageData(0, 0, fullCanvas.width, fullCanvas.height);

    const corners = detectFourCornerMarkers(imgData);
    const warped = warpPerspectiveTo1024x550(imgData, corners);
    const record = gradeWarpedSheet(warped, templateId, answerKeys, omrSettings);

    saveAndDisplayGradedRecord(record);
  };

  // Chấm điểm từ file ảnh phiếu chụp sẵn
  const handleUploadSheetPhotoToGrade = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, c.width, c.height);
      const corners = detectFourCornerMarkers(imgData);
      const warped = warpPerspectiveTo1024x550(imgData, corners);
      const record = gradeWarpedSheet(warped, templateId, answerKeys, omrSettings);
      saveAndDisplayGradedRecord(record);
    };
    img.src = URL.createObjectURL(file);
  };

  // Tạo phiếu tô giả lập bằng bút chì 2B trên đúng mẫu phiếu đang chọn và chấm thử ngay
  const handleSimulateAndGradeSheet = async () => {
    setIsSimulating(true);
    try {
      const targetKey =
        answerKeys[simExamCode] ||
        Object.values(answerKeys)[0] ||
        parseQM2025QrPayload(DEFAULT_QR_JSON_RAW, templateId)[0];
      const simulatedWarpedCanvas = await generateSimulatedSheetCanvas(
        templateId,
        simSbd,
        targetKey.examCode,
        targetKey,
        simAccuracy
      );
      const record = gradeWarpedSheet(
        simulatedWarpedCanvas,
        templateId,
        answerKeys,
        omrSettings
      );
      saveAndDisplayGradedRecord(record);
      const nextNum = (Number(simSbd) || 20158) + 1;
      setSimSbd(String(nextNum).padStart(6, '0'));
    } catch (err) {
      setStatusBanner({
        type: 'error',
        text: `Không thể tạo phiếu giả lập: ${(err as Error).message}`,
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const saveAndDisplayGradedRecord = (record: interfaceGradedSheetRecord) => {
    playSuccessBeep();
    setActiveRecordHud(record);
    setGradedRecords((prev) => {
      const existingIdx = prev.findIndex(
        (r) => !record.sbd.includes('?') && r.sbd === record.sbd
      );
      if (existingIdx !== -1) {
        const clone = [...prev];
        clone[existingIdx] = record;
        return clone;
      }
      return [record, ...prev];
    });
  };

  // Cập nhật bài làm khi giáo viên "Sửa nhanh bài làm"
  const handleUpdateRecordInHud = (updated: interfaceGradedSheetRecord) => {
    const recalculated = recalculateRecordScore(updated, answerKeys);
    setActiveRecordHud(recalculated);
    setGradedRecords((prev) =>
      prev.map((item) => (item.id === recalculated.id ? recalculated : item))
    );
  };

  // Xuất file Excel chuẩn VnEdu / SMAS (.xlsx)
  const handleExportExcel = () => {
    if (gradedRecords.length === 0) {
      setStatusBanner({
        type: 'info',
        text: 'Chưa có bài chấm nào trong Sổ điểm để xuất Excel.',
      });
      return;
    }
    const rows = gradedRecords.map((r, index) => ({
      STT: index + 1,
      'Số Báo Danh': r.sbd,
      'Mã Đề': r.examCode,
      'Điểm P1': r.p1Score,
      'Điểm P2': r.p2Score,
      'Điểm P3': r.p3Score,
      'Tổng Điểm': r.totalScore,
      'Mẫu Phiếu': TEMPLATES[r.templateId]?.shortName || r.templateId,
      'Thời Gian Chấm': r.timestamp,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 15 },
      { wch: 10 },
      { wch: 11 },
      { wch: 11 },
      { wch: 11 },
      { wch: 13 },
      { wch: 22 },
      { wch: 15 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'EduChamDe2025');
    XLSX.writeFile(
      workbook,
      `EduChamDe2025_${templateId.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  // Tải về bản Single-File HTML độc lập (index.html) chuẩn GitHub Pages
  const handleDownloadStandaloneHtml = async () => {
    try {
      const res = await fetch('./qm2025-standalone.html');
      const htmlText = await res.text();
      const blob = new Blob([htmlText], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'index.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusBanner({
        type: 'success',
        text: 'Đã tải xuống tệp index.html độc lập (có thể mở ngay trên điện thoại hoặc đẩy trực tiếp lên GitHub Pages)!',
      });
    } catch {
      window.location.href = './qm2025-standalone.html';
    }
  };

  const currentTpl = TEMPLATES[templateId];
  const currentKey = answerKeys[selectedExamCode];

  // Thống kê phổ điểm ở Tab 3
  const stats = React.useMemo(() => {
    if (gradedRecords.length === 0) {
      return {
        avg: 0,
        max: 0,
        min: 0,
        passCount: 0,
        passRate: 0,
        buckets: new Array(10).fill(0),
      };
    }
    const scores = gradedRecords.map((r) => r.totalScore);
    const sum = scores.reduce((a, b) => a + b, 0);
    const avg = Math.round((sum / scores.length) * 100) / 100;
    const max = Math.max(...scores);
    const min = Math.min(...scores);
    const passCount = scores.filter((s) => s >= 5.0).length;
    const passRate = Math.round((passCount / scores.length) * 1000) / 10;

    const buckets = new Array(10).fill(0);
    scores.forEach((s) => {
      const idx = Math.min(9, Math.max(0, Math.floor(s)));
      buckets[idx]++;
    });
    return { avg, max, min, passCount, passRate, buckets };
  }, [gradedRecords]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-20 md:pb-8">
      {/* TOP BAR CONTRACT: 3 ZONES */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
          {/* Zone 1: Single Brand Wordmark with 3D SVG Emblem */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('keys');
            }}
            className="flex items-center gap-2.5 text-base sm:text-lg font-extrabold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            <svg
              className="w-8 h-8 shrink-0"
              viewBox="0 0 40 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                x="2"
                y="5"
                width="36"
                height="33"
                rx="10"
                fill="#065F46"
              />
              <rect
                x="2"
                y="2"
                width="36"
                height="33"
                rx="10"
                fill="url(#eduGrad)"
                stroke="#34D399"
                strokeWidth="1.2"
              />
              <rect x="8" y="8" width="5" height="5" rx="1" fill="#FFFFFF" />
              <rect x="27" y="8" width="5" height="5" rx="1" fill="#FFFFFF" />
              <rect x="8" y="24" width="5" height="5" rx="1" fill="#FFFFFF" />
              <rect x="27" y="24" width="5" height="5" rx="1" fill="#FFFFFF" />
              <path
                d="M15.5 18.5L18.8 21.8L25.5 15"
                stroke="#FFFFFF"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <defs>
                <linearGradient id="eduGrad" x1="2" y1="2" x2="38" y2="35" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#10B981" />
                  <stop offset="0.55" stopColor="#059669" />
                  <stop offset="1" stopColor="#0284C7" />
                </linearGradient>
              </defs>
            </svg>
            <span>Edu Chấm Đề 2025</span>
          </a>

          {/* Zone 2: Navigation Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
            <button
              onClick={() => setActiveTab('keys')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-0.5 cursor-pointer ${
                activeTab === 'keys'
                  ? 'text-emerald-400 border-b-2 border-emerald-400 font-semibold'
                  : ''
              }`}
            >
              1. Quản Lý Ca Thi & Đáp Án
            </button>
            <button
              onClick={() => setActiveTab('camera')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-0.5 cursor-pointer ${
                activeTab === 'camera'
                  ? 'text-emerald-400 border-b-2 border-emerald-400 font-semibold'
                  : ''
              }`}
            >
              2. Camera Chấm Thi
            </button>
            <button
              onClick={() => setActiveTab('scores')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-0.5 cursor-pointer ${
                activeTab === 'scores'
                  ? 'text-emerald-400 border-b-2 border-emerald-400 font-semibold'
                  : ''
              }`}
            >
              3. Sổ Điểm & Xuất Excel ({gradedRecords.length})
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action (3D Button) */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleDownloadStandaloneHtml}
              className="btn-3d btn-3d-emerald px-4 py-2 text-xs font-bold text-white rounded-xl whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Tải Bản GitHub Pages</span>
            </button>
          </div>
        </div>
      </header>

      {/* AUTHOR & SCHOOL ATTRIBUTION SUB-BAR */}
      <div className="bg-slate-900/75 border-b border-slate-800/80 px-4 sm:px-6 py-2">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-slate-400">
          <div className="flex items-center flex-wrap gap-1.5">
            <span>Tác giả:</span>
            <strong className="text-slate-100 font-semibold">Hồ Tấn Khải</strong>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-400 font-medium">
              Trường THPT Mang Thít, Tỉnh Vĩnh Long
            </span>
            <span aria-hidden="true">·</span>
            <span>Chuẩn Phiếu QM 2025 Bộ GD&ĐT</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300 font-mono text-[11px]">
            <span className={currentTpl.accentText}>{currentTpl.name}</span>
            <span aria-hidden="true">·</span>
            <span>{Object.keys(answerKeys).length} mã đề đã nạp</span>
          </div>
        </div>
      </div>

      {/* STATUS BANNER */}
      {statusBanner && (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-3">
          <div
            className={`rounded-xl px-4 py-2.5 text-xs font-medium flex items-center justify-between gap-3 border ${
              statusBanner.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-600/60 text-emerald-200'
                : statusBanner.type === 'error'
                ? 'bg-rose-950/80 border-rose-600/60 text-rose-200'
                : 'bg-sky-950/80 border-sky-600/60 text-sky-200'
            }`}
          >
            <span>{statusBanner.text}</span>
            <button
              onClick={() => setStatusBanner(null)}
              className="text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-5 flex-1">
        {/* =====================================================================
            TAB 1: QUẢN LÝ CA THI & NẠP ĐÁP ÁN (3D SUBJECT CARDS)
           ===================================================================== */}
        {activeTab === 'keys' && (
          <div className="space-y-6">
            {/* Bước 1: Chọn Loại Mẫu Phiếu Chuẩn QM 2025 với Phối Màu 3D Riêng Biệt */}
            <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white">
                    01. Chọn Khung Môn Học & Mẫu Phiếu Chuẩn QM 2025
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Mỗi tổ hợp môn học được thiết kế khung nổi 3D và hệ màu nhận diện riêng biệt, tự động đồng bộ thang điểm Bộ GD&ĐT 2025.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
                {(Object.keys(TEMPLATES) as TemplateId[]).map((id) => {
                  const t = TEMPLATES[id];
                  const isSelected = templateId === id;
                  return (
                    <button
                      key={id}
                      onClick={() => handleSelectTemplate(id)}
                      className={`btn-3d text-left p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                        t.card3dClass
                      } ${
                        isSelected
                          ? `${t.accentBorder} ring-2 ring-white/25 scale-[1.01]`
                          : 'border-slate-700/70 opacity-85 hover:opacity-100'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-9 h-9 rounded-xl flex items-center justify-center text-white ${t.btn3dClass}`}
                            >
                              <SubjectIcon id={id} className="w-4 h-4" />
                            </span>
                            <div>
                              <span className={`text-xs font-extrabold block ${t.accentText}`}>
                                {t.name}
                              </span>
                              <span className="text-[11px] text-slate-300 font-mono">
                                {t.shortName}
                              </span>
                            </div>
                          </div>
                          {isSelected && (
                            <CheckCircle2 className={`w-5 h-5 shrink-0 ${t.accentText}`} />
                          )}
                        </div>
                        <p className="text-xs text-slate-300 mt-3 leading-relaxed">
                          {t.subjects}
                        </p>
                      </div>

                      <div className="mt-4 pt-2.5 border-t border-white/10 text-[11px] font-mono text-slate-200 flex items-center justify-between">
                        <span>
                          P.I: {t.p1Count}c ({t.p1TotalPoints}đ)
                        </span>
                        {t.p2Count > 0 && (
                          <>
                            <span>·</span>
                            <span>
                              P.II: {t.p2Count}c ({t.p2TotalPoints}đ)
                            </span>
                          </>
                        )}
                        {t.p3Count > 0 && (
                          <>
                            <span>·</span>
                            <span>
                              P.III: {t.p3Count}c ({t.p3TotalPoints}đ)
                            </span>
                          </>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Bước 2: Quét Mã QR Đáp Án từ Hệ Thống Trộn Đề QM2025 */}
            <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white">
                    02. Nạp Đáp Án Tự Động Bằng Mã QR Hoặc File Excel
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Hỗ trợ giải mã trực tiếp mảng JSON 2 chiều{' '}
                    <code className="text-emerald-300">
                      [[Mã_Đề, P1_C1..18, P2_1a..4d, P3_C1..6], ...]
                    </code>{' '}
                    từ mã QR chung QM2025.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={openQrModal}
                    className={`${currentTpl.btn3dClass} px-4 py-2.5 rounded-xl text-white text-xs font-bold flex items-center gap-2 cursor-pointer whitespace-nowrap`}
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Quét mã QR Đáp Án từ Trộn Đề</span>
                  </button>

                  <button
                    onClick={handleScanAttachedSampleQrImage}
                    className="btn-3d btn-3d-amber px-3.5 py-2.5 rounded-xl text-white text-xs font-bold flex items-center gap-2 cursor-pointer whitespace-nowrap"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Nạp Ảnh QR Sinh Học 12 (Mã 101-104)</span>
                  </button>

                  <label className="btn-3d btn-3d-blue px-3.5 py-2.5 rounded-xl text-white text-xs font-bold flex items-center gap-2 cursor-pointer whitespace-nowrap">
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Nhập File Excel (.xlsx)</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={handleExcelAnswerKeyUpload}
                    />
                  </label>
                </div>
              </div>

              {/* Ô nhập / kiểm tra chuỗi JSON QR trực tiếp */}
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                <div className="lg:col-span-9">
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Chuỗi JSON Đáp Án Chung Đã Giải Mã (có thể chỉnh sửa hoặc dán trực tiếp):
                  </label>
                  <div className="flex gap-2.5">
                    <input
                      type="text"
                      value={qrRawInput}
                      onChange={(e) => setQrRawInput(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-500"
                      placeholder='[[101,"B","C",...]]'
                    />
                    <button
                      onClick={() => applyQrPayloadString(qrRawInput)}
                      className="btn-3d btn-3d-slate px-4 py-2.5 rounded-xl text-white text-xs font-bold shrink-0 cursor-pointer"
                    >
                      Nạp Dữ Liệu
                    </button>
                  </div>
                </div>

                {/* Hộp hiển thị ảnh QR mẫu thực tế */}
                <div className="lg:col-span-3 flex items-center gap-3 bg-slate-950/80 border border-slate-800/80 rounded-xl p-2.5">
                  <img
                    src={SAMPLE_QR_IMAGE_URL}
                    alt="QR Chung Mã 101-104"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                    className="w-14 h-14 rounded-lg object-contain bg-white p-1 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate">
                      QR Chung (Mã 101-104)
                    </div>
                    <div className="text-[11px] text-slate-400">Môn Sinh Học 12 · KTCK I</div>
                    <button
                      onClick={handleScanAttachedSampleQrImage}
                      className="text-[11px] text-emerald-400 hover:underline font-semibold mt-0.5 cursor-pointer"
                    >
                      Quét thử ảnh QR này →
                    </button>
                  </div>
                </div>
              </div>

              {/* Bảng chi tiết Đáp Án từng Mã Đề */}
              <div className="mt-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-300">Danh sách Mã Đề:</span>
                    {Object.keys(answerKeys).map((code) => (
                      <button
                        key={code}
                        onClick={() => setSelectedExamCode(code)}
                        className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                          selectedExamCode === code
                            ? `${currentTpl.btn3dClass} text-white`
                            : 'btn-3d btn-3d-slate text-slate-300'
                        }`}
                      >
                        Mã đề {code}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setActiveTab('camera')}
                    className={`${currentTpl.btn3dClass} px-4 py-2.5 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer`}
                  >
                    <Camera className="w-4 h-4" />
                    <span>Mở Camera Chấm Thi →</span>
                  </button>
                </div>

                {currentKey ? (
                  <div className="bg-slate-950/75 border border-slate-800 rounded-2xl p-4 space-y-5">
                    {/* Phần I */}
                    <div>
                      <div className="flex items-center justify-between mb-2.5">
                        <h3 className={`text-xs font-bold ${currentTpl.accentText}`}>
                          PHẦN I — Trắc Nghiệm Nhiều Lựa Chọn ({currentTpl.p1Count} câu · Tổng{' '}
                          {currentTpl.p1TotalPoints.toFixed(2)} điểm ·{' '}
                          {(currentTpl.p1TotalPoints / currentTpl.p1Count).toFixed(3)} đ/câu)
                        </h3>
                        <span className="text-[11px] text-slate-400">
                          Chạm vào A, B, C, D để đổi đáp án
                        </span>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-9 gap-2">
                        {currentKey.p1.slice(0, currentTpl.p1Count).map((ans, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-900 border border-slate-800 rounded-xl p-2 flex flex-col gap-1.5"
                          >
                            <div className="flex items-center justify-between text-[11px] font-mono">
                              <span className="text-slate-400">Câu {idx + 1}</span>
                              <strong className={currentTpl.accentText}>{ans}</strong>
                            </div>
                            <div className="grid grid-cols-4 gap-1">
                              {['A', 'B', 'C', 'D'].map((ch) => (
                                <button
                                  key={ch}
                                  onClick={() => {
                                    const nextP1 = [...currentKey.p1];
                                    nextP1[idx] = ch;
                                    setAnswerKeys((prev) => ({
                                      ...prev,
                                      [selectedExamCode]: { ...currentKey, p1: nextP1 },
                                    }));
                                  }}
                                  className={`py-1 rounded text-[10px] font-mono font-bold cursor-pointer ${
                                    ans === ch
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-slate-800 text-slate-400 hover:text-white'
                                  }`}
                                >
                                  {ch}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Phần II */}
                    {currentTpl.p2Count > 0 && (
                      <div>
                        <h3 className="text-xs font-bold text-sky-400 mb-2.5">
                          PHẦN II — Trắc Nghiệm Đúng / Sai Lũy Tiến (4 câu · Tổng 4.00 điểm · 1 ý =
                          0.1đ, 2 ý = 0.25đ, 3 ý = 0.5đ, 4 ý = 1.0đ)
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          {currentKey.p2.slice(0, currentTpl.p2Count).map((qObj, qIdx) => (
                            <div
                              key={qIdx}
                              className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2"
                            >
                              <div className="text-xs font-bold text-white font-mono">
                                Câu {qIdx + 1}
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {(['a', 'b', 'c', 'd'] as const).map((subKey) => {
                                  const val = qObj[subKey];
                                  return (
                                    <div
                                      key={subKey}
                                      className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5"
                                    >
                                      <span className="text-xs font-mono text-slate-300">
                                        {subKey})
                                      </span>
                                      <div className="flex gap-1">
                                        {(['D', 'S'] as const).map((ds) => (
                                          <button
                                            key={ds}
                                            onClick={() => {
                                              const nextP2 = [...currentKey.p2];
                                              nextP2[qIdx] = { ...nextP2[qIdx], [subKey]: ds };
                                              setAnswerKeys((prev) => ({
                                                ...prev,
                                                [selectedExamCode]: {
                                                  ...currentKey,
                                                  p2: nextP2,
                                                },
                                              }));
                                            }}
                                            className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold cursor-pointer ${
                                              val === ds
                                                ? ds === 'D'
                                                  ? 'bg-emerald-600 text-white'
                                                  : 'bg-amber-600 text-white'
                                                : 'bg-slate-800 text-slate-400'
                                            }`}
                                          >
                                            {ds === 'D' ? 'Đ' : 'S'}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Phần III */}
                    {currentTpl.p3Count > 0 && (
                      <div>
                        <h3 className="text-xs font-bold text-amber-400 mb-2.5">
                          PHẦN III — Trả Lời Ngắn Dạng Số ({currentTpl.p3Count} câu · Tổng{' '}
                          {currentTpl.p3TotalPoints.toFixed(2)} điểm ·{' '}
                          {(currentTpl.p3TotalPoints / currentTpl.p3Count).toFixed(2)} đ/câu)
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                          {currentKey.p3.slice(0, currentTpl.p3Count).map((val, qIdx) => (
                            <div
                              key={qIdx}
                              className="bg-slate-900 border border-slate-800 rounded-xl p-2.5"
                            >
                              <label className="block text-[11px] text-slate-400 font-mono mb-1">
                                Câu {qIdx + 1} (Tô: {String(val).replace('.', ',').slice(0, 4)})
                              </label>
                              <input
                                type="text"
                                value={String(val)}
                                onChange={(e) => {
                                  const nextP3 = [...currentKey.p3];
                                  nextP3[qIdx] = e.target.value;
                                  setAnswerKeys((prev) => ({
                                    ...prev,
                                    [selectedExamCode]: { ...currentKey, p3: nextP3 },
                                  }));
                                }}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-500"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </section>

            {/* Bước 3: Kiểm tra & Hiệu chuẩn Ma trận Tọa độ OMR */}
            <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Sliders className={`w-4 h-4 ${currentTpl.accentText}`} />
                    <span>
                      03. Bản Đồ Ma Trận Tọa Độ OMR Trên Phiếu Chuẩn (1024 × 550 px)
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Kiểm tra trực quan vị trí các vòng tròn nhận diện: Mã đề (Xanh ngọc) · SBD
                    (Xanh dương) · Phần I (Xanh lá) · Phần II (Vàng) · Phần III (Hồng).
                  </p>
                </div>
                <button
                  onClick={() => setShowMatrixPreview((v) => !v)}
                  className="btn-3d btn-3d-slate px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-200 shrink-0 cursor-pointer"
                >
                  {showMatrixPreview ? 'Ẩn Bản Đồ Tọa Độ' : 'Hiện Bản Đồ Tọa Độ'}
                </button>
              </div>

              {showMatrixPreview && (
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
                    <div>
                      <label className="block text-[11px] text-slate-400 font-mono">
                        Ngưỡng độ đậm tô chì: {Math.round(omrSettings.fillThreshold * 100)}%
                      </label>
                      <input
                        type="range"
                        min="0.22"
                        max="0.55"
                        step="0.02"
                        value={omrSettings.fillThreshold}
                        onChange={(e) =>
                          setOmrSettings((s) => ({
                            ...s,
                            fillThreshold: Number(e.target.value),
                          }))
                        }
                        className="w-full accent-emerald-500 mt-1"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 font-mono">
                        Tinh chỉnh ngang (Offset X): {omrSettings.offsetX}px
                      </label>
                      <input
                        type="range"
                        min="-8"
                        max="8"
                        step="0.5"
                        value={omrSettings.offsetX}
                        onChange={(e) =>
                          setOmrSettings((s) => ({ ...s, offsetX: Number(e.target.value) }))
                        }
                        className="w-full accent-emerald-500 mt-1"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 font-mono">
                        Tinh chỉnh dọc (Offset Y): {omrSettings.offsetY}px
                      </label>
                      <input
                        type="range"
                        min="-8"
                        max="8"
                        step="0.5"
                        value={omrSettings.offsetY}
                        onChange={(e) =>
                          setOmrSettings((s) => ({ ...s, offsetY: Number(e.target.value) }))
                        }
                        className="w-full accent-emerald-500 mt-1"
                      />
                    </div>
                    <div className="flex items-end justify-between gap-2">
                      <div className="flex-1">
                        <label className="block text-[11px] text-slate-400 font-mono">
                          Tỷ lệ bán kính R: {Math.round(omrSettings.radiusScale * 100)}%
                        </label>
                        <input
                          type="range"
                          min="0.8"
                          max="1.25"
                          step="0.05"
                          value={omrSettings.radiusScale}
                          onChange={(e) =>
                            setOmrSettings((s) => ({
                              ...s,
                              radiusScale: Number(e.target.value),
                            }))
                          }
                          className="w-full accent-emerald-500 mt-1"
                        />
                      </div>
                      <button
                        onClick={() =>
                          setOmrSettings({
                            fillThreshold: 0.36,
                            offsetX: 0,
                            offsetY: 0,
                            radiusScale: 1.0,
                          })
                        }
                        className="btn-3d btn-3d-slate px-2.5 py-1.5 rounded-lg text-[11px] text-slate-200 cursor-pointer"
                      >
                        Mặc định
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                    <canvas
                      ref={matrixCanvasRef}
                      width={1024}
                      height={550}
                      className="w-full h-auto block"
                    />
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {/* =====================================================================
            TAB 2: CAMERA CHẤM THI TRỰC TIẾP & GIẢ LẬP CHẤM THỬ
           ===================================================================== */}
        {activeTab === 'camera' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Cột Trái: Khung ngắm Camera & Bộ tạo phiếu giả lập */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="p-3.5 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${
                        cornersLocked
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {cornersLocked
                        ? 'Đã bắt đủ 4 góc định vị (Sẵn sàng quét)'
                        : cameraActive
                        ? 'Đang tìm 4 mốc vuông đen ở 4 góc phiếu...'
                        : `Chế độ Chấm: ${currentTpl.name}`}
                    </span>

                    <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={continuousScan}
                        onChange={(e) => setContinuousScan(e.target.checked)}
                        className="accent-emerald-500 rounded"
                      />
                      <span>Chấm liên tục</span>
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleToggleTorch}
                      disabled={!cameraActive}
                      className={`btn-3d px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                        torchActive
                          ? 'btn-3d-amber text-white'
                          : 'btn-3d-slate text-slate-300 disabled:opacity-50'
                      }`}
                    >
                      <Flashlight className="w-3.5 h-3.5" />
                      <span>Đèn Flash</span>
                    </button>

                    {!cameraActive ? (
                      <button
                        onClick={startGradingCamera}
                        className={`${currentTpl.btn3dClass} px-3.5 py-1.5 rounded-lg text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer`}
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Bật Camera Sau</span>
                      </button>
                    ) : (
                      <button
                        onClick={stopGradingCamera}
                        className="btn-3d btn-3d-rose px-3.5 py-1.5 rounded-lg text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Tắt Camera</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Khung ngắm Video 1024:550 */}
                <div className="relative bg-slate-950 aspect-[1024/550] w-full flex items-center justify-center overflow-hidden">
                  <video
                    ref={gradingVideoRef}
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
                  />
                  <canvas
                    ref={gradingOverlayRef}
                    className={`absolute inset-0 w-full h-full pointer-events-none ${
                      cameraActive ? 'block' : 'hidden'
                    }`}
                  />

                  {!cameraActive && (
                    <div className="text-center p-6 max-w-md space-y-3.5">
                      <div
                        className={`w-14 h-14 rounded-2xl text-white flex items-center justify-center mx-auto ${currentTpl.btn3dClass}`}
                      >
                        <Camera className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm sm:text-base font-bold text-white">
                        Khung Ngắm Bắt 4 Góc — {currentTpl.name}
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Bấm <strong>"Mở Camera Chấm Thi"</strong> để quét phiếu trực tiếp, tải ảnh chụp phiếu từ máy, hoặc bấm <strong>"Chấm Thử Phiếu Giả Lập Ngay"</strong> để kiểm nghiệm thuật toán OMR tức thì.
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                        <button
                          onClick={startGradingCamera}
                          className={`${currentTpl.btn3dClass} px-4 py-2.5 rounded-xl text-white text-xs font-bold flex items-center gap-2 cursor-pointer`}
                        >
                          <Camera className="w-4 h-4" />
                          <span>Mở Camera Chấm Thi</span>
                        </button>
                        <button
                          onClick={handleSimulateAndGradeSheet}
                          disabled={isSimulating}
                          className="btn-3d btn-3d-amber px-4 py-2.5 rounded-xl text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4" />
                          <span>Chấm Thử Phiếu Giả Lập Ngay</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Thanh tác vụ dưới khung ngắm */}
                <div className="p-3.5 bg-slate-950/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <button
                    onClick={captureCurrentVideoFrameAndGrade}
                    disabled={!cameraActive}
                    className={`${currentTpl.btn3dClass} flex-1 min-h-[44px] px-4 py-2.5 rounded-xl disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer`}
                  >
                    <Camera className="w-4 h-4" />
                    <span>Chụp & Chấm Khung Hình Này</span>
                  </button>

                  <label className="btn-3d btn-3d-blue min-h-[44px] px-4 py-2.5 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer">
                    <Upload className="w-4 h-4" />
                    <span>Chấm Từ Ảnh Phiếu</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleUploadSheetPhotoToGrade}
                    />
                  </label>
                </div>
              </div>

              {/* Bộ Giả Lập Tô Chì Thực Tế Trên 4 Mẫu Phiếu Gốc */}
              <div className={`rounded-2xl p-4 sm:p-5 border ${currentTpl.card3dClass} ${currentTpl.accentBorder}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Sparkles className={`w-4 h-4 ${currentTpl.accentText}`} />
                      <span>Bộ Tạo Phiếu Tô Chì 2B & Chấm Thử Tự Động ({currentTpl.shortName})</span>
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Tự động tô chì SBD, Mã đề và các câu hỏi lên mẫu phiếu {currentTpl.shortName} rồi chạy toàn bộ thuật toán bắt 4 góc & chấm điểm.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">
                      Số Báo Danh (6 số):
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={simSbd}
                      onChange={(e) => setSimSbd(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-slate-950/90 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">Mã Đề Thi:</label>
                    <select
                      value={simExamCode}
                      onChange={(e) => setSimExamCode(e.target.value)}
                      className="w-full bg-slate-950/90 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-400"
                    >
                      {Object.keys(answerKeys).map((c) => (
                        <option key={c} value={c}>
                          Mã đề {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">
                      Mức làm đúng: {Math.round(simAccuracy * 100)}%
                    </label>
                    <select
                      value={String(simAccuracy)}
                      onChange={(e) => setSimAccuracy(Number(e.target.value))}
                      className="w-full bg-slate-950/90 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200"
                    >
                      <option value="1">100% (Tuyệt đối 10đ)</option>
                      <option value="0.88">~88% (Học sinh Giỏi)</option>
                      <option value="0.72">~72% (Học sinh Khá)</option>
                      <option value="0.55">~55% (Trung bình)</option>
                    </select>
                  </div>
                  <button
                    onClick={handleSimulateAndGradeSheet}
                    disabled={isSimulating}
                    className={`${currentTpl.btn3dClass} min-h-[40px] px-4 py-2 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer`}
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{isSimulating ? 'Đang chấm...' : 'Tô & Chấm Thử'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Cột Phải: HUD Kết Quả Chấm Tức Thì & Ảnh Phiếu Đã Nắn Phẳng */}
            <div className="lg:col-span-5 space-y-4">
              {activeRecordHud ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
                  <div className="flex items-start justify-between gap-4 pb-3.5 border-b border-slate-800">
                    <div>
                      <div className="text-xs text-slate-400 flex items-center gap-2">
                        <span>SBD:</span>
                        <strong className="text-base font-mono text-white">
                          {activeRecordHud.sbd}
                        </strong>
                        <span aria-hidden="true">·</span>
                        <span>Mã đề:</span>
                        <strong className="text-base font-mono text-emerald-400">
                          {activeRecordHud.examCode}
                        </strong>
                      </div>
                      <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-1.5 font-mono">
                        <span>
                          P.I:{' '}
                          <strong className="text-slate-200">
                            {activeRecordHud.p1Score.toFixed(2)}đ
                          </strong>{' '}
                          ({activeRecordHud.p1CorrectCount}/{activeRecordHud.p1TotalCount})
                        </span>
                        {TEMPLATES[activeRecordHud.templateId].p2Count > 0 && (
                          <>
                            <span>·</span>
                            <span>
                              P.II:{' '}
                              <strong className="text-slate-200">
                                {activeRecordHud.p2Score.toFixed(2)}đ
                              </strong>
                              /4.0
                            </span>
                          </>
                        )}
                        {TEMPLATES[activeRecordHud.templateId].p3Count > 0 && (
                          <>
                            <span>·</span>
                            <span>
                              P.III:{' '}
                              <strong className="text-slate-200">
                                {activeRecordHud.p3Score.toFixed(2)}đ
                              </strong>{' '}
                              ({activeRecordHud.p3CorrectCount}/{activeRecordHud.p3TotalCount})
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-[11px] text-slate-400">Tổng điểm</div>
                      <div className="text-3xl font-extrabold font-mono text-emerald-400 tabular-nums">
                        {activeRecordHud.totalScore.toFixed(2)}
                        <span className="text-xs font-normal text-slate-500"> / 10</span>
                      </div>
                    </div>
                  </div>

                  {activeRecordHud.warnings.length > 0 && (
                    <div className="bg-amber-950/60 border border-amber-800/60 rounded-xl p-3 text-xs text-amber-200 space-y-1">
                      <div className="font-semibold flex items-center gap-1.5 text-amber-300">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>Phát hiện cần lưu ý trên phiếu:</span>
                      </div>
                      <ul className="list-disc list-inside text-[11px] space-y-0.5">
                        {activeRecordHud.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                      <span className="font-semibold text-slate-300">
                        Ảnh Phiếu Nắn Phẳng (Xanh: Đúng · Đỏ: Sai · Vàng: Đáp án đúng)
                      </span>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                      <img
                        src={activeRecordHud.annotatedImageDataUrl}
                        alt="Kết quả chấm trên phiếu"
                        className="w-full h-auto block"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      onClick={() => setQuickEditModalOpen(true)}
                      className="btn-3d btn-3d-amber flex-1 min-h-[44px] px-4 py-2.5 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                      <span>Sửa nhanh bài làm</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('scores')}
                      className="btn-3d btn-3d-emerald min-h-[44px] px-4 py-2.5 rounded-xl text-white text-xs font-bold cursor-pointer"
                    >
                      Sổ Điểm ({gradedRecords.length})
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                    <Layers className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-white">
                    Chưa Có Bài Chấm Trong Phiên Này
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Khi quét phiếu thành công, hệ thống sẽ phát tiếng bíp, rung nhẹ điện thoại và hiển thị kết quả chi tiết kèm ảnh phiếu đã chấm tại đây.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 3: SỔ ĐIỂM, BIỂU ĐỒ PHỔ ĐIỂM & XUẤT EXCEL (.XLSX)
           ===================================================================== */}
        {activeTab === 'scores' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card-3d-toan border border-blue-500/40 rounded-2xl p-4">
                <div className="text-xs text-blue-200">Số Bài Đã Chấm</div>
                <div className="text-2xl font-extrabold text-white font-mono tabular-nums mt-1">
                  {gradedRecords.length}
                </div>
                <div className="text-[11px] text-slate-300 mt-1">
                  Điểm trung bình:{' '}
                  <strong className="text-blue-300 font-mono">{stats.avg.toFixed(2)}</strong>
                </div>
              </div>

              <div className="card-3d-khtn border border-emerald-500/40 rounded-2xl p-4">
                <div className="text-xs text-emerald-200">Điểm Cao Nhất</div>
                <div className="text-2xl font-extrabold text-emerald-400 font-mono tabular-nums mt-1">
                  {stats.max.toFixed(2)}
                </div>
                <div className="text-[11px] text-slate-300 mt-1">Thang điểm 10.00 Bộ GD&ĐT</div>
              </div>

              <div className="card-3d-ngoaingu border border-rose-500/40 rounded-2xl p-4">
                <div className="text-xs text-rose-200">Điểm Thấp Nhất</div>
                <div className="text-2xl font-extrabold text-rose-400 font-mono tabular-nums mt-1">
                  {stats.min.toFixed(2)}
                </div>
                <div className="text-[11px] text-slate-300 mt-1">Cần lưu ý phụ đạo nếu &lt; 5.0</div>
              </div>

              <div className="card-3d-khxh border border-amber-500/40 rounded-2xl p-4">
                <div className="text-xs text-amber-200">Tỷ Lệ Trên Trung Bình (≥ 5.0)</div>
                <div className="text-2xl font-extrabold text-amber-400 font-mono tabular-nums mt-1">
                  {stats.passRate}%
                </div>
                <div className="text-[11px] text-slate-300 mt-1">
                  Đạt {stats.passCount} / {gradedRecords.length} học sinh
                </div>
              </div>
            </div>

            {gradedRecords.length > 0 && (
              <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6">
                <h3 className="text-sm font-bold text-white mb-4">
                  Biểu Đồ Phổ Điểm Ca Thi (Từ 0 đến 10 điểm)
                </h3>
                <div className="grid grid-cols-10 gap-2 items-end h-36 pt-4 px-2 bg-slate-950/60 border border-slate-800 rounded-xl pb-3">
                  {stats.buckets.map((count, idx) => {
                    const maxBucket = Math.max(1, ...stats.buckets);
                    const heightPct = Math.round((count / maxBucket) * 100);
                    return (
                      <div
                        key={idx}
                        className="flex flex-col items-center justify-end h-full gap-1.5"
                      >
                        <span className="text-[10px] font-mono text-emerald-400 font-bold">
                          {count > 0 ? count : ''}
                        </span>
                        <div className="w-full max-w-[32px] bg-slate-800/60 rounded-t-md h-20 flex items-end overflow-hidden">
                          <div
                            className="w-full bg-emerald-500 transition-all rounded-t-md"
                            style={{
                              height: `${Math.max(count > 0 ? 12 : 0, heightPct)}%`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">
                          {idx}–{idx + 1}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white">
                    Danh Sách Bài Đã Chấm & Xuất Bảng Điểm VnEdu / SMAS
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Cấu trúc cột chuẩn: STT, Số Báo Danh, Mã Đề, Điểm P1, Điểm P2, Điểm P3, Tổng Điểm.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleExportExcel}
                    className="btn-3d btn-3d-emerald px-4 py-2.5 rounded-xl text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Xuất Excel (.xlsx)</span>
                  </button>

                  {gradedRecords.length > 0 && (
                    <button
                      onClick={() => setGradedRecords([])}
                      className="btn-3d btn-3d-rose px-3.5 py-2.5 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xóa Sổ Điểm</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-sans">
                      <th className="py-3 px-3">STT</th>
                      <th className="py-3 px-3">Số Báo Danh</th>
                      <th className="py-3 px-3">Mã Đề</th>
                      <th className="py-3 px-3">Điểm P.I</th>
                      <th className="py-3 px-3">Điểm P.II</th>
                      <th className="py-3 px-3">Điểm P.III</th>
                      <th className="py-3 px-3">Tổng Điểm</th>
                      <th className="py-3 px-3">Thời Gian</th>
                      <th className="py-3 px-3 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {gradedRecords.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-10 text-center text-slate-500 font-sans">
                          Chưa có bài chấm nào. Hãy chuyển sang Tab 2 để quét phiếu hoặc bấm "Tô & Chấm Thử".
                        </td>
                      </tr>
                    ) : (
                      gradedRecords.map((r, idx) => (
                        <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-3 text-slate-400">{idx + 1}</td>
                          <td className="py-3 px-3 font-bold text-white">{r.sbd}</td>
                          <td className="py-3 px-3 text-emerald-400 font-semibold">
                            {r.examCode}
                          </td>
                          <td className="py-3 px-3">
                            {r.p1Score.toFixed(2)}{' '}
                            <span className="text-[10px] text-slate-500">
                              ({r.p1CorrectCount}/{r.p1TotalCount})
                            </span>
                          </td>
                          <td className="py-3 px-3">{r.p2Score.toFixed(2)}</td>
                          <td className="py-3 px-3">
                            {r.p3Score.toFixed(2)}{' '}
                            <span className="text-[10px] text-slate-500">
                              ({r.p3CorrectCount}/{r.p3TotalCount})
                            </span>
                          </td>
                          <td className="py-3 px-3 font-extrabold text-sm text-emerald-400">
                            {r.totalScore.toFixed(2)}
                          </td>
                          <td className="py-3 px-3 text-slate-400">{r.timestamp}</td>
                          <td className="py-3 px-3 text-right">
                            <div className="inline-flex items-center gap-1.5 font-sans">
                              <button
                                onClick={() => {
                                  setActiveRecordHud(r);
                                  setQuickEditModalOpen(true);
                                }}
                                className="btn-3d btn-3d-slate px-2.5 py-1 rounded-lg text-slate-200 text-[11px] flex items-center gap-1 cursor-pointer"
                              >
                                <Edit3 className="w-3 h-3 text-emerald-400" />
                                <span>Xem / Sửa</span>
                              </button>
                              <button
                                onClick={() =>
                                  setGradedRecords((prev) =>
                                    prev.filter((item) => item.id !== r.id)
                                  )
                                }
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* =====================================================================
          MODAL QUÉT MÃ QR ĐÁP ÁN TỪ HỆ THỐNG TRỘN ĐỀ
         ===================================================================== */}
      {qrModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
            <div className="px-4 py-3.5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <QrCode className="w-4 h-4 text-emerald-400" />
                <span>Quét Mã QR Đáp Án Chung — Edu Chấm Đề 2025</span>
              </h3>
              <button
                onClick={closeQrModal}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3.5">
              <div className="relative bg-slate-950 rounded-xl overflow-hidden aspect-square border border-slate-800 flex items-center justify-center">
                <video
                  ref={qrVideoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-8 border-2 border-emerald-400/70 rounded-2xl pointer-events-none" />
              </div>

              <div className="flex flex-col gap-2.5">
                <label className="btn-3d btn-3d-blue w-full py-2.5 px-4 rounded-xl text-white text-xs font-bold text-center cursor-pointer">
                  Chọn Ảnh Mã QR Từ Điện Thoại / Máy Tính
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleQrImageFileUpload}
                  />
                </label>

                <button
                  onClick={() => {
                    handleScanAttachedSampleQrImage();
                    closeQrModal();
                  }}
                  className="btn-3d btn-3d-emerald w-full py-2.5 px-4 rounded-xl text-white text-xs font-bold cursor-pointer"
                >
                  Dùng Ngay Ảnh QR Mẫu Sinh Học 12 (Mã 101-104)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL SỬA NHANH BÀI LÀM CỦA HỌC SINH
         ===================================================================== */}
      {quickEditModalOpen && activeRecordHud && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Sửa Nhanh Bài Làm Học Sinh — SBD: {activeRecordHud.sbd} · Mã đề:{' '}
                  {activeRecordHud.examCode}
                </h3>
                <p className="text-xs text-slate-400">
                  Tổng điểm cập nhật tức thì:{' '}
                  <strong className="text-emerald-400 font-mono">
                    {activeRecordHud.totalScore.toFixed(2)} / 10.00
                  </strong>
                </p>
              </div>
              <button
                onClick={() => setQuickEditModalOpen(false)}
                className="btn-3d btn-3d-emerald px-4 py-1.5 rounded-xl text-white text-xs font-bold cursor-pointer"
              >
                Hoàn Tất
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-5 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <div>
                  <label className="block text-slate-400 mb-1">Số Báo Danh:</label>
                  <input
                    type="text"
                    value={activeRecordHud.sbd}
                    onChange={(e) =>
                      handleUpdateRecordInHud({ ...activeRecordHud, sbd: e.target.value })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 font-mono font-bold text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Mã Đề:</label>
                  <input
                    type="text"
                    value={activeRecordHud.examCode}
                    onChange={(e) =>
                      handleUpdateRecordInHud({
                        ...activeRecordHud,
                        examCode: e.target.value,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 font-mono font-bold text-emerald-400"
                  />
                </div>
              </div>

              <div>
                <h4 className="font-bold text-emerald-400 mb-2">
                  Phần I ({activeRecordHud.p1CorrectCount}/{activeRecordHud.p1TotalCount} câu đúng ={' '}
                  {activeRecordHud.p1Score.toFixed(2)} điểm):
                </h4>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {activeRecordHud.p1Details.map((item, idx) => (
                    <div
                      key={item.qIndex}
                      className={`p-2 rounded-lg border ${
                        item.isCorrect
                          ? 'bg-emerald-950/30 border-emerald-700/50'
                          : 'bg-rose-950/30 border-rose-800/50'
                      }`}
                    >
                      <div className="flex justify-between font-mono text-[11px] mb-1">
                        <span>
                          C.{item.qIndex} (ĐA: {item.correctAnswer})
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {['A', 'B', 'C', 'D'].map((ch) => (
                          <button
                            key={ch}
                            onClick={() => {
                              const nextP1 = [...activeRecordHud.p1Details];
                              nextP1[idx] = { ...item, studentAnswer: ch };
                              handleUpdateRecordInHud({
                                ...activeRecordHud,
                                p1Details: nextP1,
                              });
                            }}
                            className={`py-1 rounded font-mono text-[10px] font-bold cursor-pointer ${
                              item.studentAnswer === ch
                                ? item.isCorrect
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-rose-600 text-white'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {ch}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {activeRecordHud.p2Details.length > 0 && (
                <div>
                  <h4 className="font-bold text-sky-400 mb-2">
                    Phần II — Đúng/Sai Lũy Tiến ({activeRecordHud.p2Score.toFixed(2)} / 4.00 điểm):
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {activeRecordHud.p2Details.map((qItem, qIdx) => (
                      <div
                        key={qItem.qIndex}
                        className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2"
                      >
                        <div className="flex justify-between font-mono">
                          <span className="font-bold text-white">Câu {qItem.qIndex}</span>
                          <span className="text-emerald-400">
                            +{qItem.pointsEarned.toFixed(2)}đ
                          </span>
                        </div>
                        {qItem.subResults.map((sub, sIdx) => (
                          <div
                            key={sub.subKey}
                            className="flex items-center justify-between bg-slate-900 px-2.5 py-1 rounded-lg"
                          >
                            <span className="font-mono text-slate-300">
                              {sub.subKey}) ĐA: {sub.correctAnswer === 'D' ? 'Đ' : 'S'}
                            </span>
                            <div className="flex gap-1">
                              {(['D', 'S'] as const).map((ds) => (
                                <button
                                  key={ds}
                                  onClick={() => {
                                    const nextP2 = [...activeRecordHud.p2Details];
                                    const nextSubs = [...qItem.subResults];
                                    nextSubs[sIdx] = { ...sub, studentAnswer: ds };
                                    nextP2[qIdx] = { ...qItem, subResults: nextSubs };
                                    handleUpdateRecordInHud({
                                      ...activeRecordHud,
                                      p2Details: nextP2,
                                    });
                                  }}
                                  className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold cursor-pointer ${
                                    sub.studentAnswer === ds
                                      ? sub.isCorrect
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-rose-600 text-white'
                                      : 'bg-slate-800 text-slate-400'
                                  }`}
                                >
                                  {ds === 'D' ? 'Đ' : 'S'}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeRecordHud.p3Details.length > 0 && (
                <div>
                  <h4 className="font-bold text-amber-400 mb-2">
                    Phần III — Trả Lời Ngắn ({activeRecordHud.p3Score.toFixed(2)} điểm):
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                    {activeRecordHud.p3Details.map((item, idx) => (
                      <div
                        key={item.qIndex}
                        className="bg-slate-950 border border-slate-800 rounded-xl p-2.5"
                      >
                        <div className="text-[11px] text-slate-400 font-mono mb-1">
                          C.{item.qIndex} (ĐA: {item.correctValue})
                        </div>
                        <input
                          type="text"
                          value={item.studentString}
                          onChange={(e) => {
                            const nextP3 = [...activeRecordHud.p3Details];
                            nextP3[idx] = { ...item, studentString: e.target.value };
                            handleUpdateRecordInHud({
                              ...activeRecordHud,
                              p3Details: nextP3,
                            });
                          }}
                          className={`w-full bg-slate-900 border rounded-lg px-2.5 py-1 font-mono font-bold ${
                            item.isCorrect
                              ? 'border-emerald-600 text-emerald-300'
                              : 'border-rose-600 text-rose-300'
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MOBILE FIXED BOTTOM NAVIGATION BAR
         ===================================================================== */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800">
        <div className="grid grid-cols-3 h-16 max-w-md mx-auto">
          <button
            onClick={() => setActiveTab('keys')}
            className={`flex flex-col items-center justify-center gap-1 min-h-[44px] cursor-pointer ${
              activeTab === 'keys' ? 'text-emerald-400 font-semibold' : 'text-slate-400'
            }`}
          >
            <QrCode className="w-5 h-5" />
            <span className="text-[11px] whitespace-nowrap">1. Đáp Án & Ca Thi</span>
          </button>

          <button
            onClick={() => setActiveTab('camera')}
            className={`flex flex-col items-center justify-center gap-1 min-h-[44px] cursor-pointer ${
              activeTab === 'camera' ? 'text-emerald-400 font-semibold' : 'text-slate-400'
            }`}
          >
            <Camera className="w-5 h-5" />
            <span className="text-[11px] whitespace-nowrap">2. Camera Chấm</span>
          </button>

          <button
            onClick={() => setActiveTab('scores')}
            className={`flex flex-col items-center justify-center gap-1 min-h-[44px] cursor-pointer ${
              activeTab === 'scores' ? 'text-emerald-400 font-semibold' : 'text-slate-400'
            }`}
          >
            <FileSpreadsheet className="w-5 h-5" />
            <span className="text-[11px] whitespace-nowrap">
              3. Sổ Điểm ({gradedRecords.length})
            </span>
          </button>
        </div>
      </nav>
    </div>
  );
}
