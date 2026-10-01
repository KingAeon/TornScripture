// ==UserScript==
// @name         TornScripture - Training Advisor
// @namespace    https://github.com/KingAeon/TornScripture
// @version      0.1.0
// @description  User-triggered training advice, current proof, and transparent manual checkpoints.
// @author       KingAeon
// @match        https://www.torn.com/*
// @grant        none
// @run-at       document-idle
// @license      MIT
// @homepageURL  https://github.com/KingAeon/TornScripture
// @downloadURL  https://raw.githubusercontent.com/KingAeon/TornScripture/refs/heads/main/TornScripture-Training-Advisor.user.js
// @updateURL    https://raw.githubusercontent.com/KingAeon/TornScripture/refs/heads/main/TornScripture-Training-Advisor.user.js
// ==/UserScript==

// GENERATED: edit canonical src files, then run node scripts/build-training-advisor.js.
// SAFETY BOUNDARY: advisory only; no gameplay actions, background polling, or state uploads.
// Only user-triggered GET requests to the official Torn API; keys remain local.
// Only preferences/UI state and an optional local key persist. Current evidence is memory-only.
// BUILD_PROVENANCE {"generator":"training-advisor-node-core-v1","version":"0.1.0","hashes":{"src/training-advisor-pure.js":"41ba57363c837bbb578fcf72f4161c632637eb3de4c161ae1f69d228d08f5719","src/training-advisor-adapters.js":"d04b0a6253681997ea705ca245139cd65ccc2f11315bddef21be7365821eae68","src/training-advisor-runtime.js":"1f20b5fc8118e26d0b12fd29e86eddb3cf1879bd55fbfec4cd2f2145cf2b1115","src/training-advisor-ui.js":"b4d984f6290ca41766ac53d816c23a9080d1069bdba92ab27fb1f1e29136627f","scripts/build-training-advisor.js":"16635afe9272d32ed88b4952b3af70e290955fe50ca85563dd95fb5ff1a8aa07"}}
(() => {
  'use strict';
  const factories={
    "./training-advisor-pure.js": function(module, exports, require) {
'use strict';

// DQ-TRAIN-001A/001C: pure, normalized advisory logic. No live state is read here.
const MODEL_ID = 'vladar-v2-pre50m-v1';
const LIMIT = 50_000_000;
const STATS = Object.freeze({
  strength: { a: 1600, b: 1700, noise: 700 },
  speed: { a: 1600, b: 2000, noise: 1350 },
  dexterity: { a: 1800, b: 1500, noise: 1000 },
  defense: { a: 2100, b: -600, noise: 1500 }
});
const CONFIDENCE = Object.freeze({ CALIBRATED: 3, SUPPORTED_EXTRAPOLATION: 2, EXPERIMENTAL: 1, UNSUPPORTED: 0 });
const RISK = Object.freeze({ CALIBRATED_ONLY: 3, ALLOW_SUPPORTED: 2, ALLOW_EXPERIMENTAL: 1 });
const isNonnegative = n => Number.isFinite(n) && n >= 0;
const isInteger = n => Number.isSafeInteger(n) && n >= 0;
const halfUp = (n, places = 0) => Math.floor(n * 10 ** places + 0.5) / 10 ** places;
const happyMultiplier = happy => {
  const logarithm = halfUp(Math.log1p(happy / 250), 4);
  return { logarithm, multiplier: halfUp(1 + 0.07 * logarithm, 4) };
};
const happyLoss = (energyPerTrain, roll) => halfUp(0.1 * energyPerTrain * roll);
const fail = (status, reason) => ({ status, reason, warnings: [], assumptions: [] });

function simulateTraining(input) {
  if (!input || typeof input !== 'object') return fail('invalid', 'INVALID_INPUT');
  if (input.modelId !== MODEL_ID) return fail('unsupported', 'UNSUPPORTED_MODEL');
  const { stat, happy, gym, gainPerks, trainCount, randomness } = input;
  if (!stat || !STATS[stat.kind] || !isNonnegative(stat.value) ||
      !Number.isInteger(happy) || happy < 0 || happy > 99999 ||
      !gym || !isNonnegative(gym.dots) || !isInteger(gym.energyPerTrain) || gym.energyPerTrain === 0 ||
      !Array.isArray(gainPerks) || !isInteger(trainCount) ||
      !randomness || !Array.isArray(randomness.gainNoise) || !Array.isArray(randomness.happyLossRoll) ||
      randomness.gainNoise.length !== trainCount || randomness.happyLossRoll.length !== trainCount) {
    return fail('invalid', 'INVALID_INPUT');
  }
  if (stat.value > LIMIT) return fail('unsupported', 'OUT_OF_MODEL_DOMAIN');
  if (input.effects != null && !Array.isArray(input.effects)) return fail('invalid','INVALID_INPUT');
  if (input.effects?.length || gym.happyLossModifier != null) return fail('unsupported', 'UNSUPPORTED_EFFECT');
  const ids = new Set();
  for (const perk of gainPerks) {
    if (!perk || typeof perk.id !== 'string' || !perk.id || ids.has(perk.id) ||
        !Number.isFinite(perk.rate) || perk.rate <= -1) return fail('invalid', 'INVALID_INPUT');
    ids.add(perk.id);
  }
  const bound = STATS[stat.kind].noise;
  if (randomness.gainNoise.some(n => !Number.isInteger(n) || Math.abs(n) > bound) ||
      randomness.happyLossRoll.some(n => ![4, 5, 6].includes(n))) return fail('invalid', 'INVALID_INPUT');
  const canonicalPerks = [...gainPerks].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const multiplier = canonicalPerks.reduce((acc, p) => acc * (1 + p.rate), 1);
  let currentStat = stat.value, currentHappy = happy;
  const trains = [];
  for (let index = 0; index < trainCount; index++) {
    if (currentStat > LIMIT) return fail('unsupported', 'OUT_OF_MODEL_DOMAIN');
    const { a, b } = STATS[stat.kind];
    const base = currentStat * happyMultiplier(currentHappy).multiplier +
      8 * currentHappy ** 1.05 + (1 - (currentHappy / 99999) ** 2) * a + b + randomness.gainNoise[index];
    const gain = base / 200000 * gym.dots * gym.energyPerTrain * multiplier;
    const loss = happyLoss(gym.energyPerTrain, randomness.happyLossRoll[index]);
    const nextStat = currentStat + gain, nextHappy = Math.max(0, currentHappy - loss);
    trains.push({ index, statBefore: currentStat, happyBefore: currentHappy,
      gainNoise: randomness.gainNoise[index], gain, statAfter: nextStat,
      happyLossRoll: randomness.happyLossRoll[index], happyLoss: loss, happyAfter: nextHappy });
    currentStat = nextStat;
    currentHappy = nextHappy;
  }
  return { status: 'ok', model: { id: MODEL_ID, status: 'candidate_not_live_calibrated' },
    start: { stat: stat.value, happy }, end: { stat: currentStat, happy: currentHappy },
    totalGain: currentStat - stat.value, energySpent: trainCount * gym.energyPerTrain,
    canonicalPerkOrder: canonicalPerks.map(p => p.id), trains, warnings: [], assumptions: [] };
}

// Expected/central planning path, with explicit zero noise and central loss rolls.
// Unsupported remainder is reported, never assigned a predicted gain.
function simulatePlanTraining(input) {
  const { energy, ...kernel } = input || {};
  if (!isInteger(energy) || !kernel.gym || !isInteger(kernel.gym.energyPerTrain) || !kernel.gym.energyPerTrain) {
    return fail('invalid', 'INVALID_INPUT');
  }
  const count = Math.floor(energy / kernel.gym.energyPerTrain);
  const validation = simulateTraining({ ...kernel, trainCount:0,
    randomness:{gainNoise:[],happyLossRoll:[]} });
  if (validation.status !== 'ok') return validation;
  let currentStat = kernel.stat?.value, currentHappy = kernel.happy;
  let used = 0;
  const trains = [];
  for (let i = 0; i < count; i++) {
    const result = simulateTraining({ ...kernel, stat: { ...kernel.stat, value: currentStat }, happy: currentHappy,
      trainCount: 1, randomness: { gainNoise: [0], happyLossRoll: [5] } });
    if (result.status !== 'ok') {
      if (result.reason === 'OUT_OF_MODEL_DOMAIN' && i > 0) break;
      return result;
    }
    trains.push({ ...result.trains[0], index: i });
    used += kernel.gym.energyPerTrain;
    currentStat = result.end.stat;
    currentHappy = result.end.happy;
  }
  const partial = trains.length < count;
  return { status: partial ? 'partial' : 'ok', reason: partial ? 'MODEL_OUT_OF_DOMAIN' : null,
    modeledTrainCount: trains.length, modeledGain: currentStat - kernel.stat.value,
    modeledEndStat: currentStat, finalHappy: currentHappy, remainingEnergy: energy - used,
    energySpent: used, fullOutcomeRankable: !partial, trains,
    assumption: 'central path: explicit zero gain noise, Happy-loss roll 5; no probability or gain interval inferred' };
}

const num = (o, key, fallback = 0) => o[key] == null ? fallback : o[key];
const compareNumbers = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const compareStrings = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const economic = c => c.economicValueConsumed ??
  (Number.isFinite(c.newCashRequired) && Number.isFinite(c.marketValueOfOwnedItemsConsumed) &&
   Number.isFinite(c.pricedPointValueConsumed) ?
    c.newCashRequired + c.marketValueOfOwnedItemsConsumed + c.pricedPointValueConsumed : null);
const axes = ['economicValueConsumed', 'timeToCompletionHours', 'naturalEnergyLost', 'pointsConsumed'];
function dominates(a, b) {
  if (a.expectedGain < b.expectedGain || CONFIDENCE[a.confidence] < CONFIDENCE[b.confidence]) return false;
  let strict = a.expectedGain > b.expectedGain || CONFIDENCE[a.confidence] > CONFIDENCE[b.confidence];
  for (const axis of axes) {
    const va = axis === 'economicValueConsumed' ? economic(a) : num(a, axis);
    const vb = axis === 'economicValueConsumed' ? economic(b) : num(b, axis);
    if (va == null || vb == null || va > vb) return false;
    strict ||= va < vb;
  }
  return strict;
}
const fingerprint = c => c.fingerprint || c.id;
function paretoPrune(candidates) {
  const sorted = [...candidates].sort((a, b) => compareStrings(fingerprint(a), fingerprint(b)));
  return sorted.filter(c => !sorted.some(other => other !== c && dominates(other, c)));
}
function rankCandidates({ candidates, objective = 'BALANCED', riskPolicy = 'ALLOW_SUPPORTED',
  referenceSessionGain, budgetNewCash, maxWaitHours, pointLimit, prohibitedItems = [],ownedItemsOnly = false } = {}) {
  if (!Array.isArray(candidates) || !RISK[riskPolicy] ||
      !['BALANCED','MAXIMUM_GAIN','BEST_VALUE','BUDGET_CAP','USE_MY_INVENTORY','FASTEST_USEFUL'].includes(objective)) {
    return { status: 'NO_SAFE_RECOMMENDATION', reason: 'INVALID_INPUT', selected: null };
  }
  const excluded = [], valid = [];
  if (objective === 'BUDGET_CAP' && !isNonnegative(budgetNewCash))
    return {status:'NO_SAFE_RECOMMENDATION',reason:'DATA_MISSING',selected:null};
  if (budgetNewCash != null && !isNonnegative(budgetNewCash))
    return {status:'NO_SAFE_RECOMMENDATION',reason:'INVALID_INPUT',selected:null};
  const needsEconomic = ['BALANCED','BEST_VALUE','USE_MY_INVENTORY'].includes(objective);
  const needsUseful = ['USE_MY_INVENTORY','FASTEST_USEFUL'].includes(objective);
  for (const c of candidates) {
    let reason = null;
    if (!c || !c.id || !fingerprint(c) || !isNonnegative(c.expectedGain) || !(c.confidence in CONFIDENCE) ||
        (c.economicValueConsumed != null && !isNonnegative(c.economicValueConsumed)) ||
        (c.pointsConsumed != null && !isNonnegative(c.pointsConsumed)) ||
        (c.newCashRequired != null && !isNonnegative(c.newCashRequired))) reason = 'INVALID_INPUT';
    else if (c.partial || c.fullOutcomeRankable === false) reason = 'MODEL_OUT_OF_DOMAIN';
    else if (CONFIDENCE[c.confidence] < RISK[riskPolicy]) reason = 'CONFIDENCE_POLICY';
    else if (maxWaitHours != null && num(c, 'timeToCompletionHours') > maxWaitHours) reason = 'COOLDOWN_BLOCKED';
    else if (pointLimit != null && num(c, 'pointsConsumed') > pointLimit) reason = 'RESOURCE_MISSING';
    else if (prohibitedItems.some(id => c.itemsConsumed?.[id] > 0)) reason = 'USER_RESOURCE_RESTRICTION';
    else if (ownedItemsOnly && c.boughtItemsCount > 0) reason = 'USER_RESOURCE_RESTRICTION';
    else if (budgetNewCash != null && c.newCashRequired == null) reason = 'ECONOMICS_UNAVAILABLE';
    else if (budgetNewCash != null && c.newCashRequired > budgetNewCash) reason = 'BUDGET_EXHAUSTED';
    else if ((needsUseful || objective === 'BEST_VALUE') && !isNonnegative(referenceSessionGain)) reason = 'DATA_MISSING';
    else if (needsUseful && c.expectedGain < referenceSessionGain) reason = 'BELOW_USEFUL_SESSION_REFERENCE';
    else if (needsEconomic && !isNonnegative(economic(c))) reason = 'ECONOMICS_UNAVAILABLE';
    else if (objective === 'BALANCED' && c.opportunityUnknown) reason = 'DATA_MISSING';
    else if (c.resourceUnknown) reason = 'RESOURCE_MISSING';
    else if (objective === 'BUDGET_CAP' && !isNonnegative(num(c, 'newCashRequired', NaN))) reason = 'ECONOMICS_UNAVAILABLE';
    if (reason) excluded.push({ id: c?.id, reason }); else valid.push(c);
  }
  if (!valid.length) return { status: 'NO_SAFE_RECOMMENDATION', reason: excluded[0]?.reason || 'NO_COMPETITIVE_PLAN',
    selected: null, excluded, rejected: excluded };
  const frontier = paretoPrune(valid);
  let pool = objective === 'BALANCED' ? frontier : valid;
  const diagnostics = {}, advancedReasons = [];
  const cmp = (a, b, fields) => {
    for (const [value, descending] of fields) {
      const diff = compareNumbers(value(a), value(b));
      if (diff) return descending ? -diff : diff;
    }
    return compareStrings(fingerprint(a), fingerprint(b));
  };
  const conf = c => CONFIDENCE[c.confidence];
  const cost = c => economic(c) ?? Infinity;
  const time = c => num(c, 'timeToCompletionHours');
  const gain = c => c.expectedGain;
  const cash = c => num(c, 'newCashRequired');
  let comparator;
  switch (objective) {
    case 'MAXIMUM_GAIN': comparator = (a,b) => cmp(a,b,[[gain,true],[conf,true],[cost,false],[time,false]]); break;
    case 'BUDGET_CAP': comparator = (a,b) => cmp(a,b,[[gain,true],[conf,true],[cash,false],[cost,false],[time,false]]); break;
    case 'USE_MY_INVENTORY': comparator = (a,b) => cmp(a,b,[[cash,false],[gain,true],[conf,true],[cost,false],[time,false]]); break;
    case 'FASTEST_USEFUL': comparator = (a,b) => cmp(a,b,[[time,false],[gain,true],[conf,true],[cost,false]]); break;
    case 'BEST_VALUE': {
      const free = valid.filter(c => economic(c) === 0).sort((a,b) => cmp(a,b,[[gain,true],[conf,true],[time,false]]));
      const baseline = free[0];
      const baselineGain = baseline?.expectedGain || 0;
      pool = valid.filter(c => {
        const deltaGain = c.expectedGain - baselineGain, deltaEconomic = economic(c);
        if (c.expectedGain >= referenceSessionGain && deltaGain > 0 && deltaEconomic > 0) {
          diagnostics[c.id] = { deltaGain, deltaEconomic, incrementalValue: deltaGain / deltaEconomic };
          return true;
        }
        return false;
      });
      if (!pool.length && baseline) pool = [baseline];
      comparator = (a,b) => cmp(a,b,[[c => diagnostics[c.id]?.incrementalValue || 0,true],
        [gain,true],[conf,true],[cost,false],[time,false]]);
      break;
    }
    case 'BALANCED': {
      const values = c => [gain(c),cost(c),time(c),num(c,'naturalEnergyLost'),num(c,'pointsConsumed')];
      const mins = [0,1,2,3,4].map(i => Math.min(...pool.map(c => values(c)[i])));
      const maxs = [0,1,2,3,4].map(i => Math.max(...pool.map(c => values(c)[i])));
      for (const c of pool) {
        const normalized = values(c).map((v,i) => maxs[i] === mins[i] ? 0 : (v - mins[i]) / (maxs[i] - mins[i]));
        const burden = Math.max(...normalized.slice(1));
        diagnostics[c.id] = { gainUtility: normalized[0], burden, kneeScore: normalized[0] - burden };
      }
      comparator = (a,b) => cmp(a,b,[[c=>diagnostics[c.id].kneeScore,true],[conf,true],
        [c=>diagnostics[c.id].burden,false],[gain,true],[cost,false],[time,false],
        [c=>num(c,'naturalEnergyLost'),false],[c=>num(c,'pointsConsumed'),false]]);
      break;
    }
  }
  pool.sort(comparator);
  if (objective === 'BALANCED' && pool.length > 1 &&
      Math.abs(diagnostics[pool[0].id].kneeScore - diagnostics[pool[1].id].kneeScore) < 1e-12) {
    advancedReasons.push('BALANCED_KNEE_AMBIGUOUS');
  }
  return { status: pool.length ? 'ok' : 'NO_SAFE_RECOMMENDATION', selected: pool[0] || null,
    alternatives: pool.slice(1,6), frontier, excluded, rejected: excluded, diagnostics, advancedReasons,
    reason: pool.length ? null : 'NO_COMPETITIVE_PLAN' };
}

// Frontiers are generated in stable item-ID order. Owned and bought units remain
// distinct until economics and dominance have been evaluated.
function dominatesHappyRecipe(a,b) {
  const key=c=>JSON.stringify(c.bundle);
  return a.happy >= b.happy && a.newCash <= b.newCash &&
    a.economicValueConsumed <= b.economicValueConsumed && a.cooldownSeconds <= b.cooldownSeconds &&
    (a.happy > b.happy || a.newCash < b.newCash || a.economicValueConsumed < b.economicValueConsumed ||
     a.cooldownSeconds < b.cooldownSeconds || key(a) < key(b));
}
function generateHappyFrontier({ boosterSlots, items, newCashBudget = Infinity } = {}) {
  if (!isInteger(boosterSlots) || !Array.isArray(items) || !items.every(item => item &&
      typeof item.id === 'string' && item.id && isNonnegative(item.happy) &&
      isInteger(item.maxQuantity) && isInteger(item.owned) && isNonnegative(item.newCashEach))) {
    return { status: 'invalid', reason: 'INVALID_INPUT' };
  }
  const sorted = [...items].sort((a,b) => compareStrings(a.id,b.id));
  if (new Set(sorted.map(x=>x.id)).size !== sorted.length) return { status: 'invalid', reason: 'INVALID_INPUT' };
  const rawCandidates = [];
  function visit(index, remaining, bundle, happy, newCash, ownedValue, cooldownSeconds) {
    if (index === sorted.length) {
      if (remaining === 0) rawCandidates.push({ bundle, happy, newCash, ownedValue,
        economicValueConsumed: newCash + ownedValue, cooldownSeconds });
      return;
    }
    const item = sorted[index];
    for (let quantity = 0; quantity <= Math.min(remaining,item.maxQuantity); quantity++) {
      for (let owned = 0; owned <= Math.min(quantity,item.owned); owned++) {
        const bought = quantity - owned;
        if (item.purchasableQuantity != null && bought > item.purchasableQuantity) continue;
        const cash = newCash + bought * item.newCashEach;
        if (cash > newCashBudget) continue;
        const next = { ...bundle };
        if (owned) next[`${item.id}Owned`] = owned;
        if (bought) next[`${item.id}Bought`] = bought;
        visit(index+1, remaining-quantity, next, happy+quantity*item.happy, cash,
          ownedValue+owned*(item.replacementValueEach ?? item.newCashEach),
          cooldownSeconds+quantity*(item.cooldownSeconds || 0));
      }
    }
  }
  visit(0,boosterSlots,{},0,0,0,0);
  const key = c => JSON.stringify(c.bundle);
  const frontier = rawCandidates.filter(c => !rawCandidates.some(other => other !== c && dominatesHappyRecipe(other,c)))
    .sort((a,b)=>compareNumbers(a.happy,b.happy) || compareNumbers(a.newCash,b.newCash) || compareStrings(key(a),key(b)));
  return { status:'ok', rawCandidates, frontier, dominatedItemIds: sorted.filter(item =>
    sorted.some(other => other !== item && other.happy >= item.happy &&
      other.newCashEach <= item.newCashEach &&
      (other.happy > item.happy || other.newCashEach < item.newCashEach))).map(x=>x.id) };
}

function naturalEnergyLost({ energy, naturalEnergyMax, stackCap, naturalRegen, waitSeconds }) {
  if (!naturalRegen || !isNonnegative(waitSeconds) || !isNonnegative(energy)) return 0;
  const { energy: gain, everySeconds } = naturalRegen;
  if (!isNonnegative(gain) || !isNonnegative(everySeconds) || !everySeconds) return 0;
  const ticks = Math.floor(waitSeconds / everySeconds);
  return energy >= naturalEnergyMax || energy >= stackCap ? ticks * gain :
    Math.max(0, ticks * gain - Math.max(0, naturalEnergyMax - energy));
}
function advanceNaturalEnergy(energy, naturalEnergyMax, naturalRegen, waitSeconds) {
  if (!waitSeconds || energy >= naturalEnergyMax) return { energy,
    lost:naturalEnergyLost({energy,naturalEnergyMax,naturalRegen,waitSeconds}) };
  if (!naturalRegen || !isNonnegative(naturalRegen.energy) ||
      !isNonnegative(naturalRegen.everySeconds) || !naturalRegen.everySeconds) return null;
  const gained = Math.floor(waitSeconds/naturalRegen.everySeconds)*naturalRegen.energy;
  return {energy:Math.min(naturalEnergyMax,energy+gained),
    lost:Math.max(0,gained-(naturalEnergyMax-energy))};
}
function generateEnergyCandidates(input = {}) {
  const { energy, naturalEnergyMax, stackCap,
    xanax, maxWaitSeconds = 0, pointRefill, naturalRegen } = input;
  const drugCooldownSeconds = input.drugCooldownSeconds ?? input.cooldowns?.drugSeconds;
  if (!isNonnegative(energy) || !isNonnegative(naturalEnergyMax) ||
      (stackCap != null && !isNonnegative(stackCap)) ||
      !isNonnegative(maxWaitSeconds)) return [];
  const candidates = [{ type:'TRAIN_NOW', energyAtTraining: energy, waitSeconds:0,
    naturalEnergyLost:0, actions:[], discardedEnergy:0 }];
  if (xanax && isNonnegative(xanax.energyGain) && isNonnegative(drugCooldownSeconds) &&
      drugCooldownSeconds <= maxWaitSeconds && xanax.energyGain > 0 && stackCap != null && energy < stackCap) {
    let current=energy, wait=0, uses=0, discarded=0, lost=0, actions=[];
    while (current < stackCap) {
      const interval=uses ? xanax.cooldownSeconds : drugCooldownSeconds;
      if (!isNonnegative(interval) || (uses && !interval) || wait+interval > maxWaitSeconds) break;
      const advanced=advanceNaturalEnergy(current,naturalEnergyMax,naturalRegen,interval);
      if (!advanced) break; // Without regen timing, a below-cap future Energy value is unknown.
      current=advanced.energy;
      lost+=advanced.lost;
      wait+=interval;
      if (interval) actions=[...actions,{action:'WAIT',seconds:interval,checkpoint:'DRUG_COOLDOWN'}];
      const after=Math.min(stackCap,current+xanax.energyGain);
      discarded+=current+xanax.energyGain-after;
      current=after;
      uses++;
      actions=[...actions,{action:'TAKE_XANAX'}];
      const base={type:'WAIT_XANAX',energyAtTraining:current,waitSeconds:wait,xanaxUses:uses,
        postDrugCooldownSeconds:isNonnegative(xanax.cooldownSeconds) ? xanax.cooldownSeconds : null,
        discardedEnergy:discarded,naturalEnergyLost:wait && !naturalRegen ? null : lost,actions};
      candidates.push(base);
    }
  }
  if (pointRefill?.allowed && pointRefill.fillAmountPolicy === 'natural_max' &&
      isInteger(naturalEnergyMax) && energy < naturalEnergyMax) {
    candidates.push({ type:'REFILL', energyBefore:energy, nominalFill:naturalEnergyMax,
      energyObtained:naturalEnergyMax-energy,energyAtTraining:naturalEnergyMax,
      energyAfter:naturalEnergyMax,discardedEnergy:0,
      waitSeconds:0, naturalEnergyLost:0, pointsConsumed:pointRefill.pointsRequired ?? null,
      actions:[{action:'USE_REFILL'}] });
  }
  if (naturalRegen && energy < naturalEnergyMax && naturalRegen.everySeconds > 0 && naturalRegen.energy > 0) {
    const wait = Math.ceil((naturalEnergyMax-energy)/naturalRegen.energy)*naturalRegen.everySeconds;
    if (wait <= maxWaitSeconds) candidates.push({ type:'WAIT_NATURAL', energyAtTraining:naturalEnergyMax,
      waitSeconds:wait, naturalEnergyLost:0, actions:[{action:'WAIT',seconds:wait,checkpoint:'NATURAL_FULL_BAR'}] });
  }
  return candidates;
}

function resolveObserved(predicted, observed) {
  if (!observed || observed.source !== 'OBSERVED' || !['LIVE','FRESH'].includes(observed.freshness))
    return { state:predicted, changed:false };
  const changed = Object.keys(observed).some(k => k !== 'source' && k !== 'freshness' && predicted?.[k] !== observed[k]);
  return { state:{ ...predicted, ...observed }, changed, reason:changed ? 'STATE_CHANGED' : null,
    reSimulateRemainingPlan:changed };
}
function replanOnEvent(event = {}) {
  if (event.event === 'DRUG_OVERDOSE') return {phase:'INTERRUPTED',reason:'PLAN_INTERRUPTED',
    invalidate:['energy','happy','drugCooldown','readiness'],modelContradiction:false};
  if (event.materialChange && event.observedEnergyBefore !== event.plannedEnergyBefore)
    return {reason:'STATE_CHANGED',action:'REPLAN_FROM_OBSERVED_STATE',preserveSpentResources:true};
  return {reason:null,action:'CONTINUE'};
}
function compareRecommendationIdentity(before, after) {
  return {recommendationIdentityChanged:before?.fingerprint !== after?.fingerprint || before?.selected !== after?.selected,
    economicsUpdated:before?.newCashRequired !== after?.newCashRequired};
}
function simulateResolvedBoundary({modelMaxStartStat,startStat,internalTrainGains,energyPerTrain,availableEnergy}) {
  if (!isNonnegative(modelMaxStartStat) || !isNonnegative(startStat) || !Array.isArray(internalTrainGains) ||
      !internalTrainGains.every(isNonnegative) || !isInteger(energyPerTrain) || !energyPerTrain || !isInteger(availableEnergy))
    return fail('invalid','INVALID_INPUT');
  let stat=startStat, modeledTrainCount=0;
  const possible=Math.min(internalTrainGains.length,Math.floor(availableEnergy/energyPerTrain));
  while (modeledTrainCount<possible && stat<=modelMaxStartStat) stat+=internalTrainGains[modeledTrainCount++];
  const partial=modeledTrainCount<Math.floor(availableEnergy/energyPerTrain);
  return {modeledTrainCount,endingModeledStat:stat,remainingEnergy:availableEnergy-modeledTrainCount*energyPerTrain,
    reason:partial?'MODEL_OUT_OF_DOMAIN':null,eligibleForFullOutcomeRanking:!partial};
}
function capabilities(state = {}, market = {}) {
  const unsupportedGain = state.activeEffects?.some(x => x.affects?.includes('gymGain') &&
    (x.support !== 'SUPPORTED' || !x.representedByGainPerkId ||
      !state.gainPerks?.some(p=>p.id===x.representedByGainPerkId)));
  return { canPredictGain:!unsupportedGain && isNonnegative(state.stats?.[state.targetStat]) &&
      isNonnegative(state.happy) && isNonnegative(state.gym?.dots),
    canUseInventory:!!state.inventory,
    canCompareMarket:market.available !== false && !!market.items,
    canCompareCost:market.available !== false && !!market.items,
    reason:unsupportedGain ? 'UNSUPPORTED_EFFECT' : null };
}
function structuralFingerprint({ actions, targetStat, statAllocationMode = 'TARGET_STAT', resourcePolicy = 'STANDARD',
  ownedItemsConsumed = {}, boughtItems = {} }) {
  const sources=[...new Set([...Object.keys(ownedItemsConsumed),...Object.keys(boughtItems)])].sort(compareStrings)
    .map(id=>[id,ownedItemsConsumed[id] || 0,boughtItems[id] || 0]);
  return JSON.stringify({ targetStat, statAllocationMode, resourcePolicy,
    sources,
    actions: actions.filter(a => a.action !== 'VERIFY_STATE').map(a =>
      [a.action,a.item || null,a.quantity || null,a.targetStat || null,
        a.trainCount ?? null,a.energySpent ?? null,a.checkpoint ?? null]) });
}
// A booster only needs to start below the threshold. Keep the old item-ID
// order when legal; use a stable shorter-cooldown-first order if needed.
function orderedBoosterUses(items, mechanics, start, maximum) {
  if (!isNonnegative(start) || !isNonnegative(maximum) || maximum === 0) return null;
  const byId=[...items].sort((a,b)=>compareStrings(a.id,b.id));
  const legal=ordered=>{
    let cooldown=start;
    for (const item of ordered) {
      const added=mechanics[item.id]?.cooldownSeconds;
      if (!isNonnegative(added) || added === 0 || !isInteger(item.quantity) || item.quantity < 1) return false;
      for (let use=0;use<item.quantity;use++) {
        if (cooldown >= maximum) return false;
        cooldown+=added;
      }
    }
    return true;
  };
  if (legal(byId)) return byId;
  const reordered=[...byId].sort((a,b)=>compareNumbers(mechanics[a.id]?.cooldownSeconds,
    mechanics[b.id]?.cooldownSeconds) || compareStrings(a.id,b.id));
  return legal(reordered) ? reordered : null;
}
function planReadiness(plan, state = {}, timing = {}) {
  const ownedItems=plan.resources?.ownedItemsConsumed || {}, boughtItems=plan.resources?.boughtItems || {};
  const inventoryItems=[...new Set([...Object.keys(ownedItems),...Object.keys(boughtItems)])];
  const itemFreshness=item=>Object.hasOwn(state.inventoryFreshnessByItem || {},item) ?
    state.inventoryFreshnessByItem[item] : state.inventoryFreshness ?? state.freshness?.inventory;
  if (state.inventoryFreshness === 'STALE' && Object.keys(ownedItems)
      .some(item=>ownedItems[item] > 0 && itemFreshness(item)!=='LIVE'))
    return { status:'NEEDS_REFRESH',reason:'DATA_STALE',nextAction:'refresh inventory' };
  if (plan.actions?.some(a => a.action === 'TAKE_ECSTASY') && timing.safeQuarterWindow === false)
    return { status:'BLOCKED',reason:'TIMING_UNSAFE',nextAction:'wait for next safe quarter-hour window' };
  if (plan.actions?.some(a=>a.action==='TAKE_ECSTASY') && timing.safeQuarterWindow !== true)
    return {status:'NEEDS_REFRESH',reason:'DATA_MISSING',nextAction:'confirm safe quarter-hour window'};
  if (plan.actions?.some(a=>a.action==='TAKE_ECSTASY') && state.cooldowns &&
      !isNonnegative(state.cooldowns.drugSeconds))
    return {status:'NEEDS_REFRESH',reason:'DATA_MISSING',nextAction:'refresh drug cooldown'};
  if (Object.keys(plan.resources?.boughtItems || {}).length && state.itemsAvailable !== true)
    return { status:'NEEDS_ITEMS',reason:'RESOURCE_MISSING',nextAction:'obtain and verify required items' };
  if (plan.economics?.newCashRequired > 0 && state.itemsAvailable === false)
    return { status:'NEEDS_ITEMS',reason:'RESOURCE_MISSING',nextAction:'obtain required items' };
  // Source adapters supply classes for each field; no source or clock is assumed here.
  const required=[['energy',true],['happy',true],['gym',false],['gainModifiers',false]];
  const drug=plan.actions?.some(a=>['TAKE_XANAX','TAKE_ECSTASY'].includes(a.action));
  const booster=plan.actions?.some(a=>a.action==='USE_BOOSTER');
  const inventory=Object.values(ownedItems).some(quantity=>quantity > 0);
  if (drug) required.push(['drugCooldown',true]);
  if (booster) required.push(['boosterCooldown',true]);
  for (const [field,liveOnly] of required) {
    const freshness=state.freshness?.[field];
    if ((liveOnly ? freshness !== 'LIVE' : !['LIVE','FRESH'].includes(freshness)))
      return {status:'NEEDS_REFRESH',reason:!freshness || freshness==='UNKNOWN' ? 'DATA_MISSING' : 'DATA_STALE',
        nextAction:`refresh ${field}`};
  }
  // Owned proof covers only owned consumption; purchases use the acquisition gate.
  // Legacy fully-LIVE normalized input remains supported when no item proof exists.
  for (const item of inventoryItems) {
    const owned=Object.hasOwn(ownedItems,item) ? ownedItems[item] : 0;
    const bought=Object.hasOwn(boughtItems,item) ? boughtItems[item] : 0;
    const total=owned+bought;
    if (!isInteger(owned) || !isInteger(bought) || !isInteger(total) || !total)
      return {status:'NEEDS_REFRESH',reason:'DATA_MISSING',nextAction:'refresh inventory'};
    if (!owned) continue;
    const freshness=itemFreshness(item);
    if (freshness !== 'LIVE')
      return {status:'NEEDS_REFRESH',reason:!freshness || freshness==='UNKNOWN' ? 'DATA_MISSING' : 'DATA_STALE',
        nextAction:'refresh inventory'};
    const available=state.inventory?.[item];
    if (!state.inventory || !Object.hasOwn(state.inventory,item) || !isInteger(available))
      return {status:'NEEDS_REFRESH',reason:'DATA_MISSING',nextAction:'refresh inventory'};
    if (available < owned)
      return {status:'NEEDS_ITEMS',reason:'RESOURCE_MISSING',nextAction:'obtain and verify required items'};
  }
  if (drug && !isNonnegative(state.cooldowns?.drugSeconds))
    return {status:'NEEDS_REFRESH',reason:'DATA_MISSING',nextAction:'refresh drug cooldown'};
  if (booster && (!isNonnegative(state.cooldowns?.boosterSeconds) ||
      !isNonnegative(state.cooldowns?.boosterMaxSeconds)))
    return {status:'NEEDS_REFRESH',reason:'DATA_MISSING',nextAction:'refresh booster capacity'};
  if (booster) {
    const actions=plan.actions.filter(a=>a.action==='USE_BOOSTER');
    if (!Array.isArray(plan.boosterUseSequence) || plan.boosterUseSequence.length !== actions.length ||
        plan.boosterUseSequence.some((use,index)=>use.item !== actions[index].item ||
          use.quantity !== actions[index].quantity) ||
        plan.boosterUseSequence.reduce((sum,use)=>sum+use.quantity*use.cooldownSeconds,0) !==
          plan.economics?.boosterCooldownSeconds)
      return {status:'NEEDS_REFRESH',reason:'DATA_MISSING',nextAction:'verify booster sequence'};
    // The action order is the committed sequence; do not reorder a stale plan.
    const committed=plan.boosterUseSequence;
    let current=state.cooldowns.boosterSeconds;
    for (const item of committed) {
      if (!isNonnegative(item.cooldownSeconds) || !isInteger(item.quantity) || item.quantity < 1)
        return {status:'NEEDS_REFRESH',reason:'DATA_MISSING',nextAction:'verify booster sequence'};
      for (let use=0;use<item.quantity;use++) {
        if (current >= state.cooldowns.boosterMaxSeconds)
          return {status:'BLOCKED',reason:'BOOSTER_LIMIT_REACHED',nextAction:'wait for booster capacity'};
        current+=item.cooldownSeconds;
      }
    }
  }
  if (inventory && !state.inventory)
    return {status:'NEEDS_REFRESH',reason:'DATA_MISSING',nextAction:'refresh inventory'};
  if (!Array.isArray(state.gainPerks) || !Array.isArray(state.activeEffects))
    return {status:'NEEDS_REFRESH',reason:'DATA_MISSING',nextAction:'refresh gain modifiers'};
  if (plan.actions?.some(a=>a.action==='USE_REFILL')) {
    if (state.pointRefill?.allowed === false)
      return {status:'BLOCKED',reason:'RESOURCE_MISSING',nextAction:'confirm refill availability'};
    if (state.pointRefill?.allowed !== true)
      return {status:'NEEDS_REFRESH',reason:'DATA_MISSING',nextAction:'confirm refill availability'};
    if (state.pointRefill.fillAmountPolicy !== 'natural_max' ||
        !isInteger(state.pointRefill.pointsRequired))
      return {status:'NEEDS_REFRESH',reason:'DATA_MISSING',nextAction:'verify refill mechanics and point cost'};
    if (state.freshness?.pointRefill !== 'LIVE' || state.freshness?.points !== 'LIVE' ||
        !isInteger(state.pointsAvailable))
      return {status:'NEEDS_REFRESH',reason:'DATA_MISSING',nextAction:'refresh refill and points'};
    if (state.pointsAvailable < plan.economics.pointsConsumed)
      return {status:'BLOCKED',reason:'RESOURCE_MISSING',nextAction:'obtain required points'};
  }
  if (plan.actions?.some(a=>a.action==='TAKE_ECSTASY') && state.cooldowns?.drugSeconds > 0)
    return {status:'WAITING',reason:'COOLDOWN_BLOCKED',nextAction:'wait for drug cooldown, then verify Happy'};
  if (plan.actions?.find(a=>a.action!=='VERIFY_STATE')?.action === 'WAIT')
    return { status:'WAITING',reason:'COOLDOWN_BLOCKED',nextAction:'wait for checkpoint' };
  if (plan.actions?.some(a=>a.action==='WAIT'))
    return {status:'WAITING',reason:'COOLDOWN_BLOCKED',nextAction:'follow first step, then verify checkpoint'};
  return { status:'READY',reason:null,nextAction:plan.actions?.find(a=>a.action!=='VERIFY_STATE')?.action || 'VERIFY_STATE' };
}

// Only explicit mechanics and bounded quantities enter the recipe frontier.
// The no-boost path is composed by the caller, including when economics are absent.
function generateHappyRecipes(state, mechanics = {}, market = {}, preferences = {}) {
  if (!mechanics.ecstasy || !isNonnegative(mechanics.ecstasy.happyMultiplier) ||
      !state?.inventory?.ecstasy && !isNonnegative(mechanics.ecstasy.newCash)) return [];
  const prices = Array.isArray(market.items) ? Object.fromEntries(market.items.map(x=>[x.id,x])) : market.items || {};
  const maximum=state.cooldowns?.boosterMaxSeconds;
  const start=state.cooldowns?.boosterSeconds ?? 0;
  const slotsAvailable=isNonnegative(maximum) && isNonnegative(start) && maximum > 0 ?
    maximum-start : null;
  const items = Object.entries(mechanics).filter(([id,m]) => id !== 'ecstasy' &&
    isNonnegative(m.happy) && m.happy > 0 && isNonnegative(m.cooldownSeconds) && m.cooldownSeconds > 0)
    .map(([id,m]) => {
      const owned = state.inventory?.[id] || 0;
      const listing = prices[id];
      const unitCash = m.newCashEach ?? listing?.newCashEach;
      const purchasable = isNonnegative(unitCash) ?
        (listing?.availableQuantity ?? m.purchasableQuantity ?? m.maxQuantity ?? 0) : 0;
      const maxQuantity = m.maxQuantity ?? owned + purchasable;
      if (!isInteger(owned) || !isInteger(maxQuantity) || maxQuantity <= 0 ||
          !isNonnegative(unitCash) && maxQuantity > owned) return null;
      return { id, happy:m.happy, cooldownSeconds:m.cooldownSeconds, owned, maxQuantity,
        purchasableQuantity:purchasable,newCashEach:unitCash ?? 0,
        replacementValueEach:m.replacementValueEach ?? listing?.replacementValueEach ?? null };
    }).filter(Boolean);
  const ecstasyOnly = [{items:[],useEcstasy:true,
    preparation:{happyAdded:0,newCashRequired:0,economicValueConsumed:0,boosterCooldownSeconds:0}}];
  if (slotsAvailable == null || slotsAvailable <= 0 || !items.length) return ecstasyOnly;
  const maxSlots = Math.min(items.reduce((s,x)=>s+x.maxQuantity,0),
    Math.ceil(slotsAvailable/Math.min(...items.map(x=>x.cooldownSeconds))));
  const out = ecstasyOnly;
  // Missing replacement value cannot enter an economic frontier. Enumerate
  // bounded owned subsets and pair them with known-value frontiers; retain null cost.
  const knownValue = items.filter(x=>x.owned === 0 || isNonnegative(x.replacementValueEach));
  const unknownValue=items.filter(x=>!isNonnegative(x.replacementValueEach) && x.owned > 0);
  function addKnownFrontier(unknownItems,happy,cooldown,slotsUsed) {
    for (let slots=unknownItems.length ? 0 : 1; slots<=maxSlots-slotsUsed; slots++) {
      const frontier=generateHappyFrontier({boosterSlots:slots,items:knownValue,
        newCashBudget:preferences.budgetNewCash ?? Infinity});
      if (frontier.status !== 'ok') continue;
      // An economically dominant bundle may be illegal at the next-use threshold.
      // Check the complete booster sequence before applying economic dominance.
      const legal=frontier.rawCandidates.map(c=>{
        const recipeItems=knownValue.map(item=>({id:item.id,
          quantity:(c.bundle[`${item.id}Owned`] || 0)+(c.bundle[`${item.id}Bought`] || 0),
          owned:c.bundle[`${item.id}Owned`] || 0,newCashEach:item.newCashEach,
          replacementValueEach:item.replacementValueEach})).filter(item=>item.quantity);
        const ordered=orderedBoosterUses([...unknownItems,...recipeItems],mechanics,start,maximum);
        return ordered ? {c,ordered} : null;
      }).filter(Boolean);
      for (const {c,ordered} of legal.filter(entry=>!legal.some(other=>other!==entry &&
        dominatesHappyRecipe(other.c,entry.c)))) {
        const next=ordered.at(-1)?.id;
        const remaining=items.filter(item=>item.id===next || item.owned)
          .map(item=>({id:item.id,quantity:(state.inventory?.[item.id] || 0)-
            (ordered.find(used=>used.id===item.id)?.owned || 0)}))
          .filter(item=>item.quantity > 0)
          .sort((a,b)=>(a.id===next ? -1 : b.id===next ? 1 : compareStrings(a.id,b.id)))[0];
        const nextBoosterCheckpoint=start+cooldown+c.cooldownSeconds >= maximum && remaining ?
          {actions:[{action:'WAIT',checkpoint:'BOOSTER_BELOW_MAX'},
            {action:'VERIFY_STATE',fields:['boosterCooldown','happy']}],
          item:remaining.id,remainingQuantity:remaining.quantity,requiresBoosterSecondsBelow:maximum} : null;
        out.push({items:ordered,useEcstasy:true,
          ...(nextBoosterCheckpoint ? {nextBoosterCheckpoint} : {}),
          preparation:{happyAdded:happy+c.happy,newCashRequired:c.newCash,
            economicValueConsumed:unknownItems.length ? null : c.economicValueConsumed,
            boosterCooldownSeconds:cooldown+c.cooldownSeconds}});
      }
    }
  }
  function visitUnknown(index,selected,happy,cooldown,slotsUsed) {
    if (index===unknownValue.length) return addKnownFrontier(selected,happy,cooldown,slotsUsed);
    const item=unknownValue[index];
    for (let quantity=0; quantity<=Math.min(item.owned,maxSlots-slotsUsed,
      Math.ceil(slotsAvailable/item.cooldownSeconds)); quantity++) {
      visitUnknown(index+1,quantity ? [...selected,{id:item.id,quantity,owned:quantity,
        newCashEach:0,replacementValueEach:null}] : selected,happy+quantity*item.happy,
      cooldown+quantity*item.cooldownSeconds,slotsUsed+quantity);
    }
  }
  visitUnknown(0,[],0,0,0);
  return out.sort((a,b)=>compareNumbers(a.preparation.happyAdded,b.preparation.happyAdded) ||
    compareNumbers(a.preparation.economicValueConsumed ?? Infinity,b.preparation.economicValueConsumed ?? Infinity) ||
    compareStrings(JSON.stringify(a.items),JSON.stringify(b.items)));
}

function simulatePreparedTraining(state, happy, energy, postTrainRefill) {
  const input={modelId:MODEL_ID,stat:{kind:state.targetStat,value:state.stats[state.targetStat]},
    happy,gym:state.gym,gainPerks:state.gainPerks || [],
    effects:state.activeEffects?.filter(x=>x.support==='UNSUPPORTED')};
  const first=simulatePlanTraining({...input,energy});
  if (!postTrainRefill) return first;
  if (first.status !== 'ok') return fail('unsupported',first.reason || 'MODEL_OUT_OF_DOMAIN');
  if (first.remainingEnergy >= state.naturalEnergyMax || !first.modeledTrainCount)
    return fail('unsupported','RESOURCE_MISSING');
  const second=simulatePlanTraining({...input,stat:{...input.stat,value:first.modeledEndStat},
    happy:first.finalHappy,energy:state.naturalEnergyMax});
  if (second.status === 'unsupported' && second.reason === 'OUT_OF_MODEL_DOMAIN')
    return fail('unsupported','MODEL_OUT_OF_DOMAIN');
  if (!['ok','partial'].includes(second.status)) return second;
  return {...second,modeledTrainCount:first.modeledTrainCount+second.modeledTrainCount,
    modeledGain:second.modeledEndStat-input.stat.value,
    energySpent:first.energySpent+second.energySpent,
    trains:[...first.trains,...second.trains.map(train=>({...train,index:first.modeledTrainCount+train.index}))],
    preRefillState:{stat:first.modeledEndStat,happy:first.finalHappy,energy:first.remainingEnergy},
    assumption:first.assumption};
}

function composePlan({ state, preferences = {}, energy, recipe = { items:[], useEcstasy:false },
  itemMechanics = {}, marketSnapshot = {}, timing = {}, postTrainRefill = false }) {
  if (!state || !isNonnegative(state.energy) || !isInteger(energy.energyAtTraining) ||
      !isNonnegative(state.happy) || !state.targetStat || !state.gym?.energyPerTrain) return fail('invalid','INVALID_INPUT');
  if (postTrainRefill && (!preferences.allowRefill || state.pointRefill?.allowed !== true ||
      state.pointRefill.fillAmountPolicy !== 'natural_max' ||
      !isInteger(state.naturalEnergyMax) || !state.naturalEnergyMax ||
      energy.energyAtTraining <= state.naturalEnergyMax ||
      energy.actions.some(a=>a.action==='USE_REFILL'))) return fail('unsupported','RESOURCE_MISSING');
  const actions = [{action:'VERIFY_STATE'}];
  actions.push(...energy.actions);
  if (energy.waitSeconds > 0) actions.push({action:'VERIFY_STATE',fields:['energy','happy','cooldowns']});
  if (recipe.useEcstasy && energy.xanaxUses && !isNonnegative(energy.postDrugCooldownSeconds))
    return fail('unsupported','DATA_MISSING');
  const ecstasyWaitSeconds=recipe.useEcstasy ? energy.xanaxUses ? energy.postDrugCooldownSeconds :
    Math.max(0,(state.cooldowns?.drugSeconds || 0)-(energy.waitSeconds || 0)) : 0;
  const totalWaitSeconds=(energy.waitSeconds || 0)+ecstasyWaitSeconds;
  if (preferences.maxWaitSeconds != null && totalWaitSeconds > preferences.maxWaitSeconds)
    return fail('unsupported','COOLDOWN_BLOCKED');
  // A later drug checkpoint below the natural cap needs another observed Energy
  // projection. This slice does not infer the future training Energy from an unverified wait.
  if (ecstasyWaitSeconds && energy.energyAtTraining < state.naturalEnergyMax)
    return fail('unsupported','DATA_MISSING');
  const futureHappyNeeded = totalWaitSeconds > 0;
  if (ecstasyWaitSeconds) actions.push({action:'WAIT',seconds:ecstasyWaitSeconds,
    checkpoint:'DRUG_COOLDOWN'},{action:'VERIFY_STATE',fields:['energy','happy','cooldowns']});
  const futureHappy = futureHappyNeeded ? state.happyAtCheckpoint : state.happy;
  let currentHappy = isInteger(futureHappy) && futureHappy <= 99999 ? futureHappy : null;
  if (energy.xanaxUses && !futureHappyNeeded) {
    if (!isInteger(itemMechanics.xanax?.happyGain)) return fail('unsupported','UNSUPPORTED_EFFECT');
    if (currentHappy != null)
      currentHappy=Math.min(99999,currentHappy+energy.xanaxUses*itemMechanics.xanax.happyGain);
  }
  // A future Happy checkpoint already includes every preceding Xanax success.
  const happyBeforeBoosters=currentHappy;
  const ownedItemsConsumed = {}, boughtItems = {};
  let newCashRequired = 0, ownedValue = 0, boosterCooldownSeconds = 0;
  let resourceUnknown = false;
  if (energy.xanaxUses) {
    if (!isInteger(energy.xanaxUses)) return fail('invalid','INVALID_INPUT');
    const owned = Math.min(energy.xanaxUses,state.inventory?.xanax || 0), bought=energy.xanaxUses-owned;
    const listing = Array.isArray(marketSnapshot.items) ? marketSnapshot.items.find(x=>x.id==='xanax') :
      marketSnapshot.items?.xanax;
    const cashEach = itemMechanics.xanax?.newCashEach ?? listing?.newCashEach;
    const replacement = itemMechanics.xanax?.replacementValueEach ?? listing?.replacementValueEach;
    if (owned) ownedItemsConsumed.xanax=owned;
    if (bought) boughtItems.xanax=bought;
    if (owned && !isNonnegative(replacement)) ownedValue=null;
    else if (owned) ownedValue+=owned*replacement;
    if (bought && !isNonnegative(cashEach)) {newCashRequired=null;resourceUnknown=true;}
    else if (bought) newCashRequired+=bought*cashEach;
  }
  const requestedBoosters=recipe.items || [];
  if (requestedBoosters.some(item=>!itemMechanics[item.id] ||
      !isNonnegative(itemMechanics[item.id].cooldownSeconds) ||
      !itemMechanics[item.id].cooldownSeconds || !isInteger(item.quantity) || !item.quantity))
    return fail('unsupported','UNSUPPORTED_EFFECT');
  const boosters=requestedBoosters.length ? orderedBoosterUses(requestedBoosters,itemMechanics,
    state.cooldowns?.boosterSeconds ?? 0,state.cooldowns?.boosterMaxSeconds) : [];
  if (!boosters) return fail('unsupported',isNonnegative(state.cooldowns?.boosterMaxSeconds) ?
    'BOOSTER_LIMIT_REACHED':'DATA_MISSING');
  for (const item of boosters) {
    const mechanic = itemMechanics[item.id];
    if (!mechanic || !isNonnegative(mechanic.happy) || !isNonnegative(mechanic.cooldownSeconds) ||
        !isInteger(item.quantity) || !isInteger(item.owned) || item.owned > item.quantity ||
        item.owned > (state.inventory?.[item.id] ?? 0) ||
        !isNonnegative(item.newCashEach) ||
        (item.replacementValueEach != null && !isNonnegative(item.replacementValueEach))) return fail('unsupported','UNSUPPORTED_EFFECT');
    if (currentHappy != null) currentHappy = Math.min(99999,currentHappy+item.quantity*mechanic.happy);
    boosterCooldownSeconds += item.quantity*mechanic.cooldownSeconds;
    if (item.owned) ownedItemsConsumed[item.id] = item.owned;
    if (item.quantity-item.owned) boughtItems[item.id] = item.quantity-item.owned;
    if (newCashRequired != null) newCashRequired += (item.quantity-item.owned)*item.newCashEach;
    if (item.owned && item.replacementValueEach == null) ownedValue = null;
    else if (ownedValue != null) ownedValue += item.owned*item.replacementValueEach;
    actions.push({action:'USE_BOOSTER',item:item.id,quantity:item.quantity});
  }
  if (boosters.length) actions.push({action:'VERIFY_STATE',expectedHappy:currentHappy});
  const preEcstasyHappy = currentHappy;
  if (recipe.useEcstasy) {
    if (!isNonnegative(itemMechanics.ecstasy?.happyMultiplier) || itemMechanics.ecstasy.happyMultiplier <= 0)
      return fail('unsupported','UNSUPPORTED_EFFECT');
    const doubled = currentHappy == null ? null : currentHappy*itemMechanics.ecstasy.happyMultiplier;
    if (doubled != null && !Number.isInteger(doubled)) return fail('unsupported','UNSUPPORTED_EFFECT');
    currentHappy = doubled == null ? null : Math.min(99999,doubled);
    actions.push({action:'TAKE_ECSTASY'},{action:'VERIFY_STATE',expectedHappy:currentHappy});
    const ecstasyOwned = state.inventory?.ecstasy > 0;
    if (ecstasyOwned) ownedItemsConsumed.ecstasy = 1;
    else boughtItems.ecstasy = 1;
    if (isNonnegative(itemMechanics.ecstasy.replacementValue) && ownedValue != null)
      ownedValue += ecstasyOwned ? itemMechanics.ecstasy.replacementValue : 0;
    else if (ecstasyOwned) ownedValue = null;
    if (!ecstasyOwned && isNonnegative(itemMechanics.ecstasy.newCash) && newCashRequired != null)
      newCashRequired += itemMechanics.ecstasy.newCash;
    else if (!ecstasyOwned) {newCashRequired = null;resourceUnknown=true;}
  }
  const trainCount = Math.floor(energy.energyAtTraining/state.gym.energyPerTrain);
  actions.push({action:'TRAIN',targetStat:state.targetStat,trainCount,energySpent:trainCount*state.gym.energyPerTrain});
  const simulation=currentHappy == null ? fail('unsupported','DATA_MISSING') : capabilities(state).canPredictGain ?
    simulatePreparedTraining(state,currentHappy,energy.energyAtTraining,postTrainRefill) : null;
  if (postTrainRefill && ['ok','partial'].includes(simulation?.status)) {
    const refillTrainCount=Math.floor(state.naturalEnergyMax/state.gym.energyPerTrain);
    actions.push({action:'USE_REFILL'},
      {action:'VERIFY_STATE',fields:['energy','happy','stat','points'],
        expectedEnergy:state.naturalEnergyMax,expectedHappy:simulation.preRefillState.happy,
        expectedStat:simulation.preRefillState.stat},
      {action:'TRAIN',targetStat:state.targetStat,trainCount:refillTrainCount,
        energySpent:refillTrainCount*state.gym.energyPerTrain});
  } else if (postTrainRefill) return fail('unsupported',simulation?.reason || 'DATA_MISSING');
  let marginalGainFromFinalBooster = null;
  if (simulation?.status === 'ok' && boosters.length) {
    const last=boosters.at(-1);
    let withoutLast=happyBeforeBoosters;
    for (const item of boosters) withoutLast=Math.min(99999,withoutLast+
      (item.quantity-(item===last ? 1 : 0))*itemMechanics[item.id].happy);
    if (recipe.useEcstasy) withoutLast=Math.min(99999,withoutLast*itemMechanics.ecstasy.happyMultiplier);
    if (Number.isInteger(withoutLast)) {
      const previous=simulatePreparedTraining(state,withoutLast,energy.energyAtTraining,postTrainRefill);
      if (previous.status==='ok') marginalGainFromFinalBooster=simulation.modeledGain-previous.modeledGain;
    }
  }
  const fingerprintValue = structuralFingerprint({actions,targetStat:state.targetStat,
    statAllocationMode:preferences.statAllocationMode,resourcePolicy:preferences.resourcePolicy,
    ownedItemsConsumed,boughtItems});
  const usedRefill=energy.actions.some(a=>a.action==='USE_REFILL') || postTrainRefill;
  const pointsConsumed=postTrainRefill ? state.pointRefill.pointsRequired ?? null :
    usedRefill ? energy.pointsConsumed ?? null : 0;
  const economics = {newCashRequired,marketValueOfOwnedItemsConsumed:ownedValue,
    pricedPointValueConsumed:pointsConsumed == null ? null : pointsConsumed === 0 ? 0 :
      isNonnegative(preferences.pointValue) ? pointsConsumed*preferences.pointValue : null,
    naturalEnergyLost:energy.naturalEnergyLost == null || ecstasyWaitSeconds && !state.naturalRegen ? null :
      energy.naturalEnergyLost+naturalEnergyLost({energy:energy.energyAtTraining,
        naturalEnergyMax:state.naturalEnergyMax,stackCap:state.stackCap,
        naturalRegen:state.naturalRegen,waitSeconds:ecstasyWaitSeconds}),
    pointsConsumed,
    boosterCooldownSeconds, discardedEnergy:energy.discardedEnergy || 0};
  economics.economicValueConsumed = Number.isFinite(newCashRequired) && Number.isFinite(ownedValue) &&
    economics.pricedPointValueConsumed != null ? newCashRequired+ownedValue+economics.pricedPointValueConsumed : null;
  const plan = {id:fingerprintValue,fingerprint:fingerprintValue,objective:preferences.objective || 'BALANCED',
    target:{stat:state.targetStat,allocationMode:preferences.statAllocationMode || 'TARGET_STAT'},
    actions,phase:totalWaitSeconds ? 'WAITING_COOLDOWN' : recipe.useEcstasy ? 'HAPPY_PREP' : 'TRAINING_READY',
    startState:{energy:state.energy,happy:state.happy,stat:state.stats?.[state.targetStat]},
    projectedEndState:simulation?.status==='ok' || simulation?.status==='partial' ?
      {stat:simulation.modeledEndStat,happy:simulation.finalHappy,energy:simulation.remainingEnergy} : null,
    resources:{ownedItemsConsumed,boughtItems,energySpent:simulation?.energySpent ?? 0,resourceUnknown},economics,
    ...(boosters.length ? {boosterUseSequence:boosters.map(item=>({item:item.id,quantity:item.quantity,
      cooldownSeconds:itemMechanics[item.id].cooldownSeconds}))} : {}),
    ...(recipe.nextBoosterCheckpoint ? {nextBoosterCheckpoint:recipe.nextBoosterCheckpoint} : {}),
    timing:{waitSeconds:totalWaitSeconds,timeToCompletionHours:totalWaitSeconds/3600},
    confidence:{level:state.calibratedDomain === true ? 'CALIBRATED' : 'SUPPORTED_EXTRAPOLATION',
      reasons:state.calibratedDomain === true ? ['DOCUMENTED_OBSERVED_DOMAIN'] : ['OUTSIDE_DOCUMENTED_CALIBRATION']},
    prerequisites:['VERIFY_STATE',...(recipe.useEcstasy?['SAFE_QUARTER_WINDOW']:[])],
    simulation,preEcstasyHappy,postEcstasyHappy:currentHappy,marginalGainFromFinalBooster,
    explanation:{modelId:MODEL_ID,arithmetic:'central path; zero gain noise and Happy-loss roll 5',
      economicValueKnown:economics.economicValueConsumed != null},
    warnings: simulation?.reason ? [simulation.reason] : [],stopReason:simulation?.reason || null };
  plan.readiness = planReadiness(plan,state,timing);
  return plan;
}

function recommend({observedState,preferences = {},marketSnapshot = {},itemMechanics = {},timing = {}} = {}) {
  const mode = preferences.statAllocationMode || 'TARGET_STAT';
  if (!['TARGET_STAT','WEAKEST_STAT','BALANCED_STATS'].includes(mode))
    return {status:'NO_SAFE_RECOMMENDATION',reason:'INVALID_INPUT',primaryPlan:null};
  if (mode === 'BALANCED_STATS')
    return {status:'NO_SAFE_RECOMMENDATION',reason:'UNSUPPORTED_EFFECT',primaryPlan:null};
  const kinds = Object.keys(STATS);
  if (mode === 'WEAKEST_STAT' && !kinds.every(k=>isNonnegative(observedState?.stats?.[k])))
    return {status:'NO_SAFE_RECOMMENDATION',reason:'DATA_MISSING',primaryPlan:null};
  const chosen = mode === 'WEAKEST_STAT' ? kinds.sort((a,b)=>
    compareNumbers(observedState.stats[a],observedState.stats[b]) || compareStrings(a,b))[0] :
    preferences.targetStat || observedState?.targetStat;
  const state = observedState && {...observedState,targetStat:chosen};
  if (!state || !isNonnegative(state.energy) || !state.gym?.energyPerTrain || !state.targetStat)
    return {status:'NO_SAFE_RECOMMENDATION',reason:'DATA_MISSING',primaryPlan:null};
  if (preferences.cashReserve != null && (!isNonnegative(preferences.cashReserve) || !isNonnegative(state.cash)))
    return {status:'NO_SAFE_RECOMMENDATION',reason:'DATA_MISSING',primaryPlan:null};
  const budgetNewCash = preferences.cashReserve == null ? preferences.budgetNewCash :
    Math.min(preferences.budgetNewCash ?? Infinity,Math.max(0,state.cash-preferences.cashReserve));
  const cap = capabilities(state,marketSnapshot);
  if (!cap.canPredictGain) return {status:'NO_SAFE_RECOMMENDATION',reason:cap.reason || 'DATA_MISSING',
    capabilities:cap,primaryPlan:null};
  const energyStates = generateEnergyCandidates({ ...state, maxWaitSeconds:preferences.maxWaitSeconds ?? 0,
    pointRefill:preferences.allowRefill ? state.pointRefill : null });
  const plans = [];
  const strategyPreferences={...preferences,maxWaitSeconds:preferences.maxWaitSeconds ?? 0};
  const recipes = preferences.allowItems === false ? [] : generateHappyRecipes(state,itemMechanics,
    marketSnapshot,{...preferences,budgetNewCash});
  for (const energy of energyStates) {
    plans.push(composePlan({state,preferences:strategyPreferences,energy,itemMechanics,marketSnapshot,timing}));
    for (const recipe of recipes) plans.push(composePlan({state,preferences:strategyPreferences,
      energy,recipe,itemMechanics,marketSnapshot,timing}));
    if (preferences.allowRefill && state.pointRefill?.allowed === true &&
        state.pointRefill.fillAmountPolicy === 'natural_max' &&
        energy.energyAtTraining > state.naturalEnergyMax &&
        !energy.actions.some(a=>a.action==='USE_REFILL')) {
      plans.push(composePlan({state,preferences:strategyPreferences,energy,itemMechanics,
        marketSnapshot,timing,postTrainRefill:true}));
      for (const recipe of recipes) plans.push(composePlan({state,preferences:strategyPreferences,
        energy,recipe,itemMechanics,marketSnapshot,timing,postTrainRefill:true}));
    }
  }
  const candidates = plans.filter(p=>p.simulation?.status === 'ok').map(p=>({
    id:p.id,fingerprint:p.fingerprint,confidence:p.confidence.level,
    expectedGain:p.simulation.modeledGain,economicValueConsumed:p.economics.economicValueConsumed,
    newCashRequired:p.economics.newCashRequired,
    timeToCompletionHours:p.timing.timeToCompletionHours,
    naturalEnergyLost:p.economics.naturalEnergyLost,pointsConsumed:p.economics.pointsConsumed,
    opportunityUnknown:p.economics.naturalEnergyLost == null,
    itemsConsumed:Object.fromEntries(Object.entries(p.resources.ownedItemsConsumed).concat(Object.entries(p.resources.boughtItems))
      .map(([id])=>[id,(p.resources.ownedItemsConsumed[id] || 0)+(p.resources.boughtItems[id] || 0)])),
    boughtItemsCount:Object.values(p.resources.boughtItems).reduce((sum,n)=>sum+n,0),
    resourceUnknown:p.resources.resourceUnknown || p.economics.pointsConsumed == null,plan:p }));
  const reference = isInteger(state.ordinaryHappy) && state.ordinaryHappy <= 99999 ?
    simulatePlanTraining({modelId:MODEL_ID,stat:{kind:state.targetStat,value:state.stats[state.targetStat]},
      happy:state.ordinaryHappy,gym:state.gym,gainPerks:state.gainPerks || [],energy:state.naturalEnergyMax}) : null;
  const referenceSessionGain = reference?.status === 'ok' ? reference.modeledGain : undefined;
  const ranking = rankCandidates({candidates,objective:preferences.objective || 'BALANCED',
    riskPolicy:preferences.riskPolicy || 'ALLOW_SUPPORTED',referenceSessionGain,
    budgetNewCash,maxWaitHours:preferences.maxWaitHours,
    pointLimit:preferences.pointLimit,prohibitedItems:preferences.prohibitedItems,
    ownedItemsOnly:preferences.ownedItemsOnly});
  const primaryPlan = ranking.selected?.plan || null;
  const trainNow = candidates.find(c=>c.plan.actions.every(a=>!['WAIT','TAKE_XANAX','USE_BOOSTER','TAKE_ECSTASY','USE_REFILL'].includes(a.action)));
  const cheapest = [...candidates].filter(c=>c.economicValueConsumed != null)
    .sort((a,b)=>compareNumbers(a.economicValueConsumed,b.economicValueConsumed) ||
      compareStrings(a.fingerprint,b.fingerprint))[0];
  const fastest = [...candidates].sort((a,b)=>compareNumbers(a.timeToCompletionHours,b.timeToCompletionHours) ||
    compareStrings(a.fingerprint,b.fingerprint))[0];
  const maxGain = candidates.length ? Math.max(...candidates.map(c=>c.expectedGain)) : null;
  const unsupportedPlans = plans.filter(p=>p.simulation?.status==='partial' ||
    p.simulation?.status==='unsupported' || p.simulation?.status==='invalid')
    .map(p=>({id:p.id,reason:p.simulation.reason === 'OUT_OF_MODEL_DOMAIN' ?
      'MODEL_OUT_OF_DOMAIN' : p.simulation.reason}));
  return {status:ranking.status,objective:preferences.objective || 'BALANCED',primaryPlan,
    alternatives:ranking.alternatives?.map(c=>c.plan) || [],readiness:primaryPlan?.readiness || null,
    outcome:primaryPlan?.simulation || null,economics:primaryPlan?.economics || null,
    confidence:primaryPlan?.confidence || null,explanation:primaryPlan ?
      [`Selected by ${preferences.objective || 'BALANCED'} from supported candidate outcomes`,...(ranking.advancedReasons || [])] :
      [ranking.reason || 'NO_SAFE_RECOMMENDATION'],
    rejectedPlans:[...(ranking.rejected || []),...unsupportedPlans],
    opportunitySummary:{referenceSessionGain,frontierCount:ranking.frontier?.length || 0,
      gainVsTrainNow:primaryPlan && trainNow ? ranking.selected.expectedGain-trainNow.expectedGain : null,
      gainVsCheapest:primaryPlan && cheapest ? ranking.selected.expectedGain-cheapest.expectedGain : null,
      additionalWaitHoursVsFastest:primaryPlan && fastest ? ranking.selected.timeToCompletionHours-fastest.timeToCompletionHours : null,
      fractionOfMaxModeledGain:primaryPlan && maxGain>0 ? ranking.selected.expectedGain/maxGain : null,
      marginalGainFromFinalBooster:primaryPlan?.marginalGainFromFinalBooster ?? null},
    nextAction:primaryPlan?.readiness.nextAction || 'provide supported state',
    refreshTriggers:['STATE_CHANGED','DATA_STALE','TIMING_UNSAFE'],capabilities:cap,
    reason:ranking.reason === 'NO_COMPETITIVE_PLAN' && unsupportedPlans.length ?
      unsupportedPlans[0].reason : ranking.reason};
}

module.exports = { MODEL_ID, happyMultiplier, happyLoss, simulateTraining, simulatePlanTraining,
  rankCandidates, paretoPrune, generateHappyFrontier, generateEnergyCandidates, naturalEnergyLost,
  resolveObserved, replanOnEvent, compareRecommendationIdentity, simulateResolvedBoundary,
  capabilities, structuralFingerprint, planReadiness, generateHappyRecipes, composePlan, recommend };

    },
    "./training-advisor-adapters.js": function(module, exports, require) {
'use strict';

// DQ-TRAIN-001D: pure source normalization. Callers supply responses and
// explicit observation evidence; this module performs no requests or I/O.
const STATS = ['strength', 'speed', 'defense', 'dexterity'];
const CATEGORIES = ['faction', 'property', 'job', 'education', 'enhancer', 'book', 'stock', 'merit'];
const INVENTORY_SOURCES = { Drug: 'drugInventory', Booster: 'boosterInventory', Candy: 'candyInventory' };
const ENERGY_STACK_CAP_MECHANIC = Object.freeze({value:1000,
  sourceId:'TORN_ENERGY_STACK_CAP_V1',cacheClass:'VERSIONED_MECHANIC',verifiedAt:'2026-09-27'});
const ITEM_REGISTRY = Object.freeze({
  206: Object.freeze({ key: 'xanax', type: 'Drug', energyGain: 250, happyGain: 75,
    drugCooldownRangeSeconds: [21600, 28800], exactFutureCooldownKnown: false }),
  197: Object.freeze({ key: 'ecstasy', type: 'Drug', happyMultiplier: 2,
    documentedDrugCooldownEnvelopeSeconds: [12000, 13860], exactFutureCooldownKnown: false }),
  366: Object.freeze({ key: 'eroticDvd', type: 'Booster', happyGain: 2500, boosterCooldownSeconds: 21600 }),
  37: Object.freeze({ key: 'candy37', type: 'Candy', happyGain: 25, boosterCooldownSeconds: 1800 }),
  527: Object.freeze({ key: 'candy527', type: 'Candy', happyGain: 50, boosterCooldownSeconds: 1800 }),
  210: Object.freeze({ key: 'candy210', type: 'Candy', happyGain: 25, boosterCooldownSeconds: 1800 }),
  528: Object.freeze({ key: 'candy528', type: 'Candy', happyGain: 75, boosterCooldownSeconds: 1800 }),
  36: Object.freeze({ key: 'candy36', type: 'Candy', happyGain: 35, boosterCooldownSeconds: 1800 }),
  1028: Object.freeze({ key: 'candy1028', type: 'Candy', happyGain: 250, boosterCooldownSeconds: 1800 }),
  35: Object.freeze({ key: 'candy35', type: 'Candy', happyGain: 25, boosterCooldownSeconds: 1800 }),
  39: Object.freeze({ key: 'candy39', type: 'Candy', happyGain: 25, boosterCooldownSeconds: 1800 }),
  209: Object.freeze({ key: 'candy209', type: 'Candy', happyGain: 25, boosterCooldownSeconds: 1800 }),
  310: Object.freeze({ key: 'candy310', type: 'Candy', happyGain: 25, boosterCooldownSeconds: 1800 }),
  634: Object.freeze({ key: 'candy634', type: 'Candy', happyGain: 75, boosterCooldownSeconds: 1800 })
});
const finite = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const whole = n => Number.isSafeInteger(n) && n >= 0;
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const fresh = f => f === 'LIVE' || f === 'FRESH';

function sourceStatus(sourceId, payload, meta = {}, cacheClass = 'UNCACHED') {
  meta = object(meta) ? meta : {};
  const failure = payload?.status === 'PERMISSION_DENIED' || meta.permissionFailure === true ?
    'CAPABILITY_UNAVAILABLE' : payload == null || meta.requestSucceeded === false ?
      'DATA_MISSING' : null;
  // A recent HTTP response alone cannot promote cached inventory or an
  // unverified source timestamp to an execution-safe observation.
  const verified = meta.requestSucceeded === true && meta.observedAt != null &&
    typeof meta.sourceId === 'string' && meta.sourceId === sourceId;
  const claimed = ['LIVE', 'FRESH', 'STALE'].includes(meta.freshness) ? meta.freshness : 'UNKNOWN';
  const freshness = failure || !verified ? 'UNKNOWN' : cacheClass === 'CATEGORY_1H' && claimed === 'LIVE' ?
    'FRESH' : claimed;
  return { sourceId, requestedSelection: meta.requestedSelection || sourceId,
    requestSucceeded: !failure && meta.requestSucceeded === true,
    permissionFailure: failure === 'CAPABILITY_UNAVAILABLE',
    observedAt: verified ? meta.observedAt : null,
    ...(meta.sourceTimestamp != null ? { sourceTimestamp: meta.sourceTimestamp } : {}),
    cacheClass, freshness, reason: failure };
}
function field(value, status, provenance = 'OBSERVED', extra = {}) {
  return { value, provenance, freshness: status.freshness, sourceId: status.sourceId,
    observedAt: status.observedAt, ...(status.sourceTimestamp != null ?
      { sourceTimestamp: status.sourceTimestamp } : {}), cacheClass: status.cacheClass, ...extra };
}
function unavailable(reason = 'DATA_MISSING', sourceId = null) {
  return { value: null, provenance: null, freshness: 'UNKNOWN', sourceId,
    observedAt: null, reason };
}

function adaptEnergyStackCap(configuredMechanics = {}) {
  const configured = object(configuredMechanics) ? configuredMechanics : {};
  // An explicit conflicting value cannot override the audited versioned mechanic.
  if (Object.hasOwn(configured,'energyStackCap') &&
      configured.energyStackCap !== ENERGY_STACK_CAP_MECHANIC.value)
    return {available:false,field:unavailable('MECHANIC_VERSION_MISMATCH',
      ENERGY_STACK_CAP_MECHANIC.sourceId)};
  const status={sourceId:ENERGY_STACK_CAP_MECHANIC.sourceId,observedAt:null,
    freshness:'FRESH',cacheClass:ENERGY_STACK_CAP_MECHANIC.cacheClass};
  return {available:true,field:field(ENERGY_STACK_CAP_MECHANIC.value,status,'CONFIGURED',
    {verifiedAt:ENERGY_STACK_CAP_MECHANIC.verifiedAt})};
}

function adaptBars(payload, meta) {
  const status = sourceStatus('/user/bars', payload, meta);
  const fields = {};
  if (!status.reason && object(payload?.energy) && whole(payload.energy.current) &&
      whole(payload.energy.maximum) && whole(payload.energy.increment) &&
      whole(payload.energy.interval) && payload.energy.interval > 0) {
    fields.energy = field(payload.energy.current, status);
    fields.naturalEnergyMax = field(payload.energy.maximum, status);
    fields.naturalRegen = field({ energy: payload.energy.increment,
      everySeconds: payload.energy.interval }, status);
  } else for (const key of ['energy', 'naturalEnergyMax', 'naturalRegen'])
    fields[key] = unavailable(status.reason || 'SCHEMA_MISMATCH', status.sourceId);
  if (!status.reason && object(payload?.happy) && whole(payload.happy.current) &&
      whole(payload.happy.maximum) && payload.happy.current <= 99999 &&
      payload.happy.maximum <= 99999) {
    fields.happy = field(payload.happy.current, status);
    fields.ordinaryHappy = payload.happy.current <= payload.happy.maximum ||
      meta?.ordinaryHappyVerifiedAtElevated === true ? field(payload.happy.maximum, status,
        'OBSERVED', { reason: payload.happy.current > payload.happy.maximum ?
          'ELEVATED_MAPPING_VERIFIED' : 'ORDINARY_STATE_MAPPING_GUARDED' }) :
      unavailable('ORDINARY_HAPPY_ELEVATED_UNVERIFIED', status.sourceId);
  } else for (const key of ['happy', 'ordinaryHappy'])
    fields[key] = unavailable(status.reason || 'SCHEMA_MISMATCH', status.sourceId);
  return { status, fields };
}

function adaptCooldowns(payload, meta) {
  const status = sourceStatus('/user/cooldowns', payload, meta);
  return { status, fields: {
    drugCooldown: !status.reason && whole(payload?.drug) ? field(payload.drug, status) :
      unavailable(status.reason || 'SCHEMA_MISMATCH', status.sourceId),
    boosterCooldown: !status.reason && whole(payload?.booster) ? field(payload.booster, status) :
      unavailable(status.reason || 'SCHEMA_MISMATCH', status.sourceId)
  } };
}

function adaptBattleStats(payload, meta, manualInput = {}) {
  manualInput = object(manualInput) ? manualInput : {};
  const status = sourceStatus('/user/battlestats', payload, meta);
  const raw = !status.reason && STATS.every(k => object(payload?.[k]) && finite(payload[k].value)) ?
    Object.fromEntries(STATS.map(k => [k, payload[k].value])) : null;
  const manual = object(manualInput.stats) && STATS.every(k => finite(manualInput.stats[k])) &&
    manualInput.confirmed === true ? Object.fromEntries(STATS.map(k => [k, manualInput.stats[k]])) : null;
  const source = raw ? status : manual ? { ...sourceStatus('PLAYER_CONFIRMED_STATS',
    manual, {sourceId:'PLAYER_CONFIRMED_STATS',requestSucceeded:true,
      observedAt:manualInput.observedAt,freshness:manualInput.freshness}), cacheClass:'PLAYER_CONFIRMATION' } : null;
  return { status, stats: raw || manual, automaticStatsAvailable: !!raw,
    manualStatsAccepted: !raw && !!manual,
    field: source ? field(raw || manual, source, raw ? 'OBSERVED' : 'CONFIGURED') :
      unavailable(status.reason || 'SCHEMA_MISMATCH', status.sourceId) };
}

function adaptGym(userGym, tornGyms, targetStat, userMeta, catalogMeta) {
  const userStatus = sourceStatus('/user/gym', userGym, userMeta);
  const catalogStatus = sourceStatus('/torn/gyms', tornGyms, catalogMeta);
  const id = userGym?.gym?.id;
  const rows = Array.isArray(tornGyms) ? tornGyms : null;
  const matches = rows?.filter(r => r?.id === id);
  const row = matches?.[0];
  const structurallyValid = !userStatus.reason && !catalogStatus.reason && whole(id) && id > 0 &&
    matches?.length === 1 &&
    typeof userGym.gym.name === 'string' && userGym.gym.name && row &&
    typeof row.name === 'string' && row.name && row.name === userGym.gym.name &&
    typeof row.class === 'string' && row.class && whole(row.energy_cost) && row.energy_cost > 0 &&
    finite(row.cost) && object(row.modifiers) && STATS.every(k => finite(row.modifiers[k])) &&
    Object.hasOwn(row, 'note') && (row.note == null || typeof row.note === 'string');
  const reason = userStatus.reason || catalogStatus.reason || (!structurallyValid ? 'SCHEMA_MISMATCH' :
    row.note != null ? 'UNSUPPORTED_EFFECT' : null);
  const gym = structurallyValid && STATS.includes(targetStat) ? {id, name:row.name,
    energyPerTrain:row.energy_cost, dots:row.modifiers[targetStat], class:row.class,
    note:row.note} : null;
  const freshness = !fresh(userStatus.freshness) || !fresh(catalogStatus.freshness) ? 'UNKNOWN' :
    userStatus.freshness === 'LIVE' && catalogStatus.freshness === 'LIVE' ? 'LIVE' : 'FRESH';
  const joined = { ...catalogStatus, sourceId:'/user/gym + /torn/gyms',
    freshness, observedAt: userStatus.observedAt && catalogStatus.observedAt ?
      [userStatus.observedAt, catalogStatus.observedAt] : null };
  return { userStatus, catalogStatus, gym, materialGymNote:!!gym && row.note != null,
    gymPredictionAvailable:!!gym && !reason, reason,
    field:gym ? field(gym,joined,'DERIVED',reason ? {reason} : {}) :
      unavailable(reason || 'DATA_MISSING',joined.sourceId) };
}

function effectScope(description) {
  const text = description.toLowerCase();
  if (/maximum.*booster.*cooldown|booster.*maximum.*cooldown/.test(text)) return 'boosterMaximum';
  if (/consumable.*cooldown|cooldown.*consumable/.test(text)) return 'consumableCooldown';
  if (/erotic\s*dvd|\bedvd\b/.test(text)) return 'eroticDvdEffect';
  if (/candy|diabetes/.test(text)) return 'candyEffect';
  if (/\bgym\b|\btraining\b/.test(text)) return 'gymGain';
  if (/\bdrug\b|xanax|ecstasy/.test(text)) return 'drugEffect';
  if (/\bbooster\b/.test(text)) return 'boosterEffect';
  if (/\bhappy\b|\benergy\b/.test(text)) return 'preparationEffect';
  return null;
}
function adaptPerks(payload, meta) {
  const status = sourceStatus('/user/perks', payload, meta);
  const complete = !status.reason && CATEGORIES.every(k => Array.isArray(payload[k]) &&
    payload[k].every(s => typeof s === 'string')) &&
    Object.entries(payload).every(([key,value])=>CATEGORIES.includes(key) ||
      Array.isArray(value) && value.length === 0);
  const gainPerksByTarget = Object.fromEntries(STATS.map(k => [k, []]));
  const effects = [], excluded = [], seen = new Set();
  if (complete) for (const category of CATEGORIES) for (const [index, description] of payload[category].entries()) {
    const statMatch = category === 'faction' &&
      /^\+\s*(\d+(?:\.\d+)?)%\s+(strength|speed|defense|dexterity) gym gains$/i.exec(description.trim());
    const allMatch = category === 'property' &&
      /^\+\s*(\d+(?:\.\d+)?)%\s+gym gains$/i.exec(description.trim());
    if (statMatch || allMatch) {
      const id = statMatch ? `faction:gym:${statMatch[2].toLowerCase()}` : 'property:gym:all';
      const rate = Number((statMatch || allMatch)[1]) / 100;
      if (Number.isFinite(rate) && rate >= 0 && !seen.has(id)) {
        seen.add(id);
        for (const stat of statMatch ? [statMatch[2].toLowerCase()] : STATS)
          gainPerksByTarget[stat].push({id,rate});
        effects.push({id:`${category}:${index}`,description,support:'SUPPORTED',
          targetStat:statMatch ? statMatch[2].toLowerCase() : 'all',
          affects:['gymGain'],representedByGainPerkId:id});
        continue;
      }
    }
    // Passive battle-stat and combat effects are never gym gain modifiers.
    if (/\bpassive\s+(strength|speed|defense|dexterity)\b/i.test(description) &&
        !/\bgym\b|\btraining\b/i.test(description)) { excluded.push(description); continue; }
    const scope = effectScope(description);
    if (scope) effects.push({id:`${category}:${index}`,description,support:'UNSUPPORTED',
      scope,affects:scope === 'gymGain' ? ['gymGain'] : [scope]});
    else excluded.push(description);
  }
  const reason = status.reason || (!complete ? 'SCHEMA_MISMATCH' : null);
  return {status, complete, reason, gainPerksByTarget, activeEffects:effects, excluded,
    field:complete ? field(effects,status) : unavailable(reason,status.sourceId) };
}

function adaptRefills(payload, meta, configuredMechanics = {}, currentPoints) {
  configuredMechanics = object(configuredMechanics) ? configuredMechanics : {};
  const status = sourceStatus('/user/refills', payload, meta);
  const valid = !status.reason && typeof payload?.energy === 'boolean' && whole(payload?.special_count);
  const configured = configuredMechanics.paidEnergyRefillPoints == null ? 30 :
    configuredMechanics.paidEnergyRefillPoints;
  const costValid = configured === 30; // Frozen 2026-09-26 configured mechanic.
  const reason = status.reason || (!valid ? 'SCHEMA_MISMATCH' : !costValid ? 'UNSUPPORTED_EFFECT' :
    payload.special_count > 0 ? 'SPECIAL_REFILL_PRECEDENCE' : null);
  const pointRefill = valid && costValid ? {allowed:!payload.energy && payload.special_count === 0,
    fillAmountPolicy:'natural_max',pointsRequired:30} : null;
  const pointStatus = sourceStatus(currentPoints?.sourceId || 'PLAYER_CONFIRMED_POINTS',
    currentPoints?.confirmedCurrent === true && whole(currentPoints.value) ? currentPoints : null,
    {sourceId:currentPoints?.sourceId, requestSucceeded:currentPoints?.confirmedCurrent === true,
      observedAt:currentPoints?.observedAt,freshness:currentPoints?.freshness},'PLAYER_CONFIRMATION');
  const pointsAvailable = !pointStatus.reason && pointStatus.freshness === 'LIVE' ?
    currentPoints.value : null;
  return { status, pointRefill, refillState:valid ? {paidEnergyUsed:payload.energy,
    specialCount:payload.special_count} : null,
    reason, pointsAvailable,
    field:pointRefill ? field(pointRefill,status,'DERIVED',
      {configuredCost:{value:30,provenance:'CONFIGURED',verifiedAt:'2026-09-26'},
        ...(reason ? {reason} : {})}) : unavailable(reason,status.sourceId),
    pointsField:pointsAvailable == null ? unavailable('DATA_MISSING',pointStatus.sourceId) :
      field(pointsAvailable,pointStatus,'CONFIGURED') };
}

function adaptInventory(sources = {}, metas = {}, confirmedInventory) {
  sources = object(sources) ? sources : {};
  metas = object(metas) ? metas : {};
  const inventory = {}, inventoryFreshnessByItem = {}, fields = {}, categories = {}, sourceStatuses = {};
  for (const [category,key] of Object.entries(INVENTORY_SOURCES)) {
    const input = sources[key], pages = Array.isArray(input) ? input : input ? [input] : [];
    const status = sourceStatus(`/user/inventory?cat=${category}`, input,
      metas[key], 'CATEGORY_1H');
    const rows = [];
    let complete = pages.length > 0 && !status.reason, timestamp = null, total = null;
    for (const [index,page] of pages.entries()) {
      const inner = page?.inventory;
      const links = page?._metadata?.links;
      if (!Array.isArray(inner?.items) || !whole(inner.timestamp) || !object(links) ||
          !Object.hasOwn(links,'next') || !Object.hasOwn(links,'prev') ||
          !whole(page._metadata.total) ||
          (index < pages.length-1 && !links.next) ||
          (index === pages.length-1 && links.next != null) ||
          (index && links.prev == null) ||
          (pages.length > 1 && (!page.pageId ||
            (index < pages.length-1 && links.next !== pages[index+1].pageId) ||
            (index > 0 && links.prev !== pages[index-1].pageId))) ||
          (total != null && total !== page?._metadata?.total) ||
          (timestamp != null && timestamp !== inner.timestamp) ||
          (metas[key]?.sourceTimestamp != null && metas[key].sourceTimestamp !== inner.timestamp)) complete = false;
      if (whole(inner?.timestamp)) timestamp = inner.timestamp;
      if (whole(page?._metadata?.total)) total = page._metadata.total;
      for (const item of Array.isArray(inner?.items) ? inner.items : []) {
        if (!whole(item?.id) || !whole(item.amount)) {complete = false; continue;}
        rows.push(item);
      }
    }
    if (pages.length && rows.length !== pages.at(-1)?._metadata?.total) complete = false;
    const known = {};
    for (const item of rows) if (ITEM_REGISTRY[item.id]?.type === category) {
      const keyName = ITEM_REGISTRY[item.id].key;
      known[keyName] = (known[keyName] || 0) + item.amount;
    }
    if (!status.reason && fresh(status.freshness)) Object.assign(inventory,known);
    if (complete && fresh(status.freshness)) for (const item of Object.values(ITEM_REGISTRY))
      if (item.type === category && !Object.hasOwn(inventory,item.key)) inventory[item.key] = 0;
    for (const item of Object.values(ITEM_REGISTRY))
      if (item.type === category && Object.hasOwn(inventory,item.key))
        inventoryFreshnessByItem[item.key] = status.freshness;
    const reason = status.reason || (!complete ? 'INCOMPLETE_PAGINATION' :
      !fresh(status.freshness) ? status.freshness === 'STALE' ? 'DATA_STALE' : 'DATA_MISSING' : null);
    categories[category] = { complete, reason, sourceTimestamp:timestamp,
      freshness:status.freshness, observedItemKeys:Object.keys(known) };
    sourceStatuses[key] = {...status,...(timestamp != null ? {sourceTimestamp:timestamp} : {})};
    fields[category] = complete ? field(known,status,'OBSERVED',
      {sourceTimestamp:timestamp,reason:reason || 'PLANNING_ONLY_CATEGORY_CACHE'}) :
      unavailable(reason,status.sourceId);
  }
  let inventoryFreshness = Object.values(categories).every(c=>c.complete && fresh(c.freshness)) ?
    'FRESH' : 'UNKNOWN';
  // Current player proof overrides cached quantities only for confirmed keys.
  // Partial confirmation must never promote unrelated inventory to LIVE.
  const observedAt=confirmedInventory?.observedAt;
  // Validate supplied inventory evidence only; no clock or age policy is used.
  const validObservedAt=typeof observedAt === 'string' &&
    /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(observedAt) &&
    Number.isFinite(Date.parse(observedAt)) &&
    new Date(`${observedAt.slice(0,10)}T00:00:00Z`).toISOString().slice(0,10) === observedAt.slice(0,10);
  const confirmationStatus = sourceStatus(confirmedInventory?.sourceId || 'PLAYER_CONFIRMED_INVENTORY',
    confirmedInventory?.confirmedCurrent === true && validObservedAt &&
      object(confirmedInventory.quantities) ? confirmedInventory : null,
    {sourceId:confirmedInventory?.sourceId,requestSucceeded:confirmedInventory?.confirmedCurrent === true,
      observedAt:confirmedInventory?.observedAt,freshness:confirmedInventory?.freshness},
    'PLAYER_CONFIRMATION');
  if (!confirmationStatus.reason && confirmationStatus.freshness === 'LIVE') {
    const quantities = {};
    for (const {key} of Object.values(ITEM_REGISTRY))
      if (Object.hasOwn(confirmedInventory.quantities,key) && whole(confirmedInventory.quantities[key])) {
        quantities[key] = inventory[key] = confirmedInventory.quantities[key];
        inventoryFreshnessByItem[key] = 'LIVE';
      }
    if (Object.keys(quantities).length)
      fields.confirmation=field(quantities,confirmationStatus,'CONFIGURED');
    if (confirmedInventory.complete === true &&
        Object.values(ITEM_REGISTRY).every(item => Object.hasOwn(quantities,item.key)))
      inventoryFreshness='LIVE';
  }
  return { inventory, inventoryFreshness, inventoryFreshnessByItem, categories, fields, sourceStatuses };
}

function projectItemMechanics(perks, dynamicState = {}) {
  dynamicState = object(dynamicState) ? dynamicState : {};
  const unsupported = [], itemMechanics = {};
  const effectEvidence = dynamicState.effectEvidence;
  const eventEvidence = dynamicState.eventEvidence;
  const effectsVerified = dynamicState.effectsComplete === true &&
    typeof effectEvidence?.sourceId === 'string' && effectEvidence.sourceId &&
    effectEvidence.observedAt != null && fresh(effectEvidence.freshness);
  const eventVerified = dynamicState.worldDiabetesDay === 'INACTIVE' &&
    typeof eventEvidence?.sourceId === 'string' && eventEvidence.sourceId &&
    eventEvidence.observedAt != null && fresh(eventEvidence.freshness) &&
    eventEvidence.verifiedInactive === true;
  const verified = perks.complete && fresh(perks.status.freshness) &&
    effectsVerified && Array.isArray(dynamicState.materialPreparationEffects);
  const effects = [...perks.activeEffects.filter(x=>x.support==='UNSUPPORTED'),
    ...(Array.isArray(dynamicState.materialPreparationEffects) ?
      dynamicState.materialPreparationEffects.map((effect,index)=>({
        id:`dynamic:${index}`, description:effect?.description,
        scope:['candyEffect','consumableCooldown','eroticDvdEffect','boosterMaximum',
          'drugEffect','boosterEffect'].includes(effect?.scope) ? effect.scope : 'preparationEffect',
        support:'UNSUPPORTED'})) : [])];
  const scopes = new Set(effects.map(e=>e.scope));
  const block = (key, reason) => unsupported.push({capability:key,reason});
  const all = !verified || ['preparationEffect'].some(s=>scopes.has(s));
  const drug = all || scopes.has('drugEffect');
  const booster = all || scopes.has('boosterMaximum') || scopes.has('boosterEffect') ||
    scopes.has('consumableCooldown');
  const candy = booster || scopes.has('candyEffect') || !eventVerified;
  const dvd = booster || scopes.has('eroticDvdEffect');
  if (!drug) {
    itemMechanics.xanax={energyGain:ITEM_REGISTRY[206].energyGain,
      happyGain:ITEM_REGISTRY[206].happyGain};
    itemMechanics.ecstasy={happyMultiplier:2};
  } else block('drugPreparation',verified ? 'UNSUPPORTED_EFFECT' : 'DATA_MISSING');
  if (!dvd) itemMechanics.eroticDvd={happy:2500,cooldownSeconds:21600};
  else block('eroticDvdPreparation',verified ? 'UNSUPPORTED_EFFECT' : 'DATA_MISSING');
  if (!candy) for (const mechanic of Object.values(ITEM_REGISTRY).filter(x=>x.type==='Candy'))
    itemMechanics[mechanic.key]={happy:mechanic.happyGain,cooldownSeconds:1800};
  else block('candyPreparation',verified ? 'UNSUPPORTED_EFFECT' : 'DATA_MISSING');
  const boosterMaxSeconds = verified && !scopes.has('boosterMaximum') ? 86400 : null;
  if (boosterMaxSeconds == null) block('boosterMaximum', verified ? 'UNSUPPORTED_EFFECT' : 'DATA_MISSING');
  return { itemMechanics, boosterMaxSeconds, activeEffects:effects,
    effectEvidence:effectsVerified ? effectEvidence : null,
    eventEvidence:eventVerified ? eventEvidence : null,
    boosterMaxField:boosterMaxSeconds == null ?
    unavailable(verified ? 'UNSUPPORTED_EFFECT' : 'DATA_MISSING','BASE_BOOSTER_MAX_V0_1') :
    field(86400,{...perks.status,sourceId:'BASE_BOOSTER_MAX_V0_1',cacheClass:'VERSIONED_MECHANIC'},'DERIVED'),
    unsupported,baseRegistry:ITEM_REGISTRY };
}

function adaptMarketSnapshot(input) {
  // Only a separately approved, typed market source can provide planner prices.
  if (!input || !Array.isArray(input.items) || !['LIVE','FRESH'].includes(input.freshness) ||
      !input.sourceId || input.observedAt == null) return {available:false,items:{},reason:'CAPABILITY_UNAVAILABLE'};
  const items = {};
  const duplicate = new Set();
  for (const row of input.items) {
    const id = row?.itemId != null ? ITEM_REGISTRY[row.itemId]?.key : row?.id;
    if (!Object.values(ITEM_REGISTRY).some(item=>item.key===id)) continue;
    if (Object.hasOwn(items,id)) {duplicate.add(id);items[id]={};continue;}
    if (duplicate.has(id)) continue;
    const price = {};
    if (row.newCashConcept === 'EXECUTABLE_NEW_CASH' && finite(row.newCashEach) &&
        whole(row.availableQuantity)) Object.assign(price,
      {newCashEach:row.newCashEach,availableQuantity:row.availableQuantity});
    if (row.replacementConcept === 'OWNED_REPLACEMENT_VALUE' && finite(row.replacementValueEach))
      price.replacementValueEach=row.replacementValueEach;
    items[id]=price;
  }
  return {available:Object.values(items).some(price=>Object.keys(price).length > 0),
    items,sourceId:input.sourceId,observedAt:input.observedAt,
    freshness:input.freshness};
}

function normalizeTrainingSources(input = {}) {
  let {sources = {},sourceMeta = {},manualInput = {},targetStat,
    dynamicState = {},confirmedInventory,currentPoints,configuredMechanics = {},
    marketInput,planningScope = {},timingInput} = object(input) ? input : {};
  sources = object(sources) ? sources : {};
  sourceMeta = object(sourceMeta) ? sourceMeta : {};
  dynamicState = object(dynamicState) ? dynamicState : {};
  const bars=adaptBars(sources.bars,sourceMeta.bars);
  const cooldowns=adaptCooldowns(sources.cooldowns,sourceMeta.cooldowns);
  const stats=adaptBattleStats(sources.battlestats,sourceMeta.battlestats,manualInput);
  const gym=adaptGym(sources.userGym,sources.tornGyms,targetStat,sourceMeta.userGym,sourceMeta.tornGyms);
  const perks=adaptPerks(sources.perks,sourceMeta.perks);
  const refills=adaptRefills(sources.refills,sourceMeta.refills,configuredMechanics,currentPoints);
  const stackCap=adaptEnergyStackCap(configuredMechanics);
  const inventory=adaptInventory(sources,sourceMeta,confirmedInventory);
  const mechanics=projectItemMechanics(perks,dynamicState);
  const marketSnapshot=adaptMarketSnapshot(marketInput);
  const fields={...bars.fields,...cooldowns.fields,stackCap:stackCap.field,stats:stats.field,gym:gym.field,
    gainModifiers:perks.field,pointRefill:refills.field,points:refills.pointsField,
    boosterMaxSeconds:mechanics.boosterMaxField,inventory:inventory.fields,
    effectState:mechanics.effectEvidence ? field(dynamicState.materialPreparationEffects,
      {...mechanics.effectEvidence,cacheClass:'APPROVED_EFFECT_STATE'},'OBSERVED') :
      unavailable('DATA_MISSING',dynamicState.effectEvidence?.sourceId),
    worldDiabetesDay:mechanics.eventEvidence ? field('INACTIVE',
      {...mechanics.eventEvidence,cacheClass:'APPROVED_EVENT_STATE'},'OBSERVED') :
      unavailable('UNSUPPORTED_EFFECT',dynamicState.eventEvidence?.sourceId)};
  const value=key=>fields[key]?.value ?? undefined;
  const observedState={targetStat,stats:fresh(stats.field.freshness) ? stats.stats || undefined : undefined,
    energy:value('energy'),naturalEnergyMax:value('naturalEnergyMax'),
    ...(stackCap.available ? {stackCap:value('stackCap')} : {}),
    naturalRegen:value('naturalRegen'),happy:value('happy'),ordinaryHappy:value('ordinaryHappy'),
    cooldowns:{drugSeconds:value('drugCooldown'),boosterSeconds:value('boosterCooldown'),
      boosterMaxSeconds:mechanics.boosterMaxSeconds ?? undefined},
    gym:gym.gym && fresh(gym.field.freshness) ? gym.gym : undefined,
    gainPerks:perks.complete && fresh(perks.status.freshness) ?
      perks.gainPerksByTarget[targetStat] || [] : undefined,
    activeEffects:[...perks.activeEffects.filter(x=>x.support!=='SUPPORTED' ||
      x.targetStat==='all' || x.targetStat===targetStat),...(gym.materialGymNote ?
      [{id:'gym:note',description:gym.gym.note,support:'UNSUPPORTED',scope:'gymGain',affects:['gymGain']}] : []),
      ...(!perks.complete || !fresh(perks.status.freshness) ? [{id:'gain:unknown',
        support:'UNSUPPORTED',scope:'gymGain',affects:['gymGain']}] : [])],
    inventory:inventory.inventory,inventoryFreshness:inventory.inventoryFreshness,
    inventoryFreshnessByItem:inventory.inventoryFreshnessByItem,
    pointRefill:fresh(refills.status.freshness) ? refills.pointRefill || undefined : undefined,
    pointsAvailable:refills.pointsAvailable ?? undefined,
    ...(stackCap.available && mechanics.itemMechanics.xanax ?
      {xanax:{energyGain:mechanics.itemMechanics.xanax.energyGain}} : {}),
    calibratedDomain:false,
    freshness:{energy:fields.energy.freshness,happy:fields.happy.freshness,
      drugCooldown:fields.drugCooldown.freshness,boosterCooldown:fields.boosterCooldown.freshness,
      gym:fields.gym.freshness,gainModifiers:fields.gainModifiers.freshness,
      inventory:inventory.inventoryFreshness,pointRefill:fields.pointRefill.freshness,
      points:fields.points.freshness}};
  // A caller must first freeze a fully calibration-locked candidate set. The
  // generic 001D adapter cannot infer that proof from initial gym/stat values.
  const capabilities={bars:finite(observedState.energy) && finite(observedState.happy),
    automaticStats:stats.automaticStatsAvailable,manualStats:stats.manualStatsAccepted,
    gymPrediction:gym.gymPredictionAvailable && fresh(gym.field.freshness),
    gainPrediction:gym.gymPredictionAvailable && fresh(gym.field.freshness) &&
      perks.complete && fresh(perks.status.freshness) &&
      !perks.activeEffects.some(x=>x.support==='UNSUPPORTED' && x.affects.includes('gymGain')) &&
      !!observedState.stats && finite(observedState.happy),
    inventoryPlanning:Object.values(inventory.categories).some(c=>c.complete && fresh(c.freshness)),
    inventoryExecution:inventory.inventoryFreshness==='LIVE',
    marketComparison:marketSnapshot.available,
    paidRefillPlanning:fresh(refills.status.freshness) && refills.pointRefill?.allowed === true,
    paidRefillExecution:refills.pointRefill?.allowed === true && refills.status.freshness==='LIVE' &&
      refills.pointsAvailable != null && refills.pointsField.freshness==='LIVE' &&
      refills.pointsAvailable>=30,
    candyPreparation:!!mechanics.itemMechanics.candy37,
    eroticDvdPreparation:!!mechanics.itemMechanics.eroticDvd,
    drugPreparation:!!mechanics.itemMechanics.ecstasy,
    xanaxPreparation:!!observedState.xanax,
    calibratedDomain:false};
  const timing = timingInput?.confirmedCurrent === true &&
    timingInput.freshness === 'LIVE' && timingInput.observedAt != null &&
    timingInput.sourceId && typeof timingInput.safeQuarterWindow === 'boolean' ?
      {safeQuarterWindow:timingInput.safeQuarterWindow} : {};
  return {observedState,itemMechanics:mechanics.itemMechanics,marketSnapshot,timing,
    fields,capabilities,inventory:inventory.categories,refillState:refills.refillState,
    unsupported:[...mechanics.unsupported,...mechanics.activeEffects.filter(x=>x.support==='UNSUPPORTED'),
      ...(!observedState.xanax ? [{capability:'xanaxPreparation',reason:stackCap.available ?
        mechanics.unsupported.find(x=>x.capability==='drugPreparation')?.reason || 'UNSUPPORTED_EFFECT' :
        stackCap.field.reason}] : []),
      ...(gym.materialGymNote ? [{capability:'gymPrediction',reason:'UNSUPPORTED_EFFECT',
        description:gym.gym.note}] : [])],
    sourceStatus:{bars:bars.status,cooldowns:cooldowns.status,battlestats:stats.status,
      userGym:gym.userStatus,tornGyms:gym.catalogStatus,perks:perks.status,
      refills:refills.status,...inventory.sourceStatuses},
    planningScope:{...planningScope,calibratedDomain:false}};
}

module.exports = { ITEM_REGISTRY, ENERGY_STACK_CAP_MECHANIC, adaptEnergyStackCap,
  adaptBars, adaptCooldowns, adaptBattleStats,
  adaptGym, adaptPerks, adaptRefills, adaptInventory, projectItemMechanics,
  adaptMarketSnapshot, normalizeTrainingSources };

    },
    "./training-advisor-runtime.js": function(module, exports, require) {
'use strict';

// Acquisition and session control only. Calculation and normalization stay canonical.
const planner = require('./training-advisor-pure.js');
const adapters = require('./training-advisor-adapters.js');
const VERSION = '0.1.0';
const PREFS_KEY = 'tornscripture-training-settings-v1';
const API_KEY = 'tornscripture-training-api-key-v1';
const SOURCES = Object.freeze({bars:'/user/bars', cooldowns:'/user/cooldowns',
  battlestats:'/user/battlestats', userGym:'/user/gym', tornGyms:'/torn/gyms',
  perks:'/user/perks', refills:'/user/refills', money:'/user/money',
  drugInventory:'/user/inventory?cat=Drug', boosterInventory:'/user/inventory?cat=Booster',
  candyInventory:'/user/inventory?cat=Candy'});
const DEFAULTS = Object.freeze({objective:'BALANCED', targetStat:'strength',
  statAllocationMode:'TARGET_STAT', allowItems:true, allowRefill:false,
  maxWaitSeconds:0, riskPolicy:'ALLOW_SUPPORTED', pointLimit:30,
  prohibitedItems:[], ownedItemsOnly:true, mode:'beginner', theme:'Auto',
  collapsed:false, position:{x:12,y:100}});
const OBJECTIVES = Object.freeze({Balanced:'BALANCED', 'Biggest Gain':'MAXIMUM_GAIN',
  'Best Value':'BEST_VALUE', 'Stay Under Budget':'BUDGET_CAP',
  'Use What I Own':'USE_MY_INVENTORY', 'Train Soonest':'FASTEST_USEFUL'});
const clone = value => JSON.parse(JSON.stringify(value));
const validKey = value => typeof value === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(value.trim());
function preferences(input = {}) {
  const out = clone(DEFAULTS);
  if (!input || typeof input !== 'object') return out;
  if (Object.values(OBJECTIVES).includes(input.objective)) out.objective=input.objective;
  if (['strength','speed','defense','dexterity'].includes(input.targetStat)) out.targetStat=input.targetStat;
  for (const key of ['allowItems','allowRefill','ownedItemsOnly','collapsed'])
    if (typeof input[key] === 'boolean') out[key]=input[key];
  for (const key of ['budgetNewCash','pointValue','pointLimit','maxWaitSeconds'])
    if (typeof input[key] === 'number' && Number.isFinite(input[key]) && input[key]>=0) out[key]=input[key];
  if (['CALIBRATED_ONLY','ALLOW_SUPPORTED','ALLOW_EXPERIMENTAL'].includes(input.riskPolicy)) out.riskPolicy=input.riskPolicy;
  if (['beginner','advanced'].includes(input.mode)) out.mode=input.mode;
  if (['Auto','Dark','Light'].includes(input.theme)) out.theme=input.theme;
  if (Array.isArray(input.prohibitedItems)) out.prohibitedItems=[...new Set(input.prohibitedItems
    .filter(key=>Object.values(adapters.ITEM_REGISTRY).some(item=>item.key===key)))];
  if (Number.isFinite(input.position?.x) && Number.isFinite(input.position?.y)) out.position={x:input.position.x,y:input.position.y};
  return out;
}
function loadPreferences(storage) {
  try { return preferences(JSON.parse(storage.getItem(PREFS_KEY) || 'null')); }
  catch { return preferences(); }
}
function resolveKey(managed, storage) {
  if (validKey(managed)) return managed.trim();
  try { const value=storage.getItem(API_KEY); return validKey(value) ? value.trim() : ''; }
  catch { return ''; }
}
// Do not follow an API-supplied URL blindly: neither keys nor redirects may leave Torn.
function requestUrl(source, pageLink) {
  if (!Object.values(SOURCES).includes(source)) throw new Error('UNAPPROVED_SOURCE');
  const expected=new URL('https://api.torn.com/v2'+source);
  const url=pageLink ? new URL(pageLink,expected) : expected;
  if (url.origin!==expected.origin || url.pathname!==expected.pathname || url.username || url.password ||
      url.hash || url.searchParams.get('cat')!==expected.searchParams.get('cat')) throw new Error('UNAPPROVED_PAGE');
  for (const key of url.searchParams.keys()) if (!['cat','offset','limit','comment'].includes(key))
    throw new Error('UNAPPROVED_PAGE');
  url.searchParams.set('comment','TornScripture Training Advisor');
  if (source.includes('/inventory')) { if (!url.searchParams.has('limit')) url.searchParams.set('limit','100'); }
  return url;
}
function pageIdentity(link, source) {
  const url=requestUrl(source,link);
  url.searchParams.delete('comment');
  url.searchParams.sort();
  return url.href;
}
function unwrap(key,payload) {
  if (key==='cooldowns') return payload.cooldowns ?? payload;
  if (key==='perks') return payload.perks ?? payload;
  if (key==='refills') return payload.refills ?? payload;
  if (key==='battlestats') return payload.battlestats ?? payload;
  if (key==='tornGyms') return payload.gyms ?? payload;
  return payload;
}
function countdown(seconds, observedAt, now) {
  if (!Number.isFinite(seconds) || !Number.isFinite(Date.parse(observedAt))) return 'Unknown; refresh';
  const remaining=Math.max(0,Math.ceil(seconds-(now-Date.parse(observedAt))/1000));
  return remaining ? `${remaining}s observed wait; refresh at checkpoint` : 'Refresh now; countdown is not current proof';
}
function createAdvisor({fetch:fetcher, storage, managedKey='', now=()=>Date.now(),
  setTimer=setTimeout, clearTimer=clearTimeout} = {}) {
  let prefs=loadPreferences(storage), epoch=0, inFlight=null, invalidation=0, keyRevision=0, disposed=false;
  let raw={}, meta={}, normalized=null, recommendation=null, phase='NEEDS_REFRESH', startedAt=null, completedAt=null;
  let inventoryConfirmation, manualInput, effectState, pointsConfirmation;
  const cache=new Map(), subscribers=new Set(), pendingRequests=new Map();
  const iso=()=>new Date(now()).toISOString();
  // Current proof belongs to the observation epoch, until an explicit state transition.
  const current=()=>!disposed && phase==='CURRENT' && completedAt!=null;
  function snapshot() {
    const value={version:VERSION, epoch, phase, startedAt, completedAt, atomic:false,
      preferences:prefs, normalized, recommendation, acquisition:meta,
      connection:resolveKey(managedKey,storage) ? validKey(managedKey) ? 'TornPDA managed key' : 'Local browser key' : 'Not connected'};
    const key=resolveKey(managedKey,storage);
    const serialized=JSON.stringify(value);
    return JSON.parse(key ? serialized.split(key).join('[REDACTED]') : serialized);
  }
  const notify=()=>{for (const listener of subscribers) listener(snapshot());};
  function replan() {
    normalized=adapters.normalizeTrainingSources({sources:raw,sourceMeta:meta,
      targetStat:prefs.targetStat, manualInput, dynamicState:effectState,
      confirmedInventory:inventoryConfirmation,currentPoints:pointsConfirmation});
    // A rejected/incomplete cache is a meaningful reason to reacquire on the next manual refresh.
    if (normalized.fields.gym.reason==='SCHEMA_MISMATCH') cache.delete('tornGyms');
    for (const [name,category] of [['drugInventory','Drug'],['boosterInventory','Booster'],['candyInventory','Candy']])
      if (!normalized.inventory[category].complete) cache.delete(name);
    // H1/H2 are intentionally absent. A local clock or a calendar candidate is not proof.
    recommendation=planner.recommend({...normalized,preferences:{...prefs,maxWaitHours:prefs.maxWaitSeconds/3600}});
    notify(); return snapshot();
  }
  function invalidate() {
    invalidation++; inventoryConfirmation=manualInput=effectState=pointsConfirmation=undefined;
    for (const [key,value] of Object.entries(meta)) if (!key.endsWith('Inventory') && key!=='tornGyms')
      value.freshness=value.requestSucceeded ? 'STALE' : 'UNKNOWN';
    phase=inFlight ? 'REFRESHING' : 'NEEDS_REFRESH';
    return replan();
  }
  function requireCurrent() {
    if (!current()) {invalidate(); throw new Error('Refresh & Plan before current confirmation');}
  }
  async function request(source,key,pageLink) {
    const controller=new AbortController();
    const timeout=setTimer(()=>controller.abort(),15_000);
    pendingRequests.set(controller,timeout);
    try {
      const response=await fetcher(requestUrl(source,pageLink).href,{method:'GET',
        headers:{Accept:'application/json',Authorization:`ApiKey ${key}`},
        credentials:'omit',cache:'no-store',redirect:'error',signal:controller.signal});
      const payload=await response.json();
      if (!response.ok || payload?.error) {
        // Never retain server/free-text errors, which can echo credentials or request URLs.
        const code=Number(payload?.error?.code);
        const denied=response.status===401 || response.status===403 || [2,16].includes(code);
        throw new Error(denied ? 'CAPABILITY_UNAVAILABLE' : 'DATA_MISSING');
      }
      return payload;
    } finally {clearTimer(timeout);pendingRequests.delete(controller);}
  }
  async function acquire(name,key,revision) {
    const source=SOURCES[name], cached=cache.get(name), age=cached ? now()-cached.fetchedAt : Infinity;
    const ttl=name.endsWith('Inventory') ? 3600_000 : name==='tornGyms' ? 3600_000 : 0;
    if (ttl && cached?.revision===revision && age>=0 && age<ttl) return clone(cached.result);
    let result;
    try {
      let payload=await request(source,key), value=unwrap(name,payload);
      const observedAt=iso();
      if (name.endsWith('Inventory')) {
        const pages=[], seen=new Set();
        let link=null;
        for (let count=0;count<20;count++) {
          const id=pageIdentity(link || requestUrl(source).href,source);
          if (seen.has(id)) throw new Error('DATA_MISSING');
          seen.add(id);
          const links=payload?._metadata?.links;
          pages.push({...payload,pageId:id,_metadata:{...payload._metadata,
            ...(links ? {links:{prev:links.prev==null ? null : pageIdentity(links.prev,source),
              next:links.next==null ? null : pageIdentity(links.next,source)}} : {})}});
          if (!links?.next) break;
          link=links.next;
          if (count===19) throw new Error('DATA_MISSING');
          payload=await request(source,key,link);
        }
        value=pages;
      }
      result={value,meta:{sourceId:source,requestedSelection:source,requestSucceeded:true,
        observedAt,freshness:ttl ? 'FRESH' : 'LIVE',
        ...(name.endsWith('Inventory') && value[0]?.inventory?.timestamp!=null ?
          {sourceTimestamp:value[0].inventory.timestamp} : {})}};
      if (ttl && revision===keyRevision && !disposed) cache.set(name,{revision,fetchedAt:now(),result:clone(result)});
    } catch (error) {
      const permissionFailure=error?.message==='CAPABILITY_UNAVAILABLE';
      result={value:permissionFailure ? {status:'PERMISSION_DENIED'} : null,
        meta:{sourceId:source,requestedSelection:source,requestSucceeded:false,
          observedAt:iso(),freshness:'UNKNOWN',permissionFailure}};
    }
    return result;
  }
  function refresh() {
    if (disposed) return Promise.reject(new Error('Advisor disposed'));
    if (inFlight) return inFlight;
    epoch++; invalidation++;
    inventoryConfirmation=manualInput=effectState=pointsConfirmation=undefined;
    raw={}; meta={}; normalized=recommendation=null;
    phase='REFRESHING'; startedAt=iso(); completedAt=null;
    const token=invalidation, key=resolveKey(managedKey,storage), revision=keyRevision;
    // Defer work one microtask so concurrent callers share the same promise.
    inFlight=Promise.resolve().then(async()=>{
      await Promise.all(Object.entries(SOURCES).map(async([name,source])=>{
        const result=key ? await acquire(name,key,revision) : {value:{status:'PERMISSION_DENIED'},
          meta:{sourceId:source,requestedSelection:source,requestSucceeded:false,permissionFailure:true,
            observedAt:iso(),freshness:'UNKNOWN'}};
        if (!disposed) {raw[name]=result.value; meta[name]=result.meta;}
      }));
      if (disposed) return snapshot();
      completedAt=iso(); phase=token===invalidation ? 'CURRENT' : 'NEEDS_REFRESH';
      const points=raw.money?.money?.points;
      if (phase==='CURRENT' && meta.money.requestSucceeded && Number.isSafeInteger(points) && points>=0)
        pointsConfirmation={sourceId:SOURCES.money,confirmedCurrent:true,observedAt:meta.money.observedAt,
          freshness:'LIVE',value:points};
      if (phase!=='CURRENT') for (const [name,value] of Object.entries(meta))
        if (!name.endsWith('Inventory') && name!=='tornGyms' && value.requestSucceeded) value.freshness='STALE';
      replan();
      return snapshot();
    }).finally(()=>{inFlight=null;notify();});
    notify(); return inFlight;
  }
  return Object.freeze({refresh, invalidate, snapshot,
    subscribe(listener) {if (!disposed) subscribers.add(listener);return ()=>subscribers.delete(listener);},
    setPreferences(input) {
      const before=JSON.stringify(Object.fromEntries(Object.entries(prefs).filter(([key])=>
        !['mode','theme','position','collapsed'].includes(key))));
      prefs=preferences({...prefs,...input});
      try {storage.setItem(PREFS_KEY,JSON.stringify(prefs));} catch { /* memory-only still works */ }
      const after=JSON.stringify(Object.fromEntries(Object.entries(prefs).filter(([key])=>
        !['mode','theme','position','collapsed'].includes(key))));
      if (normalized && before!==after) {if (!current() && phase!=='REFRESHING') invalidate();else replan();} else notify();
      return snapshot();
    },
    setKey(value) {
      if (value && !validKey(value)) throw new Error('Enter a valid local key');
      if (value) storage.setItem(API_KEY,value.trim());else storage.removeItem(API_KEY);
      keyRevision++;cache.clear(); return invalidate();
    },
    confirmInventory(quantities) {
      requireCurrent();
      const required=recommendation?.primaryPlan?.resources?.ownedItemsConsumed || {};
      const accepted={};
      for (const [key,value] of Object.entries(quantities || {})) if (required[key]>0 &&
        Number.isSafeInteger(value) && value>=0) accepted[key]=value;
      // An explicit confirmation event replaces prior confirmation; cached quantities are never copied.
      inventoryConfirmation={sourceId:'PLAYER_CONFIRMED_INVENTORY',confirmedCurrent:true,
        observedAt:iso(),freshness:'LIVE',quantities:accepted};
      return replan();
    },
    confirmStats(stats) {
      requireCurrent(); manualInput={stats:clone(stats),confirmed:true,observedAt:iso(),freshness:'LIVE'};
      return replan();
    },
    confirmEffects(noOtherMaterialEffects) {
      requireCurrent(); effectState=noOtherMaterialEffects===true ? {effectsComplete:true,
        materialPreparationEffects:[],effectEvidence:{sourceId:'PLAYER_CONFIRMED_EFFECT_STATE',
          observedAt:iso(),freshness:'LIVE'}} : undefined;
      return replan();
    },
    confirmPoints(value) {
      requireCurrent(); pointsConfirmation={sourceId:'PLAYER_CONFIRMED_POINTS',confirmedCurrent:true,
        observedAt:iso(),freshness:'LIVE',value};return replan();
    },
    dispose() {
      disposed=true;invalidation++;phase='NEEDS_REFRESH';
      inventoryConfirmation=manualInput=effectState=pointsConfirmation=undefined;
      raw={};meta={};normalized=recommendation=null;cache.clear();
      for (const [controller,timeout] of pendingRequests) {clearTimer(timeout);controller.abort();}
      subscribers.clear();
    }
  });
}
module.exports={VERSION,PREFS_KEY,API_KEY,SOURCES,DEFAULTS,OBJECTIVES,preferences,
  loadPreferences,resolveKey,requestUrl,countdown,createAdvisor};

    },
    "./training-advisor-ui.js": function(module, exports, require) {
'use strict';
const runtime=require('./training-advisor-runtime.js');
const ROOT_ID='tornscripture-training-advisor';
const STYLE_ID='tornscripture-training-style';
const LABELS={READY:'Ready now',WAITING:'Waiting for a checkpoint',NEEDS_ITEMS:'Needs items',
  NEEDS_REFRESH:'Needs current proof',BLOCKED:'Blocked'};
const REASONS={DATA_STALE:'Refresh the relevant observation or confirm required items now.',
  DATA_MISSING:'Provide the missing current input, then refresh.',
  CAPABILITY_UNAVAILABLE:'This source is unavailable with the current API key.',
  RESOURCE_MISSING:'Obtain and verify the selected plan requirements.',
  COOLDOWN_BLOCKED:'Wait for the observed checkpoint, then Refresh & Plan.',
  TIMING_UNSAFE:'Happy reset timing is not safe for this step.',
  STATE_CHANGED:'Player state changed. Refresh & Plan before continuing.',
  MODEL_OUT_OF_DOMAIN:'This plan exceeds the supported 50m model domain.',
  UNSUPPORTED_EFFECT:'A material gym, modifier, or item effect is unsupported.',
  ECONOMICS_UNAVAILABLE:'Cost comparison is unavailable. Try Biggest Gain for supported gain planning.',
  NO_SAFE_RECOMMENDATION:'A safe recommendation needs more supported state.',
  BOOSTER_LIMIT_REACHED:'Wait for booster capacity, then refresh.',
  SCHEMA_MISMATCH:'The source shape is unsupported; dependent prediction is withheld.'};
const escape=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const approximate=value=>Number.isFinite(value) ? new Intl.NumberFormat('en-US',{maximumSignificantDigits:3}).format(value) : 'Unavailable';
const itemName=id=>({xanax:'Xanax',ecstasy:'Ecstasy',eroticDvd:'eDVD'}[id] || id);
function instruction(action) {
  if (!action) return 'Refresh & Plan';
  switch (action.action) {
    case 'TAKE_XANAX':return 'Take 1 Xanax manually in Torn. Refresh after taking it.';
    case 'TAKE_ECSTASY':return 'Take 1 Ecstasy manually in Torn. Refresh after taking it.';
    case 'USE_BOOSTER':return `Use ${action.quantity} ${itemName(action.item)} manually in Torn. Refresh after each use.`;
    case 'TRAIN':return `Train ${action.targetStat} manually in Torn (${action.energySpent}E). Refresh after training.`;
    case 'USE_REFILL':return 'Use the Energy refill manually in Torn. Refresh after using it.';
    case 'WAIT':return `${Number.isFinite(action.seconds) ? `Wait approximately ${approximate(action.seconds/60)} min` : 'Wait for the checkpoint'}, then Refresh & Plan.`;
    case 'VERIFY_STATE':return 'Checkpoint: Refresh & Plan to observe reality and replan.';
    default:return 'Refresh & Plan before continuing.';
  }
}
function planName(plan) {
  if (!plan) return 'No selected plan';
  const types=new Set(plan.actions?.map(a=>a.action));
  return [types.has('TAKE_XANAX') ? 'Xanax checkpoint' : types.has('USE_BOOSTER') ? 'Happy preparation' :
    types.has('TAKE_ECSTASY') ? 'Ecstasy preparation' : types.has('WAIT') ? 'Observed wait' : 'Train now',
    ...(types.has('USE_REFILL') ? ['Energy refill'] : [])].join(' + ');
}
function ownedRequirements(plan) {
  return Object.entries(plan?.resources?.ownedItemsConsumed || {}).filter(([,n])=>n>0)
    .map(([key,quantity])=>({key,name:itemName(key),quantity}));
}
function beginnerAlternatives(rec) {
  const selected=rec?.primaryPlan;
  const unique=new Map();
  for (const plan of rec?.alternatives || []) if (plan.id!==selected?.id && !unique.has(plan.id)) unique.set(plan.id,plan);
  return [...unique.values()].slice(0,3).map(plan=>({id:plan.id,name:planName(plan),
    gainDelta:Number.isFinite(plan.simulation?.modeledGain) && Number.isFinite(selected?.simulation?.modeledGain) ?
      plan.simulation.modeledGain-selected.simulation.modeledGain : null,
    cashDelta:Number.isFinite(plan.economics?.newCashRequired) && Number.isFinite(selected?.economics?.newCashRequired) ?
      plan.economics.newCashRequired-selected.economics.newCashRequired : null,
    waitDelta:Number.isFinite(plan.timing?.waitSeconds) && Number.isFinite(selected?.timing?.waitSeconds) ?
      plan.timing.waitSeconds-selected.timing.waitSeconds : null}));
}
function buildView(snapshot) {
  const rec=snapshot.recommendation, plan=rec?.primaryPlan, n=snapshot.normalized;
  const readiness=plan?.readiness?.status || 'NEEDS_REFRESH';
  const reason=plan?.readiness ? plan.readiness.reason ?? null : rec?.reason || 'DATA_MISSING';
  const invalidEpoch=snapshot.phase==='NEEDS_REFRESH' || snapshot.phase==='REFRESHING';
  let next=invalidEpoch ? 'Refresh & Plan before continuing.' : readiness==='READY' ?
    instruction(plan.actions.find(a=>a.action!=='VERIFY_STATE')) : plan?.readiness?.nextAction ||
    REASONS[reason] || 'Refresh & Plan or provide supported state.';
  if (!invalidEpoch && rec?.status==='NO_SAFE_RECOMMENDATION') {
    if (n?.fields.stats?.value==null) next='Enter all four current raw battle stats, or refresh /user/battlestats.';
    else if (n?.fields.gym?.value==null || n?.fields.gym?.reason) next='Refresh /user/gym and /torn/gyms; supported gym evidence is required.';
    else if (n?.fields.gainModifiers?.reason) next='Refresh /user/perks; material modifier evidence is unavailable.';
  }
  return {status:rec?.status || 'NO_SAFE_RECOMMENDATION',readiness:invalidEpoch ? 'NEEDS_REFRESH' : readiness,
    readinessLabel:LABELS[invalidEpoch ? 'NEEDS_REFRESH' : readiness], reason,
    confidence:plan?.confidence?.level || 'Unavailable', planName:planName(plan), identity:plan?.id || null,
    target:plan?.target?.stat || snapshot.preferences.targetStat,
    objective:rec?.objective || snapshot.preferences.objective,next,
    gain:plan?.simulation?.modeledGain ?? null, gainInterval:plan?.simulation?.gainInterval ?? null,
    economicsAvailable:n?.capabilities?.marketComparison===true,
    economics:plan?.economics || null, owned:ownedRequirements(plan),
    bought:Object.entries(plan?.resources?.boughtItems || {}).filter(([,n])=>n>0)
      .map(([key,quantity])=>({key,name:itemName(key),quantity})),
    sequence:plan?.actions?.map(instruction) || [],alternatives:beginnerAlternatives(rec),
    why:rec?.explanation?.join('; ') || REASONS[reason] || reason,
    known:n ? {Energy:n.observedState.energy,Happy:n.observedState.happy,
      Stats:n.observedState.stats ? 'Available' : 'Missing',Gym:n.observedState.gym?.name} : {},
    missing:n ? Object.entries(n.fields).filter(([,f])=>f && Object.hasOwn(f,'value') && f.value==null)
      .map(([field,value])=>({field,reason:value.reason})) : [{field:'Current observation',reason:'DATA_MISSING'}],
    sources:n?.sourceStatus || {},
    advanced:{Plan:plan,State:n?.observedState,Sources:{fields:n?.fields,sources:n?.sourceStatus,
      acquisition:snapshot.acquisition,epoch:snapshot.epoch,startedAt:snapshot.startedAt,
      completedAt:snapshot.completedAt,atomic:snapshot.atomic},Economics:plan?.economics,
      Alternatives:rec?.alternatives,Model:{id:plan?.explanation?.modelId || 'vladar-v2-pre50m-v1',
        confidence:plan?.confidence,calibratedDomain:n?.capabilities?.calibratedDomain,
        gainInterval:plan?.simulation?.gainInterval || null,assumption:plan?.simulation?.assumption},
      'Rejected / Diagnostics':{reason,capabilities:n?.capabilities,unsupported:n?.unsupported,rejected:rec?.rejectedPlans}},
    gates:['H1 open: Happy reset timing is unproven; elevated-Happy/Ecstasy execution needs approved timing proof.',
      'H2 open: personalized Candy event state is unproven; event-dependent Candy mechanics are withheld.']};
}
const options=(values,current)=>values.map(([label,value])=>`<option value="${escape(value)}"${value===current?' selected':''}>${escape(label)}</option>`).join('');
const button=(action,label)=>`<button type="button" data-action="${action}">${escape(label)}</button>`;
function fullHtml(snapshot,view) {
  const prefs=snapshot.preferences;
  const objective=options(Object.entries(runtime.OBJECTIVES),prefs.objective);
  const stat=options(['strength','speed','defense','dexterity'].map(s=>[s,s]),prefs.targetStat);
  const resource=list=>list.length ? list.map(x=>`${escape(x.name)} ×${x.quantity}`).join(' · ') : 'None';
  const noSafe=view.status==='NO_SAFE_RECOMMENDATION' ? `<section><h3>No safe recommendation</h3>
    <p>${escape(REASONS[view.reason] || view.reason)}</p><p>Known: ${escape(Object.entries(view.known)
      .filter(([,v])=>v!=null).map(([k,v])=>`${k}: ${v}`).join(' · ') || 'No current observation')}</p>
    <p>Missing or unsupported: ${escape(view.missing.map(x=>x.field).join(', ') || view.reason)}</p>
    <p>${escape(view.next)}</p></section>` : '';
  const summary=`<section><h3>${escape(view.planName)}</h3><p class="ta-ready">${escape(view.readinessLabel)}</p>
    <p>Confidence: ${escape(view.confidence)}</p><p class="ta-next"><strong>NEXT</strong> ${escape(view.next)}</p>
    <p>${escape(REASONS[view.reason] || (view.reason==='DATA_MISSING' ? '' : view.reason) || '')}</p>
    <p>Approximate expected gain: ${approximate(view.gain)} · Target: ${escape(view.target)}</p>
    <p>Owned use: ${resource(view.owned)}<br>To acquire: ${resource(view.bought)}</p>
    <p>${view.economicsAvailable ? `New cash: ${approximate(view.economics?.newCashRequired)} · Replacement value: ${approximate(view.economics?.marketValueOfOwnedItemsConsumed)}` : 'Cost comparison unavailable; no market prices supplied.'}
    · Points: ${approximate(view.economics?.pointsConsumed)}</p>
    <p>Supported wait: ${view.advanced.Plan ? approximate(view.advanced.Plan.timing.waitSeconds/60)+' min' : 'Unavailable'}
    · Active time: not modeled</p><p>${escape(view.why)}</p>
    ${view.sequence.length ? `<ol>${view.sequence.map(text=>`<li>${escape(text)}</li>`).join('')}</ol>` : ''}
    ${button('checkpoint','State changed / checkpoint reached')}
    <p>After each manual player action: checkpoint → Refresh & Plan → observe → replan.</p></section>`;
  const confirmation=view.owned.length ? `<form data-form="inventory"><h3>Confirm current owned quantities</h3>
    <p>Enter what you actually own now. Zero and lower values override cached planning quantities.</p>
    ${view.owned.map(x=>`<label>${escape(x.name)} (plan needs ${x.quantity})<input name="${escape(x.key)}" type="number" min="0" step="1" required inputmode="numeric" placeholder="Current quantity"></label>`).join('')}
    <button type="submit">Confirm these current quantities & replan</button><p>Only these item keys gain current proof. Purchases stay separate.</p></form>` : '';
  const alternatives=view.alternatives.length ? `<section><h3>Alternatives</h3>${view.alternatives.map(a=>
    `<p>${escape(a.name)}: gain ${approximate(a.gainDelta)} difference · new cash ${approximate(a.cashDelta)} difference · wait ${approximate(a.waitDelta==null?null:a.waitDelta/60)} min difference</p>`).join('')}</section>` : '';
  const confirmed=snapshot.normalized?.fields.inventory.confirmation;
  const confirmationSummary=confirmed ? `<p>Current confirmed inventory: ${escape(Object.entries(confirmed.value)
    .map(([key,value])=>`${itemName(key)} ×${value}`).join(' · '))}. Item-local ${escape(confirmed.freshness)} proof at ${escape(confirmed.observedAt)}.</p>` : '';
  const advanced=prefs.mode==='advanced' ? Object.entries(view.advanced).map(([name,value])=>
    `<details><summary>${escape(name)}</summary><pre>${escape(JSON.stringify(value ?? null,null,2))}</pre></details>`).join('') : '';
  return `<header><strong>Training Advisor v${runtime.VERSION}</strong>${button('close','Close')}</header>
    <div class="ta-body"><form data-form="preferences"><label>Objective<select name="objective">${objective}</select></label>
    <label>Target stat<select name="targetStat">${stat}</select></label>
    <label>New cash budget (optional)<input name="budgetNewCash" type="number" min="0" value="${prefs.budgetNewCash ?? ''}"></label>
    <label>Max wait, minutes<input name="maxWaitMinutes" type="number" min="0" value="${prefs.maxWaitSeconds/60}"></label>
    <label><input name="allowItems" type="checkbox"${prefs.allowItems?' checked':''}> Consider owned preparation items</label>
    <fieldset><legend>Do not use</legend>${['xanax','eroticDvd','ecstasy'].map(key=>
      `<label><input name="prohibited_${key}" type="checkbox"${prefs.prohibitedItems.includes(key)?' checked':''}> ${itemName(key)}</label>`).join('')}</fieldset>
    <label><input name="allowRefill" type="checkbox"${prefs.allowRefill?' checked':''}> Consider paid Energy refill (needs current Points)</label>
    <label>Points cash value (optional)<input name="pointValue" type="number" min="0" value="${prefs.pointValue ?? ''}"></label>
    <label>Risk policy<select name="riskPolicy">${options([['Supported model','ALLOW_SUPPORTED'],['Calibrated domain only','CALIBRATED_ONLY'],['Allow experimental','ALLOW_EXPERIMENTAL']],prefs.riskPolicy)}</select></label>
    <label>Theme<select name="theme">${options(['Auto','Dark','Light'].map(x=>[x,x]),prefs.theme)}</select></label>
    <button type="submit">Save preferences & replan</button></form>
    <div class="ta-actions">${button('refresh','Refresh & Plan')}${button('mode',prefs.mode==='advanced'?'Beginner':'Advanced')}</div>
    <p>${escape(snapshot.connection)} · Epoch ${snapshot.epoch} · ${escape(snapshot.phase)}.
    Independent observations; not an atomic Torn server snapshot.</p>${noSafe}${summary}${confirmationSummary}${confirmation}${alternatives}
    <section><h3>Current evidence</h3><form data-form="effects"><label><input name="none" type="checkbox" required>
    I checked my current effects: no other temporary training, drug, booster, or preparation effects beyond the fetched perks.</label>
    <button type="submit">Confirm current effect state & replan</button></form>
    ${snapshot.normalized?.capabilities.automaticStats ? '' : `<form data-form="stats"><p>Automatic stats unavailable. Enter all four current raw battle stats.</p>
      ${['strength','speed','defense','dexterity'].map(s=>`<label>${s}<input name="${s}" type="number" min="0" step="any" required></label>`).join('')}
      <button type="submit">Confirm current stats & replan</button></form>`}
    <form data-form="points"><label>Current Points (only if API proof unavailable)<input name="points" type="number" min="0" step="1" required></label>
    <button type="submit">Confirm current Points & replan</button></form>
    <p>Confirmation belongs to this observation epoch. Refresh & Plan, State changed / checkpoint reached, key changes, or reload clear it.</p>
    ${view.gates.map(text=>`<p>${escape(text)}</p>`).join('')}</section>${advanced}
    <details><summary>Connection</summary><form data-form="key"><label>Desktop local API key<input name="key" type="password" autocomplete="off" placeholder="Never included in diagnostics"></label>
    <button type="submit">Save local key</button>${button('forget-key','Forget local key')}</form>
    <p>TornPDA managed key takes priority. Keys are sent only to the official Torn API.</p></details></div>`;
}
function clamp(position,width,height,viewport) {
  return {x:Math.max(0,Math.min(Number.isFinite(position.x)?position.x:0,Math.max(0,viewport.width-width))),
    y:Math.max(0,Math.min(Number.isFinite(position.y)?position.y:0,Math.max(0,viewport.height-height)))};
}
function resolveTheme(preference,{markers='',background='',prefersDark=false}={}) {
  if (preference!=='Auto') return preference;
  const channels=background.match(/[\d.]+/g)?.map(Number) || [];
  const pageDark=/dark|night/i.test(markers) || channels.length>=3 &&
    (channels.length===3 || channels[3]>0) && channels[0]*.2126+channels[1]*.7152+channels[2]*.0722<140;
  return pageDark || prefersDark ? 'Dark' : 'Light';
}
const CSS=`#${ROOT_ID}{--bg:#f7f7f9;--fg:#181b22;--muted:#454d60;--line:#b7c0d2;--accent:#235db9;color:var(--fg);font:14px/1.4 system-ui,sans-serif;z-index:2147483600}
#${ROOT_ID}[data-theme=Dark]{--bg:#141923;--fg:#e5ebf5;--muted:#b5bfd3;--line:#47536a;--accent:#437bd3}
@media(prefers-color-scheme:dark){#${ROOT_ID}[data-theme=Auto]{--bg:#141923;--fg:#e5ebf5;--muted:#b5bfd3;--line:#47536a;--accent:#437bd3}}
#${ROOT_ID} *{box-sizing:border-box}#${ROOT_ID} button,#${ROOT_ID} input,#${ROOT_ID} select{font:inherit;color:inherit;background:var(--bg);border:1px solid var(--line);border-radius:7px;min-height:44px;padding:8px;max-width:100%}
#${ROOT_ID} button{cursor:pointer}#${ROOT_ID} button[data-action=refresh]{background:var(--accent);color:white;font-weight:700}#${ROOT_ID} button:disabled{opacity:.6;cursor:wait}
#${ROOT_ID} .ta-hud{position:fixed;width:min(340px,calc(100vw - 16px));max-height:calc(100dvh - 8px);overflow:auto;background:var(--bg);border:1px solid var(--line);border-radius:12px;box-shadow:0 6px 24px #0005;padding:10px;overflow-wrap:anywhere}
#${ROOT_ID} header{display:flex;align-items:center;justify-content:space-between;gap:8px}#${ROOT_ID} [data-drag]{touch-action:none;cursor:move;padding:4px}
#${ROOT_ID} .ta-actions{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}#${ROOT_ID} p{margin:8px 0}#${ROOT_ID} .ta-ready{font-weight:700}#${ROOT_ID} .ta-next{border-left:4px solid var(--accent);padding:10px;background:var(--bg)}
#${ROOT_ID} .ta-overlay{position:fixed;inset:12px;max-width:820px;margin:auto;display:flex;flex-direction:column;background:var(--bg);border:1px solid var(--line);border-radius:12px;box-shadow:0 10px 60px #0008;overflow:hidden}
#${ROOT_ID} .ta-overlay>header{padding:12px;border-bottom:1px solid var(--line)}#${ROOT_ID} .ta-body{overflow:auto;min-height:0;padding:14px;overflow-wrap:anywhere}
#${ROOT_ID} label{display:block;margin:8px 0}#${ROOT_ID} label>input:not([type=checkbox]),#${ROOT_ID} label>select{display:block;width:100%;margin-top:4px}#${ROOT_ID} input[type=checkbox]{min-height:24px;width:24px;vertical-align:middle}
#${ROOT_ID} section,#${ROOT_ID} form,#${ROOT_ID} details{border:1px solid var(--line);padding:10px;margin:10px 0;border-radius:8px}#${ROOT_ID} summary{cursor:pointer;min-height:44px;padding:8px}#${ROOT_ID} pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}#${ROOT_ID} li{margin:8px 0}#${ROOT_ID} h3{margin:0 0 8px}#${ROOT_ID} .ta-error{color:var(--fg);font-weight:700}
@media(max-width:600px){#${ROOT_ID} .ta-overlay{inset:0;max-width:none;border-radius:0}#${ROOT_ID} .ta-body{padding:10px}}`;
function mount({document,window,advisor}) {
  if (document.getElementById(ROOT_ID)) return null;
  const style=document.createElement('style'); style.id=STYLE_ID;style.textContent=CSS;
  document.head.appendChild(style);
  const root=document.createElement('div');root.id=ROOT_ID;document.body.appendChild(root);
  let opened=false,error='',drag=null,snapshot=advisor.snapshot();
  const listeners=[];
  const on=(target,type,handler,options)=>{target.addEventListener(type,handler,options);listeners.push(()=>target.removeEventListener(type,handler,options));};
  function position() {
    const hud=root.querySelector('.ta-hud');
    const p=clamp(snapshot.preferences.position,hud.offsetWidth,hud.offsetHeight,{width:window.innerWidth,height:window.innerHeight});
    hud.style.left=p.x+'px';hud.style.top=p.y+'px';return p;
  }
  function render(value=snapshot) {
    snapshot=value; const view=buildView(snapshot);root.dataset.theme=resolveTheme(snapshot.preferences.theme,{
      markers:[document.documentElement?.className,document.documentElement?.dataset?.theme,
        document.body?.className,document.body?.dataset?.theme].join(' '),
      background:window.getComputedStyle?.(document.body)?.backgroundColor || '',
      prefersDark:window.matchMedia?.('(prefers-color-scheme: dark)')?.matches || false});
    root.innerHTML=`<div class="ta-hud"><header><strong data-drag>Training Advisor</strong>${button('collapse',snapshot.preferences.collapsed?'Expand':'Collapse')}</header>
      ${snapshot.preferences.collapsed ? '' : `<p class="ta-ready">${escape(view.readinessLabel)}</p><p>${escape(view.planName)} · ${escape(view.target)}</p><p>${escape(view.next)}</p>`}
      <div class="ta-actions">${button('refresh','Refresh & Plan')}${button('open','Open')}</div></div>
      ${opened ? `<div class="ta-overlay" role="dialog" aria-label="Training Advisor">${fullHtml(snapshot,view)}${error?`<p class="ta-error" role="alert">${escape(error)}</p>`:''}</div>` : ''}`;
    for (const control of root.querySelectorAll('button[data-action=refresh]')) control.disabled=snapshot.phase==='REFRESHING';
    position();
  }
  on(root,'click',event=>{
    const action=event.target.closest('[data-action]')?.dataset.action;if (!action) return;
    if (action==='open') opened=true;
    if (action==='close') opened=false;
    if (action==='refresh') {error='';advisor.refresh();}
    if (action==='checkpoint') advisor.invalidate();
    if (action==='collapse') advisor.setPreferences({collapsed:!snapshot.preferences.collapsed});
    if (action==='mode') advisor.setPreferences({mode:snapshot.preferences.mode==='advanced'?'beginner':'advanced'});
    if (action==='forget-key') advisor.setKey('');
    render();
  });
  on(root,'submit',event=>{
    event.preventDefault();const form=event.target,data=new window.FormData(form);
    const number=name=>{const value=data.get(name);return typeof value==='string' && value.trim() ? Number(value) : null;};
    try {
      error='';
      switch (form.dataset.form) {
        case 'preferences':advisor.setPreferences({objective:data.get('objective'),targetStat:data.get('targetStat'),
          budgetNewCash:number('budgetNewCash'),maxWaitSeconds:(number('maxWaitMinutes') || 0)*60,
          allowItems:data.has('allowItems'),prohibitedItems:['xanax','eroticDvd','ecstasy'].filter(key=>data.has('prohibited_'+key)),
          allowRefill:data.has('allowRefill'),pointValue:number('pointValue'),riskPolicy:data.get('riskPolicy'),theme:data.get('theme')});break;
        case 'inventory':advisor.confirmInventory(Object.fromEntries(ownedRequirements(snapshot.recommendation?.primaryPlan)
          .map(x=>[x.key,number(x.key)])));break;
        case 'stats':advisor.confirmStats(Object.fromEntries(['strength','speed','defense','dexterity'].map(s=>[s,number(s)])));break;
        case 'effects':advisor.confirmEffects(data.has('none'));break;
        case 'points':advisor.confirmPoints(number('points'));break;
        case 'key':advisor.setKey(data.get('key'));break;
      }
    } catch {error='Input could not be accepted. Check the current values and Refresh & Plan before confirming.';}
    render();
  });
  on(root,'pointerdown',event=>{
    if (!event.target.closest('[data-drag]')) return;
    const p=position();drag={id:event.pointerId,x:event.clientX,y:event.clientY,start:p};
    root.setPointerCapture(event.pointerId);event.preventDefault();
  });
  on(root,'pointermove',event=>{
    if (!drag || event.pointerId!==drag.id) return;
    const hud=root.querySelector('.ta-hud'),p=clamp({x:drag.start.x+event.clientX-drag.x,y:drag.start.y+event.clientY-drag.y},
      hud.offsetWidth,hud.offsetHeight,{width:window.innerWidth,height:window.innerHeight});
    hud.style.left=p.x+'px';hud.style.top=p.y+'px';
  });
  const finishDrag=event=>{if (!drag || event.pointerId!==drag.id) return;
    const hud=root.querySelector('.ta-hud');drag=null;advisor.setPreferences({position:{x:parseFloat(hud.style.left),y:parseFloat(hud.style.top)}});};
  on(root,'pointerup',finishDrag);on(root,'pointercancel',finishDrag);on(window,'resize',position);
  const scheme=window.matchMedia?.('(prefers-color-scheme: dark)');
  if (scheme?.addEventListener) on(scheme,'change',()=>{if (snapshot.preferences.theme==='Auto') render();});
  const unsubscribe=advisor.subscribe(render);render();
  return {dispose(){unsubscribe();for (const remove of listeners) remove();advisor.dispose();root.remove();style.remove();}};
}
module.exports={ROOT_ID,STYLE_ID,CSS,escape,approximate,instruction,planName,ownedRequirements,
  beginnerAlternatives,buildView,fullHtml,clamp,resolveTheme,mount};

    }
  };
  const modules=Object.create(null);
  function load(id) {
    if (!Object.hasOwn(factories,id)) throw new Error('Unapproved private module');
    if (!modules[id]) {
      modules[id]={exports:{}};
      factories[id](modules[id],modules[id].exports,load);
    }
    return modules[id].exports;
  }
  const runtime=load('./training-advisor-runtime.js');
  const ui=load('./training-advisor-ui.js');
  if (globalThis.__TS_TRAINING_ADVISOR_TEST_MODE__===true) {
    const planner=load('./training-advisor-pure.js');
    const adapters=load('./training-advisor-adapters.js');
    globalThis.__TS_TRAINING_ADVISOR_TEST_EXPORTS__=Object.freeze({
      planner:Object.freeze({simulateTraining:planner.simulateTraining,recommend:planner.recommend,
        planReadiness:planner.planReadiness,generateEnergyCandidates:planner.generateEnergyCandidates}),
      adapters:Object.freeze({normalizeTrainingSources:adapters.normalizeTrainingSources}),
      runtime:Object.freeze({createAdvisor:runtime.createAdvisor,requestUrl:runtime.requestUrl,
        preferences:runtime.preferences,countdown:runtime.countdown}),
      ui:Object.freeze({buildView:ui.buildView,fullHtml:ui.fullHtml,clamp:ui.clamp,instruction:ui.instruction}),
      provenance:Object.freeze({"generator":"training-advisor-node-core-v1","version":"0.1.0","hashes":{"src/training-advisor-pure.js":"41ba57363c837bbb578fcf72f4161c632637eb3de4c161ae1f69d228d08f5719","src/training-advisor-adapters.js":"d04b0a6253681997ea705ca245139cd65ccc2f11315bddef21be7365821eae68","src/training-advisor-runtime.js":"1f20b5fc8118e26d0b12fd29e86eddb3cf1879bd55fbfec4cd2f2145cf2b1115","src/training-advisor-ui.js":"b4d984f6290ca41766ac53d816c23a9080d1069bdba92ab27fb1f1e29136627f","scripts/build-training-advisor.js":"16635afe9272d32ed88b4952b3af70e290955fe50ca85563dd95fb5ff1a8aa07"}})});
    return;
  }
  if (typeof document==='undefined' || document.getElementById(ui.ROOT_ID)) return;
  const storage={getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value),
    removeItem:key=>localStorage.removeItem(key)};
  const advisor=runtime.createAdvisor({fetch:window.fetch.bind(window),storage,managedKey:'###PDA-APIKEY###'});
  ui.mount({document,window,advisor});
})();
