// Sarabun Thai Font for jsPDF
// This is a minimal font data module - in production, you'd embed the full base64 font data

export const addThaiFont = (doc) => {
  // For now, we'll use the default font with better Thai character support
  // by setting the font to use UTF-8 encoding
  doc.setFont('helvetica', 'normal');
  doc.setLanguage('th-TH');
  
  // Note: For full Thai support, you would need to:
  // 1. Download Sarabun-Regular.ttf
  // 2. Convert it to base64 using: https://rawgit.com/MrRio/jsPDF/master/fontconverter/fontconverter.html
  // 3. Add the base64 data here with doc.addFileToVFS() and doc.addFont()
  
  return doc;
};

// Placeholder for future full Thai font implementation
// Once you have the base64 font data, replace the above function with:
/*
export const addThaiFont = (doc) => {
  const sarabunBase64 = 'YOUR_BASE64_FONT_DATA_HERE';
  
  doc.addFileToVFS('Sarabun-Regular.ttf', sarabunBase64);
  doc.addFont('Sarabun-Regular.ttf', 'Sarabun', 'normal');
  doc.setFont('Sarabun');
  
  return doc;
};
*/