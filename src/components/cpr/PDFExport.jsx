import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FileText, Download, Printer } from 'lucide-react';

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
    body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
    h1 { color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 10px; }
    h2 { color: #374151; margin-top: 30px; }
    .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 20px 0; }
    .summary-box { background: #f3f4f6; padding: 15px; border-radius: 8px; }
    .summary-box label { font-size: 12px; color: #6b7280; text-transform: uppercase; }
    .summary-box value { font-size: 24px; font-weight: bold; display: block; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; }
    .event-type { padding: 2px 8px; border-radius: 4px; font-size: 12px; }
    .shock { background: #fef3c7; color: #92400e; }
    .adrenaline { background: #fee2e2; color: #991b1b; }
    .rhythm { background: #dbeafe; color: #1e40af; }
    .cycle { background: #fef3c7; color: #92400e; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <h1>🏥 CPR Session Report</h1>
  
  <div class="summary-grid">
    <div class="summary-box">
      <label>Session Start</label>
      <value>${sessionData.startTime || 'N/A'}</value>
    </div>
    <div class="summary-box">
      <label>Total Duration</label>
      <value>${formatTime(sessionData.totalSeconds || 0)}</value>
    </div>
    <div class="summary-box">
      <label>Total Cycles</label>
      <value>${sessionData.totalCycles || 0}</value>
    </div>
    <div class="summary-box">
      <label>Final Rhythm</label>
      <value>${sessionData.currentRhythm || 'N/A'}</value>
    </div>
  </div>

  <h2>📊 Summary Statistics</h2>
  <table>
    <tr><th>Metric</th><th>Value</th></tr>
    <tr><td>Total Shocks Delivered</td><td>${sessionData.shockCount || 0}</td></tr>
    <tr><td>Adrenaline Doses</td><td>${sessionData.adrenalineCount || 0} mg total</td></tr>
    <tr><td>Amiodarone Doses</td><td>${sessionData.amiodaroneTotal || 0} mg total</td></tr>
    <tr><td>Compressor Changes</td><td>${sessionData.compressorChanges || 0}</td></tr>
    <tr><td>Pulse Checks</td><td>${sessionData.pulseChecks || 0}</td></tr>
  </table>

  <h2>📋 Complete Event Log</h2>
  <table>
    <tr><th>Time</th><th>Event</th><th>Details</th></tr>
    ${events.map(e => `
      <tr>
        <td>${e.cprTime}</td>
        <td><span class="event-type ${e.type}">${e.type.toUpperCase()}</span></td>
        <td>${e.message}</td>
      </tr>
    `).join('')}
  </table>

  <h2>💉 Medication Administration</h2>
  <table>
    <tr><th>Time</th><th>Medication</th><th>Dose</th><th>Cycle</th></tr>
    ${events.filter(e => e.type === 'adrenaline' || e.type === 'amiodarone').map(e => `
      <tr>
        <td>${e.cprTime}</td>
        <td>${e.type === 'adrenaline' ? 'Adrenaline' : 'Amiodarone'}</td>
        <td>${e.dose || '1'} mg</td>
        <td>${e.cycle || 'N/A'}</td>
      </tr>
    `).join('') || '<tr><td colspan="4">No medications administered</td></tr>'}
  </table>

  <h2>⚡ Defibrillation Record</h2>
  <table>
    <tr><th>Time</th><th>Shock #</th><th>Energy</th><th>Rhythm Before</th></tr>
    ${events.filter(e => e.type === 'shock').map((e, i) => `
      <tr>
        <td>${e.cprTime}</td>
        <td>${i + 1}</td>
        <td>${e.energy || 'N/A'}J</td>
        <td>${e.rhythmBefore || 'N/A'}</td>
      </tr>
    `).join('') || '<tr><td colspan="4">No shocks delivered</td></tr>'}
  </table>

  <p style="margin-top: 40px; color: #6b7280; font-size: 12px;">
    Generated: ${new Date().toLocaleString()} | CPR Tracker - ACLS Compliant
  </p>
</body>
</html>
    `;
    return report;
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(generateReport());
    printWindow.document.close();
    printWindow.print();
  };

  const handleDownload = () => {
    const blob = new Blob([generateReport()], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CPR_Report_${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800">
          <FileText className="w-4 h-4 mr-2" />
          Export Report
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle>Export CPR Session Report</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-slate-400 text-sm">
            Export a complete report of this CPR session including all events, medications, and defibrillations.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">
              <Printer className="w-4 h-4 mr-2" />
              Print Report
            </Button>
            <Button onClick={handleDownload} className="bg-green-600 hover:bg-green-700">
              <Download className="w-4 h-4 mr-2" />
              Download HTML
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}