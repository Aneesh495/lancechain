import { ethers } from "ethers";
import { LancechainError } from "../errors/LancechainErrors.js";
import { LancechainEscrowAbi } from "../abi/LancechainEscrowAbi.js";

export interface SimulationResult {
  success: boolean;
  estimatedGas: bigint;
  returnRawData?: string;
  decodedRevertReason?: string;
  revertError?: LancechainError;
}

export class SimulationEngine {
  private provider: ethers.Provider;
  private escrowAddress: string;
  private iface: ethers.Interface;

  constructor(provider: ethers.Provider, escrowAddress: string) {
    this.provider = provider;
    this.escrowAddress = escrowAddress;
    this.iface = new ethers.Interface(LancechainEscrowAbi as unknown as ethers.InterfaceAbi);
  }

  public async simulateCall(
    from: string,
    functionName: string,
    args: unknown[]
  ): Promise<SimulationResult> {
    try {
      const data = this.iface.encodeFunctionData(functionName, args);
      const tx = {
        from,
        to: this.escrowAddress,
        data,
      };

      const [returnData, estimatedGas] = await Promise.all([
        this.provider.call(tx),
        this.provider.estimateGas(tx).catch(() => 250000n),
      ]);

      return {
        success: true,
        estimatedGas,
        returnRawData: returnData,
      };
    } catch (err: unknown) {
      const revertReason = this.parseRevertReason(err);
      return {
        success: false,
        estimatedGas: 0n,
        decodedRevertReason: revertReason,
        revertError: new LancechainError(
          "SIMULATION_REVERT",
          `Simulation reverted: ${revertReason}`,
          { from, functionName, args, originalError: err }
        ),
      };
    }
  }

  public async simulateAcceptMilestone(
    from: string,
    projectId: string,
    milestoneIndex: number
  ): Promise<SimulationResult> {
    return this.simulateCall(from, "acceptMilestone", [projectId, milestoneIndex]);
  }

  public async simulateSubmitDeliverable(
    from: string,
    projectId: string,
    milestoneIndex: number,
    deliverableHash: string
  ): Promise<SimulationResult> {
    return this.simulateCall(from, "submitDeliverable", [projectId, milestoneIndex, deliverableHash]);
  }

  public async simulateWithdraw(from: string, token: string, recipient: string): Promise<SimulationResult> {
    return this.simulateCall(from, "withdraw", [token, recipient]);
  }

  private parseRevertReason(err: unknown): string {
    if (!err || typeof err !== "object") return "Unknown revert";

    const errorObj = err as Record<string, unknown>;

    if (typeof errorObj.reason === "string") {
      return errorObj.reason;
    }

    if (typeof errorObj.data === "string") {
      try {
        const decoded = this.iface.parseError(errorObj.data);
        if (decoded) {
          return `${decoded.name}(${decoded.args.join(", ")})`;
        }
      } catch {
        // Raw hex fallback
      }
      return errorObj.data;
    }

    if (errorObj.info && typeof errorObj.info === "object") {
      const info = errorObj.info as Record<string, unknown>;
      if (typeof info.error === "object" && info.error !== null) {
        const nested = info.error as Record<string, unknown>;
        if (typeof nested.message === "string") return nested.message;
      }
    }

    if (typeof errorObj.message === "string") {
      return errorObj.message;
    }

    return "Transaction reverted without reason";
  }
}
