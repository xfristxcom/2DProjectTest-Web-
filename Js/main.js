const SUPABASE_URL = 'https://pvnrztgtnsmyhixkawgo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2bnJ6dGd0bnNteWhpeGthd2dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMDI0MjMsImV4cCI6MjA5NTc3ODQyM30.clc8OgLUlJ9nM7BKxf6oXIA8B6sWRotO1VId446FNnY';

let currentUser = null; // 👈 เพิ่มบรรทัดนี้ลงไป เพื่อเอาไว้จำว่าใครล็อกอินอยู่

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const avatarMap = {
    'robot_default': '🤖',
    'robot_worker': '🔧',
    'robot_combat': '⚔️',
    'robot_ancient': '🗿',
    'robot_medic': '💉',
    'robot_scout': '👁️',
    'robot_heavy': '🛡️',
    'robot_alien': '👾' 
};

// ==========================================
// ฟังก์ชันป้องกัน XSS
// ==========================================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
}

function showAlert(title, message) {
    document.getElementById('alertTitle').innerText = title;
    document.getElementById('alertMessage').innerText = message;
    document.getElementById('customAlert').style.display = 'flex';
}

function closeAlert() {
    document.getElementById('customAlert').style.display = 'none';
}

async function checkUser() {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    
    const profileBtn = document.getElementById('mainProfileBtn');
    const dropdownMenu = document.getElementById('dropdownMenu');
    const userAvatar = document.getElementById('userAvatar'); 
    const notiDropdown = document.querySelector('.noti-dropdown'); // เพิ่มตัวแปรดึงกล่องกระดิ่ง

    if (session) {
        const userData = session.user.user_metadata;
        const displayName = userData.display_name || 'Player';
        const avatarId = userData.avatar_id || 'robot_default';
        currentUser = session.user;
        profileBtn.innerText = displayName; 
        dropdownMenu.style.display = ''; 
        profileBtn.onclick = null; 
        
        userAvatar.innerText = avatarMap[avatarId] || '🤖';
        userAvatar.style.display = 'flex';
        userAvatar.style.justifyContent = 'center';
        userAvatar.style.alignItems = 'center';
        userAvatar.style.fontSize = '22px'; 

        loadNotifications(); // 👈 2. เพิ่มบรรทัดนี้: สั่งให้โหลดแจ้งเตือนตอนเข้าเว็บ

        if (notiDropdown) notiDropdown.style.display = 'inline-block'; // โชว์กระดิ่งเมื่อล็อกอิน

    } else {
        profileBtn.innerText = 'Login'; 
        dropdownMenu.style.display = 'none'; 
        userAvatar.style.display = 'none'; 
        
        if (notiDropdown) notiDropdown.style.display = 'none'; // ซ่อนกระดิ่งเมื่อยังไม่ล็อกอิน
        
        profileBtn.onclick = () => {
            window.location.href = 'login.html';
        };
    }
}

async function logoutUser() {
    await supabaseClient.auth.signOut();
    showAlert("สำเร็จ!", "ออกจากระบบเรียบร้อยแล้ว");
    setTimeout(() => {
        window.location.reload(); 
    }, 1500);
}

// ==========================================
// ระบบแจ้งเตือน (Notifications)
// ==========================================

async function loadNotifications() {
    if (!currentUser) return;

    const { data: notis, error } = await supabaseClient
        .from('notifications')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) return;

    const notiList = document.getElementById('notiList');
    const notiCount = document.getElementById('notiCount');

    if (notis.length === 0) {
        notiList.innerHTML = '<div style="padding: 15px; text-align: center; color: #888; font-size: 14px;">ไม่มีการแจ้งเตือนใหม่</div>';
        notiCount.style.display = 'none';
        return;
    }

    const unreadCount = notis.filter(n => !n.is_read).length;
    if (unreadCount > 0) {
        notiCount.innerText = unreadCount;
        notiCount.style.display = 'inline-block';
    } else {
        notiCount.style.display = 'none';
    }

    notiList.innerHTML = '';
    notis.forEach(noti => {
        const avatar = avatarMap[noti.actor_avatar] || '🤖';
        const actionText = noti.action_type === 'comment' ? 'ได้คอมเมนต์ในโพสต์ของคุณ' : 'ได้ดันโพสต์ของคุณ';
        const bgClass = noti.is_read ? '' : 'background-color: #2c3e50;';

        notiList.innerHTML += `
            <div class="noti-item" style="${bgClass}" onclick="readNotification(${noti.id}, ${noti.post_id})">
                <div style="font-size: 24px;">${avatar}</div>
                <div>
                    <div style="font-weight: bold; color: #3a72b0;">${escapeHtml(noti.actor_name)}</div>
                    <div style="color: #e0e0e0; font-size: 13px;">${actionText}</div>
                </div>
            </div>
        `;
    });
}

async function readNotification(notiId, postId) {
    await supabaseClient.from('notifications').update({ is_read: true }).eq('id', notiId);
    window.location.href = `post.html?id=${postId}`;
}

checkUser();