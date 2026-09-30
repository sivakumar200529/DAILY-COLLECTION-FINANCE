import { MonthlyReportData } from '../types';

/**
 * Escapes XML special characters for SpreadsheetML
 */
function escapeXml(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Download a data blob as a file in the browser
 */
function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generates and downloads a rich Excel file for the Monthly Daily Collection Report
 * containing Customer details, Finance details, Day 1..31 columns, and Monthly Totals.
 */
export function exportMonthlyReportToExcel(reportData: MonthlyReportData) {
  const { monthName, year, daysInMonth, rows, totals } = reportData;
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Generate XML Spreadsheet (SpreadsheetML) compatible with Microsoft Excel, Apple Numbers, LibreOffice
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="TitleStyle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="16" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#0B132B" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="SubtitleStyle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Italic="1" ss:Color="#F59E0B"/>
   <Interior ss:Color="#0F172A" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="HeaderStyle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1E293B"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1E293B"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1E293B"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1E293B"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#1E3A8A" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="DayHeaderStyle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1E293B"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1E293B"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1E293B"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1E293B"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="9" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#B45309" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="DataText">
   <Alignment ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="10"/>
  </Style>
  <Style ss:ID="DataNumber">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="10"/>
   <NumberFormat ss:Format="#,##0"/>
  </Style>
  <Style ss:ID="DataDaily">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="9"/>
   <NumberFormat ss:Format="#,##0"/>
  </Style>
  <Style ss:ID="TotalRowStyle">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#0F172A"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#0F172A"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#0F172A" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="#,##0"/>
  </Style>
  <Style ss:ID="TotalRowLabel">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#0F172A"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#0F172A"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Bold="1" ss:Color="#F59E0B"/>
   <Interior ss:Color="#0F172A" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${escapeXml(monthName)}_${year}">
  <Table>
   <!-- Column Width Definitions -->
   <Column ss:Width="80"/>  <!-- Cust ID -->
   <Column ss:Width="140"/> <!-- Name -->
   <Column ss:Width="100"/> <!-- Mobile -->
   <Column ss:Width="150"/> <!-- Shop -->
   <Column ss:Width="120"/> <!-- Area -->
   <Column ss:Width="100"/> <!-- Collector -->
   <Column ss:Width="90"/>  <!-- Account ID -->
   <Column ss:Width="90"/>  <!-- Requested -->
   <Column ss:Width="65"/>  <!-- Margin % -->
   <Column ss:Width="85"/>  <!-- Margin Amount -->
   <Column ss:Width="90"/>  <!-- Disbursed -->
   <Column ss:Width="70"/>  <!-- Daily Due -->
   <Column ss:Width="60"/>  <!-- Total Days -->
   <Column ss:Width="85"/>  <!-- Month Sched Days -->
   <Column ss:Width="90"/>  <!-- Repayment -->
   <Column ss:Width="90"/>  <!-- Total Collected -->
   <Column ss:Width="90"/>  <!-- Remaining -->
   <Column ss:Width="70"/>  <!-- Status -->
`;

  // Daily columns width
  for (let i = 0; i < daysInMonth; i++) {
    xml += `   <Column ss:Width="50"/>\n`;
  }

  // Final summary columns
  xml += `   <Column ss:Width="90"/>  <!-- Monthly Total -->
   <Column ss:Width="90"/>  <!-- Expected Monthly -->
   <Column ss:Width="90"/>  <!-- Monthly Pending -->
   <Column ss:Width="70"/>  <!-- % -->
`;

  const totalCols = 18 + daysInMonth + 4;

  // Title Row
  xml += `   <Row ss:Height="30">
    <Cell ss:MergeAcross="${totalCols - 1}" ss:StyleID="TitleStyle">
     <Data ss:Type="String">DAILY COLLECTION</Data>
    </Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:MergeAcross="${totalCols - 1}" ss:StyleID="SubtitleStyle">
     <Data ss:Type="String">Monthly Daily Collection Register &amp; Ledger: ${escapeXml(monthName)} ${year}</Data>
    </Cell>
   </Row>
   <Row ss:Height="10"></Row>
`;

  // Header Row
  xml += `   <Row ss:Height="26">
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Customer ID</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Customer Name</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Mobile</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Shop Name</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Area</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Collector</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Account ID</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Requested (₹)</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Margin %</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Margin (₹)</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Disbursed (₹)</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Daily (₹)</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Total Days</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Month Sched Days</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Repayment (₹)</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Total Paid (₹)</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Balance (₹)</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Status</Data></Cell>
`;

  // Day columns headers
  for (const d of daysArray) {
    const formattedDay = `${String(d).padStart(2, '0')}-${monthName.slice(0, 3)}`;
    xml += `    <Cell ss:StyleID="DayHeaderStyle"><Data ss:Type="String">${escapeXml(formattedDay)}</Data></Cell>\n`;
  }

  // Summary headers
  xml += `    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Monthly Total (₹)</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Expected Monthly (₹)</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Monthly Pending (₹)</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Col %</Data></Cell>
   </Row>
`;

  // Data Rows
  rows.forEach(r => {
    xml += `   <Row ss:Height="20">
    <Cell ss:StyleID="DataText"><Data ss:Type="String">${escapeXml(r.customerId)}</Data></Cell>
    <Cell ss:StyleID="DataText"><Data ss:Type="String">${escapeXml(r.customerName)}</Data></Cell>
    <Cell ss:StyleID="DataText"><Data ss:Type="String">${escapeXml(r.mobile)}</Data></Cell>
    <Cell ss:StyleID="DataText"><Data ss:Type="String">${escapeXml(r.shopName)}</Data></Cell>
    <Cell ss:StyleID="DataText"><Data ss:Type="String">${escapeXml(r.area)}</Data></Cell>
    <Cell ss:StyleID="DataText"><Data ss:Type="String">${escapeXml(r.collector)}</Data></Cell>
    <Cell ss:StyleID="DataText"><Data ss:Type="String">${escapeXml(r.collectionAccountId)}</Data></Cell>
    <Cell ss:StyleID="DataNumber"><Data ss:Type="Number">${r.requestedAmount}</Data></Cell>
    <Cell ss:StyleID="DataNumber"><Data ss:Type="Number">${r.marginPercentage ?? 12}</Data></Cell>
    <Cell ss:StyleID="DataNumber"><Data ss:Type="Number">${r.marginAmount ?? r.financeMargin}</Data></Cell>
    <Cell ss:StyleID="DataNumber"><Data ss:Type="Number">${r.disbursedAmount}</Data></Cell>
    <Cell ss:StyleID="DataNumber"><Data ss:Type="Number">${r.dailyCollection}</Data></Cell>
    <Cell ss:StyleID="DataNumber"><Data ss:Type="Number">${r.collectionDays}</Data></Cell>
    <Cell ss:StyleID="DataNumber"><Data ss:Type="Number">${r.scheduledDaysInMonth ?? daysInMonth}</Data></Cell>
    <Cell ss:StyleID="DataNumber"><Data ss:Type="Number">${r.totalRepayment}</Data></Cell>
    <Cell ss:StyleID="DataNumber"><Data ss:Type="Number">${r.amountCollected}</Data></Cell>
    <Cell ss:StyleID="DataNumber"><Data ss:Type="Number">${r.remainingAmount}</Data></Cell>
    <Cell ss:StyleID="DataText"><Data ss:Type="String">${escapeXml(r.status)}</Data></Cell>
`;

    // Daily collection columns
    for (const d of daysArray) {
      const dayPaid = r.dailyCollections[d] || 0;
      xml += `    <Cell ss:StyleID="DataDaily"><Data ss:Type="Number">${dayPaid}</Data></Cell>\n`;
    }

    // Monthly totals
    xml += `    <Cell ss:StyleID="DataNumber"><Data ss:Type="Number">${r.monthlyTotal}</Data></Cell>
    <Cell ss:StyleID="DataNumber"><Data ss:Type="Number">${r.expectedMonthlyCollection}</Data></Cell>
    <Cell ss:StyleID="DataNumber"><Data ss:Type="Number">${r.monthlyPending}</Data></Cell>
    <Cell ss:StyleID="DataText"><Data ss:Type="String">${r.collectionPercentage}%</Data></Cell>
   </Row>
`;
  });

  // Totals Row
  xml += `   <Row ss:Height="24">
    <Cell ss:MergeAcross="6" ss:StyleID="TotalRowLabel"><Data ss:Type="String">GRAND TOTALS</Data></Cell>
    <Cell ss:StyleID="TotalRowStyle"><Data ss:Type="Number">${totals.requested}</Data></Cell>
    <Cell ss:StyleID="TotalRowStyle"><Data ss:Type="String">-</Data></Cell>
    <Cell ss:StyleID="TotalRowStyle"><Data ss:Type="Number">${totals.financeMargin}</Data></Cell>
    <Cell ss:StyleID="TotalRowStyle"><Data ss:Type="Number">${totals.disbursed}</Data></Cell>
    <Cell ss:StyleID="TotalRowStyle"><Data ss:Type="String">-</Data></Cell>
    <Cell ss:StyleID="TotalRowStyle"><Data ss:Type="String">-</Data></Cell>
    <Cell ss:StyleID="TotalRowStyle"><Data ss:Type="String">-</Data></Cell>
    <Cell ss:StyleID="TotalRowStyle"><Data ss:Type="Number">${totals.totalRepayment}</Data></Cell>
    <Cell ss:StyleID="TotalRowStyle"><Data ss:Type="Number">${totals.actualMonthly}</Data></Cell>
    <Cell ss:StyleID="TotalRowStyle"><Data ss:Type="Number">${totals.totalRepayment - totals.actualMonthly}</Data></Cell>
    <Cell ss:StyleID="TotalRowStyle"><Data ss:Type="String">-</Data></Cell>
`;

  // Daily totals
  for (const d of daysArray) {
    const dayTotal = totals.dailyTotals[d] || 0;
    xml += `    <Cell ss:StyleID="TotalRowStyle"><Data ss:Type="Number">${dayTotal}</Data></Cell>\n`;
  }

  // Final summary totals
  xml += `    <Cell ss:StyleID="TotalRowStyle"><Data ss:Type="Number">${totals.monthlyTotal}</Data></Cell>
    <Cell ss:StyleID="TotalRowStyle"><Data ss:Type="Number">${totals.expectedMonthly}</Data></Cell>
    <Cell ss:StyleID="TotalRowStyle"><Data ss:Type="Number">${totals.monthlyPending}</Data></Cell>
    <Cell ss:StyleID="TotalRowStyle"><Data ss:Type="String">${totals.collectionPercentage}%</Data></Cell>
   </Row>
  </Table>
 </Worksheet>
</Workbook>`;

  const filename = `Daily_Collection_Monthly_Register_${monthName}_${year}.xls`;
  downloadBlob(xml, filename, 'application/vnd.ms-excel');
}

/**
 * Generic tabular Excel / CSV exporter for any table
 */
export function exportTableToExcel(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string
) {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#0F172A" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center"/>
  </Style>
  <Style ss:ID="Cell">
   <Font ss:Color="#000000"/>
  </Style>
  <Style ss:ID="Title">
   <Font ss:Bold="1" ss:Size="14" ss:Color="#0F172A"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Report">
  <Table>
   <Row><Cell ss:StyleID="Title"><Data ss:Type="String">${escapeXml(title)}</Data></Cell></Row>
   <Row></Row>
   <Row>`;

  headers.forEach(h => {
    xml += `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`;
  });
  xml += `</Row>`;

  rows.forEach(r => {
    xml += `<Row>`;
    r.forEach(val => {
      const isNum = typeof val === 'number';
      xml += `<Cell ss:StyleID="Cell"><Data ss:Type="${isNum ? 'Number' : 'String'}">${escapeXml(val)}</Data></Cell>`;
    });
    xml += `</Row>`;
  });

  xml += `</Table></Worksheet></Workbook>`;

  downloadBlob(xml, `${filename}.xls`, 'application/vnd.ms-excel');
}
