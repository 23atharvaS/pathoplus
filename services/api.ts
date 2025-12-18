import { GoogleGenAI, Type, Schema } from "@google/genai";
import { FederatedResult, GradCamResult, FullInferenceResult, BatchResult, ModelPrediction, AppSettings } from '../types';
import JSZip from 'jszip';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = 'gemini-2.5-flash';

// --- Helper Functions ---

const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
        if (typeof reader.result === 'string') {
             resolve(reader.result.split(',')[1]);
        }
    };
    reader.readAsDataURL(file);
  });
  
  return {
    inlineData: {
      data: await base64EncodedDataPromise,
      mimeType: file.type,
    },
  };
};

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result.split(',')[1]); 
            } else {
                reject(new Error("Failed to convert file to base64"));
            }
        };
        reader.onerror = error => reject(error);
    });
};

const generateSimulatedHeatmap = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(""); 
                return;
            }
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const b = data[i + 2];
                data[i] = 255 - r;     
                data[i + 1] = b;       
                data[i + 2] = 50;      
            }
            ctx.putImageData(imageData, 0, 0);
            resolve(canvas.toDataURL('image/png').split(',')[1]);
            URL.revokeObjectURL(url);
        };
        img.src = url;
    });
}

// --- Dynamic Schema Generation ---

const predictionSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        label: { type: Type.STRING },
        score: { type: Type.NUMBER }
    },
    required: ["label", "score"]
};

const getFederatedSchema = (activeModels: string[]): Schema => {
    const properties: Record<string, Schema> = {};
    activeModels.forEach(model => {
        properties[model] = { type: Type.ARRAY, items: predictionSchema };
    });
    
    return {
        type: Type.OBJECT,
        properties: properties,
        required: activeModels // Ensure Gemini returns all requested models
    };
};

// --- API Service ---

export const ApiService = {
  // 1. Single Prediction
  predict: async (file: File, settings: AppSettings): Promise<FederatedResult> => {
    const imagePart = await fileToGenerativePart(file);
    
    // Filter active models
    const activeModelKeys = Object.keys(settings.activeModels).filter(key => settings.activeModels[key]);
    if (activeModelKeys.length === 0) throw new Error("No models selected in settings.");

    const prompt = `
        You are a Histopathology AI System implementing Federated Learning.
        Analyze this pathology slide image for cancer presence.
        
        Act as the following distinct models:
        ${activeModelKeys.map((key, i) => `${i + 1}. ${key.replace('_', ' ').toUpperCase()}`).join('\n')}
        
        ${settings.privacyBudget < 0.8 ? "NOTE: Privacy budget is strict. Add small random noise to confidence scores to simulate differential privacy." : ""}
        
        For each model, provide a classification label (e.g., "Invasive Ductal Carcinoma", "Normal Tissue") and a confidence score (0.0 to 1.0).
        Hospital models should have specific biases. Global models should be more robust.
        
        Return ONLY valid JSON matching the requested schema.
    `;

    const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: {
            role: "user",
            parts: [imagePart, { text: prompt }]
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: getFederatedSchema(activeModelKeys),
            temperature: 0.4
        }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as FederatedResult;
  },

  // 3. Grad-CAM
  gradcam: async (file: File, settings: AppSettings): Promise<GradCamResult> => {
    // 1. Get Prediction
    const predictions = await ApiService.predict(file, settings);
    // Determine "best" model from active ones
    const activeKeys = Object.keys(settings.activeModels).filter(k => settings.activeModels[k]);
    const bestModel = activeKeys.includes('global_fedavg') ? 'global_fedavg' : activeKeys[0];
    
    const heatmapBase64 = await generateSimulatedHeatmap(file);
    const originalBase64 = await fileToBase64(file);

    return {
        original_image: originalBase64,
        heatmap_image: heatmapBase64,
        overlay_image: heatmapBase64,
        model_name: bestModel
    };
  },

  // 5. Full Inference
  fullInference: async (file: File, settings: AppSettings): Promise<FullInferenceResult> => {
    const predictions = await ApiService.predict(file, settings);
    const heatmapBase64 = await generateSimulatedHeatmap(file);
    const originalBase64 = await fileToBase64(file);

    const gradcams: Record<string, GradCamResult> = {};
    const activeKeys = Object.keys(settings.activeModels).filter(k => settings.activeModels[k]);
    
    activeKeys.forEach(model => {
        gradcams[model] = {
            original_image: originalBase64,
            heatmap_image: heatmapBase64,
            overlay_image: heatmapBase64,
            model_name: model
        };
    });

    return {
        predictions,
        gradcams
    };
  },

  // 6. Batch Inference
  batchInfer: async (file: File, settings: AppSettings, onProgress?: (percent: number) => void): Promise<BatchResult[]> => {
    const zip = new JSZip();
    let zipContent;
    try {
        zipContent = await zip.loadAsync(file);
    } catch (e) {
        throw new Error("Failed to load ZIP file. Ensure it is a valid archive.");
    }

    const imageEntries: Array<{name: string, obj: any}> = [];
    
    zipContent.forEach((relativePath, zipEntry) => {
        // Filter for images
        if (!zipEntry.dir && relativePath.match(/\.(jpg|jpeg|png|tif|tiff|webp)$/i)) {
            imageEntries.push({ name: relativePath, obj: zipEntry });
        }
    });

    if (imageEntries.length === 0) {
        throw new Error("No supported image files (JPG, PNG, TIFF) found in the ZIP.");
    }

    const results: BatchResult[] = [];
    const total = imageEntries.length;

    // Process files sequentially to maintain order and update progress accurately
    for (let i = 0; i < total; i++) {
        const entry = imageEntries[i];
        
        try {
            const blob = await entry.obj.async('blob');
            // Create a File object to pass to predict
            const fileFromZip = new File([blob], entry.name, { type: blob.type || 'image/png' }); 
            
            // Add a small delay to avoid hitting strict rate limits on the free tier if applicable
            if (i > 0) await new Promise(resolve => setTimeout(resolve, 500));

            const prediction = await ApiService.predict(fileFromZip, settings);
            
            results.push({
                filename: entry.name,
                predictions: prediction,
                status: 'success'
            });

        } catch (err) {
            console.error(`Error processing ${entry.name}:`, err);
            results.push({
                filename: entry.name,
                predictions: {} as any, // Return empty structure on failure
                status: 'failed'
            });
        }

        if (onProgress) {
            onProgress(Math.round(((i + 1) / total) * 100));
        }
    }

    return results;
  },
};