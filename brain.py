import json
import math
import sqlite3
from datetime import datetime
from pathlib import Path

import paho.mqtt.client as mqtt
from paho.mqtt.enums import CallbackAPIVersion


BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR / "dashboard" / "src" / "config.json"
DB_PATH = BASE_DIR / "gate_logs.db"

with CONFIG_PATH.open("r", encoding="utf-8") as config_file:
    CONFIG = json.load(config_file)

MQTT_SERVER = CONFIG["mqtt"]["tcpHost"]
MQTT_PORT = CONFIG["mqtt"]["tcpPort"]
TOPICS = CONFIG["mqtt"]["topics"]
GATE_LAT = CONFIG["gate"]["lat"]
GATE_LNG = CONFIG["gate"]["lng"]
GEOFENCE_RADIUS = CONFIG["gate"]["geofenceRadiusMeters"]


def haversine(lat1, lon1, lat2, lon2):
    earth_radius_m = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * earth_radius_m * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """CREATE TABLE IF NOT EXISTS logs (
                timestamp TEXT,
                lat REAL,
                lng REAL,
                distance REAL,
                status TEXT
            )"""
        )


def save_log(lat, lng, distance, status):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "INSERT INTO logs (timestamp, lat, lng, distance, status) VALUES (?, ?, ?, ?, ?)",
            (datetime.now().isoformat(timespec="seconds"), lat, lng, distance, status),
        )


def on_connect(client, userdata, flags, rc, properties=None):
    if rc == 0:
        print("[OK] G-GATE Logic Engine Active")
        print(f"[INFO] Home Base: {GATE_LAT}, {GATE_LNG}")
        print(f"[INFO] Geofence Radius: {GEOFENCE_RADIUS}m")
        client.subscribe(TOPICS["unitGps"])
    else:
        print(f"[ERROR] Failed to connect: {rc}")


def on_message(client, userdata, msg):
    try:
        data = json.loads(msg.payload.decode())
        lat = float(data["lat"])
        lng = float(data["lng"])
        distance = haversine(GATE_LAT, GATE_LNG, lat, lng)
        status = "NEARBY" if distance < GEOFENCE_RADIUS else "AWAY"

        print(f"[GPS] Unit B | Distance: {distance:.1f}m | Status: {status}")
        save_log(lat, lng, distance, status)
        client.publish(TOPICS["unitGeofenceStatus"], status, retain=True)
    except Exception as e:
        print(f"[WARN] Error parsing GPS data: {e}")


client = mqtt.Client(callback_api_version=CallbackAPIVersion.VERSION2)
client.on_connect = on_connect
client.on_message = on_message

try:
    init_db()
    print(f"Connecting to MQTT broker at {MQTT_SERVER}:{MQTT_PORT}...")
    client.connect(MQTT_SERVER, MQTT_PORT, 60)
    client.loop_forever()
except Exception as e:
    print(f"\n[ERROR] Failed to connect to broker. Make sure Docker Mosquitto is running. Error: {e}")
