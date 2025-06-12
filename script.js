// Gyroscope Dashboard Script
    class GyroscopeDashboard {
        constructor() {
            this.websocket = null;
            this.isConnected = false;
            this.isSerialConnected = false;
            this.isLogging = false;
            this.dataBuffer = [];
            this.maxDataPoints = 50;
            this.logData = [];
            this.demoInterval = null;
            this.cube = null;
            this.cubeScene = null;
            this.cubeCamera = null;
            this.cubeRenderer = null;
            
            this.initializeElements();
            this.initializeChart();
            this.createParticles();
            this.init3DCube();
            this.bindEvents();
        }

        initializeElements() {
            this.elements = {
                websocketUrl: document.getElementById('websocketUrl'),
                portSelect: document.getElementById('portSelect'),
                baudRate: document.getElementById('baudRate'),
                connectBtn: document.getElementById('connectBtn'),
                serialConnectBtn: document.getElementById('serialConnectBtn'),
                logBtn: document.getElementById('logBtn'),
                clearBtn: document.getElementById('clearBtn'),
                demoBtn: document.getElementById('demoBtn'),
                statusDot: document.getElementById('statusDot'),
                statusText: document.getElementById('statusText'),
                horizon: document.getElementById('horizon'),
                rollValue: document.getElementById('rollValue'),
                pitchValue: document.getElementById('pitchValue'),
                accelX: document.getElementById('accelX'),
                accelY: document.getElementById('accelY'),
                accelZ: document.getElementById('accelZ'),
                gyroX: document.getElementById('gyroX'),
                gyroY: document.getElementById('gyroY'),
                gyroZ: document.getElementById('gyroZ'),
                dataLogs: document.getElementById('dataLogs')
            };
        }

        init3DCube() {
            const canvas = document.getElementById('cubeCanvas');
            const width = canvas.clientWidth;
            const height = canvas.clientHeight;

            // Create scene
            this.cubeScene = new THREE.Scene();
            this.cubeScene.background = new THREE.Color(0x111122);

            // Create camera
            this.cubeCamera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
            this.cubeCamera.position.z = 3;

            // Create renderer
            this.cubeRenderer = new THREE.WebGLRenderer({ canvas, antialias: true });
            this.cubeRenderer.setSize(width, height);
            this.cubeRenderer.setPixelRatio(window.devicePixelRatio);

            // Create cube
            const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
            const edges = new THREE.EdgesGeometry(geometry);
            const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
            const cubeMaterial = new THREE.MeshBasicMaterial({ 
                color: 0x00a8ff,
                transparent: true,
                opacity: 0.8,
                wireframe: false
            });

            this.cube = new THREE.Mesh(geometry, cubeMaterial);
            this.cubeEdges = new THREE.LineSegments(edges, lineMaterial);
            this.cube.add(this.cubeEdges);
            this.cubeScene.add(this.cube);

            // Add ambient light
            const ambientLight = new THREE.AmbientLight(0x404040);
            this.cubeScene.add(ambientLight);

            // Add directional light
            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
            directionalLight.position.set(1, 1, 1);
            this.cubeScene.add(directionalLight);

            // Animation loop
            const animate = () => {
                requestAnimationFrame(animate);
                this.cubeRenderer.render(this.cubeScene, this.cubeCamera);
            };
            animate();
        }

        updateCubeOrientation(roll, pitch, yaw) {
            if (!this.cube) return;
            
            // Convert degrees to radians
            const rollRad = THREE.MathUtils.degToRad(roll);
            const pitchRad = THREE.MathUtils.degToRad(pitch);
            const yawRad = THREE.MathUtils.degToRad(yaw);
            
            // Apply rotations (order matters)
            this.cube.rotation.set(pitchRad, yawRad, rollRad);
        }

        initializeChart() {
            const ctx = document.getElementById('gyroChart').getContext('2d');
            this.chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Gyro X',
                        data: [],
                        borderColor: '#ff6b6b',
                        backgroundColor: 'rgba(255, 107, 107, 0.1)',
                        tension: 0.4,
                        fill: false
                    }, {
                        label: 'Gyro Y',
                        data: [],
                        borderColor: '#1ebb52',
                        backgroundColor: 'rgba(78, 205, 196, 0.1)',
                        tension: 0.4,
                        fill: false
                    }, {
                        label: 'Gyro Z',
                        data: [],
                        borderColor: '#45b7d1',
                        backgroundColor: 'rgba(69, 183, 209, 0.1)',
                        tension: 0.4,
                        fill: false
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: {
                                color: 'white'
                            }
                        }
                    },
                    scales: {
                        x: {
                            ticks: { color: 'white' },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' }
                        },
                        y: {
                            ticks: { color: 'white' },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' }
                        }
                    },
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    }
                }
            });
        }

        createParticles() {
            const container = document.querySelector('.floating-particles');
            for (let i = 0; i < 50; i++) {
                const particle = document.createElement('div');
                particle.className = 'particle';
                particle.style.left = Math.random() * 100 + '%';
                particle.style.animationDelay = Math.random() * 6 + 's';
                particle.style.animationDuration = (3 + Math.random() * 3) + 's';
                container.appendChild(particle);
            }
        }

        bindEvents() {
            this.elements.connectBtn.addEventListener('click', () => {
                if (this.isConnected) {
                    this.disconnect();
                } else {
                    this.connect();
                }
            });

            this.elements.serialConnectBtn.addEventListener('click', () => {
                if (this.isSerialConnected) {
                    this.disconnectSerial();
                } else {
                    this.connectSerial();
                }
            });

            this.elements.logBtn.addEventListener('click', () => {
                this.toggleLogging();
            });

            this.elements.clearBtn.addEventListener('click', () => {
                this.clearData();
            });

            this.elements.demoBtn.addEventListener('click', () => {
                this.toggleDemoMode();
            });
        }

        async connect() {
            const url = this.elements.websocketUrl.value;
            if (!url) {
                this.addLog('Please enter WebSocket URL', 'error');
                return;
            }

            try {
                this.websocket = new WebSocket(url);
                
                this.websocket.onopen = () => {
                    this.isConnected = true;
                    this.updateConnectionStatus(true, 'Connected to Bridge');
                    this.elements.connectBtn.textContent = 'Disconnect';
                    this.elements.connectBtn.style.background = 'rgba(255, 71, 87, 0.3)';
                    this.elements.serialConnectBtn.disabled = false;
                    this.addLog('Connected to WebSocket bridge');
                    
                    // Request available ports
                    this.sendCommand({ type: 'list_ports' });
                };

                this.websocket.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        this.handleMessage(data);
                    } catch (error) {
                        console.error('Failed to parse message:', error);
                    }
                };

                this.websocket.onclose = () => {
                    this.isConnected = false;
                    this.isSerialConnected = false;
                    this.updateConnectionStatus(false, 'Disconnected');
                    this.elements.connectBtn.textContent = 'Connect to Bridge';
                    this.elements.connectBtn.style.background = 'rgba(255, 255, 255, 0.1)';
                    this.elements.serialConnectBtn.disabled = true;
                    this.elements.serialConnectBtn.textContent = 'Connect Serial';
                    this.elements.serialConnectBtn.style.background = 'rgba(255, 255, 255, 0.1)';
                    this.addLog('WebSocket connection closed', 'warning');
                };

                this.websocket.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    this.addLog('WebSocket connection error', 'error');
                };

            } catch (error) {
                console.error('Connection failed:', error);
                this.addLog('Failed to connect: ' + error.message, 'error');
            }
        }

        disconnect() {
            if (this.websocket) {
                this.websocket.close();
                this.websocket = null;
            }
            this.stopDemoMode();
        }

        connectSerial() {
            const port = this.elements.portSelect.value;
            const baudrate = parseInt(this.elements.baudRate.value);
            
            if (!port) {
                this.addLog('Please select a serial port', 'error');
                return;
            }

            this.sendCommand({
                type: 'connect',
                port: port,
                baudrate: baudrate
            });
        }

        disconnectSerial() {
            this.sendCommand({ type: 'disconnect' });
        }

        sendCommand(command) {
            if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
                this.websocket.send(JSON.stringify(command));
            }
        }

        handleMessage(data) {
            switch (data.type) {
                case 'ports':
                    this.updatePortList(data.data);
                    break;
                case 'connected':
                    this.isSerialConnected = true;
                    this.elements.serialConnectBtn.textContent = 'Disconnect Serial';
                    this.elements.serialConnectBtn.style.background = 'rgba(255, 71, 87, 0.3)';
                    this.updateConnectionStatus(true, `Serial: ${data.port} @ ${data.baudrate}`);
                    this.addLog(`Connected to ${data.port} at ${data.baudrate} baud`);
                    break;
                case 'disconnected':
                    this.isSerialConnected = false;
                    this.elements.serialConnectBtn.textContent = 'Connect Serial';
                    this.elements.serialConnectBtn.style.background = 'rgba(255, 255, 255, 0.1)';
                    this.updateConnectionStatus(true, 'Connected to Bridge');
                    this.addLog('Serial port disconnected');
                    break;
                case 'error':
                    this.addLog('Error: ' + data.message, 'error');
                    break;
                case 'raw':
                    this.addLog('Raw data: ' + data.data);
                    break;
                default:
                    // Assume it's sensor data
                    this.processData(data);
                    break;
            }
        }

        updatePortList(ports) {
            this.elements.portSelect.innerHTML = '<option value="">Select Port</option>';
            ports.forEach(port => {
                const option = document.createElement('option');
                option.value = port.port;
                option.textContent = `${port.port} - ${port.description}`;
                this.elements.portSelect.appendChild(option);
            });
        }

        toggleDemoMode() {
            if (this.demoInterval) {
                this.stopDemoMode();
            } else {
                this.startDemoMode();
            }
        }

        startDemoMode() {
            this.stopDemoMode(); // Stop if already running
            
            this.elements.demoBtn.textContent = 'Stop Demo';
            this.elements.demoBtn.style.background = 'rgba(255, 71, 87, 0.3)';
            this.addLog('Demo mode started');
            
            // Generate realistic gyroscope data
            this.demoInterval = setInterval(() => {
                const timestamp = Date.now();
                const time = timestamp / 1000;
                
                const data = {
                    timestamp: timestamp,
                    accel: {
                        x: (Math.sin(time * 0.1) * 0.5 + Math.random() * 0.1 - 0.05).toFixed(3),
                        y: (Math.cos(time * 0.15) * 0.3 + Math.random() * 0.1 - 0.05).toFixed(3),
                        z: (1.0 + Math.sin(time * 0.05) * 0.1 + Math.random() * 0.05 - 0.025).toFixed(3)
                    },
                    gyro: {
                        x: (Math.sin(time * 0.3) * 20 + Math.random() * 5 - 2.5).toFixed(3),
                        y: (Math.cos(time * 0.25) * 15 + Math.random() * 3 - 1.5).toFixed(3),
                        z: (Math.sin(time * 0.2) * 10 + Math.random() * 2 - 1).toFixed(3)
                    },
                    attitude: {
                        roll: (Math.sin(time * 0.1) * 30).toFixed(2),
                        pitch: (Math.cos(time * 0.08) * 20).toFixed(2),
                        yaw: ((time * 5) % 360).toFixed(2)
                    },
                    temperature: (25 + Math.random() * 5).toFixed(2)
                };
                
                this.processData(data);
            }, 100);
        }

        stopDemoMode() {
            if (this.demoInterval) {
                clearInterval(this.demoInterval);
                this.demoInterval = null;
                this.elements.demoBtn.textContent = 'Demo Mode';
                this.elements.demoBtn.style.background = 'rgba(255, 255, 255, 0.1)';
                this.addLog('Demo mode stopped');
            }
        }

        updateConnectionStatus(connected, message) {
            if (connected) {
                this.elements.statusDot.classList.add('connected');
                this.elements.statusText.textContent = message || 'Connected';
            } else {
                this.elements.statusDot.classList.remove('connected');
                this.elements.statusText.textContent = message || 'Disconnected';
            }
        }

        processData(data) {
            // Handle different data formats
            let accel = data.accel || data.accelerometer || {};
            let gyro = data.gyro || data.gyroscope || {};
            let attitude = data.attitude || {};

            // Update live data display
            this.elements.accelX.textContent = accel.x || '0.00';
            this.elements.accelY.textContent = accel.y || '0.00';
            this.elements.accelZ.textContent = accel.z || '0.00';
            this.elements.gyroX.textContent = gyro.x || '0.00';
            this.elements.gyroY.textContent = gyro.y || '0.00';
            this.elements.gyroZ.textContent = gyro.z || '0.00';

            // Update attitude indicator
            if (attitude.roll !== undefined && attitude.pitch !== undefined) {
                const roll = parseFloat(attitude.roll);
                const pitch = parseFloat(attitude.pitch);
                const yaw = parseFloat(attitude.yaw || 0);
                
                this.elements.horizon.style.transform = `rotate(${roll}deg) translateY(${pitch * 2}px)`;
                this.elements.rollValue.textContent = `${roll}°`;
                this.elements.pitchValue.textContent = `${pitch}°`;
                
                // Update 3D cube orientation
                this.updateCubeOrientation(roll, pitch, yaw);
            }

            // Update chart
            this.updateChart(gyro);

            // Add to logs
            if (this.isLogging) {
                this.addToDataLogs(data);
            }
        }

        updateChart(gyro) {
            if (!gyro.x && !gyro.y && !gyro.z) return;
            
            const now = new Date().toLocaleTimeString();
            
            if (this.chart.data.labels.length >= this.maxDataPoints) {
                this.chart.data.labels.shift();
                this.chart.data.datasets.forEach(dataset => dataset.data.shift());
            }

            this.chart.data.labels.push(now);
            this.chart.data.datasets[0].data.push(parseFloat(gyro.x) || 0);
            this.chart.data.datasets[1].data.push(parseFloat(gyro.y) || 0);
            this.chart.data.datasets[2].data.push(parseFloat(gyro.z) || 0);
            
            this.chart.update('none');
        }

        toggleLogging() {
            this.isLogging = !this.isLogging;
            this.elements.logBtn.textContent = this.isLogging ? 'Stop Logging' : 'Start Logging';
            this.elements.logBtn.style.background = this.isLogging ? 'rgba(255, 71, 87, 0.3)' : 'rgba(255, 255, 255, 0.1)';
            if (this.isLogging) {
                this.addLog('Logging started');
            } else {
                this.addLog('Logging stopped');
            }
        }
        addToDataLogs(data) {
            const timestamp = new Date().toLocaleTimeString();
            const logEntry = {
                timestamp: timestamp,
                data: JSON.stringify(data, null, 2)
            };
            this.logData.push(logEntry);
            
            if (this.logData.length > 100) {
                this.logData.shift(); // Keep only the last 100 entries
            }
            
            this.updateDataLogs();
        }
        updateDataLogs() {
            this.elements.dataLogs.innerHTML = '';
            this.logData.forEach(entry => {
                const logDiv = document.createElement('div');
                logDiv.className = 'log-entry';
                logDiv.innerHTML = `<span class="log-timestamp">${entry.timestamp}</span>${entry.data}`;
                this.elements.dataLogs.appendChild(logDiv);
            });
        }
        clearData() {
            this.dataBuffer = [];
            this.logData = [];
            this.updateDataLogs();
            this.chart.data.labels = [];
            this.chart.data.datasets.forEach(dataset => dataset.data = []);
            this.chart.update();
            this.addLog('Data cleared');
        }
        addLog(message) {
            const logEntry = document.createElement('div');
            logEntry.className = 'log-entry';
            logEntry.textContent = message;
            this.elements.logContainer.appendChild(logEntry);
        }
        addLog(message, type = 'info') {
            const logEntry = document.createElement('div');
            logEntry.className = `log-entry ${type}`;
            logEntry.textContent = message;
            this.elements.dataLogs.appendChild(logEntry);
            this.elements.dataLogs.scrollTop = this.elements.dataLogs.scrollHeight; // Auto-scroll
        }
    }
    document.addEventListener('DOMContentLoaded', () => {
        const dashboard = new GyroscopeDashboard();
        
        // Initialize WebSocket connection if needed
        if (dashboard.websocket) {
            dashboard.connect();
        }
    });
