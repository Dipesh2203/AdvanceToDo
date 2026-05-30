const messages = document.getElementById("messages");
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const connectionStatus = document.getElementById("connectionStatus");
const submitButton = chatForm ? chatForm.querySelector("button") : null;

const CHAT_API_ENDPOINT = "/api/chatbot/diary";

if (!messages || !chatForm || !userInput || !connectionStatus || !submitButton) {
    // The script is shared and should no-op on pages that do not mount the chatbot UI.
    console.warn("[chatbot] Chat UI elements were not found. Skipping chatbot setup.");
} else {
    initializeChatbot();
}

function setStatus(text) {
    if (connectionStatus) {
        connectionStatus.textContent = text;
    }
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatInlineMarkdown(text) {
    const escaped = escapeHtml(text);
    return escaped
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

function renderAssistantMessageFallback(content) {
    const lines = String(content || '').replace(/\r\n/g, '\n').split('\n');
    const html = [];
    let inList = false;

    const closeList = () => {
        if (inList) {
            html.push('</ul>');
            inList = false;
        }
    };

    for (const rawLine of lines) {
        const line = rawLine.trim();

        if (!line) {
            closeList();
            continue;
        }

        if (/^###\s+/.test(line)) {
            closeList();
            html.push(`<h3>${formatInlineMarkdown(line.replace(/^###\s+/, ''))}</h3>`);
            continue;
        }

        if (/^##\s+/.test(line)) {
            closeList();
            html.push(`<h2>${formatInlineMarkdown(line.replace(/^##\s+/, ''))}</h2>`);
            continue;
        }

        if (/^#\s+/.test(line)) {
            closeList();
            html.push(`<h1>${formatInlineMarkdown(line.replace(/^#\s+/, ''))}</h1>`);
            continue;
        }

        if (/^[-*]\s+/.test(line)) {
            if (!inList) {
                html.push('<ul>');
                inList = true;
            }
            html.push(`<li>${formatInlineMarkdown(line.replace(/^[-*]\s+/, ''))}</li>`);
            continue;
        }

        closeList();
        html.push(`<p>${formatInlineMarkdown(line)}</p>`);
    }

    closeList();
    return html.join('');
}

function renderAssistantMessage(content) {
    if (window.marked && window.DOMPurify) {
        const markdown = String(content || '');
        const parsed = window.marked.parse(markdown, {
            breaks: true,
            gfm: true,
        });
        return window.DOMPurify.sanitize(parsed);
    }

    return renderAssistantMessageFallback(content);
}

function setMessageContent(bubble, role, content) {
    if (role === 'assistant') {
        bubble.innerHTML = renderAssistantMessage(content);
    } else {
        bubble.textContent = content;
    }
    messages.scrollTop = messages.scrollHeight;
}

function addMessage(role, content) {
    const bubble = document.createElement('div');
    bubble.className = `message ${role}`;
    setMessageContent(bubble, role, content);
    messages.appendChild(bubble);
    return bubble;
}

function getErrorText(errorMessage) {
    const text = String(errorMessage || '').trim();
    if (/401|unauthorized|sign in|login/i.test(text)) {
        return "Sign in required to use the diary assistant.";
    }
    if (/429|rate limit|too many requests/i.test(text)) {
        return "Too many requests. Try again in a moment.";
    }
    return text || "Request failed.";
}

async function sendMessage(text) {
    const prompt = text.trim();
    if (!prompt) {
        setStatus("Type a message first.");
        return;
    }

    submitButton.disabled = true;
    userInput.disabled = true;
    setStatus("Thinking...");

    addMessage("user", prompt);
    userInput.value = "";

    const assistantBubble = addMessage("assistant", "");

    try {
        const response = await fetch(CHAT_API_ENDPOINT, {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                message: prompt,
            }),
        });

        if (response.status === 401) {
            throw new Error("Unauthorized");
        }

        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload && payload.error ? payload.error : "Request failed.");
        }

        const payload = await response.json().catch(() => ({}));
        const reply = payload && payload.result && typeof payload.result.answer === "string"
            ? payload.result.answer.trim()
            : "No response returned.";

        setMessageContent(assistantBubble, "assistant", reply || "No response returned.");
        setStatus("Ready");
    } catch (error) {
        const errorText = getErrorText(error.message);
        setMessageContent(assistantBubble, "assistant", errorText);
        setStatus(errorText);
    } finally {
        submitButton.disabled = false;
        userInput.disabled = false;
    }
}

function handleSubmit(event) {
    event.preventDefault();

    sendMessage(userInput.value).then(() => {
        userInput.focus();
    });
}

function initializeChatbot() {
    chatForm.addEventListener("submit", handleSubmit);
    addMessage("assistant", "Ask me about your diary progress, next tasks, or skill focus.");
    setStatus("Ready");
}


