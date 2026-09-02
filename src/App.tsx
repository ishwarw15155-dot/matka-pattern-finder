import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// --- 15 MATKA FAMILIES WITH PASTEL COLORS ---
const JODI_FAMILIES: Record<string, { members: string[]; color: string }> = {
  "01": { members: ["01", "10", "06", "60", "51", "15", "56", "65"], color: "#FFE1E6" },
  "02": { members: ["02", "20", "07", "70", "52", "25", "57", "75"], color: "#E2F0D9" },
  "03": { members: ["03", "30", "08", "80", "53", "35", "58", "85"], color: "#FFF2CC" },
  "04": { members: ["04", "40", "09", "90", "54", "45", "59", "95"], color: "#FCE4D6" },
  "05": { members: ["05", "50", "00", "55"], color: "#EDEDED" },
  "12": { members: ["12", "21", "17", "71", "62", "26", "67", "76"], color: "#D9E1F2" },
  "13": { members: ["13", "31", "18", "81", "63", "36", "68", "86"], color: "#E1D5E7" },
  "14": { members: ["14", "41", "19", "91", "64", "46", "69", "96"], color: "#D5E8D4" },
  "16": { members: ["16", "61", "11", "66"], color: "#F8CECC" },
  "23": { members: ["23", "32", "28", "82", "73", "37", "78", "87"], color: "#DAE8FC" },
  "24": { members: ["24", "42", "29", "92", "74", "47", "79", "97"], color: "#FFF2CC" },
  "27": { members: ["27", "72", "22", "77"], color: "#E1F5FE" },
  "34": { members: ["34", "43", "39", "93", "84", "48", "89", "98"], color: "#F3E5F5" },
  "38": { members: ["38", "83", "33", "88"], color: "#E8F5E9" },
  "49": { members: ["49", "94", "44", "99"], color: "#FFFDE7" }
};

const CUSTOM_HIGHLIGHT_COLOR = "#00e676";

const getFamilyColor = (jodiStr: string): string => {
  if (!jodiStr || jodiStr.length < 2 || jodiStr.includes('*') || jodiStr.includes('✪')) return '#ffffff';
  for (const fam of Object.values(JODI_FAMILIES)) {
    if (fam.members.includes(jodiStr)) return fam.color;
  }
  return '#ffffff';
};

const checkSameFamily = (jodi1: string, jodi2: string): boolean => {
  if (!jodi1 || !jodi2 || jodi1.includes('*') || jodi2.includes('*') || jodi1.includes('✪')) return false;
  for (const fam of Object.values(JODI_FAMILIES)) {
    if (fam.members.includes(jodi1) && fam.members.includes(jodi2)) return true;
  }
  return false;
};

const getFamilyMembers = (jodiStr: string): string[] => {
  if (!jodiStr || jodiStr.length < 2 || jodiStr.includes('*') || jodiStr.includes('✪')) return [jodiStr];
  for (const fam of Object.values(JODI_FAMILIES)) {
    if (fam.members.includes(jodiStr)) return fam.members;
  }
  return [jodiStr];
};

const isRedJodi = (jodiStr: string): boolean => {
  if (!jodiStr || jodiStr.length < 2) return false;
  const redFamilies = ["05", "16", "27", "38", "49"];
  for (const famKey of redFamilies) {
    if (JODI_FAMILIES[famKey].members.includes(jodiStr)) return true;
  }
  return false;
};

const calculateMetrics = (jodiStr: string) => {
  if (!jodiStr || jodiStr.length < 2 || jodiStr.includes('*') || jodiStr.includes('✪')) {
    return { diff: null, total: null, diffNum: null, totalNum: null };
  }
  const open = parseInt(jodiStr[0], 10);
  const close = parseInt(jodiStr[1], 10);
  if (isNaN(open) || isNaN(close)) return { diff: null, total: null, diffNum: null, totalNum: null };

  const diffNum = (close - open + 10) % 10;
  const totalNum = (open + close) % 10;

  return { diff: `D-${diffNum}`, total: `T-${totalNum}`, diffNum, totalNum };
};

const formatJodiVal = (val: string): string => {
  if (!val) return '';
  const trimmed = String(val).trim();
  return /^\d$/.test(trimmed) ? `0${trimmed}` : trimmed;
};

const formatDateString = (dateVal: string): string => {
  if (!dateVal || dateVal.startsWith('#')) return '---';
  if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(dateVal)) return dateVal.replace(/\//g, '-');
  const parsed = new Date(dateVal);
  if (!isNaN(parsed.getTime())) {
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    return `${day}-${month}-${year}`;
  }
  return dateVal;
};

const DAYS: string[] = ["DATE", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const GOOGLE_SHEET_API_URL: string = "https://script.google.com/macros/s/AKfycbxl1Qq4yqrRuvYC_H3ZsMDXyUGZw245Ws3kWm8l075Osb0WyZktd6QJosOe_jdgHECd/exec";

interface CellPosition {
  rowIndex: number;
  colIndex: number;
  value: string;
}

interface MatchResult {
  matchBlock: string[][];
  startDate: string;
  startRowIndex: number;
  matchCount: number;
  matchedPatternLength: number;
  pastRowsCount: number;
  repeatPositions: string[];
}

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [loginPin, setLoginPin] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');

  const [fullSheetData, setFullSheetData] = useState<string[][]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  const [isSelecting, setIsSelecting] = useState<boolean>(false);
  const [dragStartCell, setDragStartCell] = useState<CellPosition | null>(null);
  const [selectedCells, setSelectedCells] = useState<CellPosition[]>([]);
  
  const [matchedSets, setMatchedSets] = useState<MatchResult[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0);
  const [minMatchCount, setMinMatchCount] = useState<number>(2);
  const [strictMode, setStrictMode] = useState<boolean>(false);

  const [manualHighlightedFamily, setManualHighlightedFamily] = useState<string[]>([]);

  const leftPanelRef = useRef<HTMLDivElement | null>(null);
  const lastRowRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    const fetchData = async (): Promise<void> => {
      try {
        setLoading(true);
        const response = await fetch(GOOGLE_SHEET_API_URL);
        const rawData: unknown = await response.json();

        if (Array.isArray(rawData) && rawData.length > 0) {
          const formattedData = (rawData as (string | number)[][]).map((row) =>
            row.map((cell) => (cell !== null && cell !== undefined ? String(cell).trim() : ""))
          );

          const cleanData = formattedData.filter((row) => row.some((c) => c !== ""));
          setFullSheetData(cleanData);
        }
      } catch (error) {
        console.error("Error fetching Google Sheet data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (isLoggedIn && !loading && lastRowRef.current) {
      setTimeout(() => {
        scrollToBottom();
      }, 300);
    }
  }, [isLoggedIn, loading]);

  const scrollToBottom = (): void => {
    if (lastRowRef.current) {
      lastRowRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleLoginSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (loginPin === '5666') {
      setIsLoggedIn(true);
      setLoginError('');
    } else {
      setLoginError('चुकीचा पिन! कृपया योग्य पिन टाका.');
    }
  };

  const handleStartSelection = (rIdx: number, cIdx: number, value: string): void => {
    if (cIdx === 0) return;
    setIsSelecting(true);
    const startCell = { rowIndex: rIdx, colIndex: cIdx, value: formatJodiVal(value) };
    setDragStartCell(startCell);
    setSelectedCells([startCell]);
    setManualHighlightedFamily([]);
  };

  const handleMoveSelection = (rIdx: number, cIdx: number): void => {
    if (!isSelecting || !dragStartCell || cIdx === 0) return;

    const minRow = Math.min(dragStartCell.rowIndex, rIdx);
    const maxRow = Math.max(dragStartCell.rowIndex, rIdx);
    if (maxRow - minRow + 1 > 30) return;

    const minCol = Math.min(dragStartCell.colIndex, cIdx);
    const maxCol = Math.max(dragStartCell.colIndex, cIdx);

    const rectCells: CellPosition[] = [];
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const val = formatJodiVal(fullSheetData[r]?.[c] || "");
        rectCells.push({ rowIndex: r, colIndex: c, value: val });
      }
    }
    setSelectedCells(rectCells);
  };

  const handleEndSelection = (): void => {
    setIsSelecting(false);
  };

  const handleTouchMove = (e: React.TouchEvent): void => {
    if (!isSelecting) return;
    const touch = e.touches[0];
    const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
    if (targetElement) {
      const rIdxStr = targetElement.getAttribute('data-row');
      const cIdxStr = targetElement.getAttribute('data-col');
      if (rIdxStr !== null && cIdxStr !== null) {
        const rIdx = parseInt(rIdxStr, 10);
        const cIdx = parseInt(cIdxStr, 10);
        handleMoveSelection(rIdx, cIdx);
      }
    }
  };

  const runPatternSearch = (): void => {
    if (selectedCells.length === 0 || fullSheetData.length === 0) return;

    const minRow = Math.min(...selectedCells.map((c) => c.rowIndex));
    const maxRow = Math.max(...selectedCells.map((c) => c.rowIndex));
    const numRows = maxRow - minRow + 1;
    
    const PAST_ROWS = 10;
    const FUTURE_ROWS = 10;

    const selRepeatPairs: { cell1: CellPosition; cell2: CellPosition }[] = [];
    for (let i = 0; i < selectedCells.length; i++) {
      for (let j = i + 1; j < selectedCells.length; j++) {
        const c1 = selectedCells[i];
        const c2 = selectedCells[j];
        if (c1.value && c1.value === c2.value && !c1.value.includes('*') && !c1.value.includes('✪')) {
          selRepeatPairs.push({ cell1: c1, cell2: c2 });
        }
      }
    }

    const matches: MatchResult[] = [];

    for (let i = 0; i <= fullSheetData.length - numRows; i++) {
      if (i === minRow) continue;

      let matchCount = 0;
      const repeatPositions: string[] = [];

      for (const cell of selectedCells) {
        const offsetRow = cell.rowIndex - minRow;
        const targetHistJodi = formatJodiVal(fullSheetData[i + offsetRow]?.[cell.colIndex] || "");

        if (!cell.value || cell.value.includes('*') || cell.value.includes('✪')) continue;

        if (strictMode) {
          if (cell.value === targetHistJodi) {
            matchCount++;
          }
        } else {
          if (checkSameFamily(cell.value, targetHistJodi) || cell.value === targetHistJodi) {
            matchCount++;
          }
        }
      }

      for (const pair of selRepeatPairs) {
        const off1 = pair.cell1.rowIndex - minRow;
        const off2 = pair.cell2.rowIndex - minRow;
        const targetJodi1 = formatJodiVal(fullSheetData[i + off1]?.[pair.cell1.colIndex] || "");
        const targetJodi2 = formatJodiVal(fullSheetData[i + off2]?.[pair.cell2.colIndex] || "");

        if (targetJodi1 && targetJodi2 && (targetJodi1 === targetJodi2 || checkSameFamily(targetJodi1, targetJodi2))) {
          if (!strictMode) matchCount++;
          const posKey1 = `${off1}_${pair.cell1.colIndex}`;
          const posKey2 = `${off2}_${pair.cell2.colIndex}`;
          if (!repeatPositions.includes(posKey1)) repeatPositions.push(posKey1);
          if (!repeatPositions.includes(posKey2)) repeatPositions.push(posKey2);
        }
      }

      if (matchCount >= minMatchCount) {
        const blockStart = Math.max(0, i - PAST_ROWS);
        const blockEnd = Math.min(fullSheetData.length, i + numRows + FUTURE_ROWS);
        
        const matchBlock = fullSheetData.slice(blockStart, blockEnd);
        const startDate = formatDateString(fullSheetData[i]?.[0] || "");

        const actualPastCount = i - blockStart;

        matches.push({ 
          matchBlock, 
          startDate, 
          startRowIndex: i, 
          matchCount,
          matchedPatternLength: numRows,
          pastRowsCount: actualPastCount,
          repeatPositions
        });
      }
    }

    matches.sort((a, b) => b.matchCount - a.matchCount);
    setMatchedSets(matches);
    setCurrentMatchIndex(0);
    setManualHighlightedFamily([]);
  };

  const handleReset = (): void => {
    setSelectedCells([]);
    setMatchedSets([]);
    setCurrentMatchIndex(0);
    setManualHighlightedFamily([]);
  };

  const handleJodiCellClick = (jodiVal: string) => {
    if (!jodiVal || jodiVal.includes('*') || jodiVal.includes('✪')) return;
    const fam = getFamilyMembers(jodiVal);
    if (manualHighlightedFamily.length > 0 && manualHighlightedFamily.includes(jodiVal)) {
      setManualHighlightedFamily([]);
    } else {
      setManualHighlightedFamily(fam);
    }
  };

  if (!isLoggedIn) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#2c3e50' }}>
        <form onSubmit={handleLoginSubmit} style={{ background: '#fff', padding: '30px', borderRadius: '8px', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', textAlign: 'center', width: '280px' }}>
          <h2 style={{ margin: '0 0 15px 0', fontSize: '18px', color: '#2c3e50' }}>Matka App Login</h2>
          <input 
            type="password" 
            placeholder="Enter Security PIN" 
            value={loginPin} 
            onChange={(e) => setLoginPin(e.target.value)}
            style={{ width: '100%', padding: '10px', fontSize: '14px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
          />
          {loginError && <p style={{ color: 'red', fontSize: '12px', margin: '0 0 10px 0' }}>{loginError}</p>}
          <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#27ae60', color: '#fff', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Login
          </button>
        </form>
      </div>
    );
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '50px', fontWeight: 'bold' }}>Loading Matka Data...</div>;
  }

  const currentMatch = matchedSets[currentMatchIndex] || null;
  const selectedMinRow = selectedCells.length > 0 ? Math.min(...selectedCells.map((c) => c.rowIndex)) : 0;

  return (
    <div className="app-wrapper">
      <header className="app-header" style={{ padding: '8px', background: '#2c3e50', color: '#fff' }}>
        <h2 style={{ margin: '0 0 6px 0', fontSize: '16px', textAlign: 'center' }}>
          Matka Pattern Finder App
        </h2>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '12px' }}>
            किमान जुळणाऱ्या जोड्या:
            <select 
              value={minMatchCount} 
              onChange={(e) => setMinMatchCount(parseInt(e.target.value, 10))}
              style={{ marginLeft: '4px', padding: '2px', fontSize: '12px' }}
            >
              <option value={1}>1+</option>
              <option value={2}>2+</option>
              <option value={3}>3+</option>
              <option value={4}>4+</option>
              <option value={5}>5+</option>
              <option value={6}>6+</option>
              <option value={7}>7+</option>
            </select>
          </label>

          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#ffeb3b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input 
              type="checkbox" 
              checked={strictMode} 
              onChange={(e) => setStrictMode(e.target.checked)} 
            />
            Strict Exact Match Mode
          </label>

          <button 
            onClick={runPatternSearch} 
            disabled={selectedCells.length === 0}
            style={{ padding: '4px 10px', fontWeight: 'bold', backgroundColor: '#27ae60', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '12px' }}
          >
            Find Pattern
          </button>

          <button 
            onClick={handleReset}
            style={{ padding: '4px 10px', fontWeight: 'bold', backgroundColor: '#e74c3c', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '12px' }}
          >
            Reset
          </button>

          <button 
            onClick={scrollToBottom}
            style={{ padding: '4px 10px', fontWeight: 'bold', backgroundColor: '#3498db', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '12px' }}
          >
            Go To Bottom ⬇
          </button>

          {matchedSets.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '6px', background: '#34495e', padding: '3px 6px', borderRadius: '3px' }}>
              <button 
                onClick={() => setCurrentMatchIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentMatchIndex === 0}
                style={{ cursor: 'pointer', fontSize: '11px' }}
              >
                ◀ Prev
              </button>
              <span style={{ fontSize: '12px', fontWeight: 'bold' }}>
                Match {currentMatchIndex + 1} of {matchedSets.length}
              </span>
              <button 
                onClick={() => setCurrentMatchIndex((prev) => Math.min(matchedSets.length - 1, prev + 1))}
                disabled={currentMatchIndex === matchedSets.length - 1}
                style={{ cursor: 'pointer', fontSize: '11px' }}
              >
                Next ▶
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="side-by-side-container" style={{ display: 'flex', gap: '10px', padding: '8px' }}>
        
        {/* LEFT PANEL: FULL SHEET HISTORY */}
        <div className="panel-container scrollable-panel" ref={leftPanelRef} style={{ flex: 1, overflowX: 'auto', maxHeight: '80vh', overflowY: 'auto' }}>
          <h3 className="panel-header" style={{ background: '#34495e', color: '#fff', padding: '4px', margin: 0, fontSize: '13px', position: 'sticky', top: 0, zIndex: 10 }}>
            FULL SHEET HISTORY
          </h3>
          <table 
            className="matka-pdf-table" 
            onMouseUp={handleEndSelection} 
            onTouchEnd={handleEndSelection}
            onTouchMove={handleTouchMove}
            style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}
          >
            <thead style={{ position: 'sticky', top: '25px', zIndex: 9, background: '#fff' }}>
              <tr>
                {DAYS.map((day, idx) => (
                  <th key={day} style={{ width: idx === 0 ? '70px' : 'auto', padding: '3px 1px', fontSize: '11px' }}>{day}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fullSheetData.map((week, rIdx) => {
                const isLastRow = rIdx === fullSheetData.length - 1;

                return (
                  <tr key={`full-row-${rIdx}`} ref={isLastRow ? lastRowRef : null}>
                    {week.map((rawVal, cIdx) => {
                      if (cIdx === 0) {
                        return (
                          <td 
                            key={`full-date-${rIdx}`} 
                            className="pdf-date-cell" 
                            style={{ padding: '2px 1px', fontSize: '10px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}
                          >
                            {formatDateString(rawVal)}
                          </td>
                        );
                      }

                      const formattedVal = formatJodiVal(rawVal);
                      const isSelected = selectedCells.some((cell) => cell.rowIndex === rIdx && cell.colIndex === cIdx);

                      let isMatchedInOriginal = false;
                      let isExactJodiMatch = false;
                      let isDiffMatch = false;
                      let isTotalMatch = false;
                      let isRepeatMatch = false;

                      if (currentMatch) {
                        const matchStart = currentMatch.startRowIndex;
                        const maxSelRow = selectedCells.length > 0 ? Math.max(...selectedCells.map(c => c.rowIndex)) : 0;

                        if (rIdx >= selectedMinRow && rIdx <= maxSelRow) {
                          const offsetRow = rIdx - selectedMinRow;
                          const targetHistJodi = formatJodiVal(fullSheetData[matchStart + offsetRow]?.[cIdx] || "");
                          const posKey = `${offsetRow}_${cIdx}`;
                          
                          if (checkSameFamily(formattedVal, targetHistJodi) || formattedVal === targetHistJodi) {
                            isMatchedInOriginal = true;
                          }
                          if (formattedVal === targetHistJodi) isExactJodiMatch = true;
                          if (currentMatch.repeatPositions.includes(posKey)) isRepeatMatch = true;

                          const selMetrics = calculateMetrics(formattedVal);
                          const matchMetrics = calculateMetrics(targetHistJodi);
                          if (selMetrics.diffNum !== null && selMetrics.diffNum === matchMetrics.diffNum) isDiffMatch = true;
                          if (selMetrics.totalNum !== null && selMetrics.totalNum === matchMetrics.totalNum) isTotalMatch = true;
                        }
                      }

                      const famColor = getFamilyColor(formattedVal);
                      const isRed = isRedJodi(formattedVal);
                      const { diff, total } = calculateMetrics(formattedVal);

                      const isManualHighlight = manualHighlightedFamily.includes(formattedVal);

                      let cellBg = '#ffffff';
                      if (isManualHighlight) {
                        cellBg = CUSTOM_HIGHLIGHT_COLOR; 
                      } else if (matchedSets.length === 0 && isSelected) {
                        cellBg = '#a0c4ff'; 
                      } else if (isMatchedInOriginal || isRepeatMatch) {
                        cellBg = famColor;
                      }

                      const isHighlightCell = isMatchedInOriginal || isRepeatMatch || isManualHighlight;

                      return (
                        <td
                          key={`full-cell-${rIdx}-${cIdx}`}
                          className="pdf-jodi-cell"
                          data-row={rIdx}
                          data-col={cIdx}
                          style={{ 
                            backgroundColor: cellBg, 
                            border: isManualHighlight ? '2px solid #00c853' : isExactJodiMatch ? '2px solid #b71c1c' : isHighlightCell ? '2px solid #27ae60' : '1px solid #ccc',
                            fontWeight: 'bold',
                            padding: '2px 0px',
                            cursor: 'pointer' 
                          }}
                          onMouseDown={() => handleStartSelection(rIdx, cIdx, formattedVal)}
                          onMouseEnter={() => handleMoveSelection(rIdx, cIdx)}
                          onTouchStart={() => handleStartSelection(rIdx, cIdx, formattedVal)}
                          onClick={() => {
                            if (matchedSets.length > 0 && !isHighlightCell) {
                              handleJodiCellClick(formattedVal);
                            }
                          }}
                        >
                          <div data-row={rIdx} data-col={cIdx} className={`jodi-val ${isRed ? 'red-text' : ''}`} style={{ fontSize: '14px', fontWeight: 'bold', textAlign: 'center', lineHeight: '1.1' }}>
                            {formattedVal || '**'}
                            {isExactJodiMatch && <span style={{ color: '#b71c1c', fontSize: '10px', marginLeft: '1px' }}>★</span>}
                          </div>
                          <div data-row={rIdx} data-col={cIdx} className="metrics-row" style={{ fontSize: '9px', display: 'flex', justifyContent: 'space-between', padding: '0 2px', marginTop: '1px' }}>
                            <span className="diff-val" style={{ color: '#8b0000', fontWeight: 'bold', backgroundColor: isDiffMatch ? '#fff59d' : 'transparent', padding: '0 1px', borderRadius: '2px' }}>
                              {diff || ''}
                            </span>
                            <span className="total-val" style={{ color: '#006400', fontWeight: 'bold', backgroundColor: isTotalMatch ? '#fff59d' : 'transparent', padding: '0 1px', borderRadius: '2px' }}>
                              {total || ''}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* RIGHT PANEL: MATCHED RESULT WITH PAST & FUTURE ROWS */}
        <div className="matches-wrapper" style={{ flex: 1, overflowX: 'auto', maxHeight: '80vh', overflowY: 'auto' }}>
          {currentMatch ? (
            <div className="panel-container">
              <h3 className="panel-header" style={{ background: '#27ae60', color: '#fff', padding: '4px', margin: 0, fontSize: '13px', position: 'sticky', top: 0, zIndex: 10 }}>
                MATCHED SET {currentMatchIndex + 1} OF {matchedSets.length} ({currentMatch.matchCount} MATCHED) - DATE: {currentMatch.startDate}
              </h3>
              <table className="matka-pdf-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <thead style={{ position: 'sticky', top: '25px', zIndex: 9, background: '#fff' }}>
                  <tr>
                    {DAYS.map((day, idx) => (
                      <th key={day} style={{ width: idx === 0 ? '70px' : 'auto', padding: '3px 1px', fontSize: '11px' }}>{day}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {currentMatch.matchBlock.map((week, blockIdx) => {
                    const pastCount = currentMatch.pastRowsCount;
                    const patternLen = currentMatch.matchedPatternLength;

                    const isPastRow = blockIdx < pastCount;
                    const isPatternRow = blockIdx >= pastCount && blockIdx < pastCount + patternLen;
                    const isFutureRow = blockIdx >= pastCount + patternLen;

                    const patternRowIndex = blockIdx - pastCount;

                    return (
                      <tr 
                        key={`match-row-${blockIdx}`}
                        style={{ 
                          backgroundColor: isPastRow ? '#eef7ff' : isFutureRow ? '#fcf8e3' : 'transparent' 
                        }}
                      >
                        {week.map((rawVal, cIdx) => {
                          if (cIdx === 0) {
                            return (
                              <td 
                                key={`match-date-${blockIdx}`} 
                                className="pdf-date-cell" 
                                style={{ 
                                  padding: '2px 1px', 
                                  fontSize: '10px', 
                                  whiteSpace: 'nowrap', 
                                  textOverflow: 'ellipsis', 
                                  overflow: 'hidden',
                                  fontWeight: (!isPatternRow) ? 'bold' : 'normal',
                                  color: isPastRow ? '#2980b9' : isFutureRow ? '#d35400' : 'inherit'
                                }}
                              >
                                {formatDateString(rawVal)} 
                                {isPastRow && blockIdx === pastCount - 1 && " ⬆"}
                                {isFutureRow && blockIdx === pastCount + patternLen && " ⬇"}
                              </td>
                            );
                          }

                          const formattedVal = formatJodiVal(rawVal);
                          const targetSelectedCell = isPatternRow 
                            ? selectedCells.find((c) => (c.rowIndex - selectedMinRow) === patternRowIndex && c.colIndex === cIdx)
                            : null;
                          const posKey = `${patternRowIndex}_${cIdx}`;

                          let isMatch = false;
                          let isExactJodiMatch = false;
                          let isDiffMatch = false;
                          let isTotalMatch = false;
                          let isRepeatMatch = false;

                          if (isPatternRow) {
                            if (currentMatch.repeatPositions.includes(posKey)) {
                              isRepeatMatch = true;
                            }

                            if (targetSelectedCell) {
                              if (checkSameFamily(formattedVal, targetSelectedCell.value) || formattedVal === targetSelectedCell.value) {
                                isMatch = true;
                              }
                              if (formattedVal === targetSelectedCell.value) {
                                isExactJodiMatch = true;
                              }

                              const selMetrics = calculateMetrics(targetSelectedCell.value);
                              const resMetrics = calculateMetrics(formattedVal);

                              if (selMetrics.diffNum !== null && selMetrics.diffNum === resMetrics.diffNum) isDiffMatch = true;
                              if (selMetrics.totalNum !== null && selMetrics.totalNum === resMetrics.totalNum) isTotalMatch = true;
                            }
                          }

                          const famColor = getFamilyColor(formattedVal);
                          const isRed = isRedJodi(formattedVal);
                          const { diff, total } = calculateMetrics(formattedVal);

                          const isManualHighlight = manualHighlightedFamily.includes(formattedVal);

                          let cellBg = '#ffffff';
                          if (isManualHighlight) {
                            cellBg = CUSTOM_HIGHLIGHT_COLOR; 
                          } else if (isMatch || isRepeatMatch) {
                            cellBg = famColor;
                          }

                          return (
                            <td
                              key={`match-cell-${blockIdx}-${cIdx}`}
                              className="pdf-jodi-cell"
                              style={{ 
                                backgroundColor: cellBg, 
                                border: isManualHighlight ? '2px solid #00c853' : isExactJodiMatch ? '2px solid #b71c1c' : (isMatch || isRepeatMatch) ? '2px solid #27ae60' : '1px solid #ccc',
                                fontWeight: 'bold',
                                padding: '2px 0px',
                                cursor: 'pointer'
                              }}
                              onClick={() => {
                                handleJodiCellClick(formattedVal);
                              }}
                            >
                              <div className={`jodi-val ${isRed ? 'red-text' : ''}`} style={{ fontSize: '14px', fontWeight: 'bold', textAlign: 'center', lineHeight: '1.1' }}>
                                {formattedVal || '**'}
                                {isExactJodiMatch && <span style={{ color: '#b71c1c', fontSize: '10px', marginLeft: '1px' }}>★</span>}
                              </div>
                              <div className="metrics-row" style={{ fontSize: '9px', display: 'flex', justifyContent: 'space-between', padding: '0 2px', marginTop: '1px' }}>
                                <span className="diff-val" style={{ color: '#8b0000', fontWeight: 'bold', backgroundColor: isDiffMatch ? '#fff59d' : 'transparent', padding: '0 1px', borderRadius: '2px' }}>
                                  {diff || ''}
                                </span>
                                <span className="total-val" style={{ color: '#006400', fontWeight: 'bold', backgroundColor: isTotalMatch ? '#fff59d' : 'transparent', padding: '0 1px', borderRadius: '2px' }}>
                                  {total || ''}
                                </span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="panel-container placeholder-panel" style={{ padding: '20px', textAlign: 'center', background: '#f9f9f9', border: '1px dashed #ccc' }}>
              <h3 className="panel-header" style={{ color: '#777', fontSize: '13px' }}>MATCHED HISTORY RESULTS</h3>
              <p className="placeholder-text" style={{ color: '#666', fontSize: '12px' }}>
                डाव्या बाजूच्या Sheet वर drag/touch करून सिलेक्ट करा आणि **Find Pattern** वर क्लिक करा.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default App;
