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

// Difference & Total Calculation
const getDiffAndTotalVal = (jodiStr: string) => {
  if (!jodiStr || jodiStr.length < 2 || jodiStr.includes('*') || jodiStr.includes('✪')) {
    return { diffVal: null, totalVal: null };
  }
  const open = parseInt(jodiStr[0], 10);
  const close = parseInt(jodiStr[1], 10);
  if (isNaN(open) || isNaN(close)) return { diffVal: null, totalVal: null };

  let diff = open - close;
  if (diff < 0) diff += 10;
  const total = (open + close) % 10;

  return { diffVal: diff, totalVal: total };
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

interface SelectedCell {
  rowIndex: number;
  colIndex: number; // 1 to 6 (MON to SAT)
  value: string;
}

const App: React.FC = () => {
  const [fullSheetData, setFullSheetData] = useState<string[][]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [matchedSets, setMatchedSets] = useState<string[][][]>([]);
  const [isSelecting, setIsSelecting] = useState<boolean>(false);
  const [selectedCells, setSelectedCells] = useState<SelectedCell[]>([]);

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
    if (cIdx === 0) return; // Prevent selecting Date column
    setIsSelecting(true);
    setSelectedCells([{ rowIndex: rIdx, colIndex: cIdx, value }]);
  };

  const handleMouseEnter = (rIdx: number, cIdx: number, value: string): void => {
    if (cIdx === 0) return;
    if (isSelecting) {
      const exists = selectedCells.some((cell) => cell.rowIndex === rIdx && cell.colIndex === cIdx);
      if (!exists) {
        const minRow = Math.min(...selectedCells.map((c) => c.rowIndex), rIdx);
        const maxRow = Math.max(...selectedCells.map((c) => c.rowIndex), rIdx);
        if (maxRow - minRow + 1 <= 20) {
          setSelectedCells((prev) => [...prev, { rowIndex: rIdx, colIndex: cIdx, value }]);
        }
      }
    }
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

    const matches: string[][][] = [];

    for (let i = 0; i <= fullSheetData.length - numRows; i++) {
      let isMatch = true;

      for (const cell of selectedCells) {
        const offsetRow = cell.rowIndex - minRow;
        const targetHistJodi = formatJodiVal(fullSheetData[i + offsetRow]?.[cell.colIndex] || "");

        const isFamMatch = checkSameFamily(cell.value, targetHistJodi);
        if (!isFamMatch && cell.value !== targetHistJodi) {
          isMatch = false;
          break;
        }
      }

      if (isMatch) {
        const matchBlock = fullSheetData.slice(i, i + numRows);
        matches.push(matchBlock);
      }
    }

    setMatchedSets(matches);
  };

  const renderTable = (gridData: string[][], title: string, isCurrentSet: boolean) => (
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

                // Target cell for comparing history match logic
                const targetSelectedCell = selectedCells.find((c) => c.colIndex === cIdx);
                const isExactMatch = !isCurrentSet && targetSelectedCell && formattedVal === targetSelectedCell.value && formattedVal !== "" && !formattedVal.includes('*');
                const isFamilyMatch = !isCurrentSet && targetSelectedCell && checkSameFamily(formattedVal, targetSelectedCell.value);

                // Exact Total & Difference Matching for surrounding non-selected cells
                let showDiff: string | null = null;
                let showTotal: string | null = null;

                const { diffVal, totalVal } = getDiffAndTotalVal(formattedVal);

                if (diffVal !== null && totalVal !== null) {
                  // Find corresponding row source if available
                  const sourceJodiVal = isCurrentSet
                    ? currentGridRowSource(rIdx, cIdx)
                    : targetSelectedCell ? targetSelectedCell.value : null;

                  if (sourceJodiVal) {
                    const sourceMetrics = getDiffAndTotalVal(sourceJodiVal);
                    if (sourceMetrics.diffVal === diffVal) showDiff = `D-${diffVal}`;
                    if (sourceMetrics.totalVal === totalVal) showTotal = `T-${totalVal}`;
                  }
                }

                const isRed = isRedJodi(formattedVal);

                let cellClass = "pdf-jodi-cell";
                if (isSelected) cellClass += " cell-selected";
                if (isExactMatch) cellClass += " exact-family-match";
                else if (isFamilyMatch) cellClass += " group-family-match";

                return (
                  <td
                    key={`cell-${rIdx}-${cIdx}`}
                    className={cellClass}
                    onMouseDown={() => isCurrentSet && handleMouseDown(rIdx, cIdx, formattedVal)}
                    onMouseEnter={() => isCurrentSet && handleMouseEnter(rIdx, cIdx, formattedVal)}
                  >
                    <div className={`jodi-val ${isRed ? 'red-text' : ''}`}>
                      {formattedVal || '**'}
                    </div>
                    {(showDiff || showTotal) && (
                      <div className="metrics-row">
                        <span className="diff-val">{showDiff || ''}</span>
                        <span className="total-val">{showTotal || ''}</span>
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // Helper function to get source cell for left grid
  const currentGridRowSource = (rIdx: number, cIdx: number) => {
    return formatJodiVal(fullSheetData[rIdx]?.[cIdx] || "");
  };

  if (loading) {
    return <div className="loading-spinner">Loading Matka Chart Data...</div>;
  }

  return (
    <div className="app-wrapper">
      <header className="app-header">
        <h2>Matka Pattern Finder App</h2>
      </header>

      <div className="side-by-side-container">
        {renderTable(fullSheetData, "FULL SHEET HISTORY (SELECT UP TO 20 WEEKS)", true)}

        <div className="matches-wrapper">
          {matchedSets.length > 0 ? (
            matchedSets.map((matchBlock, idx) => (
              <React.Fragment key={`match-${idx}`}>
                {renderTable(matchBlock, `MATCHED PATTERN ${idx + 1} (${formatDateString(matchBlock[0][0])})`, false)}
              </React.Fragment>
            ))
          ) : (
            <div className="panel-container placeholder-panel">
              <h3 className="panel-header">MATCHED HISTORY RESULTS</h3>
              <p className="placeholder-text">डाव्या बाजूच्या Sheet वर 1 ते 20 आठवडे drag आणि select करा.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
