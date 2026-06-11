// --- ส่วนที่ 1: ตั้งค่าการเชื่อมต่อ ---
const SUPABASE_URL = 'https://pvnrztgtnsmyhixkawgo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2bnJ6dGd0bnNteWhpeGthd2dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMDI0MjMsImV4cCI6MjA5NTc3ODQyM30.clc8OgLUlJ9nM7BKxf6oXIA8B6sWRotO1VId446FNnY';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
console.log("เชื่อมต่อ Supabase สำเร็จ!", supabaseClient);

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

// ฟังก์ชันสมัครสมาชิก
async function registerUser() {
    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;

    if (!email || !password) {
        showAlert("เกิดข้อผิดพลาด", "กรุณากรอก Email และ Password ให้ครบถ้วน");
        return;
    }

    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
    });

    if (error) {
        showAlert("สมัครสมาชิกไม่สำเร็จ", error.message);
    } else {
        showAlert("สำเร็จ!", "สมัครสมาชิกเรียบร้อยแล้ว ตอนนี้คุณสามารถ Login ได้เลย");
    }
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

    const email = emailInput.value;
    const name = nameInput.value;
    const password = passwordInput.value;

    if (!email || !name || !password) {
        showAlert("เกิดข้อผิดพลาด", "กรุณากรอกข้อมูลให้ครบทุกช่อง");
        return;
    }

    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
        options: {
            data: { display_name: name, avatar_id: 'robot_default' }
        }
    });

    if (error) {
        showAlert("สมัครสมาชิกไม่สำเร็จ", error.message);
    } else {
        showAlert("สำเร็จ!", "สมัครสมาชิกเรียบร้อยแล้ว กำลังพากลับไปหน้าเข้าสู่ระบบ...");
        setTimeout(() => { window.location.href = 'login.html'; }, 1500);
    }
}