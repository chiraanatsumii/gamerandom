const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const gridCanvas = document.getElementById('gridCanvas');
const gridCtx = gridCanvas.getContext('2d');

const UKURAN_BLOK = 20;
const LEBAR_PAPAN = 10;
const TINGGI_PAPAN = 20;

let papanPermainan = [];
let bentukSaatIni = null;
let bentukBerikutnya = null;
let skor = 0;
let totalBaris = 0;
let level = 1;
let rekorTertinggi = parseInt(localStorage.getItem('tetrisHighScore')) || 0;
let gameJalan = false;
let gameJeda = false;
let waktuTerakhir = 0;
let spasiDitekan = false;

let intervalGerakSentuh = null;
let delayJatuhSentuh = 100;
let modeGame = 'tetris';
let papanBlockBlast = [];
let pilihanBentuk = [];
let bentukTerpilih = null;
let animasiBlast = null;
let hoverBlast = null;
let dragBlast = null;
let hantuBlast = null;
let lewatiKlikDrag = null;
let timerPerayaanBlast = null;
let animasiBunga = null;
let frameBunga = null;
let animasiKalah = null;
let waktuAngkatTetris = 0;

const UKURAN_PAPAN_BLAST = 8;
const UKURAN_SEL_BLAST = 40;
const BENTUK_BLAST = [
    [[1]],
    [[1, 1]],
    [[1], [1]],
    [[1, 1, 1]],
    [[1], [1], [1]],
    [[1, 1], [1, 1]],
    [[1, 0], [1, 1]],
    [[0, 1], [1, 1]],
    [[1, 1, 1], [0, 1, 0]],
    [[1, 1, 1], [1, 0, 0]],
    [[1, 1, 1], [0, 0, 1]],
    [[1, 1, 1, 1]],
    [[1], [1], [1], [1]],
    [[1, 1, 1], [1, 1, 1], [1, 1, 1]]
];
const WARNA_BLAST = ['#f26b5b', '#f2bd4b', '#40b8a0', '#6388e8', '#c879cf'];

function animasikanTekan(elemen) {
    if (!elemen || typeof elemen.animate !== 'function') return;
    elemen.animate([
        { transform: 'translateY(0) scale(1)' },
        { transform: 'translateY(-10px) scale(1.08)', offset: 0.55 },
        { transform: 'translateY(-5px) scale(1.04)' }
    ], { duration: 340, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1.25)' });
}

function angkatBentukTetris(elemen) {
    if (!gameJalan || gameJeda) return;
    waktuAngkatTetris = performance.now();
    animasikanTekan(elemen);
    gambarPapan();
}

function resetGameOver() {
    if (animasiKalah) {
        animasiKalah.cancel();
        animasiKalah = null;
    }
    const overlay = document.getElementById('gameOver');
    overlay.style.display = 'none';
    overlay.classList.remove('blast-lost');
    document.getElementById('gameOverTitle').textContent = 'GAME OVER';
    document.getElementById('gameOverMessage').textContent = '';
    document.getElementById('playAgainButton').textContent = 'Main Lagi';
}

function tampilkanKalah() {
    const overlay = document.getElementById('gameOver');
    document.getElementById('gameOverTitle').textContent = 'Yah, kalah!';
    document.getElementById('gameOverMessage').textContent = 'Semangat, ulang lagi yuk! Kamu pasti bisa membuat skor lebih tinggi.';
    document.getElementById('playAgainButton').textContent = 'Ulang Lagi';
    overlay.style.display = 'flex';
    if (animasiKalah) animasiKalah.cancel();
    animasiKalah = overlay.animate([
        { opacity: 0, transform: 'translate(-50%, -44%) scale(0.82) rotate(-2deg)' },
        { opacity: 1, transform: 'translate(-50%, -52%) scale(1.04) rotate(1deg)', offset: 0.72 },
        { opacity: 1, transform: 'translate(-50%, -50%) scale(1) rotate(0)' }
    ], { duration: 560, easing: 'cubic-bezier(0.2, 0.8, 0.25, 1.15)', fill: 'both' });
}

function mulaiPerayaanBunga() {
    const bunga = ['🌸', '🌼', '🌺', '🌻', '✿', '❀'];
    animasiBunga = {
        mulai: performance.now(),
        bunga: Array.from({ length: 24 }, (_, index) => ({
            arah: index * Math.PI * 2 / 24 + Math.random() * 0.2,
            laju: 35 + Math.random() * 90,
            ukuran: 12 + Math.random() * 12,
            putaran: (Math.random() - 0.5) * 4,
            lambang: bunga[index % bunga.length]
        }))
    };
    if (frameBunga) cancelAnimationFrame(frameBunga);

    const renderBunga = waktu => {
        if (!animasiBunga) return;
        if (modeGame === 'blockblast') gambarPapanBlockBlast(waktu);
        else gambarPapan();
        if (waktu - animasiBunga.mulai < 1500) {
            frameBunga = requestAnimationFrame(renderBunga);
        } else {
            animasiBunga = null;
            frameBunga = null;
        }
    };
    frameBunga = requestAnimationFrame(renderBunga);
}

function gambarPerayaanBunga(targetCtx, lebar, tinggi, waktu = performance.now()) {
    if (!animasiBunga) return;
    const progres = Math.min(1, (waktu - animasiBunga.mulai) / 1500);
    const jarak = 18 + progres * 105;
    animasiBunga.bunga.forEach(bunga => {
        const x = lebar / 2 + Math.cos(bunga.arah) * jarak * bunga.laju / 100;
        const y = tinggi / 2 + Math.sin(bunga.arah) * jarak * bunga.laju / 100 - progres * 24;
        targetCtx.save();
        targetCtx.globalAlpha = Math.max(0, 1 - progres);
        targetCtx.translate(x, y);
        targetCtx.rotate(bunga.putaran * progres);
        targetCtx.font = `${bunga.ukuran}px serif`;
        targetCtx.textAlign = 'center';
        targetCtx.textBaseline = 'middle';
        targetCtx.fillText(bunga.lambang, 0, 0);
        targetCtx.restore();
    });
}

function tampilkanPemilihMode() {
    if (modeGame === 'snake') window.hentikanSnake3D?.();
    gameJalan = false;
    gameJeda = false;
    handleTouchEnd();
    document.getElementById('pauseScreen').style.display = 'none';
    document.getElementById('gameOver').style.display = 'none';
    document.getElementById('modeSelect').style.display = 'flex';
}

function pilihMode(mode) {
    if (modeGame === 'snake' && mode !== 'snake') window.hentikanSnake3D?.();
    modeGame = mode;
    window.modeGame = mode;
    const tetrisAktif = mode === 'tetris';
    const blockBlastAktif = mode === 'blockblast';
    const snakeAktif = mode === 'snake';
    document.querySelector('.game-board').style.display = tetrisAktif ? 'block' : 'none';
    document.querySelector('.game-info').style.display = tetrisAktif ? 'flex' : 'none';
    document.getElementById('blockBlast').style.display = blockBlastAktif ? 'flex' : 'none';
    document.getElementById('snakeGame').style.display = snakeAktif ? 'flex' : 'none';
    document.getElementById('pauseButton').style.display = tetrisAktif ? '' : 'none';
    document.getElementById('modeSelect').style.display = 'none';
    if (snakeAktif) {
        gameJalan = false;
        window.mulaiSnake3D?.();
    } else {
        mulaiGame();
    }
}

function bentukBlastAcak() {
    const bentukIndex = Math.floor(Math.random() * BENTUK_BLAST.length);
    return { bentuk: BENTUK_BLAST[bentukIndex], warna: WARNA_BLAST[Math.floor(Math.random() * WARNA_BLAST.length)] };
}

function mulaiBlockBlast() {
    animasiBlast = null;
    hoverBlast = null;
    clearTimeout(timerPerayaanBlast);
    document.getElementById('blastCelebration').style.display = 'none';
    resetGameOver();
    papanBlockBlast = Array.from({ length: UKURAN_PAPAN_BLAST }, () => Array(UKURAN_PAPAN_BLAST).fill(null));
    pilihanBentuk = [bentukBlastAcak(), bentukBlastAcak(), bentukBlastAcak()];
    bentukTerpilih = null;
    skor = 0;
    totalBaris = 0;
    gameJalan = true;
    document.getElementById('gameOver').style.display = 'none';
    document.getElementById('blockBlastMessage').textContent = 'Pilih bentuk, lalu ketuk papan untuk menempatkannya.';
    gambarPapanBlockBlast();
    gambarPilihanBlockBlast();
    cekGameOverBlockBlast();
}

function gambarBlokBlast(blockCtx, x, y, warna, ukuran = 1, alpha = 1, glow = 0) {
    const pusatX = x * UKURAN_SEL_BLAST + UKURAN_SEL_BLAST / 2;
    const pusatY = y * UKURAN_SEL_BLAST + UKURAN_SEL_BLAST / 2;
    const sisi = (UKURAN_SEL_BLAST - 5) * ukuran;
    blockCtx.save();
    blockCtx.globalAlpha = alpha;
    blockCtx.shadowColor = warna;
    blockCtx.shadowBlur = glow;
    blockCtx.fillStyle = warna;
    blockCtx.fillRect(pusatX - sisi / 2, pusatY - sisi / 2, sisi, sisi);
    blockCtx.shadowBlur = 0;
    blockCtx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    blockCtx.fillRect(pusatX - sisi / 2 + 3, pusatY - sisi / 2 + 3, Math.max(0, sisi - 6), 3);
    blockCtx.restore();
}

function gambarPapanBlockBlast(waktu = performance.now()) {
    const blockCanvas = document.getElementById('blockBlastCanvas');
    const blockCtx = blockCanvas.getContext('2d');
    blockCtx.clearRect(0, 0, blockCanvas.width, blockCanvas.height);
    const durasiJatuh = 240;
    const waktuAnimasi = animasiBlast ? waktu - animasiBlast.mulai : Infinity;
    const selBaru = new Set(animasiBlast && waktuAnimasi < durasiJatuh ? animasiBlast.blokBaru.map(sel => `${sel.x},${sel.y}`) : []);

    for (let y = 0; y < UKURAN_PAPAN_BLAST; y++) {
        for (let x = 0; x < UKURAN_PAPAN_BLAST; x++) {
            const xPixel = x * UKURAN_SEL_BLAST;
            const yPixel = y * UKURAN_SEL_BLAST;
            const sedangBersih = animasiBlast && waktuAnimasi >= durasiJatuh && animasiBlast.selBersih.some(sel => sel.x === x && sel.y === y);
            const skipBlokBaru = selBaru.has(`${x},${y}`);
            blockCtx.fillStyle = sedangBersih || skipBlokBaru ? '#172326' : (papanBlockBlast[y][x] || '#172326');
            blockCtx.fillRect(xPixel + 1, yPixel + 1, UKURAN_SEL_BLAST - 2, UKURAN_SEL_BLAST - 2);
            blockCtx.strokeStyle = 'rgba(223, 242, 232, 0.14)';
            blockCtx.lineWidth = 1;
            blockCtx.strokeRect(xPixel + 0.5, yPixel + 0.5, UKURAN_SEL_BLAST - 1, UKURAN_SEL_BLAST - 1);
            if (!skipBlokBaru && !sedangBersih && papanBlockBlast[y][x]) {
                gambarBlokBlast(blockCtx, x, y, papanBlockBlast[y][x]);
            }
        }
    }

    if (animasiBlast) {
        if (waktuAnimasi < durasiJatuh) {
            const progres = Math.min(1, waktuAnimasi / durasiJatuh);
            const ease = 1 - Math.pow(1 - progres, 3);
            animasiBlast.blokBaru.forEach(sel => {
                const pantulan = Math.sin(progres * Math.PI) * 0.18;
                blockCtx.save();
                blockCtx.translate(0, -18 * (1 - ease));
                gambarBlokBlast(blockCtx, sel.x, sel.y, sel.warna, ease + pantulan, 1, 14 * (1 - progres));
                blockCtx.restore();
            });
        } else if (animasiBlast.selBersih.length) {
            const progres = Math.min(1, (waktuAnimasi - durasiJatuh) / 420);
            const pulse = 1 + Math.sin(progres * Math.PI * 4) * 0.12;
            animasiBlast.selBersih.forEach(sel => gambarBlokBlast(blockCtx, sel.x, sel.y, sel.warna, pulse * (1 - progres * 0.25), 1 - progres * 0.25, 20 * (1 - progres)));
            blockCtx.save();
            blockCtx.globalAlpha = (1 - progres) * 0.8;
            blockCtx.strokeStyle = '#fff4ad';
            blockCtx.lineWidth = 5;
            animasiBlast.barisPenuh.forEach(y => {
                blockCtx.beginPath();
                blockCtx.moveTo(0, y * UKURAN_SEL_BLAST + UKURAN_SEL_BLAST / 2);
                blockCtx.lineTo(blockCanvas.width, y * UKURAN_SEL_BLAST + UKURAN_SEL_BLAST / 2);
                blockCtx.stroke();
            });
            animasiBlast.kolomPenuh.forEach(x => {
                blockCtx.beginPath();
                blockCtx.moveTo(x * UKURAN_SEL_BLAST + UKURAN_SEL_BLAST / 2, 0);
                blockCtx.lineTo(x * UKURAN_SEL_BLAST + UKURAN_SEL_BLAST / 2, blockCanvas.height);
                blockCtx.stroke();
            });
            blockCtx.restore();
            animasiBlast.partikel.forEach(partikel => {
                const jarak = (waktuAnimasi - durasiJatuh) / 16;
                blockCtx.globalAlpha = Math.max(0, 1 - progres);
                blockCtx.fillStyle = partikel.warna;
                blockCtx.fillRect(partikel.x + partikel.vx * jarak, partikel.y + partikel.vy * jarak, partikel.ukuran, partikel.ukuran);
            });
            blockCtx.globalAlpha = 1;
        }
    } else if (bentukTerpilih !== null && hoverBlast) {
        const pilihan = pilihanBentuk[bentukTerpilih];
        if (pilihan) {
            const valid = bisaTempatkanBlast(pilihan.bentuk, hoverBlast.x, hoverBlast.y);
            pilihan.bentuk.forEach((baris, dy) => baris.forEach((isi, dx) => {
                if (isi && hoverBlast.x + dx >= 0 && hoverBlast.x + dx < UKURAN_PAPAN_BLAST && hoverBlast.y + dy >= 0 && hoverBlast.y + dy < UKURAN_PAPAN_BLAST) {
                    gambarBlokBlast(blockCtx, hoverBlast.x + dx, hoverBlast.y + dy, valid ? pilihan.warna : '#ed665d', 0.82, 0.48);
                }
            }));
        }
    }
    gambarPerayaanBunga(blockCtx, blockCanvas.width, blockCanvas.height, waktu);
}

function gambarPilihanBlockBlast() {
    const tray = document.getElementById('pieceTray');
    tray.replaceChildren();
    pilihanBentuk.forEach((pilihan, index) => {
        const tombol = document.createElement('button');
        tombol.className = 'piece-choice';
        tombol.type = 'button';
        tombol.style.touchAction = 'none';
        tombol.setAttribute('aria-label', pilihan ? `Pilih bentuk ${index + 1}` : `Bentuk ${index + 1} sudah digunakan`);
        tombol.disabled = !pilihan;
        if (bentukTerpilih === index) tombol.classList.add('selected');

        if (pilihan) {
            const grid = document.createElement('span');
            grid.className = 'piece-mini-grid';
            grid.style.setProperty('--piece-columns', pilihan.bentuk[0].length);
            pilihan.bentuk.flat().forEach((isi) => {
                const sel = document.createElement('span');
                if (isi) sel.style.backgroundColor = pilihan.warna;
                grid.append(sel);
            });
            tombol.append(grid);
            tombol.addEventListener('pointerdown', event => mulaiDragBlast(event, index, pilihan));
            tombol.addEventListener('click', () => {
                if (lewatiKlikDrag === index) {
                    lewatiKlikDrag = null;
                    return;
                }
                bentukTerpilih = index;
                hoverBlast = null;
                document.getElementById('blockBlastMessage').textContent = 'Ketuk posisi di papan untuk menempatkan bentuk.';
                gambarPilihanBlockBlast();
                gambarPapanBlockBlast();
                animasikanTekan(tray.children[index]);
            });
        }
        tray.append(tombol);
    });
}

function buatHantuBlast(pilihan) {
    if (hantuBlast) hantuBlast.remove();
    hantuBlast = document.createElement('div');
    hantuBlast.setAttribute('aria-hidden', 'true');
    Object.assign(hantuBlast.style, {
        position: 'fixed',
        zIndex: '1000',
        display: 'grid',
        gridTemplateColumns: `repeat(${pilihan.bentuk[0].length}, 24px)`,
        gridAutoRows: '24px',
        gap: '3px',
        padding: '5px',
        background: 'rgba(12, 24, 24, 0.72)',
        border: '1px solid rgba(255, 255, 255, 0.35)',
        borderRadius: '6px',
        pointerEvents: 'none',
        opacity: '0.92',
        transform: 'scale(1.04)',
        boxShadow: '0 8px 22px rgba(0, 0, 0, 0.35)'
    });
    pilihan.bentuk.flat().forEach(isi => {
        const sel = document.createElement('span');
        Object.assign(sel.style, {
            width: '24px',
            height: '24px',
            borderRadius: '3px',
            background: isi ? pilihan.warna : 'transparent',
            boxShadow: isi ? 'inset 0 2px rgba(255, 255, 255, 0.3)' : 'none'
        });
        hantuBlast.append(sel);
    });
    document.body.append(hantuBlast);
}

function mulaiDragBlast(event, index, pilihan) {
    if (event.button !== 0 || !gameJalan || animasiBlast) return;
    dragBlast = { index, pointerId: event.pointerId };
    bentukTerpilih = index;
    buatHantuBlast(pilihan);
    event.currentTarget.setPointerCapture(event.pointerId);
    geserDragBlast(event);
}

function selBlastDariEvent(event) {
    const blockCanvas = document.getElementById('blockBlastCanvas');
    const batas = blockCanvas.getBoundingClientRect();
    const borderKiri = parseFloat(getComputedStyle(blockCanvas).borderLeftWidth) || 0;
    const borderAtas = parseFloat(getComputedStyle(blockCanvas).borderTopWidth) || 0;
    return {
        x: Math.floor((event.clientX - batas.left - borderKiri) * blockCanvas.width / blockCanvas.clientWidth / UKURAN_SEL_BLAST),
        y: Math.floor((event.clientY - batas.top - borderAtas) * blockCanvas.height / blockCanvas.clientHeight / UKURAN_SEL_BLAST)
    };
}

function geserDragBlast(event) {
    if (!dragBlast || event.pointerId !== dragBlast.pointerId) return;
    if (hantuBlast) {
        hantuBlast.style.left = `${event.clientX + 16}px`;
        hantuBlast.style.top = `${event.clientY - 18}px`;
    }
    const blockCanvas = document.getElementById('blockBlastCanvas');
    const batas = blockCanvas.getBoundingClientRect();
    if (event.clientX >= batas.left && event.clientX <= batas.right && event.clientY >= batas.top && event.clientY <= batas.bottom) {
        hoverBlast = selBlastDariEvent(event);
    } else {
        hoverBlast = null;
    }
    gambarPapanBlockBlast();
}

function selesaikanDragBlast(event) {
    if (!dragBlast || event.pointerId !== dragBlast.pointerId) return;
    const dragSelesai = dragBlast;
    const blockCanvas = document.getElementById('blockBlastCanvas');
    const batas = blockCanvas.getBoundingClientRect();
    const lepasDiPapan = event.clientX >= batas.left && event.clientX <= batas.right && event.clientY >= batas.top && event.clientY <= batas.bottom;
    dragBlast = null;
    if (hantuBlast) {
        hantuBlast.remove();
        hantuBlast = null;
    }
    if (lepasDiPapan) {
        lewatiKlikDrag = dragSelesai.index;
        setTimeout(() => {
            if (lewatiKlikDrag === dragSelesai.index) lewatiKlikDrag = null;
        }, 250);
        tempatkanBlast(event);
    } else {
        hoverBlast = null;
        gambarPapanBlockBlast();
    }
}

function batalkanDragBlast(event) {
    if (!dragBlast || event.pointerId !== dragBlast.pointerId) return;
    dragBlast = null;
    hoverBlast = null;
    if (hantuBlast) {
        hantuBlast.remove();
        hantuBlast = null;
    }
    gambarPapanBlockBlast();
}

function bisaTempatkanBlast(bentuk, mulaiX, mulaiY) {
    for (let y = 0; y < bentuk.length; y++) {
        for (let x = 0; x < bentuk[y].length; x++) {
            if (bentuk[y][x] && (mulaiX + x < 0 || mulaiX + x >= UKURAN_PAPAN_BLAST || mulaiY + y < 0 || mulaiY + y >= UKURAN_PAPAN_BLAST || papanBlockBlast[mulaiY + y][mulaiX + x])) {
                return false;
            }
        }
    }
    return true;
}

function perbaruiHoverBlast(event) {
    if (!gameJalan || animasiBlast || bentukTerpilih === null) return;
    hoverBlast = selBlastDariEvent(event);
    gambarPapanBlockBlast();
}

function tempatkanBlast(event) {
    if (!gameJalan || animasiBlast || bentukTerpilih === null || !pilihanBentuk[bentukTerpilih]) return;
    const blockCanvas = document.getElementById('blockBlastCanvas');
    const batas = blockCanvas.getBoundingClientRect();
    const { x, y } = selBlastDariEvent(event);
    const pilihan = pilihanBentuk[bentukTerpilih];

    if (!bisaTempatkanBlast(pilihan.bentuk, x, y)) {
        document.getElementById('blockBlastMessage').textContent = 'Bentuk tidak muat di posisi itu.';
        return;
    }

    const blokBaru = [];
    pilihan.bentuk.forEach((baris, dy) => baris.forEach((isi, dx) => {
        if (isi) {
            papanBlockBlast[y + dy][x + dx] = pilihan.warna;
            blokBaru.push({ x: x + dx, y: y + dy, warna: pilihan.warna });
        }
    }));
    pilihanBentuk[bentukTerpilih] = null;
    bentukTerpilih = null;

    const barisPenuh = papanBlockBlast.map((baris, index) => baris.every(Boolean) ? index : -1).filter(index => index !== -1);
    const kolomPenuh = Array.from({ length: UKURAN_PAPAN_BLAST }, (_, xIndex) => xIndex).filter(xIndex => papanBlockBlast.every(baris => baris[xIndex]));
    const selBersih = [];
    const kunciSelBersih = new Set();
    barisPenuh.forEach(yIndex => {
        for (let xIndex = 0; xIndex < UKURAN_PAPAN_BLAST; xIndex++) kunciSelBersih.add(`${xIndex},${yIndex}`);
    });
    kolomPenuh.forEach(xIndex => {
        for (let yIndex = 0; yIndex < UKURAN_PAPAN_BLAST; yIndex++) kunciSelBersih.add(`${xIndex},${yIndex}`);
    });
    kunciSelBersih.forEach(kunci => {
        const [xIndex, yIndex] = kunci.split(',').map(Number);
        selBersih.push({ x: xIndex, y: yIndex, warna: papanBlockBlast[yIndex][xIndex] });
    });
    const partikel = selBersih.flatMap(sel => Array.from({ length: 2 }, () => ({
        x: sel.x * UKURAN_SEL_BLAST + UKURAN_SEL_BLAST / 2,
        y: sel.y * UKURAN_SEL_BLAST + UKURAN_SEL_BLAST / 2,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5,
        ukuran: 2 + Math.random() * 3,
        warna: sel.warna
    })));
    animasiBlast = { mulai: performance.now(), blokBaru, selBersih, barisPenuh, kolomPenuh, partikel };
    document.getElementById('blockBlastMessage').textContent = selBersih.length ? 'Bersihkan baris!' : 'Bentuk berhasil ditempatkan.';

    const renderFrame = waktu => {
        if (!animasiBlast) return;
        gambarPapanBlockBlast(waktu);
        const durasi = 240 + (selBersih.length ? 420 : 0);
        if (waktu - animasiBlast.mulai < durasi) {
            requestAnimationFrame(renderFrame);
            return;
        }
        barisPenuh.forEach(yIndex => papanBlockBlast[yIndex].fill(null));
        kolomPenuh.forEach(xIndex => papanBlockBlast.forEach(baris => { baris[xIndex] = null; }));
        skor += blokBaru.length * 10 + (barisPenuh.length + kolomPenuh.length) * UKURAN_PAPAN_BLAST * 10;
        totalBaris += barisPenuh.length + kolomPenuh.length;
        animasiBlast = null;
        const papanKosong = papanBlockBlast.every(baris => baris.every(sel => sel === null));
        if (papanKosong && selBersih.length) {
            skor += 100;
            mulaiPerayaanBunga();
        }
        if (pilihanBentuk.every(bentuk => bentuk === null)) pilihanBentuk = [bentukBlastAcak(), bentukBlastAcak(), bentukBlastAcak()];
        document.getElementById('blockBlastMessage').textContent = selBersih.length ? `Bagus! ${barisPenuh.length + kolomPenuh.length} baris/kolom dibersihkan.` : 'Bentuk berhasil ditempatkan.';
        gambarPapanBlockBlast();
        gambarPilihanBlockBlast();
        cekGameOverBlockBlast();
    };
    requestAnimationFrame(renderFrame);
}

function cekGameOverBlockBlast() {
    const masihBisa = pilihanBentuk.some(pilihan => pilihan && papanBlockBlast.some((baris, y) => baris.some((_, x) => bisaTempatkanBlast(pilihan.bentuk, x, y))));
    if (!masihBisa) {
        gameJalan = false;
        document.getElementById('finalMetricLabel').textContent = 'Baris/kolom';
        document.getElementById('finalScore').textContent = skor;
        document.getElementById('finalLines').textContent = totalBaris;
        document.getElementById('newHighSore').style.display = 'none';
        tampilkanKalah();
    }
}

const bentukTetris = [
    [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    [[2, 0, 0], [2, 2, 2], [0, 0, 0]],
    [[0, 0, 3], [3, 3, 3], [0, 0, 0]],
    [[4, 4], [4, 4]],
    [[0, 5, 5], [5, 5, 0], [0, 0, 0]],
    [[0, 6, 0], [6, 6, 6], [0, 0, 0]],
    [[7, 7, 0], [0, 7, 7], [0, 0, 0]]
];

const warnaBentuk = [
    '#000000', '#00FFFF', '#0000FF', '#FFC0CB', '#FFFF00', '#00FF00', '#800080', '#FF0000'
];

function putarSuara(namaSuara) {
    try {
        if (typeof suaraSuara !== 'undefined' && suaraSuara[namaSuara]) {
            suaraSuara[namaSuara].currentTime = 0;
            suaraSuara[namaSuara].play().catch(e => console.log(`Audio gagal diputar: ${e.message}`));
        }
    } catch (e) {
        // Audio error handler
    }
}

function buatBentukBaru() {
    const randomIndex = Math.floor(Math.random() * bentukTetris.length);
    const bentuk = bentukTetris[randomIndex];
    
    return {
        bentuk: bentuk,
        x: Math.floor(LEBAR_PAPAN / 2) - Math.floor(bentuk[0].length / 2),
        y: 0,
        warna: randomIndex + 1
    };
}

function cekGerakanValid(bentuk, dx, dy, rotasi) {
    const bentukBaru = rotasi !== undefined ? putarBentuk(bentuk.bentuk, rotasi) : bentuk.bentuk;
    const xBaru = bentuk.x + dx;
    const yBaru = bentuk.y + dy;

    for (let y = 0; y < bentukBaru.length; y++) {
        for (let x = 0; x < bentukBaru[y].length; x++) {
            if (bentukBaru[y][x]) {
                const papanX = xBaru + x;
                const papanY = yBaru + y;

                if (papanX < 0 || papanX >= LEBAR_PAPAN || papanY >= TINGGI_PAPAN) {
                    return false;
                }

                if (papanY >= 0 && papanPermainan[papanY] && papanPermainan[papanY][papanX] !== 0) {
                    return false;
                }
            }
        }
    }
    return true;
}

function putarBentuk(matriks) { 
    const N = matriks.length;
    let bentukPutar = [];
    for(let i=0; i<N; i++){
        bentukPutar[i] = [];
        for(let j=0; j<N; j++){
            bentukPutar[i][j] = matriks[N - 1 - j][i];
        }
    }
    return bentukPutar;
}

function tempatkanBentuk() {
    for (let y = 0; y < bentukSaatIni.bentuk.length; y++) {
        for (let x = 0; x < bentukSaatIni.bentuk[y].length; x++) {
            if (bentukSaatIni.bentuk[y][x]) {
                const xPapan = bentukSaatIni.x + x;
                const yPapan = bentukSaatIni.y + y;

                if (yPapan < 0) {
                    gameSelesai();
                    return;
                }
                papanPermainan[yPapan][xPapan] = bentukSaatIni.warna;
            }
        }
    }
    
    putarSuara('jatuh');
    hapusBarisLengkap();

    bentukSaatIni = bentukBerikutnya;
    bentukBerikutnya = buatBentukBaru();
    
    bentukSaatIni.x = Math.floor(LEBAR_PAPAN / 2) - Math.floor(bentukSaatIni.bentuk[0].length / 2);
    bentukSaatIni.y = 0;

    if (!cekGerakanValid(bentukSaatIni, 0, 0)) {
        gameSelesai();
    }
}

function hapusBarisLengkap() {
    let barisHapus = 0;
    for (let y = TINGGI_PAPAN - 1; y >= 0; y--) {
        if (papanPermainan[y].every(sel => sel !== 0)) {
            papanPermainan.splice(y, 1);
            papanPermainan.unshift(new Array(LEBAR_PAPAN).fill(0));
            barisHapus++;
            y++;
        }
    }

    if (barisHapus > 0) {
        if (barisHapus === 4) {
            putarSuara('tetris');
        } else {
            putarSuara('hapusBaris');
        }

        const levelLama = level;
        totalBaris += barisHapus;
        skor += hitungSkorBaris(barisHapus);
        level = Math.floor(totalBaris / 10) + 1;

        if (level > levelLama) {
            putarSuara('naikLevel');
        }
        if (papanPermainan.every(baris => baris.every(sel => sel === 0))) {
            mulaiPerayaanBunga();
        }
    }
}

function hitungSkorBaris(baris) {
    const skorDasar = [0, 100, 300, 500, 800];
    return skorDasar[baris] * level;
}

function gerakanBentuk(dx, dy) {
    if (!gameJalan || gameJeda) return false;

    if (cekGerakanValid(bentukSaatIni, dx, dy)) {
        bentukSaatIni.x += dx;
        bentukSaatIni.y += dy;
        
        if (dx !== 0) {
            putarSuara('gerak');
        }
        
        gambarPapan(); 
        return true;
    }
    return false;
}

function putarBentukSekarang() {
    if (!gameJalan || gameJeda) return false;

    const bentukPutar = putarBentuk(bentukSaatIni.bentuk);
    const offsetUji = [0, -1, 1, -2, 2];
    for (const offset of offsetUji) {
        if (cekGerakanValid({ ...bentukSaatIni, bentuk: bentukPutar }, offset, 0)) {
            bentukSaatIni.bentuk = bentukPutar;
            bentukSaatIni.x += offset; 
            putarSuara('putar');
            gambarPapan(); 
            return true;
        }
    }
    return false;
}

function jatuhkanLangsung(button) {
    if (!gameJalan || gameJeda) return;
    animasikanTekan(button);

    let dy = 0;
    while (cekGerakanValid(bentukSaatIni, 0, dy + 1)) {
        dy++;
        skor += 2;
    }
    
    bentukSaatIni.y += dy;
    tempatkanBentuk();
}

function gambarBlok(ctx, x, y, warna) {
    ctx.fillStyle = warnaBentuk[warna];
    ctx.fillRect(x * UKURAN_BLOK, y * UKURAN_BLOK, UKURAN_BLOK, UKURAN_BLOK);
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x * UKURAN_BLOK, y * UKURAN_BLOK, UKURAN_BLOK, UKURAN_BLOK);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(x * UKURAN_BLOK + 2, y * UKURAN_BLOK + 2, UKURAN_BLOK - 4, 4);
    ctx.fillRect(x * UKURAN_BLOK + 2, y * UKURAN_BLOK + 2, 4, UKURAN_BLOK - 4);
}

function gambarPapan() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    for (let y = 0; y < TINGGI_PAPAN; y++) {
        for (let x = 0; x < LEBAR_PAPAN; x++) {
            if (papanPermainan[y][x] !== 0) {
                gambarBlok(ctx, x, y, papanPermainan[y][x]);
            }
        }
    }

    if (bentukSaatIni) {
        const waktuAngkat = performance.now() - waktuAngkatTetris;
        const progresAngkat = Math.min(1, waktuAngkat / 240);
        const angkat = waktuAngkat < 240 ? Math.sin(progresAngkat * Math.PI) * 7 : 0;
        const skala = 1 + (waktuAngkat < 240 ? Math.sin(progresAngkat * Math.PI) * 0.07 : 0);
        const tengahX = (bentukSaatIni.x + bentukSaatIni.bentuk[0].length / 2) * UKURAN_BLOK;
        const tengahY = (bentukSaatIni.y + bentukSaatIni.bentuk.length / 2) * UKURAN_BLOK;
        ctx.save();
        ctx.translate(tengahX, tengahY - angkat);
        ctx.scale(skala, skala);
        ctx.translate(-tengahX, -tengahY);
        for (let y = 0; y < bentukSaatIni.bentuk.length; y++) {
            for (let x = 0; x < bentukSaatIni.bentuk[y].length; x++) {
                if (bentukSaatIni.bentuk[y][x]) {
                    gambarBlok(ctx, bentukSaatIni.x + x, bentukSaatIni.y + y, bentukSaatIni.warna);
                }
            }
        }
        ctx.restore();
    }
    gambarPerayaanBunga(ctx, canvas.width, canvas.height);
}

function loopPermainan(waktu) {
    if (!gameJalan || gameJeda) return;

    const deltaWaktu = waktu - waktuTerakhir;
    const intervalJatuh = Math.max(100, 1000 - (level - 1) * 50);

    if (deltaWaktu > intervalJatuh) {
        if (!gerakanBentuk(0, 1)) {
            tempatkanBentuk();
        }
        waktuTerakhir = waktu;
    }

    gambarPapan();
    requestAnimationFrame(loopPermainan);
}

function inisialisasiGame() {
    papanPermainan = [];
    for (let y = 0; y < TINGGI_PAPAN; y++) {
        papanPermainan[y] = new Array(LEBAR_PAPAN).fill(0);
    }
    gambarGrid();
}

function gambarGrid() {
    gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
    gridCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    gridCtx.lineWidth = 1;

    for (let x = 0; x <= LEBAR_PAPAN; x++) {
        gridCtx.beginPath();
        gridCtx.moveTo(x * UKURAN_BLOK, 0);
        gridCtx.lineTo(x * UKURAN_BLOK, canvas.height);
        gridCtx.stroke();
    }

    for (let y = 0; y <= TINGGI_PAPAN; y++) {
        gridCtx.beginPath();
        gridCtx.moveTo(0, y * UKURAN_BLOK);
        gridCtx.lineTo(canvas.width, y * UKURAN_BLOK);
        gridCtx.stroke();
    }
}

function mulaiGame() {
    if (modeGame === 'snake') {
        window.mulaiUlangSnake3D?.();
        return;
    }
    if (modeGame === 'blockblast') {
        mulaiBlockBlast();
        return;
    }

    inisialisasiGame();
    skor = 0;
    totalBaris = 0;
    level = 1;
    gameJalan = true;
    gameJeda = false;

    bentukBerikutnya = buatBentukBaru();
    bentukSaatIni = buatBentukBaru();

    document.getElementById('gameOver').style.display = 'none';
    resetGameOver();
    document.getElementById('pauseScreen').style.display = 'none';
    document.getElementById('finalMetricLabel').textContent = 'Baris';
    document.getElementById('newHighSore').style.display = 'none';

    waktuTerakhir = performance.now();
    requestAnimationFrame(loopPermainan);
}

function gameSelesai() {
    gameJalan = false;
    putarSuara('gameOver');

    const rekorBaru = skor > rekorTertinggi;
    if (rekorBaru) {
        rekorTertinggi = skor;
        localStorage.setItem('tetrisHighScore', rekorTertinggi.toString());
        document.getElementById('newHighSore').style.display = 'block';
    } else {
        document.getElementById('newHighSore').style.display = 'none';
    }
    
    document.getElementById('finalScore').textContent = skor;
    document.getElementById('finalLines').textContent = totalBaris;
    tampilkanKalah();
}

function toggleJeda() {
    if (!gameJalan) return;

    gameJeda = !gameJeda;
    document.getElementById('pauseScreen').style.display = gameJeda ? 'flex' : 'none';
    
    if (!gameJeda) {
        waktuTerakhir = performance.now();
        requestAnimationFrame(loopPermainan);
    }
}

// Kontrol Sentuh HP
function handleTouchStart(button, dx, dy, isSlowDrop = false) {
    if (!gameJalan || gameJeda) return;
    angkatBentukTetris(button);
    clearInterval(intervalGerakSentuh);
    
    if (dx !== 0 || (dy !== 0 && !isSlowDrop)) {
        gerakanBentuk(dx, dy);
    }

    if (dx !== 0 || isSlowDrop) {
        let interval = (dx !== 0) ? 100 : delayJatuhSentuh;

        intervalGerakSentuh = setInterval(() => {
            if (isSlowDrop) {
                if (gerakanBentuk(0, 1)) {
                    skor += 1;
                } else {
                    clearInterval(intervalGerakSentuh);
                    tempatkanBentuk();
                }
            } else {
                gerakanBentuk(dx, dy);
            }
        }, interval);
    }
}

function handleTouchEnd() {
    clearInterval(intervalGerakSentuh);
    intervalGerakSentuh = null;
}

function handleRotationTouch(button) {
    if (!gameJalan || gameJeda) return;
    angkatBentukTetris(button);
    putarBentukSekarang();
}

// Kontrol Keyboard PC
document.addEventListener('keydown', (e) => {
    if (modeGame !== 'tetris') return;

    if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        if (!gameJalan) return;
        if (gameJeda) {
             toggleJeda();
             return;
        }
        if (!spasiDitekan) {
            spasiDitekan = true;
            jatuhkanLangsung();
        }
        return;
    }

    if (!gameJalan || gameJeda) return;

    switch (e.key.toLowerCase()) {
        case 'a':
        case 'arrowleft':
            angkatBentukTetris();
            gerakanBentuk(-1, 0);
            break;
        case 'd':
        case 'arrowright':
            angkatBentukTetris();
            gerakanBentuk(1, 0);
            break;
        case 'w':
        case 'arrowup':
            angkatBentukTetris();
            putarBentukSekarang();
            break;
        case 's':
        case 'arrowdown':
            angkatBentukTetris();
            if (gerakanBentuk(0, 1)) {
                skor += 1;
            } else {
                tempatkanBentuk();
            }
            break;
        case 'p':
            jatuhkanLangsung();
            break;
        default:
            return;
    }
    e.preventDefault();
});

document.addEventListener('keyup', (e) => {
    if (e.key === ' ' || e.key === 'Spacebar') {
        spasiDitekan = false;
    }
    if (e.key.toLowerCase() === 'p') {
        toggleJeda();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    inisialisasiGame();
    const blockCanvas = document.getElementById('blockBlastCanvas');
    blockCanvas.addEventListener('pointerdown', tempatkanBlast);
    blockCanvas.addEventListener('pointermove', perbaruiHoverBlast);
    window.addEventListener('pointermove', geserDragBlast);
    window.addEventListener('pointerup', selesaikanDragBlast);
    window.addEventListener('pointercancel', batalkanDragBlast);
    blockCanvas.addEventListener('pointerleave', () => {
        hoverBlast = null;
        if (!animasiBlast) gambarPapanBlockBlast();
    });
});