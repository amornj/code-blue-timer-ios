import React from 'react';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';

export default function PDFExport({ sessionData, events }) {
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const generateReport = () => {
    const report = `
<!DOCTYPE html>
<html>
<head>
  <title>CPR Session Report</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body { font-family: Arial, sans-serif; font-size: 10px; margin: 0; padding: 0; }
    h1 { color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 5px; font-size: 18px; margin: 0 0 10px 0; }
    h2 { color: #374151; font-size: 12px; margin: 10px 0 5px 0; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 8px 0; }
    .summary-box { background: #f3f4f6; padding: 8px; border-radius: 4px; }
    .summary-box label { font-size: 9px; color: #6b7280; text-transform: uppercase; display: block; }
    .summary-box value { font-size: 14px; font-weight: bold; display: block; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 9px; }
    th, td { padding: 4px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; }
    .compact-table { font-size: 8px; }
    .compact-table th, .compact-table td { padding: 2px 4px; }
    @media print { 
      body { padding: 0; }
      h1 { page-break-after: avoid; }
      h2 { page-break-after: avoid; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
    }
  </style>
</head>
<body>
  <h1>🏥 CPR Session Report</h1>
  
  ${sessionData.patient_name || sessionData.hospital_number ? `
  <div style="margin-bottom: 8px; padding: 6px; background: #f9fafb; border-radius: 4px;">
    ${sessionData.patient_name ? `<strong>Patient:</strong> ${sessionData.patient_name} | ` : ''}
    ${sessionData.hospital_number ? `<strong>HN:</strong> ${sessionData.hospital_number} | ` : ''}
    ${sessionData.hospital_name ? `<strong>Hospital:</strong> ${sessionData.hospital_name}` : ''}
  </div>
  ` : ''}
  
  <div class="summary-grid">
    <div class="summary-box">
      <label>Start Time</label>
      <value>${sessionData.startTime || 'N/A'}</value>
    </div>
    <div class="summary-box">
      <label>Duration</label>
      <value>${formatTime(sessionData.totalSeconds || 0)}</value>
    </div>
    <div class="summary-box">
      <label>Cycles</label>
      <value>${sessionData.totalCycles || 0}</value>
    </div>
    <div class="summary-box">
      <label>Outcome</label>
      <value>${formatOutcome(sessionData.outcome)}</value>
    </div>
  </div>

  <h2>📊 Summary</h2>
  <table class="compact-table">
    <tr>
      <td><strong>Shocks:</strong> ${sessionData.shockCount || 0}</td>
      <td><strong>Adrenaline:</strong> ${sessionData.adrenalineCount || 0} doses</td>
      <td><strong>Amiodarone:</strong> ${sessionData.amiodaroneTotal || 0} mg</td>
      <td><strong>Compressor Changes:</strong> ${sessionData.compressorChanges || 0}</td>
    </tr>
  </table>

  <h2>💉 Medications</h2>
  <table class="compact-table">
    <tr><th>Time</th><th>Medication</th><th>Dose</th><th>Cycle</th></tr>
    ${events.filter(e => e.type === 'adrenaline' || e.type === 'amiodarone').map(e => `
      <tr>
        <td>${e.cprTime}</td>
        <td>${e.type === 'adrenaline' ? 'Adrenaline' : 'Amiodarone'}</td>
        <td>${e.dose || '1'} mg</td>
        <td>${e.cycle || 'N/A'}</td>
      </tr>
    `).join('') || '<tr><td colspan="4">None</td></tr>'}
  </table>

  <h2>⚡ Defibrillation</h2>
  <table class="compact-table">
    <tr><th>Time</th><th>Shock #</th><th>Energy</th><th>Rhythm</th></tr>
    ${events.filter(e => e.type === 'shock').map((e, i) => `
      <tr>
        <td>${e.cprTime}</td>
        <td>${i + 1}</td>
        <td>${e.energy || 'N/A'}J</td>
        <td>${e.rhythmBefore || 'N/A'}</td>
      </tr>
    `).join('') || '<tr><td colspan="4">None</td></tr>'}
  </table>

  <h2>📋 Event Log</h2>
  <table class="compact-table">
    <tr><th>Time</th><th>Event</th><th>Details</th></tr>
    ${events.slice(0, 15).map(e => `
      <tr>
        <td>${e.cprTime}</td>
        <td>${e.type.toUpperCase()}</td>
        <td>${e.message}</td>
      </tr>
    `).join('')}
  </table>

  ${sessionData.notes ? `
  <h2>📝 Notes</h2>
  <div style="padding: 6px; background: #f9fafb; border-radius: 4px; font-size: 9px;">
    ${sessionData.notes}
  </div>
  ` : ''}

  <p style="margin-top: 10px; color: #6b7280; font-size: 8px; text-align: center;">
    Generated: ${new Date().toLocaleString()} | CPR Tracker - ACLS Compliant
  </p>
</body>
</html>
    `;
    return report;
  };

  const formatOutcome = (outcome) => {
    switch (outcome) {
      case 'ROSC': return 'ROSC';
      case 'deceased': return 'Deceased';
      case 'VA_ECMO': return 'VA ECMO';
      case 'ongoing': return 'Ongoing';
      case 'transferred': return 'Transferred';
      default: return outcome || 'N/A';
    }
  };

  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(generateReport());
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <Button 
      onClick={handleExportPDF}
      variant="outline" 
      className="border-slate-600 text-slate-300 hover:bg-slate-800"
    >
      <FileText className="w-4 h-4 mr-2" />
      Export PDF
    </Button>
  );
}