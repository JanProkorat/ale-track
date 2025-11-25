# AleTrack

React app for API stored on https://github.com/JanProkorat/AleTrack

## Run konfigurace

### Požadavky
- Node.js >= 20 (viz `package.json` engines)
- Yarn 1.x nebo npm

### Proměnné prostředí
Proměnná `VITE_API_BASE_URL` definuje základní URL backend API. Viz soubor `.env.example`.
Vite načítá proměnné z: `.env`, `.env.local`, `.env.[mode]`, `.env.[mode].local`.

Dostupné módy (skripty v `package.json`):
- `localhost` (`npm run dev:local`) – lokální backend
- `dev` (`npm run dev:dev`) – testovací / vývojové vzdálené prostředí
- `production` (`npm run dev:prod`) – simulace produkční konfigurace (není plnohodnotná produkce, jen mód)

Příklady souborů prostředí:
- `.env` (lokální vývoj, ignorováno v Gitu)
- `.env.localhost` (mode=localhost)
- `.env.dev` (mode=dev)
- `.env.production` (mode=production)

### Generování API klienta
Aktualizujte swagger backendu a potom spusťte:
```
nswag run nswag.json
```

### Spuštění aplikace
Rychlý start (lokální mód):
```
# instalace
npm install
# start vývoje
npm run dev
```
Alternativní módy:
```
npm run dev:local   # Vite --mode localhost
npm run dev:dev     # Vite --mode dev
npm run dev:prod    # Vite --mode production
```

### Build a preview
```
npm run build
npm run start   # vite preview
```

### Kontroly kvality
```
npm run lint        # ESLint
npm run lint:fix    # ESLint s opravami
npm run fm:check    # Prettier check
npm run fm:fix      # Prettier write
npm run build:check # TypeScript type-check + production build
```