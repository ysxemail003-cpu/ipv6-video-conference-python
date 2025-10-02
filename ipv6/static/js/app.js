// IPv6视频会议应用主逻辑
class IPv6VideoConferenceApp {
    constructor() {
        this.socket = null;
        this.userId = this.generateUserId();
        this.currentRoomId = null;
        this.localStream = null;
        this.peerConnections = {};
        this.remoteStreams = {};
        this.serverIPv6 = '';

        this.init();
    }

    async init() {
        console.log('初始化IPv6视频会议应用...');

        try {
            // 获取服务器IPv6信息
            await this.fetchServerInfo();

            // 连接Socket.IO服务器
            this.connectSocket();

            // 更新UI
            this.updateUI();

            // 设置事件监听
            this.setupEventListeners();

            // 测试IPv6连接
            this.testIPv6Connection();

        } catch (error) {
            console.error('初始化失败:', error);
            this.showError('初始化失败: ' + error.message);
        }
    }

    async fetchServerInfo() {
        try {
            const response = await fetch('/api/server_info');
            const data = await response.json();

            if (data.success) {
                this.serverIPv6 = data.ipv6_address;
                console.log('服务器IPv6地址:', this.serverIPv6);
            }
        } catch (error) {
            console.error('获取服务器信息失败:', error);
        }
    }

    connectSocket() {
        // 连接到Socket.IO服务器
        // 注意：这里使用相对路径，浏览器会自动使用当前页面的协议和主机
        this.socket = io({
            transports: ['websocket', 'polling'],
            forceNew: true
        });

        this.socket.on('connect', () => {
            console.log('已通过IPv6连接到服务器');
            this.updateConnectionStatus('connected', 'IPv6连接已建立');
        });

        this.socket.on('disconnect', () => {
            console.log('与IPv6服务器断开连接');
            this.updateConnectionStatus('disconnected', 'IPv6连接已断开');
        });

        this.socket.on('user_joined', (data) => {
            console.log('IPv6用户加入:', data);
            this.handleUserJoined(data.user_id);
        });

        this.socket.on('user_left', (data) => {
            console.log('IPv6用户离开:', data);
            this.handleUserLeft(data.user_id);
        });

        // WebRTC信令事件
        this.socket.on('webrtc_offer', (data) => {
            this.handleWebRTCOffer(data);
        });

        this.socket.on('webrtc_answer', (data) => {
            this.handleWebRTCAnswer(data);
        });

        this.socket.on('ice_candidate', (data) => {
            this.handleICECandidate(data);
        });
    }

    updateUI() {
        console.log('更新UI');

        // 更新服务器IPv6地址显示
        const serverDisplay = document.getElementById('serverIPv6Address');
        if (serverDisplay) {
            serverDisplay.textContent = this.serverIPv6 || '正在获取...';
        }

        // 更新用户ID
        const userIdElement = document.getElementById('userId');
        if (userIdElement) {
            userIdElement.textContent = this.userId;
        }

        // 更新本地用户名
        const localUserName = document.getElementById('localUserName');
        if (localUserName) {
            localUserName.textContent = this.userId;
        }

        // 更新状态
        this.updateConnectionStatus('connecting', '正在建立IPv6连接...');

        // 检测WebRTC支持
        this.detectWebRTCSupport();
    }

    detectWebRTCSupport() {
        const webrtcStatus = document.getElementById('webrtcStatus');
        if (!webrtcStatus) return;

        if (window.RTCPeerConnection) {
            webrtcStatus.textContent = '支持';
            webrtcStatus.className = 'status-connected';
        } else {
            webrtcStatus.textContent = '不支持';
            webrtcStatus.className = 'status-error';
        }
    }

    updateConnectionStatus(status, message = '') {
        console.log('更新连接状态:', status, message);

        const statusElement = document.getElementById('connectionStatus');
        const statusTextElement = document.getElementById('connectionStatusText');

        if (statusElement) {
            const statusText = {
                'disconnected': '未连接',
                'connected': '已连接',
                'connecting': '连接中',
                'error': '连接错误',
                'testing': '测试中...'
            }[status] || '未知状态';

            statusElement.textContent = statusText;
            statusElement.className = `status-${status}`;
        }

        if (statusTextElement) {
            statusTextElement.textContent = message || this.getStatusMessage(status);
        }
    }

    getStatusMessage(status) {
        const messages = {
            'disconnected': '请检查IPv6网络连接',
            'connected': 'IPv6连接正常',
            'connecting': '正在建立IPv6连接...',
            'error': 'IPv6连接出现问题',
            'testing': '正在测试IPv6连接...'
        };
        return messages[status] || '';
    }

    setupEventListeners() {
        console.log('设置事件监听器');

        // IPv6测试按钮
        const testIPv6Button = document.getElementById('testIPv6');
        if (testIPv6Button) {
            testIPv6Button.addEventListener('click', () => {
                this.testIPv6Connection();
            });
        }

        // 加入房间按钮
        const joinButton = document.getElementById('joinRoom');
        if (joinButton) {
            joinButton.addEventListener('click', () => {
                this.joinRoom();
            });
        }

        // 创建房间按钮
        const createButton = document.getElementById('createRoom');
        if (createButton) {
            createButton.addEventListener('click', () => {
                this.createRoom();
            });
        }

        // 发现房间按钮
        const discoverButton = document.getElementById('discoverRooms');
        if (discoverButton) {
            discoverButton.addEventListener('click', () => {
                this.discoverRooms();
            });
        }

        // 回车键加入房间
        const roomInput = document.getElementById('roomIdInput');
        if (roomInput) {
            roomInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.joinRoom();
                }
            });
        }

        // 会议页面事件监听
        this.setupConferenceListeners();
    }

    setupConferenceListeners() {
        // 离开会议按钮
        const leaveConferenceBtn = document.getElementById('leaveConference');
        if (leaveConferenceBtn) {
            leaveConferenceBtn.addEventListener('click', () => {
                this.leaveConference();
            });
        }

        // 离开房间按钮
        const leaveRoomBtn = document.getElementById('leaveRoom');
        if (leaveRoomBtn) {
            leaveRoomBtn.addEventListener('click', () => {
                this.leaveConference();
            });
        }

        // 显示参与者侧边栏
        const showParticipantsBtn = document.getElementById('showParticipants');
        const closeParticipantsBtn = document.getElementById('closeParticipants');
        const participantsSidebar = document.getElementById('participantsSidebar');

        if (showParticipantsBtn && participantsSidebar) {
            showParticipantsBtn.addEventListener('click', () => {
                participantsSidebar.classList.add('active');
            });
        }

        if (closeParticipantsBtn && participantsSidebar) {
            closeParticipantsBtn.addEventListener('click', () => {
                participantsSidebar.classList.remove('active');
            });
        }

        // 显示网络信息侧边栏
        const showNetworkBtn = document.getElementById('showNetworkInfo');
        const closeNetworkBtn = document.getElementById('closeNetwork');
        const networkSidebar = document.getElementById('networkSidebar');

        if (showNetworkBtn && networkSidebar) {
            showNetworkBtn.addEventListener('click', () => {
                networkSidebar.classList.add('active');
            });
        }

        if (closeNetworkBtn && networkSidebar) {
            closeNetworkBtn.addEventListener('click', () => {
                networkSidebar.classList.remove('active');
            });
        }

        // 控制按钮事件
        const toggleVideoBtn = document.getElementById('toggleVideo');
        if (toggleVideoBtn) {
            toggleVideoBtn.addEventListener('click', () => {
                toggleVideoBtn.classList.toggle('active');
                this.toggleVideo();
            });
        }

        const toggleAudioBtn = document.getElementById('toggleAudio');
        if (toggleAudioBtn) {
            toggleAudioBtn.addEventListener('click', () => {
                toggleAudioBtn.classList.toggle('active');
                this.toggleAudio();
            });
        }

        const shareScreenBtn = document.getElementById('shareScreen');
        if (shareScreenBtn) {
            shareScreenBtn.addEventListener('click', () => {
                this.shareScreen();
            });
        }
    }

    generateUserId() {
        // 尝试从本地存储加载
        const saved = localStorage.getItem('ipv6-user-id');
        if (saved) {
            console.log('使用保存的用户ID:', saved);
            return saved;
        }

        // 生成新用户ID
        const prefix = 'ipv6_user_';
        const randomPart = Math.random().toString(36).substring(2, 10);
        const timestamp = Date.now().toString(36);
        const newId = `${prefix}${randomPart}_${timestamp}`;

        // 保存到本地存储
        localStorage.setItem('ipv6-user-id', newId);
        console.log('生成新IPv6用户ID:', newId);

        return newId;
    }

    async testIPv6Connection() {
        console.log('测试IPv6连接...');
        this.updateConnectionStatus('testing', '正在测试IPv6连接...');

        const testResult = document.getElementById('ipv6TestResult');
        if (testResult) {
            testResult.textContent = '正在测试IPv6连接...';
            testResult.className = 'ipv6-test-result';
        }

        try {
            // 测试IPv6连接
            const response = await fetch('/api/server_info');
            if (response.ok) {
                const data = await response.json();

                if (testResult) {
                    testResult.textContent = `✅ IPv6连接成功! 服务器: ${data.ipv6_address}`;
                    testResult.className = 'ipv6-test-result success';
                }

                this.updateConnectionStatus('connected', 'IPv6连接测试成功');
            } else {
                throw new Error('服务器响应错误');
            }
        } catch (error) {
            console.error('IPv6连接测试失败:', error);

            if (testResult) {
                testResult.textContent = '❌ IPv6连接失败。请确保您的网络支持IPv6';
                testResult.className = 'ipv6-test-result error';
            }

            this.updateConnectionStatus('error', 'IPv6连接测试失败');
        }
    }

    joinRoom() {
        const roomInput = document.getElementById('roomIdInput');
        const roomId = roomInput ? roomInput.value.trim() : '';
        const finalRoomId = roomId || this.generateRoomId();

        console.log(`加入IPv6房间: ${finalRoomId}`);

        // 设置当前房间ID
        this.currentRoomId = finalRoomId;

        // 通过API加入房间
        fetch('/api/rooms/' + finalRoomId + '/join', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_id: this.userId
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // 通过Socket.IO加入房间
                this.socket.emit('join_room', {
                    room_id: finalRoomId,
                    user_id: this.userId
                });

                // 切换到会议页面
                this.switchToConferencePage();

                // 更新会议页面信息
                this.updateConferenceInfo();

                // 尝试获取本地视频流
                this.initLocalVideo();
            } else {
                this.showError('加入IPv6房间失败: ' + data.error);
            }
        })
        .catch(error => {
            console.error('加入IPv6房间错误:', error);
            this.showError('加入IPv6房间时发生错误');
        });
    }

    createRoom() {
        const roomId = this.generateRoomId();
        const roomInput = document.getElementById('roomIdInput');
        if (roomInput) {
            roomInput.value = roomId;
        }
        console.log(`创建IPv6房间: ${roomId}`);

        // 通过API创建房间
        fetch('/api/rooms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                room_id: roomId,
                user_id: this.userId
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // 显示创建成功消息
                this.showRoomCreationMessage(roomId);

                // 设置当前房间ID
                this.currentRoomId = roomId;

                // 通过Socket.IO加入房间
                this.socket.emit('join_room', {
                    room_id: roomId,
                    user_id: this.userId
                });

                // 延迟跳转，让用户看到创建成功的消息
                setTimeout(() => {
                    // 切换到会议页面
                    this.switchToConferencePage();

                    // 更新会议页面信息
                    this.updateConferenceInfo();

                    // 尝试获取本地视频流
                    this.initLocalVideo();
                }, 1500);
            } else {
                this.showError('创建IPv6房间失败: ' + data.error);
            }
        })
        .catch(error => {
            console.error('创建IPv6房间错误:', error);
            this.showError('创建IPv6房间时发生错误');
        });
    }

    showRoomCreationMessage(roomId) {
        const messageElement = document.getElementById('roomCreationMessage');
        const roomIdElement = document.getElementById('createdRoomId');

        if (messageElement && roomIdElement) {
            roomIdElement.textContent = roomId;
            messageElement.classList.add('show');
        }
    }

    switchToConferencePage() {
        // 隐藏配置页面
        const configPage = document.getElementById('config-page');
        if (configPage) {
            configPage.classList.remove('active');
        }

        // 显示会议页面
        const conferencePage = document.getElementById('conference-page');
        if (conferencePage) {
            conferencePage.classList.add('active');
        }
    }

    switchToConfigPage() {
        // 离开当前房间
        if (this.currentRoomId) {
            this.socket.emit('leave_room', {
                room_id: this.currentRoomId,
                user_id: this.userId
            });

            // 通过API离开房间
            fetch('/api/rooms/' + this.currentRoomId + '/join', {
                method: 'DELETE'
            });
        }

        // 隐藏会议页面
        const conferencePage = document.getElementById('conference-page');
        if (conferencePage) {
            conferencePage.classList.remove('active');
        }

        // 显示配置页面
        const configPage = document.getElementById('config-page');
        if (configPage) {
            configPage.classList.add('active');
        }

        // 隐藏房间创建消息
        const messageElement = document.getElementById('roomCreationMessage');
        if (messageElement) {
            messageElement.classList.remove('show');
        }

        // 停止所有媒体流
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        // 关闭所有Peer连接
        Object.values(this.peerConnections).forEach(pc => pc.close());
        this.peerConnections = {};

        // 重置房间ID
        this.currentRoomId = null;
    }

    updateConferenceInfo() {
        // 更新房间ID显示
        const currentRoomIdElement = document.getElementById('currentRoomId');
        if (currentRoomIdElement && this.currentRoomId) {
            currentRoomIdElement.textContent = this.currentRoomId;
        }
    }

    async initLocalVideo() {
        try {
            const localVideo = document.getElementById('localVideo');
            if (!localVideo) return;

            // 尝试获取摄像头和麦克风
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });

            localVideo.srcObject = this.localStream;

            console.log('IPv6本地视频流已获取');
        } catch (error) {
            console.error('无法获取媒体设备:', error);
            this.showError('无法访问摄像头或麦克风: ' + error.message);
        }
    }

    toggleVideo() {
        if (!this.localStream) return;

        const videoTracks = this.localStream.getVideoTracks();
        if (videoTracks.length > 0) {
            const isEnabled = !videoTracks[0].enabled;
            videoTracks[0].enabled = isEnabled;

            console.log(`IPv6视频已${isEnabled ? '开启' : '关闭'}`);
        }
    }

    toggleAudio() {
        if (!this.localStream) return;

        const audioTracks = this.localStream.getAudioTracks();
        if (audioTracks.length > 0) {
            const isEnabled = !audioTracks[0].enabled;
            audioTracks[0].enabled = isEnabled;

            console.log(`IPv6音频已${isEnabled ? '开启' : '关闭'}`);
        }
    }

    async shareScreen() {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true
            });

            const localVideo = document.getElementById('localVideo');
            if (localVideo) {
                // 停止之前的流
                if (this.localStream) {
                    this.localStream.getTracks().forEach(track => track.stop());
                }

                this.localStream = stream;
                localVideo.srcObject = stream;
            }

            console.log('IPv6屏幕共享已开始');
        } catch (error) {
            console.error('IPv6屏幕共享失败:', error);
            this.showError('屏幕共享失败: ' + error.message);
        }
    }

    leaveConference() {
        // 切换回配置页面
        this.switchToConfigPage();

        console.log('已离开IPv6会议');
    }

    discoverRooms() {
        console.log('发现IPv6房间');

        // 获取房间列表容器
        const roomList = document.getElementById('roomList');
        const roomListContent = document.getElementById('roomListContent');

        if (!roomList || !roomListContent) return;

        // 显示房间列表
        roomList.style.display = 'block';

        // 通过API获取房间列表
        fetch('/api/rooms')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const rooms = data.rooms;

                if (rooms.length === 0) {
                    roomListContent.innerHTML = `
                        <div class="empty-rooms">
                            <p>当前没有可用的IPv6房间</p>
                            <p style="font-size: 0.9rem; margin-top: 0.5rem;">您可以创建一个新的IPv6房间开始会议</p>
                        </div>
                    `;
                } else {
                    roomListContent.innerHTML = rooms.map(room => `
                        <div class="room-item">
                            <div class="room-info">
                                <div class="room-name">${room.name}</div>
                                <div class="room-details">
                                    创建者: ${room.creator} • ${room.users.length} 人在线 • IPv6
                                </div>
                            </div>
                            <div class="room-actions">
                                <button class="btn-primary btn-small" onclick="app.joinRoomById('${room.id}')">加入</button>
                            </div>
                        </div>
                    `).join('');
                }
            } else {
                this.showError('获取IPv6房间列表失败');
            }
        })
        .catch(error => {
            console.error('获取IPv6房间列表错误:', error);
            this.showError('获取IPv6房间列表时发生错误');
        });
    }

    joinRoomById(roomId) {
        const roomInput = document.getElementById('roomIdInput');
        if (roomInput) {
            roomInput.value = roomId;
        }
        this.joinRoom();
    }

    generateRoomId() {
        const prefix = 'ipv6_room_';
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 6);
        return `${prefix}${timestamp}_${random}`;
    }

    // WebRTC相关方法
    handleUserJoined(userId) {
        console.log('处理IPv6用户加入:', userId);

        // 创建与远程用户的PeerConnection
        this.createPeerConnection(userId);

        // 更新参与者列表
        this.updateParticipantsList();
    }

    handleUserLeft(userId) {
        console.log('处理IPv6用户离开:', userId);

        // 关闭PeerConnection
        if (this.peerConnections[userId]) {
            this.peerConnections[userId].close();
            delete this.peerConnections[userId];
        }

        // 移除远程视频
        this.removeRemoteVideo(userId);

        // 更新参与者列表
        this.updateParticipantsList();
    }

    createPeerConnection(userId) {
        // 使用IPv6优先的ICE服务器配置
        const configuration = {
            iceServers: [
                {
                    urls: [
                        'stun:[2001:4860:4860::8888]:19302', // Google IPv6 STUN
                        'stun:[2600:9000::]:19302'           // 备用IPv6 STUN
                    ]
                }
            ],
            iceTransportPolicy: 'all' // 允许IPv4和IPv6，但优先IPv6
        };

        const peerConnection = new RTCPeerConnection(configuration);

        // 添加本地流到连接
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, this.localStream);
            });
        }

        // 处理远程流
        peerConnection.ontrack = (event) => {
            console.log('通过IPv6收到远程流:', userId);
            const remoteStream = event.streams[0];
            this.remoteStreams[userId] = remoteStream;
            this.addRemoteVideo(userId, remoteStream);
        };

        // 处理ICE候选
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                // 记录候选类型
                console.log('ICE候选:', event.candidate);

                this.socket.emit('ice_candidate', {
                    room_id: this.currentRoomId,
                    target_user_id: userId,
                    candidate: event.candidate
                });
            }
        };

        // 监控ICE连接状态
        peerConnection.oniceconnectionstatechange = () => {
            console.log(`ICE连接状态 (${userId}):`, peerConnection.iceConnectionState);
            this.updateNetworkStats('iceConnectionStatus', peerConnection.iceConnectionState);
        };

        peerConnection.onconnectionstatechange = () => {
            console.log(`连接状态 (${userId}):`, peerConnection.connectionState);
            this.updateNetworkStats('webrtcConnectionStatus', peerConnection.connectionState);
        };

        this.peerConnections[userId] = peerConnection;

        // 创建并发送offer
        this.createOffer(userId);
    }

    async createOffer(userId) {
        try {
            const offer = await this.peerConnections[userId].createOffer();
            await this.peerConnections[userId].setLocalDescription(offer);

            this.socket.emit('webrtc_offer', {
                room_id: this.currentRoomId,
                target_user_id: userId,
                offer: offer
            });
        } catch (error) {
            console.error('创建IPv6 offer失败:', error);
        }
    }

    async handleWebRTCOffer(data) {
        const userId = data.user_id;

        if (!this.peerConnections[userId]) {
            this.createPeerConnection(userId);
        }

        try {
            await this.peerConnections[userId].setRemoteDescription(data.offer);
            const answer = await this.peerConnections[userId].createAnswer();
            await this.peerConnections[userId].setLocalDescription(answer);

            this.socket.emit('webrtc_answer', {
                room_id: this.currentRoomId,
                target_user_id: userId,
                answer: answer
            });
        } catch (error) {
            console.error('处理IPv6 offer失败:', error);
        }
    }

    async handleWebRTCAnswer(data) {
        const userId = data.user_id;

        if (this.peerConnections[userId]) {
            try {
                await this.peerConnections[userId].setRemoteDescription(data.answer);
            } catch (error) {
                console.error('处理IPv6 answer失败:', error);
            }
        }
    }

    async handleICECandidate(data) {
        const userId = data.user_id;

        if (this.peerConnections[userId]) {
            try {
                await this.peerConnections[userId].addIceCandidate(data.candidate);
            } catch (error) {
                console.error('处理IPv6 ICE候选失败:', error);
            }
        }
    }

    addRemoteVideo(userId, stream) {
        const remoteVideosContainer = document.getElementById('remoteVideosContainer');

        // 移除空状态
        const emptyState = remoteVideosContainer.querySelector('.empty-state');
        if (emptyState) {
            emptyState.remove();
        }

        // 创建远程视频元素
        const remoteVideo = document.createElement('div');
        remoteVideo.className = 'remote-video';
        remoteVideo.id = `remote-video-${userId}`;

        remoteVideo.innerHTML = `
            <div class="video-header">
                <div class="video-title">${userId} (IPv6)</div>
                <div class="video-status">
                    <span class="status-icon">📹</span>
                    <span class="status-icon">🔊</span>
                    <span class="status-icon">🌐</span>
                </div>
            </div>
            <video autoplay></video>
            <div class="video-overlay">
                <div class="user-name">${userId}</div>
            </div>
        `;

        const videoElement = remoteVideo.querySelector('video');
        videoElement.srcObject = stream;

        remoteVideosContainer.appendChild(remoteVideo);
    }

    removeRemoteVideo(userId) {
        const remoteVideo = document.getElementById(`remote-video-${userId}`);
        if (remoteVideo) {
            remoteVideo.remove();
        }

        // 如果没有远程视频了，显示空状态
        const remoteVideosContainer = document.getElementById('remoteVideosContainer');
        if (remoteVideosContainer.children.length === 0) {
            remoteVideosContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">👥</div>
                    <h3>等待其他IPv6用户加入</h3>
                    <p>邀请其他人通过IPv6加入此房间开始视频会议</p>
                </div>
            `;
        }
    }

    updateParticipantsList() {
        const participantsList = document.getElementById('participantsList');
        if (!participantsList) return;

        // 清空列表
        participantsList.innerHTML = '';

        // 添加本地用户
        const localUserItem = document.createElement('li');
        localUserItem.className = 'participant-item';
        localUserItem.innerHTML = `
            <div class="participant-avatar">您</div>
            <div class="participant-name">您 (本地)</div>
            <div class="participant-status">
                <span>📹</span>
                <span>🔊</span>
                <span>🌐</span>
            </div>
        `;
        participantsList.appendChild(localUserItem);

        // 添加远程用户
        Object.keys(this.peerConnections).forEach(userId => {
            const remoteUserItem = document.createElement('li');
            remoteUserItem.className = 'participant-item';
            remoteUserItem.innerHTML = `
                <div class="participant-avatar">${userId.charAt(0).toUpperCase()}</div>
                <div class="participant-name">${userId} (IPv6)</div>
                <div class="participant-status">
                    <span>📹</span>
                    <span>🔊</span>
                    <span>🌐</span>
                </div>
            `;
            participantsList.appendChild(remoteUserItem);
        });
    }

    updateNetworkStats(statId, value) {
        const statElement = document.getElementById(statId);
        if (statElement) {
            statElement.textContent = value;

            // 根据状态设置颜色
            if (value === 'connected' || value === 'completed') {
                statElement.style.background = 'var(--ipv6-green)';
            } else if (value === 'failed' || value === 'disconnected') {
                statElement.style.background = '#dc3545';
            } else {
                statElement.style.background = 'var(--ipv6-blue)';
            }
        }
    }

    showError(message) {
        console.error('IPv6应用错误:', message);
        alert('IPv6错误: ' + message);
    }
}

// 启动应用
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM加载完成，启动IPv6应用...');
    window.app = new IPv6VideoConferenceApp();
    console.log('IPv6应用启动完成');
});