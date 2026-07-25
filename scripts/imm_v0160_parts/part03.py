      windows += 1;
      const before = new Map(previous.listings.map((listing) => [listing.key, listing]));
      const after = new Map(current.listings.map((listing) => [listing.key, listing]));
      for (const [listingKey, listing] of before) {
        const next = after.get(listingKey);
        if (!next) {
          removedListings += 1;
          removedListingUnits += Number(listing.quantity) || 0;
          continue;
        }
        const decrease = Math.max(0, Number(listing.quantity || 0) - Number(next.quantity || 0));
        if (decrease > 0) {
          quantityDropEvents += 1;
          quantityDropUnits += decrease;
        }
      }
      for (const listingKey of after.keys()) {
        if (!before.has(listingKey)) newListings += 1;
      }
    }
    const observedHours = observedMs / 3600000;
    const weightedUnits = quantityDropUnits + removedListingUnits * 0.35;
    const signalUnitsPerHour = observedHours > 0 ? weightedUnits / observedHours : 0;
    const movementEvents = quantityDropEvents + removedListings;
    const eventsPerHour = observedHours > 0 ? movementEvents / observedHours : 0;
    const unitScore = Math.min(70, Math.log10(1 + signalUnitsPerHour) / Math.log10(1001) * 70);
    const eventScore = Math.min(30, Math.log10(1 + eventsPerHour) / Math.log10(21) * 30);
    const score = Math.max(0, Math.min(100, Math.round(unitScore + eventScore)));
    const confidence = Math.max(0, Math.min(100, Math.round(
      Math.min(1, windows / 12) * 55
      + Math.min(1, observedMs / (2 * 3600000)) * 30
      + Math.min(1, snapshots.length / 20) * 15
    )));
    let band = 'learning';
    if (snapshots.length >= 3 && confidence >= 20) {
      if (score >= 75) band = 'frenzy';
      else if (score >= 55) band = 'fast';
      else if (score >= 30) band = 'steady';
      else band = 'slow';
    }
    const labels = { learning: 'LEARNING', slow: 'SLOW', steady: 'STEADY', fast: 'FAST', frenzy: 'FRENZY' };
    return {
      itemId: Number(record?.itemId) || null,
      itemName: clean(record?.itemName),
      snapshots: snapshots.length,
      windows,
      observedMinutes: Math.round(observedMs / 60000),
      quantityDropUnits,
      removedListingUnits,
      quantityDropEvents,
      removedListings,
      newListings,
      signalUnitsPerHour,
      eventsPerHour,
      score,
      confidence,
      band,
      label: labels[band],
      rank: score * (0.35 + confidence / 100 * 0.65),
      lastSeenAt: record?.lastSeenAt || snapshots[snapshots.length - 1]?.at || null,
    };
  }

  function turnoverVelocityForItem(item) {
    const store = turnoverHistoryStore();
    const found = turnoverRecordForItem(store, item);
    return found.record
      ? turnoverProfileFromRecord(found.record)
      : turnoverProfileFromRecord({ itemId: item?.id || null, itemName: item?.name || '', snapshots: [] });
  }

  function turnoverLeaderboard(limit = 6) {
    const store = turnoverHistoryStore();
    return Object.values(store.items || {})
      .map(turnoverProfileFromRecord)
      .filter((profile) => profile.snapshots >= 2)
      .sort((left, right) => right.rank - left.rank
        || right.confidence - left.confidence
        || right.snapshots - left.snapshots
        || left.itemName.localeCompare(right.itemName))
      .slice(0, Math.max(1, Math.floor(Number(limit) || 6)));
  }

  function maybeCaptureTurnoverSnapshot(item) {
    const listings = turnoverVisibleListings();
    const profile = () => turnoverVelocityForItem(item);
    if (!listings.length) return profile();
    const itemToken = itemKey(item?.id, item?.name);
    const signature = listings.map((listing) => `${listing.key}:${listing.quantity}`).join('|');
    const now = Date.now();
    if (turnoverCaptureState.itemToken !== itemToken || turnoverCaptureState.signature !== signature) {
      turnoverCaptureState.itemToken = itemToken;
      turnoverCaptureState.signature = signature;
      turnoverCaptureState.stableSince = now;
      return profile();
    }
    if (now - turnoverCaptureState.stableSince < TURNOVER_CAPTURE_RULES.settleMs) return profile();

    const store = turnoverHistoryStore();
    const found = turnoverRecordForItem(store, item);
