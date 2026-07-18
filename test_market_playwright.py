import json, pathlib
from playwright.sync_api import sync_playwright
root=pathlib.Path('/mnt/data/tornscripture-item-market-margin-v0.2.1')
html=(root/'mock-market.html').read_text()
catalog={
  'updatedAt':'2026-07-17T00:00:00.000Z',
  'itemsByName':{
    'african violet':{'id':206,'name':'African Violet','normalizedName':'african violet','marketPrice':56390},
    'ceibo flower':{'id':999,'name':'Ceibo Flower','normalizedName':'ceibo flower','marketPrice':25999},
    'funeral wreath':{'id':998,'name':'Funeral Wreath','normalizedName':'funeral wreath','marketPrice':250},
  },
  'itemsById':{'206':{'id':206,'name':'African Violet','normalizedName':'african violet','marketPrice':56390}}
}
script=(root/'TornScripture-Item-Market-Margin.user.js').read_text().replace('localStorage','window.__tsimmStorage')
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page=browser.new_page()
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
    page.wait_for_timeout(1200)
    badges=page.locator('.tsimm-margin-badge')
    data=[]
    for i in range(badges.count()):
        el=badges.nth(i)
        data.append({'class':el.get_attribute('class'),'text':el.inner_text()})
    print(json.dumps(data,indent=2))
    print('PANEL:\n'+page.locator('#tornscripture-imm-panel').inner_text())
    assert any(
        'tsimm-badge-category' in x['class']
        and 'tsimm-tier-minor' in x['class']
        and '$26' in x['text']
        and 'MV $56,390' in x['text']
        and '99% $55,826' in x['text']
        for x in data
    ), data
    assert any(
        'tsimm-badge-category' in x['class']
        and 'tsimm-tier-good' in x['class']
        and '$5,739' in x['text']
        and 'MV $25,999' in x['text']
        and '99% $25,739' in x['text']
        for x in data
    ), data
    assert any(
        'tsimm-badge-category' in x['class']
        and 'tsimm-tier-loss' in x['class']
        and '-$4' in x['text']
        and 'MV $250' in x['text']
        and '99% $247' in x['text']
        for x in data
    ), data
    assert any(
        'tsimm-badge-listing' in x['class']
        and 'tsimm-tier-minor' in x['class']
        and '$8,424' in x['text']
        and 'MV $56,390' in x['text']
        and '99% $55,826' in x['text']
        for x in data
    ), data
    assert any(
        'tsimm-badge-listing' in x['class']
        and 'tsimm-tier-loss' in x['class']
        and '-$168' in x['text']
        and '-$4,872' in x['text']
        for x in data
    ), data
    assert any(
        'tsimm-badge-listing' in x['class']
        and 'tsimm-tier-good' in x['class']
        and '$18,260' in x['text']
        for x in data
    ), data
    assert 'floor(Market Value × 99%)' in page.locator('#tornscripture-imm-panel').inner_text()
    browser.close()
