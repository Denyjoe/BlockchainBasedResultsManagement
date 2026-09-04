import React from "react";
import { useWallet } from "../context/WalletContext";
import { Wallet, Shield, Award, GraduationCap, AlertTriangle, RefreshCw, LogOut } from "lucide-react";

/**
 * Navbar component for the application. Displays the title, network state,
 * role badge, account balance details, and connection action.
 * @returns {React.ReactElement} The Navbar element.
 */
export default function Navbar() {
  const {
    account,
    connectWallet,
    disconnectWallet,
    isCorrectNetwork,
    switchNetwork,
    isLecturer,
    isAdmin,
  } = useWallet();

  /**
   * Formats the wallet address to a shorter readable form.
   * @param {string} addr - The full hex address.
   * @returns {string} The formatted address (e.g. 0x1234...5678).
   */
  const formatAddress = (addr) => {
    if (!addr) return "";
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  /**
   * Helper function to get the current user role text.
   * @returns {string} Role text.
   */
  const getRoleText = () => {
    if (isAdmin) return "Admin (Owner)";
    if (isLecturer) return "Lecturer";
    return "Student";
  };

  /**
   * Helper function to get the current role icon.
   * @returns {React.ReactNode} Role icon.
   */
  const getRoleIcon = () => {
    if (isAdmin) return <Shield className="w-4 h-4 text-amber-400 mr-1" />;
    if (isLecturer) return <Award className="w-4 h-4 text-indigo-400 mr-1" />;
    return <GraduationCap className="w-4 h-4 text-emerald-400 mr-1" />;
  };

  return (
    <nav className="glass sticky top-0 z-50 w-full px-6 py-4 flex items-center justify-between border-b border-white/5">
      <div className="flex items-center space-x-3">
        <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
          <Award className="w-6 h-6 text-white" />
        </div>
        <div>
          <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-400 bg-clip-text text-transparent">
            CertifyChain
          </span>
          <span className="block text-[10px] text-slate-400 uppercase tracking-widest font-semibold mt-0.5">
            Student Result Verification
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {/* Wrong network alert */}
        {account && !isCorrectNetwork && (
          <button
            onClick={switchNetwork}
            className="flex items-center bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
          >
            <AlertTriangle className="w-3.5 h-3.5 mr-1" />
            Switch to Ganache (Port 7545)
          </button>
        )}

        {/* User profile & status */}
        {account ? (
          <div className="flex items-center space-x-3">
            {/* Role Badge */}
            <div className="flex items-center bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg">
              {getRoleIcon()}
              <span className="text-xs font-semibold text-slate-300">
                {getRoleText()}
              </span>
            </div>

            {/* Address Badge */}
            <div className="flex items-center bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-lg">
              <Wallet className="w-3.5 h-3.5 text-indigo-400 mr-1.5" />
              <span className="text-xs font-mono font-bold text-indigo-300">
                {formatAddress(account)}
              </span>
            </div>

            {/* Disconnect Button */}
            <button
              onClick={disconnectWallet}
              title="Clear app connection state"
              className="flex items-center bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 p-2 rounded-lg text-xs font-semibold transition-all duration-200"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={connectWallet}
            className="flex items-center bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-all duration-200 shadow-md shadow-indigo-600/20 active:scale-95"
          >
            <Wallet className="w-4 h-4 mr-2" />
            Connect Wallet
          </button>
        )}
      </div>
    </nav>
  );
}
