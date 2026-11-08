/* Fixed, app-authored guide copy only. No page content is sent to a translator. */
(() => {
  const selector = document.getElementById('guide-language');
  const printButton = document.getElementById('guide-print');
  const error = document.getElementById('guide-error');
  const nodes = [...document.querySelectorAll('[data-guide-copy]')];
  const sources = new Map(nodes.map(node => [node, node.getAttribute('data-guide-copy')]));
  const links = [...document.querySelectorAll('a[href]')].map(node => [node, node.getAttribute('href')]);
  const supported = [...selector.options].map(option => option.value);
  const normalize = value => {
    const base = String(value || '').toLowerCase().split('-')[0];
    return supported.includes(base) ? base : 'pt';
  };
  const errorSource = 'Não foi possível carregar este idioma. O texto anterior foi mantido.';
  let active = 'pt';
  let copy = Object.fromEntries([...sources.values()].map(source => [source, source]));
  let request = 0;

  // Build text and emphasis nodes; never inject translated HTML into the page.
  function richText(text) {
    const parsed = new DOMParser().parseFromString(text, 'text/html');
    const fragment = document.createDocumentFragment();
    function append(source, parent) {
      for (const child of source.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) parent.append(document.createTextNode(child.textContent));
        else if (child.nodeType === Node.ELEMENT_NODE && ['STRONG', 'B', 'EM', 'BR'].includes(child.tagName) && child.attributes.length === 0) {
          const element = document.createElement(child.tagName.toLowerCase());
          append(child, element);
          parent.append(element);
        } else throw new Error('Unsupported guide markup');
      }
    }
    append(parsed.body, fragment);
    return fragment;
  }

  async function load(language) {
    const current = ++request;
    const code = normalize(language);
    printButton.disabled = true;
    error.hidden = true;
    document.documentElement.dataset.guideReady = 'false';
    try {
      const response = await fetch(`/guia/locales/${code}.json`);
      if (!response.ok) throw new Error('Guide language unavailable');
      const next = await response.json();
      const rendered = nodes.map(node => {
        const value = next[sources.get(node)];
        if (typeof value !== 'string' || !value.trim()) throw new Error('Incomplete guide language');
        return [node, richText(value)];
      });
      if (current !== request) return;
      for (const [node, fragment] of rendered) node.replaceChildren(fragment);
      active = code;
      copy = next;
      selector.value = code;
      document.documentElement.lang = code;
      document.documentElement.dir = code === 'ar' ? 'rtl' : 'ltr';
      // Preserve the Portuguese urban preference when it came from the app.
      const appLanguage = String(language).toLowerCase() === 'pt-banda' ? 'pt-banda' : code;
      for (const [node, href] of links) {
        const url = new URL(href, location.href);
        if (url.origin !== location.origin) continue;
        url.searchParams.set('lang', appLanguage);
        node.href = url.pathname + url.search + url.hash;
      }
      const url = new URL(location.href);
      url.searchParams.set('lang', appLanguage);
      history.replaceState(null, '', url);
      try { localStorage.setItem('i18nextLng', appLanguage); } catch { /* Private browsing. */ }
    } catch {
      if (current !== request) return;
      selector.value = active;
      error.textContent = copy[errorSource] || errorSource;
      error.hidden = false;
    } finally {
      if (current === request) {
        printButton.disabled = false;
        document.documentElement.dataset.guideReady = 'true';
        document.dispatchEvent(new CustomEvent('guide:ready'));
      }
    }
  }
  selector.addEventListener('change', () => { void load(selector.value); });
  printButton.addEventListener('click', async () => {
    if (printButton.disabled) return;
    const current = request;
    await document.fonts?.ready;
    if (current === request) window.print();
  });
  let saved;
  try { saved = localStorage.getItem('i18nextLng'); } catch { /* Private browsing. */ }
  void load(new URLSearchParams(location.search).get('lang') || saved || navigator.language || 'pt');
})();
