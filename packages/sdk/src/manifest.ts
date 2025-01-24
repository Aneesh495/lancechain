import { DeploymentManifest } from "./types.js";
import { ethers } from "ethers";

export class ManifestVerificationError extends Error {
  constructor(message: string) {
    super(`Deployment manifest verification failed: ${message}`);
    this.name = "ManifestVerificationError";
  }
}

export async function verifyDeploymentManifest(
  manifest: DeploymentManifest,
  provider: ethers.Provider
): Promise<void> {
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== manifest.chainId) {
    throw new ManifestVerificationError(
      `Chain ID mismatch. Expected ${manifest.chainId} but connected to ${network.chainId}`
    );
  }

  // Verify escrow contract bytecode
  const escrowCode = await provider.getCode(manifest.escrowAddress);
  if (!escrowCode || escrowCode === "0x") {
    throw new ManifestVerificationError(
      `No bytecode found at escrow address ${manifest.escrowAddress}`
    );
  }
  const escrowBytecodeHash = ethers.keccak256(escrowCode);
  if (
    manifest.escrowBytecodeHash &&
    escrowBytecodeHash.toLowerCase() !== manifest.escrowBytecodeHash.toLowerCase()
  ) {
    throw new ManifestVerificationError(
      `Escrow bytecode hash mismatch at ${manifest.escrowAddress}. Expected ${manifest.escrowBytecodeHash} but found ${escrowBytecodeHash}`
    );
  }

  // Verify reputation contract bytecode
  const repCode = await provider.getCode(manifest.reputationAddress);
  if (!repCode || repCode === "0x") {
    throw new ManifestVerificationError(
      `No bytecode found at reputation address ${manifest.reputationAddress}`
    );
  }
  const repBytecodeHash = ethers.keccak256(repCode);
  if (
    manifest.reputationBytecodeHash &&
    repBytecodeHash.toLowerCase() !== manifest.reputationBytecodeHash.toLowerCase()
  ) {
    throw new ManifestVerificationError(
      `Reputation bytecode hash mismatch at ${manifest.reputationAddress}. Expected ${manifest.reputationBytecodeHash} but found ${repBytecodeHash}`
    );
  }
}
