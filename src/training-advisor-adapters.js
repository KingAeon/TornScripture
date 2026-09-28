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
  const inventory = {}, fields = {}, categories = {}, sourceStatuses = {};
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
  // The pure planner has a plan-global inventory readiness class. Partial
  // confirmation must never make unconfirmed items execution-ready.
  const confirmationStatus = sourceStatus(confirmedInventory?.sourceId || 'PLAYER_CONFIRMED_INVENTORY',
    confirmedInventory?.confirmedCurrent === true && confirmedInventory.complete === true &&
      object(confirmedInventory.quantities) ? confirmedInventory : null,
    {sourceId:confirmedInventory?.sourceId,requestSucceeded:confirmedInventory?.confirmedCurrent === true,
      observedAt:confirmedInventory?.observedAt,freshness:confirmedInventory?.freshness},
    'PLAYER_CONFIRMATION');
  if (!confirmationStatus.reason && confirmationStatus.freshness === 'LIVE' &&
      Object.values(ITEM_REGISTRY).every(item => whole(confirmedInventory.quantities[item.key]))) {
    for (const [key,value] of Object.entries(confirmedInventory.quantities))
      if (Object.values(ITEM_REGISTRY).some(item=>item.key===key)) inventory[key] = value;
    inventoryFreshness='LIVE';
    fields.confirmation=field(confirmedInventory.quantities,confirmationStatus,'CONFIGURED');
  }
  return { inventory, inventoryFreshness, categories, fields, sourceStatuses };
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
