class ScreenRecorder {
  constructor(settings, onStart, onStop) {
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.animationFrameId = null;
    this.screenStream = null;
    this.camStream = null;
    this.canvas = null;
    this.ctx = null;
    this.canvasStream = null;
    this.combinedStream = null;
    this.isRecording = false;
    this.isPaused = false;
    this.startTime = null;
    this.pausedTime = 0;
    this.timerInterval = null;
    this.settings = settings;
    this.onStart = onStart; // Callback when recording starts
    this.onStop = onStop;   // Callback when recording stops
  }

  getQualityConstraints() {
    const constraints = { '480p': { width:854,height:480 }, '720p': { width:1280,height:720 }, '1080p':{ width:1920,height:1080 }, '1440p':{ width:2560,height:1440 } };
    return constraints[this.settings.quality] || constraints['720p'];
  }

  getOverlaySize(canvasHeight) {
    const sizes = { small: canvasHeight*0.25, medium: canvasHeight*0.3, large: canvasHeight*0.4 };
    return Math.floor(sizes[this.settings.overlaySize] || sizes.large);
  }

  getOverlayPosition(canvasWidth, canvasHeight, size) {
    const margin = 20;
    const positions = {
      'bottom-left': {x:margin, y:canvasHeight-size-margin},
      'bottom-right': {x:canvasWidth-size-margin, y:canvasHeight-size-margin},
      'top-left': {x:margin, y:margin},
      'top-right': {x:canvasWidth-size-margin, y:margin}
    };
    return positions[this.settings.overlayPosition] || positions['bottom-left'];
  }

  drawOverlay(camVideo, x, y, size) {
    this.ctx.save();
    switch(this.settings.overlayShape){
      case 'circle': this.ctx.beginPath(); this.ctx.arc(x+size/2, y+size/2, size/2,0,Math.PI*2); this.ctx.closePath(); this.ctx.clip(); break;
      case 'rectangle': this.ctx.beginPath(); this.ctx.rect(x,y,size,size); this.ctx.clip(); break;
      case 'rounded': this.ctx.beginPath(); this.ctx.roundRect(x,y,size,size,15); this.ctx.clip(); break;
    }
    this.ctx.drawImage(camVideo,x,y,size,size);
    this.ctx.restore();

    // Border
    this.ctx.save();
    this.ctx.strokeStyle='rgba(255,255,255,0.8)'; this.ctx.lineWidth=3;
    switch(this.settings.overlayShape){
      case 'circle': this.ctx.beginPath(); this.ctx.arc(x+size/2,y+size/2,size/2,0,Math.PI*2); this.ctx.stroke(); break;
      case 'rectangle': this.ctx.strokeRect(x,y,size,size); break;
      case 'rounded': this.ctx.beginPath(); this.ctx.roundRect(x,y,size,size,15); this.ctx.stroke(); break;
    }
    this.ctx.restore();
  }

  updateStatus(status) {
    const el = document.getElementById('recordingStatus');
    if(el) { el.textContent=status; el.className=`status-${status.toLowerCase().replace(/\s+/g,'-')}`; }
  }

  startTimer() {
    this.startTime = Date.now()-this.pausedTime;
    this.timerInterval=setInterval(()=>{
      if(!this.isPaused){
        const elapsed = Math.floor((Date.now()-this.startTime)/1000);
        const min=Math.floor(elapsed/60).toString().padStart(2,'0');
        const sec=(elapsed%60).toString().padStart(2,'0');
        const el=document.getElementById('recordingTime');
        if(el) el.textContent=`${min}:${sec}`;
      }
    },1000);
  }

  stopTimer() { if(this.timerInterval){clearInterval(this.timerInterval);this.timerInterval=null;} this.startTime=null; this.pausedTime=0; const el=document.getElementById('recordingTime'); if(el) el.textContent='00:00'; }

  async begin() {
    try {
      this.updateStatus('Initializing...');
      const qualityConstraints = this.getQualityConstraints();
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { ...qualityConstraints, frameRate: 30 }, audio: false });
      this.camStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: this.settings.includeMicrophone });

  const screenVideo = document.createElement('video');
  screenVideo.srcObject = this.screenStream;
  // Prevent any audio from the screen stream playing back in the page
  screenVideo.muted = true;
  screenVideo.playsInline = true;
  await screenVideo.play();
  const camVideo = document.createElement('video');
  camVideo.srcObject = this.camStream;
  // Mute the temporary camera element so microphone audio isn't played back locally (avoids echo)
  camVideo.muted = true;
  camVideo.volume = 0;
  camVideo.playsInline = true;
  await camVideo.play();

      this.canvas = document.createElement('canvas');
      const settings = this.screenStream.getVideoTracks()[0].getSettings();
      this.canvas.width = settings.width || qualityConstraints.width;
      this.canvas.height = settings.height || qualityConstraints.height;
      this.ctx = this.canvas.getContext('2d');

      // Set up preview: only video, no audio
      const preview = document.getElementById('preview');
      if (preview) {
        const previewStream = new MediaStream(this.canvas.captureStream(30).getVideoTracks());
        preview.srcObject = previewStream;
        preview.muted = true;
        preview.volume = 0;
      }

      this.isRecording = true;

      // Throttle draw loop to 30fps, synchronize to screenVideo play
      const draw = () => {
        if (!this.isRecording) return;
        this.ctx.drawImage(screenVideo, 0, 0, this.canvas.width, this.canvas.height);
        const size = this.getOverlaySize(this.canvas.height);
        const pos = this.getOverlayPosition(this.canvas.width, this.canvas.height, size);
        this.drawOverlay(camVideo, pos.x, pos.y, size);
        this.animationFrameId = setTimeout(draw, 1000 / 30); // 30 fps
      };
      // Start draw loop only after screenVideo is playing
      if (screenVideo.readyState >= 2) {
        draw();
      } else {
        screenVideo.onplay = draw;
      }

      this.canvasStream = this.canvas.captureStream(30);
      const tracks = [...this.canvasStream.getVideoTracks()];
      if (this.settings.includeMicrophone && this.camStream.getAudioTracks().length > 0) tracks.push(...this.camStream.getAudioTracks());
      this.combinedStream = new MediaStream(tracks);

      // Lower videoBitsPerSecond for real-time encoding
      let options = MediaRecorder.isTypeSupported('video/webm; codecs=vp9,opus') ?
        { mimeType: 'video/webm; codecs=vp9,opus', videoBitsPerSecond: 1000000 } :
        MediaRecorder.isTypeSupported('video/webm; codecs=vp8,opus') ?
        { mimeType: 'video/webm; codecs=vp8,opus', videoBitsPerSecond: 1000000 } :
        MediaRecorder.isTypeSupported('video/webm') ?
        { mimeType: 'video/webm', videoBitsPerSecond: 1000000 } :
        { videoBitsPerSecond: 1000000 };

      this.mediaRecorder = new MediaRecorder(this.combinedStream, options);
      this.recordedChunks = [];
      this.mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) this.recordedChunks.push(e.data); };
      this.mediaRecorder.onstop = () => this.handleRecordingComplete();
      this.mediaRecorder.start(1000);
      this.startTimer();
      this.updateStatus('Recording');

      // Callback
      if (this.onStart) this.onStart();
    } catch (e) {
      console.error(e); this.updateStatus('Error: ' + e.message); this.cleanup();
    }
  }

  stopRecording() { if(this.mediaRecorder && this.isRecording){ this.mediaRecorder.stop(); this.isRecording=false; this.stopTimer(); this.updateStatus('Processing...'); if(this.onStop)this.onStop(); } }

  togglePause() {
    if(!this.mediaRecorder || !this.isRecording) return;
    if(this.isPaused){ this.mediaRecorder.resume(); this.isPaused=false; this.startTime=Date.now()-this.pausedTime; this.updateStatus('Recording'); document.getElementById('pauseBtn').innerHTML='⏸️ Pause'; }
    else { this.mediaRecorder.pause(); this.isPaused=true; this.pausedTime=Date.now()-this.startTime; this.updateStatus('Paused'); document.getElementById('pauseBtn').innerHTML='▶️ Resume'; }
  }

  handleRecordingComplete() {
    this.cleanup();
    if(this.recordedChunks.length===0){ this.updateStatus('Recording Error: No data'); return; }
    const blob=new Blob(this.recordedChunks,{type:'video/webm'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url;
    a.download=`screen-recording-${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.webm`;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }

  cleanup() {
    if (this.animationFrameId) { clearTimeout(this.animationFrameId); this.animationFrameId = null; }
    if (this.screenStream) this.screenStream.getTracks().forEach(t => t.stop()); this.screenStream = null;
    if (this.camStream) this.camStream.getTracks().forEach(t => t.stop()); this.camStream = null;
    this.isRecording = false; this.isPaused = false; this.mediaRecorder = null; this.canvas = null; this.ctx = null; this.canvasStream = null; this.combinedStream = null;
  }
}

// Settings Management
const recorderSettings = {
  overlayPosition: 'bottom-left',
  overlaySize: 'large',
  overlayShape: 'circle',
  quality: '720p',
  includeMicrophone: true
};

function updatePreview() {
  const camera = document.getElementById('previewCamera');
  if(!camera) return;
  
  const sizeMap = { 'small': 25, 'medium': 30, 'large': 40 };
  const sizePct = sizeMap[recorderSettings.overlaySize] || 40;
  camera.style.height = `${sizePct}%`;
  
  if (recorderSettings.overlayShape === 'circle') camera.style.borderRadius = '50%';
  else if (recorderSettings.overlayShape === 'rounded') camera.style.borderRadius = '25%';
  else camera.style.borderRadius = '0';
  
  const margin = '5%';
  camera.style.top = 'auto'; camera.style.bottom = 'auto'; camera.style.left = 'auto'; camera.style.right = 'auto';
  
  if (recorderSettings.overlayPosition.includes('top')) camera.style.top = margin;
  else camera.style.bottom = margin;
  
  if (recorderSettings.overlayPosition.includes('left')) camera.style.left = margin;
  else camera.style.right = margin;
}

function saveSettings() {
  try { sessionStorage.setItem('recorderSettings', JSON.stringify(recorderSettings)); } catch { }
  updatePreview();
}

function loadSettings() {
  try {
    const saved = JSON.parse(sessionStorage.getItem('recorderSettings') || '{}');
    Object.assign(recorderSettings, saved);
    
    const posRadio = document.querySelector(`input[name="overlayPosition"][value="${recorderSettings.overlayPosition}"]`);
    if(posRadio) posRadio.checked = true;

    const shapeRadio = document.querySelector(`input[name="overlayShape"][value="${recorderSettings.overlayShape}"]`);
    if(shapeRadio) shapeRadio.checked = true;

    const sizeMap = ['small', 'medium', 'large'];
    const sizeIndex = sizeMap.indexOf(recorderSettings.overlaySize);
    if(sizeIndex >= 0) {
      document.getElementById('overlaySize').value = sizeIndex;
      document.getElementById('sizeLabel').textContent = ['25%', '30%', '40%'][sizeIndex];
    }

    const qMap = ['480p', '720p', '1080p', '1440p'];
    const qIndex = qMap.indexOf(recorderSettings.quality);
    if(qIndex >= 0) {
      document.getElementById('quality').value = qIndex;
      document.getElementById('qualityLabel').textContent = ['480p', '720p', '1080p', '1440p'][qIndex];
    }
    
    document.getElementById('includeMicrophone').checked = recorderSettings.includeMicrophone;
  } catch { }
  updatePreview();
}

// Multi-stage flow
document.addEventListener('DOMContentLoaded',()=>{
  loadSettings();

  document.querySelectorAll('input[name="overlayPosition"]').forEach(el => {
    el.onchange = (e) => { recorderSettings.overlayPosition = e.target.value; saveSettings(); };
  });
  
  const sizeMap = ['small', 'medium', 'large'];
  document.getElementById('overlaySize').oninput = (e) => { 
    recorderSettings.overlaySize = sizeMap[e.target.value]; 
    document.getElementById('sizeLabel').textContent = ['25%', '30%', '40%'][e.target.value];
    saveSettings(); 
  };
  
  document.querySelectorAll('input[name="overlayShape"]').forEach(el => {
    el.onchange = (e) => { recorderSettings.overlayShape = e.target.value; saveSettings(); };
  });
  
  const qMap = ['480p', '720p', '1080p', '1440p'];
  document.getElementById('quality').oninput = (e) => { 
    recorderSettings.quality = qMap[e.target.value]; 
    document.getElementById('qualityLabel').textContent = ['480p', '720p', '1080p', '1440p'][e.target.value];
    saveSettings(); 
  };
  
  document.getElementById('includeMicrophone').onchange = (e) => { recorderSettings.includeMicrophone = e.target.checked; saveSettings(); };

  const setupPage=document.getElementById('setupPage');
  const recordingPage=document.getElementById('recordingPage');
  const beginBtn=document.getElementById('beginRecording');

  let recorder=null;

  beginBtn.onclick=async ()=>{
    setupPage.classList.add('hidden');
    recordingPage.classList.remove('hidden');

    recorder=new ScreenRecorder(recorderSettings, ()=>{ /* onStart */ }, ()=>{ /* onStop */ });
    await recorder.begin();

    document.getElementById('stopBtn').onclick=()=>{ recorder.stopRecording(); resetToStart(); };
    document.getElementById('pauseBtn').onclick=()=>{ recorder.togglePause(); };
  };

  function resetToStart(){
    recordingPage.classList.add('hidden');
    setupPage.classList.remove('hidden');
  }
});
