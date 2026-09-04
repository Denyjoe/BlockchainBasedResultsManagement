<div align="center">
  <h1>🎓 CertifyChain</h1>
  <p><strong>Blockchain-Based Student Result Verification System</strong></p>
  
  <p>
    <img src="https://img.shields.io/badge/Ethereum-3C3C3D?style=for-the-badge&logo=Ethereum&logoColor=white" alt="Ethereum" />
    <img src="https://img.shields.io/badge/Solidity-%23363636.svg?style=for-the-badge&logo=solidity&logoColor=white" alt="Solidity" />
    <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  </p>
</div>

---

## 📌 Overview

**CertifyChain** is a full-stack decentralized web application designed to issue and cryptographically verify student report cards. The system hashes the student's report card data (registration number, subjects, and alphabetically sorted marks) and immutably registers the hash on the Ethereum blockchain.

When verification is needed (by recruiters, registrars, etc.), the provided `.docx` report card can be uploaded to the portal. The system extracts the grades, recalculates the cryptographic hash, and verifies it against the blockchain record. Any tampering or alteration of data instantly triggers a **Data Tampered** warning, displaying the exact discrepancies.

## 🛠️ Technical Stack

- **Smart Contracts:** Solidity (`^0.8.24`), deployed and tested via **Hardhat**.
- **Local Blockchain:** **Ganache** (Port 7545, Chain ID 1337).
- **Web3 Wallet Client:** **MetaMask** with **Ethers.js v6**.
- **Frontend Dashboard:** **React** + **Vite** + **Tailwind CSS**.
- **Document Processing:** 
  - `docx`: For generating downloadable Word files.
  - `mammoth`: For parsing and extracting data from Word files during verification.

## 📂 Project Structure

```text
StudentResult/
├── contracts/          # Solidity smart contracts (ResultManager.sol)
├── scripts/            # Deployment scripts
├── test/               # Smart contract unit tests
├── frontend/           # React frontend application
│   ├── src/
│   │   ├── components/ # Reusable UI components
│   │   ├── context/    # Web3 / Wallet connection management
│   │   ├── pages/      # Application views
│   │   ├── utils/      # Hashing and processing utilities
│   │   └── contracts/  # Deployed contract ABI & address
```

## 🚀 Installation & Setup

### 1. Clone & Install Dependencies
Install the root (smart contract) dependencies:
```bash
git clone https://github.com/Denyjoe/BlockchainBasedResultsManagement.git
cd BlockchainBasedResultsManagement
npm install
```

Install frontend dependencies:
```bash
cd frontend
npm install
```

### 2. Configure Local Blockchain
Start **Ganache** on port `7545` (Chain ID `1337`):
```bash
ganache --port 7545 --chain.chainId 1337
```
*(For Ganache UI, set the RPC server to `7545` and Network ID to `1337`).*

### 3. Setup MetaMask
Add the local network to your MetaMask wallet:
- **Network Name:** Ganache Local
- **RPC URL:** `http://127.0.0.1:7545`
- **Chain ID:** `1337`
- **Currency Symbol:** ETH

Import the **first account** from Ganache (the deployer/owner) into MetaMask.

### 4. Deploy Smart Contracts
From the root directory, deploy the contract to the local network:
```bash
npx hardhat run scripts/deploy.js --network ganache
```

### 5. Run the Application
Start the frontend development server:
```bash
cd frontend
npm run dev
```
Navigate to `http://localhost:5173/` to view the application.

## ✅ Verification & Testing

To run the smart contract unit tests:
```bash
npx hardhat test
```

## 📖 Usage Guide

1. **Connect Wallet:** Link MetaMask using the contract deployer account.
2. **Issue Results:** Navigate to the **Lecturer Portal**, input student details and marks, and click **Issue & Download**. The transaction is recorded on the blockchain and a `.docx` file is downloaded.
3. **Verify Integrity:** Navigate to the **Verify Result** tab. Upload the generated `.docx` file. The system will parse it and confirm authenticity against the blockchain.
4. **Detect Tampering:** Modify the `.docx` file locally and upload it again. The system will instantly detect the mismatch and highlight the altered fields.

---
<div align="center">
  <i>Developed with focus on security, transparency, and data integrity.</i>
</div>
