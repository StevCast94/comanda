/**
 * Comanda — Landing Country Detection
 * Detects /do path and adjusts all country-specific elements dynamically
 */
(function() {
  var path = window.location.pathname;
  var isDO = path === '/do' || path === '/do/';
  window.__COMNDA_COUNTRY = isDO ? 'do' : 'ec';
  window.__COMNDA_COUNTRY_NAME = isDO ? 'República Dominicana' : 'Ecuador';
  window.__COMNDA_EXCHANGE_RATE = isDO ? 55 : 1;
  window.__COMNDA_CURRENCY = isDO ? 'DOP' : 'USD';
  if (!isDO) return;

  // ─── Country config ───────────────────────────────────────
  var cfg = {
    currency: 'DOP',
    currencySymbol: 'RD$',
    exchangeRate: 55,        // 1 USD ≈ 55 DOP
    phoneCode: '+1 809',
    phoneRaw: '18095551234',
    whatsapp: '18095551234',
    email: 'rd@comanda.one',
    timezone: 'America/Santo_Domingo',
    countryName: 'República Dominicana',
    countryFlag: '🇩🇴',
  };

  // Maps USD prices to DOP (rounded to nearest 50)
  function toDOP(usd, rate) {
    return Math.round(usd * rate / 50) * 50;
  }

  function doAll() {
    // ─── Title ────────────────────────────────────────────────
    document.title = 'Comanda RD — Gestión Inteligente para Restaurantes';

    // ─── Hero ─────────────────────────────────────────────────
    var heroP = document.querySelector('.hero p');
    if (heroP) heroP.textContent = 'POS · Cocina · Meseros · Reportería — todo integrado para restaurantes dominicanos. Sin papel, sin caos.';

    // ─── Plan prices ───────────────────────────────────────────
    var rate = cfg.exchangeRate;
    var planCards = document.querySelectorAll('.plan-card');
    var prices = [0, 29, 59]; // FREE, BASIC, PRO in USD
    planCards.forEach(function(card, i) {
      if (i === 0) return; // FREE
      var priceEl = card.querySelector('.price');
      if (priceEl && prices[i]) {
        var dop = toDOP(prices[i], rate);
        var usdText = priceEl.innerHTML;
        priceEl.innerHTML = cfg.currencySymbol + dop.toLocaleString() + '<span>/mes</span>';
        var pEl = card.querySelector('p');
        if (pEl) {
          pEl.textContent += ' (~US$' + prices[i] + ')';
        }
      }
    });

    // ─── Phone numbers ────────────────────────────────────────
    var phoneSpans = document.querySelectorAll('.contact-item');
    phoneSpans.forEach(function(el) {
      var txt = el.textContent;
      if (txt.indexOf('+593') !== -1) el.textContent = '📱 ' + cfg.phoneCode;
      if (txt.indexOf('contacto@') !== -1) el.textContent = '📧 ' + cfg.email;
    });

    // ─── WhatsApp float + button ──────────────────────────────
    var waFloat = document.querySelector('.whatsapp-float');
    var waBtn = document.querySelector('.demo-info .btn-white');
    var waRaw = cfg.whatsapp;
    if (waFloat) waFloat.href = 'https://wa.me/' + waRaw;
    if (waBtn) waBtn.href = 'https://wa.me/' + waRaw;

    // ─── Email in hero capture ────────────────────────────────
    var quickEmail = document.getElementById('quick-email');
    if (quickEmail) quickEmail.placeholder = 'tu@email.com (' + cfg.countryFlag + ')';

    // ─── Nav login button ─────────────────────────────────────
    var loginBtn = document.querySelector('nav .btn-outline');
    if (loginBtn) loginBtn.href = '/app/?country=do';

    // ─── "Comenzar gratis" links ─────────────────────────────
    var freeLinks = document.querySelectorAll('a[href="/app"]');
    freeLinks.forEach(function(a) { a.href = '/app/?country=do'; });

    // ─── Country badge in nav ─────────────────────────────────
    var logo = document.querySelector('nav .logo');
    if (logo) logo.innerHTML = '🍽️ Comanda <span style="font-size:14px;font-weight:500;color:#64748b;margin-left:4px">' + cfg.countryFlag + '</span>';
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', doAll);
  } else {
    doAll();
  }
})();
