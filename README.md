# StudyKit

Home con tutti i tool per l'uni e i tool stessi, pronti per **Dokploy** con un unico Docker Compose.
La VPS (Ubuntu 26.04 + Dokploy) si dà per già configurata.

```
studykit/
├─ docker-compose.yml        gateway + un servizio per ogni tool con server
├─ .env.example              variabili da copiare in Dokploy
├─ gateway/                  Caddy: serve la home e inoltra /<tool>/ al container giusto
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
Internet → Traefik (Dokploy, HTTPS) → gateway:80 ─┬─ /            home
                                                  ├─ /studycut/   → studycut:8765   (password)
                                                  └─ /<tool>/     → altri tool
```

- Solo il **gateway** ha un dominio. I tool non sono raggiungibili da fuori, solo attraverso il gateway, sulla rete interna `hub`.
- Ogni tool è una cartella `tools/<id>/` con un file **`tool.json`**. Durante la build il gateway li legge tutti e genera:
  - `tools.json`, l'elenco che la home usa per card, ricerca, categorie e carosello;
  - una rotta Caddy `/<id>/` per ogni tool.
- Quindi la home **non va mai modificata** per aggiungere un tool.

## Deploy su Dokploy

### 1. Metti il progetto su Git
Crea un repository (GitHub, GitLab, Gitea o Bitbucket) e fai il push di questa cartella.

### 2. Crea il servizio Compose
1. Dokploy → **Projects** → **Create Project** (es. `studykit`).
2. Nel progetto: **Create Service** → **Compose** → tipo **Docker Compose**.
3. Scheda **General** → Provider: scegli il repository e il branch, **Compose Path** `./docker-compose.yml`. Salva.

### 3. Variabili d'ambiente
Scheda **Environment**: incolla il contenuto di `.env.example` e cambia almeno `HUB_PASSWORD`.

| Variabile | Default | A cosa serve |
|---|---|---|
| `HUB_USER` | `studente` | utente per i tool protetti |
| `HUB_PASSWORD` | vuota | password per i tool con `"auth": true`. Se è vuota, i tool protetti restano **aperti** |
| `STUDYCUT_PARALLEL` | `3` | download contemporanei |
| `YTDLP_AUTO_UPDATE` | `1` | aggiorna yt-dlp all'avvio e ogni 24 ore |

Evita il carattere `$` nella password: Docker Compose lo interpreta come variabile.

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

- `https://uni.tuodominio.it` → home
- `https://uni.tuodominio.it/studycut/` → StudyCut (chiede utente e password)

Con **Preview Compose** puoi vedere il file con le etichette Traefik che Dokploy aggiunge da solo.
Per fare il deploy automatico a ogni push, attiva **Autodeploy** oppure usa il webhook della scheda **Deployments**.

## Dati e backup

| Volume | Contenuto |
|---|---|
| `studycut-library` | video scaricati, analisi ed export |
| `studycut-secrets` | `cookies.txt` facoltativo per YouTube |

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
- I dati da conservare vanno in un volume, come `studycut-library`.

### `tool.json`
```jsonc
{
  "id": "quiz",                 // = nome della cartella e del percorso /quiz/ (a-z, 0-9, -)
  "name": "Quiz dagli appunti",
  "type": "service",            // static | service | link
  "upstream": "quiz:8000",      // solo service: servizio:porta nel compose
  "url": "https://…",           // solo link
  "auth": true,                 // chiede HUB_USER/HUB_PASSWORD
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
  "featured": {                 // facoltativo: slide nel carosello "In evidenza" (massimo 6)
    "fx": "shapes",             // shapes | tunnel | topo | slats | waves
    "preset": { "text": "QUIZ", "color": "#2a1f4a", "hoverColor": "#c784ff" },
    "specs": [["Domande", "multipla e vero/falso"]],
    "preview": "<div class=\"pv-h\">…</div>"   // facoltativo
  }
}
```
I nomi delle icone disponibili sono nell'oggetto `I` in `home/home.js`.
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
docker exec $(docker ps -qf name=studycut) du -sh /app/library   # spazio usato dai video
```
I log e il terminale dei container sono anche nell'interfaccia di Dokploy (schede **Logs** e **Monitoring**).

## Problemi

- **Upload grandi che si interrompono dopo circa 60 s:** Traefik v3 chiude le richieste lente. In Dokploy → **Settings** → **Web Server** → **Traefik** → modifica `traefik.yml` e aggiungi sotto l'entry point `websecure`:
  ```yaml
  transport:
    respondingTimeouts:
      readTimeout: 0
  ```
  poi riavvia Traefik.
- **404 su `/<tool>/`:** controlla che la cartella non inizi con `_`, che `id` sia uguale al nome della cartella e che `enabled` non sia `false`. Poi rifai il deploy: le rotte vengono generate durante la build.
- **502 su un tool con server:** il container non è partito oppure `upstream` non corrisponde al nome del servizio o alla porta. Controlla i log del tool.
- **Nessuna password richiesta:** `HUB_PASSWORD` è vuota. Impostala e rifai il deploy.
# uniSpace
