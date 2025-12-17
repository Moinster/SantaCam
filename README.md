# SantaCam Mock Camera Capture with Arduino Sensors

My kid has been wanting to catch Santa in the act for years.  So I finally decided to mock up a SantaCam that "uses" Arduino sensors to trigger a remote camera capture.  This project invloves using a lightweight local web server that you can connect a phone or tablet to and an Arduino compatible MEGA 2560 that runs custom code with a digital Ultrasonic sensor and an Analog Light sensor.  The web interface will "connect" to the Arduino Board to help make all the magic happen.  The code for the Arduio Board will output information once you push the code to make things look offical. The real magic will be what you create as part of the Santa Capture using your favorite AI video generator.

## The SantaCam console

A single-page, mobile-friendly “Santa Cam” console:
- Live camera preview (when allowed)
- Still photo capture fallback (works on more phones)
- Scrolling official-looking telemetry log
- “Activate Remote Hardware” button that shows a connection/arming overlay, then returns to the camera + logs

## Run it

### Option A: simple local server (recommended)
From this folder:

- Python:
  - `python -m http.server 8000`

Then open:
- On the same device: `http://localhost:8000/`
- From your phone on the same Wi‑Fi: `http://<your-computer-ip>:8000/`

### Expose to your web server over the internet with ngrok (optional)

If you want to access the page from a phone away from your home network or to avoid LAN IP issues, `ngrok` can securely tunnel to your local server. Quick steps:

- Install ngrok from https://ngrok.com and sign in to get an auth token.
- Start your local server first, then run (example for port 8000):

  ```bash
  ngrok http 8000
  ```

- ngrok will show a public HTTPS URL (for example `https://abcd-12-34-56.ngrok.io`). Open that on your phone.

- Note: Mobile browsers require HTTPS to grant live camera access to `getUserMedia`. The ngrok HTTPS URL satisfies that requirement so `Start Live Camera` should work.

### Option B: open the file directly
You can try opening `index.html` directly in the mobile browser, but some browsers restrict features when not served from a web origin.

## Camera notes (important)

- **Live camera preview** (`getUserMedia`) requires **HTTPS** on phones (secure context). If you serve this from plain `http://<LAN IP>`, most mobile browsers will block live camera access.
- **Still photo capture** via the "Take Still Photo" button uses the device camera picker (`<input capture>`), which usually works even when live preview is blocked.

If you want true live camera on the phone over Wi‑Fi, serve it over HTTPS (self-signed cert is fine for a home setup, but the browser will show a warning).

## Files

- [index.html](index.html)
- [styles.css](styles.css)
- [app.js](app.js)

## "Pairing" with Arduino Sensor Board

The App has an optional "Arduino Sensor Board 2.1.5.0" that you can pair with.  Below is the code for the Arduino and a mock up of how to connect it together.  For this project I used a MEGA 2560, HC-SR04 Ultrasonic sensor, LDR photoresistor Light sensor, 10kΩ Resistor, and a breadboard to connect everything together.  You can mockup whatever you want for your sensors, this is just what I had laying around.

## Wiring the Arduino MEGA 2560

Power Rails on Breadboard

First, power your breadboard:

Arduino Mega	Breadboard
5V	Red (+) rail
GND	Blue (–) rail

## Ultrasonic Sensor (HC-SR04)

Pins on HC-SR04 are usually labeled VCC, Trig, Echo, GND

HC-SR04 Pin	Arduino Mega Pin
VCC	5V
GND	GND
Trig	Digital 7
Echo	Digital 6

(Order matters — double-check the labels on the sensor)

## Light Sensor (LDR + Resistor)

This uses a voltage divider (very important concept, great teaching moment).

Wiring:

One leg of the LDR → 5V

Other leg of the LDR → A0

One leg of 10kΩ resistor → A0

Other leg of resistor → GND

Visually:

5V ---- LDR ---- A0 ---- Resistor ---- GND

## Arduino Code information (Fully Functional)

This code:

Reads distance from the ultrasonic sensor

Reads light level from the LDR

Prints friendly output to the Serial Monitor including "Camera Sync" information and "device firmware" heartbeat info.

## Arduino Code
```bash
// ===== Santa Cam Sensor Board 2.1.5.0 =====

// Ultrasonic pins
const int trigPin = 7;
const int echoPin = 6;

// Light sensor
const int lightPin = A0;

// Timing
unsigned long lastCameraSyncMessage = 0;
const unsigned long cameraSyncInterval = 10000; // ~10 seconds

void setup() {
  Serial.begin(9600);

  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);

  Serial.println("Santa Cam Sensor Board 2.1.5.0 ONLINE");
}

void loop() {
  // ----- Ultrasonic Distance -----
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  long duration = pulseIn(echoPin, HIGH);
  float distanceCM = duration * 0.034 / 2;

  // ----- Light Sensor -----
  int lightValue = analogRead(lightPin);

  // ----- Sensor Output -----
  Serial.print("Distance: ");
  Serial.print(distanceCM);
  Serial.print(" cm | Light Level: ");
  Serial.print(lightValue);

  if (lightValue < 300) {
    Serial.print(" (Dark - Santa Mode)");
  } else {
    Serial.print(" (Bright)");
  }

  Serial.println();

  // ----- Camera Sync Message (Every ~10s) -----
  unsigned long currentMillis = millis();
  if (currentMillis - lastCameraSyncMessage >= cameraSyncInterval) {
    Serial.println("Waiting for Camera Sync...");
    lastCameraSyncMessage = currentMillis;
  }

  delay(1000); // Sensor update rate
}
```

## Making it real

I've included a small diagram that can be printed for the SantaCam Sensor Board

