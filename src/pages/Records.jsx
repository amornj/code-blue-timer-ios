import React, { useState } from 'react';
import { FileText } from 'lucide-react';

export default function Records() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
        <FileText className="w-16 h-16 mx-auto mb-4 text-slate-400" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Records</h2>
        <p className="text-slate-600">Records page is not available.</p>
      </div>
    </div>
  );
}
