/* 워드맥스5 단어테스트 - 단일 파일 PWA
   - Day 선택(모달) / 퀴즈(4지선다) / 플래시카드 / 오답만
   - 발음: Web Speech API (speechSynthesis)
*/
const $ = (id) => document.getElementById(id);

const state = {
  data: {},        // { Day1: [{word,meaning}, ...], ... }
  day: "Day1",
  mode: "quiz",    // "quiz" | "flash"
  list: [],        // current questions
  idx: 0,
  correct: 0,
  answered: new Map(), // idx -> {picked, correct}
  wrongSet: new Set(), // word keys
  onlyWrong: false
};

function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}

function normalizeDay(dayKey){
  return dayKey.replace(/^day/i, "Day");
}

async function loadData(){
  const res = await fetch("./data.json");
  state.data = await res.json();
  // default day: first key sorted by number
  const keys = Object.keys(state.data).sort((a,b)=>{
    const na=parseInt(a.replace(/\D/g,''))||0;
    const nb=parseInt(b.replace(/\D/g,''))||0;
    return na-nb;
  });
  if(keys.length) state.day = keys[0];

  buildDayGrid(keys);
  resetForDay();
  $("quizCard").style.display = "";
}

function buildDayGrid(keys){
  const grid = $("dayGrid");
  grid.innerHTML = "";
  keys.forEach((k)=>{
    const btn = document.createElement("button");
    btn.className = "primary";
    btn.textContent = k;
    btn.style.width = "100%";
    btn.onclick = () => {
      state.day = normalizeDay(k);
      closeModal();
      resetForDay();
    };
    grid.appendChild(btn);
  });
}

function resetForDay(){
  $("dayPill").textContent = state.day;
  state.idx = 0;
  state.correct = 0;
  state.answered = new Map();
  state.wrongSet = new Set();
  state.onlyWrong = false;
  $("wrongBtn").textContent = "오답만";
  $("summaryCard").style.display = "none";

  const raw = (state.data[state.day] || []).map(x => ({...x}));
  state.list = shuffle(raw);

  render();
}

function setMode(newMode){
  state.mode = newMode;
  $("modePill").textContent = (state.mode === "quiz") ? "퀴즈 모드" : "플래시카드";
  render();
}

function progressText(){
  const total = state.list.length;
  const cur = Math.min(state.idx+1, total);
  const wrong = state.wrongSet.size;
  return `진행: ${cur} / ${total} · 정답: ${state.correct} · 오답: ${wrong}`;
}

function speak(text){
  try{
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    // Prefer English voice if available
    const voices = window.speechSynthesis.getVoices();
    const en = voices.find(v => /en(-|_)?/i.test(v.lang)) || voices.find(v => /English/i.test(v.name));
    if(en) u.voice = en;
    u.rate = 0.95;
    u.pitch = 1.0;
    window.speechSynthesis.speak(u);
  }catch(e){
    alert("이 기기에서 발음 기능을 사용할 수 없어요.");
  }
}

function makeChoices(correctMeaning){
  const pool = state.list.map(x => x.meaning).filter(m => m !== correctMeaning);
  shuffle(pool);
  const choices = [correctMeaning, ...pool.slice(0,3)];
  return shuffle(choices);
}

function currentItem(){
  return state.list[state.idx];
}

function render(){
  $("progressText").textContent = progressText();
  $("scorePill").textContent = `${state.correct} / ${state.list.length}`;

  if(state.list.length === 0){
    $("wordText").textContent = "단어 데이터가 없습니다";
    $("choices").innerHTML = "";
    return;
  }

  // End screen
  if(state.idx >= state.list.length){
    showSummary();
    return;
  }

  const item = currentItem();
  $("wordText").textContent = item.word;
  $("meaningBox").textContent = item.meaning;
  $("meaningBox").style.display = (state.mode === "flash" ? "" : "none");

  $("prevBtn").disabled = (state.idx === 0);
  $("nextBtn").disabled = false;

  // Flashcard mode
  if(state.mode === "flash"){
    $("choices").innerHTML = "";
    $("showBtn").style.display = "";
    return;
  }

  // Quiz mode
  $("showBtn").style.display = "none";

  const already = state.answered.get(state.idx);
  const choices = makeChoices(item.meaning);
  const wrap = $("choices");
  wrap.innerHTML = "";

  choices.forEach((c)=>{
    const btn = document.createElement("button");
    btn.className = "choice";
    btn.textContent = c;
    btn.disabled = !!already;

    btn.onclick = () => {
      const correct = (c === item.meaning);
      state.answered.set(state.idx, { picked: c, correct });
      if(correct) state.correct += 1;
      else state.wrongSet.add(item.word);

      // mark UI
      [...wrap.children].forEach((el)=>{
        el.disabled = true;
        if(el.textContent === item.meaning) el.classList.add("good");
        if(el.textContent === c && !correct) el.classList.add("bad");
      });

      // auto next after a short delay
      setTimeout(()=> next(), 380);
      updateProgressOnly();
    };
    wrap.appendChild(btn);
  });
}

function updateProgressOnly(){
  $("progressText").textContent = progressText();
  $("scorePill").textContent = `${state.correct} / ${state.list.length}`;
}

function next(){
  if(state.idx < state.list.length) state.idx += 1;
  render();
}

function prev(){
  if(state.idx > 0) state.idx -= 1;
  render();
}

function showMeaning(){
  $("meaningBox").style.display = "";
}

function showSummary(){
  $("quizCard").style.display = "none";
  $("summaryCard").style.display = "";
  const total = state.list.length;
  const wrongWords = Array.from(state.wrongSet);
  const acc = total ? Math.round((state.correct/total)*100) : 0;

  const html = `
    <div style="font-size:16px; font-weight:800;">정확도: ${acc}%</div>
    <div style="margin-top:6px;">정답 ${state.correct} / ${total}</div>
    <div style="margin-top:12px; font-weight:700;">오답(${wrongWords.length})</div>
    <div style="margin-top:8px; line-height:1.8;">
      ${wrongWords.length ? wrongWords.map(w => `<span class="pill" style="display:inline-block; margin:4px 6px 0 0;">${w}</span>`).join("") : "<span class='tiny'>오답이 없습니다 🎉</span>"}
    </div>
  `;
  $("summaryText").innerHTML = html;
}

function restart(){
  $("quizCard").style.display = "";
  $("summaryCard").style.display = "none";
  resetForDay();
}

function toggleWrongOnly(){
  if(!state.wrongSet.size){
    alert("아직 오답이 없습니다.");
    return;
  }
  state.onlyWrong = !state.onlyWrong;

  if(state.onlyWrong){
    $("wrongBtn").textContent = "전체로";
    const raw = (state.data[state.day] || []).filter(x => state.wrongSet.has(x.word)).map(x => ({...x}));
    state.list = shuffle(raw);
  }else{
    $("wrongBtn").textContent = "오답만";
    const raw = (state.data[state.day] || []).map(x => ({...x}));
    state.list = shuffle(raw);
  }
  state.idx = 0;
  state.correct = 0;
  state.answered = new Map();
  render();
}

function openModal(){
  $("dayModal").style.display = "flex";
}
function closeModal(){
  $("dayModal").style.display = "none";
}

function setupPWAInstall(){
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    $("installBtn").style.display = "";
  });

  $("installBtn").onclick = async () => {
    if(!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    $("installBtn").style.display = "none";
  };
}

function registerSW(){
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
  }
}

// events
$("dayBtn").onclick = openModal;
$("closeModalBtn").onclick = closeModal;
$("dayModal").onclick = (e)=> { if(e.target === $("dayModal")) closeModal(); };

$("modeBtn").onclick = ()=> setMode(state.mode === "quiz" ? "flash" : "quiz");
$("resetBtn").onclick = resetForDay;

$("speakBtn").onclick = ()=> {
  const item = currentItem();
  if(item) speak(item.word);
};

$("nextBtn").onclick = next;
$("prevBtn").onclick = prev;
$("showBtn").onclick = showMeaning;
$("wrongBtn").onclick = toggleWrongOnly;

$("restartBtn").onclick = restart;

// init
setupPWAInstall();
registerSW();

// Speech voice list may load async in some browsers
if(window.speechSynthesis){
  window.speechSynthesis.onvoiceschanged = ()=>{};
}

loadData().catch((e)=>{
  console.error(e);
  $("progressText").textContent = "데이터를 불러오지 못했습니다.";
});