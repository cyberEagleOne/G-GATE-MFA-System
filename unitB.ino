#include <WiFi.h>
#include <PubSubClient.h>

// --- 1. KONFIGURASI NETWORK ---
const char* ssid = "siril";
const char* password = "abcde12345";
const char* mqtt_server = "10.249.47.221";

WiFiClient espClient;
PubSubClient client(espClient);

// --- 2. THE PHANTOM BUTTON ---
#define BOOT_BUTTON 0 
bool isNearHome = false;
unsigned long lastPressTime = 0;

// KOORDINAT SIMULASI (Sesuai dengan Web)
const char* farCoords = "{\"lat\": -6.270000, \"lng\": 106.620000}";   // JAUH (LOCKED)
const char* homeCoords = "{\"lat\": -6.259955, \"lng\": 106.618164}";  // DEKAT (NEARBY)

void reconnect() {
  while (!client.connected()) {
    Serial.print("Connecting Unit B to MQTT...");
    String clientId = "G_GATE_UNIT_B_" + String(random(0xffff), HEX);
    
    if (client.connect(clientId.c_str())) { 
      Serial.println("CONNECTED");
      client.publish("ggate/unitB/online_status", "ONLINE", true);
      
      // ====================================================================
      // PERBAIKAN 1: Tambahkan parameter 'true' di akhir agar pesan di-retain
      // ====================================================================
      client.publish("ggate/unitB/gps", farCoords, true); 
      Serial.println(">>> POSISI AWAL RETAINED SENT");
      
    } else {
      Serial.print("FAILED, rc=");
      Serial.print(client.state());
      Serial.println(" -> Mencoba lagi dalam 5 detik...");
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(BOOT_BUTTON, INPUT_PULLUP);

  Serial.print("Connecting to Wi-Fi...");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { 
    delay(500); 
    Serial.print("."); 
  }
  Serial.println("\nWiFi Connected!");

  client.setServer(mqtt_server, 1883);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  // --- LOGIKA TOMBOL RAHASIA (ANTI DEBOUNCE) ---
  if (digitalRead(BOOT_BUTTON) == LOW) {
    if (millis() - lastPressTime > 1000) { 
      isNearHome = !isNearHome; 
      
      // ====================================================================
      // PERBAIKAN 2: Tambahkan parameter 'true' pada setiap pengiriman tombol
      // ====================================================================
      if (isNearHome) {
        client.publish("ggate/unitB/gps", homeCoords, true);
        Serial.println(">>> SIMULASI: MOBIL TIBA DI RUMAH (NEARBY)");
      } else {
        client.publish("ggate/unitB/gps", farCoords, true);
        Serial.println(">>> SIMULASI: MOBIL PERGI JAUH (LOCKED)");
      }
      lastPressTime = millis();
    }
  }
}