const SUPABASE_URL = 'https://pvnrztgtnsmyhixkawgo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2bnJ6dGd0bnNteWhpeGthd2dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMDI0MjMsImV4cCI6MjA5NTc3ODQyM30.clc8OgLUlJ9nM7BKxf6oXIA8B6sWRotO1VId446FNnY';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
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

// ==========================================
// 1. ระบบยืนยันตัวตน (Auth)
// ==========================================
async function checkAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        currentUser = session.user;
        const metadata = currentUser.user_metadata;
        document.getElementById('mainProfileBtn').innerText = metadata.display_name || 'Player';
        document.getElementById('dropdownMenu').style.display = '';
        document.getElementById('mainProfileBtn').onclick = null;

        const userAvatar = document.getElementById('userAvatar');
        userAvatar.innerText = avatarMap[metadata.avatar_id || 'robot_default'] || '🤖';
        userAvatar.style.display = 'flex';
        userAvatar.style.justifyContent = 'center';
        userAvatar.style.alignItems = 'center';
        userAvatar.style.fontSize = '22px';

        loadNotifications(); // โหลดกระดิ่งแจ้งเตือน
    } else {
        document.getElementById('mainProfileBtn').onclick = () => window.location.href = 'login.html';
    }

    loadSinglePost();
}

async function logoutUser() {
    await supabaseClient.auth.signOut();
    window.location.href = 'main.html';
}

// ==========================================
// 2. ระบบดึงโพสต์เดียว (Single Post)
// ==========================================
async function loadSinglePost() {
    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('id');

    if (!postId) {
        document.getElementById('singlePostContainer').innerHTML = '<div class="post-card" style="text-align:center; color:red;">ไม่พบโพสต์ที่คุณตามหา</div>';
        return;
    }

    const { data: post, error } = await supabaseClient.from('posts').select('*, comments(count)').eq('id', postId).single();

    if (error || !post) {
        document.getElementById('singlePostContainer').innerHTML = '<div class="post-card" style="text-align:center; color:red;">โพสต์นี้ถูกลบไปแล้ว หรือเกิดข้อผิดพลาด</div>';
        return;
    }

    const container = document.getElementById('singlePostContainer');
    const postDate = new Date(post.created_at).toLocaleString('th-TH');
    const avatarEmoji = avatarMap[post.author_avatar] || '🤖';
    const commentCount = post.comments[0]?.count || 0;

    const upvotedByList = post.upvoted_by || [];
    const isUpvoted = currentUser && upvotedByList.includes(currentUser.id);
    const upvoteBtnClass = isUpvoted ? "action-btn upvoted" : "action-btn";

    let postActionHtml = '';
    if (currentUser && post.user_id === currentUser.id) {
        postActionHtml = `
            <div class="action-dropdown">
                <button class="dots-btn">⋮</button>
                <div class="action-dropdown-content">
                    <button onclick="editPost('${post.id}')">✏️ แก้ไข</button>
                    <button class="delete-btn" onclick="deletePost('${post.id}')">🗑️ ลบโพสต์</button>
                </div>
            </div>
        `;
    }

    const postHtml = `
            <div class="post-card" id="post-${post.id}">
                <div class="post-header-info">
                    <div style="font-size: 30px;">${avatarEmoji}</div>
                    <div style="flex-grow: 1;">
                        <div style="font-weight: bold; color: #3a72b0; font-size: 16px;">${escapeHtml(post.author_name)}</div>
                        <div style="font-size: 12px; color: #777;">${postDate}</div>
                    </div>
                    ${postActionHtml}
                </div>

                <div style="line-height: 1.6; font-size: 16px; white-space: pre-wrap; margin-bottom: 20px;" id="content-${post.id}">${escapeHtml(post.content)}</div>

                <div class="post-actions">
                    <button onclick="toggleUpvote('${post.id}')" class="btn-post-action ${isUpvoted ? 'action-upvoted' : 'action-normal'}">
                        ⬆️ <span>${post.upvotes || 0}</span> ดันโพสต์
                    </button>
                    <button onclick="toggleCommentSection('${post.id}')" class="btn-post-action action-normal">
                        💬 <span id="comment-count-${post.id}">${commentCount}</span> คอมเมนต์
                    </button>
                </div>

                <div class="comments-box-container" id="comment-section-${post.id}" style="display: block;">
                    <div class="comment-input-wrapper">
                        <input type="text" id="comment-input-${post.id}" class="comment-styled-input" placeholder="แสดงความคิดเห็น...">
                        <button onclick="submitComment('${post.id}')" class="btn-comment-submit">ส่ง</button>
                    </div>
                    <div id="comment-list-${post.id}"></div>
                </div>
            </div>
        `;
        
    container.innerHTML = postHtml;

    loadComments(postId);
}

// ==========================================
// 3. ระบบคอมเมนต์ (โหลด, พิมพ์, ลบ)
// ==========================================
async function loadComments(postId) {
    const commentListDiv = document.getElementById(`comment-list-${postId}`);
    const { data: comments, error } = await supabaseClient.from('comments').select('*').eq('post_id', postId).order('created_at', { ascending: true });

    if (error) { commentListDiv.innerHTML = '<div style="color: red; text-align: center;">โหลดคอมเมนต์ไม่สำเร็จ</div>'; return; }
    if (comments.length === 0) { commentListDiv.innerHTML = '<div style="color: #777; text-align: center;">ยังไม่มีคอมเมนต์ เป็นคนแรกเลย!</div>'; return; }

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
function toggleCommentSection(postId) {
    const section = document.getElementById(`comment-section-${postId}`);
    // ถ้ามันซ่อนอยู่ ให้กางออกแล้วโหลดข้อมูล
    if (section.style.display === 'none' || section.style.display === '') {
        section.style.display = 'block';
        loadComments(postId); 
    } else {
        // ถ้ามันกางอยู่ ให้พับเก็บ
        section.style.display = 'none';
    }
}

async function submitComment(postId) {
    if (!currentUser) { alert("กรุณาล็อกอินก่อนคอมเมนต์ครับ!"); return; }

    const inputField = document.getElementById(`comment-input-${postId}`);
    const content = inputField.value.trim();
    if (!content) return;
    if (content.length > 300) {
        alert(`คอมเมนต์ต้องไม่เกิน 300 ตัวอักษร (ปัจจุบัน: ${content.length} ตัวอักษร)`);
        return;
    }

    inputField.disabled = true;
    const metadata = currentUser.user_metadata;
    const { error } = await supabaseClient.from('comments').insert([{
        post_id: postId, user_id: currentUser.id,
        author_name: metadata.display_name || 'Player',
        author_avatar: metadata.avatar_id || 'robot_default',
        content: content
    }]);

    inputField.disabled = false;

    if (!error) {
        inputField.value = '';
        loadComments(postId);
        const countSpan = document.getElementById(`comment-count-${postId}`);
        if (countSpan) countSpan.innerText = parseInt(countSpan.innerText) + 1;

        // ส่งแจ้งเตือนด้วย!
        await sendNotification(postId, 'comment');
    } else {
        alert("ส่งคอมเมนต์ไม่สำเร็จ: " + error.message);
    }
}

async function deleteComment(commentId, postId) {
    if (!confirm("คุณแน่ใจหรือไม่ที่จะลบคอมเมนต์นี้?")) return;
    const { error } = await supabaseClient.from('comments').delete().eq('id', commentId);
    if (!error) {
        loadComments(postId);
        const countSpan = document.getElementById(`comment-count-${postId}`);
        if (countSpan && parseInt(countSpan.innerText) > 0) countSpan.innerText = parseInt(countSpan.innerText) - 1;
    }
}

// ==========================================
// 4. ระบบกระดิ่งแจ้งเตือน
// ==========================================
async function loadNotifications() {
    if (!currentUser) return;
    const { data: notis, error } = await supabaseClient.from('notifications').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(10);
    if (error) return;

    const notiList = document.getElementById('notiList');
    const notiCount = document.getElementById('notiCount');

    if (notis.length === 0) {
        notiList.innerHTML = '<div style="padding: 15px; text-align: center; color: #888; font-size: 14px;">ไม่มีการแจ้งเตือนใหม่</div>';
        notiCount.style.display = 'none'; return;
    }

    const unreadCount = notis.filter(n => !n.is_read).length;
    if (unreadCount > 0) {
        notiCount.innerText = unreadCount;
        notiCount.style.display = 'inline-block';
    } else { notiCount.style.display = 'none'; }

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

async function sendNotification(postId, actionType) {
    const { data: post } = await supabaseClient.from('posts').select('user_id').eq('id', postId).single();
    if (!post || post.user_id === currentUser.id) return;

    const metadata = currentUser.user_metadata;
    await supabaseClient.from('notifications').insert([{
        user_id: post.user_id,
        actor_name: metadata.display_name || 'Player',
        actor_avatar: metadata.avatar_id || 'robot_default',
        action_type: actionType,
        post_id: postId
    }]);
}

// ==========================================
// ระบบดันโพสต์ (Upvote)
// ==========================================
async function toggleUpvote(postId) {
    if (!currentUser) { alert("กรุณาล็อกอินก่อนดันโพสต์ครับ!"); return; }

    // 1. ดึงข้อมูลโพสต์ปัจจุบันมาก่อน
    const { data: post, error: fetchError } = await supabaseClient.from('posts').select('upvotes, upvoted_by').eq('id', postId).single();
    if (fetchError) return;

    let currentUpvotes = post.upvotes || 0;
    let upvotedByList = post.upvoted_by || [];
    let isUpvoting = false;

    // 2. เช็กว่าเคยกดหรือยัง
    if (upvotedByList.includes(currentUser.id)) {
        // ถ้าเคยกดแล้ว -> เอาออก (ลดแต้ม)
        currentUpvotes -= 1;
        upvotedByList = upvotedByList.filter(id => id !== currentUser.id);
    } else {
        // ถ้ายังไม่เคยกด -> เพิ่มแต้ม
        currentUpvotes += 1;
        upvotedByList.push(currentUser.id);
        isUpvoting = true;
    }

    // 3. อัปเดตขึ้นฐานข้อมูล
    const { error: updateError } = await supabaseClient.from('posts').update({ 
        upvotes: currentUpvotes, 
        upvoted_by: upvotedByList,
        last_activity_at: new Date().toISOString()
    }).eq('id', postId);
    if (updateError) { alert("อัปเดตไม่สำเร็จ!"); return; }

    // 4. ถ้านี่คือการกดดันโพสต์ (ไม่ได้กดยกเลิก) ให้ยิงแจ้งเตือนด้วย!
    if (isUpvoting) {
        await sendNotification(postId, 'upvote');
    }

    // 5. โหลดโพสต์ใหม่เพื่ออัปเดตตัวเลขและสีปุ่ม
    loadSinglePost();
}

// ==========================================
// ระบบแก้ไข และ ลบโพสต์ (สำหรับหน้า Post Detail)
// ==========================================
function editPost(postId) {
    const contentDiv = document.getElementById(`content-${postId}`);
    const currentText = contentDiv.innerText.trim();
    contentDiv.innerHTML = `
        <div class="edit-post-container">
            <textarea id="editInput-${postId}" class="edit-textarea" oninput="this.style.height = 'auto'; this.style.height = this.scrollHeight + 'px'">${currentText}</textarea>
            <div class="edit-actions">
                <button class="cancel-edit-btn" onclick="loadSinglePost()">ยกเลิก</button>
                <button class="save-edit-btn" onclick="saveEdit('${postId}')">บันทึก</button>
            </div>
        </div>
    `;
    const textarea = document.getElementById(`editInput-${postId}`);
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}

async function saveEdit(postId) {
    const newContent = document.getElementById(`editInput-${postId}`).value.trim();
    if (!newContent) return;
    const { error } = await supabaseClient.from('posts').update({ content: newContent }).eq('id', postId);
    if (error) alert("แก้ไขไม่สำเร็จ: " + error.message);
    loadSinglePost();
}

async function deletePost(postId) {
    if (!confirm("คุณแน่ใจหรือไม่ที่จะลบโพสต์นี้? (คอมเมนต์ทั้งหมดจะหายไปด้วย)")) return;
    const { error } = await supabaseClient.from('posts').delete().eq('id', postId);
    if (!error) {
        window.location.href = 'community.html'; // ลบเสร็จให้เด้งกลับหน้าหลัก เพราะโพสต์หายไปแล้ว!
    } else {
        alert("ลบโพสต์ไม่สำเร็จ: " + error.message);
    }
}

// เริ่มทำงาน!
checkAuth();