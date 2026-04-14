(function () {
  "use strict";

  var FORMSPREE_URL = "https://formspree.io/f/xzdkdgwe";
  var CHAT_ENDPOINT = "/.netlify/functions/chat";
  var OPENING_MESSAGE =
    "Hi! I'm the LeadLock onboarding assistant. I'll collect a few details to get your account set up. Let's start — what's your business name and your name?";

  var messages = [];
  var isLoading = false;
  var summarySubmitted = false;

  // ── DOM refs (populated on init) ──────────────────────────────────────────
  var toggleBtn, chatWindow, messagesEl, inputEl, sendBtn;

  // ── Helpers ───────────────────────────────────────────────────────────────

  function isSummary(text) {
    // Detect the final summary by looking for the "send this over" phrase
    return /send this over|i have everything i need|i've got everything/i.test(text);
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function appendMessage(text, role) {
    var div = document.createElement("div");
    div.className =
      role === "user"
        ? "ll-msg ll-msg-user"
        : "ll-msg ll-msg-bot";
    div.textContent = text;
    messagesEl.appendChild(div);
    scrollToBottom();
    return div;
  }

  function appendFinalSummary(text) {
    var div = document.createElement("div");
    div.className = "ll-msg ll-msg-final";
    div.textContent = text;
    messagesEl.appendChild(div);
    scrollToBottom();
    return div;
  }

  function appendSuccessMessage(text) {
    var div = document.createElement("div");
    div.className = "ll-msg ll-msg-success";
    div.textContent = text;
    messagesEl.appendChild(div);
    scrollToBottom();
  }

  function showTyping() {
    var el = document.createElement("div");
    el.className = "ll-typing";
    el.id = "ll-typing-indicator";
    el.innerHTML = "<span></span><span></span><span></span>";
    messagesEl.appendChild(el);
    scrollToBottom();
    return el;
  }

  function removeTyping() {
    var el = document.getElementById("ll-typing-indicator");
    if (el) el.parentNode.removeChild(el);
  }

  function setLoading(loading) {
    isLoading = loading;
    sendBtn.disabled = loading;
    inputEl.disabled = loading;
  }

  // ── Formspree submission ──────────────────────────────────────────────────

  function submitToFormspree(summaryText) {
    fetch(FORMSPREE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        subject: "New LeadLock Onboarding",
        message: summaryText,
      }),
    })
      .then(function (res) {
        if (res.ok) {
          appendSuccessMessage(
            "You're all set! Someone from the LeadLock team will be in touch shortly."
          );
        } else {
          appendSuccessMessage(
            "Your info was collected! The LeadLock team will be in touch soon."
          );
        }
        setLoading(false);
        inputEl.style.display = "none";
        sendBtn.style.display = "none";
      })
      .catch(function () {
        appendSuccessMessage(
          "Your info was collected! The LeadLock team will be in touch soon."
        );
        setLoading(false);
        inputEl.style.display = "none";
        sendBtn.style.display = "none";
      });
  }

  // ── API call ──────────────────────────────────────────────────────────────

  function sendToAPI(userText) {
    if (isLoading) return;

    // Append to local history
    messages.push({ role: "user", content: userText });

    appendMessage(userText, "user");
    setLoading(true);
    var typing = showTyping();

    fetch(CHAT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messages }),
    })
      .then(function (res) {
        if (!res.ok) {
          return res.text().then(function (t) {
            throw new Error("Function error " + res.status + ": " + t);
          });
        }
        return res.json();
      })
      .then(function (data) {
        removeTyping();

        var botText = data.response || "Sorry, I ran into an issue. Please try again.";
        messages.push({ role: "assistant", content: botText });

        if (isSummary(botText) && !summarySubmitted) {
          summarySubmitted = true;
          appendFinalSummary(botText);
          setLoading(true); // keep disabled while submitting
          submitToFormspree(botText);
        } else {
          appendMessage(botText, "bot");
          setLoading(false);
        }
      })
      .catch(function () {
        removeTyping();
        appendMessage(
          "Sorry, something went wrong. Please check your connection and try again.",
          "bot"
        );
        setLoading(false);
      });
  }

  // ── UI actions ────────────────────────────────────────────────────────────

  function handleSend() {
    var text = inputEl.value.trim();
    if (!text || isLoading) return;
    inputEl.value = "";
    inputEl.style.height = "auto";
    sendToAPI(text);
  }

  function openChat() {
    chatWindow.classList.add("ll-open");
    toggleBtn.setAttribute("aria-expanded", "true");
    inputEl.focus();

    // Send opening message on first open
    if (messages.length === 0) {
      messages.push({ role: "assistant", content: OPENING_MESSAGE });
      appendMessage(OPENING_MESSAGE, "bot");
    }
  }

  function closeChat() {
    chatWindow.classList.remove("ll-open");
    toggleBtn.setAttribute("aria-expanded", "false");
  }

  function toggleChat() {
    if (chatWindow.classList.contains("ll-open")) {
      closeChat();
    } else {
      openChat();
    }
  }

  // ── Build DOM ─────────────────────────────────────────────────────────────

  function buildWidget() {
    var wrapper = document.createElement("div");
    wrapper.id = "ll-chat-widget";

    // Chat window
    var win = document.createElement("div");
    win.id = "ll-chat-window";
    win.setAttribute("role", "dialog");
    win.setAttribute("aria-label", "LeadLock Onboarding Chat");

    // Header
    var header = document.createElement("div");
    header.id = "ll-chat-header";
    header.innerHTML =
      '<div class="ll-header-dot"></div>' +
      '<div id="ll-chat-header-text">' +
        '<h3>LeadLock Onboarding</h3>' +
        '<p class="ll-subtitle">Online now</p>' +
      "</div>" +
      '<button id="ll-chat-close" aria-label="Close chat">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      "</button>";

    // Messages area
    var msgs = document.createElement("div");
    msgs.id = "ll-chat-messages";
    msgs.setAttribute("aria-live", "polite");

    // Input area
    var inputArea = document.createElement("div");
    inputArea.id = "ll-chat-input-area";

    var inp = document.createElement("textarea");
    inp.id = "ll-chat-input";
    inp.placeholder = "Type your message…";
    inp.rows = 1;
    inp.setAttribute("aria-label", "Message input");

    var send = document.createElement("button");
    send.id = "ll-chat-send";
    send.setAttribute("aria-label", "Send message");
    send.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';

    inputArea.appendChild(inp);
    inputArea.appendChild(send);

    win.appendChild(header);
    win.appendChild(msgs);
    win.appendChild(inputArea);

    // Toggle button
    var toggle = document.createElement("button");
    toggle.id = "ll-chat-toggle";
    toggle.setAttribute("aria-label", "Open LeadLock onboarding chat");
    toggle.setAttribute("aria-expanded", "false");
    toggle.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' +
      "</svg>";

    wrapper.appendChild(win);
    wrapper.appendChild(toggle);
    document.body.appendChild(wrapper);

    // Store refs
    toggleBtn = toggle;
    chatWindow = win;
    messagesEl = msgs;
    inputEl = inp;
    sendBtn = send;

    // ── Event listeners ────────────────────────────────────────────────────
    toggle.addEventListener("click", toggleChat);
    document.getElementById("ll-chat-close").addEventListener("click", closeChat);
    send.addEventListener("click", handleSend);

    inp.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    // Auto-resize textarea
    inp.addEventListener("input", function () {
      inp.style.height = "auto";
      inp.style.height = Math.min(inp.scrollHeight, 80) + "px";
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildWidget);
  } else {
    buildWidget();
  }
})();
