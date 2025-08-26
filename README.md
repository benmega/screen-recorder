# Screen Recorder Pro

A modern web-based screen recording application with camera overlay functionality. Record your screen with a professional camera overlay in high quality - perfect for tutorials, presentations, and online content creation.

## Features

### 🎥 Recording Capabilities
- **Screen Capture**: Record any screen, window, or browser tab
- **Camera Overlay**: Add your webcam as a customizable overlay
- **High Quality**: Support for 720p, 1080p, and 1440p recording
- **Audio Recording**: Optional microphone audio capture
- **Pause/Resume**: Control your recording with pause functionality

### 🎛️ Customization Options
- **Overlay Positioning**: Choose from 4 corner positions (top-left, top-right, bottom-left, bottom-right)
- **Overlay Sizing**: Small (20%), Medium (25%), or Large (30%) camera overlay
- **Overlay Shapes**: Circle, rectangle, or rounded rectangle camera frames
- **Quality Settings**: Adjustable video quality from HD to QHD
- **Audio Control**: Toggle microphone recording on/off

### 💻 User Interface
- **Clean Design**: Professional, minimal interface
- **Real-time Preview**: Live camera preview during setup
- **Recording Timer**: Track recording duration
- **Status Indicators**: Visual feedback for recording state
- **Responsive Layout**: Works on desktop, tablet, and mobile devices

## Browser Compatibility

### ✅ Fully Supported
- **Google Chrome** (v72+)
- **Microsoft Edge** (v79+)
- **Mozilla Firefox** (v66+)

### ⚠️ Requirements
- **HTTPS**: Must be served over HTTPS (or localhost for development)
- **Permissions**: Camera and microphone access required
- **Modern Browser**: ES6+ support needed

## Installation & Setup

### Option 1: Local Development
1. Clone or download the project files
2. Ensure you have these three files in the same directory:
   - `index.html`
   - `styles.css`
   - `script.js`
3. Serve the files using a local web server:
   ```bash
   # Using Python 3
   python -m http.server 8000
   
   # Using Node.js (with http-server)
   npx http-server
   
   # Using PHP
   php -S localhost:8000
   ```
4. Open `http://localhost:8000` in your browser

### Option 2: Web Server Deployment
1. Upload all three files to your web server
2. Ensure HTTPS is enabled (required for screen capture API)
3. Access the application through your domain

## Usage Guide

### Getting Started
1. **Open the application** in a supported browser
2. **Allow permissions** when prompted for camera and microphone access
3. **Configure settings** using the control panel:
   - Choose camera overlay position
   - Select overlay size and shape
   - Set video quality
   - Enable/disable microphone

### Recording Process
1. **Click "Start Recording"** - you'll be prompted to select what to share
2. **Choose your screen/window** from the browser dialog
3. **Recording begins** automatically with live timer
4. **Use controls** as needed:
   - Pause/Resume recording
   - Stop recording when finished
5. **Download your video** using the download button

### Tips for Best Results
- **Good lighting** improves camera overlay quality
- **Stable internet** ensures smooth recording
- **Close unnecessary apps** to improve performance
- **Test settings** with a short recording first

## File Structure

```
screen-recorder-pro/
├── index.html          # Main HTML structure
├── styles.css          # CSS styling and layout
├── script.js           # JavaScript functionality
└── README.md           # This documentation
```

## Technical Details

### Core Technologies
- **HTML5 Canvas** for video composition
- **MediaRecorder API** for recording functionality
- **WebRTC APIs** for camera and screen access
- **Vanilla JavaScript** (ES6+) - no external dependencies

### Video Specifications
- **Format**: WebM container
- **Video Codec**: VP9 (with VP8 fallback)
- **Audio Codec**: Opus
- **Bitrate**: 2 Mbps for high quality
- **Frame Rate**: 30 FPS

### Browser APIs Used
- `navigator.mediaDevices.getDisplayMedia()` - Screen capture
- `navigator.mediaDevices.getUserMedia()` - Camera/microphone access
- `MediaRecorder` - Recording functionality
- `Canvas.captureStream()` - Video composition
- `sessionStorage` - Settings persistence

## Troubleshooting

### Common Issues

**Recording file is 0 bytes:**
- Ensure you're using HTTPS (not HTTP)
- Check browser console for error messages
- Try a different browser or update your current one

**Camera not showing:**
- Grant camera permissions when prompted
- Check if camera is being used by another application
- Refresh the page and try again

**Screen sharing not working:**
- Make sure you're using a supported browser
- Grant screen sharing permissions
- Try selecting a different screen/window

**Audio not recording:**
- Enable "Include Microphone Audio" in settings
- Grant microphone permissions
- Check if microphone is muted or being used elsewhere

### Performance Tips
- **Lower quality settings** if experiencing lag
- **Close other browser tabs** to free up resources
- **Use Chrome** for best performance and compatibility
- **Record shorter segments** for very high resolutions

## Development

### Code Structure
The application follows a clean, object-oriented approach:

- **ScreenRecorder class**: Main application logic
- **Settings management**: Persistent configuration
- **Error handling**: Comprehensive error management
- **Responsive design**: Mobile-first CSS approach

### Customization
To modify the application:

1. **Styling**: Edit `styles.css` for visual changes
2. **Functionality**: Modify `script.js` for feature additions
3. **Layout**: Update `index.html` for structural changes

### Contributing
Feel free to submit issues and pull requests for:
- Bug fixes
- Feature enhancements
- Browser compatibility improvements
- Documentation updates

## Privacy & Security

- **No data transmission**: All recording happens locally in your browser
- **No server storage**: Videos are processed and stored on your device only
- **Permissions required**: Camera and microphone access needed for functionality
- **HTTPS required**: Ensures secure communication with browser APIs

## License

This project is open source and available under the MIT License.

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review browser console for error messages
3. Ensure you're using a supported browser with latest updates
4. Verify HTTPS is enabled for your deployment

---

**Built with modern web technologies • No external dependencies • Works entirely in your browser**
