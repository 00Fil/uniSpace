"""Da parlato a LaTeX: riconosce nella trascrizione le formule dette a voce ("x al quadrato piu' tre x
meno cinque uguale a zero") e le trasforma in LaTeX. Regole deterministiche, nessun modello: se una frase
non e' riconosciuta con sicurezza resta testo normale (meglio una formula in meno che una sbagliata)."""
import re

NUM_W = {"zero": 0, "uno": 1, "una": 1, "un": 1, "due": 2, "tre": 3, "quattro": 4, "cinque": 5, "sei": 6, "sette": 7, "otto": 8,
         "nove": 9, "dieci": 10, "undici": 11, "dodici": 12, "tredici": 13, "quattordici": 14, "quindici": 15, "sedici": 16,
         "diciassette": 17, "diciotto": 18, "diciannove": 19, "venti": 20, "trenta": 30, "quaranta": 40, "cinquanta": 50,
         "sessanta": 60, "settanta": 70, "ottanta": 80, "novanta": 90, "cento": 100, "mille": 1000}
UNITS = {k: v for k, v in NUM_W.items() if 1 <= v <= 9}
TENS = {"venti": 20, "trenta": 30, "quaranta": 40, "cinquanta": 50, "sessanta": 60, "settanta": 70, "ottanta": 80, "novanta": 90}
ORD = {"quadrato": 2, "cubo": 3, "seconda": 2, "terza": 3, "quarta": 4, "quinta": 5, "sesta": 6, "settima": 7, "ottava": 8, "nona": 9, "decima": 10}
GREEK = {"alfa": r"\alpha", "alpha": r"\alpha", "beta": r"\beta", "gamma": r"\gamma", "delta": r"\delta", "epsilon": r"\varepsilon",
         "eta": r"\eta", "teta": r"\theta", "theta": r"\theta", "lambda": r"\lambda", "mu": r"\mu", "ni": r"\nu", "xi": r"\xi",
         "rho": r"\rho", "ro": r"\rho", "sigma": r"\sigma", "tau": r"\tau", "fi": r"\varphi", "phi": r"\varphi", "chi": r"\chi",
         "psi": r"\psi", "omega": r"\omega", "pigreco": r"\pi", "pi": r"\pi"}
BIG = {"delta": r"\Delta", "gamma": r"\Gamma", "sigma": r"\Sigma", "omega": r"\Omega", "lambda": r"\Lambda", "phi": r"\Phi", "psi": r"\Psi"}
LETTER_NAMES = {"ics": "x", "ipsilon": "y", "effe": "f", "gi": "g", "acca": "h", "elle": "l", "emme": "m", "enne": "n", "pi": r"\pi",
                "erre": "r", "esse": "s", "ti": "t", "vu": "v", "zeta": "z", "bi": "b", "ci": "c", "di": "d", "cappa": "k"}
SETS = {"r": r"\mathbb{R}", "n": r"\mathbb{N}", "z": r"\mathbb{Z}", "q": r"\mathbb{Q}", "c": r"\mathbb{C}",
        "erre": r"\mathbb{R}", "enne": r"\mathbb{N}", "zeta": r"\mathbb{Z}"}
FUNCS = {"seno": r"\sin", "coseno": r"\cos", "tangente": r"\tan", "logaritmo": r"\ln", "esponenziale": r"\exp", "arcotangente": r"\arctan",
         "determinante": r"\det", "traccia": r"\operatorname{tr}", "rango": r"\operatorname{rk}", "dimensione": r"\dim",
         "nucleo": r"\ker", "immagine": r"\operatorname{Im}", "span": r"\operatorname{span}", "segno": r"\operatorname{sgn}"}
# relazioni e connettivi: (parole) -> latex
RELS = [
    (("maggiore", "o", "uguale", "a"), r"\ge"), (("minore", "o", "uguale", "a"), r"\le"), (("maggiore", "uguale", "di"), r"\ge"),
    (("minore", "uguale", "di"), r"\le"), (("uguale", "a"), "="), (("è", "uguale", "a"), "="), (("uguale",), "="), (("diverso", "da"), r"\neq"),
    (("maggiore", "di"), ">"), (("minore", "di"), "<"), (("circa", "uguale", "a"), r"\approx"), (("non", "appartiene", "a"), r"\notin"),
    (("appartiene", "a"), r"\in"), (("appartiene", "ad"), r"\in"), (("contenuto", "in"), r"\subseteq"), (("sottoinsieme", "di"), r"\subseteq"),
    (("implica",), r"\Rightarrow"), (("se", "e", "solo", "se"), r"\iff"), (("tende", "a"), r"\to"), (("ortogonale", "a"), r"\perp"),
    (("parallelo", "a"), r"\parallel"), (("unito", "a"), r"\cup"), (("unione",), r"\cup"), (("intersezione",), r"\cap"),
    (("intersecato", "con"), r"\cap"), (("congruo", "a"), r"\equiv"), (("proporzionale", "a"), r"\propto"),
]
RELV = {"=": "=", "<": "<", ">": ">", "<=": r"\le", ">=": r"\ge", "!=": r"\neq", "->": r"\to"}
OPEN = [("parentesi", "tonda", "aperta"), ("aperta", "parentesi", "tonda"), ("apri", "parentesi"), ("aperta", "tonda"), ("parentesi", "aperta"),
        ("aperta", "parentesi"), ("tonda", "aperta")]
CLOSE = [("parentesi", "tonda", "chiusa"), ("chiusa", "parentesi", "tonda"), ("chiudi", "parentesi"), ("chiusa", "tonda"), ("parentesi", "chiusa"),
         ("chiusa", "parentesi"), ("tonda", "chiusa")]
VERB = re.compile(r"^[\w.,]*[\^_=+\-*/<>][\w^_=+\-*/<>().,]*$|^[a-zA-Z]\([\w+\-*/^., ]*\)$", re.U)
MATHCH = re.compile(r"[\^_=+*/<>]|[a-zA-Z0-9]\(")
AMBIG = {"a", "e", "i", "o", "u", "è", "ad", "ed"}
WORD_CLEAN = re.compile(r"[^\w'^_=+\-*/<>().,|]", re.U)


def core(w):
    c = WORD_CLEAN.sub("", w.strip()).lower()
    if not VERB.match(c):  # le parole normali perdono la punteggiatura; i token tipo x^2 o f(x) restano interi
        c = re.sub(r"[^\w']", "", c, flags=re.U)
        c = re.sub(r"^(l|dell|all|nell|sull|un|quest|quell)['’]", "", c) if len(c) > 3 else c
    return c


def num_word(c):
    if c in NUM_W:
        return NUM_W[c]
    for t, v in TENS.items():       # ventuno, trentacinque, ventotto...
        if c.startswith(t[:-1]) and len(c) > len(t) - 1:
            rest = c[len(t) - 1:]
            for u, n in UNITS.items():
                if rest == u or (u in ("uno", "otto") and rest == u):
                    return v + n
    m = re.match(r"^cento(\w+)$", c)
    if m and num_word(m[1]) is not None and num_word(m[1]) < 100:
        return 100 + num_word(m[1])
    return None


def esc_tex(s):
    """Testo normale -> testo sicuro per LaTeX."""
    return "".join({"#": r"\#", "$": r"\$", "%": r"\%", "&": r"\&", "_": r"\_", "{": r"\{", "}": r"\}", "~": r"\textasciitilde{}",
                    "^": r"\textasciicircum{}", "\\": r"\textbackslash{}"}.get(ch, ch) for ch in s)


class Parser:
    """Analisi a discesa ricorsiva sulle parole (gia' in minuscolo, senza punteggiatura)."""

    def __init__(self, toks):
        self.t, self.i, self.strong, self.amb_pos = toks, 0, False, -1   # strong: nell'espressione c'e' qualcosa che non e' una parola normale

    def at(self, k=0):
        j = self.i + k
        return self.t[j] if 0 <= j < len(self.t) else None

    def phrase(self, ph):
        if all(self.at(k) == w for k, w in enumerate(ph)):
            return len(ph)
        return 0

    def first(self, options):
        best = None
        for item in options:
            ph, val = (item, None) if not isinstance(item[0], tuple) and isinstance(item[0], str) else item
            n = self.phrase(ph)
            if n and (best is None or n > best[0]):
                best = (n, val)
        return best

    # --- relazioni:  expr (REL expr)*
    def relation(self):
        left = self.expr()
        if left is None:
            return None
        out = left
        while True:
            save = self.i
            rel = self.rel_op()
            if rel is None:
                break
            right = self.expr()
            if right is None:
                self.i = save
                break
            out += f" {rel} {right}"
            self.strong = True
        return out

    def rel_op(self):
        c = self.at()
        if c in RELV:
            self.i += 1
            return RELV[c]
        lead = 1 if c in ("è", "sono", "sia", "e'") else 0     # "x è maggiore di 0"
        self.i += lead
        best = None
        for ph, val in RELS:
            n = self.phrase(ph)
            if n and (best is None or n > best[0]):
                best = (n, val)
        if best:
            self.i += best[0]
            return best[1]
        self.i -= lead
        return None

    # --- somme:  term ((piu'|meno) term)*
    def expr(self):
        sign = ""
        if self.at() in ("meno", "-") and self.at(1) is not None and getattr(self, "prev", "") not in ("o", "più", "piu"):
            save = self.i
            self.i += 1
            t = self.term()
            if t is None:
                self.i = save
                return None
            out = "-" + t
            self.strong = True
        else:
            out = self.term()
            if out is None:
                return None
        while True:
            c = self.at()
            if c in ("più", "piu", "+", "meno", "-"):
                save = self.i
                self.i += 1
                if self.at() in ("o",) and self.at(1) == "meno":      # "più o meno"
                    self.i = save
                    break
                t = self.term()
                if t is None:
                    self.i = save
                    break
                out += ("+" if c in ("più", "piu", "+") else "-") + t
                self.strong = True
            else:
                break
        return out

    # --- prodotti:  factor ((per|diviso|fratto) factor)*
    def term(self):
        out = self.factor()
        if out is None:
            return None
        while True:
            c = self.at()
            if c in ("per", "diviso", "fratto", "*", "/", "x") and (c != "x" or False):
                save = self.i
                self.i += 1
                if c in ("per", "*") and self.at() in ("ogni", "esempio", "questo", "questa", "il", "la", "lo", "i", "le", "cui", "quanto", "tanto", "che", "me", "noi"):
                    self.i = save
                    break
                f = self.factor()
                if f is None:
                    self.i = save
                    break
                if c in ("fratto", "diviso", "/"):
                    out = rf"\frac{{{out}}}{{{f}}}" if self.simple(out) and self.simple(f) else f"{out}/{f}"
                else:
                    out = rf"{out} \cdot {f}" if (out[-1].isdigit() and f[0].isdigit()) or "\\frac" in out or "\\frac" in f else f"{out}{f}" if f[0].isalpha() or f[0] == "\\" else f"{out} \\cdot {f}"
                self.strong = True
            else:
                # prodotto implicito:  3 x,  2 pi greco,  x y
                save = self.i
                if out and (out[-1].isdigit() or out[-1].isalpha() or out[-1] in "})") and self.at() is not None and self.at() not in AMBIG and self.i - 1 != self.amb_pos:
                    f = self.atom(implicit=True)
                    if f is not None and (f[0].isalpha() or f[0] == "\\" or f[0] == "("):
                        out = f"{out}{f}"
                        self.strong = True
                        continue
                    self.i = save
                break
        return out

    @staticmethod
    def simple(s):
        return re.fullmatch(r"-?[\w\\{}^_.]+", s) is not None

    # --- fattori: atom + esponenti/pedici
    def factor(self):
        a = self.atom()
        if a is None:
            return None
        while True:
            n = self.phrase(("al", "quadrato"))
            if n:
                self.i += n; a = self.pow(a, "2"); continue
            n = self.phrase(("al", "cubo"))
            if n:
                self.i += n; a = self.pow(a, "3"); continue
            if self.at() in ("alla", "all'", "alle") and self.at(1) is not None:
                save = self.i
                self.i += 1
                e = self.exponent()
                if e is None:
                    self.i = save
                    break
                a = self.pow(a, e); continue
            n = self.phrase(("elevato", "a")) or self.phrase(("elevata", "a"))
            if n:
                save = self.i
                self.i += n
                if self.at() == "alla":
                    self.i += 1
                e = self.exponent()
                if e is None:
                    self.i = save
                    break
                a = self.pow(a, e); continue
            if self.at() in ("trasposta", "traspostà"):
                self.i += 1; a = self.pow(a, r"\top"); continue
            if self.at() == "inversa":
                self.i += 1; a = self.pow(a, "-1"); continue
            if self.at() == "indice" and self.at(1) is not None:
                save = self.i
                self.i += 1
                e = self.atom_simple()
                if e is None:
                    self.i = save
                    break
                a = f"{a}_{{{e}}}"; self.strong = True; continue
            if self.at() in ("fattoriale",):
                self.i += 1; a = f"{a}!"; continue
            break
        return a

    def pow(self, a, e):
        self.strong = True
        base = a if re.fullmatch(r"[\w\\]+(\{[^{}]*\})?|\\mathbb\{\w\}|\([^()]*\)|\|[^|]*\|", a) else f"({a})"
        return f"{base}^{{{e}}}"

    def exponent(self):
        c = self.at()
        if c in ORD:
            self.i += 1
            return str(ORD[c])
        if c == "meno" and self.at(1) is not None:
            save = self.i
            self.i += 1
            e = self.atom_simple()
            if e is None:
                self.i = save
                return None
            return "-" + e
        return self.atom_simple()

    def atom_simple(self):
        c = self.at()
        if c is None:
            return None
        n = num_word(c)
        if c.isdigit():
            self.i += 1
            return c
        if n is not None:
            self.i += 1
            return str(n)
        if c in GREEK:
            self.i += 1
            return GREEK[c]
        if len(c) == 1 and c in "abcdefghijklmnopqrstuvwxyz":
            self.i += 1
            return self.letter(self.i - 1)
        if c in LETTER_NAMES and c not in ("di", "ci", "ti", "bi", "pi"):
            self.i += 1
            return LETTER_NAMES[c]
        return None

    # --- atomi
    def atom(self, implicit=False):
        c = self.at()
        if c is None:
            return None
        # parentesi dette a voce
        for ph in OPEN:
            if self.phrase(ph):
                save = self.i
                self.i += len(ph)
                inner = self.relation_inner()
                for cl in CLOSE:
                    if inner is not None and self.phrase(cl):
                        self.i += len(cl)
                        self.strong = True
                        return f"({inner})"
                self.i = save
                return None
        if implicit and c in ("per", "più", "piu", "meno", "uguale"):
            return None
        # costrutti
        r = self.construct()
        if r is not None:
            return r
        # numeri
        if c.isdigit() or re.fullmatch(r"\d+[.,]\d+", c or ""):
            self.i += 1
            return c.replace(",", "{,}") if "," in c else c
        n = num_word(c)
        if n is not None and c not in ("un", "una", "uno") and not implicit:
            self.i += 1
            # "due virgola cinque"
            if self.at() == "virgola" and self.at(1) is not None and num_word(self.at(1)) is not None:
                self.i += 2
                self.strong = True
                return f"{n}{{,}}{num_word(self.t[self.i - 1])}"
            return str(n)
        if c == "infinito":
            self.i += 1; self.strong = True
            return r"\infty"
        if c in ("insieme",) and self.at(1) == "vuoto":
            self.i += 2; self.strong = True
            return r"\emptyset"
        # simboli tipo x^2, f(x), 2x+3 detti da Whisper gia' in forma scritta
        if VERB.match(c) and MATCHCHECK(c):
            self.i += 1; self.strong = True
            return verb_tex(c)
        if c == "pi" and self.at(1) == "greco":
            self.i += 2; self.strong = True
            return r"\pi"
        if c in GREEK:
            self.i += 1; self.strong = True
            return GREEK[c]
        # funzione di:   f di x,  g di x y
        if len(c) == 1 and c in "fgh" and self.at(1) == "di" and not implicit:
            save = self.i
            self.i += 2
            arg = self.atom_simple()
            if arg is not None:
                self.strong = True
                return f"{c}({arg})"
            self.i = save
        if c in LETTER_NAMES and c not in ("di", "ci", "ti", "bi", "pi", "gi", "vu", "esse", "erre", "elle", "emme", "enne", "acca", "cappa"):
            self.i += 1
            self.strong = True
            return LETTER_NAMES[c]
        if len(c) == 1 and c in "abcdefghijklmnopqrstuvwxyz" and (c not in AMBIG):
            self.i += 1
            return self.letter(self.i - 1)
        if len(c) == 1 and c in "aei":
            self.i += 1
            self.amb = True
            self.amb_pos = self.i - 1
            return self.letter(self.i - 1)
        return None

    def letter(self, k):
        """La lettera come scritta (le maiuscole restano maiuscole: A, B per le matrici)."""
        r = re.sub(r"[^A-Za-z]", "", self.raw[k]) if hasattr(self, "raw") and k < len(self.raw) else ""
        return r if len(r) == 1 else self.t[k]

    def relation_inner(self):
        return self.relation()

    def construct(self):
        c = self.at()
        # radice quadrata di X  /  radice n-esima di X
        for ph, idx in ((("radice", "quadrata", "di"), "2"), (("radice", "cubica", "di"), "3"), (("radice", "di"), "2")):
            n = self.phrase(ph)
            if n:
                save = self.i
                self.i += n
                a = self.atom()
                if a is None:
                    self.i = save
                    return None
                self.strong = True
                return rf"\sqrt{{{a}}}" if idx == "2" else rf"\sqrt[{idx}]{{{a}}}"
        # valore assoluto / modulo / norma
        for ph, (l, r) in ((("valore", "assoluto", "di"), ("|", "|")), (("modulo", "di"), ("|", "|")), (("norma", "di"), (r"\|", r"\|"))):
            n = self.phrase(ph)
            if n:
                save = self.i
                self.i += n
                a = self.atom()
                if a is None:
                    self.i = save
                    return None
                self.strong = True
                return f"{l}{a}{r}"
        # funzioni: seno di x, determinante di A, nucleo di f ...
        if c in FUNCS and self.at(1) == "di":
            save = self.i
            self.i += 2
            a = self.atom()
            if a is None:
                self.i = save
                return None
            self.strong = True
            f = FUNCS[c]
            return f"{f}({a})" if c in ("determinante", "traccia", "rango", "dimensione", "segno") else f"{f}\\,{a}" if c in ("nucleo", "immagine", "span") else f"{f}({a})"
        # e alla X
        if c == "e" and self.at(1) in ("alla", "elevato") and self.at(2) is not None:
            save = self.i
            self.i += 2 if self.at(1) == "alla" else 3
            e = self.exponent_expr()
            if e is None:
                self.i = save
                return None
            self.strong = True
            return f"e^{{{e}}}"
        # insiemi: R, N, Z, Q, C (solo dopo "in", "a", "su")
        if c in SETS and self.i > 0 and self.t[self.i - 1] in ("in", "a", "ad", "su", "da", "di", "tra") and (len(c) > 1 or self.raw_upper(self.i)):
            self.i += 1
            s = SETS[c]
            e = self.at()
            if e is not None and (e.isdigit() or num_word(e) is not None or (len(e) == 1 and e in "nmk")) and e not in ("e", "a", "i", "o", "u"):
                self.i += 1
                s = f"{s}^{{{num_word(e) if num_word(e) is not None else e}}}"
            self.strong = True
            return s
        return None

    def exponent_expr(self):
        e = self.exponent()
        return e

    def raw_upper(self, i):
        return self.raw[i][:1].isupper() if hasattr(self, "raw") and i < len(self.raw) else False


def MATCHCHECK(c):
    return bool(MATHCH.search(c)) and not re.fullmatch(r"[\d.,]+", c)


def verb_tex(c):
    s = c.rstrip(".,")
    s = s.replace("<=", r"\le ").replace(">=", r"\ge ").replace("!=", r"\neq ").replace("->", r"\to ").replace("*", r"\cdot ")
    s = re.sub(r"\^(-?\w+)", lambda m: "^{" + m[1] + "}", s)
    s = re.sub(r"_(\w+)", lambda m: "_{" + m[1] + "}", s)
    return s


# --- costrutti lunghi (limite, integrale, derivata, sommatoria): riconosciuti a livello di frase
def special(toks, i, raw):
    """Prova a riconoscere limite/integrale/derivata/sommatoria a partire da toks[i]. Restituisce (latex, n_parole) o None."""
    def sub(j):
        p = Parser(toks[j:])
        p.raw = raw[j:]
        return p
    t = toks
    # limite per X che tende a Y di EXPR
    if t[i:i + 2] == ["limite", "per"] or t[i:i + 2] == ["limite", "di"]:
        j = i + 2
        p = sub(j)
        var = p.atom_simple()
        if var is not None and p.at() == "che" and p.at(1) == "tende" and p.at(2) == "a":
            p.i += 3
            sign = ""
            lim = p.expr()
            if lim is not None:
                if p.at() == "da" and p.at(1) in ("destra", "sinistra"):
                    sign = "^+" if p.at(1) == "destra" else "^-"
                    p.i += 2
                body = None
                if p.at() == "di":
                    p.i += 1
                    q = p
                    body = q.relation()
                if body is not None:
                    return rf"\lim_{{{var} \to {lim}{sign}}} {body}", p.i + (j - i)
    # sommatoria per i che va da A a B di EXPR  /  sommatoria per i da A a B di EXPR
    if t[i] in ("sommatoria", "somma") and t[i + 1:i + 2] == ["per"]:
        p = sub(i + 2)
        var = p.atom_simple()
        if var is not None:
            if p.at() == "che" and p.at(1) == "va":
                p.i += 2
            if p.at() == "da":
                p.i += 1
                a = p.expr()
                if a is not None and p.at() == "a":
                    p.i += 1
                    b = p.expr()
                    if b is not None and p.at() == "di":
                        p.i += 1
                        body = p.relation()
                        if body is not None:
                            return rf"\sum_{{{var}={a}}}^{{{b}}} {body}", p.i + 2 + (i - i)
    # integrale (definito)? (da A a B)? di EXPR d X
    if t[i] == "integrale":
        p = sub(i + 1)
        if p.at() == "definito":
            p.i += 1
        lo = hi = None
        if p.at() == "da":
            p.i += 1
            lo = p.expr()
            if lo is not None and p.at() == "a":
                p.i += 1
                hi = p.expr()
            if lo is None or hi is None:
                return None
        if p.at() == "di":
            p.i += 1
            start = p.i
            # il corpo arriva fino al differenziale: "d x", "di x" (come si pronuncia), "dx".  "di" e' anche la
            # preposizione (f di x), quindi si provano tutti i candidati: prima quelli dopo "in" ("in d x"),
            # poi il piu' lontano per cui il corpo si legge per intero
            cands = []
            for k in range(start + 1, len(p.t)):
                w = p.t[k] or ""
                if w in ("d", "di") and k + 1 < len(p.t) and len(p.t[k + 1] or "") == 1 and (p.t[k + 1] or "").isalpha():
                    cands.append((k, p.t[k + 1], 2))
                elif re.fullmatch(r"d[a-z]", w) and w not in ("di", "da", "de", "do"):
                    cands.append((k, w[1], 1))
            cands.sort(key=lambda c: (p.t[c[0] - 1] == "in", c[0]), reverse=True)
            for k, var, used in cands:
                end = k - 1 if p.t[k - 1] == "in" and k - 1 > start else k
                q = Parser(p.t[start:end])
                q.raw = p.raw[start:end]
                body = q.relation()
                if body is not None and q.i == end - start:
                    lim = f"_{{{lo}}}^{{{hi}}}" if lo is not None else ""
                    return rf"\int{lim} {body}\,d{var}", 1 + k + used
    # derivata di EXPR rispetto a X
    if t[i:i + 2] == ["derivata", "di"]:
        p = sub(i + 2)
        body = p.expr()
        if body is not None and p.at() == "rispetto" and p.at(1) == "a":
            p.i += 2
            var = p.atom_simple()
            if var is not None:
                return rf"\frac{{d}}{{d{var}}}\left({body}\right)", 2 + p.i
    return None


def convert(words):
    """words: [{"w": parola con punteggiatura, "s": inizio, "e": fine}] -> unita' [{"k": "w"|"m", "x", "s", "e", ("p", "src")}]."""
    raw = [w["w"].strip() for w in words]
    toks = [core(w) for w in raw]
    units, i, n = [], 0, len(toks)
    while i < n:
        if not toks[i]:
            i += 1
            continue
        got = None
        sp = special(toks, i, raw) if toks[i] in ("limite", "sommatoria", "somma", "integrale", "derivata") else None
        if sp:
            got = (sp[0], sp[1], True)
        else:
            p = Parser(toks[i:])
            p.raw = raw[i:]
            p.amb = False
            p.prev = toks[i - 1] if i else ""
            tex = p.relation()
            used = p.i
            if tex is not None and used > 0:
                span = toks[i:i + used]
                ok = p.strong or (used == 1 and span[0] in ("ics", "ipsilon") or (used == 1 and span[0] in ("x", "y", "z")))
                if used == 1 and span[0] in AMBIG:
                    ok = False
                if ok and p.amb and not p.strong:
                    ok = False
                if ok:
                    got = (tex, used, False)
        if got:
            tex, used, _ = got
            used = max(1, min(used, n - i))
            last = raw[i + used - 1]
            punct = re.search(r"[.,;:!?]+$", last)
            units.append({"k": "m", "x": tex, "s": words[i]["s"], "e": words[i + used - 1]["e"], "src": " ".join(raw[i:i + used]).rstrip(".,;:!?"),
                          "p": punct[0] if punct else ""})
            i += used
        else:
            units.append({"k": "w", "x": raw[i], "s": words[i]["s"], "e": words[i]["e"]})
            i += 1
    return units
