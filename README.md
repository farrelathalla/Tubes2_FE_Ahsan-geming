# 🧪 Algoritma BFS dan DFS pada Little Alchemy 2
# Tugas Besar 2 Strategi Algoritma IF2211

![Desain tanpa judul (2)](https://github.com/user-attachments/assets/9083415c-4e4d-40bb-9dde-8ca4ebbc9138)


## 📌 Deskripsi  
Repository ini berisi **frontend** untuk **Little Alchemy 2 Finder**, yang memungkinkan pengguna mencari elemen menggunakan tiga algoritma pencarian: **Breadth-First Search (BFS)**, **Depth-First Search (DFS)**, dan **Bidirectional Search (BDS)**. Frontend ini bertanggung jawab untuk menangani tampilan daari permintaan, memproses pencarian, dan mengembalikan jalur untuk pembuatan elemen.

## 🛠 Struktur Program
Berikut adalah struktur program tugas kecil ini :
```sh
/Tubes2_FE_Ahsan-geming
├── /doc              # Laporan
├── /components       # Komponen website
├── /app              # Halaman utama
├── /public           # Gambar dan font
└── README.md         # Dokumentasi projek
```

## Getting Started 🌐
Berikut instruksi instalasi dan penggunaan program

### Prerequisites

Pastikan anda sudah memiliki:
- **Node.js**: [Link to install](https://nodejs.org/)
- **npm** or **yarn**: [Link to npm](https://www.npmjs.com/get-npm) | [Link to yarn](https://classic.yarnpkg.com/en/docs/install/)
- **Docker Desktop**

### Installation
1. **Clone repository ke dalam suatu folder**

```bash
  git clone https://github.com/farrelathalla/Tubes2_FE_Ahsan-geming.git
```

2. **Nyalakan Docker Desktop (jika menggunakan Docker)**

3. **Pergi ke directory /Tubes2_FE_Ahsan-geming**

```bash
  cd Tubes2_FE_Ahsan-geming
```

4. **Buatlah .env.local dan .env (jika deploy) sesuai dengan .env.example**

5. **Compile program**

```bash
  docker build -t nextjs-frontend .
```

atau tanpa Docker
```bash
npm install
```

6. **Jalankan program**

```bash
  docker run -p 3000:3000 nextjs-frontend
```

atau tanpa Docker

```bash
npm run dev
```

## **📌 Cara Penggunaan**

1. **Jalankan program** melalui terminal atau IDE.
2. **Nyalakan backend** terlebih dahulu, lalu **jalankan frontend**
3. Pilih metode BFS/DFS/BDS serta Shortest/Multiple
4. Pilih elemen yang ingin dicari
5. Klik search

## **✍️ Author**
| Name                              | NIM        |
|-----------------------------------|------------|
| Ahsan Malik Al Farisi             | 13523074   |
| Kefas Kurnia Jonathan             | 13523113   |
| Farrel Athalla Putra              | 13523118   |
