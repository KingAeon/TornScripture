import json, pathlib
from playwright.sync_api import sync_playwright
root=pathlib.Path('/mnt/data/tornscripture-item-market-margin-v0.2.1')
html=(root/'mock-compact-listings.html').read_text()
catalog={
  'updatedAt':'2026-07-18T06:01:23.280Z',
  'itemsByName':{
    'bermudas':{'id':928,'name':'Bermudas','normalizedName':'bermudas','marketPrice':600},
  },
  'itemsById':{
    '928':{'id':928,'name':'Bermudas','normalizedName':'bermudas','marketPrice':600},
  }
}
script=(root/'TornScripture-Item-Market-Margin.user.js').read_text().replace('localStorage','window.__tsimmStorage')
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox','--allow-file-access-from-files'])
    page=browser.new_page()
    page.set_content(html)
    page.evaluate("location.hash = '/market/view=category&categoryName=Clothing&itemID=928'")
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
    page.wait_for_timeout(1200)
    badges=page.locator('.tsimm-margin-badge')
    data=[]
    for i in range(badges.count()):
        el=badges.nth(i)
        data.append({'class':el.get_attribute('class'),'text':el.inner_text()})
    panel=page.locator('#tornscripture-imm-panel').inner_text()
    print(json.dumps(data,indent=2))
    print('PANEL:\n'+panel)
    assert badges.count() == 4, data
    assert any('tsimm-tier-good' in x['class'] and '+$494 ea' in x['text'] for x in data), data
    assert any('tsimm-tier-minor' in x['class'] and '+$75 ea' in x['text'] for x in data), data
    assert any('tsimm-tier-loss' in x['class'] and '-$6 ea' in x['text'] for x in data), data
    assert 'item listings' in panel, panel
    # The visible Value panel is absent; source must be URL itemID -> cached catalog.
    diag=page.evaluate("""() => {
      const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Copy diagnostics'));
      return document.querySelector('#tornscripture-imm-panel').innerText;
    }""")
    browser.close()
