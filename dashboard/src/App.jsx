import React, { useEffect, useState } from 'react';
import mqtt from 'mqtt';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import OwnerDashboard from './components/OwnerDashboard';
import GuestPortal from './components/GuestPortal';
import config from './config.json';

const MQTT_URL = config.mqtt.websocketUrl;
const TOPICS = config.mqtt.topics;
const HOME_COORDS = { lat: config.gate.lat, lng: config.gate.lng };

export default function App() {
  const [mqttClient, setMqttClient] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [gateStatus, setGateStatus] = useState('LOCKED');
  const [currentPos, setCurrentPos] = useState(HOME_COORDS);
  const [isNearby, setIsNearby] = useState(false);
  const [carAtGate, setCarAtGate] = useState(false);
  const [logs, setLogs] = useState([]);

  const addLogEntry = (eventText, details = {}) => {
    setLogs(prev => [
      {
        id: Date.now() + Math.random(),
        time: new Date().toLocaleTimeString(),
        event: eventText,
        ...details
      },
      ...prev
    ].slice(0, 12));
  };

  useEffect(() => {
    console.log(`[MQTT] Dashboard connecting to ${MQTT_URL}`);
    const client = mqtt.connect(MQTT_URL, {
      clientId: 'ggate_web_' + Math.random().toString(16).slice(2, 6),
      keepalive: 60
    });

    client.on('connect', () => {
      setIsConnected(true);
      client.subscribe([
        TOPICS.gateStatus,
        TOPICS.unitGps,
        TOPICS.carStatus,
        TOPICS.unitGeofenceStatus
      ]);
      addLogEntry('System Monitoring Online');
    });

    client.on('close', () => {
      setIsConnected(false);
      addLogEntry('MQTT Connection Closed');
    });

    client.on('error', error => {
      setIsConnected(false);
      addLogEntry(`MQTT Error: ${error.message}`);
    });

    client.on('message', (topic, message) => {
      const rawMessage = message.toString().trim();
      const msg = rawMessage.toUpperCase();
      console.log(`[MQTT] [${topic}]: ${rawMessage}`);

      if (topic === TOPICS.unitGeofenceStatus) {
        if (msg === 'NEARBY') {
          setIsNearby(true);
          addLogEntry('User Device: NEARBY (via Brain)');
        } else if (msg === 'AWAY') {
          setIsNearby(false);
          addLogEntry('User Device: AWAY (via Brain)');
        }
      }

      if (topic === TOPICS.unitGps) {
        try {
          const data = JSON.parse(rawMessage);
          setCurrentPos(data);
          addLogEntry('GPS Update Received', { lat: data.lat, lng: data.lng });
        } catch (e) {
          console.error('GPS JSON Parse Error:', e);
        }
      }

      if (topic === TOPICS.carStatus) {
        const isPresent = msg === 'PRESENT' || msg === '1' || msg === 'TRUE';
        setCarAtGate(isPresent);
        addLogEntry(isPresent ? 'Car Sensor: PRESENT' : 'Car Sensor: CLEAR');
      }

      if (topic === TOPICS.gateStatus) {
        setGateStatus(msg);
        addLogEntry(`Gate: ${msg}`);
      }
    });

    setMqttClient(client);

    return () => {
      client.end();
    };
  }, []);

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <OwnerDashboard
              mqttClient={mqttClient}
              isConnected={isConnected}
              gateStatus={gateStatus}
              currentPos={currentPos}
              isNearby={isNearby}
              carAtGate={carAtGate}
              logs={logs}
              config={config}
            />
          }
        />
        <Route
          path="/guest/:token"
          element={
            <GuestPortal
              centralMqttClient={mqttClient}
              isConnected={isConnected}
              config={config}
            />
          }
        />
      </Routes>
    </Router>
  );
}
