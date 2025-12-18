export interface ModelPrediction {
  label: string;
  score: number;
}

export interface FederatedResult {
  hospital_a?: ModelPrediction[];
  hospital_b?: ModelPrediction[];
  hospital_c?: ModelPrediction[];
  global_fedavg?: ModelPrediction[];
  global_distilled?: ModelPrediction[];
  [key: string]: ModelPrediction[] | undefined;
}

export interface GradCamResult {
  original_image: string; // Base64
  heatmap_image: string; // Base64
  overlay_image: string; // Base64
  model_name: string;
}

export interface FullInferenceResult {
  predictions: FederatedResult;
  gradcams: Record<string, GradCamResult>; // key is model name
}

export interface BatchResult {
  filename: string;
  predictions: FederatedResult;
  status: 'success' | 'failed';
}

export enum AnalysisType {
  PREDICT = 'predict',
  GRADCAM = 'gradcam',
  FULL = 'full_inference',
  BATCH = 'batch_infer'
}

export type LoadingState = 'idle' | 'uploading' | 'processing' | 'complete' | 'error';

export interface AppSettings {
  activeModels: {
    hospital_a: boolean;
    hospital_b: boolean;
    hospital_c: boolean;
    global_fedavg: boolean;
    global_distilled: boolean;
    [key: string]: boolean;
  };
  privacyBudget: number; // 0.1 to 1.0 (Simulation parameter)
  useLocalPrivacy: boolean;
}

export interface HistoryRecord {
  id: string;
  timestamp: number;
  type: AnalysisType;
  filename: string;
  result: FederatedResult | FullInferenceResult | GradCamResult | BatchResult[];
}