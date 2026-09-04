import React, { useState, useEffect } from "react";
import { useWallet } from "../context/WalletContext";
import { Plus, UserMinus, ShieldCheck, ShieldAlert, Award, RefreshCw } from "lucide-react";

/**
 * Admin Dashboard page allowing the contract owner to authorize (whitelist)
 * and revoke lecturer wallet addresses.
 * @returns {React.ReactElement} The admin dashboard component.
 */
export default function AdminDashboard() {
  const { contract, isCorrectNetwork } = useWallet();

  const [newLecturer, setNewLecturer] = useState("");
  const [lecturers, setLecturers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState({ status: "idle", hash: null, error: null });

  // Load authorized lecturers list on mount
  useEffect(() => {
    loadLecturers();
  }, [contract]);

  /**
   * Queries on-chain event logs to construct the list of active whitelisted lecturers.
   */
  const loadLecturers = async () => {
    if (!contract || !isCorrectNetwork) return;
    setLoading(true);
    try {
      // Query LecturerAdded events
      const addedFilter = contract.filters.LecturerAdded();
      const addedEvents = await contract.queryFilter(addedFilter, 0, "latest");
      const addedAddresses = addedEvents.map(e => e.args[0]);

      // Query LecturerRemoved events
      const removedFilter = contract.filters.LecturerRemoved();
      const removedEvents = await contract.queryFilter(removedFilter, 0, "latest");
      const removedAddresses = removedEvents.map(e => e.args[0]);

      // Filter active addresses (added but not removed)
      // Map to lowercase for accurate unique check
      const removedSet = new Set(removedAddresses.map(a => a.toLowerCase()));
      const activeAddresses = [...new Set(addedAddresses)]
        .filter(addr => !removedSet.has(addr.toLowerCase()));

      setLecturers(activeAddresses);
    } catch (err) {
      console.error("Failed to query lecturers events:", err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Calls contract to whitelist a new lecturer.
   * @param {Event} e - Form submit event.
   */
  const handleAddLecturer = async (e) => {
    e.preventDefault();
    if (!contract || !isCorrectNetwork) return;

    setTxStatus({ status: "pending", hash: null, error: null });
    const addressToAdd = newLecturer.trim();

    try {
      const tx = await contract.addLecturer(addressToAdd);
      setTxStatus({ status: "pending", hash: tx.hash, error: null });

      await tx.wait();
      setTxStatus({ status: "confirmed", hash: tx.hash, error: null });
      setNewLecturer("");
      
      // Reload list
      await loadLecturers();
    } catch (err) {
      console.error(err);
      const errMsg = err.reason || err.message || "Transaction failed";
      setTxStatus({ status: "failed", hash: null, error: errMsg });
    }
  };

  /**
   * Calls contract to revoke lecturer privileges.
   * @param {string} address - Wallet address of the lecturer to remove.
   */
  const handleRemoveLecturer = async (address) => {
    if (!contract || !isCorrectNetwork) return;

    setTxStatus({ status: "pending", hash: null, error: null });

    try {
      const tx = await contract.removeLecturer(address);
      setTxStatus({ status: "pending", hash: tx.hash, error: null });

      await tx.wait();
      setTxStatus({ status: "confirmed", hash: tx.hash, error: null });

      // Reload list
      await loadLecturers();
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
          Admin Control Center
        </h1>
        <p className="text-slate-400 mt-1">
          Whitelisted lecturers gain authorization to publish and modify immutable grade records on-chain.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form panel */}
        <div className="lg:col-span-1">
          <div className="glass-card p-6 sticky top-24">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center">
              <ShieldCheck className="w-5 h-5 text-indigo-400 mr-2" />
              Authorize Lecturer
            </h2>

            <form onSubmit={handleAddLecturer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Wallet Address
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 0x71C7656EC7ab88b098defB751B7401B5f6d8976F"
                  value={newLecturer}
                  onChange={(e) => setNewLecturer(e.target.value)}
                  className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={txStatus.status === "pending"}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-2.5 text-xs font-semibold transition shadow-lg shadow-indigo-600/10 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                {txStatus.status === "pending" ? "Authorizing..." : "Add to Whitelist"}
              </button>
            </form>

            {/* Status Feedback */}
            {txStatus.status !== "idle" && (
              <div className="mt-4 p-4 rounded-xl text-[11px] glass border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-400">Transaction:</span>
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
                  <div className="text-rose-400 border-t border-white/5 pt-2 mt-2 leading-relaxed">
                    {txStatus.error}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Lecturers whitelist panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center">
              <Award className="w-5 h-5 text-indigo-400 mr-2" />
              Whitelisted Lecturers
            </h2>
            <button
              onClick={loadLecturers}
              disabled={loading}
              className="flex items-center text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
              Reload Whitelist
            </button>
          </div>

          {loading ? (
            <div className="glass-card p-12 text-center text-slate-400 text-xs">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-500" />
              Loading authorized addresses from events...
            </div>
          ) : lecturers.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <ShieldAlert className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-white font-semibold">No lecturers authorized</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                No active addresses have been whitelisted yet. Authorize a lecturer wallet to let them publish result data.
              </p>
            </div>
          ) : (
            <div className="glass overflow-hidden rounded-xl border border-white/5 shadow-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/60 border-b border-white/5 text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                    <th className="py-4 px-6">Authorized Address</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs text-slate-300">
                  {lecturers.map((address) => (
                    <tr key={address} className="hover:bg-white/5 transition">
                      <td className="py-4 px-6 font-mono font-semibold tracking-wide text-slate-200">
                        {address}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => handleRemoveLecturer(address)}
                          className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 px-3 py-1.5 rounded-lg text-[10px] font-bold transition flex items-center gap-1.5 ml-auto active:scale-95"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                          Revoke Access
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
