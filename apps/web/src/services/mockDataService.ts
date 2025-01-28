import {
  AgreementRecord,
  AgreementStatus,
  MilestoneStatus,
  ReputationProfile,
  AuditEvent,
  ReconciliationReport,
  WithdrawalBalance,
  WalletAccount,
  TokenInfo,
} from '../types';

export const SUPPORTED_TOKENS: TokenInfo[] = [
  {
    address: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    symbol: 'USDC',
    name: 'USD Coin Mock',
    decimals: 6,
  },
  {
    address: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    symbol: 'USDT',
    name: 'Tether USD Mock',
    decimals: 6,
  },
  {
    address: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    symbol: 'WETH',
    name: 'Wrapped Ether Mock',
    decimals: 18,
  },
];

export const DEMO_ACCOUNTS: WalletAccount[] = [
  {
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    label: 'Alice (Client)',
    role: 'client',
    privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
    balanceEth: '10000.00',
  },
  {
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    label: 'Bob (Freelancer)',
    role: 'freelancer',
    privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
    balanceEth: '10000.00',
  },
  {
    address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    label: 'Clara (Arbitrator)',
    role: 'arbitrator',
    privateKey: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
    balanceEth: '10000.00',
  },
  {
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    label: 'Protocol Deployer (Admin)',
    role: 'admin',
    privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    balanceEth: '10000.00',
  },
];

export const MOCK_AGREEMENTS: AgreementRecord[] = [
  {
    agreementId: '0x4f8a3c9b7e12d4a58602b9e4a1c5d7f2b8e3a9c7d1e5f8a2b4c6e9d1a3b5c7e9',
    client: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    freelancer: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    arbitrator: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    token: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    tokenSymbol: 'USDC',
    tokenDecimals: 6,
    status: AgreementStatus.ACTIVE,
    totalCommitted: '5000000000', // 5000 USDC
    totalFunded: '3000000000', // 3000 USDC funded
    totalPaidOut: '1500000000', // 1500 USDC paid
    totalDisputed: '0',
    termsHash: '0x8a9b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6',
    termsUri: 'ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
    arbitrationFeeBps: 250, // 2.5%
    createdAt: Date.now() - 86400000 * 14,
    updatedAt: Date.now() - 86400000 * 2,
    milestones: [
      {
        milestoneId: 0,
        agreementId: '0x4f8a3c9b7e12d4a58602b9e4a1c5d7f2b8e3a9c7d1e5f8a2b4c6e9d1a3b5c7e9',
        description: 'Architecture specification and formal invariant models',
        amount: '1500000000', // 1500 USDC
        deadline: Math.floor((Date.now() - 86400000 * 7) / 1000),
        status: MilestoneStatus.APPROVED,
        deliverableHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        submissionTime: Math.floor((Date.now() - 86400000 * 8) / 1000),
        fundedAt: Date.now() - 86400000 * 13,
        approvedAt: Date.now() - 86400000 * 7,
        deliverable: {
          agreementId: '0x4f8a3c9b7e12d4a58602b9e4a1c5d7f2b8e3a9c7d1e5f8a2b4c6e9d1a3b5c7e9',
          milestoneId: 0,
          title: 'Formal Specification & TLA+ Invariant Check',
          description: 'Delivered full formal specification, invariant proofs, and TLA+ model checks.',
          repositoryCommitUrl: 'https://github.com/lancechain/protocol/commit/9f8e7d6c',
          demoUrl: 'https://spec.lancechain.network',
          artifactHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          submittedAt: Date.now() - 86400000 * 8,
          submittedBy: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        },
      },
      {
        milestoneId: 1,
        agreementId: '0x4f8a3c9b7e12d4a58602b9e4a1c5d7f2b8e3a9c7d1e5f8a2b4c6e9d1a3b5c7e9',
        description: 'Core Solidity contracts and differential fuzzing harness',
        amount: '1500000000', // 1500 USDC
        deadline: Math.floor((Date.now() + 86400000 * 5) / 1000),
        status: MilestoneStatus.SUBMITTED,
        deliverableHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        submissionTime: Math.floor((Date.now() - 3600000 * 6) / 1000),
        fundedAt: Date.now() - 86400000 * 6,
        deliverable: {
          agreementId: '0x4f8a3c9b7e12d4a58602b9e4a1c5d7f2b8e3a9c7d1e5f8a2b4c6e9d1a3b5c7e9',
          milestoneId: 1,
          title: 'LancechainEscrow.sol and Foundry Invariant Tests',
          description: 'Completed protocol implementation with 100% test coverage and invariant verification.',
          repositoryCommitUrl: 'https://github.com/lancechain/protocol/commit/74cc128',
          artifactHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          submittedAt: Date.now() - 3600000 * 6,
          submittedBy: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        },
      },
      {
        milestoneId: 2,
        description: 'Production frontend, typed SDK, and documentation',
        agreementId: '0x4f8a3c9b7e12d4a58602b9e4a1c5d7f2b8e3a9c7d1e5f8a2b4c6e9d1a3b5c7e9',
        amount: '2000000000', // 2000 USDC
        deadline: Math.floor((Date.now() + 86400000 * 20) / 1000),
        status: MilestoneStatus.DRAFT,
      },
    ],
  },
  {
    agreementId: '0x1c2b3a4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f901a2b3c4d5e6f7a8b9c0d1e2f3a',
    client: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    freelancer: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    arbitrator: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    token: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    tokenSymbol: 'USDC',
    tokenDecimals: 6,
    status: AgreementStatus.DISPUTED,
    totalCommitted: '2500000000', // 2500 USDC
    totalFunded: '2500000000',
    totalPaidOut: '0',
    totalDisputed: '2500000000',
    termsHash: '0x7e8f901a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f901a2b3c4d5e6f7a8b9c0d',
    termsUri: 'ipfs://bafybeihdrewqmcvbvcxzrewqasdfghjklpoiuytrewq',
    arbitrationFeeBps: 300,
    createdAt: Date.now() - 86400000 * 10,
    updatedAt: Date.now() - 86400000 * 1,
    milestones: [
      {
        milestoneId: 0,
        agreementId: '0x1c2b3a4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f901a2b3c4d5e6f7a8b9c0d1e2f3a',
        description: 'Zero Knowledge rollup circuit proof synthesis',
        amount: '2500000000',
        deadline: Math.floor((Date.now() - 86400000 * 2) / 1000),
        status: MilestoneStatus.DISPUTED,
        fundedAt: Date.now() - 86400000 * 9,
        deliverableHash: '0x99887766554433221100aabbccddeeff99887766554433221100aabbccddeeff',
        submissionTime: Math.floor((Date.now() - 86400000 * 3) / 1000),
        deliverable: {
          agreementId: '0x1c2b3a4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f901a2b3c4d5e6f7a8b9c0d1e2f3a',
          milestoneId: 0,
          title: 'Circom circuits and Groth16 verify benchmarks',
          description: 'Provided initial proof verification circuits.',
          artifactHash: '0x99887766554433221100aabbccddeeff99887766554433221100aabbccddeeff',
          submittedAt: Date.now() - 86400000 * 3,
          submittedBy: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        },
        dispute: {
          disputeId: '0xdisp0001',
          agreementId: '0x1c2b3a4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f901a2b3c4d5e6f7a8b9c0d1e2f3a',
          milestoneId: 0,
          initiator: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
          reason: 'Circuits fail under non-uniform batch verification constraints. Proof generation takes > 120s exceeding 10s agreement SLA.',
          claimCategory: 'quality_defect',
          evidenceUri: 'ipfs://bafybeievidencecircuitbenchmarkfailed',
          status: 'OPEN',
          createdAt: Date.now() - 86400000 * 1,
          clientAward: '2000000000',
          freelancerAward: '500000000',
        },
      },
    ],
  },
  {
    agreementId: '0x9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b',
    client: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    freelancer: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    arbitrator: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    token: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    tokenSymbol: 'WETH',
    tokenDecimals: 18,
    status: AgreementStatus.COMPLETED,
    totalCommitted: '2000000000000000000', // 2 WETH
    totalFunded: '2000000000000000000',
    totalPaidOut: '2000000000000000000',
    totalDisputed: '0',
    termsHash: '0x2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f901a2b3c4d5e6f7a8b9c0d1e2f3a4b',
    termsUri: 'ipfs://bafybeicompletedcontracthash123',
    arbitrationFeeBps: 200,
    createdAt: Date.now() - 86400000 * 30,
    updatedAt: Date.now() - 86400000 * 15,
    milestones: [
      {
        milestoneId: 0,
        agreementId: '0x9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b',
        description: 'Complete cross-chain bridge security audit report',
        amount: '2000000000000000000',
        deadline: Math.floor((Date.now() - 86400000 * 16) / 1000),
        status: MilestoneStatus.APPROVED,
        fundedAt: Date.now() - 86400000 * 29,
        approvedAt: Date.now() - 86400000 * 15,
      },
    ],
  },
];

export const MOCK_REPUTATION: Record<string, ReputationProfile> = {
  '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC': {
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    score: 968,
    tier: 'Platinum',
    totalProjectsCompleted: 24,
    totalVolumeHandled: '184500000000', // 184,500 USDC
    totalDisputesInvolved: 1,
    disputesWon: 1,
    disputesLost: 0,
    disputeRateBps: 41, // 0.41%
    averageCompletionTimeSeconds: 432000, // 5 days
    history: [
      {
        agreementId: '0x9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b',
        action: 'Milestone Approved',
        delta: 25,
        timestamp: Date.now() - 86400000 * 15,
        details: 'Audit report delivered 3 days ahead of deadline.',
      },
      {
        agreementId: '0x4f8a3c9b7e12d4a58602b9e4a1c5d7f2b8e3a9c7d1e5f8a2b4c6e9d1a3b5c7e9',
        action: 'Milestone Approved',
        delta: 15,
        timestamp: Date.now() - 86400000 * 7,
        details: 'Formal invariant specification approved with zero revisions.',
      },
    ],
  },
  '0x70997970C51812dc3A010C7d01b50e0d17dc79C8': {
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    score: 980,
    tier: 'Platinum',
    totalProjectsCompleted: 19,
    totalVolumeHandled: '240000000000',
    totalDisputesInvolved: 1,
    disputesWon: 1,
    disputesLost: 0,
    disputeRateBps: 52,
    averageCompletionTimeSeconds: 259200,
    history: [
      {
        agreementId: '0x9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b',
        action: 'Prompt Payout Approval',
        delta: 10,
        timestamp: Date.now() - 86400000 * 15,
        details: 'Approved deliverable within 2 hours of submission.',
      },
    ],
  },
};

export const MOCK_WITHDRAWALS: Record<string, WithdrawalBalance[]> = {
  '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC': [
    {
      token: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      tokenSymbol: 'USDC',
      tokenDecimals: 6,
      availableAmount: '1485000000', // 1,485 USDC (1,500 minus 1% protocol fee)
      withdrawnAmount: '35000000000',
    },
    {
      token: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
      tokenSymbol: 'WETH',
      tokenDecimals: 18,
      availableAmount: '1980000000000000000', // 1.98 WETH
      withdrawnAmount: '8000000000000000000',
    },
  ],
  '0x70997970C51812dc3A010C7d01b50e0d17dc79C8': [
    {
      token: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      tokenSymbol: 'USDC',
      tokenDecimals: 6,
      availableAmount: '0',
      withdrawnAmount: '12000000000',
    },
  ],
};

export const MOCK_AUDIT_EVENTS: AuditEvent[] = [
  {
    id: 'evt-001',
    blockNumber: 1042301,
    blockHash: '0x1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f809',
    transactionHash: '0xaaa111bbb222ccc333ddd444eee555fff666777888999aaabbbcccdddeeefff0',
    logIndex: 1,
    eventName: 'AgreementCreated',
    agreementId: '0x4f8a3c9b7e12d4a58602b9e4a1c5d7f2b8e3a9c7d1e5f8a2b4c6e9d1a3b5c7e9',
    actor: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    timestamp: Date.now() - 86400000 * 14,
    data: {
      client: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      freelancer: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      milestonesCount: 3,
      totalCommitted: '5000000000',
    },
  },
  {
    id: 'evt-002',
    blockNumber: 1042350,
    blockHash: '0x2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a',
    transactionHash: '0xbbb222ccc333ddd444eee555fff666777888999aaabbbcccdddeeefff000111a',
    logIndex: 0,
    eventName: 'MilestoneFunded',
    agreementId: '0x4f8a3c9b7e12d4a58602b9e4a1c5d7f2b8e3a9c7d1e5f8a2b4c6e9d1a3b5c7e9',
    milestoneId: 0,
    actor: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    amount: '1500000000',
    timestamp: Date.now() - 86400000 * 13,
    data: {
      amount: '1500000000',
    },
  },
  {
    id: 'evt-003',
    blockNumber: 1042600,
    blockHash: '0x3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a2b',
    transactionHash: '0xccc333ddd444eee555fff666777888999aaabbbcccdddeeefff000111222bbb',
    logIndex: 2,
    eventName: 'DeliverableSubmitted',
    agreementId: '0x4f8a3c9b7e12d4a58602b9e4a1c5d7f2b8e3a9c7d1e5f8a2b4c6e9d1a3b5c7e9',
    milestoneId: 0,
    actor: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    timestamp: Date.now() - 86400000 * 8,
    data: {
      artifactHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    },
  },
  {
    id: 'evt-004',
    blockNumber: 1042710,
    blockHash: '0x4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c',
    transactionHash: '0xddd444eee555fff666777888999aaabbbcccdddeeefff000111222333ccc',
    logIndex: 0,
    eventName: 'MilestoneApproved',
    agreementId: '0x4f8a3c9b7e12d4a58602b9e4a1c5d7f2b8e3a9c7d1e5f8a2b4c6e9d1a3b5c7e9',
    milestoneId: 0,
    actor: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    amount: '1500000000',
    timestamp: Date.now() - 86400000 * 7,
    data: {
      freelancerNet: '1485000000',
      protocolFee: '15000000',
    },
  },
  {
    id: 'evt-005',
    blockNumber: 1043005,
    blockHash: '0x5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d',
    transactionHash: '0xeee555fff666777888999aaabbbcccdddeeefff000111222333444ddd',
    logIndex: 1,
    eventName: 'DisputeOpened',
    agreementId: '0x1c2b3a4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f901a2b3c4d5e6f7a8b9c0d1e2f3a',
    milestoneId: 0,
    actor: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    timestamp: Date.now() - 86400000 * 1,
    data: {
      initiator: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      reason: 'Circuits fail under non-uniform batch verification constraints.',
    },
  },
];

export const MOCK_RECONCILIATION: ReconciliationReport = {
  timestamp: new Date().toISOString(),
  contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  blockNumber: 1043250,
  allInvariantsPassed: true,
  tokensAudited: [
    {
      tokenAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      tokenSymbol: 'USDC',
      contractBalance: '5500000000', // 5,500 USDC
      activeEscrowLiabilities: '4000000000', // 1,500 (Aggr 1 M1) + 2,500 (Aggr 2 M0)
      unclaimedWithdrawalBalances: '1485000000', // 1,485 USDC for Bob
      accumulatedProtocolFees: '15000000', // 15 USDC
      totalContractObligations: '5500000000',
      surplusOrDeficit: '0',
      invariantSatisfied: true,
    },
    {
      tokenAddress: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
      tokenSymbol: 'WETH',
      contractBalance: '2000000000000000000', // 2 WETH
      activeEscrowLiabilities: '0',
      unclaimedWithdrawalBalances: '1980000000000000000', // 1.98 WETH
      accumulatedProtocolFees: '20000000000000000', // 0.02 WETH
      totalContractObligations: '2000000000000000000',
      surplusOrDeficit: '0',
      invariantSatisfied: true,
    },
  ],
  checks: {
    exactSumConservation: true,
    pullLedgerSolvency: true,
    reorgConsistency: true,
    unclaimedBalanceSafety: true,
  },
};
