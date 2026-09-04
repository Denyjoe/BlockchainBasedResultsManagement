import React, { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { computeResultHash } from "../utils/hashUtils";
import { generateReportCard, parseUploadedResult } from "../utils/documentUtils";
import { 
  Search, CheckCircle, ShieldAlert, RefreshCw, Download, 
  BookOpen, GraduationCap, Award, Info, FileText, Check, ShieldCheck, Upload, KeyRound
} from "lucide-react";

/**
 * StudentDashboard component allowing students to search for their grade record,
 * verify its on-chain integrity, download the official .docx report card,
 * and import report cards from files if the local cache is empty.
 * @returns {React.ReactElement} The student dashboard component.
 */
export default function StudentDashboard() {
  const { contract, isCorrectNetwork } = useWallet();

  const [regNumber, setRegNumber] = useState("");
  const [record, setRecord] = useState(null);
  const [searchExecuted, setSearchExecuted] = useState(false);
  const [verificationState, setVerificationState] = useState(null); // 'checking', 'verified', 'failed', 'error'
  
  // On-chain lookup state when local cache is empty
  const [onChainRecord, setOnChainRecord] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);

  /**
   * Searches the localStorage cache to find the student's result record.
   * If not found, queries the smart contract to check if the hash is registered.
   */
  const handleSearch = async () => {
    const cleanReg = regNumber.trim().toUpperCase();
    if (!cleanReg) return;

    setRecord(null);
    setOnChainRecord(null);
    setSearchExecuted(true);
    setVerificationState(null);
    setImportError(null);

    // 1. Look in local storage cache first
    try {
      const cached = localStorage.getItem("student_results_cache");
      if (cached) {
        const parsed = JSON.parse(cached);
        const found = parsed.find(
          (r) => r.studentId.toUpperCase() === cleanReg
        );
        if (found) {
          setRecord(found);
          return;
        }
      }
    } catch (err) {
      console.error("Local search error:", err);
    }

    // 2. If not found in cache, check the blockchain contract
    if (contract && isCorrectNetwork) {
      try {
        const lookupKey = await contract.getLookupKey(cleanReg);
        const result = await contract.results(lookupKey);

        // Check if the hash is non-zero (meaning a record exists)
        if (result && result.resultHash !== ethers.ZeroHash) {
          setOnChainRecord({
            regNumber: result.regNumber,
            resultHash: result.resultHash,
            issuedBy: result.issuedBy,
            timestamp: new Date(Number(result.timestamp) * 1000).toLocaleString()
          });
        }
      } catch (err) {
        console.error("On-chain search error:", err);
      }
    }
  };

  /**
   * Checks the integrity of the official result record against the on-chain registry.
   */
  const handleVerify = async () => {
    if (!record || !contract || !isCorrectNetwork) {
      alert("Please connect to MetaMask on the Ganache network (Port 7545) to run verification.");
      return;
    }

    setVerificationState("checking");

    try {
      const computedHash = computeResultHash(
        record.studentId, 
        record.name, 
        record.academicYear, 
        record.department, 
        record.subjects
      );

      const isValid = await contract.verifyIntegrity(record.studentId, computedHash);
      setVerificationState(isValid ? "verified" : "failed");
    } catch (err) {
      console.error("Verification failed:", err);
      setVerificationState("error");
    }
  };

  /**
   * Triggers the generation and browser download of the official report card document.
   */
  const handleDownload = async () => {
    if (!record) return;
    try {
      const resHash = computeResultHash(
        record.studentId, 
        record.name, 
        record.academicYear, 
        record.department, 
        record.subjects
      );
      await generateReportCard(
        record.studentId, 
        record.name, 
        record.academicYear, 
        record.department, 
        record.subjects, 
        resHash, 
        record.txHash
      );
    } catch (err) {
      console.error("Download failed:", err);
      alert("Failed to compile and download report card file.");
    }
  };

  /**
   * Parses an uploaded .docx report card file, verifies it on-chain,
   * and saves it to the local cache if valid.
   * @param {Event} e - File input change event.
   */
  const handleImportFile = async (e) => {
    const file = e.target.files[0];
    if (!file || !contract) return;

    setImporting(true);
    setImportError(null);

    try {
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          const buffer = event.target.result;
          
          // Parse report card
          const parsed = await parseUploadedResult(buffer);

          // Verify hash
          const computedHash = computeResultHash(
            parsed.regNumber,
            parsed.name,
            parsed.academicYear,
            parsed.department,
            parsed.subjects
          );

          const isValid = await contract.verifyIntegrity(parsed.regNumber, computedHash);

          if (!isValid) {
            throw new Error("This document hash does not match the blockchain registry. Verification failed.");
          }

          // Save to localStorage cache
          const cached = localStorage.getItem("student_results_cache");
          const currentCache = cached ? JSON.parse(cached) : [];

          const resultId = `${parsed.regNumber}-${Date.now()}`;
          const newRecord = {
            resultId,
            studentId: parsed.regNumber,
            name: parsed.name,
            academicYear: parsed.academicYear,
            department: parsed.department,
            courseCode: "REPORT CARD",
            score: 0,
            grade: "ISSUED",
            subjects: parsed.subjects,
            uploadedBy: onChainRecord?.issuedBy || account,
            timestamp: Date.now(),
            txHash: "Imported Document"
          };

          const updatedCache = currentCache.filter(r => r.studentId !== parsed.regNumber);
          updatedCache.push(newRecord);
          localStorage.setItem("student_results_cache", JSON.stringify(updatedCache));

          // Set record state to display immediately
          setRecord(newRecord);
          setOnChainRecord(null);
          setVerificationState("verified");
        } catch (err) {
          console.error("Import failed:", err);
          setImportError(err.message || "Failed to parse or verify the document.");
        } finally {
          setImporting(false);
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error(err);
      setImportError("Error reading file.");
      setImporting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Student Portal
        </h1>
        <p className="text-slate-400 mt-1">
          Search for your academic records, verify their on-chain verification key, and download your authentic report card.
        </p>
      </div>

      {/* Query Bar */}
      <div className="glass-card p-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={regNumber}
            onChange={(e) => setRegNumber(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Enter Registration Number (e.g. REG-2026-0001)"
            className="w-full bg-slate-900/60 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-indigo-500 text-sm"
          />
        </div>
        <button
          onClick={handleSearch}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-8 py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10 active:scale-95 text-sm"
        >
          <Search className="w-4 h-4" />
          Search Records
        </button>
      </div>

      {/* Result Card area */}
      {searchExecuted && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-white flex items-center">
              <BookOpen className="w-5 h-5 text-indigo-400 mr-2" />
              Query Results for "{regNumber.trim().toUpperCase()}"
            </h2>
            {record && (
              <div className="flex gap-2">
                <button
                  onClick={handleVerify}
                  className="bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-300 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${verificationState === "checking" ? "animate-spin" : ""}`} />
                  Verify On-Chain
                </button>
                
                <button
                  onClick={handleDownload}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-indigo-600/15"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Docx
                </button>
              </div>
            )}
          </div>

          {/* Scenario A: No record in cache, but registered on-chain */}
          {onChainRecord && !record && (
            <div className="glass-card p-8 border-l-4 border-l-amber-500 space-y-6 animate-fade-in">
              <div className="flex items-start gap-4">
                <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl text-amber-400 shrink-0">
                  <KeyRound className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-amber-400 font-extrabold text-base">On-Chain Record Registered</h3>
                  <p className="text-slate-300 text-xs mt-1 leading-relaxed">
                    A report card hash is registered on the Ethereum blockchain for student <strong>{onChainRecord.regNumber}</strong>. 
                    However, the detailed grade data is not cached in this browser's database.
                  </p>
                </div>
              </div>

              {/* On-chain Details */}
              <div className="bg-slate-900/60 p-4 rounded-xl border border-white/5 text-xs text-slate-400 space-y-1.5 font-mono">
                <div>Issued By: {onChainRecord.issuedBy}</div>
                <div>Registered Hash: {onChainRecord.resultHash}</div>
                <div>Timestamp: {onChainRecord.timestamp}</div>
              </div>

              {/* Document Import Form */}
              <div className="border-t border-white/5 pt-4 space-y-3">
                <span className="block text-xs font-semibold text-slate-200">
                  Import Report Card Document to View Details
                </span>
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <input
                    type="file"
                    accept=".docx"
                    id="import-docx-input"
                    onChange={handleImportFile}
                    className="hidden"
                  />
                  <label 
                    htmlFor="import-docx-input"
                    className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/15"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {importing ? "Importing..." : "Upload Report Card (.docx)"}
                  </label>
                  <span className="text-[10px] text-slate-400">
                    Select the report card file to verify and restore the preview.
                  </span>
                </div>

                {importError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
                    {importError}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Scenario B: Not found anywhere */}
          {!record && !onChainRecord && (
            <div className="glass-card p-12 text-center animate-fade-in">
              <GraduationCap className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-white font-semibold">No record found</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                No matching academic report card hash has been registered on the blockchain. If you are demoing, please issue a record under the Lecturer Portal first.
              </p>
            </div>
          )}

          {/* Scenario C: Record found in cache (or imported) */}
          {record && (
            <div className="grid grid-cols-1 gap-6 animate-fade-in">
              {/* Document Paper Preview */}
              <div className="relative bg-white text-slate-800 p-8 md:p-12 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-w-3xl mx-auto w-full font-serif select-none">
                
                {/* Visual stamps/seals */}
                {verificationState === "verified" && (
                  <div className="absolute top-20 right-10 md:right-20 border-4 border-emerald-500/40 text-emerald-500/60 font-mono font-black text-xs md:text-sm tracking-widest uppercase px-4 py-2 rounded-lg rotate-12 bg-white/40 pointer-events-none flex items-center gap-1 shadow-md animate-fade-in">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    Verified On-Chain
                  </div>
                )}

                {verificationState === "failed" && (
                  <div className="absolute top-20 right-10 md:right-20 border-4 border-rose-500/40 text-rose-500/60 font-mono font-black text-xs md:text-sm tracking-widest uppercase px-4 py-2 rounded-lg -rotate-12 bg-white/40 pointer-events-none flex items-center gap-1 shadow-md animate-shake">
                    <ShieldAlert className="w-4 h-4 text-rose-500" />
                    Compromised
                  </div>
                )}

                {/* CTU Header */}
                <div className="text-center space-y-1.5 border-b-2 border-slate-900 pb-6">
                  <h3 className="text-lg md:text-xl font-bold tracking-tight text-slate-900">
                    CERTIFYCHAIN TECHNICAL UNIVERSITY
                  </h3>
                  <h4 className="text-xs tracking-widest font-sans font-bold text-slate-500 uppercase">
                    Official Academic Report Card
                  </h4>
                </div>

                {/* Student Info Metadata Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6 text-xs md:text-sm font-sans pt-6 pb-6 text-slate-700">
                  <div>
                    <span className="font-bold text-slate-900">Student Name:</span>{" "}
                    <span className="uppercase">{record.name}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-900">Registration Number:</span>{" "}
                    <span className="font-mono text-indigo-700 font-bold uppercase">{record.studentId}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-900">Academic Year:</span>{" "}
                    <span className="uppercase">{record.academicYear}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-900">Department:</span>{" "}
                    <span className="uppercase">{record.department}</span>
                  </div>
                </div>

                {/* Grades Listing Table */}
                <div className="border border-slate-300 rounded-lg overflow-hidden font-sans">
                  <table className="w-full text-left text-xs md:text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-[10px] md:text-xs text-slate-600 uppercase font-bold border-b border-slate-300">
                        <th className="py-3 px-4">Subject Course</th>
                        <th className="py-3 px-4 text-center">Score Marks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-800 font-medium">
                      {record.subjects.map((sub, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-4 uppercase">{sub.subject}</td>
                          <td className="py-3 px-4 text-center font-bold">{sub.marks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer and Security Details */}
                <div className="mt-8 pt-6 border-t border-slate-200 space-y-3 font-sans text-[10px] text-slate-500">
                  <div className="font-bold text-slate-700 uppercase tracking-wider text-[9px]">
                    Ledger Verification Metadata
                  </div>
                  
                  <div className="space-y-1">
                    <div className="overflow-hidden text-ellipsis whitespace-nowrap">
                      <span className="font-semibold text-slate-600">On-Chain Verification Hash: </span>
                      <span className="font-mono text-slate-800">{computeResultHash(record.studentId, record.name, record.academicYear, record.department, record.subjects)}</span>
                    </div>

                    <div className="overflow-hidden text-ellipsis whitespace-nowrap">
                      <span className="font-semibold text-slate-600">Ethereum TX Hash: </span>
                      <span className="font-mono text-slate-800">{record.txHash}</span>
                    </div>
                  </div>

                  <p className="leading-relaxed border-t border-slate-100 pt-2 text-[9px] text-slate-400 italic">
                    Security Notice: This document is protected by an immutable cryptographic hash registered on-chain. Verification entities can upload this document file in the Verify Result portal to check for unauthorized modifications.
                  </p>
                </div>
              </div>

              {/* Centered Download Button below the paper preview */}
              <div className="flex justify-center pt-2">
                <button
                  onClick={handleDownload}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold px-8 py-3.5 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95 text-xs uppercase tracking-wider"
                >
                  <Download className="w-4 h-4" />
                  Download Official Report Card (.docx)
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
