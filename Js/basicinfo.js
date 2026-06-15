// --- ส่วนที่ 1: ตั้งค่าการเชื่อมต่อ Supabase ---
const SUPABASE_URL = 'https://pvnrztgtnsmyhixkawgo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2bnJ6dGd0bnNteWhpeGthd2dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMDI0MjMsImV4cCI6MjA5NTc3ODQyM30.clc8OgLUlJ9nM7BKxf6oXIA8B6sWRotO1VId446FNnY';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// ระบบดักจับและแจ้งเตือนบั๊กอัตโนมัติพร้อมวิเคราะห์ตัวแปร (Global Error Handler & Diagnostics)
// ==========================================
function getDiagnostics() {
    let diag = `\n\n--- Diagnostics ---\n`;
    diag += `EditorJS: ${typeof EditorJS}\n`;
    diag += `Header: ${typeof Header}\n`;
    diag += `EditorjsList: ${typeof EditorjsList}\n`;
    diag += `List: ${typeof List}\n`;
    diag += `ImageTool: ${typeof ImageTool}\n`;
    try {
        diag += `Tools: ${JSON.stringify(Object.keys(getEditorTools()))}\n`;
    } catch(e) {
        diag += `Tools error: ${e.message}\n`;
    }
    return diag;
}

window.onerror = function(message, source, lineno, colno, error) {
    if (message === 'Script error.' || lineno === 0) {
        console.warn('Ignored external script/extension error:', message, 'at line:', lineno, 'source:', source);
        return false;
    }
    const errorDetails = `Error: ${message}\nLine: ${lineno}\nSource: ${source}${getDiagnostics()}`;
    console.error(errorDetails);
    if (typeof showAlert === 'function') {
        showAlert("เกิดข้อผิดพลาดในการโหลดระบบ", errorDetails);
    } else {
        alert("เกิดข้อผิดพลาดในการโหลดระบบ:\n" + errorDetails);
    }
    return false;
};

window.onunhandledrejection = function(event) {
    const reason = event.reason;
    const errorDetails = `Promise Error: ${reason && reason.stack ? reason.stack : reason}${getDiagnostics()}`;
    console.error(errorDetails);
    if (typeof showAlert === 'function') {
        showAlert("เกิดข้อผิดพลาดในการโหลดระบบ (Promise)", errorDetails);
    } else {
        alert("เกิดข้อผิดพลาดในการโหลดระบบ (Promise):\n" + errorDetails);
    }
};

let currentUser = null;
let wikiPages = [];      // เก็บรายการหน้าสารานุกรมทั้งหมด
let activePageId = null;  // เก็บรหัสหน้าปัจจุบันที่แสดงอยู่
let currentWikiSort = 'admin'; // โหมดจัดเรียงเริ่มต้น

let editorAdd, editorEdit; // ตัวแปรเก็บ Instance ของ Editor.js

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
// ฟังก์ชันป้องกัน XSS — แปลง HTML ให้เป็นข้อความปลอดภัย
// ==========================================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
}

// ==========================================
// ส่วนที่ 2: ระบบยืนยันตัวตน และเมนู Navbar
// ==========================================

async function checkAuth() {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    
    const profileBtn = document.getElementById('mainProfileBtn');
    const dropdownMenu = document.getElementById('dropdownMenu');
    const userAvatar = document.getElementById('userAvatar'); 
    const notiDropdown = document.querySelector('.noti-dropdown');

    if (session) {
        currentUser = session.user;
        const userData = currentUser.user_metadata;
        const displayName = userData.display_name || 'Player';
        const avatarId = userData.avatar_id || 'robot_default';
        
        // ดึง Role จากตาราง user_roles แทนการใช้ user_metadata
        const { data: roleData, error: roleError } = await supabaseClient
            .from('user_roles')
            .select('role')
            .eq('user_id', currentUser.id);
            
        if (roleError) console.error("Role Error:", roleError);
        console.log("Fetched roleData:", roleData);
        
        currentUser.custom_role = (roleData && roleData.length > 0) ? roleData[0].role : 'user';
        console.log("Current custom_role:", currentUser.custom_role);

        profileBtn.innerText = displayName; 
        dropdownMenu.style.display = ''; 
        profileBtn.onclick = null; 
        
        userAvatar.innerText = avatarMap[avatarId] || '🤖';
        userAvatar.style.display = 'flex';
        userAvatar.style.justifyContent = 'center';
        userAvatar.style.alignItems = 'center';
        userAvatar.style.fontSize = '22px'; 

        loadNotifications();

        if (notiDropdown) notiDropdown.style.display = 'inline-block';

    } else {

        currentUser = null;
        profileBtn.innerText = 'Login'; 
        dropdownMenu.style.display = 'none'; 
        userAvatar.style.display = 'none'; 
        
        if (notiDropdown) notiDropdown.style.display = 'none';
        
        profileBtn.onclick = () => {
            window.location.href = 'login.html';
        };
    }

    // ตรวจสอบสิทธิ์แอดมินหลังโหลดผู้ใช้เสร็จ
    updateAdminUI();
    // โหลดหน้าสารานุกรมทั้งหมด
    loadWikiPages();
}

// เช็กว่าผู้ใช้ล็อกอินอยู่ และมี custom_role === 'admin'
function checkIsAdmin() {
    if (!currentUser) return false;
    return currentUser.custom_role === 'admin';
}

// แสดง/ซ่อน เมนูของแอดมิน
function updateAdminUI() {
    const isAdmin = checkIsAdmin();
    const adminSidebarBtn = document.getElementById('adminSidebarBtn');
    const adminActionGroup = document.getElementById('adminActionGroup');
    const sidebarHr = document.getElementById('sidebarHr');

    if (isAdmin) {
        if (adminSidebarBtn) adminSidebarBtn.style.display = 'block';
        if (sidebarHr) sidebarHr.style.display = 'block';
        if (adminActionGroup) adminActionGroup.style.display = 'flex';
    } else {
        if (adminSidebarBtn) adminSidebarBtn.style.display = 'none';
        if (sidebarHr) sidebarHr.style.display = 'none';
        if (adminActionGroup) adminActionGroup.style.display = 'none';
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
// ส่วนที่ 3: ระบบแจ้งเตือน (Notifications)
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

    notiList.innerHTML = '';
    notis.forEach(noti => {
        const avatar = avatarMap[noti.actor_avatar] || '🤖';
        const actionText = noti.action_type === 'comment' ? 'ได้คอมเมนต์ในโพสต์ของคุณ' : 'ได้ดันโพสต์ของคุณ';
        const bgClass = noti.is_read ? '' : 'background-color: #2c3e50;';

        notiList.innerHTML += `
            <div class="noti-item" style="${bgClass}" onclick="readNotification(${noti.id}, ${noti.post_id})">
                <div style="font-size: 24px;">${avatar}</div>
                <div>
                    <div style="font-weight: bold; color: #3a72b0;">${noti.actor_name}</div>
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

// ==========================================
// ส่วนที่ 4: ลอจิกการทำงานของ Wiki (ดึงข้อมูล/สลับหน้า)
// ==========================================

async function loadWikiPages() {
    const sidebarMenu = document.getElementById('sidebarMenu');
    sidebarMenu.innerHTML = '<div style="color: #888; font-size: 14px; text-align: center; padding: 20px;">กำลังโหลด...</div>';

    let query = supabaseClient
        .from('wiki_pages')
        .select('*, wiki_comments(count)');

    if (currentWikiSort === 'admin') {
        query = query.order('order_num', { ascending: true });
    } else if (currentWikiSort === 'top') {
        query = query.order('upvotes', { ascending: false }).order('order_num', { ascending: true });
    }

    const { data: pages, error } = await query;

    if (error) {

        sidebarMenu.innerHTML = '<div style="color: red; font-size: 14px; text-align: center; padding: 20px;">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>';
        return;
    }

    wikiPages = pages;
    sidebarMenu.innerHTML = '';

    if (wikiPages.length === 0) {
        sidebarMenu.innerHTML = '<div style="color: #888; font-size: 14px; text-align: center; padding: 20px;">ยังไม่มีหน้าสารานุกรม</div>';
        displayContent(null);
        return;
    }

    // สร้างปุ่มบน Sidebar
    wikiPages.forEach(page => {
        const btn = document.createElement('button');
        btn.className = 'sidebar-menu-btn';
        btn.id = `wiki-btn-${page.id}`;
        btn.innerText = page.title;
        btn.onclick = () => switchPage(page.id);
        sidebarMenu.appendChild(btn);
    });

    // กำหนดค่าเริ่มต้นแสดงผลหน้าแรก (Default Load)
    if (activePageId === null || !wikiPages.some(p => p.id === activePageId)) {
        activePageId = wikiPages[0].id;
    }
    
    switchPage(activePageId);
}

// สลับเนื้อหาหน้าจอแบบไม่โหลดหน้าใหม่
function switchPage(pageId) {
    activePageId = pageId;

    // เคลียร์สถานะ active ของปุ่มทั้งหมด
    document.querySelectorAll('.sidebar-menu-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // เพิ่มสถานะ active ในปุ่มปัจจุบัน
    const activeBtn = document.getElementById(`wiki-btn-${pageId}`);
    if (activeBtn) activeBtn.classList.add('active');

    // ค้นหาข้อมูลหน้าและดึงมาแสดงผลทางขวา
    const page = wikiPages.find(p => p.id === pageId);
    displayContent(page);
}

// วาดเนื้อหาทางฝั่งขวา
function displayContent(page) {
    const titleText = document.getElementById('contentTitleText');
    const bodyText = document.getElementById('contentBodyText');
    const adminActionGroup = document.getElementById('adminActionGroup');
    const interactionSection = document.getElementById('wikiInteractionSection');

    if (!page) {
        titleText.innerText = "ยังไม่มีเนื้อหา";
        bodyText.innerHTML = "กรุณาเข้าสู่ระบบในฐานะ Admin เพื่อเพิ่มหน้าข้อมูลพื้นฐานลงในระบบ Wiki";
        if (adminActionGroup) adminActionGroup.style.display = 'none';
        if (interactionSection) interactionSection.style.display = 'none';
        return;
    }

    titleText.innerText = page.title;
    // เรนเดอร์เนื้อหาเป็น HTML เนื่องจากเซฟมาแบบ Rich Text
    // แต่ถ้าเป็นข้อความเก่าที่ไม่มี Tag HTML ให้แปลง \n เป็น <br> เพื่อไม่ให้บรรทัดติดกัน
    let displayHtml = parseEditorJsData(page.content);
    bodyText.innerHTML = displayHtml;

    // อัปเดตส่วน อัพโหวต และ คอมเมนต์
    if (interactionSection) {
        interactionSection.style.display = 'block';
        
        // อัปเดต Upvote
        const upvoteCountText = document.getElementById('wikiUpvoteCount');
        const upvoteBtn = document.getElementById('wikiUpvoteBtn');
        const upvotes = page.upvotes || 0;
        const upvotedByList = page.upvoted_by || [];
        
        if (upvoteCountText) upvoteCountText.innerText = upvotes;
        if (upvoteBtn) {
            if (currentUser && upvotedByList.includes(currentUser.id)) {
                upvoteBtn.classList.add('upvoted');
            } else {
                upvoteBtn.classList.remove('upvoted');
            }
        }

        // อัปเดตยอดคอมเมนต์
        const commentCountText = document.getElementById('wikiCommentCount');
        const commentCount = page.wiki_comments && page.wiki_comments[0] ? page.wiki_comments[0].count : 0;
        if (commentCountText) commentCountText.innerText = commentCount;

        // ซ่อนกล่องคอมเมนต์ไว้ก่อนเสมอเมื่อเปลี่ยนหน้า
        const commentSection = document.getElementById('wikiCommentSection');
        if (commentSection) commentSection.style.display = 'none';
    }

    // อัปเดตการแสดงผลปุ่ม แก้ไข/ลบ ของแอดมิน
    updateAdminUI();
}

// ==========================================
// ส่วนที่ 4.5: ระบบอัพโหวต คอมเมนต์ และจัดเรียง
// ==========================================

function changeWikiSort(mode) {
    currentWikiSort = mode;
    const sortBtn = document.getElementById('sortWikiBtn');
    if (mode === 'admin') {
        sortBtn.innerText = '⭐ Admin ▼';
    } else {
        sortBtn.innerText = '🔥 Top Voted ▼';
    }
    loadWikiPages(); // โหลดใหม่ด้วยเงื่อนไขใหม่
}

async function toggleWikiUpvote() {
    if (!currentUser) {
        showAlert("แจ้งเตือน", "กรุณาล็อกอินก่อนกดโหวตครับ!");
        return;
    }
    if (!activePageId) return;

    const page = wikiPages.find(p => p.id === activePageId);
    if (!page) return;

    let currentUpvotes = page.upvotes || 0;
    let upvotedByList = page.upvoted_by || [];

    if (upvotedByList.includes(currentUser.id)) {
        currentUpvotes -= 1;
        upvotedByList = upvotedByList.filter(id => id !== currentUser.id);
    } else {
        currentUpvotes += 1;
        upvotedByList.push(currentUser.id);
    }

    // อัปเดตใน UI ชั่วคราวก่อนเพื่อให้ตอบสนองเร็ว
    page.upvotes = currentUpvotes;
    page.upvoted_by = upvotedByList;
    displayContent(page);

    const { error } = await supabaseClient
        .from('wiki_pages')
        .update({ upvotes: currentUpvotes, upvoted_by: upvotedByList })
        .eq('id', activePageId);

    if (error) {
        showAlert("ข้อผิดพลาด", "ไม่สามารถอัปเดตยอดโหวตได้");
    }
}

function toggleWikiCommentSection() {
    const section = document.getElementById('wikiCommentSection');
    if (section.style.display === 'block') {
        section.style.display = 'none';
    } else {
        section.style.display = 'block';
        loadWikiComments(); 
    }
}

async function loadWikiComments() {
    if (!activePageId) return;
    const commentListDiv = document.getElementById('wikiCommentList');
    commentListDiv.innerHTML = '<div style="color: #777; font-size: 13px; text-align: center; padding: 10px;">กำลังโหลด...</div>';

    const { data: comments, error } = await supabaseClient
        .from('wiki_comments')
        .select('*')
        .eq('wiki_page_id', activePageId)
        .order('created_at', { ascending: true }); 

    if (error) {
        commentListDiv.innerHTML = '<div style="color: red; font-size: 13px;">โหลดคอมเมนต์ไม่สำเร็จ</div>';
        return;
    }

    if (comments.length === 0) {
        commentListDiv.innerHTML = '<div style="color: #777; font-size: 13px; text-align: center; padding: 10px;">ยังไม่มีคอมเมนต์ เป็นคนแรกที่คอมเมนต์เลย!</div>';
        return;
    }

    commentListDiv.innerHTML = '';
    comments.forEach(comment => {
        const commentAvatar = avatarMap[comment.author_avatar] || '🤖';
        
        let commentActionHtml = '';
        if (currentUser && comment.user_id === currentUser.id) {
            commentActionHtml = `
                <div class="action-dropdown" style="margin-left: auto;">
                    <button class="dots-btn" style="font-size: 20px;">⋮</button>
                    <div class="action-dropdown-content">
                        <button class="delete-btn" onclick="deleteWikiComment('${comment.id}')">🗑️ ลบคอมเมนต์</button>
                    </div>
                </div>
            `;
        }

        const commentHtml = `
            <div class="comment-item" style="display: flex; align-items: flex-start; margin-top: 10px;">
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

async function submitWikiComment() {
    if (!currentUser) {
        showAlert("แจ้งเตือน", "กรุณาล็อกอินก่อนคอมเมนต์ครับ!");
        return;
    }
    if (!activePageId) return;

    const inputField = document.getElementById('wikiCommentInput');
    const content = inputField.value.trim();
    if (!content) return; 

    inputField.disabled = true;
    const metadata = currentUser.user_metadata;

    const { error } = await supabaseClient.from('wiki_comments').insert([{ 
        wiki_page_id: activePageId,
        user_id: currentUser.id, 
        author_name: metadata.display_name || 'Player', 
        author_avatar: metadata.avatar_id || 'robot_default', 
        content: content 
    }]);

    inputField.disabled = false;

    if (error) {
        showAlert("ข้อผิดพลาด", "ส่งคอมเมนต์ไม่สำเร็จ");
    } else {
        inputField.value = '';
        
        // อัปเดตตัวเลขคอมเมนต์บนปุ่มทันที
        const commentCountText = document.getElementById('wikiCommentCount');
        if (commentCountText) {
            commentCountText.innerText = parseInt(commentCountText.innerText) + 1;
        }
        
        loadWikiComments();
    }
}

async function deleteWikiComment(commentId) {
    if (!confirm("คุณแน่ใจหรือไม่ที่จะลบคอมเมนต์นี้?")) return;
    
    const { error } = await supabaseClient.from('wiki_comments').delete().eq('id', commentId);
    
    if (error) {
        showAlert("ข้อผิดพลาด", "ลบไม่สำเร็จ: " + error.message);
    } else {
        // อัปเดตตัวเลขคอมเมนต์บนปุ่ม
        const commentCountText = document.getElementById('wikiCommentCount');
        if (commentCountText && parseInt(commentCountText.innerText) > 0) {
            commentCountText.innerText = parseInt(commentCountText.innerText) - 1;
        }
        loadWikiComments();
    }
}

// ==========================================
// ส่วนที่ 5: ระบบแอดมิน (สร้าง/แก้ไข/ลบ ข้อมูล)
// ==========================================

// เปิด/ปิด Modal เพิ่มหน้า
function openAddModal() {
    const nextOrder = wikiPages.length > 0 ? Math.max(...wikiPages.map(p => p.order_num)) + 1 : 1;
    
    document.getElementById('addTitleInput').value = '';
    document.getElementById('addOrderInput').value = nextOrder;
    
    // ทำลาย Editor.js ตัวเดิมก่อน (ถ้ามี) เพื่อสร้างใหม่บน Modal ที่กำลังเปิด
    if (editorAdd) {
        try {
            editorAdd.destroy();
        } catch(e) {
            console.error(e);
        }
        editorAdd = null;
    }
    
    // แสดง Modal ก่อนเพื่อให้ Container มีมิติก่อนที่ Editor.js จะเรนเดอร์
    document.getElementById('addWikiModal').style.display = 'flex';
    
    // โดนเรียกให้สร้างใหม่เมื่อมีพื้นที่ให้เรนเดอร์
    initEditorJS();
}

function closeAddModal() {
    document.getElementById('addWikiModal').style.display = 'none';
}

// บันทึกหน้าใหม่ลงในฐานข้อมูล Supabase
async function submitAddWiki() {
    const title = document.getElementById('addTitleInput').value.trim();
    const orderNum = parseInt(document.getElementById('addOrderInput').value) || 1;
    let editorData;
    try {
        editorData = await editorAdd.save();
        // HACK: Extract custom dragged sizes for images
        editorData.blocks.forEach(block => {
            if (block.type === 'image') {
                const domBlock = document.querySelector(`#addEditorContainer .ce-block[data-id="${block.id}"] .image-tool__image`);
                if (domBlock && domBlock.style.width) {
                    block.data.customWidth = domBlock.style.width;
                    block.data.customHeight = domBlock.style.height;
                }
            }
        });
    } catch(e) {
        showAlert("เกิดข้อผิดพลาด", "ดึงข้อมูลจาก Editor ไม่สำเร็จ");
        return;
    }
    const content = JSON.stringify(editorData);

    // เช็กว่าเนื้อหาว่างเปล่าไหม
    if (!title || !editorData || editorData.blocks.length === 0) {
        showAlert("เกิดข้อผิดพลาด", "กรุณากรอกหัวเรื่องและเนื้อหาให้ครบถ้วน");
        return;
    }

    const { data, error } = await supabaseClient
        .from('wiki_pages')
        .insert([{
            title: title,
            content: content,
            order_num: orderNum
        }])
        .select();

    if (error) {
        showAlert("บันทึกไม่สำเร็จ", error.message);
    } else {
        closeAddModal();
        showAlert("สำเร็จ!", "เพิ่มหน้าสารานุกรมใหม่เรียบร้อยแล้ว");
        // กำหนดให้หน้าที่เพิ่งสร้างเป็นหน้า Active ทันที
        if (data && data[0]) {
            activePageId = data[0].id;
        }
        loadWikiPages();
    }
}

// เปิด/ปิด Modal แก้ไขหน้า
function openEditModal() {
    const page = wikiPages.find(p => p.id === activePageId);
    if (!page) return;

    document.getElementById('editTitleInput').value = page.title;
    document.getElementById('editOrderInput').value = page.order_num;
    
    // นำเนื้อหาเก่าไปใส่ใน Editor.js
    if (editorEdit) {
        try {
            editorEdit.destroy();
        } catch(e) {
            console.error(e);
        }
        editorEdit = null;
    }
    
    let blocks = [];
    if (page.content && page.content.startsWith('{')) {
        try {
            blocks = JSON.parse(page.content).blocks || [];
        } catch(e) {}
    } else if (page.content) {
        // ดึงข้อความดิบๆ ออกมาจาก HTML เก่า เพื่อให้แก้ไขต่อได้
        let tmpDiv = document.createElement('div');
        tmpDiv.innerHTML = page.content;
        let plainText = tmpDiv.innerText || tmpDiv.textContent || '';
        blocks = [
            { type: 'paragraph', data: { text: "⚠️ <i>(ระบบดึงข้อความเก่ามาให้บางส่วน กรุณาจัดหน้าใหม่ด้วย Block)</i>" } },
            { type: 'paragraph', data: { text: plainText.replace(/\n/g, '<br>') } }
        ];
    }

    const editContainer = document.getElementById('editEditorContainer');
    if (!editContainer) {
        console.error("editEditorContainer element not found in DOM!");
        return;
    }

    editorEdit = new EditorJS({
        holder: editContainer,
        data: { blocks: blocks },
        tools: getEditorTools(),
        onReady: () => {
            setTimeout(() => {
                blocks.forEach(block => {
                    if (block.type === 'image' && block.data.customWidth) {
                        const domBlock = document.querySelector(`#editEditorContainer .ce-block[data-id="${block.id}"] .image-tool__image`);
                        if (domBlock) {
                            domBlock.style.width = block.data.customWidth;
                            domBlock.style.height = block.data.customHeight;
                        }
                    }
                });
            }, 300);
        }
    });
    
    document.getElementById('editWikiModal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('editWikiModal').style.display = 'none';
}

// บันทึกการอัปเดตหน้าข้อมูลไปยังฐานข้อมูล
async function submitEditWiki() {
    const title = document.getElementById('editTitleInput').value.trim();
    const orderNum = parseInt(document.getElementById('editOrderInput').value) || 1;
    let editorData;
    try {
        editorData = await editorEdit.save();
        // HACK: Extract custom dragged sizes for images
        editorData.blocks.forEach(block => {
            if (block.type === 'image') {
                const domBlock = document.querySelector(`#editEditorContainer .ce-block[data-id="${block.id}"] .image-tool__image`);
                if (domBlock && domBlock.style.width) {
                    block.data.customWidth = domBlock.style.width;
                    block.data.customHeight = domBlock.style.height;
                }
            }
        });
    } catch(e) {
        return;
    }
    const content = JSON.stringify(editorData);

    if (!title || !editorData || editorData.blocks.length === 0) {
        showAlert("เกิดข้อผิดพลาด", "กรุณากรอกหัวเรื่องและเนื้อหาให้ครบถ้วน");
        return;
    }

    const { error } = await supabaseClient
        .from('wiki_pages')
        .update({
            title: title,
            content: content,
            order_num: orderNum
        })
        .eq('id', activePageId);

    if (error) {
        showAlert("อัปเดตไม่สำเร็จ", error.message);
    } else {
        closeEditModal();
        showAlert("สำเร็จ!", "แก้ไขข้อมูลเรียบร้อยแล้ว");
        loadWikiPages();
    }
}

// ลบหน้าข้อมูลจากฐานข้อมูล Supabase
async function deleteActiveWiki() {
    const page = wikiPages.find(p => p.id === activePageId);
    if (!page) return;

    if (!confirm(`คุณต้องการลบหน้า "${page.title}" ใช่หรือไม่? ไม่สามารถย้อนกลับได้`)) return;

    const { error } = await supabaseClient
        .from('wiki_pages')
        .delete()
        .eq('id', activePageId);

    if (error) {
        showAlert("ลบไม่สำเร็จ", error.message);
    } else {
        showAlert("สำเร็จ!", "ลบหน้าสารานุกรมเรียบร้อยแล้ว");
        activePageId = null; // รีเซ็ตรหัสหน้าปัจจุบัน
        loadWikiPages();
    }
}

// ==========================================
// ส่วนที่ 6: กล่อง Popup แจ้งเตือนของระบบ
// ==========================================

function showAlert(title, message) {
    document.getElementById('alertTitle').innerText = title;
    document.getElementById('alertMessage').innerText = message;
    document.getElementById('customAlert').style.display = 'flex';
}

function closeAlert() {
    document.getElementById('customAlert').style.display = 'none';
}

// ==========================================
// ส่วนที่ 7: ตั้งค่า Editor.js
// ==========================================

// ==========================================
// บีบอัดและปรับขนาดรูปภาพก่อน Upload (800×600 max)
// ==========================================
function compressImage(file, maxWidth, maxHeight, quality) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // คำนวณสัดส่วนให้พอดีกับขนาดสูงสุด
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => resolve(blob),
                    'image/jpeg',
                    quality
                );
            };
        };
    });
}

class SupabaseImageAdapter {
    constructor(config) {
        this.supabase = config.supabaseClient;
    }
    async uploadByFile(file) {
        const compressedFile = await compressImage(file, 800, 600, 0.75);
        const fileExt = 'jpg';
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
        
        const { data, error } = await this.supabase.storage
            .from('wiki_images')
            .upload(fileName, compressedFile);

        if (error) {
            showAlert('อัปโหลดรูปไม่สำเร็จ', error.message);
            return { success: 0 };
        }

        const { data: publicUrlData } = this.supabase.storage
            .from('wiki_images')
            .getPublicUrl(fileName);

        return {
            success: 1,
            file: {
                url: publicUrlData.publicUrl
            }
        };
    }
    
    async uploadByUrl(url) {
        return {
            success: 1,
            file: { url: url }
        };
    }
}

function getEditorTools() {
    const paragraphClass = typeof Paragraph === 'function' ? Paragraph : null;
    const headerClass = typeof Header === 'function' ? Header : null;
    const listClass = typeof EditorjsList === 'function' ? EditorjsList : (typeof List === 'function' ? List : null);
    const imageClass = typeof ImageTool === 'function' ? ImageTool : null;
    const alignmentClass = typeof AlignmentBlockTune === 'function' ? AlignmentBlockTune : (window.AlignmentBlockTune ? window.AlignmentBlockTune : null);
    const colorClass = typeof ColorPlugin === 'function' ? ColorPlugin : (window.ColorPlugin ? window.ColorPlugin : null);

    const tools = {};
    
    if (alignmentClass) {
        tools.alignmentTune = {
            class: alignmentClass,
            config: {
                default: "left",
                blocks: {
                    header: 'left',
                    list: 'left'
                }
            }
        };
    }
    
    if (colorClass) {
        tools.Color = {
            class: colorClass,
            config: {
                colorCollections: ['#ffffff', '#e0e0e0', '#ff4444', '#4caf50', '#2196f3', '#ffeb3b', '#ff9800', '#9c27b0', '#00bcd4', '#1e1e1e', '#383838'],
                defaultColor: '#ff4444',
                type: 'text',
                customPicker: true
            }
        };
        tools.Marker = {
            class: colorClass,
            config: {
                defaultColor: '#ffff00',
                type: 'marker'
            }
        };
    }

    if (paragraphClass) {
        tools.paragraph = {
            class: paragraphClass,
            inlineToolbar: true,
            tunes: alignmentClass ? ['alignmentTune'] : []
        };
    }
    if (headerClass) {
        tools.header = {
            class: headerClass,
            config: { placeholder: 'พิมพ์หัวข้อตรงนี้...', levels: [2, 3, 4], defaultLevel: 2 },
            tunes: alignmentClass ? ['alignmentTune'] : []
        };
    }
    if (listClass) {
        tools.list = {
            class: listClass,
            config: { defaultStyle: 'unordered' }
        };
    }
    if (imageClass) {
        tools.image = {
            class: imageClass,
            config: {
                uploader: {
                    uploadByFile(file) {
                        return new SupabaseImageAdapter({ supabaseClient: supabaseClient }).uploadByFile(file);
                    },
                    uploadByUrl(url) {
                        return new SupabaseImageAdapter({ supabaseClient: supabaseClient }).uploadByUrl(url);
                    }
                }
            },
            tunes: alignmentClass ? ['alignmentTune'] : []
        };
    }
    return tools;
}

function initEditorJS() {
    if (typeof EditorJS === 'undefined') {
        console.error("EditorJS is not defined. Make sure CDN is loaded.");
        return;
    }
    const addContainer = document.getElementById('addEditorContainer');
    if (!addContainer) {
        console.error("addEditorContainer element not found in DOM!");
        return;
    }
    editorAdd = new EditorJS({
        holder: addContainer,
        placeholder: 'พิมพ์เนื้อหาหรือกด Tab เพื่อเลือกกล่องเครื่องมือ',
        tools: getEditorTools(),
        onChange: () => {
            if (editorAdd && typeof editorAdd.save === 'function') {
                editorAdd.save().then((outputData) => {
                    localStorage.setItem('editorjs_autosave_basicinfo', JSON.stringify(outputData));
                }).catch(e => console.error(e));
            }
        },
        onReady: () => {
            const savedData = localStorage.getItem('editorjs_autosave_basicinfo');
            if (savedData) {
                // สำหรับฟีเจอร์โหลดข้อมูลที่ค้างอยู่ (ในอนาคต)
            }
        }
    });
}

// ==========================================
// ฟังก์ชันแปลง JSON จาก Editor.js เป็น HTML
// ==========================================
function parseEditorJsData(contentStr) {
    if (!contentStr) return '';
    
    if (!contentStr.startsWith('{')) {
        if (!contentStr.includes('<') && !contentStr.includes('>')) {
            return escapeHtml(contentStr).replace(/\n/g, '<br>');
        }
        return contentStr;
    }

    try {
        const data = JSON.parse(contentStr);
        let html = '';
        if (!data.blocks) return '';
        
        data.blocks.forEach(block => {
            let alignStyle = '';
            if (block.tunes && block.tunes.alignmentTune && block.tunes.alignmentTune.alignment) {
                alignStyle = ` style="text-align: ${block.tunes.alignmentTune.alignment};"`;
            }

            switch (block.type) {
                case 'header':
                    html += `<h${block.data.level}${alignStyle}>${block.data.text}</h${block.data.level}>`;
                    break;
                case 'paragraph':
                    html += `<p${alignStyle}>${block.data.text}</p>`;
                    break;
                case 'list':
                    html += renderList(block.data.items, block.data.style);
                    break;
                case 'image':
                    const caption = block.data.caption ? `<figcaption style="text-align:center; color:#888; font-size:12px;">${block.data.caption}</figcaption>` : '';
                    const figureAlign = alignStyle ? alignStyle : ' style="text-align: center;"';
                    let imgStyle = 'max-width:100%; border-radius:8px;';
                    if (block.data.customWidth) {
                        imgStyle += ` width:${block.data.customWidth};`;
                    } else if (!block.data.stretched) {
                        imgStyle += ` max-width:60%;`; // Default size if not stretched
                    }
                    if (block.data.customHeight) {
                        imgStyle += ` height:${block.data.customHeight};`;
                    }
                    html += `<figure${figureAlign}><img src="${block.data.file.url}" style="${imgStyle}" alt="image" />${caption}</figure>`;
                    break;
            }
        });
        return html;
    } catch (e) {
        return contentStr;
    }
}

// ฟังก์ชันช่วยเรนเดอร์รายการ List (รองรับทริค nested list และข้อมูลเก่าที่เป็น string)
function renderList(items, style) {
    if (!items || items.length === 0) return '';
    const listTag = style === 'ordered' ? 'ol' : 'ul';
    let html = `<${listTag}>`;
    items.forEach(item => {
        const content = typeof item === 'object' ? (item.content || '') : item;
        const subItems = (typeof item === 'object' && item.items) ? item.items : [];
        
        html += `<li>${content}`;
        if (subItems && subItems.length > 0) {
            html += renderList(subItems, style);
        }
        html += `</li>`;
    });
    html += `</${listTag}>`;
    return html;
}

// สั่งให้เช็กสถานะการล็อกอินและโหลดข้อมูลเมื่อโหลดหน้าเว็บ
document.addEventListener('DOMContentLoaded', () => {
    // ไม่พรีโหลด Editor.js ตอนโหลดหน้าเว็บ (รอโหลดตอนเปิด Modal เท่านั้น เพื่อป้องกันการพังของขนาดกล่องแก้ไข)
});
checkAuth();
