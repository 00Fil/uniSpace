# StudyKit

Home con tutti i tool per l'uni e i tool stessi, pronti per **Dokploy** con un unico Docker Compose.
La VPS (Ubuntu 26.04 + Dokploy) si dà per già configurata.

```
studykit/
├─ docker-compose.yml        gateway + un servizio per ogni tool con server
├─ .env.example              variabili da copiare in Dokploy
├─ gateway/                  Caddy: serve la home e inoltra /<tool>/ al container giusto
├─ account/                  account e sessioni: login, registrazione, spazio per utente
├─ home/                     la home (HTML/CSS/JS statici)
├─ tools/
│  ├─ categories.json        categorie mostrate nella home
│  ├─ studycut/              StudyCut (tool.json + Dockerfile + codice)
│  └─ _templates/            modelli per i nuovi tool (static e service)
└─ scripts/
   ├─ new-tool.sh            crea un tool dal modello
   └─ build-registry.mjs     legge tools/*/tool.json → elenco della home + rotte
```

## Come funziona

```
Internet → Traefik (Dokploy, HTTPS) → gateway:80 ─┬─ /            home                (pubblica)
                                                  ├─ /account/    → account:8000      (accesso, profilo)
                                                  │   ── da qui in giù serve aver fatto l'accesso ──
                                                  ├─ /studycut/   → studycut:8765
                                                  └─ /<tool>/     → altri tool
```

- Solo il **gateway** ha un dominio. I tool non sono raggiungibili da fuori, solo attraverso il gateway, sulla rete interna `hub`.
- Ogni tool è una cartella `tools/<id>/` con un file **`tool.json`**. Durante la build il gateway li legge tutti e genera:
  - `tools.json`, l'elenco che la home usa per card, ricerca, categorie e vetrina animata;
  - una rotta Caddy `/<id>/` per ogni tool.
- Quindi la home **non va mai modificata** per aggiungere un tool.

## Account e spazio personale

La home è pubblica: chiunque vede i tool. Per **aprire** un tool serve l'accesso: chi non è entrato finisce su `/account/login` e, dopo, torna al tool che voleva. Nella home, in alto a destra, c'è **Accedi** oppure il menu dell'account.

- **Pagina di accesso** (`/account/login`): form a sinistra (Accedi / Crea account, si passa dall'uno all'altro con il link in fondo), onde "silk" animate a destra che seguono il cursore. **Resta connesso** attivo = 30 giorni; disattivato = la sessione finisce chiudendo il browser (e al massimo dopo 12 ore).
- **Profilo** (`/account/`): nome, spazio usato e quanto ne occupa ogni tool, cambio password, dispositivi connessi, Esci ed Esci da tutti i dispositivi. Ci si arriva dal menu della home, dal pulsante con l'iniziale in alto a destra in StudyCut o cliccando la barra "Il tuo spazio" nella libreria.
- **In ogni tool:** basta una riga, `<script src="/account/badge.js" defer></script>`, per avere il pulsante dell'account (spazio usato, Profilo e spazio, Esci). I template di `new-tool.sh` lo hanno già.

- **Un account per tutti i tool.** Il servizio `account` tiene utenti e sessioni (SQLite nel volume `account-data`). La sessione è un cookie `HttpOnly` che dura 30 giorni (con "Resta connesso") e si rinnova usandola. Le password sono salvate con scrypt; dopo 10 tentativi sbagliati in 15 minuti l'accesso si blocca per un po'.
- **Come lo sanno i tool.** A ogni richiesta il gateway chiede ad `account` se la sessione è valida (`forward_auth`) e passa al tool `X-User-Id`, `X-User-Name` e `X-User-Quota`. Il gateway cancella sempre questi header se arrivano dal browser, quindi non si possono falsificare.
- **File separati.** Ogni utente ha la sua cartella nel volume `userdata`: `/data/users/<id>/<tool>/`. StudyCut mostra, scarica e cancella solo i video di chi ha fatto l'accesso, e anche i lavori in corso sono separati.
- **Limite di 2 GB per utente, uguale per tutti i tool.** Conta tutto quello che c'è in `/data/users/<id>/`. StudyCut lo controlla prima di un caricamento (anche il doppio temporaneo per i formati da convertire), durante un download da link e prima e durante un'esportazione: se finisce lo spazio si ferma e spiega quanto liberare. Lo spazio usato si vede nel profilo (anche diviso per tool), in fondo alla libreria di StudyCut e nel menu dell'account della home.

| Variabile | Default | A cosa serve |
|---|---|---|
| `USER_QUOTA_GB` | `2` | spazio per utente, per tutti i tool |
| `SIGNUP` | `open` | `open`: chiunque può registrarsi · `closed`: utenti solo da terminale |
| `SIGNUP_CODE` | vuoto | se lo imposti, per registrarsi serve questo codice di invito |
| `SESSION_DAYS` | `30` | durata della sessione |

Gestire gli utenti dalla VPS:
```
docker exec -it $(docker ps -qf name=account) python server.py list              # utenti e spazio usato
docker exec -it $(docker ps -qf name=account) python server.py add-user mario    # chiede la password
docker exec -it $(docker ps -qf name=account) python server.py passwd mario      # nuova password (chiude le sessioni)
docker exec -it $(docker ps -qf name=account) python server.py quota mario 5     # 5 GB solo per lui (0 = predefinito)
docker exec -it $(docker ps -qf name=account) python server.py del-user mario    # i file restano in userdata
```

## Deploy su Dokploy

### 1. Metti il progetto su Git
Crea un repository (GitHub, GitLab, Gitea o Bitbucket) e fai il push di questa cartella.

### 2. Crea il servizio Compose
1. Dokploy → **Projects** → **Create Project** (es. `studykit`).
2. Nel progetto: **Create Service** → **Compose** → tipo **Docker Compose**.
3. Scheda **General** → Provider: scegli il repository e il branch, **Compose Path** `./docker-compose.yml`. Salva.

### 3. Variabili d'ambiente
Scheda **Environment**: incolla il contenuto di `.env.example` (facoltativo: senza variabili valgono i default).

| Variabile | Default | A cosa serve |
|---|---|---|
| `STUDYCUT_PARALLEL` | `3` | download contemporanei |
| `USER_QUOTA_GB`, `SIGNUP`, `SIGNUP_CODE`, `SESSION_DAYS` | | account, vedi sopra |
| `YTDLP_AUTO_UPDATE` | `1` | aggiorna yt-dlp all'avvio e ogni 24 ore |

### 4. Dominio
1. Sul DNS crea un record **A** `uni.tuodominio.it` → IP della VPS.
2. Scheda **Domains** → **Add Domain**:
   - **Service Name**: `gateway`
   - **Host**: `uni.tuodominio.it`
   - **Path**: `/` · **Container Port**: `80`
   - **HTTPS**: attivo · **Certificate**: Let's Encrypt
3. Il dominio va solo su `gateway`, mai sui tool.

### 5. Deploy
Premi **Deploy**. La prima build richiede qualche minuto per ffmpeg e Deno. Quando è finita:

- `https://uni.tuodominio.it` → la home (pubblica)
- `https://uni.tuodominio.it/account/` → profilo (o accesso, se non sei entrato)
- `https://uni.tuodominio.it/studycut/` → StudyCut

Apri un tool (o **Accedi** in alto a destra) e premi **Crea account**. Se vuoi che si registri solo chi conosci, imposta `SIGNUP_CODE` (o `SIGNUP=closed` e crei tu gli utenti).

Con **Preview Compose** puoi vedere il file con le etichette Traefik che Dokploy aggiunge da solo.
Per fare il deploy automatico a ogni push, attiva **Autodeploy** oppure usa il webhook della scheda **Deployments**.

## Dati e backup

| Volume | Contenuto |
|---|---|
| `account-data` | utenti e sessioni (`account.db`) |
| `userdata` | file di ogni utente: `/<id>/studycut/` con video, analisi ed export |
| `studycut-secrets` | `cookies.txt` facoltativo per YouTube |

Il vecchio volume `studycut-library` (prima degli account) non viene più usato: i video di prima non compaiono a nessun utente. Se ti servono, copiali nella cartella del tuo utente (l'id si legge con `server.py list`):
```
docker run --rm -v <progetto>_studycut-library:/old -v <progetto>_userdata:/new alpine \
  sh -c "mkdir -p /new/<id>/studycut && cp -a /old/. /new/<id>/studycut/ && chown -R 1000:1000 /new/<id>"
```

I volumi restano anche quando rifai il deploy. Puoi programmare i backup dei volumi da Dokploy (**Volume Backups**) verso S3 o un altro storage.

### Cookie YouTube (facoltativo)
Dalla VPS YouTube a volte risponde con *"Sign in to confirm you're not a bot"*. In quel caso:

1. Esporta i cookie di youtube.com in formato Netscape (`cookies.txt`) con un'estensione del browser, meglio da un account secondario.
2. Copiali nel container:
   ```
   scp cookies.txt utente@vps:/tmp/
   ssh utente@vps
   docker cp /tmp/cookies.txt $(docker ps -qf name=studycut):/app/secrets/cookies.txt
   rm /tmp/cookies.txt
   ```
   Il file resta nel volume `studycut-secrets`. StudyCut lo usa dal download successivo.

### yt-dlp sempre aggiornato
Il container aggiorna yt-dlp a ogni avvio e lo ricontrolla ogni 24 ore. Quando esce una versione nuova, aspetta che i download in corso finiscano e poi si riavvia da solo. Non serve nessun cron.

## Aggiungere un tool

Esistono tre tipi, da indicare nel campo `type` di `tool.json`:

| `type` | Quando usarlo | Cosa serve |
|---|---|---|
| `static` | tutto nel browser (HTML/JS): timer, media voti, flashcard… | solo `tool.json` + `public/` |
| `service` | serve un server (Python, Node…): download, conversioni, AI… | `tool.json` + `Dockerfile` + un servizio nel compose |
| `link` | collegamento esterno da mostrare nella home | solo `tool.json` con `url` |

### Tool statico (2 passi)
```
./scripts/new-tool.sh static timer "Timer di studio"
```
1. Metti HTML, CSS e JS in `tools/timer/public/` (l'entry point è `index.html`) e sistema `tools/timer/tool.json`.
2. `git push` → Deploy. Il tool compare nella home e risponde su `/timer/`.

### Tool con server (3 passi)
```
./scripts/new-tool.sh service quiz "Quiz dagli appunti"
```
1. Scrivi il server in `tools/quiz/`. Nel modello c'è un esempio Python che ascolta sulla porta 8000.
2. Aggiungi il servizio a `docker-compose.yml`:
   ```yaml
     quiz:
       build: ./tools/quiz
       restart: unless-stopped
       expose:
         - "8000"
       networks:
         - hub
   ```
3. `git push` → Deploy.

Regole per i tool con server:
- Il nome del servizio nel compose deve corrispondere a `upstream` nel `tool.json` (`quiz:8000`).
- Il gateway toglie il prefisso `/quiz`, quindi il server riceve `/`, `/api/...` ecc.
- Nel frontend usa sempre **percorsi relativi** (`fetch('api/x')`, `<script src="app.js">`), mai `/api/x`.
- L'accesso lo controlla già il gateway: il tool riceve sempre `X-User-Id` (un id esadecimale), `X-User-Name` e `X-User-Quota` (byte). Se `X-User-Id` manca, rispondi 401. Ogni rotta generata contiene `import login`, il controllo dell'accesso definito nel `Caddyfile`.
- Per il pulsante dell'account (profilo, spazio, Esci) aggiungi `<script src="/account/badge.js" defer></script>`; resta in alto a destra, oppure va dentro un elemento con l'attributo `data-account`.
- I file di un utente vanno in `/data/users/<X-User-Id>/<id-del-tool>/`, montando il volume `userdata` (vedi l'esempio commentato nel compose). Prima di salvare, controlla che tutta la cartella `/data/users/<X-User-Id>/` resti sotto `X-User-Quota`.

### `tool.json`
```jsonc
{
  "id": "quiz",                 // = nome della cartella e del percorso /quiz/ (a-z, 0-9, -)
  "name": "Quiz dagli appunti",
  "type": "service",            // static | service | link
  "upstream": "quiz:8000",      // solo service: servizio:porta nel compose
  "url": "https://…",           // solo link
  "maxUpload": "500MB",         // facoltativo: limite upload (service)
  "category": "memo",           // id da tools/categories.json
  "icon": "quiz",               // icona della home (cut, mic, cards, quiz, cal, timer, cap, book, …; "box" di default)
  "iconSvg": "<path d='…'/>",   // facoltativo: SVG 24×24 personalizzato, al posto di "icon"
  "order": 20,                  // posizione: i numeri più bassi vengono prima
  "isNew": true,                // badge "Nuovo"
  "enabled": true,              // false = nascosto e senza rotta
  "description": "…",
  "tags": ["TXT", "PDF"],       // compaiono nella card e diventano filtri di ricerca
  "keywords": "domande test simulazione esame",
  "featured": {                 // facoltativo: animazione a schermo intero nella home, sotto la ricerca
    "headline": "Le lezioni, senza pause.",   // titolo del finale, sotto il logo
    "sub": "Toglie i silenzi e la fa scorrere fino a 3×.",
    "demo": "cut",              // il "film" da FILMS in home/home.js (senza: logo + titolo + pulsante)
    "fx": "tunnel",             // sfondo: tunnel | topo | slats | waves (facoltativo)
    "preset": { "cableColor": "#3d6ff5" }     // opzioni dello sfondo
  }
}
```
I nomi delle icone disponibili sono nell'oggetto `I` in `home/home.js`. Ogni tool con `featured` ha la sua sezione a schermo intero: lo scroll ci si aggancia (serve una spinta in più per andare oltre), parte quando è visibile, si ferma quando esce e alla fine resta sul logo con il pulsante Apri. Per un film nuovo aggiungi una voce a `FILMS` in `home/home.js` (`length`, `html()`, `mount()` che restituisce `render(ms)`) e gli stili in fondo a `home/home.css`; il film `cut` di StudyCut è un esempio completo.
Se un `tool.json` contiene un errore, la build del gateway si ferma con un messaggio chiaro e il sito già online resta com'è.

Per provare la generazione prima del push:
```
node scripts/build-registry.mjs tools dist
```

## Comandi utili (SSH sulla VPS)

```
docker ps --filter name=studykit                     # stato dei container
docker logs -f $(docker ps -qf name=studycut)        # log StudyCut
docker logs -f $(docker ps -qf name=gateway)         # accessi web
docker exec $(docker ps -qf name=studycut) du -sh /data/users/*   # spazio usato da ogni utente
docker logs -f $(docker ps -qf name=account)         # log degli accessi
```
I log e il terminale dei container sono anche nell'interfaccia di Dokploy (schede **Logs** e **Monitoring**).

## Problemi

- **Anteprima o ricerca YouTube in StudyCut non funzionano:** usano yt-dlp come i download (`api/probe`, `api/search`), quindi di solito basta aggiornarlo (vedi *yt-dlp sempre aggiornato*). La lingua dei titoli si cambia con `STUDYCUT_LANG` (predefinita `it`).
- **Torno sempre alla pagina di accesso:** il cookie di sessione è `Secure` quando il sito è in HTTPS. Apri il sito con `https://` e controlla che Traefik passi `X-Forwarded-Proto` (Dokploy lo fa già).
- **"Spazio esaurito":** l'utente ha raggiunto `USER_QUOTA_GB`. Può cancellare video o esportazioni, oppure puoi alzargli il limite con `server.py quota`.

- **Upload di file grandi:** StudyCut carica i file a pezzi da 8 MB, quindi i timeout di Traefik non lo bloccano. Se la connessione cade, riprova da solo fino a 5 volte.
- **404 su `/<tool>/`:** controlla che la cartella non inizi con `_`, che `id` sia uguale al nome della cartella e che `enabled` non sia `false`. Poi rifai il deploy: le rotte vengono generate durante la build.
- **502 su un tool con server:** il container non è partito oppure `upstream` non corrisponde al nome del servizio o alla porta. Controlla i log del tool.
