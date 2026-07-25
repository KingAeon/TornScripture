              quantity: Math.max(0, Math.floor(Number(listing?.quantity) || 0)),
            }))
            .filter((listing) => listing.key && listing.price > 0 && listing.quantity > 0)
            .slice(0, TURNOVER_CAPTURE_RULES.maxVisibleListings);
          if (!listings.length) return null;
          return {
            at: new Date(at).toISOString(),
            signature: clean(snapshot?.signature) || listings.map((listing) => `${listing.key}:${listing.quantity}`).join('|'),
            listings,
          };
        })
        .filter(Boolean)
        .sort((left, right) => Date.parse(left.at) - Date.parse(right.at))
        .slice(-TURNOVER_CAPTURE_RULES.maxSnapshotsPerItem);
      if (!snapshots.length) continue;
      items[token] = {
        itemId,
        itemName,
        firstSeenAt: candidate.firstSeenAt || snapshots[0].at,
        lastSeenAt: snapshots[snapshots.length - 1].at,
        snapshots,
      };
    }
    return {
      schema: 'tornscripture-imm-turnover-history',
      schemaVersion: TURNOVER_CAPTURE_RULES.schemaVersion,
      updatedAt: raw?.updatedAt || null,
      items,
    };
  }

  function saveTurnoverHistory(store) {
    const entries = Object.entries(store.items || {})
      .sort((left, right) => Date.parse(right[1]?.lastSeenAt || '') - Date.parse(left[1]?.lastSeenAt || ''))
      .slice(0, TURNOVER_CAPTURE_RULES.maxItems);
    store.items = Object.fromEntries(entries);
    store.updatedAt = new Date().toISOString();
    write(A.turnoverHistory, store);
  }

  function turnoverRecordForItem(store, item) {
    const token = itemKey(item?.id ?? item?.itemId, item?.name ?? item?.itemName);
    if (store.items?.[token]) return { token, record: store.items[token] };
    const wantedId = Number(item?.id ?? item?.itemId) > 0 ? Number(item.id ?? item.itemId) : null;
    const wantedName = key(item?.name ?? item?.itemName);
    const match = Object.entries(store.items || {}).find(([, record]) =>
      (wantedId && Number(record?.itemId) === wantedId)
      || (wantedName && key(record?.itemName) === wantedName));
    return match ? { token: match[0], record: match[1] } : { token, record: null };
  }

  function turnoverListingOwner(row, index) {
    const profile = row.querySelector('a[href*="profiles.php?XID="],a[href*="profiles.php?id=" i]');
    const href = String(profile?.getAttribute('href') || profile?.href || '');
    const userId = Number(href.match(/[?&](?:XID|id)=(\d+)/i)?.[1]) || null;
    if (userId) return `uid:${userId}`;
    const profileName = clean(profile?.textContent || profile?.getAttribute('title') || profile?.getAttribute('aria-label'));
    if (profileName) return `name:${key(profileName)}`;
    const ownerLike = [...row.querySelectorAll('[class*="owner" i],[class*="seller" i],[class*="name" i],a')]
      .map((element) => clean(element.textContent || element.getAttribute('title') || element.getAttribute('aria-label')))
      .find((label) => label && label.length <= 40 && !/^(?:buy|max|purchase|qty|quantity)$/i.test(label));
    if (ownerLike) return `name:${key(ownerLike)}`;
    const stableText = clean(row.innerText || row.textContent)
      .replace(/\$[\d,.]+/g, '')
      .replace(/\b[\d,]+\b/g, '')
      .replace(/\b(?:buy|max|purchase|qty|quantity)\b/gi, '');
    return `row:${turnoverTextHash(stableText || String(index))}`;
  }

  function turnoverVisibleListings() {
    return [...document.querySelectorAll('.tsimm-listing-mark')]
      .filter(validWatchListingRow)
      .slice(0, TURNOVER_CAPTURE_RULES.maxVisibleListings)
      .map((row, index) => {
        const badge = row.querySelector('.tsimm-margin-badge.tsimm-badge-listing');
        const price = Math.max(0, Math.round(listingPrice(row) || 0));
        const quantity = Math.max(0, Math.floor(Number(badge?.dataset?.tsimmQuantity) || 0));
        const owner = turnoverListingOwner(row, index);
        return price > 0 && quantity > 0
          ? { key: `${owner}@${price}`, owner, price, quantity }
          : null;
      })
      .filter(Boolean);
  }

  function turnoverProfileFromRecord(record) {
    const snapshots = Array.isArray(record?.snapshots) ? record.snapshots : [];
    let observedMs = 0;
    let windows = 0;
    let quantityDropUnits = 0;
    let removedListingUnits = 0;
    let quantityDropEvents = 0;
    let removedListings = 0;
    let newListings = 0;
    for (let index = 1; index < snapshots.length; index += 1) {
      const previous = snapshots[index - 1];
      const current = snapshots[index];
      const gap = Date.parse(current.at) - Date.parse(previous.at);
      if (!Number.isFinite(gap) || gap < 5000 || gap > TURNOVER_CAPTURE_RULES.maximumPairGapMs) continue;
      observedMs += gap;
