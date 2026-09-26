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
  const dominatesRecipe = (a,b) => a.happy >= b.happy && a.newCash <= b.newCash &&
    a.economicValueConsumed <= b.economicValueConsumed && a.cooldownSeconds <= b.cooldownSeconds &&
    (a.happy > b.happy || a.newCash < b.newCash || a.economicValueConsumed < b.economicValueConsumed ||
     a.cooldownSeconds < b.cooldownSeconds || key(a) < key(b));
  const frontier = rawCandidates.filter(c => !rawCandidates.some(other => other !== c && dominatesRecipe(other,c)))
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
function planReadiness(plan, state = {}, timing = {}) {
  if (state.inventoryFreshness === 'STALE' && plan.resources?.ownedItemsConsumed &&
      Object.keys(plan.resources.ownedItemsConsumed).length) return { status:'NEEDS_REFRESH',reason:'DATA_STALE',nextAction:'refresh inventory' };
  if (plan.actions?.some(a => a.action === 'TAKE_ECSTASY') && timing.safeQuarterWindow === false)
    return { status:'BLOCKED',reason:'TIMING_UNSAFE',nextAction:'wait for next safe quarter-hour window' };
  if (plan.actions?.some(a=>a.action==='TAKE_ECSTASY') && timing.safeQuarterWindow !== true)
    return {status:'NEEDS_REFRESH',reason:'DATA_MISSING',nextAction:'confirm safe quarter-hour window'};
  if (plan.actions?.some(a=>a.action==='TAKE_ECSTASY') && state.cooldowns &&
      !isNonnegative(state.cooldowns.drugSeconds))
    return {status:'NEEDS_REFRESH',reason:'DATA_MISSING',nextAction:'refresh drug cooldown'};
  if (plan.actions?.some(a=>a.action==='USE_BOOSTER') &&
      isNonnegative(state.cooldowns?.boosterSeconds) && isNonnegative(state.cooldowns?.boosterMaxSeconds) &&
      state.cooldowns.boosterSeconds+plan.economics.boosterCooldownSeconds > state.cooldowns.boosterMaxSeconds)
    return {status:'BLOCKED',reason:'BOOSTER_LIMIT_REACHED',nextAction:'wait for booster capacity'};
  if (Object.keys(plan.resources?.boughtItems || {}).length && state.itemsAvailable !== true)
    return { status:'NEEDS_ITEMS',reason:'RESOURCE_MISSING',nextAction:'obtain and verify required items' };
  if (plan.economics?.newCashRequired > 0 && state.itemsAvailable === false)
    return { status:'NEEDS_ITEMS',reason:'RESOURCE_MISSING',nextAction:'obtain required items' };
  // Source adapters supply classes for each field; no source or clock is assumed here.
  const required=[['energy',true],['happy',true],['gym',false],['gainModifiers',false]];
  const drug=plan.actions?.some(a=>['TAKE_XANAX','TAKE_ECSTASY'].includes(a.action));
  const booster=plan.actions?.some(a=>a.action==='USE_BOOSTER');
  const inventory=Object.keys(plan.resources?.ownedItemsConsumed || {}).length > 0 ||
    Object.keys(plan.resources?.boughtItems || {}).length > 0;
  if (drug) required.push(['drugCooldown',true]);
  if (booster) required.push(['boosterCooldown',true]);
  if (inventory) required.push(['inventory',true]);
  for (const [field,liveOnly] of required) {
    const freshness=field==='inventory' ? state.inventoryFreshness ?? state.freshness?.inventory : state.freshness?.[field];
    if ((liveOnly ? freshness !== 'LIVE' : !['LIVE','FRESH'].includes(freshness)))
      return {status:'NEEDS_REFRESH',reason:!freshness || freshness==='UNKNOWN' ? 'DATA_MISSING' : 'DATA_STALE',
        nextAction:`refresh ${field}`};
  }
  if (drug && !isNonnegative(state.cooldowns?.drugSeconds))
    return {status:'NEEDS_REFRESH',reason:'DATA_MISSING',nextAction:'refresh drug cooldown'};
  if (booster && (!isNonnegative(state.cooldowns?.boosterSeconds) ||
      !isNonnegative(state.cooldowns?.boosterMaxSeconds)))
    return {status:'NEEDS_REFRESH',reason:'DATA_MISSING',nextAction:'refresh booster capacity'};
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
  const slotsAvailable = state.cooldowns?.boosterMaxSeconds != null ?
    state.cooldowns.boosterMaxSeconds - (state.cooldowns.boosterSeconds || 0) : null;
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
  if (slotsAvailable == null || slotsAvailable < 0 || !items.length) return ecstasyOnly;
  const maxSlots = Math.min(items.reduce((s,x)=>s+x.maxQuantity,0),
    Math.floor(slotsAvailable/Math.min(...items.map(x=>x.cooldownSeconds))));
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
      for (const c of frontier.frontier) {
        if (cooldown+c.cooldownSeconds > slotsAvailable) continue;
        const recipeItems=knownValue.map(item=>({id:item.id,
          quantity:(c.bundle[`${item.id}Owned`] || 0)+(c.bundle[`${item.id}Bought`] || 0),
          owned:c.bundle[`${item.id}Owned`] || 0,newCashEach:item.newCashEach,
          replacementValueEach:item.replacementValueEach})).filter(item=>item.quantity);
        out.push({items:[...unknownItems,...recipeItems],useEcstasy:true,
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
      Math.floor((slotsAvailable-cooldown)/item.cooldownSeconds)); quantity++) {
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
  const boosters = [...(recipe.items || [])].sort((a,b)=>compareStrings(a.id,b.id));
  for (const item of boosters) {
    const mechanic = itemMechanics[item.id];
    if (!mechanic || !isNonnegative(mechanic.happy) || !isNonnegative(mechanic.cooldownSeconds) ||
        !isInteger(item.quantity) || !isInteger(item.owned) || item.owned > item.quantity ||
        item.owned > (state.inventory?.[item.id] ?? 0) ||
        !isNonnegative(item.newCashEach) ||
        (item.replacementValueEach != null && !isNonnegative(item.replacementValueEach))) return fail('unsupported','UNSUPPORTED_EFFECT');
    if (state.cooldowns?.boosterMaxSeconds != null &&
        (state.cooldowns.boosterSeconds || 0)+boosterCooldownSeconds+item.quantity*mechanic.cooldownSeconds >
        state.cooldowns.boosterMaxSeconds) return fail('unsupported','BOOSTER_LIMIT_REACHED');
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
    let withoutLast=futureHappy;
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
