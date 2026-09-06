import { describe, it, expect } from 'vitest';
import { csp, inlineScripts, inlineStyles, sha256 } from '../scripts/csp.mjs';

describe('csp.mjs', () => {
  it('sha256 — фармат хэшу CSP: sha256-<base64> у адзінарных двукоссях', () => {
    expect(sha256('')).toBe("'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='");
    expect(sha256('a()')).toMatch(/^'sha256-[A-Za-z0-9+/]{43}='$/);
    expect(sha256('a()')).not.toBe(sha256('a();'));
  });
  it('інлайн-скрыпты: без src, тып JS/module (рэгістр не важны); JSON-LD і іншыя тыпы не лічацца', () => {
    const html = `<script>a()</script><script src="/x.js"></script><script type="module">b()</script>
      <script type="application/ld+json">{"x":1}</script><script type="text/javascript">c()</script>
      <SCRIPT type="text/plain">d()</SCRIPT><script type='Module' data-x=1>e()</script><script defer src=/y.js></script>`;
    expect(inlineScripts(html)).toEqual(['a()', 'b()', 'c()', 'e()']);
    expect(inlineStyles('<style>p{}</style><style media="print">a{}</style><link rel="stylesheet" href="x.css">')).toEqual(['p{}', 'a{}']);
    expect(inlineScripts('')).toEqual([]);
  });
  it('палітыка: хэшы інлайн-кода, connect-src self, object/frame none, base-uri self, без unsafe-*', () => {
    const policy = csp({ scripts: ['a()'], styles: ['p{}'] });
    const d = Object.fromEntries(policy.split('; ').map((s) => { const [k, ...v] = s.split(' '); return [k, v.join(' ')]; }));
    expect(d['default-src']).toBe("'self'");
    expect(d['script-src']).toBe(`'self' ${sha256('a()')}`);
    expect(d['style-src']).toBe(`'self' ${sha256('p{}')}`);
    expect(d['connect-src']).toBe("'self'");
    expect(d['object-src']).toBe("'none'");
    expect(d['frame-src']).toBe("'none'");
    expect(d['base-uri']).toBe("'self'");
    expect(d['form-action']).toBe("'self'");
    expect(d['img-src']).toBe("'self' data:");
    expect(policy).not.toMatch(/unsafe-inline|unsafe-eval|https?:/);
    expect(csp()).toContain("script-src 'self'; style-src 'self'; ");
  });
});
