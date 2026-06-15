const SUPABASE_URL = 'https://pvnrztgtnsmyhixkawgo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2bnJ6dGd0bnNteWhpeGthd2dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMDI0MjMsImV4cCI6MjA5NTc3ODQyM30.clc8OgLUlJ9nM7BKxf6oXIA8B6sWRotO1VId446FNnY';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentUser = null;
let currentSort = 'latest'; // โหมดจัดเรียงเริ่มต้นของหน้า Community

const avatarMap = {
    'robot_default': '🤖', 'robot_worker': '🔧', 'robot_combat': '⚔️',
    'robot_ancient': '🗿', 'robot_medic': '💉', 'robot_scout': '👁️',
    'robot_heavy': '🛡️', 'robot_alien': '👾'
};

// ==========================================
// ฟังก์ชันป้องกัน XSS — แปลง HTML ให้เป็นข้อความปลอดภัย
// ==========================================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
}

async function checkAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    const profileBtn = document.getElementById('mainProfileBtn');
    const dropdownMenu = document.getElementById('dropdownMenu');
    const userAvatar = document.getElementById('userAvatar'); 
    const notiDropdown = document.querySelector('.noti-dropdown'); // เพิ่มตัวแปรดึงกล่องกระดิ่ง

    if (session) {
        currentUser = session.user;
        const metadata = currentUser.user_metadata;
        profileBtn.innerText = metadata.display_name || 'Player'; 
        dropdownMenu.style.display = ''; 
        profileBtn.onclick = null; 
        
        userAvatar.innerText = avatarMap[metadata.avatar_id || 'robot_default'] || '🤖';
        userAvatar.style.display = 'flex';
        userAvatar.style.justifyContent = 'center';
        userAvatar.style.alignItems = 'center';
        userAvatar.style.fontSize = '22px'; 

        loadNotifications(); // 👈 เติมบรรทัดนี้ลงไป เพื่อโหลดแจ้งเตือนตอนล็อกอินสำเร็จ
        
        if (notiDropdown) notiDropdown.style.display = 'inline-block'; // โชว์กระดิ่งเมื่อล็อกอิน
    } else {
        profileBtn.innerText = 'Login'; 
        dropdownMenu.style.display = 'none'; 
        userAvatar.style.display = 'none'; 
        
        if (notiDropdown) notiDropdown.style.display = 'none'; // ซ่อนกระดิ่งเมื่อยังไม่ล็อกอิน
        
        profileBtn.onclick = () => window.location.href = 'login.html';
    }
    // แสดงปุ่ม Admin ถ้าเป็น Admin
    updateCommunityAdminUI();
    loadFeed();
}

// เช็ค Admin role สำหรับ community
function checkIsAdmin() {
    if (!currentUser) return false;
    const metadata = currentUser.user_metadata;
    return metadata && (metadata.role === 'admin' || metadata.is_admin === true);
}

function updateCommunityAdminUI() {
    const adminPanel = document.getElementById('adminCleanPanel');
    if (adminPanel) adminPanel.style.display = checkIsAdmin() ? 'block' : 'none';
}

// อัปเดต counter ตัวอักษรโพสต์
function updatePostCounter(length) {
    const counter = document.getElementById('postCharCounter');
    if (!counter) return;
    counter.innerText = `${length} / 1,000`;
    counter.style.color = length > 900 ? '#ff5252' : length > 700 ? '#ff9800' : '#777';
}

// Admin: ลบโพสต์เก่าด้วยตนเอง
async function adminCleanOldPosts() {
    if (!checkIsAdmin()) { alert('ไม่มีสิทธิ์'); return; }
    if (!confirm('ต้องการล้างโพสต์เก่าตามเงื่อนไข (ไม่มี upvote > 60 วัน / มี upvote > 360 วัน) ใช่หรือไม่?')) return;

    const now = new Date();
    const d60 = new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString();
    const d360 = new Date(now - 360 * 24 * 60 * 60 * 1000).toISOString();

    // ลบโพสต์ที่ไม่มีอัพโหวตและไม่มีกิจกรรมนานกว่า 60 วัน
    const { error: e1 } = await supabaseClient
        .from('posts')
        .delete()
        .or(`upvotes.is.null,upvotes.eq.0`)
        .lt('last_activity_at', d60);

    // ลบโพสต์ที่มีอัพโหวตแต่ไม่มีกิจกรรมนานกว่า 360 วัน
    const { error: e2 } = await supabaseClient
        .from('posts')
        .delete()
        .gt('upvotes', 0)
        .lt('last_activity_at', d360);

    if (e1 || e2) {
        alert('เกิดข้อผิดพลาด: ' + (e1?.message || e2?.message));
    } else {
        alert('✅ ล้างโพสต์เก่าเรียบร้อยแล้ว!');
        loadFeed();
    }
}

async function logoutUser() {
    await supabaseClient.auth.signOut();
    alert("ออกจากระบบเรียบร้อยแล้ว");
    setTimeout(() => { window.location.reload(); }, 1500);
}

// 1. โหลดกระดานโพสต์
async function loadFeed() {
    const feedContainer = document.getElementById('feedContainer');
    
    // 1. ตั้งต้นคำสั่งดึงข้อความจากตาราง posts
    let query = supabaseClient
        .from('posts')
        .select('*, comments(count)');

    // 2. เช็กเงื่อนไขการจัดเรียงจากตัวแปร currentSort
    if (currentSort === 'latest') {
        query = query.order('created_at', { ascending: false });
    } else if (currentSort === 'top') {
        // ถ้าเป็น top ให้เรียงยอดดันโพสต์ (upvotes) จากมากไปน้อย
        query = query.order('upvotes', { ascending: false }).order('created_at', { ascending: false });
    }

    // 🔥 3. แก้บั๊กตรงนี้! สั่งให้ดึงข้อมูลจากตัวแปร query ที่เราเพิ่งจัดเรียงเสร็จ
    const { data: posts, error } = await query;

    if (error) {
        feedContainer.innerHTML = '<div class="post-card">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>';
        return;
    }

    feedContainer.innerHTML = '';
    if (posts.length === 0) {
        feedContainer.innerHTML = '<div class="post-card" style="text-align:center;">ยังไม่มีใครโพสต์เลย มาร่วมพูดคุยกันเถอะ!</div>';
        return;
    }

    posts.forEach(post => {
        const postDate = new Date(post.created_at).toLocaleString('th-TH');
        const avatarEmoji = avatarMap[post.author_avatar] || '🤖';
        
        const upvotedByList = post.upvoted_by || [];
        const isUpvoted = currentUser && upvotedByList.includes(currentUser.id);
        const upvoteBtnClass = isUpvoted ? "action-btn upvoted" : "action-btn";
        
        // *** ดึงตัวเลขจำนวนคอมเมนต์ออกมา (ถ้าไม่มีให้เป็น 0) ***
        const commentCount = post.comments[0]?.count || 0;
        
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
        feedContainer.innerHTML += postHtml;
    });
}


// 3. ระบบดันโพสต์
async function toggleUpvote(postId) {
    if (!currentUser) { alert("กรุณาล็อกอินก่อนดันโพสต์ครับ!"); return; }

    const { data: post, error: fetchError } = await supabaseClient.from('posts').select('upvotes, upvoted_by').eq('id', postId).single();
    if (fetchError) return;

    let currentUpvotes = post.upvotes || 0;
    let upvotedByList = post.upvoted_by || [];
    let isUpvoting = false; // ตัวแปรเช็กว่ากำลังกดบวกใช่ไหม?

    if (upvotedByList.includes(currentUser.id)) {
        currentUpvotes -= 1;
        upvotedByList = upvotedByList.filter(id => id !== currentUser.id);
    } else {
        currentUpvotes += 1;
        upvotedByList.push(currentUser.id);
        isUpvoting = true; // 👈 ถ้าไม่ได้กดลบ แปลว่ากดบวก
    }

    const { error: updateError } = await supabaseClient.from('posts').update({ 
        upvotes: currentUpvotes, 
        upvoted_by: upvotedByList,
        last_activity_at: new Date().toISOString()
    }).eq('id', postId);
    if (updateError) { alert("อัปเดตไม่สำเร็จ!"); return; }

    // 👈 ถ้านี่คือการกดบวก ให้ยิงแจ้งเตือนประเภท 'upvote'
    if (isUpvoting) {
        await sendNotification(postId, 'upvote');
    }

    loadFeed();
}

// --- ฟังก์ชันเปิด/ปิด โซนคอมเมนต์ ---
function toggleCommentSection(postId) {
    const section = document.getElementById(`comment-section-${postId}`);
    if (section.style.display === 'block') {
        section.style.display = 'none';
    } else {
        section.style.display = 'block';
        loadComments(postId); 
    }
}

// --- ฟังก์ชันดึงคอมเมนต์มาแสดง ---
async function loadComments(postId) {
    const commentListDiv = document.getElementById(`comment-list-${postId}`);
    commentListDiv.innerHTML = '<div style="color: #777; font-size: 13px; text-align: center;">กำลังโหลด...</div>';

    const { data: comments, error } = await supabaseClient
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true }); 

    if (error) {
        commentListDiv.innerHTML = '<div style="color: red; font-size: 13px;">โหลดคอมเมนต์ไม่สำเร็จ</div>';
        return;
    }

    if (comments.length === 0) {
        commentListDiv.innerHTML = '<div style="color: #777; font-size: 13px; text-align: center;">ยังไม่มีคอมเมนต์ เป็นคนแรกที่คอมเมนต์เลย!</div>';
        return;
    }

    commentListDiv.innerHTML = '';
    comments.forEach(comment => {
        const commentAvatar = avatarMap[comment.author_avatar] || '🤖';
        
        // เช็กว่าคอมเมนต์นี้เป็นของคนที่ล็อกอินอยู่หรือเปล่า (ถ้าใช่ให้โชว์ปุ่ม 3 จุด)
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

        const commentHtml = `
            <div class="comment-item" style="display: flex; align-items: flex-start;">
                <span style="font-size: 18px; margin-right: 8px;">${commentAvatar}</span>
                <div style="flex-grow: 1;">
                    <span style="font-weight: bold; color: #3a72b0; margin-right: 8px;">${escapeHtml(comment.author_name)}</span>
                    <span style="color: #e0e0e0;">${escapeHtml(comment.content)}</span>
                </div>
                ${commentActionHtml}
            </div>
        `;
        commentListDiv.innerHTML += commentHtml;
    });
}
// --- ฟังก์ชันลบคอมเมนต์ ---
async function deleteComment(commentId, postId) {
    if (!confirm("คุณแน่ใจหรือไม่ที่จะลบคอมเมนต์นี้?")) return;
    
    const { error } = await supabaseClient.from('comments').delete().eq('id', commentId);
    
    if (error) {
        alert("ลบไม่สำเร็จ: " + error.message);
    } else {
        loadComments(postId); // โหลดคอมเมนต์ใหม่มาแสดง (อันที่ลบจะหายไป)
        
        // ลดตัวเลขจำนวนคอมเมนต์ที่หน้าปุ่มลง 1 ทันที
        const countSpan = document.getElementById(`comment-count-${postId}`);
        if (countSpan) {
            let currentCount = parseInt(countSpan.innerText);
            if (currentCount > 0) countSpan.innerText = currentCount - 1;
        }
    }
}
// --- ฟังก์ชันส่งคอมเมนต์ ---
async function submitComment(postId) {
    if (!currentUser) {
        alert("กรุณาล็อกอินก่อนคอมเมนต์ครับ!");
        return;
    }

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
        post_id: postId,
        user_id: currentUser.id, 
        author_name: metadata.display_name || 'Player', 
        author_avatar: metadata.avatar_id || 'robot_default', 
        content: content 
    }]);

    inputField.disabled = false;

    if (error) {
        alert("ส่งคอมเมนต์ไม่สำเร็จ: " + error.message);
    } else {
        inputField.value = ''; 
        loadComments(postId); 
        
        // *** อัปเดตตัวเลขหน้าปุ่มคอมเมนต์ทันทีที่กดส่งสำเร็จ! ***
        const countSpan = document.getElementById(`comment-count-${postId}`);
        if (countSpan) {
            countSpan.innerText = parseInt(countSpan.innerText) + 1;
        }
        await sendNotification(postId, 'comment');
        // อัปเดตเวลากิจกรรมล่าสุดของโพสต์
        await supabaseClient.from('posts').update({ last_activity_at: new Date().toISOString() }).eq('id', postId);
    }
}

// ==========================================
// ระบบแจ้งเตือน (Notifications)
// ==========================================

// 1. ฟังก์ชันโหลดแจ้งเตือนมาแสดงที่กระดิ่ง
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
        const bgClass = noti.is_read ? '' : 'background-color: #2c3e50;'; // สีพื้นหลังถ้ายังไม่อ่านจะเป็นสีน้ำเงินเข้ม

        notiList.innerHTML += `
            <div class="noti-item" style="${bgClass}; display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; gap: 10px; align-items: center; flex-grow: 1; cursor: pointer;" onclick="readNotification(${noti.id}, ${noti.post_id})">
                    <div style="font-size: 24px;">${avatar}</div>
                    <div>
                        <div style="font-weight: bold; color: #3a72b0;">${escapeHtml(noti.actor_name)}</div>
                        <div style="color: #e0e0e0; font-size: 13px;">${actionText}</div>
                    </div>
                </div>
                <div title="ลบการแจ้งเตือน" onclick="deleteNotification(${noti.id}, event)" style="color: #888; font-size: 16px; padding: 0 5px; cursor: pointer; transition: 0.2s;" onmouseover="this.style.color='#ff4444'" onmouseout="this.style.color='#888'">✖</div>
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

// 2. ฟังก์ชันกดอ่านแล้วไปที่หน้าโพสต์แยก
async function readNotification(notiId, postId) {
    // อัปเดตในฐานข้อมูลว่าอ่านแล้ว
    await supabaseClient.from('notifications').update({ is_read: true }).eq('id', notiId);
    
    // 🔥 เปลี่ยนให้พาไปหน้า post.html พร้อมแนบ id โพสต์ไปที่ URL
    window.location.href = `post.html?id=${postId}`;
}

// 3. ฟังก์ชันสร้างการแจ้งเตือน (ใช้ตอนมีคนมาคอมเมนต์/ดันโพสต์)
async function sendNotification(postId, actionType) {
    // หาว่าใครเป็นเจ้าของโพสต์
    const { data: post } = await supabaseClient.from('posts').select('user_id').eq('id', postId).single();
    
    // กฎเหล็ก: ถ้าหาโพสต์ไม่เจอ หรือ "เราเป็นคนกดโพสต์ตัวเอง" = ไม่ต้องแจ้งเตือน
    if (!post || post.user_id === currentUser.id) return;

    const metadata = currentUser.user_metadata;
    await supabaseClient.from('notifications').insert([{
        user_id: post.user_id, // ส่งแจ้งเตือนไปหาเจ้าของโพสต์
        actor_name: metadata.display_name || 'Player',
        actor_avatar: metadata.avatar_id || 'robot_default',
        action_type: actionType,
        post_id: postId
    }]);

    // จำกัดจำนวนการแจ้งเตือนในฐานข้อมูล ไม่ให้ล้นเกิน 30 รายการต่อคน
    const { data: oldNotis } = await supabaseClient
        .from('notifications')
        .select('id')
        .eq('user_id', post.user_id)
        .order('created_at', { ascending: false })
        .range(30, 1000); // ค้นหาตัวที่เก่าเกินอันดับ 30
        
    if (oldNotis && oldNotis.length > 0) {
        const idsToDelete = oldNotis.map(n => n.id);
        await supabaseClient.from('notifications').delete().in('id', idsToDelete);
    }
}

// ==========================================
// ระบบแก้ไข และ ลบโพสต์
// ==========================================
function editPost(postId) {
    const contentDiv = document.getElementById(`content-${postId}`);
    const currentText = contentDiv.innerText.trim();
    contentDiv.innerHTML = `
        <div class="edit-post-container">
            <textarea id="editInput-${postId}" class="edit-textarea" oninput="this.style.height = 'auto'; this.style.height = this.scrollHeight + 'px'">${currentText}</textarea>
            <div class="edit-actions">
                <button class="cancel-edit-btn" onclick="loadFeed()">ยกเลิก</button>
                <button class="save-edit-btn" onclick="saveEdit('${postId}')">บันทึก</button>
            </div>
        </div>
    `;
    // สั่งให้กล่องขยายพอดีข้อความทันทีที่กด "แก้ไข"
    const textarea = document.getElementById(`editInput-${postId}`);
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}

async function saveEdit(postId) {
    const newContent = document.getElementById(`editInput-${postId}`).value.trim();
    if (!newContent) return;
    if (newContent.length > 1000) {
        alert(`โพสต์ต้องไม่เกิน 1,000 ตัวอักษร (ปัจจุบัน: ${newContent.length} ตัวอักษร)`);
        return;
    }
    const { error } = await supabaseClient.from('posts').update({ content: newContent }).eq('id', postId);
    if (error) alert("แก้ไขไม่สำเร็จ: " + error.message);
    loadFeed();
}

async function deletePost(postId) {
    if (!confirm("คุณแน่ใจหรือไม่ที่จะลบโพสต์นี้? (คอมเมนต์ทั้งหมดจะหายไปด้วย)")) return;
    const { error } = await supabaseClient.from('posts').delete().eq('id', postId);
    if (error) alert("ลบโพสต์ไม่สำเร็จ: " + error.message);
    loadFeed();
}

// 2. ระบบส่งโพสต์ใหม่
async function submitPost() {
    if (!currentUser) {
        alert("กรุณาล็อกอินก่อนโพสต์ครับ!");
        return;
    }
    const inputField = document.getElementById('postInput');
    const content = inputField.value.trim();
    if (!content) return;

    if (content.length > 1000) {
        alert(`โพสต์ต้องไม่เกิน 1,000 ตัวอักษร (ปัจจุบัน: ${content.length} ตัวอักษร)`);
        return;
    }

    const metadata = currentUser.user_metadata;
    const { error } = await supabaseClient.from('posts').insert([{ 
        user_id: currentUser.id, 
        author_name: metadata.display_name || 'Player', 
        author_avatar: metadata.avatar_id || 'robot_default', 
        content: content 
    }]);

    if (!error) {
        inputField.value = '';
        inputField.style.height = '80px'; // รีเซ็ตความสูงของกล่องพิมพ์ข้อความ
        loadFeed(); 
    } else {
        // 🔥 ถ้าบั๊กหรือโพสต์ไม่เข้า Database มันจะเด้งเตือนบอกสาเหตุตรงนี้เลย!
        alert("สร้างโพสต์ไม่สำเร็จ: " + error.message);
    }
}

// ฟังก์ชันสำหรับระบบเลือกการจัดเรียงหน้าฟีด Community
function selectSort(value, text) {
    currentSort = value; // เปลี่ยนค่าโหมด (latest / top)
    document.getElementById('sortDisplayBtn').innerHTML = text; // เปลี่ยนข้อความบนหน้าปุ่ม
    loadFeed(); // สั่งรีโหลดฟีดโพสต์ใหม่ทันที
}

checkAuth();