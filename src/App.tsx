import React, { useState, useEffect } from 'react';
import './App.css';

// --- 15 MATKA FAMILIES WITH UNIQUE COLORS ---
const JODI_FAMILIES: Record<string, { members: string[]; color: string }> = {
  "01": { members: ["01", "10", "06", "60", "51", "15", "56", "65"], color: "#FFE1E6" }, // Light Red/Pink
  "02": { members: ["02", "20", "07", "70", "52", "25", "57", "75"], color: "#E2F0D9" }, // Soft Green
  "03": { members: ["03", "30", "08", "80", "53", "35", "58", "85"], color: "#FFF2CC" }, // Light Yellow
  "04": { members: ["04", "40", "09", "90", "54", "45", "59", "95"], color: "#FCE4D6" }, // Light Orange
  "05": { members: ["05", "50", "00", "55"], color: "#EDEDED" },                         // Light Gray
  "12": { members: ["12", "21", "17", "71", "62", "26", "67", "76"], color: "#D9E1F2" }, // Light Blue
  "13": { members: ["13", "31", "18", "81", "63", "36", "68", "86"], color: "#E1D5E7" }, // Light Purple
  "14": { members: ["14", "41", "19", "91", "64", "46", "69", "96"], color: "#D5E8D4" }, // Mint Green
  "16": { members: ["16", "61", "11", "66"], color: "#F8CECC" },                         // Pastel Rose
  "23": { members: ["23", "32", "28", "82", "73", "37", "78", "87"], color: "#DAE8FC" }, // Ice Blue
  "24": { members: ["24", "42", "29", "92", "74", "47", "79", "97"], color: "#FFF2CC" }, // Cream
  "27": { members: ["27", "72", "22", "77"], color: "#E1F5FE" },                         // Sky Light
  "34": { members: ["34", "43", "39", "93", "84", "48", "89", "98"], color: "#F3E5F5" }, // Lavender
  "38": { members: ["38", "83", "33", "88"], color: "#E8F5E9" },                         // Tea Green
  "49": { members: ["49", "94", "44", "99"], color: "#FFFDE7" }                          // Soft Lemon
};

const getFamilyColor = (jodiStr: string): string => {
  if (!jodiStr || jodiStr.length < 2 || jodiStr.includes('*') || jodiStr.includes('✪')) return 'transparent';
  for (const fam of Object.values(JODI_FAMILIES)) {
    if (fam.members.includes(jodiStr)) return fam.color;
  }
  return 'transparent';
};

const checkSameFamily = (jodi1: string, jodi2: string): boolean => {
  if (!jodi1 || !jodi2 || jodi1.includes('*') || jodi2.includes('*') || jodi1.includes('✪')) return false;
  for (const fam of Object.values(JODI_FAMILIES)) {
    if (fam.members.includes(jodi1) && fam.members.includes(jodi2)) return true;
  }
  return false;
};

const isRedJodi = (jodiStr: string): boolean => {
  if (!jodiStr || jodiStr.length < 2) return false;
  const redFamilies = ["05", "16", "27", "38", "49"];
  for (const famKey of redFamilies) {
    if (JODI_FAMILIES[famKey].members.includes(jodiStr)) return true;
  }
  return false;
};

// Accurate Difference Calculation: D = |Open - Close|
const calculateMetrics = (jodiStr: string) => {
  if (!jodiStr || jodiStr.length < 2 || jodiStr.includes('*') || jodiStr.includes('✪')) {
    return { diff: null, total: null };
  }
  const open = parseInt(jodiStr[0], 10);
  const close = parseInt(jodiStr[1], 10);
  if (isNaN(open) || isNaN(close)) return { diff: null, total: null };

  const diff = Math.abs(open - close);
  const total = (open + close) % 10;

  return { diff: `D-${diff}`, total: `T-${total}` };
};

const formatJodiVal = (val: string): string => {
  if (!val) return '';
  const trimmed = val.trim();
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
}

const App: React.FC = () => {
  const [fullSheetData, setFullSheetData] = useState<string[][]>([]);
  const [ setLoading] = useState<boolean>(true);
  
  const [isSelecting, setIsSelecting] = useState<boolean>(false);
  const [dragStartCell, setDragStartCell] = useState<CellPosition | null>(null);
  const [selectedCells, setSelectedCells] = useState<CellPosition[]>([]);
  
  const [matchedSets, setMatchedSets] = useState<MatchResult[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0);
  const [minMatchCount, setMinMatchCount] = useState<number>(2);

  useEffect(() => {
    const fetchData = async (): Promise<void> => {
      try {
        const response = await fetch(GOOGLE_SHEET_API_URL, {
          method: 'GET',
          redirect: 'follow',
        });
        const rawData: unknown = await response.json();

        if (Array.isArray(rawData) && rawData.length > 0) {
          const formattedData = (rawData as (string | number)[][]).map((row) =>
            row.map((cell) => (cell !== null && cell !== undefined ? String(cell).trim() : ""))
          );

          const cleanData = formattedData.filter(
            (row) => row.some(c => c !== "") && !String(row[0]).toUpperCase().includes("DATE")
          );

          setFullSheetData(cleanData);
        }
        setLoading(false);
      } catch (error) {
        console.error("Error fetching Google Sheet data:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleMouseDown = (rIdx: number, cIdx: number, value: string): void => {
    if (cIdx === 0) return;
    setIsSelecting(true);
    const startCell = { rowIndex: rIdx, colIndex: cIdx, value };
    setDragStartCell(startCell);
    setSelectedCells([startCell]);
  };

  const handleMouseEnter = (rIdx: number, cIdx: number): void => {
    if (!isSelecting || !dragStartCell || cIdx === 0) return;

    const minRow = Math.min(dragStartCell.rowIndex, rIdx);
    const maxRow = Math.max(dragStartCell.rowIndex, rIdx);
    if (maxRow - minRow + 1 > 20) return;

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

  const handleMouseUp = (): void => {
    setIsSelecting(false);
  };

  const runPatternSearch = (): void => {
    if (selectedCells.length === 0 || fullSheetData.length === 0) return;

    const minRow = Math.min(...selectedCells.map((c) => c.rowIndex));
    const maxRow = Math.max(...selectedCells.map((c) => c.rowIndex));
    const numRows = maxRow - minRow + 1;

    const matches: MatchResult[] = [];

    for (let i = 0; i <= fullSheetData.length - numRows; i++) {
      if (i === minRow) continue;

      let matchCount = 0;

      for (const cell of selectedCells) {
        const offsetRow = cell.rowIndex - minRow;
        const targetHistJodi = formatJodiVal(fullSheetData[i + offsetRow]?.[cell.colIndex] || "");

        if (checkSameFamily(cell.value, targetHistJodi) || cell.value === targetHistJodi) {
          matchCount++;
        }
      }

      if (matchCount >= minMatchCount) {
        const matchBlock = fullSheetData.slice(i, i + numRows);
        const startDate = formatDateString(matchBlock[0]?.[0] || "");
        matches.push({ matchBlock, startDate, startRowIndex: i, matchCount });
      }
    }

    matches.sort((a, b) => b.matchCount - a.matchCount);
    setMatchedSets(matches);
    setCurrentMatchIndex(0);
  };

  const handleReset = (): void => {
    setSelectedCells([]);
    setMatchedSets([]);
    setCurrentMatchIndex(0);
  };

  const currentMatch = matchedSets[currentMatchIndex] || null;
  const selectedMinRow = selectedCells.length > 0 ? Math.min(...selectedCells.map((c) => c.rowIndex)) : 0;

  return (
    <div className="app-wrapper">
      <header className="app-header" style={{ padding: '10px', background: '#2c3e50', color: '#fff' }}>
        <h2 style={{ margin: '0 0 10px 0', fontSize: '18px', textAlign: 'center' }}>
          Matka Pattern Finder App
        </h2>

        {/* CONTROLS BAR */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '13px' }}>
            कमकिमान जुळणाऱ्या जोड्या:
            <select 
              value={minMatchCount} 
              onChange={(e) => setMinMatchCount(parseInt(e.target.value, 10))}
              style={{ marginLeft: '5px', padding: '3px' }}
            >
              <option value={1}>1+</option>
              <option value={2}>2+</option>
              <option value={3}>3+</option>
              <option value={5}>5+</option>
            </select>
          </label>

          <button 
            onClick={runPatternSearch} 
            disabled={selectedCells.length === 0}
            style={{ padding: '5px 15px', fontWeight: 'bold', backgroundColor: '#27ae60', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Find Pattern
          </button>

          <button 
            onClick={handleReset}
            style={{ padding: '5px 15px', fontWeight: 'bold', backgroundColor: '#e74c3c', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Reset
          </button>

          {matchedSets.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '10px', background: '#34495e', padding: '3px 8px', borderRadius: '4px' }}>
              <button 
                onClick={() => setCurrentMatchIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentMatchIndex === 0}
                style={{ cursor: 'pointer' }}
              >
                ◀ Prev
              </button>
              <span style={{ fontSize: '12px', fontWeight: 'bold' }}>
                Match {currentMatchIndex + 1} of {matchedSets.length}
              </span>
              <button 
                onClick={() => setCurrentMatchIndex((prev) => Math.min(matchedSets.length - 1, prev + 1))}
                disabled={currentMatchIndex === matchedSets.length - 1}
                style={{ cursor: 'pointer' }}
              >
                Next ▶
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="side-by-side-container" style={{ display: 'flex', gap: '15px', padding: '10px' }}>
        
        {/* LEFT PANEL: FULL SHEET HISTORY */}
        <div className="panel-container scrollable-panel" style={{ flex: 1 }}>
          <h3 className="panel-header" style={{ background: '#34495e', color: '#fff', padding: '6px', margin: 0, fontSize: '14px' }}>
            FULL SHEET HISTORY
          </h3>
          <table className="matka-pdf-table" onMouseUp={handleMouseUp} style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {DAYS.map((day) => <th key={day}>{day}</th>)}
              </tr>
            </thead>
            <tbody>
              {fullSheetData.map((week, rIdx) => (
                <tr key={`full-row-${rIdx}`}>
                  {week.map((rawVal, cIdx) => {
                    if (cIdx === 0) {
                      return <td key={`full-date-${rIdx}`} className="pdf-date-cell">{formatDateString(rawVal)}</td>;
                    }

                    const formattedVal = formatJodiVal(rawVal);
                    const isSelected = selectedCells.some((cell) => cell.rowIndex === rIdx && cell.colIndex === cIdx);

                    // Check if this row is part of the currently selected Match Result
                    let isMatchedInHistory = false;
                    if (currentMatch) {
                      const matchStart = currentMatch.startRowIndex;
                      const matchEnd = matchStart + (selectedCells.length > 0 ? (Math.max(...selectedCells.map(c => c.rowIndex)) - selectedMinRow) : 0);
                      
                      if (rIdx >= matchStart && rIdx <= matchEnd) {
                        const offsetRow = rIdx - matchStart;
                        const matchingSelectedCell = selectedCells.find((c) => (c.rowIndex - selectedMinRow) === offsetRow && c.colIndex === cIdx);
                        if (matchingSelectedCell && (checkSameFamily(matchingSelectedCell.value, formattedVal) || matchingSelectedCell.value === formattedVal)) {
                          isMatchedInHistory = true;
                        }
                      }
                    }

                    const famColor = getFamilyColor(formattedVal);
                    const isRed = isRedJodi(formattedVal);
                    const { diff, total } = calculateMetrics(formattedVal);

                    let cellBg = famColor;
                    if (isSelected) cellBg = '#a0c4ff'; // Selection highlight
                    else if (isMatchedInHistory) cellBg = '#ffd166'; // Current Match Highlight in Main Sheet

                    return (
                      <td
                        key={`full-cell-${rIdx}-${cIdx}`}
                        className={`pdf-jodi-cell ${isSelected ? 'cell-selected' : ''}`}
                        style={{ backgroundColor: cellBg, border: isMatchedInHistory ? '2px solid #d4af37' : '1px solid #ccc', cursor: 'pointer' }}
                        onMouseDown={() => handleMouseDown(rIdx, cIdx, formattedVal)}
                        onMouseEnter={() => handleMouseEnter(rIdx, cIdx)}
                      >
                        <div className={`jodi-val ${isRed ? 'red-text' : ''}`} style={{ fontWeight: 'bold' }}>
                          {formattedVal || '**'}
                        </div>
                        <div className="metrics-row" style={{ fontSize: '9px', display: 'flex', justifyContent: 'space-between' }}>
                          <span className="diff-val" style={{ color: '#8b0000' }}>{diff || ''}</span>
                          <span className="total-val" style={{ color: '#006400' }}>{total || ''}</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* RIGHT PANEL: CURRENT MATCH RESULT */}
        <div className="matches-wrapper" style={{ flex: 1 }}>
          {currentMatch ? (
            <div className="panel-container">
              <h3 className="panel-header" style={{ background: '#27ae60', color: '#fff', padding: '6px', margin: 0, fontSize: '14px' }}>
                MATCHED SET {currentMatchIndex + 1} OF {matchedSets.length} ({currentMatch.matchCount} JODIS MATCHED) - DATE: {currentMatch.startDate}
              </h3>
              <table className="matka-pdf-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {DAYS.map((day) => <th key={day}>{day}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {currentMatch.matchBlock.map((week, rIdx) => (
                    <tr key={`match-row-${rIdx}`}>
                      {week.map((rawVal, cIdx) => {
                        if (cIdx === 0) {
                          return <td key={`match-date-${rIdx}`} className="pdf-date-cell">{formatDateString(rawVal)}</td>;
                        }

                        const formattedVal = formatJodiVal(rawVal);
                        const targetSelectedCell = selectedCells.find((c) => (c.rowIndex - selectedMinRow) === rIdx && c.colIndex === cIdx);

                        const isMatch = targetSelectedCell && (checkSameFamily(formattedVal, targetSelectedCell.value) || formattedVal === targetSelectedCell.value);

                        const famColor = getFamilyColor(formattedVal);
                        const isRed = isRedJodi(formattedVal);
                        const { diff, total } = calculateMetrics(formattedVal);

                        return (
                          <td
                            key={`match-cell-${rIdx}-${cIdx}`}
                            className="pdf-jodi-cell"
                            style={{ 
                              backgroundColor: famColor, 
                              border: isMatch ? '2px solid #27ae60' : '1px solid #ccc',
                              outline: isMatch ? '2px solid #27ae60' : 'none'
                            }}
                          >
                            <div className={`jodi-val ${isRed ? 'red-text' : ''}`} style={{ fontWeight: 'bold' }}>
                              {formattedVal || '**'}
                            </div>
                            <div className="metrics-row" style={{ fontSize: '9px', display: 'flex', justifyContent: 'space-between' }}>
                              <span className="diff-val" style={{ color: '#8b0000' }}>{diff || ''}</span>
                              <span className="total-val" style={{ color: '#006400' }}>{total || ''}</span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="panel-container placeholder-panel" style={{ padding: '20px', textAlign: 'center', background: '#f9f9f9', border: '1px dashed #ccc' }}>
              <h3 className="panel-header" style={{ color: '#777' }}>MATCHED HISTORY RESULTS</h3>
              <p className="placeholder-text" style={{ color: '#666', fontSize: '13px' }}>
                डाव्या बाजूच्या Sheet वर १ ते २० आठवडे drag करून सिलेक्ट करा आणि **Find Pattern** बटणावर क्लिक करा.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default App;
