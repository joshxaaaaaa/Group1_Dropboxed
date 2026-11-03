// DropBoxed - small progressive enhancements. Every page works without this file.
(function () {
  'use strict';

  // Dismissible flash messages
  document.addEventListener('click', function (e) {
    var close = e.target.closest('[data-dismiss]');
    if (close) close.parentElement.remove();
  });

  // Confirm before destructive or account-changing actions
  document.addEventListener('submit', function (e) {
    var button = e.submitter || e.target.querySelector('[data-confirm]');
    var message = button && button.getAttribute('data-confirm');
    if (message && !window.confirm(message)) e.preventDefault();
  });

  // Print button on the reports page
  document.querySelectorAll('[data-print]').forEach(function (btn) {
    btn.addEventListener('click', function () { window.print(); });
  });

  // Hover / focus tooltips for chart marks and icon buttons
  var tip = document.createElement('div');
  tip.className = 'tooltip';
  tip.setAttribute('role', 'tooltip');
  document.body.appendChild(tip);
  var tipTarget = null;

  function showTip(el, x, y) {
    tipTarget = el;
    tip.textContent = el.getAttribute('data-tip');
    tip.classList.add('visible');
    var rect = tip.getBoundingClientRect();
    var left = Math.min(window.innerWidth - rect.width - 8, Math.max(8, x - rect.width / 2));
    var top = y - rect.height - 12;
    if (top < 8) top = y + 18;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }
  function hideTip() {
    tipTarget = null;
    tip.classList.remove('visible');
  }
  document.addEventListener('mousemove', function (e) {
    var el = e.target.closest('[data-tip]');
    if (el) showTip(el, e.clientX, e.clientY);
    else if (tipTarget) hideTip();
  });
  document.addEventListener('focusin', function (e) {
    var el = e.target.closest('[data-tip]');
    if (!el) return;
    var r = el.getBoundingClientRect();
    showTip(el, r.left + r.width / 2, r.top);
  });
  document.addEventListener('focusout', hideTip);
  window.addEventListener('scroll', hideTip, { passive: true });

  // Character counter for the complaint description
  document.querySelectorAll('[data-counter]').forEach(function (field) {
    var counter = document.getElementById(field.getAttribute('data-counter'));
    var update = function () { counter.textContent = field.value.length.toLocaleString(); };
    field.addEventListener('input', update);
    update();
  });

  // Fill the address fields from a saved address
  document.querySelectorAll('[data-fill-address]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var set = function (id, value) { var el = document.getElementById(id); if (el) el.value = value; };
      set('house_number', btn.dataset.houseNumber);
      set('street', btn.dataset.street);
      set('barangay', btn.dataset.barangay);
      set('postal_code', btn.dataset.postalCode);
      document.getElementById('description').focus();
    });
  });

  // Photo picker: drag-and-drop styling, previews and client-side checks
  // (the server validates again - this just catches mistakes early).
  var dropzone = document.querySelector('[data-dropzone]');
  if (dropzone) {
    var input = dropzone.querySelector('input[type="file"]');
    var previews = document.querySelector('[data-previews]');
    var errorBox = document.querySelector('[data-photo-error]');
    var maxFiles = Number(input.dataset.maxFiles);
    var maxBytes = Number(input.dataset.maxBytes);
    var accepted = ['image/jpeg', 'image/png'];

    var showError = function (message) {
      errorBox.querySelector('span').textContent = message;
      errorBox.hidden = !message;
      dropzone.classList.toggle('is-invalid', Boolean(message));
    };

    ['dragenter', 'dragover'].forEach(function (type) {
      dropzone.addEventListener(type, function () { dropzone.classList.add('is-dragover'); });
    });
    ['dragleave', 'drop'].forEach(function (type) {
      dropzone.addEventListener(type, function () { dropzone.classList.remove('is-dragover'); });
    });

    input.addEventListener('change', function () {
      previews.innerHTML = '';
      var files = Array.prototype.slice.call(input.files);
      var problem = '';
      if (files.length > maxFiles) problem = 'Attach at most ' + maxFiles + ' photos.';
      files.forEach(function (file) {
        if (!problem && accepted.indexOf(file.type) === -1) problem = '"' + file.name + '" is not a JPEG or PNG image.';
        if (!problem && file.size > maxBytes) problem = '"' + file.name + '" is larger than ' + Math.round(maxBytes / 1048576) + ' MB.';
      });
      showError(problem);
      if (problem) {
        input.value = '';
        return;
      }
      files.forEach(function (file) {
        var item = document.createElement('div');
        item.className = 'file-preview';
        var img = document.createElement('img');
        img.alt = '';
        img.src = URL.createObjectURL(file);
        img.onload = function () { URL.revokeObjectURL(img.src); };
        var name = document.createElement('div');
        name.textContent = file.name;
        item.appendChild(img);
        item.appendChild(name);
        previews.appendChild(item);
      });
    });
  }
})();
