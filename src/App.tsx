import React, { useState, useEffect } from 'react';
import './App.css';

// --- MATKA LOGIC HELPERS ---
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

// Check if a Jodi is Red (Red / Half-Red / Cut)
const isRedJodi = (jodiStr: string): boolean => {
  if (!jodiStr || jodiStr.length < 2) return false;
  const redFamilies = ["05", "16", "27", "38", "49"];
  for (const famKey of redFamilies) {
    if (JODI_FAMILIES[famKey].includes(jodiStr)) return true;
  }
  return false;
};

const checkSameFamily = (jodi1: string, jodi2: string): boolean => {
  if (!jodi1 || !jodi2 || jodi1.includes('*') || jodi2.includes('*') || jodi1.includes('✪') || jodi2.includes('✪')) return false;
  for (const family of Object.values(JODI_FAMILIES)) {
    if (family.includes(jodi1) && family.includes(jodi2)) return true;
  }
  return false;
};

// Helper to format raw dates into DD-MM-YYYY format
const formatDateString = (dateVal: string): string => {
  if (!dateVal || dateVal.startsWith('#')) return '---';
  
  // If already DD-MM-YYYY or DD/MM/YYYY
  if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(dateVal)) {
    return dateVal.replace(/\//g, '-');
  }

  const parsed = new Date(dateVal);
  if (!isNaN(parsed.getTime())) {
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    return `${day}-${month}-${year}`;
  }

  return dateVal;
};

// Ensure single digits display with leading zero (e.g. 3 -> 03)
const formatJodiVal = (val: string): string => {
  if (!val) return '';
  const trimmed = val.trim();
  if (/^\d$/.test(trimmed)) {
    return `0${trimmed}`;
  }
  return trimmed;
};

const DAYS: string[] = ["DATE", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const GOOGLE_SHEET_API_URL: string = "https://script.google.com/macros/s/AKfycbxl1Qq4yqrRuvYC_H3ZsMDXyUGZw245Ws3kWm8l075Osb0WyZktd6QJosOe_jdgHECd/exec";

interface SelectedCell {
  rowIndex: number;
  colIndex: number;
  value: string;
}

const App: React.FC = () => {
  const [fullSheetData, setFullSheetData] = useState<string[][]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentGrid, setCurrentGrid] = useState<string[][]>([]);
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
          setCurrentGrid(cleanData.length > 20 ? cleanData.slice(-20) : cleanData);
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
    setSelectedCells([{ rowIndex: rIdx, colIndex: cIdx, value }]);
  };

  const handleMouseEnter = (rIdx: number, cIdx: number, value: string): void => {
    if (cIdx === 0) return;
    if (isSelecting) {
      const exists = selectedCells.some(
        (cell) => cell.rowIndex === rIdx && cell.colIndex === cIdx
      );
      if (!exists) {
        setSelectedCells((prev) => [...prev, { rowIndex: rIdx, colIndex: cIdx, value }]);
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
    const historicalData = fullSheetData.slice(0, Math.max(0, fullSheetData.length - 20));

    for (let i = 0; i <= historicalData.length - numRows; i++) {
      let isMatch = true;

      for (const cell of selectedCells) {
        const offsetRow = cell.rowIndex - minRow;
        const targetHistJodi = formatJodiVal(historicalData[i + offsetRow]?.[cell.colIndex] || "");

        const isFamMatch = checkSameFamily(cell.value, targetHistJodi);
        if (!isFamMatch && cell.value !== targetHistJodi) {
          isMatch = false;
          break;
        }
      }

      if (isMatch) {
        const matchBlock = historicalData.slice(i, i + numRows);
        matches.push(matchBlock);
      }
    }

    setMatchedSets(matches);
  };

  const renderTable = (gridData: string[][], title: string, isCurrentSet: boolean) => (
    <div className="panel-container">
      <h3 className="panel-header">{title}</h3>
      <table className="matka-sheet-table" onMouseUp={handleMouseUp}>
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
                const isDateColumn = cIdx === 0;
                const formattedVal = isDateColumn ? formatDateString(rawVal) : formatJodiVal(rawVal);

                const isSelected = isCurrentSet && selectedCells.some(
                  (cell) => cell.rowIndex === rIdx && cell.colIndex === cIdx
                );

                const currentSelectedJodi = formatJodiVal(currentGrid[rIdx]?.[cIdx] || "");
                
                const isFamilyMatch = !isDateColumn && checkSameFamily(formattedVal, currentSelectedJodi);
                const isExactMatch = !isDateColumn && formattedVal === currentSelectedJodi && formattedVal !== "" && !formattedVal.includes('*');

                const isRed = !isDateColumn && isRedJodi(formattedVal);

                let cellClass = isDateColumn ? "sheet-date-cell" : "sheet-jodi-cell";
                if (isSelected) cellClass += " cell-selected";
                if (!isCurrentSet && isExactMatch) cellClass += " exact-family-match";
                else if (!isCurrentSet && isFamilyMatch) cellClass += " group-family-match";
                if (isRed) cellClass += " red-jodi";

                return (
                  <td
                    key={`cell-${rIdx}-${cIdx}`}
                    className={cellClass}
                    onMouseDown={() => isCurrentSet && handleMouseDown(rIdx, cIdx, formattedVal)}
                    onMouseEnter={() => isCurrentSet && handleMouseEnter(rIdx, cIdx, formattedVal)}
                  >
                    {formattedVal}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (loading) {
    return <div className="loading-spinner">Loading Matka Chart...</div>;
  }

  return (
    <div className="app-wrapper">
      <header className="app-header">
        <h2>Matka Pattern Finder App</h2>
      </header>

      <div className="side-by-side-container">
        {renderTable(currentGrid, "CURRENT SELECTED SET", true)}

        {matchedSets.length > 0 ? (
          matchedSets.map((matchBlock, idx) => (
            <React.Fragment key={`match-${idx}`}>
              {renderTable(matchBlock, `FOUND MATCH HISTORY SET ${idx + 1}`, false)}
            </React.Fragment>
          ))
        ) : (
          <div className="panel-container placeholder-panel">
            <h3 className="panel-header">FOUND MATCH HISTORY SET 1</h3>
            <p className="placeholder-text">Select cells on the left grid to run similarity search.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
