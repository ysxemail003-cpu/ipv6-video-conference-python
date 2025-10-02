import eventlet

eventlet.monkey_patch()

import os
import uuid
import socket
from datetime import datetime
from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_cors import CORS  # 新增导入

app = Flask(__name__)
app.config['SECRET_KEY'] = 'ipv6-secret-key-2023'

# 添加 CORS 支持
CORS(app, resources={
    r"/api/*": {
        "origins": ["*"],
        "methods": ["GET", "POST", "PUT", "DELETE"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# 存储房间和用户信息
rooms = {}
users = {}


def api_response(success=True, data=None, message="", error_code=0):
    """统一API响应格式"""
    response = {
        'success': success,
        'error_code': error_code,
        'message': message,
        'timestamp': datetime.now().isoformat(),
        'data': data or {}
    }
    return jsonify(response)


def api_error(message, error_code=400):
    """错误响应"""
    return api_response(False, None, message, error_code)


def get_ipv6_address():
    """获取IPv6地址，静默处理错误"""
    try:
        hostname = socket.gethostname()
        ipv6_addresses = []

        for addr_info in socket.getaddrinfo(hostname, None):
            family, type, proto, canonname, sockaddr = addr_info

            if family == socket.AF_INET6:
                ipv6_addr = sockaddr[0]
                ipv6_addresses.append(ipv6_addr)

        # 优先级：公网IPv6 > 本地链接 > 回环
        for addr in ipv6_addresses:
            if not addr.startswith('fe80:') and addr != '::1':
                return addr

        for addr in ipv6_addresses:
            if addr.startswith('fe80:'):
                return addr

        return "::1"

    except Exception:
        # 静默返回回环地址，不打印错误
        return "::1"


def is_ipv6_available():
    """检查IPv6连接性"""
    try:
        socket.getaddrinfo("ipv6.google.com", 80, socket.AF_INET6)
        return True
    except:
        return False


class RoomManager:
    @staticmethod
    def create_room(room_id, user_id, room_name=None):
        room = {
            'id': room_id,
            'name': room_name or f"IPv6视频会议房间 {room_id}",
            'creator': user_id,
            'created_at': datetime.now().isoformat(),
            'users': [user_id],
            'active': True,
            'ipv6_only': True,
            'sockets': []
        }
        rooms[room_id] = room
        return room

    @staticmethod
    def get_room(room_id):
        return rooms.get(room_id)

    @staticmethod
    def get_active_rooms():
        return [room for room in rooms.values() if room['active']]

    @staticmethod
    def join_room(room_id, user_id):
        room = rooms.get(room_id)
        if room and room['active']:
            if user_id not in room['users']:
                room['users'].append(user_id)
            return room
        return None

    @staticmethod
    def leave_room(room_id, user_id):
        room = rooms.get(room_id)
        if room and user_id in room['users']:
            room['users'].remove(user_id)
            if len(room['users']) == 0:
                room['active'] = False
            return True
        return False

    @staticmethod
    def delete_room(room_id):
        if room_id in rooms:
            del rooms[room_id]
            return True
        return False


class UserManager:
    @staticmethod
    def create_user(user_id=None):
        if not user_id:
            user_id = f"ipv6_user_{uuid.uuid4().hex[:8]}"

        user = {
            'id': user_id,
            'joined_at': datetime.now().isoformat(),
            'ipv6_support': True
        }
        users[user_id] = user
        return user

    @staticmethod
    def get_user(user_id):
        return users.get(user_id)


@app.route('/')
def index():
    server_ipv6 = get_ipv6_address()
    ipv6_available = is_ipv6_available()

    return render_template('index.html',
                           server_ipv6=server_ipv6,
                           ipv6_available=ipv6_available)


# ==================== 新增和改进的 API 接口 ====================

@app.route('/api/health', methods=['GET'])
def health_check():
    """健康检查接口"""
    health_data = {
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'active_connections': len(users),
        'active_rooms': len([r for r in rooms.values() if r['active']]),
        'ipv6_status': 'enabled'
    }

    return api_response(data=health_data)


@app.route('/api/status', methods=['GET'])
def server_status():
    """服务器状态信息"""
    active_rooms = RoomManager.get_active_rooms()

    status_data = {
        'server_version': '1.0.0',
        'ipv6_address': get_ipv6_address(),
        'active_rooms_count': len(active_rooms),
        'total_users_count': len(users),
        'supported_features': [
            'video_conference',
            'room_management',
            'real_time_communication',
            'ipv6_networking'
        ]
    }

    return api_response(data=status_data)


@app.route('/api/server_info')
def server_info():
    """返回服务器IPv6信息"""
    server_ipv6 = get_ipv6_address()
    ipv6_available = is_ipv6_available()

    server_data = {
        'ipv6_address': server_ipv6,
        'port': 5000,
        'ipv6_only': True,
        'ipv6_available': ipv6_available,
        'protocols': ['HTTP', 'WebSocket', 'Socket.IO'],
        'features': ['video_chat', 'room_management', 'real_time_messaging']
    }

    return api_response(data=server_data)


@app.route('/api/rooms', methods=['GET'])
def get_rooms():
    """获取所有活跃房间"""
    active_rooms = RoomManager.get_active_rooms()

    # 格式化房间信息，移除内部字段
    formatted_rooms = []
    for room in active_rooms:
        formatted_room = {
            'id': room['id'],
            'name': room['name'],
            'creator': room['creator'],
            'created_at': room['created_at'],
            'user_count': len(room['users']),
            'active': room['active'],
            'ipv6_only': room['ipv6_only']
        }
        formatted_rooms.append(formatted_room)

    return api_response(data={
        'rooms': formatted_rooms,
        'total_count': len(formatted_rooms)
    })


@app.route('/api/rooms', methods=['POST'])
def create_room():
    """创建新房间"""
    data = request.get_json()

    if not data:
        return api_error('请求体必须为JSON格式')

    room_id = data.get('room_id') or f"ipv6_room_{uuid.uuid4().hex[:8]}"
    user_id = data.get('user_id')
    room_name = data.get('room_name')

    if not user_id:
        return api_error('用户ID不能为空')

    # 创建用户（如果不存在）
    if not UserManager.get_user(user_id):
        UserManager.create_user(user_id)

    # 创建房间
    room = RoomManager.create_room(room_id, user_id, room_name)

    # 格式化返回的房间信息
    formatted_room = {
        'id': room['id'],
        'name': room['name'],
        'creator': room['creator'],
        'created_at': room['created_at'],
        'user_count': len(room['users']),
        'active': room['active'],
        'ipv6_only': room['ipv6_only']
    }

    return api_response(data={'room': formatted_room}, message="房间创建成功")


@app.route('/api/rooms/<room_id>/join', methods=['POST'])
def join_room_api(room_id):
    """加入指定房间"""
    data = request.get_json()

    if not data:
        return api_error('请求体必须为JSON格式')

    user_id = data.get('user_id')

    if not user_id:
        return api_error('用户ID不能为空')

    # 检查房间是否存在
    room = RoomManager.get_room(room_id)
    if not room:
        return api_error('房间不存在', 404)

    # 创建用户（如果不存在）
    if not UserManager.get_user(user_id):
        UserManager.create_user(user_id)

    # 加入房间
    room = RoomManager.join_room(room_id, user_id)

    if room:
        formatted_room = {
            'id': room['id'],
            'name': room['name'],
            'creator': room['creator'],
            'created_at': room['created_at'],
            'user_count': len(room['users']),
            'active': room['active'],
            'ipv6_only': room['ipv6_only']
        }
        return api_response(data={'room': formatted_room}, message="加入房间成功")
    else:
        return api_error('房间不存在或已关闭', 404)


@app.route('/api/rooms/<room_id>', methods=['GET'])
def get_room_info(room_id):
    """获取指定房间信息"""
    room = RoomManager.get_room(room_id)

    if not room:
        return api_error('房间不存在', 404)

    formatted_room = {
        'id': room['id'],
        'name': room['name'],
        'creator': room['creator'],
        'created_at': room['created_at'],
        'user_count': len(room['users']),
        'active': room['active'],
        'ipv6_only': room['ipv6_only']
    }

    return api_response(data={'room': formatted_room})


@app.route('/api/rooms/<room_id>/users', methods=['GET'])
def get_room_users(room_id):
    """获取房间内的用户列表"""
    room = RoomManager.get_room(room_id)

    if not room:
        return api_error('房间不存在', 404)

    users_info = []
    for user_id in room['users']:
        user = UserManager.get_user(user_id)
        if user:
            users_info.append({
                'id': user['id'],
                'joined_at': user['joined_at'],
                'ipv6_support': user['ipv6_support']
            })

    return api_response(data={
        'room_id': room_id,
        'users': users_info,
        'user_count': len(users_info)
    })


@app.route('/api/users/<user_id>', methods=['GET'])
def get_user_info(user_id):
    """获取用户信息"""
    user = UserManager.get_user(user_id)

    if not user:
        return api_error('用户不存在', 404)

    return api_response(data={'user': user})


# ==================== 错误处理 ====================

@app.errorhandler(404)
def not_found(error):
    return api_error('接口不存在', 404)


@app.errorhandler(500)
def internal_error(error):
    return api_error('服务器内部错误', 500)


@app.errorhandler(405)
def method_not_allowed(error):
    return api_error('请求方法不允许', 405)


# ==================== Socket.IO 事件处理 ====================

@socketio.on('connect')
def handle_connect():
    print(f"✅ IPv6客户端连接: {request.sid}")
    server_ipv6 = get_ipv6_address()

    emit('connected', {
        'message': 'IPv6连接成功',
        'ipv6_support': True,
        'server_ipv6': server_ipv6,
        'sid': request.sid
    })


@socketio.on('disconnect')
def handle_disconnect():
    print(f"❌ IPv6客户端断开: {request.sid}")
    for room_id, room in rooms.items():
        if 'sockets' in room and request.sid in room['sockets']:
            room['sockets'].remove(request.sid)
            if len(room['sockets']) == 0 and len(room['users']) == 0:
                room['active'] = False


@socketio.on('join_room')
def handle_join_room(data):
    room_id = data.get('room_id')
    user_id = data.get('user_id')

    if room_id and user_id:
        join_room(room_id)

        if room_id not in rooms:
            RoomManager.create_room(room_id, user_id)

        if 'sockets' not in rooms[room_id]:
            rooms[room_id]['sockets'] = []

        if request.sid not in rooms[room_id]['sockets']:
            rooms[room_id]['sockets'].append(request.sid)

        if user_id not in rooms[room_id]['users']:
            rooms[room_id]['users'].append(user_id)

        server_ipv6 = get_ipv6_address()

        emit('user_joined', {
            'user_id': user_id,
            'room_id': room_id,
            'message': f'用户 {user_id} 通过IPv6加入了房间',
            'ipv6_support': True,
            'server_ipv6': server_ipv6,
            'sid': request.sid
        }, room=room_id)

        print(f"👥 IPv6用户 {user_id} 加入房间 {room_id}")


@socketio.on('leave_room')
def handle_leave_room(data):
    room_id = data.get('room_id')
    user_id = data.get('user_id')

    if room_id:
        leave_room(room_id)

        if room_id in rooms and 'sockets' in rooms[room_id]:
            if request.sid in rooms[room_id]['sockets']:
                rooms[room_id]['sockets'].remove(request.sid)

        if room_id in rooms and user_id in rooms[room_id]['users']:
            rooms[room_id]['users'].remove(user_id)

        emit('user_left', {
            'user_id': user_id,
            'room_id': room_id,
            'message': f'用户 {user_id} 离开了IPv6房间',
            'sid': request.sid
        }, room=room_id)

        print(f"🚪 IPv6用户 {user_id} 离开房间 {room_id}")


@socketio.on('webrtc_offer')
def handle_webrtc_offer(data):
    data['ipv6_support'] = True
    emit('webrtc_offer', data, room=data['room_id'], include_self=False)


@socketio.on('webrtc_answer')
def handle_webrtc_answer(data):
    data['ipv6_support'] = True
    emit('webrtc_answer', data, room=data['room_id'], include_self=False)


@socketio.on('ice_candidate')
def handle_ice_candidate(data):
    data['ipv6_support'] = True
    emit('ice_candidate', data, room=data['room_id'], include_self=False)


if __name__ == '__main__':
    server_ipv6 = get_ipv6_address()
    ipv6_available = is_ipv6_available()

    print("=" * 60)
    print("🚀 纯IPv6视频会议服务器 - API版本")
    print("=" * 60)

    if server_ipv6 != "::1":
        print(f"✅ 公网IPv6地址: [{server_ipv6}]")
    else:
        print(f"🔶 使用IPv6本地回环地址")

    print(f"📍 访问地址: http://[{server_ipv6}]:5000")
    print(f"📍 本地访问: http://localhost:5000")
    print("\n📋 可用API接口:")
    print("  GET  /api/health         - 健康检查")
    print("  GET  /api/status         - 服务器状态")
    print("  GET  /api/server_info    - 服务器信息")
    print("  GET  /api/rooms          - 获取房间列表")
    print("  POST /api/rooms          - 创建房间")
    print("  GET  /api/rooms/<id>     - 获取房间信息")
    print("  POST /api/rooms/<id>/join - 加入房间")
    print("  GET  /api/rooms/<id>/users - 获取房间用户")
    print("  GET  /api/users/<id>     - 获取用户信息")
    print("=" * 60)

    # 纯IPv6服务器
    socketio.run(app,
                 host='::',  # 只监听IPv6
                 port=5000,
                 debug=True,
                 use_reloader=False)