# G-GATE

G-GATE is a local IoT smart-gate demo with layered validation. The gate opens only when the system receives the expected MQTT state from the gate hardware and the user/vehicle validation flow.

## Architecture

- Unit A, gate hardware: ESP32, HC-SR04 ultrasonic sensor, and servo motor.
- Unit B, user/vehicle tracker: GPS publisher.
- MQTT broker: Eclipse Mosquitto in Docker.
- Brain: `brain.py`, calculates geofence status from GPS data.
- Dashboard: React, Vite, Leaflet, and MQTT over WebSockets.
- Guest Portal: local guest access page generated from the owner dashboard.

## Local Mode

The dashboard and browser MQTT WebSocket are local-only:

- Dashboard: `http://localhost:5173`
- MQTT WebSocket: `ws://localhost:9001`
- Brain MQTT TCP: `localhost:1883`
- ESP32 MQTT TCP: laptop LAN IP on port `1883`

Port `1883` is intentionally still reachable from the LAN so ESP32 devices can publish sensor/GPS data. Port `9001` is bound to localhost for the web dashboard.

## MQTT Topics

Topic names live in `dashboard/src/config.json`.

- `ggate/unitA/status`: gate state, such as `LOCKED`, `OPEN`, or `WAITING_FOR_CAR`
- `ggate/unitA/car_status`: car sensor state, such as `PRESENT`, `CLEAR`, `1`, or `TRUE`
- `ggate/unitA/command`: dashboard publishes `OPEN`
- `ggate/unitB/gps`: GPS payload, for example `{ "lat": -6.259955, "lng": 106.618164 }`
- `ggate/unitB/status`: Brain publishes `NEARBY` or `AWAY`

## Run

Start the broker:

```powershell
docker compose up -d
```

Start the Brain:

```powershell
py brain.py
```

Start the dashboard:

```powershell
cd dashboard
npm run dev
```

Or start everything with:

```powershell
.\start-demo.ps1
```

## Demo Flow

1. Start Docker Mosquitto, Brain, and the dashboard.
2. Open `http://localhost:5173`.
3. Unit B publishes GPS data to `ggate/unitB/gps`.
4. Brain calculates distance and publishes `NEARBY` or `AWAY`.
5. Unit A publishes car sensor state to `ggate/unitA/car_status`.
6. When geofence is `NEARBY` and car sensor is `PRESENT`, the owner can send the `OPEN` command.
7. The local Guest Portal link can be generated from the dashboard for same-laptop testing.

## Logs

`brain.py` writes geofence events to `gate_logs.db` with timestamp, GPS coordinates, distance, and status.

## Troubleshooting

- If dashboard says connection lost, check Docker Mosquitto and port `9001`.
- If ESP32 cannot connect, use the laptop LAN IP and port `1883`.
- If Brain cannot connect, make sure Docker is running with `docker compose ps`.
- If map tiles do not load, check internet access because Leaflet uses OpenStreetMap tiles.
