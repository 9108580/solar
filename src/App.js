import React, { useState, useEffect } from 'react';
import { 
  Calculator, Settings, Sun, User, FileText, CheckCircle, Zap, DollarSign, 
  Trash2, Plus, ChevronDown, ChevronUp, HardHat, BatteryCharging, 
  ShieldCheck, Activity, MapPin, Phone, TrendingUp, Award, Clock, Wrench, AlertCircle,
  Home, LineChart, Map, Gift, Users, LogOut, PenTool
} from 'lucide-react';

const BrandLogoSvg = ({ className }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <circle cx="50" cy="45" r="35" fill="url(#sun-grad)"/>
    <path d="M10 65 L90 65 L80 95 L20 95 Z" fill="#0D47A1"/>
    <path d="M30 65 L25 95 M50 65 L50 95 M70 65 L75 95" stroke="#64B5F6" strokeWidth="2"/>
    <path d="M15 80 L85 80" stroke="#64B5F6" strokeWidth="2"/>
    <path d="M50 95 C 100 95 100 45 90 35 C 80 85 50 95 50 95 Z" fill="#4CAF50"/>
    <defs>
      <linearGradient id="sun-grad" x1="50" y1="10" x2="50" y2="80" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFB300" />
        <stop offset="1" stopColor="#FF5252" />
      </linearGradient>
    </defs>
  </svg>
);

/** לוגו החברה (`public/brand-logo.png`); נופל חזרה ל-SVG פשוט אם הקובץ חסר */
const BrandLogo = ({ className }) => {
  const [imgFailed, setImgFailed] = React.useState(false);
  if (imgFailed) return <BrandLogoSvg className={className} />;
  return (
    <img
      src={`${process.env.PUBLIC_URL}/brand-logo.png`}
      alt="מומחי אנרגיה סולארית"
      className={className}
      onError={() => setImgFailed(true)}
    />
  );
};

// --- רכיב חתימה דיגיטלית (Canvas) ---
const SignaturePad = ({ onSave }) => {
  const canvasRef = React.useRef(null);
  const [isDrawing, setIsDrawing] = React.useState(false);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#1e293b'; // צבע כחול-אפור כהה (דיו)
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: e.nativeEvent.offsetX,
      y: e.nativeEvent.offsetY
    };
  };

  const startDrawing = (e) => {
    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveCanvas = () => {
    const canvas = canvasRef.current;
    onSave(canvas.toDataURL('image/png'));
  };

  return (
    <div className="flex flex-col items-center">
      <div className="bg-white border-2 border-dashed border-blue-200 rounded-2xl overflow-hidden mb-4 shadow-lg relative" style={{ boxShadow: '0 4px 24px rgba(59,130,246,0.1)' }}>
        <span className="absolute top-2 right-4 text-slate-300 text-xs select-none pointer-events-none font-medium">חתום כאן...</span>
        <canvas
          ref={canvasRef}
          width={350}
          height={160}
          className="touch-none bg-transparent cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={clearCanvas} className="px-5 py-2.5 text-slate-500 hover:bg-slate-100 rounded-xl font-semibold transition-colors text-sm border border-slate-200">נקה</button>
        <button type="button" onClick={saveCanvas} className="px-6 py-2.5 text-white rounded-xl font-bold shadow-lg transition-all hover:scale-[1.02] text-sm flex items-center gap-2"
          style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}>
          <PenTool className="w-4 h-4"/> שמור חתימה
        </button>
      </div>
    </div>
  );
};

/** מפתח localStorage — נשמר בדפדפן; עדכון באתר (Vercel) לא מוחק את הנתונים */
const ADMIN_SETTINGS_STORAGE_KEY = 'solar-final-admin-settings-v1';

const DEFAULT_ADMIN_PRICES = {
  panelPricePerWattUsd: 0.11,
  panelPowerWatts: 640,
  usdExchangeRate: 3.75,
  constructionConcretePerKw: 350,
  constructionOtherPerKw: 200,

  inverters: [
    { id: 'inv-se100', name: 'סולאראדג\' 100kW', cost: 15000, capacityKw: 100, isSolarEdge: true },
    { id: 'inv-se12', name: 'סולאראדג\' 12kW', cost: 4500, capacityKw: 12, isSolarEdge: true },
    { id: 'inv-sma110', name: 'SMA 110kW', cost: 14000, capacityKw: 110, isSolarEdge: false }
  ],

  invertersHybrid: [
    { id: 'hinv-se10', name: 'סולאראדג\' Home Hub 10kW', cost: 8500, capacityKw: 10, isSolarEdge: true },
    { id: 'hinv-deye12', name: 'Deye 12kW', cost: 7000, capacityKw: 12, isSolarEdge: false }
  ],

  batteries: [
    { id: 'bat-se10', name: 'סוללה SolarEdge 10kWh', cost: 18000 },
    { id: 'bat-byd5', name: 'סוללה BYD 5kWh', cost: 9500 }
  ],

  optimizerPrices: { se1to1: 250, se1to2: 350, tigo: 200 },
  logisticsCost: 3100, laborPerKw: 650, constructorEngineer: 500, hybridBatteryInstallCost: 5700,
  electricalBoxCommercialPerKw: 270, electricalBoxResidential: 870,
  washingSystemBase: 4500, feesCost: 3000, planningCost: 1400, profitResidentialFixed: 21000, profitCommercialPerKw: 630, vatRate: 18,
  productionHours: 1700,
  privateCheckResidential: 550, privateCheckCommercial: 800, electricianResidential: 750, electricianCommercial: 2000,
  acCableOnGridResidential: 300, acCableHybridResidential: 600, acCableCommercial: 3000, antennaCost: 180, communicationLine: 100,

  primeRate: 6.0,
  loanMargin: 4.0,

  companyPhone: '04-611-61-33',
  agents: [
    { id: 'ag-1', name: 'ישראל ישראלי', phone: '050-1234567', tz: '123456789' }
  ]
};

function mergeAdminSettingsFromStorage(saved, defaults) {
  if (!saved || typeof saved !== 'object') return defaults;
  return {
    ...defaults,
    ...saved,
    optimizerPrices: {
      ...defaults.optimizerPrices,
      ...(saved.optimizerPrices && typeof saved.optimizerPrices === 'object' ? saved.optimizerPrices : {})
    },
    inverters: Array.isArray(saved.inverters) ? saved.inverters : defaults.inverters,
    invertersHybrid: Array.isArray(saved.invertersHybrid) ? saved.invertersHybrid : defaults.invertersHybrid,
    batteries: Array.isArray(saved.batteries) ? saved.batteries : defaults.batteries,
    agents: Array.isArray(saved.agents) ? saved.agents : defaults.agents
  };
}

function loadAdminSettingsFromStorage() {
  if (typeof window === 'undefined') return DEFAULT_ADMIN_PRICES;
  try {
    const raw = window.localStorage.getItem(ADMIN_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_ADMIN_PRICES;
    return mergeAdminSettingsFromStorage(JSON.parse(raw), DEFAULT_ADMIN_PRICES);
  } catch {
    return DEFAULT_ADMIN_PRICES;
  }
}

export default function App() {
  // --- מערכת התחברות (Login) ---
  const [currentUser, setCurrentUser] = useState(null); // הופעל מחדש
  const [loginInput, setLoginInput] = useState('');
  const [loginError, setLoginError] = useState('');

  const [activeTab, setActiveTab] = useState('sales'); 
  const [openAdminSection, setOpenAdminSection] = useState('panels'); 
  
  const [adminPrices, setAdminPrices] = useState(loadAdminSettingsFromStorage);

  const [quoteForm, setQuoteForm] = useState({
    systemType: 'residential', 
    clientName: '',
    clientCity: '', 
    systemSizeKw: 22.5,
    systemSizeAcKw: 15, 
    roofType: 'concrete', 
    inverterSystemType: 'ongrid', 
    selectedInverters: [{ id: 'inv-se100', quantity: 1 }], 
    selectedHybridInverters: [{ id: 'hinv-se10', quantity: 1 }],
    includesBatteries: false,
    selectedBatteries: [{ id: 'bat-se10', quantity: 1 }],
    includesOptimizers: false,
    tigoQuantity: 0, 
    includesWashing: false,
    showLoanSimulation: true, 
    feesPayer: 'client', 
    
    specifyOrientation: false,
    panelsSouth: 0,
    panelsEastWest: 0,
    panelsNorth: 0,
    optimizerAcknowledge: false,
    additionalNotes: '',
  });

  const [generatedQuote, setGeneratedQuote] = useState(null);
  const [errorMsg, setErrorMsg] = useState(''); 
  const [currentTime, setCurrentTime] = useState(Date.now()); 
  const [clientSignature, setClientSignature] = useState(null); // סטייט לשמירת החתימה הדיגיטלית

  useEffect(() => {
    let interval = null;
    if (activeTab === 'quote' && generatedQuote) {
      interval = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeTab, generatedQuote]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(ADMIN_SETTINGS_STORAGE_KEY, JSON.stringify(adminPrices));
    } catch (_) {
      /* מקום אחסון מלא או דפדפן פרטי */
    }
  }, [adminPrices]);

  // --- פונקציית התחברות ---
  const handleLogin = (e) => {
    e.preventDefault();
    if (loginInput === 'admin') {
      setCurrentUser({ role: 'admin', data: null });
      setActiveTab('sales');
      setLoginInput('');
    } else {
      const agent = adminPrices.agents.find(a => a.tz === loginInput);
      if (agent) {
        setCurrentUser({ role: 'agent', data: agent });
        setActiveTab('sales');
        setLoginInput('');
      } else {
        setLoginError('מספר תעודת זהות לא נמצא במערכת. אנא פנה להנהלה.');
      }
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setGeneratedQuote(null);
    setLoginInput('');
  };

  /** אחרי שמירת חתימה: פותח וואטסאפ לסוכן (או טלפון החברה) עם טקסט מוכן — הלקוח רק לוחץ «שלח». ללא שרת אין שליחה אוטומטית אמיתית. */
  const handleClientSignatureSaved = (imgData) => {
    setClientSignature(imgData);
    const gq = generatedQuote;
    if (!gq) return;
    const phoneRaw = gq.agentDetails ? gq.agentDetails.phone : adminPrices.companyPhone;
    let clean = String(phoneRaw || '').replace(/\D/g, '');
    if (clean.startsWith('0')) clean = '972' + clean.slice(1);
    if (!clean) return;
    const client = (gq.clientName || '').trim() || 'לקוח';
    const cityPart = (gq.clientCity || '').trim() ? ` מ${(gq.clientCity || '').trim()}` : '';
    const dateStr = new Date().toLocaleString('he-IL');
    const body = `היי, הלקוח ${client}${cityPart} חתם/ה עכשיו על חתימה דיגיטלית (אישור עקרוני) בהצעת המחיר.\nתאריך ושעה: ${dateStr}\nמומלץ ליצור קשר לשלב הבא.`;
    window.open(`https://wa.me/${clean}?text=${encodeURIComponent(body)}`, '_blank', 'noopener,noreferrer');
  };

  // --- עזרי תצוגה טרום-חישוב (לשימוש בטופס הסוכן) ---
  const panelPowerConst = Number(adminPrices.panelPowerWatts) || 640;
  const currentCalculatedPanels = Math.round(((parseFloat(quoteForm.systemSizeKw) || 0) * 1000) / panelPowerConst) || 0;
  
  const pSouthInput = Number(quoteForm.panelsSouth) || 0;
  const pEWInput = Number(quoteForm.panelsEastWest) || 0;
  const pNorthInput = Number(quoteForm.panelsNorth) || 0;
  const currentDistributedPanels = pSouthInput + pEWInput + pNorthInput;

  const baseProductionHours = Number(adminPrices.productionHours) > 0 ? Number(adminPrices.productionHours) : 1700;
  const liveSouthH = baseProductionHours;
  const liveEWH = baseProductionHours * 0.85;
  const liveNorthH = baseProductionHours * 0.65;
  let liveAvgH = baseProductionHours;
  if (currentDistributedPanels > 0) {
    liveAvgH = ((pSouthInput * liveSouthH) + (pEWInput * liveEWH) + (pNorthInput * liveNorthH)) / currentDistributedPanels;
  }

  let requiredOptimizersForSmallArrays = 0;
  if (pSouthInput > 0 && pSouthInput < 6) requiredOptimizersForSmallArrays += pSouthInput;
  if (pEWInput > 0 && pEWInput < 6) requiredOptimizersForSmallArrays += pEWInput;
  if (pNorthInput > 0 && pNorthInput < 6) requiredOptimizersForSmallArrays += pNorthInput;

  const handleAdminChange = (e) => {
    const { name, value } = e.target;
    if (name === 'companyPhone') {
      setAdminPrices(prev => ({ ...prev, [name]: value }));
    } else {
      setAdminPrices(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    }
  };

  const handleOptimizerPriceChange = (e) => {
    const { name, value } = e.target;
    setAdminPrices(prev => ({ ...prev, optimizerPrices: { ...prev.optimizerPrices, [name]: parseFloat(value) || 0 } }));
  };

  const updateAdminListItem = (listName, id, field, value) => {
    setAdminPrices(prev => ({ ...prev, [listName]: prev[listName].map(item => item.id === id ? { ...item, [field]: value } : item) }));
  };

  const removeAdminListItem = (listName, id) => {
    setAdminPrices(prev => ({ ...prev, [listName]: prev[listName].filter(item => item.id !== id) }));
  };

  const addAdminListItem = (listName, newItemTemplate) => {
    setAdminPrices(prev => ({ ...prev, [listName]: [...prev[listName], { ...newItemTemplate, id: `${listName}-${Date.now()}` }] }));
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;
    
    setQuoteForm(prev => {
      const newState = { ...prev, [name]: val };
      if (['panelsSouth', 'panelsEastWest', 'panelsNorth'].includes(name)) {
        newState.optimizerAcknowledge = false;
      }
      return newState;
    });
    
    if (name === 'specifyOrientation' && !checked) {
      setErrorMsg('');
    }
  };

  const handleDcSizeChange = (e) => {
    const val = parseFloat(e.target.value) || 0;
    const autoAc = val <= 15 ? 15 : (val / 3) * 2;
    setQuoteForm(prev => ({ 
      ...prev, 
      systemSizeKw: e.target.value,
      systemSizeAcKw: autoAc.toFixed(2)
    }));
  };

  const handleQuoteListChange = (listName, index, field, value) => {
    const updatedList = [...quoteForm[listName]];
    updatedList[index][field] = field === 'quantity' ? (parseInt(value) || 1) : value;
    setQuoteForm(prev => ({ ...prev, [listName]: updatedList }));
  };

  const addQuoteListItem = (formListName, adminListName) => {
    if (adminPrices[adminListName].length === 0) return;
    setQuoteForm(prev => ({ ...prev, [formListName]: [...prev[formListName], { id: adminPrices[adminListName][0].id, quantity: 1 }] }));
  };

  const removeQuoteListItem = (formListName, index) => {
    setQuoteForm(prev => ({ ...prev, [formListName]: prev[formListName].filter((_, i) => i !== index) }));
  };

  const getSolarEdgeStatus = () => {
    let hasSolarEdge = false;
    let maxSECapacity = 0;
    const activeInvertersForm = quoteForm.inverterSystemType === 'hybrid' ? quoteForm.selectedHybridInverters : quoteForm.selectedInverters;
    const activeInvertersAdmin = quoteForm.inverterSystemType === 'hybrid' ? adminPrices.invertersHybrid : adminPrices.inverters;

    activeInvertersForm.forEach(sel => {
      const invData = activeInvertersAdmin.find(i => i.id === sel.id);
      if (invData && invData.isSolarEdge && sel.quantity > 0) {
        hasSolarEdge = true;
        if (invData.capacityKw > maxSECapacity) { maxSECapacity = invData.capacityKw; }
      }
    });
    return { hasSolarEdge, maxSECapacity };
  };

  const calculateTariff = (acSize) => {
    const numSize = parseFloat(acSize);
    if (isNaN(numSize) || numSize <= 0) return 0;
    
    let totalCents = 0;
    let remaining = numSize;

    if (remaining > 300) {
      totalCents += (remaining - 300) * 28.44;
      remaining = 300;
    }
    if (remaining > 100) {
      totalCents += (remaining - 100) * 34.37;
      remaining = 100;
    }
    if (remaining > 15) {
      totalCents += (remaining - 15) * 37.31;
      remaining = 15;
    }
    if (remaining > 0) {
      totalCents += remaining * 48.00;
    }
    return (totalCents / numSize) / 100;
  };

  const calculateQuote = (e) => {
    e.preventDefault();
    
    const sizeKw = parseFloat(quoteForm.systemSizeKw) || 0;
    const acKw = parseFloat(quoteForm.systemSizeAcKw) || 15;
    const systemSizeWatts = sizeKw * 1000; 
    
    const panelPower = Number(adminPrices.panelPowerWatts) || 640;
    const numPanels = Math.round(systemSizeWatts / panelPower);

    const rawAmps = acKw * 1.44 * 1.10;
    const standardAmps = [25, 40, 63, 80, 100, 160, 200, 250, 315, 400, 630, 800, 1000, 1250, 1600];
    let requiredConnectionAmps = standardAmps[standardAmps.length - 1]; 
    for (let i = 0; i < standardAmps.length; i++) {
      if (standardAmps[i] >= rawAmps) {
        requiredConnectionAmps = standardAmps[i];
        break;
      }
    }
    if (rawAmps > requiredConnectionAmps) {
       requiredConnectionAmps = Math.ceil(rawAmps);
    }

    const panelsCost = systemSizeWatts * (Number(adminPrices.panelPricePerWattUsd) || 0.11) * (Number(adminPrices.usdExchangeRate) || 3.75);
    const constructionCost = sizeKw * (quoteForm.roofType === 'concrete' ? (Number(adminPrices.constructionConcretePerKw) || 350) : (Number(adminPrices.constructionOtherPerKw) || 200));
    
    let totalInvertersCost = 0;
    const inverterDetailsList = [];
    const isHybridSystem = quoteForm.inverterSystemType === 'hybrid';
    const activeInvertersForm = isHybridSystem ? quoteForm.selectedHybridInverters : quoteForm.selectedInverters;
    const activeInvertersAdmin = isHybridSystem ? adminPrices.invertersHybrid : adminPrices.inverters;

    activeInvertersForm.forEach(sel => {
      const invData = activeInvertersAdmin.find(i => i.id === sel.id);
      if (invData && sel.quantity > 0) {
        totalInvertersCost += (Number(invData.cost) || 0) * sel.quantity;
        inverterDetailsList.push({ name: invData.name, quantity: sel.quantity, isHybrid: isHybridSystem, isSolarEdge: invData.isSolarEdge });
      }
    });

    let totalBatteriesCost = 0;
    const batteryDetailsList = [];
    const hasBatteries = isHybridSystem && quoteForm.includesBatteries;
    
    if (hasBatteries) {
      quoteForm.selectedBatteries.forEach(sel => {
        const batData = adminPrices.batteries.find(b => b.id === sel.id);
        if (batData && sel.quantity > 0) {
          totalBatteriesCost += (Number(batData.cost) || 0) * sel.quantity;
          batteryDetailsList.push({ name: batData.name, quantity: sel.quantity });
        }
      });
    }
    
    let optimizersCost = 0;
    let optimizerDetails = { type: 'ללא', quantity: 0 };
    if (quoteForm.includesOptimizers) {
      const seStatus = getSolarEdgeStatus();
      if (seStatus.hasSolarEdge) {
        if (seStatus.maxSECapacity > 15) {
          const optQty = Math.ceil(numPanels / 2);
          optimizersCost = optQty * (Number(adminPrices.optimizerPrices?.se1to2) || 350);
          optimizerDetails = { type: 'SolarEdge 1:2', quantity: optQty };
        } else {
          const optQty = numPanels;
          optimizersCost = optQty * (Number(adminPrices.optimizerPrices?.se1to1) || 250);
          optimizerDetails = { type: 'SolarEdge 1:1', quantity: optQty };
        }
      } else {
        const optQty = parseInt(quoteForm.tigoQuantity) || 0;
        optimizersCost = optQty * (Number(adminPrices.optimizerPrices?.tigo) || 200);
        optimizerDetails = { type: 'Tigo (טייגו)', quantity: optQty };
      }
    }

    const logisticsCost = Number(adminPrices.logisticsCost) || 3100;
    let laborCost = sizeKw * (Number(adminPrices.laborPerKw) || 650);
    if (hasBatteries) laborCost += (Number(adminPrices.hybridBatteryInstallCost) || 5700); 

    const engineeringCost = (Number(adminPrices.planningCost) || 1400) + (Number(adminPrices.constructorEngineer) || 500);
    const privateCheckCost = quoteForm.systemType === 'residential' ? (Number(adminPrices.privateCheckResidential) || 550) : (Number(adminPrices.privateCheckCommercial) || 800);
    const electricianCost = quoteForm.systemType === 'residential' ? (Number(adminPrices.electricianResidential) || 750) : (Number(adminPrices.electricianCommercial) || 2000);
    
    let acCableCost = 0;
    if (quoteForm.systemType === 'residential') {
        acCableCost = isHybridSystem ? (Number(adminPrices.acCableHybridResidential) || 600) : (Number(adminPrices.acCableOnGridResidential) || 300);
    } else {
        acCableCost = Number(adminPrices.acCableCommercial) || 3000;
    }
    const accessoriesCost = acCableCost + (Number(adminPrices.antennaCost) || 180) + (Number(adminPrices.communicationLine) || 100);
    
    const electricalBoxCost = quoteForm.systemType === 'residential' 
      ? (Number(adminPrices.electricalBoxResidential) || 870) 
      : sizeKw * (Number(adminPrices.electricalBoxCommercialPerKw) || 270);

    const washingCost = quoteForm.includesWashing ? (Number(adminPrices.washingSystemBase) || 4500) : 0;
    const feesCost = quoteForm.feesPayer === 'company' ? (Number(adminPrices.feesCost) || 3000) : 0;
    
    const totalBaseCost = panelsCost + constructionCost + totalInvertersCost + totalBatteriesCost + optimizersCost + 
                          logisticsCost + laborCost + engineeringCost + privateCheckCost + 
                          electricianCost + accessoriesCost + electricalBoxCost + washingCost + feesCost;
    
    let profitValue = quoteForm.systemType === 'residential' ? (Number(adminPrices.profitResidentialFixed) || 21000) : (sizeKw * (Number(adminPrices.profitCommercialPerKw) || 630));
    
    const finalPrice = (totalBaseCost + profitValue) || 0;

    const calculatedTariff = calculateTariff(acKw);
    const baseProductionHours = Number(adminPrices.productionHours) > 0 ? Number(adminPrices.productionHours) : 1700;
    let productionHoursValid = baseProductionHours;
    let orientationDetails = null;

    if (quoteForm.specifyOrientation) {
      const pSouth = Number(quoteForm.panelsSouth) || 0;
      const pEW = Number(quoteForm.panelsEastWest) || 0;
      const pNorth = Number(quoteForm.panelsNorth) || 0;
      const sumPanels = pSouth + pEW + pNorth;
      
      if (sumPanels !== numPanels) {
         setErrorMsg(`שגיאה: סך הפאנלים שהוזנו לכיווני האוויר (${sumPanels}) אינו תואם לסך הפאנלים במערכת (${numPanels}). אנא תקן את החלוקה כדי להמשיך.`);
         return; 
      }

      if (requiredOptimizersForSmallArrays > 0 && !quoteForm.optimizerAcknowledge) {
         setErrorMsg(`שגיאה: חלוקת הפאנלים דורשת התקנת ${requiredOptimizersForSmallArrays} אופטימייזרים לפחות. אנא סמן "V" בתיבת האישור שמתחת לכיווני האוויר.`);
         return;
      }
      
      productionHoursValid = ((pSouth * liveSouthH) + (pEW * liveEWH) + (pNorth * liveNorthH)) / numPanels;
      orientationDetails = { pSouth, southHours: liveSouthH, pEW, ewHours: liveEWH, pNorth, northHours: liveNorthH };
    }
    
    setErrorMsg('');
    setClientSignature(null); // איפוס חתימה בכל הפקה מחדש של ההצעה

    const estimatedYearlyProductionKwhYear1 = sizeKw * productionHoursValid;
    const estimatedYearlySavingsYear1 = estimatedYearlyProductionKwhYear1 * calculatedTariff;
    
    const vatRate = Number(adminPrices.vatRate) || 18;
    const initialInvestment = quoteForm.systemType === 'residential' ? finalPrice * (1 + vatRate / 100) : finalPrice;

    let roiYears = 0;
    let annualYield = 0;
    if (estimatedYearlySavingsYear1 > 0 && initialInvestment > 0) {
      roiYears = initialInvestment / estimatedYearlySavingsYear1;
      annualYield = (estimatedYearlySavingsYear1 / initialInvestment) * 100;
    }

    const primeRate = Number(adminPrices.primeRate) || 6.0;
    const loanMargin = Number(adminPrices.loanMargin) || 4.0;
    const annualInterestRate = (primeRate + loanMargin) / 100;
    const degradationRate = 0.0033;
    
    let remainingDebt = initialInvestment;
    let currentYearIncome = estimatedYearlySavingsYear1;
    const loanSimulation = [];
    
    for (let year = 1; year <= 25; year++) {
      if (year > 1) {
        currentYearIncome = currentYearIncome * (1 - degradationRate);
      }
      
      let yearlyRepaymentAccumulator = 0;
      let monthlyIncome = currentYearIncome / 12;

      for(let m = 0; m < 12; m++) {
         if (remainingDebt > 0) {
           let interestAccrued = remainingDebt * (annualInterestRate / 12);
           remainingDebt += interestAccrued;
           
           if (monthlyIncome >= remainingDebt) {
              yearlyRepaymentAccumulator += remainingDebt;
              remainingDebt = 0;
           } else {
              yearlyRepaymentAccumulator += monthlyIncome;
              remainingDebt -= monthlyIncome;
           }
         }
      }
      
      let netProfit = currentYearIncome - yearlyRepaymentAccumulator;

      loanSimulation.push({
        year: year,
        income: currentYearIncome,
        repayment: yearlyRepaymentAccumulator,
        netProfit: netProfit
      });
    }

    const getCumulativeIncomeWithDegradation = (years) => {
      let total = 0;
      let current = estimatedYearlySavingsYear1;
      for(let i=1; i<=years; i++){
         total += current;
         current *= (1 - degradationRate);
      }
      return total;
    };

    const graphData = [
      { year: 0, flow: -initialInvestment }, 
      { year: 5, flow: getCumulativeIncomeWithDegradation(5) - initialInvestment },
      { year: 10, flow: getCumulativeIncomeWithDegradation(10) - initialInvestment },
      { year: 15, flow: getCumulativeIncomeWithDegradation(15) - initialInvestment },
      { year: 20, flow: getCumulativeIncomeWithDegradation(20) - initialInvestment },
      { year: 25, flow: getCumulativeIncomeWithDegradation(25) - initialInvestment },
    ];
    
    const maxProfit = Math.max(1, ...graphData.map(d => d.flow || 0));
    const minLoss = Math.min(0, ...graphData.map(d => d.flow || 0));

    // הגדרת זמן תפוגה להטבה (7 ימים מהפקת ההצעה)
    const offerExpiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);

    setGeneratedQuote({
      ...quoteForm,
      calculatedNumPanels: numPanels,
      panelPowerWatts: adminPrices.panelPowerWatts,
      productionHoursValid,
      orientationDetails,
      inverterDetailsList,
      batteryDetailsList,
      optimizerDetails,
      hasBatteries,
      calculatedTariff,
      requiredConnectionAmps,
      estimatedYearlyProductionKwh: estimatedYearlyProductionKwhYear1,
      estimatedYearlySavings: estimatedYearlySavingsYear1,
      roiYears,
      annualYield,
      graphData,
      maxProfit,
      minLoss,
      loanSettings: { primeRate, loanMargin, annualInterestRate: primeRate + loanMargin },
      loanSimulation,
      breakdown: {
        panels: panelsCost, construction: constructionCost, inverter: totalInvertersCost, batteries: totalBatteriesCost,
        optimizers: optimizersCost, logistics: logisticsCost, labor: laborCost, engineering: engineeringCost,
        electricianAndChecks: privateCheckCost + electricianCost, electricalBoxes: electricalBoxCost, accessories: accessoriesCost,
        washing: washingCost, fees: feesCost, totalCost: totalBaseCost, marginValue: profitValue, finalPrice: finalPrice
      },
      hasSolarEdgeQuote: inverterDetailsList.some(inv => inv.isSolarEdge),
      offerExpiresAt: offerExpiresAt,
      // שמירת פרטי הסוכן שהפיק את ההצעה
      agentDetails: currentUser?.role === 'agent' ? currentUser.data : null
    });

    setActiveTab('quote');
    window.scrollTo(0, 0);
  };

  const seStatusDisplay = getSolarEdgeStatus();

  // חישוב זמן נותר להטבה (לתצוגת הטיימר)
  let timeLeft = { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  if (generatedQuote && generatedQuote.offerExpiresAt) {
    const distance = generatedQuote.offerExpiresAt - currentTime;
    if (distance > 0) {
      timeLeft = {
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000),
        expired: false
      };
    }
  }

  // הגדרת הטלפון עבור הווטסאפ (סוכן או חברה)
  const activePhoneForQuote = generatedQuote?.agentDetails ? generatedQuote.agentDetails.phone : adminPrices.companyPhone;
  // כשמערכת שטיפה כבר בהצעה — ההטבה בבאנר היא תוספת אופטימייזרים; אחרת מתנת שטיפה
  const limitedOfferHighlightShort = generatedQuote?.includesWashing
    ? 'תוספת אופטימייזרים לפי הצורך לתפוקה מקסימלית במקומות מוצללים'
    : 'מערכת שטיפה אוטומטית בשווי 6,500 ₪';
  const whatsappBenefitPhrase = generatedQuote?.includesWashing
    ? 'תוספת האופטימייזרים לפי הצורך לתפוקה מקסימלית במקומות מוצללים'
    : 'מערכת השטיפה במתנה';
  const whatsappMessage = encodeURIComponent(`שלום, אני ${generatedQuote?.clientName ? generatedQuote.clientName : ''} ${generatedQuote?.clientCity ? `מ${generatedQuote.clientCity}` : ''}. עברתי על הצעת המחיר למערכת סולארית ואני מעוניין/ת להתקדם ולנצל את ההטבה של ${whatsappBenefitPhrase}! אשמח שתיצרו איתי קשר.`);
  
  // עיבוד חכם של מספר הטלפון לוואטסאפ (תמיכה אוטומטית במספרים שמתחילים ב-0 והמרתם ל-972)
  let cleanPhone = (activePhoneForQuote || '').replace(/\D/g, '');
  if (cleanPhone.startsWith('0')) {
    cleanPhone = '972' + cleanPhone.slice(1);
  }
  const whatsappLink = `https://wa.me/${cleanPhone}?text=${whatsappMessage}`;

  // --- מסך התחברות (Login Screen) ---
  if (!currentUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden" dir="rtl"
           style={{ background: 'linear-gradient(135deg, #050c1a 0%, #0b1628 50%, #0a1a30 100%)' }}>
         {/* Background photo */}
         <div className="absolute inset-0 z-0 opacity-[0.12]" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1509391366360-120953a17a74?auto=format&fit=crop&q=80&w=1600')", backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
         {/* Radial glow */}
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-20 pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.35) 0%, transparent 70%)' }}></div>
         
         <div className="relative z-10 w-full max-w-[420px] text-center animation-fade-in">
            {/* Logo above card */}
            <div className="flex flex-col items-center mb-8">
              <div className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl border border-white/15 shadow-2xl mb-5 inline-block">
                <BrandLogo className="h-16 w-16" />
              </div>
              <h1 className="text-2xl font-black text-white tracking-wide">מומחי אנרגיה סולארית</h1>
            </div>

            {/* Login card */}
            <div className="overflow-hidden rounded-3xl shadow-[0_30px_80px_rgba(0,0,0,0.6)] border border-white/10"
                 style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)', backdropFilter: 'blur(20px)' }}>
               {/* gradient accent line */}
               <div className="h-1 w-full" style={{ background: 'linear-gradient(to right, #1d4ed8, #f97316, #fbbf24)' }}></div>
               
               <div className="p-10">
                 <h2 className="text-xl font-bold text-white mb-1 tracking-wide">כניסה למערכת</h2>
                 <p className="text-slate-400 mb-8 text-sm">הזן את מספר תעודת הזהות שלך להתחברות</p>
                 
                 <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                      <input 
                        type="text" 
                        value={loginInput}
                        onChange={(e) => {setLoginInput(e.target.value); setLoginError('');}}
                        placeholder="מספר ת.ז. / סיסמת מנהל"
                        className="w-full rounded-xl p-4 text-white outline-none text-center text-lg tracking-widest transition-all duration-200 border border-white/10 focus:border-blue-500/70"
                        style={{ background: 'rgba(0,0,0,0.35)' }}
                        onFocus={e => e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.25), 0 8px 30px rgba(0,0,0,0.4)'}
                        onBlur={e => e.target.style.boxShadow = 'none'}
                      />
                      {loginError && (
                        <div className="flex items-center gap-2 mt-3 text-red-400 text-sm font-medium bg-red-900/20 border border-red-500/20 p-3 rounded-xl">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{loginError}</span>
                        </div>
                      )}
                    </div>
                    <button type="submit"
                      className="w-full text-white font-black py-4 rounded-xl text-lg tracking-wide transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-blue-500/30"
                      style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}>
                      היכנס למערכת ←
                    </button>
                 </form>
               </div>
            </div>
         </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-200 font-sans p-4 md:p-8 relative" dir="rtl"
         style={{ background: 'linear-gradient(160deg, #060d1c 0%, #091526 50%, #0b1a2e 100%)' }}>
      {/* Ambient glow top-right */}
      <div className="fixed top-0 right-0 w-[500px] h-[500px] rounded-full opacity-10 pointer-events-none"
           style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.5) 0%, transparent 70%)' }}></div>
      {/* Ambient glow bottom-left */}
      <div className="fixed bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-8 pointer-events-none"
           style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.4) 0%, transparent 70%)' }}></div>

      <div className="max-w-5xl mx-auto relative z-10">
        
        {/* Header (Top Nav) */}
        <header className="flex items-center justify-between mb-10 print:hidden">
          {/* Left: Logo + Company Name */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute -inset-1 rounded-2xl opacity-40 blur-sm" style={{ background: 'linear-gradient(135deg, #f97316, #fbbf24)' }}></div>
              <div className="relative bg-white/10 backdrop-blur-sm rounded-xl p-2 border border-white/20 shadow-2xl">
                <BrandLogo className="h-11 w-11 object-contain" />
              </div>
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-black text-white tracking-wide leading-tight">מומחי אנרגיה סולארית</h1>
              <p className="text-blue-400/80 text-xs flex items-center gap-1.5 mt-0.5">
                <span className="inline-block w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]"></span>
                מחובר: {currentUser.role === 'admin' ? 'מנהל ראשי' : currentUser.data.name}
              </p>
            </div>
          </div>
          
          {/* Right: Navigation */}
          <nav className="flex items-center gap-1 rounded-2xl p-1.5 border border-white/10 shadow-xl"
               style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)' }}>
            <button onClick={() => setActiveTab('sales')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${activeTab === 'sales' || activeTab === 'quote' ? 'text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              style={activeTab === 'sales' || activeTab === 'quote' ? { background: 'linear-gradient(135deg, #1d4ed8, #2563eb)', boxShadow: '0 4px 15px rgba(59,130,246,0.4)' } : {}}>
              <Calculator className="w-4 h-4" /> מכירות
            </button>
            {currentUser.role === 'admin' && (
              <button onClick={() => setActiveTab('admin')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${activeTab === 'admin' ? 'text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                style={activeTab === 'admin' ? { background: 'linear-gradient(135deg, #1d4ed8, #2563eb)', boxShadow: '0 4px 15px rgba(59,130,246,0.4)' } : {}}>
                <Settings className="w-4 h-4" /> ניהול עלויות
              </button>
            )}
            <div className="w-px h-6 bg-white/10 mx-1"></div>
            <button onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200 font-medium">
              <LogOut className="w-4 h-4" /> התנתק
            </button>
          </nav>
        </header>

        <main>
          {/* ================= ADMIN TAB ================= */}
          {activeTab === 'admin' && currentUser.role === 'admin' && (
            <div className="space-y-4 animation-fade-in">
              <div className="mb-8 pb-6 border-b border-white/8">
                <h2 className="text-2xl font-black text-white mb-2 flex items-center gap-3">
                  <span className="text-orange-400"><Settings className="w-6 h-6"/></span>
                  הגדרות בסיס ומחירון
                </h2>
                <p className="text-slate-500">הזן את מחירי העלות של הרכיבים. כל העלויות המוזנות צריכות להיות לפני מע"מ.</p>
                <p className="text-slate-600 text-sm mt-2 max-w-2xl">הגדרות המחירון והסוכנים נשמרות אוטומטית בדפדפן (במחשב זה) ונשארות גם אחרי עדכון האתר. מחשב אחר או דפדפן אחר מתחילים מברירת מחדל — לשיתוף צוות נדרש שרת בעתיד.</p>
              </div>

              {/* 1. ניהול סוכנים (חדש) */}
              <div className="rounded-2xl overflow-hidden shadow-xl transition-all border border-white/8"
                   style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.025) 100%)' }}>
                <button onClick={() => setOpenAdminSection(prev => prev === 'agents' ? null : 'agents')} className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3"><Users className="w-5 h-5 text-orange-400" /><h3 className="text-lg font-semibold text-white">ניהול סוכני מכירות</h3></div>
                  {openAdminSection === 'agents' ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </button>
                {openAdminSection === 'agents' && (
                  <div className="p-6 pt-2 border-t border-white/8 space-y-4">
                    <p className="text-sm text-slate-400 mb-4">הוסף את הסוכנים של החברה. תעודת הזהות תשמש כסיסמת ההתחברות שלהם. בעת הפקת הצעת מחיר, פרטי הסוכן והטלפון שלו יופיעו אוטומטית בהצעה ובלחצן הווטסאפ.</p>
                    <div className="space-y-3">
                      {adminPrices.agents.map(agent => (
                        <div key={agent.id} className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 bg-black/20 border border-white/8 rounded-xl items-end relative pr-10 md:pr-4">
                          <button onClick={() => removeAdminListItem('agents', agent.id)} className="absolute top-4 right-4 text-slate-500 hover:text-red-400 transition-colors"><Trash2 className="w-5 h-5" /></button>
                          <div><label className="text-slate-500 text-xs block mb-1">שם מלא</label><input type="text" value={agent.name} onChange={(e) => updateAdminListItem('agents', agent.id, 'name', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-blue-500/60 transition-all" placeholder="שם הסוכן" /></div>
                          <div><label className="text-slate-500 text-xs block mb-1">טלפון (לווטסאפ)</label><input type="text" value={agent.phone} onChange={(e) => updateAdminListItem('agents', agent.id, 'phone', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-blue-500/60 transition-all" placeholder="050-0000000" dir="ltr" /></div>
                          <div><label className="text-slate-500 text-xs block mb-1">מספר ת"ז (להתחברות)</label><input type="text" value={agent.tz} onChange={(e) => updateAdminListItem('agents', agent.id, 'tz', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-blue-500/60 transition-all font-mono tracking-widest text-center" /></div>
                        </div>
                      ))}
                      <button onClick={() => addAdminListItem('agents', { name: 'סוכן חדש', phone: '050-', tz: '' })} className="w-full mt-2 flex items-center justify-center gap-2 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 text-orange-400 p-3 rounded-xl font-medium transition-all">
                        <Plus className="w-5 h-5" /> הוסף סוכן למערכת
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. פאנלים והמרות */}
              <div className="rounded-2xl overflow-hidden shadow-xl transition-all border border-white/8"
                   style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.025) 100%)' }}>
                <button onClick={() => setOpenAdminSection(prev => prev === 'panels' ? null : 'panels')} className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3"><Zap className="w-5 h-5 text-blue-400" /><h3 className="text-lg font-semibold text-white">פאנלים והמרות מטבע</h3></div>
                  {openAdminSection === 'panels' ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </button>
                {openAdminSection === 'panels' && (
                  <div className="p-6 pt-2 border-t border-white/8 space-y-4">
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-sm text-slate-400 mb-1">הספק פאנל בודד (וואט)</label>
                        <input type="number" name="panelPowerWatts" value={adminPrices.panelPowerWatts} onChange={handleAdminChange} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-blue-500/60 transition-all" />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm text-slate-400 mb-1">שעות שמש בשנה (לחישוב הכנסה)</label>
                        <input type="number" name="productionHours" value={adminPrices.productionHours} onChange={handleAdminChange} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-blue-500/60 transition-all" />
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-sm text-slate-400 mb-1">מחיר פאנלים (וואט/$)</label>
                        <input type="number" step="0.001" name="panelPricePerWattUsd" value={adminPrices.panelPricePerWattUsd} onChange={handleAdminChange} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-blue-500/60 transition-all" />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm text-slate-400 mb-1">שער דולר (₪)</label>
                        <input type="number" step="0.01" name="usdExchangeRate" value={adminPrices.usdExchangeRate} onChange={handleAdminChange} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-blue-500/60 transition-all" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. קונסטרוקציה */}
              <div className="rounded-2xl overflow-hidden shadow-xl transition-all border border-white/8"
                   style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.025) 100%)' }}>
                <button onClick={() => setOpenAdminSection(prev => prev === 'construction' ? null : 'construction')} className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3"><Sun className="w-5 h-5 text-blue-400" /><h3 className="text-lg font-semibold text-white">עלויות קונסטרוקציה</h3></div>
                  {openAdminSection === 'construction' ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </button>
                {openAdminSection === 'construction' && (
                  <div className="p-6 pt-2 border-t border-white/8 space-y-3">
                    <div className="flex items-center gap-3"><span className="text-sm text-slate-300 w-1/2">גג בטון (₪ ל-kWp)</span><input type="number" name="constructionConcretePerKw" value={adminPrices.constructionConcretePerKw} onChange={handleAdminChange} className="w-1/2 bg-white/5 border border-white/10 rounded-xl p-2 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                    <div className="flex items-center gap-3"><span className="text-sm text-slate-300 w-1/2">גג אחר (₪ ל-kWp)</span><input type="number" name="constructionOtherPerKw" value={adminPrices.constructionOtherPerKw} onChange={handleAdminChange} className="w-1/2 bg-white/5 border border-white/10 rounded-xl p-2 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                  </div>
                )}
              </div>

              {/* 4. אופטימייזרים */}
              <div className="rounded-2xl overflow-hidden shadow-xl transition-all border border-white/8"
                   style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.025) 100%)' }}>
                <button onClick={() => setOpenAdminSection(prev => prev === 'optimizers' ? null : 'optimizers')} className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3"><CheckCircle className="w-5 h-5 text-blue-400" /><h3 className="text-lg font-semibold text-white">מחירון אופטימייזרים</h3></div>
                  {openAdminSection === 'optimizers' ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </button>
                {openAdminSection === 'optimizers' && (
                  <div className="p-6 pt-2 border-t border-white/8 space-y-3">
                    <div className="flex items-center gap-3"><span className="text-sm text-slate-300 w-1/2">SolarEdge 1:1 (₪)</span><input type="number" name="se1to1" value={adminPrices.optimizerPrices.se1to1} onChange={handleOptimizerPriceChange} className="w-1/2 bg-white/5 border border-white/10 rounded-xl p-2 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                    <div className="flex items-center gap-3"><span className="text-sm text-slate-300 w-1/2">SolarEdge 1:2 (₪)</span><input type="number" name="se1to2" value={adminPrices.optimizerPrices.se1to2} onChange={handleOptimizerPriceChange} className="w-1/2 bg-white/5 border border-white/10 rounded-xl p-2 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                    <div className="flex items-center gap-3"><span className="text-sm text-slate-300 w-1/2">טייגו (Tigo) (₪)</span><input type="number" name="tigo" value={adminPrices.optimizerPrices.tigo} onChange={handleOptimizerPriceChange} className="w-1/2 bg-white/5 border border-white/10 rounded-xl p-2 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                  </div>
                )}
              </div>

              {/* 5. ניהול ממירים */}
              <div className="rounded-2xl overflow-hidden shadow-xl transition-all border border-white/8"
                   style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.025) 100%)' }}>
                <button onClick={() => setOpenAdminSection(prev => prev === 'inverters' ? null : 'inverters')} className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3"><Settings className="w-5 h-5 text-blue-400" /><h3 className="text-lg font-semibold text-white">מחירון ממירים</h3></div>
                  {openAdminSection === 'inverters' ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </button>
                {openAdminSection === 'inverters' && (
                  <div className="p-6 pt-2 border-t border-white/8 space-y-6">
                    <div>
                      <h4 className="text-blue-300 font-bold mb-3 border-b border-white/10 pb-2">ממירי אונגריד (On-Grid)</h4>
                      <div className="space-y-3">
                        {adminPrices.inverters.map(inv => (
                          <div key={inv.id} className="p-3 bg-black/20 border border-white/8 rounded-xl space-y-3">
                            <div className="flex items-center gap-2">
                              <input type="text" value={inv.name} onChange={(e) => updateAdminListItem('inverters', inv.id, 'name', e.target.value)} className="flex-1 bg-transparent border-b border-white/15 p-1 text-white outline-none focus:border-blue-400 transition-all" placeholder="שם הממיר" />
                              <button onClick={() => removeAdminListItem('inverters', inv.id)} className="p-1 text-slate-500 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                            </div>
                            <div className="flex gap-2 text-sm">
                              <div className="flex-1"><label className="text-slate-500 text-xs block">הספק (kW)</label><input type="number" value={inv.capacityKw} onChange={(e) => updateAdminListItem('inverters', inv.id, 'capacityKw', parseFloat(e.target.value)||0)} className="w-full bg-white/5 border border-white/10 rounded-lg p-1.5 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                              <div className="flex-1"><label className="text-slate-500 text-xs block">עלות (₪)</label><input type="number" value={inv.cost} onChange={(e) => updateAdminListItem('inverters', inv.id, 'cost', parseFloat(e.target.value)||0)} className="w-full bg-white/5 border border-white/10 rounded-lg p-1.5 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer mt-1">
                              <input type="checkbox" checked={inv.isSolarEdge} onChange={(e) => updateAdminListItem('inverters', inv.id, 'isSolarEdge', e.target.checked)} className="w-4 h-4 accent-blue-500" />
                              <span className="text-xs text-blue-300">הגדר כממיר סולאראדג'</span>
                            </label>
                          </div>
                        ))}
                        <button onClick={() => addAdminListItem('inverters', { name: 'ממיר חדש', cost: 0, capacityKw: 10, isSolarEdge: false })} className="w-full mt-2 flex items-center justify-center gap-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 p-2 rounded-xl text-sm transition-all">
                          <Plus className="w-4 h-4" /> הוסף ממיר אונגריד
                        </button>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-blue-300 font-bold mb-3 border-b border-white/10 pb-2">ממירים היברידיים (Hybrid)</h4>
                      <div className="space-y-3">
                        {adminPrices.invertersHybrid.map(inv => (
                          <div key={inv.id} className="p-3 bg-black/20 border border-white/8 rounded-xl space-y-3">
                            <div className="flex items-center gap-2">
                              <input type="text" value={inv.name} onChange={(e) => updateAdminListItem('invertersHybrid', inv.id, 'name', e.target.value)} className="flex-1 bg-transparent border-b border-white/15 p-1 text-white outline-none focus:border-blue-400 transition-all" placeholder="שם הממיר" />
                              <button onClick={() => removeAdminListItem('invertersHybrid', inv.id)} className="p-1 text-slate-500 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                            </div>
                            <div className="flex gap-2 text-sm">
                              <div className="flex-1"><label className="text-slate-500 text-xs block">הספק (kW)</label><input type="number" value={inv.capacityKw} onChange={(e) => updateAdminListItem('invertersHybrid', inv.id, 'capacityKw', parseFloat(e.target.value)||0)} className="w-full bg-white/5 border border-white/10 rounded-lg p-1.5 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                              <div className="flex-1"><label className="text-slate-500 text-xs block">עלות (₪)</label><input type="number" value={inv.cost} onChange={(e) => updateAdminListItem('invertersHybrid', inv.id, 'cost', parseFloat(e.target.value)||0)} className="w-full bg-white/5 border border-white/10 rounded-lg p-1.5 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer mt-1">
                              <input type="checkbox" checked={inv.isSolarEdge} onChange={(e) => updateAdminListItem('invertersHybrid', inv.id, 'isSolarEdge', e.target.checked)} className="w-4 h-4 accent-blue-500" />
                              <span className="text-xs text-blue-300">הגדר כממיר סולאראדג'</span>
                            </label>
                          </div>
                        ))}
                        <button onClick={() => addAdminListItem('invertersHybrid', { name: 'ממיר היברידי חדש', cost: 0, capacityKw: 10, isSolarEdge: false })} className="w-full mt-2 flex items-center justify-center gap-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 p-2 rounded-xl text-sm transition-all">
                          <Plus className="w-4 h-4" /> הוסף ממיר היברידי
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 6. ניהול סוללות אגירה */}
              <div className="rounded-2xl overflow-hidden shadow-xl transition-all border border-white/8"
                   style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.025) 100%)' }}>
                <button onClick={() => setOpenAdminSection(prev => prev === 'batteries' ? null : 'batteries')} className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3"><BatteryCharging className="w-5 h-5 text-blue-400" /><h3 className="text-lg font-semibold text-white">מחירון סוללות אגירה</h3></div>
                  {openAdminSection === 'batteries' ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </button>
                {openAdminSection === 'batteries' && (
                  <div className="p-6 pt-2 border-t border-white/8 space-y-3">
                     {adminPrices.batteries.map(bat => (
                        <div key={bat.id} className="flex items-center gap-2 p-3 bg-black/20 border border-white/8 rounded-xl">
                          <input type="text" value={bat.name} onChange={(e) => updateAdminListItem('batteries', bat.id, 'name', e.target.value)} className="flex-1 bg-transparent text-white outline-none focus:border-blue-400 transition-all" />
                          <div className="flex items-center gap-1 border-r border-white/10 pr-2">
                             <span className="text-slate-400 text-sm">₪</span>
                             <input type="number" value={bat.cost} onChange={(e) => updateAdminListItem('batteries', bat.id, 'cost', parseFloat(e.target.value)||0)} className="w-24 bg-transparent text-white outline-none focus:border-blue-400 transition-all" />
                          </div>
                          <button onClick={() => removeAdminListItem('batteries', bat.id)} className="p-2 text-slate-500 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                     ))}
                     <button onClick={() => addAdminListItem('batteries', { name: 'סוללה חדשה', cost: 0 })} className="mt-3 flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors">
                        <Plus className="w-4 h-4" /> הוסף סוללה למחירון
                     </button>
                  </div>
                )}
              </div>

              {/* 7. עבודה, הובלות ואביזרים */}
              <div className="rounded-2xl overflow-hidden shadow-xl transition-all border border-white/8"
                   style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.025) 100%)' }}>
                <button onClick={() => setOpenAdminSection(prev => prev === 'labor' ? null : 'labor')} className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3"><HardHat className="w-5 h-5 text-blue-400" /><h3 className="text-lg font-semibold text-white">עבודה, הובלות ואביזרים</h3></div>
                  {openAdminSection === 'labor' ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </button>
                {openAdminSection === 'labor' && (
                  <div className="p-6 pt-2 border-t border-white/8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><label className="block text-sm text-slate-400 mb-1">הובלות ולוגיסטיקה (פיקס) - ₪</label><input type="number" name="logisticsCost" value={adminPrices.logisticsCost} onChange={handleAdminChange} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                      <div><label className="block text-sm text-slate-400 mb-1">עבודה התקנה (₪ לכל kWp)</label><input type="number" name="laborPerKw" value={adminPrices.laborPerKw} onChange={handleAdminChange} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                      <div><label className="block text-sm text-slate-400 mb-1">מהנדס קונסטרוקטור (פיקס) - ₪</label><input type="number" name="constructorEngineer" value={adminPrices.constructorEngineer} onChange={handleAdminChange} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                      <div><label className="block text-sm text-blue-300 font-medium mb-1">תוספת התקנה למערכת היברידית</label><input type="number" name="hybridBatteryInstallCost" value={adminPrices.hybridBatteryInstallCost} onChange={handleAdminChange} className="w-full bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-white/8 pt-4">
                       <h4 className="md:col-span-2 text-sm font-medium text-blue-300">בדיקות וחשמלאי (לפי סוג מערכת)</h4>
                       <div className="space-y-3 bg-black/20 p-4 rounded-xl border border-white/8">
                          <p className="text-xs text-slate-500 font-bold mb-2">מערכת ביתית:</p>
                          <div className="flex items-center gap-3"><span className="text-sm text-slate-400 w-1/2">בדיקה פרטית (₪)</span><input type="number" name="privateCheckResidential" value={adminPrices.privateCheckResidential} onChange={handleAdminChange} className="w-1/2 bg-white/5 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                          <div className="flex items-center gap-3"><span className="text-sm text-slate-400 w-1/2">חשמלאי (₪)</span><input type="number" name="electricianResidential" value={adminPrices.electricianResidential} onChange={handleAdminChange} className="w-1/2 bg-white/5 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                       </div>
                       <div className="space-y-3 bg-black/20 p-4 rounded-xl border border-white/8">
                          <p className="text-xs text-slate-500 font-bold mb-2">מערכת מסחרית:</p>
                          <div className="flex items-center gap-3"><span className="text-sm text-slate-400 w-1/2">בדיקה פרטית (₪)</span><input type="number" name="privateCheckCommercial" value={adminPrices.privateCheckCommercial} onChange={handleAdminChange} className="w-1/2 bg-white/5 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                          <div className="flex items-center gap-3"><span className="text-sm text-slate-400 w-1/2">חשמלאי (₪)</span><input type="number" name="electricianCommercial" value={adminPrices.electricianCommercial} onChange={handleAdminChange} className="w-1/2 bg-white/5 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                       </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-white/8 pt-4">
                       <h4 className="md:col-span-2 text-sm font-medium text-blue-300">אביזרים וכבלים (₪)</h4>
                       <div className="flex items-center gap-3"><span className="text-sm text-slate-400 w-1/2">כבל AC (ביתי On-Grid)</span><input type="number" name="acCableOnGridResidential" value={adminPrices.acCableOnGridResidential} onChange={handleAdminChange} className="w-1/2 bg-white/5 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                       <div className="flex items-center gap-3"><span className="text-sm text-slate-400 w-1/2">כבל AC (ביתי היברידי)</span><input type="number" name="acCableHybridResidential" value={adminPrices.acCableHybridResidential} onChange={handleAdminChange} className="w-1/2 bg-white/5 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                       <div className="flex items-center gap-3"><span className="text-sm text-slate-400 w-1/2">כבל AC (מסחרי)</span><input type="number" name="acCableCommercial" value={adminPrices.acCableCommercial} onChange={handleAdminChange} className="w-1/2 bg-white/5 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                       <div className="flex items-center gap-3"><span className="text-sm text-slate-400 w-1/2">אנטנה לממיר</span><input type="number" name="antennaCost" value={adminPrices.antennaCost} onChange={handleAdminChange} className="w-1/2 bg-white/5 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                       <div className="flex items-center gap-3"><span className="text-sm text-slate-400 w-1/2">לחצן חירום / קו תקשורת</span><input type="number" name="communicationLine" value={adminPrices.communicationLine} onChange={handleAdminChange} className="w-1/2 bg-white/5 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-white/8 pt-4">
                       <h4 className="md:col-span-2 text-sm font-medium text-blue-300">קופסאות ולוחות חשמל (₪)</h4>
                       <div className="flex items-center gap-3"><span className="text-sm text-slate-400 w-1/2">מערכת ביתית (פיקס)</span><input type="number" name="electricalBoxResidential" value={adminPrices.electricalBoxResidential} onChange={handleAdminChange} className="w-1/2 bg-white/5 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                       <div className="flex items-center gap-3"><span className="text-sm text-slate-400 w-1/2">מערכת מסחרית (לכל kWp)</span><input type="number" name="electricalBoxCommercialPerKw" value={adminPrices.electricalBoxCommercialPerKw} onChange={handleAdminChange} className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                    </div>
                  </div>
                )}
              </div>

              {/* 8. תוספות, מס ורווחים */}
              <div className="rounded-2xl overflow-hidden shadow-xl transition-all border border-white/8"
                   style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.025) 100%)' }}>
                <button onClick={() => setOpenAdminSection(prev => prev === 'profit' ? null : 'profit')} className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3"><DollarSign className="w-5 h-5 text-blue-400" /><h3 className="text-lg font-semibold text-white">תוספות, רווחים ומס</h3></div>
                  {openAdminSection === 'profit' ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </button>
                {openAdminSection === 'profit' && (
                  <div className="p-6 pt-2 border-t border-white/8 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div><label className="block text-sm text-slate-400 mb-1">מערכת שטיפה (פיקס) - ₪</label><input type="number" name="washingSystemBase" value={adminPrices.washingSystemBase} onChange={handleAdminChange} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                      <div><label className="block text-sm text-slate-400 mb-1">אגרות ורישוי (פיקס) - ₪</label><input type="number" name="feesCost" value={adminPrices.feesCost} onChange={handleAdminChange} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                      <div>
                        <label className="block text-sm text-blue-300 font-medium mb-1">מע"מ (%)</label>
                        <div className="flex items-center gap-2">
                          <input type="number" name="vatRate" value={adminPrices.vatRate} onChange={handleAdminChange} className="w-full bg-blue-500/10 border border-blue-500/25 rounded-xl p-3 text-blue-300 font-bold outline-none focus:border-blue-500/60 transition-all" />
                          <span className="text-slate-400 font-bold">%</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">כל מחירי העלות המוזנים במערכת הם לפני מע"מ.</p>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-white/8 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><label className="block text-sm text-blue-300 font-medium mb-1">רווח למערכת ביתית (₪ - פיקס)</label><input type="number" name="profitResidentialFixed" value={adminPrices.profitResidentialFixed} onChange={handleAdminChange} className="w-full bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                      <div><label className="block text-sm text-blue-300 font-medium mb-1">רווח למערכת מסחרית (₪ לכל kWp)</label><input type="number" name="profitCommercialPerKw" value={adminPrices.profitCommercialPerKw} onChange={handleAdminChange} className="w-full bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                    </div>
                    {/* סימולציית הלוואות וטלפון חברה */}
                    <div className="pt-4 border-t border-white/8 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <h4 className="md:col-span-3 text-sm font-medium text-blue-300 mb-1">מימון וטלפון ראשי של החברה</h4>
                      <div><label className="block text-sm text-slate-400 mb-1">ריבית פריים (%)</label><input type="number" step="0.1" name="primeRate" value={adminPrices.primeRate} onChange={handleAdminChange} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                      <div><label className="block text-sm text-slate-400 mb-1">מרווח בנקאי (%)</label><input type="number" step="0.1" name="loanMargin" value={adminPrices.loanMargin} onChange={handleAdminChange} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-blue-500/60 transition-all" /></div>
                      <div><label className="block text-sm text-slate-400 mb-1">טלפון ראשי לווטסאפ</label><input type="text" name="companyPhone" value={adminPrices.companyPhone} onChange={handleAdminChange} placeholder="04-611-61-33" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-blue-500/60 transition-all" dir="ltr" /></div>
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ================= SALES TAB ================= */}
          {activeTab === 'sales' && (
            <form onSubmit={calculateQuote} className="space-y-6 animation-fade-in">
              <div className="mb-8 pb-6 border-b border-white/8">
                <h2 className="text-2xl font-black text-white mb-2 flex items-center gap-3">
                  <span className="text-orange-400"><FileText className="w-6 h-6"/></span>
                  יצירת הצעת מחיר חדשה
                </h2>
                <p className="text-slate-500">הזן את פרטי הלקוח ואפיין את המערכת הרצויה.</p>
              </div>

              {/* בחירת סוג מערכת */}
              <div className="flex gap-4 mb-6">
                <label className={`flex-1 flex items-center justify-center gap-3 p-5 rounded-2xl cursor-pointer border-2 transition-all duration-200 ${quoteForm.systemType === 'residential' ? 'border-blue-500/70 text-blue-200 shadow-[0_0_25px_rgba(59,130,246,0.25)] scale-[1.01]' : 'border-white/8 text-slate-400 hover:border-white/20 hover:text-slate-300'}`}
                      style={quoteForm.systemType === 'residential' ? { background: 'linear-gradient(135deg, rgba(29,78,216,0.25), rgba(37,99,235,0.12))' } : { background: 'rgba(255,255,255,0.035)' }}>
                  <input type="radio" name="systemType" value="residential" checked={quoteForm.systemType === 'residential'} onChange={handleFormChange} className="hidden" />
                  <span className="text-2xl">🏠</span><span className="font-bold text-lg">מערכת ביתית (פרטית)</span>
                </label>
                <label className={`flex-1 flex items-center justify-center gap-3 p-5 rounded-2xl cursor-pointer border-2 transition-all duration-200 ${quoteForm.systemType === 'commercial' ? 'border-blue-500/70 text-blue-200 shadow-[0_0_25px_rgba(59,130,246,0.25)] scale-[1.01]' : 'border-white/8 text-slate-400 hover:border-white/20 hover:text-slate-300'}`}
                      style={quoteForm.systemType === 'commercial' ? { background: 'linear-gradient(135deg, rgba(29,78,216,0.25), rgba(37,99,235,0.12))' } : { background: 'rgba(255,255,255,0.035)' }}>
                  <input type="radio" name="systemType" value="commercial" checked={quoteForm.systemType === 'commercial'} onChange={handleFormChange} className="hidden" />
                  <span className="text-2xl">🏢</span><span className="font-bold text-lg">מערכת מסחרית</span>
                </label>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* פרטי לקוח */}
                <div className="rounded-2xl shadow-2xl lg:col-span-1 h-fit overflow-hidden border border-white/10"
                     style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)' }}>
                  <div className="h-0.5 w-full" style={{ background: 'linear-gradient(to right, #f97316, #fbbf24, transparent)' }}></div>
                  <div className="p-7">
                    <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2 border-b border-white/8 pb-4">
                      <div className="p-2 rounded-lg" style={{ background: 'rgba(59,130,246,0.2)' }}><User className="w-4 h-4 text-blue-400" /></div>
                      פרטי הלקוח
                    </h3>
                    <div className="space-y-5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">שם הלקוח / חברה</label>
                        <input required type="text" name="clientName" value={quoteForm.clientName} onChange={handleFormChange}
                          className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white outline-none transition-all duration-200 focus:border-blue-500/60 focus:bg-white/8"
                          onFocus={e => e.target.style.boxShadow='0 0 0 3px rgba(59,130,246,0.18)'} onBlur={e => e.target.style.boxShadow='none'} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">יישוב / עיר</label>
                        <input type="text" name="clientCity" value={quoteForm.clientCity} onChange={handleFormChange}
                          className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white outline-none transition-all duration-200 focus:border-blue-500/60 focus:bg-white/8"
                          onFocus={e => e.target.style.boxShadow='0 0 0 3px rgba(59,130,246,0.18)'} onBlur={e => e.target.style.boxShadow='none'} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* אפיון המערכת */}
                <div className="rounded-2xl shadow-2xl lg:col-span-2 overflow-hidden border border-white/10"
                     style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)' }}>
                  <div className="h-0.5 w-full" style={{ background: 'linear-gradient(to right, #1d4ed8, #3b82f6, transparent)' }}></div>
                  <div className="p-7">
                    <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2 border-b border-white/8 pb-4">
                      <div className="p-2 rounded-lg" style={{ background: 'rgba(59,130,246,0.2)' }}><Settings className="w-4 h-4 text-blue-400" /></div>
                      אפיון המערכת
                    </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">גודל מערכת DC (kWp)</label>
                      <input required type="number" step="0.1" min="1" name="systemSizeKw" value={quoteForm.systemSizeKw} onChange={handleDcSizeChange}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white text-2xl font-black outline-none transition-all duration-200 focus:border-blue-500/60"
                        onFocus={e => e.target.style.boxShadow='0 0 0 3px rgba(59,130,246,0.18)'} onBlur={e => e.target.style.boxShadow='none'} />
                      <p className="text-xs text-slate-500 mt-2">יחושב כ- <strong className="text-blue-400">{currentCalculatedPanels}</strong> פאנלים</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">גודל מערכת AC (kWp)</label>
                      <input required type="number" step="0.1" min="1" name="systemSizeAcKw" value={quoteForm.systemSizeAcKw} onChange={handleFormChange}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white text-2xl font-black outline-none transition-all duration-200 focus:border-blue-500/60"
                        onFocus={e => e.target.style.boxShadow='0 0 0 3px rgba(59,130,246,0.18)'} onBlur={e => e.target.style.boxShadow='none'} />
                      <p className="text-xs text-slate-500 mt-2">מחושב אוטומטית לפי ה-DC אך ניתן לשינוי</p>
                    </div>
                    <div className="md:col-span-2 mt-2">
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">סוג גג</label>
                      <select name="roofType" value={quoteForm.roofType} onChange={handleFormChange}
                        className="w-full bg-slate-950 border border-white/15 rounded-xl p-3.5 text-slate-100 outline-none transition-all duration-200 focus:border-blue-500/60 [color-scheme:dark]">
                        <option value="concrete" className="bg-slate-900 text-slate-100" style={{ backgroundColor: '#0f172a', color: '#f1f5f9' }}>גג בטון (דורש משקולות)</option>
                        <option value="other" className="bg-slate-900 text-slate-100" style={{ backgroundColor: '#0f172a', color: '#f1f5f9' }}>גג רגיל (איסכורית / פאנל / רעפים)</option>
                      </select>
                    </div>
                  
                    {/* סוג ממיר */}
                    <div className="md:col-span-2 mt-2">
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">סוג מערכת ההמרה</label>
                      <div className="flex gap-3">
                        <label className={`flex-1 flex items-center justify-center gap-2 p-3.5 rounded-xl cursor-pointer border transition-all duration-200 ${quoteForm.inverterSystemType === 'ongrid' ? 'border-blue-500/60 text-blue-200' : 'border-white/8 text-slate-400 hover:border-white/20 hover:text-slate-300'}`}
                               style={quoteForm.inverterSystemType === 'ongrid' ? { background: 'rgba(29,78,216,0.2)' } : { background: 'rgba(0,0,0,0.2)' }}>
                          <input type="radio" name="inverterSystemType" value="ongrid" checked={quoteForm.inverterSystemType === 'ongrid'} onChange={handleFormChange} className="hidden" />
                          מערכת אונגריד (On-Grid)
                        </label>
                        <label className={`flex-1 flex items-center justify-center gap-2 p-3.5 rounded-xl cursor-pointer border transition-all duration-200 ${quoteForm.inverterSystemType === 'hybrid' ? 'border-blue-500/60 text-blue-200' : 'border-white/8 text-slate-400 hover:border-white/20 hover:text-slate-300'}`}
                               style={quoteForm.inverterSystemType === 'hybrid' ? { background: 'rgba(29,78,216,0.2)' } : { background: 'rgba(0,0,0,0.2)' }}>
                          <input type="radio" name="inverterSystemType" value="hybrid" checked={quoteForm.inverterSystemType === 'hybrid'} onChange={handleFormChange} className="hidden" />
                          מערכת היברידית (Hybrid)
                        </label>
                      </div>
                    </div>

                    {/* בחירת ממירים */}
                    <div className="md:col-span-2 p-5 bg-black/20 border border-white/10 rounded-2xl">
                      <label className="block text-xs font-semibold text-blue-400 uppercase tracking-wider mb-3">בחירת ממירים</label>
                      {(() => {
                        const isHybrid = quoteForm.inverterSystemType === 'hybrid';
                        const adminList = isHybrid ? adminPrices.invertersHybrid : adminPrices.inverters;
                        const formListName = isHybrid ? 'selectedHybridInverters' : 'selectedInverters';
                        const currentSelections = quoteForm[formListName];
                        if (adminList.length === 0) return <p className="text-sm text-red-400">לא קיימים דגמים במערכת.</p>;
                        return (
                          <>
                            <div className="space-y-3">
                              {currentSelections.map((item, index) => (
                                <div key={index} className="flex gap-3 items-center">
                                  <select value={item.id} onChange={(e) => handleQuoteListChange(formListName, index, 'id', e.target.value)} className="flex-1 bg-slate-950 border border-white/15 rounded-xl p-2.5 text-slate-100 outline-none focus:border-blue-500/60 transition-all [color-scheme:dark]">
                                    {adminList.map(inv => (<option key={inv.id} value={inv.id} className="bg-slate-900 text-slate-100" style={{ backgroundColor: '#0f172a', color: '#f1f5f9' }}>{inv.name}</option>))}
                                  </select>
                                  <div className="w-28 flex items-center bg-white/5 border border-white/10 rounded-xl">
                                     <span className="pl-2 text-slate-500 text-sm">כמות:</span>
                                     <input type="number" min="1" value={item.quantity} onChange={(e) => handleQuoteListChange(formListName, index, 'quantity', e.target.value)} className="w-full bg-transparent p-2 text-white outline-none" />
                                  </div>
                                  <button type="button" onClick={() => removeQuoteListItem(formListName, index)} className="p-2 text-slate-500 hover:text-red-400 rounded-xl transition-colors"><Trash2 className="w-5 h-5" /></button>
                                </div>
                              ))}
                            </div>
                            <button type="button" onClick={() => addQuoteListItem(formListName, isHybrid ? 'invertersHybrid' : 'inverters')} className="mt-4 flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors">
                              <Plus className="w-4 h-4" /> הוסף ממיר
                            </button>
                          </>
                        );
                      })()}
                    </div>

                    {/* סוללות */}
                    {quoteForm.inverterSystemType === 'hybrid' && (
                      <div className="md:col-span-2 p-5 bg-blue-950/20 border border-blue-500/20 rounded-2xl">
                        <label className="flex items-center gap-3 cursor-pointer mb-4">
                          <input type="checkbox" name="includesBatteries" checked={quoteForm.includesBatteries} onChange={handleFormChange} className="w-5 h-5 accent-blue-500 rounded" />
                          <div><span className="block text-white font-semibold text-lg">המערכת כוללת סוללות אגירה</span></div>
                        </label>
                        {quoteForm.includesBatteries && (
                           <div className="mt-4 border-t border-white/10 pt-4">
                             <label className="block text-xs font-semibold text-blue-300 uppercase tracking-wider mb-3">בחירת סוללות אגירה</label>
                             {adminPrices.batteries.length === 0 ? <p className="text-sm text-red-400">לא הוגדרו סוללות באדמין.</p> : (
                               <>
                                 <div className="space-y-3">
                                   {quoteForm.selectedBatteries.map((item, index) => (
                                     <div key={index} className="flex gap-3 items-center">
                                       <select value={item.id} onChange={(e) => handleQuoteListChange('selectedBatteries', index, 'id', e.target.value)} className="flex-1 bg-slate-950 border border-white/15 rounded-xl p-2.5 text-slate-100 outline-none focus:border-blue-500/60 transition-all [color-scheme:dark]">
                                         {adminPrices.batteries.map(bat => (<option key={bat.id} value={bat.id} className="bg-slate-900 text-slate-100" style={{ backgroundColor: '#0f172a', color: '#f1f5f9' }}>{bat.name}</option>))}
                                       </select>
                                       <div className="w-28 flex items-center bg-white/5 border border-white/10 rounded-xl"><span className="pl-2 text-slate-500 text-sm">כמות:</span><input type="number" min="1" value={item.quantity} onChange={(e) => handleQuoteListChange('selectedBatteries', index, 'quantity', e.target.value)} className="w-full bg-transparent p-2 text-white outline-none" /></div>
                                       <button type="button" onClick={() => removeQuoteListItem('selectedBatteries', index)} className="p-2 text-slate-500 hover:text-red-400 rounded-xl transition-colors"><Trash2 className="w-5 h-5" /></button>
                                     </div>
                                   ))}
                                 </div>
                                 <button type="button" onClick={() => addQuoteListItem('selectedBatteries', 'batteries')} className="mt-4 flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"><Plus className="w-4 h-4" /> הוסף סוללה</button>
                               </>
                             )}
                           </div>
                        )}
                      </div>
                    )}

                    <div className="md:col-span-2 space-y-3 pt-2 border-t border-white/8 mt-2">
                      <div className="bg-black/15 border border-white/8 rounded-2xl overflow-hidden">
                        <label className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/5 transition-colors">
                          <input type="checkbox" name="includesOptimizers" checked={quoteForm.includesOptimizers} onChange={handleFormChange} className="w-5 h-5 accent-blue-500 rounded" />
                          <span className="block text-white font-semibold">כולל אופטימייזרים (Optimizers)</span>
                        </label>
                        {quoteForm.includesOptimizers && (
                          <div className="px-4 pb-4 pt-2 border-t border-white/8 bg-black/15 ml-12">
                            {seStatusDisplay.hasSolarEdge ? (
                               <p className="text-sm text-blue-300">זוהה ממיר SolarEdge במערכת ({seStatusDisplay.maxSECapacity > 15 ? 'מסוג 1:2' : 'מסוג 1:1'}).</p>
                            ) : (
                               <div className="flex items-center gap-3 mt-1"><label className="text-sm text-slate-400">כמות Tigo:</label><input type="number" min="1" name="tigoQuantity" value={quoteForm.tigoQuantity} onChange={handleFormChange} className="w-24 bg-white/5 border border-white/10 rounded-xl p-2 text-white focus:border-blue-500/60 transition-all" /></div>
                            )}
                          </div>
                        )}
                      </div>
                      <label className="flex items-center gap-3 p-4 bg-black/15 border border-white/8 rounded-2xl cursor-pointer hover:bg-white/5 transition-colors">
                        <input type="checkbox" name="includesWashing" checked={quoteForm.includesWashing} onChange={handleFormChange} className="w-5 h-5 accent-blue-500 rounded" />
                        <span className="block text-white font-semibold">התקנת מערכת שטיפה אוטומטית</span>
                      </label>
                      <label className="flex items-center gap-3 p-4 bg-black/15 border border-white/8 rounded-2xl cursor-pointer hover:bg-white/5 transition-colors">
                        <input type="checkbox" name="showLoanSimulation" checked={quoteForm.showLoanSimulation} onChange={handleFormChange} className="w-5 h-5 accent-blue-500 rounded" />
                        <span className="block text-white font-semibold">הצג טבלת סימולציית מימון (100% הלוואה בנקאית)</span>
                      </label>
                      
                      {/* הגדרות כיווני אוויר */}
                      <div className="bg-black/15 border border-white/8 rounded-2xl overflow-hidden transition-all">
                        <label className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/5 transition-colors">
                          <input type="checkbox" name="specifyOrientation" checked={quoteForm.specifyOrientation} onChange={handleFormChange} className="w-5 h-5 accent-blue-500 rounded" />
                          <span className="block text-white font-semibold">הגדרת כיווני אוויר לחלוקת פאנלים (משפיע על תפוקה)</span>
                        </label>
                        
                        {quoteForm.specifyOrientation && (
                          <div className="px-4 pb-4 pt-4 border-t border-white/8 bg-black/15 ml-12 rounded-b-2xl animation-fade-in">
                             <p className="text-sm text-blue-300 mb-3">סך הכל פאנלים נדרשים במערכת: <strong>{currentCalculatedPanels}</strong></p>
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                               <div>
                                 <label className="block text-sm text-slate-400 mb-1">דרום (100% שמש)</label>
                                 <input type="number" min="0" name="panelsSouth" value={quoteForm.panelsSouth} onChange={handleFormChange} className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white outline-none focus:border-blue-500/60 transition-all" />
                               </div>
                               <div>
                                 <label className="block text-sm text-slate-400 mb-1">מזרח/מערב (-15%)</label>
                                 <input type="number" min="0" name="panelsEastWest" value={quoteForm.panelsEastWest} onChange={handleFormChange} className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white outline-none focus:border-blue-500/60 transition-all" />
                               </div>
                               <div>
                                 <label className="block text-sm text-slate-400 mb-1">צפון (-35%)</label>
                                 <input type="number" min="0" name="panelsNorth" value={quoteForm.panelsNorth} onChange={handleFormChange} className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-white outline-none focus:border-blue-500/60 transition-all" />
                               </div>
                             </div>
                             
                             {/* התראת אופטימייזרים */}
                             {requiredOptimizersForSmallArrays > 0 && (
                               <div className="mt-4 bg-amber-500/10 border border-amber-500/50 p-4 rounded-xl animation-fade-in col-span-1 md:col-span-3">
                                  <p className="text-amber-400 text-sm font-medium mb-3 flex items-start gap-2">
                                     <AlertCircle className="w-5 h-5 shrink-0" />
                                     שימו לב: כיוון שמכיל פחות מ-6 פאנלים דורש התקנת אופטימייזרים. בחלוקה זו יידרשו לפחות {requiredOptimizersForSmallArrays} אופטימייזרים.
                                  </p>
                                  <label className="flex items-center gap-2 cursor-pointer text-slate-300 text-sm font-medium hover:text-white transition-colors w-fit">
                                     <input 
                                        type="checkbox" 
                                        name="optimizerAcknowledge" 
                                        checked={quoteForm.optimizerAcknowledge || false} 
                                        onChange={handleFormChange} 
                                        className="w-4 h-4 accent-amber-500 rounded cursor-pointer" 
                                     />
                                     אני מודע/ת ומאשר/ת להמשיך
                                  </label>
                               </div>
                             )}

                             {/* תצוגה חיה של חלוקה ושעות שמש למנהל */}
                             <div className={`text-sm mt-4 p-3 rounded-lg font-medium flex flex-col gap-2 ${currentDistributedPanels === currentCalculatedPanels ? 'bg-green-900/20 text-green-400 border border-green-800/50' : 'bg-red-900/20 text-red-400 border border-red-800/50'}`}>
                               <div className="flex items-center gap-2">
                                 {currentDistributedPanels === currentCalculatedPanels ? <CheckCircle className="w-5 h-5"/> : <AlertCircle className="w-5 h-5"/>}
                                 סה"כ חולקו: {currentDistributedPanels} מתוך {currentCalculatedPanels}
                               </div>
                               
                               {currentDistributedPanels === currentCalculatedPanels && currentDistributedPanels > 0 && (
                                 <div className="mt-2 pt-3 border-t border-green-800/30 text-xs text-slate-300">
                                    <p className="text-blue-300 font-bold mb-1">ממוצע שעות שמש משוקלל: {Math.round(liveAvgH)} שעות</p>
                                    <div className="flex flex-wrap gap-4 opacity-80 mt-2">
                                      {pSouthInput > 0 && <span>• דרום: {Math.round(liveSouthH)} שעות</span>}
                                      {pEWInput > 0 && <span>• מזרח/מערב: {Math.round(liveEWH)} שעות</span>}
                                      {pNorthInput > 0 && <span>• צפון: {Math.round(liveNorthH)} שעות</span>}
                                    </div>
                                 </div>
                               )}
                             </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="md:col-span-2 pt-2">
                       <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">מי נושא בעלות אגרות חח"י / רשויות?</label>
                       <div className="flex gap-3">
                          <label className={`flex-1 flex items-center justify-center gap-2 p-3.5 rounded-xl cursor-pointer border transition-all duration-200 ${quoteForm.feesPayer === 'client' ? 'border-blue-500/60 text-blue-200' : 'border-white/8 text-slate-400 hover:border-white/20 hover:text-slate-300'}`}
                                 style={quoteForm.feesPayer === 'client' ? { background: 'rgba(29,78,216,0.2)' } : { background: 'rgba(0,0,0,0.2)' }}>
                            <input type="radio" name="feesPayer" value="client" checked={quoteForm.feesPayer === 'client'} onChange={handleFormChange} className="hidden" />
                            הלקוח משלם
                          </label>
                          <label className={`flex-1 flex items-center justify-center gap-2 p-3.5 rounded-xl cursor-pointer border transition-all duration-200 ${quoteForm.feesPayer === 'company' ? 'border-blue-500/60 text-blue-200' : 'border-white/8 text-slate-400 hover:border-white/20 hover:text-slate-300'}`}
                                 style={quoteForm.feesPayer === 'company' ? { background: 'rgba(29,78,216,0.2)' } : { background: 'rgba(0,0,0,0.2)' }}>
                            <input type="radio" name="feesPayer" value="company" checked={quoteForm.feesPayer === 'company'} onChange={handleFormChange} className="hidden" />
                            החברה משלמת
                          </label>
                       </div>
                    </div>

                    {/* סיכומים נוספים */}
                    <div className="md:col-span-2 pt-4 border-t border-white/8 mt-2">
                       <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">סיכומים נוספים (אופציונלי)</label>
                       <textarea 
                         name="additionalNotes" 
                         value={quoteForm.additionalNotes} 
                         onChange={handleFormChange} 
                         placeholder="הכנס כאן הערות מיוחדות, הבטחות ללקוח, או סיכומים חריגים שיופיעו בהצעת המחיר..." 
                         className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white outline-none transition-all duration-200 focus:border-blue-500/60 min-h-[100px] resize-y"
                       />
                    </div>

                  </div>
                  </div>{/* closes p-7 wrapper */}
                </div>
              </div>

              <div className="flex flex-col items-end gap-4 pt-6">
                {errorMsg && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-4 rounded-2xl flex items-center gap-3 w-full justify-end animation-fade-in shadow-lg">
                     <p className="font-semibold">{errorMsg}</p>
                     <AlertCircle className="w-6 h-6 shrink-0 text-red-400" />
                  </div>
                )}
                <div className="relative group">
                  {/* Glow effect behind button */}
                  <div className="absolute -inset-1 rounded-2xl opacity-60 blur-md group-hover:opacity-90 transition-opacity duration-300"
                       style={{ background: 'linear-gradient(135deg, #f97316, #fbbf24, #f97316)' }}></div>
                  <button type="submit"
                    className="relative flex items-center gap-3 text-slate-900 px-10 py-4 rounded-2xl font-black text-xl shadow-2xl transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
                    style={{ background: 'linear-gradient(135deg, #f97316 0%, #fbbf24 50%, #f97316 100%)', backgroundSize: '200%' }}>
                    <FileText className="w-6 h-6" />
                    חשב והפק פרזנטציה
                    <span className="text-orange-900 text-lg">←</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ================= QUOTE PRESENTATION TAB ================= */}
          {activeTab === 'quote' && generatedQuote && (
            <div className="animation-fade-in pb-20">
              {/* Toolbar */}
              <div className="max-w-6xl mx-auto flex justify-between items-center mb-8 px-4 print:hidden">
                 <button onClick={() => setActiveTab('sales')}
                   className="text-blue-300 hover:text-blue-200 text-sm flex items-center gap-2 font-semibold px-4 py-2.5 rounded-xl transition-all border border-white/10 hover:border-white/20 hover:bg-white/5"
                   style={{ background: 'rgba(255,255,255,0.04)' }}>
                   &rarr; חזרה לעריכה
                 </button>
                 <button onClick={() => window.print()}
                   className="bg-white text-slate-900 px-6 py-2.5 rounded-xl font-bold shadow-xl flex items-center gap-2 hover:bg-slate-100 transition-all hover:scale-[1.02] hover:shadow-2xl">
                   <FileText className="w-4 h-4"/> הדפס לקובץ PDF
                 </button>
              </div>
              
              <div id="quote-presentation" className="bg-white text-slate-900 shadow-2xl max-w-6xl mx-auto font-sans relative">
                
                {/* --- PAGE 1: HERO COVER --- */}
                <section className="relative h-[80vh] min-h-[640px] flex flex-col justify-center px-8 md:px-16 lg:px-20 print:h-[100vh] overflow-hidden isolate">
                   {/* תמונת רקע מלאה — הפאנלים בולטים משמאל, גרדיאנט כהה מאחורי הטקסט (ימין בעברית) */}
                   <div className="absolute inset-0 z-0">
                     <img
                       src={`${process.env.PUBLIC_URL}/hero-solar-rooftop.png`}
                       alt=""
                       className="h-full w-full object-cover object-[50%_65%] md:object-[50%_60%] scale-105 print:scale-100 print:object-[50%_55%]"
                     />
                     <div
                       className="absolute inset-0"
                       style={{
                         background: 'linear-gradient(to left, rgba(10,18,40,0.94) 0%, rgba(10,18,40,0.82) 28%, rgba(10,18,40,0.45) 58%, rgba(10,18,40,0.15) 85%, rgba(10,18,40,0.05) 100%)'
                       }}
                     />
                     <div className="absolute inset-0 bg-gradient-to-br from-orange-500/15 via-transparent to-blue-600/20 pointer-events-none" />
                   </div>

                   {/* כרטיס תמונה ממוסגר — דקורציה במסכים רחבים בלבד */}
                   <div className="hidden xl:block absolute z-[2] bottom-[18%] left-8 lg:left-14 w-[min(340px,28vw)] rounded-3xl overflow-hidden border border-white/25 shadow-2xl ring-1 ring-white/10 pointer-events-none print:hidden">
                     <img
                       src={`${process.env.PUBLIC_URL}/hero-solar-rooftop.png`}
                       alt=""
                       className="w-full h-44 object-cover object-[50%_75%]"
                     />
                     <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 to-transparent h-16" />
                     <p className="absolute bottom-3 right-4 left-4 text-white text-xs font-bold drop-shadow-md text-center">פאנלים על הגג — אנרגיה נקייה</p>
                   </div>
                   
                   <div className="absolute top-10 right-6 md:right-10 z-[5] flex items-center gap-3 text-white bg-white/12 p-3 rounded-2xl backdrop-blur-md border border-white/25 shadow-xl">
                      <BrandLogo className="h-16 w-16 md:h-20 md:w-20 object-contain bg-white rounded-xl p-2 shadow-inner" />
                      <div className="hidden md:flex flex-col justify-center">
                        <span className="font-black text-2xl md:text-3xl tracking-tight text-white drop-shadow-md">מומחי אנרגיה סולארית</span>
                      </div>
                   </div>
                   
                   <div className="text-white relative z-[5] w-full max-w-4xl mr-0 md:mr-auto mt-12 md:mt-8">
                     <div className="inline-flex py-1.5 px-4 rounded-full bg-blue-500/25 text-blue-100 font-bold text-sm mb-6 border border-blue-400/35 backdrop-blur-sm shadow-lg">
                       מערכת אנרגיה סולארית {generatedQuote.systemType === 'commercial' ? 'מסחרית' : 'ביתית'} • {generatedQuote.inverterSystemType === 'hybrid' ? 'היברידית (Hybrid)' : 'אונגריד (On-Grid)'}
                     </div>
                     <h1 className="text-5xl md:text-6xl lg:text-7xl font-black mb-2 leading-[1.1] drop-shadow-[0_4px_24px_rgba(0,0,0,0.45)]">
                       עצמאות אנרגטית.
                       <br />
                       <span className="text-transparent bg-clip-text bg-gradient-to-l from-amber-300 via-orange-400 to-orange-500">השקעה חכמה.</span>
                     </h1>
                     <div className="h-1 w-24 md:w-32 rounded-full bg-gradient-to-l from-orange-500 to-amber-400 mt-5 mb-8 opacity-90" aria-hidden />
                     
                     <div className="bg-slate-950/55 backdrop-blur-lg border border-white/15 px-4 py-3 md:px-5 md:py-3.5 rounded-2xl w-fit max-w-full mt-4 shadow-xl ring-1 ring-white/10">
                        <p className="text-slate-200 mb-2 text-xs font-medium tracking-wide">הוכנה במיוחד עבור:</p>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:flex-wrap gap-2 sm:gap-x-5 sm:gap-y-1">
                          {generatedQuote.clientName && <div className="flex items-center gap-2 shrink-0"><User className="w-5 h-5 text-blue-400 shrink-0"/><span className="font-bold text-lg leading-tight">{generatedQuote.clientName}</span></div>}
                          {generatedQuote.clientCity && <div className="flex items-center gap-2 shrink-0"><MapPin className="w-5 h-5 text-blue-400 shrink-0"/><span className="font-bold text-lg leading-tight">{generatedQuote.clientCity}</span></div>}
                        </div>
                     </div>
                   </div>
                   
                   <div className="absolute bottom-10 left-10 z-[5] text-slate-300 text-sm font-medium drop-shadow-md">
                      תאריך הפקה: {new Date().toLocaleDateString('he-IL')}
                   </div>
                </section>

                {/* --- PAGE 2: ABOUT US --- */}
                <section className="py-20 px-8 md:px-20 bg-slate-50 print:break-before-page">
                   <div className="max-w-4xl mx-auto text-center mb-16">
                     <h2 className="text-3xl md:text-4xl font-black text-blue-900 mb-4">מי אנחנו? המומחים שלכם באנרגיה סולארית</h2>
                     <p className="text-lg text-slate-600">אנו חברת בוטיק המתמחה בפתרונות אנרגיה מתקדמים. הסטנדרט שלנו הוא הגבוה בשוק - ללא פשרות על איכות הרכיבים, מקצועיות ההתקנה ומתן שירות אישי לכל לקוח.</p>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                     <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
                        <Award className="w-12 h-12 text-orange-500 mx-auto mb-4"/>
                        <h3 className="text-xl font-bold text-blue-800 mb-2">איכות ללא פשרות</h3>
                        <p className="text-slate-600 text-sm">אנו עובדים רק עם המותגים המובילים בעולם (Tier 1) כדי להבטיח אמינות ותפוקה מקסימלית לאורך עשרות שנים.</p>
                     </div>
                     <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
                        <ShieldCheck className="w-12 h-12 text-blue-600 mx-auto mb-4"/>
                        <h3 className="text-xl font-bold text-blue-800 mb-2">אחריות וביטחון</h3>
                        <p className="text-slate-600 text-sm">שקט נפשי מלא. אנו מלווים אתכם גם לאחר ההתקנה עם מערכות ניטור מתקדמות ואחריות ארוכת טווח.</p>
                     </div>
                     <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
                        <Wrench className="w-12 h-12 text-green-500 mx-auto mb-4"/>
                        <h3 className="text-xl font-bold text-blue-800 mb-2">פתרון Turn-Key</h3>
                        <p className="text-slate-600 text-sm">מא' ועד ת'. אנו מטפלים בכל הביורוקרטיה, הרישוי, התכנון וההתקנה - אתם רק נהנים מהחשמל.</p>
                     </div>
                   </div>
                </section>

                {/* --- PAGE 3: THE SYSTEM & FINANCIALS --- */}
                <section className="py-20 px-8 md:px-20 print:break-before-page">
                   <h2 className="text-3xl md:text-4xl font-black text-blue-900 mb-12 text-center">המערכת ותחזית כלכלית</h2>
                   
                   {/* Highlights */}
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
                     
                     {/* Card 1 */}
                     <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl shadow-lg p-6 flex flex-col items-center text-center h-full border border-slate-700/50">
                        <Zap className="w-8 h-8 text-orange-400 mb-3"/>
                        <p className="text-slate-400 text-sm font-medium">הספק המערכת (DC)</p>
                        <p className="text-3xl font-black mt-1 text-white">{generatedQuote.systemSizeKw}<span className="text-lg font-bold text-slate-500 ml-1">kWp</span></p>
                        <div className="flex-1 flex flex-col justify-evenly w-full mt-4 gap-2">
                           <span className="block text-xs text-center text-blue-300 bg-slate-800/80 px-2 py-2 rounded-lg border border-slate-700">מערכת AC: {generatedQuote.systemSizeAcKw} kWp</span>
                           <span className="block text-xs text-center text-slate-300 bg-slate-800/80 px-2 py-2 rounded-lg border border-slate-700">גודל חיבור נדרש: 3x{generatedQuote.requiredConnectionAmps}A</span>
                        </div>
                     </div>
                     
                     {/* Card 2 */}
                     <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl shadow-lg p-6 flex flex-col items-center text-center h-full border border-slate-700/50">
                        <Activity className="w-8 h-8 text-blue-400 mb-3"/>
                        <p className="text-slate-400 text-sm font-medium">ייצור שנתי משוער</p>
                        <p className="text-3xl font-black mt-1 text-white">{Math.round(generatedQuote.estimatedYearlyProductionKwh).toLocaleString('en-US')}<span className="text-lg font-bold text-slate-500 ml-1">קוט"ש</span></p>
                        <div className="flex-1 flex flex-col justify-end w-full mt-4 space-y-1.5">
                          <span className="block text-xs text-center font-medium text-slate-300 bg-slate-800/80 px-2 py-1.5 rounded-lg border border-slate-700">
                            לפי {Math.round(generatedQuote.productionHoursValid)} שעות בממוצע
                          </span>
                          
                          {generatedQuote.specifyOrientation && generatedQuote.orientationDetails && (
                            <div className="text-[11px] text-slate-400 bg-slate-900/50 p-2.5 rounded-lg border border-slate-700/50 text-right space-y-1.5 mt-2">
                              <p className="font-bold text-slate-500 mb-1 border-b border-slate-700/50 pb-1">פירוט שעות לפי כיוונים:</p>
                              {generatedQuote.orientationDetails.pSouth > 0 && (
                                <div className="flex justify-between items-center">
                                  <span>דרום ({generatedQuote.orientationDetails.pSouth} יח'):</span> 
                                  <span className="font-semibold text-slate-300">{Math.round(generatedQuote.orientationDetails.southHours)} שעות</span>
                                </div>
                              )}
                              {generatedQuote.orientationDetails.pEW > 0 && (
                                <div className="flex justify-between items-center">
                                  <span>מזרח/מערב ({generatedQuote.orientationDetails.pEW} יח'):</span> 
                                  <span className="font-semibold text-slate-300">{Math.round(generatedQuote.orientationDetails.ewHours)} שעות</span>
                                </div>
                              )}
                              {generatedQuote.orientationDetails.pNorth > 0 && (
                                <div className="flex justify-between items-center">
                                  <span>צפון ({generatedQuote.orientationDetails.pNorth} יח'):</span> 
                                  <span className="font-semibold text-slate-300">{Math.round(generatedQuote.orientationDetails.northHours)} שעות</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                     </div>
                     
                     {/* Card 3 */}
                     <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl shadow-lg p-6 flex flex-col items-center text-center h-full border border-slate-700/50">
                        <DollarSign className="w-8 h-8 text-green-400 mb-3"/>
                        <p className="text-slate-400 text-sm font-medium">הכנסה שנתית צפויה</p>
                        <p className="text-3xl font-black mt-1 text-green-400">₪{Math.round(generatedQuote.estimatedYearlySavings).toLocaleString('en-US')}</p>
                        <div className="flex-1 flex flex-col justify-evenly w-full mt-4 gap-2">
                          {generatedQuote.estimatedYearlySavings <= 27000 ? (
                             <span className="block text-xs text-center text-green-300 bg-slate-800/80 px-2 py-2 rounded-lg border border-slate-700">פטור ממס</span>
                          ) : generatedQuote.estimatedYearlySavings <= 100000 ? (
                             <span className="block text-xs text-center text-amber-400 bg-slate-800/80 px-2 py-2 rounded-lg border border-slate-700">מס: 10%</span>
                          ) : null}
                          <span className="block text-xs text-center text-slate-300 bg-slate-800/80 px-2 py-2 rounded-lg border border-slate-700">
                            תעריף חח"י: {Number((generatedQuote.calculatedTariff > 0 ? generatedQuote.calculatedTariff * 100 : 0).toFixed(4))} אג'
                          </span>
                        </div>
                     </div>
                     
                     {/* Card 4 */}
                     <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl shadow-lg p-6 flex flex-col items-center text-center h-full border border-slate-700/50">
                        <Clock className="w-8 h-8 text-blue-400 mb-3"/>
                        <p className="text-slate-400 text-sm font-medium">החזר השקעה (ROI)</p>
                        <p className="text-3xl font-black mt-1 text-white">
                          {generatedQuote.roiYears > 0 && isFinite(generatedQuote.roiYears) ? generatedQuote.roiYears.toFixed(1) : "---"}
                          <span className="text-lg font-bold text-slate-500 ml-1">שנים</span>
                        </p>
                        <div className="flex-1 flex flex-col justify-evenly w-full mt-4 gap-2">
                          <span className="block text-xs text-center font-bold text-orange-400 bg-slate-800/80 px-2 py-2 rounded-lg border border-slate-700">תשואה שנתית: {generatedQuote.annualYield ? generatedQuote.annualYield.toFixed(1) : 0}%</span>
                          <span className="block text-[11px] text-center text-slate-400 bg-slate-800/80 px-2 py-2 rounded-lg border border-slate-700">ללא התחשבות בפחת ומימון</span>
                        </div>
                     </div>
                   </div>

                   {/* Custom Financial Chart (CSS Based) */}
                   <div className="bg-white border border-slate-200 rounded-3xl p-8 mb-16 shadow-lg">
                      <h3 className="text-xl font-bold text-blue-900 mb-8 flex items-center gap-2"><TrendingUp className="text-orange-500"/> תחזית תזרים מזומנים מצטבר (ל-25 שנים)</h3>
                      
                      <div className="h-64 flex items-end justify-between gap-2 md:gap-8 mt-12 relative border-b-2 border-slate-300 pb-2">
                        {/* 0 Line marker */}
                        <div className="absolute w-full border-t border-dashed border-slate-400" style={{bottom: `${Math.abs(generatedQuote.minLoss) / ((generatedQuote.maxProfit || 1) + Math.abs(generatedQuote.minLoss)) * 100}%`}}></div>
                        <span className="absolute left-0 font-bold text-xs text-slate-400" style={{bottom: `calc(${Math.abs(generatedQuote.minLoss) / ((generatedQuote.maxProfit || 1) + Math.abs(generatedQuote.minLoss)) * 100}% + 5px)`}}>איזון 0</span>

                        {generatedQuote.graphData.map((point, i) => {
                          const isNegative = point.flow < 0;
                          const totalRange = (generatedQuote.maxProfit || 1) + Math.abs(generatedQuote.minLoss);
                          const heightPercent = (Math.abs(point.flow) / totalRange) * 100;
                          const zeroPosPercent = (Math.abs(generatedQuote.minLoss) / totalRange) * 100;

                          return (
                            <div key={i} className="flex-1 flex flex-col items-center relative h-full">
                               {/* Value label */}
                               <div className="absolute text-[10px] md:text-sm font-bold w-full text-center" 
                                    style={{
                                      bottom: isNegative ? `calc(${zeroPosPercent}% - ${heightPercent}% - 22px)` : `calc(${zeroPosPercent}% + ${heightPercent}% + 5px)`,
                                      color: isNegative ? '#ef4444' : '#1d4ed8' 
                                    }}>
                                  {point.flow > 0 ? '+' : ''}{Math.round(point.flow / 1000)}k
                               </div>
                               
                               {/* Bar */}
                               <div className="absolute w-6 md:w-16 rounded-sm transition-all shadow-sm"
                                    style={{
                                      height: `${heightPercent}%`,
                                      bottom: isNegative ? `calc(${zeroPosPercent}% - ${heightPercent}%)` : `${zeroPosPercent}%`,
                                      backgroundColor: isNegative ? '#fca5a5' : '#3b82f6' 
                                    }}>
                               </div>
                               
                               {/* Year Label */}
                               <div className="absolute -bottom-8 text-xs md:text-sm font-medium text-slate-600">
                                 {point.year === 0 ? 'התקנה' : `שנה ${point.year}`}
                               </div>
                            </div>
                          )
                        })}
                      </div>
                   </div>

                   {/* Investment Comparison Section */}
                   <div className="mb-16 print:break-inside-avoid">
                      <h3 className="text-2xl font-black text-blue-900 mb-6 border-r-4 border-orange-500 pr-4">השוואת אפיקי השקעה</h3>
                      <p className="text-slate-600 mb-8 max-w-3xl">לפני שמקבלים החלטה, חשוב להבין איך השקעה במערכת סולארית עומדת מול אלטרנטיבות ההשקעה הנפוצות במשק הישראלי.</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        
                        {/* Real Estate */}
                        <div className="bg-emerald-50/40 border border-emerald-100 rounded-2xl p-6 shadow-sm flex flex-col transition-all hover:shadow-md">
                           <div className="flex items-center gap-3 mb-4">
                             <div className="p-3 bg-emerald-100/50 text-emerald-600 rounded-xl"><Home className="w-6 h-6" /></div>
                             <h4 className="font-bold text-lg text-slate-800">נדל"ן (דירה להשקעה)</h4>
                           </div>
                           <div className="space-y-4 flex-1">
                              <div>
                                <p className="text-sm text-slate-500 mb-1">תשואה שנתית ממוצעת</p>
                                <p className="text-2xl font-black text-emerald-700/70">3% - 5%</p>
                              </div>
                              <ul className="space-y-2 text-sm text-slate-600">
                                <li className="flex items-start gap-2"><Activity className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> <strong>רמת סיכון:</strong> נמוכה</li>
                                <li className="flex items-start gap-2"><Wrench className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> <strong>מעורבות:</strong> גבוהה (חיפוש שוכרים, תיקונים, עו"ד)</li>
                                <li className="flex items-start gap-2"><FileText className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> <strong>הבטחת הכנסה:</strong> תלוי בשוכר ובשוק</li>
                              </ul>
                           </div>
                        </div>

                        {/* Stock Market */}
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 shadow-sm flex flex-col transition-all hover:shadow-md">
                           <div className="flex items-center gap-3 mb-4">
                             <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl"><LineChart className="w-6 h-6" /></div>
                             <h4 className="font-bold text-lg text-slate-800">שוק ההון (מדד S&P 500)</h4>
                           </div>
                           <div className="space-y-4 flex-1">
                              <div>
                                <p className="text-sm text-slate-500 mb-1">תשואה שנתית ממוצעת</p>
                                <p className="text-2xl font-black text-emerald-700">8% - 10%</p>
                              </div>
                              <ul className="space-y-2 text-sm text-slate-600">
                                <li className="flex items-start gap-2"><Activity className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> <strong>רמת סיכון:</strong> בינונית-גבוהה (תנודתיות)</li>
                                <li className="flex items-start gap-2"><Wrench className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> <strong>מעורבות:</strong> נמוכה</li>
                                <li className="flex items-start gap-2"><FileText className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> <strong>הבטחת הכנסה:</strong> אין (תלוי בשוק הגלובלי)</li>
                              </ul>
                           </div>
                        </div>

                        {/* Solar System (Branded Colors) */}
                        <div className="bg-blue-50 border-2 border-blue-500 rounded-2xl p-6 shadow-md flex flex-col relative overflow-hidden transition-all hover:shadow-lg transform hover:-translate-y-1">
                           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-orange-400"></div>
                           <div className="flex items-center gap-3 mb-4">
                             <div className="p-3 bg-orange-500 text-white rounded-xl"><Sun className="w-6 h-6" /></div>
                             <h4 className="font-bold text-lg text-blue-900">מערכת סולארית</h4>
                           </div>
                           <div className="space-y-4 flex-1">
                              <div>
                                <p className="text-sm text-blue-800 mb-1">תשואה שנתית משוערת</p>
                                <p className="text-3xl font-black text-blue-700">{generatedQuote.annualYield ? generatedQuote.annualYield.toFixed(1) : 0}%</p>
                              </div>
                              <ul className="space-y-2 text-sm text-blue-900 font-medium">
                                <li className="flex items-start gap-2"><Activity className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" /> <strong>רמת סיכון:</strong> אפסית</li>
                                <li className="flex items-start gap-2"><Wrench className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" /> <strong>מעורבות:</strong> אפסית (הכנסה פסיבית)</li>
                                <li className="flex items-start gap-2"><FileText className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" /> <strong>הבטחת הכנסה:</strong> מובטחת ע"י המדינה ל-25 שנה!</li>
                              </ul>
                           </div>
                        </div>

                      </div>
                   </div>

                   {/* Loan Simulation Table (25 Years Dynamics) */}
                   {generatedQuote.showLoanSimulation && (
                     <div className="bg-white border border-slate-200 rounded-3xl p-8 mb-16 shadow-lg overflow-hidden print:break-before-page">
                        <div className="mb-6">
                           <h3 className="text-2xl font-black text-blue-900">ניתוח כדאיות כלכלית - מימון 100% בנקאי</h3>
                           <p className="text-slate-600 mt-1 mb-2">
                             פריים + {generatedQuote.loanSettings.loanMargin}% (סה"כ ריבית משוערת: {generatedQuote.loanSettings.annualInterestRate}%)<br/>
                             <span className="text-sm font-medium bg-blue-50 text-blue-800 px-2 py-1 rounded inline-block mt-2 border border-blue-100">
                               החזר ההלוואה מבוסס על הפניית 100% מההכנסות לטובת סילוק הקרן והריבית עד לסיומה. לאחר מכן, ההכנסות עוברות לרווח נקי.
                             </span>
                           </p>
                        </div>
                        <div className="overflow-x-auto">
                           <table className="w-full text-center border-collapse text-sm">
                              <thead>
                                 <tr className="bg-slate-100 text-blue-900">
                                    <th className="py-3 px-2 font-bold border-b-2 border-slate-300 rounded-tr-xl">שנה</th>
                                    <th className="py-3 px-2 font-bold border-b-2 border-slate-300">הכנסה שנתית (כולל פחת 0.33%)</th>
                                    <th className="py-3 px-2 font-bold border-b-2 border-slate-300 text-red-600">החזר הלוואה (עד לסילוק)</th>
                                    <th className="py-3 px-2 font-bold border-b-2 border-slate-300 text-green-600 rounded-tl-xl">רווח נטו ללקוח</th>
                                 </tr>
                              </thead>
                              <tbody>
                                 {generatedQuote.loanSimulation.map((row) => (
                                    <tr key={row.year} className="border-b border-slate-100 hover:bg-blue-50/50 transition-colors">
                                       <td className="py-2 px-2 font-semibold text-slate-800">{row.year}</td>
                                       <td className="py-2 px-2 font-medium text-slate-600">₪{Math.round(row.income).toLocaleString()}</td>
                                       <td className="py-2 px-2 font-medium text-red-500">{row.repayment > 0 ? `- ₪${Math.round(row.repayment).toLocaleString()}` : '-'}</td>
                                       <td className="py-2 px-2 font-bold text-green-600">{row.netProfit > 0 ? `₪${Math.round(row.netProfit).toLocaleString()}` : '-'}</td>
                                    </tr>
                                 ))}
                                 <tr className="bg-blue-50/80 font-black text-blue-900">
                                    <td className="py-4 px-2 border-t-2 border-blue-200 rounded-br-xl">סה"כ ל-25 שנים</td>
                                    <td className="py-4 px-2 border-t-2 border-blue-200">₪{Math.round(generatedQuote.loanSimulation.reduce((acc, row) => acc + row.income, 0)).toLocaleString()}</td>
                                    <td className="py-4 px-2 border-t-2 border-blue-200 text-red-600">- ₪{Math.round(generatedQuote.loanSimulation.reduce((acc, row) => acc + row.repayment, 0)).toLocaleString()}</td>
                                    <td className="py-4 px-2 border-t-2 border-blue-200 text-green-600 rounded-bl-xl">₪{Math.round(generatedQuote.loanSimulation.reduce((acc, row) => acc + row.netProfit, 0)).toLocaleString()}</td>
                                 </tr>
                              </tbody>
                           </table>
                        </div>
                        <p className="text-xs text-slate-400 mt-4">* הסימולציה מציגה הערכה כללית הכוללת פחת מודולים סולאריים משוער של 0.33% בשנה. התנאים הסופיים כפופים לאישור הבנק המממן ולשינויים בריבית הפריים. </p>
                     </div>
                   )}

                </section>

                {/* --- PAGE 4: INCLUSIONS & PRICING --- */}
                <section className="py-20 px-8 md:px-20 bg-slate-900 text-white print:break-before-page print:bg-white print:text-slate-900">
                  <h2 className="text-3xl md:text-4xl font-black mb-12 text-center text-white print:text-blue-900">ההשקעה שלך בפרויקט Turn-Key</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
                     <div className="bg-slate-800 p-8 rounded-3xl print:bg-slate-50 print:border print:border-slate-200">
                       <h3 className="text-2xl font-bold mb-6 text-blue-400 print:text-blue-800">מה כלול בהצעה?</h3>
                       <div className="space-y-4">
                         <div className="flex items-start gap-3"><CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5"/><p className="text-slate-300 print:text-slate-700"><strong>הנדסה ורישוי:</strong> תכנון, קונסטרוקטור וטיפול מול חח"י.</p></div>
                         <div className="flex items-start gap-3"><CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5"/><p className="text-slate-300 print:text-slate-700"><strong>חשמל:</strong> כבלי AC/DC, לוחות מותאמים לחיבור 3x{generatedQuote.requiredConnectionAmps}A, חשמלאי מוסמך.</p></div>
                         <div className="flex items-start gap-3"><CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5"/><p className="text-slate-300 print:text-slate-700"><strong>התקנה:</strong> לוגיסטיקה, מנופים וצוות התקנה מקצועי.</p></div>
                         <div className="flex items-start gap-3"><CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5"/><p className="text-slate-300 print:text-slate-700"><strong>בדיקות:</strong> בודק פרטי מוסמך וחיבור למערכת ניטור.</p></div>
                         {generatedQuote.includesOptimizers && <div className="flex items-start gap-3"><CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5"/><p className="text-slate-300 print:text-slate-700"><strong>אופטימייזרים:</strong> התקנת אופטימייזרים למיקסום תפוקה ({generatedQuote.optimizerDetails.type}).</p></div>}
                         {generatedQuote.includesWashing && <div className="flex items-start gap-3"><CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5"/><p className="text-slate-300 print:text-slate-700"><strong>שטיפה:</strong> מערכת ניקוי פאנלים אוטומטית.</p></div>}
                         {generatedQuote.feesPayer === 'company' && <div className="flex items-start gap-3"><CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5"/><p className="text-slate-300 print:text-slate-700"><strong>אגרות:</strong> תשלומים לרשויות כלולים.</p></div>}
                       </div>
                     </div>
                     
                     <div className="flex flex-col justify-center bg-blue-900/30 border border-blue-500/30 p-8 rounded-3xl text-center print:bg-blue-50 print:border-blue-200">
                        <p className="text-orange-400 text-lg font-bold mb-2 print:text-blue-800">השקעה כוללת בפרויקט</p>
                        
                        {generatedQuote.systemType === 'residential' ? (
                          <>
                            <div className="text-6xl font-black text-white mb-2 print:text-blue-900">₪{(generatedQuote.breakdown.finalPrice * (1 + adminPrices.vatRate / 100)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            <p className="text-slate-400 text-sm mb-6 print:text-slate-500">סה"כ לתשלום (המחיר כולל מע"מ)</p>
                            <div className="text-sm text-slate-300 print:text-blue-900 bg-slate-900/50 print:bg-white p-4 rounded-xl border border-slate-700 print:border-blue-200 mx-auto w-full max-w-sm shadow-sm">
                              {generatedQuote.includesWashing && Number(generatedQuote.breakdown.washing) > 0 && (
                                <div className="flex justify-between mb-3 pb-3 border-b border-slate-600 print:border-blue-200">
                                  <span className="text-green-400 print:text-green-700 font-semibold">מערכת שטיפה אוטומטית (כלולה)</span>
                                  <span className="font-bold text-white print:text-blue-900 tabular-nums">₪{Math.round(generatedQuote.breakdown.washing).toLocaleString()}</span>
                                </div>
                              )}
                              <div className="flex justify-between mb-1"><span>לפני מע"מ:</span><span>₪{generatedQuote.breakdown.finalPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                              <div className="flex justify-between"><span>מע"מ ({adminPrices.vatRate}%):</span><span>₪{(generatedQuote.breakdown.finalPrice * (adminPrices.vatRate / 100)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-6xl font-black text-white mb-2 print:text-blue-900">₪{generatedQuote.breakdown.finalPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            <p className="text-slate-400 text-sm mb-6 print:text-slate-500">סה"כ לתשלום (לפני מע"מ)</p>
                            <div className="text-sm text-slate-300 print:text-blue-900 bg-slate-900/50 print:bg-white p-4 rounded-xl border border-slate-700 print:border-blue-200 mx-auto w-full max-w-sm shadow-sm">
                              {generatedQuote.includesWashing && Number(generatedQuote.breakdown.washing) > 0 && (
                                <div className="flex justify-between mb-3 pb-3 border-b border-slate-600 print:border-blue-200">
                                  <span className="text-green-400 print:text-green-700 font-semibold">מערכת שטיפה אוטומטית (כלולה)</span>
                                  <span className="font-bold text-white print:text-blue-900 tabular-nums">₪{Math.round(generatedQuote.breakdown.washing).toLocaleString()}</span>
                                </div>
                              )}
                              <div className="flex justify-between mb-1"><span>תוספת מע"מ ({adminPrices.vatRate}%):</span><span>₪{(generatedQuote.breakdown.finalPrice * (adminPrices.vatRate / 100)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                              <div className="flex justify-between font-bold text-white print:text-blue-900 mt-2 pt-2 border-t border-slate-700 print:border-blue-200"><span>סה"כ כולל מע"מ:</span><span>₪{(generatedQuote.breakdown.finalPrice * (1 + adminPrices.vatRate / 100)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                            </div>
                          </>
                        )}
                     </div>
                  </div>
                </section>

                {/* --- PAGE 5: TECHNICAL SPECIFICATIONS --- */}
                <section className="py-20 px-8 md:px-20 bg-white print:break-before-page">
                   <h2 className="text-3xl md:text-4xl font-black text-blue-900 mb-12 text-center">מפרט טכני</h2>
                   
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10 text-sm">
                     
                     {/* Column 1 */}
                     <div className="space-y-8">
                        <div>
                           <h4 className="text-lg font-bold text-blue-800 mb-3 border-b-2 border-orange-500 inline-block pb-1">אביזרי חשמל ורכיבי קונסטרוקציה</h4>
                           <ul className="space-y-2 text-slate-700">
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>חיבור גישרי הארכה 10 ממ"ר בין הקולטים.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>גיד הארכה 16 ממ"ר לאורך תשתית החשמלית.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>כבל DC בהתאמה 6 או 10 ממ"ר עם הגנת UV. תוצרת KBE גרמניה או ש"ע.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>תשתית התקנה על בסיס קונסטרוקציית אלומיניום פרופיל 40/40.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>בגג איסכורית או שטוח משולשי זווית מאלומיניום 50/50/30.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>בגג בטון העמדה על אבני-שפה ואטם בין קונסטרוקציה לגג.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>אביזרי חיבור בין קולטים עשויים אלומיניום.</span></li>
                           </ul>
                        </div>
                        
                        <div>
                           <h4 className="text-lg font-bold text-blue-800 mb-3 border-b-2 border-orange-500 inline-block pb-1">קונסטרוקציית אלומיניום נושאת לפאנל</h4>
                           <ul className="space-y-2 text-slate-700">
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>כל הרכיבים כדוגמת ברגים, תפסנים, אומגות וכו' יהיו עשויי אלומיניום או נירוסטה.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>בגג אסכורית הקונסטרוקציה תורכב בחיבור ישירות למרישים (פטות) או בעזרת פרופילים מגשרים.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>הממירים יותקנו על גבי קיר חיצוני של המבנה או בתוך המבנה עצמו בחדר ייעודי על מנת לא להפריע לתפעול של המבנה על פי אופי האתר ולפי הוראות היצרן.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>חיבור לאבן שפה בגגות בטון ע"י בורג ג'מבו או עוגן חץ עשויים מברזל מגולוון.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>בחיבור לגג איסכורית או פנאל מבודד בורג יעודי לאיסכורית.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>תופסן בגגות רעפים עשוי מברזל מגולוון.</span></li>
                           </ul>
                        </div>
                     </div>

                     {/* Column 2 */}
                     <div className="space-y-8">
                        <div>
                           <h4 className="text-lg font-bold text-blue-800 mb-3 border-b-2 border-orange-500 inline-block pb-1">בצד ה- DC בין התאים הפוטו-וולטאיים לממירים</h4>
                           <ul className="space-y-2 text-slate-700">
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>כבלי DC: שימוש בכבל גמיש בעל בידוד כפול ייעודי לחיבור טורי בין הפאנלים במערכות PV.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>שטח חתך 6,10X1 ממ"ר עם עמידות לקרינת UV.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>כבלים מאחד היצרנים המפורטים Draka, General Cable, Huber+Shhner. הכולל תו תקן.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>קופסאות חיבור DC בדרגת אטימות IP65. יותקנו רק בגג רעפים.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>מחברי DC - מחברים ייעודיים בעלי דרגת אטימות IP67 העשויים מפוליקרבונט (כיסוי).</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>מפסקי DC - מנתק דו-קוטבי תוצרת ABB, ייעודי לזרם ישר (DC) במערכות סולאריות.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>תעלת רשת תקנית להולכת כבלים על גבי הגג.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>יוצבו שלטי אזהרה וסימון מוגנים מקרינת UV בהתאם לדרישת חח"י.</span></li>
                           </ul>
                        </div>
                        
                        <div>
                           <h4 className="text-lg font-bold text-blue-800 mb-3 border-b-2 border-orange-500 inline-block pb-1">בצד ה- AC בין הממירים לבין חיבור רשת החשמל</h4>
                           <ul className="space-y-2 text-slate-700">
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>כבלי AC שימוש בכבל ייעודי XLP-E בעל בידוד כפול שטח חתך תואם בחיבור בין הממירים לארון חלוקה עד 30 מ'.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>מפסקי AC - בצמוד לממיר, שימוש במא"ז ט"מ דו-קוטבי עד 40A של יצרן מוביל, תוצרת ABB.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>התקנת תעלות רשת לפי תקן עם תמיכה ייעודית למבנה בעזרת ברגים.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>כבל ההזנה בין חיבור ארון החלוקה לבין ארון החשמל באתר, מסוג XLP-E תלת-פאזי נחושת, בעל שטח חתך הנדרש לפי המרחק בין נקודות החיבור.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span>תעלות פח לאורך הגג ובירידה לממירים.</span></li>
                           </ul>
                        </div>

                        <div>
                           <h4 className="text-lg font-bold text-blue-800 mb-3 border-b-2 border-orange-500 inline-block pb-1">הגנות וניטור</h4>
                           <ul className="space-y-2 text-slate-700">
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span><strong>הגנות בפני ברקים ומתחי יתר:</strong> מסופק ע"י יצרן הממירים מובנה בממיר.</span></li>
                             <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5"/> <span><strong>תקשורת ומערכת ניטור:</strong> מערכת ניטור ייעודית לאיסוף נתונים וגילוי תקלות וכשלים. אספקת אפליקציית ניטור.</span></li>
                           </ul>
                        </div>
                     </div>

                   </div>
                </section>

                {/* --- PAGE 6: PAYMENT TERMS & WARRANTY --- */}
                <section className="py-20 px-8 md:px-20 bg-slate-50 print:break-before-page">
                   <h2 className="text-3xl md:text-4xl font-black text-blue-900 mb-12 text-center">תנאי תשלום ואחריות</h2>
                   
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      
                      {/* Payment Terms */}
                      <div className="bg-white rounded-3xl shadow-lg p-8 border border-slate-200 h-fit">
                        <div className="flex items-center gap-3 mb-6 border-b-2 border-orange-500 pb-3 inline-flex">
                           <DollarSign className="w-6 h-6 text-blue-600" />
                           <h3 className="text-2xl font-bold text-slate-800">תנאי תשלום:</h3>
                        </div>
                        <table className="w-full text-right text-slate-700 text-lg">
                          <tbody>
                            <tr className="border-b border-slate-100">
                              <td className="py-4 font-medium">בתחילת הדרך</td>
                              <td className="py-4 font-black text-blue-600 text-left">5%</td>
                            </tr>
                            <tr className="border-b border-slate-100">
                              <td className="py-4 font-medium">עם קבלת אישור PV</td>
                              <td className="py-4 font-black text-blue-600 text-left">10%</td>
                            </tr>
                            <tr className="border-b border-slate-100">
                              <td className="py-4 font-medium">ביום הזמנת קונסטרוקציה לאתר הלקוח</td>
                              <td className="py-4 font-black text-blue-600 text-left">35%</td>
                            </tr>
                            <tr className="border-b border-slate-100">
                              <td className="py-4 font-medium">ביום הזמנת פאנלים לאתר הלקוח</td>
                              <td className="py-4 font-black text-blue-600 text-left">45%</td>
                            </tr>
                            <tr>
                              <td className="py-4 font-medium">ביום חיבור המתקן לרשת חברת החשמל</td>
                              <td className="py-4 font-black text-blue-600 text-left">יתרה</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Warranty */}
                      <div className="bg-white rounded-3xl shadow-lg p-8 border border-slate-200 h-fit">
                        <div className="flex items-center gap-3 mb-6 border-b-2 border-orange-500 pb-3 inline-flex">
                           <ShieldCheck className="w-6 h-6 text-blue-600" />
                           <h3 className="text-2xl font-bold text-slate-800">עיקרי האחריות:</h3>
                        </div>
                        <ul className="space-y-5 text-lg">
                           <li className="flex items-start gap-4">
                              <CheckCircle className="w-6 h-6 text-green-500 shrink-0 mt-0.5"/> 
                              <span className="text-slate-700">אחריות להספק ביצוע הפנלים לתקופה של <strong>25-30 שנה</strong>, על פי הוראות יצרן.</span>
                           </li>
                           <li className="flex items-start gap-4">
                              <CheckCircle className="w-6 h-6 text-green-500 shrink-0 mt-0.5"/> 
                              <span className="text-slate-700">אחריות לממיר מתח <strong>{generatedQuote.hasSolarEdgeQuote ? '12' : '10'} שנה</strong> על פי הוראות יצרן.</span>
                           </li>
                           {generatedQuote.includesOptimizers && (
                              <li className="flex items-start gap-4">
                                 <CheckCircle className="w-6 h-6 text-green-500 shrink-0 mt-0.5"/> 
                                 <span className="text-slate-700">אחריות לאופטימייזרים <strong>25 שנה</strong> על פי הוראות יצרן.</span>
                              </li>
                           )}
                           <li className="flex items-start gap-4">
                              <CheckCircle className="w-6 h-6 text-green-500 shrink-0 mt-0.5"/> 
                              <span className="text-slate-700">אחריות התקנה <strong>36 חודשים</strong>.</span>
                           </li>
                        </ul>
                      </div>
                      
                   </div>
                </section>

                {/* --- PAGE 6.1: ADDITIONAL NOTES (CONDITIONAL) --- */}
                {generatedQuote.additionalNotes && generatedQuote.additionalNotes.trim() !== '' && (
                  <section className="py-10 px-8 md:px-20 bg-white border-t border-slate-200 print:break-inside-avoid">
                     <div className="max-w-4xl mx-auto bg-blue-50 border border-blue-100 p-8 rounded-3xl shadow-sm">
                        <h3 className="text-2xl font-bold text-blue-900 mb-4 flex items-center gap-2">
                           <FileText className="w-6 h-6 text-blue-600" /> סיכומים נוספים
                        </h3>
                        <p className="text-slate-700 text-lg whitespace-pre-wrap leading-relaxed">
                           {generatedQuote.additionalNotes}
                        </p>
                     </div>
                  </section>
                )}

                {/* --- PAGE 6.5: DIGITAL SIGNATURE (PRINCIPLE APPROVAL) --- */}
                <section className="py-16 px-8 md:px-20 bg-white border-t border-slate-200 print:break-inside-avoid">
                   <div className="max-w-4xl mx-auto">
                     <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-blue-100 text-blue-600 rounded-xl"><PenTool className="w-6 h-6" /></div>
                        <h3 className="text-2xl md:text-3xl font-black text-blue-900">אישור עקרוני להתקדם</h3>
                     </div>
                     <p className="text-slate-700 text-lg mb-8 leading-relaxed">
                        הריני מאשר/ת כי עברתי על הצעת המחיר, המפרט הטכני והתנאים. חתימה זו מהווה הבעת רצון עקרונית לאשר את ההצעה ולהתקדם לשלב הבא. 
                        <br/>
                        <span className="text-sm font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded inline-block mt-2">
                          * מובהר בזאת כי מסמך זה הינו הצעת מחיר ואינו מהווה חוזה משפטי. חוזה התקשרות מחייב ומפורט ייחתם בנפרד מול החברה.
                        </span>
                     </p>
                     
                     <div className="bg-slate-50 border border-slate-200 p-6 md:p-10 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-8 shadow-sm">
                       <div className="text-right flex-1 w-full">
                          <p className="text-sm text-slate-500 mb-1">שם הלקוח / חברה:</p>
                          <p className="font-bold text-2xl text-slate-800 mb-6">{generatedQuote.clientName || '__________________'}</p>
                          <p className="text-sm text-slate-500 mb-1">תאריך אישור:</p>
                          <p className="font-bold text-xl text-slate-800">{new Date().toLocaleDateString('he-IL')}</p>
                       </div>
                       
                       <div className="flex-1 flex justify-center md:justify-end w-full">
                         {!clientSignature ? (
                           <div className="print:hidden">
                             <SignaturePad onSave={handleClientSignatureSaved} />
                           </div>
                         ) : (
                           <div className="text-center relative bg-white p-4 rounded-2xl border border-blue-100 shadow-sm w-[350px]">
                             <button onClick={() => setClientSignature(null)} className="absolute -top-3 -right-3 bg-red-100 text-red-600 p-2 rounded-full hover:bg-red-200 print:hidden shadow-md transition-transform hover:scale-110" title="מחק חתימה"><Trash2 className="w-4 h-4" /></button>
                             <img src={clientSignature} alt="חתימת לקוח" className="h-32 mx-auto object-contain mix-blend-multiply border-b-2 border-blue-200 pb-2 mb-2" />
                             <p className="text-sm text-blue-600 font-bold flex items-center justify-center gap-1"><CheckCircle className="w-4 h-4"/> נחתם דיגיטלית בהצלחה</p>
                             <p className="text-xs text-slate-500 mt-2 text-center leading-snug print:hidden">אם נפתח וואטסאפ לסוכן — שלחו את ההודעה כדי לעדכן אותו.</p>
                           </div>
                         )}
                         {/* חלופה להדפסה אם המסמך טרם נחתם דיגיטלית */}
                         <div className="hidden print:flex flex-col items-center justify-end w-[350px]">
                           {!clientSignature && (
                              <>
                                <div className="border-b-2 border-slate-400 w-full mt-24 mb-2"></div>
                                <p className="text-center text-slate-500 text-sm font-medium">חתימת הלקוח (אישור עקרוני)</p>
                              </>
                           )}
                         </div>
                       </div>
                     </div>
                   </div>
                </section>

                {/* --- PAGE 7: INTERACTIVE MAP (CLIENTS) --- */}
                <section className="py-20 px-8 md:px-20 bg-white print:hidden border-t border-slate-100">
                   <div className="max-w-4xl mx-auto text-center mb-10">
                     <h2 className="text-3xl md:text-4xl font-black text-blue-900 mb-4 flex items-center justify-center gap-3">
                       <Map className="w-10 h-10 text-orange-500" />
                       מצא לקוח ממליץ מאזורך
                     </h2>
                     <p className="text-lg text-slate-600">מערכות סולאריות שלנו פזורות בכל רחבי הארץ. תוכלו לנווט במפה, לראות פרויקטים שהתקנו בסביבה שלכם ולקבל המלצות מהלקוחות שלנו שכבר התקינו איתנו</p>
                   </div>
                   
                   <div className="w-full rounded-3xl overflow-hidden shadow-2xl border border-slate-200 relative" style={{ height: '600px' }}>
                      {/* מסכת כיסוי חכמה לכותרת של גוגל (מסתיר את השם ומציג רק את שם החברה בעיצוב תואם) */}
                      <div className="absolute top-0 left-0 w-full h-[58px] bg-blue-900 flex items-center px-6 z-10 shadow-md">
                        <MapPin className="w-5 h-5 text-orange-400 ml-3" />
                        <span className="font-bold text-white text-lg tracking-wide">פרויקטים של מומחי אנרגיה סולארית</span>
                      </div>
                      
                      <iframe 
                        src="https://www.google.com/maps/d/embed?mid=1gmzO7k_SBVucywFFtwSgYE35ltMabc0&ll=31.93778024868962%2C35.098651000000025&z=8" 
                        width="100%" 
                        height="100%" 
                        frameBorder="0"
                        style={{ border: 0 }}
                        allowFullScreen=""
                        aria-hidden="false"
                        tabIndex="0"
                        title="לקוחות ממליצים"
                      ></iframe>
                   </div>
                </section>

                {/* --- LIMITED TIME OFFER BANNER --- */}
                <section className="pb-20 pt-8 px-8 md:px-20 bg-white">
                  <div className="max-w-4xl mx-auto">
                    {/* לתצוגת ווב (טיימר חי וכפתור) */}
                    {!timeLeft.expired ? (
                      <div className="print:hidden bg-gradient-to-r from-orange-500 to-yellow-500 rounded-3xl p-8 md:p-10 shadow-xl text-slate-900 flex flex-col md:flex-row items-center justify-between gap-8 transform hover:scale-[1.01] transition-transform">
                         <div className="flex-1 text-center md:text-right">
                           <div className="flex items-center justify-center md:justify-start gap-3 mb-3">
                             <Gift className="w-8 h-8 text-white animate-pulse" />
                             <h3 className="text-2xl md:text-3xl font-black text-white">הטבה לזמן מוגבל!</h3>
                           </div>
                           <p className="text-lg text-orange-50 font-medium leading-relaxed">
                             אשרו את הצעת המחיר ב-7 הימים הקרובים, וקבלו <strong className="text-slate-900 bg-white/90 px-2 py-0.5 rounded shadow-sm">{limitedOfferHighlightShort}</strong> במתנה עלינו!
                           </p>
                         </div>
                         
                         <div className="flex flex-col items-center gap-4">
                           <div className="flex gap-3 text-center" dir="ltr">
                             <div className="bg-slate-900/10 backdrop-blur-sm rounded-xl p-3 w-16 shadow-inner border border-white/20">
                               <div className="text-2xl font-black tabular-nums leading-none text-white">{String(timeLeft.days).padStart(2, '0')}</div>
                               <div className="text-[10px] text-white/80 mt-1 uppercase tracking-wider font-bold">Days</div>
                             </div>
                             <div className="text-2xl font-black text-white mt-2">:</div>
                             <div className="bg-slate-900/10 backdrop-blur-sm rounded-xl p-3 w-16 shadow-inner border border-white/20">
                               <div className="text-2xl font-black tabular-nums leading-none text-white">{String(timeLeft.hours).padStart(2, '0')}</div>
                               <div className="text-[10px] text-white/80 mt-1 uppercase tracking-wider font-bold">Hrs</div>
                             </div>
                             <div className="text-2xl font-black text-white mt-2">:</div>
                             <div className="bg-slate-900/10 backdrop-blur-sm rounded-xl p-3 w-16 shadow-inner border border-white/20">
                               <div className="text-2xl font-black tabular-nums leading-none text-white">{String(timeLeft.minutes).padStart(2, '0')}</div>
                               <div className="text-[10px] text-white/80 mt-1 uppercase tracking-wider font-bold">Min</div>
                             </div>
                             <div className="text-2xl font-black text-white mt-2">:</div>
                             <div className="bg-slate-900/10 backdrop-blur-sm rounded-xl p-3 w-16 shadow-inner border border-white/20">
                               <div className="text-2xl font-black tabular-nums leading-none text-white">{String(timeLeft.seconds).padStart(2, '0')}</div>
                               <div className="text-[10px] text-white/80 mt-1 uppercase tracking-wider font-bold">Sec</div>
                             </div>
                           </div>
                           <a 
                             href={whatsappLink} 
                             target="_blank" 
                             rel="noopener noreferrer"
                             className="bg-white text-orange-600 hover:bg-slate-50 w-full py-3 px-6 rounded-xl font-black text-lg text-center shadow-lg transition-colors flex items-center justify-center gap-2"
                           >
                             אני רוצה את ההטבה!
                           </a>
                         </div>
                      </div>
                    ) : (
                      <div className="print:hidden bg-blue-50 border border-blue-200 rounded-3xl p-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="text-center md:text-right">
                          <h3 className="text-xl font-bold text-blue-900 mb-1">הצעה זו בתוקף</h3>
                          <p className="text-slate-600">אנו זמינים לכל שאלה. לחצו לאישור ההצעה והתחלת הפרויקט.</p>
                        </div>
                        <a 
                           href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(`שלום, אני ${generatedQuote?.clientName ? generatedQuote.clientName : ''} ${generatedQuote?.clientCity ? `מ${generatedQuote.clientCity}` : ''}. עברתי על הצעת המחיר למערכת סולארית ואני מעוניין/ת לאשר את ההצעה ולהתקדם. אשמח שתיצרו איתי קשר.`)}`}
                           target="_blank" 
                           rel="noopener noreferrer"
                           className="bg-gradient-to-r from-blue-700 to-blue-500 text-white hover:from-blue-600 hover:to-blue-400 px-8 py-3 rounded-xl font-bold text-lg shadow-lg transition-transform transform hover:scale-105"
                        >
                           לאשר הצעה
                        </a>
                      </div>
                    )}
                    
                    {/* לתצוגת PDF (טקסט סטטי) */}
                    <div className="hidden print:block bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center mt-8">
                       <h3 className="text-xl font-bold text-amber-600 mb-2 flex items-center justify-center gap-2">
                         <Gift className="w-5 h-5" /> הטבה מיוחדת
                       </h3>
                       <p className="text-slate-700">אשרו את הצעת המחיר בתוך 7 ימים מתאריך ההפקה, וקבלו {limitedOfferHighlightShort} במתנה!</p>
                    </div>
                  </div>
                </section>

                {/* FOOTER */}
                <footer className="py-10 px-8 md:px-20 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center text-slate-500 print:bg-white">
                  <div className="flex flex-col md:flex-row items-center gap-6 mb-4 md:mb-0 font-medium text-slate-700">
                    {/* הצגת פרטי הסוכן אם הופק ע"י סוכן, אחרת פרטי החברה */}
                    {generatedQuote?.agentDetails ? (
                      <>
                        <span className="flex items-center gap-2 bg-blue-100/50 px-3 py-1.5 rounded-lg border border-blue-200"><User className="w-5 h-5 text-blue-600"/> סוכן אישי: {generatedQuote.agentDetails.name}</span>
                        <span className="flex items-center gap-2"><Phone className="w-5 h-5 text-blue-600"/> {generatedQuote.agentDetails.phone}</span>
                      </>
                    ) : (
                      <span className="flex items-center gap-2"><Phone className="w-5 h-5 text-blue-600"/> {adminPrices.companyPhone}</span>
                    )}
                    <span className="flex items-center gap-2"><MapPin className="w-5 h-5 text-blue-600"/> עין יעקב</span>
                  </div>
                  <div className="flex items-center gap-3 font-bold text-slate-800 text-xl">
                     <BrandLogo className="h-10 w-10 object-contain" />
                     <span className="hidden md:inline-block text-blue-900">מומחי אנרגיה סולארית</span>
                  </div>
                </footer>

                {/* Floating Action Button (WhatsApp) */}
                <div className="fixed bottom-8 left-8 z-50 print:hidden">
                  <a 
                    href={!timeLeft.expired ? whatsappLink : `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`שלום, אני ${generatedQuote?.clientName ? generatedQuote.clientName : ''} ${generatedQuote?.clientCity ? `מ${generatedQuote.clientCity}` : ''}. עברתי על הצעת המחיר למערכת סולארית ואני מעוניין/ת לאשר את ההצעה ולהתקדם. אשמח שתיצרו איתי קשר.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 bg-[#25D366] text-white px-5 py-3 rounded-full shadow-2xl hover:bg-[#20bd5a] transition-all transform hover:scale-105 group relative overflow-hidden border-2 border-white"
                  >
                    <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    {/* WhatsApp SVG Icon */}
                    <svg className="w-7 h-7 fill-current z-10" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                    </svg>
                    <span className="font-bold tracking-wide z-10 hidden md:block text-lg">לאשר הצעה</span>
                    
                    {/* Ripple Effect Background */}
                    <div className="absolute inset-0 bg-[#25D366] rounded-full animate-ping opacity-30 -z-10 scale-150"></div>
                  </a>
                </div>

              </div>

              {/* View Internal Costs (Admin Only) */}
              {currentUser.role === 'admin' && (
                <div className="max-w-6xl mx-auto mt-8 p-7 rounded-2xl text-sm font-mono text-slate-400 print:hidden border border-white/10 shadow-2xl"
                     style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)' }}>
                  <p className="font-black text-white mb-5 text-base border-b border-white/10 pb-3 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-orange-400" />
                    תצוגת מנהל — עלויות פנימיות (Cost)
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-y-4 gap-x-6 border-b border-white/8 pb-5 mb-5">
                    <p>פאנלים: <span className="text-white font-bold">₪{Math.round(generatedQuote.breakdown.panels)}</span></p>
                    <p>ממירים: <span className="text-white font-bold">₪{Math.round(generatedQuote.breakdown.inverter)}</span></p>
                    <p>אגירה: <span className="text-white font-bold">₪{Math.round(generatedQuote.breakdown.batteries)}</span></p>
                    <p>קונסטרוקציה: <span className="text-white font-bold">₪{Math.round(generatedQuote.breakdown.construction)}</span></p>
                    <p>עבודה: <span className="text-white font-bold">₪{Math.round(generatedQuote.breakdown.labor)}</span></p>
                    <p>הובלות: <span className="text-white font-bold">₪{Math.round(generatedQuote.breakdown.logistics)}</span></p>
                    <p>הנדסה: <span className="text-white font-bold">₪{Math.round(generatedQuote.breakdown.engineering)}</span></p>
                    <p>חשמל/בדיקות: <span className="text-white font-bold">₪{Math.round(generatedQuote.breakdown.electricianAndChecks)}</span></p>
                    <p>לוחות חשמל: <span className="text-white font-bold">₪{Math.round(generatedQuote.breakdown.electricalBoxes)}</span></p>
                    <p>אביזרים: <span className="text-white font-bold">₪{Math.round(generatedQuote.breakdown.accessories)}</span></p>
                    <p>אופטימייזרים: <span className="text-white font-bold">₪{Math.round(generatedQuote.breakdown.optimizers)}</span></p>
                    <p>אגרות/שטיפה: <span className="text-white font-bold">₪{Math.round(generatedQuote.breakdown.washing + generatedQuote.breakdown.fees)}</span></p>
                  </div>
                  <div className="flex justify-between items-center bg-black/30 p-5 rounded-2xl border border-white/8">
                    <p className="text-white text-lg">סה"כ Cost פנימי: <span className="font-black text-orange-300">₪{Math.round(generatedQuote.breakdown.totalCost).toLocaleString()}</span></p>
                    <p className="text-green-400 text-lg">רווח נקי: <span className="font-black text-green-300">₪{Math.round(generatedQuote.breakdown.marginValue).toLocaleString()}</span></p>
                  </div>
                </div>
              )}

            </div>
          )}
        </main>
      </div>
    </div>
  );
}