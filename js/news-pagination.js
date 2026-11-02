(function () {
  'use strict';

  var section = document.getElementById('blog');
  if (!section) return;
  var cards = Array.prototype.map.call(section.querySelectorAll('.blog-post'), function (card) {
    return card.parentElement;
  });
  var pageSize = 5;
  var pageCount = Math.ceil(cards.length / pageSize);
  if (pageCount <= 1) return;

  var nav = document.createElement('nav');
  nav.className = 'news-pagination';
  nav.setAttribute('aria-label', '新闻分页');
  var status = document.createElement('p');
  status.className = 'news-page-status';
  status.setAttribute('aria-live', 'polite');
  var container = section.querySelector('.container');
  container.appendChild(nav);
  container.appendChild(status);

  function currentPage() {
    var page = Number(new URL(window.location.href).searchParams.get('page'));
    return Number.isInteger(page) && page > 0 ? Math.min(page, pageCount) : 1;
  }

  function render(page) {
    cards.forEach(function (card, index) {
      card.hidden = index < (page - 1) * pageSize || index >= page * pageSize;
      // Entries hidden during initial load must not remain hidden by the old scroll animation.
      card.style.visibility = 'visible';
      card.classList.remove('wow', 'fadeInUp');
    });
    nav.replaceChildren();
    function button(label, target, disabled, active) {
      var el = document.createElement('button');
      el.type = 'button';
      el.textContent = label;
      el.disabled = disabled;
      if (active) el.setAttribute('aria-current', 'page');
      el.addEventListener('click', function () {
        var url = new URL(window.location.href);
        if (target === 1) url.searchParams.delete('page');
        else url.searchParams.set('page', target);
        window.history.pushState({ page: target }, '', url);
        render(target);
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      nav.appendChild(el);
    }
    button('上一页', page - 1, page === 1, false);
    for (var i = 1; i <= pageCount; i++) button(String(i), i, false, i === page);
    button('下一页', page + 1, page === pageCount, false);
    status.textContent = '第 ' + page + ' / ' + pageCount + ' 页，共 ' + cards.length + ' 条新闻';
  }

  window.addEventListener('popstate', function () { render(currentPage()); });
  render(currentPage());
})();
