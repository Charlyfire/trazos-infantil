"""Chromium checks of every template, including native simulated multi-touch."""
import math
import os
import re
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent


def stroke_model(stroke):
    track = stroke.locator('.track')
    values = [float(v) for v in re.findall(r'-?\d+(?:\.\d+)?(?:e[+-]?\d+)?', track.get_attribute('d'))]
    points = list(zip(values[::2], values[1::2]))
    segments = []
    length = 0
    for a, b in zip(points, points[1:]):
        size = math.dist(a,b)
        if size > 1e-6:
            segments.append((a,b,length,size))
            length += size
    scale = float(track.get_attribute('stroke-width'))/100
    def at(t):
        along = min(length, max(0, t*length))
        for a,b,start,size in segments:
            if start+size >= along-1e-6:
                ratio = (along-start)/size
                return (a[0]+(b[0]-a[0])*ratio,a[1]+(b[1]-a[1])*ratio)
        return points[-1]
    at.scale, at.length, at.points = scale, length, points
    return at


def finished(node):
    return node.get_attribute('data-finished') == 'true'


def mouse_trace(page, stroke, start=0, end=1):
    point = stroke_model(stroke)
    if stroke.get_attribute('data-kind') == 'dot':
        x,y = point(0)
        if start > 0: x += 120*point.scale
        page.mouse.click(x,y)
        return
    page.mouse.move(*point(start))
    page.mouse.down()
    count = max(60,math.ceil(point.length*(end-start)/10))
    for step in range(1,count+1):
        page.mouse.move(*point(start+(end-start)*step/count))
    page.mouse.up()


def touch(cdp,kind,contacts):
    cdp.send('Input.dispatchTouchEvent', {'type':kind,'touchPoints':[{'x':p[0],'y':p[1],'id':i} for i,p in contacts]})


with sync_playwright() as p:
    executable = os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome')
    browser = p.chromium.launch(executable_path=executable,headless=True,args=['--no-sandbox'])
    for width,height in [(1280,720),(1920,1080),(375,667),(844,390)]:
        context = browser.new_context(viewport={'width':width,'height':height},has_touch=True)
        page = context.new_page()
        errors = []
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto((ROOT/'index.html').as_uri())
        page.locator('#start').click()
        template_count = page.locator('#template option').count()
        assert template_count == 20
        for mode in ['demo','practice']:
            page.locator('#'+mode).click()
            for template in range(template_count):
                page.select_option('#template',str(template))
                figures = page.locator('.route')
                for figure in figures.all():
                    for stroke in figure.locator('.stroke').all():
                        point = stroke_model(stroke)
                        for endpoint in [point(0),point(1)]:
                            assert endpoint[1]-68*point.scale >= height*0.3-0.01
                        mouse_trace(page,stroke,0.5)
                        assert not finished(stroke), 'Cannot start midway'
                        assert stroke.locator('.ink').get_attribute('d') == ''
                        if stroke.locator('.track').get_attribute('data-closed') == 'true':
                            page.mouse.move(*point(0));page.mouse.down();page.mouse.up()
                            assert not finished(stroke), 'Circle contact is not a full lap'
                        mouse_trace(page,stroke)
                        assert finished(stroke),f'Mouse: {template}/{mode}'
                    assert finished(figure)
                assert page.locator('#exercise').get_attribute('data-all-finished') == 'true'
                page.locator('#clear').click()
                # Trace up to three figures at once. Each component is a new gesture.
                cdp = context.new_cdp_session(page)
                for first in range(0,figures.count(),3):
                    batch = figures.all()[first:first+3]
                    for component in range(max(f.locator('.stroke').count() for f in batch)):
                        strokes = [f.locator('.stroke').nth(component) for f in batch]
                        points = [stroke_model(s) for s in strokes]
                        touch(cdp,'touchStart',[(i+1,point(0)) for i,point in enumerate(points)])
                        steps = max(100,math.ceil(max(point.length for point in points)/10))
                        for step in range(1,steps+1):
                            touch(cdp,'touchMove',[(i+1,point(step/steps)) for i,point in enumerate(points)])
                        touch(cdp,'touchEnd',[])
                        assert all(finished(s) for s in strokes),'Independent simultaneous touch strokes'
                    assert all(finished(f) for f in batch)
                cdp.detach()
                assert page.locator('#exercise').get_attribute('data-all-finished') == 'true'
                if width == 1280 and height == 720 and mode == 'practice' and template in [0,6,11,12]:
                    page.screenshot(path=f'/tmp/trazos-template-{template}.png')
                page.mouse.wheel(0,900)
                assert page.evaluate('scrollX === 0 && scrollY === 0')
                assert page.locator('#board').evaluate('el => getComputedStyle(el).touchAction') == 'none'
        # Teacher height and optional continuation mode.
        page.select_option('#template','0')
        before_y = stroke_model(page.locator('.stroke').first)(0)[1]
        page.locator('#settings-button').click()
        page.locator('#height-down').click()
        page.locator('#help').click()
        page.locator('#settings-close').click()
        assert stroke_model(page.locator('.stroke').first)(0)[1] > before_y
        assert page.evaluate("JSON.parse(localStorage.getItem('trazos.preferences.v1')).assisted")
        stroke = page.locator('.stroke').first
        point = stroke_model(stroke)
        # Accepted ink retains a real lateral offset.
        offset = 30*point.scale
        page.mouse.move(point(0)[0]+offset,point(0)[1]);page.mouse.down()
        for step in range(1,31):
            x,y = point(step/100);page.mouse.move(x+offset,y)
        page.mouse.up()
        values = [float(v) for v in re.findall(r'-?\d+(?:\.\d+)?',stroke.locator('.ink').get_attribute('d'))]
        assert all(abs(x-point(0)[0]-offset)<0.02 for x in values[::2]), 'Ink is not snapped to template'
        assert stroke.locator('.origin').get_attribute('data-resume') == 'true'
        prefix = stroke.locator('.ink').get_attribute('d')
        mouse_trace(page,stroke,0.3,1)
        assert finished(stroke) and stroke.locator('.ink').get_attribute('d').startswith(prefix)
        page.locator('#clear').click()
        # Repeating a secondary child's figure must keep the first contact alive.
        figures = page.locator('.route')
        if figures.count() > 1:
            second = figures.nth(1).locator('.stroke').first
            mouse_trace(page,second)
            assert finished(figures.nth(1))
            first = figures.first.locator('.stroke').first
            point = stroke_model(first)
            cdp = context.new_cdp_session(page)
            touch(cdp,'touchStart',[(1,point(0))]);touch(cdp,'touchMove',[(1,point(0.3))])
            prefix = first.locator('.ink').get_attribute('d')
            button = page.locator('.individual-repeat').nth(1).bounding_box()
            centre = (button['x']+button['width']/2,button['y']+button['height']/2)
            touch(cdp,'touchStart',[(1,point(0.3)),(2,centre)])
            touch(cdp,'touchEnd',[(1,point(0.3))])
            assert not finished(figures.nth(1)) and first.locator('.ink').get_attribute('d') == prefix
            touch(cdp,'touchMove',[(1,point(0.5))])
            assert first.locator('.ink').get_attribute('d') != prefix
            touch(cdp,'touchEnd',[]);cdp.detach()
        page.locator('#demo').click()
        dot = page.locator('.demo-point')
        y0 = float(dot.get_attribute('cy'))
        page.wait_for_timeout(1100)
        assert float(dot.get_attribute('cy')) > y0
        assert page.locator('.ink').first.get_attribute('d') == ''
        assert page.locator('.demo-ink').first.get_attribute('d') != ''
        assert not finished(page.locator('.route').first)
        page.locator('#practice').click()
        assert page.locator('#exercise').get_attribute('data-demonstrating') == 'false'
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight')
        for button in page.locator('.teacher-controls button').all():
            bounds = button.bounding_box()
            assert bounds['x'] >= 0 and bounds['x']+bounds['width'] <= width
        assert not errors,errors
        context.close()
    browser.close()
print('Browser checks passed: 20 families, all gestures, native multi-touch, lower layout, start-only and no scroll.')
