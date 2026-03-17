import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  if (!showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[1000] bg-[#fcfcfc] flex flex-col items-center justify-center p-8 text-[#121212]"
      >
        <img src="/splash.png" alt="Logo" className="w-32 h-32 mb-8" />
        <h2 className="text-3xl font-bold mb-4">Install Unsubzr</h2>
        <p className="text-center mb-8 text-lg opacity-80">Get the best experience by installing Unsubzr on your device.</p>
        <button 
          onClick={handleInstall}
          className="bg-[#FFC300] text-[#121212] px-8 py-3 rounded-full font-bold text-lg shadow-lg hover:scale-105 active:scale-95 transition-transform"
        >
          Install App
        </button>
      </motion.div>
    </AnimatePresence>
  );
};
