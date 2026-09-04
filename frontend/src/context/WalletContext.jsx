import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import contractData from "../contracts/contractData.json";

const WalletContext = createContext(null);

/**
 * Custom hook to consume the WalletContext.
 * @returns {Object} The wallet and contract state.
 */
export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
};

/**
 * WalletProvider component that handles MetaMask integration, network detection,
 * contract instantiation, and user role resolve logic.
 * @param {Object} props - React props.
 * @param {React.ReactNode} props.children - Child components to render.
 */
export const WalletProvider = ({ children }) => {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);
  const [isLecturer, setIsLecturer] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [chainId, setChainId] = useState(null);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const EXPECTED_CHAIN_ID = "0x539"; // 1337 in hex

  /**
   * Resolves the user's role on the smart contract based on their wallet address.
   * @param {Object} activeContract - Instantiated ethers.Contract instance.
   * @param {string} userAddress - Connected wallet address.
   * @returns {Promise<void>}
   */
  const determineUserRole = async (activeContract, userAddress) => {
    try {
      // Check if Owner (Admin)
      const ownerAddress = await activeContract.owner();
      const isUserOwner = ownerAddress.toLowerCase() === userAddress.toLowerCase();
      setIsAdmin(isUserOwner);

      // Check if Lecturer
      const isUserLecturer = await activeContract.lecturers(userAddress);
      setIsLecturer(isUserLecturer);
    } catch (err) {
      console.error("Error determining user role:", err);
      setIsAdmin(false);
      setIsLecturer(false);
    }
  };

  /**
   * Initializes the connection to the Ethereum provider and contract.
   * @returns {Promise<void>}
   */
  const checkConnection = useCallback(async () => {
    if (!window.ethereum) {
      setError("MetaMask is not installed. Please install it to use this app.");
      setLoading(false);
      return;
    }

    try {
      const activeProvider = new ethers.BrowserProvider(window.ethereum);
      const network = await activeProvider.getNetwork();
      const hexChainId = "0x" + network.chainId.toString(16);
      setChainId(hexChainId);

      const correctNetwork = hexChainId === EXPECTED_CHAIN_ID;
      setIsCorrectNetwork(correctNetwork);

      const accounts = await activeProvider.listAccounts();
      if (accounts.length > 0) {
        const activeSigner = await activeProvider.getSigner();
        const userAddress = await activeSigner.getAddress();
        setAccount(userAddress);
        setSigner(activeSigner);

        const activeContract = new ethers.Contract(
          contractData.address,
          contractData.abi,
          activeSigner
        );
        setContract(activeContract);

        if (correctNetwork) {
          await determineUserRole(activeContract, userAddress);
        }
      } else {
        // Reset states if no accounts connected
        setAccount(null);
        setSigner(null);
        setContract(null);
        setIsAdmin(false);
        setIsLecturer(false);
      }
    } catch (err) {
      console.error("Initialization error:", err);
      setError("Failed to connect to wallet.");
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Requests connection to MetaMask wallet.
   * @returns {Promise<string|null>} The connected account address or null.
   */
  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("MetaMask is not installed. Please install it.");
      return null;
    }

    setLoading(true);
    try {
      const activeProvider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      if (accounts.length > 0) {
        await checkConnection();
        return accounts[0];
      }
    } catch (err) {
      console.error("Connection request failed:", err);
      setError("User rejected connection or connection failed.");
    } finally {
      setLoading(false);
    }
    return null;
  };

  /**
   * Requests switching network in MetaMask to Ganache (Chain ID 1337).
   * @returns {Promise<void>}
   */
  const switchNetwork = async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: EXPECTED_CHAIN_ID }],
      });
    } catch (switchError) {
      // This error code indicates that the chain has not been added to MetaMask.
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: EXPECTED_CHAIN_ID,
                chainName: "Ganache Local Node",
                nativeCurrency: {
                  name: "ETH",
                  symbol: "ETH",
                  decimals: 18,
                },
                rpcUrls: ["http://127.0.0.1:7545"],
              },
            ],
          });
        } catch (addError) {
          console.error("Failed to add network:", addError);
        }
      } else {
        console.error("Failed to switch network:", switchError);
      }
    }
  };

  // Listen to accounts and network changes
  useEffect(() => {
    checkConnection();

    if (window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        console.log("Accounts changed:", accounts);
        checkConnection();
      };

      const handleChainChanged = (chainHexId) => {
        console.log("Network changed:", chainHexId);
        // Recommended reload on chain change
        window.location.reload();
      };

      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", handleChainChanged);

      return () => {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
        window.ethereum.removeListener("chainChanged", handleChainChanged);
      };
    }
  }, [checkConnection]);

  /**
   * Simulates disconnecting the wallet by clearing local React state
   * and prompting the user about MetaMask extension options.
   */
  const disconnectWallet = () => {
    setAccount(null);
    setSigner(null);
    setContract(null);
    setIsAdmin(false);
    setIsLecturer(false);
    alert("Connection cleared in the application! To revoke this site's permissions entirely, open your MetaMask extension, click the three dots, and select 'Connected sites' -> 'Disconnect'.");
  };

  const value = {
    account,
    provider,
    signer,
    contract,
    isLecturer,
    isAdmin,
    chainId,
    isCorrectNetwork,
    loading,
    error,
    connectWallet,
    disconnectWallet,
    switchNetwork,
    refreshRole: () => contract && account && determineUserRole(contract, account),
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};
