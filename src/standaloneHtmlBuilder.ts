import { SHEET_DATABASE } from './omr/templates';

/**
 * Xuất trọn vẹn 1 file HTML duy nhất (tích hợp Tailwind CSS qua CDN, SHEET_DATABASE 14 mẫu phiếu,
 * thuật toán OMR Perspective Transform 4 góc & Ma trận tọa độ sub-pixel 1024x550, cùng toàn bộ Mobile-First UI)
 * để giáo viên có thể tải về máy hoặc đẩy thẳng 1 file index.html lên GitHub Pages chạy ngay lập tức.
 */
export function generateStandaloneSingleFileHtml(): string {
  const sheetDbJson = JSON.stringify(SHEET_DATABASE, null, 2);

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="theme-color" content="#2563eb" />
  <title>Chấm thi QM 2025 — Edu Chấm Đề GDPT 2018 (Mobile-First OMR)</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    * {
      box-sizing: border-box;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }
    html, body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f1f5f9;
      color: #0f172a;
      overscroll-behavior: none;
      user-select: none;
    }
    .safe-top { padding-top: max(0.75rem, env(safe-area-inset-top)); }
    .safe-bottom { padding-bottom: max(0.75rem, env(safe-area-inset-bottom)); }
    .touch-44 { min-width: 44px; min-height: 44px; }
    @keyframes slideUp {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }
    .sheet-up { animation: slideUp 0.24s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  </style>
</head>
<body class="min-h-screen flex flex-col">
  <div id="app" class="flex-1 flex flex-col max-w-md mx-auto w-full bg-[#f2f3f7] min-h-screen shadow-xl relative pb-24"></div>

  <script>
    // 1. CƠ SỞ DỮ LIỆU 14 MẪU PHIẾU CHUẨN GDPT 2018 & CV 1239
    const SHEET_DATABASE = ${sheetDbJson};

    // 2. HỆ TỌA ĐỘ CHUẨN 1024x550 & THUẬT TOÁN NẮN PHẲNG PERSPECTIVE TRANSFORM
    const TARGET_CORNERS_1024x550 = {
      width: 1024,
      height: 550,
      tl: { x: 26, y: 38 },
      tr: { x: 998, y: 38 },
      bl: { x: 26, y: 512 },
      br: { x: 998, y: 512 }
    };

    function getTemplateBubbleMap(templateId, offsetX = 0, offsetY = 0, radiusScale = 1.0) {
      const pt = (x, y, r) => ({ x: x + offsetX, y: y + offsetY, r: r * radiusScale });
      const item = SHEET_DATABASE.find(s => s.id === templateId) || SHEET_DATABASE[1];

      if (templateId === 'qm_toan' || templateId === 'qm_khtn_dia') {
        const r = 7.4;
        const maDeCols = [46.3, 65.3, 84.5];
        const sbdCols = [138.4, 157.6, 176.6, 195.8, 214.8, 233.9];
        const leftRows = [282.4, 301.6, 320.8, 340.0, 359.5, 378.7, 397.9, 417.1, 436.4, 455.8];
        const maDe = maDeCols.map(cx => leftRows.map(cy => pt(cx, cy, r)));
        const sbd = sbdCols.map(cx => leftRows.map(cy => pt(cx, cy, r)));
        const p1Cols = [298.5, 317.6, 336.6, 355.8];
        const p1Rows = templateId === 'qm_toan'
          ? [263.2, 282.4, 301.6, 320.7, 339.9, 359.5, 378.7, 397.9, 417.0, 436.6, 455.8, 475.0]
          : [128.4, 147.5, 166.7, 186.3, 205.4, 224.6, 243.8, 262.9, 282.5, 320.8, 340.0, 359.6, 378.7, 397.9, 417.1, 436.2, 455.8, 475.0];
        const p1 = p1Rows.map(cy => p1Cols.map(cx => pt(cx, cy, r)));
        const p2ColPairs = [[612.3, 631.3], [712.0, 730.9], [811.4, 830.6], [911.1, 930.3]];
        const p2Rows = [103.0, 122.2, 141.3, 161.0];
        const p2 = p2ColPairs.map(([xD, xS]) => ({
          a: [pt(xD, p2Rows[0], r), pt(xS, p2Rows[0], r)],
          b: [pt(xD, p2Rows[1], r), pt(xS, p2Rows[1], r)],
          c: [pt(xD, p2Rows[2], r), pt(xS, p2Rows[2], r)],
          d: [pt(xD, p2Rows[3], r), pt(xS, p2Rows[3], r)]
        }));
        const p3GroupCols = [
          [413.0, 432.0, 451.2, 470.1], [512.6, 531.6, 550.8, 569.8],
          [612.3, 631.3, 650.5, 669.5], [712.0, 730.9, 749.9, 769.1],
          [811.4, 830.6, 849.6, 868.8], [911.1, 930.3, 949.2, 968.4]
        ];
        const p3DigitRows = [301.7, 320.8, 340.0, 359.6, 378.7, 397.9, 417.1, 436.6, 455.8, 475.0];
        const p3 = p3GroupCols.map(cols => ({
          minus: pt(cols[0], 263.3, r),
          comma1: pt(cols[1], 282.5, r),
          comma2: pt(cols[2], 282.5, r),
          digits: cols.map(cx => p3DigitRows.map(cy => pt(cx, cy, r)))
        }));
        return { maDe, sbd, p1, p2, p3 };
      }

      const r = 5.2;
      const sbdCols = item.codeLength === 4
        ? [722.0, 741.0, 760.5, 780.0, 799.5, 819.0, 838.5, 858.0]
        : [722.0, 741.0, 760.5, 780.0, 799.5, 819.0];
      const maDeCols = item.codeLength === 4
        ? [923.6, 943.1, 962.6, 982.1]
        : [923.6, 943.1, 962.6];
      const topRows = [80.3, 89.8, 99.3, 108.8, 118.3, 127.8, 137.3, 146.8, 156.3, 165.8];
      const maDe = maDeCols.map(cx => topRows.map(cy => pt(cx, cy, r)));
      const sbd = sbdCols.map(cx => topRows.map(cy => pt(cx, cy, r)));
      const p1ColBlocks = [
        [83.2, 134.1, 185.0, 235.6], [326.4, 377.3, 427.8, 478.3],
        [569.6, 620.1, 670.6, 721.1], [812.4, 862.9, 913.4, 964.3]
      ];
      const p1Rows10 = [209.2, 217.5, 225.6, 233.7, 242.0, 250.1, 258.2, 266.5, 274.8, 282.9];
      const p1 = [];
      for (const cols of p1ColBlocks) {
        for (let i = 0; i < 10; i++) p1.push(cols.map(cx => pt(cx, p1Rows10[i], r)));
      }
      const p2ColPairs = [
        [83.2, 134.1], [185.0, 235.6], [326.4, 377.3], [427.8, 478.3],
        [569.6, 620.1], [670.6, 721.1], [812.4, 862.9], [913.4, 964.3]
      ];
      const p2Rows = [331.5, 339.7, 348.0, 356.1];
      const p2 = p2ColPairs.map(([xD, xS]) => ({
        a: [pt(xD, p2Rows[0], r), pt(xS, p2Rows[0], r)],
        b: [pt(xD, p2Rows[1], r), pt(xS, p2Rows[1], r)],
        c: [pt(xD, p2Rows[2], r), pt(xS, p2Rows[2], r)],
        d: [pt(xD, p2Rows[3], r), pt(xS, p2Rows[3], r)]
      }));
      const p3GroupCols = [
        [83.2, 107.1, 131.0, 154.5], [245.3, 269.2, 292.7, 316.2],
        [407.4, 431.4, 454.4, 478.3], [569.6, 593.1, 616.6, 640.5],
        [731.3, 754.8, 778.7, 802.2], [893.0, 916.9, 940.8, 964.3]
      ];
      const p3DigitRows = [422.2, 430.3, 438.4, 446.7, 455.0, 463.1, 471.2, 479.5, 487.6, 495.8];
      const p3 = p3GroupCols.map(cols => ({
        minus: pt(cols[0], 405.8, r),
        comma1: pt(cols[1], 413.9, r),
        comma2: pt(cols[2], 413.9, r),
        digits: cols.map(cx => p3DigitRows.map(cy => pt(cx, cy, r)))
      }));
      return { maDe, sbd, p1, p2, p3 };
    }

    // 3. STATE QUẢN LÝ MOBILE-FIRST APP
    const state = {
      tab: 'sessions', // 'sessions' | 'scanner' | 'classes' | 'settings'
      view: 'list',    // 'list' | 'hub' | 'create' | 'keys' | 'graded' | 'stats'
      bottomSheetOpen: false,
      sheetTab: 'Khổ ngang (2 bài/A4)',
      exportSheetOpen: false,
      keySheetOpen: false,
      activeSessionId: 'ex-1',
      sessions: [
        { id: 'ex-1', name: 'Công nghệ 12 - GKI', createdAt: '2026-11-02 10:47:17', sheetId: 'qm_khxh_tin_cn', codeLength: 3, scanSbd: true, p1: 24, p2: 4, p3: 0, totalScore: 10 },
        { id: 'ex-2', name: 'Sinh 11 - GKI', createdAt: '2026-11-02 10:45:40', sheetId: 'qm_khtn_dia', codeLength: 3, scanSbd: true, p1: 18, p2: 4, p3: 6, totalScore: 10 },
        { id: 'ex-3', name: 'Toán 12 - CV 1239 (4 số)', createdAt: '2026-11-02 09:30:00', sheetId: 'qm_cv1239', codeLength: 4, scanSbd: true, p1: 12, p2: 4, p3: 6, totalScore: 10 }
      ],
      draft: {
        name: '',
        codeLength: 3,
        sheetId: 'qm_khtn_dia',
        scanSbd: true,
        p1: 18,
        p2: 4,
        p3: 6
      }
    };

    function calcDraftTotal(d) {
      const p1Pts = (Number(d.p1) || 0) * 0.25;
      const p2Pts = (Number(d.p2) || 0) * 1.0;
      const p3Unit = d.sheetId === 'qm_toan' ? 0.5 : 0.25;
      const p3Pts = (Number(d.p3) || 0) * p3Unit;
      return Math.round((p1Pts + p2Pts + p3Pts) * 100) / 100;
    }

    window.selectSheetFromDb = function(id) {
      const s = SHEET_DATABASE.find(x => x.id === id);
      if (!s) return;
      state.draft.sheetId = s.id;
      state.draft.codeLength = s.codeLength;
      state.draft.scanSbd = s.hasSBD;
      state.draft.p1 = s.p1 > 24 && s.p2 > 0 ? 18 : s.p1;
      state.draft.p2 = s.p2 > 4 ? 4 : s.p2;
      state.draft.p3 = s.p3 > 6 ? 6 : s.p3;
      state.bottomSheetOpen = false;
      render();
    };

    window.saveNewSession = function() {
      const name = state.draft.name.trim() || 'Kiểm tra định kỳ mới';
      const totalScore = calcDraftTotal(state.draft);
      const newEx = {
        id: 'ex-' + Date.now(),
        name,
        createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
        sheetId: state.draft.sheetId,
        codeLength: state.draft.codeLength,
        scanSbd: state.draft.scanSbd,
        p1: Number(state.draft.p1) || 0,
        p2: Number(state.draft.p2) || 0,
        p3: Number(state.draft.p3) || 0,
        totalScore
      };
      state.sessions.unshift(newEx);
      state.activeSessionId = newEx.id;
      state.view = 'hub';
      render();
    };

    function render() {
      const root = document.getElementById('app');
      const activeEx = state.sessions.find(s => s.id === state.activeSessionId) || state.sessions[0];
      const activeSheet = SHEET_DATABASE.find(s => s.id === activeEx.sheetId) || SHEET_DATABASE[1];
      const draftSheet = SHEET_DATABASE.find(s => s.id === state.draft.sheetId) || SHEET_DATABASE[1];
      const draftTotal = calcDraftTotal(state.draft);

      if (state.tab === 'scanner') {
        root.innerHTML = \`
          <div class="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col">
            <div class="px-4 py-3 bg-white text-slate-900 flex items-center justify-between border-b safe-top">
              <button onclick="state.tab='sessions';render()" class="text-blue-600 font-semibold flex items-center gap-1 touch-44">‹ Quay lại</button>
              <span class="font-bold text-base">Chấm bài</span>
              <span class="text-xs font-mono text-emerald-600 font-bold">\${activeSheet.codeLength} số</span>
            </div>
            <div class="bg-slate-100 text-slate-800 text-center py-2 text-xs font-medium">
              Hãy giữ phiếu trả lời thật phẳng!<br/>Tránh ánh sáng phản chiếu trên phiếu
            </div>
            <div class="flex-1 relative bg-black flex flex-col items-center justify-center overflow-hidden p-3">
              <div class="w-full bg-white text-red-600 font-mono font-bold text-xs px-3 py-1.5 rounded-t-lg">
                P1: 11/12 = 2.75 | P2: 4/4; 4/4 = 2.00<br/>
                P3: 4/4 = 2.00 | Tổng: 6.75 điểm | SBD: 010203 | Mã đề: 114
              </div>
              <div class="relative w-full aspect-[1024/550] bg-slate-900 border-2 border-emerald-400 rounded-b-lg flex items-center justify-center">
                <div class="absolute top-2 left-2 w-8 h-8 border-4 border-green-500"></div>
                <div class="absolute top-2 right-2 w-8 h-8 border-4 border-green-500"></div>
                <div class="absolute bottom-2 left-2 w-8 h-8 border-4 border-green-500"></div>
                <div class="absolute bottom-2 right-2 w-8 h-8 border-4 border-green-500"></div>
                <span class="text-xs text-emerald-300 font-mono text-center px-4">Khung định vị 4 góc vuông xanh lá chuẩn OMR 1024x550 (\${activeSheet.name})</span>
              </div>
            </div>
            <div class="p-4 bg-white text-center safe-bottom">
              <button onclick="state.tab='sessions';render()" class="text-amber-600 font-bold text-base py-2 px-6 rounded-xl touch-44">✕ Huỷ / Quay lại</button>
            </div>
          </div>
        \`;
        return;
      }

      let contentHtml = '';
      if (state.view === 'list') {
        contentHtml = \`
          <header class="sticky top-0 z-20 bg-white/95 backdrop-blur border-b px-4 py-3 flex items-center justify-between safe-top">
            <span class="text-lg font-bold text-slate-900">Danh sách chấm</span>
            <button onclick="state.view='create';render()" class="w-10 h-10 rounded-full bg-blue-600 text-white text-2xl font-light flex items-center justify-center shadow touch-44">+</button>
          </header>
          <div class="p-3.5 space-y-3">
            \${state.sessions.map(ex => {
              const sh = SHEET_DATABASE.find(x => x.id === ex.sheetId) || SHEET_DATABASE[0];
              const isTen = Math.abs(ex.totalScore - 10) < 0.05;
              return \`
                <div onclick="state.activeSessionId='\${ex.id}';state.view='hub';render()" class="bg-white rounded-[16px] p-4 shadow-sm border border-slate-200/80 active:scale-[0.99] transition cursor-pointer space-y-1.5">
                  <div class="flex items-center justify-between gap-2">
                    <span class="font-bold text-base text-slate-900">\${ex.name}</span>
                    <span class="text-xs font-bold px-2.5 py-0.5 rounded-full \${isTen ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">\${ex.totalScore} điểm</span>
                  </div>
                  <div class="text-sm text-slate-700">
                    Số câu: <strong>\${ex.p1}; \${ex.p2}; \${ex.p3}</strong> • Phiếu: <strong>\${sh.name}</strong>
                  </div>
                  <div class="flex items-center justify-between text-xs text-slate-500 pt-1">
                    <span>Ngày: \${ex.createdAt}</span>
                    <span class="text-blue-600 font-bold">Chi tiết →</span>
                  </div>
                </div>
              \`;
            }).join('')}
          </div>
        \`;
      } else if (state.view === 'hub') {
        contentHtml = \`
          <header class="sticky top-0 z-20 bg-white/95 backdrop-blur border-b px-4 py-3 flex items-center justify-between safe-top">
            <button onclick="state.view='list';render()" class="text-blue-600 font-medium flex items-center gap-1 touch-44">‹ Quay lại</button>
            <span class="font-bold text-base truncate">\${activeEx.name}</span>
            <button onclick="state.view='create';render()" class="text-blue-600 text-sm font-semibold touch-44">Sửa</button>
          </header>
          <div class="p-3.5 space-y-2.5">
            \${[
              { label: 'Đáp án', icon: '🔑', act: "state.keySheetOpen=true;render()" },
              { label: 'Chấm bài', icon: '▶️', act: "state.tab='scanner';render()" },
              { label: 'Bài đã chấm', icon: '🖼️', act: "state.tab='scanner';render()" },
              { label: 'Xuất kết quả', icon: '📤', act: "state.exportSheetOpen=true;render()" },
              { label: 'Thống kê', icon: '📊', act: "alert('Thống kê độ khó câu hỏi theo mã đề')" },
              { label: 'Chọn lớp học', icon: '👥', act: "state.tab='classes';render()" }
            ].map(m => \`
              <button onclick="\${m.act}" class="w-full bg-white rounded-2xl px-4 py-4 flex items-center justify-between shadow-xs border border-slate-100 active:bg-slate-50 touch-44">
                <div class="flex items-center gap-3.5">
                  <span class="text-lg">\${m.icon}</span>
                  <span class="text-base font-medium text-slate-900">\${m.label}</span>
                </div>
                <span class="text-slate-400 text-lg">›</span>
              </button>
            \`).join('')}

            <div class="bg-white rounded-2xl p-4 space-y-2 border border-slate-100 mt-3 text-sm">
              <div>✅ \${activeEx.p1}; \${activeEx.p2}; \${activeEx.p3} câu</div>
              <div>✅ Phiếu: \${activeSheet.name}</div>
              <div>\${activeEx.scanSbd ? '✅ Quét số báo danh' : '⚪ Không quét SBD'}</div>
              <div>\${Math.abs(activeEx.totalScore - 10) < 0.05 ? '✅' : '⚠️'} Tổng điểm: \${activeEx.totalScore}</div>
            </div>
          </div>
        \`;
      } else if (state.view === 'create') {
        contentHtml = \`
          <header class="sticky top-0 z-20 bg-white/95 backdrop-blur border-b px-4 py-3 flex items-center justify-between safe-top">
            <button onclick="state.view='list';render()" class="text-blue-600 font-medium touch-44">‹ Danh sách chấm</button>
            <span class="font-bold text-base">Tạo mới</span>
            <button onclick="saveNewSession()" class="text-blue-600 font-bold touch-44">Lưu</button>
          </header>
          <div class="p-4 space-y-4 pb-28">
            <div class="flex items-center gap-3">
              <label class="font-bold text-sm shrink-0">1. Tên bài</label>
              <input value="\${state.draft.name}" oninput="state.draft.name=this.value" placeholder="Nhập tên bài kiểm tra..." class="flex-1 bg-white rounded-xl px-3.5 py-2.5 border border-slate-200 text-sm focus:outline-none focus:border-blue-500" />
            </div>

            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <label class="font-bold text-sm">2. Chọn phiếu có mã đề:</label>
                <div class="inline-flex bg-slate-200 p-1 rounded-xl">
                  <button onclick="state.draft.codeLength=3;render()" class="px-4 py-1.5 rounded-lg text-xs font-bold \${state.draft.codeLength===3 ? 'bg-blue-600 text-white shadow' : 'text-slate-700'}">3 số</button>
                  <button onclick="state.draft.codeLength=4;render()" class="px-4 py-1.5 rounded-lg text-xs font-bold \${state.draft.codeLength===4 ? 'bg-blue-600 text-white shadow' : 'text-slate-700'}">4 số</button>
                </div>
              </div>
              <button onclick="state.bottomSheetOpen=true;render()" class="w-full bg-white rounded-xl px-4 py-3 border border-slate-200 flex items-center justify-between text-left shadow-xs touch-44">
                <div>
                  <div class="font-bold text-sm text-slate-900">\${draftSheet.name}</div>
                  <div class="text-xs text-slate-500">\${draftSheet.note}</div>
                </div>
                <span class="text-blue-600 font-bold text-lg">›</span>
              </button>
            </div>

            <div class="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-slate-200">
              <span class="font-bold text-sm">3. Quét số báo danh</span>
              <input type="checkbox" \${state.draft.scanSbd ? 'checked' : ''} onchange="state.draft.scanSbd=this.checked;render()" class="w-5 h-5 accent-blue-600" />
            </div>

            <div class="space-y-2">
              <label class="font-bold text-sm block">4. Cấu trúc đề (Lưới 3 Cột Ngang)</label>
              <div class="grid grid-cols-3 gap-2.5">
                <div class="bg-white p-3 rounded-xl border border-slate-200">
                  <div class="text-xs font-bold text-blue-700 mb-1">Phần I (TN)</div>
                  <input type="number" value="\${state.draft.p1}" oninput="state.draft.p1=this.value;render()" class="w-full bg-slate-50 border rounded-lg px-2 py-2 text-center font-bold text-base" />
                  <div class="text-[11px] text-slate-400 mt-1 text-center">0.25đ / câu</div>
                </div>
                <div class="bg-white p-3 rounded-xl border border-slate-200">
                  <div class="text-xs font-bold text-emerald-700 mb-1">Phần II (Đ/S)</div>
                  <input type="number" value="\${state.draft.p2}" oninput="state.draft.p2=this.value;render()" class="w-full bg-slate-50 border rounded-lg px-2 py-2 text-center font-bold text-base" />
                  <div class="text-[11px] text-slate-400 mt-1 text-center">Lũy tiến Bộ GD</div>
                </div>
                <div class="bg-white p-3 rounded-xl border border-slate-200">
                  <div class="text-xs font-bold text-purple-700 mb-1">Phần III (Điền)</div>
                  <input type="number" value="\${state.draft.p3}" oninput="state.draft.p3=this.value;render()" class="w-full bg-slate-50 border rounded-lg px-2 py-2 text-center font-bold text-base" />
                  <div class="text-[11px] text-slate-400 mt-1 text-center">Tự động tính</div>
                </div>
              </div>
            </div>

            <div class="fixed bottom-16 left-0 right-0 max-w-md mx-auto bg-white border-t px-4 py-3 flex items-center justify-between gap-3 z-20 shadow-lg">
              <div class="flex items-center gap-2">
                <div class="w-12 h-12 rounded-full border-4 \${Math.abs(draftTotal - 10) < 0.05 ? 'border-emerald-500 text-emerald-700' : 'border-amber-500 text-amber-700'} flex items-center justify-center font-black text-xs">
                  \${draftTotal}/10
                </div>
                <span class="text-xs font-semibold text-slate-600">Tổng điểm</span>
              </div>
              <button onclick="saveNewSession()" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-5 rounded-xl text-sm shadow-md touch-44">
                LƯU BÀI KIỂM TRA
              </button>
            </div>
          </div>
        \`;
      }

      // Khay trượt đáy chọn 14 mẫu phiếu
      const bottomSheetHtml = state.bottomSheetOpen ? \`
        <div class="fixed inset-0 z-50 bg-black/50 flex items-end justify-center">
          <div class="bg-white w-full max-w-md rounded-t-3xl h-[78vh] flex flex-col sheet-up overflow-hidden">
            <div class="px-4 py-3 border-b flex items-center justify-between">
              <span class="font-bold text-base">Chọn Mẫu Phiếu Chuẩn (14 Mẫu)</span>
              <button onclick="state.bottomSheetOpen=false;render()" class="text-slate-500 font-bold px-2 py-1">Đóng</button>
            </div>
            <div class="grid grid-cols-3 gap-1 p-2 bg-slate-100 text-xs font-bold">
              \${['Khổ ngang (2 bài/A4)', 'Khổ dọc A4 Chuẩn', 'Azota / TNmaker Tương thích'].map(g => \`
                <button onclick="state.sheetTab='\${g}';render()" class="py-2 px-1 rounded-lg truncate \${state.sheetTab===g ? 'bg-blue-600 text-white shadow' : 'text-slate-700'}">\${g}</button>
              \`).join('')}
            </div>
            <div class="flex-1 overflow-y-auto p-3 space-y-2.5">
              \${SHEET_DATABASE.filter(s => s.group === state.sheetTab).map(s => \`
                <div class="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between gap-2">
                  <div onclick="selectSheetFromDb('\${s.id}')" class="flex-1 cursor-pointer">
                    <div class="font-bold text-sm text-slate-900">\${s.name} <span class="text-xs font-mono px-2 py-0.5 rounded bg-blue-100 text-blue-800">\${s.codeLength} số</span></div>
                    <div class="text-xs text-slate-600 mt-0.5">Cấu trúc: \${s.p1} P1 • \${s.p2} P2 • \${s.p3} P3</div>
                    <div class="text-[11px] text-slate-500">\${s.note}</div>
                  </div>
                  <div class="flex flex-col gap-1.5 shrink-0">
                    <button onclick="selectSheetFromDb('\${s.id}')" class="bg-blue-600 text-white text-xs font-bold px-3.5 py-2 rounded-xl">CHỌN</button>
                    <a href="\${s.pdfUrl}" target="_blank" class="text-[11px] text-center text-blue-700 underline font-semibold">Tải PDF</a>
                  </div>
                </div>
              \`).join('')}
            </div>
          </div>
        </div>
      \` : '';

      root.innerHTML = \`
        \${contentHtml}
        \${bottomSheetHtml}
        <nav class="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-200 px-4 py-1.5 flex items-center justify-around z-30 safe-bottom">
          <button onclick="state.tab='sessions';state.view='list';render()" class="flex flex-col items-center py-1 \${state.tab==='sessions' ? 'text-blue-600 font-bold' : 'text-slate-500'} touch-44">
            <span class="text-lg">📁</span>
            <span class="text-[11px]">Đợt chấm</span>
          </button>
          <button onclick="state.tab='scanner';render()" class="flex flex-col items-center -mt-6 touch-44">
            <div class="w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center text-2xl shadow-lg border-4 border-white">📷</div>
            <span class="text-[11px] font-bold text-blue-700 mt-0.5">Quét bài</span>
          </button>
          <button onclick="state.tab='classes';render()" class="flex flex-col items-center py-1 \${state.tab==='classes' ? 'text-blue-600 font-bold' : 'text-slate-500'} touch-44">
            <span class="text-lg">👥</span>
            <span class="text-[11px]">Lớp học</span>
          </button>
          <button onclick="state.tab='settings';render()" class="flex flex-col items-center py-1 \${state.tab==='settings' ? 'text-blue-600 font-bold' : 'text-slate-500'} touch-44">
            <span class="text-lg">⚙️</span>
            <span class="text-[11px]">Cài đặt</span>
          </button>
        </nav>
      \`;
    }

    render();
  </script>
</body>
</html>`;
}
