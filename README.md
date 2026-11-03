# Борг: Ліс (Android, three.js + Capacitor)

## Збірка APK через GitHub
1. Створіть репозиторій на GitHub, завантажте весь вміст цієї папки (разом із `.github`).
2. Вкладка **Actions → Build APK → Run workflow** (або просто зробіть push).
3. Після завершення скачайте артефакт **DebtForest-APK**, розпакуйте й встановіть `app-debug.apk`.

## Локально (ПК)
`npm install && npm run build && npm run serve` (відкрити http://localhost:8080).

## Файли
- `src/` — код гри, `www/` — HTML/CSS (+ `game.js` після збірки).
- Власні 3D-моделі `.glb` можна класти в `www/models/`.
