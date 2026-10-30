# StudyCut

Scarica le lezioni, guardale offline, salta i silenzi e cambia la velocità.

## Sul server (Docker / Dokploy)
StudyCut parte con il resto di StudyKit (vedi il `README.md` principale) e risponde su `/studycut/`.
Nel container:
- ffmpeg e Deno (il runtime JS che yt-dlp usa per YouTube) sono già installati;
- yt-dlp si aggiorna all'avvio e ogni 24 ore;
- i video stanno nel volume `studycut-library`, i cookie facoltativi in `studycut-secrets`.

| Variabile | Default | |
|---|---|---|
| `STUDYCUT_PARALLEL` | 3 | download contemporanei |
| `STUDYCUT_WHISPER_MODEL` | large-v3 | modello di trascrizione (`medium`/`small` se il server è lento) |
| `ANTHROPIC_API_KEY` | vuoto | attiva la correzione **audio + video** con Claude |
| `STUDYCUT_LLM_MODEL` | claude-sonnet-5-5 | modello per la correzione |
| `STUDYCUT_LLM_URL` / `STUDYCUT_LLM_KEY` | vuoto | in alternativa: API compatibile OpenAI con immagini (es. Ollama + qwen2.5vl) |
| `STUDYCUT_LLM` | auto | `off` per non correggere |
| `STUDYCUT_FRAMES` | 1 | `0` per non leggere i fotogrammi |
| `YTDLP_AUTO_UPDATE` | 1 | 0 per non aggiornare yt-dlp |
| `YTDLP_UPDATE_HOURS` | 24 | ogni quante ore controllare gli aggiornamenti |

## Sul tuo computer (senza Docker)
### Avvio
1. Installa **Python 3.9 o versioni successive** (python.org; su Windows spunta "Add Python to PATH").
2. Avvia l'app con un doppio clic:
   - **Windows:** `avvia.bat`
   - **macOS:** `avvia.command` (la prima volta: tasto destro → Apri)
   - **Linux:** `./avvia.command`
3. Il browser si apre su http://127.0.0.1:8765

Al primo avvio l'app installa da sola yt-dlp e ffmpeg in un ambiente separato (`.venv`). A ogni avvio aggiorna yt-dlp: YouTube cambia spesso e così il download continua a funzionare.

## Come si usa
- **Incolla uno o più link** nella barra in alto. Puoi incollare anche un elenco intero: i link compaiono in una lista e puoi togliere quelli che non ti servono. Scegli la qualità oppure **Solo audio**, poi premi Scarica. Si scaricano 3 file alla volta e gli altri restano in coda; per cambiare il numero usa `STUDYCUT_PARALLEL=5`. L'avanzamento compare nella libreria, sotto "In corso".
- Quando il download finisce, l'app trova i silenzi da sola.
- **Player:** i controlli sono tutti sotto il video. Passando il mouse sulla barra vedi l'anteprima del fotogramma. Ci sono anche volume, ±10 s, picture-in-picture e schermo intero.
- **Sidebar:** si chiudono con le icone in alto oppure con i tasti L e P.
- **Salta i silenzi:** dopo l'analisi il server crea una versione del video con le pause già tolte e la manda **in streaming mentre la crea**, come YouTube: pezzi da 2 secondi, il video parte in meno di un secondo. Il player scarica solo i ~30 s che servono e scorre di fila, senza salti né buffering. La barra mostra sempre i tempi del video originale. Se salti più avanti della parte già pronta, il player usa per un momento l'originale saltando le pause, poi torna da solo alla versione in streaming. Se disattivi il salto si torna al video originale nello stesso punto.
- **Velocità:** da 0,5× a 3×, con la voce che resta naturale. Puoi usare i preset o il cursore.
- **Sensibilità:** soglia in dB, durata minima della pausa e margine, così non si tagliano le parole. Se cambi questi valori, premi "Analizza di nuovo".
- **Esporta MP4:** crea un file già tagliato e accelerato da vedere su telefono o tablet. Parte dalla versione senza pause già pronta, quindi è più veloce (a 1× è immediato).
- Puoi anche **importare un file** (icona in alto o trascinandolo nella finestra). Il file viene caricato a pezzi e l'avanzamento compare in "In corso". I formati che il browser non riproduce (AVI, WMV, FLV, MPG…) vengono convertiti in MP4.
- **Libreria:** passando il mouse su un video parte un'anteprima a 10× con i tasti **Apri**, **Archivia** ed **Elimina** (clicca due volte per confermare). Su telefono tieni premuto. I video archiviati restano nella sezione "Archiviati" in fondo alla libreria.
- Il tasto con la casetta in alto a sinistra torna alla home di uniSpace.
- Scorciatoie: Spazio, ←/→ (10 s), ↑/↓ (volume), M (muto), F (schermo intero), [ ] (velocità), S (salta silenzi), L e P (sidebar)

### Trascrizione, segnaposti, tagli, cartelle
- **Trascrizione incrociata audio + video.** Per ogni lezione:
  1. legge il video e tiene un fotogramma per ogni slide o stato della lavagna (cambio scena, oppure ogni 45 s se si scrive a lungo) e ne legge il testo con l'OCR (tesseract);
  2. Whisper large-v3 trascrive l'audio usando come suggerimento le parole viste sulla lavagna (nomi, termini, sigle);
  3. con `ANTHROPIC_API_KEY` (o `STUDYCUT_LLM_URL`) ogni tratto di ~2,5 minuti va a un modello che vede i fotogrammi e il parlato insieme: corregge le parole sentite male, la punteggiatura, e scrive le formule dette a voce in LaTeX con la notazione della lavagna (`$...$` in linea, `$$...$$` per equazioni e matrici). Non riassume e non aggiunge nulla; una frase lunga che si accorcerebbe troppo resta com'era;
  4. ogni formula viene composta con KaTeX sul server: se non compila torna al modello con l'errore, e se resta sbagliata la frase torna alla versione di Whisper. I tempi delle parole restano quelli dell'audio (l'evidenziazione segue la voce).
  Nel pannello compare "audio + video" (corretta) o "audio + lavagna" (solo suggerimenti OCR). La versione di Whisper resta nel file in `raw`.
- **Trascrizione automatica** (Whisper large-v3, la più precisa): parte da sola su ogni nuovo video, una alla volta; può richiedere tempo (circa 3 GB di RAM; la prima volta scarica il modello). Si disattiva in Impostazioni. Il pannello a destra scorre come i testi di Spotify: la frase attuale si illumina lettera per lettera e le formule dette a voce diventano LaTeX (KaTeX). Doppio clic su una frase per correggerla (le formule vanno fra `$...$`). Esporta in `.txt`, `.tex` o PDF.
- **Segnaposti** (tasto B): punti da ritrovare, con nome, visibili sulla barra. **Tagli** (I = inizio, O = fine): parti saltate come i silenzi senza toccare il video; tasto T o "Salta tagli" per attivarli/disattivarli.
- **Libreria:** doppio clic sul titolo per rinominare; "Seleziona" per rinominare in serie (Analisi 1, 2, 3…) o spostare in cartelle; trascina un video su una cartella. "In corso" e le cartelle si aprono in una finestra a griglia.
- **Impostazioni** (ingranaggio in alto): tempo risparmiato, velocità, lingua, qualità, esportazione e sensibilità dei silenzi.

I video sono salvati nella cartella `library/`.

## Problemi
- **"Sign in to confirm you're not a bot":** apri YouTube in Chrome o Firefox su questo computer, poi riprova. L'app riprova da sola usando i cookie del browser. Per scegliere il browser: `set STUDYCUT_BROWSER=firefox` (Windows) oppure `export STUDYCUT_BROWSER=firefox`.
- **Il download non funziona dopo un aggiornamento di YouTube:** riavvia l'app (yt-dlp si aggiorna da solo). Se l'errore parla di "JavaScript runtime", installa Deno da deno.com.
