import React, { useState, useEffect } from 'react';
import './App.css';

// --- MATKA FAMILY GROUPS ---
const JODI_FAMILIES: Record<string, string[]> = {
  "01": ["01", "10", "06", "60", "51", "15", "56", "65"],
  "02": ["02", "20", "07", "70", "52", "25", "57", "75"],
  "03": ["03", "30", "08", "80", "53", "35", "58", "85"],
  "04": ["04", "40", "09", "90", "54", "45", "59", "95"],
  "05": ["05", "50", "00", "55"],
  "12": ["12", "21", "17", "71", "62", "26", "67", "76"],
  "13": ["13", "31", "18", "81", "63", "36", "68", "86"],
  "14": ["14", "41", "19", "91", "64", "46", "69", "96"],
  "16": ["16", "61", "11", "66"],
  "23": ["23", "32", "28", "82", "73", "37", "78", "87"],
  "24": ["24", "42", "29", "92", "74", "47", "79", "97"],
  "27": ["27", "72", "22", "77"],
  "34": ["34", "43", "39", "93", "84", "48", "89", "98"],
  "38": ["38", "83", "33", "88"],
  "49": ["49", "94", "44", "99"]
};

const isRedJodi = (jodiStr: string): boolean => {
  if (!jodiStr || jodiStr.length < 2) return false;
  const redFamilies = ["05", "16", "27", "38", "49"];
  for (const famKey of redFamilies) {
    if (JODI_FAMILIES[famKey].includes(jodiStr)) return true;
  }
  return false;
};

const checkSameFamily = (jodi1: string, jodi2: string): boolean => {
  if (!jodi1 || !jodi2 || jodi1.includes('*') || jodi2.includes('*') || jodi1.includes('✪')) return false;
  for (const family of Object.values(JODI_FAMILIES)) {
    if (family.includes(jodi1) && family.includes(jodi2)) return true;
  }
  return false;
};

// Absolute Difference Formula: D = |Open - Close|
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

const App: React.FC = () => {
  const [fullSheetData, setFullSheetData] = useState<string[][]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [matchedSets, setMatchedSets] = useState<{ matchBlock: string[][]; startDate: string; matchCount: number }[]>([]);
  
  const [isSelecting, setIsSelecting] = useState<boolean>(false);
  const [dragStartCell, setDragStartCell] = useState<CellPosition | null>(null);
  const [selectedCells, setSelectedCells] = useState<CellPosition[]>([]);
  
  // Minimum required matches in selected pattern (At least 2 or more jodis matched in position)
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

  // Rectangular Drag Selection
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
    if (selectedCells.length > 0) {
      runPatternSearch();
    }
  };

  const runPatternSearch = (): void => {
    if (selectedCells.length === 0 || fullSheetData.length === 0) return;

    const minRow = Math.min(...selectedCells.map((c) => c.rowIndex));
    const maxRow = Math.max(...selectedCells.map((c) => c.rowIndex));
    const numRows = maxRow - minRow + 1;

    const matches: { matchBlock: string[][]; startDate: string; matchCount: number }[] = [];

    // Scan history
    for (let i = 0; i <= fullSheetData.length - numRows; i++) {
      if (i === minRow) continue; // Skip current selection

      let matchCount = 0;

      for (const cell of selectedCells) {
        const offsetRow = cell.rowIndex - minRow;
        const targetHistJodi = formatJodiVal(fullSheetData[i + offsetRow]?.[cell.colIndex] || "");

        // Check if exact or family match in same day/position
        const isFamMatch = checkSameFamily(cell.value, targetHistJodi);
        if (isFamMatch || cell.value === targetHistJodi) {
          matchCount++;
        }
      }

      // If matches are found above the minimum criteria
      if (matchCount >= minMatchCount) {
        const matchBlock = fullSheetData.slice(i, i + numRows);
        const startDate = formatDateString(matchBlock[0]?.[0] || "");
        matches.push({ matchBlock, startDate, matchCount });
      }
    }

    // Sort blocks by highest matches found
    matches.sort((a, b) => b.matchCount - a.matchCount);
    setMatchedSets(matches);
  };

  const renderTable = (gridData: string[][], title: string, isCurrentSet: boolean) => {
    const minRow = selectedCells.length > 0 ? Math.min(...selectedCells.map((c) => c.rowIndex)) : 0;

    return (
      <div className={`panel-container ${isCurrentSet ? 'scrollable-panel' : ''}`}>
        <h3 className="panel-header">{title}</h3>
        <table className="matka-pdf-table" onMouseUp={handleMouseUp}>
          <thead>
            <tr>
              {DAYS.map((day) => (
                <th key={day}>{day}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gridData.map((week, rIdx) => (
              <tr key={`row-${rIdx}`}>
                {week.map((rawVal, cIdx) => {
                  const isDateCol = cIdx === 0;
                  const formattedVal = isDateCol ? formatDateString(rawVal) : formatJodiVal(rawVal);

                  if (isDateCol) {
                    return (
                      <td key={`cell-${rIdx}-${cIdx}`} className="pdf-date-cell">
                        {formattedVal}
                      </td>
                    );
                  }

                  const isSelected = isCurrentSet && selectedCells.some((cell) => cell.rowIndex === rIdx && cell.colIndex === cIdx);

                  // Highlights for History Matches
                  const targetSelectedCell = selectedCells.find(
                    (c) => (c.rowIndex - minRow) === rIdx && c.colIndex === cIdx
                  );

                  const isExactMatch = !isCurrentSet && targetSelectedCell && formattedVal === targetSelectedCell.value && formattedVal !== "" && !formattedVal.includes('*');
                  const isFamilyMatch = !isCurrentSet && targetSelectedCell && checkSameFamily(formattedVal, targetSelectedCell.value);

                  const isRed = isRedJodi(formattedVal);
                  const { diff, total } = calculateMetrics(formattedVal);

                  let cellClass = "pdf-jodi-cell";
                  if (isSelected) cellClass += " cell-selected";
                  if (isExactMatch) cellClass += " exact-family-match";
                  else if (isFamilyMatch) cellClass += " group-family-match";

                  return (
                    <td
                      key={`cell-${rIdx}-${cIdx}`}
                      className={cellClass}
                      onMouseDown={() => isCurrentSet && handleMouseDown(rIdx, cIdx, formattedVal)}
                      onMouseEnter={() => isCurrentSet && handleMouseEnter(rIdx, cIdx)}
                    >
                      <div className={`jodi-val ${isRed ? 'red-text' : ''}`}>
                        {formattedVal || '**'}
                      </div>
                      <div className="metrics-row">
                        <span className="diff-val">{diff || ''}</span>
                        <span className="total-val">{total || ''}</span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  if (loading) {
    return <div className="loading-spinner">Loading Matka Chart Data...</div>;
  }

  return (
    <div className="app-wrapper">
      <header className="app-header">
        <h2>Matka Pattern Finder App</h2>

        {/* MINIMUM MATCH FILTER */}
        <div style={{ textAlign: 'center', marginBottom: '10px' }}>
          <label style={{ fontSize: '13px', fontWeight: 'bold', marginRight: '10px' }}>
            कमकिमान किती जोड्या जुळल्या पाहिजेत:
          </label>
          <select 
            value={minMatchCount} 
            onChange={(e) => {
              setMinMatchCount(parseInt(e.target.value, 10));
              if (selectedCells.length > 0) runPatternSearch();
            }}
            style={{ padding: '4px 8px', fontSize: '12px' }}
          >
            <option value={1}>किमान १ तरी जोडी मॅच असावी</option>
            <option value={2}>किमान २ जोड्या मॅच असाव्यात (Best)</option>
            <option value={3}>किमान ३ जोड्या मॅच असाव्यात</option>
            <option value={5}>किमान ५ जोड्या मॅच असाव्यात</option>
          </select>
        </div>
      </header>

      <div className="side-by-side-container">
        {renderTable(fullSheetData, "FULL SHEET HISTORY (1 ते 20 आठवडे ड्रॅग करा)", true)}

        <div className="matches-wrapper">
          {matchedSets.length > 0 ? (
            matchedSets.map((item, idx) => (
              <React.Fragment key={`match-${idx}`}>
                {renderTable(
                  item.matchBlock, 
                  `MATCHED HISTORICAL PATTERN ${idx + 1} (${item.matchCount} JODIS MATCHED) - DATE: ${item.startDate}`, 
                  false
                )}
              </React.Fragment>
            ))
          ) : (
            <div className="panel-container placeholder-panel">
              <h3 className="panel-header">MATCHED HISTORY RESULTS</h3>
              <p className="placeholder-text">
                डाव्या बाजूच्या Sheet वर १ ते २० आठवडे drag करून सिलेक्ट करा. ज्या ज्या ठिकाणी जोड्या फॅमिली/एक्झॅक्ट जुळतील ते सर्व पॅटर्न उजवीकडे दिसतील.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
