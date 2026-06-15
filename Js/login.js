// --- ส่วนที่ 1: ตั้งค่าการเชื่อมต่อ ---
const SUPABASE_URL = 'https://pvnrztgtnsmyhixkawgo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2bnJ6dGd0bnNteWhpeGthd2dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMDI0MjMsImV4cCI6MjA5NTc3ODQyM30.clc8OgLUlJ9nM7BKxf6oXIA8B6sWRotO1VId446FNnY';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ฟังก์ชันสั่งให้ Popup โชว์
function showAlert(title, message) {
    document.getElementById('alertTitle').innerText = title;
    document.getElementById('alertMessage').innerText = message;
    document.getElementById('customAlert').style.display = 'flex';
}

// ฟังก์ชันปิด Popup
function closeAlert() {
    document.getElementById('customAlert').style.display = 'none';
}

// โหลดหน้าเพจ เช็คว่าล็อกอินอยู่แล้วหรือไม่
window.onload = async () => {
    // ถ้าหน้าปัจจุบันคือ reset_password.html ไม่ต้องเด้งกลับไป main.html ทันที 
    // เพราะเราอาจจะมี session จากลิงก์
    if (window.location.pathname.includes('reset_password.html')) {
        return; 
    }
    
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        window.location.href = 'main.html';
    }
};

// เปิด/ปิด Modal ลืมรหัสผ่าน
function openForgotModal() {
    document.getElementById('forgotModal').style.display = 'flex';
}
function closeForgotModal() {
    document.getElementById('forgotModal').style.display = 'none';
}



// ฟังก์ชันเข้าสู่ระบบ
async function loginUser() {
    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;

    if (!email || !password) {
        showAlert("เกิดข้อผิดพลาด", "กรุณากรอก Email และ Password ให้ครบถ้วน");
        return;
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        showAlert("เข้าสู่ระบบไม่สำเร็จ", error.message);
    } else {
        showAlert("สำเร็จ!", "เข้าสู่ระบบเรียบร้อย กำลังพาท่านไปหน้าหลัก...");
        setTimeout(() => {
            window.location.href = 'main.html';
        }, 1000); 
    }
}
// ฟังก์ชันสมัครสมาชิก (ทำงานในหน้า register.html)
async function registerUser() {
    // ใช้ ID ของหน้า Register
    const emailInput = document.getElementById('regEmailInput');
    const nameInput = document.getElementById('regNameInput');
    const passwordInput = document.getElementById('regPasswordInput');

    // เช็กก่อนว่ามีช่องเหล่านี้อยู่ในหน้าเว็บไหม (ป้องกัน Error)
    if (!emailInput || !nameInput || !passwordInput) return;

    const email = emailInput.value.trim();
    const name = nameInput.value.trim();
    const password = passwordInput.value;

    if (!email || !name || !password) {
        showAlert("เกิดข้อผิดพลาด", "กรุณากรอกข้อมูลให้ครบทุกช่อง");
        return;
    }

    // เช็กรูปแบบอีเมลเบื้องต้น
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showAlert("รูปแบบอีเมลไม่ถูกต้อง", "กรุณาระบุอีเมลที่สามารถใช้งานได้จริง (เช่น test@gmail.com)");
        return;
    }

    // เช็กความยาวรหัสผ่าน (Supabase บังคับขั้นต่ำ 6 ตัวอักษร)
    if (password.length < 6) {
        showAlert("รหัสผ่านสั้นเกินไป", "กรุณาตั้งรหัสผ่านอย่างน้อย 6 ตัวอักษร");
        return;
    }

    const redirectUrl = window.location.origin + window.location.pathname.replace('register.html', 'verified.html');

    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
        options: {
            data: { display_name: name, avatar_id: 'robot_default' },
            emailRedirectTo: redirectUrl
        }
    });

    if (error) {
        showAlert("สมัครสมาชิกไม่สำเร็จ", error.message);
    } else {
        if (data.session) {
            // ถ้าระบบไม่ได้บังคับยืนยันอีเมล จะได้ session กลับมาเลย
            showAlert("สำเร็จ!", "สมัครสมาชิกเรียบร้อยแล้ว กำลังพากลับไปหน้าเข้าสู่ระบบ...");
            setTimeout(() => { window.location.href = 'login.html'; }, 2000);
        } else {
            // ถ้าระบบบังคับยืนยันอีเมล session จะเป็น null
            showAlert("สำเร็จ!", "กรุณาตรวจสอบอีเมลของคุณ และคลิกลิงก์ยืนยันตัวตน ก่อนเข้าสู่ระบบ (หากไม่พบให้ดูในจดหมายขยะ)");
            setTimeout(() => { window.location.href = 'login.html'; }, 3000);
        }
    }
}

// ฟังก์ชันส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมล (ทำงานในหน้า login.html Modal)
async function sendPasswordReset() {
    const email = document.getElementById('forgotEmailInput').value.trim();
    if (!email) {
        showAlert("เกิดข้อผิดพลาด", "กรุณากรอกอีเมลของคุณ");
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showAlert("รูปแบบอีเมลไม่ถูกต้อง", "กรุณาระบุอีเมลที่สามารถใช้งานได้จริง");
        return;
    }

    // กำหนด URL ของหน้าเว็บเรา เพื่อให้ Supabase ส่งผู้ใช้กลับมาถูกหน้าเมื่อกดลิงก์ในอีเมล
    // ปกติถ้าใช้ GitHub Pages หรือ Localhost ให้แก้เป็นที่อยู่ปัจจุบันของหน้า reset_password.html
    const redirectUrl = window.location.origin + window.location.pathname.replace('login.html', 'reset_password.html');

    const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl
    });

    if (error) {
        showAlert("ส่งลิงก์ไม่สำเร็จ", error.message);
    } else {
        closeForgotModal();
        showAlert("ส่งลิงก์สำเร็จ!", "กรุณาตรวจสอบอีเมลของคุณเพื่อตั้งรหัสผ่านใหม่ (หากไม่พบให้ดูในโฟลเดอร์จดหมายขยะ)");
        document.getElementById('forgotEmailInput').value = '';
    }
}

// ฟังก์ชันอัปเดตรหัสผ่านใหม่ (ทำงานในหน้า reset_password.html)
async function updateNewPassword() {
    const newPassword = document.getElementById('newPasswordInput').value;
    const confirmPassword = document.getElementById('confirmPasswordInput').value;

    if (!newPassword || !confirmPassword) {
        showAlert("เกิดข้อผิดพลาด", "กรุณากรอกรหัสผ่านให้ครบทั้งสองช่อง");
        return;
    }

    if (newPassword.length < 6) {
        showAlert("รหัสผ่านสั้นเกินไป", "กรุณาตั้งรหัสผ่านอย่างน้อย 6 ตัวอักษร");
        return;
    }

    if (newPassword !== confirmPassword) {
        showAlert("เกิดข้อผิดพลาด", "รหัสผ่านทั้งสองช่องไม่ตรงกัน!");
        return;
    }

    // เมื่อผู้ใช้กดลิงก์มาจากอีเมล Supabase จะยืนยันตัวตนให้ชั่วคราวแล้ว
    // เราสามารถอัปเดตรหัสผ่านได้เลย
    const { data, error } = await supabaseClient.auth.updateUser({
        password: newPassword
    });

    if (error) {
        showAlert("เปลี่ยนรหัสผ่านไม่สำเร็จ", error.message);
    } else {
        showAlert("สำเร็จ!", "รหัสผ่านถูกเปลี่ยนเรียบร้อยแล้ว กำลังพากลับไปหน้าเข้าสู่ระบบ...");
        // บังคับ Log out จาก session ชั่วคราว เพื่อให้เข้าสู่ระบบใหม่ด้วยรหัสใหม่
        await supabaseClient.auth.signOut();
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
    }
}