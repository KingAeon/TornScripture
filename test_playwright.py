import json, pathlib
from playwright.sync_api import sync_playwright
root=pathlib.Path('/mnt/data/tornscripture-item-market-margin-v0.2.0')
html=(root/'mock-trade.html').read_text()
catalog={
  'updatedAt':'2026-07-18T00:00:00.000Z',
  'itemsByName':{
    'african violet':{'id':206,'name':'African Violet','normalizedName':'african violet','marketPrice':56390},
    'dahlia':{'id':123,'name':'Dahlia','normalizedName':'dahlia','marketPrice':1900},
  },
  'itemsById':{
    '206':{'id':206,'name':'African Violet','normalizedName':'african violet','marketPrice':56390},
    '123':{'id':123,'name':'Dahlia','normalizedName':'dahlia','marketPrice':1900},
  }
}
script=(root/'TornScripture-Item-Market-Margin.user.js').read_text().replace('localStorage','window.__tsimmStorage')
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1200,'height':900})
    page.set_content(html)
    page.evaluate("""([catalog]) => {
      const data = new Map();
      window.__tsimmStorage = {
        getItem: (key) => data.has(key) ? data.get(key) : null,
        setItem: (key, value) => data.set(key, String(value)),
        removeItem: (key) => data.delete(key),
      };
      window.__tsimmStorage.setItem('tornscripture-imm-catalog-v1', catalog);
    }""", [json.dumps(catalog)])
    page.add_script_tag(content=script)
    page.wait_for_timeout(1400)
    panel=page.locator('#tornscripture-imm-panel').inner_text()
    print(panel)
    assert 'v0.2.0 · trade' in panel
    assert 'Required 99% payout' in panel
    assert '$18,106,434' in panel
    assert '99% PROTECTED' in panel
    assert 'Difference from target\n$0' in panel or 'Difference from target\n+$0' in panel
    badges=page.locator('.tsimm-trade-item-badge')
    assert badges.count()==2, badges.count()
    texts=[badges.nth(i).inner_text() for i in range(badges.count())]
    print(texts)
    assert any('99% $18,087,624' in t for t in texts)
    assert any('99% $18,810' in t for t in texts)
    page.locator('.user.right .money').evaluate("el => { el.textContent = 'Money: $18,000,000'; }")
    page.wait_for_timeout(900)
    underpaid=page.locator('#tornscripture-imm-panel').inner_text()
    assert 'UNDER TARGET' in underpaid
    assert '-$106,434' in underpaid
    page.locator('.user.right .money').evaluate("el => { el.textContent = 'Money: $18,106,434'; }")
    page.wait_for_timeout(900)
    page.screenshot(path=str(root/'mock-trade-v0.2.0.png'), full_page=True)
    browser.close()
