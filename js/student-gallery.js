(() => {
  const gallery = document.querySelector('.student-gallery');
  const photos = gallery.querySelector('.student-gallery-photos');
  const status = gallery.querySelector('.student-gallery-status');
  const toggle = gallery.querySelector('.student-gallery-toggle');
  const preview = gallery.querySelector('.student-gallery-preview');
  const dialog = gallery.querySelector('.student-gallery-dialog');
  const dialogImage = dialog.querySelector('img');
  const originalLink = dialog.querySelector('a');
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const thumbnailObservers = [];
  let playing;
  let previewTimer;

  function updateDuration() {
    const widths = [...photos.children].map(row => row.firstElementChild.firstElementChild.getBoundingClientRect().width);
    // One common period gives every photo one pass per cycle, even when row sizes differ.
    gallery.style.setProperty('--gallery-duration', `${Math.max(...widths) / 42}s`);
  }

  const rowSizeObserver = new ResizeObserver(updateDuration);

  function closePreview() {
    clearTimeout(previewTimer);
    preview.hidden = true;
    preview.removeAttribute('src');
  }

  function showPhoto(image, photo) {
    image.src = photo.thumbnail;
    if (photo.src === photo.thumbnail) return;

    const original = new Image();
    original.src = photo.src;
    original.decode().then(() => {
      if (image.getAttribute('src') === photo.thumbnail) image.src = photo.src;
    }, () => {});
  }

  function showPreview(card, photo) {
    const rect = card.getBoundingClientRect();
    const spaceOnRight = innerWidth - rect.right;
    const placeOnRight = spaceOnRight > rect.left;
    const sideWidth = (placeOnRight ? spaceOnRight : rect.left) - 24;
    const width = Math.min(540, sideWidth < 160 ? innerWidth - 24 : sideWidth);
    const height = Math.min(width * 0.75, innerHeight - 24);
    const top = Math.max(12, Math.min(rect.top + (rect.height - height) / 2, innerHeight - height - 12));
    const left = sideWidth < 160 ? (innerWidth - width) / 2 : placeOnRight ? rect.right + 12 : rect.left - width - 12;
    Object.assign(preview.style, {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
    });
    showPhoto(preview, photo);
    preview.hidden = false;
  }

  function openPhoto(photo) {
    closePreview();
    dialogImage.alt = photo.alt;
    showPhoto(dialogImage, photo);
    originalLink.href = photo.src;
    dialog.showModal();
  }

  function makeList(pictures, duplicate = false) {
    const list = document.createElement('ul');
    list.className = 'student-gallery-list';
    if (duplicate) list.setAttribute('aria-hidden', 'true');

    for (const [index, photo] of pictures.entries()) {
      const item = document.createElement('li');
      const card = document.createElement('button');
      card.className = 'student-gallery-card';
      card.type = 'button';
      card.setAttribute('aria-label', `查看大图：${photo.alt}`);
      if (duplicate) card.tabIndex = -1;

      const image = document.createElement('img');
      image.addEventListener('error', () => { card.textContent = '查看大图'; }, { once: true });
      image.alt = '';
      // The two ends of each list can be visible when the loop starts.
      image.loading = index < 7 || index >= pictures.length - 2 ? 'eager' : 'lazy';
      image.decoding = 'async';
      image.draggable = false;
      image.src = photo.thumbnail;
      card.append(image);
      card.addEventListener('pointerenter', event => {
        if (event.pointerType !== 'mouse' || dialog.open) return;
        closePreview();
        previewTimer = setTimeout(() => showPreview(card, photo), 160);
      });
      card.addEventListener('pointerleave', closePreview);
      card.addEventListener('click', () => openPhoto(photo));
      item.append(card);
      list.append(item);
    }
    return list;
  }

  async function render(pictures) {
    closePreview();
    rowSizeObserver.disconnect();
    for (const observer of thumbnailObservers.splice(0)) observer.disconnect();
    photos.replaceChildren();
    gallery.classList.toggle('student-gallery-preparing', Boolean(pictures.length));
    photos.hidden = !pictures.length;
    status.hidden = false;
    status.textContent = pictures.length ? '正在加载照片…' : '暂无照片';
    toggle.hidden = true;
    if (!pictures.length) return;

    const shuffled = [...pictures];
    for (let end = shuffled.length - 1; end > 0; end--) {
      const selected = Math.floor(Math.random() * (end + 1));
      [shuffled[end], shuffled[selected]] = [shuffled[selected], shuffled[end]];
    }

    const rowCount = Math.max(1, Math.min(4, Math.floor(shuffled.length / 2)));
    const rows = Array.from({ length: rowCount }, () => []);
    shuffled.forEach((photo, index) => rows[index % rowCount].push(photo));
    const smallestRow = Math.floor(shuffled.length / rowCount);
    // Keep the window shorter than one loop. With few photos, only an edge fragment can repeat.
    gallery.style.setProperty('--gallery-window-slots', Math.max(1, smallestRow - 0.4));
    gallery.classList.toggle('student-gallery-compact', smallestRow < 5);
    toggle.hidden = shuffled.length < 2;

    rows.forEach((images, index) => {
      const row = document.createElement('div');
      row.className = 'student-gallery-row';
      row.setAttribute('role', 'group');
      row.setAttribute('aria-label', `第 ${index + 1} 行照片`);
      row.classList.toggle('is-rolling', images.length > 1);

      const track = document.createElement('div');
      track.className = 'student-gallery-track';
      const list = makeList(images);
      track.append(list);
      if (images.length > 1) track.append(makeList(images, true));
      row.append(track);
      photos.append(row);
      rowSizeObserver.observe(list);

      const preload = new IntersectionObserver((entries, observer) => {
        for (const { target, isIntersecting } of entries) {
          if (!isIntersecting) continue;
          target.loading = 'eager';
          observer.unobserve(target);
        }
      }, { root: row, rootMargin: '0px 600px' });
      for (const image of row.querySelectorAll('img[loading="lazy"]')) preload.observe(image);
      thumbnailObservers.push(preload);
    });

    updateDuration();
    const visibleImages = [...photos.children].flatMap(row => {
      const viewport = row.getBoundingClientRect();
      return [...row.querySelectorAll('img')].filter(image => {
        const bounds = image.getBoundingClientRect();
        return bounds.right > viewport.left && bounds.left < viewport.right;
      });
    });
    await Promise.allSettled(visibleImages.map(image => {
      image.loading = 'eager';
      return image.decode();
    }));
    status.hidden = true;
    gallery.classList.remove('student-gallery-preparing');
  }

  async function loadGallery() {
    if (location.protocol === 'file:') {
      const index = document.createElement('script');
      index.src = './imgs/student-gallery/.gallery-cache/index.js';
      const showIndexError = () => {
        status.textContent = '请运行 tools/update_student_gallery.py 生成本地照片索引。';
      };
      index.addEventListener('load', () => {
        if (Array.isArray(window.studentGalleryPhotos)) render(window.studentGalleryPhotos);
        else showIndexError();
      });
      index.addEventListener('error', showIndexError);
      document.head.append(index);
      return;
    }
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
    try {
      let response = await fetch('./gallery/gallery.json', { cache: 'no-cache' });
      if (response.status === 404 && local) {
        response = await fetch('/__student_gallery/gallery.json', { cache: 'no-store' });
      }
      if (response.status === 404 && !local) {
        render([]);
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const { photos: entries } = await response.json();
      await render(entries.map(entry => ({
        src: new URL(entry.src, response.url).href,
        thumbnail: new URL(entry.thumbnail, response.url).href,
        alt: entry.alt,
      })));
    } catch (error) {
      status.textContent = local ? '无法读取本地照片，请使用图廊预览脚本启动网站。' : '团队影像暂时无法加载。';
      console.warn('团队影像读取失败', error);
    }
  }

  function setPlaying(nextPlaying) {
    playing = nextPlaying;
    gallery.classList.toggle('student-gallery-paused', !playing);
    gallery.classList.toggle('student-gallery-motion-enabled', playing);
    toggle.textContent = playing ? '暂停轮播' : '播放轮播';
  }

  setPlaying(!motionPreference.matches || new URLSearchParams(location.search).get('play') === '1');
  motionPreference.addEventListener('change', event => setPlaying(!event.matches));
  toggle.addEventListener('click', () => setPlaying(!playing));
  dialog.querySelector('button').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => dialogImage.removeAttribute('src'));
  window.addEventListener('resize', closePreview);
  window.addEventListener('scroll', closePreview, { passive: true });

  loadGallery();
})();
