# 👥 GUIDA UTENTE - NUOVO SELETTORE SETTIMANE

## Per gli Atleti (Pagina Client)

### Cosa Vedrai

```
┌────────────────────────────────────────────────────┐
│  🔔 | REDTAIL CLIENT | Logout                      │
├────────────────────────────────────────────────────┤
│  Community  |  Massimali                           │
├────────────────────────────────────────────────────┤
│                                                    │
│  SETTIMANE ─────────────────── Ultima modifica: W5 │
│  ┌──────────────────────────────────────────────┐ │
│  │ W1●  W2●  W3●  W4  W5✨  W6  W7  W8  W9   │ │
│  └──────────────────────────────────────────────┘ │
│  ← Indietro 5 Settimane | Avanti 5 Settimane →   │
│                                                    │
│ GIORNI DELLA SETTIMANA:                           │
│ [Mon] [Tue] [Wed] [Thu] [Fri] [Sat] [Sun]       │
│                                                    │
│ (Resto della pagina con il tuo allenamento)      │
│                                                    │
└────────────────────────────────────────────────────┘
```

### Come Usare

1. **Scegliere una settimana:**
   - Clicca su qualsiasi tab (W1, W2, W3, etc.)
   - La settimana selezionata diventa **rossa** con bordo luminoso

2. **Navigare velocemente:**
   - Clicca "← Indietro 5" per saltare 5 settimane indietro
   - Clicca "Avanti 5 →" per saltare 5 settimane avanti

3. **Identificare l'ultima modifica:**
   - Cerca il **badge dorato con stella** ✨ - è l'ultima settimana che il tuo coach ha modificato
   - Hover su quella settimana per vedere l'esatta data/ora

4. **Scrollare le settimane:**
   - Se non vedi una settimana, scorri orizzontalmente nella barra
   - Sfumature ai bordi indicano altre settimane disponibili

### Indicatori Visivi

| Elemento | Significato |
|----------|------------|
| **Scheda Rossa** | Settimana attualmente selezionata |
| **✨ Badge Dorato** | Ultima settimana modificata dal coach |
| **● Pallino Verde** | Settimana con dati/allenamenti |
| **Scheda Grigia** | Settimana senza dati |
| **"5m fa"** | Tempo relativo ultima modifica |

---

## Per i Coach (Pagina Trainer)

### Cosa Vedrai

```
┌────────────────────────────────────────────────────┐
│  ← ATLETI | NOME ATLETA | Logout                  │
├────────────────────────────────────────────────────┤
│                                                    │
│  SETTIMANE ─────────────────── Ultima modifica: W3 │
│  ┌──────────────────────────────────────────────┐ │
│  │ W1●  W2  W3✨  W4●  W5  W6  W7  W8  W9   │ │
│  └──────────────────────────────────────────────┘ │
│  ← Indietro 5 Settimane | Avanti 5 Settimane →   │
│                                                    │
│ GIORNI DELLA SETTIMANA:                           │
│ [Mon] [Tue] [Wed] [Thu] [Fri] [Sat] [Sun]       │
│                                                    │
│ (Modulo di creazione allenamento)                 │
│                                                    │
└────────────────────────────────────────────────────┘
```

### Come Usare

1. **Creare allenamenti per diverse settimane:**
   - Seleziona una settimana (W1, W2, W3, etc.)
   - I giorni della settimana cambiano dinamicamente
   - Scrivi il programma per quel giorno

2. **Monitorare modifiche:**
   - Il **badge dorato** ✨ ti mostra quale settimana hai modificato per ultimo
   - I pallini verdi ● mostrano settimane con allenamenti già creati

3. **Navigare velocemente tra atleti:**
   - Vai indietro a "ATLETI" per selezionare un altro cliente
   - Torna al cliente e il WeekSelector mostrerà i SUOI dati

4. **Vantaggi per il Coach:**
   - Vedi subito quale settimana dell'atleta è più aggiornata
   - Puoi planificare meglio i programmi futuri
   - La navigazione è molto più intuitiva

### Case d'uso Tipici

**Scenario 1: Aggiornare il programma di un atleta**
```
1. Vai a Pagina Trainer → Seleziona Atleta
2. Vedrai subito qual è l'ultima settimana modificata
3. Puoi continuare da lì o crearne una nuova
4. Salva - il badge si aggiorna automaticamente
```

**Scenario 2: Pianificare 8 settimane in avanti**
```
1. Seleziona W1 e crea lunedì
2. Clicca "Avanti 5" → Arrivi a W6
3. Crea i programmi delle settimane 6, 7, 8
4. Torna ai tuoi atleti - il WeekSelector mostra tutto
```

**Scenario 3: Controllare il lavoro dell'atleta**
```
1. Vai a Pagina Client (come atleta)
2. Il WeekSelector mostra l'ultima settimana da te modificata
3. Vedi che feedback ha lasciato l'atleta
4. Puoi editare il programma se necessario
```

---

## Miglioramenti Rispetto a Prima

| Funzione | Prima | Dopo |
|----------|-------|------|
| Navigazione settimane | Frecce singole | Tab scorribili + navigazione rapida |
| Ultima modifica | Sconosciuta | Badge dorato con animazione |
| Data modifica | Non disponibile | Timestamp relativo preciso |
| Visibilità settimane | Una per volta | 8-12 in una volta |
| Feedback visivo | Nessuno | Colori, badge, pallini, animazioni |
| Scalabilità | Difficile per molte settimane | Ottimizzata fino a 100+ settimane |
| Mobile-friendly | Limitato | Responsive con scroll |
| Accessibilità | Base | Tooltip e semantic HTML |

---

## FAQ - Domande Frequenti

### D: Cosa significa il badge dorato ✨?
**R:** È l'ultima settimana che il coach ha modificato o creato. Se stai vedendo W5 con il badge, significa che il tuo programma più recente è della settimana 5.

### D: Se scrollo, le settimane rimangono caricate?
**R:** Sì! Tutte le settimane vengono caricate una volta dal server. Lo scroll è solo visivo.

### D: Posso creare una settimana 100?
**R:** Sì! Il sistema è illimitato. Il selettore si adatta dinamicamente.

### D: Il timestamp "5m fa" si aggiorna?
**R:** No, si aggiorna quando ricarichi la pagina o quando cambi atleta/settimana.

### D: Cosa succede se non c'è un'ultima modifica?
**R:** Non vedrai il badge. Significa che nessuna settimana è stata ancora modificata.

### D: Posso tornare indietro di 10 settimane velocemente?
**R:** Clicca "← Indietro 5" due volte! Oppure scrolla il tab e clicca direttamente su quella settimana.

---

## Tips & Tricks 💡

1. **Scroll rapido:** Invece di usare le frecce, puoi scorrere orizzontalmente direttamente sul tab delle settimane

2. **Hover informativo:** Passa il mouse su una settimana per vedere l'esatta data di modifica nel tooltip

3. **Pallini verdi:** Se vedi un pallino verde ● su una settimana, sai che ha dati (utile per i coach)

4. **Badge animato:** Il badge dorato pulsa leggermente - è facile da notare!

5. **Navigazione da mobile:** Scorrere orizzontalmente è facile anche su phone

---

## Cosa Cambia dal Codice del Coach

**Prima:**
```
       <  Week 1  >
       (solo frecce avanti/indietro)
```

**Dopo:**
```
SETTIMANE ─── Ultima modifica: W5
[W1] [W2] [W3] [W4] [W5✨] [W6] ...
← Indietro 5 | Avanti 5 →
```

✨ Molto più intuitivo e professionale!

---

## Supporto Tecnico

Se il WeekSelector non funziona:
1. Ricarica la pagina (F5)
2. Verifica la connessione a internet
3. Pulisci cache del browser
4. Contatta il support se persiste

---

**Goditi il nuovo WeekSelector! 🎉**
