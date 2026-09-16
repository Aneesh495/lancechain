import React, { useCallback, useMemo, useState } from "react";
import { ethers } from "ethers";

const RPC_URL = process.env.REACT_APP_RPC_URL || "http://127.0.0.1:8545";
const DAO_ADDRESS = process.env.REACT_APP_FREELANCE_DAO_ADDRESS || "";

const FREELANCE_DAO_ABI = [
  "function createProject(address freelancer) payable",
  "function markAsCompleted(uint256 projectId)",
  "function confirmCompletion(uint256 projectId)",
  "function raiseDispute(uint256 projectId)",
  "function nextProjectId() view returns (uint256)",
  "function projects(uint256) view returns (uint256 id, address client, address freelancer, uint256 amount, bool isCompleted, bool isDisputed)",
];

export default function App() {
  const [account, setAccount] = useState("");
  const [freelancer, setFreelancer] = useState("");
  const [amountEth, setAmountEth] = useState("0.01");
  const [projectId, setProjectId] = useState("0");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const provider = useMemo(
    () => new ethers.JsonRpcProvider(RPC_URL),
    []
  );

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setStatus("No injected wallet found. Use MetaMask or a local Hardhat node.");
      return;
    }
    const browser = new ethers.BrowserProvider(window.ethereum);
    const accounts = await browser.send("eth_requestAccounts", []);
    setAccount(accounts[0] || "");
    setStatus(accounts[0] ? `Connected ${accounts[0].slice(0, 10)}…` : "No account");
  }, []);

  const withSigner = useCallback(async () => {
    if (!DAO_ADDRESS) throw new Error("Set REACT_APP_FREELANCE_DAO_ADDRESS");
    if (!window.ethereum) throw new Error("Injected wallet required for writes");
    const browser = new ethers.BrowserProvider(window.ethereum);
    const signer = await browser.getSigner();
    return new ethers.Contract(DAO_ADDRESS, FREELANCE_DAO_ABI, signer);
  }, []);

  const run = useCallback(
    async (fn) => {
      setBusy(true);
      try {
        await fn();
      } catch (err) {
        setStatus(err?.shortMessage || err?.message || String(err));
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const createProject = () =>
    run(async () => {
      const dao = await withSigner();
      const tx = await dao.createProject(freelancer, {
        value: ethers.parseEther(amountEth || "0"),
      });
      await tx.wait();
      const next = await dao.nextProjectId();
      setStatus(`Project created. nextProjectId=${next.toString()}`);
    });

  const markComplete = () =>
    run(async () => {
      const dao = await withSigner();
      const tx = await dao.markAsCompleted(BigInt(projectId));
      await tx.wait();
      setStatus(`Marked project ${projectId} complete`);
    });

  const confirm = () =>
    run(async () => {
      const dao = await withSigner();
      const tx = await dao.confirmCompletion(BigInt(projectId));
      await tx.wait();
      setStatus(`Released escrow for project ${projectId}`);
    });

  const loadProject = () =>
    run(async () => {
      if (!DAO_ADDRESS) throw new Error("Set REACT_APP_FREELANCE_DAO_ADDRESS");
      const dao = new ethers.Contract(DAO_ADDRESS, FREELANCE_DAO_ABI, provider);
      const p = await dao.projects(BigInt(projectId));
      setStatus(
        `id=${p.id} client=${p.client} freelancer=${p.freelancer} amount=${ethers.formatEther(p.amount)} ETH completed=${p.isCompleted} disputed=${p.isDisputed}`
      );
    });

  return (
    <main style={{ maxWidth: 720, margin: "3rem auto", padding: "0 1.25rem", fontFamily: "ui-sans-serif, system-ui, sans-serif", color: "#0f172a" }}>
      <header style={{ marginBottom: "2rem" }}>
        <p style={{ letterSpacing: "0.12em", textTransform: "uppercase", fontSize: 12, color: "#64748b", margin: 0 }}>Lancechain</p>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 600, margin: "0.35rem 0" }}>Escrow marketplace console</h1>
        <p style={{ color: "#475569", lineHeight: 1.5, margin: 0 }}>
          Connect a wallet, fund a project against <code>FreelanceDAO</code>, and drive the escrow lifecycle.
          Point <code>REACT_APP_*</code> at a local Hardhat deployment.
        </p>
      </header>

      <section style={{ display: "grid", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <button type="button" disabled={busy} onClick={connect} style={btn}>
          {account ? `Wallet ${account.slice(0, 6)}…${account.slice(-4)}` : "Connect wallet"}
        </button>
        <label style={label}>
          Freelancer address
          <input value={freelancer} onChange={(e) => setFreelancer(e.target.value)} placeholder="0x…" style={input} />
        </label>
        <label style={label}>
          Escrow (ETH)
          <input value={amountEth} onChange={(e) => setAmountEth(e.target.value)} style={input} />
        </label>
        <button type="button" disabled={busy || !freelancer} onClick={createProject} style={btn}>
          Create project
        </button>
      </section>

      <section style={{ display: "grid", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <label style={label}>
          Project id
          <input value={projectId} onChange={(e) => setProjectId(e.target.value)} style={input} />
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <button type="button" disabled={busy} onClick={loadProject} style={btnSecondary}>Read</button>
          <button type="button" disabled={busy} onClick={markComplete} style={btnSecondary}>Mark complete</button>
          <button type="button" disabled={busy} onClick={confirm} style={btnSecondary}>Confirm &amp; release</button>
        </div>
      </section>

      <pre style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "1rem", whiteSpace: "pre-wrap", fontSize: 13, color: "#334155", minHeight: 72 }}>
        {status || "Ready."}
      </pre>
    </main>
  );
}

const btn = {
  appearance: "none",
  border: "none",
  background: "#0f172a",
  color: "#f8fafc",
  padding: "0.65rem 1rem",
  borderRadius: 8,
  fontWeight: 500,
  cursor: "pointer",
};

const btnSecondary = {
  ...btn,
  background: "#1e293b",
};

const label = { display: "grid", gap: 6, fontSize: 13, color: "#334155" };
const input = {
  padding: "0.55rem 0.7rem",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  fontSize: 14,
};
