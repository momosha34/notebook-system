// backend/utils/tableExport.js

// 将 Luckysheet 数据转换为可打印的 HTML 表格
export function convertToPrintableTable(sheetData) {
  if (!sheetData || !Array.isArray(sheetData) || sheetData.length === 0) {
    return '';
  }
  
  let html = '<div class="luckysheet-print-container">';
  
  sheetData.forEach((sheet, sheetIndex) => {
    html += generateSheetHTML(sheet, sheetIndex);
  });
  
  html += '</div>';
  return html;
}

// 生成单个工作表的 HTML
function generateSheetHTML(sheet, sheetIndex) {
  if (!sheet || !sheet.data) return '';
  
  const { data, name } = sheet;
  const rowCount = data.length;
  const colCount = data[0] ? data[0].length : 0;
  
  if (rowCount === 0 || colCount === 0) return '';
  
  let html = `<div class="sheet-print" data-sheet-index="${sheetIndex}">`;
  html += `<h4 class="sheet-title">${name || `表格${sheetIndex + 1}`}</h4>`;
  html += '<table class="print-table" border="1" cellspacing="0" cellpadding="8">';
  
  // 生成所有行
  for (let r = 0; r < rowCount; r++) {
    html += '<tr>';
    for (let c = 0; c < colCount; c++) {
      const cell = data[r] ? data[r][c] : null;
      const value = cell ? getCellValue(cell) : '';
      html += `<td>${value}</td>`;
    }
    html += '</tr>';
  }
  html += '</table></div>';
  return html;
}

// 获取单元格值
function getCellValue(cell) {
  if (!cell) return '';
  
  if (cell.v !== null && cell.v !== undefined) {
    if (typeof cell.v === 'object' && cell.v !== null) {
      return cell.v.m !== undefined ? cell.v.m : 
             cell.v.v !== undefined ? cell.v.v : 
             cell.v !== null ? cell.v : '';
    }
    return cell.v;
  }
  
  if (cell.m !== null && cell.m !== undefined) {
    return cell.m;
  }
  
  return '';
}

// 生成简化的表格信息（用于预览）
export function generateTablePreview(sheetData) {
  if (!sheetData || !Array.isArray(sheetData) || sheetData.length === 0) {
    return '';
  }
  
  let html = '<div class="table-section"><h3>表格数据</h3>';
  
  sheetData.forEach((sheet, sheetIndex) => {
    const rowCount = sheet.data ? sheet.data.length : 0;
    const colCount = sheet.data && sheet.data[0] ? sheet.data[0].length : 0;
    
    html += `<div class="sheet-info">`;
    html += `<h4>${sheet.name || `表格${sheetIndex + 1}`}</h4>`;
    html += `<p>尺寸: ${rowCount} 行 × ${colCount} 列</p>`;
    html += '</div>';
  });
  
  html += '</div>';
  return html;
}