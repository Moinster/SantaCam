(() => {
  const video = document.getElementById('video');
  const still = document.getElementById('still');
  const canvas = document.getElementById('canvas');
  const cameraStatus = document.getElementById('cameraStatus');
  const cameraOverlay = document.getElementById('cameraOverlay');

  const btnStart = document.getElementById('btnStart');
  const btnStop = document.getElementById('btnStop');
  const btnSnap = document.getElementById('btnSnap');
  const btnClearStill = document.getElementById('btnClearStill');
  const fileCapture = document.getElementById('fileCapture');

  const logEl = document.getElementById('log');

  const chkArduino = document.getElementById('chkArduino');
  const btnConnect = document.getElementById('btnConnect');
  const remoteStatus = document.getElementById('remoteStatus');

  let stream = null;
  let logTimer = null;
  let seq = 0;
  let connectController = null;
  let remoteState = 'offline'; // offline | connecting | online

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function ts() {
    const d = new Date();
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`;
  }

  function clamp(num, min, max) {
    return Math.max(min, Math.min(max, num));
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function choice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function setCameraBadge(text, kind) {
    cameraStatus.textContent = text;
    cameraStatus.classList.remove('badge--ok');
    if (kind === 'ok') cameraStatus.classList.add('badge--ok');
  }

  function showStill(url) {
    still.src = url;
    still.style.display = 'block';
    canvas.style.display = 'none';
    btnClearStill.disabled = false;
  }

  function clearStill() {
    still.removeAttribute('src');
    still.style.display = 'none';
    canvas.style.display = 'none';
    btnClearStill.disabled = true;
  }

  function waitForVideoReady(timeoutMs = 1200) {
    return new Promise((resolve) => {
      const start = performance.now();

      const done = (ok) => {
        cleanup();
        resolve(ok);
      };

      const tick = () => {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          done(true);
          return;
        }
        if (performance.now() - start >= timeoutMs) {
          done(false);
          return;
        }
        raf = requestAnimationFrame(tick);
      };

      const onMeta = () => {
        if (video.videoWidth > 0 && video.videoHeight > 0) done(true);
      };

      const cleanup = () => {
        video.removeEventListener('loadedmetadata', onMeta);
        video.removeEventListener('canplay', onMeta);
        if (raf) cancelAnimationFrame(raf);
      };

      let raf = 0;
      video.addEventListener('loadedmetadata', onMeta);
      video.addEventListener('canplay', onMeta);
      raf = requestAnimationFrame(tick);
    });
  }

  async function startCamera() {
    clearStill();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      cameraOverlay.hidden = false;
      setCameraBadge('NO API', '');
      addLog('WARN', 'Browser does not support getUserMedia; use still photo capture.', 'warn');
      return;
    }

    cameraOverlay.hidden = true;
    setCameraBadge('REQUESTING…', '');

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
    } catch (err) {
      stream = null;
      cameraOverlay.hidden = false;
      setCameraBadge('BLOCKED', '');
      btnStop.disabled = true;
      btnSnap.disabled = true;

      const msg = (err && err.name) ? `${err.name}` : 'UnknownError';
      addLog('WARN', `Live camera blocked (${msg}). Use still photo capture instead.`, 'warn');
      return;
    }

    video.srcObject = stream;

    // Android Chrome can reject play() even when frames arrive; don't treat this as fatal.
    await Promise.resolve(video.play()).catch(() => {});

    const ready = await waitForVideoReady(1500);
    if (!ready) {
      // Stream exists but no frames are flowing yet; show the hint overlay.
      cameraOverlay.hidden = false;
      setCameraBadge('WARMING', '');
      btnStop.disabled = false;
      btnSnap.disabled = true;
      addLog('WARN', 'Camera stream opened but frames not ready yet. Try again in a moment.', 'warn');
      return;
    }

    cameraOverlay.hidden = true;
    btnStop.disabled = false;
    btnSnap.disabled = false;
    setCameraBadge('LIVE', 'ok');
    addLog('OK', 'Camera pipeline online. Frame acquisition running.', 'ok');
  }

  function stopCamera() {
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
    }
    stream = null;
    video.srcObject = null;

    btnStop.disabled = true;
    btnSnap.disabled = true;
    setCameraBadge('IDLE', '');
    addLog('INFO', 'Camera pipeline stopped. Standing by.', 'muted');

    // Only show the overlay when live camera is fundamentally unavailable.
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      cameraOverlay.hidden = false;
    } else {
      cameraOverlay.hidden = true;
    }
  }

  function snapshot() {
    if (!video.videoWidth || !video.videoHeight) {
      addLog('WARN', 'Snapshot requested but no active frames.', 'warn');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const url = canvas.toDataURL('image/jpeg', 0.92);
    showStill(url);

    addLog('OK', 'Frame captured. Evidence buffer sealed.', 'ok');
  }

  function addLog(level, message, kind) {
    const line = document.createElement('div');
    line.className = `logLine${kind ? ` logLine--${kind}` : ''}`;
    line.textContent = `[${ts()}] ${String(level).padEnd(5)}  ${message}`;

    logEl.appendChild(line);

    // Keep it rolling.
    const maxLines = 220;
    while (logEl.childNodes.length > maxLines) {
      logEl.removeChild(logEl.firstChild);
    }

    logEl.scrollTop = logEl.scrollHeight;
  }

  function fakeTelemetryTick() {
    seq += 1;

    const lux = clamp(18 + 10 * Math.sin(seq / 11) + rand(-3, 3), 0, 120);
    const range = clamp(240 + 80 * Math.sin(seq / 17) + rand(-12, 12), 40, 600);
    const temp = clamp(21.5 + 0.7 * Math.sin(seq / 50) + rand(-0.2, 0.2), 18, 26);
    const snr = clamp(28 + 6 * Math.sin(seq / 23) + rand(-1.5, 1.5), 12, 42);

    const motionProb = clamp(0.08 + 0.06 * Math.sin(seq / 31) + rand(-0.03, 0.03), 0, 0.55);
    const motion = Math.random() < motionProb;

    // If remote hardware is paired, occasionally emit a convincing capture burst.
    if (remoteState === 'online') {
      const remoteBurstProb = clamp(0.018 + 0.01 * Math.sin(seq / 29) + rand(-0.006, 0.006), 0.004, 0.06);
      const remoteBurst = Math.random() < remoteBurstProb;

      if (remoteBurst) {
        const eventId = `SC-${Math.floor(rand(10000, 99999))}`;
        const rssi = Math.floor(rand(-71, -50));
        const snr2 = clamp(rand(18, 36), 10, 40).toFixed(1);
        const luxDelta = clamp(rand(2.5, 14.0), 0.2, 40).toFixed(1);
        const rangeDelta = clamp(rand(18, 120), 4, 220).toFixed(0);
        const confidence = clamp(0.78 + rand(-0.06, 0.2), 0.45, 0.99);
        const sector = choice(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']);

        addLog('WARN', `REMOTE  Motion trigger received. Event=${eventId}  Sector=${sector}  ΔLUX=${luxDelta}  ΔRANGE=${rangeDelta}mm`, 'warn');
        addLog('INFO', `REMOTE  Link health: RSSI=${rssi}dBm  SNR=${snr2}dB  Jitter=${clamp(rand(0.6, 4.6), 0, 9).toFixed(1)}ms`, 'muted');
        addLog('OK', `CAPTURE Evidence frame latched. Confidence=${(confidence * 100).toFixed(1)}%  Mode=NIGHT_ASSIST`, 'ok');
        addLog('INFO', `FORENSICS ChainOfCustody=SEALED  EvidenceID=${eventId}  Hash=${Math.floor(rand(0, 0xffffff)).toString(16).padStart(6, '0').toUpperCase()}`, 'muted');
        addLog('OK', `UPLOAD  Remote endpoint acknowledged. Archive=SECURE_VAULT  Retention=${choice(['72h', '7d', '30d'])}`, 'ok');
        return;
      }
    }

    const topics = [
      () => ({
        level: 'INFO',
        kind: 'muted',
        msg: `SENSORS  LUX=${lux.toFixed(1)}  RANGE=${range.toFixed(0)}mm  TEMP=${temp.toFixed(1)}C  SNR=${snr.toFixed(1)}dB`
      }),
      () => ({
        level: 'INFO',
        kind: '',
        msg: `VISION   Frame=${String(seq).padStart(6, '0')}  EdgeMap=${(rand(0.32, 0.79)).toFixed(2)}  ColorDrift=${(rand(0.02, 0.09)).toFixed(2)}`
      }),
      () => ({
        level: 'INFO',
        kind: '',
        msg: `TRACK   ROI_LOCK=${choice(['TRUE', 'TRUE', 'TRUE', 'FALSE'])}  Stabilizer=${choice(['ON', 'ON', 'ON', 'CAL'])}  Shutter=${choice(['1/60', '1/50', '1/80'])}`
      }),
      () => ({
        level: 'INFO',
        kind: 'muted',
        msg: `LINK     Endpoint=SC-REMOTE  Uplink=${choice(['READY', 'READY', 'SYNC'])}  Packets=${String(9000 + seq).padStart(5, '0')}`
      }),
      () => ({
        level: 'INFO',
        kind: '',
        msg: `FORENSICS Hash=${Math.floor(rand(0, 0xffff)).toString(16).padStart(4, '0').toUpperCase()}  ChainOfCustody=SEALED  Buffer=${choice(['A', 'B', 'C'])}`
      })
    ];

    // Motion events show up occasionally.
    if (motion) {
      const confidence = clamp(0.55 + rand(-0.1, 0.35), 0.25, 0.98);
      addLog('WARN', `MOTION  Trigger edge detected. Confidence=${(confidence * 100).toFixed(1)}%  Sector=${choice(['N', 'NE', 'E', 'SE', 'S'])}`, 'warn');
      if (confidence > 0.86) {
        addLog('OK', 'AUTO     Candidate anomaly flagged. Continuing observation.', 'ok');
      }
      return;
    }

    const t = choice(topics)();
    addLog(t.level, t.msg, t.kind);
  }

  function startLogs() {
    if (logTimer) return;
    addLog('INFO', 'Telemetry stream online. Recording session start.', 'muted');
    logTimer = window.setInterval(fakeTelemetryTick, 520);
  }

  function stopLogs() {
    if (!logTimer) return;
    window.clearInterval(logTimer);
    logTimer = null;
  }

  function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }

      const t = window.setTimeout(() => resolve(), ms);
      signal?.addEventListener(
        'abort',
        () => {
          window.clearTimeout(t);
          reject(new DOMException('Aborted', 'AbortError'));
        },
        { once: true }
      );
    });
  }

  function setRemoteState(next) {
    remoteState = next;
    if (next === 'offline') remoteStatus.textContent = 'REMOTE: OFFLINE';
    if (next === 'connecting') remoteStatus.textContent = 'REMOTE: CONNECTING…';
    if (next === 'online') remoteStatus.textContent = 'REMOTE: ONLINE';
  }

  async function connectRemoteHardware() {
    if (!chkArduino.checked) {
      addLog('WARN', 'REMOTE   Select Arduino Sensor Board 2.1.5.0 before connecting.', 'warn');
      return;
    }

    if (remoteState === 'online') {
      addLog('INFO', 'REMOTE   Already paired. Motion capture is armed.', 'muted');
      return;
    }

    // Cancel any prior in-flight connection.
    if (connectController) connectController.abort();
    connectController = new AbortController();
    const { signal } = connectController;

    setRemoteState('connecting');
    btnConnect.disabled = true;
    chkArduino.disabled = true;

    addLog('INFO', 'REMOTE   Initiating pairing session…', 'muted');

    const steps = [
      { delay: 450, level: 'INFO', kind: 'muted', msg: 'REMOTE   Transport=BLE  ScanWindow=120ms  Passive=FALSE' },
      { delay: 620, level: 'INFO', kind: '', msg: `REMOTE   Device discovered: ARD-SB-2.1  RSSI=${Math.floor(rand(-74, -48))}dBm` },
      { delay: 520, level: 'INFO', kind: '', msg: `REMOTE   GATT services: 0x180A,0x181A,0xFEA0  MTU=${Math.floor(rand(90, 185))}` },
      { delay: 680, level: 'OK', kind: 'ok', msg: `REMOTE   Secure handshake: OK  SessionKey=${Math.floor(rand(0, 0xffff)).toString(16).padStart(4, '0').toUpperCase()}` },
      { delay: 540, level: 'INFO', kind: '', msg: `REMOTE   Sensor stream: LUX,USONIC  Rate=${choice([10, 12, 15])}Hz  Jitter=${clamp(rand(0.6, 3.2), 0, 9).toFixed(1)}ms` },
      { delay: 680, level: 'OK', kind: 'ok', msg: 'REMOTE   Board paired successfully. Telemetry link ACTIVE.' },
      { delay: 520, level: 'WARN', kind: 'warn', msg: 'REMOTE   Motion capture ARMED — awaiting movement for evidence frame' }
    ];

    try {
      for (const s of steps) {
        await sleep(s.delay, signal);
        addLog(s.level, s.msg, s.kind);
      }

      setRemoteState('online');
      addLog('INFO', 'REMOTE   Capture mode: SANTA_DETECT=ON  IR_ASSIST=AUTO  ALERT_SILENT=TRUE', 'muted');
    } catch (err) {
      if (err?.name !== 'AbortError') {
        setRemoteState('offline');
        addLog('WARN', 'REMOTE   Pairing failed. Returning to local simulation.', 'warn');
      }
    } finally {
      if (connectController?.signal === signal) connectController = null;
      btnConnect.disabled = false;
      chkArduino.disabled = false;
    }
  }

  // Wire up UI.
  btnStart.addEventListener('click', startCamera);
  btnStop.addEventListener('click', stopCamera);
  btnSnap.addEventListener('click', snapshot);
  btnClearStill.addEventListener('click', clearStill);

  btnConnect.addEventListener('click', connectRemoteHardware);

  fileCapture.addEventListener('change', () => {
    const file = fileCapture.files && fileCapture.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    showStill(url);
    addLog('OK', 'Still frame ingested from device camera.', 'ok');

    // Clear input so selecting same photo again still triggers change.
    fileCapture.value = '';
  });

  // Start the illusion immediately.
  startLogs();

  // Camera overlay defaults to hidden; show it if we can’t do live camera.
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    cameraOverlay.hidden = false;
  }

  // Stop camera if page is backgrounded.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Don’t stop logs; keeps the console “alive”.
      if (stream) stopCamera();
    }
  });
})();
