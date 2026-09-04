import React, { useState } from "react";
import { WalletProvider, useWallet } from "./context/WalletContext";
import Navbar from "./components/Navbar";
import StudentDashboard from "./pages/StudentDashboard";
import LecturerDashboard from "./pages/LecturerDashboard";
import VerifyDashboard from "./pages/VerifyDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import ActivityPanel from "./components/ActivityPanel";
import { 
  GraduationCap, Award, ShieldAlert, KeyRound, Wallet, 
  Database, Info, AlertTriangle, ShieldCheck 
} from "lucide-react";

/**
 * Main application content router. Displays tabs based on role authentication and selection,
 * alongside a sticky side panel for blockchain activity monitoring.
 * @returns {React.ReactElement} The App content element.
 */
function AppContent() {
  const { account, isCorrectNetwork, isLecturer, isAdmin, connectWallet, switchNetwork } = useWallet();
  const [activeTab, setActiveTab] = useState("student");

  // Show Connect Wallet page if not connected
  if (!account) {
    return (
      <div className="min-h-screen flex flex-col justify-between">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="glass-card max-w-2xl w-full p-8 text-center space-y-8 animate-fade-in">
            <div className="space-y-3">
              <div className="bg-indigo-600/10 border border-indigo-500/20 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto text-indigo-400">
                <Database className="w-8 h-8" />
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
                Decentralized Result Verification
              </h1>
              <p className="text-slate-400 text-sm max-w-lg mx-auto leading-relaxed">
                CertifyChain uses Ethereum smart contracts to hash and verify academic report cards. 
                Students download authentic Word credentials, and verification systems can instantly audit documents for tampering.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              <div className="bg-slate-900/40 border border-white/5 p-5 rounded-2xl space-y-2">
                <GraduationCap className="w-5 h-5 text-emerald-400" />
                <h3 className="text-white font-bold text-sm">Students</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Search academic history and download authentic digital credentials verified by the blockchain.
                </p>
              </div>

              <div className="bg-slate-900/40 border border-white/5 p-5 rounded-2xl space-y-2">
                <Award className="w-5 h-5 text-indigo-400" />
                <h3 className="text-white font-bold text-sm">Lecturers</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Digitally sign report card hashes onto the blockchain ledger and issue downloadable documents.
                </p>
              </div>

              <div className="bg-slate-900/40 border border-white/5 p-5 rounded-2xl space-y-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <h3 className="text-white font-bold text-sm">Verification</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Verify credential files instantly. Recomputed file hashes validate document authenticity.
                </p>
              </div>
            </div>

            <button
              onClick={connectWallet}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-3.5 rounded-xl transition shadow-lg shadow-indigo-600/20 active:scale-95 flex items-center justify-center gap-2 mx-auto"
            >
              <Wallet className="w-5 h-5" />
              Connect Web3 Wallet
            </button>
          </div>
        </main>
        <footer className="text-center py-6 text-xs text-slate-500 border-t border-white/5">
          CertifyChain Verification Portal &copy; {new Date().getFullYear()} — Powered by Ethereum Smart Contracts.
        </footer>
      </div>
    );
  }

  // Show network mismatch screen if not on Ganache (Chain ID 1337)
  if (!isCorrectNetwork) {
    return (
      <div className="min-h-screen flex flex-col justify-between">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="glass-card max-w-md w-full p-8 text-center space-y-6 border-l-4 border-l-rose-500 animate-fade-in">
            <div className="bg-rose-500/10 border border-rose-500/20 w-14 h-14 rounded-full flex items-center justify-center mx-auto text-rose-400">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">Wrong Ethereum Network</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Please switch your MetaMask connection network to your local Ganache network.
              </p>
            </div>
            <div className="bg-slate-900/60 p-4 rounded-xl text-left text-xs font-mono text-slate-400 space-y-1 border border-white/5">
              <div>Network Target: Ganache RPC</div>
              <div>RPC URL: http://127.0.0.1:7545</div>
              <div>Expected Chain ID: 1337</div>
            </div>
            <button
              onClick={switchNetwork}
              className="w-full bg-rose-600 hover:bg-rose-500 text-white font-semibold py-3 rounded-xl transition"
            >
              Switch Network in MetaMask
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      {/* Navigation tabs */}
      <div className="max-w-7xl w-full mx-auto px-6 mt-8">
        <div className="flex border-b border-white/10 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab("student")}
            className={`py-3 px-6 font-semibold text-sm transition-all whitespace-nowrap relative ${
              activeTab === "student" ? "text-indigo-400 border-b-2 border-indigo-500" : "text-slate-400 hover:text-white"
            }`}
          >
            Student Portal
          </button>
          
          <button
            onClick={() => setActiveTab("lecturer")}
            className={`py-3 px-6 font-semibold text-sm transition-all whitespace-nowrap relative ${
              activeTab === "lecturer" ? "text-indigo-400 border-b-2 border-indigo-500" : "text-slate-400 hover:text-white"
            }`}
          >
            Lecturer Portal
          </button>

          <button
            onClick={() => setActiveTab("verify")}
            className={`py-3 px-6 font-semibold text-sm transition-all whitespace-nowrap relative ${
              activeTab === "verify" ? "text-indigo-400 border-b-2 border-indigo-500" : "text-slate-400 hover:text-white"
            }`}
          >
            Verify Result (Job View)
          </button>

          <button
            onClick={() => setActiveTab("admin")}
            className={`py-3 px-6 font-semibold text-sm transition-all whitespace-nowrap relative ${
              activeTab === "admin" ? "text-indigo-400 border-b-2 border-indigo-500" : "text-slate-400 hover:text-white"
            }`}
          >
            Admin Panel
          </button>
        </div>
      </div>

      {/* Grid Layout dividing Main Area and activity panel */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Column: Dashboards */}
        <div className="lg:col-span-3">
          {activeTab === "student" && <StudentDashboard />}

          {activeTab === "verify" && <VerifyDashboard />}

          {activeTab === "lecturer" && (
            isLecturer || isAdmin ? (
              <LecturerDashboard />
            ) : (
              <div className="glass-card p-8 text-center max-w-lg mx-auto border-l-4 border-l-amber-500 space-y-4 animate-fade-in mt-12">
                <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto" />
                <div>
                  <h3 className="text-white font-bold text-lg">Lecturer Access Denied</h3>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1">
                    Your connected address is not whitelisted as a lecturer on the smart contract.
                  </p>
                </div>
                <div className="bg-slate-900/60 p-4 rounded-xl text-left text-xs text-slate-400 space-y-2 border border-white/5">
                  <div className="flex items-start gap-1.5">
                    <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    <span>
                      To resolve this for testing, switch to the <strong>Admin Panel</strong> tab (using the contract owner wallet) and authorize this address:
                    </span>
                  </div>
                  <div className="bg-black/40 p-2.5 rounded font-mono text-[10px] text-indigo-300 break-all select-all">
                    {account}
                  </div>
                </div>
              </div>
            )
          )}

          {activeTab === "admin" && (
            isAdmin ? (
              <AdminDashboard />
            ) : (
              <div className="glass-card p-8 text-center max-w-lg mx-auto border-l-4 border-l-rose-500 space-y-4 animate-fade-in mt-12">
                <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto" />
                <div>
                  <h3 className="text-white font-bold text-lg">Admin Access Denied</h3>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1">
                    Only the contract deployer (Owner) can access the Administrator whitelisting controls.
                  </p>
                </div>
                <div className="bg-slate-900/60 p-4 rounded-xl text-left text-xs text-slate-400 space-y-2 border border-white/5">
                  <div className="flex items-start gap-1.5">
                    <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    <span>
                      In Ganache development environments, the first account in the keys list is usually the contract owner address.
                    </span>
                  </div>
                </div>
              </div>
            )
          )}
        </div>

        {/* Right Column: Ledger Activity Panel */}
        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <ActivityPanel />
          </div>
        </div>
      </main>
      
      <footer className="text-center py-6 text-xs text-slate-600 border-t border-white/5 mt-12">
        CertifyChain Portal &copy; {new Date().getFullYear()} — Powered by Ethereum Smart Contracts.
      </footer>
    </div>
  );
}

/**
 * Root component wrapping AppContent in WalletProvider.
 * @returns {React.ReactElement} The Root React App.
 */
function App() {
  return (
    <WalletProvider>
      <AppContent />
    </WalletProvider>
  );
}

export default App;
