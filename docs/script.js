class ScreenRecorder {
  constructor(onStart, onStop) {
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
    this.settings = {
      overlayPosition: 'bottom-left',
      overlaySize: 'medium',
      overlayShape: 'circle',
      quality: '1080p',
      includeMicrophone: true
    };
    this.onStart = onStart; // Callback when recording starts
    this.onStop = onStop;   // Callback when recording stops
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadSettings();
  }

  bindEvents() {
    document.getElementById('stopBtn').onclick = () => this.stopRecording();
    document.getElementById('pauseBtn').onclick = () => this.togglePause();

    // Settings
    document.getElementById('overlayPosition').onchange = (e) => { this.settings.overlayPosition = e.target.value; this.saveSettings(); };
    document.getElementById('overlaySize').onchange = (e) => { this.settings.overlaySize = e.target.value; this.saveSettings(); };
    document.getElementById('overlayShape').onchange = (e) => { this.settings.overlayShape = e.target.value; this.saveSettings(); };
    document.getElementById('quality').onchange = (e) => { this.settings.quality = e.target.value; this.saveSettings(); };
    document.getElementById('includeMicrophone').onchange = (e) => { this.settings.includeMicrophone = e.target.checked; this.saveSettings(); };
  }

  loadSettings() {
    try {
      const saved = JSON.parse(sessionStorage.getItem('recorderSettings') || '{}');
      this.settings = { ...this.settings, ...saved };
      document.getElementById('overlayPosition').value = this.settings.overlayPosition;
      document.getElementById('overlaySize').value = this.settings.overlaySize;
      document.getElementById('overlayShape').value = this.settings.overlayShape;
      document.getElementById('quality').value = this.settings.quality;
      document.getElementById('includeMicrophone').checked = this.settings.includeMicrophone;
    } catch { }
  }

  saveSettings() {
    try { sessionStorage.setItem('recorderSettings', JSON.stringify(this.settings)); } catch { }
  }

  getQualityConstraints() {
    const constraints = { '720p': { width:1280,height:720 }, '1080p':{ width:1920,height:1080 }, '1440p':{ width:2560,height:1440 } };
    return constraints[this.settings.quality] || constraints['1080p'];
  }

  getOverlaySize(canvasHeight) {
    const sizes = { small: canvasHeight*0.2, medium: canvasHeight*0.25, large: canvasHeight*0.3 };
    return Math.floor(sizes[this.settings.overlaySize] || sizes.medium);
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
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video:{...qualityConstraints, frameRate:30}, audio:false });
      this.camStream = await navigator.mediaDevices.getUserMedia({ video:{width:640,height:480}, audio:this.settings.includeMicrophone });

      const screenVideo = document.createElement('video'); screenVideo.srcObject=this.screenStream; await screenVideo.play();
      const camVideo = document.createElement('video'); camVideo.srcObject=this.camStream; await camVideo.play();

      const preview = document.getElementById('preview'); if(preview) preview.srcObject=this.camStream;

      this.canvas=document.createElement('canvas');
      const settings=this.screenStream.getVideoTracks()[0].getSettings();
      this.canvas.width=settings.width||qualityConstraints.width;
      this.canvas.height=settings.height||qualityConstraints.height;
      this.ctx=this.canvas.getContext('2d');

      this.isRecording=true;
      const draw=()=>{
        if(!this.isRecording) return;
        this.ctx.drawImage(screenVideo,0,0,this.canvas.width,this.canvas.height);
        const size=this.getOverlaySize(this.canvas.height);
        const pos=this.getOverlayPosition(this.canvas.width,this.canvas.height,size);
        this.drawOverlay(camVideo,pos.x,pos.y,size);
        this.animationFrameId=requestAnimationFrame(draw);
      };
      draw();

      this.canvasStream=this.canvas.captureStream(30);
      const tracks=[...this.canvasStream.getVideoTracks()];
      if(this.settings.includeMicrophone && this.camStream.getAudioTracks().length>0) tracks.push(...this.camStream.getAudioTracks());
      this.combinedStream=new MediaStream(tracks);

      let options = MediaRecorder.isTypeSupported('video/webm; codecs=vp9,opus') ?
        { mimeType:'video/webm; codecs=vp9,opus', videoBitsPerSecond:2000000 } :
        MediaRecorder.isTypeSupported('video/webm; codecs=vp8,opus') ?
        { mimeType:'video/webm; codecs=vp8,opus', videoBitsPerSecond:2000000 } :
        MediaRecorder.isTypeSupported('video/webm') ?
        { mimeType:'video/webm', videoBitsPerSecond:2000000 } :
        { videoBitsPerSecond:2000000 };

      this.mediaRecorder=new MediaRecorder(this.combinedStream,options);
      this.recordedChunks=[];
      this.mediaRecorder.ondataavailable=(e)=>{if(e.data.size>0) this.recordedChunks.push(e.data);};
      this.mediaRecorder.onstop=()=>this.handleRecordingComplete();
      this.mediaRecorder.start(1000);
      this.startTimer();
      this.updateStatus('Recording');

      // Callback
      if(this.onStart) this.onStart();
    } catch(e){
      console.error(e); this.updateStatus('Error: '+e.message); this.cleanup();
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
    if(this.animationFrameId){ cancelAnimationFrame(this.animationFrameId); this.animationFrameId=null; }
    if(this.screenStream) this.screenStream.getTracks().forEach(t=>t.stop()); this.screenStream=null;
    if(this.camStream) this.camStream.getTracks().forEach(t=>t.stop()); this.camStream=null;
    this.isRecording=false; this.isPaused=false; this.mediaRecorder=null; this.canvas=null; this.ctx=null; this.canvasStream=null; this.combinedStream=null;
  }
}

// Multi-stage flow
document.addEventListener('DOMContentLoaded',()=>{
  const startPage=document.getElementById('startPage');
  const setupPage=document.getElementById('setupPage');
  const recordingPage=document.getElementById('recordingPage');

  const startBtn=document.getElementById('startBtn');
  const beginBtn=document.getElementById('beginRecording');

  let recorder=null;

  startBtn.onclick=()=>{ startPage.classList.add('hidden'); setupPage.classList.remove('hidden'); };
  beginBtn.onclick=async ()=>{
    setupPage.classList.add('hidden');
    recordingPage.classList.remove('hidden');

    recorder=new ScreenRecorder(()=>{ /* onStart */ }, ()=>{ /* onStop */ });
    await recorder.begin();

    document.getElementById('stopBtn').onclick=()=>{ recorder.stopRecording(); resetToStart(); };
    document.getElementById('pauseBtn').onclick=()=>{ recorder.togglePause(); };
  };

  function resetToStart(){
    recordingPage.classList.add('hidden');
    startPage.classList.remove('hidden');
  }
});
