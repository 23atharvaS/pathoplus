import React, { InputHTMLAttributes, useEffect } from 'react';
import { motion, HTMLMotionProps, AnimatePresence } from 'framer-motion';

// Inline utility for class merging
function classNames(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, className, variant = 'primary', size = 'md', ...props 
}) => {
  const base = "inline-flex items-center justify-center rounded-xl font-medium transition-all focus:outline-none disabled:opacity-50 disabled:pointer-events-none active:scale-95";
  const variants = {
    primary: "bg-white text-black hover:bg-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.3)]",
    secondary: "bg-zinc-900 text-white border border-zinc-800 hover:bg-zinc-800",
    ghost: "bg-transparent text-zinc-400 hover:text-white hover:bg-zinc-900/50",
    destructive: "bg-red-950/50 text-red-500 border border-red-900/50 hover:bg-red-900/50",
  };
  const sizes = {
    sm: "h-10 px-4 text-sm", // Scaled up from h-8
    md: "h-12 px-6 text-base", // Scaled up from h-10
    lg: "h-14 px-8 text-lg", // Scaled up from h-12
  };

  return (
    <button className={classNames(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  );
};

export const Card = motion(React.forwardRef<HTMLDivElement, HTMLMotionProps<"div">>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={classNames(
        "rounded-2xl border border-zinc-800 bg-zinc-950/50 backdrop-blur-xl shadow-2xl overflow-hidden",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
));

export const Badge: React.FC<{ children: React.ReactNode; variant?: 'default' | 'outline' | 'success' }> = ({ children, variant = 'default' }) => {
  const styles = {
    default: "bg-zinc-800 text-zinc-300",
    outline: "border border-zinc-700 text-zinc-400",
    success: "bg-emerald-950/30 text-emerald-400 border border-emerald-900/50",
  };
  return (
    <span className={classNames("inline-flex items-center px-3 py-1 rounded-full text-sm font-medium", styles[variant])}>
      {children}
    </span>
  );
};

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={classNames("animate-pulse rounded-lg bg-zinc-900/50", className)} />
);

export const Switch: React.FC<{ checked: boolean; onCheckedChange: (c: boolean) => void }> = ({ checked, onCheckedChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onCheckedChange(!checked)}
    className={classNames(
      "relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:ring-offset-2 focus:ring-offset-black",
      checked ? "bg-emerald-600" : "bg-zinc-700"
    )}
  >
    <span
      className={classNames(
        "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
        checked ? "translate-x-5" : "translate-x-0"
      )}
    />
  </button>
);

export const Slider: React.FC<{ value: number; min: number; max: number; step: number; onChange: (val: number) => void }> = ({ value, min, max, step, onChange }) => (
  <div className="relative flex w-full touch-none select-none items-center py-2">
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-emerald-500"
    />
  </div>
);

export const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
    // Lock body scroll
    useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = 'unset';
    }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm" 
                        onClick={onClose}
                    />
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed left-[50%] top-[50%] z-[101] w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] p-6"
                    >
                        <div className="relative rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden">
                             <div className="flex items-center justify-between border-b border-zinc-800 p-6">
                                <h3 className="text-xl font-semibold text-white">{title}</h3>
                                <button onClick={onClose} className="text-zinc-500 hover:text-white p-1">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                </button>
                             </div>
                             <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                                {children}
                             </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}

export const FileUpload: React.FC<{ 
  onFileSelect: (file: File) => void;
  accept?: string;
  label?: string;
}> = ({ onFileSelect, accept = "image/*", label = "Drop pathology slide or click to upload" }) => {
  const [dragActive, setDragActive] = React.useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div
      className={classNames(
        "relative group cursor-pointer flex flex-col items-center justify-center w-full h-80 rounded-3xl border-2 border-dashed transition-all duration-300",
        dragActive 
          ? "border-white bg-zinc-900/50 scale-[1.01]" 
          : "border-zinc-800 bg-black/40 hover:border-zinc-600 hover:bg-zinc-900/20"
      )}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input
        type="file"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        accept={accept}
        onChange={handleChange}
      />
      <div className="flex flex-col items-center space-y-6 text-center p-8 z-0 pointer-events-none">
        <div className="p-5 rounded-full bg-zinc-900 border border-zinc-800 shadow-inner group-hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-shadow">
          <svg className="w-10 h-10 text-zinc-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <div>
          <p className="text-xl font-medium text-white">{label}</p>
          <p className="text-base text-zinc-500 mt-2">Supported: JPG, PNG, TIFF {accept.includes('zip') ? ', ZIP' : ''}</p>
        </div>
      </div>
    </div>
  );
};