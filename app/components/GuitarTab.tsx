/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useRef, useEffect, useState } from 'react';

/**
 * [v5.0 最終修復]
 * 1. \instrument (25): 強制指定為 "Acoustic Guitar (Steel)"，徹底解決被誤判為打擊樂的問題。
 * 2. \clef (g2): 明確指定高音譜記號，確保譜面正確。
 * 3. 移除 \chord 定義，改用動態生成，避免方向錯誤。
 */
const INITIAL_SCORE = `\\staff{tabs}
\\tuning (E2 A2 D3 G3 B3 E4)
\\instrument 25
\\capo 1
\\ts (4 4)
\\tempo (120)
.
`;

type Note = { string: number; fret: number };

// 和弦庫定義
const CHORD_LIBRARY: Record<string, Note[]> = {
  'C':     [{string:5, fret:3}, {string:4, fret:2}, {string:2, fret:1}, {string:3, fret:0}, {string:1, fret:0}],
  'D':     [{string:3, fret:2}, {string:1, fret:2}, {string:2, fret:3}, {string:4, fret:0}],
  'E':     [{string:5, fret:2}, {string:4, fret:2}, {string:3, fret:1}, {string:6, fret:0}, {string:2, fret:0}, {string:1, fret:0}],
  'F':     [{string:6, fret:1}, {string:5, fret:3}, {string:4, fret:3}, {string:3, fret:2}, {string:2, fret:1}, {string:1, fret:1}],
  'G':     [{string:6, fret:3}, {string:5, fret:2}, {string:1, fret:3}, {string:2, fret:0}, {string:3, fret:0}, {string:4, fret:0}],
  'A':     [{string:4, fret:2}, {string:3, fret:2}, {string:2, fret:2}, {string:5, fret:0}, {string:1, fret:0}],
  'Am':    [{string:4, fret:2}, {string:3, fret:2}, {string:2, fret:1}, {string:5, fret:0}, {string:1, fret:0}],
  'Em':    [{string:5, fret:2}, {string:4, fret:2}, {string:6, fret:0}, {string:3, fret:0}, {string:2, fret:0}, {string:1, fret:0}],
  'Dm':    [{string:3, fret:2}, {string:2, fret:3}, {string:1, fret:1}, {string:4, fret:0}],
  'Cmaj7': [{string:5, fret:3}, {string:4, fret:2}, {string:3, fret:0}, {string:2, fret:0}, {string:1, fret:0}],
  'G7':    [{string:6, fret:3}, {string:5, fret:2}, {string:4, fret:0}, {string:3, fret:0}, {string:2, fret:0}, {string:1, fret:1}],
  'E7':    [{string:5, fret:2}, {string:4, fret:0}, {string:3, fret:1}, {string:6, fret:0}, {string:2, fret:0}, {string:1, fret:0}],
};

const Fretboard = ({ onNoteClick, selectedNotes = [] }: { onNoteClick: (string: number, fret: number) => void; selectedNotes?: Note[]; }) => {
  const strings = [1, 2, 3, 4, 5, 6];
  const frets = Array.from({ length: 13 }, (_, i) => i);
  const isSelected = (s: number, f: number) => selectedNotes.some(n => n.string === s && n.fret === f);

  return (
    <div className="flex flex-col bg-amber-100 border-2 border-amber-800 rounded p-2 overflow-x-auto shadow-inner select-none shrink-0">
      <h3 className="text-center text-amber-900 font-bold mb-2 text-sm">虛擬指板</h3>
      <div className="flex flex-col gap-[2px]">
        {strings.map((stringNum) => (
          <div key={stringNum} className="flex relative h-8 items-center">
            {/* 標示弦號，避免混淆 */}
            <div className="absolute -left-6 w-6 text-[10px] text-amber-900 font-bold text-right pr-1">
              {stringNum === 1 ? '1(E)' : stringNum === 6 ? '6(E)' : stringNum}
            </div>
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 bg-amber-900 z-0 pointer-events-none" style={{ height: `${stringNum * 0.5 + 1}px` }} />
            {frets.map((fretNum) => {
              const active = isSelected(stringNum, fretNum);
              return (
                <button
                  key={fretNum}
                  onClick={() => onNoteClick(stringNum, fretNum)}
                  className={`z-10 w-10 h-full border-r border-amber-400 flex items-center justify-center transition ${active ? 'bg-blue-500 text-white' : 'hover:bg-amber-900/20 active:bg-amber-900/40'} ${fretNum === 0 && !active ? 'border-r-4 border-slate-400 bg-slate-200/50 w-12' : ''}`}
                >
                  <span className={`text-xs font-bold ${active ? 'opacity-100' : 'opacity-0 hover:opacity-100 text-amber-900'}`}>{fretNum}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

const GuitarTab = () => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [api, setApi] = useState<any>(null);
  const [inputText, setInputText] = useState(INITIAL_SCORE);
  
  const [isChordMode, setIsChordMode] = useState(false);
  const [chordBuffer, setChordBuffer] = useState<Note[]>([]); 
  const [selectedChordName, setSelectedChordName] = useState<string>(""); 
  const [strokeDirection, setStrokeDirection] = useState<'none' | 'down' | 'up'>('none');
  const [duration, setDuration] = useState<string>("4");

  useEffect(() => {
    let apiInstance: any = null;
    const setupAlphaTab = async () => {
      const alphaTab = await import('@coderline/alphatab');
      if (!wrapperRef.current) return;

      apiInstance = new alphaTab.AlphaTabApi(wrapperRef.current, {
        core: {
          fontDirectory: "https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/font/",
          useWorkers: false
        },
        display: {
          staveProfile: alphaTab.StaveProfile.Tab
        },
        player: {
          enablePlayer: true,
          soundFont: "https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/soundfont/sonivox.sf2"
        }
      });

      apiInstance.error.on((e: any) => console.error("AlphaTab Error:", e));
      setApi(apiInstance);
      apiInstance.tex(inputText);
    };

    setupAlphaTab();
    return () => apiInstance?.destroy();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (api && inputText) {
      try { api.tex(inputText); } catch { /* 忽略打字過程中的暫時性語法錯誤 */ }
    }
  }, [inputText, api]);

  const insertTextAtCursor = (textToAdd: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setInputText(prev => prev + textToAdd);
      return;
    }
    
    // [智慧定位]：尋找最後一個 Metadata 指令的位置
    let safeStartPos = 0;
    const lastMetadataIndex = inputText.lastIndexOf('\\');
    if (lastMetadataIndex !== -1) {
        const nextNewLine = inputText.indexOf('\n', lastMetadataIndex);
        safeStartPos = nextNewLine !== -1 ? nextNewLine + 1 : inputText.length;
    } else {
        safeStartPos = inputText.length; 
    }

    let start = textarea.selectionStart;
    let end = textarea.selectionEnd;

    // [強制保護]：如果游標在 Metadata 區域內，強行移動到區域後方
    if (start < safeStartPos) {
        start = safeStartPos;
        end = safeStartPos;
        // 若該處無換行，自動補換行
        if (inputText[safeStartPos - 1] !== '\n') {
            textToAdd = '\n' + textToAdd;
        }
    }

    const newText = inputText.substring(0, start) + textToAdd + inputText.substring(end);
    setInputText(newText);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + textToAdd.length, start + textToAdd.length);
    }, 0);
  };

  const handleFretClick = (stringNum: number, fretNum: number) => {
    if (isChordMode) {
      setChordBuffer(prev => {
        const exists = prev.some(n => n.string === stringNum && n.fret === fretNum);
        if (exists) return prev.filter(n => !(n.string === stringNum && n.fret === fretNum));
        const filtered = prev.filter(n => n.string !== stringNum);
        return [...filtered, { string: stringNum, fret: fretNum }];
      });
      setSelectedChordName(""); 
    } else {
      insertTextAtCursor(` ${fretNum}.${stringNum}.${duration} `);
    }
  };

  const commitChord = () => {
    if (chordBuffer.length === 0) return;
    
    const sortedNotes = [...chordBuffer].sort((a, b) => a.string - b.string);
    const notesString = sortedNotes.map(n => `${n.fret}.${n.string}`).join(' ');

    const safeName = selectedChordName ? selectedChordName.replace(/"/g, '') : "";

    const textarea = textareaRef.current;
    const cursorPos = textarea ? textarea.selectionStart : inputText.length;
    const lastBarIndex = inputText.lastIndexOf('|', cursorPos - 1);
    const barStart = lastBarIndex === -1 ? 0 : lastBarIndex + 1;
    const barContentBeforeCursor = inputText.slice(barStart, cursorPos);
    const isFirstBeatInBar = barContentBeforeCursor.trim().length === 0;

    const properties: string[] = [];
    if (strokeDirection === 'down') properties.push("bd");
    if (strokeDirection === 'up')   properties.push("bu");
    if (safeName && isFirstBeatInBar) properties.push(`txt "${safeName}"`);

    const effects = properties.length ? ` {${properties.join(' ')}}` : "";
    const fullCode = ` (${notesString}).${duration}${effects} `;

    insertTextAtCursor(fullCode);
  };

  return (
    <div className="flex flex-col gap-4 w-full h-[85vh]">
      <div className="flex justify-between items-center bg-slate-800 p-4 rounded text-white shadow-lg shrink-0">
        <h2 className="font-bold text-xl">🎸 Pro Guitar Editor (Final v5.0)</h2>
        <div className="flex gap-2">
           <button
             onClick={() => {
               setInputText(INITIAL_SCORE);
             }}
             className="px-4 py-2 bg-rose-600 hover:bg-rose-500 rounded font-bold transition text-sm shadow-sm"
           >
             🗑️ 重置
           </button>
           <button
             onClick={() => api?.print()}
             className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded font-bold transition text-sm shadow-sm"
           >
             ⬇ 匯出 PDF
           </button>
           <button onClick={() => api?.playPause()} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-full font-bold transition flex items-center gap-2 shadow-sm">▶ 播放</button>
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        <div className="w-1/3 flex flex-col gap-4 min-w-[320px] overflow-y-auto pr-2 custom-scrollbar">
          <Fretboard onNoteClick={handleFretClick} selectedNotes={chordBuffer} />

          <div className="flex flex-col gap-3 p-3 bg-slate-100 rounded border shadow-inner shrink-0">
            <div className="flex gap-1">
                <span className="text-xs font-bold text-slate-500 flex items-center px-1">時值:</span>
                {[1, 2, 4, 8, 16].map((d) => (
                    <button key={d} onClick={() => setDuration(d.toString())} className={`flex-1 py-1 text-xs rounded border transition ${duration === d.toString() ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 border-slate-300'}`}>1/{d}</button>
                ))}
            </div>

            {isChordMode && (
              <div className="flex bg-white rounded border p-1 shadow-sm">
                <button onClick={() => setStrokeDirection('none')} className={`flex-1 py-1 text-xs rounded transition ${strokeDirection === 'none' ? 'bg-slate-200 font-bold' : ''}`}>無</button>
                <button onClick={() => setStrokeDirection('down')} className={`flex-1 py-1 text-xs rounded transition ${strokeDirection === 'down' ? 'bg-amber-400 text-white font-bold' : ''}`}>↓ 下刷</button>
                <button onClick={() => setStrokeDirection('up')} className={`flex-1 py-1 text-xs rounded transition ${strokeDirection === 'up' ? 'bg-amber-400 text-white font-bold' : ''}`}>↑ 上刷</button>
              </div>
            )}

            <div className="flex gap-2">
                <button onClick={() => { setIsChordMode(!isChordMode); setChordBuffer([]); setSelectedChordName(""); }} className={`flex-1 py-2 rounded font-bold transition text-xs shadow-sm ${isChordMode ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-700 border-slate-300'}`}>{isChordMode ? '模式: 和弦編輯' : '模式: 單音點擊'}</button>
                <button onClick={commitChord} disabled={!isChordMode || chordBuffer.length === 0} className="flex-1 py-2 bg-emerald-600 text-white rounded font-bold hover:bg-emerald-700 disabled:opacity-40 text-xs shadow-sm">✓ 加入樂譜</button>
            </div>

            <button onClick={() => insertTextAtCursor(" | ")} className="w-full py-1 bg-slate-500 text-white rounded font-bold text-xs shadow-sm">加入小節線 |</button>

            <div className="grid grid-cols-4 gap-1 border-t pt-2">
              {Object.keys(CHORD_LIBRARY).map(name => (
                <button key={name} onClick={() => { setChordBuffer(CHORD_LIBRARY[name]); setIsChordMode(true); setSelectedChordName(name); }} className="px-1 py-2 bg-white border border-slate-300 rounded text-xs hover:bg-indigo-50 font-medium text-slate-700 transition shadow-sm">{name}</button>
              ))}
            </div>
          </div>

          <div className="flex-1 flex flex-col bg-white rounded border overflow-hidden min-h-[150px]">
            <label className="p-2 bg-slate-50 font-bold text-slate-600 border-b text-xs">AlphaTex 原始碼 (Metadata保護中)</label>
            <textarea 
              ref={textareaRef}
              className="flex-1 w-full p-3 font-mono text-xs bg-slate-900 text-emerald-400 resize-none focus:outline-none"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              spellCheck={false}
            />
          </div>
        </div>

        <div className="flex-1 border-2 border-slate-200 rounded-lg overflow-auto bg-white shadow-sm relative">
          <div ref={wrapperRef} className="alphaTab p-4" />
        </div>
      </div>
    </div>
  );
};

export default GuitarTab;
