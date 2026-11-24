/**
 * THE CHAT'S INTRO — a short, animated presentation of what the box is for,
 * shown once to each new visitor, anchored to the launcher.
 *
 * Two quick steps ("this is the chat", "point, ask, find"), then — when the
 * page has a get-started tour to offer (`window.avokaido.tour`, see the
 * onboarding module) — a third asking whether they want that tour as well.
 * On by default; a team turns it off in the console (Chat options → Intro),
 * which reaches here as `intro: false` on the audience answer.
 *
 * Pure DOM inside the widget's shadow root, CSS-only motion, no dependency.
 * The motion stops for anybody who asked for less (`prefers-reduced-motion`),
 * and the still frames say the same thing.
 *
 * Talks to the page with one window event, `avokaido:intro`:
 *   { state: "start" }                — on screen now
 *   { state: "done", tour: boolean }  — finished; tour true when they chose it
 *   { state: "skipped" }              — not shown (off, or already seen)
 */

/** Where "seen" is kept, in this site's storage. Per person once known. */
export var INTRO_KEY = "avokaido.ideas.intro";

/** The storage keys that say [userId] (or this browser) has seen the intro. */
export function introKeys(userId) {
  var keys = [INTRO_KEY];
  if (typeof userId === "string" && userId) keys.push(INTRO_KEY + ":" + userId);
  return keys;
}

/** Whether the intro was seen here, by this browser or this person. */
export function introSeen(storage, userId) {
  try {
    var keys = introKeys(userId);
    for (var i = 0; i < keys.length; i++) if (storage.getItem(keys[i])) return true;
  } catch (e) {
    /* Storage refused: shown again rather than never. */
  }
  return false;
}

/** Remembers that the intro was seen. Never throws. */
export function markIntroSeen(storage, userId) {
  try {
    var keys = introKeys(userId);
    for (var i = 0; i < keys.length; i++) storage.setItem(keys[i], String(Date.now()));
  } catch (e) {
    /* Private mode: shown again next visit, nothing worse. */
  }
}

/**
 * The page's language, "sv" or "en": `<html lang>` first — what the app says
 * it speaks — then the browser's. English for anything else.
 */
export function introLang(htmlLang, navigatorLanguages) {
  var tried = [htmlLang].concat(navigatorLanguages || []);
  for (var i = 0; i < tried.length; i++) {
    var l = String(tried[i] || "").toLowerCase();
    if (!l) continue;
    if (l.indexOf("sv") === 0) return "sv";
    if (l.indexOf("en") === 0) return "en";
  }
  return "en";
}

export var INTRO_COPY = {
  sv: {
    label: "Om chatten",
    skip: "Hoppa över",
    next: "Nästa",
    finish: "Klar",
    no: "Nej tack",
    yes: "Ja, visa runt",
    close: "Stäng",
    startTour: "Starta rundturen",
    of: function (n, total) { return n + " av " + total; },
    allDone: "Klart",
    chat: {
      title: "Hej! Det här är chatten",
      body: "Alla kan föreslå en ändring, med egna ord. Teamets regler avgör vad som byggs direkt och vad som godkänns först.",
      typed: "Kan ni lägga till en matlista?",
      reply: "Bra idé! Jag skriver ihop den.",
      idea: "Idé",
      ideaTitle: "Matlista",
      direct: "Byggs direkt",
      or: "eller",
      signoff: "Godkänns först",
    },
    point: {
      title: "Ta mig dit, fyll i åt mig",
      body: "Fråga var något finns så tar chatten dig dit, eller be den fylla i åt dig. Peka på något så ser vi exakt vad du menar.",
      fieldLabel: "Aktivitet",
      fieldTyped: "Fotboll, tisdagar 17:00",
      fillMe: "Fyll i åt mig →",
      button: "Lägg till",
      label: "Här!",
      takeMe: "Ta mig till Lägg till →",
    },
    tour: {
      title: "Vill du ha en rundtur?",
      body: "Vi visar sidans viktigaste delar på under en minut.",
    },
    doneTour: { title: "Då kör vi!", body: "Rundturen börjar nu. Avokadon väntar här nere om du undrar något." },
    doneNo: { title: "Klart, nu vet du!", body: "Avokadon finns här nere när du vill föreslå något." },
  },
  en: {
    label: "About the chat",
    skip: "Skip",
    next: "Next",
    finish: "Done",
    no: "No thanks",
    yes: "Yes, show me",
    close: "Close",
    startTour: "Start the tour",
    of: function (n, total) { return n + " of " + total; },
    allDone: "Done",
    chat: {
      title: "Hi! This is the chat",
      body: "Anyone can suggest a change, in their own words. Your team's rules decide what's built right away and what gets signed off first.",
      typed: "Could you add a shopping list?",
      reply: "Great idea! I'll write it up.",
      idea: "Idea",
      ideaTitle: "Shopping list",
      direct: "Built right away",
      or: "or",
      signoff: "Signed off first",
    },
    point: {
      title: "Take me there, fill it in",
      body: "Ask where something is and the chat takes you there, or ask it to fill something in for you. Point at something and we'll see exactly what you mean.",
      fieldLabel: "Activity",
      fieldTyped: "Football, Tuesdays 5pm",
      fillMe: "Fill it in for me →",
      button: "Add",
      label: "Here!",
      takeMe: "Take me to Add →",
    },
    tour: {
      title: "Want a guided tour?",
      body: "We'll show you the main parts of the page in under a minute.",
    },
    doneTour: { title: "Let's go!", body: "The tour starts now. The avocado waits down here if you wonder about anything." },
    doneNo: { title: "That's it!", body: "The avocado is down here whenever you want to suggest something." },
  },
};

/** The steps, in order: "chat", "point", and "tour" when there is one to offer. */
export function introSteps(hasTour) {
  return hasTour ? ["chat", "point", "tour"] : ["chat", "point"];
}

/** The intro's stylesheet, read into the widget's own (see `styles`). */
export var INTRO_CSS = [
  ".ai-layer { position: fixed; inset: 0; pointer-events: none;",
  "  font-family: var(--w-font-body, system-ui, -apple-system, 'Segoe UI', sans-serif) }",
  ".ai-scrim { position: fixed; inset: 0; pointer-events: auto;",
  "  backdrop-filter: blur(1.5px); -webkit-backdrop-filter: blur(1.5px);",
  "  animation: ai-fade .5s ease both }",
  ".ai-ring { position: fixed; border-radius: 50%; border: 3px solid var(--w-primary, #2C4112);",
  "  pointer-events: none; animation: ai-ring 2.4s cubic-bezier(.2,.7,.3,1) .8s infinite }",
  ".ai-ring.r2 { animation-delay: 2s }",
  ".launcher.ai-wake { animation: ai-wake .9s cubic-bezier(.34,1.56,.64,1) backwards }",
  ".launcher.ai-wake .mark { animation: ai-wiggle 3.4s ease-in-out 1.2s infinite }",
  ".ai-card { position: fixed; pointer-events: auto; box-sizing: border-box;",
  "  display: flex; flex-direction: column; padding: 14px 14px 18px; border-radius: 28px;",
  "  color: var(--w-text, #231502); background: var(--w-bg, #F5F3EC);",
  "  box-shadow: 0 30px 70px rgba(0,0,0,.30), 0 2px 8px rgba(0,0,0,.10);",
  "  transform-origin: 88% 100%; animation: ai-pop .6s cubic-bezier(.34,1.56,.64,1) .35s both }",
  ".ai-arrow { position: absolute; bottom: -8px; width: 18px; height: 18px; border-radius: 3px;",
  "  background: var(--w-bg, #F5F3EC); transform: rotate(45deg) }",
  ".ai-panel { position: relative; height: 172px; border-radius: 20px; overflow: hidden;",
  "  margin-bottom: 18px; background: var(--w-primary-subtle, rgba(44,65,18,.12)) }",
  /* A SHORT WINDOW: the picture shrinks, and on a very short one it goes —
     the words and the buttons always fit. */
  ".ai-card.short .ai-panel { height: 116px; margin-bottom: 12px }",
  ".ai-card.short .ai-panel > * { transform: scale(.68); transform-origin: 50% 0 }",
  ".ai-card.short .ai-panel > .ai-spark, .ai-card.short .ai-panel > .ai-badge { transform: none }",
  ".ai-card.tiny .ai-panel { display: none }",
  ".ai-head { font-family: var(--w-font-head, var(--w-font-body, Georgia, serif));",
  "  font-size: 26px; font-weight: 700; line-height: 1.2; padding: 0 10px; margin: 0 }",
  ".ai-body { font-size: 16px; line-height: 1.5; color: var(--w-muted, #5c5c56);",
  "  padding: 8px 10px 0; margin: 0 }",
  ".ai-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px;",
  "  padding: 18px 10px 0 }",
  ".ai-actions.end { justify-content: flex-end }",
  ".ai-btn { font: inherit; font-weight: 800; font-size: 16px; border: 0; cursor: pointer;",
  "  border-radius: 999px; padding: 13px 22px; min-height: 46px;",
  "  color: var(--w-on-primary, #F5F3EC); background: var(--w-primary, #2C4112);",
  "  transition: transform .15s ease }",
  ".ai-btn:hover { transform: translateY(-1px); background: var(--w-primary-hover, #445A2C) }",
  ".ai-btn:active { transform: scale(.96) }",
  ".ai-btn:focus-visible, .ai-link:focus-visible { outline: 2px solid var(--w-primary, #2C4112); outline-offset: 3px }",
  ".ai-btn.ghost { background: transparent; color: var(--w-text, #231502);",
  "  box-shadow: inset 0 0 0 2px var(--w-border, rgba(0,0,0,.14)) }",
  ".ai-btn.ghost:hover { background: transparent }",
  ".ai-link { font: inherit; font-weight: 700; font-size: 15px; background: none; border: 0;",
  "  cursor: pointer; color: var(--w-muted, #5c5c56); text-decoration: underline;",
  "  text-underline-offset: 3px; padding: 12px 4px; min-height: 44px }",
  ".ai-foot { display: flex; align-items: center; gap: 6px; padding: 14px 10px 0 }",
  ".ai-seg { display: block; width: 30px; height: 6px; border-radius: 3px; overflow: hidden;",
  "  background: var(--w-border, rgba(0,0,0,.12)) }",
  ".ai-fill { display: block; height: 100%; transform-origin: left; background: var(--w-primary, #2C4112) }",
  ".ai-fill.none { transform: scaleX(0) }",
  ".ai-fill.cur { animation: ai-fillin .7s cubic-bezier(.2,.8,.2,1) .25s both }",
  ".ai-count { margin-left: 6px; font-size: 13px; font-weight: 700; color: var(--w-muted, #5c5c56) }",
  ".ai-rise { animation: ai-rise .45s cubic-bezier(.2,.9,.25,1.15) both }",
  ".ai-rise.d1 { animation-delay: .06s } .ai-rise.d2 { animation-delay: .12s } .ai-rise.d3 { animation-delay: .18s }",
  /* TWO SCENES A STEP, one after the other on a loop: each picture shows
     the step's two halves. */
  ".ai-scene { position: absolute; inset: 0 }",
  ".ai-s1a { animation: ai-sa 10s ease infinite } .ai-s1b { animation: ai-sb 10s ease infinite }",
  ".ai-s2a { animation: ai-sa 9.2s ease infinite } .ai-s2b { animation: ai-sb 9.2s ease infinite }",
  /* Step 1, first: a message types itself, and an answer pops back. */
  ".ai-chat { position: absolute; inset: 0; padding: 24px 26px; display: flex; flex-direction: column;",
  "  justify-content: center; gap: 12px }",
  ".ai-ub { align-self: flex-end; padding: 11px 16px; border-radius: 20px 20px 6px 20px;",
  "  font-weight: 700; font-size: 16px; color: var(--w-on-primary, #F5F3EC);",
  "  background: var(--w-primary, #2C4112); box-shadow: 0 6px 16px rgba(0,0,0,.12) }",
  ".ai-typed { display: inline-block; overflow: hidden; white-space: nowrap; vertical-align: bottom;",
  "  max-width: 300px; animation: ai-type 10s steps(30,end) infinite }",
  ".ai-caret { display: inline-block; margin-left: 1px; animation: ai-blink .8s steps(1) infinite }",
  ".ai-ans { align-self: flex-start; padding: 11px 16px; border-radius: 20px 20px 20px 6px;",
  "  font-weight: 600; font-size: 16px; color: var(--w-text, #231502); background: var(--w-bg, #F5F3EC);",
  "  box-shadow: 0 6px 16px rgba(0,0,0,.10); animation: ai-ans 10s cubic-bezier(.34,1.56,.64,1) infinite }",
  /* Step 1, then: the idea goes one of the team's two ways — built right
     away, or signed off first (the link's own settings decide which). */
  ".ai-flow { position: absolute; left: 50%; top: 20px; width: 300px; height: 132px; margin-left: -150px }",
  ".ai-flow svg { position: absolute; left: 0; top: 0; overflow: visible }",
  ".ai-idea { position: absolute; left: 0; top: 38px; width: 112px; height: 56px; box-sizing: border-box;",
  "  padding: 8px 12px; border-radius: 16px; display: flex; flex-direction: column; justify-content: center;",
  "  color: var(--w-text, #231502); background: var(--w-bg, #F5F3EC); box-shadow: 0 8px 18px rgba(0,0,0,.12);",
  "  transform-origin: 30% 50%; animation: ai-idea 10s cubic-bezier(.34,1.56,.64,1) infinite }",
  ".ai-idea small { font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase;",
  "  color: var(--w-muted, #5c5c56) }",
  ".ai-idea b { font-size: 15px; font-weight: 800 }",
  ".ai-branch { fill: none; stroke: var(--w-primary, #2C4112); stroke-width: 3; stroke-linecap: round;",
  "  stroke-dasharray: 1 }",
  ".ai-branch.b1 { animation: ai-l1 10s ease infinite } .ai-branch.b2 { animation: ai-l2 10s ease infinite }",
  ".ai-out { position: absolute; left: 168px; height: 34px; box-sizing: border-box; padding: 0 12px;",
  "  display: flex; align-items: center; gap: 6px; border-radius: 999px; white-space: nowrap;",
  "  font-weight: 800; font-size: 13px; transform-origin: 0 50% }",
  ".ai-out svg { position: static; width: 16px; height: 16px; flex-shrink: 0 }",
  ".ai-out.o1 { top: 14px; color: var(--w-on-primary, #F5F3EC); background: var(--w-primary, #2C4112);",
  "  box-shadow: 0 6px 14px rgba(0,0,0,.14); animation: ai-o1 10s cubic-bezier(.34,1.56,.64,1) infinite }",
  ".ai-out.o2 { top: 84px; color: var(--w-text, #231502); background: var(--w-bg, #F5F3EC);",
  "  box-shadow: inset 0 0 0 2px var(--w-primary, #2C4112); animation: ai-o2 10s cubic-bezier(.34,1.56,.64,1) infinite }",
  ".ai-or { position: absolute; left: 176px; top: 56px; font-size: 12px; font-weight: 700;",
  "  color: var(--w-muted, #5c5c56); animation: ai-o2 10s ease infinite }",
  /* Step 2, first: "take me to" — the chat's button that walks you to what
     you asked about, pressed by the cursor, which then goes there. */
  ".ai-wire { position: absolute; left: 50%; top: 20px; width: 304px; height: 128px; margin-left: -152px }",
  ".ai-bar { position: absolute; left: 0; border-radius: 6px; background: var(--w-border-strong, rgba(0,0,0,.16)) }",
  ".ai-tgt { position: absolute; left: 176px; top: 40px; width: 112px; height: 36px; border-radius: 18px;",
  "  display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px;",
  "  color: var(--w-text, #231502); background: var(--w-bg, #F5F3EC) }",
  ".ai-wire svg { position: absolute; left: 0; top: 0; overflow: visible }",
  ".ai-hl { fill: none; stroke: var(--w-primary, #2C4112); stroke-width: 3; stroke-dasharray: 320;",
  "  animation: ai-draw 9.2s ease infinite }",
  ".ai-lab { position: absolute; left: 176px; top: 88px; padding: 5px 12px; border-radius: 999px;",
  "  font-weight: 800; font-size: 13px; color: var(--w-on-primary, #F5F3EC); background: var(--w-primary, #2C4112);",
  "  animation: ai-lab 9.2s cubic-bezier(.34,1.56,.64,1) infinite }",
  ".ai-take { position: absolute; left: 0; top: 86px; padding: 7px 12px; border-radius: 999px;",
  "  white-space: nowrap; font-weight: 800; font-size: 13px;",
  "  color: var(--w-on-primary, #F5F3EC); background: var(--w-primary, #2C4112);",
  "  box-shadow: 0 6px 14px rgba(0,0,0,.14); transform-origin: 20% 50%;",
  "  animation: ai-take 9.2s cubic-bezier(.34,1.56,.64,1) infinite }",
  ".ai-take.fill { animation-name: ai-takeb }",
  ".ai-cur { position: absolute; left: 24px; top: 98px; animation: ai-cur 9.2s cubic-bezier(.45,0,.2,1) infinite }",
  ".ai-cur.fill { animation-name: ai-curb }",
  ".ai-cur path { fill: var(--w-text, #231502); stroke: var(--w-bg, #F5F3EC); stroke-width: 2; stroke-linejoin: round }",
  /* Step 2, then: "fill it in for me" — a field types itself. */
  ".ai-flabel { position: absolute; left: 2px; top: 2px; font-size: 12px; font-weight: 700;",
  "  color: var(--w-muted, #5c5c56) }",
  ".ai-field { position: absolute; left: 0; top: 22px; width: 288px; height: 42px; box-sizing: border-box;",
  "  padding: 0 14px; display: flex; align-items: center; border-radius: 12px; font-size: 15px; font-weight: 600;",
  "  color: var(--w-text, #231502); background: var(--w-bg, #F5F3EC);",
  "  box-shadow: inset 0 0 0 2px var(--w-border, rgba(0,0,0,.14)); animation: ai-focus 9.2s ease infinite }",
  ".ai-ftype { display: inline-block; overflow: hidden; white-space: nowrap; max-width: 260px;",
  "  animation: ai-ftype 9.2s steps(24,end) infinite }",
  /* Step 3: a path draws itself from stop to stop. */
  ".ai-route { position: absolute; left: 50%; top: 24px; width: 300px; height: 120px; margin-left: -150px }",
  ".ai-route svg { position: absolute; left: 0; top: 0; overflow: visible }",
  ".ai-guide { fill: none; stroke: var(--w-border-strong, rgba(0,0,0,.2)); stroke-width: 3;",
  "  stroke-dasharray: 2 8; stroke-linecap: round }",
  ".ai-trail { fill: none; stroke: var(--w-primary, #2C4112); stroke-width: 4; stroke-linecap: round;",
  "  stroke-dasharray: 1; animation: ai-path 4.4s cubic-bezier(.5,0,.3,1) infinite }",
  ".ai-pin { transform-box: fill-box; transform-origin: center; animation: ai-dot 4.4s cubic-bezier(.34,1.56,.64,1) infinite }",
  ".ai-pin.p2 { animation-delay: .9s } .ai-pin.p3 { animation-delay: 1.9s }",
  ".ai-marker { position: absolute; left: 0; top: 0; width: 22px; height: 22px; margin: -11px 0 0 -11px;",
  "  box-sizing: border-box; border-radius: 50%; background: var(--w-bg, #F5F3EC);",
  "  border: 4px solid var(--w-primary, #2C4112); offset-rotate: 0deg;",
  "  animation: ai-travel 4.4s cubic-bezier(.5,0,.3,1) infinite }",
  /* The end: confetti around the avocado. */
  ".ai-spark { position: absolute; left: 50%; top: 50%; width: 10px; height: 10px;",
  "  animation: ai-burst 1.3s cubic-bezier(.15,.7,.3,1) both }",
  ".ai-badge { position: absolute; left: 50%; top: 50%; width: 76px; height: 76px; border-radius: 50%;",
  "  display: flex; align-items: center; justify-content: center;",
  "  color: var(--w-on-primary, #F5F3EC); background: var(--w-primary, #2C4112);",
  "  box-shadow: 0 12px 28px rgba(0,0,0,.3); animation: ai-bob 2.2s ease-in-out infinite;",
  "  transform: translate(-50%,-50%) }",
  ".ai-badge svg { height: 42px; width: 28px; overflow: visible }",
  "@keyframes ai-wake { 0% { transform: scale(0) rotate(-40deg) } 55% { transform: scale(1.18) rotate(10deg) }",
  "  75% { transform: scale(.94) rotate(-4deg) } 100% { transform: none } }",
  "@keyframes ai-ring { 0% { transform: scale(1); opacity: .6 } 100% { transform: scale(2.5); opacity: 0 } }",
  "@keyframes ai-wiggle { 0%,84%,100% { transform: rotate(0) } 88% { transform: rotate(-16deg) }",
  "  92% { transform: rotate(13deg) } 96% { transform: rotate(-6deg) } }",
  "@keyframes ai-pop { 0% { opacity: 0; transform: translateY(28px) scale(.55) } 100% { opacity: 1; transform: none } }",
  "@keyframes ai-rise { 0% { opacity: 0; transform: translateX(30px) } 100% { opacity: 1; transform: none } }",
  "@keyframes ai-fade { from { opacity: 0 } to { opacity: 1 } }",
  "@keyframes ai-fillin { from { transform: scaleX(0) } to { transform: scaleX(1) } }",
  "@keyframes ai-sa { 0%,46% { opacity: 1 } 50%,96% { opacity: 0 } 100% { opacity: 1 } }",
  "@keyframes ai-sb { 0%,48% { opacity: 0 } 52%,94% { opacity: 1 } 98%,100% { opacity: 0 } }",
  "@keyframes ai-type { 0%,3% { max-width: 0 } 20%,100% { max-width: 300px } }",
  "@keyframes ai-blink { 50% { opacity: 0 } }",
  "@keyframes ai-ans { 0%,22% { opacity: 0; transform: translateY(10px) scale(.85) } 27%,100% { opacity: 1; transform: none } }",
  "@keyframes ai-idea { 0%,50% { opacity: 0; transform: scale(.6) } 55%,100% { opacity: 1; transform: none } }",
  "@keyframes ai-l1 { 0%,56% { stroke-dashoffset: 1 } 62%,100% { stroke-dashoffset: 0 } }",
  "@keyframes ai-l2 { 0%,68% { stroke-dashoffset: 1 } 74%,100% { stroke-dashoffset: 0 } }",
  "@keyframes ai-o1 { 0%,61% { opacity: 0; transform: translateX(-8px) scale(.8) } 65%,100% { opacity: 1; transform: none } }",
  "@keyframes ai-o2 { 0%,73% { opacity: 0; transform: translateX(-8px) scale(.8) } 77%,100% { opacity: 1; transform: none } }",
  "@keyframes ai-cur { 0%,4% { transform: translate(0,0) } 5.5% { transform: translate(0,0) scale(.82) }",
  "  7% { transform: translate(0,0) scale(1) } 19% { transform: translate(168px,-68px) }",
  "  21% { transform: translate(168px,-68px) scale(.82) } 23%,48% { transform: translate(168px,-68px) scale(1) }",
  "  50%,100% { transform: translate(0,0) } }",
  "@keyframes ai-take { 0% { opacity: 0; transform: translateY(8px) scale(.8) } 3%,5% { opacity: 1; transform: none }",
  "  6% { opacity: 1; transform: scale(.93) } 7%,14% { opacity: 1; transform: none }",
  "  18%,100% { opacity: 0; transform: translateY(4px) } }",
  "@keyframes ai-draw { 0%,20% { stroke-dashoffset: 320 } 30%,100% { stroke-dashoffset: 0 } }",
  "@keyframes ai-lab { 0%,27% { opacity: 0; transform: translateY(8px) scale(.7) } 31%,100% { opacity: 1; transform: none } }",
  "@keyframes ai-takeb { 0%,50% { opacity: 0; transform: translateY(8px) scale(.8) } 53%,55% { opacity: 1; transform: none }",
  "  56% { opacity: 1; transform: scale(.93) } 57%,64% { opacity: 1; transform: none }",
  "  68%,100% { opacity: 0; transform: translateY(4px) } }",
  "@keyframes ai-curb { 0%,54% { transform: translate(0,0) } 55.5% { transform: translate(0,0) scale(.82) }",
  "  57% { transform: translate(0,0) scale(1) } 64%,100% { transform: translate(150px,-60px) } }",
  "@keyframes ai-focus { 0%,62% { box-shadow: inset 0 0 0 2px var(--w-border, rgba(0,0,0,.14)) }",
  "  66%,100% { box-shadow: inset 0 0 0 2px var(--w-primary, #2C4112) } }",
  "@keyframes ai-ftype { 0%,66% { max-width: 0 } 84%,100% { max-width: 260px } }",
  "@keyframes ai-path { 0% { stroke-dashoffset: 1 } 62%,90% { stroke-dashoffset: 0; opacity: 1 }",
  "  100% { stroke-dashoffset: 0; opacity: 0 } }",
  "@keyframes ai-travel { 0% { offset-distance: 0%; opacity: 1 } 62%,90% { offset-distance: 100%; opacity: 1 }",
  "  100% { offset-distance: 100%; opacity: 0 } }",
  "@keyframes ai-dot { 0%,4% { transform: scale(0) } 12% { transform: scale(1.35) } 18%,90% { transform: scale(1) }",
  "  100% { transform: scale(0) } }",
  "@keyframes ai-burst { 0% { transform: translate(-50%,-50%) scale(0); opacity: 1 } 70% { opacity: 1 }",
  "  100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1); opacity: 0 } }",
  "@keyframes ai-bob { 0%,100% { transform: translate(-50%,-50%) scale(1) } 50% { transform: translate(-50%,-58%) scale(1.06) } }",
  /* LESS MOTION, SAME MESSAGE: every animation off, and each picture left on
     its last frame — the message typed, the button ringed, the path drawn. */
  "@media (prefers-reduced-motion: reduce) {",
  "  .ai-layer *, .launcher.ai-wake, .launcher.ai-wake .mark { animation: none !important; transition: none !important }",
  "  .ai-ring, .ai-spark, .ai-caret, .ai-marker { display: none }",
  "  .ai-s1b, .ai-s2b, .ai-take { display: none }",
  "  .ai-cur { transform: translate(168px,-68px) }",
  "  .ai-hl, .ai-trail { stroke-dashoffset: 0 }",
  "}",
].join("\n");

var ROUTE = "M20 92 C 70 10, 120 20, 150 62 S 240 118, 282 28";
var CURSOR = "M3 2l19 13-8.5 1.6L18 26l-4 2-4.4-9.4L3 24z";
var SPARK_COLOURS = ["var(--w-primary, #2C4112)", "#f2b84b", "#e9785a", "#8cc084"];

/** The confetti's sixteen pieces: where each flies, and its colour. */
export function sparks() {
  var out = [];
  for (var i = 0; i < 16; i++) {
    var a = (i / 16) * Math.PI * 2;
    var r = 120 + (i % 3) * 26;
    out.push({
      dx: Math.round(Math.cos(a) * r),
      dy: Math.round(Math.sin(a) * r * 0.55),
      colour: SPARK_COLOURS[i % 4],
      delay: (i % 4) * 0.05,
      round: i % 2 === 1,
    });
  }
  return out;
}

/**
 * Where the card goes for a launcher at [rect] in a [vw]×[vh] window: above
 * it, its right edge lined up with the launcher's, its little arrow pointing
 * at the launcher's middle. Full width less 16 on each side on a phone.
 */
export function placeIntro(rect, vw, vh) {
  var narrow = vw < 520;
  var width = narrow ? vw - 32 : Math.min(404, vw - 32);
  var centre = rect.left + rect.width / 2;
  var right = narrow ? 16 : Math.max(16, vw - rect.right);
  // Launcher in a left corner: the card lines up with its left edge instead.
  var leftSide = !narrow && centre < vw / 2;
  var left = narrow ? 16 : leftSide ? Math.max(16, rect.left) : vw - right - width;
  var arrow = Math.min(width - 30, Math.max(12, centre - left - 9));
  var above = rect.top > vh / 2;
  return {
    left: left,
    width: width,
    // Above a launcher in the lower half, below one in the upper half.
    top: above ? null : rect.bottom + 16,
    bottom: above ? vh - rect.top + 16 : null,
    arrowLeft: arrow,
    arrowEdge: above ? "bottom" : "top",
    centreX: centre,
    centreY: rect.top + rect.height / 2,
  };
}

function el(tag, cls, text) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function svg(markup, cls, w, h) {
  var holder = document.createElement("span");
  holder.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg"' + (cls ? ' class="' + cls + '"' : "") +
    ' width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + " " + h + '" aria-hidden="true">' +
    markup + "</svg>";
  return holder.firstChild;
}

/**
 * Shows the intro in [root] (the widget's shadow root), just under
 * [launcher] in the stacking order, and calls [onEnd] once with how it went:
 * `{ tour: true }` for "yes, show me", `{ tour: false }` otherwise.
 * `mark` is the avocado's SVG markup for the last card. Returns `stop()`.
 */
export function runIntro(opts) {
  var root = opts.root;
  var launcher = opts.launcher;
  var copy = INTRO_COPY[opts.lang] || INTRO_COPY.en;
  var steps = introSteps(opts.hasTour);
  var total = steps.length;
  var index = 0;
  var ended = false;
  var finished = null; // { tour } once a choice is made; the last card shows

  var layer = el("div", "ai-layer");
  var scrim = el("div", "ai-scrim");
  var ring1 = el("span", "ai-ring");
  var ring2 = el("span", "ai-ring r2");
  var card = el("div", "ai-card");
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "false");
  card.setAttribute("aria-label", copy.label);
  layer.appendChild(scrim);
  layer.appendChild(ring1);
  layer.appendChild(ring2);
  layer.appendChild(card);
  // Under the launcher: it stays on top, lit, and pressable.
  root.insertBefore(layer, launcher);
  launcher.classList.add("ai-wake");

  /**
   * The launcher's box WITHOUT its wake-up animation: the animation scales it
   * from nothing about its centre, so the centre is right at any moment but
   * the size is not — the size is read from layout instead.
   */
  function launcherBox() {
    var b = launcher.getBoundingClientRect();
    var w = launcher.offsetWidth || b.width;
    var h = launcher.offsetHeight || b.height;
    var cx = b.left + b.width / 2;
    var cy = b.top + b.height / 2;
    return { left: cx - w / 2, top: cy - h / 2, right: cx + w / 2, bottom: cy + h / 2, width: w, height: h };
  }

  function place() {
    var r = launcherBox();
    var p = placeIntro(r, window.innerWidth, window.innerHeight);
    card.style.left = p.left + "px";
    card.style.width = p.width + "px";
    card.style.top = p.top == null ? "" : p.top + "px";
    card.style.bottom = p.bottom == null ? "" : p.bottom + "px";
    card.style.transformOrigin = (p.arrowLeft + 9) + "px " + (p.arrowEdge === "bottom" ? "100%" : "0");
    var arrow = card.querySelector(".ai-arrow");
    if (arrow) {
      arrow.style.left = p.arrowLeft + "px";
      arrow.style.top = p.arrowEdge === "top" ? "-8px" : "";
      arrow.style.bottom = p.arrowEdge === "bottom" ? "-8px" : "";
    }
    // Fits the room above (or below) the launcher, shrinking the picture
    // when it has to.
    var room = p.bottom != null ? r.top - 16 - 8 : window.innerHeight - p.top - 8;
    card.classList.remove("short", "tiny");
    if (card.offsetHeight > room) card.classList.add("short");
    if (card.offsetHeight > room) {
      card.classList.remove("short");
      card.classList.add("tiny");
    }
    var hole = Math.max(r.width, r.height) / 2 + 14;
    scrim.style.background =
      "radial-gradient(circle at " + p.centreX + "px " + p.centreY + "px, rgba(0,0,0,0) 0 " +
      hole + "px, rgba(10,16,13,.5) " + (hole + 4) + "px)";
    var size = r.width;
    var rings = [ring1, ring2];
    for (var i = 0; i < rings.length; i++) {
      rings[i].style.left = r.left + "px";
      rings[i].style.top = r.top + "px";
      rings[i].style.width = size + "px";
      rings[i].style.height = r.height + "px";
    }
  }

  function button(label, kind, onClick) {
    var b = el("button", kind === "link" ? "ai-link" : kind === "ghost" ? "ai-btn ghost" : "ai-btn", label);
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
  }

  function picture(step) {
    var panel = el("div", "ai-panel");
    if (step === "chat") {
      var talk = el("div", "ai-scene ai-s1a");
      var chat = el("div", "ai-chat");
      var ub = el("div", "ai-ub");
      ub.appendChild(el("span", "ai-typed", copy.chat.typed));
      ub.appendChild(el("span", "ai-caret", "|"));
      chat.appendChild(ub);
      chat.appendChild(el("div", "ai-ans", copy.chat.reply));
      talk.appendChild(chat);
      panel.appendChild(talk);

      var next = el("div", "ai-scene ai-s1b");
      var flow = el("div", "ai-flow");
      flow.appendChild(
        svg(
          '<path class="ai-branch b1" pathLength="1" d="M112 66 C 142 66, 138 31, 168 31"/>' +
            '<path class="ai-branch b2" pathLength="1" d="M112 66 C 142 66, 138 101, 168 101"/>',
          "",
          300,
          132,
        ),
      );
      var idea = el("div", "ai-idea");
      idea.appendChild(el("small", "", copy.chat.idea));
      idea.appendChild(el("b", "", copy.chat.ideaTitle));
      flow.appendChild(idea);
      var o1 = el("div", "ai-out o1");
      o1.appendChild(svg('<path d="M9.5 1L3 9.2h4.3L6.5 15 13 6.8H8.7z" fill="currentColor"/>', "", 16, 16));
      o1.appendChild(el("span", "", copy.chat.direct));
      flow.appendChild(o1);
      flow.appendChild(el("div", "ai-or", copy.chat.or));
      var o2 = el("div", "ai-out o2");
      o2.appendChild(
        svg(
          '<path d="M3 8.5l3.2 3.2L13 4.8" fill="none" stroke="currentColor" stroke-width="2.2" ' +
            'stroke-linecap="round" stroke-linejoin="round"/>',
          "",
          16,
          16,
        ),
      );
      o2.appendChild(el("span", "", copy.chat.signoff));
      flow.appendChild(o2);
      next.appendChild(flow);
      panel.appendChild(next);
    } else if (step === "point") {
      var take = el("div", "ai-scene ai-s2a");
      var wire = el("div", "ai-wire");
      var bars = [[4, 120, 12], [28, 200, 9], [46, 150, 9]];
      for (var i = 0; i < bars.length; i++) {
        var bar = el("div", "ai-bar");
        bar.style.top = bars[i][0] + "px";
        bar.style.width = bars[i][1] + "px";
        bar.style.height = bars[i][2] + "px";
        wire.appendChild(bar);
      }
      wire.appendChild(el("div", "ai-tgt", copy.point.button));
      wire.appendChild(svg('<rect class="ai-hl" x="170" y="34" width="124" height="48" rx="24"/>', "", 304, 128));
      wire.appendChild(el("div", "ai-lab", copy.point.label));
      wire.appendChild(el("div", "ai-take", copy.point.takeMe));
      wire.appendChild(svg('<path d="' + CURSOR + '"/>', "ai-cur", 26, 30));
      take.appendChild(wire);
      panel.appendChild(take);

      var fill = el("div", "ai-scene ai-s2b");
      var form = el("div", "ai-wire");
      form.appendChild(el("div", "ai-flabel", copy.point.fieldLabel));
      var field = el("div", "ai-field");
      field.appendChild(el("span", "ai-ftype", copy.point.fieldTyped));
      field.appendChild(el("span", "ai-caret", "|"));
      form.appendChild(field);
      form.appendChild(el("div", "ai-take fill", copy.point.fillMe));
      form.appendChild(svg('<path d="' + CURSOR + '"/>', "ai-cur fill", 26, 30));
      fill.appendChild(form);
      panel.appendChild(fill);
    } else if (step === "tour") {
      var route = el("div", "ai-route");
      route.appendChild(
        svg(
          '<path class="ai-guide" d="' + ROUTE + '"/>' +
            '<path class="ai-trail" pathLength="1" d="' + ROUTE + '"/>' +
            '<circle class="ai-pin" cx="20" cy="92" r="9" fill="var(--w-primary, #2C4112)"/>' +
            '<circle class="ai-pin p2" cx="150" cy="62" r="9" fill="#f2b84b"/>' +
            '<circle class="ai-pin p3" cx="282" cy="28" r="9" fill="#e9785a"/>',
          "",
          300,
          120,
        ),
      );
      var marker = el("div", "ai-marker");
      marker.style.offsetPath = "path('" + ROUTE + "')";
      route.appendChild(marker);
      panel.appendChild(route);
    } else {
      var list = sparks();
      for (var j = 0; j < list.length; j++) {
        var s = el("span", "ai-spark");
        s.style.setProperty("--dx", list[j].dx + "px");
        s.style.setProperty("--dy", list[j].dy + "px");
        s.style.background = list[j].colour;
        s.style.animationDelay = list[j].delay + "s";
        s.style.borderRadius = list[j].round ? "50%" : "3px";
        panel.appendChild(s);
      }
      var badge = el("div", "ai-badge");
      if (opts.mark) badge.innerHTML = opts.mark;
      panel.appendChild(badge);
    }
    return panel;
  }

  function foot() {
    var f = el("div", "ai-foot");
    for (var i = 0; i < total; i++) {
      var seg = el("span", "ai-seg");
      var cls = finished || i < index ? "ai-fill" : i === index ? "ai-fill cur" : "ai-fill none";
      seg.appendChild(el("span", cls));
      f.appendChild(seg);
    }
    f.appendChild(el("span", "ai-count", finished ? copy.allDone : copy.of(index + 1, total)));
    return f;
  }

  function draw() {
    card.textContent = "";
    card.appendChild(el("span", "ai-arrow"));
    var step = finished ? "done" : steps[index];
    var words =
      step === "done" ? (finished.tour ? copy.doneTour : copy.doneNo) : copy[step];
    card.appendChild(picture(step));
    var head = el("p", "ai-head ai-rise d1", words.title);
    head.id = "ai-head";
    card.setAttribute("aria-labelledby", "ai-head");
    card.appendChild(head);
    card.appendChild(el("p", "ai-body ai-rise d2", words.body));
    var actions = el("div", "ai-actions ai-rise d3");
    var primary;
    if (step === "done") {
      actions.className = "ai-actions end ai-rise d3";
      primary = button(finished.tour ? copy.startTour : copy.close, "primary", function () {
        end(finished.tour);
      });
      actions.appendChild(primary);
    } else if (step === "tour") {
      actions.appendChild(button(copy.no, "ghost", function () { choose(false); }));
      primary = button(copy.yes, "primary", function () { choose(true); });
      actions.appendChild(primary);
    } else {
      actions.appendChild(button(copy.skip, "link", function () { end(false); }));
      var last = index === total - 1;
      primary = button(last ? copy.finish : copy.next, "primary", function () {
        if (last) choose(false);
        else {
          index += 1;
          draw();
        }
      });
      actions.appendChild(primary);
    }
    card.appendChild(actions);
    card.appendChild(foot());
    place();
    try {
      primary.focus({ preventScroll: true });
    } catch (e) {
      primary.focus();
    }
  }

  function choose(tour) {
    finished = { tour: tour };
    draw();
  }

  function onKey(e) {
    if (e.key === "Escape") end(finished ? finished.tour : false);
  }

  function teardown() {
    window.removeEventListener("resize", place);
    root.removeEventListener("keydown", onKey);
    launcher.classList.remove("ai-wake");
    if (layer.parentNode) layer.parentNode.removeChild(layer);
  }

  function end(tour) {
    if (ended) return;
    ended = true;
    teardown();
    opts.onEnd({ tour: Boolean(tour) });
  }

  window.addEventListener("resize", place);
  root.addEventListener("keydown", onKey);
  draw();

  return {
    /** Takes it off the screen without a word to anybody. */
    stop: function () {
      if (ended) return;
      ended = true;
      teardown();
    },
    /** Ends it as if "skip" was pressed. */
    skip: function () {
      end(false);
    },
  };
}
