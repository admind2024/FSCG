# ⛔ TVRDO PRAVILO — GIT JE JEDINI IZVOR ISTINE

**Obavezno za SVAKOG AI agenta i svakog saradnika, PRIJE bilo kakvog rada u ovom projektu.**
Uvedeno 15.8.2026. poslije incidenta u kojem je rad rađen mimo gita i objavljivan
`vercel --prod` komandom iz radnog direktorijuma — pa je nestao pri sljedećem
sync-u repozitorijuma. Ovo pravilo postoji da se to NIKAD više ne desi.

## 1. PRIJE rada — povuci važeći git
- `git fetch origin` + provjeri `git status` PRIJE prve izmjene.
- Radi se isključivo na ažurnom `origin/main` (ili grani povučenoj iz njega).
- Ako u radnom direktorijumu postoje tuđe necommitovane izmjene — STOP: prvo ih
  commituj na granu ili pitaj vlasnika; nikad ih ne gazi i ne resetuj.

## 2. Rad koji nije na gitu NE POSTOJI
- Svaki završen posao se ODMAH commituje i push-uje na `origin/main`.
- Zabranjeno je završiti sesiju sa necommitovanim izmjenama "za kasnije".

## 3. Publikovanje ide ISKLJUČIVO kroz git main
- Deploy = `git push origin main` → Vercel/CI auto-build sa commita.
- **ZABRANJENO**: `vercel --prod`, `vercel deploy` ili bilo koje objavljivanje
  direktno iz radnog direktorijuma — to builduje kod kojeg nema u istoriji.
- Ako produkcijski domen ne prati novi git deploy (alias zaostane), alias se
  prebacuje NA GIT DEPLOY — nikad na build napravljen mimo gita.

## 4. Destruktivne git operacije — samo uz eksplicitni nalog vlasnika
- `git reset --hard`, `push --force`, brisanje grana, `stash drop` — nikad
  samoinicijativno.

**Ako bilo koji korak iznad nije ispunjen — zaustavi se i pitaj vlasnika
(rade.milosevic87@gmail.com) prije nastavka.**
