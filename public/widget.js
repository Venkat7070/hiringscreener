(function () {
  const root = document.getElementById('support-bot-widget');
  if (!root) return;

  const history = [];

  root.innerHTML = `
    <div class="sb-header">Support</div>
    <div class="sb-messages" id="sb-messages"></div>
    <form class="sb-input-row" id="sb-form">
      <input id="sb-input" type="text" placeholder="Ask a question..." autocomplete="off" />
      <button type="submit" id="sb-send">Send</button>
    </form>
  `;

  const messagesEl = root.querySelector('#sb-messages');
  const formEl = root.querySelector('#sb-form');
  const inputEl = root.querySelector('#sb-input');
  const sendEl = root.querySelector('#sb-send');

  function appendMessage(role, text) {
    const el = document.createElement('div');
    el.className = `sb-msg ${role}`;
    el.textContent = text;
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = inputEl.value.trim();
    if (!text) return;

    history.push({ role: 'user', content: text });
    appendMessage('user', text);
    inputEl.value = '';
    sendEl.disabled = true;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');

      history.push({ role: 'assistant', content: data.reply });
      appendMessage('assistant', data.reply);
    } catch (err) {
      appendMessage('assistant', 'Sorry, something went wrong. Please try again.');
    } finally {
      sendEl.disabled = false;
      inputEl.focus();
    }
  });
})();
