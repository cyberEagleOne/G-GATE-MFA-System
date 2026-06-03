#include <WiFi.h>
#include <DNSServer.h>
#include <WebServer.h>
#include <PubSubClient.h>
#include <ESP32Servo.h>

// --- 1. KONFIGURASI NETWORK ---
const char* ssid = "siril";
const char* password = "abcde12345";
const char* mqtt_server = "10.249.47.221";

// Konfigurasi WiFi Offline (Untuk Scan NFC Sticker)
const char* ap_ssid = "G-GATE-OFFLINE";
const char* ap_password = "buka-pintu-dong"; 

// --- 2. PIN HARDWARE ---
const int TRIG_PIN = 5;
const int ECHO_PIN = 6;
const int SERVO_PIN = 18;
const int DISTANCE_THRESHOLD = 10; 

// ==========================================================
// KALIBRASI SUDUT GERBANG GESER (SESUAIKAN DENGAN MAKETMU)
// ==========================================================
const int SERVO_LOCKED_ANGLE = 0;   // Sudut saat gerbang menutup rapat
const int SERVO_OPEN_ANGLE = 90;   // Sudut saat gerbang terbuka penuh
const int SERVO_SPEED_MS = 15;      // Jeda per 1 derajat (Makin besar = makin lambat & halus)

// --- 3. VARIABEL & OBJEK ---
Servo gateServo;
WiFiClient espClient;
PubSubClient client(espClient);
DNSServer dnsServer;
WebServer server(80);

bool autoCloseActive = false;
unsigned long openStartTime = 0;
const long closeDelay = 30000; 

bool lastCarPresentState = false; 
bool firstConnect = true;

// VARIABEL UNTUK LOGIKA GERBANG HALUS
int targetServoPos = SERVO_LOCKED_ANGLE;
int currentServoPos = SERVO_LOCKED_ANGLE;
unsigned long lastServoUpdate = 0;

// --- 4. FUNGSI LOGIKA FISIK ---
float getDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duration = pulseIn(ECHO_PIN, HIGH, 30000); 
  if (duration == 0) return 999;
  return (duration * 0.034) / 2;
}

void openGate(String source) {
  targetServoPos = SERVO_OPEN_ANGLE; 
  autoCloseActive = true;
  openStartTime = millis();
  
  String statusMsg = "OPEN_VIA_" + source;
  if (client.connected()) {
    client.publish("ggate/unitA/status", statusMsg.c_str(), true); 
  }
  Serial.println("STATUS: Target Gate -> OPEN (" + source + ")");
}

// --- 5. WEB SERVER HANDLERS (Offline Mode) ---

// CRITICAL FIX: Mengembalikan seluruh script keamanan PIN ke dalam string pembangun HTML
String buildPage(String title, String message, String color, bool isRoot) {
  String html = "<!DOCTYPE html><html><head>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'>";
  html += "<title>G-GATE PORTAL</title>";
  html += "<style>";
  html += "body { background-color: #121212; color: #ffffff; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; margin: 0; padding: 20px; display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 100vh; }";
  html += ".card { background: #1e1e1e; padding: 40px 20px; border-radius: 20px; border-top: 5px solid " + color + "; box-shadow: 0 10px 30px rgba(0,0,0,0.5); width: 100%; max-width: 400px; box-sizing: border-box; }";
  html += "h1 { color: " + color + "; font-size: 1.8rem; margin-top: 0; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; }";
  html += "p { font-size: 1.1rem; color: #bbbbbb; margin-bottom: 30px; line-height: 1.5; }";
  html += ".btn { background-color: " + color + "; border: none; padding: 18px 20px; font-size: 1.1rem; border-radius: 12px; width: 100%; font-weight: bold; color: #121212; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.2); transition: 0.2s; display: block; text-decoration: none; box-sizing: border-box; }";
  html += ".btn-back { background-color: #333333; color: #ffffff; margin-top: 15px; }";
  html += ".btn:active { transform: scale(0.96); }";
  html += "</style></head><body>";
  
  html += "<div class='card'>";
  html += "<h1>" + title + "</h1>";
  html += "<p>" + message + "</p>";
  
  if (isRoot) {
    html += "<form id='gateForm' action='/open' method='POST'>";
    html += "<button class='btn' type='button' onclick='checkSecurePin()'>TAP TO OPEN GATE</button>";
    html += "</form>";
    
    html += "<script>";
    html += "function checkSecurePin() {";
    html += "  let pinInput = prompt('Masukkan 4-Digit PIN Keamanan Rumah:');";
    html += "  if (pinInput === '1234') {"; 
    html += "    alert('PIN Valid! Memeriksa sensor fisik kendaraan...');";
    html += "    document.getElementById('gateForm').submit();"; 
    html += "  } else if (pinInput !== null) {"; // FIX: Sekarang sudah aman di dalam string HTML
    html += "    alert('PIN Salah! Akses ditolak.');";
    html += "  }";
    html += "}";
    html += "</script>";
  } else {
    html += "<a href='/' class='btn btn-back'>KEMBALI KE MENU AWAL</a>";
  }
  
  html += "</div></body></html>";
  return html;
}

void handleRoot() { 
  server.send(200, "text/html", buildPage("G-GATE EMERGENCY", "Koneksi Cloud Terputus.<br>Gunakan akses lokal ini untuk membuka gerbang.", "#00ff88", true)); 
}

void handleOpen() {
  float dist = getDistance();
  if (dist > 0 && dist <= DISTANCE_THRESHOLD) {
    openGate("OFFLINE_WEB");
    server.send(200, "text/html", buildPage("AKSES DITERIMA", "Gerbang sedang dibuka...<br>Akan tertutup otomatis dalam 30 detik.", "#00ff88", false));
  } else {
    server.send(200, "text/html", buildPage("AKSES DITOLAK", "Kendaraan tidak terdeteksi di depan sensor. Mohon maju sedikit dan coba lagi.", "#ff4d4d", false));
  }
}

// --- 6. MQTT & NETWORK LOGIC ---
void callback(char* topic, byte* payload, unsigned int length) {
  String message;
  for (int i = 0; i < length; i++) message += (char)payload[i];
  message.trim(); 
  
  if (message == "OPEN") {
    float dist = getDistance();
    if (dist > 0 && dist <= DISTANCE_THRESHOLD) {
      openGate("MQTT");
    } else {
      client.publish("ggate/unitA/status", "WAITING_FOR_CAR", true);
    }
  } else if (message == "LOCKED") {
    targetServoPos = SERVO_LOCKED_ANGLE; 
    client.publish("ggate/unitA/status", "LOCKED", true);
    autoCloseActive = false;
  }
}

void reconnect() {
  if (!client.connected()) {
    Serial.print("Connecting MQTT...");
    String clientId = "G_GATE_UNIT_A_" + String(random(0xffff), HEX);
    if (client.connect(clientId.c_str(), "ggate/unitA/online_status", 1, true, "OFFLINE")) {
      Serial.println("CONNECTED");
      client.subscribe("ggate/unitA/command");
      client.publish("ggate/unitA/online_status", "ONLINE", true);
      firstConnect = true; 
    }
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT); 
  pinMode(ECHO_PIN, INPUT);
  gateServo.attach(SERVO_PIN); 
  gateServo.write(currentServoPos); 

  WiFi.mode(WIFI_AP_STA);
  WiFi.begin(ssid, password);
  WiFi.softAP(ap_ssid, ap_password);
  
  dnsServer.start(53, "*", WiFi.softAPIP());

  server.on("/", handleRoot);
  server.on("/generate_204", handleRoot); 
  server.on("/open", HTTP_POST, handleOpen);
  server.begin();

  client.setServer(mqtt_server, 1883);
  client.setCallback(callback);
}

void loop() {
  dnsServer.processNextRequest();
  server.handleClient();

  if (WiFi.status() == WL_CONNECTED) {
    if (!client.connected()) reconnect();
    client.loop();
  }

 // LOGIKA UTAMA EKSEKUSI GERBANG HALUS (SMOOTH SWEEP - REVISI 4 DERAJAT)
  if (currentServoPos != targetServoPos) {
    if (millis() - lastServoUpdate >= SERVO_SPEED_MS) {
      int step = 4; // REVISI: Lompat 4 derajat sekaligus agar torsi kuat menembus gesekan gir PLA+
      int selisih = abs(targetServoPos - currentServoPos);
      
      if (selisih <= step) {
        currentServoPos = targetServoPos;
      } else if (currentServoPos < targetServoPos) {
        currentServoPos += step;
      } else {
        currentServoPos -= step;
      }
      
      gateServo.write(currentServoPos); 
      lastServoUpdate = millis();
    }
  }

  // Logika Auto-Close
  if (autoCloseActive && (millis() - openStartTime >= closeDelay)) {
    targetServoPos = SERVO_LOCKED_ANGLE; 
    if (client.connected()) client.publish("ggate/unitA/status", "LOCKED", true);
    autoCloseActive = false;
    Serial.println(">>> AUTO-CLOSE EXECUTED");
  }

  // Heartbeat & Sensor Ultrasonik
  static unsigned long lastCheck = 0;
  if (millis() - lastCheck > 1000) { 
    float d = getDistance();
    Serial.printf("Jarak: %.2f cm\n", d);
    
    bool currentCarPresent = (d > 0 && d <= DISTANCE_THRESHOLD);
    
    if (currentCarPresent != lastCarPresentState || firstConnect) {
      lastCarPresentState = currentCarPresent;
      firstConnect = false; 
      
      if (client.connected()) {
        const char* payload = currentCarPresent ? "PRESENT" : "NOT_DETECTED";
        client.publish("ggate/unitA/car_status", payload, true); 
        Serial.printf(">>> MQTT Broadcast: %s (Retained)\n", payload);
      }
    }
    lastCheck = millis();
  }
}