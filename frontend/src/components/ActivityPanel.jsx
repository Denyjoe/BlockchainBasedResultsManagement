import React, { useState, useEffect, useCallback } from "react";
import { useWallet } from "../context/WalletContext";
import { Database, Cpu, Activity, RefreshCw, Link as LinkIcon, Info } from "lucide-react";

/**
 * ActivityPanel component that pulls and displays recent smart contract events and transactions.
 * Designed to provide real-time blockchain feedback during live demonstrations.
 * @returns {React.ReactElement} The activity panel component.
 */
export default function ActivityPanel() {
  const { contract, provider, isCorrectNetwork } = useWallet();
  
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ totalUploads: 0, currentBlock: 0 });

  /**
   * Fetches recent ResultUploaded events and block numbers from the blockchain.
   */
  const fetchRecentActivity = useCallback(async () => {
    if (!contract || !isCorrectNetwork) return;
    setLoading(true);

    try {
      // 1. Get current block number
      const activeProvider = contract.runner.provider;
      const currentBlock = await activeProvider.getBlockNumber();
      
      // 2. Fetch ResultUploaded events
      const filter = contract.filters.ResultUploaded();
      const events = await contract.queryFilter(filter, 0, "latest");
      
      setStats({
        totalUploads: events.length,
        currentBlock: currentBlock,
      });

      // 3. Resolve the timestamps and format logs (take last 5 in reverse)
      const recentEvents = events.slice(-5).reverse();
      
      const formattedActivities = await Promise.all(
        recentEvents.map(async (event) => {
          let timeString = "Mining...";
          try {
            const block = await activeProvider.getBlock(event.blockNumber);
            timeString = new Date(Number(block.timestamp) * 1000).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            });
          } catch (tErr) {
            console.error("Timestamp fetch failed:", tErr);
          }

          return {
            regNumber: event.args[0],
            resultHash: event.args[1],
            issuedBy: event.args[2],
            txHash: event.transactionHash,
            blockNumber: event.blockNumber,
            timestamp: timeString,
          };
        })
      );

      setActivities(formattedActivities);
    } catch (err) {
      console.error("Failed to load blockchain activity logs:", err);
    } finally {
      setLoading(false);
    }
  }, [contract, isCorrectNetwork]);

  // Listen to block events and also poll every 6 seconds as a fallback
  // because MetaMask BrowserProvider does not reliably emit block events
  useEffect(() => {
    fetchRecentActivity();

    // Polling interval — runs every 6 seconds regardless of block events
    const pollInterval = setInterval(() => {
      fetchRecentActivity();
    }, 6000);

    // Also listen for manual refresh signal dispatched after a transaction confirms
    const handleManualRefresh = () => fetchRecentActivity();
    window.addEventListener("certifychain:newblock", handleManualRefresh);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener("certifychain:newblock", handleManualRefresh);
    };
  }, [fetchRecentActivity]);

  return (
    <div className="glass-card p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center space-x-2">
          <Activity className="w-5 h-5 text-indigo-400 animate-pulse" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Ganache Ledger Activity
          </h2>
        </div>
        <button
          onClick={fetchRecentActivity}
          disabled={loading}
          className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center font-semibold disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
          Reload
        </button>
      </div>

      {/* Ledger Context Clarification Callout */}
      <div className="bg-slate-900/60 border border-indigo-500/20 rounded-xl p-3 text-[11px] text-slate-300 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-white">Blocks here are always green:</strong> They show that a transaction was successfully mined on-chain, not whether student data is authentic. Tamper detection happens separately in the <span className="text-indigo-300 font-semibold">Verify Result</span> tab by comparing an uploaded document's data against the hash stored in these blocks.
        </p>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="bg-slate-900/40 p-3 rounded-xl border border-white/5 flex items-center space-x-2">
          <Database className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <span className="block text-[10px] text-slate-500 font-semibold uppercase">Total Uploads</span>
            <span className="text-white font-bold">{stats.totalUploads}</span>
          </div>
        </div>

        <div className="bg-slate-900/40 p-3 rounded-xl border border-white/5 flex items-center space-x-2">
          <Cpu className="w-4 h-4 text-indigo-400 shrink-0" />
          <div>
            <span className="block text-[10px] text-slate-500 font-semibold uppercase">Latest Block</span>
            <span className="text-white font-bold">#{stats.currentBlock}</span>
          </div>
        </div>
      </div>

      {/* Activities list */}
      <div className="space-y-3 pt-2">
        <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          Mined Transactions Log
        </span>

        {activities.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs italic">
            No grading transactions recorded in current network epoch.
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
            {activities.map((act, idx) => (
              <div 
                key={idx} 
                className="bg-slate-950/40 border border-white/5 p-3 rounded-xl space-y-1.5 hover:border-indigo-500/20 transition animate-fade-in"
              >
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    Block #{act.blockNumber}
                  </span>
                  <span className="text-slate-500 font-semibold">
                    {act.timestamp}
                  </span>
                </div>
                
                <div className="text-xs font-semibold text-slate-300">
                  Result Hash Published for: <span className="text-white">{act.regNumber}</span>
                </div>
                
                <div className="flex items-center text-[10px] text-indigo-400 font-mono truncate gap-1 border-t border-white/5 pt-1.5 mt-1">
                  <LinkIcon className="w-3 h-3 text-slate-500" />
                  <span className="truncate" title={act.txHash}>
                    Tx: {act.txHash}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
