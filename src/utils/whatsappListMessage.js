// src/utils/whatsappListMessage.js
//
// Builds and sends a WhatsApp Cloud API "interactive list" message
// from a chatbot "Text + List" node, and reads the customer's reply.
//
// WhatsApp limits (enforced here so Meta never rejects the request):
//   body 1024 chars | header 60 | footer 60 | menu button text 20
//   row title 24    | row id 200 | max 10 rows in total

const LIMITS = {
  body: 1024,
  header: 60,
  footer: 60,
  button: 20,
  section: 24,
  rowTitle: 24,
  rowId: 200,
  rows: 10
};

const clip = (value, max) => String(value ?? '').trim().slice(0, max);

/**
 * Build the JSON payload for POST /{phone-number-id}/messages
 * @param {string} to    customer phone number (digits, with country code)
 * @param {object} data  the node's `data` object (message/body, buttons, header, footer, buttonText)
 */
export function buildListPayload(to, data = {}) {
  const body = clip(data.body || data.message, LIMITS.body);
  if (!body) {
    throw new Error('List message body text is empty');
  }

  const source = Array.isArray(data.buttons)
    ? data.buttons
    : (Array.isArray(data.rows) ? data.rows : []);

  const usedIds = new Set();
  const rows = [];
  for (const item of source) {
    if (rows.length >= LIMITS.rows) break;
    const title = clip(item?.text ?? item?.title, LIMITS.rowTitle);
    if (!title) continue;

    let id = clip(item?.id, LIMITS.rowId) || `row_${rows.length + 1}`;
    while (usedIds.has(id)) id = `${id}_${rows.length + 1}`;
    usedIds.add(id);

    rows.push({ id, title });
  }

  if (rows.length === 0) {
    throw new Error('List message needs at least one list item');
  }

  const menuButton =
    clip(
      data.buttonText || data.menuButtonText || data.menu_button_text || data.button_text,
      LIMITS.button
    ) || 'View Menu';

  const interactive = {
    type: 'list',
    body: { text: body },
    action: {
      button: menuButton,
      sections: [
        {
          title: clip(data.sectionTitle || 'Menu', LIMITS.section) || 'Menu',
          rows
        }
      ]
    }
  };

  const header = clip(data.header, LIMITS.header);
  if (header) interactive.header = { type: 'text', text: header };

  const footer = clip(data.footer, LIMITS.footer);
  if (footer) interactive.footer = { text: footer };

  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: String(to || '').replace(/\D/g, ''),
    type: 'interactive',
    interactive
  };
}

/**
 * Send the list message through the WhatsApp Cloud API.
 * Returns { messageId, raw } or throws an Error (error.metaError holds Meta's error object).
 */
export async function sendListMessage({ phoneNumberId, accessToken, to, data, apiVersion }) {
  if (!phoneNumberId || !accessToken) {
    throw new Error('phoneNumberId and accessToken are required to send a list message');
  }

  const version = apiVersion || process.env.META_API_VERSION || 'v23.0';
  const payload = buildListPayload(to, data);

  const res = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json?.error?.message || `WhatsApp API error ${res.status}`);
    err.metaError = json?.error || null;
    throw err;
  }

  return { messageId: json?.messages?.[0]?.id || null, raw: json };
}

/**
 * Read what the customer tapped from an incoming webhook message.
 * List reply id === the list item's id, so it matches the edge `sourceHandle` in the flow.
 * Returns { kind: 'list' | 'button', id, title } or null for normal text messages.
 */
export function getInteractiveReply(message) {
  const list = message?.interactive?.list_reply;
  if (list) return { kind: 'list', id: list.id, title: list.title };

  const button = message?.interactive?.button_reply;
  if (button) return { kind: 'button', id: button.id, title: button.title };

  return null;
}