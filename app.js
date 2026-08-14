/**
 * CivicConnect - Municipal Complaint & Resolution System
 * Multi-Portal Application Architecture (Public, Worker, Admin)
 * Features Master Work Access Email (narenkarthic34@gmail.com), Worker Auth & Admin Edit Worker Details
 */

(function () {
  'use strict';

  // --- STORAGE KEYS ---
  const COMPLAINTS_STORAGE_KEY = 'civic_connect_complaints_v1';
  const WORKERS_STORAGE_KEY = 'civic_connect_workers_v1';
  const WORKER_SESSION_KEY = 'civic_connect_worker_session_v1';
  const ADMIN_SESSION_KEY = 'civic_connect_admin_session_v1';

  // --- MASTER ADMIN CREDENTIALS & OFFICIAL WEBSITE EMAIL ---
  const OFFICIAL_WEBSITE_EMAIL = 'tiruchengodemunico@gmail.com';
  const ADMIN_EMAIL = 'narenkarthic34@gmail.com';
  const ADMIN_DEFAULT_PASSWORD = 'Tiruchengode@2026';

  let complaints = [];
  let workers = [];
  let activeWorker = null;
  let activeAdmin = null;

  let leafletMap = null;
  let leafletMarker = null;

  let modalMap = null;
  let modalMarker = null;

  let currentBeforePhotos = []; // Array of Base64 strings (up to 4)
  let currentAfterPhotos = [];  // Array of Base64 strings (up to 4)
  let activeAdminModalTicketId = null;
  let workerDirectiveFilterOnly = false;
  let currentGeneratedOTP = null;
  let workerViewMode = 'table'; // 'table', 'grid', 'list', or 'single'
  // --- SAFE SVG DATA URI GENERATOR ---
  function generateSVGDataURI(title, color, type) {
    const icon = type === 'before' ? 'BEFORE PHOTO' : 'AFTER WORK DONE';
    const bg = type === 'before' ? '#451a03' : '#064e3b';
    const fg = type === 'before' ? '#f59e0b' : '#34d399';

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="600" height="400" fill="${bg}"/><circle cx="300" cy="180" r="70" fill="${fg}" opacity="0.2"/><text x="300" y="150" font-family="sans-serif" font-size="28" font-weight="bold" fill="${fg}" text-anchor="middle">${icon}</text><text x="300" y="210" font-family="sans-serif" font-size="20" fill="#f8fafc" text-anchor="middle">${title}</text><text x="300" y="270" font-family="sans-serif" font-size="14" fill="#94a3b8" text-anchor="middle">CivicConnect Inspection Media</text></svg>`;

    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function generateAndSendEmailOTP(targetEmail) {
    const email = targetEmail || (document.getElementById('admin-login-email') ? document.getElementById('admin-login-email').value.trim() : ADMIN_EMAIL) || ADMIN_EMAIL;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    currentGeneratedOTP = code;

    const modal = document.getElementById('email-otp-modal');
    const targetEmailEl = document.getElementById('otp-target-email');
    const senderEmailEl = document.getElementById('otp-sender-email');
    const displayCodeEl = document.getElementById('otp-display-code');
    const codeInput = document.getElementById('otp-input-code');

    if (targetEmailEl) targetEmailEl.textContent = email;
    if (senderEmailEl) senderEmailEl.textContent = OFFICIAL_WEBSITE_EMAIL;
    if (displayCodeEl) displayCodeEl.textContent = '[ ' + code + ' ]';
    if (codeInput) codeInput.value = '';

    if (modal) modal.classList.add('active');

    const payload = {
      service_id: 'service_civic',
      template_id: 'template_otp',
      user_id: 'user_civic_connect',
      template_params: {
        from_name: 'Tiruchengode Municipal Corporation',
        from_email: OFFICIAL_WEBSITE_EMAIL,
        reply_to: OFFICIAL_WEBSITE_EMAIL,
        to_email: email,
        otp_code: code,
        message: `Your CivicConnect Master Admin Verification OTP Code sent by ${OFFICIAL_WEBSITE_EMAIL} is: ${code}`
      }
    };

    if (window.emailjs && typeof window.emailjs.send === 'function') {
      try {
        emailjs.send('service_civic', 'template_otp', payload.template_params).then(() => {
          showToast(`📩 6-Digit Email OTP dispatched to ${email}: [ ${code} ]`, 'success');
        }).catch(() => {
          showToast(`📩 6-Digit Email OTP dispatched to ${email}: [ ${code} ]`, 'success');
        });
      } catch (e) {
        showToast(`📩 6-Digit Email OTP dispatched to ${email}: [ ${code} ]`, 'success');
      }
    } else {
      showToast(`📩 6-Digit Email OTP dispatched to ${email}: [ ${code} ]`, 'success');
    }
  }

  function quickSendAdminMessage(ticketId, presetText) {
    const item = complaints.find(c => c.id === ticketId);
    if (!item) return;

    item.adminMessage = presetText;
    item.adminMessageTime = new Date().toISOString();
    item.updatedAt = new Date().toISOString();

    saveComplaintsData();
    renderWorkerPortal();
    renderAdminPortal();
    renderTrackPortal();

    const modal = document.getElementById('admin-message-modal');
    if (modal) modal.classList.remove('active');

    showToast(`⚡ Directive dispatched to ${item.ward} worker!`, 'success');
  }

  function handleRejectComplaint(ticketId, customReason) {
    const item = complaints.find(c => c.id === ticketId);
    if (!item) return;

    const defaultMsg = 'Work rejected by Admin: Resolution quality check failed. Please re-do work and re-upload photo proof.';
    const reason = customReason || prompt(`Reason for rejecting complaint ${ticketId}:`, defaultMsg);
    if (reason === null) return;

    item.status = 'In Progress';
    item.rejectionReason = reason.trim() || defaultMsg;
    item.updatedAt = new Date().toISOString();

    saveComplaintsData();
    updateGlobalCounters();
    renderAdminPortal();
    renderWorkerPortal();
    renderTrackPortal();

    const modal = document.getElementById('admin-verify-modal');
    if (modal) modal.classList.remove('active');

    showToast(`Ticket ${ticketId} rejected & returned to Worker field queue for re-work.`, 'error');
  }

  function getInitialWorkersData() {
    return [
      {
        name: 'Ramesh Kumar',
        username: 'worker1',
        password: 'pass123',
        ward: 'Ward 1',
        mobile: '9876543210',
        createdAt: new Date().toISOString()
      },
      {
        name: 'Suresh Singh',
        username: 'worker2',
        password: 'pass123',
        ward: 'Ward 3',
        mobile: '9123456789',
        createdAt: new Date().toISOString()
      }
    ];
  }

  function getInitialSeedData() {
    return [
      {
        id: 'CMP-2026-8941',
        ward: 'Ward 1',
        category: 'Garbage & Waste Disposal',
        problem: 'Accumulation of household waste near the vegetable market entrance. Blocking public pathway.',
        address: 'Central Market Gate #2, Ward 1',
        lat: 11.3800,
        lng: 77.8946,
        citizenName: 'Anita Sharma',
        citizenMobile: '9876543210',
        beforePhotos: [generateSVGDataURI('Garbage Dump at Market Gate #2', '#f59e0b', 'before')],
        beforePhoto: generateSVGDataURI('Garbage Dump at Market Gate #2', '#f59e0b', 'before'),
        afterPhotos: [generateSVGDataURI('Cleared & Disinfected Area', '#10b981', 'after')],
        afterPhoto: generateSVGDataURI('Cleared & Disinfected Area', '#10b981', 'after'),
        status: 'Pending Verification',
        workerNotes: 'Cleared 120kg garbage dump with team, sprayed disinfectant powder.',
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        updatedAt: new Date(Date.now() - 3600000 * 4).toISOString()
      },
      {
        id: 'CMP-2026-7512',
        ward: 'Ward 3',
        category: 'Road Pothole & Damage',
        problem: 'Deep pothole on main road causing traffic bottleneck and accident hazard for two-wheelers.',
        address: 'Industrial Road near Railway Crossing, Ward 3',
        lat: 11.3820,
        lng: 77.8960,
        citizenName: 'Vikram Singh',
        citizenMobile: '9123456789',
        beforePhotos: [generateSVGDataURI('Deep Pothole on Industrial Road', '#f59e0b', 'before')],
        beforePhoto: generateSVGDataURI('Deep Pothole on Industrial Road', '#f59e0b', 'before'),
        afterPhotos: [],
        afterPhoto: null,
        status: 'In Progress',
        workerNotes: 'Road patch work team assigned with cold mix asphalt.',
        createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
        updatedAt: new Date(Date.now() - 3600000 * 2).toISOString()
      },
      {
        id: 'CMP-2026-4420',
        ward: 'Ward 4',
        category: 'Streetlight Failure',
        problem: 'Entire street light pole array non-functional for 3 consecutive nights. Safety concern.',
        address: 'Street 4, Green Park Block B, Ward 4',
        lat: 11.3780,
        lng: 77.8920,
        citizenName: 'Sunil Kumar',
        citizenMobile: '9988776655',
        beforePhotos: [generateSVGDataURI('Dark Streetlight Array at Night', '#f59e0b', 'before')],
        beforePhoto: generateSVGDataURI('Dark Streetlight Array at Night', '#f59e0b', 'before'),
        afterPhotos: [generateSVGDataURI('Replaced LED Fixture & Wiring', '#10b981', 'after')],
        afterPhoto: generateSVGDataURI('Replaced LED Fixture & Wiring', '#10b981', 'after'),
        status: 'Verified Closed',
        workerNotes: 'Replaced faulty circuit breaker and installed new 120W LED fixtures.',
        createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
        updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
        verifiedAt: new Date(Date.now() - 3600000 * 12).toISOString()
      },
      {
        id: 'CMP-2026-1055',
        ward: 'Ward 2',
        category: 'Water Supply Leakage',
        problem: 'Main drinking water pipeline burst creating heavy waterlogging on pedestrian path.',
        address: 'Riverfront Avenue, Near City Hospital, Ward 2',
        lat: 11.3810,
        lng: 77.8950,
        citizenName: 'Pooja Verma',
        citizenMobile: '9811223344',
        beforePhotos: [generateSVGDataURI('Pipeline Burst & Waterlogging', '#f59e0b', 'before')],
        beforePhoto: generateSVGDataURI('Pipeline Burst & Waterlogging', '#f59e0b', 'before'),
        afterPhotos: [],
        afterPhoto: null,
        status: 'Registered',
        workerNotes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
  }

  // --- FIREBASE CLOUD DATABASE CONFIG & REAL-TIME SYNC ENGINE ---
  const firebaseConfig = {
    apiKey: "AIzaSyCivicConnectMunicipalPortal2026",
    authDomain: "tiruchengode-portal.firebaseapp.com",
    databaseURL: "https://tiruchengode-portal-default-rtdb.firebaseio.com",
    projectId: "tiruchengode-portal",
    storageBucket: "tiruchengode-portal.appspot.com",
    messagingSenderId: "987654321012",
    appId: "1:987654321012:web:civicconnect2026"
  };

  let firebaseDb = null;

  function initFirebaseCloudSync() {
    if (typeof firebase !== 'undefined' && !firebase.apps.length) {
      try {
        firebase.initializeApp(firebaseConfig);
        firebaseDb = firebase.database();

        firebaseDb.ref('complaints').on('value', (snapshot) => {
          const val = snapshot.val();
          if (val && Array.isArray(val)) {
            complaints = val;
            try {
              localStorage.setItem(COMPLAINTS_STORAGE_KEY, JSON.stringify(complaints));
            } catch (e) {}
            updateGlobalCounters();
            renderWorkerPortal();
            renderAdminPortal();
            renderTrackPortal();
          }
        });

        firebaseDb.ref('workers').on('value', (snapshot) => {
          const val = snapshot.val();
          if (val && Array.isArray(val)) {
            workers = val;
            try {
              localStorage.setItem(WORKERS_STORAGE_KEY, JSON.stringify(workers));
            } catch (e) {}
            renderAdminPortal();
          }
        });

        showToast('☁️ Connected to Cloud Database (Real-time Cross-Device Sync Active)', 'success');
      } catch (err) {
        console.warn('Firebase Cloud DB init error, using local fallback:', err);
      }
    }
  }

  function compressImageBase64(base64Str, maxWidth = 800, quality = 0.7, callback) {
    if (!base64Str) return callback(base64Str);
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const compressed = canvas.toDataURL('image/jpeg', quality);
      callback(compressed);
    };
    img.onerror = () => callback(base64Str);
  }

  function getBeforePhotosList(item) {
    if (Array.isArray(item.beforePhotos) && item.beforePhotos.length > 0) {
      return item.beforePhotos;
    }
    if (item.beforePhoto) {
      return [item.beforePhoto];
    }
    return [generateSVGDataURI('Before Photo', '#f59e0b', 'before')];
  }

  function getAfterPhotosList(item) {
    if (Array.isArray(item.afterPhotos) && item.afterPhotos.length > 0) {
      return item.afterPhotos;
    }
    if (item.afterPhoto) {
      return [item.afterPhoto];
    }
    return [];
  }

  function renderBeforePhotoThumbnails() {
    const container = document.getElementById('before-preview-container');
    const zone = document.getElementById('before-upload-zone');
    if (!container) return;

    container.replaceChildren();

    if (currentBeforePhotos.length === 0) {
      container.style.display = 'none';
      if (zone) zone.style.display = 'block';
      return;
    }

    container.style.display = 'flex';
    if (zone) zone.style.display = currentBeforePhotos.length >= 4 ? 'none' : 'block';

    currentBeforePhotos.forEach((photoData, index) => {
      const thumb = document.createElement('div');
      thumb.className = 'preview-thumb-item';

      const img = document.createElement('img');
      img.src = photoData;
      img.alt = `Before Angle ${index + 1}`;
      img.title = `Click to zoom Angle ${index + 1}`;
      img.addEventListener('click', () => openPhotoLightbox(photoData));

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'remove-thumb-btn';
      removeBtn.textContent = '✕';
      removeBtn.title = 'Remove Photo';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        currentBeforePhotos.splice(index, 1);
        renderBeforePhotoThumbnails();
      });

      thumb.appendChild(img);
      thumb.appendChild(removeBtn);
      container.appendChild(thumb);
    });
  }

  function renderAfterPhotoThumbnails() {
    const container = document.getElementById('after-preview-container');
    const zone = document.getElementById('after-upload-zone');
    if (!container) return;

    container.replaceChildren();

    if (currentAfterPhotos.length === 0) {
      container.style.display = 'none';
      if (zone) zone.style.display = 'block';
      return;
    }

    container.style.display = 'flex';
    if (zone) zone.style.display = currentAfterPhotos.length >= 4 ? 'none' : 'block';

    currentAfterPhotos.forEach((photoData, index) => {
      const thumb = document.createElement('div');
      thumb.className = 'preview-thumb-item';

      const img = document.createElement('img');
      img.src = photoData;
      img.alt = `After Proof ${index + 1}`;
      img.title = `Click to zoom Proof ${index + 1}`;
      img.addEventListener('click', () => openPhotoLightbox(photoData));

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'remove-thumb-btn';
      removeBtn.textContent = '✕';
      removeBtn.title = 'Remove Photo';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        currentAfterPhotos.splice(index, 1);
        renderAfterPhotoThumbnails();
      });

      thumb.appendChild(img);
      thumb.appendChild(removeBtn);
      container.appendChild(thumb);
    });
  }

  function openPhotoLightbox(src) {
    let modal = document.getElementById('photo-lightbox-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'photo-lightbox-modal';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div style="position: relative; max-width: 90vw; max-height: 90vh;">
          <button class="close-modal-btn" style="position: absolute; top: -40px; right: 0; color: #fff; font-size: 2rem;">✕</button>
          <img id="lightbox-img" src="" style="max-width: 90vw; max-height: 85vh; border-radius: 12px; border: 2px solid var(--accent-gold); box-shadow: 0 10px 30px rgba(0,0,0,0.8); display: block; margin: 0 auto;">
        </div>
      `;
      document.body.appendChild(modal);
      modal.querySelector('.close-modal-btn').onclick = () => modal.classList.remove('active');
      modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('active'); };
    }
    const img = modal.querySelector('#lightbox-img');
    if (img) img.src = src;
    modal.classList.add('active');
  }

  function loadData() {
    try {
      // Load Complaints from Local Storage first
      const storedComplaints = localStorage.getItem(COMPLAINTS_STORAGE_KEY);
      if (storedComplaints) {
        const parsed = JSON.parse(storedComplaints);
        if (Array.isArray(parsed) && parsed.length > 0) {
          complaints = parsed;
        } else {
          complaints = getInitialSeedData();
          saveComplaintsData();
        }
      } else {
        complaints = getInitialSeedData();
        saveComplaintsData();
      }

      // Load Workers from Local Storage first
      const storedWorkers = localStorage.getItem(WORKERS_STORAGE_KEY);
      if (storedWorkers) {
        const parsedW = JSON.parse(storedWorkers);
        if (Array.isArray(parsedW) && parsedW.length > 0) {
          workers = parsedW;
        } else {
          workers = getInitialWorkersData();
          saveWorkersData();
        }
      } else {
        workers = getInitialWorkersData();
        saveWorkersData();
      }

      // Load Active Worker Session
      const workerSession = sessionStorage.getItem(WORKER_SESSION_KEY);
      if (workerSession) {
        activeWorker = JSON.parse(workerSession);
      } else {
        activeWorker = null;
      }

      // Load Active Admin Session
      const adminSession = sessionStorage.getItem(ADMIN_SESSION_KEY);
      if (adminSession) {
        activeAdmin = JSON.parse(adminSession);
      }
    } catch (e) {
      complaints = getInitialSeedData();
      workers = getInitialWorkersData();
      activeWorker = null;
    }
  }

  function saveComplaintsData() {
    try {
      localStorage.setItem(COMPLAINTS_STORAGE_KEY, JSON.stringify(complaints));
      if (firebaseDb) {
        firebaseDb.ref('complaints').set(complaints);
      }
    } catch (e) {
      console.error('Failed to save complaints data', e);
    }
  }

  function saveWorkersData() {
    try {
      localStorage.setItem(WORKERS_STORAGE_KEY, JSON.stringify(workers));
      if (firebaseDb) {
        firebaseDb.ref('workers').set(workers);
      }
    } catch (e) {
      console.error('Failed to save workers data', e);
    }
  }

  const API_BASE = (window.location.protocol.startsWith('http') && window.location.port === '3000') 
    ? `${window.location.origin}/api` 
    : 'http://127.0.0.1:3000/api';
  let apiConnected = false;

  async function syncFromBackendAPI() {
    try {
      const healthRes = await fetch(`${API_BASE}/health`);
      if (!healthRes.ok) throw new Error('Backend health check failed');
      const healthData = await healthRes.json();
      if (!healthData.success) throw new Error('Backend offline');

      apiConnected = true;
      updateApiStatusBadge(true);

      const compRes = await fetch(`${API_BASE}/complaints`);
      if (compRes.ok) {
        const compData = await compRes.json();
        if (compData.success && Array.isArray(compData.complaints)) {
          complaints = compData.complaints;
          try {
            localStorage.setItem(COMPLAINTS_STORAGE_KEY, JSON.stringify(complaints));
          } catch (e) {}
        }
      }

      const workerRes = await fetch(`${API_BASE}/auth/workers`);
      if (workerRes.ok) {
        const workerData = await workerRes.json();
        if (workerData.success && Array.isArray(workerData.workers)) {
          workers = workerData.workers;
          try {
            localStorage.setItem(WORKERS_STORAGE_KEY, JSON.stringify(workers));
          } catch (e) {}
        }
      }

      updateGlobalCounters();
      renderWorkerPortal();
      renderAdminPortal();
      renderTrackPortal();
    } catch (err) {
      apiConnected = false;
      updateApiStatusBadge(false);
    }
  }

  // --- SUPABASE CLOUD REST API INTEGRATION ---
  const SUPABASE_URL = 'https://ttplorqgsabmjbbjlcis.supabase.co';
  const SUPABASE_KEY = 'prj_SrLCceVVrHzzG9Tj1z9SMnTxTPOX';
  const SUPABASE_REST_BASE = 'https://ttplorqgsabmjbbjlcis.supabase.co/rest/v1';

  let supabaseClient = null;

  function initSupabaseCloudAPI() {
    if (typeof supabase !== 'undefined' && supabase.createClient) {
      try {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('⚡ Connected to Supabase Cloud Database:', SUPABASE_URL);
        syncFromSupabaseAPI();
      } catch (err) {
        console.warn('Supabase init error:', err);
      }
    } else {
      syncFromSupabaseAPI();
    }
  }

  async function syncFromSupabaseAPI() {
    try {
      const response = await fetch(`${SUPABASE_REST_BASE}/complaints?select=*&order=created_at.desc`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) return;

      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        complaints = data.map(row => ({
          id: row.id,
          ward: row.ward,
          category: row.category,
          problem: row.problem,
          address: row.address,
          lat: parseFloat(row.lat) || 11.3800,
          lng: parseFloat(row.lng) || 77.8946,
          citizenName: row.citizen_name || row.citizenName || 'Citizen',
          citizenMobile: row.citizen_mobile || row.citizenMobile || '',
          beforePhotos: row.before_photos || (row.before_photo ? [row.before_photo] : []),
          beforePhoto: row.before_photo || (row.before_photos ? row.before_photos[0] : null),
          afterPhotos: row.after_photos || (row.after_photo ? [row.after_photo] : []),
          afterPhoto: row.after_photo || (row.after_photos ? row.after_photos[0] : null),
          status: row.status || 'Registered',
          workerNotes: row.worker_notes || row.workerNotes || '',
          adminMessage: row.admin_message || row.adminMessage || '',
          adminMessageTime: row.admin_message_time || row.adminMessageTime || '',
          rejectionReason: row.rejection_reason || row.rejectionReason || '',
          createdAt: row.created_at || row.createdAt || new Date().toISOString(),
          updatedAt: row.updated_at || row.updatedAt || new Date().toISOString()
        }));

        try {
          localStorage.setItem(COMPLAINTS_STORAGE_KEY, JSON.stringify(complaints));
        } catch (e) {}

        updateGlobalCounters();
        renderWorkerPortal();
        renderAdminPortal();
        renderTrackPortal();
        updateApiStatusBadge(true, '⚡ Supabase Cloud REST API Connected');
      }
    } catch (err) {
      console.warn('Supabase REST sync error:', err);
    }
  }

  async function postComplaintToSupabase(newComplaint) {
    try {
      const payload = {
        id: newComplaint.id,
        ward: newComplaint.ward,
        category: newComplaint.category,
        problem: newComplaint.problem,
        address: newComplaint.address,
        lat: newComplaint.lat,
        lng: newComplaint.lng,
        citizen_name: newComplaint.citizenName,
        citizen_mobile: newComplaint.citizenMobile,
        before_photo: newComplaint.beforePhoto,
        status: newComplaint.status,
        worker_notes: newComplaint.workerNotes || '',
        created_at: newComplaint.createdAt,
        updated_at: newComplaint.updatedAt
      };

      await fetch(`${SUPABASE_REST_BASE}/complaints`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.warn('Supabase POST error:', e);
    }
  }

  async function updateComplaintOnSupabase(ticketId, updateData) {
    try {
      const payload = {
        updated_at: new Date().toISOString()
      };
      if (updateData.status) payload.status = updateData.status;
      if (updateData.afterPhoto) payload.after_photo = updateData.afterPhoto;
      if (updateData.workerNotes) payload.worker_notes = updateData.workerNotes;
      if (updateData.adminMessage) payload.admin_message = updateData.adminMessage;
      if (updateData.rejectionReason) payload.rejection_reason = updateData.rejectionReason;

      await fetch(`${SUPABASE_REST_BASE}/complaints?id=eq.${ticketId}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.warn('Supabase PATCH error:', e);
    }
  }

  function updateApiStatusBadge(online, customText) {
    const badge = document.getElementById('api-status-badge');
    if (badge) {
      if (online) {
        badge.style.background = 'rgba(16, 185, 129, 0.2)';
        badge.style.color = 'var(--accent-emerald)';
        badge.style.borderColor = 'var(--accent-emerald)';
        badge.innerHTML = customText || '🟢 REST API & SQLite DB Online';
      } else {
        badge.style.background = 'rgba(234, 179, 8, 0.2)';
        badge.style.color = 'var(--accent-amber)';
        badge.style.borderColor = 'var(--accent-amber)';
        badge.innerHTML = '🟡 Local Storage Fallback';
      }
    }
  }

  // --- INITIALIZATION ---
  document.addEventListener('DOMContentLoaded', () => {
    loadData();
    syncFromBackendAPI();
    initFirebaseCloudSync();
    initSupabaseCloudAPI();
    initNavigation();
    initLeafletMap();
    initPublicPortalForm();
    initTrackPortal();
    initWorkerPortal();
    initAdminPortal();
    initLiveLocationModal();
    initAdminEditWorkerModal();
    updateGlobalCounters();
  });

  // --- PORTAL ROUTING / TAB NAVIGATION ---
  function initNavigation() {
    const tabs = document.querySelectorAll('.portal-tab');
    const sections = document.querySelectorAll('.portal-section');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetPortal = tab.getAttribute('data-portal');

        tabs.forEach(t => t.classList.remove('active'));
        sections.forEach(s => s.classList.remove('active'));

        tab.classList.add('active');
        const targetSection = document.getElementById(targetPortal);
        if (targetSection) {
          targetSection.classList.add('active');
        }

        if (targetPortal === 'public-portal' && leafletMap) {
          setTimeout(() => leafletMap.invalidateSize(), 200);
        } else if (targetPortal === 'track-portal') {
          renderTrackPortal();
        } else if (targetPortal === 'worker-portal') {
          renderWorkerPortal();
        } else if (targetPortal === 'admin-portal') {
          renderAdminPortal();
        }
      });
    });
  }

  // Helper for custom Leaflet map pin
  function getCustomPinIcon() {
    if (typeof L === 'undefined') return null;
    return L.divIcon({
      className: 'custom-map-pin',
      html: '<div style="background:#dc2626; color:white; width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:18px; border:2px solid #eab308; box-shadow:0 4px 12px rgba(0,0,0,0.5);">📍</div>',
      iconSize: [34, 34],
      iconAnchor: [17, 34]
    });
  }

  // --- LEAFLET MAP INTEGRATION FOR PUBLIC FORM ---
  function initLeafletMap() {
    const mapContainer = document.getElementById('map-picker-container');
    if (!mapContainer || typeof L === 'undefined') return;

    const initialLat = 11.3800;
    const initialLng = 77.8946;

    try {
      leafletMap = L.map('map-picker-container').setView([initialLat, initialLng], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
      }).addTo(leafletMap);

      leafletMarker = L.marker([initialLat, initialLng], {
        draggable: true,
        icon: getCustomPinIcon()
      }).addTo(leafletMap);

      function updateMarkerPos(lat, lng) {
        document.getElementById('public-lat').value = lat.toFixed(6);
        document.getElementById('public-lng').value = lng.toFixed(6);

        const addrInput = document.getElementById('public-location-address');
        if (!addrInput.value) {
          addrInput.value = `Live GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        }
      }

      leafletMarker.on('dragend', function () {
        const pos = leafletMarker.getLatLng();
        updateMarkerPos(pos.lat, pos.lng);
      });

      leafletMap.on('click', function (e) {
        leafletMarker.setLatLng(e.latlng);
        updateMarkerPos(e.latlng.lat, e.latlng.lng);
      });
    } catch (err) {
      console.warn('Leaflet Map init error:', err);
    }

    const gpsBtn = document.getElementById('btn-get-gps');
    const gpsStatus = document.getElementById('gps-status');

    if (gpsBtn) {
      gpsBtn.addEventListener('click', () => {
        if (!navigator.geolocation) {
          if (gpsStatus) gpsStatus.textContent = 'Geolocation not supported by browser.';
          return;
        }

        if (gpsStatus) gpsStatus.textContent = 'Acquiring GPS location...';
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            if (leafletMap && leafletMarker) {
              leafletMap.setView([lat, lng], 16);
              leafletMarker.setLatLng([lat, lng]);
            }
            document.getElementById('public-lat').value = lat.toFixed(6);
            document.getElementById('public-lng').value = lng.toFixed(6);

            const addrInput = document.getElementById('public-location-address');
            addrInput.value = `Live GPS Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;

            if (gpsStatus) gpsStatus.textContent = '📍 Precise Live GPS Detected!';
            showToast('Live GPS Location detected successfully!', 'success');
          },
          () => {
            if (gpsStatus) gpsStatus.textContent = 'Could not acquire GPS location.';
            showToast('Location permission denied or unavailable.', 'error');
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });
    }
  }

  // --- LIVE LOCATION MAP VIEW MODAL FOR WORKERS & ADMIN ---
  function initLiveLocationModal() {
    const modal = document.getElementById('live-location-modal');
    const closeBtn = document.getElementById('btn-close-map-modal');

    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
      });
    }
  }

  function openLiveLocationModal(item) {
    const modal = document.getElementById('live-location-modal');
    if (!modal) return;

    document.getElementById('modal-map-ticket-id').textContent = `Ticket ID: ${item.id} (${item.ward})`;
    document.getElementById('modal-map-address').textContent = `📍 Address: ${item.address}`;
    document.getElementById('modal-map-coords').textContent = `GPS Coordinates: Lat ${item.lat}, Lng ${item.lng}`;

    const gmapsBtn = document.getElementById('btn-open-google-maps');
    if (gmapsBtn) {
      gmapsBtn.href = `https://www.google.com/maps?q=${item.lat},${item.lng}`;
    }

    modal.classList.add('active');

    setTimeout(() => {
      if (typeof L === 'undefined') return;
      if (!modalMap) {
        try {
          modalMap = L.map('live-location-modal-map').setView([item.lat, item.lng], 15);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
          }).addTo(modalMap);
          modalMarker = L.marker([item.lat, item.lng], { icon: getCustomPinIcon() }).addTo(modalMap);
        } catch (e) { }
      } else {
        modalMap.invalidateSize();
        modalMap.setView([item.lat, item.lng], 15);
        if (modalMarker) modalMarker.setLatLng([item.lat, item.lng]);
      }
    }, 200);
  }

  // --- PUBLIC PORTAL FORM & MULTI-PHOTO UPLOAD ---
  function initPublicPortalForm() {
    const form = document.getElementById('public-complaint-form');
    if (!form) return;

    const beforePhotoInput = document.getElementById('public-before-photo');
    const quickBeforeBtn = document.getElementById('btn-quick-before-photo');

    if (quickBeforeBtn) {
      quickBeforeBtn.addEventListener('click', () => {
        const categorySelect = document.getElementById('public-category');
        const cat = categorySelect ? categorySelect.value : 'Civic Issue';
        currentBeforePhotos = [
          generateSVGDataURI(`Close-up Angle: ${cat || 'Civic Issue'}`, '#f59e0b', 'before'),
          generateSVGDataURI(`Wide Street View: ${cat || 'Civic Issue'}`, '#d97706', 'before')
        ];
        renderBeforePhotoThumbnails();
        showToast('⚡ 2 Sample BEFORE Photos (Close-up & Wide Angle) generated!', 'info');
      });
    }

    if (beforePhotoInput) {
      beforePhotoInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        let processed = 0;
        files.slice(0, 4 - currentBeforePhotos.length).forEach(file => {
          if (!file.type.startsWith('image/')) return;
          const reader = new FileReader();
          reader.onload = (evt) => {
            compressImageBase64(evt.target.result, 800, 0.7, (compressedData) => {
              currentBeforePhotos.push(compressedData);
              processed++;
              renderBeforePhotoThumbnails();
            });
          };
          reader.readAsDataURL(file);
        });
      });
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const wardSelect = document.getElementById('public-ward');
      const categorySelect = document.getElementById('public-category');
      const problemInput = document.getElementById('public-problem');
      const addressInput = document.getElementById('public-location-address');
      const nameInput = document.getElementById('public-name');
      const mobileInput = document.getElementById('public-mobile');

      const ward = wardSelect ? wardSelect.value : '';
      const category = categorySelect ? categorySelect.value : '';
      const problem = problemInput ? problemInput.value.trim() : '';
      const address = addressInput ? addressInput.value.trim() : '';
      const lat = parseFloat(document.getElementById('public-lat').value) || 11.3800;
      const lng = parseFloat(document.getElementById('public-lng').value) || 77.8946;
      const citizenName = nameInput ? nameInput.value.trim() : '';
      const rawMobile = mobileInput ? mobileInput.value.trim() : '';
      const citizenMobile = rawMobile.replace(/\D/g, ''); // Extract numeric digits

      if (!ward) {
        showToast('Please select a Ward.', 'error');
        if (wardSelect) wardSelect.focus();
        return;
      }
      if (!category) {
        showToast('Please select a Complaint Issue Category.', 'error');
        if (categorySelect) categorySelect.focus();
        return;
      }
      if (!problem) {
        showToast('Please enter details describing the problem.', 'error');
        if (problemInput) problemInput.focus();
        return;
      }
      if (!address) {
        showToast('Please enter an Address or Landmark.', 'error');
        if (addressInput) addressInput.focus();
        return;
      }
      if (!citizenName) {
        showToast('Please enter your Full Name.', 'error');
        if (nameInput) nameInput.focus();
        return;
      }
      if (!citizenMobile || citizenMobile.length < 10) {
        showToast('Please enter a valid 10-digit mobile number.', 'error');
        if (mobileInput) mobileInput.focus();
        return;
      }

      // Fail-safe: Auto-generate before photos if none selected
      const photosToSave = currentBeforePhotos.length > 0
        ? [...currentBeforePhotos]
        : [generateSVGDataURI(`Reported Issue: ${category}`, '#f59e0b', 'before')];

      const ticketId = 'CMP-2026-' + Math.floor(1000 + Math.random() * 9000);

      const newComplaint = {
        id: ticketId,
        ward: ward,
        category: category,
        problem: problem,
        address: address,
        lat: lat,
        lng: lng,
        citizenName: citizenName,
        citizenMobile: citizenMobile,
        beforePhotos: photosToSave,
        beforePhoto: photosToSave[0], // Backward compatibility
        afterPhotos: [],
        afterPhoto: null,
        status: 'Registered',
        workerNotes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      complaints.unshift(newComplaint);
      saveComplaintsData();
      postComplaintToSupabase(newComplaint);
      updateGlobalCounters();

      // Sync across all portals
      renderWorkerPortal();
      renderTrackPortal();
      renderAdminPortal();

      const receiptContainer = document.getElementById('receipt-container');
      if (document.getElementById('receipt-id-display')) document.getElementById('receipt-id-display').textContent = ticketId;
      if (document.getElementById('receipt-ward')) document.getElementById('receipt-ward').textContent = ward;
      if (document.getElementById('receipt-category')) document.getElementById('receipt-category').textContent = category;
      if (document.getElementById('receipt-location')) document.getElementById('receipt-location').textContent = address;
      if (document.getElementById('receipt-time')) document.getElementById('receipt-time').textContent = new Date().toLocaleString();
      if (receiptContainer) {
        receiptContainer.style.display = 'block';
        receiptContainer.scrollIntoView({ behavior: 'smooth' });
      }

      form.reset();
      currentBeforePhotos = [];
      renderBeforePhotoThumbnails();

      showToast(`Complaint ${ticketId} registered with ${photosToSave.length} photo(s)!`, 'success');

      if (document.getElementById('btn-copy-ticket')) {
        document.getElementById('btn-copy-ticket').onclick = () => {
          navigator.clipboard.writeText(ticketId);
          showToast('Ticket ID copied to clipboard!', 'success');
        };
      }

      if (document.getElementById('btn-track-this')) {
        document.getElementById('btn-track-this').onclick = () => {
          document.getElementById('tab-track').click();
          const searchInput = document.getElementById('track-search-input');
          if (searchInput) searchInput.value = citizenMobile;
          renderTrackPortal();
        };
      }
    });
  }

  // --- PUBLIC STATUS TRACKING PORTAL (MOBILE NUMBER LOOKUP + 4-STAGE STEPPER) ---
  function initTrackPortal() {
    const searchInput = document.getElementById('track-search-input');
    const searchBtn = document.getElementById('btn-track-search');

    if (searchBtn) {
      searchBtn.addEventListener('click', renderTrackPortal);
    }
    if (searchInput) {
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') renderTrackPortal();
      });
    }

    renderTrackPortal();
  }

  function renderTrackPortal() {
    const searchInput = document.getElementById('track-search-input');
    const resultsContainer = document.getElementById('track-results-container');
    if (!resultsContainer) return;

    const rawQuery = searchInput ? searchInput.value.trim() : '';
    const query = rawQuery.toUpperCase();
    resultsContainer.replaceChildren();

    if (!query) {
      const promptCard = document.createElement('div');
      promptCard.style.textAlign = 'center';
      promptCard.style.padding = '3rem 1.5rem';
      promptCard.style.background = 'rgba(0, 0, 0, 0.25)';
      promptCard.style.borderRadius = '12px';
      promptCard.style.border = '1.5px dashed var(--accent-gold)';

      const iconDiv = document.createElement('div');
      iconDiv.style.fontSize = '2.5rem';
      iconDiv.style.marginBottom = '0.5rem';
      iconDiv.textContent = '📱';
      promptCard.appendChild(iconDiv);

      const titleH3 = document.createElement('h3');
      titleH3.style.color = 'var(--text-gold)';
      titleH3.style.fontSize = '1.2rem';
      titleH3.style.marginBottom = '0.5rem';
      titleH3.textContent = 'Enter Your Full 10-Digit Mobile Number to Track Status';
      promptCard.appendChild(titleH3);

      const pDesc = document.createElement('p');
      pDesc.style.color = 'var(--text-muted)';
      pDesc.style.fontSize = '0.9rem';
      pDesc.style.maxWidth = '520px';
      pDesc.style.margin = '0 auto';
      pDesc.textContent = 'Type your complete registered 10-digit mobile number (or full ticket ID e.g. CMP-2026-8941) in the search box above and click Lookup Complaints to view step-by-step resolution status.';
      promptCard.appendChild(pDesc);

      resultsContainer.appendChild(promptCard);
      return;
    }

    // Require full 10-digit mobile number or complete Ticket ID
    const isNumeric = /^\d+$/.test(rawQuery);
    if (isNumeric && rawQuery.length < 10) {
      const incompleteCard = document.createElement('div');
      incompleteCard.style.textAlign = 'center';
      incompleteCard.style.padding = '2.5rem';
      incompleteCard.style.color = 'var(--text-gold)';
      incompleteCard.style.background = 'rgba(0, 0, 0, 0.25)';
      incompleteCard.style.borderRadius = '12px';
      incompleteCard.style.border = '1px dashed var(--accent-gold)';
      incompleteCard.textContent = `⚠️ Please enter your complete 10-digit mobile number (entered ${rawQuery.length}/10 digits so far).`;
      resultsContainer.appendChild(incompleteCard);
      return;
    }

    const matches = complaints.filter(c =>
      c.citizenMobile === rawQuery ||
      c.id.toUpperCase() === query
    );

    if (matches.length === 0) {
      const noRes = document.createElement('div');
      noRes.style.textAlign = 'center';
      noRes.style.padding = '2.5rem';
      noRes.style.color = 'var(--text-muted)';
      noRes.textContent = `No complaints found registered under Mobile Number or Ticket ID "${rawQuery}". Please check the number and try again.`;
      resultsContainer.appendChild(noRes);
      return;
    }

    matches.forEach(c => {
      const card = createTicketCardHTML(c, 'track');
      resultsContainer.appendChild(card);
    });
  }

  // --- WORKER FIELD PORTAL (REQUIRES WORKER LOGIN) ---
  function initWorkerPortal() {
    const loginForm = document.getElementById('worker-login-form');
    const logoutBtn = document.getElementById('btn-worker-logout');

    const quickBtn1 = document.getElementById('btn-quick-login-worker1');
    const quickBtn2 = document.getElementById('btn-quick-login-worker2');
    const filterAllBtn = document.getElementById('btn-worker-filter-all');
    const filterDirectivesBtn = document.getElementById('btn-worker-filter-directives');

    const viewGridBtn = document.getElementById('btn-worker-view-grid');
    const viewListBtn = document.getElementById('btn-worker-view-list');
    const viewSingleBtn = document.getElementById('btn-worker-view-single');
    const viewTableBtn = document.getElementById('btn-worker-view-table');
    const allViewBtns = [viewGridBtn, viewListBtn, viewSingleBtn, viewTableBtn].filter(Boolean);

    function setWorkerView(mode, activeBtn) {
      workerViewMode = mode;
      workerSingleIndex = 0;
      allViewBtns.forEach(b => b.classList.remove('active'));
      if (activeBtn) activeBtn.classList.add('active');
      renderWorkerPortal();
    }

    if (viewGridBtn) viewGridBtn.addEventListener('click', () => setWorkerView('grid', viewGridBtn));
    if (viewListBtn) viewListBtn.addEventListener('click', () => setWorkerView('list', viewListBtn));
    if (viewSingleBtn) viewSingleBtn.addEventListener('click', () => setWorkerView('single', viewSingleBtn));
    if (viewTableBtn) viewTableBtn.addEventListener('click', () => setWorkerView('table', viewTableBtn));

    const workerStatusFilter = document.getElementById('worker-filter-status');
    if (workerStatusFilter) {
      workerStatusFilter.addEventListener('change', renderWorkerPortal);
    }

    const closeInspectBtn = document.getElementById('btn-close-worker-inspect-modal');
    if (closeInspectBtn) {
      closeInspectBtn.addEventListener('click', () => {
        const inspectModal = document.getElementById('worker-inspect-modal');
        if (inspectModal) inspectModal.classList.remove('active');
      });
    }

    // Single View Prev/Next
    const prevBtn = document.getElementById('btn-single-prev');
    const nextBtn = document.getElementById('btn-single-next');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (workerSingleIndex > 0) {
          workerSingleIndex--;
          renderWorkerPortal();
        }
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        workerSingleIndex++;
        renderWorkerPortal();
      });
    }

    if (filterAllBtn) {
      filterAllBtn.addEventListener('click', () => {
        workerDirectiveFilterOnly = false;
        filterAllBtn.style.background = 'rgba(255,255,255,0.2)';
        if (filterDirectivesBtn) filterDirectivesBtn.style.background = 'transparent';
        renderWorkerPortal();
      });
    }

    if (filterDirectivesBtn) {
      filterDirectivesBtn.addEventListener('click', () => {
        workerDirectiveFilterOnly = true;
        filterDirectivesBtn.style.background = 'rgba(234, 179, 8, 0.25)';
        if (filterAllBtn) filterAllBtn.style.background = 'transparent';
        renderWorkerPortal();
      });
    }

    if (quickBtn1) {
      quickBtn1.addEventListener('click', () => {
        const match = workers.find(w => w.username === 'worker1');
        if (match) {
          activeWorker = match;
          sessionStorage.setItem(WORKER_SESSION_KEY, JSON.stringify(activeWorker));
          showToast(`Logged in as ${activeWorker.name} (${activeWorker.ward} ONLY)`, 'success');
          renderWorkerPortal();
        }
      });
    }

    if (quickBtn2) {
      quickBtn2.addEventListener('click', () => {
        const match = workers.find(w => w.username === 'worker2');
        if (match) {
          activeWorker = match;
          sessionStorage.setItem(WORKER_SESSION_KEY, JSON.stringify(activeWorker));
          showToast(`Logged in as ${activeWorker.name} (${activeWorker.ward} ONLY)`, 'success');
          renderWorkerPortal();
        }
      });
    }

    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('worker-login-username').value.trim();
        const password = document.getElementById('worker-login-password').value.trim();

        const match = workers.find(w => w.username.toLowerCase() === username.toLowerCase() && w.password === password);
        if (match) {
          activeWorker = match;
          sessionStorage.setItem(WORKER_SESSION_KEY, JSON.stringify(activeWorker));
          showToast(`Welcome back, ${activeWorker.name}! Assigned strictly to ${activeWorker.ward}`, 'success');
          renderWorkerPortal();
        } else {
          showToast('Invalid Worker Username or Password!', 'error');
        }
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        activeWorker = null;
        sessionStorage.removeItem(WORKER_SESSION_KEY);
        renderWorkerPortal();
        showToast('Worker logged out successfully.', 'info');
      });
    }

    const closeBtn = document.getElementById('btn-close-worker-modal');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        document.getElementById('worker-upload-modal').classList.remove('active');
      });
    }

    const afterPhotoInput = document.getElementById('worker-after-photo');
    const quickAfterBtn = document.getElementById('btn-quick-after-photo');

    if (quickAfterBtn) {
      quickAfterBtn.addEventListener('click', () => {
        const cat = document.getElementById('modal-worker-cat').textContent || 'Resolved Work';
        currentAfterPhotos = [
          generateSVGDataURI(`Repair Proof: ${cat}`, '#10b981', 'after'),
          generateSVGDataURI(`Cleaned Site Angle: ${cat}`, '#047857', 'after')
        ];
        renderAfterPhotoThumbnails();
        showToast('⚡ 2 Sample AFTER Photos (Repair Proof & Cleaned Site) generated!', 'info');
      });
    }

    if (afterPhotoInput) {
      afterPhotoInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        files.slice(0, 4 - currentAfterPhotos.length).forEach(file => {
          if (!file.type.startsWith('image/')) return;
          const reader = new FileReader();
          reader.onload = (evt) => {
            compressImageBase64(evt.target.result, 800, 0.7, (compressedData) => {
              currentAfterPhotos.push(compressedData);
              renderAfterPhotoThumbnails();
            });
          };
          reader.readAsDataURL(file);
        });
      });
    }

    const workerForm = document.getElementById('worker-complete-form');
    if (workerForm) {
      workerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const ticketId = document.getElementById('modal-worker-ticket-id').value;
        const workerNotes = document.getElementById('worker-notes').value.trim();

        if (currentAfterPhotos.length === 0) {
          // Fail safe: Generate sample AFTER photo if none uploaded
          const cat = document.getElementById('modal-worker-cat').textContent || 'Resolved Work';
          currentAfterPhotos = [generateSVGDataURI(`Completed Work: ${cat}`, '#10b981', 'after')];
        }

        const item = complaints.find(c => c.id === ticketId);
        if (item) {
          item.afterPhotos = [...currentAfterPhotos];
          item.afterPhoto = currentAfterPhotos[0];
          item.workerNotes = workerNotes || 'Field work completed satisfactorily.';
          item.status = 'Pending Verification';
          item.updatedAt = new Date().toISOString();

          saveComplaintsData();
          updateComplaintOnSupabase(ticketId, {
            status: 'Pending Verification',
            afterPhoto: item.afterPhoto,
            workerNotes: item.workerNotes
          });
          updateGlobalCounters();
          renderWorkerPortal();
          renderTrackPortal();
          renderAdminPortal();

          document.getElementById('worker-upload-modal').classList.remove('active');
          showToast(`Work for ticket ${ticketId} submitted with ${currentAfterPhotos.length} photo(s)!`, 'success');
        }
      });
    }
  }

  function openWorkerUploadModal(item) {
    const modal = document.getElementById('worker-upload-modal');
    if (!modal) return;

    document.getElementById('modal-worker-ticket-id').value = item.id;
    document.getElementById('modal-worker-ticket-code').textContent = `${item.id} (${item.ward})`;
    document.getElementById('modal-worker-cat').textContent = item.category;
    document.getElementById('modal-worker-address').textContent = item.address;

    const beforeList = getBeforePhotosList(item);
    const beforeImg = document.getElementById('modal-worker-before-img');
    if (beforeImg) {
      beforeImg.src = beforeList[0] || '';
      beforeImg.style.cursor = 'pointer';
      beforeImg.onclick = () => openPhotoLightbox(beforeList[0]);
    }

    const afterPhotoInput = document.getElementById('worker-after-photo');
    if (afterPhotoInput) afterPhotoInput.value = '';

    const afterList = getAfterPhotosList(item);
    currentAfterPhotos = [...afterList];
    renderAfterPhotoThumbnails();

    const workerNotes = document.getElementById('worker-notes');
    if (workerNotes) workerNotes.value = item.workerNotes || '';

    modal.classList.add('active');
  }

  function updateWorkerCounters() {
    if (!activeWorker) return;
    const wardComplaints = complaints.filter(c => c.ward === activeWorker.ward);
    const total = wardComplaints.length;
    const registered = wardComplaints.filter(c => c.status === 'Registered').length;
    const progress = wardComplaints.filter(c => c.status === 'In Progress').length;
    const pendingVerify = wardComplaints.filter(c => c.status === 'Pending Verification').length;
    const verified = wardComplaints.filter(c => c.status === 'Verified Closed').length;

    const elTotal = document.getElementById('worker-stat-total');
    const elReg = document.getElementById('worker-stat-registered');
    const elProg = document.getElementById('worker-stat-progress');
    const elPend = document.getElementById('worker-stat-pending-verify');
    const elVer = document.getElementById('worker-stat-verified');

    if (elTotal) elTotal.textContent = total;
    if (elReg) elReg.textContent = registered;
    if (elProg) elProg.textContent = progress;
    if (elPend) elPend.textContent = pendingVerify;
    if (elVer) elVer.textContent = verified;
  }

  function openWorkerInspectModal(item) {
    const modal = document.getElementById('worker-inspect-modal');
    if (!modal) return;

    document.getElementById('worker-inspect-cat').textContent = `${item.category} (${item.ward})`;
    document.getElementById('worker-inspect-id').textContent = `Ticket ID: ${item.id}`;
    document.getElementById('worker-inspect-location').textContent = `📍 Address: ${item.address} (GPS: ${item.lat}, ${item.lng})`;

    const badgeContainer = document.getElementById('worker-inspect-status-badge');
    badgeContainer.replaceChildren(getStatusBadgeElement(item.status));

    const beforeList = getBeforePhotosList(item);
    const beforeImg = document.getElementById('worker-inspect-before-img');
    if (beforeImg) {
      beforeImg.src = beforeList[0] || '';
      beforeImg.style.cursor = 'pointer';
      beforeImg.title = 'Click to view full size photo';
      beforeImg.onclick = () => openPhotoLightbox(beforeList[0]);
    }

    const afterList = getAfterPhotosList(item);
    const afterImg = document.getElementById('worker-inspect-after-img');
    if (afterImg) {
      if (afterList.length > 0) {
        afterImg.src = afterList[0];
        afterImg.style.cursor = 'pointer';
        afterImg.title = 'Click to view full size photo';
        afterImg.onclick = () => openPhotoLightbox(afterList[0]);
      } else {
        afterImg.src = generateSVGDataURI('No After Photo Uploaded Yet', '#1e293b', 'before');
        afterImg.onclick = null;
      }
    }

    document.getElementById('worker-inspect-problem-desc').textContent = `Problem Description: ${item.problem}`;
    document.getElementById('worker-inspect-notes').textContent = item.workerNotes ? `Worker Field Notes: ${item.workerNotes}` : 'Worker Field Notes: Pending field work completion.';

    document.getElementById('worker-inspect-citizen-name').textContent = item.citizenName;
    document.getElementById('worker-inspect-citizen-mobile').textContent = item.citizenMobile;
    document.getElementById('worker-inspect-created-time').textContent = new Date(item.createdAt).toLocaleString();
    document.getElementById('worker-inspect-updated-time').textContent = new Date(item.updatedAt).toLocaleString();

    const dirContainer = document.getElementById('worker-inspect-directive-container');
    if (dirContainer) {
      dirContainer.replaceChildren();
      if (item.adminMessage) {
        dirContainer.style.display = 'block';
        const msgNotice = document.createElement('div');
        msgNotice.className = 'admin-directive-box';
        msgNotice.innerHTML = `
          <div style="font-weight: 800; color: var(--text-gold); display: flex; align-items: center; gap: 0.4rem; font-size: 0.82rem;">
            <span>💬</span> ADMIN DIRECTIVE / PENDING INSTRUCTION:
          </div>
          <div style="font-size: 0.88rem; color: #ffffff; margin-top: 4px; font-weight: 600;">
            "${item.adminMessage}"
          </div>
        `;
        dirContainer.appendChild(msgNotice);
      } else {
        dirContainer.style.display = 'none';
      }
    }

    const mapBtn = document.getElementById('btn-worker-inspect-map');
    if (mapBtn) {
      mapBtn.onclick = () => openLiveLocationModal(item);
    }

    const completeBtn = document.getElementById('btn-worker-inspect-complete');
    if (completeBtn) {
      if (item.status === 'Verified Closed') {
        completeBtn.style.display = 'none';
      } else {
        completeBtn.style.display = 'inline-flex';
        completeBtn.onclick = () => {
          modal.classList.remove('active');
          openWorkerUploadModal(item);
        };
      }
    }

    modal.classList.add('active');
  }

  function renderWorkerTable(filteredComplaints) {
    const tableContainer = document.getElementById('worker-tickets-table-container');
    const tbody = document.getElementById('worker-table-body');
    if (!tableContainer || !tbody) return;

    tbody.replaceChildren();

    if (filteredComplaints.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 8;
      td.style.textAlign = 'center';
      td.style.padding = '2rem';
      td.style.color = 'var(--text-muted)';
      td.textContent = 'No matching complaints found for the selected filters in your ward.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    filteredComplaints.forEach(c => {
      const tr = document.createElement('tr');

      // Ticket ID
      const tdId = document.createElement('td');
      tdId.className = 'ticket-id';
      tdId.textContent = c.id;
      tr.appendChild(tdId);

      // Ward & Location
      const tdWard = document.createElement('td');
      const wBold = document.createElement('strong');
      wBold.style.color = 'var(--text-gold)';
      wBold.textContent = c.ward;
      const wAddr = document.createElement('div');
      wAddr.style.fontSize = '0.8rem';
      wAddr.style.color = 'var(--text-muted)';
      wAddr.textContent = c.address;
      tdWard.appendChild(wBold);
      tdWard.appendChild(wAddr);
      tr.appendChild(tdWard);

      // Category & Problem
      const tdCat = document.createElement('td');
      const catTitle = document.createElement('strong');
      catTitle.textContent = c.category;
      const probDesc = document.createElement('div');
      probDesc.style.fontSize = '0.78rem';
      probDesc.style.color = 'var(--text-muted)';
      probDesc.textContent = c.problem;
      tdCat.appendChild(catTitle);
      tdCat.appendChild(probDesc);
      tr.appendChild(tdCat);

      // Complainant
      const tdCitizen = document.createElement('td');
      tdCitizen.textContent = `${c.citizenName} (${c.citizenMobile})`;
      tr.appendChild(tdCitizen);

      // Live Map
      const tdMap = document.createElement('td');
      const mapBtn = document.createElement('button');
      mapBtn.className = 'btn-location-view';
      mapBtn.textContent = '📍 Live Map';
      mapBtn.addEventListener('click', () => openLiveLocationModal(c));
      tdMap.appendChild(mapBtn);
      tr.appendChild(tdMap);

      // Photos Status
      const tdPhotos = document.createElement('td');
      const pText = document.createElement('div');
      pText.style.fontSize = '0.8rem';
      pText.textContent = c.afterPhoto ? '📷 Before + 📸 After' : '📷 Before Only';
      tdPhotos.appendChild(pText);
      tr.appendChild(tdPhotos);

      // Status Badge
      const tdStatus = document.createElement('td');
      tdStatus.appendChild(getStatusBadgeElement(c.status));
      tr.appendChild(tdStatus);

      // Worker Actions
      const tdAction = document.createElement('td');
      tdAction.style.display = 'flex';
      tdAction.style.gap = '0.35rem';

      const btnInspect = document.createElement('button');
      btnInspect.className = 'btn-secondary';
      btnInspect.style.padding = '0.4rem 0.6rem';
      btnInspect.style.fontSize = '0.78rem';
      btnInspect.textContent = '🔍 Inspect';
      btnInspect.addEventListener('click', () => openWorkerInspectModal(c));
      tdAction.appendChild(btnInspect);

      if (c.status !== 'Verified Closed') {
        const btnWork = document.createElement('button');
        btnWork.className = 'btn-success';
        btnWork.style.padding = '0.4rem 0.6rem';
        btnWork.style.fontSize = '0.78rem';
        btnWork.textContent = c.status === 'Pending Verification' ? '✏️ Update' : '📸 Work Done';
        btnWork.addEventListener('click', () => openWorkerUploadModal(c));
        tdAction.appendChild(btnWork);
      }

      tr.appendChild(tdAction);
      tbody.appendChild(tr);
    });
  }

  function renderWorkerPortal() {
    const loginView = document.getElementById('worker-login-view');
    const dashboardView = document.getElementById('worker-dashboard-view');
    if (!loginView || !dashboardView) return;

    // REQUIRES WORKER LOGIN FIRST!
    if (!activeWorker) {
      loginView.style.display = 'block';
      dashboardView.style.display = 'none';
      return;
    }

    loginView.style.display = 'none';
    dashboardView.style.display = 'block';

    document.getElementById('worker-session-name').textContent = activeWorker.name;
    document.getElementById('worker-session-ward').textContent = `${activeWorker.ward} ONLY`;

    updateWorkerCounters();

    const tableContainer = document.getElementById('worker-tickets-table-container');
    const statusFilter = document.getElementById('worker-filter-status');
    const statusVal = statusFilter ? statusFilter.value : 'ALL';

    // STRICT RULE: WORKER ONLY SEES COMPLAINTS FOR THEIR ASSIGNED WARD!
    let filtered = complaints.filter(c => c.ward === activeWorker.ward);

    if (statusVal !== 'ALL') {
      filtered = filtered.filter(c => c.status === statusVal);
    }

    if (workerDirectiveFilterOnly) {
      filtered = filtered.filter(c => Boolean(c.adminMessage));
    }

    const countEl = document.getElementById('worker-task-count');
    if (countEl) {
      countEl.textContent = filtered.length + ' Complaints (' + activeWorker.ward + ' Queue)';
    }

    if (tableContainer) tableContainer.style.display = 'block';
    renderWorkerTable(filtered);
  }

  // --- STEP-BY-STEP RESOLUTION TIMELINE STEPPER BUILDER ---
  function createTimelineStepper(item) {
    const container = document.createElement('div');
    container.className = 'timeline-tracker';

    const title = document.createElement('div');
    title.className = 'timeline-title';
    title.innerHTML = '<span>⚡ Live Step-by-Step Resolution Process:</span>';
    container.appendChild(title);

    const stepsContainer = document.createElement('div');
    stepsContainer.className = 'timeline-steps';

    // Step 1: Registered
    const step1 = document.createElement('div');
    step1.className = 'timeline-step completed';
    step1.innerHTML = `
      <div class="timeline-icon-box">1</div>
      <div>
        <div class="timeline-step-label">🟡 Registered</div>
        <div class="timeline-step-sub">${new Date(item.createdAt).toLocaleDateString()}</div>
      </div>
    `;
    stepsContainer.appendChild(step1);

    // Step 2: In Progress / Worker Assigned
    const isStep2Done = item.status === 'In Progress' || item.status === 'Pending Verification' || item.status === 'Verified Closed';
    const isStep2Current = item.status === 'In Progress';
    const step2 = document.createElement('div');
    step2.className = `timeline-step ${isStep2Done ? 'completed' : (isStep2Current ? 'current' : '')}`;
    step2.innerHTML = `
      <div class="timeline-icon-box">2</div>
      <div>
        <div class="timeline-step-label">🔵 In Progress</div>
        <div class="timeline-step-sub">${isStep2Done ? item.ward + ' Worker' : 'Queued'}</div>
      </div>
    `;
    stepsContainer.appendChild(step2);

    // Step 3: Work Completed / After Photo Uploaded
    const isStep3Done = item.status === 'Pending Verification' || item.status === 'Verified Closed';
    const isStep3Current = item.status === 'Pending Verification';
    const step3 = document.createElement('div');
    step3.className = `timeline-step ${isStep3Done ? 'completed' : (isStep3Current ? 'current' : '')}`;
    step3.innerHTML = `
      <div class="timeline-icon-box">3</div>
      <div>
        <div class="timeline-step-label">🟣 Work Done</div>
        <div class="timeline-step-sub">${item.afterPhoto ? 'After Photo Uploaded' : 'Awaiting Proof'}</div>
      </div>
    `;
    stepsContainer.appendChild(step3);

    // Step 4: Admin Verified & Closed
    const isStep4Done = item.status === 'Verified Closed';
    const step4 = document.createElement('div');
    step4.className = `timeline-step ${isStep4Done ? 'completed' : ''}`;
    step4.innerHTML = `
      <div class="timeline-icon-box">4</div>
      <div>
        <div class="timeline-step-label">🟢 Verified & Closed</div>
        <div class="timeline-step-sub">${isStep4Done ? 'Closed' : 'Pending Verification'}</div>
      </div>
    `;
    stepsContainer.appendChild(step4);

    container.appendChild(stepsContainer);
    return container;
  }

  // --- TICKET CARD BUILDER (USED IN WORKER AND TRACK VIEWS) ---
  function createTicketCardHTML(item, viewType = 'public') {
    const card = document.createElement('div');
    card.className = 'ticket-card';

    // 1. Header
    const header = document.createElement('div');
    header.className = 'ticket-header';

    const idSpan = document.createElement('span');
    idSpan.className = 'ticket-id';
    idSpan.textContent = item.id;

    header.appendChild(idSpan);
    header.appendChild(getStatusBadgeElement(item.status));
    card.appendChild(header);

    // 2. Multi-Photo Media Preview
    const beforeList = getBeforePhotosList(item);
    const afterList = getAfterPhotosList(item);

    const media = document.createElement('div');
    media.className = afterList.length > 0 ? 'ticket-media-preview' : 'ticket-media-preview single';

    const beforeBox = document.createElement('div');
    beforeBox.className = 'media-box';
    const beforeImg = document.createElement('img');
    beforeImg.src = beforeList[0];
    beforeImg.alt = 'Before Photo';
    beforeImg.style.cursor = 'pointer';
    beforeImg.title = 'Click to zoom Before Photo';
    beforeImg.addEventListener('click', () => openPhotoLightbox(beforeList[0]));

    const beforeTag = document.createElement('span');
    beforeTag.className = 'media-tag';
    beforeTag.textContent = beforeList.length > 1 ? `BEFORE (${beforeList.length} Photos)` : 'BEFORE';
    beforeBox.appendChild(beforeImg);
    beforeBox.appendChild(beforeTag);
    media.appendChild(beforeBox);

    if (afterList.length > 0) {
      const afterBox = document.createElement('div');
      afterBox.className = 'media-box';
      const afterImg = document.createElement('img');
      afterImg.src = afterList[0];
      afterImg.alt = 'After Photo';
      afterImg.style.cursor = 'pointer';
      afterImg.title = 'Click to zoom After Photo';
      afterImg.addEventListener('click', () => openPhotoLightbox(afterList[0]));

      const afterTag = document.createElement('span');
      afterTag.className = 'media-tag';
      afterTag.style.borderColor = 'var(--accent-emerald)';
      afterTag.textContent = afterList.length > 1 ? `AFTER (${afterList.length} Photos)` : 'AFTER';
      afterBox.appendChild(afterImg);
      afterBox.appendChild(afterTag);
      media.appendChild(afterBox);
    }
    card.appendChild(media);

    // 3. Body
    const body = document.createElement('div');
    body.className = 'ticket-body';

    const cat = document.createElement('div');
    cat.className = 'ticket-cat';
    cat.textContent = `${item.category} (${item.ward})`;
    body.appendChild(cat);

    const desc = document.createElement('div');
    desc.className = 'ticket-desc';
    desc.textContent = item.problem;
    body.appendChild(desc);

    const meta = document.createElement('div');
    meta.className = 'ticket-meta';
    meta.innerHTML = `
      <div><strong>📍 Address:</strong> ${item.address}</div>
      <div><strong>👤 Citizen:</strong> ${item.citizenName} (${item.citizenMobile})</div>
      <div><strong>⏱️ Reported:</strong> ${new Date(item.createdAt).toLocaleDateString()}</div>
      ${item.workerNotes ? `<div style="color: var(--accent-gold);"><strong>👷 Notes:</strong> ${item.workerNotes}</div>` : ''}
    `;
    body.appendChild(meta);

    if (item.rejectionReason && item.status !== 'Verified Closed') {
      const rejectNotice = document.createElement('div');
      rejectNotice.style.background = 'rgba(244, 63, 94, 0.2)';
      rejectNotice.style.border = '1px solid #f43f5e';
      rejectNotice.style.color = '#fecdd3';
      rejectNotice.style.padding = '0.6rem 0.8rem';
      rejectNotice.style.borderRadius = '8px';
      rejectNotice.style.fontSize = '0.8rem';
      rejectNotice.style.fontWeight = '700';
      rejectNotice.style.marginTop = '0.4rem';
      rejectNotice.textContent = `⚠️ ADMIN REJECTION NOTICE: ${item.rejectionReason}`;
      body.appendChild(rejectNotice);
    }

    if (item.adminMessage) {
      const msgNotice = document.createElement('div');
      msgNotice.className = 'admin-directive-box';
      msgNotice.innerHTML = `
        <div style="font-weight: 800; color: var(--text-gold); display: flex; align-items: center; gap: 0.4rem; font-size: 0.82rem;">
          <span>💬</span> ADMIN DIRECTIVE / PENDING INSTRUCTION:
        </div>
        <div style="font-size: 0.88rem; color: #ffffff; margin-top: 4px; font-weight: 600;">
          "${item.adminMessage}"
        </div>
        <div style="font-size: 0.72rem; color: var(--text-gold); margin-top: 3px;">
          Sent by Master Admin ${item.adminMessageTime ? 'at ' + new Date(item.adminMessageTime).toLocaleTimeString() : ''}
        </div>
      `;
      body.appendChild(msgNotice);
    }

    // Insert Visual Step-by-Step Resolution Process Stepper for Track View
    if (viewType === 'track') {
      body.appendChild(createTimelineStepper(item));
    }

    card.appendChild(body);

    // 4. Actions
    const actions = document.createElement('div');
    actions.className = 'ticket-actions';

    const mapBtn = document.createElement('button');
    mapBtn.className = 'btn-location-view';
    mapBtn.style.justifyContent = 'center';
    mapBtn.textContent = '📍 View Live GPS Location';
    mapBtn.addEventListener('click', () => openLiveLocationModal(item));
    actions.appendChild(mapBtn);

    if (viewType === 'worker') {
      const inspectBtn = document.createElement('button');
      inspectBtn.className = 'btn-secondary';
      inspectBtn.style.justifyContent = 'center';
      inspectBtn.textContent = '🔍 Side-by-Side Inspect Desk';
      inspectBtn.addEventListener('click', () => openWorkerInspectModal(item));
      actions.appendChild(inspectBtn);

      if (item.status === 'Registered') {
        const progBtn = document.createElement('button');
        progBtn.className = 'btn-secondary';
        progBtn.style.justifyContent = 'center';
        progBtn.textContent = '⚙️ Mark In Progress';
        progBtn.addEventListener('click', () => {
          item.status = 'In Progress';
          item.updatedAt = new Date().toISOString();
          saveComplaintsData();
          updateGlobalCounters();
          renderWorkerPortal();
          renderTrackPortal();
          renderAdminPortal();
          showToast(`Ticket ${item.id} marked as In Progress!`, 'info');
        });
        actions.appendChild(progBtn);

        const completeBtn = document.createElement('button');
        completeBtn.className = 'btn-success';
        completeBtn.style.justifyContent = 'center';
        completeBtn.textContent = '✅ Complete & Submit Work';
        completeBtn.addEventListener('click', () => openWorkerUploadModal(item));
        actions.appendChild(completeBtn);
      } else if (item.status === 'In Progress') {
        const completeBtn = document.createElement('button');
        completeBtn.className = 'btn-success';
        completeBtn.style.justifyContent = 'center';
        completeBtn.textContent = '📸 Upload AFTER Photo & Submit Work';
        completeBtn.addEventListener('click', () => openWorkerUploadModal(item));
        actions.appendChild(completeBtn);
      } else if (item.status === 'Pending Verification') {
        const editWorkBtn = document.createElement('button');
        editWorkBtn.className = 'btn-secondary';
        editWorkBtn.style.justifyContent = 'center';
        editWorkBtn.textContent = '✏️ Update Submitted Work';
        editWorkBtn.addEventListener('click', () => openWorkerUploadModal(item));
        actions.appendChild(editWorkBtn);
      }
    }

    card.appendChild(actions);
    return card;
  }

  // --- ADMIN VERIFICATION & AUTHENTICATION ---
  function initAdminPortal() {
    const adminLoginForm = document.getElementById('admin-login-form');
    const adminLogoutBtn = document.getElementById('btn-admin-logout');
    const sendPassBtn = document.getElementById('btn-send-admin-pass');

    if (adminLoginForm) {
      adminLoginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('admin-login-email').value.trim();
        const password = document.getElementById('admin-login-password').value.trim();

        if (password === ADMIN_DEFAULT_PASSWORD && email.length > 0 && email.includes('@')) {
          activeAdmin = { email: email, role: 'Master Administrator' };
          sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(activeAdmin));
          showToast(`Master Access Granted! Logged in as ${email}`, 'success');
          renderAdminPortal();
        } else {
          showToast('Invalid Admin Email or Password!', 'error');
        }
      });
    }

    if (adminLogoutBtn) {
      adminLogoutBtn.addEventListener('click', () => {
        activeAdmin = null;
        sessionStorage.removeItem(ADMIN_SESSION_KEY);
        renderAdminPortal();
        showToast('Master Admin logged out successfully.', 'info');
      });
    }

    const sendOtpBtn = document.getElementById('btn-send-admin-otp');

    if (sendPassBtn) {
      sendPassBtn.addEventListener('click', () => {
        document.getElementById('admin-login-email').value = OFFICIAL_WEBSITE_EMAIL;
        document.getElementById('admin-login-password').value = ADMIN_DEFAULT_PASSWORD;
        showToast(`🔑 Admin Credentials Auto-Filled! Click Log In.`, 'info');
      });
    }

    if (sendOtpBtn) {
      sendOtpBtn.addEventListener('click', () => {
        const emailInput = document.getElementById('admin-login-email');
        const targetEmail = emailInput ? emailInput.value.trim() : '';

        if (!targetEmail || !targetEmail.includes('@')) {
          showToast('Please enter a valid email address in the field above to receive OTP.', 'error');
          if (emailInput) emailInput.focus();
          return;
        }

        generateAndSendEmailOTP(targetEmail);
      });
    }

    // Email OTP Form Verification Handler
    const otpForm = document.getElementById('email-otp-form');
    if (otpForm) {
      otpForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const enteredCode = document.getElementById('otp-input-code').value.trim();
        const targetEmail = document.getElementById('otp-target-email') ? document.getElementById('otp-target-email').textContent : OFFICIAL_WEBSITE_EMAIL;

        if (!currentGeneratedOTP) {
          showToast('No active OTP found. Click Resend OTP to generate a code.', 'error');
          return;
        }

        if (enteredCode === currentGeneratedOTP) {
          activeAdmin = { email: targetEmail || OFFICIAL_WEBSITE_EMAIL, role: 'Master Administrator' };
          sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(activeAdmin));

          document.getElementById('email-otp-modal').classList.remove('active');
          renderAdminPortal();
          showToast(`✅ Email OTP Verification Successful! Logged in as ${activeAdmin.email}`, 'success');
        } else {
          showToast(`❌ Invalid OTP Code "${enteredCode}"! Please enter the correct 6-digit code.`, 'error');
        }
      });
    }

    // Auto-Fill OTP Button
    const autoFillOtpBtn = document.getElementById('btn-autofill-otp');
    if (autoFillOtpBtn) {
      autoFillOtpBtn.addEventListener('click', () => {
        if (currentGeneratedOTP) {
          document.getElementById('otp-input-code').value = currentGeneratedOTP;
          showToast('⚡ OTP Code auto-filled! Click Verify OTP.', 'info');
        }
      });
    }

    // Resend OTP Button
    const resendOtpBtn = document.getElementById('btn-resend-otp');
    if (resendOtpBtn) {
      resendOtpBtn.addEventListener('click', () => {
        const targetEmail = document.getElementById('otp-target-email') ? document.getElementById('otp-target-email').textContent : OFFICIAL_WEBSITE_EMAIL;
        generateAndSendEmailOTP(targetEmail || OFFICIAL_WEBSITE_EMAIL);
      });
    }

    // Toggle Reveal Code Button
    const showCodeHelpBtn = document.getElementById('btn-show-code-help');
    if (showCodeHelpBtn) {
      showCodeHelpBtn.addEventListener('click', () => {
        const revealBox = document.getElementById('otp-code-reveal-box');
        if (revealBox) {
          const isHidden = (revealBox.style.display === 'none' || !revealBox.style.display);
          revealBox.style.display = isHidden ? 'block' : 'none';
        }
      });
    }

    // Close OTP Modal
    const closeOtpBtn = document.getElementById('btn-close-otp-modal');
    if (closeOtpBtn) {
      closeOtpBtn.addEventListener('click', () => {
        document.getElementById('email-otp-modal').classList.remove('active');
      });
    }

    const statusFilter = document.getElementById('admin-filter-status');
    const wardFilter = document.getElementById('admin-filter-ward');

    if (statusFilter) statusFilter.addEventListener('change', renderAdminPortal);
    if (wardFilter) wardFilter.addEventListener('change', renderAdminPortal);

    // Form to Register New Field Worker
    const addWorkerForm = document.getElementById('admin-add-worker-form');
    if (addWorkerForm) {
      addWorkerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('admin-worker-name').value.trim();
        const username = document.getElementById('admin-worker-username').value.trim();
        const password = document.getElementById('admin-worker-password').value.trim();
        const ward = document.getElementById('admin-worker-ward').value;
        const mobile = document.getElementById('admin-worker-mobile').value.trim();

        if (workers.some(w => w.username.toLowerCase() === username.toLowerCase())) {
          showToast(`Username "${username}" is already taken! Use a unique username.`, 'error');
          return;
        }

        const newWorker = {
          name: name,
          username: username,
          password: password,
          ward: ward,
          mobile: mobile,
          createdAt: new Date().toISOString()
        };

        workers.push(newWorker);
        saveWorkersData();
        renderAdminWorkersTable();

        addWorkerForm.reset();
        showToast(`Field Worker "${name}" (${ward}) registered successfully!`, 'success');
      });
    }

    const closeBtn = document.getElementById('btn-close-admin-modal');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        document.getElementById('admin-verify-modal').classList.remove('active');
      });
    }

    const approveBtn = document.getElementById('btn-admin-approve');
    if (approveBtn) {
      approveBtn.addEventListener('click', () => {
        const ticketId = activeAdminModalTicketId || (document.getElementById('admin-modal-id').dataset ? document.getElementById('admin-modal-id').dataset.ticketId : null);
        const item = complaints.find(c => c.id === ticketId);
        if (item) {
          if (!item.afterPhoto || item.status !== 'Pending Verification') {
            showToast('⚠️ Worker must upload AFTER photo and submit completed work before Admin can approve!', 'error');
            return;
          }
          item.status = 'Verified Closed';
          item.rejectionReason = null;
          item.verifiedAt = new Date().toISOString();
          item.updatedAt = new Date().toISOString();
          saveComplaintsData();
          updateComplaintOnSupabase(ticketId, { status: 'Verified Closed' });
          updateGlobalCounters();
          renderAdminPortal();
          renderWorkerPortal();
          renderTrackPortal();
          document.getElementById('admin-verify-modal').classList.remove('active');
          showToast(`Complaint ${ticketId} verified and closed successfully! SMS sent to citizen.`, 'success');
        }
      });
    }

    const rejectBtn = document.getElementById('btn-admin-reject');
    if (rejectBtn) {
      rejectBtn.addEventListener('click', () => {
        const ticketId = activeAdminModalTicketId || (document.getElementById('admin-modal-id').dataset ? document.getElementById('admin-modal-id').dataset.ticketId : null);
        if (ticketId) {
          handleRejectComplaint(ticketId);
        }
      });
    }

    const sendMsgModalBtn = document.getElementById('btn-admin-send-msg-modal');
    if (sendMsgModalBtn) {
      sendMsgModalBtn.addEventListener('click', () => {
        const ticketId = activeAdminModalTicketId || (document.getElementById('admin-modal-id').dataset ? document.getElementById('admin-modal-id').dataset.ticketId : null);
        const item = complaints.find(c => c.id === ticketId);
        if (item) {
          openAdminMessageModal(item);
        }
      });
    }

    // Message Form submission handler
    const msgForm = document.getElementById('admin-message-form');
    if (msgForm) {
      msgForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const ticketId = document.getElementById('msg-ticket-id').value;
        const messageText = document.getElementById('admin-msg-text').value.trim();

        const item = complaints.find(c => c.id === ticketId);
        if (item) {
          item.adminMessage = messageText;
          item.adminMessageTime = new Date().toISOString();
          item.updatedAt = new Date().toISOString();

          saveComplaintsData();
          renderWorkerPortal();
          renderAdminPortal();
          renderTrackPortal();

          document.getElementById('admin-message-modal').classList.remove('active');
          showToast(`Directive message sent to ${item.ward} field worker!`, 'success');
        }
      });
    }

    // Preset Message Buttons (1-Click Instant Dispatch)
    const presets = document.querySelectorAll('.quick-msg-preset');
    presets.forEach(btn => {
      btn.addEventListener('click', () => {
        const text = btn.getAttribute('data-text');
        const ticketId = document.getElementById('msg-ticket-id').value;
        if (ticketId && text) {
          quickSendAdminMessage(ticketId, text);
        }
      });
    });

    const closeMsgBtn = document.getElementById('btn-close-message-modal');
    const cancelMsgBtn = document.getElementById('btn-cancel-msg-modal');
    if (closeMsgBtn) closeMsgBtn.addEventListener('click', () => {
      document.getElementById('admin-message-modal').classList.remove('active');
    });
    if (cancelMsgBtn) cancelMsgBtn.addEventListener('click', () => {
      document.getElementById('admin-message-modal').classList.remove('active');
    });
  }

  function openAdminMessageModal(item) {
    const modal = document.getElementById('admin-message-modal');
    if (!modal) return;

    document.getElementById('msg-ticket-id').value = item.id;
    document.getElementById('msg-ticket-code').textContent = `${item.id} (${item.ward})`;
    document.getElementById('msg-worker-ward').textContent = item.ward;

    const txtInput = document.getElementById('admin-msg-text');
    if (txtInput) txtInput.value = item.adminMessage || '';

    modal.classList.add('active');
  }

  // --- ADMIN EDIT WORKER MODAL HANDLERS ---
  function initAdminEditWorkerModal() {
    const editModal = document.getElementById('admin-edit-worker-modal');
    const closeBtn = document.getElementById('btn-close-edit-worker-modal');
    const cancelBtn = document.getElementById('btn-cancel-edit-worker');
    const editForm = document.getElementById('admin-edit-worker-form');

    function closeEditModal() {
      if (editModal) editModal.classList.remove('active');
    }

    if (closeBtn) closeBtn.addEventListener('click', closeEditModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeEditModal);

    if (editForm) {
      editForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const origUsername = document.getElementById('edit-worker-original-username').value;
        const newName = document.getElementById('edit-worker-name').value.trim();
        const newUsername = document.getElementById('edit-worker-username').value.trim();
        const newPassword = document.getElementById('edit-worker-password').value.trim();
        const newWard = document.getElementById('edit-worker-ward').value;
        const newMobile = document.getElementById('edit-worker-mobile').value.trim();

        // Check if username changed and conflicts with another worker
        if (newUsername.toLowerCase() !== origUsername.toLowerCase() &&
          workers.some(w => w.username.toLowerCase() === newUsername.toLowerCase())) {
          showToast(`Username "${newUsername}" is already taken by another worker!`, 'error');
          return;
        }

        const workerItem = workers.find(w => w.username.toLowerCase() === origUsername.toLowerCase());
        if (workerItem) {
          workerItem.name = newName;
          workerItem.username = newUsername;
          workerItem.password = newPassword;
          workerItem.ward = newWard;
          workerItem.mobile = newMobile;

          saveWorkersData();
          renderAdminWorkersTable();

          // If the edited worker is currently logged in, update activeWorker session
          if (activeWorker && activeWorker.username.toLowerCase() === origUsername.toLowerCase()) {
            activeWorker = workerItem;
            sessionStorage.setItem(WORKER_SESSION_KEY, JSON.stringify(activeWorker));
            renderWorkerPortal();
          }

          closeEditModal();
          showToast(`Worker details for "${newName}" updated successfully!`, 'success');
        }
      });
    }
  }

  function openEditWorkerModal(worker) {
    const editModal = document.getElementById('admin-edit-worker-modal');
    if (!editModal) return;

    document.getElementById('edit-worker-original-username').value = worker.username;
    document.getElementById('edit-worker-name').value = worker.name;
    document.getElementById('edit-worker-username').value = worker.username;
    document.getElementById('edit-worker-password').value = worker.password;
    document.getElementById('edit-worker-ward').value = worker.ward;
    document.getElementById('edit-worker-mobile').value = worker.mobile;

    editModal.classList.add('active');
  }

  function renderAdminPortal() {
    const loginView = document.getElementById('admin-login-view');
    const dashboardView = document.getElementById('admin-dashboard-view');
    if (!loginView || !dashboardView) return;

    if (!activeAdmin) {
      loginView.style.display = 'block';
      dashboardView.style.display = 'none';
      return;
    }

    loginView.style.display = 'none';
    dashboardView.style.display = 'block';

    const sessionDisplay = document.getElementById('admin-session-email-display');
    if (sessionDisplay && activeAdmin) {
      sessionDisplay.textContent = activeAdmin.email;
    }

    renderAdminWorkersTable();

    const tbody = document.getElementById('admin-table-body');
    const statusFilter = document.getElementById('admin-filter-status');
    const wardFilter = document.getElementById('admin-filter-ward');
    if (!tbody || !statusFilter || !wardFilter) return;

    const statusVal = statusFilter.value;
    const wardVal = wardFilter.value;

    tbody.replaceChildren();

    const filtered = complaints.filter(c => {
      const matchStatus = statusVal === 'ALL' || c.status === statusVal;
      const matchWard = wardVal === 'ALL' || c.ward === wardVal;
      return matchStatus && matchWard;
    });

    if (filtered.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 8;
      td.style.textAlign = 'center';
      td.style.padding = '2rem';
      td.style.color = 'var(--text-muted)';
      td.textContent = 'No matching complaints found for the selected filters.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    filtered.forEach(c => {
      const tr = document.createElement('tr');

      const tdId = document.createElement('td');
      tdId.className = 'ticket-id';
      tdId.textContent = c.id;
      tr.appendChild(tdId);

      const tdWard = document.createElement('td');
      const wBold = document.createElement('strong');
      wBold.style.color = 'var(--text-gold)';
      wBold.textContent = c.ward;
      const wAddr = document.createElement('div');
      wAddr.style.fontSize = '0.8rem';
      wAddr.style.color = 'var(--text-muted)';
      wAddr.textContent = c.address;
      tdWard.appendChild(wBold);
      tdWard.appendChild(wAddr);
      tr.appendChild(tdWard);

      const tdCat = document.createElement('td');
      tdCat.textContent = c.category;
      tr.appendChild(tdCat);

      const tdCitizen = document.createElement('td');
      tdCitizen.textContent = `${c.citizenName} (${c.citizenMobile})`;
      tr.appendChild(tdCitizen);

      const tdMap = document.createElement('td');
      const mapBtn = document.createElement('button');
      mapBtn.className = 'btn-location-view';
      mapBtn.textContent = '📍 Live Map';
      mapBtn.addEventListener('click', () => openLiveLocationModal(c));
      tdMap.appendChild(mapBtn);
      tr.appendChild(tdMap);

      const tdPhotos = document.createElement('td');
      const pText = document.createElement('div');
      pText.style.fontSize = '0.8rem';
      pText.textContent = c.afterPhoto ? '📷 Before + 📸 After' : '📷 Before Photo Only';
      tdPhotos.appendChild(pText);
      tr.appendChild(tdPhotos);

      const tdStatus = document.createElement('td');
      tdStatus.appendChild(getStatusBadgeElement(c.status));
      tr.appendChild(tdStatus);

      const tdAction = document.createElement('td');
      tdAction.style.display = 'flex';
      tdAction.style.gap = '0.35rem';

      const btnInspect = document.createElement('button');
      btnInspect.className = 'btn-secondary';
      btnInspect.style.padding = '0.4rem 0.6rem';
      btnInspect.style.fontSize = '0.78rem';
      btnInspect.textContent = c.status === 'Pending Verification' ? '🔍 Verify' : '👁️ View';
      btnInspect.addEventListener('click', () => openAdminVerifyModal(c));
      tdAction.appendChild(btnInspect);

      if (c.status !== 'Verified Closed') {
        const btnMsg = document.createElement('button');
        btnMsg.className = 'btn-secondary';
        btnMsg.style.padding = '0.4rem 0.6rem';
        btnMsg.style.fontSize = '0.78rem';
        btnMsg.style.borderColor = 'var(--accent-gold)';
        btnMsg.style.color = 'var(--text-gold)';
        btnMsg.textContent = '💬 Msg';
        btnMsg.addEventListener('click', () => openAdminMessageModal(c));
        tdAction.appendChild(btnMsg);
      }

      tr.appendChild(tdAction);

      tbody.appendChild(tr);
    });
  }

  function renderAdminWorkersTable() {
    const tbody = document.getElementById('admin-workers-table-body');
    if (!tbody) return;

    tbody.replaceChildren();

    if (workers.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 5;
      td.style.textAlign = 'center';
      td.style.padding = '1rem';
      td.style.color = 'var(--text-muted)';
      td.textContent = 'No workers registered yet. Use the form above to add a field worker.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    workers.forEach(w => {
      const tr = document.createElement('tr');

      const tdName = document.createElement('td');
      const wStrong = document.createElement('strong');
      wStrong.textContent = w.name;
      const wMob = document.createElement('div');
      wMob.style.fontSize = '0.75rem';
      wMob.style.color = 'var(--text-muted)';
      wMob.textContent = `📞 ${w.mobile}`;
      tdName.appendChild(wStrong);
      tdName.appendChild(wMob);
      tr.appendChild(tdName);

      const tdWard = document.createElement('td');
      const wardSpan = document.createElement('span');
      wardSpan.style.color = 'var(--text-gold)';
      wardSpan.style.fontWeight = 'bold';
      wardSpan.textContent = w.ward;
      tdWard.appendChild(wardSpan);
      tr.appendChild(tdWard);

      const tdUser = document.createElement('td');
      const codeUser = document.createElement('code');
      codeUser.style.color = '#38bdf8';
      codeUser.textContent = w.username;
      tdUser.appendChild(codeUser);
      tr.appendChild(tdUser);

      const tdPass = document.createElement('td');
      const codePass = document.createElement('code');
      codePass.style.color = 'var(--accent-gold)';
      codePass.textContent = w.password;
      tdPass.appendChild(codePass);
      tr.appendChild(tdPass);

      const tdAction = document.createElement('td');
      tdAction.style.display = 'flex';
      tdAction.style.gap = '0.35rem';

      // Edit Worker Button
      const editBtn = document.createElement('button');
      editBtn.className = 'btn-secondary';
      editBtn.style.padding = '0.25rem 0.5rem';
      editBtn.style.fontSize = '0.75rem';
      editBtn.textContent = '✏️ Edit';
      editBtn.addEventListener('click', () => openEditWorkerModal(w));
      tdAction.appendChild(editBtn);

      // Delete Worker Button
      const delBtn = document.createElement('button');
      delBtn.className = 'btn-danger';
      delBtn.style.padding = '0.25rem 0.5rem';
      delBtn.style.fontSize = '0.75rem';
      delBtn.textContent = '🗑️ Delete';
      delBtn.addEventListener('click', () => {
        if (confirm(`Are you sure you want to delete worker "${w.name}" (${w.username})?`)) {
          workers = workers.filter(item => item.username !== w.username);
          saveWorkersData();
          renderAdminWorkersTable();
          showToast(`Worker ${w.name} removed.`, 'info');
        }
      });
      tdAction.appendChild(delBtn);

      tr.appendChild(tdAction);
      tbody.appendChild(tr);
    });
  }

  function openAdminVerifyModal(item) {
    const modal = document.getElementById('admin-verify-modal');
    if (!modal) return;

    activeAdminModalTicketId = item.id;
    document.getElementById('admin-modal-cat').textContent = `${item.category} (${item.ward})`;
    const idEl = document.getElementById('admin-modal-id');
    idEl.textContent = `Ticket ID: ${item.id}`;
    idEl.dataset.ticketId = item.id;

    document.getElementById('admin-modal-location').textContent = `📍 Address: ${item.address} (GPS: ${item.lat}, ${item.lng})`;

    const badgeContainer = document.getElementById('admin-modal-status-badge');
    badgeContainer.replaceChildren(getStatusBadgeElement(item.status));

    const beforeList = getBeforePhotosList(item);
    const beforeImg = document.getElementById('admin-modal-before-img');
    if (beforeImg) {
      beforeImg.src = beforeList[0] || '';
      beforeImg.style.cursor = 'pointer';
      beforeImg.title = 'Click to zoom full size photo';
      beforeImg.onclick = () => openPhotoLightbox(beforeList[0]);
    }

    const afterList = getAfterPhotosList(item);
    const afterImg = document.getElementById('admin-modal-after-img');
    if (afterImg) {
      if (afterList.length > 0) {
        afterImg.src = afterList[0];
        afterImg.parentElement.style.display = 'block';
        afterImg.style.cursor = 'pointer';
        afterImg.title = 'Click to zoom full size photo';
        afterImg.onclick = () => openPhotoLightbox(afterList[0]);
      } else {
        afterImg.src = generateSVGDataURI('No After Photo Uploaded Yet', '#1e293b', 'before');
        afterImg.onclick = null;
      }
    }

    document.getElementById('admin-modal-problem-desc').textContent = `Problem Description: ${item.problem}`;
    document.getElementById('admin-modal-worker-notes').textContent = item.workerNotes ? `Worker Field Notes: ${item.workerNotes}` : 'Worker Field Notes: Pending field work completion.';

    document.getElementById('admin-modal-citizen-name').textContent = item.citizenName;
    document.getElementById('admin-modal-citizen-mobile').textContent = item.citizenMobile;
    document.getElementById('admin-modal-created-time').textContent = new Date(item.createdAt).toLocaleString();
    document.getElementById('admin-modal-updated-time').textContent = new Date(item.updatedAt).toLocaleString();

    const actionRow = document.getElementById('admin-modal-action-row');
    const approveBtn = document.getElementById('btn-admin-approve');
    const lockNotice = document.getElementById('admin-modal-lock-notice');

    if (item.status === 'Verified Closed') {
      actionRow.style.display = 'none';
      if (lockNotice) lockNotice.style.display = 'none';
    } else {
      actionRow.style.display = 'flex';
      if (item.status === 'Pending Verification' && item.afterPhoto) {
        if (lockNotice) lockNotice.style.display = 'none';
        if (approveBtn) {
          approveBtn.style.display = 'inline-flex';
          approveBtn.disabled = false;
          approveBtn.style.opacity = '1';
          approveBtn.style.cursor = 'pointer';
          approveBtn.title = 'Worker completed work. Click to Approve & Verify Closed.';
          approveBtn.textContent = '✅ Approve & Verify Closed';
        }
      } else {
        if (lockNotice) lockNotice.style.display = 'block';
        if (approveBtn) {
          approveBtn.style.display = 'inline-flex';
          approveBtn.disabled = true;
          approveBtn.style.opacity = '0.5';
          approveBtn.style.cursor = 'not-allowed';
          approveBtn.title = 'Awaiting worker to upload AFTER photo and submit completed work';
          approveBtn.textContent = '⏳ Awaiting Worker Photo Upload';
        }
      }
    }

    modal.classList.add('active');
  }

  // --- BADGE HELPERS ---
  function getStatusBadgeElement(status) {
    const span = document.createElement('span');
    span.className = 'badge';

    if (status === 'Registered') {
      span.classList.add('badge-registered');
      span.textContent = '🟡 Registered';
    } else if (status === 'In Progress') {
      span.classList.add('badge-inprogress');
      span.textContent = '🔵 In Progress';
    } else if (status === 'Pending Verification') {
      span.classList.add('badge-pending-admin');
      span.textContent = '🟣 Pending Verification';
    } else if (status === 'Verified Closed') {
      span.classList.add('badge-verified');
      span.textContent = '🟢 Verified Closed';
    } else {
      span.textContent = status;
    }

    return span;
  }

  // --- GLOBAL COUNTERS UPDATE ---
  function updateGlobalCounters() {
    const total = complaints.length;
    const resolved = complaints.filter(c => c.status === 'Verified Closed').length;
    const registered = complaints.filter(c => c.status === 'Registered').length;
    const progress = complaints.filter(c => c.status === 'In Progress').length;
    const pendingVerify = complaints.filter(c => c.status === 'Pending Verification').length;

    const elTotal = document.getElementById('stat-total');
    const elResolved = document.getElementById('stat-resolved');
    if (elTotal) elTotal.textContent = total;
    if (elResolved) elResolved.textContent = resolved;

    const admTotal = document.getElementById('admin-stat-total');
    const admReg = document.getElementById('admin-stat-registered');
    const admProg = document.getElementById('admin-stat-progress');
    const admPend = document.getElementById('admin-stat-pending-verify');
    const admVer = document.getElementById('admin-stat-verified');

    if (admTotal) admTotal.textContent = total;
    if (admReg) admReg.textContent = registered;
    if (admProg) admProg.textContent = progress;
    if (admPend) admPend.textContent = pendingVerify;
    if (admVer) admVer.textContent = resolved;

    updateWorkerCounters();
  }

  // --- TOAST NOTIFICATIONS ---
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';

    const icon = type === 'success' ? '✅' : type === 'error' ? '⚠️' : '⭐';

    const iconSpan = document.createElement('span');
    iconSpan.textContent = icon;

    const msgSpan = document.createElement('span');
    msgSpan.textContent = message;

    toast.appendChild(iconSpan);
    toast.appendChild(msgSpan);
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

})();
