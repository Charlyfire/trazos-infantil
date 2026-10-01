"""Optional Chromium checks, with native CDP multi-touch. Requires Python Playwright."""
import os
import re
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent


def routes(page):
    result = []
    for track in page.locator('.track').all():
        sx, sy, ex, ey = [float(v) for v in re.findall(r'-?\d+(?:\.\d+)?', track.get_attribute('d'))]
        length = ((ex-sx)**2 + (ey-sy)**2)**0.5
        scale = float(track.get_attribute('stroke-width')) / 100
        def point(t, offset=0, sx=sx, sy=sy, ex=ex, ey=ey, length=length):
            return (sx+(ex-sx)*t-(ey-sy)/length*offset, sy+(ey-sy)*t+(ex-sx)/length*offset)
        point.scale = scale
        result.append(point)
    return result


def trace_mouse(page, point, start=0, end=1):
    page.mouse.move(*point(start))
    page.mouse.down()
    for i in range(1, 51):
        page.mouse.move(*point(start+(end-start)*i/50))
    page.mouse.up()


def touch(cdp, kind, points):
    cdp.send('Input.dispatchTouchEvent', {
        'type': kind,
        'touchPoints': [{'x': p[0], 'y': p[1], 'id': identifier} for identifier, p in points],
    })


def finished(page, index):
    return page.locator('.route').nth(index).get_attribute('data-finished') == 'true'


with sync_playwright() as p:
    executable = os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome')
    browser = p.chromium.launch(executable_path=executable, headless=True, args=['--no-sandbox'])
    for width, height in [(1280,720), (1920,1080), (375,667), (844,390)]:
        context = browser.new_context(viewport={'width': width, 'height': height}, has_touch=True)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto((ROOT / 'index.html').as_uri())
        page.locator('#start').click()
        for mode in ['demo', 'practice']:
            page.locator('#'+mode).click()
            for exercise in range(4):
                points = routes(page)
                max_count = 5 if exercise == 0 else 3
                count = 1 if mode == 'demo' else max(1, min(max_count, (width-32)//220))
                assert len(points) == count
                for index, point in enumerate(points):
                    assert min(point(0)[1], point(1)[1])-68*point.scale >= height*0.3-0.01
                    trace_mouse(page, point, 0.5)
                    assert not finished(page,index), 'Cannot start at midpoint'
                    assert page.locator('.ink').nth(index).get_attribute('d') == ''
                    trace_mouse(page,point)
                    assert finished(page,index), f'Mouse trace {exercise}/{mode}/{index}'
                assert page.locator('#completed').is_visible()
                page.locator('#repeat').click()
                cdp = context.new_cdp_session(page)
                # Up to three simultaneous contacts, including non-primary touch pointers.
                for first in range(0, len(points), 3):
                    batch = list(enumerate(points[first:first+3],start=first))
                    touch(cdp,'touchStart', [(i+1,point(0)) for i,point in batch])
                    for step in range(1,51):
                        touch(cdp,'touchMove', [(i+1,point(step/50)) for i,point in batch])
                    touch(cdp,'touchEnd', [])
                    assert all(finished(page,i) for i,_ in batch), 'Independent simultaneous touch completion'
                cdp.detach()
                assert page.locator('#completed').is_visible()
                page.locator('#advance').click()

        page.locator('#demo').click()
        point = routes(page)[0]
        page.mouse.move(*point(0))
        page.mouse.down()
        page.mouse.move(*point(0.3),steps=10)
        before = page.locator('.ink').get_attribute('d')
        page.mouse.move(*point(0.4,120*point.scale))
        page.mouse.move(*point(0.8))
        page.mouse.move(*point(1))
        assert page.locator('.ink').get_attribute('d') == before
        assert not finished(page,0)
        page.mouse.move(*point(0.28))
        page.mouse.move(*point(1),steps=50)
        page.mouse.up()
        assert finished(page,0)
        page.locator('#repeat').click()
        trace_mouse(page,point,0,0.4)
        trace_mouse(page,point,0.4,1)
        assert not finished(page,0), 'Must use one continuous gesture'
        page.mouse.wheel(0,900)
        assert page.evaluate('scrollX === 0 && scrollY === 0')
        assert page.evaluate('document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth')
        assert page.locator('#board').evaluate('el => getComputedStyle(el).touchAction') == 'none'
        # Teacher controls must stay fully on screen, including the phone viewport.
        for button in page.locator('.teacher-controls button').all():
            bounds = button.bounding_box()
            assert bounds['x'] >= 0 and bounds['x']+bounds['width'] <= width
            assert bounds['y']+bounds['height'] <= height*0.3
        assert not errors, errors
        context.close()
    browser.close()
print('Browser checks passed: lower-area layout, demo/practice, all traces, mouse, three native simulated touch contacts, no gaps or scroll.')
