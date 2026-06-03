import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Lock, Unlock, Activity, ShieldCheck, Share2, 
  Clock, MapPin, Car, AlertCircle, CheckCircle2, Navigation
} from 'lucide-react';

// ==========================================================
// DEFINISI PALET WARNA MARKER BIAR BERBEDA (ANTI-MENUMPUK)
// ==========================================================
const shadowUrl = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png';

// 1. Marker Gerbang Saat Terkunci (Merah)
const gateLockedIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// 2. Marker Gerbang Saat Terbuka (Hijau)
const gateOpenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// 3. Marker Lokasi Michael / Unit B (Emas / Gold)
const ownerIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
  shadowUrl: shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const OwnerDashboard = ({ 
  mqttClient, isConnected, gateStatus, currentPos, logs, isNearby, carAtGate, config
}) => {
  const [guestLink, setGuestLink] = useState('');
  const [commandState, setCommandState] = useState('IDLE');
  
  const topics = config.mqtt.topics;
  const GATE_POS = [config.gate.lat, config.gate.lng];

  useEffect(() => {
    if (gateStatus === 'OPEN' && commandState === 'REQUESTED') setCommandState('CONFIRMED');
    if (gateStatus === 'LOCKED') setCommandState('IDLE');
  }, [gateStatus]);

  const generateLink = () => {
    const token = 'G-' + Math.random().toString(36).substring(2, 7).toUpperCase();
    const link = `${window.location.origin}/#/guest/${token}`;
    setGuestLink(link);
    navigator.clipboard.writeText(link);
    alert("Link Tiket Tamu Lokal Berhasil Dibuat & Disalin!");
  };

  const publishOpenCommand = () => {
    if (!mqttClient || !carAtGate) return;
    setCommandState('REQUESTED');
    mqttClient.publish(topics.gateCommand, 'OPEN');
  };

  return (
    <div className="max-w-7xl mx-auto p-6 text-white font-sans selection:bg-emerald-500/30">
      
      {/* HEADER SECTION */}
      <header className="flex justify-between items-center mb-6 bg-slate-900/80 backdrop-blur-md p-6 rounded-3xl border border-white/5 shadow-2xl">
        <div className="flex items-center gap-6">
          <h1 className="text-2xl font-black italic flex items-center gap-3 tracking-tighter">
            <Activity className={isConnected ? "text-emerald-400 animate-pulse" : "text-red-500"} /> 
            G-GATE <span className="text-emerald-500 font-light not-italic">ADMIN</span>
          </h1>
          
          {/* Dashboard Mini-Status */}
          <div className="hidden md:flex gap-4 border-l border-white/10 pl-6">
            <div className="flex items-center gap-2">
               <div className={`w-2 h-2 rounded-full ${carAtGate ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-slate-600'}`}></div>
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Car Sensor</span>
            </div>
            <div className="flex items-center gap-2">
               <div className={`w-2 h-2 rounded-full ${isNearby ? 'bg-blue-500 shadow-[0_0_8px_#3b82f6]' : 'bg-slate-600'}`}></div>
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">User Geofence</span>
            </div>
          </div>
        </div>

        <div className={`px-4 py-1.5 rounded-full border text-[10px] font-black tracking-widest ${isConnected ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/5' : 'border-red-500/50 text-red-400 bg-red-500/5'}`}>
          {isConnected ? 'SYSTEM ONLINE' : 'CONNECTION LOST'}
        </div>
      </header>

      {/* DYNAMIC NOTIFICATION PANEL (The "MFA" Logic) */}
      {isNearby && gateStatus !== 'OPEN' && (
        <div className={`mb-6 p-6 rounded-[35px] flex flex-col md:flex-row justify-between items-center shadow-2xl transition-all duration-700 border-b-4 ${carAtGate ? 'bg-emerald-400 text-black border-emerald-600' : 'bg-yellow-500 text-black border-yellow-600'}`}>
          <div className="flex items-center gap-5 mb-4 md:mb-0">
            <div className="p-4 bg-black/10 rounded-2xl">
              {carAtGate ? <CheckCircle2 size={32} className="animate-bounce" /> : <ShieldCheck size={32} />}
            </div>
            <div>
              <h3 className="font-black uppercase text-xl leading-none mb-1">
                {carAtGate ? "Ready to Open!" : "Michael is Nearby"}
              </h3>
              <p className="text-sm font-medium opacity-90">
                {carAtGate 
                  ? "Mobil terdeteksi di depan palang. Silakan tekan tombol untuk konfirmasi." 
                  : "GPS Terdeteksi. Menunggu mobil berhenti tepat di depan sensor ultrasonic..."}
              </p>
            </div>
          </div>
          
          <button 
            disabled={!carAtGate || !mqttClient}
            onClick={publishOpenCommand} 
            className={`w-full md:w-auto px-10 py-4 rounded-2xl font-black text-xs uppercase transition-all shadow-xl active:scale-95 ${carAtGate ? 'bg-black text-white hover:bg-slate-800' : 'bg-black/10 text-black/40 cursor-not-allowed'}`}
          >
            {commandState === 'REQUESTED' ? "Menunggu Konfirmasi..." : carAtGate ? "Buka Palang Sekarang" : "Menunggu Mobil..."}
          </button>
        </div>
      )}

      {/* ALERT: JIKA COBA BUKA TAPI MOBIL TIDAK ADA */}
      {gateStatus === 'WAITING_FOR_CAR' && (
        <div className="mb-6 bg-red-600 p-5 rounded-2xl flex items-center gap-4 animate-pulse shadow-lg border border-white/20">
          <AlertCircle size={24} />
          <p className="text-xs font-black uppercase tracking-wider">Akses Ditolak: Mobil belum terdeteksi di depan palang parkir!</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          
          {/* MAIN STATUS VISUALIZER */}
          <div className="bg-slate-900 border border-white/10 rounded-[45px] p-12 flex flex-col items-center justify-center shadow-2xl relative overflow-hidden min-h-[350px]">
            <div className={`p-12 rounded-full mb-8 z-10 transition-all duration-1000 ${gateStatus === 'OPEN' ? 'bg-emerald-500 shadow-[0_0_120px_rgba(16,185,129,0.4)]' : 'bg-red-600 shadow-[0_0_80px_rgba(220,38,38,0.2)]'}`}>
              {gateStatus === 'OPEN' ? <Unlock size={100} className="text-white"/> : <Lock size={100} className="text-white"/>}
            </div>
            <h2 className="text-8xl font-black tracking-tighter z-10 uppercase select-none">
                {gateStatus === 'OPEN' ? 'OPEN' : 'LOCKED'}
            </h2>
            
            {/* Background Glow Overlay */}
            <div className={`absolute inset-0 opacity-10 transition-colors duration-1000 ${gateStatus === 'OPEN' ? 'bg-emerald-500' : 'bg-red-600'}`}></div>
          </div>

          {/* INTERACTIVE MAP */}
          <div className="bg-slate-900 border border-white/10 rounded-[45px] p-2 h-[500px] shadow-2xl overflow-hidden relative">
            <MapContainer center={GATE_POS} zoom={16} style={{ height: '100%', width: '100%', borderRadius: '40px' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              
              {/* Lokasi Gerbang (Dinamis: Hijau saat OPEN, Merah saat LOCKED) */}
              <Marker position={GATE_POS} icon={gateStatus === 'OPEN' ? gateOpenIcon : gateLockedIcon}>
                <Popup className="custom-popup">
                  <div className="font-sans p-1">
                    <b className={gateStatus === 'OPEN' ? "text-emerald-500" : "text-red-500"}>MAIN GATE ({gateStatus})</b><br/>
                    {config.gate.areaLabel}
                  </div>
                </Popup>
              </Marker>

              {/* Lokasi Michael (Unit B) - Berwarna Emas/Kuning */}
              <Marker position={[currentPos.lat, currentPos.lng]} icon={ownerIcon}>
                <Popup>
                  <div className="font-sans p-1 text-center">
                    <Navigation size={14} className="mx-auto text-yellow-500 mb-1"/>
                    <b className="text-yellow-500">MICHAEL (Unit B)</b><br/>
                    Real-time Tracking
                  </div>
                </Popup>
              </Marker>
            </MapContainer>
          </div>
        </div>

        {/* SIDEBAR: CONTROL & AUDIT LOGS */}
        <div className="space-y-6">
          {/* Guest Access Box */}
          <div className="bg-slate-900/80 border border-white/10 rounded-[40px] p-8 text-center shadow-xl backdrop-blur-sm">
            <h3 className="font-bold mb-6 text-emerald-400 text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2">
              <Share2 size={16}/> Guest Management
            </h3>
            <button 
              onClick={generateLink} 
              className="w-full bg-emerald-500 text-black p-5 rounded-2xl font-black text-xs uppercase mb-4 hover:bg-emerald-400 transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
            >
              Generate Access Link
            </button>
            {guestLink && (
              <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 animate-in fade-in slide-in-from-top-2">
                <p className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest">Link Copied to Clipboard!</p>
              </div>
            )}
          </div>

          {/* Security Log Box */}
          <div className="bg-slate-900/80 border border-white/10 rounded-[40px] p-7 shadow-xl h-[510px] flex flex-col backdrop-blur-sm">
            <h3 className="font-bold mb-6 flex items-center gap-2 text-emerald-400 text-[10px] uppercase tracking-[0.2em]">
              <Clock size={16}/> Security Audit Logs
            </h3>
            <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar scroll-smooth">
              {logs && logs.length > 0 ? logs.map((log, index) => (
                <div 
                  key={log.id} 
                  className={`p-4 rounded-2xl border transition-all duration-300 ${index === 0 ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/5'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-[11px] font-black text-slate-100 uppercase tracking-tight">{log.event}</p>
                    <p className="text-[9px] text-slate-500 font-mono bg-black/20 px-2 py-0.5 rounded-md">{log.time}</p>
                  </div>
                  
                  {/* PERBAIKAN SAKRAL: Koordinat hanya di-render jika datanya ada & bukan 0 */}
                  {log.lat !== undefined && log.lng !== undefined && log.lat !== 0 && (
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <MapPin size={10} className="text-emerald-500"/>
                      <p className="text-[10px] font-mono tracking-tighter">
                        {log.lat.toFixed(5)}, {log.lng.toFixed(5)}
                      </p>
                    </div>
                  )}
                </div>
              )) : (
                <div className="flex flex-col items-center justify-center h-full opacity-20">
                   <Activity size={48} className="mb-2"/>
                   <p className="text-xs font-bold italic">Waiting for data...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OwnerDashboard;