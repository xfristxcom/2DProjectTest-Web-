const SUPABASE_URL = 'https://pvnrztgtnsmyhixkawgo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2bnJ6dGd0bnNteWhpeGthd2dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMDI0MjMsImV4cCI6MjA5NTc3ODQyM30.clc8OgLUlJ9nM7BKxf6oXIA8B6sWRotO1VId446FNnY';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let selectedAvatar = 'robot_default';
let currentUser = null; 
let currentPageProfile = 1;
const POSTS_PER_PAGE_PROFILE = 5; // 👈 เปลี่ยนจำนวนโหลดต่อหน้าตรงนี้ได้เลย! (ลองเทสที่ 5 หรือ 10 ก่อนได้ครับ)
let currentSortProfile = 'latest';

const avatarMap = {
    'robot_default': '🤖', 'robot_worker': '🔧', 'robot_combat': '⚔️', 'robot_ancient': '🗿',
    'robot_medic': '💉', 'robot_scout': '👁️', 'robot_heavy': '🛡️', 'robot_alien': '👾'
};

// ==========================================
// ฟังก์ชันป้องกัน XSS — แปลง HTML ให้เป็นข้อความปลอดภัย
// ==========================================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
}

/* =======================================
   ส่วนที่ 1: จัดการข้อมูลโปรไฟล์ (User Data)
   ======================================= */
async function loadUserData() {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    currentUser = session.user;
    const metadata = currentUser.user_metadata;

    document.getElementById('emailInput').value = currentUser.email;
    document.getElementById('nameInput').value = metadata.display_name || 'Player';

    const createdDate = new Date(currentUser.created_at);
    document.getElementById('createdDateDisplay').innerText = createdDate.toLocaleDateString('th-TH');

    if (metadata.avatar_id) selectedAvatar = metadata.avatar_id;
    
    updateAvatarUI();
    loadPosts();

    // ==========================================
    // Navbar Profile Initialization
    // ==========================================
    const userAvatar = document.getElementById('userAvatar');
    const profileBtn = document.getElementById('mainProfileBtn');
    const dropdownMenu = document.getElementById('dropdownMenu');
    const notiDropdownBlock = document.getElementById('notiDropdownBlock');

    if (userAvatar) {
        userAvatar.innerHTML = avatarMap[metadata.avatar_id] || '🤖';
        userAvatar.style.display = 'flex';
    }

    if (profileBtn) {
        profileBtn.innerText = metadata.display_name || 'Player';
        dropdownMenu.style.display = 'none';

        profileBtn.onclick = () => {
            dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
        };
    }

    if (notiDropdownBlock) {
        notiDropdownBlock.style.display = 'inline-block';
        const notiBtn = document.querySelector('.noti-btn');
        const notiDropdown = document.getElementById('notiMenu');

        if (notiBtn && notiDropdown) {
            notiBtn.onclick = (e) => {
                e.stopPropagation();
                notiDropdown.style.display = notiDropdown.style.display === 'block' ? 'none' : 'block';
            };
        }

        document.addEventListener('click', (e) => {
            if (profileBtn && dropdownMenu && !profileBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
                dropdownMenu.style.display = 'none';
            }
            if (notiBtn && notiDropdown && !notiBtn.contains(e.target) && !notiDropdown.contains(e.target)) {
                notiDropdown.style.display = 'none';
            }
        });
    }

    loadNotifications();
}

async function logoutUser() {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
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
        .limit(10); // เอาแค่ 10 รายการล่าสุด

    if (error) return;

    const notiList = document.getElementById('notiList');
    const notiCount = document.getElementById('notiCount');

    if (notis.length === 0) {
        notiList.innerHTML = '<div style="padding: 15px; text-align: center; color: #888; font-size: 14px;">ไม่มีการแจ้งเตือนใหม่</div>';
        notiCount.style.display = 'none';
        return;
    }

    // นับจำนวนที่ยังไม่ได้อ่าน
    const unreadCount = notis.filter(n => !n.is_read).length;
    if (unreadCount > 0) {
        notiCount.innerText = unreadCount;
        notiCount.style.display = 'inline-block';
    } else {
        notiCount.style.display = 'none';
    }

    // วาดรายการแจ้งเตือน
    notiList.innerHTML = '';
    notis.forEach(noti => {
        const avatar = avatarMap[noti.actor_avatar] || '🤖';
        const actionText = noti.action_type === 'comment' ? 'ได้คอมเมนต์ในโพสต์ของคุณ' : 'ได้ดันโพสต์ของคุณ';
        const bgClass = noti.is_read ? '' : 'background-color: #2c3e50;';

        notiList.innerHTML += `
            <div class="noti-item" style="${bgClass}; display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; gap: 10px; align-items: center; flex-grow: 1; cursor: pointer;" onclick="readNotification(${noti.id}, ${noti.post_id})">
                    <div style="font-size: 20px;">${avatar}</div>
                    <div>
                        <div style="font-weight: bold; color: #3a72b0; font-size: 14px;">${escapeHtml(noti.actor_name)}</div>
                        <div style="color: #e0e0e0; font-size: 12px;">${actionText}</div>
                    </div>
                </div>
                <div title="ลบการแจ้งเตือน" onclick="deleteNotification(${noti.id}, event)" style="color: #888; font-size: 12px; padding: 0 5px; cursor: pointer; transition: 0.2s;" onmouseover="this.style.color='#ff4444'" onmouseout="this.style.color='#888'">✖</div>
            </div>
        `;
    });
}

// ลบแจ้งเตือนทีละอัน
async function deleteNotification(notiId, event) {
    if (event) event.stopPropagation();
    await supabaseClient.from('notifications').delete().eq('id', notiId);
    loadNotifications();
}

// ล้างแจ้งเตือนทั้งหมด
async function clearAllNotifications() {
    if (!currentUser) return;
    if (confirm("ต้องการลบการแจ้งเตือนทั้งหมดใช่หรือไม่?")) {
        await supabaseClient.from('notifications').delete().eq('user_id', currentUser.id);
        loadNotifications();
    }
}

async function readNotification(notiId, postId) {
    await supabaseClient.from('notifications').update({ is_read: true }).eq('id', notiId);
    window.location.href = `post.html?id=${postId}`;
}

let isEditingName = false;
async function toggleEditName() {
    const nameInput = document.getElementById('nameInput');
    const editBtn = document.getElementById('editNameBtn');

    if (!isEditingName) {
        nameInput.disabled = false;
        nameInput.focus();
        editBtn.innerText = 'Save';
        editBtn.style.backgroundColor = '#3a72b0';
        editBtn.style.borderColor = '#3a72b0';
        isEditingName = true;
    } else {
        editBtn.innerText = 'Saving...';
        const { error } = await supabaseClient.auth.updateUser({ data: { display_name: nameInput.value } });

        nameInput.disabled = true;
        editBtn.innerText = 'Change';
        editBtn.style.backgroundColor = 'transparent';
        editBtn.style.borderColor = '#e0e0e0';
        isEditingName = false;

        if (error) alert("เปลี่ยนชื่อไม่สำเร็จ: " + error.message);
    }
}

/* =======================================
   ส่วนที่ 2: จัดการอวาตาร์ (Avatar Modal)
   ======================================= */
const avatarOptions = document.querySelectorAll('.avatar-option');
const modalPreview = document.getElementById('modalPreviewAvatar');

function openAvatarModal() {
    document.getElementById('avatarModal').style.display = 'flex';
    modalPreview.innerText = avatarMap[selectedAvatar] || '🤖';
}
function closeAvatarModal() {
    document.getElementById('avatarModal').style.display = 'none';
}

avatarOptions.forEach(option => {
    option.addEventListener('mouseenter', function () {
        modalPreview.innerText = avatarMap[this.getAttribute('data-avatar')];
        modalPreview.style.transform = 'scale(1.1)';
    });
    option.addEventListener('mouseleave', function () {
        modalPreview.innerText = avatarMap[selectedAvatar] || '🤖';
        modalPreview.style.transform = 'scale(1)';
    });
    option.addEventListener('click', async function () {
        selectedAvatar = this.getAttribute('data-avatar');
        updateAvatarUI();
        modalPreview.innerText = '⏳';
        await supabaseClient.auth.updateUser({ data: { avatar_id: selectedAvatar } });
        closeAvatarModal();
    });
});

function updateAvatarUI() {
    document.getElementById('displayAvatar').innerText = avatarMap[selectedAvatar] || '🤖';
    avatarOptions.forEach(option => {
        option.classList.remove('selected');
        if (option.getAttribute('data-avatar') === selectedAvatar) option.classList.add('selected');
    });
}

/* =======================================
   ส่วนที่ 3: ระบบโพสต์ (Load, Edit, Delete, Upvote)
   ======================================= */


async function loadPosts() {
    const container = document.getElementById('postContainer');
    container.innerHTML = '<div class="post-card" style="text-align:center; color:#888;">กำลังโหลดโพสต์...</div>';

    // 1. ตั้งต้นคำสั่งดึงข้อมูล (ดึงเฉพาะโพสต์ของตัวเอง และนับจำนวนทั้งหมดด้วย {count: 'exact'})
    let query = supabaseClient
        .from('posts')
        .select('*, comments(count)', { count: 'exact' })
        .eq('user_id', currentUser.id);

    // 2. เช็กว่าเลือกจัดเรียงแบบไหน
    if (currentSortProfile === 'latest') {
        query = query.order('created_at', { ascending: false });
    } else if (currentSortProfile === 'top') {
        query = query.order('upvotes', { ascending: false }).order('created_at', { ascending: false });
    }

    // 3. คำนวณระยะที่จะดึงข้อมูล (จากโพสต์ที่เท่าไหร่ ถึงเท่าไหร่)
    const from = (currentPageProfile - 1) * POSTS_PER_PAGE_PROFILE;
    const to = from + POSTS_PER_PAGE_PROFILE - 1;

    const { data, error, count } = await query.range(from, to);

    if (error) {
        container.innerHTML = '<div class="post-card" style="text-align:center; color:red;">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>';
        return;
    }

    // 4. จัดการปุ่มหน้าถัดไป/ก่อนหน้า
    document.getElementById('pageInfoProfile').innerText = `Page ${currentPageProfile}`;
    document.getElementById('prevBtnProfile').disabled = currentPageProfile === 1;
    document.getElementById('nextBtnProfile').disabled = to >= (count - 1); // ถ้าถึงโพสต์สุดท้าย ให้ปิดปุ่มถัดไป

    // 5. เริ่มวาดโพสต์
    container.innerHTML = '';
    if (data.length === 0) {
        container.innerHTML = '<div class="post-card" style="text-align:center; color:#888;">ยังไม่มีโพสต์เลย</div>';
        return;
    }

    data.forEach(post => {
        const commentCount = post.comments[0]?.count || 0;
        const postDate = new Date(post.created_at).toLocaleString('th-TH');
        const avatarEmoji = avatarMap[post.author_avatar] || '🤖';
        
        const upvotedByList = post.upvoted_by || [];
        const isUpvoted = upvotedByList.includes(currentUser.id);

        container.innerHTML += `
            <div class="post-card" id="post-${post.id}">
                <div class="post-header-info">
                    <div style="font-size: 30px;">${avatarEmoji}</div>
                    <div style="flex-grow: 1;">
                        <div style="font-weight: bold; color: #3a72b0; font-size: 16px;">${escapeHtml(post.author_name)}</div>
                        <div style="font-size: 12px; color: #777;">${postDate}</div>
                    </div>
                    <div class="action-dropdown">
                        <button class="dots-btn">⋮</button>
                        <div class="action-dropdown-content">
                            <button onclick="editPost('${post.id}')">✏️ Edit</button>
                            <button class="delete-btn" onclick="deletePost('${post.id}')">🗑️ Delete</button>
                        </div>
                    </div>
                </div>

                <div style="line-height: 1.6; font-size: 16px; white-space: pre-wrap; margin-bottom: 20px;" id="content-${post.id}">${escapeHtml(post.content)}</div>

                <div class="post-actions">
                    <button onclick="toggleUpvote('${post.id}')" class="btn-post-action ${isUpvoted ? 'action-upvoted' : 'action-normal'}">
                        ⬆️ ดันโพสต์ ( <span>${post.upvotes || 0}</span> )
                    </button>
                    <button onclick="toggleCommentSection('${post.id}')" class="btn-post-action action-normal">
                        💬 คอมเมนต์ ( <span id="comment-count-${post.id}">${commentCount}</span> )
                    </button>
                </div>

                <div class="comments-box-container" id="comment-section-${post.id}">
                    <div class="comment-input-wrapper">
                        <input type="text" id="comment-input-${post.id}" class="comment-styled-input" placeholder="แสดงความคิดเห็น...">
                        <button onclick="submitComment('${post.id}')" class="btn-comment-submit">ส่ง</button>
                    </div>
                    <div id="comment-list-${post.id}"></div>
                </div>
            </div>
        `;
    });
}

function editPost(postId) {
    const contentDiv = document.getElementById(`content-${postId}`);
    const currentText = contentDiv.innerText.trim();
    contentDiv.innerHTML = `
        <div class="edit-post-container">
            <textarea id="editInput-${postId}" class="edit-textarea" oninput="this.style.height = 'auto'; this.style.height = this.scrollHeight + 'px'">${currentText}</textarea>
            <div class="edit-actions">
                <button class="cancel-edit-btn" onclick="loadPosts()">ยกเลิก</button>
                <button class="save-edit-btn" onclick="saveEdit('${postId}')">บันทึก</button>
            </div>
        </div>
    `;
    const textarea = document.getElementById(`editInput-${postId}`);
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}

async function saveEdit(postId) {
    const newContent = document.getElementById(`editInput-${postId}`).value;
    await supabaseClient.from('posts').update({ content: newContent }).eq('id', postId);
    loadPosts();
}

async function deletePost(postId) {
    if (!confirm("คุณแน่ใจนะว่าจะลบโพสต์นี้?")) return;
    await supabaseClient.from('posts').delete().eq('id', postId);
    loadPosts();
}

async function toggleUpvote(postId) {
    const { data: post } = await supabaseClient.from('posts').select('upvotes, upvoted_by').eq('id', postId).single();
    let currentUpvotes = post.upvotes || 0;
    let upvotedByList = post.upvoted_by || [];

    if (upvotedByList.includes(currentUser.id)) {
        currentUpvotes -= 1;
        upvotedByList = upvotedByList.filter(id => id !== currentUser.id);
    } else {
        currentUpvotes += 1;
        upvotedByList.push(currentUser.id);
    }
    await supabaseClient.from('posts').update({ 
        upvotes: currentUpvotes, 
        upvoted_by: upvotedByList,
        last_activity_at: new Date().toISOString()
    }).eq('id', postId);
    loadPosts();
}

/* =======================================
   ส่วนที่ 4: ระบบคอมเมนต์ (Load, Submit, Delete)
   ======================================= */
function toggleCommentSection(postId) {
    const section = document.getElementById(`comment-section-${postId}`);
    if (section.style.display === 'block') {
        section.style.display = 'none';
    } else {
        section.style.display = 'block';
        loadComments(postId); 
    }
}

async function loadComments(postId) {
    const commentListDiv = document.getElementById(`comment-list-${postId}`);
    commentListDiv.innerHTML = '<div style="color: #777; font-size: 13px; text-align: center;">กำลังโหลด...</div>';

    const { data: comments, error } = await supabaseClient.from('comments').select('*').eq('post_id', postId).order('created_at', { ascending: true });

    if (error) { commentListDiv.innerHTML = '<div style="color: red; font-size: 13px;">โหลดคอมเมนต์ไม่สำเร็จ</div>'; return; }
    if (comments.length === 0) { commentListDiv.innerHTML = '<div style="color: #777; font-size: 13px; text-align: center;">ยังไม่มีคอมเมนต์ เป็นคนแรกที่คอมเมนต์เลย!</div>'; return; }

    commentListDiv.innerHTML = '';
    comments.forEach(comment => {
        const commentAvatar = avatarMap[comment.author_avatar] || '🤖';
        let commentActionHtml = '';
        if (currentUser && comment.user_id === currentUser.id) {
            commentActionHtml = `
                <div class="action-dropdown" style="margin-left: auto;">
                    <button class="dots-btn" style="font-size: 20px;">⋮</button>
                    <div class="action-dropdown-content">
                        <button class="delete-btn" onclick="deleteComment('${comment.id}', '${postId}')">🗑️ ลบคอมเมนต์</button>
                    </div>
                </div>
            `;
        }

        commentListDiv.innerHTML += `
            <div style="padding: 10px 0; border-bottom: 1px solid #333; font-size: 14px; display: flex; align-items: flex-start;">
                <span style="font-size: 18px; margin-right: 8px;">${commentAvatar}</span>
                <div style="flex-grow: 1;">
                    <span style="font-weight: bold; color: #3a72b0; margin-right: 8px;">${escapeHtml(comment.author_name)}</span>
                    <span style="color: #e0e0e0;">${escapeHtml(comment.content)}</span>
                </div>
                ${commentActionHtml} 
            </div>
        `;
    });
}

async function submitComment(postId) {
    const inputField = document.getElementById(`comment-input-${postId}`);
    const content = inputField.value.trim();
    if (!content) return;

    if (content.length > 300) {
        alert(`คอมเมนต์ต้องไม่เกิน 300 ตัวอักษร (ปัจจุบัน: ${content.length} ตัวอักษร)`);
        return;
    }

    inputField.disabled = true;
    const { error } = await supabaseClient.from('comments').insert([{
        post_id: postId, user_id: currentUser.id,
        author_name: currentUser.user_metadata.display_name || 'Player',
        author_avatar: selectedAvatar || 'robot_default', content: content
    }]);

    inputField.disabled = false;
    if (!error) {
        inputField.value = ''; 
        loadComments(postId); 
        const countSpan = document.getElementById(`comment-count-${postId}`);
        if (countSpan) countSpan.innerText = parseInt(countSpan.innerText) + 1;
    } else {
        alert("ส่งคอมเมนต์ไม่สำเร็จ: " + error.message);
    }
}

async function deleteComment(commentId, postId) {
    if (!confirm("คุณแน่ใจหรือไม่ที่จะลบคอมเมนต์นี้?")) return;
    const { error } = await supabaseClient.from('comments').delete().eq('id', commentId);
    
    if (error) alert("ลบไม่สำเร็จ: " + error.message);
    else {
        loadComments(postId); 
        const countSpan = document.getElementById(`comment-count-${postId}`);
        if (countSpan && parseInt(countSpan.innerText) > 0) countSpan.innerText = parseInt(countSpan.innerText) - 1;
    }
}

// 2. เมื่อคลิกเลือกหัวข้อ
function selectSort(value, text) {
    currentSortProfile = value; 
    document.getElementById('sortDisplayBtn').innerHTML = `${text} `; 
    currentPageProfile = 1; 
    loadPosts(); 
}

function nextPageProfile() { 
    currentPageProfile++; 
    loadPosts(); 
}
function prevPageProfile() { 
    if(currentPageProfile > 1) { 
        currentPageProfile--; 
        loadPosts(); 
    } 
}

// สั่งทำงานเมื่อเปิดหน้าเว็บ
loadUserData();