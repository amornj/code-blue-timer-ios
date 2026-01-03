import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Search, Download, Eye, Edit, FileText, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import JSZip from 'jszip';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function Records() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecords, setSelectedRecords] = useState([]);
  const [viewingRecord, setViewingRecord] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editForm, setEditForm] = useState({ patient_name: '', hospital_number: '', hospital_name: '', post_cpr_notes: '' });
  const [reportDialog, setReportDialog] = useState(null);
  const [deletingRecord, setDeletingRecord] = useState(null);

  const { data: sessions, refetch } = useQuery({
    queryKey: ['cpr-sessions'],
    queryFn: () => base44.entities.CPRSession.list('-created_date'),
    initialData: [],
    enabled: isAuthenticated
  });

  useEffect(() => {
    const checkAuth = async () => {
      const authenticated = await base44.auth.isAuthenticated();
      setIsAuthenticated(authenticated);
      setLoading(false);
      if (!authenticated) {
        base44.auth.redirectToLogin(window.location.href);
      }
    };
    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const filteredSessions = sessions.filter(session => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (session.patient_name || '').toLowerCase().includes(searchLower) ||
      (session.hospital_number || '').toLowerCase().includes(searchLower) ||
      (session.hospital_name || '').toLowerCase().includes(searchLower)
    );
  });

  const toggleSelect = (id) => {
    setSelectedRecords(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedRecords.length === filteredSessions.length) {
      setSelectedRecords([]);
    } else {
      setSelectedRecords(filteredSessions.map(s => s.id));
    }
  };

  const handleEdit = (session) => {
    setEditingRecord(session);
    setEditForm({
      patient_name: session.patient_name || '',
      hospital_number: session.hospital_number || '',
      hospital_name: session.hospital_name || '',
      post_cpr_notes: session.post_cpr_notes || ''
    });
  };

  const handleSaveEdit = async () => {
    await base44.entities.CPRSession.update(editingRecord.id, editForm);
    setEditingRecord(null);
    refetch();
  };

  const handleDelete = async () => {
    await base44.entities.CPRSession.delete(deletingRecord.id);
    setDeletingRecord(null);
    refetch();
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getOutcomeColor = (outcome) => {
    switch (outcome) {
      case 'ROSC_following':
      case 'ROSC_not_following':
      case 'ROSC': 
        return 'bg-green-100 text-green-800 border-green-300';
      case 'death':
      case 'deceased': 
        return 'bg-red-100 text-red-800 border-red-300';
      case 'VA_ECMO': 
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'transfer_ICU':
      case 'transferred':
      case 'ongoing':
      default: 
        return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  };

  const formatOutcome = (outcome) => {
    switch (outcome) {
      case 'ROSC_following': return 'ROSC, and following command';
      case 'ROSC_not_following': return 'ROSC, not following command';
      case 'death': return 'Death';
      case 'VA_ECMO': return 'Transit to VA ECMO';
      case 'transfer_ICU': return 'Transfer to ICU or other hospital';
      // Legacy support
      case 'ROSC': return 'ROSC';
      case 'deceased': return 'Deceased';
      case 'ongoing': return 'Ongoing';
      case 'transferred': return 'Transferred';
      default: return outcome;
    }
  };

  const exportToCSV = (records) => {
    const headers = [
      'Date', 'Patient Name', 'HN', 'Hospital', 'Duration', 'Cycles', 
      'Outcome', 'Shocks', 'Adrenaline Doses', 'Amiodarone (mg)', 'Notes'
    ];
    
    const rows = records.map(r => [
      format(new Date(r.start_time), 'yyyy-MM-dd HH:mm'),
      r.patient_name || 'N/A',
      r.hospital_number || 'N/A',
      r.hospital_name || 'N/A',
      formatDuration(r.total_duration_seconds || 0),
      r.total_cycles || 0,
      formatOutcome(r.outcome),
      r.shocks_delivered?.length || 0,
      r.adrenaline_doses?.length || 0,
      r.adrenaline_doses?.reduce((sum, d) => sum + (d.dose_mg || 0), 0) || 0,
      (r.notes || '').replace(/\n/g, ' ')
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csv;
  };

  const exportToJSON = (records) => {
    return JSON.stringify(records, null, 2);
  };

  const handleExport = async () => {
    const recordsToExport = selectedRecords.length > 0
      ? sessions.filter(s => selectedRecords.includes(s.id))
      : sessions;

    const csv = exportToCSV(recordsToExport);
    const json = exportToJSON(recordsToExport);

    // Create ZIP file
    const zip = new JSZip();
    const dateStr = new Date().toISOString().slice(0, 10);
    
    zip.file(`CPR_Sessions_${dateStr}.csv`, csv);
    zip.file(`CPR_Sessions_${dateStr}.json`, json);

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const zipUrl = URL.createObjectURL(zipBlob);
    const zipLink = document.createElement('a');
    zipLink.href = zipUrl;
    zipLink.download = `CPR_Sessions_${dateStr}.zip`;
    zipLink.click();
    URL.revokeObjectURL(zipUrl);
  };

  const formatDurationForPDF = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const exportSingleRecordPDF = (record) => {
    const formatOutcome = (outcome) => {
      switch (outcome) {
        case 'ROSC_following': return 'ROSC, and following command';
        case 'ROSC_not_following': return 'ROSC, not following command';
        case 'death': return 'Death';
        case 'VA_ECMO': return 'Transit to VA ECMO';
        case 'transfer_ICU': return 'Transfer to ICU or other hospital';
        case 'ROSC': return 'ROSC';
        case 'deceased': return 'Deceased';
        case 'ongoing': return 'Ongoing';
        case 'transferred': return 'Transferred';
        default: return outcome || 'N/A';
      }
    };

    const doc = new jsPDF();
    let yPos = 20;

    // Title
    doc.setFontSize(18);
    doc.setTextColor(30, 64, 175);
    doc.text('CPR Session Report', 15, yPos);
    yPos += 12;

    // Patient Info
    if (record.patient_name || record.hospital_number || record.hospital_name) {
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      if (record.patient_name) {
        doc.text(`Patient: ${record.patient_name}`, 15, yPos);
        yPos += 5;
      }
      if (record.hospital_number) {
        doc.text(`HN: ${record.hospital_number}`, 15, yPos);
        yPos += 5;
      }
      if (record.hospital_name) {
        doc.text(`Hospital: ${record.hospital_name}`, 15, yPos);
        yPos += 5;
      }
      yPos += 3;
    }

    // Summary
    doc.setFontSize(10);
    doc.text(`Start: ${format(new Date(record.start_time), 'MMM d, yyyy HH:mm')}`, 15, yPos);
    doc.text(`Duration: ${formatDurationForPDF(record.total_duration_seconds || 0)}`, 70, yPos);
    doc.text(`Cycles: ${record.total_cycles || 0}`, 125, yPos);
    yPos += 6;
    doc.text(`Outcome: ${formatOutcome(record.outcome)}`, 15, yPos);
    yPos += 10;

    doc.setFontSize(9);
    doc.text(`Shocks: ${record.shocks_delivered?.length || 0} | Adrenaline: ${record.adrenaline_doses?.length || 0} | Amiodarone: ${record.amiodarone_doses?.reduce((sum, d) => sum + (d.dose_mg || 0), 0) || 0}mg | Lidocaine: ${record.lidocaine_doses?.reduce((sum, d) => sum + (d.dose_mg_per_kg || 0), 0) || 0}mg/kg | Compressor Changes: ${record.compressor_changes?.length || 0}`, 15, yPos);
    yPos += 10;

    // Build comprehensive event log from all data
    const allEvents = [];
    
    // Rhythm changes
    (record.rhythm_history || []).forEach(r => {
      allEvents.push({
        time: r.timestamp,
        description: `Rhythm Check: ${r.rhythm}`,
        cycle: r.cycle
      });
    });
    
    // Shocks
    (record.shocks_delivered || []).forEach(s => {
      allEvents.push({
        time: s.timestamp,
        description: `Shock Delivered @ ${s.energy_joules}J (Rhythm: ${s.rhythm_before})`,
        cycle: s.cycle
      });
    });
    
    // Compressor changes (including LUCAS)
    (record.compressor_changes || []).forEach(c => {
      allEvents.push({
        time: c.timestamp,
        description: 'Compressor Changed',
        cycle: c.cycle
      });
    });
    
    // Pulse checks
    (record.pulse_checks || []).forEach(p => {
      allEvents.push({
        time: p.timestamp,
        description: 'Pulse Check Performed',
        cycle: p.cycle
      });
    });
    
    // Adrenaline
    (record.adrenaline_doses || []).forEach(a => {
      allEvents.push({
        time: a.timestamp,
        description: `Adrenaline ${a.dose_mg}mg IV`,
        cycle: a.cycle
      });
    });
    
    // Amiodarone
    (record.amiodarone_doses || []).forEach(a => {
      allEvents.push({
        time: a.timestamp,
        description: `Amiodarone ${a.dose_mg}mg IV`,
        cycle: a.cycle
      });
    });
    
    // Lidocaine
    (record.lidocaine_doses || []).forEach(l => {
      allEvents.push({
        time: l.timestamp,
        description: `Xylocaine ${l.dose_mg_per_kg} mg/kg IV`,
        cycle: l.cycle
      });
    });
    
    // Discretionary medications
    (record.discretionary_medications || []).forEach(m => {
      allEvents.push({
        time: m.timestamp,
        description: m.medication || m.dosage,
        cycle: m.cycle
      });
    });
    
    // End event
    if (record.end_time) {
      allEvents.push({
        time: format(new Date(record.end_time), 'HH:mm'),
        description: `CPR Session Ended (Outcome: ${formatOutcome(record.outcome)})`,
        cycle: '-'
      });
    }
    
    // Sort by time
    allEvents.sort((a, b) => {
      const timeA = a.time.split(':').map(Number);
      const timeB = b.time.split(':').map(Number);
      return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
    });

    // Single Event Log Table (filter out start event)
    const filteredEvents = allEvents.filter(e => e.description !== 'CPR Session Started');
    
    if (filteredEvents.length > 0) {
      doc.setFontSize(11);
      doc.text('Event Log', 15, yPos);
      yPos += 5;
      
      doc.autoTable({
        startY: yPos,
        head: [['Time', 'Event', 'Cycle']],
        body: filteredEvents.map(e => [e.time, e.description, e.cycle || '-']),
        theme: 'striped',
        styles: { fontSize: 8 },
        margin: { left: 15 },
        headStyles: { fillColor: [30, 64, 175] }
      });
      yPos = doc.lastAutoTable.finalY + 8;
    }

    // Notes section - wrap text properly within A4 margins
    if (record.doctor_notes) {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(11);
      doc.text('Note1 (During CPR)', 15, yPos);
      yPos += 6;
      doc.setFontSize(9);
      const splitNotes = doc.splitTextToSize(record.doctor_notes, 170);
      doc.text(splitNotes, 15, yPos);
      yPos += splitNotes.length * 5 + 6;
    }

    if (record.notes) {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(11);
      doc.text('Note2 (End Session)', 15, yPos);
      yPos += 6;
      doc.setFontSize(9);
      const splitNote2 = doc.splitTextToSize(record.notes, 170);
      doc.text(splitNote2, 15, yPos);
      yPos += splitNote2.length * 5 + 6;
    }

    if (record.post_cpr_notes) {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(11);
      doc.text('Note3 (Post CPR)', 15, yPos);
      yPos += 6;
      doc.setFontSize(9);
      const splitNote3 = doc.splitTextToSize(record.post_cpr_notes, 170);
      doc.text(splitNote3, 15, yPos);
    }

    // Footer on all pages
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(107, 114, 128);
      doc.text(`Generated: ${new Date().toLocaleString()} | CPR Tracker - ACLS Compliant | Page ${i} of ${pageCount}`, 105, 285, { align: 'center' });
    }

    // Download
    const fileName = `CPR_Record_${record.patient_name || 'Session'}_${format(new Date(record.start_time), 'yyyy-MM-dd')}.pdf`;
    doc.save(fileName);
    setReportDialog(null);
  };

  const oldExportSingleRecordPDF_HTML = (record) => {
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
  
  ${record.patient_name || record.hospital_number ? `
  <div style="margin-bottom: 8px; padding: 6px; background: #f9fafb; border-radius: 4px;">
    ${record.patient_name ? `<strong>Patient:</strong> ${record.patient_name} | ` : ''}
    ${record.hospital_number ? `<strong>HN:</strong> ${record.hospital_number} | ` : ''}
    ${record.hospital_name ? `<strong>Hospital:</strong> ${record.hospital_name}` : ''}
  </div>
  ` : ''}
  
  <div class="summary-grid">
    <div class="summary-box">
      <label>Start Time</label>
      <value>${format(new Date(record.start_time), 'MMM d, yyyy HH:mm')}</value>
    </div>
    <div class="summary-box">
      <label>Duration</label>
      <value>${formatDuration(record.total_duration_seconds || 0)}</value>
    </div>
    <div class="summary-box">
      <label>Cycles</label>
      <value>${record.total_cycles || 0}</value>
    </div>
    <div class="summary-box">
      <label>Outcome</label>
      <value>${formatOutcome(record.outcome)}</value>
    </div>
  </div>

  <h2>📊 Summary</h2>
  <table class="compact-table">
    <tr>
      <td><strong>Shocks:</strong> ${record.shocks_delivered?.length || 0}</td>
      <td><strong>Adrenaline:</strong> ${record.adrenaline_doses?.length || 0} doses</td>
      <td><strong>Amiodarone:</strong> ${record.amiodarone_doses?.reduce((sum, d) => sum + (d.dose_mg || 0), 0) || 0} mg</td>
      <td><strong>Compressor Changes:</strong> ${record.compressor_changes?.length || 0}</td>
    </tr>
  </table>

  <h2>💉 Medications</h2>
  <table class="compact-table">
    <tr><th>Cycle</th><th>Medication</th><th>Dose</th><th>Time</th></tr>
    ${[...(record.adrenaline_doses || []).map(d => ({ ...d, med: 'Adrenaline' })), 
       ...(record.amiodarone_doses || []).map(d => ({ ...d, med: 'Amiodarone' }))]
      .sort((a, b) => a.cycle - b.cycle)
      .map(d => `
        <tr>
          <td>${d.cycle}</td>
          <td>${d.med}</td>
          <td>${d.dose_mg} mg</td>
          <td>${d.timestamp}</td>
        </tr>
      `).join('') || '<tr><td colspan="4">None</td></tr>'}
  </table>

  <h2>⚡ Defibrillation</h2>
  <table class="compact-table">
    <tr><th>Shock #</th><th>Energy</th><th>Rhythm</th><th>Cycle</th></tr>
    ${(record.shocks_delivered || []).map(s => `
      <tr>
        <td>${s.shock_number}</td>
        <td>${s.energy_joules}J</td>
        <td>${s.rhythm_before || 'N/A'}</td>
        <td>${s.cycle}</td>
      </tr>
    `).join('') || '<tr><td colspan="4">None</td></tr>'}
  </table>

  <h2>🫀 Rhythm Changes</h2>
  <table class="compact-table">
    <tr><th>Cycle</th><th>Rhythm</th><th>Time</th></tr>
    ${(record.rhythm_history || []).map(r => `
      <tr>
        <td>${r.cycle}</td>
        <td>${r.rhythm}</td>
        <td>${r.timestamp}</td>
      </tr>
    `).join('') || '<tr><td colspan="3">None recorded</td></tr>'}
  </table>

  ${record.doctor_notes ? `
  <h2>📝 CPR Note</h2>
  <div style="padding: 8px; background: #f9fafb; border-radius: 4px; font-size: 9px; border: 1px solid #e5e7eb;">
    ${record.doctor_notes}
  </div>
  ` : ''}

  ${record.notes ? `
  <h2>📝 Post CPR Note</h2>
  <div style="padding: 8px; background: #f9fafb; border-radius: 4px; font-size: 9px; border: 1px solid #e5e7eb;">
    ${record.notes}
  </div>
  ` : ''}

  <p style="margin-top: 10px; color: #6b7280; font-size: 8px; text-align: center;">
    Generated: ${new Date().toLocaleString()} | CPR Tracker - ACLS Compliant
  </p>
  </body>
  </html>
  `;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">CPR Session Records</h1>
          <p className="text-slate-600">View and manage all recorded CPR sessions</p>
        </div>

        {/* Search and Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search by patient name, HN, or hospital..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              onClick={handleExport}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Download className="w-4 h-4 mr-2" />
              {selectedRecords.length > 0 ? `Export Selected (${selectedRecords.length})` : 'Export All'}
            </Button>
          </div>
        </div>

        {/* Records Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <Checkbox
                      checked={selectedRecords.length === filteredSessions.length && filteredSessions.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Date & Time</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Patient</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">HN</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Hospital</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Duration</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Outcome</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                      No CPR sessions found
                    </td>
                  </tr>
                ) : (
                  filteredSessions.map((session) => (
                    <tr key={session.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={selectedRecords.includes(session.id)}
                          onCheckedChange={() => toggleSelect(session.id)}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {format(new Date(session.start_time), 'MMM d, yyyy HH:mm')}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {session.patient_name ? (
                          <span className="font-medium text-slate-900">{session.patient_name}</span>
                        ) : (
                          <span className="text-slate-400 italic">Not specified</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {session.hospital_number || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {session.hospital_name || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-700">
                        {formatDuration(session.total_duration_seconds || 0)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${getOutcomeColor(session.outcome)}`}>
                          {formatOutcome(session.outcome)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setReportDialog(session)}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(session)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeletingRecord(session)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* View Record Dialog */}
      <Dialog open={!!viewingRecord} onOpenChange={() => setViewingRecord(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>CPR Session Details</span>
              <Button
                size="sm"
                onClick={() => exportSingleRecordPDF(viewingRecord)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <FileText className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
            </DialogTitle>
          </DialogHeader>
          {viewingRecord && (
            <div className="space-y-6 py-4">
              {/* Patient Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-500">Patient Name</label>
                  <p className="font-medium">{viewingRecord.patient_name || 'Not specified'}</p>
                </div>
                <div>
                  <label className="text-sm text-slate-500">Hospital Number</label>
                  <p className="font-medium">{viewingRecord.hospital_number || 'Not specified'}</p>
                </div>
                <div>
                  <label className="text-sm text-slate-500">Hospital Name</label>
                  <p className="font-medium">{viewingRecord.hospital_name || 'Not specified'}</p>
                </div>
                <div>
                  <label className="text-sm text-slate-500">Outcome</label>
                  <p className="font-medium">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs border ${getOutcomeColor(viewingRecord.outcome)}`}>
                      {formatOutcome(viewingRecord.outcome)}
                    </span>
                  </p>
                </div>
              </div>

              {/* Session Summary */}
              <div className="grid grid-cols-4 gap-4 bg-slate-50 rounded-lg p-4">
                <div>
                  <label className="text-xs text-slate-500">Duration</label>
                  <p className="text-2xl font-bold text-slate-900">{formatDuration(viewingRecord.total_duration_seconds || 0)}</p>
                </div>
                <div>
                  <label className="text-xs text-slate-500">Cycles</label>
                  <p className="text-2xl font-bold text-slate-900">{viewingRecord.total_cycles || 0}</p>
                </div>
                <div>
                  <label className="text-xs text-slate-500">Shocks</label>
                  <p className="text-2xl font-bold text-slate-900">{viewingRecord.shocks_delivered?.length || 0}</p>
                </div>
                <div>
                  <label className="text-xs text-slate-500">Adrenaline</label>
                  <p className="text-2xl font-bold text-slate-900">{viewingRecord.adrenaline_doses?.length || 0}</p>
                </div>
              </div>

              {/* Medications */}
              {(viewingRecord.adrenaline_doses?.length > 0 || viewingRecord.amiodarone_doses?.length > 0) && (
                <div>
                  <h3 className="font-semibold mb-2">Medications</h3>
                  <div className="space-y-2">
                    {viewingRecord.adrenaline_doses?.map((dose, i) => (
                      <div key={i} className="flex justify-between text-sm bg-red-50 rounded p-2">
                        <span>Adrenaline {dose.dose_mg}mg</span>
                        <span className="text-slate-500">Cycle {dose.cycle}</span>
                      </div>
                    ))}
                    {viewingRecord.amiodarone_doses?.map((dose, i) => (
                      <div key={i} className="flex justify-between text-sm bg-purple-50 rounded p-2">
                        <span>Amiodarone {dose.dose_mg}mg</span>
                        <span className="text-slate-500">Cycle {dose.cycle}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Shocks */}
              {viewingRecord.shocks_delivered?.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Defibrillation</h3>
                  <div className="space-y-2">
                    {viewingRecord.shocks_delivered.map((shock, i) => (
                      <div key={i} className="flex justify-between text-sm bg-yellow-50 rounded p-2">
                        <span>Shock #{shock.shock_number} @ {shock.energy_joules}J</span>
                        <span className="text-slate-500">Cycle {shock.cycle} ({shock.rhythm_before})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {viewingRecord.notes && (
                <div>
                  <h3 className="font-semibold mb-2">Notes</h3>
                  <p className="text-sm text-slate-700 bg-slate-50 rounded p-3">{viewingRecord.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Report Dialog */}
      <Dialog open={!!reportDialog} onOpenChange={() => setReportDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>CPR Session Report</DialogTitle>
          </DialogHeader>
          {reportDialog && (
            <div className="space-y-4 py-4">
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Patient:</span>
                  <span className="font-medium">{reportDialog.patient_name || 'Not specified'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Hospital Number:</span>
                  <span className="font-medium">{reportDialog.hospital_number || 'Not specified'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Duration:</span>
                  <span className="font-medium">{formatDuration(reportDialog.total_duration_seconds || 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Outcome:</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getOutcomeColor(reportDialog.outcome)}`}>
                    {formatOutcome(reportDialog.outcome)}
                  </span>
                </div>
              </div>
              
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setReportDialog(null)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => exportSingleRecordPDF(reportDialog)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Export PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Record Dialog */}
      <Dialog open={!!editingRecord} onOpenChange={() => setEditingRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Patient Information</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Patient Name</Label>
              <Input
                value={editForm.patient_name}
                onChange={(e) => setEditForm({ ...editForm, patient_name: e.target.value })}
                placeholder="Enter patient name"
              />
            </div>
            <div>
              <Label>Hospital Number (HN)</Label>
              <Input
                value={editForm.hospital_number}
                onChange={(e) => setEditForm({ ...editForm, hospital_number: e.target.value })}
                placeholder="Enter hospital number"
              />
            </div>
            <div>
              <Label>Hospital Name</Label>
              <Input
                value={editForm.hospital_name}
                onChange={(e) => setEditForm({ ...editForm, hospital_name: e.target.value })}
                placeholder="Enter hospital name"
              />
            </div>
            <div>
              <Label>Post CPR Notes (max 200 characters)</Label>
              <Textarea
                value={editForm.post_cpr_notes}
                onChange={(e) => setEditForm({ ...editForm, post_cpr_notes: e.target.value.slice(0, 200) })}
                placeholder="Add additional post-CPR notes..."
                maxLength={200}
                className="resize-none"
                rows={3}
              />
              <div className="text-xs text-slate-500 mt-1 text-right">
                {editForm.post_cpr_notes.length}/200 characters
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setEditingRecord(null)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingRecord} onOpenChange={() => setDeletingRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-slate-600">
              Are you sure you want to delete this CPR session record? This action cannot be undone.
            </p>
            {deletingRecord && (
              <div className="bg-slate-50 rounded-lg p-3 text-sm">
                <div><strong>Date:</strong> {format(new Date(deletingRecord.start_time), 'MMM d, yyyy HH:mm')}</div>
                <div><strong>Patient:</strong> {deletingRecord.patient_name || 'Not specified'}</div>
                <div><strong>Duration:</strong> {formatDuration(deletingRecord.total_duration_seconds || 0)}</div>
              </div>
            )}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setDeletingRecord(null)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDelete}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}