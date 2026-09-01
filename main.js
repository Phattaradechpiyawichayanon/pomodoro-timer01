import './style.css'

const FOCUS_DEFAULT = 25
const BREAK_DEFAULT = 5

const state = {
  mode: 'focus',
  focusMin: FOCUS_DEFAULT,
  breakMin: BREAK_DEFAULT,
  remaining: FOCUS_DEFAULT * 60,
  total: FOCUS_DEFAULT * 60,
  running: false,
  rounds: 0,
  intervalId: null,
}

let audioCtx = null

function beep() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.connect(gain)
  gain.connect(audioCtx.destination)
  osc.type = 'sine'
  osc.frequency.value = 880
  gain.gain.setValueAtTime(0.0001, audioCtx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.3, audioCtx.currentTime + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.5)
  osc.start()
  osc.stop(audioCtx.currentTime + 0.5)
}

function fmt(sec) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function applyTheme() {
  const root = document.documentElement
  if (state.mode === 'focus') {
    root.style.setProperty('--bg', 'var(--focus-bg)')
    root.style.setProperty('--bg-2', 'var(--focus-bg-2)')
  } else {
    root.style.setProperty('--bg', 'var(--break-bg)')
    root.style.setProperty('--bg-2', 'var(--break-bg-2)')
  }
}

function modeDuration() {
  return (state.mode === 'focus' ? state.focusMin : state.breakMin) * 60
}

function switchMode() {
  beep()
  if (state.mode === 'focus') {
    state.rounds += 1
    state.mode = 'break'
  } else {
    state.mode = 'focus'
  }
  state.remaining = modeDuration()
  state.total = modeDuration()
  applyTheme()
  render()
}

function tick() {
  state.remaining -= 1
  if (state.remaining <= 0) {
    stopTimer()
    switchMode()
    if (state.running) startTimer()
    return
  }
  renderTimer()
}

function startTimer() {
  if (state.running) return
  if (state.remaining <= 0) {
    state.remaining = modeDuration()
    state.total = modeDuration()
  }
  state.running = true
  state.intervalId = setInterval(tick, 1000)
  renderControls()
}

function pauseTimer() {
  state.running = false
  if (state.intervalId) {
    clearInterval(state.intervalId)
    state.intervalId = null
  }
  renderControls()
}

function stopTimer() {
  state.running = false
  if (state.intervalId) {
    clearInterval(state.intervalId)
    state.intervalId = null
  }
}

function resetTimer() {
  stopTimer()
  state.remaining = modeDuration()
  state.total = modeDuration()
  render()
}

function setMode(mode) {
  if (state.running) return
  state.mode = mode
  state.remaining = modeDuration()
  state.total = modeDuration()
  applyTheme()
  render()
}

function adjust(target, delta) {
  if (state.running) return
  if (target === 'focus') {
    state.focusMin = Math.min(60, Math.max(1, state.focusMin + delta))
  } else {
    state.breakMin = Math.min(30, Math.max(1, state.breakMin + delta))
  }
  state.remaining = modeDuration()
  state.total = modeDuration()
  render()
}

// --- Render ---
const app = document.querySelector('#app')

let ringFg, ringCirc

app.innerHTML = `
  <div class="mode-switch">
    <button data-mode="focus">ทำงาน</button>
    <button data-mode="break">พัก</button>
  </div>

  <div class="timer-ring">
    <svg class="ring-svg" viewBox="0 0 120 120">
      <circle class="ring-bg" cx="60" cy="60" r="54"></circle>
      <circle class="ring-fg" cx="60" cy="60" r="54"
        stroke-dasharray="339.29" stroke-dashoffset="0"></circle>
    </svg>
    <div class="timer-display">
      <div class="time" id="time">25:00</div>
      <div class="mode-label" id="mode-label">FOCUS</div>
    </div>
  </div>

  <div class="controls" id="controls"></div>

  <div class="rounds" id="rounds">รอบที่ทำสำเร็จ: <b id="rounds-num">0</b> รอบ</div>

  <div class="settings">
    <p class="settings-title">ตั้งเวลา (นาที)</p>
    <div class="setting-row">
      <label>เวลาทำงาน</label>
      <div class="stepper">
        <button data-adj="focus" data-delta="-1">−</button>
        <span class="val" id="focus-val">25</span><span class="unit">นาที</span>
        <button data-adj="focus" data-delta="1">+</button>
      </div>
    </div>
    <div class="setting-row">
      <label>เวลาพัก</label>
      <div class="stepper">
        <button data-adj="break" data-delta="-1">−</button>
        <span class="val" id="break-val">5</span><span class="unit">นาที</span>
        <button data-adj="break" data-delta="1">+</button>
      </div>
    </div>
  </div>

  <button class="help-toggle" id="help-btn">วิธีใช้งาน</button>

  <div class="modal-overlay" id="help-modal">
    <div class="modal">
      <h2>วิธีใช้งาน Pomodoro Timer</h2>
      <ol>
        <li>ตั้งเวลาทำงานและเวลาพักตามต้องการ โดยกดปุ่ม + / −</li>
        <li>กดปุ่ม <b>เริ่ม</b> เพื่อนับเวลาถอยหลังของช่วงทำงาน</li>
        <li>เมื่อหมดเวลาทำงาน จะมีเสียงแจ้งเตือน แล้วสลับไปโหมดพักอัตโนมัติ</li>
        <li>พักเสร็จจะสลับกลับมาทำงานต่อ และนับรอบที่ทำสำเร็จเพิ่มขึ้น</li>
        <li>กด <b>หยุดชั่วคราว</b> เพื่อพักได้ทุกเมื่อ กด <b>ตั้งใหม่</b> เพื่อรีเซ็ตเวลา</li>
        <li>เปลี่ยนโหมดได้โดยกดที่แท็บ ทำงาน / พัก (เฉพาะตอนหยุด)</li>
      </ol>
      <button class="modal-close" id="help-close">เข้าใจแล้ว</button>
    </div>
  </div>
`

const timeEl = document.getElementById('time')
const modeLabelEl = document.getElementById('mode-label')
const roundsNumEl = document.getElementById('rounds-num')
const focusValEl = document.getElementById('focus-val')
const breakValEl = document.getElementById('break-val')
const controlsEl = document.getElementById('controls')
const helpModal = document.getElementById('help-modal')

ringFg = app.querySelector('.ring-fg')
ringCirc = 2 * Math.PI * 54

function renderTimer() {
  timeEl.textContent = fmt(state.remaining)
  const progress = state.total > 0 ? state.remaining / state.total : 0
  ringFg.style.strokeDashoffset = String(ringCirc * (1 - progress))
}

function renderControls() {
  controlsEl.innerHTML = ''
  if (state.running) {
    controlsEl.innerHTML = `<button class="ctrl primary" data-act="pause">หยุดชั่วคราว</button>
      <button class="ctrl" data-act="reset">ตั้งใหม่</button>`
  } else {
    controlsEl.innerHTML = `<button class="ctrl primary" data-act="start">เริ่ม</button>
      <button class="ctrl" data-act="reset">ตั้งใหม่</button>`
  }
}

function render() {
  renderTimer()
  renderControls()
  roundsNumEl.textContent = String(state.rounds)
  focusValEl.textContent = String(state.focusMin)
  breakValEl.textContent = String(state.breakMin)
  modeLabelEl.textContent = state.mode === 'focus' ? 'FOCUS' : 'BREAK'

  document.querySelectorAll('.mode-switch button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === state.mode)
  })
}

// --- Events ---
app.addEventListener('click', (e) => {
  const target = e.target
  if (!target) return

  if (target.dataset.mode) {
    setMode(target.dataset.mode)
  } else if (target.dataset.act === 'start') {
    startTimer()
  } else if (target.dataset.act === 'pause') {
    pauseTimer()
  } else if (target.dataset.act === 'reset') {
    resetTimer()
  } else if (target.dataset.adj) {
    adjust(target.dataset.adj, parseInt(target.dataset.delta, 10))
  }
})

document.getElementById('help-btn').addEventListener('click', () => {
  helpModal.classList.add('open')
})
document.getElementById('help-close').addEventListener('click', () => {
  helpModal.classList.remove('open')
})
helpModal.addEventListener('click', (e) => {
  if (e.target === helpModal) helpModal.classList.remove('open')
})

// --- Init ---
applyTheme()
render()
