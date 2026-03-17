import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { InstallPrompt } from './components/InstallPrompt';
import { 
  PenLine, 
  Facebook, 
  Instagram, 
  Twitter, 
  ChevronRight, 
  X, 
  Info, 
  Settings, 
  Link as LinkIcon, 
  Sparkles,
  Trash2,
  ChevronDown,
  ChevronUp,
  History,
  Key,
  Globe,
  Zap
} from 'lucide-react';
import { 
  Post, 
  Series, 
  AppState,
  loadState, 
  saveState, 
  adaptContent, 
  generateFromUrl 
} from './services/ai';

const PLATFORMS = [
  { id: 'linkedin', icon: PenLine, label: 'LinkedIn' },
  { id: 'facebook', icon: Facebook, label: 'Facebook' },
  { id: 'instagram', icon: Instagram, label: 'Instagram' },
  { id: 'twitter', icon: Twitter, label: 'X (Twitter)' },
  { id: 'hashnode', icon: Globe, label: 'Hashnode' },
];

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [content, setContent] = useState('');
  const [activePlatform, setActivePlatform] = useState('linkedin');
  const [navView, setNavView] = useState<'icons' | 'text' | 'series_history' | 'posts_history'>('icons');
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<string | null>(null);
  const [showUrlSheet, setShowUrlSheet] = useState(false);
  const [showSystemSheet, setShowSystemSheet] = useState(false);
  const [showApiKeySheet, setShowApiKeySheet] = useState(false);
  const [showOptionsSheet, setShowOptionsSheet] = useState(false);
  const [pendingPlatform, setPendingPlatform] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [urlInstructions, setUrlInstructions] = useState('');
  const [referenceArticleUrl, setReferenceArticleUrl] = useState('');
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);
  const [urlIsSeries, setUrlIsSeries] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  const [tooltip, setTooltip] = useState<string | null>(null);
  const [isDeepDive, setIsDeepDive] = useState(false);
  const [activeSeriesId, setActiveSeriesId] = useState<string | null>(null);

  const mainInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadState().then(s => {
      setState(s);
      setTempApiKey(s.customApiKey || '');
    });
  }, []);

  useEffect(() => {
    if (state) {
      saveState(state);
    }
  }, [state]);

  if (!state) return <div className="h-screen flex items-center justify-center bg-[#f9f9f7]">Loading...</div>;

  const showAlert = (msg: string) => {
    setAlert(msg);
    setTimeout(() => setAlert(null), 4000);
  };

  const handleAction = async () => {
    if (navView === 'icons') {
      setNavView('text');
    } else {
      setNavView('icons');
    }
  };

  const handleAdapt = async (platformId: string) => {
    if (isLoading) return;
    if (!content.trim()) {
      showAlert('Please enter some text first');
      return;
    }

    setIsLoading(true);
    try {
      const adapted = await adaptContent(content, platformId, state.systemPrompt, state.customApiKey);
      setContent(adapted);
      
      const newPost: Post = {
        id: Math.random().toString(36).substr(2, 9),
        title: adapted.substring(0, 30).replace(/\n/g, ' ') + '...',
        content: adapted,
        platform: platformId,
        createdAt: Date.now(),
      };
      setState(prev => ({ ...prev, posts: [newPost, ...prev.posts] }));
      
      setNavView('icons');
      setShowOptionsSheet(false);
    } catch (e: any) {
      if (e.message.includes('API Key missing')) {
        setShowApiKeySheet(true);
      } else {
        showAlert('AI Error: ' + e.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlatformClick = (platformId: string) => {
    if (tooltip === 'Choose platform to adapt to') {
      handleAdapt(platformId);
      setTooltip(null);
    } else {
      setPendingPlatform(platformId);
      setShowOptionsSheet(true);
    }
  };

  const handleUrlGenerate = async (isNextPart = false, customInstructions = '') => {
    if (!urlInput.trim()) return;

    setIsLoading(true);
    setShowUrlSheet(false);
    try {
      const series = state.series.find(s => s.id === activeSeriesId);
      const result = await generateFromUrl(
        isNextPart ? (series?.originalUrl || urlInput) : urlInput, 
        activePlatform, 
        urlIsSeries, 
        isNextPart ? customInstructions : urlInstructions, 
        state.systemPrompt, 
        state.customApiKey,
        isDeepDive,
        isNextPart,
        series?.title,
        referenceArticleUrl
      );

      if (urlIsSeries || isNextPart) {
        const seriesId = isNextPart ? activeSeriesId! : Math.random().toString(36).substr(2, 9);
        if (!isNextPart) {
          const newSeries: Series = {
            id: seriesId,
            title: result.seriesTitle || 'New Series',
            createdAt: Date.now(),
            originalUrl: urlInput,
            originalPrompt: urlInstructions,
            referenceArticleUrl: referenceArticleUrl,
            styleKnowledge: result.styleKnowledge,
          };
          setState(prev => ({
            ...prev!,
            series: [newSeries, ...prev!.series],
          }));
        }
        const newPosts = result.posts.map(p => ({
          id: Math.random().toString(36).substr(2, 9),
          title: p.substring(0, 30).replace(/\n/g, ' ') + '...',
          content: p,
          platform: activePlatform,
          createdAt: Date.now(),
          seriesId,
        }));
        setState(prev => ({
          ...prev,
          posts: [...newPosts, ...prev.posts],
        }));
        setContent(result.posts[0]);
      } else {
        const newPost: Post = {
          id: Math.random().toString(36).substr(2, 9),
          title: result.posts[0].substring(0, 30).replace(/\n/g, ' ') + '...',
          content: result.posts[0],
          platform: activePlatform,
          createdAt: Date.now(),
        };
        setState(prev => ({ ...prev, posts: [newPost, ...prev.posts] }));
        setContent(result.posts[0]);
      }
    } catch (e: any) {
      if (e.message.includes('API Key missing')) {
        setShowApiKeySheet(true);
      } else {
        showAlert('AI Error: ' + e.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const deletePost = (id: string) => {
    setState(prev => ({ ...prev, posts: prev.posts.filter(p => p.id !== id) }));
  };

  const deleteSeries = (id: string) => {
    setState(prev => ({
      ...prev,
      series: prev.series.filter(s => s.id !== id),
      posts: prev.posts.filter(p => p.seriesId !== id),
    }));
  };

  const springTransition: any = { type: 'spring', stiffness: 300, damping: 25 };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#fcfcfc] text-[#121212] font-sans">
      <InstallPrompt />
      {/* Background Grid */}
      <div className="fixed inset-0 pointer-events-none opacity-20" 
           style={{ backgroundImage: 'radial-gradient(#d1d1cf 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

      <main className="relative z-10 flex flex-col lg:flex-row flex-1 p-4 lg:p-8 gap-4 lg:gap-8 max-w-[1400px] mx-auto w-full h-full pb-4 lg:pb-8">
        
        {/* Branding */}
        <div className="absolute top-4 left-8 pointer-events-none hidden lg:block">
          <div className="flex items-center gap-2">
            <motion.div 
              whileHover={{ rotate: 12, scale: 1.1 }}
              className="w-10 h-10 bg-[#FF6B2B] rounded-xl flex items-center justify-center text-white shadow-lg shadow-[#FF6B2B]/20"
            >
              <Zap size={24} fill="currentColor" />
            </motion.div>
            <span className="text-2xl font-bold tracking-tight text-[#121212] font-display">Unsubzr</span>
          </div>
        </div>

        {/* Content Area */}
        <motion.div 
          initial={{ y: 30, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={springTransition}
          className="flex-1 flex flex-col min-h-0 h-full"
        >
          <div className="relative flex-1 group flex flex-col h-full">
            <textarea
              ref={mainInputRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="flex-1 w-full h-full p-8 text-lg border border-gray-200 rounded-[18px] resize-none focus:outline-none focus:border-[#FF6B2B] bg-white transition-all duration-300 shadow-sm"
              placeholder="Type or paste content here..."
            />
            <button 
              onClick={handleAction}
              className="absolute bottom-6 right-6 w-[52px] h-[52px] bg-[#FF6B2B] text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform z-20"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <ChevronRight className={`transition-transform duration-300 ${navView !== 'icons' ? 'rotate-180' : ''}`} />
              )}
            </button>
          </div>
        </motion.div>

        {/* Sidebar / Nav */}
        <motion.div 
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ ...springTransition, delay: 0.2 }}
          className="w-full lg:w-[280px] flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto no-scrollbar lg:mask-none flex-shrink-0"
        >
          <AnimatePresence mode="wait">
            {navView === 'icons' && (
              <motion.div 
                key="icons"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex lg:flex-col gap-2 w-full"
              >
                {PLATFORMS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handlePlatformClick(p.id)}
                    className={`flex-shrink-0 min-w-[6em] lg:w-full h-[3em] lg:h-[3.5rem] flex items-center justify-center gap-3 bg-white border rounded-xl transition-all hover:-translate-y-0.5 relative ${activePlatform === p.id ? 'border-[#FF6B2B] text-[#FF6B2B] bg-[#FF6B2B]/10' : 'border-gray-200 text-gray-500'}`}
                  >
                    <p.icon size={20} />
                    <span className="hidden lg:inline text-sm font-medium">{p.label}</span>
                    {tooltip === 'Choose platform to adapt to' && activePlatform === p.id && (
                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap animate-bounce">
                        Choose platform to adapt to
                      </div>
                    )}
                  </button>
                ))}
                <button
                  onClick={() => setShowApiKeySheet(true)}
                  className="flex-shrink-0 min-w-[6em] lg:w-full h-[3em] lg:h-[3.5rem] flex items-center justify-center gap-3 bg-white border border-gray-200 text-gray-500 rounded-xl transition-all hover:-translate-y-0.5"
                >
                  <Key size={20} />
                  <span className="hidden lg:inline text-sm font-medium">API Key</span>
                </button>
              </motion.div>
            )}

            {navView === 'text' && (
              <motion.div 
                key="text"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex lg:flex-col gap-2 w-full"
              >
                <button onClick={() => setNavView('series_history')} className="nav-item-text">Series History</button>
                <button onClick={() => setNavView('posts_history')} className="nav-item-text">Posts History</button>
                <button onClick={() => setShowUrlSheet(true)} className="nav-item-text">URL to post</button>
                <button onClick={() => {
                  if (!content.trim()) {
                    showAlert('Please enter some text first');
                  } else {
                    setNavView('icons');
                    setTooltip('Choose platform to adapt to');
                    setTimeout(() => setTooltip(null), 5000);
                  }
                }} className="nav-item-text">Adapt write up</button>
                <button onClick={() => setShowSystemSheet(true)} className="nav-item-text">System Prompt</button>
                <button onClick={() => setNavView('icons')} className="nav-item-text text-red-500">Back</button>
              </motion.div>
            )}

            {navView === 'series_history' && (
              <motion.div 
                key="series_history"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex lg:flex-col gap-2 w-full"
              >
                <button onClick={() => setNavView('text')} className="nav-item-text text-[#FFC300] sticky left-0 z-10 bg-white">
                  <ChevronRight className="rotate-180" size={14} strokeWidth={3} />
                </button>
                
                <div className="flex lg:flex-col gap-2">
                  {state.series.length === 0 ? (
                    <div className="text-xs text-gray-400 px-2 italic">No series yet</div>
                  ) : (
                    state.series.map(s => (
                      <div key={s.id} className="group relative">
                        <button 
                          onClick={() => setSelectedSeriesId(selectedSeriesId === s.id ? null : s.id)}
                          className={`nav-item-text flex justify-between items-center ${selectedSeriesId === s.id ? 'border-blue-500 bg-blue-50' : ''}`}
                        >
                          <span className="truncate">{s.title}</span>
                          {selectedSeriesId === s.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteSeries(s.id); }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"
                        >
                          <Trash2 size={14} />
                        </button>
                        
                        <AnimatePresence>
                          {selectedSeriesId === s.id && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden flex flex-col gap-1 mt-1 pl-4"
                            >
                              {state.posts.filter(p => p.seriesId === s.id).map(p => (
                                <button 
                                  key={p.id}
                                  onClick={() => { setContent(p.content); setSelectedSeriesId(null); }}
                                  className="text-xs text-left p-2 hover:bg-gray-100 rounded-lg truncate border border-transparent hover:border-gray-200"
                                >
                                  {p.title}
                                </button>
                              ))}
                               <div className="flex gap-1 mt-2">
                                <button onClick={() => { setActiveSeriesId(s.id); handleUrlGenerate(true); }} className="text-[10px] bg-[#FFC300] text-black p-1 rounded">Next Part</button>
                                <button onClick={() => { setActiveSeriesId(s.id); setShowUrlSheet(true); }} className="text-[10px] bg-gray-200 text-gray-800 p-1 rounded">Custom</button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {navView === 'posts_history' && (
              <motion.div 
                key="posts_history"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex lg:flex-col gap-2 w-full"
              >
                <button onClick={() => setNavView('text')} className="nav-item-text text-[#FFC300] sticky left-0 z-10 bg-white">
                  <ChevronRight className="rotate-180" size={14} strokeWidth={3} />
                </button>
                
                <div className="flex lg:flex-col gap-2">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 py-1">Posts History</div>
                  {state.posts.filter(p => !p.seriesId).length === 0 ? (
                    <div className="text-xs text-gray-400 px-2 italic">No posts yet</div>
                  ) : (
                    state.posts.filter(p => !p.seriesId).map(p => (
                      <div key={p.id} className="group relative">
                        <button 
                          onClick={() => setContent(p.content)}
                          className="nav-item-text text-left pr-8"
                        >
                          <span className="truncate">{p.title}</span>
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); deletePost(p.id); }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>

      {/* Sheets & Overlays */}
      <AnimatePresence>
        {(showUrlSheet || showSystemSheet || showApiKeySheet || showOptionsSheet) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setShowUrlSheet(false); setShowSystemSheet(false); setShowApiKeySheet(false); setShowOptionsSheet(false); }}
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[100]"
          />
        )}
      </AnimatePresence>

      {/* Options Sheet */}
      <Sheet
        show={showOptionsSheet}
        onClose={() => setShowOptionsSheet(false)}
        title={`Options for ${PLATFORMS.find(p => p.id === pendingPlatform)?.label}`}
      >
        <div className="grid grid-cols-1 gap-3">
          <button 
            onClick={() => pendingPlatform && handleAdapt(pendingPlatform)}
            className="w-full bg-[#FF6B2B] text-white p-4 rounded-xl font-bold text-sm active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            <Sparkles size={18} />
            Adapt Current Text
          </button>
          <button 
            onClick={() => {
              if (pendingPlatform) setActivePlatform(pendingPlatform);
              setShowOptionsSheet(false);
              setShowUrlSheet(true);
            }}
            className="w-full bg-[#FFC300] text-black p-4 rounded-xl font-bold text-sm active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            <LinkIcon size={18} />
            Generate from URL
          </button>
        </div>
      </Sheet>

      {/* URL Sheet */}
      <Sheet 
        show={showUrlSheet} 
        onClose={() => setShowUrlSheet(false)} 
        title="URL to Post"
      >
        <div className="space-y-5">
          <input 
            type="text" 
            placeholder="URL to Post" 
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="mini-input" 
          />
          <textarea 
            placeholder="Custom instructions..." 
            value={urlInstructions}
            onChange={(e) => setUrlInstructions(e.target.value)}
            className="mini-input h-24 resize-none" 
          />
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-600">Post or series</span>
            <div 
              className={`w-11 h-5 rounded-full cursor-pointer transition-colors relative ${urlIsSeries ? 'bg-[#FF6B2B]' : 'bg-gray-200'}`}
              onClick={() => setUrlIsSeries(!urlIsSeries)}
            >
              <motion.div 
                animate={{ x: urlIsSeries ? 22 : 3 }}
                className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm"
              />
            </div>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-600">Deep Dive (Hashnode)</span>
            <div 
              className={`w-11 h-5 rounded-full cursor-pointer transition-colors relative ${isDeepDive ? 'bg-[#FF6B2B]' : 'bg-gray-200'}`}
              onClick={() => setIsDeepDive(!isDeepDive)}
            >
              <motion.div 
                animate={{ x: isDeepDive ? 22 : 3 }}
                className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm"
              />
            </div>
          </div>
          
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button 
              onClick={() => setIsAccordionOpen(!isAccordionOpen)}
              className="w-full p-4 flex items-center justify-between text-sm text-gray-600 font-medium bg-gray-50"
            >
              Reference Article (for style)
              {isAccordionOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {isAccordionOpen && (
              <div className="p-4 border-t border-gray-200">
                <input 
                  type="text" 
                  placeholder="Reference Article URL" 
                  value={referenceArticleUrl}
                  onChange={(e) => setReferenceArticleUrl(e.target.value)}
                  className="mini-input" 
                />
              </div>
            )}
          </div>

          <button 
            onClick={() => handleUrlGenerate(false, urlInstructions)}
            className="w-full bg-[#FFC300] text-black p-4 rounded-xl font-bold text-sm active:scale-95 transition-transform"
          >
            Generate from URL
          </button>
        </div>
      </Sheet>

      {/* System Sheet */}
      <Sheet 
        show={showSystemSheet} 
        onClose={() => setShowSystemSheet(false)} 
        title="System Prompt"
      >
        <div className="space-y-4">
          <textarea 
            value={state.systemPrompt}
            onChange={(e) => setState(prev => ({ ...prev!, systemPrompt: e.target.value }))}
            className="mini-input h-48 resize-none p-4" 
            placeholder="Enter system instructions for the model..." 
          />
          <button 
            onClick={() => setShowSystemSheet(false)}
            className="w-full bg-[#FFC300] text-black p-4 rounded-xl font-bold text-sm active:scale-95 transition-transform"
          >
            Update Prompt
          </button>
        </div>
      </Sheet>

      {/* API Key Sheet */}
      <Sheet 
        show={showApiKeySheet} 
        onClose={() => setShowApiKeySheet(false)} 
        title="Gemini API Key"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-500">Enter your custom Gemini API key if the environment one is not available.</p>
          <input 
            type="password"
            value={tempApiKey}
            onChange={(e) => setTempApiKey(e.target.value)}
            className="mini-input" 
            placeholder="AI Studio API Key" 
          />
          <button 
            onClick={() => {
              setState(prev => ({ ...prev!, customApiKey: tempApiKey }));
              setShowApiKeySheet(false);
            }}
            className="w-full bg-[#FFC300] text-black p-4 rounded-xl font-bold text-sm active:scale-95 transition-transform"
          >
            Save Key
          </button>
        </div>
      </Sheet>

      {/* Alert */}
      <AnimatePresence>
        {alert && (
          <motion.div 
            initial={{ y: 100, x: '-50%' }}
            animate={{ y: 0, x: '-50%' }}
            exit={{ y: 100, x: '-50%' }}
            className="fixed bottom-6 left-1/2 bg-white border border-gray-200 shadow-xl rounded-2xl p-4 flex items-center justify-between gap-4 w-[90%] max-w-[400px] z-[200]"
          >
            <div className="flex items-center gap-3">
              <Info className="text-blue-500" size={18} />
              <span className="text-xs font-medium text-gray-600">{alert}</span>
            </div>
            <button onClick={() => setAlert(null)} className="text-gray-300 hover:text-gray-500">
              <X size={14} strokeWidth={3} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        * {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        *::-webkit-scrollbar {
          display: none;
        }
        .nav-item-text {
          width: 100%;
          height: 3rem;
          display: flex;
          align-items: center;
          justify-content: center;
          background: white;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          border: 1px solid #e5e7eb;
          text-align: center;
          padding: 0 16px;
          font-size: 0.85rem;
          font-weight: 400;
          color: #6b7280;
          white-space: nowrap;
        }
        .nav-item-text:hover {
          transform: translateY(-2px);
          border-color: #d1d5db;
        }
        .mini-input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          font-size: 0.9rem;
          outline: none;
          transition: border-color 0.3s;
        }
        .mini-input:focus { border-color: #3b82f6; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

function Sheet({ show, onClose, title, children }: { show: boolean, onClose: () => void, title: string, children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div 
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed bottom-0 left-0 right-0 lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:bottom-auto bg-white border border-blue-500 rounded-t-[24px] lg:rounded-[24px] p-6 lg:p-8 z-[101] max-w-[500px] mx-auto w-full shadow-2xl"
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{title}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
