import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Layers, Scan, UploadCloud, ChevronRight, Loader2, FileText, CheckCircle2, AlertCircle, Settings, Clock, Home, Shield, Share2, Lock, GitMerge } from 'lucide-react';
import { ApiService } from './services/api';
import { AnalysisType, LoadingState, FederatedResult, FullInferenceResult, GradCamResult, BatchResult, AppSettings, HistoryRecord } from './types';
import { Button, Card, FileUpload, Badge, Modal } from './components/ui/DesignSystem';
import { PredictionResults, FullInferenceView, SettingsPanel, HistoryList, BatchResultsView, GradCamResultsView } from './components/ResultsView';
import { GradCamViewer } from './components/GradCamViewer';
import { AmbientBackground } from './components/ui/AmbientBackground';

// --- Default State ---

const DEFAULT_SETTINGS: AppSettings = {
    activeModels: {
        hospital_a: true,
        hospital_b: true,
        hospital_c: true,
        global_fedavg: true,
        global_distilled: true
    },
    privacyBudget: 0.8,
    useLocalPrivacy: true
};

// --- Helper Functions ---

const generateId = () => {
    // Robust environment-agnostic ID generator
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};

// --- Components ---

const Navbar: React.FC<{ onReset: () => void }> = ({ onReset }) => (
  <nav className="fixed top-0 left-0 right-0 z-50 bg-black/50 backdrop-blur-xl border-b border-white/5">
    <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
      <Link to="/" onClick={onReset} className="flex items-center gap-2 group cursor-pointer">
        <span className="font-bold text-xl tracking-tight flex items-center text-white transition-opacity group-hover:opacity-90">
          Patho
          <motion.span 
            className="text-2xl -ml-0.5 bg-clip-text text-transparent bg-gradient-to-tr from-lime-400 via-emerald-500 to-teal-500 pr-2"
            animate={{ opacity: [0.8, 1, 0.8] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ 
                textShadow: '0 0 20px rgba(16,185,129,0.4)',
                filter: 'drop-shadow(0 0 2px rgba(16,185,129,0.5))'
            }}
          >
            +
          </motion.span>
        </span>
      </Link>
      <div className="flex gap-8 text-base font-medium text-zinc-400">
        <Link to="/" onClick={onReset} className="hover:text-white transition-colors flex items-center gap-2"><Home size={18}/> Dashboard</Link>
        <Link to="/history" className="hover:text-white transition-colors flex items-center gap-2"><Clock size={18}/> History</Link>
        <Link to="/settings" className="hover:text-white transition-colors flex items-center gap-2"><Settings size={18}/> Settings</Link>
      </div>
    </div>
  </nav>
);

const ModeSelector: React.FC<{ selected: AnalysisType, onSelect: (m: AnalysisType) => void }> = ({ selected, onSelect }) => {
    const modes = [
        { id: AnalysisType.PREDICT, label: 'Prediction', icon: Activity, desc: 'Multi-model Classification' },
        { id: AnalysisType.GRADCAM, label: 'Grad-CAM', icon: Scan, desc: 'Heatmap Visualization' },
        { id: AnalysisType.FULL, label: 'Full Inference', icon: Layers, desc: 'Classify + Explain' },
        { id: AnalysisType.BATCH, label: 'Batch Process', icon: UploadCloud, desc: 'ZIP Archive Analysis' },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {modes.map((mode) => (
                <button
                    key={mode.id}
                    onClick={() => onSelect(mode.id)}
                    className={`relative p-6 rounded-2xl text-left border transition-all duration-300 group overflow-hidden ${
                        selected === mode.id 
                        ? 'bg-zinc-900/80 border-white/20 shadow-[0_0_30px_rgba(16,185,129,0.1)]' 
                        : 'bg-black/50 border-zinc-900 hover:border-zinc-800 hover:bg-zinc-900/30'
                    }`}
                >
                    <div className={`absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 transition-opacity duration-500 ${selected === mode.id ? 'opacity-100' : 'group-hover:opacity-100'}`} />
                    <mode.icon className={`w-8 h-8 mb-4 transition-colors ${selected === mode.id ? 'text-emerald-400' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
                    <h3 className={`text-lg font-semibold transition-colors ${selected === mode.id ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-200'}`}>{mode.label}</h3>
                    <p className="text-sm text-zinc-600 mt-2 leading-relaxed">{mode.desc}</p>
                </button>
            ))}
        </div>
    );
};

// --- Page Components ---

const Dashboard: React.FC<{ 
    settings: AppSettings, 
    onUpdateSettings: (s: AppSettings) => void,
    onSaveHistory: (rec: HistoryRecord) => void 
}> = ({ settings, onUpdateSettings, onSaveHistory }) => {
  const [mode, setMode] = useState<AnalysisType>(AnalysisType.PREDICT);
  const [loading, setLoading] = useState<LoadingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<any>(null);
  const [activeInfo, setActiveInfo] = useState<'privacy' | 'ensemble' | null>(null);

  const handleUpload = async (file: File) => {
    setLoading('uploading');
    setError(null);
    setResults(null);

    try {
        setLoading('processing');
        let data;
        
        switch (mode) {
            case AnalysisType.PREDICT:
                data = await ApiService.predict(file, settings);
                break;
            case AnalysisType.GRADCAM:
                data = await ApiService.gradcam(file, settings);
                break;
            case AnalysisType.FULL:
                data = await ApiService.fullInference(file, settings);
                break;
            case AnalysisType.BATCH:
                if (!file.name.endsWith('.zip')) throw new Error("Batch mode requires a .zip file");
                data = await ApiService.batchInfer(file, settings);
                break;
        }

        setResults(data);
        onSaveHistory({
            id: generateId(),
            timestamp: Date.now(),
            type: mode,
            filename: file.name,
            result: data
        });
        setLoading('complete');
    } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to process inference.");
        setLoading('error');
    }
  };

  const toggleModel = (key: string) => {
    onUpdateSettings({
        ...settings,
        activeModels: {
            ...settings.activeModels,
            [key]: !settings.activeModels[key]
        }
    });
  };

  const activeModelCount = Object.values(settings.activeModels).filter(Boolean).length;

  const renderContent = () => {
    if (loading === 'processing' || loading === 'uploading') {
        return (
            <div className="h-96 flex flex-col items-center justify-center space-y-8 animate-in fade-in duration-500 backdrop-blur-sm rounded-3xl border border-white/5 bg-zinc-950/30">
                <div className="relative">
                    <div className="w-24 h-24 border-4 border-zinc-800 border-t-emerald-500 rounded-full animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 bg-emerald-500/20 rounded-full blur-xl animate-pulse" />
                    </div>
                </div>
                <div className="text-center space-y-3">
                    <p className="text-white font-medium animate-pulse text-xl">Running Federated Inference</p>
                    <p className="text-zinc-500 text-base">Querying {activeModelCount} active nodes...</p>
                </div>
            </div>
        );
    }

    if (loading === 'error') {
        return (
            <div className="h-96 flex flex-col items-center justify-center space-y-6 text-center backdrop-blur-sm rounded-3xl border border-red-900/20 bg-red-950/5">
                <AlertCircle className="w-16 h-16 text-red-500 mb-2" />
                <h3 className="text-xl font-medium text-white">Inference Failed</h3>
                <p className="text-zinc-500 max-w-md text-base">{error}</p>
                <Button onClick={() => setLoading('idle')} variant="secondary" size="lg">Try Again</Button>
            </div>
        );
    }

    if (loading === 'complete' && results) {
        if (mode === AnalysisType.PREDICT) {
            return <PredictionResults data={results as FederatedResult} onReset={() => setLoading('idle')} />;
        }
        if (mode === AnalysisType.GRADCAM) {
             const gcData = results as GradCamResult;
             return <GradCamResultsView data={gcData} onReset={() => setLoading('idle')} />;
        }
        if (mode === AnalysisType.FULL) {
            return <FullInferenceView data={results as FullInferenceResult} onReset={() => setLoading('idle')} />;
        }
        if (mode === AnalysisType.BATCH) {
            return <BatchResultsView results={results as BatchResult[]} onReset={() => setLoading('idle')} />
        }
    }

    return (
        <div className="relative z-20">
            {/* Hero Section */}
            <header className="mb-16 text-center relative select-none animate-in fade-in slide-in-from-top-10 duration-700">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-emerald-900/10 blur-[120px] rounded-full pointer-events-none" />
                
                <motion.h1 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-7xl md:text-9xl font-bold tracking-tighter flex items-center justify-center relative z-10 py-8"
                >
                    <div className="relative inline-block">
                        <span className="bg-clip-text text-transparent bg-gradient-to-b from-white via-zinc-200 to-zinc-500 relative z-10 pr-6">Patho</span>
                        <motion.span 
                            initial={{ scale: 0.8, opacity: 0, rotate: -10 }}
                            animate={{ 
                                opacity: 1,
                                scale: [1, 1.1, 1],
                                rotate: 0,
                                filter: [
                                    "drop-shadow(0 0 20px rgba(16,185,129,0.2))", 
                                    "drop-shadow(0 0 40px rgba(16,185,129,0.5))", 
                                    "drop-shadow(0 0 20px rgba(16,185,129,0.2))"
                                ]
                            }}
                            whileHover={{ 
                                scale: 1.3, 
                                rotate: 10,
                                filter: "drop-shadow(0 0 50px rgba(16,185,129,0.8))",
                            }}
                            transition={{ 
                                scale: { duration: 0.2 },
                                animate: { duration: 3, repeat: Infinity, ease: "easeInOut" }
                            }}
                            className="cursor-default select-none absolute right-[-0.1em] top-[-0.1em] text-[0.65em] bg-clip-text text-transparent bg-gradient-to-tr from-lime-400 via-emerald-500 to-teal-500 z-20"
                            style={{ 
                                WebkitTextStroke: '1px rgba(255,255,255,0.05)',
                            }}
                        >
                            +
                        </motion.span>
                    </div>
                </motion.h1>
                
                <motion.p 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="text-zinc-400 mt-2 text-xl max-w-2xl mx-auto leading-relaxed"
                >
                    Experience <span className="text-zinc-200 font-medium">Federated Learning</span> for digital pathology. 
                    Analyze specimens across distributed nodes with <span className="text-emerald-500/90 font-semibold">state-of-the-art precision</span>.
                </motion.p>
            </header>

            <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                className="max-w-4xl mx-auto"
            >
                <ModeSelector selected={mode} onSelect={setMode} />

                <div className="flex justify-between items-center mb-6 px-2">
                    <span className="text-lg font-medium text-zinc-300">Analysis Configuration</span>
                    {activeModelCount === 0 && <span className="text-sm text-red-500 animate-pulse">Select at least one active node</span>}
                </div>

                {/* Model Selection UI */}
                <div className="mb-10">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {Object.keys(settings.activeModels).map(key => (
                            <div key={key} 
                                onClick={() => toggleModel(key)}
                                className={`cursor-pointer flex flex-col gap-2 p-4 rounded-2xl border transition-all duration-300 group ${settings.activeModels[key] ? 'bg-zinc-900/60 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.05)]' : 'bg-black/20 border-zinc-900 text-zinc-600 hover:border-zinc-800'}`}
                            >
                                <div className={`w-2 h-2 rounded-full transition-all duration-500 ${settings.activeModels[key] ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,1)]' : 'bg-zinc-800'}`} />
                                <span className={`text-xs font-bold uppercase tracking-widest truncate select-none transition-colors ${settings.activeModels[key] ? 'text-zinc-100' : 'text-zinc-600'}`}>{key.replace(/_/g, ' ')}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {activeModelCount > 0 ? (
                    <FileUpload 
                        onFileSelect={handleUpload} 
                        accept={mode === AnalysisType.BATCH ? ".zip" : "image/*"}
                        label={mode === AnalysisType.BATCH ? "Drop .ZIP archive of slides" : "Drop pathology slide to begin"}
                    />
                ) : (
                    <div className="w-full h-80 rounded-3xl border-2 border-dashed border-zinc-900 bg-zinc-950/20 flex flex-col items-center justify-center text-zinc-600 space-y-4">
                        <AlertCircle className="w-10 h-10 opacity-20" />
                        <p className="text-lg font-medium">Activate a federated node to continue</p>
                    </div>
                )}
                
                <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <motion.div 
                        onClick={() => setActiveInfo('privacy')}
                        whileHover={{ scale: 1.01, borderColor: "rgba(16,185,129,0.2)" }}
                        whileTap={{ scale: 0.99 }}
                        className="cursor-pointer p-6 rounded-2xl bg-zinc-950/40 border border-zinc-900 transition-all backdrop-blur-md group"
                    >
                        <div className="flex items-center justify-between mb-3 text-zinc-300">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 group-hover:border-emerald-500/40 transition-all">
                                    <Shield className="w-5 h-5 text-emerald-500" />
                                </div>
                                <span className="font-semibold text-base group-hover:text-emerald-400 transition-colors">Differential Privacy</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                        </div>
                        <p className="text-sm text-zinc-500 leading-relaxed">Secure aggregation ensures patient anonymity via mathematical noise injection.</p>
                    </motion.div>

                    <motion.div 
                        onClick={() => setActiveInfo('ensemble')}
                        whileHover={{ scale: 1.01, borderColor: "rgba(59,130,246,0.2)" }}
                        whileTap={{ scale: 0.99 }}
                        className="cursor-pointer p-6 rounded-2xl bg-zinc-950/40 border border-zinc-900 transition-all backdrop-blur-md group"
                    >
                        <div className="flex items-center justify-between mb-3 text-zinc-300">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 group-hover:border-blue-500/40 transition-all">
                                    <GitMerge className="w-5 h-5 text-blue-500" />
                                </div>
                                <span className="font-semibold text-base group-hover:text-blue-400 transition-colors">Distributed Ensemble</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                        </div>
                        <p className="text-sm text-zinc-500 leading-relaxed">Cross-validate findings against 5 independent clinical models for consensus.</p>
                    </motion.div>
                </div>
                
                {/* Info Modals */}
                <Modal 
                    isOpen={activeInfo === 'privacy'} 
                    onClose={() => setActiveInfo(null)} 
                    title="Privacy Standards"
                >
                    <div className="space-y-6">
                        <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/30 flex gap-4">
                            <Lock className="w-8 h-8 text-emerald-500 flex-shrink-0" />
                            <div>
                                <h4 className="font-semibold text-emerald-400 mb-1">Mathematically Guaranteed Privacy</h4>
                                <p className="text-sm text-emerald-200/70">Your slide data never leaves this session. Only mathematical gradients with added noise are transmitted.</p>
                            </div>
                        </div>
                        
                        <div className="space-y-4 text-zinc-300">
                            <p>
                                In our architecture, <strong>Local Differential Privacy (LDP)</strong> is applied before any model update is shared. 
                            </p>
                            <p>
                                Specifically, we utilize the <strong>Laplace Mechanism</strong> to inject calibrated noise into the model's weight updates. 
                                The parameter <span className="font-mono text-emerald-400 bg-emerald-950/30 px-1 rounded">epsilon ({settings.privacyBudget})</span> controls this trade-off:
                            </p>
                            <ul className="list-disc list-inside space-y-2 ml-2 text-zinc-400">
                                <li><strong>Lower Epsilon:</strong> Higher noise, maximum privacy, slightly lower accuracy.</li>
                                <li><strong>Higher Epsilon:</strong> Less noise, better accuracy, standard privacy.</li>
                            </ul>
                        </div>
                    </div>
                </Modal>

                <Modal 
                    isOpen={activeInfo === 'ensemble'} 
                    onClose={() => setActiveInfo(null)} 
                    title="Ensemble Architecture"
                >
                    <div className="space-y-6">
                        <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-900/30 flex gap-4">
                            <Share2 className="w-8 h-8 text-blue-500 flex-shrink-0" />
                            <div>
                                <h4 className="font-semibold text-blue-400 mb-1">Collaborative Intelligence</h4>
                                <p className="text-sm text-blue-200/70">Models trained at different hospitals collaborate to form a smarter global model without sharing patient data.</p>
                            </div>
                        </div>

                        <div className="space-y-4 text-zinc-300">
                            <p>This system runs 5 distinct AI models simultaneously to provide a robust diagnostic consensus.</p>
                            <ul className="space-y-3">
                                <li className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                                    <span className="block font-medium text-white mb-1">Local Nodes (Hospital A-C)</span>
                                    <span className="text-sm text-zinc-500">Models trained on specific hospital cohorts with unique scanning hardware.</span>
                                </li>
                                <li className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                                    <span className="block font-medium text-white mb-1">Global FedAvg</span>
                                    <span className="text-sm text-zinc-500">The primary aggregated model using Federated Averaging.</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </Modal>
            </motion.div>
        </div>
    );
  };

  return (
    <>
        {renderContent()}
    </>
  );
};

const App: React.FC = () => {
    const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
    const [history, setHistory] = useState<HistoryRecord[]>([]);
    const [dashboardKey, setDashboardKey] = useState(0);

    const handleReset = () => {
        setDashboardKey(prev => prev + 1);
    };

    const addToHistory = (rec: HistoryRecord) => {
        setHistory(prev => [rec, ...prev]);
    };

    const clearHistory = () => {
        setHistory([]);
    };

    return (
        <HashRouter>
            <div className="min-h-screen bg-black text-foreground selection:bg-emerald-500/30 selection:text-emerald-200 font-sans overflow-hidden">
                <AmbientBackground />
                <Navbar onReset={handleReset} />
                
                <main className="pt-32 pb-16 px-6 max-w-7xl mx-auto min-h-[calc(100vh-100px)] flex flex-col relative z-10">
                    <Routes>
                        <Route path="/" element={<Dashboard key={dashboardKey} settings={settings} onUpdateSettings={setSettings} onSaveHistory={addToHistory} />} />
                        <Route path="/history" element={<HistoryList history={history} onClear={clearHistory} />} />
                        <Route path="/settings" element={<SettingsPanel settings={settings} onUpdate={setSettings} />} />
                    </Routes>
                </main>
            </div>
        </HashRouter>
    );
}

export default App;