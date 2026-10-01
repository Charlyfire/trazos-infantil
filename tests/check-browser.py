"""Optional browser validation. Requires Python Playwright and Chromium."""
import os
import re
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent


def route(page):
    values = [float(v) for v in re.findall(r"-?\d+(?:\.\d+)?", page.locator("#track").get_attribute("d"))]
    sx, sy, ex, ey = values
    length = ((ex-sx)**2 + (ey-sy)**2)**0.5
    return lambda t, offset=0: (sx+(ex-sx)*t-(ey-sy)/length*offset, sy+(ey-sy)*t+(ex-sx)/length*offset)


def trace_mouse(page, point, start=0, end=1):
    page.mouse.move(*point(start))
    page.mouse.down()
    for i in range(1, 51):
        page.mouse.move(*point(start+(end-start)*i/50))
    page.mouse.up()


def touch(cdp, kind, point=None):
    cdp.send("Input.dispatchTouchEvent", {
        "type": kind,
        "touchPoints": [] if point is None else [{"x": point[0], "y": point[1], "id": 1}],
    })


with sync_playwright() as p:
    executable = os.environ.get("CHROMIUM_PATH") or shutil.which("chromium") or shutil.which("google-chrome")
    browser = p.chromium.launch(executable_path=executable, headless=True, args=["--no-sandbox"])
    for width, height in [(1280, 720), (1920, 1080), (375, 667), (844, 390)]:
        context = browser.new_context(viewport={"width": width, "height": height}, has_touch=True)
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto((ROOT / "index.html").as_uri())
        page.locator("#start").click()
        for index in range(4):
            point = route(page)
            trace_mouse(page, point, 0.5)
            assert page.locator("#completed").is_hidden(), "Cannot start in the middle"
            assert page.locator("#ink").get_attribute("d") == ""
            trace_mouse(page, point)
            assert page.locator("#completed").is_visible(), f"Mouse trace {index}"
            page.locator("#repeat").click()
            cdp = context.new_cdp_session(page)
            touch(cdp, "touchStart", point(0))
            for i in range(1, 51):
                touch(cdp, "touchMove", point(i/50))
            touch(cdp, "touchEnd")
            assert page.locator("#completed").is_visible(), f"Touch trace {index}"
            cdp.detach()
            page.locator("#next").click()

        point = route(page)
        page.mouse.move(*point(0))
        page.mouse.down()
        page.mouse.move(*point(0.3), steps=10)
        before = page.locator("#ink").get_attribute("d")
        page.mouse.move(*point(0.4, 120))
        page.mouse.move(*point(0.8))
        page.mouse.move(*point(1))
        assert page.locator("#ink").get_attribute("d") == before
        assert page.locator("#completed").is_hidden()
        page.mouse.move(*point(0.28))
        page.mouse.move(*point(1), steps=50)
        page.mouse.up()
        assert page.locator("#completed").is_visible()
        page.locator("#repeat").click()
        trace_mouse(page, point, 0, 0.4)
        trace_mouse(page, point, 0.4, 1)
        assert page.locator("#completed").is_hidden(), "Must use one continuous gesture"
        page.mouse.wheel(0, 900)
        assert page.evaluate("scrollX === 0 && scrollY === 0")
        assert page.evaluate("document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth")
        assert page.locator("#board").evaluate("el => getComputedStyle(el).touchAction") == "none"
        assert not errors, errors
        context.close()
    browser.close()
print("Browser checks passed: four traces with mouse and native simulated touch, gap prevention, continuous gesture and no scroll.")
