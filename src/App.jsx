import React, { useState, useRef } from 'react'; // Import useRef
import './App.css';

function App() {
  const fileInputRef = useRef(null); // Add useRef for file input
  const [csvData, setCsvData] = useState(''); // Default data removed
  const [processedData, setProcessedData] = useState([]);
  const [outputFileName, setOutputFileName] = useState('');
  const [userInputFileName, setUserInputFileName] = useState(''); // State for user-defined filename
  const [selectedRows, setSelectedRows] = useState(new Set()); // State for selected row indices
  const [error, setError] = useState('');

  const handleRowSelect = (index) => {
    const newSelectedRows = new Set(selectedRows);
    if (newSelectedRows.has(index)) {
      newSelectedRows.delete(index);
    } else {
      newSelectedRows.add(index);
    }
    setSelectedRows(newSelectedRows);
  };

  const handleSelectAllRows = (event) => {
    if (event.target.checked) {
      const allRowIndices = new Set(processedData.map((_, index) => index));
      setSelectedRows(allRowIndices);
    } else {
      setSelectedRows(new Set());
    }
  };

  const handleDeleteSelectedRows = () => {
    const newProcessedData = processedData.filter((_, index) => !selectedRows.has(index));
    setProcessedData(newProcessedData);
    setSelectedRows(new Set()); // Clear selection after deletion
  };

  // Helper function: Convert HH:MM to total minutes from midnight
  const timeToMinutes = (timeStr) => {
    try {
      const [hours, minutes] = timeStr.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes)) {
        throw new Error('Invalid time format');
      }
      return hours * 60 + minutes;
    } catch (e) {
      console.warn(`Warning: Could not parse time string '${timeStr}'.`, e);
      setError(`警告: 時刻文字列 '${timeStr}' を解析できませんでした。`);
      return null;
    }
  };

  const processCsv = () => {
    // alert("processCsv called"); // Removed alert
    // console.log("Processing CSV Data:", csvData); // Debug log removed
    setError('');
    setProcessedData([]);
    if (!csvData.trim()) {
      setError('CSVデータを入力してください。');
      return;
    }

    const lines = csvData.trim().split('\n'); // Changed from '\\n' to '\n'
    const parsedDataWithDuration = [];

    // Step 1: Parse CSV, remove spaces, calculate duration
    for (const line of lines) {
      if (!line.trim()) continue;
      const originalRow = line.split(',');
      const cleanedRow = originalRow.map(elem => elem.replace(/ /g, '')); // Replace all spaces

      let durationMinutes = null;
      if (cleanedRow.length > 0 && cleanedRow[0].includes('-')) {
        const timeRangeStr = cleanedRow[0];
        const [startTimeStr, endTimeStr] = timeRangeStr.split('-');

        if (startTimeStr && endTimeStr) {
          const startMinutes = timeToMinutes(startTimeStr);
          const endMinutes = timeToMinutes(endTimeStr);

          if (startMinutes !== null && endMinutes !== null) {
            durationMinutes = endMinutes - startMinutes;
            if (durationMinutes < 0) {
              durationMinutes += 1440; // Across midnight
            }
          } else {
            // timeToMinutes already set an error, so just skip this row's duration
            parsedDataWithDuration.push([null, ...cleanedRow]);
            continue;
          }
        } else {
            setError(`警告: 時刻範囲の形式が無効です: '${timeRangeStr}'`);
            parsedDataWithDuration.push([null, ...cleanedRow]);
            continue;
        }
      } else {
        // First element is not a time range, or row is empty
         parsedDataWithDuration.push([null, ...cleanedRow]);
         continue;
      }
      parsedDataWithDuration.push([durationMinutes, ...cleanedRow]);
    }

    // Step 2: Add character count of element 2
    const dataWithCharCount = parsedDataWithDuration.map(row => {
      let element2CharCount = null;
      if (row.length > 2 && typeof row[2] === 'string') { // row[0] is duration, row[1] is time_range, row[2] is element2
        element2CharCount = row[2].length;
      }
      return [...row, element2CharCount];
    });

    // Step 3: Calculate average (char count / duration)
    const finalProcessedData = dataWithCharCount.map(row => {
      const durationMinutes = row[0]; // Element 0: duration
      const charCount = row[row.length - 1]; // Last element from dataWithCharCount is charCount
      let averageCharsPerMinute = null;

      if (typeof durationMinutes === 'number' && durationMinutes > 0 && typeof charCount === 'number') {
        averageCharsPerMinute = charCount / durationMinutes;
        averageCharsPerMinute = Math.round(averageCharsPerMinute * 1000000) / 1000000; // Round to 6 decimal places
      }
      // The new structure will be [duration, original_timerange, elem2, ..., elem2_char_count, averageCharsPerMinute]
      // We are replacing the previous last element (which was also for average, but calculated differently)
      // So, we can just append the new average. The previous structure of dataWithCharCount is [duration, time_range, elem2, (elem3 if any), elem2_char_count]
      // The new average will be added as the last element.
      return [...row, averageCharsPerMinute]; 
    });

    // console.log("Final Processed Data:", finalProcessedData); // Debug log removed
    setProcessedData(finalProcessedData);
    setSelectedRows(new Set()); // Reset selection when new data is processed

    // Generate default filename and set it for both output and user input field
    const now = new Date();
    const timestampStr = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
    const defaultFileName = `output_with_header_${timestampStr}.csv`;
    setOutputFileName(defaultFileName);
    setUserInputFileName(defaultFileName); // Set as default for the input field
  };

  const downloadCsv = () => {
    const fileNameToUse = userInputFileName.trim() ? userInputFileName.trim() : outputFileName;
    if (!fileNameToUse.toLowerCase().endsWith('.csv')) {
      setError('ファイル名は .csv で終わる必要があります。');
      return;
    }
    if (processedData.length === 0) {
      setError('処理されたデータがありません。');
      return;
    }

    const header = ['経過時間', '区間', 'テロップ内容', '文字数', '文字数/秒'];
    // The processedData already has: [duration, time_range, elem2, elem3, ..., elem2_char_count, calculated_val]
    // We need to select and reorder for the output CSV.
    // Python script output: [duration, time_range, elem2, elem2_char_count, calculated_val_elem3_per_min]
    // Note: Python script's "elem3" is not directly in the output, only its use in "文字数/秒"
    // The header implies 5 columns.
    // Python output row: [duration_minutes, time_range_str, element2_str, element2_char_count, calculated_value_elem3_per_min]
    // Our JS `processedData` row: [duration, original_timerange, elem2, elem3 (if any), ..., elem2_char_count, calculated_val]
    // Indices for JS data:
    // 0: duration_minutes
    // 1: original_timerange_str (cleaned)
    // 2: element2_str (cleaned)
    // N-2: element2_char_count (last element but one from step 2)
    // N-1: calculated_value_elem3_per_min (last element from step 3)

    const csvRows = [
        header.join(','),
        ...processedData.map(row => {
            // Helper to convert to string and replace newlines for each cell
            const sanitizeCell = (cellValue) => {
                if (cellValue === null || cellValue === undefined) return '';
                return String(cellValue).replace(/\r\n|\r|\n/g, ' ');
            };

            const duration = sanitizeCell(row[0]);
            const timeRange = sanitizeCell(row[1]);
            const telopContent = sanitizeCell(row[2]);
            const charCount = sanitizeCell(row[row.length - 2]); // Assuming char count is second to last
            const averageValue = sanitizeCell(row[row.length - 1]); // Assuming average value is last

            // Ensure all parts are defined before joining, to avoid "undefined" in CSV
            return [
                duration,
                timeRange,
                telopContent,
                charCount,
                averageValue
            ].join(',');
        })
    ];
    const csvString = csvRows.join('\n'); // Use '\n' for row separator, consistent with typical CSV

    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', fileNameToUse); // Use potentially user-defined filename
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        setCsvData(content);
        // Trigger height adjustment for textarea after content is set
        // This might need a slight delay or a more robust way if direct update doesn't work
        setTimeout(() => {
          const textarea = document.querySelector('textarea');
          if (textarea) {
            textarea.style.height = 'inherit';
            textarea.style.height = `${textarea.scrollHeight}px`;
          }
        }, 0);
      };
      reader.readAsText(file);
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // defaultCsvData constant removed

  return (
    <div className="App">
      <h1>Uzit生成データからCSV生成</h1> {/* Restored header */}
      <input
        type="file"
        accept=".csv"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
        ref={fileInputRef}
      />
      <button onClick={triggerFileInput} style={{ marginBottom: '10px', backgroundColor: 'red', color: 'white' }}>
        CSVファイルをインポート
      </button>
      <textarea
        style={{ minHeight: '100px', overflowY: 'hidden' }} /* Removed width, relying on App.css */
        placeholder="CSVデータをここに入力..."
        value={csvData} // Use value for controlled component, removed defaultValue
        onChange={(e) => {
          // console.log('onChange triggered, new value:', e.target.value); // Debug log removed
          setCsvData(e.target.value);
          e.target.style.height = 'inherit'; // Reset height to recalculate
          e.target.style.height = `${e.target.scrollHeight}px`;
        }}
        onFocus={(e) => { // Also adjust on focus, removed setCsvData
          e.target.style.height = 'inherit';
          e.target.style.height = `${e.target.scrollHeight}px`;
        }}
      />
      <br />
      <button onClick={processCsv} style={{ marginTop: '10px' }}>処理開始</button>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {processedData.length > 0 && (
        <div style={{ marginTop: '20px' }}> {/* Removed width and margin, relying on App.css for .App container */}
          <h2>処理結果</h2>
          <div>
            <label htmlFor="fileNameInput">ファイル名: </label>
            <input
              type="text"
              id="fileNameInput"
              value={userInputFileName}
              onChange={(e) => setUserInputFileName(e.target.value)}
              placeholder="例: output.csv"
              style={{ width: '400px', marginRight: '10px', padding: '0.6em', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box', verticalAlign: 'middle', fontSize: '16px' }}
            />
            <button onClick={downloadCsv} disabled={processedData.length === 0} style={{ verticalAlign: 'middle' }}>
              CSVダウンロード
            </button>
            {selectedRows.size > 0 && (
              <button onClick={handleDeleteSelectedRows} style={{ marginLeft: '10px', verticalAlign: 'middle', backgroundColor: '#dc3545', borderColor: '#dc3545', color: 'white' }}>
                選択項目を削除 ({selectedRows.size})
              </button>
            )}
          </div>
          <div style={{ border: '1px solid #ccc', marginTop: '10px' }}> {/* Added marginTop for spacing */}
            <table style={{ width: '100%' }}>{/* Table width to 100% of its container, removed space before thead */}
              <thead>
                <tr>
                  <th><input type="checkbox" onChange={handleSelectAllRows} checked={processedData.length > 0 && selectedRows.size === processedData.length} /></th>
                  <th>経過時間</th>
                  <th>区間</th>
                  <th>テロップ内容</th>
                  <th>文字数</th>
                  <th>文字数/秒</th>
                </tr>
              </thead>
              <tbody>
                {processedData.map((row, index) => (
                  <tr key={index} className={selectedRows.has(index) ? 'selected-row' : ''}>
                    <td><input type="checkbox" checked={selectedRows.has(index)} onChange={() => handleRowSelect(index)} /></td>
                    <td>{row[0] === null || row[0] === undefined ? '' : row[0]}</td>
                    <td>{row[1] === null || row[1] === undefined ? '' : row[1]}</td>
                    <td>{row[2] === null || row[2] === undefined ? '' : row[2]}</td>
                    <td>{row[row.length - 2] === null || row[row.length - 2] === undefined ? '' : row[row.length - 2]}</td>{/* Char count */}
                    <td>{row[row.length - 1] === null || row[row.length - 1] === undefined ? '' : row[row.length - 1]}</td>{/* Average value */}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
