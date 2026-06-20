const fs = require('fs');
const path = 'C:/Users/xfris/Desktop/Foxd/VSCode/2dProjectTest[Web]/Js';
const cssPath = 'C:/Users/xfris/Desktop/Foxd/VSCode/2dProjectTest[Web]/Css/main.css';
const htmlPath = 'C:/Users/xfris/Desktop/Foxd/VSCode/2dProjectTest[Web]/Html';

// 1. Fix CSS
let css = fs.readFileSync(cssPath, 'utf8');
if (!css.includes('textarea, input { font-family:')) {
    css += '\n\ntextarea, input { font-family: \'Germania\', \'ChakraPetch\', sans-serif !important; }\n';
    fs.writeFileSync(cssPath, css, 'utf8');
}

// 2. Fix JS Files
const jsFiles = ['community.js', 'post.js', 'profile.js'];
jsFiles.forEach(file => {
    let content = fs.readFileSync(path + '/' + file, 'utf8');
    
    // Add showAlert if missing
    if (!content.includes('function showAlert(')) {
        content += `\n\nfunction showAlert(title, message) {
    const safeMessage = typeof escapeHtml === 'function' ? escapeHtml(message) : message;
    const alertTitle = document.getElementById('alertTitle');
    const alertMessage = document.getElementById('alertMessage');
    const customAlert = document.getElementById('customAlert');
    if(alertTitle) alertTitle.innerText = title;
    if(alertMessage) alertMessage.innerHTML = safeMessage.replace(/\\n/g, '<br>');
    if(customAlert) customAlert.style.display = 'flex';
}
function closeAlert() {
    const customAlert = document.getElementById('customAlert');
    if(customAlert) customAlert.style.display = 'none';
}
`;
    }

    // Convert Thai text to English and native alert to showAlert
    content = content.replace(/alert\('ไม่มีสิทธิ์'\)/g, 'showAlert("Permission Denied", "You do not have permission.")');
    content = content.replace(/alert\("ไม่มีสิทธิ์"\)/g, 'showAlert("Permission Denied", "You do not have permission.")');
    content = content.replace(/alert\('เกิดข้อผิดพลาด: ' \+ (.*?)\)/g, 'showAlert("Error", "An error occurred: " + $1)');
    content = content.replace(/alert\("เกิดข้อผิดพลาด: " \+ (.*?)\)/g, 'showAlert("Error", "An error occurred: " + $1)');
    content = content.replace(/alert\('✅ ล้างโพสต์เก่าเรียบร้อยแล้ว!'\)/g, 'showAlert("Success", "Old posts cleaned successfully!")');
    content = content.replace(/alert\("ออกจากระบบเรียบร้อยแล้ว"\)/g, 'showAlert("Success", "Logged out successfully.")');
    content = content.replace(/alert\("กรุณาล็อกอินก่อนดันโพสต์ครับ!"\)/g, 'showAlert("Notice", "Please login to upvote!")');
    content = content.replace(/alert\("อัปเดตไม่สำเร็จ!"\)/g, 'showAlert("Error", "Failed to update upvote!")');
    content = content.replace(/alert\("ลบไม่สำเร็จ: " \+ (.*?)\)/g, 'showAlert("Error", "Failed to delete: " + $1)');
    content = content.replace(/alert\("กรุณาล็อกอินก่อนคอมเมนต์ครับ!"\)/g, 'showAlert("Notice", "Please login to comment!")');
    content = content.replace(/alert\("คอมเมนต์ต้องไม่เกิน 300 ตัวอักษรครับ"\)/g, 'showAlert("Notice", "Comment cannot exceed 300 characters.")');
    content = content.replace(/alert\("ส่งคอมเมนต์ไม่สำเร็จ"\)/g, 'showAlert("Error", "Failed to send comment.")');
    content = content.replace(/alert\("ส่งคอมเมนต์ไม่สำเร็จ: " \+ (.*?)\)/g, 'showAlert("Error", "Failed to send comment: " + $1)');
    content = content.replace(/alert\(\`โพสต์ต้องไม่เกิน 1,000 ตัวอักษรครับ \(ปัจจุบัน: \$\{([^\}]+)\} ตัวอักษร\)\`\)/g, 'showAlert("Notice", `Post cannot exceed 1,000 characters (Current: ${\$1}).`)');
    content = content.replace(/alert\("แก้ไขไม่สำเร็จ: " \+ (.*?)\)/g, 'showAlert("Error", "Failed to edit: " + $1)');
    content = content.replace(/alert\("ลบโพสต์ไม่สำเร็จ: " \+ (.*?)\)/g, 'showAlert("Error", "Failed to delete post: " + $1)');
    content = content.replace(/alert\("กรุณาล็อกอินก่อนโพสต์ครับ!"\)/g, 'showAlert("Notice", "Please login to post!")');
    content = content.replace(/alert\("กรุณาล็อกอินก่อนโพสต์รูปครับ!"\)/g, 'showAlert("Notice", "Please login to post!")');
    content = content.replace(/alert\("โพสต์ไม่สำเร็จ กรุณาลองใหม่"\)/g, 'showAlert("Error", "Failed to post. Please try again.")');
    content = content.replace(/alert\("สร้างโพสต์ไม่สำเร็จ: " \+ (.*?)\)/g, 'showAlert("Error", "Failed to create post: " + $1)');
    content = content.replace(/alert\("อัปเดตโพสต์ไม่สำเร็จ: " \+ (.*?)\)/g, 'showAlert("Error", "Failed to update post: " + $1)');
    content = content.replace(/alert\("ดึงข้อมูลโพสต์ไม่สำเร็จ"\)/g, 'showAlert("Error", "Failed to load post data.")');
    content = content.replace(/alert\("อัปเดตโปรไฟล์ไม่สำเร็จ: " \+ (.*?)\)/g, 'showAlert("Error", "Failed to update profile: " + $1)');

    content = content.replace(/confirm\('ต้องการล้างโพสต์เก่าตามเงื่อนไข \(ไม่มี upvote > 60 วัน \/ มี upvote > 360 วัน\) ใช่หรือไม่\?'\)/g, 'confirm("Are you sure you want to clean old posts? (No upvotes > 60 days / Has upvotes > 360 days)")');
    content = content.replace(/confirm\("คุณแน่ใจหรือไม่ที่จะลบคอมเมนต์นี้\?"\)/g, 'confirm("Are you sure you want to delete this comment?")');
    content = content.replace(/confirm\("ต้องการลบการแจ้งเตือนทั้งหมดใช่หรือไม่\?"\)/g, 'confirm("Are you sure you want to clear all notifications?")');
    content = content.replace(/confirm\("คุณแน่ใจหรือไม่ที่จะลบโพสต์นี้\? \(คอมเมนต์ทั้งหมดจะหายไปด้วย\)"\)/g, 'confirm("Are you sure you want to delete this post? All comments will be deleted too.")');

    content = content.replace(/alert\("([^"]+)"\)/g, 'showAlert("Notice", "$1")');
    content = content.replace(/alert\('([^']+)'\)/g, 'showAlert("Notice", \'$1\')');

    fs.writeFileSync(path + '/' + file, content, 'utf8');
});

// 3. Fix HTML Placeholders in Wiki JS files
const wikiJsFiles = ['basicinfo.js', 'monsterinfo.js', 'weaponinfo.js'];
wikiJsFiles.forEach(file => {
    let content = fs.readFileSync(path + '/' + file, 'utf8');
    content = content.replace(/placeholder="Write a comment about this page\.\.\."/g, 'placeholder="Write a comment..."');
    content = content.replace(/showAlert\("แจ้งเตือน"/g, 'showAlert("Notice"');
    content = content.replace(/showAlert\("ข้อผิดพลาด"/g, 'showAlert("Error"');
    content = content.replace(/showAlert\("สำเร็จ"/g, 'showAlert("Success"');
    content = content.replace(/showAlert\("เข้าสู่ระบบสำเร็จ"/g, 'showAlert("Success"');
    fs.writeFileSync(path + '/' + file, content, 'utf8');
});

// 4. Update Modal in HTML files
const htmlFiles = fs.readdirSync(htmlPath).filter(f => f.endsWith('.html'));
htmlFiles.forEach(file => {
    let content = fs.readFileSync(htmlPath + '/' + file, 'utf8');
    content = content.replace(/<h3 id="alertTitle">แจ้งเตือน<\/h3>/g, '<h3 id="alertTitle">Notice</h3>');
    content = content.replace(/<p id="alertMessage">ข้อความ<\/p>/g, '<p id="alertMessage">Message</p>');
    content = content.replace(/<button([^>]*)>ตกลง<\/button>/g, '<button$1>OK</button>');
    fs.writeFileSync(htmlPath + '/' + file, content, 'utf8');
});

console.log("Done");
