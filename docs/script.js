class ScreenRecorder {
  constructor() {
    // Core recording objects
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.animationFrameId = null;
    this.screenStream = null;
    this.camStream = null;
    this.canvas = null;
    this.ctx = null;
    this.canvasStream = null;
    this.combinedStream = null;
    
    // Recording state
    this.isRecording = false;
    this.isPaused = false;
    this.startTime = null;
    this.pausedTime = 0;
    this.timerInterval = null;
    
    // Settings
    this.settings = {
      overlayPosition: 'bottom-left',
      overlaySize: 'medium',
      overlayShape: 'circle',
      quality: '1080p',
      includeMicrophone: true
    };
    
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadSettings();
  }

  bindEvents() {
    // Main controls
    document.getElementById('startBtn').onclick = () => this.startRecording();
    document.getElementById('stopBtn').onclick = () => this.stopRecording();
    document.getElementById('pauseBtn').onclick = () => this.togglePause();
    
    // Settings
    document.getElementById('overlayPosition').onchange = (e) => {
      this.settings.overlayPosition = e.target.value;
      this.saveSettings();
    };
    
    document.getElementById('overlaySize').onchange = (e) => {
      this.settings.overlaySize = e.target.value;
      this.saveSettings();
    };
    
    document.getElementById('overlayShape').onchange = (e) => {
      this.settings.overlayShape = e.target.value;
      this.saveSettings();
    };
    
    document.getElementById('quality').onchange = (e) => {
      this.settings.quality = e.target.value;
      this.saveSettings();
    };
    
    document.getElementById('includeMicrophone').onchange = (e) => {
      this.settings.includeMicrophone = e.target.checked;
      this.saveSettings();
    };
  }

  loadSettings() {
    try {
      const saved = JSON.parse(sessionStorage.getItem('recorderSettings') || '{}');
      this.settings = { ...this.settings, ...saved };
      
      // Apply settings to UI
      document.getElementById('overlayPosition').value = this.settings.overlayPosition;
      document.getElementById('overlaySize').value = this.settings.overlaySize;
      document.getElementById('overlayShape').value = this.settings.overlayShape;
      document.getElementById('quality').value = this.settings.quality;
      document.getElementById('includeMicrophone').checked = this.settings.includeMicrophone;
    } catch (error) {
      console.warn('Could not load settings:', error);
    }
  }

  saveSettings() {
    try {
      sessionStorage.setItem('recorderSettings', JSON.stringify(this.settings));
    } catch (error) {
      console.warn('Could not save settings:', error);
    }
  }

  getQualityConstraints() {
    const constraints = {
      '720p': { width: 1280, height: 720 },
      '1080p': { width: 1920, height: 1080 },
      '1440p': { width: 2560, height: 1440 }
    };
    return constraints[this.settings.quality] || constraints['1080p'];
  }

  getOverlaySize(canvasHeight) {
    const sizes = {
      small: canvasHeight * 0.2,
      medium: canvasHeight * 0.25,
      large: canvasHeight * 0.3
    };
    return Math.floor(sizes[this.settings.overlaySize] || sizes.medium);
  }

  getOverlayPosition(canvasWidth, canvasHeight, size) {
    const margin = 20;
    const positions = {
      'bottom-left': { x: margin, y: canvasHeight - size - margin },
      'bottom-right': { x: canvasWidth - size - margin, y: canvasHeight - size - margin },
      'top-left': { x: margin, y: margin },
      'top-right': { x: canvasWidth - size - margin, y: margin }
    };
    return positions[this.settings.overlayPosition] || positions['bottom-left'];
  }

  drawOverlay(camVideo, x, y, size) {
    this.ctx.save();
    
    switch (this.settings.overlayShape) {
      case 'circle':
        this.ctx.beginPath();
        this.ctx.arc(x + size/2, y + size/2, size/2, 0, Math.PI * 2, true);
        this.ctx.closePath();
        this.ctx.clip();
        break;
        
      case 'rectangle':
        this.ctx.beginPath();
        this.ctx.rect(x, y, size, size);
        this.ctx.clip();
        break;
        
      case 'rounded':
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, size, size, 15);
        this.ctx.clip();
        break;
    }
    
    this.ctx.drawImage(camVideo, x, y, size, size);
    this.ctx.restore();
    
    // Add border for better visibility
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    this.ctx.lineWidth = 3;
    
    switch (this.settings.overlayShape) {
      case 'circle':
        this.ctx.beginPath();
        this.ctx.arc(x + size/2, y + size/2, size/2, 0, Math.PI * 2, true);
        this.ctx.stroke();
        break;
        
      case 'rectangle':
        this.ctx.strokeRect(x, y, size, size);
        break;
        
      case 'rounded':
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, size, size, 15);
        this.ctx.stroke();
        break;
    }
    this.ctx.restore();
  }

  updateStatus(status) {
    const statusElement = document.getElementById('recordingStatus');
    statusElement.textContent = status;
    statusElement.className = `status-${status.toLowerCase().replace(/\s+/g, '-')}`;
  }

  startTimer() {
    this.startTime = Date.now() - this.pausedTime;
    this.timerInterval = setInterval(() => {
      if (!this.isPaused) {
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const seconds = (elapsed % 60).toString().padStart(2, '0');
        document.getElementById('recordingTime').textContent = `${minutes}:${seconds}`;
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.startTime = null;
    this.pausedTime = 0;
    document.getElementById('recordingTime').textContent = '00:00';
  }

  setButtonLoading(buttonId, loading) {
    const button = document.getElementById(buttonId);
    if (loading) {
      button.classList.add('loading');
      button.disabled = true;
    } else {
      button.classList.remove('loading');
    }
  }

  async startRecording() {
    try {
      this.setButtonLoading('startBtn', true);
      this.updateStatus('Initializing...');

      const qualityConstraints = this.getQualityConstraints();
      
      // Get screen stream with quality constraints
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          ...qualityConstraints,
          frameRate: 30
        },
        audio: false // Don't capture system audio to avoid conflicts
      });

      // Get camera and microphone
      const mediaConstraints = {
        video: { width: 640, height: 480 },
        audio: this.settings.includeMicrophone
      };
      
      this.camStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);

      // Create video elements
      const screenVideo = document.createElement("video");
      screenVideo.srcObject = this.screenStream;
      await screenVideo.play();

      const camVideo = document.createElement("video");
      camVideo.srcObject = this.camStream;
      await camVideo.play();

      // Preview camera only
      document.getElementById('preview').srcObject = this.camStream;

      // Create canvas for composition
      this.canvas = document.createElement("canvas");
      const screenTrack = this.screenStream.getVideoTracks()[0];
      const settings = screenTrack.getSettings();
      
      this.canvas.width = settings.width || qualityConstraints.width;
      this.canvas.height = settings.height || qualityConstraints.height;
      this.ctx = this.canvas.getContext("2d");

      // Wait for videos to be ready
      await new Promise(resolve => {
        let loadedCount = 0;
        const checkLoaded = () => {
          loadedCount++;
          if (loadedCount === 2) resolve();
        };
        
        if (screenVideo.readyState >= 2) checkLoaded();
        else screenVideo.addEventListener('loadeddata', checkLoaded, { once: true });
        
        if (camVideo.readyState >= 2) checkLoaded();
        else camVideo.addEventListener('loadeddata', checkLoaded, { once: true });
      });

      // Animation loop
      const draw = () => {
        if (!this.isRecording) return;
        
        // Draw screen content
        this.ctx.drawImage(screenVideo, 0, 0, this.canvas.width, this.canvas.height);

        // Draw camera overlay
        const size = this.getOverlaySize(this.canvas.height);
        const position = this.getOverlayPosition(this.canvas.width, this.canvas.height, size);
        
        this.drawOverlay(camVideo, position.x, position.y, size);

        this.animationFrameId = requestAnimationFrame(draw);
      };

      // Start drawing immediately
      this.isRecording = true;
      draw();

      // Create media streams
      this.canvasStream = this.canvas.captureStream(30);
      
      // Combine video and audio streams
      const tracks = [...this.canvasStream.getVideoTracks()];
      if (this.settings.includeMicrophone && this.camStream.getAudioTracks().length > 0) {
        tracks.push(...this.camStream.getAudioTracks());
      }
      this.combinedStream = new MediaStream(tracks);

      // Setup MediaRecorder with better options
      let options;
      if (MediaRecorder.isTypeSupported('video/webm; codecs=vp9,opus')) {
        options = { mimeType: 'video/webm; codecs=vp9,opus', videoBitsPerSecond: 2000000 };
      } else if (MediaRecorder.isTypeSupported('video/webm; codecs=vp8,opus')) {
        options = { mimeType: 'video/webm; codecs=vp8,opus', videoBitsPerSecond: 2000000 };
      } else if (MediaRecorder.isTypeSupported('video/webm')) {
        options = { mimeType: 'video/webm', videoBitsPerSecond: 2000000 };
      } else {
        options = { videoBitsPerSecond: 2000000 };
      }
      
      this.mediaRecorder = new MediaRecorder(this.combinedStream, options);
      this.recordedChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        console.log('Data available:', event.data.size);
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        console.log('Recording stopped, chunks:', this.recordedChunks.length);
        this.handleRecordingComplete();
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event.error);
        this.updateStatus('Recording Error');
      };

      this.mediaRecorder.onstart = () => {
        console.log('Recording started');
      };

      // Start recording with timeslice for regular data chunks
      this.mediaRecorder.start(1000); // Request data every 1000ms
      this.startTimer();
      
      this.updateStatus('Recording');
      this.setButtonLoading('startBtn', false);
      
      // Update UI
      document.getElementById('startBtn').disabled = true;
      document.getElementById('stopBtn').disabled = false;
      document.getElementById('pauseBtn').disabled = false;

    } catch (error) {
      console.error("Error starting recording:", error);
      this.updateStatus('Error: ' + error.message);
      this.setButtonLoading('startBtn', false);
      this.cleanup();
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
      this.stopTimer();
      this.updateStatus('Processing...');
    }
  }

  togglePause() {
    if (!this.mediaRecorder || !this.isRecording) return;

    if (this.isPaused) {
      this.mediaRecorder.resume();
      this.isPaused = false;
      this.startTime = Date.now() - this.pausedTime;
      this.updateStatus('Recording');
      document.getElementById('pauseBtn').innerHTML = '<span class="btn-icon">⏸️</span>Pause';
    } else {
      this.mediaRecorder.pause();
      this.isPaused = true;
      this.pausedTime = Date.now() - this.startTime;
      this.updateStatus('Paused');
      document.getElementById('pauseBtn').innerHTML = '<span class="btn-icon">▶️</span>Resume';
    }
  }

  handleRecordingComplete() {
    this.cleanup();
    
    console.log('Processing recording with', this.recordedChunks.length, 'chunks');
    
    if (this.recordedChunks.length === 0) {
      console.error('No recorded chunks available');
      this.updateStatus('Recording Error: No data captured');
      return;
    }
    
    // Create download blob
    const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
    console.log('Created blob with size:', blob.size);
    
    if (blob.size === 0) {
      console.error('Generated blob is empty');
      this.updateStatus('Recording Error: Empty file');
      return;
    }
    
    const url = URL.createObjectURL(blob);
    
    // Setup download
    const recording = document.getElementById('recording');
    const downloadLink = document.getElementById('downloadLink');
    
    recording.src = url;
    downloadLink.href = url;
    downloadLink.download = `screen-recording-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
    downloadLink.style.display = 'inline-flex';
    
    this.updateStatus('Recording Complete');
    
    // Reset UI
    document.getElementById('startBtn').disabled = false;
    document.getElementById('stopBtn').disabled = true;
    document.getElementById('pauseBtn').disabled = true;
    document.getElementById('pauseBtn').innerHTML = '<span class="btn-icon">⏸️</span>Pause';
    
    // Clean up the URL after some time to prevent memory leaks
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 60000);
  }

  cleanup() {
    // Stop animation frame
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Stop streams
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }
    
    if (this.camStream) {
      this.camStream.getTracks().forEach(track => track.stop());
      this.camStream = null;
    }

    // Reset state
    this.isRecording = false;
    this.isPaused = false;
    this.mediaRecorder = null;
    this.canvas = null;
    this.ctx = null;
    this.canvasStream = null;
    this.combinedStream = null;
  }
}

// Initialize the recorder when the page loads
document.addEventListener('DOMContentLoaded', () => {
  // Check for required browser support
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    alert('Screen recording is not supported in this browser. Please use Chrome, Edge, or Firefox.');
    return;
  }

  // Initialize recorder
  const recorder = new ScreenRecorder();
  
  // Add some helpful tips
  console.log('Screen Recorder Pro initialized!');
  console.log('Tips:');
  console.log('- Make sure to allow camera and microphone permissions');
  console.log('- Choose which screen/window to share when prompted');
  console.log('- Adjust settings before starting recording for best results');
});