import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Search, Download, Eye, Edit, FileJson, FileSpreadsheet, Package } from 'lucide-react';
import { format } from 'date-fns';

export default function Records() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecords, setSelectedRecords] = useState([]);
  const [viewingRecord, setViewingRecord] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editForm, setEditForm] = useState({ patient_name: '', hospital_number: '', hospital_name: '' });

  const { data: sessions, refetch } = useQuery({
    queryKey: ['cpr-sessions'],
    queryFn: () => base44.entities.CPRSession.list('-created_date'),
    initialData: []
  });

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
      hospital_name: session.hospital_name || ''
    });
  };

  const handleSaveEdit = async () => {
    await base44.entities.CPRSession.update(editingRecord.id, editForm);
    setEditingRecord(null);
    refetch();
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getOutcomeColor = (outcome) => {
    switch (outcome) {
      case 'ROSC': return 'bg-green-100 text-green-800 border-green-300';
      case 'deceased': return 'bg-red-100 text-red-800 border-red-300';
      case 'VA_ECMO': return 'bg-purple-100 text-purple-800 border-purple-300';
      default: return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  };

  const formatOutcome = (outcome) => {
    switch (outcome) {
      case 'ROSC': return 'ROSC';
      case 'deceased': return 'Deceased';
      case 'VA_ECMO': return 'VA ECMO';
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

    // Create CSV blob
    const csvBlob = new Blob([csv], { type: 'text/csv' });
    const csvUrl = URL.createObjectURL(csvBlob);
    const csvLink = document.createElement('a');
    csvLink.href = csvUrl;
    csvLink.download = `CPR_Sessions_${new Date().toISOString().slice(0, 10)}.csv`;
    csvLink.click();
    URL.revokeObjectURL(csvUrl);

    // Create JSON blob
    const jsonBlob = new Blob([json], { type: 'application/json' });
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const jsonLink = document.createElement('a');
    jsonLink.href = jsonUrl;
    jsonLink.download = `CPR_Sessions_${new Date().toISOString().slice(0, 10)}.json`;
    jsonLink.click();
    URL.revokeObjectURL(jsonUrl);
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
                            onClick={() => setViewingRecord(session)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(session)}
                            className="text-slate-600 hover:text-slate-700 hover:bg-slate-50"
                          >
                            <Edit className="w-4 h-4" />
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
            <DialogTitle>CPR Session Details</DialogTitle>
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
    </div>
  );
}