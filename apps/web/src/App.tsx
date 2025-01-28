import React, { useState } from 'react';
import { WalletProvider } from './context/WalletContext';
import { LancechainProvider, useLancechain } from './context/LancechainContext';
import { AgreementRecord } from './types';
import { Header } from './components/layout/Header';
import { Navigation } from './components/layout/Navigation';
import { NotificationToastContainer } from './components/layout/NotificationToast';
import { ProjectExplorer } from './components/projects/ProjectExplorer';
import { ProjectDetail } from './components/projects/ProjectDetail';
import { DeliverablesView } from './components/deliverables/DeliverablesView';
import { DisputeRoom } from './components/disputes/DisputeRoom';
import { WithdrawalDashboard } from './components/withdrawals/WithdrawalDashboard';
import { ReputationExplorer } from './components/reputation/ReputationExplorer';
import { FinancialReconciliationPanel } from './components/reconciliation/FinancialReconciliationPanel';
import { ChainAuditLog } from './components/audit/ChainAuditLog';
import { AgreementBuilder } from './components/agreements/AgreementBuilder';
import { Modal } from './components/common/Modal';

const MainContent: React.FC = () => {
  const { projects } = useLancechain();
  const [activeTab, setActiveTab] = useState<string>('projects');
  const [selectedProject, setSelectedProject] = useState<AgreementRecord | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const handleSelectProjectById = (agreementId: string) => {
    const proj = projects.find((p) => p.agreementId.toLowerCase() === agreementId.toLowerCase());
    if (proj) {
      setSelectedProject(proj);
      setActiveTab('projects');
    }
  };

  const handleCreateSuccess = (newAgreementId: string) => {
    setIsCreateModalOpen(false);
    const newProj = projects.find((p) => p.agreementId === newAgreementId);
    if (newProj) {
      setSelectedProject(newProj);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        openCreateModal={() => setIsCreateModalOpen(true)}
      />

      <Navigation
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setSelectedProject(null);
        }}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {selectedProject ? (
          <ProjectDetail
            project={selectedProject}
            onBack={() => setSelectedProject(null)}
          />
        ) : (
          <>
            {activeTab === 'projects' && (
              <ProjectExplorer
                onSelectProject={(p) => setSelectedProject(p)}
                openCreateModal={() => setIsCreateModalOpen(true)}
              />
            )}
            {activeTab === 'deliverables' && (
              <DeliverablesView onSelectProjectById={handleSelectProjectById} />
            )}
            {activeTab === 'disputes' && <DisputeRoom />}
            {activeTab === 'withdrawals' && <WithdrawalDashboard />}
            {activeTab === 'reputation' && <ReputationExplorer />}
            {activeTab === 'reconciliation' && <FinancialReconciliationPanel />}
            {activeTab === 'audit' && <ChainAuditLog />}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/60 py-6 text-xs font-mono text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-slate-300 font-semibold">Lancechain Escrow Engine</span>
            <span>• Solvency & Invariant Proof Verified</span>
          </div>

          <div className="flex items-center gap-4 text-slate-500">
            <span>EIP-712</span>
            <span>•</span>
            <span>EIP-1271</span>
            <span>•</span>
            <span>Reorg Journal Depth 128</span>
            <span>•</span>
            <span>Chain ID 31337</span>
          </div>
        </div>
      </footer>

      {/* New Agreement Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Author Milestone Escrow Agreement"
        subtitle="Configure structured milestones, counterparties, and cryptographic terms"
        maxWidth="2xl"
      >
        <AgreementBuilder
          onSuccess={handleCreateSuccess}
          onCancel={() => setIsCreateModalOpen(false)}
        />
      </Modal>

      <NotificationToastContainer />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <WalletProvider>
      <LancechainProvider>
        <MainContent />
      </LancechainProvider>
    </WalletProvider>
  );
};

export default App;
