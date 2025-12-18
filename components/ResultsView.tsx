import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { FederatedResult, FullInferenceResult, GradCamResult, AppSettings, HistoryRecord, AnalysisType, BatchResult } from '../types';
import { Card, Badge, Button, Switch, Slider, Modal } from './ui/DesignSystem';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Download, RefreshCw, FileJson, Trash2, Clock, Settings, ArrowRight, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { GradCamViewer } from './GradCamViewer';

interface PredictionProps {
  data: FederatedResult;
  onReset: () => void;
}

// --- Helper Logic for Consensus ---
const getConsensus = (data: FederatedResult) => {
    const models = Object.keys(data);
    if (models.length === 0) return null;

    let cancerCount = 0;
    let benignCount = 0;
    let totalScore = 0;
    let modelCount = 0;

    models.forEach(model => {
        const preds = data[model];
        if (preds && preds.length > 0) {
            modelCount++;
            const top = [...preds].sort((a, b) => b.score - a.score)[0];
            const label = top.label.toLowerCase();
            if (label.includes('cancer') || label.includes('carcinoma') || label.includes('positive') || label.includes('malignant')) {
                cancerCount++;
            } else {
                benignCount++;
            }
            totalScore += top.score;
        }
    });

    if (modelCount === 0) return null;

    const total = cancerCount + benignCount;
    const isPositive = cancerCount > benignCount;
    const agreement = isPositive ? (cancerCount / total) : (benignCount / total);
    const avgConfidence = totalScore / total;

    return {
        label: isPositive ? "Positive for Malignancy" : "Benign / Normal Tissue",
        isPositive,
        confidence: avgConfidence,
        agreement,
        count: total
    };
};

// --- Sub-Components ---

const SummaryCard: React.FC<{ title: string; children: React.ReactNode; variant?: 'default' | 'alert' | 'safe' }> = ({ title, children, variant = 'default' }) => {
    const colors = {
        default: "border-l-zinc-500 bg-zinc-900/30",
        alert: "border-l-red-500 bg-red-950/10",
        safe: "border-l-emerald-500 bg-emerald-950/10"
    };
    
    const titleColors = {
        default: "text-zinc-300",
        alert: "text-red-400",
        safe: "text-emerald-400"
    };

    return (
        <Card className={`p-6 border-l-4 ${colors[variant]} h-full`}>
            <h4 className={`text-base font-bold mb-3 flex items-center gap-2 ${titleColors[variant]}`}>
                {variant === 'alert' && <AlertTriangle size={20} />}
                {variant === 'safe' && <CheckCircle2 size={20} />}
                {variant === 'default' && <Info size={20} />}
                {title}
            </h4>
            <div className="text-base text-zinc-300 space-y-2 leading-relaxed">{children}</div>
        </Card>
    );
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl shadow-xl">
        <p className="text-white font-medium mb-1 text-base">{label}</p>
        <p className="text-sm text-zinc-400">
          Confidence: <span className="text-white">{(payload[0].value * 100).toFixed(2)}%</span>
        </p>
      </div>
    );
  }
  return null;
};

const ModelResultCard: React.FC<{ name: string; predictions: any[] }> = ({ name, predictions }) => {
  if (!predictions || predictions.length === 0) return null;
  const sorted = [...predictions].sort((a, b) => b.score - a.score);
  const topPrediction = sorted[0];
  const isPositive = topPrediction.label.toLowerCase().includes('cancer') || topPrediction.label.toLowerCase().includes('positive') || topPrediction.label.toLowerCase().includes('carcinoma');

  return (
    <Card className="p-6 flex flex-col h-full border-zinc-800/50 hover:border-zinc-700 transition-colors">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h4 className="text-lg font-semibold text-zinc-100 capitalize">{name.replace(/_/g, ' ')}</h4>
          <span className="text-sm text-zinc-500">Federated Node</span>
        </div>
        <Badge variant={isPositive ? 'default' : 'success'}>
            {topPrediction.label}
        </Badge>
      </div>
      
      <div className="h-40 w-full mt-auto">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={predictions} layout="vertical" margin={{ left: 0, right: 20 }}>
            <XAxis type="number" hide domain={[0, 1]} />
            <YAxis 
                dataKey="label" 
                type="category" 
                width={100} 
                tick={{ fill: '#71717a', fontSize: 12 }} 
                axisLine={false}
                tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
            <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={24}>
              {predictions.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={index === 0 ? (isPositive ? '#f87171' : '#34d399') : '#52525b'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

// --- Main Views ---

export const PredictionResults: React.FC<PredictionProps> = ({ data, onReset }) => {
  const [showJson, setShowJson] = useState(false);
  const modelKeys = Object.keys(data);
  const consensus = useMemo(() => getConsensus(data), [data]);

  const downloadReport = () => {
    const report = {
        timestamp: new Date().toISOString(),
        summary: "Federated Histopathology Analysis",
        consensus,
        results: data
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patho_plus_report_${Date.now()}.json`;
    a.click();
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight text-white">Analysis Results</h2>
        <div className="flex gap-3">
            <Button variant="secondary" size="sm" onClick={() => setShowJson(true)}>
                <FileJson className="w-4 h-4 mr-2" /> View JSON
            </Button>
            <Button variant="secondary" size="sm" onClick={downloadReport}>
                <Download className="w-4 h-4 mr-2" /> Export
            </Button>
            <Button variant="primary" size="sm" onClick={onReset}>
                <RefreshCw className="w-4 h-4 mr-2" /> New Analysis
            </Button>
        </div>
      </div>

      {consensus && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <SummaryCard 
                title="Federated Consensus" 
                variant={consensus.isPositive ? 'alert' : 'safe'}
              >
                  <p className="text-xl font-medium text-white mb-2">{consensus.label}</p>
                  <p>
                      The federated ensemble reached a <strong>{(consensus.agreement * 100).toFixed(0)}% agreement rate</strong> across {consensus.count} nodes.
                      The average confidence score for this classification is <span className="text-white">{(consensus.confidence * 100).toFixed(1)}%</span>.
                  </p>
              </SummaryCard>
              <SummaryCard title="Clinical Interpretation" variant="default">
                  {consensus.isPositive 
                    ? <p>The aggregated results suggest a <strong>high probability of pathological abnormality</strong>. The consensus across multiple hospital models strengthens the validity of this finding. Immediate expert histopathological review is recommended to confirm the specific subtype.</p>
                    : <p>The aggregated results suggest the tissue is likely <strong>benign or normal</strong>. While model consensus is high, clinical correlation and standard screening protocols should still be followed to rule out false negatives.</p>
                  }
              </SummaryCard>
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {modelKeys.map((key, index) => (
             <motion.div 
                key={key}
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: index * 0.1 }}
            >
                <ModelResultCard name={key} predictions={data[key] as any[]} />
            </motion.div>
        ))}
      </div>

      <Modal isOpen={showJson} onClose={() => setShowJson(false)} title="Raw Analysis Data">
          <pre className="text-sm text-zinc-400 font-mono whitespace-pre-wrap p-2">
              {JSON.stringify(data, null, 2)}
          </pre>
      </Modal>
    </div>
  );
};

export const GradCamResultsView: React.FC<{ data: GradCamResult, onReset: () => void }> = ({ data, onReset }) => {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-white">Grad-CAM Visualization</h2>
                <Button onClick={onReset} variant="ghost">Reset</Button>
            </div>

            <SummaryCard title="Visual Explanation" variant="default">
                <p>
                    <strong>Gradient-weighted Class Activation Mapping (Grad-CAM)</strong> highlights the regions of the image that heavily influenced the AI's classification decision.
                </p>
                <ul className="list-disc list-inside mt-3 text-zinc-400 ml-2 space-y-2">
                    <li><span className="text-red-400 font-medium">Red/Yellow areas:</span> High attention (strong influence on prediction).</li>
                    <li><span className="text-blue-400 font-medium">Blue/Transparent areas:</span> Low attention (ignored by the model).</li>
                </ul>
            </SummaryCard>

            {/* Viewer now handles its own internal layout */}
            <GradCamViewer 
                original={data.original_image} 
                heatmap={data.heatmap_image} 
                modelName={data.model_name} 
            />
        </div>
    );
};

export const FullInferenceView: React.FC<{ data: FullInferenceResult, onReset: () => void }> = ({ data, onReset }) => {
    const [activeTab, setActiveTab] = React.useState<string>(Object.keys(data.gradcams)[0]);
    const models = Object.keys(data.gradcams);
    const consensus = useMemo(() => getConsensus(data.predictions), [data.predictions]);

    return (
        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold tracking-tight text-white">Full Inference Analysis</h2>
                <Button variant="ghost" onClick={onReset}>Back to Upload</Button>
            </div>

            {consensus && (
                <div className="mb-4">
                     <SummaryCard title="Executive Summary" variant={consensus.isPositive ? 'alert' : 'safe'}>
                        <p className="text-lg">
                            <strong>Outcome:</strong> {consensus.label} (Confidence: {(consensus.confidence * 100).toFixed(1)}%).
                            <br/>
                            This view combines classification metrics with Grad-CAM visualization. Select a model below to inspect its specific attention map.
                        </p>
                    </SummaryCard>
                </div>
            )}

            <div className="flex overflow-x-auto gap-3 pb-3 border-b border-zinc-800 no-scrollbar">
                {models.map(model => (
                    <button
                        key={model}
                        onClick={() => setActiveTab(model)}
                        className={`px-6 py-3 rounded-full text-base font-medium transition-all whitespace-nowrap ${
                            activeTab === model 
                            ? 'bg-white text-black shadow-lg shadow-white/10' 
                            : 'text-zinc-500 hover:text-white hover:bg-zinc-900'
                        }`}
                    >
                        {model.replace(/_/g, ' ')}
                    </button>
                ))}
            </div>

            <div className="flex flex-col gap-8">
                <div className="w-full">
                    <h3 className="text-xl font-medium text-zinc-400 mb-4">Classification Metrics</h3>
                    {data.predictions[activeTab] && (
                        <ModelResultCard name={activeTab} predictions={data.predictions[activeTab] as any[]} />
                    )}
                </div>

                <div className="w-full">
                     {/* Floating header inside viewer handles the title now */}
                     {data.gradcams[activeTab] && (
                         <GradCamViewer 
                            original={data.gradcams[activeTab].original_image}
                            heatmap={data.gradcams[activeTab].heatmap_image}
                            modelName={activeTab}
                         />
                     )}
                </div>
            </div>
        </div>
    )
};

export const BatchResultsView: React.FC<{ results: BatchResult[]; onReset: () => void }> = ({ results, onReset }) => {
    const stats = useMemo(() => {
        const total = results.length;
        const positive = results.filter(r => {
             // Quick check for positive in the first model result for summary
             const firstModelKey = Object.keys(r.predictions)[0];
             if (!firstModelKey) return false;
             const firstModel = r.predictions[firstModelKey];
             if(!firstModel) return false;
             const top = firstModel.sort((a: any, b: any) => b.score - a.score)[0];
             return top.label.toLowerCase().includes('cancer') || top.label.toLowerCase().includes('carcinoma') || top.label.toLowerCase().includes('malignant');
        }).length;
        return { total, positive, benign: total - positive };
    }, [results]);

    const downloadBatchCSV = () => {
        const headers = ["Filename", "Status", "Consensus Label", "Avg Confidence"];
        const rows = results.map(r => {
            const cons = getConsensus(r.predictions);
            return [
                r.filename,
                r.status,
                cons ? cons.label : "N/A",
                cons ? cons.confidence.toFixed(4) : "0.00"
            ].join(",");
        });
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `batch_results_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="animate-in fade-in space-y-10">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-white">Batch Processing Complete</h2>
                <div className="flex gap-3">
                     <Button variant="secondary" size="sm" onClick={downloadBatchCSV}>
                        <Download className="w-5 h-5 mr-2" /> Download Report
                    </Button>
                    <Button onClick={onReset} variant="ghost">Analyze New Batch</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-8 flex flex-col items-center justify-center bg-zinc-900/50 border-zinc-800">
                    <span className="text-5xl font-bold text-white mb-3">{stats.total}</span>
                    <span className="text-sm text-zinc-500 uppercase tracking-wider font-semibold">Total Slides Processed</span>
                </Card>
                <Card className="p-8 flex flex-col items-center justify-center bg-red-950/20 border-red-900/30">
                    <span className="text-5xl font-bold text-red-400 mb-3">{stats.positive}</span>
                    <span className="text-sm text-red-500/70 uppercase tracking-wider font-semibold">Flagged Positive</span>
                </Card>
                <Card className="p-8 flex flex-col items-center justify-center bg-emerald-950/20 border-emerald-900/30">
                    <span className="text-5xl font-bold text-emerald-400 mb-3">{stats.benign}</span>
                    <span className="text-sm text-emerald-500/70 uppercase tracking-wider font-semibold">Benign / Clear</span>
                </Card>
            </div>

            <Card className="overflow-hidden border-zinc-800">
                <div className="p-6 border-b border-zinc-800 bg-zinc-900/30">
                    <h3 className="text-lg font-medium text-zinc-200">Detailed Batch Breakdown</h3>
                </div>
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left text-base">
                        <thead className="bg-zinc-950/50 text-zinc-400 sticky top-0 backdrop-blur-md">
                            <tr>
                                <th className="p-6 font-medium">Filename</th>
                                <th className="p-6 font-medium">Status</th>
                                <th className="p-6 font-medium">Consensus Result</th>
                                <th className="p-6 font-medium">Confidence</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                            {results.map((res, i) => {
                                const cons = getConsensus(res.predictions);
                                return (
                                    <tr key={i} className="hover:bg-zinc-900/30 transition-colors">
                                        <td className="p-6 text-white font-mono">{res.filename}</td>
                                        <td className="p-6"><Badge variant={res.status === 'success' ? 'success' : 'default'}>{res.status}</Badge></td>
                                        <td className="p-6">
                                            {cons ? (
                                                <span className={cons.isPositive ? "text-red-400 font-medium" : "text-emerald-400 font-medium"}>
                                                    {cons.label}
                                                </span>
                                            ) : <span className="text-zinc-600">--</span>}
                                        </td>
                                        <td className="p-6 text-zinc-400">
                                            {cons ? (cons.confidence * 100).toFixed(1) + '%' : '--'}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export const SettingsPanel: React.FC<{ settings: AppSettings, onUpdate: (s: AppSettings) => void }> = ({ settings, onUpdate }) => {
    const toggleModel = (key: string) => {
        onUpdate({
            ...settings,
            activeModels: {
                ...settings.activeModels,
                [key]: !settings.activeModels[key]
            }
        });
    };

    return (
        <div className="space-y-10 animate-in slide-in-from-right-8 duration-500">
            <div>
                <h2 className="text-3xl font-bold text-white mb-3">System Configuration</h2>
                <p className="text-lg text-zinc-400">Manage active federated nodes and privacy parameters.</p>
            </div>

            <Card className="p-8 space-y-8">
                <h3 className="text-xl font-medium text-white flex items-center gap-3">
                    <Settings className="w-6 h-6 text-emerald-500" /> Active Federated Nodes
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Object.keys(settings.activeModels).map(key => (
                        <div key={key} className="flex items-center justify-between p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/50">
                            <span className="capitalize text-zinc-200 text-lg">{key.replace(/_/g, ' ')}</span>
                            <Switch checked={settings.activeModels[key]} onCheckedChange={() => toggleModel(key)} />
                        </div>
                    ))}
                </div>
            </Card>

            <Card className="p-8 space-y-8">
                 <h3 className="text-xl font-medium text-white flex items-center gap-3">
                    <Settings className="w-6 h-6 text-blue-500" /> Privacy & Simulation
                </h3>
                
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <span className="text-zinc-200 text-lg">Local Differential Privacy</span>
                        <Switch 
                            checked={settings.useLocalPrivacy} 
                            onCheckedChange={(c) => onUpdate({...settings, useLocalPrivacy: c})} 
                        />
                    </div>
                    
                    <div className="space-y-3">
                        <div className="flex justify-between text-base text-zinc-400">
                            <span>Privacy Budget (Epsilon)</span>
                            <span>{settings.privacyBudget}</span>
                        </div>
                        <Slider 
                            min={0.1} max={1.0} step={0.1} 
                            value={settings.privacyBudget} 
                            onChange={(v) => onUpdate({...settings, privacyBudget: v})}
                        />
                        <p className="text-sm text-zinc-500 pt-1">Lower values increase noise addition to simulate stricter privacy constraints.</p>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export const HistoryList: React.FC<{ history: HistoryRecord[], onClear: () => void }> = ({ history, onClear }) => {
    if (history.length === 0) {
        return (
            <div className="text-center py-24">
                <Clock className="w-16 h-16 text-zinc-700 mx-auto mb-6" />
                <h3 className="text-2xl font-medium text-white">No Analysis History</h3>
                <p className="text-lg text-zinc-500 mt-2">Upload a slide to generate your first report.</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
             <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-white">Recent Analysis</h2>
                <Button variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-950/30" onClick={onClear}>
                    <Trash2 className="w-5 h-5 mr-2" /> Clear History
                </Button>
            </div>

            <div className="space-y-4">
                {history.map((record) => (
                    <Card key={record.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 group hover:border-zinc-600 transition-colors">
                        <div className="flex items-center gap-6">
                            <div className={`p-4 rounded-full ${record.type === AnalysisType.BATCH ? 'bg-blue-950/50 text-blue-400' : 'bg-emerald-950/50 text-emerald-400'}`}>
                                {record.type === AnalysisType.PREDICT ? <FileJson size={24} /> : <Clock size={24} />}
                            </div>
                            <div>
                                <h4 className="text-lg font-medium text-white">{record.filename}</h4>
                                <p className="text-sm text-zinc-500 mt-1">{new Date(record.timestamp).toLocaleString()} • {record.type.toUpperCase()}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <Badge variant="outline">Completed</Badge>
                             {/* In a real app, clicking this would reload the state */}
                            <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                View Details <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
};