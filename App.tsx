import React, { useState, useEffect } from 'react';
import './App.css';
import { getJodiMetrics, checkSameFamily } from './utils/matkaLogic';

const DAYS: string[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];

const GOOGLE_SHEET_API_URL: string = "https://script.google.com/macros/s/AKfycbxl1Qq4yqrRuvYC_H3ZsMDXyUGZw245Ws3kWm8l075Osb0WyZktd6QJosOe_jdgHECd/exec";

interface SelectedCell {
  rowIndex: number;
  colIndex: number;
  value: string;
}

export const App: React.FC = () => {
  const [fullSheetData, setFullSheetData] = useState<string[][]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentGrid, setCurrentGrid] = useState<string[][]>([]);
  const [matchedSets, setMatchedSets] = useState<string[][][]>([]);
  const [isSelecting, setIsSelecting] = useState<boolean>(false);
  const [selectedCells, setSelectedCells] = useState<SelectedCell[]>([]);

  useEffect(() => {
    const fetchData = async (): Promise<void> => {
      try {
        if (!GOOGLE_SHEET_API_URL || GOOGLE_SHEET_API_URL.includes("YOUR_GOOGLE_APPS_SCRIPT")) {
          console.warn("Google Sheet API URL is not set.");
          setLoading(false);
          return;
        }

        const response = await fetch(GOOGLE_SHEET_API_URL);
        const rawData: unknown = await response.json();

        if (Array.isArray(rawData) && rawData.length > 0) {
          const formattedData = rawData as string[][];
          setFullSheetData(formattedData);
          setCurrentGrid(formattedData.slice(-20));
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
    setIsSelecting(true);
    setSelectedCells([{ rowIndex: rIdx, colIndex: cIdx, value }]);
  };

  const handleMouseEnter = (rIdx: number, cIdx: number, value: string): void => {
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
        const targetHistJodi = historicalData[i + offsetRow]?.[cell.colIndex] || "";

        const isFamMatch = checkSameFamily(cell.value, targetHistJodi);
        if (!isFamMatch && cell.value !== targetHistJodi) {
          isMatch = false;
          break;
        }
      }

      if (isMatch) {
        const matchBlock = historicalData.slice(i, i + 9);
        matches.push(matchBlock);
      }
    }

    setMatchedSets(matches);
  };

  const renderTable = (gridData: string[][], title: string, isCurrentSet: boolean) => (
    <div className="panel-container">
      <h3 className="panel-header">{title}</h3>
      <table className="matka-table" onMouseUp={handleMouseUp}>
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
              {week.map((jodiVal, cIdx) => {
                const isSelected = isCurrentSet && selectedCells.some(
                  (cell) => cell.rowIndex === rIdx && cell.colIndex === cIdx
                );

                const currentSelectedJodi = currentGrid[rIdx]?.[cIdx] || "";
                
                const isFamilyMatch = checkSameFamily(jodiVal, currentSelectedJodi);
                const isExactMatch = jodiVal === currentSelectedJodi && jodiVal !== "" && jodiVal !== "**";

                const { jodi, totalStr, diffStr } = getJodiMetrics(jodiVal);

                let cellClass = "matka-cell";
                if (isSelected) cellClass += " cell-selected";
                if (!isCurrentSet && isExactMatch) cellClass += " exact-family-match";
                else if (!isCurrentSet && isFamilyMatch) cellClass += " group-family-match";

                return (
                  <td
                    key={`cell-${rIdx}-${cIdx}`}
                    className={cellClass}
                    onMouseDown={() => isCurrentSet && handleMouseDown(rIdx, cIdx, jodiVal)}
                    onMouseEnter={() => isCurrentSet && handleMouseEnter(rIdx, cIdx, jodiVal)}
                  >
                    <div className="jodi-number">{jodi}</div>
                    <div className="metrics-container">
                      {diffStr ? <span className="diff-label">{diffStr}</span> : null}
                      {totalStr ? <span className="total-label">{totalStr}</span> : null}
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

  if (loading) {
    return <div className="loading-spinner">Loading Matka Data...</div>;
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
