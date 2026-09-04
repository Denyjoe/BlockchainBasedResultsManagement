import React, { useState, useEffect } from "react";
import { useWallet } from "../context/WalletContext";
import { computeResultHash } from "../utils/hashUtils";
import { generateReportCard } from "../utils/documentUtils";
import { 
  Plus, Trash2, CheckCircle, ShieldAlert, Award, 
  RefreshCw, AlertTriangle, FileText, Download, ListPlus
} from "lucide-react";

/**
 * LecturerDashboard component allowing whitelisted lecturers to issue report cards,
 * register hashes on-chain, download compiled .docx report cards, and manage records.
 * @returns {React.ReactElement} The lecturer dashboard component.
 */
export default function LecturerDashboard() {
  const { contract, account, isCorrectNetwork } = useWallet();

  // Expanded student info states
  const [studentName, setStudentName] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [department, setDepartment] = useState("");
  const [subjectRows, setSubjectRows] = useState([{ subject: "", marks: "" }]);
  
  const [issuedRecords, setIssuedRecords] = useState([]);
  const [txStatus, setTxStatus] = useState({ status: "idle", hash: null, error: null });

  // Load records on mount
  useEffect(() => {
    loadCachedRecords();
  }, [account]);

  /**
   * Loads results issued in the system from localStorage cache.
   */
  const loadCachedRecords = () => {
    try {
      const cached = localStorage.getItem("student_results_cache");
      if (cached) {
        const parsed = JSON.parse(cached);
        // Show all results in local database cache for easier demo testing
        setIssuedRecords(parsed);
      } else {
        setIssuedRecords([]);
      }
    } catch (err) {
      console.error("Failed to load cached results:", err);
    }
  };

  /**
   * Appends an empty row to the subject input list.
   */
  const addSubjectRow = () => {
    setSubjectRows(prev => [...prev, { subject: "", marks: "" }]);
  };

  /**
   * Removes a specific subject row by index.
   * @param {number} idx - Index of the row to remove.
   */
  const removeSubjectRow = (idx) => {
    if (subjectRows.length === 1) return;
    setSubjectRows(prev => prev.filter((_, i) => i !== idx));
  };

  /**
   * Updates fields on a subject row.
   * @param {number} idx - Index of the row.
   * @param {string} field - Field name (subject or marks).
   * @param {string} val - Changed value.
   */
  const handleRowChange = (idx, field, val) => {
    setSubjectRows(prev => {
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        [field]: val
      };
      return copy;
    });
  };

  /**
   * Generates and downloads the .docx report card for a cached record.
   * @param {Object} rec - The record details.
   */
  const handleDownloadDocx = async (rec) => {
    try {
      // Recompute hash (should match what was stored)
      const resHash = computeResultHash(
        rec.studentId, 
        rec.name || "Student Name",
        rec.academicYear || "2026/2027",
        rec.department || "Computer Science",
        rec.subjects
      );
      await generateReportCard(
        rec.studentId, 
        rec.name || "Student Name",
        rec.academicYear || "2026/2027",
        rec.department || "Computer Science",
        rec.subjects, 
        resHash, 
        rec.txHash
      );
    } catch (err) {
      console.error("Failed to regenerate document:", err);
      alert("Error regenerating report card file.");
    }
  };

  /**
   * Handles submitting the grade record to MetaMask and Ganache.
   * @param {Event} e - Submit event.
   */
  const handleIssueResult = async (e) => {
    e.preventDefault();
    if (!contract || !isCorrectNetwork) return;

    // Filter out incomplete rows
    const activeRows = subjectRows.filter(
      r => r.subject.trim() && r.marks.toString().trim() !== ""
    );

    if (activeRows.length === 0) {
      alert("Please provide at least one subject and score.");
      return;
    }

    setTxStatus({ status: "pending", hash: null, error: null });
    const cleanReg = regNumber.trim().toUpperCase();
    const cleanName = studentName.trim().toUpperCase();
    const cleanYear = academicYear.trim().toUpperCase();
    const cleanDept = department.trim().toUpperCase();

    // Map rows to correct formats
    const formattedSubjects = activeRows.map(r => ({
      subject: r.subject.trim().toUpperCase(),
      marks: Number(r.marks)
    }));

    try {
      // 1. Compute canonical Keccak256 hash in JS including expanded details
      const resultHash = computeResultHash(
        cleanReg, 
        cleanName, 
        cleanYear, 
        cleanDept, 
        formattedSubjects
      );

      // 2. Call uploadResult on-chain with safety gas limit
      const tx = await contract.uploadResult(cleanReg, resultHash, {
        gasLimit: 300000
      });
      setTxStatus({ status: "pending", hash: tx.hash, error: null });

      // 3. Wait for confirmation
      await tx.wait();
      setTxStatus({ status: "confirmed", hash: tx.hash, error: null });

      // Signal the ActivityPanel to immediately refresh its block/event log
      window.dispatchEvent(new Event("certifychain:newblock"));

      // 4. Save details in localStorage off-chain database cache
      const cached = localStorage.getItem("student_results_cache");
      const currentCache = cached ? JSON.parse(cached) : [];

      const resultId = `${cleanReg}-${Date.now()}`;
      const record = {
        resultId,
        studentId: cleanReg, // regNumber
        name: cleanName,
        academicYear: cleanYear,
        department: cleanDept,
        courseCode: "REPORT CARD",
        score: 0,
        grade: "ISSUED",
        subjects: formattedSubjects,
        uploadedBy: account,
        timestamp: Date.now(),
        txHash: tx.hash,
      };

      // Filter out duplicates
      const updatedCache = currentCache.filter(r => r.studentId !== cleanReg);
      updatedCache.push(record);
      localStorage.setItem("student_results_cache", JSON.stringify(updatedCache));

      // 5. Generate and download report card document
      await generateReportCard(
        cleanReg, 
        cleanName, 
        cleanYear, 
        cleanDept, 
        formattedSubjects, 
        resultHash, 
        tx.hash
      );

      // Reset form
      setStudentName("");
      setRegNumber("");
      setAcademicYear("");
      setDepartment("");
      setSubjectRows([{ subject: "", marks: "" }]);
      loadCachedRecords();
    } catch (err) {
      console.error(err);
      const errMsg = err.reason || err.message || "Transaction failed";
      setTxStatus({ status: "failed", hash: null, error: errMsg });
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Lecturer Portal
        </h1>
        <p className="text-slate-400 mt-1">
          Issue student report cards, record hashes on the Ethereum ledger, and download verified Word credentials.
        </p>
      </div>

      {/* Grid Layout: Form is wider (lg:col-span-2), List is narrower (lg:col-span-1) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Issuance Form */}
        <div className="lg:col-span-2">
          <div className="glass-card p-6 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center">
              <Award className="w-5 h-5 text-indigo-400 mr-2" />
              Issue Student Report Card
            </h2>

            <form onSubmit={handleIssueResult} className="space-y-6">
              {/* Row 1: Student Name & Reg Number */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                    Student Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                    Student Registration Number
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. REG-2026-0001"
                    value={regNumber}
                    onChange={(e) => setRegNumber(e.target.value)}
                    className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Row 2: Academic Year & Department */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                    Academic Year / Semester
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 2026/2027 Semester 1"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                    Department / Course of Study
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Computer Science"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Subject Repeatable Grid */}
              <div className="space-y-3 pt-2 border-t border-white/5">
                <div className="flex justify-between items-center">
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Academic Subjects & Scores
                  </label>
                  <button
                    type="button"
                    onClick={addSubjectRow}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 bg-indigo-500/5 px-2.5 py-1 rounded-lg border border-indigo-500/10 hover:border-indigo-500/20"
                  >
                    <ListPlus className="w-3.5 h-3.5" />
                    Add Subject Row
                  </button>
                </div>

                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {subjectRows.map((row, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="text"
                        required
                        placeholder="e.g. Mathematics"
                        value={row.subject}
                        onChange={(e) => handleRowChange(idx, "subject", e.target.value)}
                        className="flex-1 bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 uppercase"
                      />
                      <input
                        type="number"
                        min="0"
                        max="100"
                        required
                        placeholder="85"
                        value={row.marks}
                        onChange={(e) => handleRowChange(idx, "marks", e.target.value)}
                        className="w-20 bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white text-center focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        disabled={subjectRows.length === 1}
                        onClick={() => removeSubjectRow(idx)}
                        className="text-slate-500 hover:text-rose-400 disabled:opacity-30 transition p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={txStatus.status === "pending"}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl text-xs transition shadow-lg shadow-indigo-600/10 disabled:opacity-50 flex items-center justify-center gap-1.5 active:scale-95"
              >
                {txStatus.status === "pending" ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Signing Transaction...
                  </>
                ) : (
                  <>
                    <Award className="w-4 h-4" />
                    Issue & Download Report Card
                  </>
                )}
              </button>
            </form>

            {/* Status Message */}
            {txStatus.status !== "idle" && (
              <div className="mt-4 p-4 rounded-xl text-[11px] glass border border-white/5 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-400">Transaction Status:</span>
                  <span className={`font-bold capitalize ${
                    txStatus.status === "confirmed" ? "text-emerald-400" :
                    txStatus.status === "failed" ? "text-rose-400" : "text-amber-400 animate-pulse"
                  }`}>
                    {txStatus.status}
                  </span>
                </div>
                {txStatus.hash && (
                  <div className="overflow-hidden text-ellipsis whitespace-nowrap">
                    <span className="font-semibold text-slate-400">Hash: </span>
                    <span className="font-mono text-indigo-400">{txStatus.hash}</span>
                  </div>
                )}
                {txStatus.error && (
                  <div className="text-rose-400 border-t border-white/5 pt-2 mt-2 leading-relaxed font-mono text-[10px] break-all">
                    {txStatus.error}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Issued Records List - lg:col-span-1 */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center">
            <FileText className="w-5 h-5 text-indigo-400 mr-2" />
            Issued Report Cards
          </h2>

          {issuedRecords.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-white font-semibold">No report cards issued</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Any results you submit will appear here. You can download the report card document again anytime.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {issuedRecords.map((rec) => (
                <div key={rec.studentId} className="glass-card p-4 border-l-4 border-l-indigo-500 glow-indigo/5 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-white text-sm truncate max-w-[120px]">
                        {rec.name || "Student Name"}
                      </span>
                      <span className="text-[10px] text-indigo-400 font-mono font-bold">
                        {rec.studentId}
                      </span>
                    </div>
                    <span className="block text-[9px] text-slate-400 mt-0.5">
                      Issued: {new Date(rec.timestamp).toLocaleDateString()}
                    </span>
                    <span className="block text-[10px] text-slate-300 mt-1 font-medium truncate uppercase">
                      {rec.department || "Computer Science"}
                    </span>
                  </div>

                  <button
                    onClick={() => handleDownloadDocx(rec)}
                    title="Download Report Card .docx"
                    className="w-full bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/20 py-2 rounded-xl text-indigo-400 hover:text-indigo-300 transition flex items-center justify-center gap-1.5 text-xs font-bold"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Docx
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
