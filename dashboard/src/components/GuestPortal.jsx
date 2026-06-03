import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import mqtt from 'mqtt'; 

// ==========================================================
// CONFIGURATION (SINKRON DENGAN KOORDINAT KAMPUS/RUMAH)
// ==========================================================
// PERBAIKAN 1: Otomatis mendeteksi jika diuji di laptop sendiri menggunakan 'localhost'
const KAMPUS_IP = window.location.hostname === 'localhost' ? 'localhost' : '10.249.47.221'; 
const HOME_COORDS = { lat: -6.259955, lng: 106.618164 }; 
const GEOFENCE_RADIUS = 0.006; // Radius toleransi jarak GPS

export default function GuestPortal() {
  const { token } = useParams();
  const [guestMqttClient, setGuestMqttClient] = useState(null); 
  const [carAtGate, setCarAtGate] = useState(false);
  const [gateStatus, setGateStatus] = useState('LOCKED');

  const [isValidToken, setIsValidToken] = useState(false);
  const [isGuestNearby, setIsGuestNearby] = useState(false);
  const [guestCoords, setGuestCoords] = useState({ lat: 0, lng: 0 });
  const [gpsLoading, setGpsLoading] = useState(true);
  const [gpsError, setGpsError] = useState('');

  // 1. LOGIKA VALIDASI TOKEN
  useEffect(() => {
    if (token && token.startsWith('G-') && token.length === 7) {
      setIsValidToken(true);
    } else {
      setIsValidToken(false);
    }
  }, [token]);

  // 2. LOGIKA VALIDASI GPS SMARTPHONE TAMU
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError("Browser HP Anda tidak mendukung pelacakan GPS.");
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setGuestCoords({ lat, lng });

        const distance = Math.sqrt(
          Math.pow(lat - HOME_COORDS.lat, 2) + 
          Math.pow(lng - HOME_COORDS.lng, 2)
        );

        if (distance < GEOFENCE_RADIUS) {
          setIsGuestNearby(true);
        } else {
          setIsGuestNearby(false);
        }
        setGpsError('');
        setGpsLoading(false);
      },
      (error) => {
        console.error("GPS Error:", error);
        
        // ==========================================================
        // PERBAIKAN SAKRAL (DEMO BYPASS): 
        // Jika sedang diuji di laptop (localhost), otomatis lolos GPS agar tidak terkunci!
        // ==========================================================
        if (window.location.hostname === 'localhost') {
          setGuestCoords(HOME_COORDS);
          setIsGuestNearby(true);
          setGpsError(''); 
        } else {
          setGpsError("Gagal mendapatkan lokasi. Pastikan GPS HP Aktif & Beri Izin Lokasi.");
        }
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // 3. KONEKSI MQTT INDEPENDENT HP TAMU
  useEffect(() => {
    const REMOTE_URL = `ws://${KAMPUS_IP}:9001`;
    console.log(`[MQTT Guest] Connecting to ${REMOTE_URL}`);
    
    const client = mqtt.connect(REMOTE_URL, {
      clientId: 'ggate_web_guest_' + Math.random().toString(16).substr(2, 4),
      keepalive: 60
    });

    client.on('connect', () => {
      console.log("[MQTT Guest] Connected Successfully!");
      client.subscribe(['ggate/unitA/car_status', 'ggate/unitA/status']);
    });

    client.on('message', (topic, message) => {
      // PERBAIKAN 2: Dipaksa ke UpperCase agar aman dari kesalahan typo huruf kecil/besar
      const msg = message.toString().trim().toUpperCase(); 
      console.log(`[MQTT Guest] [${topic}]: ${msg}`);
      
      if (topic === 'ggate/unitA/car_status') setCarAtGate(msg === 'PRESENT');
      if (topic === 'ggate/unitA/status') setGateStatus(msg);
    });

    setGuestMqttClient(client);
    return () => { if (client) client.end(); };
  }, []);

  const handleOpenGate = () => {
    if (guestMqttClient && carAtGate && isValidToken && isGuestNearby) {
      guestMqttClient.publish('ggate/unitA/command', 'OPEN');
    }
  };

  if (!isValidToken) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', backgroundColor: '#1a1a1a', color: '#ff4d4d', minHeight: '100vh', fontFamily: 'sans-serif' }}>
        <h2 style={{ fontWeight: 900 }}>ACCESS DENIED</h2>
        <p style={{ color: '#aaa' }}>Format Token Akses Tamu Tidak Valid atau Kadaluarsa.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#1a1a1a', color: 'white', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <h2 style={{ fontWeight: 900, marginBottom: '5px' }}>G-GATE GUEST PORTAL</h2>
      <p style={{ color: '#888', margin: 0, fontSize: '14px' }}>Token Verified: <span style={{ color: '#00ff88', fontWeight: 'bold' }}>{token}</span></p>
      
      {/* PANEL INFORMASI VALIDASI GPS HP TAMU */}
      <div style={{ margin: '15px auto', maxWidth: '400px', backgroundColor: '#222', padding: '12px', borderRadius: '15px', fontSize: '12px', border: '1px solid #333' }}>
        {gpsLoading ? (
          <p style={{ color: '#ebff43', margin: 0 }}>🔄 Menghitung Jarak GPS Smartphone Anda ke Gerbang...</p>
        ) : gpsError ? (
          <p style={{ color: '#ff4d4d', margin: 0 }}>⚠️ {gpsError}</p>
        ) : (
          <p style={{ margin: 0, color: isGuestNearby ? '#00ff88' : '#ff4d4d' }}>
            {isGuestNearby 
              ? `📍 GPS HP Tamu Terverifikasi (Berada di Radius Gerbang) ${window.location.hostname === 'localhost' ? '[DEMO MODE active]' : ''}` 
              : `❌ Anda Terlalu Jauh dari Lokasi Gerbang (${guestCoords.lat.toFixed(4)}, ${guestCoords.lng.toFixed(4)})`}
          </p>
        )}
      </div>

      <div style={{ 
        padding: '30px', 
        border: '2px solid', 
        borderColor: (carAtGate && isGuestNearby) ? '#00ff88' : '#ff4d4d',
        borderRadius: '25px',
        margin: '20px auto',
        maxWidth: '400px',
        backgroundColor: '#151515',
        transition: 'all 0.5s ease'
      }}>
        {/* SYARAT KELULUSAN 2FA TAMU */}
        {carAtGate && isGuestNearby ? (
          <>
            <h3 style={{ color: '#00ff88', marginTop: 0, fontWeight: 900 }}>2FA AMAN: SIAP DIBUKA</h3>
            <p style={{ fontSize: '13px', color: '#ccc', marginBottom: '25px' }}>Fisik mobil terdeteksi & GPS terverifikasi. Silakan klik tombol.</p>
            <button 
              onClick={handleOpenGate}
              disabled={gateStatus === 'OPEN'}
              style={{
                padding: '18px 40px',
                fontSize: '16px',
                backgroundColor: gateStatus === 'OPEN' ? '#333' : '#00ff88',
                color: gateStatus === 'OPEN' ? '#666' : '#000',
                border: 'none',
                borderRadius: '15px',
                cursor: 'pointer',
                fontWeight: 'bold',
                width: '100%',
                textTransform: 'uppercase'
              }}
            >
              {gateStatus === 'OPEN' ? 'MENGANGKAT PALANG...' : 'BUKA GERBANG'}
            </button>
          </>
        ) : (
          <>
            <h3 style={{ color: '#ff4d4d', marginTop: 0, fontWeight: 900 }}>AKSES DIKUNCI</h3>
            <p style={{ fontSize: '14px', color: '#aaa', margin: '0 0 10px 0' }}>
              {!isGuestNearby ? "Posisikan diri Anda di area gerbang." : "Posisikan kendaraan Anda tepat di depan sensor ultrasonic gerbang."}
            </p>
            <span style={{ fontSize: '11px', color: '#555' }}>Syarat: GPS Valid + Car Sensor Terdeteksi</span>
          </>
        )}
      </div>

      <div style={{ marginTop: '30px', color: '#666', fontSize: '14px' }}>
        Status Gerbang: <strong style={{ color: gateStatus === 'OPEN' ? '#00ff88' : '#ff4d4d' }}>{gateStatus}</strong>
      </div>
    </div>
  );
}