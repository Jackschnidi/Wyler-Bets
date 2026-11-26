# Wyler-Bets

Prognose-Spiel mit Punkten. Statische Next.js-App (GitHub Pages) mit Supabase (Datenbank + Microsoft-Login).

## Einrichtung

1. Supabase: `supabase/migrations/001_wylerbets_points.sql` im SQL Editor ausführen.
2. Supabase → Authentication → Providers → Azure aktivieren (Client ID + Secret aus der Azure-App-Registrierung).
3. Supabase → Authentication → URL Configuration:
   - Site URL: `https://jackschnidi.github.io/Wyler-Bets/`
   - Redirect URLs: `https://jackschnidi.github.io/Wyler-Bets/**` und `http://localhost:3000/**`
4. GitHub → Settings → Pages → Source: **GitHub Actions**.
5. Push auf `main` baut und veröffentlicht die Seite automatisch.

## Lokal entwickeln

```bash
cp .env.example .env.local
npm install
npm run dev
```
