import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, Button } from './ui/DesignSystem';
import { Eye, EyeOff, ZoomIn, ZoomOut, Scan, Maximize2 } from 'lucide-react';

interface GradCamViewerProps {
  original: string; // Base64
  heatmap: string; // Base64
  modelName: string;
}

export const GradCamViewer: React.FC<GradCamViewerProps> = ({ original, heatmap, modelName }) => {
  const [opacity, setOpacity] = useState(0.5);
  const [zoom, setZoom] = useState(1);

  return (
    <Card className="relative h-[85vh] min-h-[600px] flex flex-col overflow-hidden bg-zinc-950 border-zinc-800">
      {/* Floating Header (Top Left) */}
      <div className="absolute top-6 left-6 z-20 flex items-center gap-3 bg-black/60 backdrop-blur-md border border-white/10 px-4 py-3 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-top-4 duration-500">
            <Scan size={20} className="text-emerald-500" />
            <h3 className="text-base font-semibold text-white capitalize tracking-wide">
                {modelName.replace(/_/g, ' ')}
            </h3>
      </div>

      {/* Floating Zoom Controls (Top Right) */}
      <div className="absolute top-6 right-6 z-20 flex items-center gap-2 bg-black/60 backdrop-blur-md border border-white/10 p-2 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-top-4 duration-500">
           <Button size="sm" variant="ghost" onClick={() => setZoom(Math.max(1, zoom - 0.2))} className="h-10 w-10 p-0 rounded-xl hover:bg-white/10"><ZoomOut size={18}/></Button>
           <span className="text-sm font-bold text-white w-14 text-center font-mono">{Math.round(zoom * 100)}%</span>
           <Button size="sm" variant="ghost" onClick={() => setZoom(Math.min(5, zoom + 0.2))} className="h-10 w-10 p-0 rounded-xl hover:bg-white/10"><ZoomIn size={18}/></Button>
      </div>

      {/* Main Image Area - Edge to Edge */}
      <div className="relative w-full h-full bg-zinc-950 flex items-center justify-center overflow-hidden">
        {/* Grid Background Pattern */}
        <div className="absolute inset-0 opacity-[0.1] pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(#333 1px, transparent 1px)', backgroundSize: '20px 20px' }} 
        />
        
        <div 
            className="w-full h-full transition-transform duration-200 ease-out flex items-center justify-center will-change-transform"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
        >
            <div className="relative w-full h-full flex items-center justify-center">
                {/* Original Image - Force Full Size */}
                <img 
                src={`data:image/jpeg;base64,${original}`} 
                alt="Original" 
                className="w-full h-full object-contain absolute inset-0 m-auto"
                draggable={false}
                />
                
                {/* Heatmap Overlay */}
                <img 
                src={`data:image/png;base64,${heatmap}`} 
                alt="Heatmap" 
                className="w-full h-full object-contain absolute inset-0 m-auto mix-blend-screen transition-opacity duration-150"
                style={{ opacity: opacity }}
                draggable={false}
                />
            </div>
        </div>
      </div>

      {/* Floating Footer Controls (Bottom Center) */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 w-full max-w-lg px-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="bg-black/70 backdrop-blur-xl border border-white/10 p-5 rounded-3xl shadow-2xl space-y-4">
            <div className="flex justify-between items-center text-xs text-zinc-400 font-bold uppercase tracking-widest">
                <span className={opacity === 0 ? "text-white" : ""}>Original</span>
                <span className="text-emerald-500">Heatmap Intensity</span>
                <span className={opacity === 1 ? "text-white" : ""}>Overlay</span>
            </div>
            
            <div className="relative h-8 flex items-center group">
                {/* Track */}
                <div className="absolute inset-0 h-1.5 bg-zinc-800 rounded-full top-1/2 -translate-y-1/2 overflow-hidden">
                    <div 
                        className="h-full bg-gradient-to-r from-zinc-600 via-emerald-500 to-white opacity-50" 
                        style={{ width: `${opacity * 100}%` }}
                    />
                </div>
                
                {/* Slider Input */}
                <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.01"
                    value={opacity}
                    onChange={(e) => setOpacity(parseFloat(e.target.value))}
                    className="w-full relative z-10 appearance-none bg-transparent cursor-pointer 
                    [&::-webkit-slider-thumb]:appearance-none 
                    [&::-webkit-slider-thumb]:w-6 
                    [&::-webkit-slider-thumb]:h-6 
                    [&::-webkit-slider-thumb]:rounded-full 
                    [&::-webkit-slider-thumb]:bg-white 
                    [&::-webkit-slider-thumb]:shadow-[0_0_20px_rgba(255,255,255,0.5)] 
                    [&::-webkit-slider-thumb]:border-4 
                    [&::-webkit-slider-thumb]:border-black
                    hover:[&::-webkit-slider-thumb]:scale-110 
                    transition-all"
                />
            </div>
        </div>
      </div>
    </Card>
  );
};