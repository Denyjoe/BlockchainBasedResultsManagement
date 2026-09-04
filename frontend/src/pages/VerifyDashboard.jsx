import React, { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { computeResultHash, canonicalizeResultData } from "../utils/hashUtils";
import { parseUploadedResult } from "../utils/documentUtils";
import {
  Upload, CheckCircle, ShieldAlert, AlertTriangle, FileText,
  RefreshCw, X, ArrowRight, ShieldCheck, Bug, Info, ChevronDown, ChevronUp,
  Lock, Check, XCircle, HelpCircle
} from "lucide-react";

/**
 * VerifyDashboard component. Handles uploading a report card .docx file,
 * parsing it client-side, computing the Keccak256 hash, and verifying integrity on-chain.
 * @returns {React.ReactElement} The verification dashboard component.
 */
export default function VerifyDashboard() {
  const { contract, isCorrectNetwork } = useWallet();

  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [error, setError] = useState(null);
  const [showPayloadDetails, setShowPayloadDetails] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  /**
   * Triggers file selection and state updates.
   * @param {Event} e - File input change event.
   */
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setVerificationResult(null);
      setError(null);
    }
  };

  /**
   * Processes the uploaded file: parses the text, recomputes the hash,
   * queries the contract, and checks differences against the off-chain database.
   */
  const processAndVerifyFile = async () => {
    if (!file) return;
    if (!contract || !isCorrectNetwork) {
      setError("Please connect your Web3 wallet on Ganache network to run verification.");
      return;
    }

    setParsing(true);
    setVerificationResult(null);
    setError(null);

    try {
      // 1. Read file as array buffer
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const buffer = e.target.result;

          // 2. Parse the document using mammoth + paragraph-by-paragraph extraction
          const { regNumber, name, academicYear, department, subjects } = await parseUploadedResult(buffer);

          // 3. Canonicalize and compute deterministic hash
          const canonical       = canonicalizeResultData(regNumber, name, academicYear, department, subjects);
          const recomputedHash  = computeResultHash(regNumber, name, academicYear, department, subjects);

          // 4. Fetch the hash that is actually stored on-chain for this reg number
          let onChainStoredHash = null;
          try {
            const lookupKey   = await contract.getLookupKey(regNumber);
            const onChainData = await contract.results(lookupKey);
            onChainStoredHash = onChainData?.resultHash || null;
          } catch (hashFetchErr) {
            console.warn("Could not fetch on-chain stored hash:", hashFetchErr);
          }

          // 5. Verify on-chain
          const isValid = await contract.verifyIntegrity(regNumber, recomputedHash);

          // 6. Diff against off-chain cache
          let diffs = [];
          const cache = localStorage.getItem("student_results_cache");
          let originalRecord = null;

          if (cache) {
            const parsedCache = JSON.parse(cache);
            originalRecord = parsedCache.find(
              (r) => r.studentId.toUpperCase() === regNumber.toUpperCase()
            );

            if (originalRecord) {
              if (originalRecord.name && originalRecord.name.toUpperCase() !== name.toUpperCase()) {
                diffs.push({ subject: "Student Name",  uploaded: name,         original: originalRecord.name,         type: "mismatch" });
              }
              if (originalRecord.academicYear && originalRecord.academicYear.toUpperCase() !== academicYear.toUpperCase()) {
                diffs.push({ subject: "Academic Year", uploaded: academicYear,  original: originalRecord.academicYear, type: "mismatch" });
              }
              if (originalRecord.department && originalRecord.department.toUpperCase() !== department.toUpperCase()) {
                diffs.push({ subject: "Department",    uploaded: department,    original: originalRecord.department,   type: "mismatch" });
              }

              const originalSubjects = originalRecord.subjects || [];
              subjects.forEach((s) => {
                const orig = originalSubjects.find(
                  (os) => os.subject.trim().toUpperCase() === s.subject.trim().toUpperCase()
                );
                if (orig) {
                  if (Number(orig.marks) !== Number(s.marks)) {
                    diffs.push({ subject: s.subject, uploaded: s.marks, original: orig.marks, type: "mismatch" });
                  }
                } else {
                  diffs.push({ subject: s.subject, uploaded: s.marks, original: null, type: "added" });
                }
              });
              originalSubjects.forEach((os) => {
                const uploaded = subjects.find(
                  (s) => s.subject.trim().toUpperCase() === os.subject.trim().toUpperCase()
                );
                if (!uploaded) {
                  diffs.push({ subject: os.subject, uploaded: null, original: os.marks, type: "removed" });
                }
              });
            }
          }

          // Console diagnostic — compare both hashes for debugging
          console.debug("[CertifyChain Verify] Recomputed hash:",  recomputedHash);
          console.debug("[CertifyChain Verify] On-chain hash:    ",  onChainStoredHash);
          console.debug("[CertifyChain Verify] Canonical payload:", JSON.stringify(canonical, null, 2));

          setVerificationResult({
            isValid,
            regNumber,
            name,
            academicYear,
            department,
            subjects,
            hash:             recomputedHash,
            onChainHash:      onChainStoredHash,
            canonicalPayload: canonical,
            diffs,
            hasOriginalRecord: !!originalRecord,
          });
        } catch (err) {
          console.error("Verification processing failed:", err);
          setError(err.message || "Failed to parse document text. Ensure it is a valid CertifyChain report card.");
        } finally {
          setParsing(false);
        }
      };

      reader.onerror = () => {
        setError("Error reading file binary stream.");
        setParsing(false);
      };

      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred during verification.");
      setParsing(false);
    }
  };

  /**
   * Handles drag-over event for file drop zone.
   * @param {DragEvent} e - Drag over event.
   */
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  /**
   * Handles dropping files in drop zone.
   * @param {DragEvent} e - Drop event.
   */
  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setVerificationResult(null);
      setError(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Credential Verification
            </h1>
            <p className="text-slate-400 mt-1">
              Upload a student's .docx report card. The system parses the document contents, re-hashes the details, and verifies them directly against the Ethereum blockchain ledger.
            </p>
          </div>
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="shrink-0 flex items-center gap-1.5 bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-500/30 px-3.5 py-2 rounded-xl text-xs font-semibold transition"
          >
            <HelpCircle className="w-4 h-4 text-indigo-400" />
            <span>How Verification Works</span>
            {showGuide ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
          </button>
        </div>

        {/* Collapsible Demo / Presentation Guide */}
        {showGuide && (
          <div className="mt-4 p-5 rounded-2xl bg-slate-900/80 border border-indigo-500/30 space-y-3 animate-fade-in">
            <div className="flex items-center space-x-2">
              <Info className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Architecture Concept: Off-Chain Document Verification vs Blockchain Blocks
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-1">
              <div className="bg-black/40 p-3 rounded-xl border border-white/5 space-y-1">
                <div className="text-indigo-400 font-bold text-[11px] flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center text-[10px]">1</span>
                  Issuance (Upload)
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Lecturer issues grades. The app canonicalizes student data, calculates its Keccak256 hash, and records it permanently on-chain.
                </p>
              </div>
              <div className="bg-black/40 p-3 rounded-xl border border-white/5 space-y-1">
                <div className="text-indigo-400 font-bold text-[11px] flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center text-[10px]">2</span>
                  Verification (Verify Tab)
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  When a student or employer uploads a .docx file, the app parses the text and recomputes the hash directly in their browser.
                </p>
              </div>
              <div className="bg-black/40 p-3 rounded-xl border border-white/5 space-y-1">
                <div className="text-indigo-400 font-bold text-[11px] flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center text-[10px]">3</span>
                  Tamper Detection
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  If even 1 character was edited off-chain, the recomputed hash diverges from the on-chain hash. The app flags it as tampered.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Upload Column */}
        <div className="md:col-span-1 space-y-6">
          <div className="glass-card p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center">
              <Upload className="w-5 h-5 text-indigo-400 mr-2" />
              Upload Document
            </h2>

            {/* Drag & Drop Area */}
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="border-2 border-dashed border-white/10 hover:border-indigo-500/40 rounded-2xl p-6 text-center cursor-pointer bg-slate-900/20 hover:bg-slate-900/40 transition duration-200"
            >
              <input
                type="file"
                id="verify-file-input"
                accept=".docx"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="verify-file-input" className="cursor-pointer space-y-3 block">
                <FileText className="w-10 h-10 text-slate-500 mx-auto" />
                <div>
                  <span className="text-indigo-400 font-bold text-xs hover:underline">
                    Browse File
                  </span>
                  <span className="text-slate-400 text-xs"> or drag it here</span>
                </div>
                <div className="text-[10px] text-slate-500">Supports Word document (.docx) formats only</div>
              </label>
            </div>

            {/* Chosen File Details */}
            {file && (
              <div className="mt-4 p-3 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2 truncate">
                  <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="text-slate-300 font-medium truncate">{file.name}</span>
                </div>
                <button
                  onClick={() => {
                    setFile(null);
                    setVerificationResult(null);
                  }}
                  className="text-slate-500 hover:text-white ml-2"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              onClick={processAndVerifyFile}
              disabled={!file || parsing}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl text-xs transition mt-6 disabled:opacity-50 flex items-center justify-center gap-1.5 active:scale-95"
            >
              {parsing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Parsing File...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Run Integrity Verification
                </>
              )}
            </button>

            {error && (
              <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 leading-relaxed flex items-start">
                <AlertTriangle className="w-4 h-4 mr-2 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>

        {/* Verification Result Column */}
        <div className="md:col-span-2 space-y-6">
          {!verificationResult ? (
            <div className="glass-card p-12 text-center h-full flex flex-col justify-center items-center">
              <ShieldCheck className="w-16 h-16 text-slate-700 mb-3" />
              <h3 className="text-white font-bold">Awaiting Verification Run</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Upload a student's generated report card document on the left and trigger the check to inspect its cryptographic validity.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Dynamic Status Banner */}
              {verificationResult.isValid ? (
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-2xl flex items-start gap-4 animate-fade-in border-l-4 border-l-emerald-500">
                  <div className="bg-emerald-500/20 p-2 rounded-xl text-emerald-400 shrink-0">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-emerald-400 font-extrabold text-base flex items-center gap-2">
                      <span>✅ Verified — Matches Blockchain Record</span>
                    </h3>
                    <p className="text-slate-300 text-xs mt-1 leading-relaxed">
                      Cryptographic validation successful. The document hash matches the record stored on the Ethereum blockchain. No alterations have been made.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-rose-500/10 border border-rose-500/20 p-5 rounded-2xl flex items-start gap-4 animate-shake border-l-4 border-l-rose-500">
                  <div className="bg-rose-500/20 p-2 rounded-xl text-rose-400 shrink-0">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-rose-400 font-extrabold text-base flex items-center gap-2">
                      <span>🚫 Data Tampered — This document does not match the blockchain record</span>
                    </h3>
                    <p className="text-slate-300 text-xs mt-1 leading-relaxed">
                      Security alert: The recomputed document hash does not match the registered on-chain hash record. This report card has been edited or modified after issuance.
                    </p>
                  </div>
                </div>
              )}

              {/* Side-by-Side Cryptographic Hash Comparison Card */}
              <div className="glass-card p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-white/5 pb-3">
                  <div className="flex items-center space-x-2">
                    <Lock className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      Cryptographic Proof: Hash Comparison
                    </h3>
                  </div>

                  {verificationResult.hash === verificationResult.onChainHash ? (
                    <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1 w-fit">
                      <Check className="w-3.5 h-3.5" /> EXACT MATCH (Authentic)
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20 flex items-center gap-1 w-fit">
                      <XCircle className="w-3.5 h-3.5" /> HASH MISMATCH (Tampered)
                    </span>
                  )}
                </div>

                {/* Side-by-side hash boxes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* Recomputed hash */}
                  <div className="bg-black/40 p-4 rounded-xl border border-white/5 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-400 uppercase">1. Recomputed from File</span>
                      <span className="text-amber-400 font-mono text-[10px] bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">Client Keccak256</span>
                    </div>
                    <div className="font-mono text-[11px] text-amber-300 break-all bg-black/60 p-2.5 rounded-lg border border-white/5 select-all">
                      {verificationResult.hash}
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Calculated directly in-browser from uploaded .docx content.
                    </p>
                  </div>

                  {/* On-chain hash */}
                  <div className="bg-black/40 p-4 rounded-xl border border-white/5 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-400 uppercase">2. Stored on Ethereum</span>
                      <span className="text-emerald-400 font-mono text-[10px] bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">Ganache Block Record</span>
                    </div>
                    <div className="font-mono text-[11px] text-emerald-300 break-all bg-black/60 p-2.5 rounded-lg border border-white/5 select-all">
                      {verificationResult.onChainHash || "None registered on current contract"}
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Mined and permanently stored by lecturer on the smart contract.
                    </p>
                  </div>
                </div>

                {/* Deterministic Payload Toggle */}
                <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    Inspect deterministic byte payload used to generate Keccak256 hash:
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPayloadDetails(!showPayloadDetails)}
                    className="text-[11px] text-indigo-400 hover:text-indigo-200 font-semibold underline flex items-center gap-1 cursor-pointer"
                  >
                    <Bug className="w-3.5 h-3.5" />
                    {showPayloadDetails ? "Hide Payload" : "View Payload"}
                  </button>
                </div>

                {showPayloadDetails && verificationResult.canonicalPayload && (
                  <div className="bg-black/70 p-3.5 rounded-xl border border-white/10 space-y-1.5 animate-fade-in">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase">
                      Canonical JSON Payload:
                    </span>
                    <pre className="font-mono text-[10px] text-indigo-200 overflow-x-auto max-h-40">
                      {JSON.stringify(verificationResult.canonicalPayload, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              {/* Document Details Card */}
              <div className="glass-card p-6 space-y-4">
                <h3 className="text-sm font-bold text-white border-b border-white/5 pb-2">
                  Extracted Document Details
                </h3>

                <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-xs">
                  <div>
                    <span className="block text-[10px] text-slate-500 font-semibold uppercase">Student Name</span>
                    <span className="font-bold text-white text-sm">{verificationResult.name}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-semibold uppercase">Registration Number</span>
                    <span className="font-bold text-white text-sm">{verificationResult.regNumber}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-semibold uppercase">Academic Year</span>
                    <span className="font-bold text-white text-sm">{verificationResult.academicYear}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-semibold uppercase">Department</span>
                    <span className="font-bold text-white text-sm">{verificationResult.department}</span>
                  </div>
                </div>

                {/* Table of Parsed Grades */}
                <div className="mt-4">
                  <span className="block text-xs font-semibold text-slate-400 mb-2">Extracted Grades</span>
                  <div className="bg-black/30 rounded-xl overflow-hidden border border-white/5">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-900/60 text-[10px] text-slate-400 uppercase font-bold border-b border-white/5">
                          <th className="py-2.5 px-4">Subject</th>
                          <th className="py-2.5 px-4 text-center">Extracted Marks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-slate-300 font-medium">
                        {verificationResult.subjects.map((sub, idx) => (
                          <tr key={idx} className="hover:bg-white/5 transition">
                            <td className="py-2.5 px-4 uppercase">{sub.subject}</td>
                            <td className="py-2.5 px-4 text-center text-white font-bold">{sub.marks}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Tampering Difference Logs */}
              {!verificationResult.isValid && (
                <div className="glass-card p-6 border-l-4 border-l-rose-500">
                  <h3 className="text-sm font-bold text-rose-400 mb-3 flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Off-Chain Difference Log (Tampered Fields)
                  </h3>

                  {!verificationResult.hasOriginalRecord ? (
                    <p className="text-xs text-slate-400 leading-relaxed">
                      No original cache record found in this browser's `localStorage` for <strong>{verificationResult.regNumber}</strong>. We verified the tampering via the smart contract, but difference analysis cannot display which values were modified because the original grades are not cached locally.
                    </p>
                  ) : verificationResult.diffs.length === 0 ? (
                    <p className="text-xs text-slate-400 leading-relaxed">
                      The document hash is invalid on-chain, but the local cached grades match the document grades. The document might have been issued on a different contract or contains metadata modifications in the headers/footers.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Comparing the uploaded document values against the official off-chain database records shows the following discrepancies:
                      </p>
                      
                      <div className="space-y-2">
                        {verificationResult.diffs.map((diff, idx) => (
                          <div key={idx} className="bg-rose-500/5 border border-rose-500/10 p-3 rounded-xl flex items-center justify-between text-xs animate-fade-in">
                            <div>
                              <span className="font-bold text-slate-200 uppercase">{diff.subject}</span>
                              <span className="block text-[10px] text-slate-400 mt-0.5">
                                {diff.type === "mismatch" && "Discrepancy detected"}
                                {diff.type === "added" && "Added in document"}
                                {diff.type === "removed" && "Omitted in document"}
                              </span>
                            </div>
                            
                            <div className="flex items-center space-x-3 font-semibold">
                              {diff.type === "mismatch" && (
                                <>
                                  <span className="text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">{diff.uploaded}</span>
                                  <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                                  <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20" title="Blockchain Original Record">{diff.original}</span>
                                </>
                              )}
                              {diff.type === "added" && (
                                <span className="text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">Added (Val: {diff.uploaded})</span>
                              )}
                              {diff.type === "removed" && (
                                <span className="text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">Omitted (Official: {diff.original})</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
