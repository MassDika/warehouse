const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql2');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',      // ganti jika user/password MySQL Anda berbeda
    password: '',
    database: 'wms',
    port: 3307
});

// Fungsi untuk mengenerate id barang
// function generateId(length = 7) {
//     const charts = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
//     let id = '';
//     for (let i = 0; i < length; i++) {
//         id += charts.charAt(Math.floor(Math.random() * charts.length));
//     }
//     return id;
// }

// --- ENDPOINT BARANG ---
// Ambil semua barang
app.get('/api/barang', (req, res) => {
    db.query(
        `SELECT 
            b.id,
            b.kode,
            b.nama,
            b.kategori,
            b.satuan_id,
            s.nama AS satuan,
            b.stok AS stok,
            (b.stok + 
                IFNULL((SELECT SUM(jumlah) FROM barang_keluar WHERE barang_id = b.id),0) - 
                IFNULL((SELECT SUM(jumlah) FROM barang_masuk WHERE barang_id = b.id),0)
            ) AS stok_awal,
            (SELECT SUM(jumlah) FROM barang_masuk WHERE barang_id = b.id) AS masuk,
            (SELECT SUM(jumlah) FROM barang_keluar WHERE barang_id = b.id) AS keluar,
            GREATEST(
                IFNULL((SELECT MAX(tanggal) FROM barang_masuk WHERE barang_id = b.id), '0000-00-00'),
                IFNULL((SELECT MAX(tanggal) FROM barang_keluar WHERE barang_id = b.id), '0000-00-00')
            ) AS tanggal_update
        FROM barang b
        LEFT JOIN satuan s ON b.satuan_id = s.id
        ORDER BY b.nama ASC`,
        (err, results) => {
            if (err) return res.status(500).json({ error: err });
            res.json(results);
        }
    );
});

// Tambah barang
app.post('/api/barang', (req, res) => {
    const { nama, kode, kategori, stok, satuan_id } = req.body;
    db.query('INSERT INTO barang (nama, kode, kategori, stok, satuan_id) VALUES (?, ?, ?, ?, ?)',
        [nama, kode, kategori, stok, satuan_id],
        (err, result) => {
            if (err) {
                console.error('Insert error:', err);
                return res.status(500).json({ error: err });
            }
            res.json({ id: result.insertId, nama, kode, kategori, stok, satuan_id });
        }
    );
});

// Edit barang
app.put('/api/barang/:id', (req, res) => {
    const { nama, kode, kategori, stok, satuan_id } = req.body;
    db.query(
        'UPDATE barang SET nama=?, kode=?, kategori=?, stok=?, satuan_id=? WHERE id=?',
        [nama, kode, kategori, stok, satuan_id, req.params.id],
        (err) => {
            if (err) return res.status(500).json({ error: err });
            res.json({ id: req.params.id, nama, kode, kategori, stok, satuan_id });
        }
    );
});

app.delete('/api/barang/:id', (req, res) => {
    const barangId = req.params.id;
    // Hapus data terkait di barang_masuk
    db.query('DELETE FROM barang_masuk WHERE barang_id=?', [barangId], (err) => {
        if (err) return res.status(500).json({ error: err });
        // Setelah itu hapus barang
        db.query('DELETE FROM barang WHERE id=?', [barangId], (err2) => {
            if (err2) return res.status(500).json({ error: err2 });
            res.json({ success: true });
        });
    });
});
// Tambah barang masuk & update stok barang
app.post('/api/barang-masuk', (req, res) => {
    const { tanggal, barangId, jumlah, kode_rak, supplier, user_id } = req.body;
    db.query(
        'INSERT INTO barang_masuk (tanggal, barang_id, jumlah, kode_rak, supplier, user_id) VALUES (?, ?, ?, ?, ?, ?)',
        [tanggal, barangId, jumlah, kode_rak, supplier, user_id],
        (err, result) => {
            if (err) {
                console.error('Insert barang_masuk error:', err);
                return res.status(500).json({ error: err });
            }
            db.query(
                'UPDATE barang SET stok = stok + ? WHERE id = ?',
                [jumlah, barangId],
                (err2) => {
                    if (err2) {
                        console.error('Update stok error:', err2);
                        return res.status(500).json({ error: err2 });
                    }
                    res.json({ success: true });
                }
            );
        }
    );
});

// Kurangi stok barang saat barang keluar
app.post('/api/barang-keluar', (req, res) => {
    const { barangId, jumlah, namaPemesan } = req.body;
    // 1. Simpan ke tabel barang_keluar
    db.query(
        'INSERT INTO barang_keluar (barang_id, jumlah, nama_pemesan) VALUES (?, ?, ?)',
        [barangId, jumlah, namaPemesan],
        (err, result) => {
            if (err) {
                console.error('Insert barang_keluar error:', err);
                return res.status(500).json({ error: err });
            }
            // 2. Kurangi stok barang
            db.query(
                'UPDATE barang SET stok = stok - ? WHERE id = ? AND stok >= ?',
                [jumlah, barangId, jumlah],
                (err2, result2) => {
                    if (err2) {
                        console.error('Update stok error:', err2);
                        return res.status(500).json({ error: err2 });
                    }
                    if (result2.affectedRows === 0) {
                        return res.status(400).json({ error: 'Stok tidak cukup' });
                    }
                    res.json({ success: true });
                }
            );
        }
    );
});

// --- ENDPOINT BARANG KELUAR ---
app.get('/api/barang-keluar', (req, res) => {
    db.query(
        `SELECT 
            bk.*, 
            b.nama AS nama_barang,
            b.kode AS kode_barang,
            s.nama AS satuan
        FROM barang_keluar bk 
        JOIN barang b ON bk.barang_id = b.id 
        LEFT JOIN satuan s ON b.satuan_id = s.id
        ORDER BY bk.tanggal DESC`,
        (err, results) => {
            if (err) return res.status(500).json({ error: err });
            res.json(results);
        }
    );
});

// --- ENDPOINT USER ---
app.get('/api/user', (req, res) => {
    db.query('SELECT id, nama FROM user', (err, results) => {
        if (err) return res.status(500).json({ error: err });
        res.json(results);
    });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.query(
        'SELECT id, username, role, nama FROM user WHERE username=? AND password=?',
        [username, password],
        (err, results) => {
            if (err) return res.status(500).json({ error: 'Server error' });
            if (results.length === 0) return res.json({ error: 'Username atau password salah!' });
            res.json(results[0]);
        }
    );
});

// --- ENDPOINT SATUAN BARANG ---
// Ambil semua satuan
app.get('/api/satuan', (req, res) => {
    db.query('SELECT id, nama, deskripsi FROM satuan ORDER BY nama ASC', (err, results) => {
        if (err) return res.status(500).json({ error: err });
        res.json(results);
    });
});

// Tambah satuan
app.post('/api/satuan', (req, res) => {
    const { nama, deskripsi } = req.body;
    if (!nama) return res.status(400).json({ error: 'Nama satuan wajib diisi!' });
    db.query('INSERT INTO satuan (nama, deskripsi) VALUES (?, ?)', [nama, deskripsi], (err, result) => {
        if (err) return res.status(500).json({ error: err });
        res.json({ success: true, id: result.insertId });
    });
});

// Edit satuan
app.put('/api/satuan/:id', (req, res) => {
    const { nama, deskripsi } = req.body;
    db.query('UPDATE satuan SET nama=?, deskripsi=? WHERE id=?', [nama, deskripsi, req.params.id], (err, result) => {
        if (err) return res.status(500).json({ error: err });
        res.json({ success: true });
    });
});

// Hapus satuan
app.delete('/api/satuan/:id', (req, res) => {
    db.query('DELETE FROM satuan WHERE id=?', [req.params.id], (err, result) => {
        if (err) return res.status(500).json({ error: err });
        res.json({ success: true });
    });
});

// --- ENDPOINT BARANG MASUK ---
// Ambil semua data barang masuk
app.get('/api/barang-masuk', (req, res) => {
    db.query(
        `SELECT 
            bm.id AS id,
            bm.tanggal,
            b.kode AS kode,
            b.nama AS nama_barang,
            bm.jumlah,
            s.nama AS satuan,
            bm.supplier,
            bm.kode_rak,
            b.kategori,
            u.nama AS petugas
        FROM barang_masuk bm
        JOIN barang b ON bm.barang_id = b.id
        LEFT JOIN satuan s ON b.satuan_id = s.id
        LEFT JOIN user u ON bm.user_id = u.id
        ORDER BY bm.tanggal DESC`,
        (err, results) => {
            if (err) return res.status(500).json({ error: err });
            res.json(results);
        }
    );
});

// Tambah data barang masuk
app.post('/api/barang-masuk', (req, res) => {
    const { tanggal, barangId, jumlah, kode_rak, supplier, user_id } = req.body;
    db.query(
        'INSERT INTO barang_masuk (tanggal, barang_id, jumlah, kode_rak, supplier, user_id) VALUES (?, ?, ?, ?, ?, ?)',
        [tanggal, barangId, jumlah, kode_rak, supplier, user_id],
        (err, result) => {
            if (err) return res.status(500).json({ error: err });
            // Update stok barang setelah insert
            db.query(
                'UPDATE barang SET stok = stok + ? WHERE id = ?',
                [jumlah, barangId],
                (err2) => {
                    if (err2) return res.status(500).json({ error: err2 });
                    res.json({ success: true, id: result.insertId });
                }
            );
        }
    );
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));