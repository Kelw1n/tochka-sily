/* ТОЧКА СИЛЫ — вся логика: профили, план, калькулятор, дневник, редактор, backup */

(function () {
  'use strict';

  var STORAGE_KEY = 'tochka-sily-state-v1';
  var DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  var DAY_SHORT = { mon: 'ПН', tue: 'ВТ', wed: 'СР', thu: 'ЧТ', fri: 'ПТ', sat: 'СБ', sun: 'ВС' };
  var JS_DAY_TO_KEY = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' };

  var uidCounter = 0;
  function uid(prefix) {
    uidCounter += 1;
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + uidCounter;
  }

  function ex(name, sets, rLow, rHigh, opts) {
    opts = opts || {};
    return {
      id: uid('ex'),
      name: name,
      sets: sets,
      repsLow: rLow,
      repsHigh: rHigh,
      note: opts.note || '',
      rest: opts.rest || ''
    };
  }

  function buildDefaultPlan() {
    return {
      mon: {
        label: 'Понедельник — Верх',
        off: false,
        exercises: [
          ex('Жим лёжа', 4, 4, 6, { rest: '3–4 мин', note: 'Рабочий вес ~80 кг' }),
          ex('Тяга штанги в наклоне', 4, 6, 8),
          ex('Жим гантелей на наклонной скамье (30°)', 3, 8, 10),
          ex('Подтягивания / верхний блок', 3, 6, 10),
          ex('Жим штанги стоя / жим гантелей сидя', 3, 6, 8),
          ex('Махи в стороны', 3, 12, 20),
          ex('Суперсет бицепс/трицепс', 3, 10, 12),
          ex('Предплечья', 3, 12, 15)
        ]
      },
      tue: {
        label: 'Вторник — Низ',
        off: false,
        exercises: [
          ex('Приседания со штангой', 3, 4, 6),
          ex('Жим ногами', 3, 10, 12),
          ex('Сгибание ног лёжа', 3, 10, 15),
          ex('Икры', 3, 10, 15),
          ex('Пресс', 3, 10, 15),
          ex('Шея', 3, 10, 12),
          ex('Предплечья', 3, 12, 15)
        ]
      },
      wed: { label: 'Среда — отдых', off: true, exercises: [] },
      thu: {
        label: 'Четверг — Верх',
        off: false,
        exercises: [
          ex('Жим лёжа', 3, 8, 10),
          ex('Подтягивания / верхний блок', 4, 6, 8),
          ex('Жим гантелей сидя / жим штанги стоя', 3, 6, 10),
          ex('Горизонтальная тяга блока', 3, 8, 12, { note: 'Иногда можно заменить на тягу штанги' }),
          ex('Махи в стороны', 3, 12, 20),
          ex('Суперсет бицепс/трицепс', 3, 10, 12)
        ]
      },
      fri: {
        label: 'Пятница — Низ',
        off: false,
        exercises: [
          ex('Приседания со штангой', 3, 6, 8),
          ex('Жим ногами', 3, 10, 15),
          ex('Сгибание ног лёжа', 3, 10, 15),
          ex('Икры', 3, 10, 15),
          ex('Пресс', 3, 10, 15),
          ex('Шея', 3, 10, 12),
          ex('Предплечья', 3, 12, 15)
        ]
      },
      sat: { label: 'Суббота — отдых', off: true, exercises: [] },
      sun: { label: 'Воскресенье — отдых', off: true, exercises: [] }
    };
  }

  // ---------- state ----------

  var state = null;

  function makeProfile(name) {
    return {
      id: uid('profile'),
      name: name,
      createdAt: new Date().toISOString(),
      oneRM: { bench: null },
      oneRMHistory: [],
      customPlan: null,
      debt: {},
      log: {}
    };
  }

  function loadState() {
    var raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { raw = null; }
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.profiles && Object.keys(parsed.profiles).length) {
          state = parsed;
          return;
        }
      } catch (e) { /* fall through to fresh state */ }
    }
    var p = makeProfile('Я');
    state = { profiles: {}, activeId: p.id };
    state.profiles[p.id] = p;
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* storage full / disabled */ }
  }

  function getActiveProfile() {
    return state.profiles[state.activeId];
  }

  function getPlan(profile) {
    return profile.customPlan || buildDefaultPlan();
  }
  // cache default plan once so ids are stable across renders in a session
  var DEFAULT_PLAN = buildDefaultPlan();
  function getPlanCached(profile) {
    return profile.customPlan || DEFAULT_PLAN;
  }

  function todayKey() {
    return JS_DAY_TO_KEY[new Date().getDay()];
  }

  function todayIso() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // ---------- toast ----------

  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  // ---------- nav ----------

  function switchView(name) {
    document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
    var target = document.getElementById('view-' + name);
    if (target) target.classList.add('active');
    document.querySelectorAll('nav.tabs button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-nav') === name);
    });
    renderAll();
    var scrollRoot = document.getElementById('scroll-root');
    if (scrollRoot) scrollRoot.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  function bindNav() {
    document.querySelectorAll('[data-nav]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        switchView(el.getAttribute('data-nav'));
      });
    });
  }

  // ---------- HOME ----------

  function renderHome() {
    var profile = getActiveProfile();
    document.getElementById('stat-1rm').textContent = profile.oneRM.bench ? profile.oneRM.bench : '—';
    document.getElementById('stat-sessions').textContent = Object.keys(profile.log).length;
    var tk = todayKey();
    var plan = getPlanCached(profile);
    var day = plan[tk];
    document.getElementById('stat-today').textContent = day && !day.off ? day.label.split('—')[1].trim() : 'Отдых';
  }

  // ---------- CALCULATOR ----------

  function epley(weight, reps) {
    return weight * (1 + reps / 30);
  }

  function renderCalcHistory() {
    var profile = getActiveProfile();
    var box = document.getElementById('calc-history');
    if (!profile.oneRMHistory.length) {
      box.innerHTML = '<div class="empty-state">Пока пусто. Рассчитай и сохрани первый результат.</div>';
      return;
    }
    var rows = profile.oneRMHistory.slice().reverse().slice(0, 10).map(function (h) {
      var d = new Date(h.date);
      var dateStr = d.toLocaleDateString('ru-RU');
      return '<div class="exercise-row"><span class="ex-num">▪</span><span><span class="ex-name">' + dateStr + '</span></span><span class="ex-scheme">' + h.value + ' кг</span></div>';
    }).join('');
    box.innerHTML = rows;
  }

  function bindCalc() {
    document.getElementById('calc-run').addEventListener('click', function () {
      var w = parseFloat(document.getElementById('calc-weight').value);
      var r = parseInt(document.getElementById('calc-reps').value, 10);
      if (!w || !r || w <= 0 || r <= 0) {
        toast('Заполни вес и повторения');
        return;
      }
      var result = Math.round(epley(w, r));
      document.getElementById('calc-val').textContent = result;
      document.getElementById('calc-result').style.display = 'block';
      document.getElementById('calc-actions').style.display = 'flex';
      document.getElementById('calc-actions').dataset.value = result;
    });

    document.getElementById('calc-apply').addEventListener('click', function () {
      var val = parseInt(document.getElementById('calc-actions').dataset.value, 10);
      if (!val) return;
      var profile = getActiveProfile();
      profile.oneRM.bench = val;
      profile.oneRMHistory.push({ date: new Date().toISOString(), value: val });
      saveState();
      renderAll();
      toast('Сохранено: 1ПМ = ' + val + ' кг. Построй программу на вкладке «Жим · 14»');
    });
  }

  // ---------- PROGRAM ----------

  var programSelectedDay = todayKey();

  function suggestedWeightFor(exercise, profile) {
    if (!/жим лёжа/i.test(exercise.name)) return null;
    var oneRM = profile.oneRM.bench;
    if (!oneRM) return null;
    var pct = 0.75;
    if (exercise.repsHigh <= 6) pct = 0.85;
    else if (exercise.repsHigh <= 8) pct = 0.8;
    var raw = oneRM * pct;
    return Math.round(raw / 2.5) * 2.5;
  }

  function dayTabsHtml(tabsId, selectedDay, plan, opts) {
    var todayK = todayKey();
    return DAY_ORDER.map(function (k) {
      var d = plan[k];
      var cls = ['btn'];
      var classes = [];
      if (k === selectedDay) classes.push('active');
      if (k === todayK) classes.push('today');
      if (d.off) classes.push('off');
      return '<button data-day="' + k + '" class="' + classes.join(' ') + '">' + DAY_SHORT[k] + '</button>';
    }).join('');
  }

  function renderProgramExerciseRow(exercise, idx, profile) {
    var suggestion = suggestedWeightFor(exercise, profile);
    var meta = [];
    if (exercise.note) meta.push(exercise.note);
    if (exercise.rest) meta.push('Отдых ' + exercise.rest);
    if (suggestion) meta.push('<b style="color:var(--orange)">Рабочий вес ≈ ' + suggestion + ' кг</b> (по твоему 1ПМ)');
    return '<div class="exercise-row">' +
      '<span class="ex-num">' + (idx + 1) + '</span>' +
      '<span><span class="ex-name">' + exercise.name + '</span>' + (meta.length ? '<div class="ex-meta">' + meta.join(' · ') + '</div>' : '') + '</span>' +
      '<span class="ex-scheme">' + exercise.sets + '×' + exercise.repsLow + (exercise.repsHigh && exercise.repsHigh !== exercise.repsLow ? '–' + exercise.repsHigh : '') + '</span>' +
      '</div>';
  }

  function renderProgram() {
    var profile = getActiveProfile();
    var plan = getPlanCached(profile);
    document.getElementById('program-day-tabs').innerHTML = dayTabsHtml('program-day-tabs', programSelectedDay, plan);
    var day = plan[programSelectedDay];
    var body = document.getElementById('program-body');
    if (day.off) {
      body.innerHTML = '<div class="rest-day-msg"><div class="big">' + day.label + '</div>Восстановление — без силовой работы.</div>';
    } else {
      body.innerHTML = '<div class="panel-title">' + day.label + '</div>' +
        day.exercises.map(function (e, i) { return renderProgramExerciseRow(e, i, profile); }).join('');
    }
    document.querySelectorAll('#program-day-tabs button').forEach(function (b) {
      b.addEventListener('click', function () {
        programSelectedDay = b.getAttribute('data-day');
        renderProgram();
      });
    });
  }

  // ---------- DIARY ----------

  var diarySelectedDay = todayKey();
  var diaryDraft = {}; // exId -> { status, doneSets }

  function debtKeyLabel(dayKey, plan) {
    return plan[dayKey] ? plan[dayKey].label : dayKey;
  }

  function collectDebts(profile) {
    var out = [];
    var plan = getPlanCached(profile);
    Object.keys(profile.debt || {}).forEach(function (exId) {
      var owed = profile.debt[exId];
      if (!owed) return;
      DAY_ORDER.forEach(function (dk) {
        var day = plan[dk];
        if (!day || day.off) return;
        day.exercises.forEach(function (e) {
          if (e.id === exId) out.push({ exId: exId, name: e.name, owed: owed, dayLabel: day.label });
        });
      });
    });
    return out;
  }

  function renderDiaryDebtZone() {
    var profile = getActiveProfile();
    var debts = collectDebts(profile);
    var zone = document.getElementById('diary-debt-zone');
    if (!debts.length) { zone.innerHTML = ''; return; }
    zone.innerHTML = debts.map(function (d) {
      return '<div class="debt-banner">Должок по упражнению <b>' + d.name + '</b>: ' + d.owed + ' подход(а). Добавим их сверху нормы в следующий раз, когда это упражнение будет по плану (' + d.dayLabel + ').</div>';
    }).join('');
  }

  function effectiveTargetSets(exercise, profile) {
    var owed = profile.debt[exercise.id] || 0;
    var capped = Math.min(owed, 2);
    return exercise.sets + capped;
  }

  function renderDiaryBody() {
    var profile = getActiveProfile();
    var plan = getPlanCached(profile);
    var day = plan[diarySelectedDay];
    var body = document.getElementById('diary-body');

    if (!day || day.off) {
      body.innerHTML = '<div class="rest-day-msg"><div class="big">' + (day ? day.label : 'Отдых') + '</div>Сегодня нечего отмечать — день отдыха.</div>';
      return;
    }

    diaryDraft = {};
    body.innerHTML = day.exercises.map(function (e) {
      var target = effectiveTargetSets(e, profile);
      diaryDraft[e.id] = { status: null, doneSets: target };
      return '<div class="diary-row" data-ex="' + e.id + '">' +
        '<div class="diary-top"><div>' +
        '<div class="diary-name">' + e.name + '</div>' +
        '<div class="diary-scheme">Норма: ' + target + '×' + e.repsLow + (e.repsHigh && e.repsHigh !== e.repsLow ? '–' + e.repsHigh : '') + (target > e.sets ? ' <span style="color:var(--orange)">(+' + (target - e.sets) + ' в счёт долга)</span>' : '') + '</div>' +
        '</div></div>' +
        '<div class="status-btns">' +
        '<button data-status="done">Выполнил</button>' +
        '<button data-status="partial">Частично</button>' +
        '<button data-status="skip">Пропустил</button>' +
        '</div>' +
        '<div class="sets-input" style="display:none"><input type="number" min="0" value="' + target + '"><span>подходов сделано из ' + target + '</span></div>' +
        '</div>';
    }).join('') + '<button class="btn" id="diary-save" style="margin-top:6px">Сохранить дневник за день</button>';

    body.querySelectorAll('.diary-row').forEach(function (row) {
      var exId = row.getAttribute('data-ex');
      var setsInputWrap = row.querySelector('.sets-input');
      var setsInput = setsInputWrap.querySelector('input');
      row.querySelectorAll('.status-btns button').forEach(function (btn) {
        btn.addEventListener('click', function () {
          row.querySelectorAll('.status-btns button').forEach(function (b) { b.classList.remove('sel-done', 'sel-partial', 'sel-skip'); });
          var status = btn.getAttribute('data-status');
          btn.classList.add('sel-' + status);
          setsInputWrap.style.display = status === 'partial' ? 'flex' : 'none';
          var target = diaryDraft[exId].doneSets;
          if (status === 'done') diaryDraft[exId] = { status: 'done', doneSets: parseInt(setsInput.value, 10) || target };
          else if (status === 'skip') diaryDraft[exId] = { status: 'skip', doneSets: 0 };
          else diaryDraft[exId] = { status: 'partial', doneSets: parseInt(setsInput.value, 10) || 0 };
        });
      });
      setsInput.addEventListener('input', function () {
        if (diaryDraft[exId].status === 'partial') diaryDraft[exId].doneSets = parseInt(setsInput.value, 10) || 0;
      });
    });

    var saveBtn = document.getElementById('diary-save');
    if (saveBtn) saveBtn.addEventListener('click', function () { saveDiary(day); });
  }

  function saveDiary(day) {
    var profile = getActiveProfile();
    var entries = [];
    var anyMarked = false;
    day.exercises.forEach(function (e) {
      var d = diaryDraft[e.id];
      var target = effectiveTargetSets(e, profile);
      if (!d.status) return;
      anyMarked = true;
      var doneSets = d.status === 'done' ? target : d.doneSets;
      var deficit = Math.max(0, target - doneSets);
      profile.debt[e.id] = Math.min(4, deficit); // cap accumulated debt
      entries.push({ exId: e.id, name: e.name, targetSets: target, doneSets: doneSets, status: d.status });
    });
    if (!anyMarked) { toast('Отметь хотя бы одно упражнение'); return; }
    var iso = diarySelectedDay === todayKey() ? todayIso() : todayIso() + '_' + diarySelectedDay;
    profile.log[iso] = { dayKey: diarySelectedDay, dayLabel: day.label, date: new Date().toISOString(), entries: entries };
    saveState();
    renderAll();
    toast('Дневник сохранён');
  }

  function renderDiaryHistory() {
    var profile = getActiveProfile();
    var box = document.getElementById('diary-history');
    var keys = Object.keys(profile.log).sort().reverse().slice(0, 12);
    if (!keys.length) {
      box.innerHTML = '<div class="empty-state">Записей пока нет.</div>';
      return;
    }
    box.innerHTML = keys.map(function (k) {
      var entry = profile.log[k];
      var d = new Date(entry.date);
      var doneCount = entry.entries.filter(function (e) { return e.status === 'done'; }).length;
      var skipCount = entry.entries.filter(function (e) { return e.status === 'skip'; }).length;
      return '<div class="exercise-row"><span class="ex-num">▪</span><span><span class="ex-name">' + entry.dayLabel + '</span><div class="ex-meta">' + d.toLocaleDateString('ru-RU') + ' · выполнено ' + doneCount + ', пропущено ' + skipCount + '</div></span><span></span></div>';
    }).join('');
  }

  function renderDiary() {
    var profile = getActiveProfile();
    var plan = getPlanCached(profile);
    document.getElementById('diary-day-tabs').innerHTML = dayTabsHtml('diary-day-tabs', diarySelectedDay, plan);
    document.querySelectorAll('#diary-day-tabs button').forEach(function (b) {
      b.addEventListener('click', function () {
        diarySelectedDay = b.getAttribute('data-day');
        renderDiaryBody();
        document.querySelectorAll('#diary-day-tabs button').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
      });
    });
    renderDiaryDebtZone();
    renderDiaryBody();
    renderDiaryHistory();
  }

  // ---------- EDITOR ----------

  function ensureCustomPlan(profile) {
    if (!profile.customPlan) {
      profile.customPlan = JSON.parse(JSON.stringify(DEFAULT_PLAN));
    }
    return profile.customPlan;
  }

  function renderEditor() {
    var profile = getActiveProfile();
    var plan = getPlanCached(profile);
    var container = document.getElementById('editor-days');
    container.innerHTML = DAY_ORDER.map(function (dk) {
      var day = plan[dk];
      var exRows = (day.exercises || []).map(function (e, i) {
        return '<div class="editor-ex" data-day="' + dk + '" data-ex="' + e.id + '">' +
          '<div class="row1">' +
          '<input type="text" class="ex-name-input" value="' + escapeAttr(e.name) + '" placeholder="Название упражнения">' +
          '<div>' +
          '<button class="icon-btn ex-up" title="Вверх">↑</button>' +
          '<button class="icon-btn ex-down" title="Вниз">↓</button>' +
          '<button class="icon-btn ex-del" title="Удалить">×</button>' +
          '</div>' +
          '</div>' +
          '<div class="row2">' +
          '<div><span class="mini-lbl">Подходы</span><input type="number" class="ex-sets" value="' + e.sets + '"></div>' +
          '<div><span class="mini-lbl">Повт. от</span><input type="number" class="ex-rlow" value="' + e.repsLow + '"></div>' +
          '<div><span class="mini-lbl">Повт. до</span><input type="number" class="ex-rhigh" value="' + e.repsHigh + '"></div>' +
          '<div><span class="mini-lbl">Отдых</span><input type="text" class="ex-rest" value="' + escapeAttr(e.rest || '') + '" placeholder="напр. 2 мин"></div>' +
          '</div>' +
          '</div>';
      }).join('');
      return '<div class="editor-day-block" data-day="' + dk + '">' +
        '<div class="editor-day-head">' +
        '<span class="dname">' + DAY_SHORT[dk] + ' · <input type="text" class="day-label-input" value="' + escapeAttr(day.label) + '" style="width:220px;display:inline-block"></span>' +
        '<label style="font-size:11px;color:var(--dim);display:flex;align-items:center;gap:6px"><input type="checkbox" class="day-off-toggle"' + (day.off ? ' checked' : '') + '> выходной</label>' +
        '</div>' +
        '<div class="editor-ex-list">' + exRows + '</div>' +
        (day.off ? '' : '<button class="btn small ghost editor-add-ex">+ упражнение</button>') +
        '</div>';
    }).join('');

    bindEditorEvents();
  }

  function escapeAttr(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function bindEditorEvents() {
    var profile = getActiveProfile();

    document.querySelectorAll('.day-off-toggle').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var dk = cb.closest('.editor-day-block').getAttribute('data-day');
        var plan = ensureCustomPlan(profile);
        plan[dk].off = cb.checked;
        saveState();
        renderEditor();
      });
    });

    document.querySelectorAll('.day-label-input').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var dk = inp.closest('.editor-day-block').getAttribute('data-day');
        var plan = ensureCustomPlan(profile);
        plan[dk].label = inp.value || plan[dk].label;
        saveState();
      });
    });

    document.querySelectorAll('.editor-add-ex').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var dk = btn.closest('.editor-day-block').getAttribute('data-day');
        var plan = ensureCustomPlan(profile);
        plan[dk].exercises.push(ex('Новое упражнение', 3, 8, 12));
        saveState();
        renderEditor();
      });
    });

    document.querySelectorAll('.editor-ex').forEach(function (block) {
      var dk = block.getAttribute('data-day');
      var exId = block.getAttribute('data-ex');

      function updateField(field, value) {
        var plan = ensureCustomPlan(profile);
        var arr = plan[dk].exercises;
        var found = arr.find(function (e) { return e.id === exId; });
        if (found) { found[field] = value; saveState(); }
      }

      block.querySelector('.ex-name-input').addEventListener('change', function (e) { updateField('name', e.target.value); });
      block.querySelector('.ex-sets').addEventListener('change', function (e) { updateField('sets', parseInt(e.target.value, 10) || 1); });
      block.querySelector('.ex-rlow').addEventListener('change', function (e) { updateField('repsLow', parseInt(e.target.value, 10) || 1); });
      block.querySelector('.ex-rhigh').addEventListener('change', function (e) { updateField('repsHigh', parseInt(e.target.value, 10) || 1); });
      block.querySelector('.ex-rest').addEventListener('change', function (e) { updateField('rest', e.target.value); });

      block.querySelector('.ex-del').addEventListener('click', function () {
        var plan = ensureCustomPlan(profile);
        plan[dk].exercises = plan[dk].exercises.filter(function (e) { return e.id !== exId; });
        saveState();
        renderEditor();
      });
      block.querySelector('.ex-up').addEventListener('click', function () {
        var plan = ensureCustomPlan(profile);
        var arr = plan[dk].exercises;
        var i = arr.findIndex(function (e) { return e.id === exId; });
        if (i > 0) { var t = arr[i - 1]; arr[i - 1] = arr[i]; arr[i] = t; saveState(); renderEditor(); }
      });
      block.querySelector('.ex-down').addEventListener('click', function () {
        var plan = ensureCustomPlan(profile);
        var arr = plan[dk].exercises;
        var i = arr.findIndex(function (e) { return e.id === exId; });
        if (i < arr.length - 1) { var t = arr[i + 1]; arr[i + 1] = arr[i]; arr[i] = t; saveState(); renderEditor(); }
      });
    });
  }

  function downloadJson(obj, filename) {
    var blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function bindEditorActions() {
    document.getElementById('editor-reset').addEventListener('click', function () {
      if (!confirm('Сбросить план профиля к стандартному? Свои изменения потеряются.')) return;
      var profile = getActiveProfile();
      profile.customPlan = null;
      saveState();
      renderEditor();
      toast('План сброшен к стандартному');
    });

    document.getElementById('editor-export').addEventListener('click', function () {
      var profile = getActiveProfile();
      var plan = getPlanCached(profile);
      downloadJson(plan, 'tochka-sily-plan-' + profile.name.replace(/\s+/g, '_') + '.json');
    });

    document.getElementById('editor-import-btn').addEventListener('click', function () {
      document.getElementById('editor-import-file').click();
    });
    document.getElementById('editor-import-file').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var plan = JSON.parse(reader.result);
          DAY_ORDER.forEach(function (dk) { if (!plan[dk]) plan[dk] = { label: DAY_SHORT[dk], off: true, exercises: [] }; });
          var profile = getActiveProfile();
          profile.customPlan = plan;
          saveState();
          renderEditor();
          toast('План импортирован');
        } catch (err) {
          toast('Не удалось прочитать файл плана');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });
  }

  // ---------- PROFILE ----------

  function renderProfileSelect() {
    var sel = document.getElementById('profile-select');
    sel.innerHTML = Object.keys(state.profiles).map(function (id) {
      var p = state.profiles[id];
      return '<option value="' + id + '"' + (id === state.activeId ? ' selected' : '') + '>' + escapeAttr(p.name) + '</option>';
    }).join('');
  }

  function renderProfileCard() {
    var profile = getActiveProfile();
    var created = new Date(profile.createdAt).toLocaleDateString('ru-RU');
    document.getElementById('profile-card').innerHTML =
      '<div class="pname">' + escapeAttr(profile.name) + '</div>' +
      '<div class="pmeta">Создан ' + created + ' · 1ПМ: ' + (profile.oneRM.bench || '—') + ' кг · тренировок в дневнике: ' + Object.keys(profile.log).length + ' · план: ' + (profile.customPlan ? 'свой' : 'стандартный') + '</div>';
  }

  function bindProfileActions() {
    document.getElementById('profile-select').addEventListener('change', function (e) {
      state.activeId = e.target.value;
      saveState();
      renderAll();
    });

    document.getElementById('profile-new').addEventListener('click', function () {
      var name = prompt('Имя нового профиля:', 'Друг');
      if (!name) return;
      var p = makeProfile(name.trim());
      state.profiles[p.id] = p;
      state.activeId = p.id;
      saveState();
      renderAll();
      toast('Профиль «' + p.name + '» создан');
    });

    document.getElementById('profile-rename').addEventListener('click', function () {
      var profile = getActiveProfile();
      var name = prompt('Новое имя профиля:', profile.name);
      if (!name) return;
      profile.name = name.trim();
      saveState();
      renderAll();
    });

    document.getElementById('profile-delete').addEventListener('click', function () {
      var ids = Object.keys(state.profiles);
      if (ids.length <= 1) { toast('Нельзя удалить единственный профиль'); return; }
      var profile = getActiveProfile();
      if (!confirm('Удалить профиль «' + profile.name + '» вместе со всем прогрессом? Это необратимо.')) return;
      delete state.profiles[profile.id];
      state.activeId = Object.keys(state.profiles)[0];
      saveState();
      renderAll();
      toast('Профиль удалён');
    });

    document.getElementById('backup-export').addEventListener('click', function () {
      var date = todayIso();
      downloadJson(state, 'tochka-sily-backup-' + date + '.json');
      toast('Резервная копия скачана — сохрани файл в надёжное место');
    });

    document.getElementById('backup-import-btn').addEventListener('click', function () {
      document.getElementById('backup-import-file').click();
    });
    document.getElementById('backup-import-file').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var incoming = JSON.parse(reader.result);
          if (!incoming.profiles || !incoming.activeId) throw new Error('bad format');
          var mode = confirm('Заменить текущие данные резервной копией целиком?\n\nOK — заменить всё.\nОтмена — объединить (профили из файла добавятся к текущим, при совпадении имени/ID — перезапишутся).');
          if (mode) {
            state = incoming;
          } else {
            Object.keys(incoming.profiles).forEach(function (id) { state.profiles[id] = incoming.profiles[id]; });
            state.activeId = incoming.activeId in state.profiles ? incoming.activeId : state.activeId;
          }
          saveState();
          renderAll();
          toast('Резервная копия восстановлена');
        } catch (err) {
          toast('Файл повреждён или это не backup Точки Силы');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });
  }

  function renderProfile() {
    renderProfileSelect();
    renderProfileCard();
  }

  // ---------- BENCH PROGRESSION (14 sessions from 1RM, wave % + negatives + test days) ----------
  // Взято 1-в-1 из твоих скриншотов референса (1ПМ=100 там, так что показанный вес = процент).
  // Тренировки 5 и 14 на скринах обрезаны (не видно последнего сета/подвала) — доделал по видимой
  // части и по аналогии с соседними тестовыми/финальной тренировками. Пришли полные скрины (докрути
  // до конца, чтобы было видно "МОЙ ТГК" внизу) — поправлю день 5 и день 14 на 100% точно.
  var ROUND_STEP = 2.5;

  var BENCH_PROGRESSION_TEMPLATE = [
    [ { pct: 80, reps: 6, type: 'normal' }, { pct: 82.5, reps: 5, type: 'normal' }, { pct: 82.5, reps: 5, type: 'normal' }, { pct: 85, reps: 4, type: 'normal' }, { pct: 85, reps: 4, type: 'normal' } ],
    [ { pct: 85, reps: 3, type: 'normal' }, { pct: 85, reps: 3, type: 'normal' }, { pct: 92.5, reps: 2, type: 'normal' }, { pct: 92.5, reps: 2, type: 'normal' }, { pct: 102.5, reps: 1, type: 'negative' } ],
    [ { pct: 80, reps: 6, type: 'normal' }, { pct: 85, reps: 5, type: 'normal' }, { pct: 85, reps: 5, type: 'normal' }, { pct: 87.5, reps: 4, type: 'normal' }, { pct: 87.5, reps: 4, type: 'normal' } ],
    [ { pct: 87.5, reps: 3, type: 'normal' }, { pct: 87.5, reps: 3, type: 'normal' }, { pct: 95, reps: 2, type: 'normal' }, { pct: 95, reps: 2, type: 'normal' }, { pct: 105, reps: 1, type: 'negative' } ],
    [ { pct: 80, reps: 6, type: 'normal' }, { pct: 85, reps: 5, type: 'normal' }, { pct: 85, reps: 5, type: 'normal' }, { pct: 90, reps: null, type: 'test' } ],
    [ { pct: 90, reps: 3, type: 'normal' }, { pct: 90, reps: 3, type: 'normal' }, { pct: 95, reps: 2, type: 'normal' }, { pct: 95, reps: 2, type: 'normal' }, { pct: 105, reps: 1, type: 'negative' } ],
    [ { pct: 85, reps: 5, type: 'normal' }, { pct: 85, reps: 5, type: 'normal' }, { pct: 90, reps: 3, type: 'normal' }, { pct: 90, reps: 3, type: 'normal' }, { pct: 92.5, reps: null, type: 'test' } ],
    [ { pct: 92.5, reps: 3, type: 'normal' }, { pct: 92.5, reps: 3, type: 'normal' }, { pct: 100, reps: 1, type: 'normal' }, { pct: 100, reps: 1, type: 'normal' }, { pct: 110, reps: 1, type: 'negative' } ],
    [ { pct: 85, reps: 5, type: 'normal' }, { pct: 85, reps: 5, type: 'normal' }, { pct: 95, reps: 3, type: 'normal' }, { pct: 95, reps: 3, type: 'normal' }, { pct: 95, reps: null, type: 'test' } ],
    [ { pct: 95, reps: 3, type: 'normal' }, { pct: 95, reps: 3, type: 'normal' }, { pct: 102.5, reps: 2, type: 'normal' }, { pct: 102.5, reps: 2, type: 'normal' }, { pct: 105, reps: 1, type: 'normal' } ],
    [ { pct: 87.5, reps: 5, type: 'normal' }, { pct: 87.5, reps: 5, type: 'normal' }, { pct: 95, reps: 3, type: 'normal' }, { pct: 95, reps: 3, type: 'normal' }, { pct: 95, reps: null, type: 'test' } ],
    [ { pct: 95, reps: 3, type: 'normal' }, { pct: 95, reps: 3, type: 'normal' }, { pct: 102.5, reps: 2, type: 'normal' }, { pct: 102.5, reps: 2, type: 'normal' }, { pct: 105, reps: 1, type: 'normal' } ],
    [ { pct: 90, reps: 5, type: 'normal' }, { pct: 100, reps: 3, type: 'normal' }, { pct: 100, reps: 3, type: 'normal' }, { pct: 105, reps: 2, type: 'normal' }, { pct: 105, reps: 2, type: 'normal' } ],
    [ { pct: 95, reps: 3, type: 'normal' }, { pct: 105, reps: 2, type: 'normal' }, { pct: 107.5, reps: 1, type: 'record' } ]
  ];

  function roundWeight(v) {
    return Math.round(v / ROUND_STEP) * ROUND_STEP;
  }

  function buildBenchProgression(oneRM) {
    return BENCH_PROGRESSION_TEMPLATE.map(function (sessionTemplate, idx) {
      return {
        index: idx + 1,
        sets: sessionTemplate.map(function (s) {
          return { weight: roundWeight(oneRM * s.pct / 100), reps: s.reps, type: s.type, pct: s.pct };
        })
      };
    });
  }

  var progressionSelectedSession = 1;

  function tagLabel(type) {
    if (type === 'negative') return 'негатив';
    if (type === 'test') return 'тест';
    if (type === 'record') return 'рекорд';
    return 'обычный';
  }

  function renderProgression() {
    var profile = getActiveProfile();
    var noRmBox = document.getElementById('progression-no-1rm');
    var controls = document.getElementById('progression-controls');
    var tabsBox = document.getElementById('progression-tabs');
    var body = document.getElementById('progression-body');

    if (!profile.oneRM.bench) {
      noRmBox.style.display = 'block';
      controls.innerHTML = '';
      tabsBox.innerHTML = '';
      body.innerHTML = '';
      return;
    }
    noRmBox.style.display = 'none';

    if (!profile.benchProgression) {
      controls.innerHTML = '<button class="btn" id="prog-build">Построить программу на 14 тренировок (1ПМ = ' + profile.oneRM.bench + ' кг)</button>';
      tabsBox.innerHTML = '';
      body.innerHTML = '';
      var buildBtn = document.getElementById('prog-build');
      if (buildBtn) buildBtn.addEventListener('click', function () {
        profile.benchProgression = { oneRM: profile.oneRM.bench, checks: {} };
        saveState();
        renderProgression();
        toast('Программа построена');
      });
      return;
    }

    var stale = profile.benchProgression.oneRM !== profile.oneRM.bench;
    controls.innerHTML = (stale
      ? '<button class="btn" id="prog-rebuild">Пересчитать под новый 1ПМ (' + profile.oneRM.bench + ' кг)</button>'
      : '<button class="btn ghost" id="prog-rebuild">Пересобрать заново</button>') +
      '<span class="sub-1rm" style="align-self:center">Построено от 1ПМ = ' + profile.benchProgression.oneRM + ' кг' + (stale ? ' — сейчас сохранён новый 1ПМ' : '') + '</span>';

    document.getElementById('prog-rebuild').addEventListener('click', function () {
      if (!confirm('Пересобрать программу? Отметки о выполненных подходах сбросятся.')) return;
      profile.benchProgression = { oneRM: profile.oneRM.bench, checks: {} };
      saveState();
      renderProgression();
      toast('Программа пересобрана');
    });

    var progression = buildBenchProgression(profile.benchProgression.oneRM);

    tabsBox.innerHTML = progression.map(function (s) {
      var cls = ['btn'];
      if (s.index === progressionSelectedSession) cls.push('active');
      var checks = profile.benchProgression.checks[s.index] || [];
      var doneAll = checks.length === s.sets.length && checks.every(Boolean);
      if (doneAll) cls.push('today');
      return '<button data-session="' + s.index + '" class="' + cls.join(' ') + '">' + s.index + '</button>';
    }).join('');

    document.querySelectorAll('#progression-tabs button').forEach(function (b) {
      b.addEventListener('click', function () {
        progressionSelectedSession = parseInt(b.getAttribute('data-session'), 10);
        renderProgression();
      });
    });

    var session = progression[progressionSelectedSession - 1];
    var checks = profile.benchProgression.checks[session.index] || session.sets.map(function () { return false; });

    body.innerHTML = '<div class="progression-summary"><div class="panel-title" style="margin:0">Тренировка ' + session.index + '</div><span class="sub-1rm">1ПМ = ' + profile.benchProgression.oneRM + ' кг</span></div>' +
      session.sets.map(function (set, i) {
        var repsLabel = set.type === 'test' ? 'макс. повторений' : set.reps + ' повт.';
        return '<div class="prog-set-row">' +
          '<span class="ex-num">' + (i + 1) + '</span>' +
          '<span><span class="ex-name">' + set.weight + ' кг × ' + repsLabel + '</span></span>' +
          '<span class="prog-tag ' + set.type + '">' + tagLabel(set.type) + '</span>' +
          '<span class="check-circle' + (checks[i] ? ' checked' : '') + '" data-idx="' + i + '"></span>' +
          '</div>';
      }).join('');

    body.querySelectorAll('.check-circle').forEach(function (c) {
      c.addEventListener('click', function () {
        var i = parseInt(c.getAttribute('data-idx'), 10);
        var arr = profile.benchProgression.checks[session.index] || session.sets.map(function () { return false; });
        arr[i] = !arr[i];
        profile.benchProgression.checks[session.index] = arr;
        saveState();
        renderProgression();
      });
    });
  }

  // ---------- render all ----------

  function renderAll() {
    renderHome();
    renderCalcHistory();
    renderProgression();
    renderProgram();
    renderDiary();
    renderEditor();
    renderProfile();
  }

  // ---------- init ----------

  document.addEventListener('DOMContentLoaded', function () {
    loadState();
    bindNav();
    bindCalc();
    bindEditorActions();
    bindProfileActions();
    renderAll();
  });
})();
