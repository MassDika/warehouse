const signUpButton = document.getElementById('signUp');
const signInButton = document.getElementById('signIn');
const container = document.getElementById('container');

// Animasi panel
signUpButton.addEventListener('click', () => {
    container.classList.add("right-panel-active");
});
signInButton.addEventListener('click', () => {
    container.classList.remove("right-panel-active");
});

// Animasi mouse
document.addEventListener('mousemove', function(e) {
    const star = document.createElement('div');
    star.className = 'star-trail';
    star.style.left = (e.clientX - 5) + 'px';
    star.style.top = (e.clientY - 5) + 'px';
    document.body.appendChild(star);
    setTimeout(() => star.remove(), 800);
});

// Login form
const loginForm = document.querySelector('.sign-in-container form');
if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const username = loginForm.querySelector('input[type="text"]').value.trim();
        const password = loginForm.querySelector('input[type="password"]').value;
        fetch('http://localhost:3000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        })
        .then(res => res.json())
        .then(user => {
            if (user && user.id) {
                // Simpan data user ke localStorage
                localStorage.setItem('user', JSON.stringify(user));
                localStorage.setItem('stakeholder', user.role);
                localStorage.setItem('username', user.nama);
                Swal.fire({
                    icon: 'success',
                    title: 'Login Berhasil!',
                    text: `Selamat datang, ${user.nama}!`,
                    timer: 1500,
                    showConfirmButton: true,
                    confirmButtonText: 'OK'
                });
                setTimeout(() => window.location.href = '/view/index.html', 1600);
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Login Gagal',
                    text: user.error || 'Username atau password salah!'
                });
            }
        })
        .catch(() => {
            Swal.fire({
                icon: 'error',
                title: 'Server Error',
                text: 'Gagal terhubung ke server!'
            });
        });
    });
}