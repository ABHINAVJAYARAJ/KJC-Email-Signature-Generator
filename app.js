/*
 * KJC Email Signature Generator
 * 28 October 2026
 *
 * Generates a branded HTML email signature from details entered in the browser.
 * The employee's contact information is not sent to or saved by this website.
 */

(() => {
  'use strict';

  const brand = {
    name: "King's Junior Consulting",
    logo: 'assets/kjc-logo.png',
    red: '#ff1720',
    text: '#172133'
  };

  const example = {
    first: 'Abhi',
    last: 'Jay',
    title: 'General Consultant',
    email: 'abhi.jay@example.com',
    phone: '+44 7123 456789',
    linkedin: 'www.linkedin.com/in/abhinavjayaraj'
  };

  const fieldNames = ['first', 'last', 'title', 'email', 'phone', 'linkedin'];
  const form = document.getElementById('signature-form');
  const preview = document.getElementById('signature-preview');
  const previewState = document.getElementById('preview-state');
  const actionMessage = document.getElementById('action-message');
  const themeButton = document.getElementById('theme-toggle');
  const themeLabel = document.getElementById('theme-label');
  const desktopButton = document.getElementById('desktop-view');
  const mobileButton = document.getElementById('mobile-view');
  const copyButton = document.getElementById('copy-button');
  const downloadButton = document.getElementById('download-button');
  const dialog = document.getElementById('copy-dialog');
  const dialogClose = document.getElementById('dialog-close');
  const dialogDone = document.getElementById('dialog-done');

  const touched = new Set();
  let submitted = false;
  let previousFocus = null;

  function setTheme(theme) {
    const dark = theme === 'dark';

    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]').content = dark
      ? '#0d141d'
      : '#f5f7fb';

    themeButton.setAttribute('aria-pressed', String(dark));
    themeButton.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} mode`);
    themeLabel.textContent = dark ? 'Dark mode' : 'Light mode';
  }

  function loadTheme() {
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';

    // Only the theme choice is stored; employee contact details are not persisted.
    try {
      return localStorage.getItem('kjc-theme') || systemTheme;
    } catch (error) {
      return systemTheme;
    }
  }

  function toggleTheme() {
    const nextTheme = document.documentElement.dataset.theme === 'dark'
      ? 'light'
      : 'dark';

    setTheme(nextTheme);

    try {
      localStorage.setItem('kjc-theme', nextTheme);
    } catch (error) {
      // The theme still works if browser storage is disabled.
    }
  }

  function cleanInput(value) {
    return String(value || '')
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function escapeHtml(value) {
    const entities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };

    return String(value).replace(/[&<>"']/g, character => entities[character]);
  }

  function readFields() {
    const values = {};

    for (const name of fieldNames) {
      values[name] = cleanInput(form.elements[name].value);
    }

    return values;
  }

  function fullName(values) {
    return `${values.first} ${values.last}`.trim();
  }

  function linkedInUrl(value) {
    if (!value) return '';

    try {
      const address = /^https?:\/\//i.test(value) ? value : `https://${value}`;
      const url = new URL(address);

      // Restrict contact links to genuine LinkedIn hosts, not lookalike domains.
      if (!['http:', 'https:'].includes(url.protocol)) return '';
      if (!/(^|\.)linkedin\.com$/i.test(url.hostname)) return '';
      if (url.username || url.password || url.port) return '';

      url.protocol = 'https:';
      url.hash = '';
      return url.href;
    } catch (error) {
      return '';
    }
  }

  function validate(values, showAll = false) {
    const errors = {};

    if (!values.first) errors.first = 'Please enter your first name.';
    if (!values.last) errors.last = 'Please enter your last name.';
    if (!values.title) errors.title = 'Please enter your job title.';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      errors.email = 'Enter a valid email address.';
    }

    const digits = values.phone.replace(/\D/g, '');
    if (values.phone && (digits.length < 7 || /[^\d\s()+.\-]/.test(values.phone))) {
      errors.phone = 'Enter a valid phone number or leave blank.';
    }

    if (values.linkedin && !linkedInUrl(values.linkedin)) {
      errors.linkedin = 'Use a linkedin.com profile URL.';
    }

    for (const name of fieldNames) {
      const input = form.elements[name];
      const message = document.getElementById(`${name}-error`);
      const shouldShow = showAll || submitted || touched.has(name);
      const error = shouldShow ? errors[name] : null;

      message.textContent = error || '';

      if (error) {
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-describedby', `${name}-error`);
      } else {
        input.removeAttribute('aria-invalid');
        input.removeAttribute('aria-describedby');
      }
    }

    return errors;
  }

  function logoUrl() {
    // Email clients need an absolute, publicly accessible image URL.
    return new URL(brand.logo, document.baseURI).href;
  }

  function contactRow(symbol, content) {
    const font = 'font-family:Arial,Helvetica,sans-serif;';

    return `
      <tr>
        <td style="${font}font-size:12px;line-height:19px;color:${brand.red};font-weight:bold;padding:1px 9px 1px 0;white-space:nowrap;vertical-align:top;">${symbol}</td>
        <td style="${font}font-size:12px;line-height:19px;color:${brand.text};padding:1px 0;word-break:break-word;">${content}</td>
      </tr>`;
  }

  function signatureHtml(values) {
    const name = escapeHtml(fullName(values));
    const title = escapeHtml(values.title);
    const email = escapeHtml(values.email);
    const phone = escapeHtml(values.phone);
    const linkedin = linkedInUrl(values.linkedin);

    const font = 'font-family:Arial,Helvetica,sans-serif;';
    const linkStyle = `${font}font-size:12px;line-height:19px;color:${brand.text};text-decoration:none;`;
    const emailLink = `<a href="${escapeHtml(`mailto:${values.email}`)}" style="${linkStyle}">${email}</a>`;
    const contactRows = [contactRow('✉', emailLink)];

    if (values.phone) {
      const telephone = values.phone.replace(/[^\d+]/g, '');
      const phoneLink = `<a href="${escapeHtml(`tel:${telephone}`)}" style="${linkStyle}">${phone}</a>`;
      contactRows.push(contactRow('☎', phoneLink));
    }

    if (linkedin) {
      const profileLink = `<a href="${escapeHtml(linkedin)}" style="${linkStyle}">LinkedIn profile</a>`;
      contactRows.push(contactRow('in', profileLink));
    }

    // Table layout and inline styles are needed for Gmail and Outlook compatibility.
    return `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-spacing:0;max-width:560px;${font}">
        <tr>
          <td valign="middle" style="padding:4px 17px 4px 0;vertical-align:middle;">
            <img src="${escapeHtml(logoUrl())}" alt="${escapeHtml(brand.name)}" width="108" height="94" style="width:108px;height:94px;display:block;border:0;outline:none;text-decoration:none;">
          </td>
          <td width="1" valign="top" style="font-size:0;line-height:0;width:1px;max-width:1px;background-color:#d8dde6;">&nbsp;</td>
          <td valign="middle" style="padding:4px 0 4px 17px;vertical-align:middle;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-spacing:0;${font}">
              <tr>
                <td style="${font}font-size:18px;font-weight:bold;line-height:23px;color:${brand.text};padding:0 0 2px 0;">${name}</td>
              </tr>
              <tr>
                <td style="${font}font-size:12px;line-height:18px;color:${brand.red};padding:0 0 8px 0;">${title}</td>
              </tr>
              <tr>
                <td>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-spacing:0;">
                    ${contactRows.join('')}
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>`;
  }

  function plainText(values) {
    return [
      fullName(values),
      values.title,
      brand.name,
      values.email,
      values.phone,
      linkedInUrl(values.linkedin)
    ].filter(Boolean).join('\n');
  }

  function showMessage(message, error = false) {
    actionMessage.textContent = message;
    actionMessage.classList.toggle('is-error', error);
  }

  function renderPreview() {
    const values = readFields();
    const errors = validate(values);
    const hasInput = fieldNames.some(name => Boolean(values[name]));

    // Show example details only until the user begins filling out the form.
    const display = hasInput ? values : example;

    preview.innerHTML = signatureHtml(display);
    preview.classList.toggle('mobile-preview', mobileButton.classList.contains('is-active'));

    if (!hasInput) {
      previewState.textContent = 'Showing example details. Fill in the fields to personalise.';
    } else if (Object.keys(errors).length) {
      previewState.textContent = 'Live preview. Finish required fields to copy or download.';
    } else {
      previewState.textContent = 'Your signature is ready to copy or download.';
    }
  }

  function validatedFields() {
    submitted = true;
    const values = readFields();
    const errors = validate(values, true);

    if (Object.keys(errors).length) {
      const firstInvalid = fieldNames.find(name => errors[name]);
      form.elements[firstInvalid].focus();
      showMessage('Please correct the highlighted fields.', true);
      renderPreview();
      return null;
    }

    return values;
  }

  function generateSignature() {
    if (!validatedFields()) return;

    renderPreview();
    showMessage('Signature generated. Use Copy signature or Download HTML below.');

    if (window.matchMedia('(max-width: 860px)').matches) {
      document.getElementById('preview-panel').scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  }

  function copySelectedPreview() {
    const selection = window.getSelection();
    if (!selection) return false;

    const range = document.createRange();
    range.selectNodeContents(preview);
    selection.removeAllRanges();
    selection.addRange(range);

    // Older browsers may support copying a selected HTML fragment instead.
    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch (error) {
      // The user can still select the preview and copy manually.
    }

    selection.removeAllRanges();
    return copied;
  }

  function showCopyDialog() {
    previousFocus = document.activeElement;
    dialog.hidden = false;
    dialogDone.focus();
  }

  function hideCopyDialog() {
    dialog.hidden = true;
    if (previousFocus && typeof previousFocus.focus === 'function') {
      previousFocus.focus();
    }
  }

  function handleDialogKeydown(event) {
    if (dialog.hidden) return;

    if (event.key === 'Escape') {
      hideCopyDialog();
      return;
    }

    // Keep keyboard focus inside the confirmation dialog while it is open.
    if (event.key === 'Tab') {
      const buttons = [dialogClose, dialogDone];
      const position = buttons.indexOf(document.activeElement);

      if (event.shiftKey && position === 0) {
        event.preventDefault();
        dialogDone.focus();
      } else if (!event.shiftKey && position === 1) {
        event.preventDefault();
        dialogClose.focus();
      }
    }
  }

  async function copySignature() {
    const values = validatedFields();
    if (!values) return;

    const html = signatureHtml(values);
    let copied = false;

    try {
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([plainText(values)], { type: 'text/plain' })
          })
        ]);
        copied = true;
      }
    } catch (error) {
      // If rich clipboard access is unavailable, use the selection fallback.
    }

    if (!copied) copied = copySelectedPreview();

    if (copied) {
      showMessage('Formatted signature copied to your clipboard.');
      showCopyDialog();
    } else {
      showMessage(
        'Clipboard permission was blocked. Select your signature in the preview and press Ctrl+C (or ⌘+C).',
        true
      );
    }
  }

  function downloadSignature() {
    const values = validatedFields();
    if (!values) return;

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(fullName(values))} — KJC Signature</title>
</head>
<body style="margin:24px;background:#fff;">
${signatureHtml(values)}
</body>
</html>`;

    const filename = fullName(values)
      .replace(/[^a-z0-9-]+/gi, '-')
      .replace(/^-|-$/g, '') || 'Team-Member';

    const file = new Blob([html], { type: 'text/html;charset=utf-8' });
    const address = URL.createObjectURL(file);
    const link = document.createElement('a');

    link.href = address;
    link.download = `KJC-Signature-${filename}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    // Release the temporary download URL after the browser starts the download.
    setTimeout(() => URL.revokeObjectURL(address), 1500);
    showMessage('HTML signature downloaded. Open the file in a browser to preview it.');
  }

  function setPreviewWidth(mobile) {
    mobileButton.classList.toggle('is-active', mobile);
    desktopButton.classList.toggle('is-active', !mobile);
    mobileButton.setAttribute('aria-pressed', String(mobile));
    desktopButton.setAttribute('aria-pressed', String(!mobile));
    preview.classList.toggle('mobile-preview', mobile);
  }

  // Set up the interface after the HTML has loaded (script is deferred).
  setTheme(loadTheme());
  themeButton.addEventListener('click', toggleTheme);

  for (const name of fieldNames) {
    form.elements[name].addEventListener('input', () => {
      showMessage('');
      renderPreview();
    });

    form.elements[name].addEventListener('blur', () => {
      touched.add(name);
      renderPreview();
    });
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    generateSignature();
  });

  copyButton.addEventListener('click', copySignature);
  downloadButton.addEventListener('click', downloadSignature);
  desktopButton.addEventListener('click', () => setPreviewWidth(false));
  mobileButton.addEventListener('click', () => setPreviewWidth(true));
  dialogClose.addEventListener('click', hideCopyDialog);
  dialogDone.addEventListener('click', hideCopyDialog);
  dialog.addEventListener('click', event => {
    if (event.target === dialog) hideCopyDialog();
  });
  document.addEventListener('keydown', handleDialogKeydown);

  renderPreview();
})();
