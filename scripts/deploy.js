import pkg from "hardhat";
const { ethers } = pkg;
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contract with the account:", deployer.address);

  // Get factory
  const ResultManager = await ethers.getContractFactory("ResultManager");
  
  // Deploy the contract with deployer as initial owner
  const resultManager = await ResultManager.deploy(deployer.address);
  await resultManager.waitForDeployment();

  const contractAddress = await resultManager.getAddress();
  console.log("ResultManager deployed to:", contractAddress);

  // Whitelist the deployer as a lecturer by default so they can test uploads immediately
  const whitelistTx = await resultManager.addLecturer(deployer.address);
  await whitelistTx.wait();
  console.log("Whitelisted deployer as lecturer:", deployer.address);

  // Define frontend contracts directory
  const frontendContractsDir = path.join(__dirname, "..", "frontend", "src", "contracts");
  
  // Create if it doesn't exist
  if (!fs.existsSync(frontendContractsDir)) {
    fs.mkdirSync(frontendContractsDir, { recursive: true });
  }

  // Load the compiler artifact
  const artifactPath = path.join(__dirname, "..", "artifacts", "contracts", "ResultManager.sol", "ResultManager.json");
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Artifact not found at ${artifactPath}. Please run: npx hardhat compile`);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  // Write contract address and ABI to frontend/src/contracts/contractData.json
  const data = {
    address: contractAddress,
    abi: artifact.abi
  };

  fs.writeFileSync(
    path.join(frontendContractsDir, "contractData.json"),
    JSON.stringify(data, null, 2)
  );

  console.log(`Saved contract address (${contractAddress}) and ABI to frontend/src/contracts/contractData.json`);
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
