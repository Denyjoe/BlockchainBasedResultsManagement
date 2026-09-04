import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle,
} from "docx";
import mammoth from "mammoth";

// ---------------------------------------------------------------------------
// FIELD MARKERS — must match exactly between generateReportCard and
// parseUploadedResult so extraction is always consistent.
// ---------------------------------------------------------------------------
const FIELD = {
  NAME:  "Student Name:",
  REG:   "Registration Number:",
  YEAR:  "Academic Year:",
  DEPT:  "Department:",
};

/**
 * Generates a professional student report card .docx and triggers a browser download.
 *
 * @param {string} regNumber    - Unique registration number.
 * @param {string} name         - Student full name.
 * @param {string} academicYear - Academic year / semester.
 * @param {string} department   - Department or program.
 * @param {Array<{subject:string,marks:number}>} subjects - Grade rows (sorted before call).
 * @param {string} resultHash   - Keccak256 hash stored on-chain.
 * @param {string} txHash       - Ethereum transaction hash.
 * @returns {Promise<void>} Resolves when the file download is triggered.
 */
export async function generateReportCard(
  regNumber, name, academicYear, department, subjects, resultHash, txHash
) {
  // Sort subjects alphabetically for display — must match hash ordering
  const sorted = [...subjects].sort((a, b) =>
    a.subject.trim().toUpperCase().localeCompare(b.subject.trim().toUpperCase())
  );

  const cellBorders = {
    top:    { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
    left:   { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
    right:  { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
  };

  const headerRow = new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ text: "SUBJECT", bold: true, alignment: AlignmentType.CENTER })],
        shading: { fill: "4F46E5" },
        borders: cellBorders,
      }),
      new TableCell({
        children: [new Paragraph({ text: "MARKS", bold: true, alignment: AlignmentType.CENTER })],
        shading: { fill: "4F46E5" },
        borders: cellBorders,
      }),
    ],
  });

  const dataRows = sorted.map(s =>
    new TableRow({
      children: [
        new TableCell({
          // Store SUBJECT exactly as uppercase — parser reads this back
          children: [new Paragraph({ text: s.subject.trim().toUpperCase() })],
          borders: cellBorders,
        }),
        new TableCell({
          // Store marks as plain integer string — parser reads this back with parseInt
          children: [new Paragraph({ text: String(Number(s.marks)), alignment: AlignmentType.CENTER })],
          borders: cellBorders,
        }),
      ],
    })
  );

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({ text: "CERTIFYCHAIN TECHNICAL UNIVERSITY", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
        new Paragraph({ text: "OFFICIAL ACADEMIC REPORT CARD",    heading: HeadingLevel.HEADING_3, alignment: AlignmentType.CENTER }),
        new Paragraph({ text: "" }),

        // Each field on its own paragraph — critical for reliable parsing
        new Paragraph({ children: [new TextRun({ text: FIELD.NAME,  bold: true }), new TextRun({ text: name.trim().toUpperCase() })] }),
        new Paragraph({ children: [new TextRun({ text: FIELD.REG,   bold: true }), new TextRun({ text: regNumber.trim().toUpperCase(), color: "4F46E5", bold: true })] }),
        new Paragraph({ children: [new TextRun({ text: FIELD.YEAR,  bold: true }), new TextRun({ text: academicYear.trim().toUpperCase() })] }),
        new Paragraph({ children: [new TextRun({ text: FIELD.DEPT,  bold: true }), new TextRun({ text: department.trim().toUpperCase() })] }),
        new Paragraph({ text: "" }),

        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...dataRows] }),
        new Paragraph({ text: "" }),
        new Paragraph({ text: "" }),

        new Paragraph({ children: [new TextRun({ text: "VERIFICATION METADATA (DO NOT EDIT)", bold: true, color: "EF4444" })] }),
        new Paragraph({ children: [new TextRun({ text: "Result Hash: ", bold: true }), new TextRun({ text: resultHash })] }),
        new Paragraph({ children: [new TextRun({ text: "Transaction ID: ", bold: true }), new TextRun({ text: txHash })] }),
        new Paragraph({
          text: "Notice: Altering any content in this document will invalidate the cryptographic result hash stored on the Ethereum blockchain.",
          italics: true,
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url  = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = `ReportCard_${regNumber.trim().toUpperCase()}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Extracts structured student data from an uploaded CertifyChain .docx report card.
 *
 * The key design decision: instead of running greedy regexes over the entire
 * concatenated textContent (which causes fields to bleed into each other),
 * we iterate over each HTML paragraph produced by Mammoth individually.
 * Each paragraph holds exactly one field, so extraction is reliable.
 *
 * @param {ArrayBuffer} arrayBuffer - Raw file bytes.
 * @returns {Promise<{
 *   regNumber: string,
 *   name: string,
 *   academicYear: string,
 *   department: string,
 *   subjects: Array<{subject:string, marks:number}>
 * }>}
 */
export async function parseUploadedResult(arrayBuffer) {
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const html   = result.value;

  const domParser = new DOMParser();
  const doc       = domParser.parseFromString(html, "text/html");

  // -------------------------------------------------------------------------
  // Step 1: Walk each <p> paragraph and extract fields by their known prefix.
  // This avoids the greedy-regex bleed problem entirely.
  // -------------------------------------------------------------------------
  let name         = null;
  let regNumber    = null;
  let academicYear = null;
  let department   = null;

  const paragraphs = Array.from(doc.querySelectorAll("p"));

  for (const p of paragraphs) {
    const raw  = p.textContent;              // e.g. "Student Name: JOHN DOE"
    const text = raw.replace(/\s+/g, " ").trim(); // collapse all whitespace

    if (text.startsWith(FIELD.NAME) && name === null) {
      name = text.slice(FIELD.NAME.length).trim().toUpperCase();
    } else if (text.startsWith(FIELD.REG) && regNumber === null) {
      regNumber = text.slice(FIELD.REG.length).trim().toUpperCase();
    } else if (text.startsWith(FIELD.YEAR) && academicYear === null) {
      academicYear = text.slice(FIELD.YEAR.length).trim().toUpperCase();
    } else if (text.startsWith(FIELD.DEPT) && department === null) {
      department = text.slice(FIELD.DEPT.length).trim().toUpperCase();
    }
  }

  // Dev diagnostic — log extracted header fields to console for debugging
  console.debug("[CertifyChain Parser] Extracted fields:", { name, regNumber, academicYear, department });

  if (!name)         throw new Error("Could not detect 'Student Name:' in document.");
  if (!regNumber)    throw new Error("Could not detect 'Registration Number:' in document.");
  if (!academicYear) throw new Error("Could not detect 'Academic Year:' in document.");
  if (!department)   throw new Error("Could not detect 'Department:' in document.");

  // -------------------------------------------------------------------------
  // Step 2: Extract grade rows from the <table>.
  // Skip the header row (row 0 = SUBJECT / MARKS) and any metadata rows.
  // -------------------------------------------------------------------------
  const SKIP_KEYWORDS = ["HASH", "TRANSACTION", "VERIFICATION", "NOTICE", "METADATA", "RESULT", "SUBJECT"];
  const subjects = [];
  const rows     = Array.from(doc.querySelectorAll("tr"));

  for (let i = 1; i < rows.length; i++) {
    const cells      = Array.from(rows[i].querySelectorAll("td"));
    if (cells.length < 2) continue;

    const subjectRaw = cells[0].textContent.replace(/\s+/g, " ").trim().toUpperCase();
    const marksRaw   = cells[1].textContent.replace(/\s+/g, " ").trim();
    const marks      = parseInt(marksRaw, 10);

    const isMetaRow = SKIP_KEYWORDS.some(kw => subjectRaw.includes(kw));
    if (!subjectRaw || isNaN(marks) || isMetaRow) continue;

    subjects.push({ subject: subjectRaw, marks });
  }

  console.debug("[CertifyChain Parser] Extracted subjects:", subjects);

  if (subjects.length === 0) {
    throw new Error("Could not extract any grade rows from document table.");
  }

  return { regNumber, name, academicYear, department, subjects };
}
